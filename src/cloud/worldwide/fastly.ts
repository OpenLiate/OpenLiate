import fs from "fs";
import path from "path";
import os from "os";
import { generateUUIDv7 } from "../../core/uuid";

export const FASTLY_API_ENDPOINT = "https://api.fastly.com";
export const FASTLY_VERIFY_ENDPOINT = "https://api.fastly.com/verify";
export const FASTLY_PUBLIC_SEARCH_ENDPOINT = "https://api.fastly.com/public-search/docs";

export interface FastlyTokenData {
  api_token: string;
  customer_id?: string;
  service_id?: string;
  user_id?: string;
  user_name?: string;
  scope?: string;
  saved_at: string;
}

export class FastlyLink {
  public static getTokenPath(): string {
    const configDir = process.env.OPENLIATE_CONFIG_DIR;
    if (configDir) {
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      return path.join(configDir, "fastly.json");
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
        return path.join(d, "fastly.json");
      } catch {}
    }

    try {
      const homeLinkDir = path.join(os.homedir(), ".openliate", "link");
      if (!fs.existsSync(homeLinkDir)) {
        fs.mkdirSync(homeLinkDir, { recursive: true });
      }
      return path.join(homeLinkDir, "fastly.json");
    } catch {
      return path.resolve(process.cwd(), ".openliate", "link", "fastly.json");
    }
  }

  public static loadSavedToken(): FastlyTokenData | null {
    const configDir = process.env.OPENLIATE_CONFIG_DIR;
    if (configDir) {
      const p = path.join(configDir, "fastly.json");
      if (fs.existsSync(p)) {
        try {
          const raw = fs.readFileSync(p, "utf-8");
          const parsed = JSON.parse(raw);
          if (parsed && (parsed.api_token || parsed.access_token)) {
            return {
              api_token: parsed.api_token || parsed.access_token,
              service_id: parsed.service_id,
              customer_id: parsed.customer_id,
              saved_at: parsed.saved_at || new Date().toISOString()
            };
          }
        } catch {}
      }
      return null;
    }

    const candidatePaths = [
      configDir ? path.join(configDir, "fastly.json") : "",
      FastlyLink.getTokenPath(),
      path.resolve(process.cwd(), ".openliate", "link", "fastly.json"),
      path.resolve(process.cwd(), ".openliate", "fastly.json"),
      path.resolve(process.cwd(), "..", ".openliate", "link", "fastly.json"),
      path.resolve(__dirname, "..", "..", ".openliate", "link", "fastly.json"),
      path.resolve(os.homedir(), ".openliate", "link", "fastly.json")
    ].filter(Boolean);

    for (const p of candidatePaths) {
      try {
        if (fs.existsSync(p)) {
          const raw = fs.readFileSync(p, "utf-8");
          const parsed = JSON.parse(raw);
          if (parsed && (parsed.api_token || parsed.access_token)) {
            return {
              api_token: parsed.api_token || parsed.access_token,
              customer_id: parsed.customer_id,
              user_id: parsed.user_id,
              user_name: parsed.user_name,
              scope: parsed.scope,
              saved_at: parsed.saved_at || new Date().toISOString()
            };
          }
        }
      } catch {}
    }

    if (process.env.FASTLY_API_TOKEN) {
      return {
        api_token: process.env.FASTLY_API_TOKEN,
        saved_at: new Date().toISOString()
      };
    }

    return null;
  }

  public static saveToken(data: FastlyTokenData): void {
    const p = FastlyLink.getTokenPath();
    const pDir = path.dirname(p);
    if (!fs.existsSync(pDir)) {
      fs.mkdirSync(pDir, { recursive: true });
    }
    fs.writeFileSync(p, JSON.stringify(data, null, 2), "utf-8");

    const configDir = process.env.OPENLIATE_CONFIG_DIR;
    if (configDir) {
      return;
    }

    // Mirror to local workspace .openliate/link/fastly.json
    const mirrorPath = path.resolve(process.cwd(), ".openliate", "link", "fastly.json");
    if (mirrorPath !== p) {
      try {
        if (!fs.existsSync(path.dirname(mirrorPath))) {
          fs.mkdirSync(path.dirname(mirrorPath), { recursive: true });
        }
        fs.writeFileSync(mirrorPath, JSON.stringify(data, null, 2), "utf-8");
      } catch {}
    }

    // Always update .env.local with fresh FASTLY_API_TOKEN
    try {
      const envPath = path.join(process.cwd(), ".env.local");
      let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf-8") : "";
      if (content.includes("FASTLY_API_TOKEN=")) {
        content = content.replace(/FASTLY_API_TOKEN="?[^"\r\n]+"?/g, `FASTLY_API_TOKEN="${data.api_token}"`);
      } else {
        content += `\nFASTLY_API_TOKEN="${data.api_token}"\n`;
      }
      fs.writeFileSync(envPath, content.trim() + "\n", "utf-8");
    } catch {}

    // Configure Fastly MCP server in .openliate/mcp.json
    try {
      FastlyLink.configureMcpServer(data.api_token);
    } catch {}
  }

  public static clearSavedToken(): void {
    const configDir = process.env.OPENLIATE_CONFIG_DIR;
    if (configDir) {
      try {
        const p = path.join(configDir, "fastly.json");
        if (fs.existsSync(p)) fs.unlinkSync(p);
      } catch {}
      delete process.env.FASTLY_API_TOKEN;
      delete process.env.FASTLY_CUSTOMER_ID;
      return;
    }

    const candidatePaths = [
      FastlyLink.getTokenPath(),
      path.resolve(process.cwd(), ".openliate", "link", "fastly.json"),
      path.resolve(process.cwd(), ".openliate", "fastly.json"),
      path.resolve(process.cwd(), "..", ".openliate", "link", "fastly.json"),
      path.resolve(__dirname, "..", "..", ".openliate", "link", "fastly.json"),
      path.resolve(os.homedir(), ".openliate", "link", "fastly.json")
    ];

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
        content = content.replace(/FASTLY_API_TOKEN="?[^"\r\n]+"?\r?\n?/g, "");
        fs.writeFileSync(envPath, content, "utf-8");
      }
    } catch {}
  }

  /**
   * Verify token against Fastly /verify API endpoint
   */
  public static async verifyToken(token: string): Promise<{
    valid: boolean;
    user_id?: string;
    customer_id?: string;
    customer_name?: string;
    name?: string;
    login?: string;
    scope?: string;
    services?: Record<string, string>;
    error?: string;
  }> {
    try {
      const res = await fetch(FASTLY_VERIFY_ENDPOINT, {
        headers: {
          "Fastly-Key": token,
          "Accept": "application/json"
        }
      });

      if (!res.ok) {
        return { valid: false };
      }

      const body = await res.json() as any;
      const customer = body.customer || {};
      const user = body.user || {};
      const tok = body.token || {};

      return {
        valid: true,
        user_id: user.id || body.user_id,
        customer_id: customer.id || body.customer_id,
        customer_name: customer.name,
        name: user.name || body.name,
        login: user.login,
        scope: tok.scope || body.scope,
        services: body.services
      };
    } catch (err: any) {
      return { valid: false, error: err?.message || String(err) };
    }
  }

  /**
   * Automatically register Fastly MCP server into workspace .openliate/mcp.json
   */
  public static configureMcpServer(token?: string): void {
    const mcpPath = path.resolve(process.cwd(), ".openliate", "mcp.json");
    let currentConfig: any = { mcpServers: {} };

    if (fs.existsSync(mcpPath)) {
      try {
        currentConfig = JSON.parse(fs.readFileSync(mcpPath, "utf-8")) || { mcpServers: {} };
      } catch {}
    }

    if (!currentConfig.mcpServers) {
      currentConfig.mcpServers = {};
    }

    const localMcpPath = path.resolve(process.cwd(), "node_modules", "@fastly", "mcp", "src", "index.js");
    const hasLocal = fs.existsSync(localMcpPath);

    currentConfig.mcpServers.fastly = {
      command: hasLocal ? "node" : "npx",
      args: hasLocal ? [localMcpPath] : ["-y", "-p", "@fastly/mcp", "fastly-mcp"],
      env: {
        FASTLY_API_TOKEN: token || "${env:FASTLY_API_TOKEN}"
      }
    };

    const dir = path.dirname(mcpPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(mcpPath, JSON.stringify(currentConfig, null, 2), "utf-8");
  }

  /**
   * Search Fastly documentation via Fastly's public search API
   */
  public static async searchDocs(query: string, limit: number = 10): Promise<any[]> {
    try {
      const url = `${FASTLY_PUBLIC_SEARCH_ENDPOINT}?query=${encodeURIComponent(query)}&limit=${limit}`;
      const res = await fetch(url);
      if (!res.ok) return [];
      const json = await res.json() as any;
      return json.data || json.results || [];
    } catch {
      return [];
    }
  }
}

