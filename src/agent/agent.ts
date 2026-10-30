import fs from "fs";
import path from "path";
import { AUM } from "../core/aum";
import type { AgentManifest } from "../engine/types";
import { SarvamClient } from "../llm/sarvam";
import { normalizeModelConfig } from "../llm/config";
import { IntegrationResolver } from "../integration/integration";
import type { MemoryProvider } from "../integration/types";
import { ReActLoop } from "./loop";
import type { AgentTool, AgentContext, AgentRunResult, AgentExecutionOptions } from "./types";
import { ToolRegistry } from "../tools/registry";
import { EnvironmentResolver } from "../environment/environment";

export interface AgentConfigOptions {
  manifest?: string | AgentManifest;
  name?: string;
  version?: string;
  intent?: string;
  model?: string;
  memory?: string;
  tools?: Array<string | AgentTool>;
  apiKey?: string;
}

export class Agent {
  public readonly name: string;
  public readonly version: string;
  public readonly intent: string;
  public readonly model: string;
  public readonly manifest?: AgentManifest;
  private memory: MemoryProvider;
  private llm: SarvamClient;
  private tools: Map<string, AgentTool> = new Map();
  private maxSteps: number = 10;
  private toolsInitialized: boolean = false;
  private rawToolSpecs: Array<string | AgentTool> = [];

  constructor(options: AgentConfigOptions = {}) {
    let resolvedManifest: AgentManifest | undefined;

    if (typeof options.manifest === "string") {
      const manifestPath = path.resolve(process.cwd(), options.manifest);
      EnvironmentResolver.loadEnv(manifestPath);
      const raw = fs.readFileSync(manifestPath, "utf-8");
      resolvedManifest = AUM.resolveEnvironment(AUM.parse(raw));
    } else if (typeof options.manifest === "object") {
      EnvironmentResolver.loadEnv();
      resolvedManifest = AUM.resolveEnvironment(AUM.parse(options.manifest));
    }

    this.manifest = resolvedManifest;

    // Resolve Name, Version, and Intent from manifest or programmatic options
    this.name = options.name || resolvedManifest?.A?.name || "unnamed_agent";
    this.version = options.version || resolvedManifest?.A?.version || "1.0.0";
    this.intent = options.intent || resolvedManifest?.A?.intent || "Autonomous AI Agent";
    this.maxSteps = resolvedManifest?.A?.maxSteps ?? 10;

    // Resolve Model ([L] Layer) - strictly dynamic, no hardcoding
    const normalizedL = resolvedManifest?.L ? normalizeModelConfig(resolvedManifest.L) : undefined;
    const resolvedModel = options.model || normalizedL?.model;
    if (!resolvedModel) {
      throw new Error("Missing required model definition in Layer [L]");
    }
    this.model = resolvedModel;

    // Resolve Memory Provider ([I] Layer)
    const memoryConfig = options.memory || resolvedManifest?.I;
    this.memory = IntegrationResolver.resolveMemory(memoryConfig, {
      agentName: this.name,
      agentVersion: this.version
    });

    // Resolve LLM Provider ([L] Layer)
    const apiKey = options.apiKey || resolvedManifest?.E?.SARVAM_API_KEY || process.env.SARVAM_API_KEY;
    this.llm = new SarvamClient(apiKey);

    // Collect tool specs from options or manifest ([T] Layer)
    if (options.tools) {
      this.rawToolSpecs.push(...options.tools);
    }
    if (resolvedManifest?.T && Array.isArray(resolvedManifest.T)) {
      this.rawToolSpecs.push(...resolvedManifest.T);
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

  public async getTools(): Promise<AgentTool[]> {
    await this.initializeTools();
    return Array.from(this.tools.values());
  }

  public async initializeTools(): Promise<void> {
    if (this.toolsInitialized) return;

    if (this.rawToolSpecs.length > 0) {
      const customEnv = (this.manifest?.E as Record<string, string>) || process.env;
      const resolved = await ToolRegistry.resolveTools(this.rawToolSpecs, customEnv);
      for (const t of resolved) {
        this.tools.set(t.name, t);
      }
    }

    this.toolsInitialized = true;
  }

  public async run(input: string, options: AgentExecutionOptions = {}): Promise<AgentRunResult> {
    await this.initializeTools();

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
        model: options.model ?? this.model,
        maxSteps: options.maxSteps ?? this.maxSteps,
        systemPrompt: options.systemPrompt,
        temperature: options.temperature
      }
    );
  }
}
