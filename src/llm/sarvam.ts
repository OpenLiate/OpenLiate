import { HubResolver, type HubLLMDefinition } from "./hub";

export interface SarvamMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface SarvamChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  reasoningEffort?: "none" | "low" | "high" | "max";
  apiKey?: string;
  endpoint?: string;
}

export interface SarvamChatResponse {
  text: string;
  reasoningContent?: string;
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

    const model = options?.model || this.hubDef.default_model;
    const url = options?.endpoint || this.hubDef.endpoint;

    const payload: Record<string, any> = {
      model,
      messages,
      temperature: options?.temperature ?? 0.2,
      max_tokens: options?.maxTokens ?? 2048
    };

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

    return {
      text: message.content || "",
      reasoningContent: message.reasoning_content || message.reasoning || undefined,
      model: data.model || model,
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0
      }
    };
  }
}
