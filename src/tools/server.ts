import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

export interface McpAgentLike {
  name: string;
  run(prompt: string): Promise<{ text: string }>;
  [key: string]: any;
}

/**
 * OpenLiate MCP Server Exposer [Layer T]
 * Exposes a Liate Agent as a standard Model Context Protocol (MCP) server
 * so external IDEs (Claude Desktop, Cursor, Antigravity) can call it directly.
 */
export function createAgentMcpServer(agent: McpAgentLike): McpServer {
  const agentName = agent.name || "LiateAgent";
  const server = new McpServer({
    name: `liate-${agentName.toLowerCase()}`,
    version: "1.0.0"
  });

  // Tool 1: Run Agent
  server.registerTool(
    `${agentName.toLowerCase()}_run`,
    {
      description: `Execute cognitive reasoning using the ${agentName} agent.`,
      inputSchema: z.object({
        prompt: z.string().describe("The prompt or instruction to execute")
      })
    },
    async ({ prompt }: { prompt: string }) => {
      const result = await agent.run(prompt);
      return {
        content: [{ type: "text", text: result.text }]
      };
    }
  );

  // Tool 2: Agent Health & Status
  server.registerTool(
    `${agentName.toLowerCase()}_health`,
    {
      description: `Check the status of the ${agentName} agent.`,
      inputSchema: z.object({})
    },
    async () => {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                status: "ok",
                agent: agentName,
                protocol: "LAPI/v1",
                mcpVersion: "v2",
                doctrine: "Class is an Agent. Agent is a LAPI. That's your Backend."
              },
              null,
              2
            )
          }
        ]
      };
    }
  );

  return server;
}

