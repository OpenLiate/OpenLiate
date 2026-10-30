import { describe, expect, it } from "bun:test";
import { AUM } from "../../src/core/aum";
import { normalizeModelConfig } from "../../src/llm/config";
import { HubResolver } from "../../src/llm/hub";

describe("Layer 1: [L] Large Models Layer", () => {
  it("should normalize model string into Sarvam /v2 provider", () => {
    const model = normalizeModelConfig("sarvam/glm5.3");
    expect(model.provider).toBe("sarvam");
    expect(model.model).toBe("glm5.3");
  });

  it("should dynamically load Sarvam definition from hub/llm/sarvam.json", () => {
    const hubDef = HubResolver.loadLLM("sarvam");
    expect(hubDef.provider).toBe("sarvam");
    expect(hubDef.version).toBe("v2");
    expect(hubDef.endpoint).toBe("https://api.sarvam.ai/v2/chat/completions");
    expect(hubDef.available_models).toContain("glm5.3");
    expect(hubDef.available_models).toContain("sarvam-105b");
  });

  it("should parse AUM manifest with 5 layers and resolve environment keys", () => {
    const rawManifest = {
      L: "sarvam/glm5.3",
      I: { memory: "sessions/test-session" },
      A: { name: "test_agent", intent: "Verification Agent" },
      T: ["mcp/fetch"],
      E: { SARVAM_API_KEY: "$SARVAM_API_KEY" }
    };

    const parsed = AUM.parse(rawManifest);
    expect(parsed.L).toBe("sarvam/glm5.3");
    expect(parsed.A.name).toBe("test_agent");

    const resolved = AUM.resolveEnvironment(parsed, {
      SARVAM_API_KEY: "mock_test_key_12345"
    });
    expect(resolved.E.SARVAM_API_KEY).toBe("mock_test_key_12345");
  });
});

