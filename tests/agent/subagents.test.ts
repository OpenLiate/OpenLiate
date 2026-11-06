import { describe, it, expect } from "bun:test";
import { Agent } from "../../src/layers/agent/harness";

describe("Layer [A]: Multi-Agent Swarms & Subagent Delegation", () => {
  it("registers delegate tool for configured subagents", async () => {
    const manager = new Agent({
      manifest: {
        L: "sarvam/sarvam-105b",
        A: {
          name: "lead_agent",
          intent: "Orchestrate team",
          subagents: ["auditor", "coder"]
        },
        T: [
          {
            name: "test_tool",
            description: "Test tool for leader agent",
            execute: async () => "ok"
          }
        ],
        E: { SARVAM_API_KEY: "mock-key" }
      }
    });

    const tools = await manager.getTools();
    const toolNames = tools.map(t => t.name);

    expect(toolNames).toContain("delegate_to_auditor");
    expect(toolNames).toContain("delegate_to_coder");
    expect(toolNames).toContain("test_tool");

    const auditorTool = tools.find(t => t.name === "delegate_to_auditor");
    expect(auditorTool?.description).toContain("auditor");
  });
});

