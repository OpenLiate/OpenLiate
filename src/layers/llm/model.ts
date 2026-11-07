/**
 * OpenLiate — Layer [L]: Universal Large Models Layer
 * Single OpenAI-Compatible Model Gateway
 * 
 * Supports all OpenAI-compatible endpoints:
 * - Sarvam AI (sarvam-2b, sarvam-105b, GLM)
 * - Neon AI Gateway (Serverless Branch-Scoped Models)
 * - OpenAI / Groq / Cerebras / OpenRouter / Ollama / DeepSeek
 * 
 * Zero hardcoded models: the model passed in Layer [L] is passed directly to the provider.
 */

import type { ToolCall } from "../agent/types";
import type { ModelConfig } from "../../core/spec";
import { resilientFetch } from "../../core/fetch.js";

export type LlmRole = "system" | "user" | "assistant" | "tool";

export interface LlmMessage {
  role: LlmRole;
  content: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: any[];
}

export type SarvamMessage = LlmMessage;
export type LLMMessage = LlmMessage;

export interface LlmChatOptions {
  model?: string;
  provider?: string;
  temperature?: number;
  maxTokens?: number;
  reasoningEffort?: "none" | "low" | "high" | "max";
  apiKey?: string;
  endpoint?: string;
  baseUrl?: string;
  tools?: any[];
  toolChoice?: string | object;
  systemPrompt?: string;
}

export type SarvamChatOptions = LlmChatOptions;

export interface LlmChatResponse {
  text: string;
  reasoningContent?: string;
  toolCalls?: ToolCall[];
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export type SarvamChatResponse = LlmChatResponse;

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

export interface HubLLMDefinition {
  name: string;
  provider: string;
  version: string;
  base_url: string;
  endpoint: string;
  models_endpoint?: string;
  systemone_endpoint?: string;
  headers: Record<string, string>;
  features: {
    tool_calling: boolean;
    streaming: boolean;
    reasoning: boolean;
    system_one_decisions?: boolean;
  };
}

export class HubResolver {
  public static getBuiltinGateways(): Record<string, HubLLMDefinition> {
    const rawNeon = (typeof process !== "undefined" && process.env?.NEON_AI_GATEWAY_BASE_URL)
      ? process.env.NEON_AI_GATEWAY_BASE_URL.replace(/\/+$/, "")
      : "https://api.ai.neon.tech/v1";
    const neonBaseUrl = rawNeon.endsWith("/v1") ? rawNeon : `${rawNeon}/v1`;

    return {
      sarvam: {
        name: "sarvam",
        provider: "sarvam",
        version: "v2",
        base_url: "https://api.sarvam.ai/v2",
        endpoint: "https://api.sarvam.ai/v2/chat/completions",
        models_endpoint: "https://api.sarvam.ai/v2/models",
        systemone_endpoint: "https://api.sarvam.ai/v2/systemone",
        headers: {
          "api-subscription-key": "$SARVAM_API_KEY",
          "Authorization": "Bearer $SARVAM_API_KEY",
          "Content-Type": "application/json"
        },
        features: {
          tool_calling: true,
          streaming: true,
          reasoning: true,
          system_one_decisions: true
        }
      },
      neon: {
        name: "neon",
        provider: "neon",
        version: "v1",
        base_url: neonBaseUrl,
        endpoint: `${neonBaseUrl}/chat/completions`,
        models_endpoint: `${neonBaseUrl}/models`,
        headers: {
          "Authorization": "Bearer $NEON_AI_GATEWAY_TOKEN",
          "Content-Type": "application/json"
        },
        features: {
          tool_calling: true,
          streaming: true,
          reasoning: true
        }
      }
    };
  }