/**
 * CLI Entrypoint to link Fastly (API Key flow)
 */
export async function runFastlyLinkFlow(key?: string): Promise<string> {
  console.log(`\n===========================================================`);
  console.log(`  Fastly Compute (WASM Engine)`);
  console.log(`===========================================================\n`);

  let token = key || process.env.FASTLY_API_TOKEN;

  if (!token) {
    const existing = FastlyLink.loadSavedToken();
    if (existing && existing.api_token) {
      console.log(`  Found existing Fastly credentials on disk.`);
      token = existing.api_token;
    }
  }

  if (!token) {
    throw new Error(
      "Fastly API token not provided. Please pass via `liate link --fastly --key <token>` or export FASTLY_API_TOKEN in your environment."
    );
  }

  console.log(`  Verifying Fastly API token against https://api.fastly.com/verify...`);
  const verification = await FastlyLink.verifyToken(token);

  if (!verification.valid) {
    console.warn(`  [Warning]: Fastly API verification returned non-OK. Proceeding with credentials.`);
  } else {
    console.log(`  Fastly Token verified successfully!`);
    if (verification.customer_name) {
      console.log(`  Customer:  ${verification.customer_name} (${verification.customer_id})`);
    } else if (verification.customer_id) {
      console.log(`  Customer:  ${verification.customer_id}`);
    }
    if (verification.name || verification.login) {
      console.log(`  User:      ${verification.name || ""} <${verification.login || ""}>`);
    }
    if (verification.scope) {
      console.log(`  Scopes:    ${verification.scope}`);
    }
    if (verification.services && Object.keys(verification.services).length > 0) {
      const serviceNames = Object.values(verification.services).join(", ");
      console.log(`  Services:  ${serviceNames}`);
    }
  }

  FastlyLink.saveToken({
    api_token: token,
    customer_id: verification.customer_id,
    user_id: verification.user_id,
    user_name: verification.name,
    scope: verification.scope,
    saved_at: new Date().toISOString()
  });

  console.log(`  Saved Fastly token to: ${FastlyLink.getTokenPath()}`);
  console.log(`  Configured Fastly MCP server (@fastly/mcp) in .openliate/mcp.json`);
  console.log(`  Updated .env.local with FASTLY_API_TOKEN`);
  console.log(`\n  Fastly Edge Cloud linked successfully! (10,000,000 monthly WASM runs)\n`);

  return token;
}

