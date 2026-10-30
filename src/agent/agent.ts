import fs from "fs";
import path from "path";
import { AUM } from "../core/aum";
import type { AgentManifest } from "../engine/types";
import { SarvamClient } from "../llm/sarvam";
import { IntegrationResolver } from "../integration/integration";
import type { MemoryProvider } from "../integration/types";
import { ReActLoop } from "./loop";
import type { AgentTool, AgentContext, AgentRunResult, AgentExecutionOptions } from "./types";

export interface AgentConfigOptions {
  manifest?: string | AgentManifest;
  name?: string;
  version?: string;
  intent?: string;
  model?: string;
  memory?: string;
  tools?: AgentTool[];
  apiKey?: string;
}

export class Agent {
  public readonly name: string;
  public readonly version: string;
  public readonly intent: string;
  public readonly manifest?: AgentManifest;
  private memory: MemoryProvider;
  private llm: SarvamClient;
  private tools: Map<string, AgentTool> = new Map();
  private maxSteps: number = 10;

  constructor(options: AgentConfigOptions = {}) {
    let resolvedManifest: AgentManifest | undefined;

    if (typeof options.manifest === "string") {
      const manifestPath = path.resolve(process.cwd(), options.manifest);
      const raw = fs.readFileSync(manifestPath, "utf-8");
      resolvedManifest = AUM.resolveEnvironment(AUM.parse(raw));
    } else if (typeof options.manifest === "object") {
      resolvedManifest = AUM.resolveEnvironment(AUM.parse(options.manifest));
    }

    this.manifest = resolvedManifest;

    // Resolve Name, Version, and Intent from manifest or programmatic options
    this.name = options.name || resolvedManifest?.A?.name || "unnamed_agent";
    this.version = options.version || resolvedManifest?.A?.version || "1.0.0";
    this.intent = options.intent || resolvedManifest?.A?.intent || "Autonomous AI Agent";
    this.maxSteps = resolvedManifest?.A?.maxSteps ?? 10;

    // Resolve Memory Provider ([I] Layer)
    const memoryConfig = options.memory || resolvedManifest?.I;
    this.memory = IntegrationResolver.resolveMemory(memoryConfig, {
      agentName: this.name,
      agentVersion: this.version
    });

    // Resolve LLM Provider ([L] Layer)
    const apiKey = options.apiKey || resolvedManifest?.E?.SARVAM_API_KEY || process.env.SARVAM_API_KEY;
    this.llm = new SarvamClient(apiKey);

    // Register initial tools
    if (options.tools) {
      for (const t of options.tools) {
        this.tools.set(t.name, t);
      }
    }
  }

  public registerTool(tool: AgentTool): void {
    this.tools.set(tool.name, tool);
  }

  public getMemory(): MemoryProvider {
    return this.memory;
  }

  public getContext(): AgentContext {
    return {
      agentName: this.name,
      agentVersion: this.version,
      sessionId: this.memory.sessionId,
      state: {
        intent: this.intent
      }
    };
  }

  public async run(input: string, options: AgentExecutionOptions = {}): Promise<AgentRunResult> {
    const allTools = [
      ...Array.from(this.tools.values()),
      ...(options.tools || [])
    ];

    const context = this.getContext();

    return ReActLoop.execute(
      input,
      this.llm,
      this.memory,
      allTools,
      context,
      {
        maxSteps: options.maxSteps ?? this.maxSteps,
        systemPrompt: options.systemPrompt,
        temperature: options.temperature
      }
    );
  }
}
