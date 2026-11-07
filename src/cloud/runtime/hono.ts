import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import path from "path";
import fs from "fs";
import { Agent } from "../../layers/agent/harness";
import { EnvironmentResolver } from "../../layers/environment/sandbox";
import { MCP } from "../../layers/tools/mcp";
import { ToolRegistry } from "../../layers/tools/registry";
import type { MemoryProvider } from "../../layers/integration/types";
import { InMemorySession } from "../../layers/integration/memory";
import { LLMRouter, HubResolver } from "../../layers/llm/model";
import { OPENLIATE_VERSION } from "../../core/version";
import { resilientFetch } from "../../core/fetch.js";
import { skillsRouter } from "../../routes/skills";

const globalSessionStore = new Map<string, MemoryProvider>();

export interface RuntimeServerOptions {
  port?: number;
  host?: string;
}

export function createRuntimeApp() {
  const app = new Hono();

  // Enable CORS
  app.use("*", cors());

  // Mount Skills Router (skills.sh & Edge Dynamic Resolver)
  app.route("/api/v1/skills", skillsRouter);
  app.route("/skills", skillsRouter);

  // Health and runtime information
  app.get("/health", (c) => {
    return c.json({
      status: "ok",
      runtime: "openliate",
      version: OPENLIATE_VERSION,
      protocol: "Liate API v1",
      gateway: "Sarvam AI & Neon AI Gateway",
      doctrine: "OpenLiate — Built for Sovereign AI Agents From India to the World",
      uptime: typeof process !== "undefined" && typeof process.uptime === "function" ? process.uptime() : 0,
      timestamp: new Date().toISOString()
    });
  });

  app.get("/", (c) => {
    return c.json({
      name: "OpenLiate",
      version: OPENLIATE_VERSION,
      status: "running",
      gateway: "Sarvam AI & Neon AI Gateway",
      doctrine: "OpenLiate — Built for Sovereign AI Agents From India to the World",
      endpoints: {
        chat: "POST /chat",
        models: "GET /models",
        openliate_hub: "GET /hub",
        openliate_agents: "GET /hub/agents",
        openliate_llm: "GET /hub/llm",
        openliate_mcp: "GET /hub/mcp",
        openliate_skills: "GET /api/v1/skills",
        openliate_skills_resolve: "POST /api/v1/skills/resolve",
        openliate_run: "POST /run",
        health: "GET /health",
        openai_chat: "POST /v1/chat/completions",
        openai_models: "GET /v1/models"
      }
    });
  });

  // =========================================================================
  // Models & Chat Routes
  // =========================================================================

  const handleGetModels = async (c: any) => {
    const list: any[] = [];
    const seenIds = new Set<string>();

    // 1. Live model discovery from Sarvam AI Token Factory v2
    const sarvamKey = (typeof process !== "undefined" && process.env) ? process.env.SARVAM_API_KEY : undefined;
    if (sarvamKey) {
      try {
        const res = await resilientFetch("https://api.sarvam.ai/v2/models", {
          headers: {
            "api-subscription-key": sarvamKey,
            Authorization: `Bearer ${sarvamKey}`
          },
          signal: AbortSignal.timeout(1500)
        });
        if (res.ok) {
          const data: any = await res.json();
          const items = Array.isArray(data) ? data : (data.data || []);
          for (const m of items) {
            const id = typeof m === "string" ? m : m.id;
            if (id && !seenIds.has(id)) {
              seenIds.add(id);
              list.push({
                id,
                object: "model",
                created: 1740000000,
                owned_by: "sarvam-ai",
                description: `Sarvam Token Factory v2 (${id}) Model`
              });
            }
          }
        }
      } catch {}
    }

    // 2. Live model discovery from Neon AI Gateway (branch-scoped)
    const neonBaseUrl = (typeof process !== "undefined" && process.env) ? process.env.NEON_AI_GATEWAY_BASE_URL : undefined;
    const neonToken = (typeof process !== "undefined" && process.env) ? process.env.NEON_AI_GATEWAY_TOKEN : undefined;
    if (neonBaseUrl && neonToken) {
      try {
        const rawBase = neonBaseUrl.replace(/\/+$/, "");
        const v1Base = rawBase.endsWith("/v1") ? rawBase : `${rawBase}/v1`;
        const res = await resilientFetch(`${v1Base}/models`, {
          headers: {
            Authorization: `Bearer ${neonToken}`
          },
          signal: AbortSignal.timeout(1500)
        });
        if (res.ok) {
          const data: any = await res.json();
          const items = Array.isArray(data) ? data : (data.data || []);
          for (const m of items) {
            const id = typeof m === "string" ? m : m.id;
            if (id && !seenIds.has(id)) {
              seenIds.add(id);
              list.push({
                id,
                object: "model",
                created: 1740000000,
                owned_by: "neon-ai-gateway",
                description: `Neon AI Gateway (${id}) Model`
              });
            }
          }
        }
      } catch {}
    }

    return c.json({
      object: "list",
      data: list
    });
  };

  app.get("/v1/models", handleGetModels);
  app.get("/api/v1/models", handleGetModels);
  app.get("/models", handleGetModels);

  const handleChatCompletions = async (c: any) => {
    let body: any = {};
    try {
      body = await c.req.json();
    } catch {
      return c.json(
        {
          error: {
            message: "Invalid JSON in request body",
            type: "invalid_request_error",
            code: 400
          }
        },
        400
      );
    }

    let messages = body.messages;
    if (!messages && (body.prompt || body.message)) {
      messages = [{ role: "user", content: body.prompt || body.message }];
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return c.json(
        {
          error: {
            message: "Missing or invalid 'messages' array or 'prompt' in request body",
            type: "invalid_request_error",
            code: 400
          }
        },
        400
      );
    }

    // Extract authorization key if provided (Bearer ...)
    const authHeader = c.req.header("authorization") || c.req.header("Authorization");
    let bearerKey: string | undefined;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.slice(7).trim();
      if (token && token !== "none" && token !== "test") {
        bearerKey = token;
      }
    }

    const customEnv: Record<string, string> = typeof process !== "undefined" && process.env ? { ...(process.env as Record<string, string>) } : {};
    if (bearerKey) {
      customEnv["SARVAM_API_KEY"] = bearerKey;
      customEnv["NEON_AI_GATEWAY_TOKEN"] = bearerKey;
    }

    const reqHeaders = c.req.header();
    for (const [headerName, headerVal] of Object.entries(reqHeaders)) {
      if (headerName.startsWith("x-") && typeof headerVal === "string" && headerVal) {
        const envKey = headerName.slice(2).replace(/-/g, "_").toUpperCase();
        customEnv[envKey] = headerVal;
      }
    }

    const requestedModel = body.model;
    if (!requestedModel) {
      return c.json({ error: { message: "Missing required field 'model' in request body" } }, 400);
    }
    const isStream = Boolean(body.stream);

    const router = new LLMRouter();
    try {
      const response = await router.complete(
        {
          model: requestedModel,
          temperature: body.temperature,
          maxTokens: body.max_tokens,
        },
        messages,
        customEnv
      );

      const responseId = `chatcmpl-${Math.random().toString(36).slice(2)}`;
      const created = Math.floor(Date.now() / 1000);
      const assistantContent = response.text || "";

      if (isStream) {
        const streamHeaders = {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive"
        };

        const chunk1 = {
          id: responseId,
          object: "chat.completion.chunk",
          created,
          model: response.model,
          choices: [
            {
              index: 0,
              delta: { role: "assistant", content: assistantContent },
              finish_reason: null
            }
          ]
        };

        const chunk2 = {
          id: responseId,
          object: "chat.completion.chunk",
          created,
          model: response.model,
          choices: [
            {
              index: 0,
              delta: {},
              finish_reason: "stop"
            }
          ]
        };

        const sseBody = `data: ${JSON.stringify(chunk1)}\n\ndata: ${JSON.stringify(chunk2)}\n\ndata: [DONE]\n\n`;
        return new Response(sseBody, { headers: streamHeaders });
      }

      return c.json({
        id: responseId,
        object: "chat.completion",
        created,
        model: response.model,
        system_fingerprint: "fp_openliate",
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: assistantContent
            },
            finish_reason: "stop"
          }
        ],
        usage: {
          prompt_tokens: response.usage?.promptTokens || 0,
          completion_tokens: response.usage?.completionTokens || 0,
          total_tokens: response.usage?.totalTokens || 0
        }
      });
    } catch (err: any) {
      return c.json(
        {
          error: {
            message: err.message || "Gateway failed to complete request",
            type: "api_error",
            code: 500
          }
        },
        500
      );
    }
  };

  app.post("/chat", handleChatCompletions);
  app.post("/v1/chat/completions", handleChatCompletions);
  app.post("/api/v1/chat/completions", handleChatCompletions);
  app.post("/chat/completions", handleChatCompletions);

  // =========================================================================
  // OpenLiate Hub & Autonomous Agent Routes
  // =========================================================================

  function resolveHubDir(subDir: "agents" | "llm" | "mcp"): string {
    try {
      const candidateDirs = [
        path.resolve(process.cwd(), "hub", subDir),
        path.resolve(process.cwd(), "OpenLiate", "hub", subDir),
        path.resolve(__dirname, "../../hub", subDir),
        path.resolve(__dirname, "../../../hub", subDir)
      ];
      return candidateDirs.find((d) => fs.existsSync(d)) || candidateDirs[0];
    } catch {
      return "";
    }
  }

  function getHubAgents() {
    const agents: Array<{ id: string; name?: string; version?: string; intent?: string; model?: string; tools?: any[] }> = [];
    const seenIds = new Set<string>();

    try {
      const scanDirs = [
        path.resolve(process.cwd(), ".openliate", "agents"),
        path.resolve(process.cwd(), "OpenLiate", ".openliate", "agents"),
        resolveHubDir("agents")
      ].filter(Boolean);

      for (const dir of scanDirs) {
        if (fs.existsSync(dir)) {
          const dirs = fs.readdirSync(dir, { withFileTypes: true });
          for (const d of dirs) {
            if (d.isDirectory() && !seenIds.has(d.name)) {
              const modulePath = path.join(dir, d.name, "agent.json");
              if (fs.existsSync(modulePath)) {
                try {
                  const module = JSON.parse(fs.readFileSync(modulePath, "utf-8"));
                  seenIds.add(d.name);
                  agents.push({
                    id: d.name,
                    name: module.A?.name || module.name || d.name,
                    version: module.A?.version || module.version || "0.0.1",
                    intent: module.A?.intent || module.intent || "",
                    model: typeof module.L === "string" ? module.L : (module.L?.model || module.L?.provider || ""),
                    tools: Array.isArray(module.T)
                      ? module.T
                      : (module.T && typeof module.T === "object" ? Object.keys(module.T) : [])
                  });
                } catch {}
              }
            }
          }
        }
      }
    } catch {}

    return agents;
  }

  function getHubLLMs() {
    const llms: any[] = [];
    const gateways = HubResolver.getBuiltinGateways();
    for (const [k, data] of Object.entries(gateways)) {
      llms.push({
        id: data.provider || data.name || k,
        name: data.name || data.provider,
        version: data.version,
        endpoint: data.endpoint,
        models_endpoint: data.models_endpoint,
        features: data.features || {}
      });
    }
    return llms;
  }

  function getHubMCPs() {
    const mcps: any[] = [];
    try {
      const workspaceServers = ToolRegistry.readWorkspaceMcpServers();
      for (const [k, data] of Object.entries(workspaceServers)) {
        mcps.push({
          id: (data as any).id || k,
          name: (data as any).name || k,
          description: (data as any).description || "",
          transport: (data as any).transport || ((data as any).url ? "http" : "stdio"),
          command: (data as any).command,
          args: (data as any).args,
          url: (data as any).url
        });
      }
    } catch {}
    return mcps;
  }

  // 1. Complete OpenLiate Hub Registry
  app.get("/hub", (c) => {
    const agents = getHubAgents();
    const llm = getHubLLMs();
    const mcp = getHubMCPs();
    return c.json({
      hub: "openliate",
      version: OPENLIATE_VERSION,
      counts: {
        agents: agents.length,
        llm: llm.length,
        mcp: mcp.length
      },
      agents,
      llm,
      mcp
    });
  });

  // 2. Hub Agents
  const handleGetAgents = (c: any) => {
    const agents = getHubAgents();
    return c.json({ agents });
  };
  app.get("/hub/agents", handleGetAgents);
  app.get("/agents", handleGetAgents);

  // 3. Hub Agent by ID (Inspect Module)
  const handleGetAgentById = (c: any) => {
    const id = c.req.param("id");
    try {
      const candidatePaths = [
        path.resolve(process.cwd(), ".openliate", "agents", id, "agent.json"),
        path.resolve(process.cwd(), "OpenLiate", ".openliate", "agents", id, "agent.json"),
        path.join(resolveHubDir("agents"), id, "agent.json")
      ];
      const modulePath = candidatePaths.find((p) => fs.existsSync(p));
      if (!modulePath) {
        return c.json({ error: `Agent '${id}' not found in .openliate/agents/ or hub/agents/` }, 404);
      }
      const module = JSON.parse(fs.readFileSync(modulePath, "utf-8"));
      return c.json({ id, module });
    } catch (err: any) {
      return c.json({ error: `Failed to read module for '${id}': ${err.message}` }, 500);
    }
  };
  app.get("/hub/agents/:id", handleGetAgentById);
  app.get("/agents/:id", handleGetAgentById);

  // 4. Hub LLMs / Models
  const handleGetHubLLM = (c: any) => {
    const llm = getHubLLMs();
    return c.json({ llm });
  };
  app.get("/hub/llm", handleGetHubLLM);
  app.get("/hub/models", handleGetHubLLM);

  // 5. Hub MCP Tools
  const handleGetHubMCP = (c: any) => {
    const mcp = getHubMCPs();
    return c.json({ mcp });
  };
  app.get("/hub/mcp", handleGetHubMCP);
  app.get("/hub/tools", handleGetHubMCP);

  // Run any AI agent on the fly (Dynamic ReAct Loop Execution)
  app.post("/run", async (c) => {
    let body: any = {};
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON payload" }, 400);
    }

    const prompt = body.prompt;
    if (!prompt || typeof prompt !== "string") {
      return c.json({ error: "Missing required field 'prompt' (string)" }, 400);
    }

    // 1. Resolve on-the-fly API keys and environment variables generically
    const onTheFlyKeys: Record<string, string> = {};

    // First, load any direct literal values from E (skipping $VAR references)
    const rawE = { ...(body.E || {}), ...(body.agent?.E || {}), ...(body.module?.E || {}) };
    for (const [k, v] of Object.entries(rawE)) {
      if (typeof v === "string" && !v.startsWith("$") && v) {
        onTheFlyKeys[k] = v;
      }
    }

    // Overlay real runtime secrets from env and keys (never overwrite with $VAR strings)
    Object.assign(onTheFlyKeys, body.env || {}, body.keys || {});

    // Forward any custom request headers generically
    const reqHeaders = c.req.header();
    for (const [headerName, headerVal] of Object.entries(reqHeaders)) {
      if (headerName.startsWith("x-") && headerVal && typeof headerVal === "string") {
        const envKey = headerName.slice(2).replace(/-/g, "_").toUpperCase();
        onTheFlyKeys[envKey] = headerVal;
      }
    }

    const previousEnv: Record<string, string | undefined> = {};
    if (typeof process !== "undefined" && process.env) {
      for (const [k, v] of Object.entries(onTheFlyKeys)) {
        if (typeof v === "string" && v) {
          previousEnv[k] = process.env[k];
          process.env[k] = v;
        }
      }
    }

    // 2. Resolve Agent Module (On-The-Fly Object or Path)
    let modulePath: string | null = null;
    let inlineModule: any = null;

    if (body.manifest) {
      return c.json({
        error: "[OpenLiate Error]: 'manifest' has been permanently retired. Declare your agent specification as 'module' (AUM) or 'agent'."
      }, 400);
    }

    if (body.agent && typeof body.agent === "object") {
      inlineModule = body.agent;
    } else if (body.module && typeof body.module === "object") {
      inlineModule = body.module;
    } else if (body.L) {
      inlineModule = body;
    } else if (typeof body.agent === "string") {
      try {
        const candidates = [
          path.resolve(process.cwd(), body.agent),
          path.resolve(process.cwd(), ".openliate", "agents", body.agent, "agent.json"),
          path.resolve(process.cwd(), ".openliate", "agents", body.agent),
          path.resolve(process.cwd(), "OpenLiate", ".openliate", "agents", body.agent, "agent.json"),
          path.resolve(process.cwd(), "OpenLiate", ".openliate", "agents", body.agent),
          path.resolve(process.cwd(), "hub", "agents", body.agent, "agent.json"),
          path.resolve(process.cwd(), "hub", "agents", body.agent),
          path.resolve(process.cwd(), "OpenLiate", "hub", "agents", body.agent, "agent.json"),
          path.resolve(process.cwd(), "OpenLiate", "hub", "agents", body.agent),
          path.resolve(__dirname, "..", "..", "hub", "agents", body.agent, "agent.json"),
          path.resolve(process.cwd(), "agent.json")
        ];

        for (const p of candidates) {
          if (fs.existsSync(p)) {
            const stat = fs.statSync(p);
            if (stat.isFile()) {
              modulePath = p;
              break;
            }
            if (stat.isDirectory()) {
              const sub = path.join(p, "agent.json");
              if (fs.existsSync(sub)) {
                modulePath = sub;
                break;
              }
            }
          }
        }
      } catch {}
    }

    if (!modulePath && !inlineModule) {
      try {
        const defaultCandidates = [
          path.resolve(process.cwd(), "agent.json"),
          path.resolve(__dirname, "agent.json"),
          path.resolve(__dirname, "..", "agent.json")
        ];
        for (const p of defaultCandidates) {
          if (fs.existsSync(p)) {
            modulePath = p;
            break;
          }
        }
      } catch {}
    }

    if (!modulePath && !inlineModule) {
      return c.json(
        {
          error: "Missing agent definition. Provide an on-the-fly agent object (L·I·A·T·E) or valid agent path."
        },
        400
      );
    }

    // 3. Resolve Session / Memory
    const sessionId =
      body.sessionId ||
      body.session ||
      inlineModule?.I?.sessionId ||
      inlineModule?.I?.session;

    let sessionMemory: MemoryProvider | undefined;
    if (sessionId) {
      if (!globalSessionStore.has(sessionId)) {
        globalSessionStore.set(sessionId, new InMemorySession(sessionId));
      }
      sessionMemory = globalSessionStore.get(sessionId);
    }

    // Pre-seed conversation history if supplied
    if (sessionMemory && Array.isArray(body.messages) && body.messages.length > 0) {
      const existing = sessionMemory.getMessages();
      if (existing.length === 0) {
        for (const m of body.messages) {
          await sessionMemory.append({
            role: m.role || "user",
            content: m.content || "",
            timestamp: m.timestamp || Date.now()
          });
        }
      }
    }

    // 4. Load environment & execute
    if (modulePath) {
      try {
        EnvironmentResolver.loadEnv(modulePath);
      } catch {}
    }

    const t0 = Date.now();
    try {
      if (inlineModule) {
        inlineModule.keys = { ...onTheFlyKeys };
      }
      const agent = inlineModule
        ? new Agent({ module: inlineModule, memory: sessionMemory })
        : new Agent({ module: modulePath!, memory: sessionMemory });

      const result = await agent.run(prompt);
      const latencyMs = Date.now() - t0;

      return c.json({
        success: true,
        agent: agent.name,
        sessionId: agent.getMemory().sessionId,
        prompt,
        text: result.text.trim(),
        thought: result.thought || null,
        model: result.model,
        totalSteps: result.totalSteps,
        latencyMs,
        protocol: "Liate API v1"
      });
    } catch (err: any) {
      return c.json(
        {
          success: false,
          error: err.message || "Agent execution failed",
          latencyMs: Date.now() - t0
        },
        500
      );
    } finally {
      if (typeof process !== "undefined" && process.env) {
        for (const [k, prevVal] of Object.entries(previousEnv)) {
          if (prevVal !== undefined) {
            process.env[k] = prevVal;
          } else {
            delete process.env[k];
          }
        }
      }
      try {
        await MCP.closeAll();
      } catch {}
    }
  });

  return app;
}

