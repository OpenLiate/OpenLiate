#!/usr/bin/env node
import { runJoinFlow } from "./commands/join";
import { handleRunCommand } from "./commands/run";
import { handleServeCommand } from "./commands/serve";
import { handleLinkCommand, handleRelinkCommand, handleUnlinkCommand } from "./commands/link";
import { handleEnvCommand } from "./commands/env";
import { handleHubCommand, handleCreateCommand } from "./commands/hub";
import { OPENLIATE_VERSION } from "../core/version";

export const VERSION = OPENLIATE_VERSION;

export const BANNER = `
===========================================================
  OpenLiate — Open Source Backend Layer for AI Agents
  "Don't build AI agents. Integrate by parts."
  Version: ${VERSION}
===========================================================
`;

export function printHelp(): void {
  console.log(BANNER);
  console.log(`Usage:
  openliate join                                       Configure AI gateway and workspace
  openliate hub                                        Browse and inspect OpenLiate Hub agents
  openliate create                                     Construct an agent step-by-step via 5-pillar L·I·A·T·E
  openliate run <agent.json|agent-name> "<prompt>"    Execute an agent locally
  openliate serve [--port <port>]                      Start the Agent-as-an-API HTTP server (default: 7071)
  openliate link [neon|vercel|supabase]                Link multi-cloud infrastructure & database (2.5M Free Runs)
  openliate relink [neon|vercel|supabase|all]          Relink cloud via fresh OAuth & redeploy
  openliate unlink [neon|vercel|supabase|all]          Unlink cloud & clear saved credentials
  openliate env set <KEY>=<VALUE>                      Save persistent secret for runtime
  openliate env list                                   List configured global keys
  openliate version                                    Show version and runtime info
  openliate help                                       Show this help menu

Examples:
  openliate hub
  openliate create
  openliate run sarvam-agent "Namaste, who are you?"
  openliate run identity-agent "Verify PAN ABCPE1234F"
  openliate run research-agent "Fetch https://skills.sh and summarize"
  openliate serve --port 7071
  openliate link neon
  openliate link vercel
  openliate link supabase
  openliate relink supabase
  openliate unlink all
  openliate env set SARVAM_API_KEY="sk_live_..."
`);
}

export async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === "--help" || command === "-h" || command === "help") {
    printHelp();
    process.exit(0);
  }

  if (command === "version" || command === "--version" || command === "-v") {
    console.log(`OpenLiate v${VERSION}`);
    process.exit(0);
  }

  // 1. Join / Init Command
  if (command === "join" || command === "init" || command === "setup") {
    try {
      await runJoinFlow();
    } catch (err: any) {
      console.error(`\n[Join Error]: ${err.message}`);
      process.exit(1);
    }
    return;
  }

  // 2. Hub Command
  if (command === "hub") {
    await handleHubCommand();
    return;
  }

  // 3. Create Agent (Interactive 5-Pillar LIATE Builder)
  if (command === "create") {
    await handleCreateCommand();
    return;
  }

  // 4. Run Command
  if (command === "run") {
    await handleRunCommand(args);
    return;
  }

  // 3. Serve Command
  if (command === "serve") {
    await handleServeCommand(args);
    return;
  }

  // 4. Link Command
  if (command === "link") {
    await handleLinkCommand(args);
    return;
  }

  // 5. Relink Command
  if (command === "relink") {
    await handleRelinkCommand(args);
    return;
  }

  // 6. Unlink Command
  if (command === "unlink") {
    await handleUnlinkCommand(args);
    return;
  }

  // 7. Env Command
  if (command === "env") {
    await handleEnvCommand(args);
    return;
  }

  console.error(`Unknown command: '${command}'. Run 'openliate help' for available commands.`);
  process.exit(1);
}

// Auto-run when executed directly
if (import.meta.main || process.argv[1]?.endsWith("cli.ts") || process.argv[1]?.endsWith("index.ts") || process.argv[1]?.endsWith("bin.js")) {
  main().catch(err => {
    console.error("Fatal:", err);
    process.exit(1);
  });
}

