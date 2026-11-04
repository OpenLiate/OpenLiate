import { normalizeModelConfig } from "./config";
import { SarvamClient, type SarvamMessage, type SarvamChatResponse } from "./sarvam";
import type { ModelConfig } from "../../core/types";

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
        usage: response.usage ? {
          promptTokens: response.usage.promptTokens,
          completionTokens: response.usage.completionTokens,
          totalTokens: response.usage.totalTokens
        } : undefined
      };
    }

    if (normalized.provider === "neon") {
      // Neon AI Gateway — branch-scoped endpoint, unique per Neon project
      // Set NEON_AI_GATEWAY_BASE_URL to your branch URL:
      // https://<branch-id>-api.ai.<cell>.<region>.aws.neon.tech
      const neonToken = environment?.NEON_AI_GATEWAY_TOKEN || process.env.NEON_AI_GATEWAY_TOKEN;
      const neonBaseUrl = normalized.endpoint || environment?.NEON_AI_GATEWAY_BASE_URL || process.env.NEON_AI_GATEWAY_BASE_URL;

      if (!neonBaseUrl) {
        throw new Error("NEON_AI_GATEWAY_BASE_URL is not set. Set it to your Neon branch gateway URL: https://<branch-id>-api.ai.<cell>.<region>.aws.neon.tech");
      }

      if (!neonToken) {
        throw new Error("NEON_AI_GATEWAY_TOKEN is not set. Set it to your Neon branch-scoped token: nt_live_...");
      }

      const response = await fetch(`${neonBaseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${neonToken}`
        },
        body: JSON.stringify({
          model: normalized.model,
          messages,
          temperature: normalized.temperature,
          max_tokens: normalized.maxTokens
        })
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`Neon AI Gateway error (${response.status}): ${err}`);
      }

      const data = await response.json() as any;
      const text = data.choices?.[0]?.message?.content ?? "";

      return {
        text,
        provider: "neon",
        model: normalized.model,
        durationMs: performance.now() - start,
        usage: data.usage ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens
        } : undefined
      };
    }

    throw new Error(`Provider [${normalized.provider}] is not supported. OpenLiate runs on Sarvam AI and Neon AI Gateway only.`);
  }
}
