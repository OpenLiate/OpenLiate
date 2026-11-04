import http from "http";
import path from "path";
import fs from "fs";
import * as p from "@clack/prompts";
import { ConfigManager } from "../core/config";
import { Agent } from "../agent/agent";
import { Sarvam } from "../catalog/sarvam/index";
import { OmniRoute } from "../llm/omniroute/index";
import { NeonMcpOAuth } from "../catalog/neon/index";

export const DEFAULT_JOIN_CALLBACK_PORT = 54324;
export const JOIN_PORTAL_URL = "https://openliate.tech/join";

export async function waitForJoinCallback(port: number = DEFAULT_JOIN_CALLBACK_PORT): Promise<{ username: string; token: string }> {
  return new Promise((resolve, reject) => {
    let resolved = false;

    const server = http.createServer((req, res) => {
      try {
        const reqUrl = new URL(req.url || "/", `http://localhost:${port}`);
        if (reqUrl.pathname !== "/callback") {
          res.writeHead(404);
          res.end("Not Found");
          return;
        }

        const username = reqUrl.searchParams.get("user") || reqUrl.searchParams.get("username") || "developer";
        const token = reqUrl.searchParams.get("token") || reqUrl.searchParams.get("key") || "";

        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(`<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>OpenLiate — Mission: AgentYaan Authorized</title>
  </head>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #000; color: #fff; padding: 48px; text-align: center;">
    <h2 style="font-size: 28px; margin-bottom: 8px;">Mission: AgentYaan Initiated 🚀</h2>
    <p style="color: rgba(255,255,255,0.7); font-size: 16px;">Welcome aboard, <strong>@${username}</strong>! Developer Slot claimed.</p>
    <p style="color: rgba(255,255,255,0.4); font-size: 13px; margin-top: 24px;">You can close this tab and return to your terminal.</p>
    <script>try { window.close(); } catch(e) {}</script>
  </body>
</html>`);

        server.close();
        if (!resolved) {
          resolved = true;
          resolve({ username, token });
        }
      } catch (err: any) {
        server.close();
        if (!resolved) {
          resolved = true;
          reject(err);
        }
      }
    });

    server.on("error", (err) => {
      if (!resolved) {
        resolved = true;
        reject(err);
      }
    });

    server.listen(port);

    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        server.close();
        reject(new Error("GitHub authorization timed out after 90 seconds."));
      }
    }, 90000);
  });
}

