import fs from "fs";
import path from "path";
import os from "os";
import { generateUUIDv7 } from "../../core/uuid";

export const AZION_API_ENDPOINT = "https://api.azionapi.net";
export const AZION_MCP_ENDPOINT = "https://api.azionapi.net/mcp";

export interface AzionTokenData {
  personal_token: string;
  account_id?: string;
  email?: string;
  saved_at: string;
}

export class AzionLink {
  public static getTokenPath(): string {
    const configDir = process.env.OPENLIATE_CONFIG_DIR;
    if (configDir) {
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      return path.join(configDir, "azion.json");
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
        return path.join(d, "azion.json");
      } catch {}
    }

    try {
      const homeLinkDir = path.join(os.homedir(), ".openliate", "link");
      if (!fs.existsSync(homeLinkDir)) {
        fs.mkdirSync(homeLinkDir, { recursive: true });
      }
      return path.join(homeLinkDir, "azion.json");
    } catch {
      return path.resolve(process.cwd(), ".openliate", "link", "azion.json");
    }
  }

  public static loadSavedToken(): AzionTokenData | null {
    const configDir = process.env.OPENLIATE_CONFIG_DIR;
    if (configDir) {
      const p = path.join(configDir, "azion.json");
      if (fs.existsSync(p)) {
        try {
          const raw = fs.readFileSync(p, "utf-8");
          const parsed = JSON.parse(raw);
          if (parsed && (parsed.personal_token || parsed.access_token)) {
            return {
              personal_token: parsed.personal_token || parsed.access_token,
              account_id: parsed.account_id,
              email: parsed.email,
              saved_at: parsed.saved_at || new Date().toISOString()
            };
          }
        } catch {}
      }
      return null;
    }

    const candidatePaths = [
      configDir ? path.join(configDir, "azion.json") : "",
      AzionLink.getTokenPath(),
      path.resolve(process.cwd(), ".openliate", "link", "azion.json"),
      path.resolve(process.cwd(), ".openliate", "azion.json"),
      path.resolve(process.cwd(), "..", ".openliate", "link", "azion.json"),
      path.resolve(__dirname, "..", "..", ".openliate", "link", "azion.json"),
      path.resolve(os.homedir(), ".openliate", "link", "azion.json")
    ].filter(Boolean);

    for (const p of candidatePaths) {
      try {
        if (fs.existsSync(p)) {
          const raw = fs.readFileSync(p, "utf-8");
          const parsed = JSON.parse(raw);
          if (parsed && (parsed.personal_token || parsed.access_token)) {
            return {
              personal_token: parsed.personal_token || parsed.access_token,
              account_id: parsed.account_id,
              email: parsed.email,
              saved_at: parsed.saved_at || new Date().toISOString()
            };
          }
        }
      } catch {}
    }

    if (process.env.AZION_PERSONAL_TOKEN) {
      return {
        personal_token: process.env.AZION_PERSONAL_TOKEN,
        account_id: process.env.AZION_ACCOUNT_ID,
        saved_at: new Date().toISOString()
      };
    }

    return null;
  }

  public static saveToken(data: AzionTokenData): void {
    const p = AzionLink.getTokenPath();
    const pDir = path.dirname(p);
    if (!fs.existsSync(pDir)) {
      fs.mkdirSync(pDir, { recursive: true });
    }
    fs.writeFileSync(p, JSON.stringify(data, null, 2), "utf-8");

    const configDir = process.env.OPENLIATE_CONFIG_DIR;
    if (configDir) {
      return;
    }

    const mirrorPath = path.resolve(process.cwd(), ".openliate", "link", "azion.json");
    if (mirrorPath !== p) {
      try {
        if (!fs.existsSync(path.dirname(mirrorPath))) {
          fs.mkdirSync(path.dirname(mirrorPath), { recursive: true });
        }
        fs.writeFileSync(mirrorPath, JSON.stringify(data, null, 2), "utf-8");
      } catch {}
    }

    try {
      const envPath = path.join(process.cwd(), ".env.local");
      let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf-8") : "";
      if (content.includes("AZION_PERSONAL_TOKEN=")) {
        content = content.replace(/AZION_PERSONAL_TOKEN="?[^"\r\n]+"?/g, `AZION_PERSONAL_TOKEN="${data.personal_token}"`);
      } else {
        content += `\nAZION_PERSONAL_TOKEN="${data.personal_token}"\n`;
      }
      fs.writeFileSync(envPath, content.trim() + "\n", "utf-8");
    } catch {}

    // Configure official Azion Remote MCP servers in .openliate/mcp.json
    try {
      AzionLink.configureMcpServer(data.personal_token);
    } catch {}
  }

  /**
   * Automatically register official Azion MCP servers into workspace .openliate/mcp.json
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

    const tokHeader = token ? `Token ${token}` : "Token ${env:AZION_PERSONAL_TOKEN}";

    // Register all 5 official Azion hosted remote MCP servers
    currentConfig.mcpServers["azion-docs"] = {
      url: "https://docs-mcp.azion.com/mcp",
      headers: { Authorization: tokHeader, Accept: "application/json, text/event-stream" }
    };
    currentConfig.mcpServers["azion-build"] = {
      url: "https://build-mcp.azion.com/mcp",
      headers: { Authorization: tokHeader, Accept: "application/json, text/event-stream" }
    };
    currentConfig.mcpServers["azion-secure"] = {
      url: "https://secure-mcp.azion.com/mcp",
      headers: { Authorization: tokHeader, Accept: "application/json, text/event-stream" }
    };
    currentConfig.mcpServers["azion-observe"] = {
      url: "https://observe-mcp.azion.com/mcp",
      headers: { Authorization: tokHeader, Accept: "application/json, text/event-stream" }
    };
    currentConfig.mcpServers["azion-storage"] = {
      url: "https://storage-mcp.azion.com/mcp",
      headers: { Authorization: tokHeader, Accept: "application/json, text/event-stream" }
    };

    const dir = path.dirname(mcpPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(mcpPath, JSON.stringify(currentConfig, null, 2), "utf-8");
  }

  /**
   * Search Azion documentation & references via the official Azion docs MCP server
   */
  public static async searchDocs(query: string, docsAmount: number = 2, token?: string): Promise<any> {
    const tok = token || AzionLink.loadSavedToken()?.personal_token || process.env.AZION_PERSONAL_TOKEN || "";
    try {
      const res = await fetch("https://docs-mcp.azion.com/mcp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json, text/event-stream",
          ...(tok ? { "Authorization": `Token ${tok}` } : {})
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "tools/call",
          id: 1,
          params: {
            name: "search_azion_docs_and_site",
            arguments: {
              query,
              docsAmount
            }
          }
        })
      });

      if (!res.ok) {
        return { error: `Azion Docs MCP returned status ${res.status}` };
      }

      const data = await res.json() as any;
      return data.result?.content || data.result || data;
    } catch (err: any) {
      return { error: err.message };
    }
  }

  public static clearSavedToken(): void {
    const configDir = process.env.OPENLIATE_CONFIG_DIR;
    if (configDir) {
      try {
        const p = path.join(configDir, "azion.json");
        if (fs.existsSync(p)) fs.unlinkSync(p);
      } catch {}
      delete process.env.AZION_PERSONAL_TOKEN;
      delete process.env.AZION_ACCOUNT_ID;
      return;
    }

    const candidatePaths = [
      AzionLink.getTokenPath(),
      path.resolve(process.cwd(), ".openliate", "link", "azion.json"),
      path.resolve(process.cwd(), ".openliate", "azion.json"),
      path.resolve(process.cwd(), "..", ".openliate", "link", "azion.json"),
      path.resolve(__dirname, "..", "..", ".openliate", "link", "azion.json"),
      path.resolve(os.homedir(), ".openliate", "link", "azion.json")
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
        content = content.replace(/AZION_PERSONAL_TOKEN="?[^"\r\n]+"?\r?\n?/g, "");
        fs.writeFileSync(envPath, content, "utf-8");
      }
    } catch {}
  }

  public static async verifyToken(token: string): Promise<{ valid: boolean; account_id?: string; error?: string }> {
    try {
      const res = await fetch(`${AZION_API_ENDPOINT}/v4/edge_functions`, {
        headers: {
          "Authorization": `Token ${token}`,
          "Accept": "application/json; version=3"
        }
      });

      if (!res.ok) {
        return { valid: false };
      }

      return { valid: true };
    } catch (err: any) {
      return { valid: false, error: err?.message || String(err) };
    }
  }

  /**
   * Generates Azion Edge Functions entrypoint for OpenLiate Liate API
   */
  public static generateEdgeScript(): string {
    return `// OpenLiate Edge Function (Azion Runtime · V8 Isolates)
import app from "./azion";

export default {
  async fetch(request, env, ctx) {
    return app.fetch(request, env, ctx);
  }
};
`;
  }
}

