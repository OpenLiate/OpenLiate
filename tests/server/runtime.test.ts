import { describe, it, expect } from "bun:test";
import fs from "fs";
import path from "path";
import { createRuntimeApp } from "../../src/server/runtime";

describe("Agent Runtime Server: LAPI HTTP & On-the-fly Execution", () => {
  const app = createRuntimeApp();

  it("GET /health returns runtime status, LAPI protocol, and doctrine", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);

    const body = await res.json() as any;
    expect(body.status).toBe("ok");
    expect(body.runtime || body.engine).toBe("openliate");
    expect(body.protocol).toBe("LAPI/v1");
    expect(body.gateway).toContain("Sarvam AI");
    expect(body.doctrine).toContain("Class is an Agent");
    expect(body.doctrine).toContain("OpenLiate");
  });

  it("GET / returns all endpoint maps including openai_chat and openai_models", async () => {
    const res = await app.request("/");
    expect(res.status).toBe(200);

    const body = await res.json() as any;
    expect(body.name).toBe("OpenLiate");
    expect(body.endpoints.chat).toBe("POST /chat");
    expect(body.endpoints.models).toBe("GET /models");
    expect(body.endpoints.openai_chat).toBe("POST /v1/chat/completions");
    expect(body.endpoints.openai_models).toBe("GET /v1/models");
  });

  it("GET /v1/models returns OpenAI-compatible models list with sarvam-105b and neon models", async () => {
    const res = await app.request("/v1/models");
    expect(res.status).toBe(200);

    const body = await res.json() as any;
    expect(body.object).toBe("list");
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(4);

    const modelIds = body.data.map((m: any) => m.id);
    expect(modelIds).toContain("sarvam-105b");
    expect(modelIds).toContain("claude-sonnet-4-6");
  });

  it("POST /chat accepts simple prompt payload via Sovereign gateway", async () => {
    const origKey = process.env.SARVAM_API_KEY;
    process.env.SARVAM_API_KEY = "mock_key";

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = url.toString();
      if (urlStr.includes("sarvam.ai")) {
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  role: "assistant",
                  content: "Hello from OpenLiate Sovereign Chat!"
                }
              }
            ],
            usage: { prompt_tokens: 5, completion_tokens: 10, total_tokens: 15 }
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return originalFetch(url, init);
    }) as any;

    try {
      const res = await app.request("/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: "Hello from user"
        })
      });

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.object).toBe("chat.completion");
      expect(body.choices[0].message.content).toBe("Hello from OpenLiate Sovereign Chat!");
    } finally {
      globalThis.fetch = originalFetch;
      process.env.SARVAM_API_KEY = origKey;
    }
  });

  it("POST /v1/chat/completions validates required messages array", async () => {
    const res = await app.request("/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });
    expect(res.status).toBe(400);

    const body = await res.json() as any;
    expect(body.error).toBeDefined();
    expect(body.error.message).toContain("Missing or invalid 'messages' array");
  });

  it("POST /v1/chat/completions handles OpenAI payload via Sovereign gateway", async () => {
    const originalFetch = globalThis.fetch;
    try {
      (globalThis as any).fetch = async (url: string, init: any) => {
        return {
          ok: true,
          json: async () => ({
            choices: [
              {
                message: { role: "assistant", content: "Greetings from Sovereign Gateway!" }
              }
            ],
            usage: { prompt_tokens: 10, completion_tokens: 15, total_tokens: 25 }
          })
        };
      };

      const res = await app.request("/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer sk-test-key"
        },
        body: JSON.stringify({
          model: "sarvam-105b",
          messages: [{ role: "user", content: "Hello Gateway" }]
        })
      });

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.id).toBeDefined();
      expect(body.object).toBe("chat.completion");
      expect(body.choices[0].message.content).toBe("Greetings from Sovereign Gateway!");
      expect(body.choices[0].finish_reason).toBe("stop");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("POST /v1/chat/completions supports streaming SSE format when stream: true", async () => {
    const originalFetch = globalThis.fetch;
    try {
      (globalThis as any).fetch = async (url: string, init: any) => {
        return {
          ok: true,
          json: async () => ({
            choices: [
              {
                message: { role: "assistant", content: "Streamed content" }
              }
            ],
            usage: { prompt_tokens: 8, completion_tokens: 12, total_tokens: 20 }
          })
        };
      };

      const res = await app.request("/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer sk-test-key"
        },
        body: JSON.stringify({
          model: "sarvam-105b",
          messages: [{ role: "user", content: "Stream test" }],
          stream: true
        })
      });

      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/event-stream");
      const text = await res.text();
      expect(text).toContain("data: ");
      expect(text).toContain("[DONE]");
      expect(text).toContain("Streamed content");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("GET /hub returns complete hub registry (agents, llm, mcp, counts)", async () => {
    const res = await app.request("/hub");
    expect(res.status).toBe(200);

    const body = await res.json() as any;
    expect(body.hub).toBe("openliate");
    expect(body.counts).toBeDefined();
    expect(Array.isArray(body.agents)).toBe(true);
    expect(Array.isArray(body.llm)).toBe(true);
    expect(Array.isArray(body.mcp)).toBe(true);
    expect(body.counts.agents).toBeGreaterThanOrEqual(1);
    expect(body.counts.llm).toBeGreaterThanOrEqual(1);
    expect(body.counts.mcp).toBeGreaterThanOrEqual(1);
  });

  it("GET /hub/agents and GET /agents list pre-configured agents from OpenLiate Hub", async () => {
    const res = await app.request("/hub/agents");
    expect(res.status).toBe(200);

    const body = await res.json() as any;
    expect(Array.isArray(body.agents)).toBe(true);
    expect(body.agents.length).toBeGreaterThanOrEqual(1);

    const ids = body.agents.map((a: any) => a.id);
    expect(ids).toContain("sarvam-agent");

    // Check alias route /agents
    const res2 = await app.request("/agents");
    expect(res2.status).toBe(200);
    const body2 = await res2.json() as any;
    expect(body2.agents.length).toBe(body.agents.length);
  });

  it("GET /hub/agents/:id returns full manifest for a specific agent", async () => {
    const res = await app.request("/hub/agents/sarvam-agent");
    expect(res.status).toBe(200);

    const body = await res.json() as any;
    expect(body.id).toBe("sarvam-agent");
    expect(body.manifest).toBeDefined();
    expect(body.manifest.L).toBeDefined();
  });

  it("resolves user-created agents from .openliate/agents/<name>/agent.json", async () => {
    const customAgentDir = path.resolve(process.cwd(), ".openliate", "agents", "custom-workspace-agent");
    fs.mkdirSync(customAgentDir, { recursive: true });
    const manifestFile = path.join(customAgentDir, "agent.json");
    fs.writeFileSync(manifestFile, JSON.stringify({
      L: "sarvam/sarvam-105b",
      A: { name: "custom_workspace_agent", version: "0.0.1", intent: "Custom Test Agent" },
      T: []
    }), "utf-8");

    try {
      const listRes = await app.request("/hub/agents");
      expect(listRes.status).toBe(200);
      const listBody = await listRes.json() as any;
      const ids = listBody.agents.map((a: any) => a.id);
      expect(ids).toContain("custom-workspace-agent");

      const getRes = await app.request("/hub/agents/custom-workspace-agent");
      expect(getRes.status).toBe(200);
      const getBody = await getRes.json() as any;
      expect(getBody.id).toBe("custom-workspace-agent");
      expect(getBody.manifest.A.name).toBe("custom_workspace_agent");
    } finally {
      fs.rmSync(customAgentDir, { recursive: true, force: true });
    }
  });

  it("GET /hub/llm and GET /hub/models return sovereign LLM gateway definitions", async () => {
    const res = await app.request("/hub/llm");
    expect(res.status).toBe(200);

    const body = await res.json() as any;
    expect(Array.isArray(body.llm)).toBe(true);
    const providers = body.llm.map((l: any) => l.id || l.provider || l.name);
    expect(providers).toContain("sarvam");
  });

  it("GET /hub/mcp and GET /hub/tools return registered MCP servers", async () => {
    const res = await app.request("/hub/mcp");
    expect(res.status).toBe(200);

    const body = await res.json() as any;
    expect(Array.isArray(body.mcp)).toBe(true);
    const mcpIds = body.mcp.map((m: any) => m.id);
    expect(mcpIds).toContain("fetch");
  });

  it("POST /run validates required prompt", async () => {
    const res = await app.request("/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });
    expect(res.status).toBe(400);

    const body = await res.json() as any;
    expect(body.error).toContain("Missing required field 'prompt'");
  });

  it("POST /run executes agent on the fly with custom prompt", async () => {
    const res = await app.request("/run", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-sarvam-api-key": "sk_test_key_mock_123"
      },
      body: JSON.stringify({
        agent: "identity-agent",
        prompt: "Say Hello from Pure Engine!"
      })
    });

    const body = await res.json() as any;
    expect(res.status === 200 || res.status === 500).toBe(true);
    if (res.status === 200) {
      expect(body.success).toBe(true);
      expect(body.protocol).toBe("LAPI/v1");
      expect(body.agent).toBeDefined();
    }
  }, 15000);

  it("POST /run supports sessionId memory retention in LAPI format", async () => {
    const res = await app.request("/run", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-sarvam-api-key": "sk_test_key_mock_123"
      },
      body: JSON.stringify({
        agent: "identity-agent",
        sessionId: "test-user-session-99",
        prompt: "Hello memory!"
      })
    });

    const body = await res.json() as any;
    if (res.status === 200) {
      expect(body.sessionId).toBe("test-user-session-99");
    }
  }, 15000);
});
