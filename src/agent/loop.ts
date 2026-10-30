import type { AgentTool, AgentContext, AgentStep, AgentRunResult, AgentExecutionOptions, ToolCall, ToolResult } from "./types";
import type { MemoryProvider, AgentMessage } from "../integration/types";
import type { SarvamMessage, SarvamChatResponse } from "../llm/sarvam";

export interface LLMFunctionCaller {
  chat(messages: SarvamMessage[], options?: any): Promise<SarvamChatResponse & { toolCalls?: ToolCall[] }>;
}

export class ReActLoop {
  public static async execute(
    userInput: string,
    llm: LLMFunctionCaller,
    memory: MemoryProvider,
    tools: AgentTool[] = [],
    context: AgentContext,
    options: AgentExecutionOptions = {}
  ): Promise<AgentRunResult> {
    const startTime = Date.now();
    const maxSteps = options.maxSteps ?? 10;
    const steps: AgentStep[] = [];
    const toolMap = new Map<string, AgentTool>(tools.map(t => [t.name, t]));

    // 1. Append user input to session memory
    await memory.append({
      role: "user",
      content: userInput,
      timestamp: startTime
    });

    let currentStep = 1;
    let finalOutput = "";
    let finalThought: string | undefined = undefined;
    let finishReason: "stop" | "max_steps_reached" | "error" = "max_steps_reached";
    let usedModel = "unknown";

    // Build system message incorporating Intent, Name, and Version
    const systemInstruction = options.systemPrompt ??
      `You are ${context.agentName} (v${context.agentVersion}).
Your mission and intent: ${context.state.intent || "Autonomous AI Agent"}.
Follow the ReAct methodology: Reason about the user's request, select tools if needed, observe outputs, and provide a clear final answer.`;

    while (currentStep <= maxSteps) {
      const stepStartTime = Date.now();

      // Retrieve full history from memory
      const conversationHistory = memory.getMessages().map(m => ({
        role: m.role as "system" | "user" | "assistant",
        content: m.content
      }));

      const messages: SarvamMessage[] = [
        { role: "system", content: systemInstruction },
        ...conversationHistory
      ];

      // Query LLM
      const response = await llm.chat(messages, {
        temperature: options.temperature ?? 0.2
      });

      usedModel = response.model || usedModel;
      const thought = response.reasoningContent;
      if (thought) {
        finalThought = thought;
      }

      // Check if LLM requested tool calling
      const requestedToolCalls: ToolCall[] = response.toolCalls || [];

      if (requestedToolCalls.length > 0) {
        const stepResults: ToolResult[] = [];

        for (const tc of requestedToolCalls) {
          const tool = toolMap.get(tc.name);
          let resultStr: string;

          if (!tool) {
            resultStr = `Error: Tool '${tc.name}' not found. Available tools: ${Array.from(toolMap.keys()).join(", ")}`;
          } else {
            try {
              const res = await tool.execute(tc.arguments, context);
              resultStr = typeof res === "string" ? res : JSON.stringify(res);
            } catch (err: any) {
              resultStr = `Error executing tool '${tc.name}': ${err.message}`;
            }
          }

          stepResults.push({
            toolCallId: tc.id,
            toolName: tc.name,
            result: resultStr
          });

          // Append tool observation to memory for subsequent turns
          await memory.append({
            role: "tool",
            name: tc.name,
            toolCallId: tc.id,
            content: resultStr,
            timestamp: Date.now()
          });
        }

        steps.push({
          step: currentStep,
          thought,
          toolCalls: requestedToolCalls,
          toolResults: stepResults,
          timestamp: stepStartTime
        });

        currentStep++;
      } else {
        // No tool calls - LLM produced final text answer
        finalOutput = response.text;
        finishReason = "stop";

        steps.push({
          step: currentStep,
          thought,
          output: finalOutput,
          timestamp: stepStartTime
        });

        // Append final assistant response to memory
        await memory.append({
          role: "assistant",
          content: finalOutput,
          reasoningContent: thought,
          timestamp: Date.now()
        });

        break;
      }
    }

    return {
      text: finalOutput,
      thought: finalThought,
      steps,
      totalSteps: steps.length,
      model: usedModel,
      durationMs: Date.now() - startTime,
      finishReason
    };
  }
}
