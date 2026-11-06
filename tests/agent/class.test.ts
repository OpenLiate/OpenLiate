import { describe, it, expect } from "bun:test";
import { liate } from "../../src/core/om";

class TestGreetingAgent extends liate {
  L = "sarvam/sarvam-105b";
  I = { memory: "sessions/test-class-agent" };
  A = { name: "test_greeting_agent", intent: "Friendly greeter" };
  T = ["fetch"];
  E = { SARVAM_API_KEY: "test_sarvam_key" };
}

describe("Class is an Agent (OOP SDK)", () => {
  it("initializes an agent from a class definition with 5 properties (L·I·A·T·E)", () => {
    const agent = new TestGreetingAgent();
    expect(agent.L).toBe("sarvam/sarvam-105b");
    expect(agent.T).toEqual(["fetch"]);
    expect(agent.A.name).toBe("test_greeting_agent");

    const runner = agent.getRunner();
    expect(runner.name).toBe("test_greeting_agent");
    expect(runner.intent).toBe("Friendly greeter");
    expect(runner.model).toBe("sarvam-105b");
  });

  it("exports a compliant L·I·A·T·E manifest via toManifest()", () => {
    const agent = new TestGreetingAgent();
    const manifest = agent.toManifest();

    expect(manifest.L).toBe("sarvam/sarvam-105b");
    expect(typeof manifest.A === "object" ? manifest.A.name : manifest.A).toBe("test_greeting_agent");
    expect(manifest.T).toEqual(["fetch"]);
    expect(manifest.E?.SARVAM_API_KEY).toBe("test_sarvam_key");
  });

  it("converts OOP agent to standard Web Request handler via toHandler()", async () => {
    const agent = new TestGreetingAgent();
    const handler = agent.toHandler();
    expect(typeof handler).toBe("function");

    const invalidReq = new Request("http://localhost:7071/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });
    const res = await handler(invalidReq);
    expect(res.status).toBe(400);

    const body = await res.json() as any;
    expect(body.error).toContain("Missing required 'prompt'");
  });

  it("strictly enforces Layer [L] and never silently hardcodes a fallback model", () => {
    class IncompleteAgent extends liate {
      A = { name: "no_model_agent" };
    }
    const agent = new IncompleteAgent();
    expect(() => agent.getRunner()).toThrow("Missing required Layer [L]");
    expect(() => agent.toManifest()).toThrow("Missing required Layer [L]");
  });

  it("supports Full-Name LIATE properties (LLM, Integration, Agent, Tools, Environment)", () => {
    class FullNameAgent extends liate {
      LLM = "sarvam/sarvam-105b";
      Integration = { memory: "sessions/full-name" };
      Agent = { name: "full_name_agent" };
      Tools = ["fetch"];
      Environment = { SARVAM_API_KEY: "test_key" };
    }
    const agent = new FullNameAgent();
    const manifest = agent.toManifest();
    expect(manifest.L).toBe("sarvam/sarvam-105b");
    expect((manifest.I as any)?.memory).toBe("sessions/full-name");
    expect(typeof manifest.A === "object" ? manifest.A.name : manifest.A).toBe("full_name_agent");
    expect(manifest.T).toEqual(["fetch"]);
  });

  it("supports Lowercase LIATE properties (llm, integration, agent, tools, environment)", () => {
    class LowercaseAgent extends liate {
      llm = "sarvam/sarvam-105b";
      integration = { memory: "sessions/lowercase" };
      agent = { name: "lowercase_agent" };
      tools = ["fetch"];
      environment = { SARVAM_API_KEY: "test_key" };
    }
    const agent = new LowercaseAgent();
    const manifest = agent.toManifest();
    expect(manifest.L).toBe("sarvam/sarvam-105b");
    expect((manifest.I as any)?.memory).toBe("sessions/lowercase");
    expect(typeof manifest.A === "object" ? manifest.A.name : manifest.A).toBe("lowercase_agent");
    expect(manifest.T).toEqual(["fetch"]);
  });
});
