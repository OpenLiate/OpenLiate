import fs from "fs";
import path from "path";
import type { AgentTool } from "../agent/types";
import type { McpServerConfig, ParsedToolSpec } from "./types";
import { MCP } from "./mcp";
import { fetchTool } from "./builtin/fetch";
import { identityVerifierTool } from "./builtin/identity";

export class ToolRegistry {
  public static parseSpec(spec: string): ParsedToolSpec {
    const trimmed = spec.trim();

    if (trimmed.toLowerCase() === "fetch" || trimmed.toLowerCase() === "builtin:fetch") {
      return {
        raw: trimmed,
        isMcp: false,
        isBuiltin: true
      };
    }

    if (
      trimmed.toLowerCase() === "identity" ||
      trimmed.toLowerCase() === "verify_identity" ||
      trimmed.toLowerCase() === "builtin:identity"
    ) {
      return {
        raw: trimmed,
        isMcp: false,
        isBuiltin: true
      };
    }

    if (trimmed.startsWith("mcp:")) {
      const remainder = trimmed.slice(4); // Remove "mcp:"
      const colonIndex = remainder.indexOf(":");

      if (colonIndex === -1) {
        // e.g. "mcp:agentmail" -> all tools
        return {
          raw: trimmed,
          isMcp: true,
          isBuiltin: false,
          serverName: remainder.trim(),
          selectedTools: undefined
        };
      }

      // e.g. "mcp:agentmail:send_email,read_inbox"
      const serverName = remainder.slice(0, colonIndex).trim();
      const toolsPart = remainder.slice(colonIndex + 1).trim();
      const selectedTools = toolsPart ? toolsPart.split(",").map(s => s.trim()).filter(Boolean) : undefined;

      return {
        raw: trimmed,
        isMcp: true,
        isBuiltin: false,
        serverName,
        selectedTools
      };
    }

    // Check if it's "serverName:tool1,tool2"
    if (trimmed.includes(":")) {
      const [serverName, toolsPart] = trimmed.split(":");
      const selectedTools = toolsPart ? toolsPart.split(",").map(s => s.trim()).filter(Boolean) : undefined;
      return {
        raw: trimmed,
        isMcp: true,
        isBuiltin: false,
        serverName: serverName.trim(),
        selectedTools
      };
    }

    // Default to an MCP server name (e.g. "agentmail")
    return {
      raw: trimmed,
      isMcp: true,
      isBuiltin: false,
      serverName: trimmed,
      selectedTools: undefined
    };
  }

  /**
   * Resolve local workspace .openliate/mcp.json path
   */
  public static getMcpJsonPath(): string {
    const candidates = [
      path.resolve(process.cwd(), ".openliate", "mcp.json"),
      path.resolve(process.cwd(), "..", ".openliate", "mcp.json")
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }
    return path.resolve(process.cwd(), ".openliate", "mcp.json");
  }

  /**
   * Reads .openliate/mcp.json if available
   */
  public static readWorkspaceMcpServers(): Record<string, any> {
    const mcpJsonPath = ToolRegistry.getMcpJsonPath();
    if (fs.existsSync(mcpJsonPath)) {
      try {
        const raw = fs.readFileSync(mcpJsonPath, "utf-8");
        const parsed = JSON.parse(raw);
        return parsed.mcpServers || parsed || {};
      } catch {}
    }
    return {};
  }

