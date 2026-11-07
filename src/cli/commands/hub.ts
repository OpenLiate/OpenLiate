import fs from "fs";
import path from "path";
import JSZip from "jszip";
import * as p from "@clack/prompts";
import { Agent } from "../../layers/agent/harness";
import { EnvironmentResolver } from "../../layers/environment/sandbox";
import { MCP } from "../../layers/tools/mcp";
import { OPENLIATE_VERSION } from "../../core/version";
import { handleCreateCommand } from "./create";

export { handleCreateCommand };

export interface HubAgentSummary {
  id: string;
  name: string;
  intent: string;
  model: string;
  tools: string[];
  modulePath: string;
}

export function listHubAgents(): HubAgentSummary[] {
  const scanDirs = [
    path.resolve(process.cwd(), "hub", "agents"),
    path.resolve(process.cwd(), ".openliate", "agents"),
    path.resolve(process.cwd(), "OpenLiate", "hub", "agents"),
    path.resolve(__dirname, "..", "..", "..", "hub", "agents")
  ];

  const list: HubAgentSummary[] = [];
  const seenIds = new Set<string>();

  for (const dir of scanDirs) {
    if (fs.existsSync(dir)) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const ent of entries) {
        if (ent.isDirectory() && !seenIds.has(ent.name)) {
          const candidateFiles = ["agent.json", "agent.ts", "agent.py"];
          let modulePath: string | null = null;
          for (const cand of candidateFiles) {
            const pth = path.join(dir, ent.name, cand);
            if (fs.existsSync(pth)) {
              modulePath = pth;
              break;
            }
          }
          if (modulePath) {
            seenIds.add(ent.name);
            let name = ent.name;
            let intent = "AI Agent";
            let model = "sarvam/sarvam-105b";
            let tools: string[] = [];

            if (modulePath.endsWith(".json")) {
              try {
                const raw = JSON.parse(fs.readFileSync(modulePath, "utf-8"));
                name = raw.A?.name || ent.name;
                intent = raw.A?.intent || "AI Agent";
                model = typeof raw.L === "string" ? raw.L : (raw.L?.model || "sarvam/sarvam-105b");
                tools = Array.isArray(raw.T)
                  ? raw.T
                  : (raw.T && typeof raw.T === "object" ? Object.keys(raw.T) : []);
              } catch {}
            }

            list.push({
              id: ent.name,
              name,
              intent,
              model,
              tools,
              modulePath
            });
          }
        }
      }
    }
  }

  return list;
}

export function validateHubAgent(dir: string): void {
  const candidateFiles = ["agent.json", "agent.ts", "agent.py"];
  const found = candidateFiles.some(f => fs.existsSync(path.join(dir, f)));
  if (!found) {
    fs.rmSync(dir, { recursive: true, force: true });
    throw new Error("Invalid agent: missing agent.ts, agent.py, or agent.json in repository root");
  }
}

export async function addHubAgent(source: string): Promise<{ name: string; targetDir: string }> {
  const hubAgentsDir = path.resolve(process.cwd(), "hub", "agents");
  if (!fs.existsSync(hubAgentsDir)) {
    fs.mkdirSync(hubAgentsDir, { recursive: true });
  }

  // 1. Local filesystem path
  if (fs.existsSync(source)) {
    const stat = fs.statSync(source);
    const repoName = path.basename(source).replace(/\.(ts|py|json)$/, "");
    const targetDir = path.join(hubAgentsDir, repoName);
    fs.mkdirSync(targetDir, { recursive: true });

    if (stat.isDirectory()) {
      fs.cpSync(source, targetDir, { recursive: true });
    } else {
      fs.copyFileSync(source, path.join(targetDir, path.basename(source)));
    }

    validateHubAgent(targetDir);
    return { name: repoName, targetDir };
  }

  // 2. Remote GitHub repository (<owner>/<repo>)
  const cleanSource = source.trim().replace(/^https?:\/\/github\.com\//, "").replace(/\.git$/, "");
  const parts = cleanSource.split("/");
  if (parts.length !== 2) {
    throw new Error(`Invalid agent format '${source}'. Expected <owner>/<repo> (e.g. username/agent-name) or local path.`);
  }

  const [owner, repoName] = parts;
  const zipUrl = `https://api.github.com/repos/${owner}/${repoName}/zipball`;
  console.log(`\n📦 Fetching agent ${owner}/${repoName} from ${zipUrl}...`);

  const resp = await fetch(zipUrl, {
    headers: {
      "User-Agent": "openliate-hub-cli"
    }
  });

  if (!resp.ok) {
    throw new Error(`Agent not found on GitHub (${resp.status} ${resp.statusText})`);
  }

  const buffer = await resp.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);

  const targetDir = path.join(hubAgentsDir, repoName);
  fs.mkdirSync(targetDir, { recursive: true });

  for (const [filename, fileEntry] of Object.entries(zip.files)) {
    // Strip GitHub top-level wrapper directory
    const pathParts = filename.split("/");
    if (pathParts.length < 2 || !pathParts[1]) continue;
    const relPath = pathParts.slice(1).join("/");
    const outPath = path.join(targetDir, relPath);

    if (fileEntry.dir) {
      fs.mkdirSync(outPath, { recursive: true });
      continue;
    }

    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    const content = await fileEntry.async("nodebuffer");
    fs.writeFileSync(outPath, content);
  }

  validateHubAgent(targetDir);
  return { name: repoName, targetDir };
}

export const installHubAgent = addHubAgent;

