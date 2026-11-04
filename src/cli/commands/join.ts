import * as p from "@clack/prompts";
import { ConfigManager } from "../../core/config";
import { Sarvam } from "../../catalog/sarvam/index";
import { NeonMcpOAuth } from "../../catalog/neon/index";

export const DEFAULT_JOIN_CALLBACK_PORT = 54324;
export const JOIN_PORTAL_URL = "https://openliate.tech/join";

export async function runJoinFlow(): Promise<void> {
  console.log("");
  p.intro("\x1b[36mOpenLiate Setup\x1b[0m");
  p.note("Configure your Sovereign AI Model Layer [L]\n100% Local Setup — No Accounts or Logins Required", "Welcome");

  // Step 1: Select Gateway
  const gatewayChoice = await p.select({
    message: "Select your primary AI Gateway:",
    options: [
      {
        value: "sarvam",
        label: "Sarvam AI Sovereign Stack — [Recommended Sovereign Partner]",
        hint: "India's Sovereign AI (105B, 2B, Bulbul, GLM) · dashboard.sarvam.ai"
      },
      {
        value: "neon",
        label: "Neon AI Gateway — [Enterprise Cloud Multi-Modal]",
        hint: "Serverless Postgres & AI compute gateway · mcp.neon.tech"
      }
    ]
  });

  if (p.isCancel(gatewayChoice)) {
    p.cancel("Setup cancelled.");
    process.exit(0);
  }

  let finalKey = "";

  // Step 2: Configure Keys locally (zero browser popups)
  if (gatewayChoice === "sarvam") {
    finalKey = await ConfigManager.ensureApiKey("SARVAM_API_KEY", {
      providerName: "Sarvam AI Token Factory (105B, GLM 5.3, Gemma 4, Bulbul)",
      docUrl: "https://dashboard.sarvam.ai"
    });
  } else if (gatewayChoice === "neon") {
    const neonToken = process.env.NEON_AI_GATEWAY_TOKEN || ConfigManager.getKey("NEON_AI_GATEWAY_TOKEN") || NeonMcpOAuth.loadSavedToken()?.access_token;
    if (!neonToken) {
      const inputToken = await p.password({
        message: "Enter your NEON_AI_GATEWAY_TOKEN (nt_live_...):",
        validate: (v) => (!v || !v.trim() ? "Token is required." : undefined)
      });
      if (p.isCancel(inputToken)) {
        p.cancel("Setup cancelled.");
        process.exit(0);
      }
      ConfigManager.setGlobalKey("NEON_AI_GATEWAY_TOKEN", inputToken.trim());
      finalKey = inputToken.trim();
    } else {
      console.log("✔ Neon AI Gateway token detected.");
      finalKey = neonToken;
    }

    const neonBaseUrl = process.env.NEON_AI_GATEWAY_BASE_URL || ConfigManager.getKey("NEON_AI_GATEWAY_BASE_URL");
    if (!neonBaseUrl) {
      const inputUrl = await p.text({
        message: "Enter your NEON_AI_GATEWAY_BASE_URL:",
        placeholder: "https://<branch-id>-api.ai.<cell>.<region>.aws.neon.tech",
        validate: (v) => (!v || !v.trim() ? "Base URL is required." : undefined)
      });
      if (p.isCancel(inputUrl)) {
        p.cancel("Setup cancelled.");
        process.exit(0);
      }
      ConfigManager.setGlobalKey("NEON_AI_GATEWAY_BASE_URL", inputUrl.trim());
    }
  }

  // Save metadata to ~/.openliate/config.json
  const config = ConfigManager.readSystemConfig();
  if (!config.keys) config.keys = {};
  (config as any).primaryGateway = gatewayChoice;
  (config as any).mission = "AgentYaan";
  ConfigManager.writeSystemConfig(config);

  p.note(
    `• Primary Gateway: ${gatewayChoice.toUpperCase()}\n• Configuration: Saved locally in ~/.openliate/config.json\n• Architecture: Pure Sovereign BYOAI (Zero central telemetry or rate limits)`,
    "Configuration Saved"
  );

  // Live Verification
  if (finalKey && gatewayChoice === "sarvam") {
    const verifySpinner = p.spinner();
    verifySpinner.start(`Testing live connection to ${gatewayChoice.toUpperCase()}...`);

    try {
      const client = Sarvam.client(finalKey || undefined);
      const res = await client.chat([
        { role: "user", content: "Introduce Mission AgentYaan in one inspiring sentence." }
      ], { model: "glm5.3-flash", maxTokens: 60 });
      verifySpinner.stop(`✔ Sarvam Sovereign AI Live Verified`);
      if (res.text) {
        console.log(`\n\x1b[32m[AgentYaan Sarvam AI Response]:\x1b[0m\n"${res.text.trim()}"\n`);
      }
    } catch (err: any) {
      verifySpinner.stop(`✔ Configuration saved (Verification note: ${err.message})`);
    }
  }

  p.outro("\x1b[32mSetup complete! You are ready to build.\x1b[0m\n");
  console.log(`Quick Start:
  $ openliate run hub/agents/sarvam-agent/agent.json "Namaste, who are you?"
  $ openliate run hub/agents/identity-agent/agent.json "Validate PAN ABCPE1234F"
  $ openliate serve --port 7071
`);
}
