import { NeonMcpOAuth, NeonMcpClient, generatePKCE } from "./neon";
import { VercelMcpOAuth, VercelMcpClient, runVercelLinkFlow } from "./vercel";
import { SupabaseMcpOAuth, SupabaseMcpClient, runSupabaseLinkFlow } from "./supabase";

export interface LinkOptions {
  provider?: "neon" | "vercel" | "supabase" | "both" | "all";
  key?: string;
  isDaemon?: boolean;
  relink?: boolean;
}

export function printHowToRunAgent(runEndpoint: string, provider: "neon" | "vercel" | "supabase"): void {
  const sarvamKey = process.env.SARVAM_API_KEY || "<YOUR_SARVAM_API_KEY>";
  console.log("How to run an agent (5-Pillar L·I·A·T·E Architecture):\n");
  console.log("  1. Via cURL (Direct HTTP API with on-the-fly BYOAI key):");
  console.log(`     curl -X POST ${runEndpoint} \\`);
  console.log(`       -H "Content-Type: application/json" \\`);
  console.log(`       -d '{"prompt": "Namaste, who are you and what tools do you have?", "sessionId": "${provider}-session-1", "L": {"provider": "sarvam", "model": "sarvam-105b"}, "I": {"session": "${provider}-session-1"}, "A": {"name": "sovereign_agent", "intent": "Autonomous Sovereign Indic AI Agent"}, "T": ["mcp:sarvam"], "E": {}, "keys": {"SARVAM_API_KEY": "${sarvamKey}"}}'\n`);
  console.log("  2. Via PowerShell (Windows Invoke-RestMethod):");
  console.log(`     Invoke-RestMethod -Uri "${runEndpoint}" -Method Post -ContentType "application/json" -Body '{"prompt":"Namaste, who are you and what tools do you have?","sessionId":"${provider}-session-1","L":{"provider":"sarvam","model":"sarvam-105b"},"I":{"session":"${provider}-session-1"},"A":{"name":"sovereign_agent","intent":"Autonomous Sovereign Indic AI Agent"},"T":["mcp:sarvam"],"E":{},"keys":{"SARVAM_API_KEY":"${sarvamKey}"}}'\n`);
  console.log("  3. Via OpenLiate CLI (Local):");
  console.log(`     liate run hub/agents/sarvam-agent/agent.json "Namaste, who are you?"`);
  console.log(`     liate run hub/agents/email-agent/agent.json "Check new inboxes"\n`);
  console.log("Refer to https://docs.openliate.tech for documentation, agents, and guides.\n");
}

