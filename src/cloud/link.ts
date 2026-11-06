import { HubResolver } from "../layers/llm/model";
import { NeonMcpOAuth, NeonMcpClient, generatePKCE } from "./regional/neon";
import { VercelMcpOAuth, VercelMcpClient, runVercelLinkFlow } from "./regional/vercel";
import { SupabaseMcpOAuth, SupabaseMcpClient, runSupabaseLinkFlow } from "./regional/supabase";
import { CloudflareMcpOAuth, runCloudflareLinkFlow, deployCloudflare } from "./worldwide/cloudflare";
import { AzionMcpOAuth, runAzionLinkFlow, deployAzion } from "./worldwide/azion";
import { FastlyLink, runFastlyLinkFlow, deployFastly } from "./worldwide/fastly";
import { resolveManifestPath } from "../cli/commands/run";
import path from "path";
import fs from "fs";

export { CloudflareMcpOAuth, runCloudflareLinkFlow, deployCloudflare } from "./worldwide/cloudflare";
export { AzionMcpOAuth, runAzionLinkFlow, deployAzion } from "./worldwide/azion";
export { FastlyLink, runFastlyLinkFlow, deployFastly } from "./worldwide/fastly";
export { NeonMcpOAuth, NeonMcpClient } from "./regional/neon";
export { VercelMcpOAuth, VercelMcpClient, runVercelLinkFlow } from "./regional/vercel";
export { SupabaseMcpOAuth, SupabaseMcpClient, runSupabaseLinkFlow } from "./regional/supabase";

export interface LinkOptions {
  provider?: "neon" | "vercel" | "supabase" | "cloudflare" | "azion" | "fastly" | "both" | "all";
  key?: string;
  isDaemon?: boolean;
  relink?: boolean;
}

export interface DeployOptions {
  provider?: "neon" | "vercel" | "supabase" | "cloudflare" | "azion" | "fastly" | "all";
  agent?: string;
  key?: string;
  isDaemon?: boolean;
  branch?: string;
  port?: number;
}

export function printHowToRunAgent(runEndpoint: string, provider: "neon" | "vercel" | "supabase" = "neon"): void {
  const sarvamKey = process.env.SARVAM_API_KEY || "<YOUR_SARVAM_API_KEY>";
  let defaultModel = "sarvam-105b";
  try {
    defaultModel = HubResolver.loadLLM("sarvam").default_model || defaultModel;
  } catch {}

  console.log("How to run an agent (5-Pillar L·I·A·T·E Architecture):\n");
  console.log("  1. Via cURL (Direct HTTP API with on-the-fly BYOAI key):");
  console.log(`     curl -X POST ${runEndpoint} \\`);
  console.log(`       -H "Content-Type: application/json" \\`);
  console.log(`       -d '{"prompt": "Namaste, who are you and what tools do you have?", "sessionId": "${provider}-session-1", "L": {"provider": "sarvam", "model": "${defaultModel}"}, "I": {"session": "${provider}-session-1"}, "A": {"name": "sovereign_agent", "intent": "Autonomous Sovereign Indic AI Agent"}, "T": ["mcp:sarvam"], "E": {}, "keys": {"SARVAM_API_KEY": "${sarvamKey}"}}'\n`);
  console.log("  2. Via PowerShell (Windows Invoke-RestMethod):");
  console.log(`     Invoke-RestMethod -Uri "${runEndpoint}" -Method Post -ContentType "application/json" -Body '{"prompt":"Namaste, who are you and what tools do you have?","sessionId":"${provider}-session-1","L":{"provider":"sarvam","model":"${defaultModel}"},"I":{"session":"${provider}-session-1"},"A":{"name":"sovereign_agent","intent":"Autonomous Sovereign Indic AI Agent"},"T":["mcp:sarvam"],"E":{},"keys":{"SARVAM_API_KEY":"${sarvamKey}"}}'\n`);
  console.log("  3. Via OpenLiate CLI (Local):");
  console.log(`     openliate run hub/agents/sarvam-agent/agent.json "Namaste, who are you?"`);
  console.log(`     openliate run hub/agents/email-agent/agent.json "Check new inboxes"\n`);
  console.log("Refer to https://docs.openliate.tech for documentation, agents, and guides.\n");
}

