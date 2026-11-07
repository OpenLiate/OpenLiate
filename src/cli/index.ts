#!/usr/bin/env node
import { runStartFlow } from "./commands/start";
import { handleRunCommand } from "./commands/run";
import { handleServeCommand } from "./commands/serve";
import { handleLinkCommand, handleRelinkCommand, handleUnlinkCommand } from "./commands/link";
import { handleDeployCommand } from "./commands/deploy";
import { handleEnvCommand } from "./commands/env";
import { handleHubCommand } from "./commands/hub";
import { handleCreateCommand } from "./commands/create";
import { OPENLIATE_VERSION } from "../core/version";

export const VERSION = OPENLIATE_VERSION;

export const BANNER = `
===========================================================
  OpenLiate - Open Source Backend Layer for AI Agents
  "Built for Sovereign AI Agents From India to the World"
  Version: ${VERSION} (MIT)
===========================================================
`;

export function printHelp(): void {
  console.log(BANNER);
  console.log(`Usage:
  openliate start                                          Quickstart workspace and configure BYOAI API keys
  openliate hub                                            OpenLiate Hub interactive menu
  openliate hub add <owner/repo|path>                      Add an agent to OpenLiate Hub from GitHub or local path
  openliate hub list                                       List all agents in OpenLiate Hub
  openliate add <owner/repo|path>                          Add an agent directly to OpenLiate Hub
  openliate create <name>                                  Scaffold a new agent project
  openliate run <agent.json|agent-name> "<prompt>"         Run an agent locally
  openliate serve [--port <port>]                          Serve agent as HTTP API (default: 7071)
  openliate link [fastly|cloudflare|azion|neon|vercel|supabase|all] Link multi-cloud compute (18.5M runs)
  openliate relink [provider|all]                          Relink cloud via fresh OAuth
  openliate unlink [provider|all]                          Unlink cloud & remove credentials
  openliate deploy [fastly|cloudflare|azion|neon|vercel|supabase|all] Deploy OpenLiate Runtime Engine to connected cloud
  openliate deploy <agent> [--to <cloud>]                  Deploy a dedicated agent as a standalone cloud endpoint
  openliate key set <KEY>=<VALUE>                          Save or update an API key
  openliate key list                                       List configured keys (masked)
  openliate key rm <KEY>                                   Remove an API key
  openliate version                                        Show version and runtime info
  openliate help                                           Show this help menu

Note:
  Commands can be run as either 'openliate' or 'liate' (e.g. 'openliate start' or 'liate start').

Examples:
  openliate start
  openliate hub
  openliate create
  openliate run sarvam-agent "Namaste, who are you?"
  openliate run neon-agent "Hello from Neon AI Gateway"
  openliate serve --port 7071
  openliate link neon
  openliate deploy neon
  openliate deploy sarvam-agent --to neon
  openliate key set SARVAM_API_KEY="sk_live_..."
  openliate key list
  openliate key rm SARVAM_API_KEY

Workspace Storage (.openliate/):
  .openliate/config.json                               Global runtime & API keys configuration
  .openliate/sessions/                                 Persistent agent conversation memory
  .openliate/agents/                                   Custom agent definitions created locally
  .openliate/mcp.json                                  Cached & custom MCP servers configuration
  .openliate/link/                                     Multi-cloud credentials (Neon, Vercel, Supabase, etc.)
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

  // 1. Start / Init Command
  if (command === "start" || command === "init" || command === "setup") {
    try {
      await runStartFlow();
    } catch (err: any) {
      console.error(`\n[Start Error]: ${err.message}`);
      process.exit(1);
    }
    return;
  }

  // 2. Hub Command
  if (command === "hub") {
    await handleHubCommand(args);
    return;
  }

  // 2b. Shorthand: openliate add <repo> (or openliate i / install)
  if (command === "add" || command === "i" || command === "install") {
    await handleHubCommand(["hub", "add", ...args.slice(1)]);
    return;
  }

  // 3. Create / New Agent Project Scaffolder
  if (command === "create" || command === "new") {
    await handleCreateCommand(args);
    return;
  }

  // 4. Run Command
  if (command === "run") {
    await handleRunCommand(args);
    process.exit(0);
  }

  // 3. Serve Command
  if (command === "serve") {
    await handleServeCommand(args);
    return;
  }

  // 4. Link Command
  if (command === "link") {
    await handleLinkCommand(args);
    process.exit(0);
  }

  // 5. Relink Command
  if (command === "relink") {
    await handleRelinkCommand(args);
    process.exit(0);
  }

  // 6. Unlink Command
  if (command === "unlink") {
    await handleUnlinkCommand(args);
    process.exit(0);
  }

  // 7. Deploy Command
  if (command === "deploy") {
    await handleDeployCommand(args);
    process.exit(0);
  }

  // 8. Key & Env Commands
  if (command === "key" || command === "keys" || command === "env") {
    await handleEnvCommand(args);
    process.exit(0);
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