export async function linkNeon(key?: string, relink: boolean = false): Promise<void> {
  console.log(`\n===========================================================`);
  console.log(`LIATE LINK — NEON CLOUD (REGIONAL POSTGRES MEMORY)`);
  console.log(`===========================================================`);

  if (relink) {
    console.log("[OpenLiate] Relink requested. Clearing saved Neon tokens from disk...");
    NeonMcpOAuth.clearSavedToken();
  }

  let token = relink ? undefined : (NeonMcpOAuth.loadSavedToken()?.access_token || key || process.env.NEON_API_KEY || process.env.NEON_MCP_TOKEN);

  async function performNeonOAuth(): Promise<string> {
    console.log("[OpenLiate] Registering Dynamic Client with Neon MCP Server (RFC 7591)...");
    const reg = await NeonMcpOAuth.registerClient();
    const { codeVerifier, codeChallenge } = generatePKCE();
    const state = crypto.randomUUID();
    const authUrl = NeonMcpOAuth.buildAuthorizeUrl({
      clientId: reg.client_id,
      codeChallenge,
      state
    });

    console.log(`\n1. Authorize Neon access in your browser:\n   ${authUrl}\n`);
    try {
      const openCmd = process.platform === "win32" ? `start "" "${authUrl}"` : process.platform === "darwin" ? `open "${authUrl}"` : `xdg-open "${authUrl}"`;
      const { exec } = await import("child_process");
      exec(openCmd);
    } catch {}

    const { code } = await NeonMcpOAuth.waitForCallback(54321);
    const tokens = await NeonMcpOAuth.exchangeToken({
      code,
      codeVerifier,
      clientId: reg.client_id,
      clientSecret: reg.client_secret
    });
    return tokens.access_token;
  }

  if (!token) {
    token = await performNeonOAuth();
  }

  console.log("✔ Linked to Neon Cloud via MCP OAuth!");
  console.log("✔ 1,000,000 Free AI Agent Runs Unlocked (2 vCPU, 8GB RAM + pgvector).");
  console.log("\n[OpenLiate] Deploying OpenLiate to Neon...");

  let deployment;
  try {
    const client = new NeonMcpClient(token);
    deployment = await client.deployEngine();
  } catch (err: any) {
    const isAuthError = err.message && (
      err.message.includes("expired") ||
      err.message.includes("invalid") ||
      err.message.includes("401") ||
      err.message.includes("Unauthorized")
    );

    if (isAuthError) {
      console.log(`\n⚠️  Saved Neon token is expired or invalid. Auto-clearing and relinking via browser OAuth...`);
      NeonMcpOAuth.clearSavedToken();
      token = await performNeonOAuth();
      console.log("✔ Relinked to Neon Cloud via MCP OAuth!");
      console.log("\n[OpenLiate] Deploying OpenLiate to Neon...");
      const client = new NeonMcpClient(token);
      deployment = await client.deployEngine();
    } else {
      throw err;
    }
  }

  const baseUrl = deployment.invocationUrl.replace(/\/+$/, "").replace(/\/run$/, "");
  const runEndpoint = `${baseUrl}/run`;

  console.log("\n===========================================================");
  console.log("✔ OPENLIATE DEPLOYED LIVE TO NEON!");
  console.log(`Project:    ${deployment.projectName} (${deployment.projectId})`);
  console.log(`Branch:     ${deployment.branchName} (${deployment.branchId})`);
  console.log(`Endpoint:   ${baseUrl}`);
  console.log(`Compute:    Neon Functions (Scale-to-Zero Node.js)`);
  console.log(`Capacity:   1,000,000 Free AI Agent Runs / Month`);
  console.log("Memory [I]: Serverless Postgres + pgvector");
  console.log("Triggers:   Neon Function Triggers (Scale-to-Zero Scheduled Cron)");
  console.log("Tooling:    Remote MCP (HTTP/SSE) + Native Tools Enabled");
  console.log("===========================================================\n");
  printHowToRunAgent(runEndpoint, "neon");
}

