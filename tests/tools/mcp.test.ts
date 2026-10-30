import { describe, expect, test } from "bun:test";
import { ToolRegistry } from "../../src/tools/registry";
import { fetchTool } from "../../src/tools/builtin/fetch";
import { Agent } from "../../src/agent/agent";
import { createAgentMcpServer } from "../../src/tools/server";

describe("Layer 4: [T] Tools & MCP v2 Layer", () => {
  test("ToolRegistry.parseSpec: parses builtin fetch tool", () => {
    const res1 = ToolRegistry.parseSpec("fetch");
    expect(res1.isBuiltin).toBe(true);
    expect(res1.isMcp).toBe(false);

    const res2 = ToolRegistry.parseSpec("builtin:fetch");
    expect(res2.isBuiltin).toBe(true);
  });

  test("ToolRegistry.parseSpec: parses entire MCP server name", () => {
    const res = ToolRegistry.parseSpec("mcp:agentmail");
    expect(res.isMcp).toBe(true);
    expect(res.serverName).toBe("agentmail");
    expect(res.selectedTools).toBeUndefined();
  });

  test("ToolRegistry.parseSpec: parses single granular tool", () => {
    const res = ToolRegistry.parseSpec("mcp:agentmail:send_email");
    expect(res.isMcp).toBe(true);
    expect(res.serverName).toBe("agentmail");
    expect(res.selectedTools).toEqual(["send_email"]);
  });

  test("ToolRegistry.parseSpec: parses inline comma-separated multiple tools in one entry", () => {
    const res = ToolRegistry.parseSpec("mcp:agentmail:send_email,read_inbox,delete_email");
    expect(res.isMcp).toBe(true);
    expect(res.serverName).toBe("agentmail");
    expect(res.selectedTools).toEqual(["send_email", "read_inbox", "delete_email"]);
  });

  test("ToolRegistry.parseSpec: parses shorthand server:tool1,tool2 syntax", () => {
    const res = ToolRegistry.parseSpec("github:create_issue,get_pull_request");
    expect(res.isMcp).toBe(true);
    expect(res.serverName).toBe("github");
    expect(res.selectedTools).toEqual(["create_issue", "get_pull_request"]);
  });

  test("ToolRegistry.loadMcpConfig: loads hub/mcp/agentmail.json and resolves env vars", () => {
    const config = ToolRegistry.loadMcpConfig("agentmail", {
      AGENTMAIL_API_KEY: "test_secret_agentmail_123"
    });

    expect(config.id).toBe("agentmail");
    expect(config.transport).toBe("http");
    expect(config.url).toBe("https://mcp.agentmail.to/mcp?apiKey=test_secret_agentmail_123");
  });

  test("ToolRegistry.loadMcpConfig: loads hub/mcp/fetch.json with uvx stdio transport", () => {
    const config = ToolRegistry.loadMcpConfig("fetch");
    expect(config.id).toBe("fetch");
    expect(config.transport).toBe("stdio");
    expect(config.command).toBe("uvx");
    expect(config.args).toEqual(["mcp-server-fetch"]);
  });

  test("Builtin fetch tool: has compliant schema and required parameters", () => {
    expect(fetchTool.name).toBe("fetch");
    expect(fetchTool.description).toBeDefined();
    expect(fetchTool.parameters?.required).toContain("url");
    expect(fetchTool.execute).toBeDefined();
  });

  test("Agent integration: loads Layer [T] tools from manifest", async () => {
    const manifest = {
      L: "sarvam/gemma4",
      I: { memory: ":memory:" },
      A: {
        name: "tool_agent",
        version: "1.0.0",
        intent: "Tool Tester"
      },
      T: ["fetch"],
      E: { SARVAM_API_KEY: "dummy-key" }
    };

    const agent = new Agent({ manifest });
    expect(agent.name).toBe("tool_agent");

    const tools = await agent.getTools();
    expect(tools.length).toBe(1);
    expect(tools[0].name).toBe("fetch");
    expect(tools[0].description).toBeDefined();
  });

  test("createAgentMcpServer: exposes an agent as a compliant MCP server", () => {
    const mockAgent = {
      name: "test_bot",
      async run(prompt: string) {
        return { text: `Echo: ${prompt}` };
      }
    };

    const server = createAgentMcpServer(mockAgent);
    expect(server).toBeDefined();
  });
});
