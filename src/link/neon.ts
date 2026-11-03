import { createHash, randomBytes } from "crypto";
import http from "http";
import fs from "fs";
import path from "path";
import os from "os";
import JSZip from "jszip";
import { generateUUIDv7 } from "../core/uuid";
import { ConfigManager } from "../config/index";

export const NEON_MCP_ENDPOINT = "https://mcp.neon.tech/mcp";
export const NEON_REGISTER_ENDPOINT = "https://mcp.neon.tech/api/register";
export const NEON_AUTH_ENDPOINT = "https://mcp.neon.tech/api/authorize";
export const NEON_TOKEN_ENDPOINT = "https://mcp.neon.tech/api/token";
export const DEFAULT_CALLBACK_PORT = 54321;
export const DEFAULT_CALLBACK_URL = `http://localhost:${DEFAULT_CALLBACK_PORT}/callback`;

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

export interface NeonTokenData {
  access_token: string;
  refresh_token?: string;
  saved_at: string;
  projectId?: string;
}

export interface ClientRegistration {
  client_id: string;
  client_secret?: string;
}

export class NeonMcpOAuth {
  /**
   * Path to persistent OpenLiate config (~/.openliate/neon_token.json or .openliate/neon_token.json).
   */
  public static getTokenPath(): string {
    if (process.env.OPENLIATE_CONFIG_DIR) {
      if (!fs.existsSync(process.env.OPENLIATE_CONFIG_DIR)) {
        fs.mkdirSync(process.env.OPENLIATE_CONFIG_DIR, { recursive: true });
      }
      return path.join(process.env.OPENLIATE_CONFIG_DIR, "neon_token.json");
    }

    // Prefer workspace .openliate directory
    const candidateDirs = [
      path.resolve(process.cwd(), ".openliate"),
      path.resolve(process.cwd(), "..", ".openliate"),
      path.resolve(__dirname, "..", "..", ".openliate")
    ];

    for (const d of candidateDirs) {
      try {
        if (!fs.existsSync(d)) {
          fs.mkdirSync(d, { recursive: true });
        }
        return path.join(d, "neon_token.json");
      } catch {}
    }

    try {
      const homeDir = path.join(os.homedir(), ".openliate");
      if (!fs.existsSync(homeDir)) {
        fs.mkdirSync(homeDir, { recursive: true });
      }
      return path.join(homeDir, "neon_token.json");
    } catch {
      return path.resolve(process.cwd(), ".openliate", "neon_token.json");
    }
  }

  public static loadSavedToken(): NeonTokenData | null {
    const candidatePaths = [
      process.env.OPENLIATE_CONFIG_DIR ? path.join(process.env.OPENLIATE_CONFIG_DIR, "neon_token.json") : "",
      path.resolve(process.cwd(), ".openliate", "neon_token.json"),
      path.resolve(process.cwd(), "..", ".openliate", "neon_token.json"),
      path.resolve(__dirname, "..", "..", ".openliate", "neon_token.json"),
      path.resolve(os.homedir(), ".openliate", "neon_token.json")
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
    return null;
  }

  public static saveToken(data: NeonTokenData): void {
    const p = NeonMcpOAuth.getTokenPath();
    fs.writeFileSync(p, JSON.stringify(data, null, 2), "utf-8");

    // Do not modify workspace configuration if running inside an isolated test environment
    if (process.env.OPENLIATE_CONFIG_DIR) {
      return;
    }

    // Also mirror to workspace .openliate if running from subfolder
    const mirrorPath = path.resolve(process.cwd(), ".openliate", "neon_token.json");
    if (mirrorPath !== p) {
      try {
        if (!fs.existsSync(path.dirname(mirrorPath))) {
          fs.mkdirSync(path.dirname(mirrorPath), { recursive: true });
        }
        fs.writeFileSync(mirrorPath, JSON.stringify(data, null, 2), "utf-8");
      } catch {}
    }

    // Always update .env.local with fresh token
    try {
      const envPath = path.join(process.cwd(), ".env.local");
      let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf-8") : "";
      if (content.includes("NEON_MCP_TOKEN=")) {
        content = content.replace(/NEON_MCP_TOKEN="?[^"\r\n]+"?/g, `NEON_MCP_TOKEN="${data.access_token}"`);
      } else {
        content += `\nNEON_MCP_TOKEN="${data.access_token}"\n`;
      }
      fs.writeFileSync(envPath, content.trim() + "\n", "utf-8");
    } catch {}
  }

  public static clearSavedToken(): void {
    const candidatePaths = [
      process.env.OPENLIATE_CONFIG_DIR ? path.join(process.env.OPENLIATE_CONFIG_DIR, "neon_token.json") : "",
      NeonMcpOAuth.getTokenPath(),
      path.resolve(process.cwd(), ".openliate", "neon_token.json"),
      path.resolve(process.cwd(), "..", ".openliate", "neon_token.json"),
      path.resolve(__dirname, "..", "..", ".openliate", "neon_token.json"),
      path.resolve(os.homedir(), ".openliate", "neon_token.json")
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
        content = content.replace(/NEON_MCP_TOKEN="?[^"\r\n]+"?(\r?\n|$)/g, "");
        fs.writeFileSync(envPath, content.trim() + "\n", "utf-8");
      }
    } catch {}

    delete process.env.NEON_MCP_TOKEN;
    delete process.env.NEON_API_KEY;
  }

