import fs from "fs";
import path from "path";
import * as p from "@clack/prompts";
import { Agent } from "../../layers/agent/harness";
import { EnvironmentResolver } from "../../layers/environment/sandbox";
import { MCP } from "../../layers/tools/mcp";
import { OPENLIATE_VERSION } from "../../core/version";

interface HubAgentSummary {
  id: string;
  name: string;
  intent: string;
  model: string;
  tools: string[];
  manifestPath: string;
}

export function listHubAgents(): HubAgentSummary[] {
  const hubDir = path.resolve(process.cwd(), "hub", "agents");
  if (!fs.existsSync(hubDir)) return [];

  const entries = fs.readdirSync(hubDir, { withFileTypes: true });
  const list: HubAgentSummary[] = [];

  for (const ent of entries) {
    if (ent.isDirectory()) {
      const manifestPath = path.join(hubDir, ent.name, "agent.json");
      if (fs.existsSync(manifestPath)) {
        try {
          const raw = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
          list.push({
            id: ent.name,
            name: raw.A?.name || ent.name,
            intent: raw.A?.intent || "Autonomous Sovereign Agent",
            model: typeof raw.L === "string" ? raw.L : (raw.L?.model || "sarvam/sarvam-105b"),
            tools: Array.isArray(raw.T) ? raw.T : [],
            manifestPath
          });
        } catch {}
      }
    }
  }

  return list;
}

