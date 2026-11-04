import fs from "fs";
import path from "path";
import { AUM } from "../../core/aum";
import type { AgentManifest } from "../../core/types";
import { SarvamClient } from "../llm/sarvam";
import { normalizeModelConfig } from "../llm/config";
import { IntegrationResolver } from "../integration/knowledge";
import type { MemoryProvider } from "../integration/types";
import { ReActLoop, type LLMFunctionCaller } from "./loop";
import type { AgentTool, AgentContext, AgentRunResult, AgentExecutionOptions } from "./types";
import { ToolRegistry } from "../tools/registry";
import { EnvironmentResolver } from "../environment/sandbox";
import { ConfigManager } from "../../core/config";

export interface AgentConfigOptions {
  manifest?: string | AgentManifest;
  name?: string;
  version?: string;
  intent?: string;
  model?: string;
  memory?: string | MemoryProvider;
  sessionId?: string;
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
  private llm: LLMFunctionCaller;
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
    if (options.memory && typeof options.memory === "object" && "append" in options.memory) {
      this.memory = options.memory as MemoryProvider;
    } else {
      const memoryConfig = options.memory || resolvedManifest?.I;
      const sId = options.sessionId || (typeof resolvedManifest?.I === "object" ? (resolvedManifest.I as any).sessionId || (resolvedManifest.I as any).session : undefined);
      this.memory = IntegrationResolver.resolveMemory(memoryConfig, {
        agentName: this.name,
        agentVersion: this.version
      }, sId);
    }

    // Resolve LLM Provider ([L] Layer) — Sarvam AI Sovereign Stack
    const apiKey = options.apiKey || resolvedManifest?.E?.SARVAM_API_KEY || process.env.SARVAM_API_KEY || ConfigManager.getKey("SARVAM_API_KEY");
    this.llm = new SarvamClient(apiKey);

    // Collect tool specs from options or manifest ([T] Layer)
    if (options.tools) {
      this.rawToolSpecs.push(...options.tools);
    }
    if (resolvedManifest?.T) {
      if (Array.isArray(resolvedManifest.T)) {
        this.rawToolSpecs.push(...resolvedManifest.T);
      } else if (typeof resolvedManifest.T === "object") {
        for (const [key, val] of Object.entries(resolvedManifest.T)) {
          if (typeof val === "object" && val !== null) {
            this.rawToolSpecs.push({ id: key, name: key, ...val });
          } else {
            this.rawToolSpecs.push(key);
          }
        }
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

  /**
   * Converts this Agent into a standard Web Request / API Route handler.
   * Compatible with Next.js App Router (route.ts), Vercel Edge, Hono, Node.js, and Cloudflare Workers.
   *
   * Usage:
   *   export const POST = agent.toHandler();
   */
  public toHandler(): (req: Request) => Promise<Response> {
    return async (req: Request): Promise<Response> => {
      try {
        let body: any = {};
        if (req.method === "POST") {
          body = await req.json();
        }

        const prompt = body.prompt || body.message || body.input;
        if (!prompt || typeof prompt !== "string") {
          return new Response(
            JSON.stringify({ error: "Missing required 'prompt' string in request body." }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }

        const sessionId = body.sessionId || body.session;
        if (sessionId && this.memory && typeof (this.memory as any).setSessionId === "function") {
          (this.memory as any).setSessionId(sessionId);
        }

        const result = await this.run(prompt, {
          model: body.model,
          maxSteps: body.maxSteps,
          systemPrompt: body.systemPrompt
        });

        return new Response(
          JSON.stringify({
            text: result.text,
            thought: result.thought,
            model: result.model,
            steps: result.totalSteps,
            durationMs: result.durationMs,
            agent: {
              name: this.name,
              version: this.version
            }
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      } catch (err: any) {
        return new Response(
          JSON.stringify({ error: err.message || "Agent execution failed." }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }
    };
  }
}
