import { describe, expect, test } from "bun:test";
import { ReActLoop, type LLMFunctionCaller } from "../../src/layers/agent/loop";
import { Agent } from "../../src/layers/agent/harness";
import { InMemorySession } from "../../src/layers/integration/memory";
import type { AgentTool, ToolCall } from "../../src/layers/agent/types";
import type { SarvamMessage, SarvamChatResponse } from "../../src/layers/llm/sarvam";

describe("Layer 3: [A] Agent Harness & ReAct Loop", () => {
  test("ReActLoop: executes single-step conversation and records to memory", async () => {
    const memory = new InMemorySession("test-agent-session");
    const mockLLM: LLMFunctionCaller = {
      async chat(messages: SarvamMessage[]) {
        return {
          text: "Integration by parts is the core doctrine of Liate.",
          reasoningContent: "Thinking about Liate's core calculus philosophy.",
          model: "sarvam-mock"
        };
      }
    };

    const context = {
      agentName: "liate_bot",
      agentVersion: "1.0.0",
      state: { intent: "Explain Liate concepts" }
    };

    const result = await ReActLoop.execute(
      "What is Liate's doctrine?",
      mockLLM,
      memory,
      [],
      context,
      { maxSteps: 5 }
    );

    expect(result.text).toBe("Integration by parts is the core doctrine of Liate.");
    expect(result.thought).toBe("Thinking about Liate's core calculus philosophy.");
    expect(result.totalSteps).toBe(1);
    expect(result.finishReason).toBe("stop");

    // Verify session memory recorded user turn and assistant turn
    const recorded = memory.getMessages();
    expect(recorded.length).toBe(2);
    expect(recorded[0].role).toBe("user");
    expect(recorded[0].content).toBe("What is Liate's doctrine?");
    expect(recorded[1].role).toBe("assistant");
    expect(recorded[1].content).toBe(result.text);
    expect(recorded[1].reasoningContent).toBe(result.thought);
  });

  test("ReActLoop: executes multi-step ReAct cycle (Thought -> Action -> Observation -> Final Answer)", async () => {
    const memory = new InMemorySession("react-test-session");
    let callCount = 0;

    const mockCalculator: AgentTool = {
      name: "calculate_sum",
      description: "Adds two numbers together",
      async execute(args) {
        return String(Number(args.a) + Number(args.b));
      }
    };

    const mockLLM: LLMFunctionCaller = {
      async chat(messages: SarvamMessage[]) {
        callCount++;
        if (callCount === 1) {
          // Step 1: Decision to call a tool
          return {
            text: "",
            reasoningContent: "User wants to add 42 and 58. I will invoke calculate_sum tool.",
            model: "glm5.3-mock",
            toolCalls: [
              {
                id: "call_add_1",
                name: "calculate_sum",
                arguments: { a: 42, b: 58 }
              }
            ]
          };
        } else {
          // Step 2: Final answer after receiving tool observation
          return {
            text: "The sum of 42 and 58 is 100.",
            reasoningContent: "Observed tool output of 100. Formulating final response.",
            model: "glm5.3-mock"
          };
        }
      }
    };

    const context = {
      agentName: "math_agent",
      agentVersion: "1.0.0",
      state: { intent: "Mathematical problem solver" }
    };

    const result = await ReActLoop.execute(
      "Calculate 42 + 58",
      mockLLM,
      memory,
      [mockCalculator],
      context,
      { maxSteps: 5 }
    );

    expect(callCount).toBe(2);
    expect(result.totalSteps).toBe(2);
    expect(result.finishReason).toBe("stop");
    expect(result.text).toBe("The sum of 42 and 58 is 100.");

    // Verify step 1 recorded tool execution
    expect(result.steps[0].toolCalls?.length).toBe(1);
    expect(result.steps[0].toolResults?.[0].result).toBe("100");

    // Verify memory contains: user -> tool observation -> assistant final answer
    const history = memory.getMessages();
    expect(history.length).toBe(4);
    expect(history[0].role).toBe("user");
    expect(history[1].role).toBe("assistant");
    expect(history[1].toolCalls?.length).toBe(1);
    expect(history[2].role).toBe("tool");
    expect(history[2].content).toBe("100");
    expect(history[3].role).toBe("assistant");
    expect(history[3].content).toBe("The sum of 42 and 58 is 100.");
  });

  test("ReActLoop: enforces maxSteps guardrail against infinite loops", async () => {
    const memory = new InMemorySession("infinite-loop-session");

    const endlessTool: AgentTool = {
      name: "endless_ping",
      description: "Infinite test ping",
      async execute() {
        return "pong";
      }
    };

    const infiniteMockLLM: LLMFunctionCaller = {
      async chat() {
        return {
          text: "",
          reasoningContent: "Continuing loop forever.",
          model: "sarvam-mock",
          toolCalls: [
            {
              id: "ping_call",
              name: "endless_ping",
              arguments: {}
            }
          ]
        };
      }
    };

    const context = {
      agentName: "guardrail_test",
      agentVersion: "0.0.1",
      state: {}
    };

    const result = await ReActLoop.execute(
      "Start loop",
      infiniteMockLLM,
      memory,
      [endlessTool],
      context,
      { maxSteps: 3 }
    );

    expect(result.totalSteps).toBe(3);
    expect(result.finishReason).toBe("max_steps_reached");
  });

  test("Agent Class: initializes from manifest and configures L, I, and A correctly", () => {
    const manifest = {
      L: "sarvam/glm5.3",
      I: { memory: "sessions/demo-agent" },
      A: {
        name: "sarvam_coder",
        version: "2.1.0",
        intent: "Autonomous Coding Assistant",
        maxSteps: 7
      },
      T: ["fetch"],
      E: { SARVAM_API_KEY: "test-key" }
    };

    const agent = new Agent({ manifest });
    expect(agent.name).toBe("sarvam_coder");
    expect(agent.version).toBe("2.1.0");
    expect(agent.intent).toBe("Autonomous Coding Assistant");

    const ctx = agent.getContext();
    expect(ctx.agentName).toBe("sarvam_coder");
    expect(ctx.agentVersion).toBe("2.1.0");
    expect(ctx.sessionId).toBe("demo-agent");
  });
});
