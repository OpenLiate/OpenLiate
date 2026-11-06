/**
 * OpenLiate Catalog — Neon AI Gateway Provider
 * Branch-scoped universal LLM gateway powered by '@neon/ai-sdk-provider'
 */

import { neon, createNeon } from "@neon/ai-sdk-provider";
import { generateText, streamText, type LanguageModel } from "ai";
import type { LLMFunctionCaller } from "../../layers/agent/loop";
import type { SarvamMessage, SarvamChatResponse } from "../../layers/llm/sarvam";

export interface NeonGatewayConfig {
  baseURL?: string;
  apiKey?: string;
}

export class NeonAiGateway implements LLMFunctionCaller {
  private client: ReturnType<typeof createNeon>;

  constructor(config?: NeonGatewayConfig) {
    const baseURL = config?.baseURL || process.env.NEON_AI_GATEWAY_BASE_URL;
    const apiKey = config?.apiKey || process.env.NEON_AI_GATEWAY_TOKEN;

    if (baseURL && apiKey) {
      this.client = createNeon({ baseURL, apiKey });
    } else {
      this.client = neon;
    }
  }

  /**
   * Return a language model instance for the given model ID
   */
  public model(modelId: string): LanguageModel {
    return this.client(modelId) as any;
  }

  /**
   * Quick text generation helper
   */
  public async generate(modelId: string, prompt: string) {
    return generateText({
      model: this.model(modelId),
      prompt,
    });
  }

  /**
   * Quick text streaming helper
   */
  public async stream(modelId: string, prompt: string) {
    return streamText({
      model: this.model(modelId),
      prompt,
    });
  }

  /**
   * Chat implementation conforming to LLMFunctionCaller for ReActLoop
   */
  public async chat(messages: SarvamMessage[], options?: any): Promise<SarvamChatResponse & { toolCalls?: any[] }> {
    let modelId = options?.model || "gpt-5-4-nano";
    if (modelId.includes("/")) {
      modelId = modelId.split("/").pop() || modelId;
    }

    // Convert messages to text prompt or Vercel AI SDK CoreMessages
    const prompt = messages
      .map(m => `${m.role.toUpperCase()}: ${m.content || ""}`)
      .join("\n\n");

    const result = await generateText({
      model: this.model(modelId),
      prompt
    });

    return {
      text: result.text,
      model: modelId,
      usage: {
        promptTokens: (result.usage as any)?.promptTokens || (result.usage as any)?.inputTokens || 0,
        completionTokens: (result.usage as any)?.completionTokens || (result.usage as any)?.outputTokens || 0,
        totalTokens: (result.usage as any)?.totalTokens || 0
      }
    };
  }
}
