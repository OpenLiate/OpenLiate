import { liate } from "./src/liate";

export class HelloAgent extends liate {
  L = "sarvam/sarvam-105b";
  I = { memory: "sessions/hello-agent" };
  A = { name: "hello_agent", intent: "Autonomous Sovereign Agent" };
  T = {
    fetch: {
      command: "uvx",
      args: ["mcp-server-fetch"],
      tools: ["*"]
    }
  };
  E = { SARVAM_API_KEY: "$SARVAM_API_KEY" };
}

async function main() {
  const agent = new HelloAgent();
  console.log("=== [agent.ts] Agent Unified Module (AUM) ===");
  console.log(JSON.stringify(agent.toModule(), null, 2));

  console.log("\n=== [agent.ts] Executing via Orchestration Module (OM) ===");
  const result = await agent.run("Introduce yourself in one sentence and say Namaste.");
  console.log("\nAgent Output:\n" + result.text);
  console.log(`\nModel: ${result.model} | Latency: ${result.durationMs}ms | Steps: ${result.totalSteps}`);
}

if (import.meta.main) {
  main().catch(console.error);
}

