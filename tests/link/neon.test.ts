import { describe, it, expect } from "bun:test";
import fs from "fs";
import path from "path";
import os from "os";
import { NeonMcpOAuth, generatePKCE, NeonMcpClient } from "../../src/cloud/regional/neon";

describe("Cloud Link: Neon MCP OAuth 2.1 (https://mcp.neon.tech)", () => {
  it("generates compliant RFC 7636 PKCE code_verifier and code_challenge", () => {
    const { codeVerifier, codeChallenge } = generatePKCE();
    expect(codeVerifier).toBeDefined();
    expect(codeVerifier.length).toBeGreaterThanOrEqual(43);

    expect(codeChallenge).toBeDefined();
    expect(codeChallenge.length).toBeGreaterThanOrEqual(43);
    expect(codeChallenge).not.toEqual(codeVerifier);
  });

  it("builds compliant Neon MCP OAuth 2.1 authorization URL", () => {
    const { codeChallenge } = generatePKCE();
    const state = "test-state-neon-mcp";

    const url = NeonMcpOAuth.buildAuthorizeUrl({
      clientId: "test_dynamic_neon_client",
      codeChallenge,
      state
    });

    const parsed = new URL(url);
    expect(parsed.hostname).toBe("mcp.neon.tech");
    expect(parsed.pathname).toBe("/api/authorize");
    expect(parsed.searchParams.get("client_id")).toBe("test_dynamic_neon_client");
    expect(parsed.searchParams.get("response_type")).toBe("code");
    expect(parsed.searchParams.get("code_challenge")).toBe(codeChallenge);
    expect(parsed.searchParams.get("code_challenge_method")).toBe("S256");
    expect(parsed.searchParams.get("state")).toBe(state);
    expect(parsed.searchParams.get("scope")).toBe("read write");
  });

  it("saves and reloads Neon MCP tokens from disk", () => {
    const prevConfigDir = process.env.LIATE_CONFIG_DIR;
    const testDir = path.join(os.tmpdir(), "liate-test-" + Date.now());
    process.env.LIATE_CONFIG_DIR = testDir;

    const testToken = {
      access_token: "test_neon_mcp_access_token_12345",
      refresh_token: "test_neon_mcp_refresh_token_67890",
      saved_at: new Date().toISOString()
    };

    try {
      NeonMcpOAuth.saveToken(testToken);
      const loaded = NeonMcpOAuth.loadSavedToken();
      expect(loaded).not.toBeNull();
      expect(loaded?.access_token).toBe(testToken.access_token);
      expect(loaded?.refresh_token).toBe(testToken.refresh_token);

      NeonMcpOAuth.clearSavedToken();
      const cleared = NeonMcpOAuth.loadSavedToken();
      expect(cleared).toBeNull();
    } finally {
      if (prevConfigDir !== undefined) {
        process.env.LIATE_CONFIG_DIR = prevConfigDir;
      } else {
        delete process.env.LIATE_CONFIG_DIR;
      }
      try {
        fs.rmSync(testDir, { recursive: true, force: true });
      } catch {}
    }
  });

  it("initializes NeonMcpClient with active token", () => {
    const client = new NeonMcpClient("test_token_override");
    expect(client).toBeDefined();
  });
});