  /**
   * Modern 2026 Dynamic Client Registration (RFC 7591)
   * Registers OpenLiate dynamically with Neon's MCP server.
   */
  public static async registerClient(callbackUrl: string = DEFAULT_CALLBACK_URL): Promise<ClientRegistration> {
    try {
      const res = await fetch(NEON_REGISTER_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_name: "OpenLiate CLI",
          client_uri: "https://openliate.tech",
          redirect_uris: [callbackUrl],
          grant_types: ["authorization_code", "refresh_token"],
          response_types: ["code"],
          token_endpoint_auth_method: "none"
        })
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Neon Dynamic Client Registration failed (${res.status}): ${text}`);
      }

      const json = await res.json() as any;
      return {
        client_id: json.client_id,
        client_secret: json.client_secret
      };
    } catch (err: any) {
      throw err;
    }
  }

  /**
   * Constructs 1-Click Authorization URL for Neon MCP OAuth 2.1
   */
  public static buildAuthorizeUrl(options: {
    clientId: string;
    codeChallenge: string;
    state: string;
    callbackUrl?: string;
  }): string {
    const callbackUrl = options.callbackUrl || DEFAULT_CALLBACK_URL;
    const authUrl = new URL(NEON_AUTH_ENDPOINT);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", options.clientId);
    authUrl.searchParams.set("redirect_uri", callbackUrl);
    authUrl.searchParams.set("scope", "read write");
    authUrl.searchParams.set("code_challenge", options.codeChallenge);
    authUrl.searchParams.set("code_challenge_method", "S256");
    authUrl.searchParams.set("state", options.state);
    return authUrl.toString();
  }

  /**
   * Exchanges authorization code for Neon MCP access token.
   */
  public static async exchangeToken(options: {
    code: string;
    codeVerifier: string;
    clientId: string;
    clientSecret?: string;
    callbackUrl?: string;
  }): Promise<NeonTokenData> {
    const callbackUrl = options.callbackUrl || DEFAULT_CALLBACK_URL;
    const params = new URLSearchParams({
      grant_type: "authorization_code",
      code: options.code,
      redirect_uri: callbackUrl,
      client_id: options.clientId,
      code_verifier: options.codeVerifier
    });

    if (options.clientSecret) {
      params.append("client_secret", options.clientSecret);
    }

    try {
      const res = await fetch(NEON_TOKEN_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Neon Token Exchange failed (${res.status}): ${text}`);
      }

      const json = await res.json() as any;
      const tokenData: NeonTokenData = {
        access_token: json.access_token,
        refresh_token: json.refresh_token,
        saved_at: new Date().toISOString()
      };
      NeonMcpOAuth.saveToken(tokenData);
      return tokenData;
    } catch (err: any) {
      throw err;
    }
  }

  /**
   * Ephemeral HTTP server on port 54321 to receive OAuth callback
   */
  public static waitForCallback(port: number = DEFAULT_CALLBACK_PORT): Promise<{ code: string; state?: string }> {
    return new Promise((resolve, reject) => {
      let resolved = false;

      const server = http.createServer((req, res) => {
        try {
          const reqUrl = new URL(req.url || "/", `http://localhost:${port}`);
          if (reqUrl.pathname !== "/callback") {
            res.writeHead(404, { "Content-Type": "text/plain" });
            res.end("Not Found");
            return;
          }

          const code = reqUrl.searchParams.get("code");
          const state = reqUrl.searchParams.get("state") || undefined;
          const error = reqUrl.searchParams.get("error");

          if (error) {
            res.writeHead(400, { "Content-Type": "text/html" });
            res.end(`<h3>Neon MCP OAuth Error: ${error}</h3>`);
            server.close();
            if (!resolved) {
              resolved = true;
              reject(new Error(`OAuth Error: ${error}`));
            }
            return;
          }

          if (!code) {
            res.writeHead(400, { "Content-Type": "text/plain" });
            res.end("Missing authorization code.");
            return;
          }

          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          res.end(`<!DOCTYPE html>
<html>
  <head>
    <title>Liate — Authentication Successful</title>
  </head>
  <body style="font-family: -apple-system, system-ui, sans-serif; padding: 40px; text-align: center; color: #111;">
    <h2>Authentication successful</h2>
    <p>You can close this window and return to your terminal.</p>
    <script>try { window.close(); } catch(e) {}</script>
  </body>
</html>`);

          server.close();
          if (!resolved) {
            resolved = true;
            resolve({ code, state });
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
          reject(new Error("Neon MCP OAuth timed out after 60 seconds."));
        }
      }, 60000);
    });
  }
}

