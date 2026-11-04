/**
 * OpenLiate Catalog — Sarvam AI Token Factory LLM Client
 * Native /v2 API client with tool-calling, switchable reasoning, and streaming.
 */

import { ConfigManager } from "../../core/config";
import { DEFAULT_SARVAM_LLM, SARVAM_MODELS } from "./models";

export interface SarvamMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string;
  tool_call_id?: string;
}

export interface SarvamToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, any>;
  };
}

export interface SarvamCompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: SarvamToolDefinition[];
  systemPrompt?: string;
  stream?: boolean;
}

export interface SarvamToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface SarvamCompletionResult {
  text: string;
  thought?: string;
  model: string;
  toolCalls?: SarvamToolCall[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export class SarvamLlmClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey?: string, baseUrl: string = "https://api.sarvam.ai/v2") {
    this.apiKey = apiKey || process.env.SARVAM_API_KEY || ConfigManager.getKey("SARVAM_API_KEY") || "";
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  public getModelMetadata(modelId: string) {
    return SARVAM_MODELS[modelId] || null;
  }

  /**
   * Executes a chat completion against Sarvam Token Factory
   */
  public async chat(
    messages: SarvamMessage[],
    options: SarvamCompletionOptions = {}
  ): Promise<SarvamCompletionResult> {
    if (!this.apiKey) {
      this.apiKey = process.env.SARVAM_API_KEY || ConfigManager.getKey("SARVAM_API_KEY") || "";
    }

    if (!this.apiKey) {
      throw new Error(
        "Missing SARVAM_API_KEY. Run 'openliate join' or 'openliate env set SARVAM_API_KEY=\"sk_live_...\"' to configure your sovereign key."
      );
    }

    const model = options.model || DEFAULT_SARVAM_LLM;
    const finalMessages = [...messages];

    if (options.systemPrompt && !finalMessages.some(m => m.role === "system")) {
      finalMessages.unshift({ role: "system", content: options.systemPrompt });
    }

    const payload: Record<string, any> = {
      model,
      messages: finalMessages,
      temperature: options.temperature ?? 0.2,
      max_tokens: options.maxTokens ?? 2048
    };

    if (options.tools && options.tools.length > 0) {
      payload.tools = options.tools;
      payload.tool_choice = "auto";
    }

    const endpoint = `${this.baseUrl}/chat/completions`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-subscription-key": this.apiKey,
        "Authorization": `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      let parsedMessage = errText;
      try {
        const errJson = JSON.parse(errText);
        parsedMessage = errJson.message || errJson.error || errText;
      } catch {}
      throw new Error(`Sarvam AI API Error (${response.status}): ${parsedMessage}`);
    }

    const data = await response.json();
    const choice = data.choices?.[0];
    const message = choice?.message || {};

    let rawText = message.content || "";
    let thought: string | undefined;

    // Parse switchable reasoning tags (<thought>...</thought>)
    const thoughtMatch = rawText.match(/<thought>([\s\S]*?)<\/thought>/);
    if (thoughtMatch) {
      thought = thoughtMatch[1].trim();
      rawText = rawText.replace(/<thought>[\s\S]*?<\/thought>/, "").trim();
    }

    let toolCalls: SarvamToolCall[] | undefined;
    if (message.tool_calls && Array.isArray(message.tool_calls)) {
      toolCalls = message.tool_calls;
    }

    return {
      text: rawText,
      thought,
      model: data.model || model,
      toolCalls,
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens
      } : undefined
    };
  }
}