export async function handleHubCommand(args: string[] = []): Promise<void> {
  const sub = args[1]?.toLowerCase();
  const target = args[2];

  // 1. Direct CLI: openliate hub add <repo> (or openliate hub i <repo>)
  if (sub === "add" || sub === "i" || sub === "install") {
    if (!target) {
      console.error("Usage: openliate hub add <owner/repo|path>");
      process.exit(1);
    }
    try {
      const res = await addHubAgent(target);
      console.log(`\n✅ Successfully added agent '${res.name}' to OpenLiate Hub!`);
      console.log(`   Location: ${res.targetDir}`);
      console.log(`\nRun your agent:\n  openliate run ${res.name} "Your prompt"\n`);
    } catch (err: any) {
      console.error(`\n❌ Failed to add agent: ${err.message}`);
      process.exit(1);
    }
    return;
  }

  // 2. Direct CLI: openliate hub list
  if (sub === "list" || sub === "ls") {
    const agents = listHubAgents();
    console.log(`\n📦 OpenLiate Hub Agents (${agents.length}):`);
    if (agents.length === 0) {
      console.log("  (No agents found in hub/agents/)");
    } else {
      for (const a of agents) {
        console.log(`  - \x1b[36m${a.id}\x1b[0m [${a.model}]: ${a.intent}`);
      }
    }
    console.log("");
    return;
  }

  // 3. Direct CLI: openliate hub create
  if (sub === "create" || sub === "new") {
    await handleCreateCommand(args.slice(1));
    return;
  }

  // 4. Interactive OpenLiate Hub Menu
  console.log("");
  p.intro("\x1b[36mOpenLiate Hub\x1b[0m");

  const action = await p.select({
    message: "Select an action:",
    options: [
      {
        value: "run",
        label: "1. Run Agent from Hub",
        hint: "Browse and execute ready-to-run agents"
      },
      {
        value: "add",
        label: "2. Add Agent to Hub",
        hint: "Add from GitHub (owner/repo) or local directory"
      },
      {
        value: "create",
        label: "3. Create New Agent (5-Layer Builder)",
        hint: "Design, configure, and launch a custom agent"
      },
      {
        value: "list",
        label: "4. List Hub Agents",
        hint: "View all Hub agents"
      }
    ]
  });

  if (p.isCancel(action)) {
    p.cancel("Hub exited.");
    return;
  }

  if (action === "create") {
    await handleCreateCommand();
    return;
  }

  if (action === "list") {
    const agents = listHubAgents();
    p.note(
      agents.length === 0
        ? "No agents found in hub/agents/."
        : agents.map(a => `• ${a.id} [${a.model}]: ${a.intent}`).join("\n"),
      `Hub Agents (${agents.length})`
    );
    p.outro("Done.");
    return;
  }

  if (action === "add") {
    const source = await p.text({
      message: "Enter GitHub repository (owner/repo) or local path:",
      placeholder: "e.g. username/agent-name or ./path/to/agent",
      validate: (v) => (!v || !v.trim() ? "Source is required." : undefined)
    });

    if (p.isCancel(source) || !source) {
      p.cancel("Operation cancelled.");
      return;
    }

    const spin = p.spinner();
    spin.start(`Adding agent from ${source}...`);
    try {
      const res = await addHubAgent(source.trim());
      spin.stop(`✅ Added '${res.name}' to OpenLiate Hub!`);
      p.outro(`Run your agent:\n  openliate run ${res.name} "Your prompt"`);
    } catch (err: any) {
      spin.stop(`❌ Failed to add agent`);
      p.cancel(err.message);
    }
    return;
  }

  // Browse & Run Existing Hub Agents
  const agents = listHubAgents();
  if (agents.length === 0) {
    p.note("No agents found in hub/agents/. You can add one with 'openliate hub add <owner/repo>' or create with 'openliate create'.", "Hub Empty");
    return;
  }

  const selectedAgentId = await p.select({
    message: "Select an agent to run:",
    options: agents.map(a => ({
      value: a.id,
      label: `${a.id} — [${a.model}]`,
      hint: a.intent.slice(0, 75)
    }))
  });

  if (p.isCancel(selectedAgentId)) {
    p.cancel("Hub exited.");
    return;
  }

  const agentSummary = agents.find(a => a.id === selectedAgentId)!;

  const prompt = await p.text({
    message: `Enter prompt for '${agentSummary.id}':`,
    placeholder: "What would you like the agent to do?",
    validate: (v) => (!v || !v.trim() ? "Prompt is required." : undefined)
  });

  if (p.isCancel(prompt) || !prompt) {
    p.cancel("Run cancelled.");
    return;
  }

  EnvironmentResolver.loadEnv(agentSummary.modulePath);
  const agent = new Agent({ module: agentSummary.modulePath });
  console.log(`\n[OpenLiate] Booting ${agent.name} (v${agent.version})...`);
  console.log(`[OpenLiate] Intent: "${agent.intent}"\n`);

  const t0 = Date.now();
  try {
    const result = await agent.run((prompt as string).trim());
    const latency = Date.now() - t0;

    if (result.thought) {
      console.log(`[Thought]:\n${result.thought}\n`);
    }
    console.log(`[Answer]:\n${result.text.trim()}\n`);
    console.log(`-----------------------------------------------------------`);
    console.log(`Model: ${result.model} | Latency: ${latency}ms | Steps: ${result.totalSteps}\n`);
  } catch (err: any) {
    console.error(`[OpenLiate Error]: ${err.message}`);
  } finally {
    await MCP.closeAll();
  }
}
