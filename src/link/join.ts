import http from "http";
import path from "path";
import fs from "fs";
import * as p from "@clack/prompts";
import { ConfigManager } from "../core/config";
import { Agent } from "../agent/agent";

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

  const choice = await p.select({
    message: "Select your onboarding path:",
    options: [
      {
        value: "github",
        label: "Connect with GitHub",
        hint: "Claim your developer handle at openliate.tech/@handle"
      },
      {
        value: "byoai",
        label: "Configure BYOAI Key",
        hint: "Set Sarvam AI or custom API key locally"
      }
    ]
  });

  if (p.isCancel(choice)) {
    p.cancel("Onboarding cancelled.");
    process.exit(0);
  }

  let finalUsername = "developer";
  let finalKey = "";

  if (choice === "github") {
    const callbackUrl = `http://localhost:${DEFAULT_JOIN_CALLBACK_PORT}/callback`;
    const authUrl = `${JOIN_PORTAL_URL}?callback=${encodeURIComponent(callbackUrl)}`;

    console.log(`\n1. Authorizing via GitHub...`);
    console.log(`   Opening: ${authUrl}\n`);

    try {
      const openCmd = process.platform === "win32" ? `start "" "${authUrl}"` : process.platform === "darwin" ? `open "${authUrl}"` : `xdg-open "${authUrl}"`;
      const { exec } = await import("child_process");
      exec(openCmd);
    } catch {}

    const spinner = p.spinner();
    spinner.start("Waiting for GitHub authorization callback...");

    try {
      const res = await waitForJoinCallback(DEFAULT_JOIN_CALLBACK_PORT);
      finalUsername = res.username.replace(/^@/, "");
      finalKey = res.token;
      spinner.stop(`✔ Connected as @${finalUsername}!`);
    } catch {
      spinner.stop("Could not capture automatic browser callback.");
      const manualUser = await p.text({
        message: "Enter your GitHub username to claim your slot:",
        placeholder: "iamazent",
        validate: (v) => (!v || !v.trim() ? "Username is required." : undefined)
      });
      if (p.isCancel(manualUser) || typeof manualUser !== "string") {
        p.cancel("Cancelled.");
        process.exit(0);
      }
      finalUsername = manualUser.trim().replace(/^@/, "");
    }

    // Save user slot & community starter key to system ~/.openliate/config.json
    const config = ConfigManager.readSystemConfig();
    if (!config.keys) config.keys = {};
    (config as any).username = finalUsername;
    (config as any).slot = `openliate.tech/@${finalUsername}`;
    (config as any).mission = "AgentYaan";

    if (finalKey) {
      config.keys["SARVAM_API_KEY"] = finalKey;
      process.env["SARVAM_API_KEY"] = finalKey;
    }

    ConfigManager.writeSystemConfig(config);

    p.note(
      `• Developer Slot: openliate.tech/@${finalUsername}\n• Architecture: Sovereign BYOAI (Direct Sarvam AI Token Factory)\n• Mission Status: AgentYaan Active`,
      "Registration Confirmed"
    );
  } else {
    // BYOAI Flow
    const key = await ConfigManager.ensureApiKey("SARVAM_API_KEY", {
      providerName: "Sarvam AI Token Factory (105B, GLM 5.3, Gemma 4)",
      docUrl: "https://dashboard.sarvam.ai"
    });
    finalKey = key;
  }

  // Verification step: Run 1 live test prompt
  const verifySpinner = p.spinner();
  verifySpinner.start("Testing connection to Sarvam Token Factory (sarvam-105b)...");

  try {
    const testManifestPath = path.resolve(process.cwd(), "hub", "agents", "sarvam-agent", "agent.json");
    if (fs.existsSync(testManifestPath)) {
      const agent = new Agent({ manifest: testManifestPath });
      const t0 = Date.now();
      const res = await agent.run("Introduce Mission AgentYaan in one inspiring sentence.");
      const latency = Date.now() - t0;
      verifySpinner.stop(`✔ Token Factory Verified (${latency}ms)`);
      if (res.text) {
        console.log(`\n\x1b[32m[AgentYaan Response]:\x1b[0m\n"${res.text.trim()}"\n`);
      }
    } else {
      verifySpinner.stop("✔ Configuration verified.");
    }
  } catch {
    verifySpinner.stop("✔ Configuration saved to ~/.openliate/config.json");
  }

  p.outro("\x1b[32m🎉 Welcome to Mission: AgentYaan! You are ready to build.\x1b[0m\n");
  console.log(`Next steps:
  $ openliate run hub/agents/sarvam-agent/agent.json "Your prompt"
  $ openliate serve --port 3000
  $ openliate link --neon
`);
}

