import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import path from "path";
import fs from "fs";
import { Agent } from "../agent/agent";
import { EnvironmentResolver } from "../environment/environment";
import { LiateMcp } from "../tools/mcp";
import type { MemoryProvider } from "../integration/types";
import { InMemorySession } from "../integration/memory";
import { OmniRouteGatewayClient, OMNIROUTE_MODELS } from "../llm/omniroute/index";

const globalSessionStore = new Map<string, MemoryProvider>();

export interface EngineServerOptions {
  port?: number;
  host?: string;
}

export function createEngineApp() {
  const app = new Hono();

  // Enable CORS so any frontend, IDE, or tool (Cursor, Claude Code, Cline, etc.) can call the gateway
  app.use("*", cors());

  // Health and engine information
  app.get("/health", (c) => {
    return c.json({
      status: "ok",
      engine: "openliate",
      protocol: "LAPI/v1",
      gateway: "OmniRoute",
      doctrine: "Class is an Agent. Agent is a Function. Function is an API. OpenLiate is Your Backend.",
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  });

  app.get("/", (c) => {
    return c.json({
      name: "OpenLiate",
      status: "running",
      gateway: "OmniRoute",
      doctrine: "Class is an Agent. Agent is a Function. Function is an API. OpenLiate is Your Backend.",
      endpoints: {
        openai_chat: "POST /v1/chat/completions",
        openai_models: "GET /v1/models",
        openliate_run: "POST /run",
        openliate_agents: "GET /agents",
        health: "GET /health"
      }
    });
  });

  // =========================================================================
  // OpenAI-Compatible Gateway Routes (OmniRoute Free AI Gateway)
  // Compatible with Cursor, Claude Code, Cline, Python openai SDK, LangChain, curl
  // Dynamically queries the running OmniRoute port (20128)
  // =========================================================================

  const handleGetModels = async (c: any) => {
    const authHeader = c.req.header("authorization") || c.req.header("Authorization");
    let bearerKey: string | undefined;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.slice(7).trim();
      if (token && token !== "none" && token !== "test") {
        bearerKey = token;
      }
    }

    const gateway = new OmniRouteGatewayClient(bearerKey);
    const dynamicModels = await gateway.listModels();

    const list = [
      {
        id: "auto",
        object: "model",
        created: 1740000000,
        owned_by: "omniroute",
        description: "Adaptive task-based routing across 380+ providers"
      },
      {
        id: "auto-free",
        object: "model",
        created: 1740000000,
        owned_by: "omniroute",
        description: "Zero API Key Free Pool"
      },
      ...dynamicModels.map((m: any) => ({
        id: m.id || m.modelId,
        object: "model",
        created: 1740000000,
        owned_by: m.provider || "omniroute",
        permission: [],
        root: m.id || m.modelId,
        parent: null
      }))
    ];

    // Deduplicate by id
    const seen = new Set<string>();
    const unique = list.filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });

    return c.json({
      object: "list",
      data: unique
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

    const messages = body.messages;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return c.json(
        {
          error: {
            message: "Missing or invalid 'messages' array in request body",
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

    // Extract provider keys passed via custom headers (e.g. x-groq-key, x-sarvam-key)
    const customProviders: Record<string, string> = {};
    const reqHeaders = c.req.header();
    for (const [hName, hVal] of Object.entries(reqHeaders)) {
      if (typeof hVal === "string" && hVal) {
        if (hName.startsWith("x-") && hName.endsWith("-key")) {
          const prov = hName.slice(2, -4).replace(/-/g, "_").toLowerCase();
          customProviders[prov] = hVal;
        }
      }
    }

    const gateway = new OmniRouteGatewayClient(bearerKey);
    const model = body.model || "auto";
    const isStream = Boolean(body.stream);

    try {
      const response = await gateway.chat(messages, {
        model,
        temperature: body.temperature,
        maxTokens: body.max_tokens,
      });

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
        system_fingerprint: "fp_openliate_omniroute",
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
            message: err.message || "OmniRoute gateway failed to complete request",
            type: "api_error",
            code: 500
          }
        },
        500
      );
    }
  };

  app.post("/v1/chat/completions", handleChatCompletions);
  app.post("/api/v1/chat/completions", handleChatCompletions);
  app.post("/chat/completions", handleChatCompletions);

  // =========================================================================
  // OpenLiate LAPI Autonomous Agent Routes
  // =========================================================================

  // List available agents in OpenLiate Hub
  app.get("/agents", (c) => {
    const candidateHubDirs = [
      path.resolve(process.cwd(), "hub", "agents"),
      path.resolve(process.cwd(), "OpenLiate", "hub", "agents"),
      path.resolve(__dirname, "../../hub/agents")
    ];
    const hubDir = candidateHubDirs.find((d) => fs.existsSync(d)) || candidateHubDirs[0];
    const agents: Array<{ id: string; name?: string; intent?: string; model?: string }> = [];

    if (fs.existsSync(hubDir)) {
      const dirs = fs.readdirSync(hubDir, { withFileTypes: true });
      for (const d of dirs) {
        if (d.isDirectory()) {
          const manifestPath = path.join(hubDir, d.name, "agent.json");
          if (fs.existsSync(manifestPath)) {
            try {
              const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
              agents.push({
                id: d.name,
                name: manifest.A?.name || manifest.name || d.name,
                intent: manifest.A?.intent || manifest.intent || "",
                model: typeof manifest.L === "string" ? manifest.L : (manifest.L?.model || manifest.L?.provider || "")
              });
            } catch {
              // Ignore corrupt manifests
            }
          }
        }
      }
    }

    return c.json({ agents });
  });

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
    const onTheFlyKeys: Record<string, string> = {
      ...(body.keys || {}),
      ...(body.env || {}),
      ...(body.agent?.E || {})
    };

    // Forward any custom request headers generically (e.g., x-api-key, x-sarvam-api-key, etc.)
    const reqHeaders = c.req.header();
    for (const [headerName, headerVal] of Object.entries(reqHeaders)) {
      if (headerName.startsWith("x-") && headerVal && typeof headerVal === "string") {
        const envKey = headerName.slice(2).replace(/-/g, "_").toUpperCase();
        onTheFlyKeys[envKey] = headerVal;
      }
    }

    const previousEnv: Record<string, string | undefined> = {};
    for (const [k, v] of Object.entries(onTheFlyKeys)) {
      if (typeof v === "string" && v) {
        previousEnv[k] = process.env[k];
        process.env[k] = v;
      }
    }

    // 2. Resolve Agent Manifest (On-The-Fly Object or Path)
    let manifestPath: string | null = null;
    let inlineManifest: any = null;

    if (body.agent && typeof body.agent === "object") {
      inlineManifest = body.agent;
    } else if (body.manifest && typeof body.manifest === "object") {
      inlineManifest = body.manifest;
    } else if (body.L) {
      inlineManifest = body;
    } else if (typeof body.agent === "string") {
      const candidates = [
        path.resolve(process.cwd(), body.agent),
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
            manifestPath = p;
            break;
          }
          if (stat.isDirectory()) {
            const sub = path.join(p, "agent.json");
            if (fs.existsSync(sub)) {
              manifestPath = sub;
              break;
            }
          }
        }
      }
    }

    if (!manifestPath && !inlineManifest) {
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
      inlineManifest?.I?.sessionId ||
      inlineManifest?.I?.session;

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
    if (manifestPath) {
      EnvironmentResolver.loadEnv(manifestPath);
    }

    const t0 = Date.now();
    try {
      const agent = inlineManifest
        ? new Agent({ manifest: inlineManifest, memory: sessionMemory })
        : new Agent({ manifest: manifestPath!, memory: sessionMemory });

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
        protocol: "LAPI/v1"
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
      // Restore environment state to avoid bleeding ephemeral keys
      for (const [k, prevVal] of Object.entries(previousEnv)) {
        if (prevVal !== undefined) {
          process.env[k] = prevVal;
        } else {
          delete process.env[k];
        }
      }
      await LiateMcp.closeAll();
    }
  });

  return app;
}

export function startEngineServer(options?: EngineServerOptions) {
  const port = options?.port || 20128;
  const host = options?.host || "0.0.0.0";
  const app = createEngineApp();

  console.log(`\n===========================================================`);
  console.log(`  [OpenLiate] Engine & OmniRoute Gateway running on http://${host === "0.0.0.0" ? "localhost" : host}:${port}`);
  console.log(`  • OpenAI Base URL:    http://localhost:${port}/v1`);
  console.log(`  • Models Endpoint:    http://localhost:${port}/v1/models`);
  console.log(`  • Autonomous Agents:  http://localhost:${port}/run`);
  console.log(`  • Free AI Gateway:    OmniRoute (380+ Providers / Port ${port})`);
  console.log(`  • Doctrine: "Class is an Agent. Agent is a Function. Function is an API."`);
  console.log(`===========================================================\n`);

  // Native Bun / Node server
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
