import { NeonMcpOAuth, NeonMcpClient, generatePKCE } from "./neon";
import { VercelMcpOAuth, VercelMcpClient, runVercelLinkFlow } from "./vercel";
import { SupabaseMcpOAuth, SupabaseMcpClient, runSupabaseLinkFlow } from "./supabase";

export interface LinkOptions {
  provider?: "neon" | "vercel" | "supabase" | "both" | "all";
  key?: string;
  isDaemon?: boolean;
  relink?: boolean;
}

export async function linkNeon(key?: string, relink: boolean = false): Promise<void> {
  console.log(`\n===========================================================`);
  console.log(`LIATE LINK — NEON CLOUD (REGIONAL POSTGRES MEMORY)`);
  console.log(`===========================================================`);

  if (relink) {
    console.log("[Liate] Relink requested. Clearing saved Neon tokens from disk...");
    NeonMcpOAuth.clearSavedToken();
  }

  let token = relink ? undefined : (NeonMcpOAuth.loadSavedToken()?.access_token || key || process.env.NEON_API_KEY || process.env.NEON_MCP_TOKEN);

  async function performNeonOAuth(): Promise<string> {
    console.log("[Liate] Registering Dynamic Client with Neon MCP Server (RFC 7591)...");
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
  console.log("\n[Liate] Auto-provisioning project 'liate' and deploying runtime engine...");

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
      console.log("\n[Liate] Auto-provisioning project 'liate' and deploying runtime engine...");
      const client = new NeonMcpClient(token);
      deployment = await client.deployEngine();
    } else {
      throw err;
    }
  }

  const endpoint = `${deployment.invocationUrl}run`;

  console.log("\n===========================================================");
  console.log("✔ PURE LIATE RUNTIME ENGINE DEPLOYED LIVE TO NEON!");
  console.log(`Project:    ${deployment.projectName} (${deployment.projectId})`);
  console.log(`Branch:     ${deployment.branchName} (${deployment.branchId})`);
  console.log(`Endpoint:   ${endpoint}`);
  console.log(`Runtime:    Linux Node.js (2 vCPU, 8 GB RAM)`);
  console.log(`Capacity:   1,000,000 Free AI Agent Runs / Month`);
  console.log("Tooling:    Remote MCP (HTTP/SSE) + Native Tools Enabled");
  console.log("===========================================================\n");
  console.log("How to run an agent:\n");
  console.log("  1. Via cURL (Direct HTTP API to your cloud engine):");
  console.log(`     curl -X POST ${endpoint} \\`);
  console.log(`       -H "Content-Type: application/json" \\`);
  console.log(`       -H "x-sarvam-api-key: $SARVAM_API_KEY" \\`);
  console.log(`       -d '{"prompt": "Hello Agent World!", "agent": "research-agent"}'\n`);
  console.log("  2. Via Liate CLI (Local):");
  console.log(`     liate run <agent.json|agent-name> "<prompt>"\n`);
  console.log("Refer to https://liate.dev for documentation, agents, and guides.\n");
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
    console.log("[Liate] Relink requested. Clearing saved Vercel tokens from disk...");
    VercelMcpOAuth.clearToken();
  }

  let token = relink ? undefined : (VercelMcpOAuth.loadToken()?.access_token || key || process.env.VERCEL_TOKEN || process.env.VERCEL_MCP_TOKEN);

  async function performVercelOAuth(): Promise<string> {
    console.log("[Liate] Starting Vercel MCP OAuth 2.0 Authorization (via https://mcp.vercel.com)...");
    const tokenData = await runVercelLinkFlow({ port: 54322 });
    return tokenData.access_token;
  }

  if (!token) {
    token = await performVercelOAuth();
  }

  console.log("✔ Linked to Vercel Cloud via MCP OAuth!");
  if (isDaemon) {
    console.log("✔ Vercel Fluid Daemon Worker Unlocked (24/7 Container Execution).");
    console.log("\n[Liate] Auto-deploying containerized background daemon to Vercel...");
  } else {
    console.log("✔ 1,000,000 Free AI Agent Runs + Fluid Compute Functions Unlocked.");
    console.log("\n[Liate] Auto-deploying serverless runtime engine to Vercel...");
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
    console.log("✔ PURE LIATE DAEMON WORKER DEPLOYED LIVE TO VERCEL!");
    console.log(`Project:    ${deployment.name} (${deployment.projectId})`);
    console.log(`Deployment: ${deployment.url}`);
    console.log(`Mode:       Background Daemon Worker (Pull-based / Queue / Long-running)`);
    console.log(`Runtime:    Docker Container (Node 24 + Python + uvx)`);
    console.log(`Instances:  1 Dedicated Worker Instance (iad1)`);
    console.log("Tooling:    Dual-MCP (Stdio uvx/npx + Remote HTTP/SSE) Enabled");
    console.log("===========================================================\n");
    console.log("Daemon Operation & Monitoring:\n");
    console.log(`  1. View live streaming daemon logs in Vercel Dashboard:`);
    console.log(`     https://vercel.com/dashboard -> Projects -> ${deployment.name} -> Logs\n`);
    console.log(`  2. Daemons run continuously without inbound HTTP traffic, pulling`);
    console.log(`     and executing long-running agent tasks autonomously.\n`);
  } else {
    console.log("✔ PURE LIATE RUNTIME ENGINE DEPLOYED LIVE TO VERCEL!");
    console.log(`Project:    ${deployment.name} (${deployment.projectId})`);
    console.log(`Endpoint:   ${deployment.engineUrl}`);
    console.log(`Mode:       Serverless Fluid Compute Function (Auto-scales to 0)`);
    console.log(`Capacity:   1,000,000 Free AI Agent Runs / Month`);
    console.log("Tooling:    Remote MCP (HTTP/SSE) + Native Tools Enabled");
    console.log("===========================================================\n");
    console.log("How to run an agent:\n");
    console.log("  1. Via cURL (Direct HTTP API to your cloud engine):");
    console.log(`     curl -X POST ${deployment.engineUrl} \\`);
    console.log(`       -H "Content-Type: application/json" \\`);
    console.log(`       -H "x-sarvam-api-key: $SARVAM_API_KEY" \\`);
    console.log(`       -d '{"prompt": "Hello Agent World!", "agent": "research-agent"}'\n`);
    console.log("  2. Via Liate CLI (Local):");
    console.log(`     liate run <agent.json|agent-name> "<prompt>"\n`);
  }
  console.log("Refer to https://liate.dev for documentation, agents, and guides.\n");
}