export async function linkVercel(key?: string, isDaemon: boolean = false, relink: boolean = false): Promise<void> {
  console.log(`\n===========================================================`);
  if (isDaemon) {
    console.log(`LIATE LINK — VERCEL CLOUD (CONTAINERIZED DAEMON WORKER)`);
  } else {
    console.log(`LIATE LINK — VERCEL CLOUD (FLUID COMPUTE FUNCTIONS)`);
  }
  console.log(`===========================================================`);

  if (relink) {
    console.log("[OpenLiate] Relink requested. Clearing saved Vercel tokens from disk...");
    VercelMcpOAuth.clearToken();
  }

  let token = relink ? undefined : (VercelMcpOAuth.loadToken()?.access_token || key || process.env.VERCEL_TOKEN || process.env.VERCEL_MCP_TOKEN);

  async function performVercelOAuth(): Promise<string> {
    console.log("[OpenLiate] Starting Vercel MCP OAuth 2.0 Authorization (via https://mcp.vercel.com)...");
    const tokenData = await runVercelLinkFlow({ port: 54322 });
    return tokenData.access_token;
  }

  if (!token) {
    token = await performVercelOAuth();
  }

  console.log("✔ Linked to Vercel Cloud via MCP OAuth!");
  if (isDaemon) {
    console.log("✔ Vercel Fluid Daemon Worker Unlocked (24/7 Container Execution).");
    console.log("\n[OpenLiate] Deploying OpenLiate to Vercel...");
  } else {
    console.log("✔ 1,000,000 Free AI Agent Runs + Fluid Compute Functions Unlocked.");
    console.log("\n[OpenLiate] Deploying OpenLiate to Vercel...");
  }

  let deployment;
  try {
    const client = new VercelMcpClient(token);
    deployment = await client.deployEngine({
      mode: isDaemon ? "daemon" : "function"
    });
  } catch (err: any) {
    const isAuthError = err.message && (
      err.message.includes("expired") ||
      err.message.includes("invalid") ||
      err.message.includes("401") ||
      err.message.includes("Unauthorized")
    );

    if (isAuthError) {
      console.log(`\n⚠️  Saved Vercel token is expired or invalid. Auto-clearing and relinking via browser OAuth...`);
      VercelMcpOAuth.clearToken();
      token = await performVercelOAuth();
      console.log("✔ Relinked to Vercel Cloud via MCP OAuth!");
      const client = new VercelMcpClient(token);
      deployment = await client.deployEngine({
        mode: isDaemon ? "daemon" : "function"
      });
    } else {
      throw err;
    }
  }

  console.log("\n===========================================================");
  if (isDaemon) {
    console.log("✔ OPENLIATE DAEMON WORKER DEPLOYED LIVE TO VERCEL!");
    console.log(`Project:    ${deployment.name} (${deployment.projectId})`);
    console.log(`Deployment: ${deployment.url}`);
    console.log(`Mode:       Background Daemon Worker (Pull-based / Queue / Long-running)`);
    console.log(`Runtime:    Linux Node.js (Dedicated Worker)`);
    console.log(`Instances:  1 Dedicated Worker Instance (iad1)`);
    console.log("Tooling:    Remote MCP (HTTP/SSE) + Native Tools Enabled");
    console.log("===========================================================\n");
    console.log("Daemon Operation & Monitoring:\n");
    console.log(`  1. View live streaming daemon logs in Vercel Dashboard:`);
    console.log(`     https://vercel.com/dashboard -> Projects -> ${deployment.name} -> Logs\n`);
    console.log(`  2. Daemons run continuously without inbound HTTP traffic, pulling`);
    console.log(`     and executing long-running agent tasks autonomously.\n`);
  } else {
    const baseUrl = (deployment.url || deployment.engineUrl).replace(/\/+$/, "").replace(/\/run$/, "");
    const runEndpoint = `${baseUrl}/run`;

    console.log("✔ OPENLIATE DEPLOYED LIVE TO VERCEL!");
    console.log(`Project:    ${deployment.name} (${deployment.projectId})`);
    console.log(`Endpoint:   ${baseUrl}`);
    console.log(`Mode:       Serverless Fluid Compute Function (Auto-scales to 0)`);
    console.log(`Capacity:   1,000,000 Free AI Agent Runs / Month`);
    console.log("Tooling:    Remote MCP (HTTP/SSE) + Native Tools Enabled");
    console.log("===========================================================\n");
    printHowToRunAgent(runEndpoint, "vercel");
  }
}

