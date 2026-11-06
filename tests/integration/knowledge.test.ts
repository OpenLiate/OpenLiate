import { describe, it, expect } from "bun:test";
import { LiateKnowledge } from "../../src/layers/integration/knowledge";
import { Agent } from "../../src/layers/agent/harness";
import path from "node:path";

describe("Layer [I] LiateKnowledge Suite", () => {
  it("resolves inline knowledge strings and factual arrays", async () => {
    const kContext = await LiateKnowledge.resolve([
      "OpenLiate provides 18.5M free AI agent runs per month across worldwide edge clouds.",
      "The 5 elements of an AI agent are Model, Knowledge, Tools, Harness, and Sandbox."
    ]);

    expect(kContext).toBeDefined();
    expect(kContext.documents.length).toBe(2);
    expect(kContext.totalChars).toBeGreaterThan(50);
  });

  it("resolves file and directory knowledge sources", async () => {
    const kContext = await LiateKnowledge.resolve("README.md");
    expect(kContext.documents.length).toBeGreaterThan(0);
    expect(kContext.documents[0].content.length).toBeGreaterThan(10);
  });

  it("synthesizes search_knowledge agent tool and queries content", async () => {
    const kContext = await LiateKnowledge.resolve([
      "Sarvam-105b is India's sovereign foundation LLM.",
      "Fastly Compute provides 10M free agent runs per month using WebAssembly."
    ]);

    const tool = LiateKnowledge.asTool(kContext);
    expect(tool.name).toBe("search_knowledge");
    expect(tool.description).toBeDefined();

    const result = await tool.execute({ query: "Fastly" });
    expect(result).toContain("Fastly Compute");
  });

  it("Agent harness automatically loads Layer [I] knowledge and registers search_knowledge", async () => {
    const agent = new Agent({
      manifest: {
        L: "sarvam/sarvam-2b",
        I: {
          knowledge: [
            "OpenLiate is an open-source backend layer for AI agents."
          ]
        },
        A: {
          name: "knowledge-agent",
          intent: "Knowledge Retrieval Agent"
        },
        E: { SARVAM_API_KEY: "dummy-key" }
      }
    });

    const tools = await agent.getTools();
    const toolNames = tools.map((t) => t.name);
    expect(toolNames).toContain("search_knowledge");

    const context = agent.getContext();
    expect(context.state.knowledge).toBeDefined();
    expect(context.state.knowledge.documents.length).toBe(1);
  });
});

