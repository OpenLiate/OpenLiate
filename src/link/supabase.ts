import { createHash, randomBytes } from "crypto";
import http from "http";
import fs from "fs";
import path from "path";
import os from "os";
import { generateUUIDv7 } from "../core/uuid";

export const SUPABASE_MCP_ENDPOINT = "https://mcp.supabase.com/mcp";
export const SUPABASE_REGISTER_ENDPOINT = "https://api.supabase.com/platform/oauth/apps/register";
export const SUPABASE_AUTH_ENDPOINT = "https://api.supabase.com/v1/oauth/authorize";
export const SUPABASE_TOKEN_ENDPOINT = "https://api.supabase.com/v1/oauth/token";
export const SUPABASE_API_ENDPOINT = "https://api.supabase.com/v1";
export const DEFAULT_SUPABASE_CALLBACK_PORT = 54323;
export const DEFAULT_SUPABASE_CALLBACK_URL = `http://localhost:${DEFAULT_SUPABASE_CALLBACK_PORT}/callback`;

export function base64url(buffer: Buffer): string {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function generatePKCE() {
  const codeVerifier = base64url(randomBytes(32));
  const codeChallenge = base64url(createHash("sha256").update(codeVerifier).digest());
  return { codeVerifier, codeChallenge };
}

export interface SupabaseTokenData {
  access_token: string;
  refresh_token?: string;
  project_ref?: string;
  organization?: string;
  mcp_url?: string;
  saved_at: string;
}

export interface ClientRegistration {
  client_id: string;
  client_secret?: string;
}

export class SupabaseMcpOAuth {
  public static getTokenPath(): string {
    if (process.env.LIATE_CONFIG_DIR) {
      if (!fs.existsSync(process.env.LIATE_CONFIG_DIR)) {
        fs.mkdirSync(process.env.LIATE_CONFIG_DIR, { recursive: true });
      }
      return path.join(process.env.LIATE_CONFIG_DIR, "supabase_token.json");
    }

    try {
      const homeDir = path.join(os.homedir(), ".liate");
      if (!fs.existsSync(homeDir)) {
        fs.mkdirSync(homeDir, { recursive: true });
      }
      return path.join(homeDir, "supabase_token.json");
    } catch {
      return path.resolve(process.cwd(), ".liate", "supabase_token.json");
    }
  }

  public static loadToken(): SupabaseTokenData | null {
    const candidatePaths = [
      process.env.LIATE_CONFIG_DIR ? path.join(process.env.LIATE_CONFIG_DIR, "supabase_token.json") : "",
      path.resolve(process.cwd(), ".liate", "supabase_token.json"),
      path.resolve(process.cwd(), "..", ".liate", "supabase_token.json"),
      path.resolve(__dirname, "..", "..", ".liate", "supabase_token.json"),
      path.resolve(os.homedir(), ".liate", "supabase_token.json")
    ].filter(Boolean);

    for (const p of candidatePaths) {
      try {
        if (fs.existsSync(p)) {
          const raw = fs.readFileSync(p, "utf-8");
          const parsed = JSON.parse(raw);
          if (parsed && parsed.access_token) {
            return parsed;
          }
        }
      } catch {}
    }

    const envToken = process.env.SUPABASE_MCP_TOKEN || process.env.SUPABASE_ACCESS_TOKEN;
    if (envToken) {
      return {
        access_token: envToken,
        saved_at: new Date().toISOString()
      };
    }

    return null;
  }

  public static saveToken(data: SupabaseTokenData): void {
    const tokenPath = SupabaseMcpOAuth.getTokenPath();
    const dir = path.dirname(tokenPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(tokenPath, JSON.stringify(data, null, 2), "utf-8");

    try {
      const mirrorPath = path.resolve(process.cwd(), ".liate", "supabase_token.json");
      const mirrorDir = path.dirname(mirrorPath);
      if (!fs.existsSync(mirrorDir)) {
        fs.mkdirSync(mirrorDir, { recursive: true });
      }
      fs.writeFileSync(mirrorPath, JSON.stringify(data, null, 2), "utf-8");
    } catch {}

    try {
      const envPath = path.join(process.cwd(), ".env.local");
      let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf-8") : "";
      if (content.includes("SUPABASE_MCP_TOKEN=")) {
        content = content.replace(/SUPABASE_MCP_TOKEN=.*(\r?\n|$)/, `SUPABASE_MCP_TOKEN="${data.access_token}"\n`);
      } else {
        content += `\n# OpenLiate Supabase MCP Access Token\nSUPABASE_MCP_TOKEN="${data.access_token}"\n`;
      }
      if (data.project_ref) {
        if (content.includes("SUPABASE_PROJECT_REF=")) {
          content = content.replace(/SUPABASE_PROJECT_REF=.*(\r?\n|$)/, `SUPABASE_PROJECT_REF="${data.project_ref}"\n`);
        } else {
          content += `SUPABASE_PROJECT_REF="${data.project_ref}"\n`;
        }
      }
      fs.writeFileSync(envPath, content, "utf-8");
    } catch {}
  }

  public static clearToken(): void {
    const candidatePaths = [
      process.env.LIATE_CONFIG_DIR ? path.join(process.env.LIATE_CONFIG_DIR, "supabase_token.json") : "",
      SupabaseMcpOAuth.getTokenPath(),
      path.resolve(process.cwd(), ".liate", "supabase_token.json"),
      path.resolve(process.cwd(), "..", ".liate", "supabase_token.json"),
      path.resolve(__dirname, "..", "..", ".liate", "supabase_token.json"),
      path.resolve(os.homedir(), ".liate", "supabase_token.json")
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
        content = content.replace(/SUPABASE_MCP_TOKEN=.*(\r?\n|$)/g, "");
        content = content.replace(/SUPABASE_PROJECT_REF=.*(\r?\n|$)/g, "");
        fs.writeFileSync(envPath, content.trim() + "\n", "utf-8");
      }
    } catch {}

    delete process.env.SUPABASE_MCP_TOKEN;
    delete process.env.SUPABASE_ACCESS_TOKEN;
    delete process.env.SUPABASE_PROJECT_REF;
  }

  public static async registerClient(callbackUrl: string): Promise<ClientRegistration> {
    try {
      const res = await fetch(SUPABASE_REGISTER_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_name: "OpenLiate CLI",
          client_uri: "https://openliate.tech",
          redirect_uris: [callbackUrl],
          grant_types: ["authorization_code", "refresh_token"],
          response_types: ["code"],
          token_endpoint_auth_method: "client_secret_post"
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
      client_id: process.env.SUPABASE_MCP_CLIENT_ID || "ca05de37-96dd-400c-b0a6-fe081604eb4f",
      client_secret: process.env.SUPABASE_MCP_CLIENT_SECRET || "sba_604a6f033ea7f9c904f52f3b78140b5fae6992b5"
    };
  }

  public static buildAuthUrl(
    clientId: string,
    redirectUri: string,
    codeChallenge: string,
    state: string
  ): string {
    const url = new URL(SUPABASE_AUTH_ENDPOINT);
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("code_challenge", codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
    url.searchParams.set("state", state);
    return url.toString();
  }

  public static async exchangeCodeForToken(
    clientId: string,
    clientSecret: string | undefined,
    code: string,
    codeVerifier: string,
    redirectUri: string
  ): Promise<SupabaseTokenData> {
    const params = new URLSearchParams({
      grant_type: "authorization_code",
      code: code,
      redirect_uri: redirectUri,
      client_id: clientId,
      code_verifier: codeVerifier
    });

    const headers: Record<string, string> = {
      "Content-Type": "application/x-www-form-urlencoded"
    };

    if (clientSecret) {
      headers["Authorization"] = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
    }

    const res = await fetch(SUPABASE_TOKEN_ENDPOINT, {
      method: "POST",
      headers,
      body: params
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Supabase MCP token exchange failed (${res.status}): ${errText}`);
    }

    const data = (await res.json()) as any;
    if (!data.access_token) {
      throw new Error("No access_token returned by Supabase token endpoint");
    }

    let projectRef: string | undefined;
    let organization: string | undefined;

    // Dynamically query user organizations and projects
    try {
      const [orgRes, projRes] = await Promise.all([
        fetch(`${SUPABASE_API_ENDPOINT}/organizations`, {
          headers: { Authorization: `Bearer ${data.access_token}` }
        }),
        fetch(`${SUPABASE_API_ENDPOINT}/projects`, {
          headers: { Authorization: `Bearer ${data.access_token}` }
        })
      ]);

      if (orgRes.ok) {
        const orgs = (await orgRes.json()) as any[];
        if (Array.isArray(orgs) && orgs.length > 0) {
          organization = orgs[0].name || orgs[0].id;
        }
      }

      if (projRes.ok) {
        const projs = (await projRes.json()) as any[];
        if (Array.isArray(projs) && projs.length > 0) {
          projectRef = projs[0].id || projs[0].ref;
        }
      }
    } catch {}

    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      project_ref: projectRef,
      organization: organization,
      mcp_url: SUPABASE_MCP_ENDPOINT,
      saved_at: new Date().toISOString()
    };
  }
}

export class SupabaseMcpClient {
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

    const res = await fetch(SUPABASE_MCP_ENDPOINT, {
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
    const res = await fetch(`${SUPABASE_API_ENDPOINT}/projects`, {
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: "application/json"
      }
    });
    if (!res.ok) {
      throw new Error(`Failed to list Supabase projects: ${res.statusText}`);
    }
    return (await res.json()) as any[];
  }

  public async deployEngine(options: {
    slug?: string;
    projectRef?: string;
    body?: string;
  } = {}): Promise<{
    slug: string;
    name: string;
    projectRef: string;
    functionUrl: string;
    engineUrl: string;
    mcpUrl: string;
  }> {
    const uuid7 = generateUUIDv7();
    const fnSlug = options.slug || "openliate";

    let projectRef = options.projectRef || process.env.SUPABASE_PROJECT_REF;
    if (!projectRef) {
      const saved = SupabaseMcpOAuth.loadToken();
      projectRef = saved?.project_ref;
    }

    if (!projectRef) {
      const projects = await this.listProjects();
      if (projects.length === 0) {
        throw new Error("No active Supabase projects found in account. Please create a project at https://supabase.com/dashboard first.");
      }
      projectRef = projects[0].id || projects[0].ref;
    }

    let bundleCode = options.body || "";
    if (!bundleCode) {
      const candidatePaths = [
        path.resolve(process.cwd(), "dist", "engine", "index.js"),
        path.resolve(process.cwd(), "liate", "dist", "engine", "index.js"),
        path.resolve(__dirname, "..", "..", "dist", "engine", "index.js")
      ];
      for (const p of candidatePaths) {
        if (fs.existsSync(p)) {
          bundleCode = fs.readFileSync(p, "utf-8");
          break;
        }
      }
    }

    if (!bundleCode) {
      throw new Error("Could not locate dist/engine/index.js. Please run 'bun run build:engine' first.");
    }

    // Ensure Node builtins use node: prefix for Deno runtime compatibility in Supabase Edge Functions
    bundleCode = bundleCode
      .replace(/from\s+["'](os|fs|path|http|https|crypto|stream|events|util|buffer|url|net|tls|zlib)["']/g, 'from "node:$1"')
      .replace(/import\s+["'](os|fs|path|http|https|crypto|stream|events|util|buffer|url|net|tls|zlib)["']/g, 'import "node:$1"')
      .replace(/require\(["'](os|fs|path|http|https|crypto|stream|events|util|buffer|url|net|tls|zlib)["']\)/g, 'require("node:$1")');

    const deployRes = await fetch(`${SUPABASE_API_ENDPOINT}/projects/${projectRef}/functions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        slug: fnSlug,
        name: fnSlug,
        body: bundleCode,
        verify_jwt: false
      })
    });

    const deployData = (await deployRes.json()) as any;
    if (!deployRes.ok || !deployData?.id) {
      // If function already exists, try update (PATCH)
      if (deployRes.status === 409 || deployData?.message?.includes("already exists")) {
        const patchRes = await fetch(`${SUPABASE_API_ENDPOINT}/projects/${projectRef}/functions/${fnSlug}`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${this.token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            body: bundleCode,
            verify_jwt: false
          })
        });
        if (!patchRes.ok) {
          throw new Error(`Supabase function update failed (${patchRes.status}): ${await patchRes.text()}`);
        }
      } else {
        throw new Error(`Supabase function deploy failed (${deployRes.status}): ${deployData?.message || JSON.stringify(deployData)}`);
      }
    }

    const functionUrl = `https://${projectRef}.supabase.co/functions/v1/${fnSlug}`;
    const engineUrl = `${functionUrl}/run`;

    try {
      const deployPath = path.resolve(process.cwd(), ".liate", "supabase_deployment.json");
      const deployDir = path.dirname(deployPath);
      if (!fs.existsSync(deployDir)) {
        fs.mkdirSync(deployDir, { recursive: true });
      }
      fs.writeFileSync(
        deployPath,
        JSON.stringify(
          {
            slug: fnSlug,
            projectRef,
            functionUrl,
            engineUrl,
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
      slug: fnSlug,
      name: fnSlug,
      projectRef,
      functionUrl,
      engineUrl,
      mcpUrl: SUPABASE_MCP_ENDPOINT
    };
  }
}

export async function runSupabaseLinkFlow(options: {
  port?: number;
  openBrowser?: boolean;
} = {}): Promise<SupabaseTokenData> {
  const port = options.port || DEFAULT_SUPABASE_CALLBACK_PORT;
  const redirectUri = `http://localhost:${port}/callback`;

  console.log(`\n⚡ [OpenLiate] Registering Dynamic Client with Supabase MCP...`);
  const reg = await SupabaseMcpOAuth.registerClient(redirectUri);

  const { codeVerifier, codeChallenge } = generatePKCE();
  const state = randomBytes(16).toString("hex");

  const authUrl = SupabaseMcpOAuth.buildAuthUrl(
    reg.client_id,
    redirectUri,
    codeChallenge,
    state
  );

  return new Promise<SupabaseTokenData>((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        const reqUrl = new URL(req.url || "/", `http://localhost:${port}`);
        if (reqUrl.pathname === "/callback") {
          const code = reqUrl.searchParams.get("code");
          const retState = reqUrl.searchParams.get("state");
          const error = reqUrl.searchParams.get("error");

          if (error) {
            res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
            res.end(`<h3>Supabase MCP Link Failed</h3><p>${error}</p>`);
            server.close();
            return reject(new Error(`Supabase OAuth Error: ${error}`));
          }

          if (!code || retState !== state) {
            res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
            res.end(`<h3>Invalid State or Missing Code</h3>`);
            server.close();
            return reject(new Error("State mismatch or missing authorization code"));
          }

          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          res.end(`<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Liate — Supabase Linked</title>
  </head>
  <body style="font-family: -apple-system, system-ui, sans-serif; padding: 40px; text-align: center; color: #111;">
    <h2>Authentication successful</h2>
    <p>Supabase is linked to Liate. You can close this window and return to your terminal.</p>
    <script>try { window.close(); } catch(e) {}</script>
  </body>
</html>`);
          server.close();

          console.log(`⚡ [OpenLiate] Exchanging Authorization Code with Supabase...`);
          const tokenData = await SupabaseMcpOAuth.exchangeCodeForToken(
            reg.client_id,
            reg.client_secret,
            code,
            codeVerifier,
            redirectUri
          );

          SupabaseMcpOAuth.saveToken(tokenData);
          console.log(`⚡ [OpenLiate] Supabase MCP Access Token saved successfully!`);
          resolve(tokenData);
        }
      } catch (err) {
        server.close();
        reject(err);
      }
    });

    server.listen(port, () => {
      console.log(`\n⚡ [OpenLiate] Complete Supabase authorization in your browser:\n`);
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

