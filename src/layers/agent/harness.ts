import fs from "fs";
import path from "path";
import { AUM } from "../../core/aum";
import { ConfigManager, type AgentModule } from "../../core/spec";
import { UniversalLlmClient, normalizeModelConfig } from "../llm/model";
import { IntegrationResolver, LiateKnowledge, type KnowledgeContext } from "../integration/knowledge";
import { LiateRepo, type RepoContext } from "../integration/repo";
import { LiateLib } from "../integration/lib";
import type { MemoryProvider } from "../integration/types";
import { ReActLoop, type LLMFunctionCaller } from "./loop";
import type { AgentTool, AgentContext, AgentRunResult, AgentExecutionOptions } from "./types";
import { ToolRegistry } from "../tools/registry";
import { EnvironmentResolver } from "../environment/sandbox";
import { OPENLIATE_VERSION } from "../../core/version";
import { SkillsResolver } from "./skills";

export interface AgentOptions {
  module?: string | AgentModule;
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
  public readonly module?: AgentModule;
  public compiledSkills: string = "";
  public repoContext?: RepoContext;
  public knowledgeContext?: KnowledgeContext;
  private rawSkillsConfig?: string | string[];
  private moduleBaseDir: string = process.cwd();
  private memory: MemoryProvider;
  private llm: LLMFunctionCaller;
  private tools: Map<string, AgentTool> = new Map();
  private maxSteps: number = 10;
  private toolsInitialized: boolean = false;
  private rawToolSpecs: any[] = [];

