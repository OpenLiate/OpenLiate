import { createHash, randomBytes } from "crypto";
import http from "http";
import fs from "fs";
import path from "path";
import os from "os";
import { generateUUIDv7 } from "../../core/uuid";
import { OPENLIATE_VERSION } from "../../core/version";
import { base64url, generatePKCE, type ClientRegistration } from "../../core/pkce";
export { base64url, generatePKCE, type ClientRegistration };

export const VERCEL_MCP_ENDPOINT = "https://mcp.vercel.com";
export const VERCEL_REGISTER_ENDPOINT = "https://vercel.com/api/login/oauth/register";
export const VERCEL_AUTH_ENDPOINT = "https://vercel.com/oauth/authorize";
export const VERCEL_TOKEN_ENDPOINT = "https://vercel.com/api/login/oauth/token";
export const VERCEL_API_ENDPOINT = "https://api.vercel.com";
export const DEFAULT_VERCEL_CALLBACK_PORT = 54322;
export const DEFAULT_VERCEL_CALLBACK_URL = `http://localhost:${DEFAULT_VERCEL_CALLBACK_PORT}/callback`;


export interface VercelTokenData {
  access_token: string;
  refresh_token?: string;
  user_id?: string;
  team_id?: string;
  email?: string;
  scope?: string;
  saved_at: string;
}


export class VercelMcpOAuth {
  public static getTokenPath(): string {
    const configDir = process.env.OPENLIATE_CONFIG_DIR || process.env.LIATE_CONFIG_DIR;
    if (configDir) {
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      return path.join(configDir, "vercel.json");
    }

    const candidateDirs = [
      path.resolve(process.cwd(), ".openliate", "link"),
      path.resolve(process.cwd(), "..", ".openliate", "link"),
      path.resolve(__dirname, "..", "..", ".openliate", "link")
    ];

    for (const d of candidateDirs) {
      try {
        if (!fs.existsSync(d)) {
          fs.mkdirSync(d, { recursive: true });
        }
        return path.join(d, "vercel.json");
      } catch {}
    }

    try {
      const homeLinkDir = path.join(os.homedir(), ".openliate", "link");
      if (!fs.existsSync(homeLinkDir)) {
        fs.mkdirSync(homeLinkDir, { recursive: true });
      }
      return path.join(homeLinkDir, "vercel.json");
    } catch {
      return path.resolve(process.cwd(), ".openliate", "link", "vercel.json");
    }
  }

  public static loadToken(): VercelTokenData | null {
    const configDir = process.env.OPENLIATE_CONFIG_DIR || process.env.LIATE_CONFIG_DIR;
    const candidatePaths = [
      configDir ? path.join(configDir, "vercel.json") : "",
      configDir ? path.join(configDir, "vercel_token.json") : "",
      VercelMcpOAuth.getTokenPath(),
      path.resolve(process.cwd(), ".openliate", "link", "vercel.json"),
      path.resolve(process.cwd(), ".openliate", "link", "vercel_token.json"),
      path.resolve(process.cwd(), ".openliate", "vercel.json"),
      path.resolve(process.cwd(), ".openliate", "vercel_token.json"),
      path.resolve(process.cwd(), "..", ".openliate", "link", "vercel.json"),
      path.resolve(process.cwd(), "..", ".openliate", "vercel_token.json"),
      path.resolve(__dirname, "..", "..", ".openliate", "link", "vercel.json"),
      path.resolve(__dirname, "..", "..", ".openliate", "vercel_token.json"),
      path.join(os.homedir(), ".openliate", "link", "vercel.json"),
      path.join(os.homedir(), ".openliate", "vercel_token.json")
    ].filter(Boolean);

    for (const p of candidatePaths) {
      try {
        if (fs.existsSync(p)) {
          const raw = fs.readFileSync(p, "utf-8");
          const data = JSON.parse(raw) as VercelTokenData;
          if (data && data.access_token) {
            return data;
          }
        }
      } catch {}
    }

    const envToken = process.env.VERCEL_TOKEN || process.env.VERCEL_MCP_TOKEN;
    if (envToken) {
      return {
        access_token: envToken,
        saved_at: new Date().toISOString()
      };
    }

    return null;
  }