/**
 * Neon MCP Client: Calls tools directly on https://mcp.neon.tech/mcp
 */
export class NeonMcpClient {
  private token: string;

  constructor(token?: string) {
    const saved = NeonMcpOAuth.loadSavedToken();
    this.token = token || saved?.access_token || process.env.NEON_MCP_TOKEN || "";
    if (!this.token) {
      throw new Error("No Neon MCP token found. Run 'liate link --neon' first.");
    }
  }

  public async callTool(name: string, args: Record<string, any> = {}): Promise<any> {
    const payload = {
      jsonrpc: "2.0",
      id: Date.now(),
      method: "tools/call",
      params: {
        name,
        arguments: args
      }
    };

    const res = await fetch(NEON_MCP_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.token}`,
        "Accept": "application/json, text/event-stream"
      },
      body: JSON.stringify(payload)
    });

    if (res.status === 401) {
      NeonMcpOAuth.clearSavedToken();
      throw new Error("Neon MCP Token has expired or is invalid. Please run 'liate relink --neon' to re-authenticate.");
    }

    const text = await res.text();
    let data: any;
    const match = text.match(/data: ({.*})/);
    if (match) {
      try {
        const parsed = JSON.parse(match[1]);
        if (parsed.result?.content?.[0]?.text) {
          try {
            data = JSON.parse(parsed.result.content[0].text);
          } catch {
            data = parsed.result.content[0].text;
          }
        } else {
          data = parsed;
        }
      } catch {
        data = text;
      }
    } else {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }

    if (data && typeof data === "object" && data.error) {
      if (data.error === "invalid_token" || data.error_description?.includes("expired")) {
        throw new Error("Neon MCP Token has expired. Please run 'liate relink --neon' to re-authenticate.");
      }
      throw new Error(`Neon MCP Error (${data.error}): ${data.error_description || JSON.stringify(data)}`);
    }

    return data;
  }

  public async listProjects(): Promise<any[]> {
    const res = await this.callTool("list_projects");
    return Array.isArray(res) ? res : res.projects || [];
  }

  public async listBranches(projectId: string): Promise<any[]> {
    const res = await this.callTool("list_branches", { project_id: projectId });
    return Array.isArray(res) ? res : res.branches || [];
  }

  public async listFunctions(projectId: string, branchId: string): Promise<any[]> {
    const res = await this.callTool("list_functions", { project_id: projectId, branch_id: branchId });
    return Array.isArray(res) ? res : res.functions || [];
  }

  public async deployEngine(options?: {
    slug?: string;
    projectId?: string;
    branchId?: string;
    branchName?: string;
    usePrimaryBranch?: boolean;
    createNewBranch?: boolean;
  }): Promise<{
    deploymentId: number;
    uuid7: string;
    slug: string;
    projectId: string;
    projectName: string;
    branchId: string;
    branchName: string;
    invocationUrl: string;
    status: string;
  }> {
    // 1. Build universal serverless engine bundle into dist/engine/
    const engineDistDir = path.resolve(process.cwd(), "dist", "engine");
    if (!fs.existsSync(engineDistDir)) {
      fs.mkdirSync(engineDistDir, { recursive: true });
    }

    const entrypoint = path.resolve(__dirname, "..", "server", "index.ts");
    const buildResult = await (globalThis as any).Bun.build({
      entrypoints: [entrypoint],
      target: "node",
      format: "esm",
      minify: false,
      naming: "[name].[ext]",
      outdir: engineDistDir
    });
    if (!buildResult.success || buildResult.outputs.length === 0) {
      throw new Error("Failed to bundle Liate Engine for Neon deployment.");
    }
    const bundleText = await buildResult.outputs[0].text();

    // 2. Create physical package dist/engine/engine.zip for transparency and portability
    const zip = new JSZip();
    zip.file("index.js", bundleText);
    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
    fs.writeFileSync(path.join(engineDistDir, "engine.zip"), zipBuffer);
    const zipBase64 = zipBuffer.toString("base64");

    // 3. Resolve or Automatically Create Project "openliate"
    let projects = await this.listProjects();
    let project = projects.find((p: any) => p.name === "openliate" || p.name === "liate");

    if (!project) {
      try {
        const createProjRes = await this.callTool("create_project", {
          name: "openliate",
          branch: { name: "main" }
        });
        project = createProjRes?.project || createProjRes;
      } catch {
        project = projects.find((p: any) => p.name === "openliate" || p.name === "liate") || projects[0];
      }
    }

    if (!project) {
      throw new Error("Unable to resolve or create a Neon project for Liate.");
    }

    // 4. Generate RFC 9562 UUIDv7 for deployment traceability
    const uuid7 = generateUUIDv7();
    const cleanId = uuid7.replace(/-/g, "").slice(0, 8);
    const targetBranchName = options?.branchName || `liate-branch-${cleanId}`;

    // 5. Resolve Branch (Dedicated isolated branch or Project's primary branch)
    let branch: any;
    if (options?.branchId) {
      const branches = await this.listBranches(project.id);
      branch = branches.find((b: any) => b.id === options.branchId) || branches[0];
    } else if (options?.usePrimaryBranch) {
      const branches = await this.listBranches(project.id);
      branch = branches.find((b: any) => b.primary || b.default) || branches[0];
    } else {
      try {
        const branchRes = await this.callTool("create_branch", {
          project_id: project.id,
          name: targetBranchName
        });
        branch = branchRes?.branch || branchRes;
      } catch {
        const branches = await this.listBranches(project.id);
        branch = branches.find((b: any) => b.primary || b.default) || branches[0];
      }
    }

    if (!branch || !branch.id) {
      const branches = await this.listBranches(project.id);
      branch = branches.find((b: any) => b.primary || b.default) || branches[0];
    }

    const slug = options?.slug || "engine";

    // 6. Call deploy_function on Neon MCP
    const deployRes = await this.callTool("deploy_function", {
      project_id: project.id,
      branch_id: branch.id,
      slug,
      zip: zipBase64,
      runtime: "nodejs24"
    });

    // 7. Query function details to retrieve live invocation URL
    const fnRes = await this.callTool("get_function", {
      project_id: project.id,
      branch_id: branch.id,
      slug
    });

    const result = {
      deploymentId: deployRes?.id || fnRes?.current_deployment?.id || 0,
      uuid7,
      slug,
      projectId: project.id,
      projectName: project.name,
      branchId: branch.id,
      branchName: branch.name || targetBranchName,
      invocationUrl: fnRes?.invocation_url || "",
      status: fnRes?.current_deployment?.status || deployRes?.status || "unknown"
    };

    // Persist deployment metadata
    try {
      const deployPath = path.resolve(process.cwd(), ".openliate", "neon_deployment.json");
      if (!fs.existsSync(path.dirname(deployPath))) {
        fs.mkdirSync(path.dirname(deployPath), { recursive: true });
      }
      fs.writeFileSync(deployPath, JSON.stringify(result, null, 2), "utf-8");
    } catch {}

    return result;
  }

  public async getEngineDeployment(): Promise<{
    deploymentId?: number;
    uuid7?: string;
    slug?: string;
    projectId: string;
    projectName: string;
    branchId: string;
    branchName: string;
    invocationUrl: string;
    runtime: string;
    status: string;
  }> {
    // Check saved deployment first
    try {
      const deployPath = path.resolve(process.cwd(), ".openliate", "neon_deployment.json");
      if (fs.existsSync(deployPath)) {
        const saved = JSON.parse(fs.readFileSync(deployPath, "utf-8"));
        if (saved && saved.invocationUrl) {
          return {
            deploymentId: saved.deploymentId,
            uuid7: saved.uuid7,
            slug: saved.slug,
            projectId: saved.projectId,
            projectName: saved.projectName,
            branchId: saved.branchId,
            branchName: saved.branchName,
            invocationUrl: saved.invocationUrl,
            runtime: "nodejs24",
            status: saved.status || "completed"
          };
        }
      }
    } catch {}

    const projects = await this.listProjects();
    if (!projects || projects.length === 0) {
      throw new Error("No Neon projects found in your account.");
    }

    const project = projects.find((p: any) => p.name === "liate-engine") || projects[0];
    const branches = await this.listBranches(project.id);
    const branch = branches.find((b: any) => b.primary || b.default) || branches[0];

    const functions = await this.listFunctions(project.id, branch.id);
    let fn = functions.find((f: any) => f.slug?.startsWith("liate") || f.id?.startsWith("liate")) || functions[0];

    if (!fn || !fn.invocation_url) {
      throw new Error(`No deployed Liate engine function found on branch ${branch.name}.`);
    }

    return {
      slug: fn.slug,
      projectId: project.id,
      projectName: project.name,
      branchId: branch.id,
      branchName: branch.name,
      invocationUrl: fn.invocation_url,
      runtime: fn.current_deployment?.runtime || "nodejs24",
      status: fn.current_deployment?.status || "completed"
    };
  }
}

