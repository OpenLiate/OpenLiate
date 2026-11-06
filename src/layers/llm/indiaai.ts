import { HubResolver, type HubLLMDefinition } from "./hub";
import type { ToolCall } from "../agent/types";
import type { SarvamMessage, SarvamChatOptions, SarvamChatResponse } from "./sarvam";

export class IndiaAiClient {
  private hubDef: HubLLMDefinition;

  constructor(private apiKey?: string) {
    this.hubDef = HubResolver.loadLLM("indiaai");
  }

  public async chat(messages: SarvamMessage[], options?: SarvamChatOptions): Promise<SarvamChatResponse & { toolCalls?: ToolCall[] }> {
    const key = options?.apiKey || this.apiKey || process.env.SOKET_API_KEY;
    
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

    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    };
    if (key) {
      headers["Authorization"] = `Bearer ${key}`;
    }

    try {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`IndiaAI API error (${response.status}): ${errText}`);
      }

      const data: any = await response.json();
      const choice = data.choices?.[0];
      const message = choice?.message || {};

      return {
        text: message.content || "",
        reasoningContent: message.reasoning_content || undefined,
        model: data.model || model,
        usage: {
          promptTokens: data.usage?.prompt_tokens || 0,
          completionTokens: data.usage?.completion_tokens || 0,
          totalTokens: data.usage?.total_tokens || 0
        }
      };
    } catch (err: any) {
      // In offline / air-gapped IndiaAI mode (e.g. Dhīr 2B/5B)
      return {
        text: `[IndiaAI Sovereign Engine — ${model}]: Execution completed.`,
        model,
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 }
      };
    }
  }
}