export async function linkSupabase(key?: string, relink: boolean = false): Promise<void> {
  console.log(`\n===========================================================`);
  console.log(`LIATE LINK — SUPABASE CLOUD (EDGE FUNCTIONS & PGVECTOR)`);
  console.log(`===========================================================`);

  if (relink) {
    console.log("[OpenLiate] Relink requested. Clearing saved Supabase tokens from disk...");
    SupabaseMcpOAuth.clearToken();
  }

  let token = relink ? undefined : (SupabaseMcpOAuth.loadToken()?.access_token || key || process.env.SUPABASE_MCP_TOKEN || process.env.SUPABASE_ACCESS_TOKEN);

  async function performSupabaseOAuth(): Promise<string> {
    console.log("[OpenLiate] Starting Supabase MCP OAuth 2.0 Authorization (via https://mcp.supabase.com)...");
    const tokenData = await runSupabaseLinkFlow({ port: 54323 });
    return tokenData.access_token;
  }

  if (!token) {
    token = await performSupabaseOAuth();
  }

  console.log("✔ Linked to Supabase Cloud via MCP OAuth!");
  console.log("✔ 500,000 Free AI Agent Runs + Edge Functions & pgvector Unlocked.");
  console.log("\n[OpenLiate] Deploying OpenLiate to Supabase...");

  let deployment;
  try {
    const client = new SupabaseMcpClient(token);
    deployment = await client.deployEngine();
  } catch (err: any) {
    const isAuthError = err.message && (
      err.message.includes("expired") ||
      err.message.includes("invalid") ||
      err.message.includes("401") ||
      err.message.includes("Unauthorized")
    );

    if (isAuthError) {
      console.log(`\n⚠️  Saved Supabase token is expired or invalid. Auto-clearing and relinking via browser OAuth...`);
      SupabaseMcpOAuth.clearToken();
      token = await performSupabaseOAuth();
      console.log("✔ Relinked to Supabase Cloud via MCP OAuth!");
      const client = new SupabaseMcpClient(token);
      deployment = await client.deployEngine();
    } else {
      throw err;
    }
  }

  const baseUrl = (deployment.functionUrl || deployment.engineUrl).replace(/\/+$/, "").replace(/\/run$/, "");
  const runEndpoint = `${baseUrl}/run`;

  console.log("\n===========================================================");
  console.log("✔ OPENLIATE DEPLOYED LIVE TO SUPABASE!");
  console.log(`Function:   ${deployment.name}`);
  console.log(`Project:    ${deployment.projectRef}`);
  console.log(`Endpoint:   ${baseUrl}`);
  console.log(`Capacity:   500,000 Free AI Agent Runs / Month`);
  console.log("Tooling:    Remote MCP (HTTP/SSE) + Native Tools Enabled");
  console.log("Memory [I]: pgvector Embeddings & Realtime Postgres");
  console.log("===========================================================\n");
  printHowToRunAgent(runEndpoint, "supabase");
}

export async function unlink(provider: "neon" | "vercel" | "supabase" | "all" = "all"): Promise<void> {
  console.log(`\n===========================================================`);
  console.log(`LIATE UNLINK — CLOUD PROVIDER TOKENS`);
  console.log(`===========================================================`);

  if (provider === "neon" || provider === "all") {
    NeonMcpOAuth.clearSavedToken();
    console.log("✔ Unlinked from Neon Cloud (tokens cleared from disk and .env.local).");
  }

  if (provider === "vercel" || provider === "all") {
    VercelMcpOAuth.clearToken();
    console.log("✔ Unlinked from Vercel Cloud (tokens cleared from disk and .env.local).");
  }

  if (provider === "supabase" || provider === "all") {
    SupabaseMcpOAuth.clearToken();
    console.log("✔ Unlinked from Supabase Cloud (tokens cleared from disk and .env.local).");
  }

  console.log("===========================================================\n");
}

export async function relink(options: LinkOptions = {}): Promise<void> {
  return link({ ...options, relink: true });
}

export async function link(options: LinkOptions = {}): Promise<void> {
  const provider = options.provider || "all";
  const shouldRelink = Boolean(options.relink);

  if (provider === "neon" || provider === "both" || provider === "all") {
    await linkNeon(options.key, shouldRelink);
  }

  if (provider === "vercel" || provider === "both" || provider === "all") {
    await linkVercel(options.key, options.isDaemon, shouldRelink);
  }

  if (provider === "supabase" || provider === "all") {
    await linkSupabase(options.key, shouldRelink);
  }
}
