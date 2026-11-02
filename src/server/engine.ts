import { Hono } from "hono";
import { cors } from "hono/cors";
import path from "path";
import fs from "fs";
import { Agent } from "../agent/agent";
import { EnvironmentResolver } from "../environment/environment";
import { LiateMcp } from "../tools/mcp";
import type { MemoryProvider } from "../integration/types";
import { InMemorySession } from "../integration/memory";

const globalSessionStore = new Map<string, MemoryProvider>();

export interface EngineServerOptions {
  port?: number;
  host?: string;
}

export function createEngineApp() {
  const app = new Hono();

  // Enable CORS so any frontend (React, Next.js, mobile app) can call the engine
  app.use("*", cors());

  // Health and engine information
  app.get("/health", (c) => {
    return c.json({
      status: "ok",
      engine: "openliate",
      protocol: "LAPI/v1",
      doctrine: "Class is an Agent. Agent is a Function. Function is an API. OpenLiate is Your Backend.",
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  });

  app.get("/", (c) => {
    return c.json({
      name: "OpenLiate",
      status: "running",
      endpoints: {
        health: "GET /health",
        agents: "GET /agents",
        run: "POST /run"
      }
    });
  });

  // List available agents in Liate Hub
  app.get("/agents", (c) => {
    const candidateHubDirs = [
      path.resolve(process.cwd(), "hub", "agents"),
      path.resolve(process.cwd(), "liate", "hub", "agents"),
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
        path.resolve(process.cwd(), "liate", "hub", "agents", body.agent, "agent.json"),
        path.resolve(process.cwd(), "liate", "hub", "agents", body.agent),
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
  const port = options?.port || 3000;
  const host = options?.host || "0.0.0.0";
  const app = createEngineApp();

  console.log(`[Liate] Starting Pure Engine Server on port ${port}...`);
  console.log(`[Liate] Doctrine: "Class is an Agent. Agent is a Function. Function is an API."`);

  // Native Bun / Node server
  const server = (globalThis as any).Bun?.serve
    ? (globalThis as any).Bun.serve({
        fetch: app.fetch,
        port,
        hostname: host
      })
    : null;

  return {
    app,
    server,
    port,
    close: () => {
      if (server?.stop) {
        server.stop();
      }
    }
  };
}

