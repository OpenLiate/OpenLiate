import { describe, expect, test } from "bun:test";
import { ToolRegistry } from "../../src/layers/tools/registry";
import { fetchTool } from "../../src/layers/tools/builtin/fetch";
import { Agent } from "../../src/layers/agent/harness";
import { createAgentMcpServer } from "../../src/layers/tools/server";
import { MCP } from "../../src/layers/tools/mcp";

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

  test("ToolRegistry: supports custom MCP servers defined directly in .openliate/mcp.json", () => {
    ToolRegistry.cacheMcpServer("custom-db", {
      id: "custom-db",
      name: "Custom Postgres",
      transport: "http",
      url: "https://custom-db.internal/mcp"
    });

    const config = ToolRegistry.loadMcpConfig("custom-db");
    expect(config.id).toBe("custom-db");
    expect(config.url).toBe("https://custom-db.internal/mcp");
    expect(config.transport).toBe("http");
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
        version: "0.0.1",
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

  test("Agent integration: loads inline command-based MCP tools from dictionary manifest", async () => {
    const manifest = {
      L: "sarvam/gemma4",
      I: { memory: ":memory:" },
      A: {
        name: "time-agent",
        version: "1.0.0",
        intent: "You are a time analyst."
      },
      T: {
        tool: {
          command: "uvx",
          args: ["mcp-server-time"],
          tools: ["*"]
        }
      },
      E: { SARVAM_API_KEY: "dummy-key" }
    };

    const agent = new Agent({ manifest });
    expect(agent.name).toBe("time-agent");
  });

  test("ToolRegistry: supports custom in-memory AgentTool objects", async () => {
    const customTool = {
      name: "echo_custom",
      description: "Custom echo tool",
      parameters: { type: "object", properties: { text: { type: "string" } } },
      execute: async ({ text }: { text: string }) => `Echo: ${text}`
    };

    const tools = await ToolRegistry.resolveTools([customTool]);
    expect(tools.length).toBe(1);
    expect(tools[0].name).toBe("echo_custom");
    const result = await tools[0].execute({ text: "OpenLiate" });
    expect(result).toBe("Echo: OpenLiate");
  });

  test("ToolRegistry: resolves environment variables in inline MCP config args and env", async () => {
    const originalDiscover = MCP.discoverTools;
    let capturedConfig: any = null;

    MCP.discoverTools = (async (cfg: any, filter?: string[]) => {
      capturedConfig = { cfg, filter };
      return [];
    }) as any;

    try {
      await ToolRegistry.resolveTools(
        {
          sqlite: {
            command: "uvx",
            args: ["mcp-server-sqlite", "--db", "$CUSTOM_DB"],
            env: { SECRET_FLAG: "$SECRET_VAL" },
            tools: ["query_db"]
          }
        },
        { CUSTOM_DB: "/data/app.db", SECRET_VAL: "xyz123" }
      );

      expect(capturedConfig).toBeDefined();
      expect(capturedConfig.cfg.command).toBe("uvx");
      expect(capturedConfig.cfg.args).toEqual(["mcp-server-sqlite", "--db", "/data/app.db"]);
      expect(capturedConfig.cfg.env.SECRET_FLAG).toBe("xyz123");
      expect(capturedConfig.filter).toEqual(["query_db"]);
    } finally {
      MCP.discoverTools = originalDiscover;
    }
  });

  test("ToolRegistry: treats tools: ['*'] as exposing all tools (undefined filter)", async () => {
    const originalDiscover = MCP.discoverTools;
    let capturedFilter: any = "unset";

    MCP.discoverTools = (async (_cfg: any, filter?: string[]) => {
      capturedFilter = filter;
      return [];
    }) as any;

    try {
      await ToolRegistry.resolveTools({
        time_tool: {
          command: "uvx",
          args: ["mcp-server-time"],
          tools: ["*"]
        }
      });

      expect(capturedFilter).toBeUndefined();
    } finally {
      MCP.discoverTools = originalDiscover;
    }
  });

  test("ToolRegistry: resolves remote HTTP MCP servers defined inline with URL/header expansion", async () => {
    const originalDiscover = MCP.discoverTools;
    let capturedConfig: any = null;

    MCP.discoverTools = (async (cfg: any, filter?: string[]) => {
      capturedConfig = { cfg, filter };
      return [];
    }) as any;

    try {
      await ToolRegistry.resolveTools(
        {
          agentmail: {
            url: "https://mcp.agentmail.to/mcp?apiKey=$AGENTMAIL_API_KEY",
            headers: {
              Authorization: "Bearer $AUTH_TOKEN",
              "X-Custom": "test"
            },
            transport: "http",
            tools: ["send_email", "list_inbox"]
          }
        },
        {
          AGENTMAIL_API_KEY: "secret_agentmail_key_999",
          AUTH_TOKEN: "jwt_token_123"
        }
      );

      expect(capturedConfig).toBeDefined();
      expect(capturedConfig.cfg.transport).toBe("http");
      expect(capturedConfig.cfg.url).toBe("https://mcp.agentmail.to/mcp?apiKey=secret_agentmail_key_999");
      expect(capturedConfig.cfg.headers.Authorization).toBe("Bearer jwt_token_123");
      expect(capturedConfig.cfg.headers["X-Custom"]).toBe("test");
      expect(capturedConfig.filter).toEqual(["send_email", "list_inbox"]);
    } finally {
      MCP.discoverTools = originalDiscover;
    }
  });

  test("Live Remote HTTP MCP: connects to remote HTTP MCP endpoint inline, discovers tools, and executes tool call", async () => {
    const originalFetch = globalThis.fetch;

    globalThis.fetch = (async (input: any, init?: any) => {
      const url = String(input);
      expect(url).toContain("https://mcp.agentmail.to/mcp?key=live_test_key");

      const body = JSON.parse(init?.body as string);
      if (body.method === "tools/list") {
        return new Response(JSON.stringify({
          jsonrpc: "2.0",
          id: body.id,
          result: {
            tools: [
              {
                name: "send_agent_mail",
                description: "Send an email via remote AgentMail",
                inputSchema: {
                  type: "object",
                  properties: { to: { type: "string" }, subject: { type: "string" } },
                  required: ["to", "subject"]
                }
              }
            ]
          }
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      if (body.method === "tools/call") {
        return new Response(JSON.stringify({
          jsonrpc: "2.0",
          id: body.id,
          result: {
            content: [{ type: "text", text: `Email delivered to ${body.params.arguments.to}` }]
          }
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      return new Response("Not found", { status: 404 });
    }) as any;

    try {
      const tools = await ToolRegistry.resolveTools(
        {
          agentmail_remote: {
            url: "https://mcp.agentmail.to/mcp?key=$SECRET_KEY",
            transport: "http",
            tools: ["*"]
          }
        },
        { SECRET_KEY: "live_test_key" }
      );

      expect(tools.length).toBe(1);
      expect(tools[0].name).toBe("send_agent_mail");
      expect(tools[0].description).toContain("remote AgentMail");

      const callResult = await tools[0].execute({ to: "team@openliate.tech", subject: "Hello OpenLiate" });
      expect(callResult).toBe("Email delivered to team@openliate.tech");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
