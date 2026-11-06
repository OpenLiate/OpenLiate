import { describe, it, expect } from "bun:test";
import fs from "fs";
import path from "path";
import os from "os";
import { SupabaseMcpOAuth, generatePKCE, SupabaseMcpClient } from "../../src/cloud/regional/supabase";

describe("Cloud Link: Supabase MCP OAuth (https://mcp.supabase.com)", () => {
  it("generates compliant RFC 7636 PKCE code_verifier and code_challenge", () => {
    const { codeVerifier, codeChallenge } = generatePKCE();
    expect(codeVerifier).toBeDefined();
    expect(codeVerifier.length).toBeGreaterThanOrEqual(43);

    expect(codeChallenge).toBeDefined();
    expect(codeChallenge.length).toBeGreaterThanOrEqual(43);
    expect(codeChallenge).not.toEqual(codeVerifier);
  });

  it("builds compliant Supabase MCP OAuth authorization URL", () => {
    const { codeChallenge } = generatePKCE();
    const state = "test-state-supabase-mcp";
    const redirectUri = "http://localhost:54323/callback";

    const url = SupabaseMcpOAuth.buildAuthUrl("test_dynamic_supabase_client", redirectUri, codeChallenge, state);

    const parsed = new URL(url);
    expect(parsed.hostname).toBe("api.supabase.com");
    expect(parsed.pathname).toBe("/v1/oauth/authorize");
    expect(parsed.searchParams.get("client_id")).toBe("test_dynamic_supabase_client");
    expect(parsed.searchParams.get("response_type")).toBe("code");
    expect(parsed.searchParams.get("redirect_uri")).toBe(redirectUri);
    expect(parsed.searchParams.get("code_challenge")).toBe(codeChallenge);
    expect(parsed.searchParams.get("code_challenge_method")).toBe("S256");
    expect(parsed.searchParams.get("state")).toBe(state);
  });

  it("saves, reloads, and clears Supabase MCP tokens from disk", () => {
    const prevConfigDir = process.env.LIATE_CONFIG_DIR;
    const testDir = path.join(os.tmpdir(), "liate-supabase-test-" + Date.now());
    process.env.LIATE_CONFIG_DIR = testDir;

    const testToken = {
      access_token: "test_supabase_mcp_access_token_12345",
      refresh_token: "test_supabase_mcp_refresh_token_67890",
      project_ref: "proj_supabase_abc123",
      organization: "Liate Org",
      saved_at: new Date().toISOString()
    };

    try {
      SupabaseMcpOAuth.saveToken(testToken);
      const loaded = SupabaseMcpOAuth.loadToken();
      expect(loaded).not.toBeNull();
      expect(loaded?.access_token).toBe(testToken.access_token);
      expect(loaded?.refresh_token).toBe(testToken.refresh_token);
      expect(loaded?.project_ref).toBe(testToken.project_ref);

      SupabaseMcpOAuth.clearToken();
      const cleared = SupabaseMcpOAuth.loadToken();
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

  it("initializes SupabaseMcpClient with active token", () => {
    const client = new SupabaseMcpClient("test_token_123");
    expect(client).toBeDefined();
    expect(typeof client.listProjects).toBe("function");
    expect(typeof client.deployRuntime).toBe("function");
    expect(typeof client.callMcp).toBe("function");
  });
});