  public static saveToken(data: VercelTokenData): void {
    const tokenPath = VercelMcpOAuth.getTokenPath();
    const dir = path.dirname(tokenPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(tokenPath, JSON.stringify(data, null, 2), "utf-8");

    const configDir = process.env.OPENLIATE_CONFIG_DIR || process.env.LIATE_CONFIG_DIR;
    if (configDir) {
      return;
    }

    try {
      const mirrorPath = path.resolve(process.cwd(), ".openliate", "link", "vercel.json");
      const mirrorDir = path.dirname(mirrorPath);
      if (!fs.existsSync(mirrorDir)) {
        fs.mkdirSync(mirrorDir, { recursive: true });
      }
      fs.writeFileSync(mirrorPath, JSON.stringify(data, null, 2), "utf-8");
    } catch {}

    try {
      const envPath = path.join(process.cwd(), ".env.local");
      let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf-8") : "";
      if (content.includes("VERCEL_TOKEN=")) {
        content = content.replace(/VERCEL_TOKEN=.*(\r?\n|$)/, `VERCEL_TOKEN=${data.access_token}\n`);
      } else {
        content += `\n# OpenLiate Vercel MCP Access Token\nVERCEL_TOKEN=${data.access_token}\n`;
      }
      fs.writeFileSync(envPath, content, "utf-8");
    } catch {}
  }

  public static clearToken(): void {
    const configDir = process.env.OPENLIATE_CONFIG_DIR || process.env.LIATE_CONFIG_DIR;
    const candidatePaths = [
      configDir ? path.join(configDir, "vercel.json") : "",
      configDir ? path.join(configDir, "vercel_token.json") : "",
      VercelMcpOAuth.getTokenPath(),
      path.resolve(process.cwd(), ".openliate", "link", "vercel.json"),
      path.resolve(process.cwd(), ".openliate", "link", "vercel_token.json"),
      path.resolve(process.cwd(), ".openliate", "vercel.json"),
      path.resolve(process.cwd(), ".openliate", "vercel_token.json"),
      path.resolve(process.cwd(), "..", ".openliate", "link", "vercel.json"),
      path.resolve(process.cwd(), "..", ".openliate", "vercel_token.json"),
      path.resolve(__dirname, "..", "..", ".openliate", "link", "vercel.json"),
      path.resolve(__dirname, "..", "..", ".openliate", "vercel_token.json"),
      path.resolve(os.homedir(), ".openliate", "link", "vercel.json"),
      path.resolve(os.homedir(), ".openliate", "vercel_token.json")
    ].filter(Boolean);

    for (const p of candidatePaths) {
      try {
        if (fs.existsSync(p)) {
          fs.unlinkSync(p);
        }
      } catch {}
    }

    try {
      const envPath = path.join(process.cwd(), ".env.local");
      if (fs.existsSync(envPath)) {
        let content = fs.readFileSync(envPath, "utf-8");
        content = content.replace(/VERCEL_TOKEN=.*(\r?\n|$)/g, "");
        fs.writeFileSync(envPath, content.trim() + "\n", "utf-8");
      }
    } catch {}

    delete process.env.VERCEL_TOKEN;
    delete process.env.VERCEL_MCP_TOKEN;
  }

  public static async registerClient(callbackUrl: string): Promise<ClientRegistration> {
    try {
      const res = await fetch(VERCEL_REGISTER_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_name: "OpenLiate CLI Vercel MCP",
          client_uri: "https://openliate.tech",
          redirect_uris: [callbackUrl],
          grant_types: ["authorization_code", "refresh_token"],
          response_types: ["code"],
          token_endpoint_auth_method: "none"
        })
      });

