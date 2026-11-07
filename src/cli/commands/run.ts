import path from "path";
import fs from "fs";
import { Agent } from "../../layers/agent/harness";
import { EnvironmentResolver } from "../../layers/environment/sandbox";
import { MCP } from "../../layers/tools/mcp";
import { ConfigManager } from "../../core/spec";
import { AUM } from "../../core/aum";

export function resolveModulePath(input: string): string | null {
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
        for (const f of ["agent.ts", "agent.py", "agent.json"]) {
          const sub = path.join(c, f);
          if (fs.existsSync(sub)) return sub;
        }
      }
    }
  }
  return null;
}

export async function handleRunCommand(args: string[]): Promise<void> {
  const moduleArg = args[1];
  const promptArg = args[2];

  if (!moduleArg || !promptArg) {
    console.error("Error: 'openliate run' requires an agent module or name and a prompt string.");
    console.error("Usage: openliate run <agent.json|agent-name> \"<prompt>\"");
    process.exit(1);
  }

  const modulePath = resolveModulePath(moduleArg);
  if (!modulePath) {
    console.error(`Error: Agent module not found for '${moduleArg}'.`);
    console.error(`Checked: ${path.resolve(process.cwd(), moduleArg)}, .openliate/agents/${moduleArg}/agent.json, and hub/agents/${moduleArg}/agent.json`);
    process.exit(1);
  }

  EnvironmentResolver.loadEnv(modulePath);

  try {
    const rawContent = fs.readFileSync(modulePath, "utf-8");
    const parsedModule = AUM.parse(rawContent);
    const modelStr = typeof parsedModule.L === "string" ? parsedModule.L : (parsedModule.L as any)?.model || "";
    const lowerModel = modelStr.toLowerCase();

    if (lowerModel.includes("sarvam") || moduleArg.includes("sarvam") || moduleArg.includes("indic")) {
      await ConfigManager.ensureApiKey("SARVAM_API_KEY", {
        agentName: moduleArg,
        providerName: "Sarvam AI Token Factory (Free Credits at https://dashboard.sarvam.ai)",
        docUrl: "https://dashboard.sarvam.ai"
      });
    }

    const agent = new Agent({ module: parsedModule });
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

