import { normalizeModelConfig } from "./config";
import { SarvamClient, type SarvamMessage, type SarvamChatResponse } from "./sarvam";
import type { ModelConfig } from "../core/types";

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMExecutionResult {
  text: string;
  reasoningContent?: string;
  provider: string;
  model: string;
  durationMs: number;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export class LLMRouter {
  private sarvamClient: SarvamClient;

  constructor(private customApiKey?: string) {
    this.sarvamClient = new SarvamClient(customApiKey);
  }

  public async complete(
    modelInput: string | ModelConfig,
    messages: LLMMessage[],
    environment?: Record<string, string>
  ): Promise<LLMExecutionResult> {
    const start = performance.now();
    const normalized = normalizeModelConfig(modelInput);
    const apiKey = environment?.SARVAM_API_KEY || this.customApiKey || process.env.SARVAM_API_KEY;

    if (normalized.provider === "sarvam") {
      const response: SarvamChatResponse = await this.sarvamClient.chat(messages as SarvamMessage[], {
        model: normalized.model,
        temperature: normalized.temperature,
        maxTokens: normalized.maxTokens,
        apiKey,
        endpoint: normalized.endpoint
      });

      return {
        text: response.text,
        reasoningContent: response.reasoningContent,
        provider: "sarvam",
        model: response.model,
        durationMs: performance.now() - start,
        usage: response.usage
      };
    }

    throw new Error(`Provider "${normalized.provider}" is queued for community PR integration.`);
  }
}