/**
 * Link Neon Cloud (MCP OAuth 2.1 & regional credentials)
 * Pure authentication & token persistence. Does NOT trigger deployment.
 */
export async function linkNeon(key?: string, relink: boolean = false): Promise<string> {
  console.log(`\n===========================================================`);
  console.log(`OpenLiate Link — Neon Cloud (Serverless Postgres & pgvector)`);
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

  console.log("[Success] Linked to Neon Cloud via MCP OAuth!");
  console.log("[Capacity] 1,000,000 Free AI Agent Runs Unlocked (2 vCPU, 8GB RAM + pgvector).");
  console.log("[Saved] Saved credentials to .openliate/link/neon.json");
  console.log("\nNext Steps:");
  console.log("  Deploy Runtime Engine:   liate deploy neon");
  console.log("  Deploy Dedicated Agent:  liate deploy <agent.json|agent-name> --to neon\n");

  return token;
}

/**
 * Link Vercel Cloud (OAuth 2.0 & compute credentials)
 * Pure authentication & token persistence. Does NOT trigger deployment.
 */
export async function linkVercel(key?: string, isDaemon: boolean = false, relink: boolean = false): Promise<string> {
  console.log(`\n===========================================================`);
  if (isDaemon) {
    console.log(`OpenLiate Link — Vercel Cloud (Containerized Daemon Worker)`);
  } else {
    console.log(`OpenLiate Link — Vercel Cloud (Fluid Compute Functions)`);
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

  console.log("[Success] Linked to Vercel Cloud via MCP OAuth!");
  if (isDaemon) {
    console.log("[Capacity] Vercel Fluid Daemon Worker Unlocked (24/7 Container Execution).");
  } else {
    console.log("[Capacity] 1,000,000 Free AI Agent Runs + Fluid Compute Functions Unlocked.");
  }
  console.log("[Saved] Saved credentials to .openliate/link/vercel.json");
  console.log("\nNext Steps:");
  console.log("  Deploy Runtime Engine:   liate deploy vercel");
  console.log("  Deploy Dedicated Agent:  liate deploy <agent.json|agent-name> --to vercel\n");

  return token;
}

/**
 * Link Supabase Cloud (OAuth 2.0 & Edge Functions credentials)
 * Pure authentication & token persistence. Does NOT trigger deployment.
 */
export async function linkSupabase(key?: string, relink: boolean = false): Promise<string> {
  console.log(`\n===========================================================`);
  console.log(`OpenLiate Link — Supabase Cloud (Edge Functions & pgvector)`);
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

  console.log("[Success] Linked to Supabase Cloud via MCP OAuth!");
  console.log("[Capacity] 500,000 Free AI Agent Runs + Edge Functions & pgvector Unlocked.");
  console.log("[Saved] Saved credentials to .openliate/link/supabase.json");
  console.log("\nNext Steps:");
  console.log("  Deploy Runtime Engine:   liate deploy supabase");
  console.log("  Deploy Dedicated Agent:  liate deploy <agent.json|agent-name> --to supabase\n");

  return token;
}

/**
 * Link Cloudflare Workers (Edge V8 Isolates · 3,000,000 Free Runs)
 */
export async function linkCloudflare(key?: string, relink: boolean = false): Promise<string> {
  if (relink) {
    CloudflareMcpOAuth.clearSavedToken();
  }
  return runCloudflareLinkFlow(key, relink);
}

/**
 * Link Azion Edge Functions (Distributed V8 Edge Mesh · 3,000,000 Free Runs)
 */
export async function linkAzion(key?: string, relink: boolean = false): Promise<string> {
  if (relink) {
    AzionMcpOAuth.clearSavedToken();
  }
  return runAzionLinkFlow(key, relink);
}

/**
 * Link Fastly Compute (WASM Edge Grid · 10,000,000 Free Runs · Direct API Key)
 */
export async function linkFastly(key?: string, relink: boolean = false): Promise<string> {
  if (relink) {
    FastlyLink.clearSavedToken();
  }
  return runFastlyLinkFlow(key);
}

/**
 * Unlink cloud credentials
 */
export async function unlink(provider: "neon" | "vercel" | "supabase" | "cloudflare" | "azion" | "fastly" | "all" = "all"): Promise<void> {
  console.log(`\n===========================================================`);
  console.log(`OpenLiate Unlink — Cloud Provider Credentials`);
  console.log(`===========================================================`);

  if (provider === "neon" || provider === "all") {
    NeonMcpOAuth.clearSavedToken();
    console.log("[Unlinked] Unlinked from Neon Cloud (credentials cleared from disk).");
  }

  if (provider === "vercel" || provider === "all") {
    VercelMcpOAuth.clearToken();
    console.log("[Unlinked] Unlinked from Vercel Cloud (credentials cleared from disk).");
  }

  if (provider === "supabase" || provider === "all") {
    SupabaseMcpOAuth.clearToken();
    console.log("[Unlinked] Unlinked from Supabase Cloud (credentials cleared from disk).");
  }

  if (provider === "cloudflare" || provider === "all") {
    CloudflareMcpOAuth.clearSavedToken();
    console.log("[Unlinked] Unlinked from Cloudflare Workers (credentials cleared from disk).");
  }

  if (provider === "azion" || provider === "all") {
    AzionMcpOAuth.clearSavedToken();
    console.log("[Unlinked] Unlinked from Azion Edge Functions (credentials cleared from disk).");
  }

  if (provider === "fastly" || provider === "all") {
    FastlyLink.clearSavedToken();
    console.log("[Unlinked] Unlinked from Fastly Compute (credentials cleared from disk).");
  }

  console.log("===========================================================\n");
}

export async function relink(options: LinkOptions = {}): Promise<void> {
  return link({ ...options, relink: true });
}

export async function link(options: LinkOptions = {}): Promise<void> {
  const provider = options.provider || "neon";
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

  if (provider === "cloudflare" || provider === "all") {
    await linkCloudflare(options.key, shouldRelink);
  }

  if (provider === "azion" || provider === "all") {
    await linkAzion(options.key, shouldRelink);
  }

  if (provider === "fastly" || provider === "all") {
    await linkFastly(options.key, shouldRelink);
  }
}

/**
 * Deploy OpenLiate Runtime Engine or Agent to Neon Cloud
 */
export async function deployNeon(options: { agent?: string; branch?: string } = {}): Promise<any> {
  console.log(`\n===========================================================`);
  if (options.agent) {
    console.log(`OpenLiate Deploy — Deploying Agent '${options.agent}' to Neon Cloud`);
  } else {
    console.log(`OpenLiate Deploy — Deploying Runtime Engine to Neon Cloud`);
  }
  console.log(`===========================================================`);

  let token = NeonMcpOAuth.loadSavedToken()?.access_token || process.env.NEON_API_KEY || process.env.NEON_MCP_TOKEN;
  if (!token) {
    console.log("[OpenLiate] Neon is not linked. Authenticating first...");
    token = await linkNeon();
  }

  const client = new NeonMcpClient(token);

  if (options.agent) {
    const manifestPath = resolveManifestPath(options.agent);
    if (!manifestPath) {
      throw new Error(`Agent manifest not found for '${options.agent}'. Checked .openliate/agents/ and hub/agents/.`);
    }

    console.log(`[OpenLiate] Bundling dedicated agent from: ${manifestPath}`);
    const deployment = await client.deployAgent(manifestPath, {
      agentName: options.agent,
      branchName: options.branch
    });

    const runEndpoint = deployment.invocationUrl.endsWith("/run") ? deployment.invocationUrl : `${deployment.invocationUrl.replace(/\/+$/, "")}/run`;

    console.log("\n===========================================================");
    console.log(`Agent '${options.agent}' deployed live to Neon!`);
    console.log(`Project:    ${deployment.projectName} (${deployment.projectId})`);
    console.log(`Branch:     ${deployment.branchName} (${deployment.branchId})`);
    console.log(`Endpoint:   ${deployment.invocationUrl}`);
    console.log(`Agent Run:  ${runEndpoint}`);
    console.log(`Compute:    Neon Functions (Scale-to-Zero Node.js)`);
    console.log("Memory [I]: Dedicated Serverless Postgres + pgvector");
    console.log("===========================================================\n");
    printHowToRunAgent(runEndpoint);
    return deployment;
  } else {
    console.log("[OpenLiate] Deploying universal OpenLiate Runtime Engine to Neon...");
    const deployment = await client.deployRuntime({
      branchName: options.branch
    });

    const baseUrl = deployment.invocationUrl.replace(/\/+$/, "").replace(/\/run$/, "");
    const runEndpoint = `${baseUrl}/run`;

    console.log("\n===========================================================");
    console.log("OpenLiate Runtime deployed live to Neon!");
    console.log(`Project:    ${deployment.projectName} (${deployment.projectId})`);
    console.log(`Branch:     ${deployment.branchName} (${deployment.branchId})`);
    console.log(`Endpoint:   ${baseUrl}`);
    console.log(`Compute:    Neon Functions (Scale-to-Zero Node.js)`);
    console.log(`Capacity:   1,000,000 Free AI Agent Runs / Month`);
    console.log("Memory [I]: Serverless Postgres + pgvector");
    console.log("Triggers:   Neon Function Triggers (Scale-to-Zero Scheduled Cron)");
    console.log("Tooling:    Remote MCP (HTTP/SSE) + Native Tools Enabled");
    console.log("===========================================================\n");
    printHowToRunAgent(runEndpoint);
    return deployment;
  }
}

/**
 * Deploy OpenLiate Runtime Engine or Agent to Vercel Cloud
 */
export async function deployVercel(options: { agent?: string; isDaemon?: boolean } = {}): Promise<any> {
  console.log(`\n===========================================================`);
  if (options.agent) {
    console.log(`OpenLiate Deploy — Deploying Agent '${options.agent}' to Vercel Cloud`);
  } else {
    console.log(`OpenLiate Deploy — Deploying Runtime Engine to Vercel Cloud`);
  }
  console.log(`===========================================================`);

  let token = VercelMcpOAuth.loadToken()?.access_token || process.env.VERCEL_TOKEN || process.env.VERCEL_MCP_TOKEN;
  if (!token) {
    console.log("[OpenLiate] Vercel is not linked. Authenticating first...");
    token = await linkVercel(undefined, options.isDaemon);
  }

  const client = new VercelMcpClient(token);
  const deployment = await client.deployRuntime({
    mode: options.isDaemon ? "daemon" : "function"
  });

  const baseUrl = (deployment.url || deployment.runtimeUrl).replace(/\/+$/, "").replace(/\/run$/, "");
  const runEndpoint = `${baseUrl}/run`;

  console.log("\n===========================================================");
  console.log("OpenLiate deployed live to Vercel!");
  console.log(`Project:    ${deployment.name} (${deployment.projectId})`);
  console.log(`Endpoint:   ${baseUrl}`);
  console.log(`Capacity:   1,000,000 Free AI Agent Runs / Month`);
  console.log("===========================================================\n");
  printHowToRunAgent(runEndpoint, "vercel");
  return deployment;
}

/**
 * Deploy OpenLiate Runtime Engine or Agent to Supabase Cloud
 */
export async function deploySupabase(options: { agent?: string } = {}): Promise<any> {
  console.log(`\n===========================================================`);
  if (options.agent) {
    console.log(`OpenLiate Deploy — Deploying Agent '${options.agent}' to Supabase Cloud`);
  } else {
    console.log(`OpenLiate Deploy — Deploying Runtime Engine to Supabase Cloud`);
  }
  console.log(`===========================================================`);

  let token = SupabaseMcpOAuth.loadToken()?.access_token || process.env.SUPABASE_MCP_TOKEN || process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) {
    console.log("[OpenLiate] Supabase is not linked. Authenticating first...");
    token = await linkSupabase();
  }

  const client = new SupabaseMcpClient(token);
  const deployment = await client.deployRuntime();

  const baseUrl = (deployment.functionUrl || deployment.runtimeUrl).replace(/\/+$/, "").replace(/\/run$/, "");
  const runEndpoint = `${baseUrl}/run`;

  console.log("\n===========================================================");
  console.log("OpenLiate deployed live to Supabase!");
  console.log(`Function:   ${deployment.name}`);
  console.log(`Project:    ${deployment.projectRef}`);
  console.log(`Endpoint:   ${baseUrl}`);
  console.log(`Capacity:   500,000 Free AI Agent Runs / Month`);
  console.log("===========================================================\n");
  printHowToRunAgent(runEndpoint, "supabase");
  return deployment;
}

