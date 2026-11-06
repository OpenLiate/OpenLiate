import path from "path";
import fs from "fs";
import { Agent } from "../../layers/agent/harness";
import { EnvironmentResolver } from "../../layers/environment/sandbox";
import { MCP } from "../../layers/tools/mcp";
import { ConfigManager } from "../../core/config";

export function resolveManifestPath(input: string): string | null {
  const candidates = [
    path.resolve(process.cwd(), input),
    path.resolve(process.cwd(), ".openliate", "agents", input, "agent.json"),
    path.resolve(process.cwd(), ".openliate", "agents", input),
    path.resolve(process.cwd(), "hub", "agents", input, "agent.json"),
    path.resolve(process.cwd(), "hub", "agents", input),
    path.resolve(process.cwd(), "OpenLiate", ".openliate", "agents", input, "agent.json"),
    path.resolve(process.cwd(), "OpenLiate", ".openliate", "agents", input),
    path.resolve(process.cwd(), "OpenLiate", "hub", "agents", input, "agent.json"),
    path.resolve(process.cwd(), "OpenLiate", "hub", "agents", input),
    path.resolve(__dirname, "..", "..", "..", ".openliate", "agents", input, "agent.json"),
    path.resolve(__dirname, "..", "..", "..", "hub", "agents", input, "agent.json"),
    path.resolve(__dirname, "..", "..", "..", "hub", "agents", input)
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

export async function handleRunCommand(args: string[]): Promise<void> {
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
    console.error(`Checked: ${path.resolve(process.cwd(), manifestArg)}, .openliate/agents/${manifestArg}/agent.json, and hub/agents/${manifestArg}/agent.json`);
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
    await MCP.closeAll();
  }
}