const defaultApp = createRuntimeApp();

// Deno Edge hook
if (typeof (globalThis as any).Deno !== "undefined" && typeof (globalThis as any).Deno?.serve === "function") {
  (globalThis as any).Deno.serve((req: Request) => defaultApp.fetch(req));
}

export function startRuntimeServer(options?: RuntimeServerOptions) {
  const port = options?.port || 7071;
  const host = options?.host || "0.0.0.0";
  const app = createRuntimeApp();

  console.log(`\n===========================================================`);
  console.log(`  [OpenLiate] Agent Runtime Server on http://${host === "0.0.0.0" ? "localhost" : host}:${port}`);
  console.log(`  • Invoke Agent API:   POST http://localhost:${port}/run`);
  console.log(`  • Hub Registry:       GET  http://localhost:${port}/hub`);
  console.log(`  • Hub Agents:         GET  http://localhost:${port}/hub/agents`);
  console.log(`  • Hub LLMs:           GET  http://localhost:${port}/hub/llm`);
  console.log(`  • Hub MCP Tools:      GET  http://localhost:${port}/hub/mcp`);
  console.log(`  • Health & Status:    GET  http://localhost:${port}/health`);
  console.log(`  • Chat API:           POST http://localhost:${port}/chat`);
  console.log(`  • Model Layer [L]:    Universal OpenAI Router`);
  console.log(`  • Doctrine: "Class is an Agent. Agent is a Function. Function is an API."`);
  console.log(`===========================================================\n`);

  let server: any;
  if ((globalThis as any).Bun?.serve) {
    server = (globalThis as any).Bun.serve({
      fetch: app.fetch,
      port,
      hostname: host
    });
  } else {
    server = serve({
      fetch: app.fetch,
      port,
      hostname: host
    });
  }

  return {
    app,
    server,
    port,
    close: () => {
      if (server?.stop) {
        server.stop();
      } else if (server?.close) {
        server.close();
      }
    }
  };
}

export { defaultApp as runtimeApp, defaultApp as app };
export default defaultApp;

