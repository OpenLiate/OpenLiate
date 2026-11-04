#!/usr/bin/env node
import path from "path";
import fs from "fs";
import { Agent } from "./agent/agent";
import { EnvironmentResolver } from "./environment/environment";
import { LiateMcp } from "./tools/mcp";
import { link, relink, unlink, linkNeon, linkVercel, linkSupabase } from "./link/index";
import { runJoinFlow } from "./link/join";
import { NeonMcpOAuth, NeonMcpClient } from "./link/neon";
import { VercelMcpOAuth, VercelMcpClient } from "./link/vercel";
import { startEngineServer } from "./server/engine";
import { ConfigManager } from "./core/config";

const VERSION = "0.0.14";
const BANNER = `
===========================================================
  OPENLIATE — Open Source Backend Layer for AI Agents
  "Don't build AI agents. Integrate by parts."
  Version: ${VERSION}
===========================================================
`;

function resolveManifestPath(input: string): string | null {
  const candidates = [
    path.resolve(process.cwd(), input),
    path.resolve(process.cwd(), "hub", "agents", input, "agent.json"),
    path.resolve(process.cwd(), "hub", "agents", input),
    path.resolve(process.cwd(), "OpenLiate", input),
    path.resolve(process.cwd(), "OpenLiate", "hub", "agents", input, "agent.json"),
    path.resolve(process.cwd(), "OpenLiate", "hub", "agents", input),
    path.resolve(__dirname, "..", "hub", "agents", input, "agent.json"),
    path.resolve(__dirname, "..", "hub", "agents", input)
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
  openliate join                                       Join Mission AgentYaan, claim @handle & BYOAI setup
  openliate run <agent.json|agent-name> "<prompt>"    Execute an agent locally
  openliate serve [--port <port>]                      Start the pure OpenLiate engine HTTP server (default: 20128)
  openliate link                                       Link Vercel, Neon & Supabase in 1 click (2.5M Free Runs)
  openliate link --neon                                Link Neon & auto-deploy engine (1M runs, 2 vCPU, 8GB RAM)
  openliate link --vercel                              Link Vercel & auto-deploy serverless engine (1M runs)
  openliate link --vercel-daemons                      Link Vercel & auto-deploy 24/7 background daemon
  openliate link --supabase                            Link Supabase & auto-deploy Edge Function (500k runs + pgvector)
  openliate relink [--neon|--vercel|--supabase|--all]  Relink cloud via fresh OAuth & redeploy
  openliate unlink [--neon|--vercel|--supabase|--all]  Unlink cloud & clear saved credentials
  openliate env set <KEY>=<VALUE>                      Save persistent secret for engine
  openliate version                                    Show version and engine info
  openliate help                                       Show this help menu

Note: Both 'openliate' and 'liate' can be used interchangeably.

Examples:
  openliate join
  openliate run agent.json "Hello Agent World!"
  openliate run research-agent "Fetch https://skills.sh and summarize"
  openliate serve --port 20128
  openliate link
  openliate link --neon
  openliate link --vercel
  openliate link --supabase
  openliate relink --supabase
  openliate unlink --all
  openliate env set SARVAM_API_KEY="sk_live_..."
`);
    process.exit(0);
  }

  if (command === "version" || command === "--version" || command === "-v") {
    console.log(`OpenLiate v${VERSION}`);
    process.exit(0);
  }

  // 0. Join Command (Mission: AgentYaan & Starter Tokens)
  if (command === "join" || command === "init" || command === "setup") {
    try {
      await runJoinFlow();
    } catch (err: any) {
      console.error(`\n[Join Error]: ${err.message}`);
      process.exit(1);
    }
    return;
  }

  // 1. Run Command
  if (command === "run") {
    const manifestArg = args[1];
    const promptArg = args[2];

    if (!manifestArg || !promptArg) {
      console.error("Error: 'openliate run' requires an agent manifest or name and a prompt string.");
      console.error("Usage: openliate run <agent.json|agent-name> \"<prompt>\"");
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
      const rawJson = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
      const modelStr = typeof rawJson.L === "string" ? rawJson.L : rawJson.L?.model || "";
      const lowerModel = modelStr.toLowerCase();

      if (lowerModel.includes("sarvam") || manifestArg.includes("sarvam") || manifestArg.includes("indic")) {
        await ConfigManager.ensureApiKey("SARVAM_API_KEY", {
          agentName: manifestArg,
          providerName: "Sarvam AI Token Factory (Free Credits at https://dashboard.sarvam.ai)",
          docUrl: "https://dashboard.sarvam.ai"
        });
      } else if (lowerModel.includes("groq") || lowerModel.includes("coder") || manifestArg.includes("code")) {
        const hasGroq = process.env.GROQ_API_KEY || ConfigManager.getKey("GROQ_API_KEY");
        if (!hasGroq) {
          await ConfigManager.ensureApiKey("GROQ_API_KEY", {
            agentName: manifestArg,
            providerName: "Groq Fast LPUs (Free Tier at https://console.groq.com/keys)",
            docUrl: "https://console.groq.com/keys"
          });
        }
      } else if (lowerModel.includes("cerebras") || manifestArg.includes("speed")) {
        const hasCerebras = process.env.CEREBRAS_API_KEY || ConfigManager.getKey("CEREBRAS_API_KEY");
        if (!hasCerebras) {
          await ConfigManager.ensureApiKey("CEREBRAS_API_KEY", {
            agentName: manifestArg,
            providerName: "Cerebras Wafer-Scale Fast Inference (Free Tier at https://cloud.cerebras.ai)",
            docUrl: "https://cloud.cerebras.ai"
          });
        }
      } else if (lowerModel.includes("auto") || lowerModel.includes("omniroute")) {
        const hasAny = process.env.GROQ_API_KEY || process.env.SARVAM_API_KEY || process.env.CEREBRAS_API_KEY || ConfigManager.getKey("GROQ_API_KEY") || ConfigManager.getKey("SARVAM_API_KEY");
        if (!hasAny) {
          await ConfigManager.ensureApiKey("GROQ_API_KEY", {
            agentName: manifestArg,
            providerName: "Groq Fast LPUs (Free Tier at https://console.groq.com/keys)",
            docUrl: "https://console.groq.com/keys"
          });
        }
      }

      const agent = new Agent({ manifest: manifestPath });
      console.log(`[OpenLiate] Booting ${agent.name} (v${agent.version})...`);
      console.log(`[OpenLiate] Intent: "${agent.intent}"`);

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
      console.error(`[OpenLiate Error]: ${err.message}`);
      process.exit(1);
    } finally {
      await LiateMcp.closeAll();
    }
    return;
  }

  // 2. Serve Command (Pure Engine HTTP Server)
  if (command === "serve") {
    let port = 20128;
    const portIdx = args.indexOf("--port");
    if (portIdx !== -1 && args[portIdx + 1]) {
      port = parseInt(args[portIdx + 1], 10) || 20128;
    }

    EnvironmentResolver.loadEnv();
    startEngineServer({ port });
    console.log(`Ready to serve Cursor, Claude Code, Cline, Python SDK, and Autonomous Agents.`);

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

  // 6. Env Command (openliate env set KEY=VALUE)
  if (command === "env") {
    const sub = args[1];
    if (sub === "set") {
      const pair = args.find(a => a !== "set" && a.includes("="));
      if (!pair || !pair.includes("=")) {
        console.error("Usage: openliate env set KEY=VALUE");
        process.exit(1);
      }
      const [k, ...rest] = pair.split("=");
      const v = rest.join("=").replace(/^["']|["']$/g, "");
      const keyName = k.trim();
      
      // Save globally in ~/.openliate/config.json
      ConfigManager.setGlobalKey(keyName, v);

      // Also save locally in .env.local if in a project directory
      try {
        const envPath = path.join(process.cwd(), ".env.local");
        let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf-8") : "";
        const regex = new RegExp(`^${keyName}=.*$`, "m");
        if (regex.test(content)) {
          content = content.replace(regex, `${keyName}="${v}"`);
        } else {
          content += `\n${keyName}="${v}"\n`;
        }
        fs.writeFileSync(envPath, content.trim() + "\n", "utf-8");
      } catch {}

      const masked = v.length > 8 ? `${v.slice(0, 4)}...${v.slice(-4)}` : "******";
      console.log(`✔ Set ${keyName} in ~/.openliate/config.json & .env.local (Masked: ${masked})`);
      return;
    }

    if (sub === "list" || sub === "ls") {
      const config = ConfigManager.readSystemConfig();
      console.log(`\nGlobal Configuration (~/.openliate/config.json):`);
      if (config.keys && Object.keys(config.keys).length > 0) {
        for (const [k, v] of Object.entries(config.keys)) {
          const masked = v.length > 8 ? `${v.slice(0, 4)}...${v.slice(-4)}` : "******";
          console.log(`  - ${k}: ${masked}`);
        }
      } else {
        console.log(`  (No global keys configured yet)`);
      }
      console.log("");
      return;
    }

    console.log(`Usage:
  openliate env set KEY=VALUE    Save key globally in ~/.openliate and locally
  openliate env list             List configured global keys
`);
    return;
  }

  console.error(`Unknown command: '${command}'. Run 'openliate help' for available commands.`);
  process.exit(1);
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
