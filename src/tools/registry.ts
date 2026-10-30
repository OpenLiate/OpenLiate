import fs from "fs";
import path from "path";
import type { AgentTool } from "../agent/types";
import type { McpServerConfig, ParsedToolSpec } from "./types";
import { LiateMcp } from "./mcp";
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

  public static loadMcpConfig(serverName: string, customEnv: Record<string, string | undefined> = process.env): McpServerConfig {
    const possiblePaths = [
      path.resolve(process.cwd(), `hub/mcp/${serverName}.json`),
      path.resolve(process.cwd(), "..", `hub/mcp/${serverName}.json`),
      path.join(__dirname, "..", "..", `hub/mcp/${serverName}.json`)
    ];

    let foundPath: string | undefined;
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        foundPath = p;
        break;
      }
    }

    if (!foundPath) {
      throw new Error(`MCP definition file not found for '${serverName}' at hub/mcp/${serverName}.json`);
    }

    const raw = fs.readFileSync(foundPath, "utf-8");
    const parsed: McpServerConfig = JSON.parse(raw);

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
    specs: Array<string | AgentTool | Record<string, any>>,
    customEnv: Record<string, string | undefined> = process.env
  ): Promise<AgentTool[]> {
    const resolved: AgentTool[] = [];

    for (const item of specs) {
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
            const tools = await LiateMcp.discoverTools(inlineConfig);
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
            const tools = await LiateMcp.discoverTools(config, parsed.selectedTools);
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