  constructor(options: AgentOptions = {}) {
    let resolvedModule: AgentModule | undefined;

    const moduleBaseDir = typeof options.module === "string"
      ? path.dirname(path.resolve(process.cwd(), options.module))
      : process.cwd();

    if (typeof options.module === "string") {
      const modulePath = path.resolve(process.cwd(), options.module);
      EnvironmentResolver.loadEnv(modulePath);
      const raw = fs.readFileSync(modulePath, "utf-8");
      resolvedModule = AUM.resolveEnvironment(AUM.parse(raw));
    } else if (typeof options.module === "object") {
      EnvironmentResolver.loadEnv();
      resolvedModule = AUM.resolveEnvironment(AUM.parse(options.module));
    }

    this.module = resolvedModule;

    // Resolve Name, Version, and Intent from module or programmatic options
    const aObj = typeof resolvedModule?.A === "object" ? resolvedModule.A : undefined;
    const aName = typeof resolvedModule?.A === "string" ? resolvedModule.A : aObj?.name;
    this.name = options.name || aName || "unnamed_agent";
    this.version = options.version || aObj?.version || "0.0.1";
    this.intent = options.intent || aObj?.intent || "Autonomous AI Agent";
    this.maxSteps = typeof (aObj as any)?.maxSteps === "number" ? (aObj as any).maxSteps : 10;

    // Resolve Layer [A] Skills (skills.md, SKILL.md, .openliate/skills, or hub/skills)
    this.moduleBaseDir = moduleBaseDir;
    this.rawSkillsConfig = (options as any).skills || (aObj as any)?.skills || (resolvedModule?.I as any)?.skills;
    this.compiledSkills = SkillsResolver.compileSkills(this.rawSkillsConfig, moduleBaseDir);

    // Resolve Model ([L] Layer) - strictly dynamic, no hardcoding
    const normalizedL = resolvedModule?.L ? normalizeModelConfig(resolvedModule.L) : undefined;
    const resolvedModel = options.model || normalizedL?.model;
    if (!resolvedModel) {
      throw new Error("Missing required model definition in Layer [L]");
    }
    this.model = resolvedModel;

    // Resolve Memory Provider ([I] Layer)
    if (options.memory && typeof options.memory === "object" && "append" in options.memory) {
      this.memory = options.memory as MemoryProvider;
    } else {
      const memoryConfig = options.memory || resolvedModule?.I;
      const sId = options.sessionId || (typeof resolvedModule?.I === "object" ? (resolvedModule.I as any).sessionId || (resolvedModule.I as any).session : undefined);
      this.memory = IntegrationResolver.resolveMemory(memoryConfig, {
        agentName: this.name,
        agentVersion: this.version
      }, sId);
    }

    // Resolve LLM Provider ([L] Layer) — Multi-Provider Dynamic Routing
    const provider = resolvedModel.includes("/") ? resolvedModel.split("/")[0].toLowerCase() : "sarvam";

    const resolvedApiKey = options.apiKey
      || (provider === "neon" ? (resolvedModule?.E?.NEON_AI_GATEWAY_TOKEN || process.env.NEON_AI_GATEWAY_TOKEN || ConfigManager.getKey("NEON_AI_GATEWAY_TOKEN"))
                              : (resolvedModule?.E?.SARVAM_API_KEY || process.env.SARVAM_API_KEY || ConfigManager.getKey("SARVAM_API_KEY")));
    this.llm = new UniversalLlmClient(resolvedApiKey, { provider });

    // Collect tool specs from options or module ([T] Layer)
    if (options.tools) {
      this.rawToolSpecs.push(...options.tools);
    }
    if (resolvedModule?.T) {
      if (Array.isArray(resolvedModule.T)) {
        this.rawToolSpecs.push(...resolvedModule.T);
      } else if (typeof resolvedModule.T === "object") {
        if ("command" in resolvedModule.T || "url" in resolvedModule.T) {
          this.rawToolSpecs.push({ id: "inline_tool", name: "inline_tool", ...(resolvedModule.T as Record<string, any>) });
        } else {
          for (const [key, val] of Object.entries(resolvedModule.T as Record<string, any>)) {
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
        skills: this.compiledSkills,
        repo: this.repoContext,
        knowledge: this.knowledgeContext
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
      const moduleKeys = ((this.module as any)?.keys as Record<string, string>) || {};
      const moduleEnv = ((this.module as any)?.env as Record<string, string>) || {};
      const rawE = (this.module?.E as Record<string, string>) || {};

      // Build customEnv with real secret values taking priority over literal $VAR placeholders
      const customEnv: Record<string, string | undefined> = {
        ...process.env,
        ...moduleEnv,
        ...moduleKeys
      };

      for (const [k, v] of Object.entries(rawE)) {
        if (typeof v === "string" && v.startsWith("$")) {
          const varName = v.slice(1);
          const resolvedVal = moduleKeys[k] || moduleKeys[varName] || moduleEnv[k] || moduleEnv[varName] || process.env[k] || process.env[varName];
          if (resolvedVal) {
            customEnv[k] = resolvedVal;
          }
        } else if (v && !customEnv[k]) {
          customEnv[k] = v;
        }
      }

      const resolved = await ToolRegistry.resolveTools(this.rawToolSpecs, customEnv);
      for (const t of resolved) {
        this.tools.set(t.name, t);
      }
    }

    // Resolve Layer [I] Context Integration (e.g. Neon Functions Context.dev)
    if (this.module?.I) {
      const iBlock = this.module.I as any;
      const contextTools = IntegrationResolver.resolveContextTools(iBlock);
      for (const ct of contextTools) {
        if (!this.tools.has(ct.name)) {
          this.tools.set(ct.name, ct);
        }
      }

      // 1. Repo Integration
      if (iBlock.repo) {
        try {
          const repoTarget = typeof iBlock.repo === "string" ? iBlock.repo : iBlock.repo.target || ".";
          const repoOpts = typeof iBlock.repo === "object" ? iBlock.repo : undefined;
          this.repoContext = await LiateRepo.resolveContext(repoTarget, repoOpts);
        } catch (err: any) {
          console.warn(`[OpenLiate Layer I] Repo resolution notice: ${err.message}`);
        }
      }

      // 2. Lib Integration
      if (iBlock.lib) {
        try {
          const loadedLibs = await LiateLib.resolveLibs(iBlock.lib);
          const libTools = LiateLib.asTools(loadedLibs);
          for (const lt of libTools) {
            if (!this.tools.has(lt.name)) {
              this.tools.set(lt.name, lt);
            }
          }
        } catch (err: any) {
          console.warn(`[OpenLiate Layer I] Lib resolution notice: ${err.message}`);
        }
      }

      // 3. Knowledge Integration
      if (iBlock.knowledge) {
        try {
          this.knowledgeContext = await LiateKnowledge.resolve(iBlock.knowledge, this.moduleBaseDir);
          const kTool = LiateKnowledge.asTool(this.knowledgeContext);
          if (!this.tools.has(kTool.name)) {
            this.tools.set(kTool.name, kTool);
          }
        } catch (err: any) {
          console.warn(`[OpenLiate Layer I] Knowledge resolution notice: ${err.message}`);
        }
      }
    }

    // Resolve Layer [A] Subagents & Agent Swarm delegation
    const aObj = typeof this.module?.A === "object" ? this.module.A : undefined;
    const subagents: (string | any)[] = (aObj as any)?.subagents || (aObj as any)?.agents || [];
    if (Array.isArray(subagents)) {
      for (const sub of subagents) {
        const subName = typeof sub === "string" ? sub : sub?.name;
        if (!subName) continue;
        const toolName = `delegate_to_${subName.replace(/[^a-zA-Z0-9_]/g, "_")}`;
        if (!this.tools.has(toolName)) {
          this.tools.set(toolName, {
            name: toolName,
            description: `Delegate a sub-task or question to the subagent '${subName}'.`,
            parameters: {
              type: "object",
              properties: {
                task: { type: "string", description: "The task or prompt to pass to the subagent." }
              },
              required: ["task"]
            },
            execute: async (args: any) => {
              const taskPrompt = args.task || args.prompt || "";
              const subPaths = [
                path.resolve(process.cwd(), ".openliate", "agents", subName, "agent.json"),
                path.resolve(process.cwd(), "hub", "agents", subName, "agent.json"),
                path.resolve(process.cwd(), "hub", "agents", `${subName}-agent`, "agent.json")
              ];
              let subAgentInstance: Agent | null = null;
              for (const p of subPaths) {
                if (fs.existsSync(p)) {
                  subAgentInstance = new Agent({ module: p });
                  break;
                }
              }
              if (!subAgentInstance) {
                subAgentInstance = new Agent({
                  module: {
                    L: this.model,
                    A: { name: subName, intent: `Subagent ${subName}` }
                  }
                });
              }
              const res = await subAgentInstance.run(taskPrompt);
              return { answer: res.text, steps: res.totalSteps, subagent: subName };
            }
          });
        }
      }
    }

    this.toolsInitialized = true;
  }

  public async run(input: string, options: AgentExecutionOptions = {}): Promise<AgentRunResult> {
    await this.initializeTools();

    if (!this.compiledSkills && this.rawSkillsConfig) {
      try {
        this.compiledSkills = await SkillsResolver.compileSkillsAsync(this.rawSkillsConfig, this.moduleBaseDir);
      } catch {}
    }

    const allTools = [
      ...Array.from(this.tools.values()),
      ...(options.tools || [])
    ];

    const context = this.getContext();

    let activeSystemPrompt = options.systemPrompt;
    if (this.repoContext) {
      const repoSummary = `\n\nRepository Context (${this.repoContext.repo}):\nBranch: ${this.repoContext.branch || "main"}\nFiles (${this.repoContext.files?.length || 0}): ${this.repoContext.files?.slice(0, 30).join(", ") || "none"}${this.repoContext.readme ? `\nREADME excerpt:\n${this.repoContext.readme.slice(0, 500)}` : ""}`;
      activeSystemPrompt = activeSystemPrompt ? `${activeSystemPrompt}${repoSummary}` : `You are ${this.name} (v${this.version}).\nYour mission: ${this.intent}.${repoSummary}`;
    }

    if (this.knowledgeContext && this.knowledgeContext.documents.length > 0) {
      const kSummary = `\n\nKnowledge Base (${this.knowledgeContext.documents.length} docs loaded):\n` +
        this.knowledgeContext.documents.slice(0, 3).map(d => `[${d.title || d.source}]: ${d.content.slice(0, 300)}...`).join("\n");
      activeSystemPrompt = activeSystemPrompt ? `${activeSystemPrompt}${kSummary}` : kSummary;
    }

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

export function createAgent(options?: AgentOptions | string): Agent {
  return new Agent(typeof options === "string" ? { module: options } : options);
}

export function create(options?: AgentOptions | string): Agent {
  return createAgent(options);
}