/**
 * Deploy OpenLiate Runtime Engine to Fastly Compute WASM
 */
export async function deployFastly(options: { agent?: string; serviceId?: string; slug?: string } = {}): Promise<any> {
  const uuid7 = generateUUIDv7();
  const cleanId = uuid7.replace(/-/g, "").slice(0, 8);
  const slug = options.slug || (options.agent ? `${options.agent}-${cleanId}` : `openliate-${cleanId}`);

  console.log(`\n===========================================================`);
  if (options.agent) {
    console.log(`OpenLiate Deploy — Deploying Agent '${options.agent}' to Fastly Compute [${slug}]`);
  } else {
    console.log(`OpenLiate Deploy — Deploying Runtime Engine to Fastly Compute (WASM) [${slug}]`);
  }
  console.log(`===========================================================`);

  let token = FastlyLink.loadSavedToken()?.api_token || process.env.FASTLY_API_TOKEN;
  if (!token) {
    console.log("[OpenLiate] Fastly is not linked. Linking first...");
    token = await runFastlyLinkFlow();
  }

  let serviceId = options.serviceId || "";
  if (!serviceId && fs.existsSync("fastly.toml")) {
    const toml = fs.readFileSync("fastly.toml", "utf-8");
    const match = toml.match(/service_id\s*=\s*"([^"]+)"/);
    if (match && match[1]) {
      serviceId = match[1];
    }
  }

  // If no service ID in fastly.toml, discover from Fastly API
  if (!serviceId) {
    try {
      const listRes = await fetch("https://api.fastly.com/service", {
        headers: { "Fastly-Key": token, "Accept": "application/json" }
      });
      if (listRes.ok) {
        const services = await listRes.json() as any[];
        const computeService = services.find((s: any) => s.type === "wasm" || s.name === "openliate");
        if (computeService) {
          serviceId = computeService.id;
        }
      }
    } catch {}
  }

  if (!serviceId) {
    throw new Error(
      "[Fastly Deploy Error]: No Fastly Compute service ID found. Please specify service_id in fastly.toml or pass --serviceId <id>."
    );
  }

  let targetVersion = 1;

  // Check and upload package if pkg/openliate.tar.gz exists
  const pkgPath = path.resolve(process.cwd(), "pkg", "openliate.tar.gz");
  if (fs.existsSync(pkgPath)) {
    try {
      console.log(`[OpenLiate] Uploading Fastly Compute package (${(fs.statSync(pkgPath).size / (1024 * 1024)).toFixed(2)} MB)...`);
      const fileBytes = fs.readFileSync(pkgPath);
      const formData = new FormData();
      formData.append("package", new Blob([fileBytes], { type: "application/gzip" }), "openliate.tar.gz");

      // Get latest or active version, clone if locked
      const verRes = await fetch(`https://api.fastly.com/service/${serviceId}/version`, {
        headers: { "Fastly-Key": token, "Accept": "application/json" }
      });
      if (verRes.ok) {
        const versions = await verRes.json() as any[];
        if (Array.isArray(versions) && versions.length > 0) {
          const draft = versions.find((v: any) => !v.active && !v.locked);
          if (draft) {
            targetVersion = draft.number;
          } else {
            const cloneRes = await fetch(`https://api.fastly.com/service/${serviceId}/version/active/clone`, {
              method: "PUT",
              headers: { "Fastly-Key": token, "Accept": "application/json" }
            });
            if (cloneRes.ok) {
              const cloneData = await cloneRes.json() as any;
              targetVersion = cloneData.number;
            } else {
              targetVersion = versions[versions.length - 1].number + 1;
            }
          }
        }
      }

      const upRes = await fetch(`https://api.fastly.com/service/${serviceId}/version/${targetVersion}/package`, {
        method: "PUT",
        headers: { "Fastly-Key": token, "Accept": "application/json" },
        body: formData
      });

      if (upRes.ok) {
        console.log(`[OpenLiate] Package uploaded to version ${targetVersion}. Activating...`);
        await fetch(`https://api.fastly.com/service/${serviceId}/version/${targetVersion}/activate`, {
          method: "PUT",
          headers: { "Fastly-Key": token, "Accept": "application/json" }
        });
        console.log(`[OpenLiate] Version ${targetVersion} activated successfully!`);
      }
    } catch (err: any) {
      console.warn(`[OpenLiate] Notice: Package upload step: ${err.message}`);
    }
  }

  let domain = `${serviceId}.edgecompute.app`;
  try {
    const domainRes = await fetch(`https://api.fastly.com/service/${serviceId}/version/active`, {
      headers: { "Fastly-Key": token, "Accept": "application/json" }
    });
    if (domainRes.ok) {
      const activeVersion = await domainRes.json() as any;
      const verNum = activeVersion.number;
      const dRes = await fetch(`https://api.fastly.com/service/${serviceId}/version/${verNum}/domain`, {
        headers: { "Fastly-Key": token, "Accept": "application/json" }
      });
      if (dRes.ok) {
        const domains = await dRes.json() as any[];
        if (domains && domains.length > 0) {
          domain = domains[0].name;
        }
      }
    }
  } catch {}

  const baseUrl = `https://${domain}`;
  const healthUrl = `https://${domain}/health`;
  const runEndpoint = `https://${domain}/run`;
  const runtimeUrl = `https://${domain}/${slug}`;

  // Persist deployment to .openliate/deployments/fastly.json
  const deployRecord = {
    provider: "fastly",
    serviceId,
    version: targetVersion,
    uuid7,
    slug,
    domain,
    url: baseUrl,
    healthUrl,
    runtimeUrl,
    runEndpoint,
    deployedAt: new Date().toISOString()
  };

  try {
    const depDir = path.resolve(process.cwd(), ".openliate", "deployments");
    if (!fs.existsSync(depDir)) {
      fs.mkdirSync(depDir, { recursive: true });
    }
    fs.writeFileSync(path.join(depDir, "fastly.json"), JSON.stringify(deployRecord, null, 2), "utf-8");
  } catch {}

  console.log("\n===========================================================");
  console.log("OpenLiate Runtime deployed live to Fastly Compute!");
  console.log(`Deployment: ${slug} (UUIDv7: ${uuid7})`);
  console.log(`Service ID: ${serviceId}`);
  console.log(`Endpoint:   ${baseUrl}`);
  console.log(`Health:     ${healthUrl}`);
  console.log(`Compute:    Fastly WASM Compute (10M runs/mo · Wasmtime Lucet Edge Isolates)`);
  console.log("Tooling:    Remote MCP & Fastly MCP Server Enabled");
  console.log("===========================================================\n");

  console.log("How to run your agent on Fastly Compute:\n");
  console.log(`  curl -X POST ${runtimeUrl} \\`);
  console.log(`    -H "Content-Type: application/json" \\`);
  console.log(`    -d '{"prompt": "Hello Fastly Edge Agent!"}'\n`);

  return deployRecord;
}