/**
 * Unified Deploy Handler
 */
export async function deploy(options: DeployOptions = {}): Promise<any> {
  const provider = options.provider || "neon";

  if (provider === "neon") {
    return deployNeon({ agent: options.agent, branch: options.branch });
  }

  if (provider === "vercel") {
    return deployVercel({ agent: options.agent, isDaemon: options.isDaemon });
  }

  if (provider === "supabase") {
    return deploySupabase({ agent: options.agent });
  }

  if (provider === "fastly") {
    return deployFastly({ agent: options.agent });
  }

  if (provider === "cloudflare") {
    return deployCloudflare({ agent: options.agent });
  }

  if (provider === "azion") {
    return deployAzion({ agent: options.agent });
  }

  if (provider === "all") {
    const results: Record<string, any> = {};
    results.neon = await deployNeon({ agent: options.agent, branch: options.branch });
    results.vercel = await deployVercel({ agent: options.agent, isDaemon: options.isDaemon });
    results.supabase = await deploySupabase({ agent: options.agent });
    results.fastly = await deployFastly({ agent: options.agent });
    results.cloudflare = await deployCloudflare({ agent: options.agent });
    results.azion = await deployAzion({ agent: options.agent });

    console.log("\n===========================================================");
    console.log("OpenLiate Multi-Cloud Fleet Deployed Successfully!");
    console.log("Total Capacity: 18,500,000 Free AI Agent Runs / Month");
    console.log("  [Worldwide Edge Cloud — 16,000,000 runs/mo]:");
    console.log("  • Fastly Compute:       10,000,000 runs/mo (WASM Edge Anycast)");
    console.log("  • Cloudflare Workers:    3,000,000 runs/mo (V8 Edge Isolates in 330+ Cities)");
    console.log("  • Azion Edge Functions:  3,000,000 runs/mo (Distributed Edge in 500+ PoPs)");
    console.log("  [Regional Serverless Cloud — 2,500,000 runs/mo]:");
    console.log("  • Neon Cloud Functions:  1,000,000 runs/mo (Scale-to-Zero Functions + pgvector)");
    console.log("  • Vercel Fluid Compute:  1,000,000 runs/mo (Fluid Compute)");
    console.log("  • Supabase Edge:           500,000 runs/mo (Deno Edge Isolates)");
    console.log("===========================================================\n");

    return results;
  }

  throw new Error(`Unknown cloud provider '${provider}'. Supported: neon, vercel, supabase, fastly, cloudflare, azion, all.`);
}