  public static loadLLM(providerName: string): HubLLMDefinition {
    const builtins = this.getBuiltinGateways();
    const key = providerName.toLowerCase();
    if (builtins[key]) {
      return builtins[key];
    }

    // Default dynamic OpenAI-compatible gateway
    return {
      name: providerName,
      provider: providerName,
      version: "v1",
      base_url: "https://api.openai.com/v1",
      endpoint: "https://api.openai.com/v1/chat/completions",
      models_endpoint: "https://api.openai.com/v1/models",
      headers: {
        "Authorization": `Bearer $${providerName.toUpperCase()}_API_KEY`,
        "Content-Type": "application/json"
      },
      features: {
        tool_calling: true,
        streaming: true,
        reasoning: true
      }
    };
  }
}

export interface NormalizedModel {
  provider: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  endpoint?: string;
}

export function normalizeModelConfig(input?: string | ModelConfig): NormalizedModel {
  if (!input) {
    throw new Error("Missing required Layer [L] model definition. Specify model string (e.g. 'sarvam/sarvam-105b' or 'neon/claude-sonnet-4-6').");
  }

  if (typeof input === "string") {
    const trimmed = input.trim();
    if (!trimmed) {
      throw new Error("Missing required Layer [L] model definition. Specify model string (e.g. 'sarvam/sarvam-105b' or 'neon/claude-sonnet-4-6').");
    }

    if (trimmed.includes("/")) {
      const parts = trimmed.split("/");
      return {
        provider: parts[0].toLowerCase(),
        model: parts.slice(1).join("/")
      };
    }

    if (trimmed.includes(":")) {
      const parts = trimmed.split(":");
      return {
        provider: parts[0].toLowerCase(),
        model: parts.slice(1).join(":")
      };
    }

    const isNeonModel = trimmed.startsWith("claude") || trimmed.startsWith("gpt") || trimmed.startsWith("gemini");
    return {
      provider: isNeonModel ? "neon" : "sarvam",
      model: trimmed
    };
  }

  let providerStr = input.provider;
  let modelStr = input.model;

  if (!providerStr && modelStr && (modelStr.includes("/") || modelStr.includes(":"))) {
    const sep = modelStr.includes("/") ? "/" : ":";
    const parts = modelStr.split(sep);
    providerStr = parts[0];
    modelStr = parts.slice(1).join(sep);
  }

  if (!modelStr) {
    throw new Error("Missing required Layer [L] model. Specify a model property (e.g. 'sarvam-105b').");
  }

  const isNeonModel = modelStr.startsWith("claude") || modelStr.startsWith("gpt") || modelStr.startsWith("gemini");
  return {
    provider: (providerStr || (isNeonModel ? "neon" : "sarvam")).toLowerCase(),
    model: modelStr,
    temperature: input.temperature,
    maxTokens: input.maxTokens,
    endpoint: (input as any).endpoint || input.baseUrl
  };
}

/**
 * Universal OpenAI-Compatible Client
 * Handles Sarvam AI, Neon AI Gateway, OpenAI, Groq, OpenRouter, and Ollama.
 */
export class UniversalLlmClient {
  constructor(private apiKey?: string, private options?: { endpoint?: string; provider?: string }) {}

  public async chat(messages: LlmMessage[], options?: LlmChatOptions): Promise<LlmChatResponse> {
    const provider = (options?.endpoint || this.options?.endpoint)
      ? "custom"
      : (options?.provider?.toLowerCase()
          || this.options?.provider?.toLowerCase()
          || (options?.model?.includes("/") ? options.model.split("/")[0].toLowerCase() : undefined)
          || (options?.model?.includes("claude") || options?.model?.includes("gpt") || options?.model?.includes("gemini") ? "neon" : "sarvam"));

    let model = options?.model;
    if (model && (model.includes("/") || model.includes(":"))) {
      const sep = model.includes("/") ? "/" : ":";
      model = model.split(sep).slice(1).join(sep);
    }
    if (!model) {
      throw new Error("Missing required Layer [L] model: specify a model (e.g. 'sarvam-105b' or 'claude-sonnet-4-6').");
    }

    // Resolve API Key
    let key = options?.apiKey || this.apiKey;
    if (!key) {
      if (provider === "neon") {
        key = process.env.NEON_AI_GATEWAY_TOKEN;
      } else {
        key = process.env.SARVAM_API_KEY || process.env.OPENAI_API_KEY;
      }
    }

    // Resolve Endpoint URL
    let url = options?.endpoint || options?.baseUrl || this.options?.endpoint;
    if (!url) {
      if (provider === "neon") {
        const raw = process.env.NEON_AI_GATEWAY_BASE_URL || "https://api.ai.neon.tech/v1";
        const base = raw.replace(/\/+$/, "");
        const v1Base = base.endsWith("/v1") ? base : `${base}/v1`;
        url = `${v1Base}/chat/completions`;
      } else {
        const hub = HubResolver.loadLLM("sarvam");
        url = hub.endpoint || "https://api.sarvam.ai/v2/chat/completions";
      }
    }

    // High-speed System-1 Decision routing for Sarvam Prism
    if (model.toLowerCase().includes("prism") && (options as any)?.decide) {
      return this.decidePrism(messages, options, key, model);
    }

    const payload: Record<string, any> = {
      model,
      messages: messages.map((m) => {
        const item: Record<string, any> = {
          role: m.role,
          content: m.content
        };
        if (m.name) item.name = m.name;
        if (m.tool_call_id) item.tool_call_id = m.tool_call_id;
        if (m.tool_calls) item.tool_calls = m.tool_calls;
        return item;
      }),
      max_tokens: options?.maxTokens ?? 4096
    };

    if (options?.temperature !== undefined) {
      payload.temperature = options.temperature;
    }

    if (options?.tools && options.tools.length > 0) {
      payload.tools = options.tools;
      if (options.toolChoice) {
        payload.tool_choice = options.toolChoice;
      }
    }

    if (options?.reasoningEffort) {
      payload.reasoning_effort = options.reasoningEffort;
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    };
    if (key) {
      headers["Authorization"] = `Bearer ${key}`;
      headers["api-subscription-key"] = key; // Sarvam AI dual-header compatibility
    }

    const response = await resilientFetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`LLM Gateway error (${response.status}) at ${url}: ${errText}`);
    }

