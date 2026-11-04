import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import type { AgentTool } from "../agent/types";
import type { McpServerConfig } from "./types";
import { OPENLIATE_VERSION } from "../../core/version";

export class MCP {
  private static activeClients: Client[] = [];
  private static activeTransports: any[] = [];

  /**
   * Close all active MCP clients and transports, releasing stdio streams
   */
  public static async closeAll(): Promise<void> {
    for (const client of this.activeClients) {
      try {
        await client.close();
      } catch {}
    }
    this.activeClients = [];

    for (const transport of this.activeTransports) {
      try {
        if (typeof transport.close === "function") {
          await transport.close();
        }
      } catch {}
    }
    this.activeTransports = [];
  }

  /**
   * Connects to an external MCP server (Stdio, SSE, or Streamable HTTP)
   * and discovers all tools exposed by that server.
   */
  public static async discoverTools(
    config: McpServerConfig,
    toolFilter?: string[]
  ): Promise<AgentTool[]> {
    if (
      config.transport === "http" ||
      config.transport === "sse" ||
      (config.url && (config.url.startsWith("http://") || config.url.startsWith("https://")))
    ) {
      return this.discoverHttpTools(config, toolFilter);
    }
    return this.discoverStdioTools(config, toolFilter);
  }

  /**
   * Discovers tools from a local MCP server over Stdio (e.g. uvx, bunx, npx, or custom executable).
   * Uses official @modelcontextprotocol/client with full protocol negotiation.
   */
  public static async discoverStdioTools(
    config: McpServerConfig,
    toolFilter?: string[]
  ): Promise<AgentTool[]> {
    const filterSet = toolFilter && toolFilter.length > 0 ? new Set(toolFilter.map(t => t.toLowerCase())) : null;

    try {
      const containerSafeEnv: Record<string, string> = {
        HOME: "/tmp",
        npm_config_cache: "/tmp/.npm",
        npm_config_update_notifier: "false",
        ...process.env,
        ...(config.env || {})
      };

      const transport = new StdioClientTransport({
        command: config.command || "npx",
        args: config.args || [],
        env: containerSafeEnv
      });
      this.activeTransports.push(transport);

      const safeJsonSchemaValidator = {
        getValidator: () => (input: any) => ({ valid: true, data: input })
      };

      const client = new Client(
        {
          name: `openliate-${config.name}`,
          version: OPENLIATE_VERSION
        },
        {
          capabilities: {},
          jsonSchemaValidator: safeJsonSchemaValidator as any,
          timeout: 60000
        } as any
      );

      await client.connect(transport);
      this.activeClients.push(client);

      const toolsResult = await client.listTools(undefined, { timeout: 60000 });
      const registeredTools: AgentTool[] = [];

      for (const t of toolsResult.tools) {
        if (filterSet && !filterSet.has(t.name.toLowerCase())) continue;

        registeredTools.push({
          name: t.name,
          description: t.description || `Tool from ${config.name} MCP server`,
          parameters: (t.inputSchema as Record<string, any>) || { type: "object", properties: {} },
          execute: async (callArgs: Record<string, any>) => {
            try {
              const res = await client.callTool({
                name: t.name,
                arguments: callArgs
              });

              if (res && res.content && Array.isArray(res.content)) {
                return res.content.map((c: any) => c.text ?? JSON.stringify(c)).join("\n");
              }
              return typeof res === "string" ? res : JSON.stringify(res);
            } catch (err: any) {
              return `Error calling MCP tool ${t.name}: ${err.message}`;
            }
          }
        });
      }

      return registeredTools;
    } catch (err: any) {
      console.warn(`[MCP] Stdio discovery failed for ${config.name}: ${err.message}`);
      return [];
    }
  }

  /**
   * Discovers tools from a remote MCP HTTP/SSE endpoint using zero-dependency native fetch.
   * Sends JSON-RPC 2.0 tools/list and registers tools/call executors.
   */
  public static async discoverHttpTools(
    config: McpServerConfig,
    toolFilter?: string[]
  ): Promise<AgentTool[]> {
    const url = config.url!;
    const filterSet = toolFilter && toolFilter.length > 0 ? new Set(toolFilter.map(t => t.toLowerCase())) : null;
    const headers = {
      "Content-Type": "application/json",
      "Accept": "application/json, text/event-stream, */*",
      ...(config.headers || {})
    };

    function parseMcpPayload(rawText: string): any {
      const trimmed = rawText.trim();
      if (trimmed.includes("data:")) {
        const lines = trimmed.split("\n");
        for (const line of lines) {
          const l = line.trim();
          if (l.startsWith("data:")) {
            try {
              return JSON.parse(l.slice(5).trim());
            } catch {}
          }
        }
      }
      return JSON.parse(trimmed);
    }

    try {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/list",
          params: {}
        })
      });

      if (!res.ok) {
        return [];
      }

      const resText = await res.text();
      const data: any = parseMcpPayload(resText);
      const rawTools = data.result?.tools || [];
      const registeredTools: AgentTool[] = [];

      for (const t of rawTools) {
        if (filterSet && !filterSet.has(t.name.toLowerCase())) continue;

        registeredTools.push({
          name: t.name,
          description: t.description || `HTTP MCP tool ${t.name}`,
          parameters: t.inputSchema || { type: "object", properties: {} },
          execute: async (args: Record<string, any>) => {
            try {
              const callRes = await fetch(url, {
                method: "POST",
                headers,
                body: JSON.stringify({
                  jsonrpc: "2.0",
                  id: Date.now(),
                  method: "tools/call",
                  params: { name: t.name, arguments: args }
                })
              });

              const callText = await callRes.text();
              const callData: any = parseMcpPayload(callText);
              const content = callData.result?.content;
              if (Array.isArray(content)) {
                return content.map((c: any) => c.text ?? JSON.stringify(c)).join("\n");
              }
              return typeof callData.result === "string" ? callData.result : JSON.stringify(callData.result || callData);
            } catch (err: any) {
              return `Error calling HTTP MCP tool ${t.name}: ${err.message}`;
            }
          }
        });
      }

      return registeredTools;
    } catch (err: any) {
      console.warn(`[MCP] HTTP discovery failed for ${config.name}: ${err.message}`);
      return [];
    }
  }
}
