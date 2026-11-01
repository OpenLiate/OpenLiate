#!/usr/bin/env bun
import path from "path";
import fs from "fs";
import { Agent } from "./agent/agent";
import { EnvironmentResolver } from "./environment/environment";
import { LiateMcp } from "./tools/mcp";
import { link, relink, unlink, linkNeon, linkVercel, linkSupabase } from "./link/index";
import { NeonMcpOAuth, NeonMcpClient } from "./link/neon";
import { VercelMcpOAuth, VercelMcpClient } from "./link/vercel";
import { startEngineServer } from "./server/engine";

const VERSION = "0.1.0";
const BANNER = `
===========================================================
  LIATE — Open Source Backend Layer for AI Agents
  "Don't build AI agents. Integrate by parts."
  Version: ${VERSION} (Standalone Autonomous Engine)
===========================================================
`;

function resolveManifestPath(input: string): string | null {
  const candidates = [
    path.resolve(process.cwd(), input),
    path.resolve(process.cwd(), "hub", "agents", input, "agent.json"),
    path.resolve(process.cwd(), "hub", "agents", input),
    path.resolve(__dirname, "..", "hub", "agents", input, "agent.json")
  ];

  for (const c of candidates) {
    if (fs.existsSync(c)) {
      const stat = fs.statSync(c);
      if (stat.isFile()) return c;
      if (stat.isDirectory()) {
        const sub = path.join(c, "agent.json");
        if (fs.existsSync(sub)) return sub;
      }
    }
  }
  return null;
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === "--help" || command === "-h" || command === "help") {
    console.log(BANNER);
    console.log(`Usage:
  liate run <agent.json|agent-name> "<prompt>"    Execute an agent locally
  liate serve [--port <port>]                      Start the pure Liate engine HTTP server
  liate link                                       Link Vercel, Neon & Supabase in 1 click (2.5M Free Runs)
  liate link --neon                                Link Neon & auto-deploy engine (1M runs, 2 vCPU, 8GB RAM)
  liate link --vercel                              Link Vercel & auto-deploy serverless engine (1M runs)
  liate link --vercel-daemons                      Link Vercel & auto-deploy 24/7 background daemon
  liate link --supabase                            Link Supabase & auto-deploy Edge Function (500k runs + pgvector)
  liate relink [--neon|--vercel|--supabase|--all]  Relink cloud via fresh OAuth & redeploy
  liate unlink [--neon|--vercel|--supabase|--all]  Unlink cloud & clear saved credentials
  liate env set <KEY>=<VALUE>                      Save persistent secret for engine
  liate version                                    Show version and engine info
  liate help                                       Show this help menu

Examples:
  liate run agent.json "Hello Agent World!"
  liate run research-agent "Fetch https://skills.sh and summarize"
  liate serve --port 3000
  liate link
  liate link --neon
  liate link --vercel
  liate link --supabase
  liate relink --supabase
  liate unlink --all
  liate env set SARVAM_API_KEY="sk_live_..."
`);
    process.exit(0);
  }

  if (command === "version" || command === "--version" || command === "-v") {
    console.log(`Liate Engine v${VERSION} (Bun native binary)`);
    process.exit(0);
  }

  // 1. Run Command
  if (command === "run") {
    const manifestArg = args[1];
    const promptArg = args[2];

    if (!manifestArg || !promptArg) {
      console.error("Error: 'liate run' requires an agent manifest or name and a prompt string.");
      console.error("Usage: liate run <agent.json|agent-name> \"<prompt>\"");
      process.exit(1);
    }

    const manifestPath = resolveManifestPath(manifestArg);
    if (!manifestPath) {
      console.error(`Error: Agent manifest not found for '${manifestArg}'.`);
      console.error(`Checked: ${path.resolve(process.cwd(), manifestArg)} and hub/agents/${manifestArg}/agent.json`);
      process.exit(1);
    }

    EnvironmentResolver.loadEnv(manifestPath);

    try {
      const agent = new Agent({ manifest: manifestPath });
      console.log(`[Liate] Booting ${agent.name} (v${agent.version})...`);
      console.log(`[Liate] Intent: "${agent.intent}"`);

      const t0 = Date.now();
      const result = await agent.run(promptArg);
      const latency = Date.now() - t0;

      if (result.thought) {
        console.log(`\n[Thought / Reasoning]:\n${result.thought}\n`);
      }

      console.log(`[Answer]:\n${result.text.trim()}\n`);
      console.log(`-----------------------------------------------------------`);
      console.log(`Model: ${result.model} | Latency: ${latency}ms | Steps: ${result.totalSteps}`);
    } catch (err: any) {
      console.error(`[Liate Error]: ${err.message}`);
      process.exit(1);
    } finally {
      await LiateMcp.closeAll();
    }
    return;
  }

  // 2. Serve Command (Pure Engine HTTP Server)
  if (command === "serve") {
    let port = 3000;
    const portIdx = args.indexOf("--port");
    if (portIdx !== -1 && args[portIdx + 1]) {
      port = parseInt(args[portIdx + 1], 10) || 3000;
    }

    EnvironmentResolver.loadEnv();
    const engine = startEngineServer({ port });
    console.log(`\n[Liate OM] Pure Runtime Engine running at: http://localhost:${port}`);
    console.log(`[Endpoints]:`);
    console.log(`  - Health: GET  http://localhost:${port}/health`);
    console.log(`  - Agents: GET  http://localhost:${port}/agents`);
    console.log(`  - Run:    POST http://localhost:${port}/run\n`);
    console.log(`Ready to execute AI agents on the fly.`);

    // Keep process alive
    return;
  }

  // 3. Link Command (1-Click Multi-Cloud Link & Instant Deployment)
  if (command === "link") {
    const isNeon = args.includes("--neon");
    const isVercelDaemon = args.includes("--vercel-daemons") || args.includes("--vercel-daemon") || (args.includes("--vercel") && (args.includes("--daemons") || args.includes("--daemon")));
    const isVercel = args.includes("--vercel") || isVercelDaemon;
    const isSupabase = args.includes("--supabase");
    const isBoth = args.includes("--both");
    // If no provider flag specified, default to --all (links Neon, Vercel & Supabase in 1 click!)
    const isAll = args.includes("--all") || (!isNeon && !isVercel && !isSupabase && !isBoth);
    const isRelink = args.includes("--relink") || args.includes("--force") || args.includes("-f");
    const keyIdx = args.indexOf("--key");
    const key = keyIdx !== -1 ? args[keyIdx + 1] : undefined;

    let provider: "neon" | "vercel" | "supabase" | "both" | "all" = "all";
    if (isAll) {
      provider = "all";
    } else if (isBoth) {
      provider = "both";
    } else if (isSupabase) {
      provider = "supabase";
    } else if (isVercel) {
      provider = "vercel";
    } else if (isNeon) {
      provider = "neon";
    }

    try {
      await link({ provider, key, isDaemon: isVercelDaemon, relink: isRelink });
    } catch (err: any) {
      console.error(`\n[Link Error]: ${err.message}`);
      process.exit(1);
    }
    return;
  }

  // 4. Relink Command (Force fresh OAuth authorization & redeployment)
  if (command === "relink") {
    const isNeon = args.includes("--neon");
    const isVercelDaemon = args.includes("--vercel-daemons") || args.includes("--vercel-daemon") || (args.includes("--vercel") && (args.includes("--daemons") || args.includes("--daemon")));
    const isVercel = args.includes("--vercel") || isVercelDaemon;
    const isSupabase = args.includes("--supabase");
    const isBoth = args.includes("--both");
    const isAll = args.includes("--all") || (!isNeon && !isVercel && !isSupabase && !isBoth);
    const keyIdx = args.indexOf("--key");
    const key = keyIdx !== -1 ? args[keyIdx + 1] : undefined;

    let provider: "neon" | "vercel" | "supabase" | "both" | "all" = "all";
    if (isAll) {
      provider = "all";
    } else if (isBoth) {
      provider = "both";
    } else if (isSupabase) {
      provider = "supabase";
    } else if (isVercel) {
      provider = "vercel";
    } else if (isNeon) {
      provider = "neon";
    }

    try {
      await relink({ provider, key, isDaemon: isVercelDaemon });
    } catch (err: any) {
      console.error(`\n[Relink Error]: ${err.message}`);
      process.exit(1);
    }
    return;
  }

  // 5. Unlink Command (Clear credentials & logout from providers)
  if (command === "unlink") {
    const isNeon = args.includes("--neon");
    const isVercel = args.includes("--vercel");
    const isSupabase = args.includes("--supabase");
    let provider: "neon" | "vercel" | "supabase" | "all" = "all";
    if (isNeon && !isVercel && !isSupabase) {
      provider = "neon";
    } else if (isVercel && !isNeon && !isSupabase) {
      provider = "vercel";
    } else if (isSupabase && !isNeon && !isVercel) {
      provider = "supabase";
    }

    try {
      await unlink(provider);
    } catch (err: any) {
      console.error(`\n[Unlink Error]: ${err.message}`);
      process.exit(1);
    }
    return;
  }

  // 5. Env Command (liate env set KEY=VALUE)
  if (command === "env") {
    const sub = args[1];
    if (sub === "set") {
      const pair = args[2];
      if (!pair || !pair.includes("=")) {
        console.error("Usage: liate env set KEY=VALUE");
        process.exit(1);
      }
      const [k, ...rest] = pair.split("=");
      const v = rest.join("=").replace(/^["']|["']$/g, "");
      
      const envPath = path.join(process.cwd(), ".env.local");
      let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf-8") : "";
      const regex = new RegExp(`^${k}=.*$`, "m");
      if (regex.test(content)) {
        content = content.replace(regex, `${k}="${v}"`);
      } else {
        content += `\n${k}="${v}"\n`;
      }
      fs.writeFileSync(envPath, content.trim() + "\n", "utf-8");
      console.log(`✔ Set ${k} in .env.local (Masked: ${v.slice(0, 4)}...${v.slice(-4)})`);
      return;
    }
  }

  console.error(`Unknown command: '${command}'. Run 'liate help' for available commands.`);
  process.exit(1);
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
