import { normalizeModelConfig } from "./config";
import { SarvamClient, type SarvamMessage, type SarvamChatResponse } from "./sarvam";
import { OmniRouteGatewayClient } from "./omniroute/gateway";
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
    tokensSaved?: number;
  };
}

export class LLMRouter {
  private sarvamClient: SarvamClient;
  private omniRoute: OmniRouteGatewayClient;

  constructor(private customApiKey?: string) {
    this.sarvamClient = new SarvamClient(customApiKey);
    this.omniRoute = new OmniRouteGatewayClient();
  }

  public async complete(
    modelInput: string | ModelConfig,
    messages: LLMMessage[],
    environment?: Record<string, string>
  ): Promise<LLMExecutionResult> {
    const start = performance.now();
    const normalized = normalizeModelConfig(modelInput);
    const apiKey = environment?.SARVAM_API_KEY || this.customApiKey || process.env.SARVAM_API_KEY;

    if (normalized.provider === "omniroute") {
      const result = await this.omniRoute.chat(
        messages.map((m) => ({ role: m.role, content: m.content })),
        { model: normalized.model }
      );

      return {
        text: result.text,
        provider: result.provider || "omniroute",
        model: result.model,
        durationMs: performance.now() - start,
        usage: result.usage
          ? {
              promptTokens: result.usage.promptTokens,
              completionTokens: result.usage.completionTokens,
              totalTokens: result.usage.totalTokens,
            }
          : undefined,
      };
    }

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
        usage: response.usage ? {
          promptTokens: response.usage.promptTokens,
          completionTokens: response.usage.completionTokens,
          totalTokens: response.usage.totalTokens
        } : undefined
      };
    }

    throw new Error(`Provider [${normalized.provider}] execution is not implemented yet in sovereign mode.`);
  }
}