export async function handleCreateCommand(): Promise<void> {
  console.log("");
  p.intro("\x1b[36mOpenLiate — 5-Pillar L·I·A·T·E Agent Studio\x1b[0m");
  p.note(
    "Construct an autonomous agent aligned with the 5 Sovereign Pillars:\n" +
    "[L] Model  ->  [I] Knowledge  ->  [A] Harness  ->  [T] Tools  ->  [E] Sandbox",
    "LIATE Architecture"
  );

  // Pillar 1: [L] Model
  const modelChoice = await p.select({
    message: "1. [L] Model Layer — Select Intelligence Factory:",
    options: [
      {
        value: "sarvam/sarvam-105b",
        label: "sarvam/sarvam-105b — [Sovereign Indic Flagship]",
        hint: "Sarvam AI Indian LLM (22 Languages)"
      },
      {
        value: "sarvam/sarvam-2b",
        label: "sarvam/sarvam-2b — [Ultra-fast Sovereign Edge]",
        hint: "Sub-millisecond latency for real-time tasks"
      },
      {
        value: "neon/gpt-4o",
        label: "neon/gpt-4o — [Neon AI Gateway Frontier]",
        hint: "Frontier multi-modal intelligence via Neon"
      },
      {
        value: "neon/claude-3-5-sonnet",
        label: "neon/claude-3-5-sonnet — [Neon AI Gateway Reasoning]",
        hint: "Complex code synthesis and reasoning via Neon"
      },
      {
        value: "neon/meta-llama-3.3-70b",
        label: "neon/meta-llama-3.3-70b — [Neon Open Frontier]",
        hint: "Open-weight reasoning via Neon AI Gateway"
      }
    ]
  });

  if (p.isCancel(modelChoice)) {
    p.cancel("Agent creation cancelled.");
    return;
  }

  // Pillar 2: [I] Knowledge & Memory
  const memoryChoice = await p.select({
    message: "2. [I] Knowledge Layer — Select Session & Memory Retention:",
    options: [
      {
        value: "file",
        label: "Persistent Disk Knowledge (sessions/<name>.json)",
        hint: "Remembers conversation across CLI runs"
      },
      {
        value: ":memory:",
        label: "Ephemeral In-Memory (:memory:)",
        hint: "Resets memory after every run"
      }
    ]
  });

  if (p.isCancel(memoryChoice)) {
    p.cancel("Agent creation cancelled.");
    return;
  }

  // Pillar 3: [A] Harness (Name, Intent, Steps)
  const agentName = await p.text({
    message: "3. [A] Harness Layer — Enter Agent Identifier / Name:",
    placeholder: "indic_translator",
    validate: (v) => (!v || !v.trim() ? "Agent name is required." : undefined)
  });

  if (p.isCancel(agentName)) {
    p.cancel("Agent creation cancelled.");
    return;
  }

  const cleanName = (agentName as string).trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_");
  const agentDirName = cleanName.replace(/_/g, "-");

  const agentIntent = await p.text({
    message: "3. [A] Harness Layer — Define Agent Intent & Persona:",
    placeholder: "Autonomous agent that translates documents across 22 Indian languages",
    initialValue: `Specialized autonomous agent powered by ${modelChoice}`
  });

  if (p.isCancel(agentIntent)) {
    p.cancel("Agent creation cancelled.");
    return;
  }

  // Pillar 4: [T] Tools & MCP
  const selectedTools = await p.multiselect({
    message: "4. [T] Tools Layer — Select MCP Protocols & Builtin Tools:",
    options: [
      {
        value: "mcp:sarvam",
        label: "mcp:sarvam — Sarvam AI Token Factory & Speech Tools",
        hint: "TTS, STT, and Indic document tools"
      },
      {
        value: "verify_identity",
        label: "verify_identity — Indian Identity Verifier",
        hint: "Validates 12-digit Aadhaar (Verhoeff) & PAN cards"
      },
      {
        value: "mcp:fetch",
        label: "mcp:fetch — Web Research & Page Scraper",
        hint: "Fetches web URLs for live context extraction"
      },
      {
        value: "mcp:agentmail:list_inboxes,get_inbox,search_messages",
        label: "mcp:agentmail — Autonomous Email Inbox",
        hint: "Read, search, and manage email inboxes"
      }
    ],
    required: false
  });

  if (p.isCancel(selectedTools)) {
    p.cancel("Agent creation cancelled.");
    return;
  }

  // Pillar 5: [E] Sandbox & Environment Variables
  const envConfig: Record<string, string> = {};
  if ((modelChoice as string).startsWith("sarvam") || (selectedTools as string[]).includes("mcp:sarvam")) {
    envConfig["SARVAM_API_KEY"] = "$SARVAM_API_KEY";
  }
  if ((modelChoice as string).startsWith("neon")) {
    envConfig["NEON_AI_GATEWAY_TOKEN"] = "$NEON_AI_GATEWAY_TOKEN";
    envConfig["NEON_AI_GATEWAY_BASE_URL"] = "$NEON_AI_GATEWAY_BASE_URL";
  }
  if ((selectedTools as string[]).some(t => t.includes("agentmail"))) {
    envConfig["AGENTMAIL_API_KEY"] = "$AGENTMAIL_API_KEY";
  }

  // Build the compliant AUM (Agent Universal Manifest)
  const memoryValue = memoryChoice === "file" ? `sessions/${agentDirName}` : ":memory:";

  const manifest = {
    L: modelChoice as string,
    I: {
      memory: memoryValue
    },
    A: {
      name: cleanName,
      version: "0.0.1",
      intent: (agentIntent as string).trim(),
      maxSteps: 5
    },
    T: selectedTools as string[],
    E: envConfig
  };

  // Save to hub/agents/<agentDirName>/agent.json
  const targetDir = path.resolve(process.cwd(), "hub", "agents", agentDirName);
  fs.mkdirSync(targetDir, { recursive: true });
  const targetFile = path.join(targetDir, "agent.json");
  fs.writeFileSync(targetFile, JSON.stringify(manifest, null, 2) + "\n", "utf-8");

  p.note(
    `[L] Model:       ${manifest.L}\n` +
    `[I] Knowledge:   ${manifest.I.memory}\n` +
    `[A] Harness:     ${manifest.A.name} (v${manifest.A.version})\n` +
    `[T] Tools:       ${manifest.T.length > 0 ? manifest.T.join(", ") : "None"}\n` +
    `[E] Sandbox:     ${Object.keys(manifest.E).join(", ") || "Zero secrets required"}\n\n` +
    `Saved to: hub/agents/${agentDirName}/agent.json`,
    "Agent Manifest Created Successfully"
  );

  // Instant Run Option
  const runNow = await p.confirm({
    message: `Would you like to execute '${cleanName}' right now?`,
    initialValue: true
  });

  if (!p.isCancel(runNow) && runNow) {
    const testPrompt = await p.text({
      message: "Enter prompt for your agent:",
      placeholder: "Hello! Tell me what you can do.",
      initialValue: "Namaste! Introduce yourself and list your capabilities."
    });

    if (!p.isCancel(testPrompt) && typeof testPrompt === "string" && testPrompt.trim()) {
      EnvironmentResolver.loadEnv(targetFile);
      const agent = new Agent({ manifest: targetFile });
      console.log(`\n[OpenLiate] Booting ${agent.name} (v${agent.version})...`);
      console.log(`[OpenLiate] Intent: "${agent.intent}"\n`);

      const t0 = Date.now();
      try {
        const result = await agent.run(testPrompt.trim());
        const latency = Date.now() - t0;

        if (result.thought) {
          console.log(`[Thought]:\n${result.thought}\n`);
        }
        console.log(`[Answer]:\n${result.text.trim()}\n`);
        console.log(`-----------------------------------------------------------`);
        console.log(`Model: ${result.model} | Latency: ${latency}ms | Steps: ${result.totalSteps}\n`);
      } catch (err: any) {
        console.error(`[Agent Execution Note]: ${err.message}`);
      } finally {
        await MCP.closeAll();
      }
    }
  }

  p.outro(`\x1b[32mAgent '${cleanName}' is ready! Run anytime via:\x1b[0m\n  $ openliate run ${agentDirName} "<prompt>"\n`);
}

export async function handleHubCommand(): Promise<void> {
  console.log("");
  p.intro("\x1b[36mOpenLiate Hub & Studio\x1b[0m");

  const action = await p.select({
    message: "Select an action:",
    options: [
      {
        value: "run",
        label: "1. Run Pre-Built Agent from Hub",
        hint: "Browse ready-to-run sovereign agents"
      },
      {
        value: "create",
        label: "2. Create New Agent (5-Pillar L·I·A·T·E Builder)",
        hint: "Design, configure, and launch a custom agent"
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

  // Browse & Run Existing Hub Agents
  const agents = listHubAgents();
  if (agents.length === 0) {
    p.note("No agents found in hub/agents/. You can create one using 'openliate create'.", "Hub Empty");
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

  EnvironmentResolver.loadEnv(agentSummary.manifestPath);
  const agent = new Agent({ manifest: agentSummary.manifestPath });
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

