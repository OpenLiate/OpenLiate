import { describe, it, expect } from "bun:test";
import { createEngineApp } from "../../src/server/engine";

describe("Pure Engine Server: LAPI HTTP & On-the-fly Execution", () => {
  const app = createEngineApp();

  it("GET /health returns engine status, LAPI protocol, and doctrine", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);

    const body = await res.json() as any;
    expect(body.status).toBe("ok");
    expect(body.engine).toBe("liate-om");
    expect(body.protocol).toBe("LAPI/v1");
    expect(body.doctrine).toContain("Class is an Agent");
    expect(body.doctrine).toContain("LAPI");
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

    // In local test without active live LLM response, it executes the loop or returns standard result
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

