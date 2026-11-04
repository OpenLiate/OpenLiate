/**
 * OpenLiate Catalog — OmniRoute Multi-Provider Gateway Client
 * Native connection to 'cheaper-inference/OmniRoute' (http://localhost:20128/v1 or https://api.omniroute.online/v1)
 */

import { ConfigManager } from "../../core/config";
import {
  DEFAULT_OMNIROUTE_MODEL,
  OMNIROUTE_DEFAULT_LOCAL_URL,
  OMNIROUTE_DEFAULT_REMOTE_URL,
  OMNIROUTE_MODELS,
  type OmniRouteModelMetadata
} from "./models";

export interface OmniRouteChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: any[];
  systemPrompt?: string;
  compression?: "rtk" | "caveman" | "none";
}

export interface OmniRouteChatResult {
  text: string;
  model: string;
  provider?: string;
  toolCalls?: any[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export class OmniRouteGatewayClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(apiKey?: string, customBaseUrl?: string) {
    this.apiKey =
      apiKey ||
      process.env.OMNIROUTE_API_KEY ||
      ConfigManager.getKey("OMNIROUTE_API_KEY") ||
      "";

    this.baseUrl = (
      customBaseUrl ||
      process.env.OMNIROUTE_URL ||
      process.env.OMNIROUTE_BASE_URL ||
      OMNIROUTE_DEFAULT_LOCAL_URL
    ).replace(/\/+$/, "");
  }

  /**
   * Checks if a local OmniRoute proxy daemon is running on port 20128
   */
  public async isLocalRunning(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 300);
      const res = await fetch(`${OMNIROUTE_DEFAULT_LOCAL_URL}/models`, {
        signal: controller.signal
      });
      clearTimeout(timeout);
      return res.ok;
    } catch {
      return false;
    }
  }

  public getModel(modelId: string): OmniRouteModelMetadata {
    if (OMNIROUTE_MODELS[modelId]) {
      return OMNIROUTE_MODELS[modelId];
    }
    return {
      id: modelId,
      name: modelId,
      providerStrategy: "auto-fallback",
      contextWindow: 128000,
      description: `OmniRoute dynamic model: ${modelId}`
    };
  }

  /**
   * Fetches the live model catalog from the running OmniRoute gateway port (20128).
   * Falls back gracefully to the core free pool if gateway is offline.
   */
  public async listModels(): Promise<OmniRouteModelMetadata[]> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1000);
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (this.apiKey) {
        headers["Authorization"] = `Bearer ${this.apiKey}`;
      }
      const res = await fetch(`${this.baseUrl}/models`, {
        headers,
        signal: controller.signal
      });
      clearTimeout(timeout);
      if (res.ok) {
        const body = (await res.json()) as any;
        const rawList = Array.isArray(body?.data) ? body.data : Array.isArray(body) ? body : [];
        if (rawList.length > 0) {
          const dynamicList: OmniRouteModelMetadata[] = rawList.map((m: any) => ({
            id: m.id || m.modelId || m.name,
            name: m.name || m.id || "OmniRoute Model",
            providerStrategy: "auto-fallback",
            contextWindow: m.context_window || m.contextWindow || 128000,
            description: m.description || `Live model from OmniRoute gateway (${m.owned_by || m.provider || "omniroute"})`
          }));

          const hasAuto = dynamicList.some(m => m.id === "auto" || m.id === "auto-free");
          if (!hasAuto) {
            dynamicList.unshift(
              {
                id: "auto",
                name: "OmniRoute Auto Router",
                providerStrategy: "auto-fallback",
                contextWindow: 128000,
                description: "Adaptive task-based routing across 380+ providers"
              },
              OMNIROUTE_MODELS["auto-free"]
            );
          }
          return dynamicList;
        }
      }
    } catch {
      // Gateway offline or unauthenticated — fall back to core free models
    }
    return Object.values(OMNIROUTE_MODELS);
  }

  public listModelsSync(): OmniRouteModelMetadata[] {
    return Object.values(OMNIROUTE_MODELS);
  }

  /**
   * Dispatches chat completion through OmniRoute's auto-router with failover
   */
  public async chat(
    messages: Array<{ role: string; content: string; name?: string }>,
    options: OmniRouteChatOptions = {}
  ): Promise<OmniRouteChatResult> {
    const model = options.model || DEFAULT_OMNIROUTE_MODEL;
    const finalMessages = [...messages];

    if (options.systemPrompt && !finalMessages.some((m) => m.role === "system")) {
      finalMessages.unshift({ role: "system", content: options.systemPrompt });
    }

    const payload: any = {
      model,
      messages: finalMessages,
      temperature: options.temperature ?? 0.3,
      max_tokens: options.maxTokens ?? 2048,
    };

    if (options.tools && options.tools.length > 0) {
      payload.tools = options.tools;
      payload.tool_choice = "auto";
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    if (options.compression && options.compression !== "none") {
      headers["x-omniroute-compression"] = options.compression;
    }

    const endpoint = `${this.baseUrl}/chat/completions`;
    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(payload)
      });
    } catch (networkErr: any) {
      if (this.baseUrl === OMNIROUTE_DEFAULT_LOCAL_URL) {
        throw new Error(
          `[OmniRoute] Gateway is not running on ${OMNIROUTE_DEFAULT_LOCAL_URL}. Start the engine with: openliate serve (or pass custom OMNIROUTE_URL). Details: ${networkErr.message}`
        );
      }
      throw new Error(`[OmniRoute] Failed to connect to ${endpoint}: ${networkErr.message}`);
    }

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OmniRoute Gateway Error (${response.status}): ${err}`);
    }

    const data = await response.json();
    const choice = data.choices?.[0];
    const message = choice?.message || {};

    return {
      text: message.content || "",
      model: data.model || model,
      provider: data.provider || "omniroute-auto",
      toolCalls: message.tool_calls,
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens
      } : undefined
    };
  }
}
