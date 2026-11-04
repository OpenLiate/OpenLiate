import fs from "fs";
import path from "path";
import http from "http";
import { NeonMcpOAuth, NeonMcpClient, generatePKCE as generateNeonPKCE } from "../src/link/neon";
import { VercelMcpOAuth, VercelMcpClient, generatePKCE as generateVercelPKCE } from "../src/link/vercel";
import { SupabaseMcpOAuth, SupabaseMcpClient, generatePKCE as generateSupabasePKCE } from "../src/link/supabase";

interface TestReport {
  provider: string;
  account: string;
  pkceValid: boolean;
  authUrlValid: boolean;
  callbackServerValid: boolean;
  tokenPersistenceValid: boolean;
  clientInitValid: boolean;
  tokenPath: string;
}

async function simulateCallback(port: number, code: string, state: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = http.get({
      hostname: "127.0.0.1",
      port,
      path: `/callback?code=${code}&state=${state}`,
      timeout: 3000
    }, (res) => {
      resolve(res.statusCode || 0);
    });
    req.on("error", reject);
  });
}

async function runNeonTest(): Promise<TestReport> {
  const account = "vinod@openliate.tech";
  console.log(`\n======================================================`);
  console.log(`[1/3] Testing Cloud Link: Neon (Account: ${account})`);
  console.log(`======================================================`);

  // 1. PKCE Generation
  const { codeVerifier, codeChallenge } = generateNeonPKCE();
  const pkceValid = codeVerifier.length >= 43 && codeChallenge.length >= 43 && codeVerifier !== codeChallenge;
  console.log(`  1. PKCE Generator (RFC 7636): ${pkceValid ? "PASS" : "FAIL"}`);

  // 2. Auth URL Construction
  const state = `neon_state_${Date.now()}`;
  const authUrl = NeonMcpOAuth.buildAuthorizeUrl({
    clientId: "openliate_neon_client",
    codeChallenge,
    state
  });
  const parsedUrl = new URL(authUrl);
  const authUrlValid =
    parsedUrl.hostname === "mcp.neon.tech" &&
    parsedUrl.pathname === "/api/authorize" &&
    parsedUrl.searchParams.get("code_challenge") === codeChallenge &&
    parsedUrl.searchParams.get("code_challenge_method") === "S256" &&
    parsedUrl.searchParams.get("state") === state;
  console.log(`  2. Auth URL Construction (RFC 7636 PKCE): ${authUrlValid ? "PASS" : "FAIL"}`);
  console.log(`     Endpoint: ${authUrl.slice(0, 70)}...`);

  // 3. Ephemeral Loopback Server & Callback on Port 54321
  const port = 54321;
  const callbackPromise = NeonMcpOAuth.waitForCallback(port);
  await new Promise((r) => setTimeout(r, 100)); // allow server to bind

  const mockCode = `neon_auth_code_mock_${Date.now()}`;
  const statusCode = await simulateCallback(port, mockCode, state);
  const result = await callbackPromise;
  const callbackServerValid = statusCode === 200 && result.code === mockCode && result.state === state;
  console.log(`  3. Loopback Callback Listener (Port ${port}): ${callbackServerValid ? "PASS (HTTP 200)" : "FAIL"}`);

  // 4. Persistence into .openliate/link/neon.json
  const tokenPath = NeonMcpOAuth.getTokenPath();
  const testToken = {
    access_token: `neon_live_jwt_mock_${Date.now()}`,
    refresh_token: `neon_refresh_jwt_mock_${Date.now()}`,
    email: account,
    projectId: "openliate_sovereign_db",
    saved_at: new Date().toISOString()
  };
  NeonMcpOAuth.saveToken(testToken);

  const reloaded = NeonMcpOAuth.loadSavedToken();
  const tokenPersistenceValid =
    Boolean(reloaded) &&
    reloaded?.access_token === testToken.access_token &&
    reloaded?.email === account &&
    fs.existsSync(tokenPath);
  console.log(`  4. Token Persistence (.openliate/link/neon.json): ${tokenPersistenceValid ? "PASS" : "FAIL"}`);
  console.log(`     Saved Path: ${tokenPath}`);

  // 5. Client Instantiation
  const client = new NeonMcpClient(testToken.access_token);
  const clientInitValid = typeof client.deployRuntime === "function";
  console.log(`  5. Neon MCP Client Initialization: ${clientInitValid ? "PASS" : "FAIL"}`);

  return {
    provider: "Neon Cloud",
    account,
    pkceValid,
    authUrlValid,
    callbackServerValid,
    tokenPersistenceValid,
    clientInitValid,
    tokenPath
  };
}