      if (res.ok) {
        const body = (await res.json()) as any;
        if (body.client_id) {
          return {
            client_id: body.client_id,
            client_secret: body.client_secret
          };
        }
      }
    } catch {}

    return {
      client_id: "openliate-vercel-mcp-cli"
    };
  }

  public static buildAuthUrl(
    clientId: string,
    redirectUri: string,
    codeChallenge: string,
    state: string
  ): string {
    const url = new URL(VERCEL_AUTH_ENDPOINT);
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", "openid email offline_access profile");
    url.searchParams.set("code_challenge", codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
    url.searchParams.set("state", state);
    url.searchParams.set("resource", "https://mcp.vercel.com/");
    return url.toString();
  }

  public static async exchangeCodeForToken(
    clientId: string,
    code: string,
    codeVerifier: string,
    redirectUri: string
  ): Promise<VercelTokenData> {
    const params = new URLSearchParams({
      grant_type: "authorization_code",
      code: code,
      redirect_uri: redirectUri,
      client_id: clientId,
      code_verifier: codeVerifier
    });

    const res = await fetch(VERCEL_TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Vercel MCP token exchange failed (${res.status}): ${errText}`);
    }

    const data = (await res.json()) as any;
    if (!data.access_token) {
      throw new Error("No access_token returned by Vercel token endpoint");
    }

    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      user_id: data.user_id,
      team_id: data.team_id,
      scope: data.scope,
      saved_at: new Date().toISOString()
    };
  }
}

export class VercelMcpClient {
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  public async callMcp(method: string, params: Record<string, any> = {}): Promise<any> {
    const rpcPayload = {
      jsonrpc: "2.0",
      id: Date.now(),
      method: method,
      params: params
    };

    const res = await fetch(VERCEL_MCP_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.token}`,
        Accept: "application/json, text/event-stream"
      },
      body: JSON.stringify(rpcPayload)
    });

    const text = await res.text();
    const match = text.match(/data: ({.*})/);
    if (match) {
      return JSON.parse(match[1]);
    }
    try {
      return JSON.parse(text);
    } catch {
      return { raw: text };
    }
  }

  public async listProjects(): Promise<any[]> {
    const res = await fetch(`${VERCEL_API_ENDPOINT}/v9/projects?limit=50`, {
      headers: {
        Authorization: `Bearer ${this.token}`
      }
    });

    if (res.ok) {
      const data = (await res.json()) as any;
      return data.projects || [];
    }

    const mcpRes = await this.callMcp("tools/call", {
      name: "list_projects",
      arguments: {}
    });
    try {
      const content = mcpRes.result?.content?.[0]?.text;
      return content ? JSON.parse(content) : [];
    } catch {
      return [];
    }
  }

  public async deployRuntime(options: {
    name?: string;
    target?: string;
    mode?: "function" | "daemon";
    files?: Array<{ file: string; data: string; encoding?: string }>;
  } = {}): Promise<{
    id: string;
    url: string;
    runtimeUrl: string;
    projectId?: string;
    name: string;
    mode: "function" | "daemon";
  }> {
    const isDaemon = options.mode === "daemon";
    const uuid7 = generateUUIDv7();
    const cleanId = uuid7.replace(/-/g, "").slice(0, 8);
    const projectName = options.name || (isDaemon ? "openliate-daemon" : "openliate");

    let bundleCode = "";
    if (options.files && options.files.length > 0) {
      const targetFile = options.files.find((f) => f.file === "api/index.js" || f.file === "dist/runtime/index.js");
      if (targetFile) bundleCode = targetFile.data;
    }

    if (!bundleCode) {
      const candidatePaths = [
        path.resolve(process.cwd(), "dist", "runtime", "index.js"),
        path.resolve(process.cwd(), "OpenLiate", "dist", "runtime", "index.js"),
        path.resolve(__dirname, "..", "..", "dist", "runtime", "index.js")
      ];
      for (const p of candidatePaths) {
        if (fs.existsSync(p)) {
          bundleCode = fs.readFileSync(p, "utf-8");
          break;
        }
      }
    }

    if (!bundleCode) {
      throw new Error(
        "Could not locate dist/runtime/index.js. Please run 'bun run build:runtime' first."
      );
    }

    let files: Array<{ file: string; data: string; encoding?: string }>;

    if (isDaemon) {
      let dockerfileContent = "";
      const dockerfileCandidates = [
        path.resolve(process.cwd(), "Dockerfile"),
        path.resolve(process.cwd(), "OpenLiate", "Dockerfile"),
        path.resolve(__dirname, "..", "..", "Dockerfile")
      ];
      for (const df of dockerfileCandidates) {
        if (fs.existsSync(df)) {
          dockerfileContent = fs.readFileSync(df, "utf-8");
          break;
        }
      }
      if (!dockerfileContent) {
        dockerfileContent = `FROM node:24-alpine
WORKDIR /app
COPY dist/runtime ./dist/runtime
COPY package.json ./package.json
EXPOSE 3000
CMD ["node", "dist/runtime/index.js"]`;
      }

      files = [
        {
          file: "dist/runtime/index.js",
          data: bundleCode,
          encoding: "utf-8"
        },
        {
          file: "Dockerfile",
          data: dockerfileContent,
          encoding: "utf-8"
        },
        {
          file: "package.json",
          data: JSON.stringify(
            {
              name: projectName,
              version: OPENLIATE_VERSION,
              type: "module",
              main: "dist/runtime/index.js"
            },
            null,
            2
          ),
          encoding: "utf-8"
        },
        {
          file: "vercel.json",
          data: JSON.stringify(
            {
              version: 2,
              daemons: {
                "openliate-daemon": {
                  entrypoint: "Dockerfile",
                  command: ["node", "dist/runtime/index.js"],
                  instances: {
                    iad1: 1
                  }
                }
              }
            },
            null,
            2
          ),
          encoding: "utf-8"
        }
      ];
    } else {
      files = [
        {
          file: "api/index.js",
          data: bundleCode,
          encoding: "utf-8"
        },
        {
          file: "package.json",
          data: JSON.stringify(
            {
              name: projectName,
              version: OPENLIATE_VERSION,
              type: "module",
              main: "api/index.js"
            },
            null,
            2
          ),
          encoding: "utf-8"
        },
        {
          file: "vercel.json",
          data: JSON.stringify(
            {
              version: 2,
              routes: [
                {
                  src: "/(.*)",
                  dest: "/api/index.js"
                }
              ]
            },
            null,
            2
          ),
          encoding: "utf-8"
        }
      ];
    }

    const deployPayload = {
      name: projectName,
      target: options.target || "production",
      files,
      projectSettings: {
        framework: null
      }
    };

    const deployRes = await fetch(
      `${VERCEL_API_ENDPOINT}/v13/deployments?skipAutoDetectionConfirmation=1`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.token}`
        },
        body: JSON.stringify(deployPayload)
      }
    );

    const deployData = (await deployRes.json()) as any;
    if (!deployRes.ok || !deployData.url) {
      throw new Error(
        `Vercel deployment failed (${deployRes.status}): ${deployData.error?.message || "Unknown error"}`
      );
    }

    const rawUrl = deployData.alias?.[0] || deployData.url;
    const deploymentUrl = rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`;
    const runtimeUrl = `${deploymentUrl}/run`;

    try {
      const deployPath = path.resolve(process.cwd(), ".openliate", "vercel_deployment.json");
      const deployDir = path.dirname(deployPath);
      if (!fs.existsSync(deployDir)) {
        fs.mkdirSync(deployDir, { recursive: true });
      }
      fs.writeFileSync(
        deployPath,
        JSON.stringify(
          {
            projectName,
            deploymentUrl,
            runtimeUrl,
            id: deployData.id,
            uuid7,
            deployedAt: new Date().toISOString()
          },
          null,
          2
        ),
        "utf-8"
      );
    } catch {}

    return {
      id: deployData.id,
      url: deploymentUrl,
      runtimeUrl,
      projectId: deployData.project?.id || deployData.projectId || deployData.id,
      name: projectName,
      mode: isDaemon ? "daemon" : "function"
    };
  }
}

