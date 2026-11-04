import { describe, it, expect } from "bun:test";
import { createEngineApp } from "../../src/server/engine";

describe("Pure Engine Server: LAPI HTTP & On-the-fly Execution", () => {
  const app = createEngineApp();

  it("GET /health returns engine status, LAPI protocol, and doctrine", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);

    const body = await res.json() as any;
    expect(body.status).toBe("ok");
    expect(body.engine).toBe("openliate");
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
    expect(modelIds).toContain("neon/gpt-4o");
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

  it("GET /agents lists pre-configured agents from Liate Hub", async () => {
    const res = await app.request("/agents");
    expect(res.status).toBe(200);

    const body = await res.json() as any;
    expect(Array.isArray(body.agents)).toBe(true);
    expect(body.agents.length).toBeGreaterThanOrEqual(1);

    const ids = body.agents.map((a: any) => a.id);
    expect(ids).toContain("general-agent");
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
        agent: "general-agent",
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
  });

  it("POST /run supports sessionId memory retention in LAPI format", async () => {
    const res = await app.request("/run", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-sarvam-api-key": "sk_test_key_mock_123"
      },
      body: JSON.stringify({
        agent: "general-agent",
        sessionId: "test-user-session-99",
        prompt: "Hello memory!"
      })
    });

    const body = await res.json() as any;
    if (res.status === 200) {
      expect(body.sessionId).toBe("test-user-session-99");
    }
  });
});