export async function linkSupabase(key?: string, relink: boolean = false): Promise<void> {
  console.log(`\n===========================================================`);
  console.log(`LIATE LINK — SUPABASE CLOUD (EDGE FUNCTIONS & PGVECTOR)`);
  console.log(`===========================================================`);

  if (relink) {
    console.log("[Liate] Relink requested. Clearing saved Supabase tokens from disk...");
    SupabaseMcpOAuth.clearToken();
  }

  let token = relink ? undefined : (SupabaseMcpOAuth.loadToken()?.access_token || key || process.env.SUPABASE_MCP_TOKEN || process.env.SUPABASE_ACCESS_TOKEN);

  async function performSupabaseOAuth(): Promise<string> {
    console.log("[Liate] Starting Supabase MCP OAuth 2.0 Authorization (via https://mcp.supabase.com)...");
    const tokenData = await runSupabaseLinkFlow({ port: 54323 });
    return tokenData.access_token;
  }

  if (!token) {
    token = await performSupabaseOAuth();
  }

  console.log("✔ Linked to Supabase Cloud via MCP OAuth!");
  console.log("✔ 500,000 Free AI Agent Runs + Edge Functions & pgvector Unlocked.");
  console.log("\n[Liate] Auto-deploying Edge Function runtime engine to Supabase...");

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

  console.log("\n===========================================================");
  console.log("✔ PURE LIATE RUNTIME ENGINE DEPLOYED LIVE TO SUPABASE!");
  console.log(`Function:   ${deployment.name}`);
  console.log(`Project:    ${deployment.projectRef}`);
  console.log(`Endpoint:   ${deployment.engineUrl}`);
  console.log(`Capacity:   500,000 Free AI Agent Runs / Month`);
  console.log("Tooling:    Remote MCP (HTTP/SSE) + Edge Functions Enabled");
  console.log("Memory [I]: pgvector Embeddings & Realtime Postgres");
  console.log("===========================================================\n");
  console.log("How to run an agent:\n");
  console.log("  1. Via cURL (Direct HTTP API to your cloud engine):");
  console.log(`     curl -X POST ${deployment.engineUrl} \\`);
  console.log(`       -H "Content-Type: application/json" \\`);
  console.log(`       -H "x-sarvam-api-key: $SARVAM_API_KEY" \\`);
  console.log(`       -d '{"prompt": "Hello Agent World!", "agent": "research-agent"}'\n`);
  console.log("  2. Via Liate CLI (Local):");
  console.log(`     liate run <agent.json|agent-name> "<prompt>"\n`);
  console.log("Refer to https://liate.dev for documentation, agents, and guides.\n");
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
