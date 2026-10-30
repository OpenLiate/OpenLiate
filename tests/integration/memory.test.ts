import { describe, expect, test, afterAll } from "bun:test";
import fs from "fs/promises";
import path from "path";
import { InMemorySession, FileSessionMemory } from "../../src/integration/memory";
import { IntegrationResolver } from "../../src/integration/integration";

describe("Layer 2: [I] Integration & Memory Layer", () => {
  const testSessionPath = path.resolve(process.cwd(), "sessions/test-integration-agent.json");

  afterAll(async () => {
    try {
      await fs.unlink(testSessionPath);
    } catch {}
  });

  test("InMemorySession: should append, read messages, and manage state", async () => {
    const memory = new InMemorySession("test-ephemeral");
    expect(memory.sessionId).toBe("test-ephemeral");

    await memory.append({
      role: "user",
      content: "Hello Liate!"
    });

    await memory.append({
      role: "assistant",
      content: "Hello! Integration layer is online."
    });

    const messages = memory.getMessages();
    expect(messages.length).toBe(2);
    expect(messages[0].content).toBe("Hello Liate!");
    expect(messages[1].role).toBe("assistant");
    expect(messages[0].timestamp).toBeDefined();

    await memory.setState("userLanguage", "en-US");
    expect(memory.getState("userLanguage")).toBe("en-US");

    await memory.clear();
    expect(memory.getMessages().length).toBe(0);
    expect(memory.getState("userLanguage")).toBeUndefined();
  });

  test("FileSessionMemory: should persist to JSON file and reload across instances", async () => {
    const memory1 = new FileSessionMemory(testSessionPath, { agent: "test_bot" });
    await memory1.append({
      role: "user",
      content: "My name is Vinod Hatti."
    });
    await memory1.append({
      role: "assistant",
      content: "Pleasure to meet you, Vinod!"
    });
    await memory1.setState("founder", "Vinod");

    // Verify file exists on disk and has valid JSON structure
    const fileExists = await fs.stat(testSessionPath).then(() => true).catch(() => false);
    expect(fileExists).toBe(true);

    const raw = await fs.readFile(testSessionPath, "utf-8");
    const parsed = JSON.parse(raw);
    expect(parsed.sessionId).toBe("test-integration-agent");
    expect(parsed.messages.length).toBe(2);
    expect(parsed.state.founder).toBe("Vinod");

    // Second instance loading from the same path
    const memory2 = new FileSessionMemory(testSessionPath);
    await memory2.load();
    const restoredMessages = memory2.getMessages();
    expect(restoredMessages.length).toBe(2);
    expect(restoredMessages[0].content).toBe("My name is Vinod Hatti.");
    expect(memory2.getState("founder")).toBe("Vinod");
  });

  test("IntegrationResolver: should resolve memory based on agent manifest config", () => {
    const mem1 = IntegrationResolver.resolveMemory();
    expect(mem1 instanceof InMemorySession).toBe(true);

    const mem2 = IntegrationResolver.resolveMemory(":memory:");
    expect(mem2 instanceof InMemorySession).toBe(true);

    const mem3 = IntegrationResolver.resolveMemory({ memory: "sessions/hello-agent" });
    expect(mem3 instanceof FileSessionMemory).toBe(true);
    expect(mem3.sessionId).toBe("hello-agent");
  });
});