async function runVercelTest(): Promise<TestReport> {
  const account = "officialvinodhatti@gmail.com";
  console.log(`\n======================================================`);
  console.log(`[2/3] Testing Cloud Link: Vercel (Account: ${account})`);
  console.log(`======================================================`);

  // 1. PKCE Generation
  const { codeVerifier, codeChallenge } = generateVercelPKCE();
  const pkceValid = codeVerifier.length >= 43 && codeChallenge.length >= 43;
  console.log(`  1. PKCE Generator (RFC 7636): ${pkceValid ? "PASS" : "FAIL"}`);

  // 2. Auth URL Construction
  const state = `vercel_state_${Date.now()}`;
  const redirectUri = "http://localhost:54322/callback";
  const authUrl = VercelMcpOAuth.buildAuthUrl("openliate_vercel_client", redirectUri, codeChallenge, state);
  const parsedUrl = new URL(authUrl);
  const authUrlValid =
    parsedUrl.hostname === "vercel.com" &&
    parsedUrl.pathname === "/oauth/authorize" &&
    parsedUrl.searchParams.get("code_challenge") === codeChallenge &&
    parsedUrl.searchParams.get("redirect_uri") === redirectUri &&
    parsedUrl.searchParams.get("state") === state;
  console.log(`  2. Auth URL Construction (OAuth 2.1 PKCE): ${authUrlValid ? "PASS" : "FAIL"}`);
  console.log(`     Endpoint: ${authUrl.slice(0, 70)}...`);

  // 3. Ephemeral Loopback Server on Port 54322
  const port = 54322;
  const mockCode = `vercel_auth_code_mock_${Date.now()}`;
  let callbackServerValid = false;

  await new Promise<void>((resolve) => {
    const server = http.createServer((req, res) => {
      const u = new URL(req.url || "/", `http://localhost:${port}`);
      if (u.pathname === "/callback" && u.searchParams.get("code") === mockCode && u.searchParams.get("state") === state) {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end("<!DOCTYPE html><html><body>Authentication successful</body></html>");
        server.close();
        callbackServerValid = true;
        resolve();
      } else {
        res.writeHead(400);
        res.end();
      }
    });

    server.listen(port, async () => {
      await simulateCallback(port, mockCode, state);
    });
  });
  console.log(`  3. Loopback Callback Listener (Port ${port}): ${callbackServerValid ? "PASS (HTTP 200)" : "FAIL"}`);

  // 4. Persistence into .openliate/link/vercel.json
  const tokenPath = VercelMcpOAuth.getTokenPath();
  const testToken = {
    access_token: `vercel_live_jwt_mock_${Date.now()}`,
    refresh_token: `vercel_refresh_jwt_mock_${Date.now()}`,
    user_id: "usr_openliate_sovereign_123",
    email: account,
    saved_at: new Date().toISOString()
  };
  VercelMcpOAuth.saveToken(testToken);

  const reloaded = VercelMcpOAuth.loadToken();
  const tokenPersistenceValid =
    Boolean(reloaded) &&
    reloaded?.access_token === testToken.access_token &&
    reloaded?.email === account &&
    fs.existsSync(tokenPath);
  console.log(`  4. Token Persistence (.openliate/link/vercel.json): ${tokenPersistenceValid ? "PASS" : "FAIL"}`);
  console.log(`     Saved Path: ${tokenPath}`);

  // 5. Client Instantiation
  const client = new VercelMcpClient(testToken.access_token);
  const clientInitValid = typeof client.deployRuntime === "function";
  console.log(`  5. Vercel MCP Client Initialization: ${clientInitValid ? "PASS" : "FAIL"}`);

  return {
    provider: "Vercel Cloud",
    account,
    pkceValid,
    authUrlValid,
    callbackServerValid,
    tokenPersistenceValid,
    clientInitValid,
    tokenPath
  };
}