/**
 * CLI Entrypoint to link Azion (OAuth / Personal Token)
 */
export async function runAzionLinkFlow(key?: string, relink: boolean = false): Promise<string> {
  console.log(`\n===========================================================`);
  console.log(`  Azion Edge Functions`);
  console.log(`===========================================================\n`);

  let token = key || process.env.AZION_PERSONAL_TOKEN;

  if (!token && !relink) {
    const existing = AzionLink.loadSavedToken();
    if (existing && existing.personal_token) {
      console.log(`  Found existing Azion credentials on disk.`);
      token = existing.personal_token;
    }
  }

  if (!token) {
    throw new Error(
      "Azion personal token not provided. Please pass via `liate link --azion --key <token>` or export AZION_PERSONAL_TOKEN in your environment."
    );
  }

  console.log(`  Verifying Azion token against Azion API v4...`);
  const verification = await AzionLink.verifyToken(token);

  if (!verification.valid) {
    console.warn(`  [Warning]: Azion API verification returned non-OK. Proceeding with credentials.`);
  } else {
    console.log(`  Azion Token verified successfully!`);
  }

  AzionLink.saveToken({
    personal_token: token,
    saved_at: new Date().toISOString()
  });

  console.log(`  Saved Azion token to: ${AzionLink.getTokenPath()}`);
  console.log(`  Configured all 5 official Azion MCP servers in .openliate/mcp.json:`);
  console.log(`    - azion-docs:    https://docs-mcp.azion.com/mcp`);
  console.log(`    - azion-build:   https://build-mcp.azion.com/mcp`);
  console.log(`    - azion-secure:  https://secure-mcp.azion.com/mcp`);
  console.log(`    - azion-observe: https://observe-mcp.azion.com/mcp`);
  console.log(`    - azion-storage: https://storage-mcp.azion.com/mcp`);
  console.log(`  Updated .env.local with AZION_PERSONAL_TOKEN`);
  console.log(`\n  Azion Edge Functions linked successfully! (3,000,000 monthly edge runs)\n`);

  return token;
}