export async function runVercelLinkFlow(options: {
  port?: number;
  openBrowser?: boolean;
} = {}): Promise<VercelTokenData> {
  const port = options.port || DEFAULT_VERCEL_CALLBACK_PORT;
  const redirectUri = `http://localhost:${port}/callback`;

  console.log(`\n▲ [OpenLiate] Registering Dynamic Client with Vercel MCP...`);
  const reg = await VercelMcpOAuth.registerClient(redirectUri);

  const { codeVerifier, codeChallenge } = generatePKCE();
  const state = base64url(randomBytes(16));

  const authUrl = VercelMcpOAuth.buildAuthUrl(reg.client_id, redirectUri, codeChallenge, state);

  return new Promise<VercelTokenData>((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        const reqUrl = new URL(req.url || "/", `http://localhost:${port}`);
        if (reqUrl.pathname === "/callback") {
          const code = reqUrl.searchParams.get("code");
          const retState = reqUrl.searchParams.get("state");
          const error = reqUrl.searchParams.get("error");

          if (error) {
            res.writeHead(400, { "Content-Type": "text/html" });
            res.end(`<h3>Vercel MCP Link Failed</h3><p>${error}</p>`);
            try { (server as any).closeAllConnections?.(); } catch {}
          try { (server as any).unref?.(); } catch {}
          server.close();
            return reject(new Error(`Vercel OAuth Error: ${error}`));
          }

          if (!code || retState !== state) {
            res.writeHead(400, { "Content-Type": "text/html" });
            res.end(`<h3>Invalid State or Missing Code</h3>`);
            server.close();
            return reject(new Error("State mismatch or missing authorization code"));
          }

          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Connection": "close" });
          res.end(`<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>OpenLiate — Authentication Successful</title>
  </head>
  <body style="font-family: -apple-system, system-ui, sans-serif; padding: 40px; text-align: center; color: #111;">
    <h2>Authentication successful</h2>
    <p>You can close this window and return to your terminal.</p>
    <script>try { window.close(); } catch(e) {}</script>
  </body>
</html>`);
          server.close();

          console.log(`▲ [OpenLiate] Exchanging Authorization Code with Vercel...`);
          const tokenData = await VercelMcpOAuth.exchangeCodeForToken(
            reg.client_id,
            code,
            codeVerifier,
            redirectUri
          );

          VercelMcpOAuth.saveToken(tokenData);
          console.log(`▲ [OpenLiate] Vercel MCP Access Token saved successfully!`);
          resolve(tokenData);
        }
      } catch (err) {
        server.close();
        reject(err);
      }
    });

    server.listen(port, () => {
      console.log(`\n▲ [OpenLiate] Complete authorization in your browser:\n`);
      console.log(`   ${authUrl}\n`);

      if (options.openBrowser !== false) {
        try {
          const { exec } = require("child_process");
          const startCmd =
            process.platform === "win32"
              ? `start "" "${authUrl}"`
              : process.platform === "darwin"
                ? `open "${authUrl}"`
                : `xdg-open "${authUrl}"`;
          exec(startCmd);
        } catch {}
      }
    });
  });
}

