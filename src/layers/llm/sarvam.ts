import { HubResolver, type HubLLMDefinition } from "./hub";
import type { ToolCall } from "../agent/types";

export interface SarvamMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: any[];
}

export interface SarvamChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  reasoningEffort?: "none" | "low" | "high" | "max";
  apiKey?: string;
  endpoint?: string;
  tools?: any[];
  toolChoice?: string | object;
}

export interface SarvamChatResponse {
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

export class SarvamClient {
  private hubDef: HubLLMDefinition;

  constructor(private apiKey?: string) {
    this.hubDef = HubResolver.loadLLM("sarvam");
  }

  public async chat(messages: SarvamMessage[], options?: SarvamChatOptions): Promise<SarvamChatResponse> {
    const key = options?.apiKey || this.apiKey || process.env.SARVAM_API_KEY;
    if (!key) {
      throw new Error("Missing SARVAM_API_KEY. Please provide it via options or environment variable.");
    }

    let model = options?.model || this.hubDef.default_model;
    if (model.includes("/")) {
      model = model.split("/").pop() || model;
    }
    const url = options?.endpoint || this.hubDef.endpoint;

    const payload: Record<string, any> = {
      model,
      messages: messages.map(m => {
        const item: Record<string, any> = {
          role: m.role,
          content: m.content
        };
        if (m.name) item.name = m.name;
        if (m.tool_call_id) item.tool_call_id = m.tool_call_id;
        if (m.tool_calls) item.tool_calls = m.tool_calls;
        return item;
      }),
      temperature: options?.temperature ?? 0.2,
      max_tokens: options?.maxTokens ?? 2048
    };

    if (options?.tools && options.tools.length > 0) {
      payload.tools = options.tools;
      if (options.toolChoice) {
        payload.tool_choice = options.toolChoice;
      }
    }

    if (options?.reasoningEffort) {
      payload.reasoning_effort = options.reasoningEffort;
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-subscription-key": key,
        "Authorization": `Bearer ${key}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Sarvam API /v2 error (${response.status}): ${errText}`);
    }

    const data: any = await response.json();
    const choice = data.choices?.[0];
    const message = choice?.message || {};

    const rawToolCalls = message.tool_calls;
    let toolCalls: ToolCall[] | undefined = undefined;

    if (Array.isArray(rawToolCalls) && rawToolCalls.length > 0) {
      toolCalls = rawToolCalls.map((tc: any) => {
        let parsedArgs: Record<string, any> = {};
        if (typeof tc.function?.arguments === "string") {
          try {
            parsedArgs = JSON.parse(tc.function.arguments);
          } catch {
            parsedArgs = { raw: tc.function.arguments };
          }
        } else if (typeof tc.function?.arguments === "object") {
          parsedArgs = tc.function.arguments;
        }

        return {
          id: tc.id || `call_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          name: tc.function?.name || tc.name,
          arguments: parsedArgs
        };
      });
    }

    return {
      text: message.content || "",
      reasoningContent: message.reasoning_content || message.reasoning || undefined,
      toolCalls,
      model: data.model || model,
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0
      }
    };
  }
}