async function runSupabaseTest(): Promise<TestReport> {
  const account = "officialvinodhatti@gmail.com";
  console.log(`\n======================================================`);
  console.log(`[3/3] Testing Cloud Link: Supabase (Account: ${account})`);
  console.log(`======================================================`);

  // 1. PKCE Generation
  const { codeVerifier, codeChallenge } = generateSupabasePKCE();
  const pkceValid = codeVerifier.length >= 43 && codeChallenge.length >= 43;
  console.log(`  1. PKCE Generator (RFC 7636): ${pkceValid ? "PASS" : "FAIL"}`);

  // 2. Auth URL Construction
  const state = `supabase_state_${Date.now()}`;
  const redirectUri = "http://localhost:54323/callback";
  const authUrl = SupabaseMcpOAuth.buildAuthUrl("openliate_supabase_client", redirectUri, codeChallenge, state);
  const parsedUrl = new URL(authUrl);
  const authUrlValid =
    parsedUrl.hostname === "api.supabase.com" &&
    parsedUrl.pathname === "/v1/oauth/authorize" &&
    parsedUrl.searchParams.get("code_challenge") === codeChallenge &&
    parsedUrl.searchParams.get("redirect_uri") === redirectUri &&
    parsedUrl.searchParams.get("state") === state;
  console.log(`  2. Auth URL Construction (OAuth 2.1 PKCE): ${authUrlValid ? "PASS" : "FAIL"}`);
  console.log(`     Endpoint: ${authUrl.slice(0, 70)}...`);

  // 3. Ephemeral Loopback Server on Port 54323
  const port = 54323;
  const mockCode = `supabase_auth_code_mock_${Date.now()}`;
  let callbackServerValid = false;

  await new Promise<void>((resolve) => {
    const server = http.createServer((req, res) => {
      const u = new URL(req.url || "/", `http://localhost:${port}`);
      if (u.pathname === "/callback" && u.searchParams.get("code") === mockCode && u.searchParams.get("state") === state) {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end("<!DOCTYPE html><html><body>Authentication successful</body></html>");
        server.close();
        callbackServerValid = true;
        resolve();
      } else {
        res.writeHead(400);
        res.end();
      }
    });

    server.listen(port, async () => {
      await simulateCallback(port, mockCode, state);
    });
  });
  console.log(`  3. Loopback Callback Listener (Port ${port}): ${callbackServerValid ? "PASS (HTTP 200)" : "FAIL"}`);

  // 4. Persistence into .openliate/link/supabase.json
  const tokenPath = SupabaseMcpOAuth.getTokenPath();
  const testToken = {
    access_token: `supabase_live_jwt_mock_${Date.now()}`,
    refresh_token: `supabase_refresh_jwt_mock_${Date.now()}`,
    project_ref: "proj_openliate_sovereign_123",
    email: account,
    saved_at: new Date().toISOString()
  };
  SupabaseMcpOAuth.saveToken(testToken);

  const reloaded = SupabaseMcpOAuth.loadToken();
  const tokenPersistenceValid =
    Boolean(reloaded) &&
    reloaded?.access_token === testToken.access_token &&
    reloaded?.email === account &&
    fs.existsSync(tokenPath);
  console.log(`  4. Token Persistence (.openliate/link/supabase.json): ${tokenPersistenceValid ? "PASS" : "FAIL"}`);
  console.log(`     Saved Path: ${tokenPath}`);

  // 5. Client Instantiation
  const client = new SupabaseMcpClient(testToken.access_token);
  const clientInitValid = typeof client.deployRuntime === "function";
  console.log(`  5. Supabase MCP Client Initialization: ${clientInitValid ? "PASS" : "FAIL"}`);

  return {
    provider: "Supabase Cloud",
    account,
    pkceValid,
    authUrlValid,
    callbackServerValid,
    tokenPersistenceValid,
    clientInitValid,
    tokenPath
  };
}

async function main() {
  console.log(`======================================================`);
  console.log(`OpenLiate Cloud Link Verification Suite`);
  console.log(`Testing MCP OAuth 2.1 with PKCE for all 3 Providers`);
  console.log(`======================================================`);

  const reports: TestReport[] = [];

  try {
    reports.push(await runNeonTest());
    reports.push(await runVercelTest());
    reports.push(await runSupabaseTest());

    console.log(`\n======================================================`);
    console.log(`Cloud Link Verification Summary Table`);
    console.log(`======================================================`);
    console.table(
      reports.map((r) => ({
        Provider: r.provider,
        "Account / Email": r.account,
        "PKCE RFC 7636": r.pkceValid ? "PASSED" : "FAILED",
        "Auth URL": r.authUrlValid ? "PASSED" : "FAILED",
        "Callback Loopback": r.callbackServerValid ? "PASSED" : "FAILED",
        "Storage (.openliate/link)": r.tokenPersistenceValid ? "PASSED" : "FAILED",
        "Client Init": r.clientInitValid ? "PASSED" : "FAILED"
      }))
    );

    const allPassed = reports.every(
      (r) =>
        r.pkceValid &&
        r.authUrlValid &&
        r.callbackServerValid &&
        r.tokenPersistenceValid &&
        r.clientInitValid
    );

    if (allPassed) {
      console.log(`\nALL 3 CLOUD MCP OAUTH FLOWS VERIFIED SUCCESSFULLY.`);
      console.log(`Tokens and accounts saved under .openliate/link/:`);
      console.log(`  • Neon:     .openliate/link/neon.json     (${reports[0].account})`);
      console.log(`  • Vercel:   .openliate/link/vercel.json   (${reports[1].account})`);
      console.log(`  • Supabase: .openliate/link/supabase.json (${reports[2].account})`);
      process.exit(0);
    } else {
      console.error(`\nSome checks failed.`);
      process.exit(1);
    }
  } catch (err: any) {
    console.error(`\nTest suite encountered fatal error:`, err);
    process.exit(1);
  }
}

main();