    const data: any = await response.json();
    const choice = data.choices?.[0];

    return {
      text: choice?.message?.content || choice?.message?.reasoning_content || "",
      reasoningContent: choice?.message?.reasoning_content,
      toolCalls: choice?.message?.tool_calls?.map((tc: any) => {
        let args = {};
        try {
          args = typeof tc.function?.arguments === "string" ? JSON.parse(tc.function.arguments) : (tc.function?.arguments || tc.arguments || {});
        } catch {
          args = tc.function?.arguments || tc.arguments || {};
        }
        return {
          id: tc.id || `call_${Date.now()}`,
          name: tc.function?.name || tc.name || "",
          arguments: args
        };
      }),
      model: data.model || model,
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens || data.usage.promptTokens || 0,
        completionTokens: data.usage.completion_tokens || data.usage.completionTokens || 0,
        totalTokens: data.usage.total_tokens || data.usage.totalTokens || 0
      } : undefined
    };
  }

  private async decidePrism(messages: LlmMessage[], options: any, key?: string, model?: string): Promise<LlmChatResponse> {
    const hub = HubResolver.loadLLM("sarvam");
    const sysOneUrl = hub.systemone_endpoint || "https://api.sarvam.ai/v2/systemone";
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user")?.content || "";
    const systemMsg = messages.find((m) => m.role === "system")?.content;

    const res = await resilientFetch(sysOneUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(key ? { "api-subscription-key": key, "Authorization": `Bearer ${key}` } : {})
      },
      body: JSON.stringify({
        input: lastUserMsg,
        options: {
          decision: {
            type: "choice",
            instructions: systemMsg || "Evaluate the input state and select the appropriate decision.",
            criteria: {
              allow: "Legitimate, safe, and valid request matching normal authorized behavior",
              challenge_mfa: "Suspicious, ambiguous, or requires secondary verification",
              block: "Malicious, invalid, high-risk, credential attack, or fraudulent attempt"
            }
          }
        }
      })
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Prism Decision error (${res.status}): ${err}`);
    }

    const data: any = await res.json();
    const ans = data.answers?.decision || Object.values(data.answers || {})[0];
    const selected = (ans as any)?.choice ? (ans as any).choice.toUpperCase() : "EVALUATED";

    return {
      text: selected,
      model: model || "sarvam-prism",
      usage: data.usage
    };
  }

  public async decide(input: string, options: any, chatOpts?: LlmChatOptions): Promise<any> {
    const hub = HubResolver.loadLLM("sarvam");
    const sysOneUrl = hub.systemone_endpoint || "https://api.sarvam.ai/v2/systemone";
    const key = chatOpts?.apiKey || this.apiKey || process.env.SARVAM_API_KEY;

    const res = await resilientFetch(sysOneUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(key ? { "api-subscription-key": key, "Authorization": `Bearer ${key}` } : {})
      },
      body: JSON.stringify({ input, options })
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Sarvam Decision API error (${res.status}): ${err}`);
    }

    return await res.json();
  }
}

// Canonical Aliases for universal compatibility
export const SarvamClient = UniversalLlmClient;
export const OpenAiClient = UniversalLlmClient;

/**
 * High-level LLMRouter
 */
export class LLMRouter {
  private client: UniversalLlmClient;

  constructor(customApiKey?: string) {
    this.client = new UniversalLlmClient(customApiKey);
  }

  public async complete(
    modelInput: string | ModelConfig,
    messages: LLMMessage[],
    environment?: Record<string, string>
  ): Promise<LLMExecutionResult> {
    const start = performance.now();
    const normalized = normalizeModelConfig(modelInput);
    const apiKey = normalized.provider === "neon"
      ? (environment?.NEON_AI_GATEWAY_TOKEN || process.env.NEON_AI_GATEWAY_TOKEN)
      : (environment?.SARVAM_API_KEY || process.env.SARVAM_API_KEY || environment?.OPENAI_API_KEY || process.env.OPENAI_API_KEY);

    const response = await this.client.chat(messages as LlmMessage[], {
      model: `${normalized.provider}/${normalized.model}`,
      temperature: normalized.temperature,
      maxTokens: normalized.maxTokens,
      apiKey,
      endpoint: normalized.endpoint
    });

    return {
      text: response.text,
      reasoningContent: response.reasoningContent,
      provider: normalized.provider,
      model: response.model,
      durationMs: performance.now() - start,
      usage: response.usage
    };
  }
}
