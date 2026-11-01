import { describe, it, expect } from "bun:test";
import fs from "fs";
import path from "path";
import os from "os";
import { VercelMcpOAuth, generatePKCE, VercelMcpClient } from "../../src/link/vercel";

describe("Cloud Link: Vercel MCP OAuth (https://mcp.vercel.com)", () => {
  it("generates compliant RFC 7636 PKCE code_verifier and code_challenge", () => {
    const { codeVerifier, codeChallenge } = generatePKCE();
    expect(codeVerifier).toBeDefined();
    expect(codeVerifier.length).toBeGreaterThanOrEqual(43);

    expect(codeChallenge).toBeDefined();
    expect(codeChallenge.length).toBeGreaterThanOrEqual(43);
    expect(codeChallenge).not.toEqual(codeVerifier);
  });

  it("builds compliant Vercel MCP OAuth authorization URL", () => {
    const { codeChallenge } = generatePKCE();
    const state = "test-state-vercel-mcp";
    const redirectUri = "http://localhost:54322/callback";

    const url = VercelMcpOAuth.buildAuthUrl("test_dynamic_vercel_client", redirectUri, codeChallenge, state);

    const parsed = new URL(url);
    expect(parsed.hostname).toBe("vercel.com");
    expect(parsed.pathname).toBe("/oauth/authorize");
    expect(parsed.searchParams.get("client_id")).toBe("test_dynamic_vercel_client");
    expect(parsed.searchParams.get("response_type")).toBe("code");
    expect(parsed.searchParams.get("redirect_uri")).toBe(redirectUri);
    expect(parsed.searchParams.get("code_challenge")).toBe(codeChallenge);
    expect(parsed.searchParams.get("code_challenge_method")).toBe("S256");
    expect(parsed.searchParams.get("state")).toBe(state);
    expect(parsed.searchParams.get("scope")).toContain("openid");
    expect(parsed.searchParams.get("resource")).toBe("https://mcp.vercel.com/");
  });

  it("saves and reloads Vercel MCP tokens from disk", () => {
    const prevConfigDir = process.env.LIATE_CONFIG_DIR;
    const testDir = path.join(os.tmpdir(), "liate-vercel-test-" + Date.now());
    process.env.LIATE_CONFIG_DIR = testDir;

    const testToken = {
      access_token: "test_vercel_mcp_access_token_12345",
      refresh_token: "test_vercel_mcp_refresh_token_67890",
      user_id: "usr_test123",
      team_id: "team_test456",
      scope: "openid email",
      saved_at: new Date().toISOString()
    };

    try {
      VercelMcpOAuth.saveToken(testToken);
      const loaded = VercelMcpOAuth.loadToken();
      expect(loaded).not.toBeNull();
      expect(loaded?.access_token).toBe(testToken.access_token);
      expect(loaded?.refresh_token).toBe(testToken.refresh_token);
      expect(loaded?.user_id).toBe(testToken.user_id);

      VercelMcpOAuth.clearToken();
      const cleared = VercelMcpOAuth.loadToken();
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

  it("initializes VercelMcpClient with active token", () => {
    const client = new VercelMcpClient("test_token_123");
    expect(client).toBeDefined();
    expect(typeof client.listProjects).toBe("function");
    expect(typeof client.deployEngine).toBe("function");
    expect(typeof client.callMcp).toBe("function");
  });
});

