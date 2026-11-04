import { describe, expect, test } from "bun:test";
import { EnvironmentResolver } from "../../src/layers/environment/sandbox";

describe("Layer 5: [E] Environment & Sandbox Layer", () => {
  test("EnvironmentResolver.resolve: expands $VAR references cleanly", () => {
    const declared = {
      SARVAM_KEY: "$SARVAM_LIVE_KEY",
      DIRECT_VAL: "constant_value",
      AGENT_PORT: "$PORT"
    };

    const mockEnv = {
      SARVAM_LIVE_KEY: "secret_live_key_999",
      PORT: "8080"
    };

    const resolved = EnvironmentResolver.resolve(declared, mockEnv);
    expect(resolved.SARVAM_KEY).toBe("secret_live_key_999");
    expect(resolved.DIRECT_VAL).toBe("constant_value");
    expect(resolved.AGENT_PORT).toBe("8080");
  });

  test("EnvironmentResolver.loadEnv: safely loads environment variables without throwing", () => {
    expect(() => EnvironmentResolver.loadEnv()).not.toThrow();
  });

  test("EnvironmentResolver.maskSecret: masks API keys for secure logging", () => {
    const rawKey = "sk_live_1234567890abcdef12345678";
    const masked = EnvironmentResolver.maskSecret(rawKey);

    expect(masked).toBe("sk_l***5678");
    expect(masked.includes("abcdef")).toBe(false);

    // Short strings
    expect(EnvironmentResolver.maskSecret("short")).toBe("******");
  });

  test("EnvironmentResolver.createSandbox: configures guardrails and allowed domains", () => {
    const sandbox = EnvironmentResolver.createSandbox(
      { KEY: "$API_KEY" },
      { allowedDomains: ["api.sarvam.ai"], timeoutMs: 15000 }
    );

    expect(sandbox.allowedDomains).toContain("api.sarvam.ai");
    expect(sandbox.timeoutMs).toBe(15000);
    expect(sandbox.denyNetwork).toBe(false);
  });
});
