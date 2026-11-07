import fs from "fs";
import path from "path";
import type { AgentTool } from "../agent/types";
import type { McpServerConfig, ParsedToolSpec } from "./types";
import { MCP } from "./mcp";

export class ToolRegistry {
  public static parseSpec(spec: string): ParsedToolSpec {
    const trimmed = spec.trim();

    if (trimmed.toLowerCase() === "fetch" || trimmed.toLowerCase() === "mcp:fetch" || trimmed.toLowerCase() === "mcp/fetch") {
      return {
        raw: trimmed,
        isMcp: true,
        serverName: "fetch"
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

    // Check workspace .openliate/mcp.json (local cache & user-registered servers)
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

    if (!parsed) {
      throw new Error(`MCP server '${serverName}' not found. Define it directly inline in Layer [T] (e.g. { url: "...", transport: "http" }) or register it in .openliate/mcp.json.`);
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
    let rawList: Array<string | AgentTool | Record<string, any>> = [];

    if (Array.isArray(specs)) {
      rawList = specs;
    } else if (typeof specs === "object" && specs !== null) {
      if ("command" in specs || "url" in specs) {
        rawList = [{ id: "inline_tool", name: "inline_tool", ...specs }];
      } else {
        rawList = Object.entries(specs).map(([key, val]) => {
          if (typeof val === "object" && val !== null) {
            return { id: key, name: key, ...val };
          }
          return key;
        });
      }
    }

    for (const item of rawList) {
      if (typeof item === "object" && item !== null) {
        // Direct AgentTool object (has name & execute function)
        if ("name" in item && "execute" in item && typeof (item as any).execute === "function") {
          resolved.push(item as AgentTool);
          continue;
        }

        // Inline MCP Config Object (e.g. { command: "uvx", args: ["mcp-server-time"], tools: ["*"] })
        if ("command" in item || "url" in item) {
          const rawArgs = (item as any).args;
          const resolvedArgs = Array.isArray(rawArgs)
            ? rawArgs.map(arg => typeof arg === "string" ? arg.replace(/\$([A-Z0-9_]+)/g, (_, name) => customEnv[name] || process.env[name] || "") : arg)
            : undefined;

          const rawEnv = (item as any).env;
          const resolvedEnv: Record<string, string> = {};
          if (rawEnv && typeof rawEnv === "object") {
            for (const [k, v] of Object.entries(rawEnv)) {
              resolvedEnv[k] = typeof v === "string"
                ? v.replace(/\$([A-Z0-9_]+)/g, (_, name) => customEnv[name] || process.env[name] || "")
                : String(v);
            }
          }

          let resolvedUrl = (item as any).url;
          if (resolvedUrl && typeof resolvedUrl === "string" && resolvedUrl.includes("$")) {
            resolvedUrl = resolvedUrl.replace(/\$([A-Z0-9_]+)/g, (_, name) => customEnv[name] || process.env[name] || "");
          }

          const rawHeaders = (item as any).headers;
          const resolvedHeaders: Record<string, string> = {};
          if (rawHeaders && typeof rawHeaders === "object") {
            for (const [k, v] of Object.entries(rawHeaders)) {
              resolvedHeaders[k] = typeof v === "string"
                ? v.replace(/\$([A-Z0-9_]+)/g, (_, name) => customEnv[name] || process.env[name] || "")
                : String(v);
            }
          }

          const inlineConfig: McpServerConfig = {
            id: (item as any).id || (item as any).name || "inline_mcp",
            name: (item as any).name || (item as any).id || "inline_mcp",
            transport: (item as any).transport || ((item as any).url ? "http" : "stdio"),
            command: (item as any).command,
            args: resolvedArgs,
            url: resolvedUrl,
            env: Object.keys(resolvedEnv).length > 0 ? resolvedEnv : undefined,
            headers: Object.keys(resolvedHeaders).length > 0 ? resolvedHeaders : undefined
          };

          const rawFilter = (item as any).tools || (item as any).selectedTools;
          const toolFilter: string[] | undefined = Array.isArray(rawFilter)
            ? (rawFilter.includes("*") ? undefined : rawFilter)
            : typeof rawFilter === "string" && rawFilter !== "*"
            ? rawFilter.split(",").map((s: string) => s.trim()).filter(Boolean)
            : undefined;

          try {
            const tools = await MCP.discoverTools(inlineConfig, toolFilter);
            resolved.push(...tools);
          } catch (err: any) {
            console.warn(`[ToolRegistry] Failed to resolve inline MCP config '${inlineConfig.name}': ${err.message}`);
          }
          continue;
        }
      }

      if (typeof item === "string") {
        const trimmed = item.trim();
        if (trimmed.toLowerCase() === "fetch" || trimmed.toLowerCase() === "mcp:fetch" || trimmed.toLowerCase() === "mcp/fetch") {
          resolved.push({
            name: "fetch",
            description: "Safe HTTP web fetcher tool to fetch webpage or API content",
            parameters: {
              type: "object",
              properties: {
                url: { type: "string", description: "The HTTP or HTTPS URL to fetch" }
              },
              required: ["url"]
            },
            execute: async ({ url }: { url: string }) => {
              const res = await fetch(url);
              return await res.text();
            }
          });
          continue;
        }

        const parsed = this.parseSpec(trimmed);

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
