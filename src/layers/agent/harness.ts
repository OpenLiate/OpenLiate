import fs from "fs";
import path from "path";
import { AUM } from "../../core/aum";
import type { AgentManifest } from "../../core/types";
import { SarvamClient } from "../llm/sarvam";
import { IndiaAiClient } from "../llm/indiaai";
import { NeonAiGateway } from "../../catalog/neon/gateway";
import { normalizeModelConfig } from "../llm/config";
import { IntegrationResolver } from "../integration/knowledge";
import type { MemoryProvider } from "../integration/types";
import { ReActLoop, type LLMFunctionCaller } from "./loop";
import type { AgentTool, AgentContext, AgentRunResult, AgentExecutionOptions } from "./types";
import { ToolRegistry } from "../tools/registry";
import { EnvironmentResolver } from "../environment/sandbox";
import { ConfigManager } from "../../core/config";
import { OPENLIATE_VERSION } from "../../core/version";
import { SkillsResolver } from "./skills";

export interface AgentConfigOptions {
  manifest?: string | AgentManifest;
  name?: string;
  version?: string;
  intent?: string;
  model?: string;
  memory?: string | MemoryProvider;
  sessionId?: string;
  tools?: any[];
  apiKey?: string;
}

export class Agent {
  public readonly name: string;
  public readonly version: string;
  public readonly intent: string;
  public readonly model: string;
  public readonly manifest?: AgentManifest;
  public compiledSkills: string = "";
  private rawSkillsConfig?: string | string[];
  private manifestBaseDir: string = process.cwd();
  private memory: MemoryProvider;
  private llm: LLMFunctionCaller;
  private tools: Map<string, AgentTool> = new Map();
  private maxSteps: number = 10;
  private toolsInitialized: boolean = false;
  private rawToolSpecs: any[] = [];

  constructor(options: AgentConfigOptions = {}) {
    let resolvedManifest: AgentManifest | undefined;

    const manifestBaseDir = typeof options.manifest === "string"
      ? path.dirname(path.resolve(process.cwd(), options.manifest))
      : process.cwd();

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
    const aObj = typeof resolvedManifest?.A === "object" ? resolvedManifest.A : undefined;
    const aName = typeof resolvedManifest?.A === "string" ? resolvedManifest.A : aObj?.name;
    this.name = options.name || aName || "unnamed_agent";
    this.version = options.version || aObj?.version || "0.0.1";
    this.intent = options.intent || aObj?.intent || "Autonomous AI Agent";
    this.maxSteps = typeof (aObj as any)?.maxSteps === "number" ? (aObj as any).maxSteps : 10;

    // Resolve Layer [A] Skills (skills.md, SKILL.md, .openliate/skills, or hub/skills)
    this.manifestBaseDir = manifestBaseDir;
    this.rawSkillsConfig = (options as any).skills || (aObj as any)?.skills || (resolvedManifest?.I as any)?.skills;
    this.compiledSkills = SkillsResolver.compileSkills(this.rawSkillsConfig, manifestBaseDir);

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

    // Resolve LLM Provider ([L] Layer) — Multi-Provider Dynamic Routing
    const provider = resolvedModel.includes("/") ? resolvedModel.split("/")[0].toLowerCase() : "sarvam";

    if (provider === "neon") {
      this.llm = new NeonAiGateway();
    } else if (provider === "indiaai") {
      const soketKey = options.apiKey || resolvedManifest?.E?.SOKET_API_KEY || process.env.SOKET_API_KEY || ConfigManager.getKey("SOKET_API_KEY");
      this.llm = new IndiaAiClient(soketKey);
    } else {
      const apiKey = options.apiKey || resolvedManifest?.E?.SARVAM_API_KEY || process.env.SARVAM_API_KEY || ConfigManager.getKey("SARVAM_API_KEY");
      this.llm = new SarvamClient(apiKey);
    }

    // Collect tool specs from options or manifest ([T] Layer)
    if (options.tools) {
      this.rawToolSpecs.push(...options.tools);
    }
    if (resolvedManifest?.T) {
      if (Array.isArray(resolvedManifest.T)) {
        this.rawToolSpecs.push(...resolvedManifest.T);
      } else if (typeof resolvedManifest.T === "object") {
        if ("command" in resolvedManifest.T || "url" in resolvedManifest.T) {
          this.rawToolSpecs.push({ id: "inline_tool", name: "inline_tool", ...(resolvedManifest.T as Record<string, any>) });
        } else {
          for (const [key, val] of Object.entries(resolvedManifest.T as Record<string, any>)) {
            if (typeof val === "object" && val !== null) {
              this.rawToolSpecs.push({ id: key, name: key, ...val });
            } else {
              this.rawToolSpecs.push(key);
            }
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
        intent: this.intent,
        skills: this.compiledSkills
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

    // Resolve Layer [I] Context Integration (e.g. Neon Functions Context.dev)
    if (this.manifest?.I) {
      const contextTools = IntegrationResolver.resolveContextTools(this.manifest.I as any);
      for (const ct of contextTools) {
        if (!this.tools.has(ct.name)) {
          this.tools.set(ct.name, ct);
        }
      }
    }

    this.toolsInitialized = true;
  }

  public async run(input: string, options: AgentExecutionOptions = {}): Promise<AgentRunResult> {
    await this.initializeTools();

    if (!this.compiledSkills && this.rawSkillsConfig) {
      try {
        this.compiledSkills = await SkillsResolver.compileSkillsAsync(this.rawSkillsConfig, this.manifestBaseDir);
      } catch {}
    }

    const allTools = [
      ...Array.from(this.tools.values()),
      ...(options.tools || [])
    ];

    const context = this.getContext();

    let activeSystemPrompt = options.systemPrompt;
    if (this.compiledSkills) {
      if (activeSystemPrompt) {
        activeSystemPrompt = `${activeSystemPrompt}\n\n${this.compiledSkills}`;
      } else {
        const base = `You are ${this.name} (v${this.version}).\nYour mission and intent: ${this.intent || "Autonomous AI Agent"}.\nFollow the ReAct methodology: Reason about the user's request, select tools if needed, observe outputs, and provide a clear final answer.`;
        activeSystemPrompt = `${base}\n\n${this.compiledSkills}`;
      }
    }

    return ReActLoop.execute(
      input,
      this.llm,
      this.memory,
      allTools,
      context,
      {
        model: options.model ?? this.model,
        maxSteps: options.maxSteps ?? this.maxSteps,
        systemPrompt: activeSystemPrompt,
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

export function createAgent(options?: AgentConfigOptions | string): Agent {
  return new Agent(typeof options === "string" ? { manifest: options } : options);
}

export function create(options?: AgentConfigOptions | string): Agent {
  return createAgent(options);
}
