#!/usr/bin/env node
import { runJoinFlow } from "./commands/join";
import { handleRunCommand } from "./commands/run";
import { handleServeCommand } from "./commands/serve";
import { handleLinkCommand, handleRelinkCommand, handleUnlinkCommand } from "./commands/link";
import { handleDeployCommand } from "./commands/deploy";
import { handleEnvCommand } from "./commands/env";
import { handleHubCommand, handleCreateCommand } from "./commands/hub";
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
  liate join                                           Initialize workspace and configure BYOAI API keys
  liate hub                                            Get sovereign agents from hub
  liate create                                         Define agent.json in 5 lines
  liate run <agent.json|agent-name> "<prompt>"         Run an agent locally
  liate serve [--port <port>]                          Serve agent as HTTP API (default: 7071)
  liate link [neon|vercel|supabase]                    Link cloud database & compute (BYOC)
  liate relink [neon|vercel|supabase|all]              Relink cloud via fresh OAuth
  liate unlink [neon|vercel|supabase|all]              Unlink cloud & remove credentials
  liate deploy [neon|vercel|supabase]                  Deploy OpenLiate Runtime Engine to connected cloud
  liate deploy <agent> [--to neon|vercel|supabase]     Deploy a dedicated agent as a standalone cloud endpoint
  liate key set <KEY>=<VALUE>                          Save or update an API key
  liate key list                                       List configured keys (masked)
  liate key rm <KEY>                                   Remove an API key
  liate version                                        Show version and runtime info
  liate help                                           Show this help menu

Note:
  Both 'liate' and 'openliate' commands can be used interchangeably.

Examples:
  liate hub
  liate create
  liate run sarvam-agent "Namaste, who are you?"
  liate run indiaai-agent "EKA-1 Indian Sovereign reasoning"
  liate run neon-agent "Hello from Neon AI Gateway"
  liate serve --port 7071
  liate link neon
  liate link vercel
  liate link supabase
  liate deploy neon
  liate deploy sarvam-agent --to neon
  liate key set SARVAM_API_KEY="sk_live_..."
  liate key list
  liate key rm SARVAM_API_KEY

Workspace Storage (.openliate/):
  .openliate/config.json                               Global runtime & API keys configuration
  .openliate/sessions/                                 Persistent agent conversation memory
  .openliate/agents/                                   Custom agent definitions created locally
  .openliate/mcp.json                                  Cached & custom MCP servers configuration
  .openliate/link/                                     Multi-cloud credentials (Neon, Vercel, Supabase)
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