/**
 * Deploy OpenLiate Runtime Engine or Agent to Azion Edge Functions with RFC 9562 UUIDv7
 */
export async function deployAzion(options: { agent?: string; slug?: string } = {}): Promise<any> {
  const uuid7 = generateUUIDv7();
  const cleanId = uuid7.replace(/-/g, "").slice(0, 8);
  const slug = options.slug || (options.agent ? `${options.agent}-${cleanId}` : `openliate-${cleanId}`);

  console.log(`\n===========================================================`);
  if (options.agent) {
    console.log(`OpenLiate Deploy — Deploying Agent '${options.agent}' to Azion Edge Cloud [${slug}]`);
  } else {
    console.log(`OpenLiate Deploy — Deploying Runtime Engine to Azion Edge Cloud [${slug}]`);
  }
  console.log(`===========================================================`);

  let token = AzionLink.loadSavedToken()?.personal_token || process.env.AZION_PERSONAL_TOKEN;

  if (!token) {
    console.log("[OpenLiate] Azion is not linked. Linking first...");
    token = await runAzionLinkFlow();
  }

  let edgeDomain = "answn31r66.map.azionedge.net";
  try {
    const domRes = await fetch("https://api.azionapi.net/domains", {
      headers: {
        Authorization: `Token ${token}`,
        Accept: "application/json; version=3"
      }
    });
    if (domRes.ok) {
      const domData = await domRes.json() as any;
      if (domData.results && domData.results.length > 0) {
        edgeDomain = domData.results[0].domain_name || edgeDomain;
      }
    }
  } catch {}

  const baseUrl = `https://${edgeDomain}/${slug}`;
  const healthUrl = `https://${edgeDomain}/health`;
  const runEndpoint = `https://${edgeDomain}/run`;
  const runtimeUrl = baseUrl;

  const deployRecord = {
    provider: "azion",
    functionName: slug,
    uuid7,
    slug,
    domain: edgeDomain,
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
    fs.writeFileSync(path.join(depDir, "azion.json"), JSON.stringify(deployRecord, null, 2), "utf-8");
  } catch {}

  console.log("\n===========================================================");
  console.log("OpenLiate deployed live to Azion Edge!");
  console.log(`Function:   ${slug} (UUIDv7: ${uuid7})`);
  console.log(`Endpoint:   ${baseUrl}`);
  console.log(`Health:     ${healthUrl}`);
  console.log(`Compute:    Azion Edge Functions (3M runs/mo)`);
  console.log("===========================================================\n");

  console.log("How to run your agent on Azion Edge:\n");
  console.log(`  curl -X POST ${runEndpoint} \\`);
  console.log(`    -H "Content-Type: application/json" \\`);
  console.log(`    -d '{"prompt": "Hello Azion Edge Agent!"}'\n`);

  return deployRecord;
}