  /**
   * Caches/writes an MCP server definition into .openliate/mcp.json
   */
  public static cacheMcpServer(serverName: string, config: McpServerConfig): void {
    try {
      const mcpJsonPath = ToolRegistry.getMcpJsonPath();
      const dir = path.dirname(mcpJsonPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      let data: { mcpServers: Record<string, any> } = { mcpServers: {} };
      if (fs.existsSync(mcpJsonPath)) {
        try {
          const raw = fs.readFileSync(mcpJsonPath, "utf-8");
          const parsed = JSON.parse(raw);
          data.mcpServers = parsed.mcpServers || parsed || {};
        } catch {}
      }

      data.mcpServers[serverName] = {
        name: config.name || serverName,
        transport: config.transport || (config.url ? "http" : "stdio"),
        ...(config.command ? { command: config.command } : {}),
        ...(config.args ? { args: config.args } : {}),
        ...(config.url ? { url: config.url } : {}),
        ...(config.headers ? { headers: config.headers } : {}),
        ...(config.env ? { env: config.env } : {})
      };

      fs.writeFileSync(mcpJsonPath, JSON.stringify(data, null, 2), "utf-8");
    } catch {}
  }

  public static loadMcpConfig(serverName: string, customEnv: Record<string, string | undefined> = process.env): McpServerConfig {
    let parsed: McpServerConfig | null = null;

    // 1. Check workspace .openliate/mcp.json first (local cache & custom servers)
    const workspaceServers = ToolRegistry.readWorkspaceMcpServers();
    if (workspaceServers && workspaceServers[serverName]) {
      const s = workspaceServers[serverName];
      parsed = {
        id: serverName,
        name: s.name || serverName,
        description: s.description,
        transport: s.transport || (s.url ? "http" : "stdio"),
        command: s.command,
        args: s.args,
        url: s.url,
        headers: s.headers,
        env: s.env
      };
    }

    // 2. If not found in .openliate/mcp.json, search hub/mcp/<serverName>.json
    if (!parsed) {
      const possiblePaths = [
        path.resolve(process.cwd(), `hub/mcp/${serverName}.json`),
        path.resolve(process.cwd(), `OpenLiate/hub/mcp/${serverName}.json`),
        path.resolve(process.cwd(), "..", `hub/mcp/${serverName}.json`),
        path.resolve(__dirname, `../../hub/mcp/${serverName}.json`),
        path.resolve(__dirname, `../../../hub/mcp/${serverName}.json`),
        path.resolve(__dirname, `../../../../hub/mcp/${serverName}.json`)
      ];

      const foundPath = possiblePaths.find((p) => fs.existsSync(p));
      if (!foundPath) {
        throw new Error(`MCP definition file not found for '${serverName}' in .openliate/mcp.json or hub/mcp/${serverName}.json`);
      }

      const raw = fs.readFileSync(foundPath, "utf-8");
      parsed = JSON.parse(raw);

      // Auto-cache into workspace .openliate/mcp.json for future runs
      if (parsed) {
        ToolRegistry.cacheMcpServer(serverName, parsed);
      }
    }

    if (!parsed) {
      throw new Error(`Failed to load MCP configuration for '${serverName}'`);
    }

    // Resolve environment variables in headers and URL
    const resolvedHeaders: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed.headers || {})) {
      if (typeof v === "string" && v.startsWith("$")) {
        const envName = v.slice(1);
        resolvedHeaders[k] = customEnv[envName] || "";
      } else if (typeof v === "string" && v.includes("$")) {
        resolvedHeaders[k] = v.replace(/\$([A-Z0-9_]+)/g, (_, name) => customEnv[name] || "");
      } else {
        resolvedHeaders[k] = String(v);
      }
    }

    let resolvedUrl = parsed.url;
    if (resolvedUrl && resolvedUrl.includes("$")) {
      resolvedUrl = resolvedUrl.replace(/\$([A-Z0-9_]+)/g, (_, name) => customEnv[name] || "");
    }

    return {
      ...parsed,
      url: resolvedUrl,
      headers: resolvedHeaders
    };
  }

  public static async resolveTools(
    specs: Array<string | AgentTool | Record<string, any>> | Record<string, any>,
    customEnv: Record<string, string | undefined> = process.env
  ): Promise<AgentTool[]> {
    const resolved: AgentTool[] = [];
    const rawList: Array<string | AgentTool | Record<string, any>> = Array.isArray(specs)
      ? specs
      : Object.entries(specs || {}).map(([key, val]) => {
          if (typeof val === "object" && val !== null) {
            return { id: key, name: key, ...val };
          }
          return key;
        });

    for (const item of rawList) {
      if (typeof item === "object" && item !== null) {
        // Direct AgentTool object (has name & execute function)
        if ("name" in item && "execute" in item && typeof (item as any).execute === "function") {
          resolved.push(item as AgentTool);
          continue;
        }

        // Inline MCP Config Object (e.g. { command: "uvx", args: ["mcp-server-fetch"] })
        if ("command" in item || "url" in item) {
          const inlineConfig: McpServerConfig = {
            id: (item as any).id || (item as any).name || "inline_mcp",
            name: (item as any).name || (item as any).id || "inline_mcp",
            transport: (item as any).transport || ((item as any).url ? "http" : "stdio"),
            command: (item as any).command,
            args: (item as any).args,
            url: (item as any).url,
            env: (item as any).env,
            headers: (item as any).headers
          };
          try {
            const tools = await MCP.discoverTools(inlineConfig);
            resolved.push(...tools);
          } catch (err: any) {
            console.warn(`[ToolRegistry] Failed to resolve inline MCP config: ${err.message}`);
          }
          continue;
        }
      }

      if (typeof item === "string") {
        const parsed = this.parseSpec(item);

        if (parsed.isBuiltin) {
          if (parsed.raw.toLowerCase().includes("identity")) {
            resolved.push(identityVerifierTool);
          } else {
            resolved.push(fetchTool);
          }
          continue;
        }

        if (parsed.isMcp && parsed.serverName) {
          try {
            const config = this.loadMcpConfig(parsed.serverName, customEnv);
            const tools = await MCP.discoverTools(config, parsed.selectedTools);
            resolved.push(...tools);
          } catch (err: any) {
            console.warn(`[ToolRegistry] Failed to resolve MCP server '${parsed.serverName}': ${err.message}`);
          }
        }
      }
    }

    return resolved;
  }
}