export async function runJoinFlow(): Promise<void> {
  console.log("");
  p.intro("\x1b[36mOpenLiate Join\x1b[0m");
  p.note("Mission: AgentYaan — India's Sovereign AI Agents\nClaim your developer handle at openliate.tech/@handle", "Mission Status");

  // Step 1: Select Gateway
  const gatewayChoice = await p.select({
    message: "Select your primary AI Gateway:",
    options: [
      {
        value: "omniroute",
        label: "OmniRoute Gateway — [Recommended]",
        hint: "Multi-provider BYOAI token gateway · 380+ providers · omniroute.online"
      },
      {
        value: "sarvam",
        label: "Sarvam AI Token Factory — [Dedicated Indic BYOAI]",
        hint: "India's Sovereign AI (105B, 2B, Bulbul, GLM) · dashboard.sarvam.ai"
      },
      {
        value: "neon",
        label: "Neon AI Gateway",
        hint: "Serverless Postgres & AI compute gateway · mcp.neon.tech"
      }
    ]
  });

  if (p.isCancel(gatewayChoice)) {
    p.cancel("Onboarding cancelled.");
    process.exit(0);
  }

  let finalKey = "";
  let finalUsername = "developer";

  // Step 2: Configure BYOAI Key based on choice
  if (gatewayChoice === "omniroute") {
    const omniPrompt = await p.text({
      message: "Enter your OmniRoute API key (or press enter for default pool):",
      placeholder: "omni_live_... or leave empty"
    });
    if (!p.isCancel(omniPrompt) && typeof omniPrompt === "string" && omniPrompt.trim()) {
      finalKey = omniPrompt.trim();
      ConfigManager.setGlobalKey("OMNIROUTE_API_KEY", finalKey);
    }
  } else if (gatewayChoice === "sarvam") {
    finalKey = await ConfigManager.ensureApiKey("SARVAM_API_KEY", {
      providerName: "Sarvam AI Token Factory (105B, GLM 5.3, Gemma 4, Bulbul)",
      docUrl: "https://dashboard.sarvam.ai"
    });
  } else if (gatewayChoice === "neon") {
    const neonToken = NeonMcpOAuth.loadSavedToken();
    if (!neonToken) {
      console.log("\n[OpenLiate] Neon is not linked yet. You can link it anytime via: openliate link --neon");
    } else {
      console.log("\n✔ Neon token detected on disk.");
    }
  }

  // Step 3: Optional GitHub handle claim
  const claimHandle = await p.confirm({
    message: "Would you like to claim your sovereign developer handle (openliate.tech/@handle) via GitHub?",
    initialValue: true
  });

  if (!p.isCancel(claimHandle) && claimHandle) {
    const callbackUrl = `http://localhost:${DEFAULT_JOIN_CALLBACK_PORT}/callback`;
    const authUrl = `${JOIN_PORTAL_URL}?callback=${encodeURIComponent(callbackUrl)}`;

    console.log(`\nOpening GitHub authorization:\n  ${authUrl}\n`);
    try {
      const openCmd = process.platform === "win32" ? `start "" "${authUrl}"` : process.platform === "darwin" ? `open "${authUrl}"` : `xdg-open "${authUrl}"`;
      const { exec } = await import("child_process");
      exec(openCmd);
    } catch {}

    const spinner = p.spinner();
    spinner.start("Waiting for GitHub callback...");

    try {
      const res = await waitForJoinCallback(DEFAULT_JOIN_CALLBACK_PORT);
      finalUsername = res.username.replace(/^@/, "");
      spinner.stop(`✔ Connected as @${finalUsername}!`);
    } catch {
      spinner.stop("Could not capture automatic browser callback.");
      const manualUser = await p.text({
        message: "Enter your GitHub username manually:",
        placeholder: "iamazent",
        validate: (v) => (!v || !v.trim() ? "Username is required." : undefined)
      });
      if (!p.isCancel(manualUser) && typeof manualUser === "string" && manualUser.trim()) {
        finalUsername = manualUser.trim().replace(/^@/, "");
      }
    }
  }

  // Save metadata to ~/.openliate/config.json
  const config = ConfigManager.readSystemConfig();
  if (!config.keys) config.keys = {};
  (config as any).username = finalUsername;
  (config as any).slot = `openliate.tech/@${finalUsername}`;
  (config as any).primaryGateway = gatewayChoice;
  (config as any).mission = "AgentYaan";
  ConfigManager.writeSystemConfig(config);

  p.note(
    `• Developer Slot: openliate.tech/@${finalUsername}\n• Primary Gateway: ${gatewayChoice.toUpperCase()}\n• Architecture: Pure Sovereign BYOAI (Zero central rate limits)\n• Mission Status: AgentYaan Active`,
    "Registration Confirmed"
  );

  // Live Verification
  if (finalKey) {
    const verifySpinner = p.spinner();
    verifySpinner.start(`Testing live connection to ${gatewayChoice.toUpperCase()}...`);

    try {
      if (gatewayChoice === "sarvam") {
        const client = Sarvam.client(finalKey || undefined);
        const res = await client.chat([
          { role: "user", content: "Introduce Mission AgentYaan in one inspiring sentence." }
        ], { model: "glm5.3-flash", maxTokens: 60 });
        verifySpinner.stop(`✔ Sarvam Token Factory Live Verified`);
        if (res.text) {
          console.log(`\n\x1b[32m[AgentYaan Sarvam AI Response]:\x1b[0m\n"${res.text.trim()}"\n`);
        }
      } else if (gatewayChoice === "omniroute") {
        const omni = OmniRoute.gateway(finalKey || undefined);
        const res = await omni.chat([
          { role: "user", content: "Introduce Mission AgentYaan in one inspiring sentence." }
        ]);
        verifySpinner.stop(`✔ OmniRoute Live Verified (${res.model} via ${res.provider})`);
        if (res.text) {
          console.log(`\n\x1b[32m[AgentYaan OmniRoute Response]:\x1b[0m\n"${res.text.trim()}"\n`);
        }
      } else {
        verifySpinner.stop(`✔ Gateway Configured`);
      }
    } catch (err: any) {
      verifySpinner.stop(`✔ Configuration saved (Verification note: ${err.message})`);
    }
  }

  p.outro("\x1b[32m🎉 Welcome to Mission: AgentYaan! You are ready to build.\x1b[0m\n");
  console.log(`Next steps:
  $ openliate run hub/agents/code-agent/agent.json "Write a concurrent Go function"
  $ openliate run hub/agents/indic-agent/agent.json "नमस्ते भारत!"
  $ openliate serve --port 3000
`);
}
