import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

export interface McpAgentLike {
  name: string;
  version?: string;
  run(prompt: string): Promise<{ text: string }>;
  [key: string]: any;
}

/**
 * OpenLiate MCP Server Exposer [Layer T]
 * Exposes an OpenLiate Agent as a standard Model Context Protocol (MCP) server.
 */
export function createAgentMcpServer(agent: McpAgentLike): McpServer {
  const agentName = agent.name || "Agent";
  const agentVersion = agent.version || "0.0.1";
  const server = new McpServer({
    name: `openliate-${agentName.toLowerCase()}`,
    version: agentVersion
  });

  // Tool 1: Run Agent
  (server as any).registerTool(
    `${agentName.toLowerCase()}_run`,
    {
      description: `Execute cognitive reasoning using the ${agentName} agent.`,
      inputSchema: {
        prompt: z.string().describe("The prompt or instruction to execute")
      }
    },
    async ({ prompt }: { prompt: string }) => {
      const result = await agent.run(prompt);
      return {
        content: [{ type: "text", text: result.text }]
      };
    }
  );

  // Tool 2: Agent Health & Status
  (server as any).registerTool(
    `${agentName.toLowerCase()}_health`,
    {
      description: `Check the status of the ${agentName} agent.`,
      inputSchema: {}
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
                version: agentVersion,
                protocol: "Liate API v1",
                doctrine: "Class is an Agent. Agent is a Function. Function is an API. OpenLiate is Your Backend."
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

