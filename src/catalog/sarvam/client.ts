/**
 * OpenLiate Catalog — Sarvam AI Real SDK Client
 * Powered directly by the official 'sarvamai' SDK (SarvamAIClient).
 */

import { SarvamAIClient, SarvamAIError } from "sarvamai";
import { ConfigManager } from "../../core/config";
import { DEFAULT_SARVAM_LLM, SARVAM_MODELS, type SarvamModelMetadata } from "./models";

export interface SarvamChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: any[];
  systemPrompt?: string;
  stream?: boolean;
}

export interface SarvamChatResult {
  text: string;
  thought?: string;
  model: string;
  toolCalls?: any[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export class SarvamCatalogClient {
  public readonly raw: SarvamAIClient;
  private apiKey: string;

  constructor(apiKey?: string, options?: SarvamAIClient.Options) {
    this.apiKey = apiKey || process.env.SARVAM_API_KEY || ConfigManager.getKey("SARVAM_API_KEY") || "";
    
    if (!this.apiKey) {
      // In development or when linking, provide clear instruction
      this.apiKey = "";
    }

    this.raw = new SarvamAIClient({
      apiSubscriptionKey: this.apiKey,
      ...options
    });
  }

  public getModel(modelId: string): SarvamModelMetadata | undefined {
    return SARVAM_MODELS[modelId];
  }

  public listModels(): SarvamModelMetadata[] {
    return Object.values(SARVAM_MODELS);
  }

  /**
   * Official Token Factory Chat Completion (/v2)
   */
  public async chat(
    messages: Array<{ role: "system" | "user" | "assistant" | "tool"; content: string; name?: string; tool_call_id?: string }>,
    options: SarvamChatOptions = {}
  ): Promise<SarvamChatResult> {
    if (!this.apiKey) {
      this.apiKey = process.env.SARVAM_API_KEY || ConfigManager.getKey("SARVAM_API_KEY") || "";
      if (!this.apiKey) {
        throw new Error(
          "Missing SARVAM_API_KEY. Run 'openliate join' or 'openliate env set SARVAM_API_KEY=\"sk_live_...\"' to configure your sovereign key."
        );
      }
    }

    const model = options.model || DEFAULT_SARVAM_LLM;
    const finalMessages = [...messages];

    if (options.systemPrompt && !finalMessages.some(m => m.role === "system")) {
      finalMessages.unshift({ role: "system", content: options.systemPrompt });
    }

    const request: any = {
      model,
      messages: finalMessages,
      temperature: options.temperature ?? 0.2,
      max_tokens: options.maxTokens ?? 2048
    };

    if (options.tools && options.tools.length > 0) {
      request.tools = options.tools;
      request.tool_choice = "auto";
    }

    const response = await this.raw.chat.completions(request);

    const choice = (response as any).choices?.[0];
    const message = choice?.message || {};

    let rawText = message.content || "";
    let thought: string | undefined;

    // Switchable reasoning tags (<thought>...</thought>)
    const thoughtMatch = rawText.match(/<thought>([\s\S]*?)<\/thought>/);
    if (thoughtMatch) {
      thought = thoughtMatch[1].trim();
      rawText = rawText.replace(/<thought>[\s\S]*?<\/thought>/, "").trim();
    }

    return {
      text: rawText,
      thought,
      model: (response as any).model || model,
      toolCalls: message.tool_calls,
      usage: (response as any).usage ? {
        promptTokens: (response as any).usage.prompt_tokens,
        completionTokens: (response as any).usage.completion_tokens,
        totalTokens: (response as any).usage.total_tokens
      } : undefined
    };
  }

  /**
   * Bulbul v4 Flash (Text to Speech with 200+ voices)
   */
  public async textToSpeech(text: string, options: { languageCode?: string; speaker?: string; pace?: number; model?: "bulbul:v4-flash" | "bulbul:v3" } = {}) {
    return await this.raw.textToSpeech.convert({
      text,
      language_code: (options.languageCode as any) || "hi-IN",
      speaker: options.speaker || "meera",
      pace: options.pace ?? 1.0,
      model: options.model || "bulbul:v4-flash"
    });
  }

  /**
   * Mayura v1 & Sarvam Translate across 23 languages
   */
  public async translate(input: string, targetLanguageCode: string, sourceLanguageCode: string = "auto") {
    return await this.raw.text.translate({
      input,
      target_language_code: targetLanguageCode as any,
      source_language_code: sourceLanguageCode === "auto" ? undefined : (sourceLanguageCode as any)
    });
  }

  /**
   * Saaras v4 (Speech to Text transcription)
   */
  public async speechToText(file: any, options: { languageCode?: string; model?: string } = {}) {
    return await this.raw.speechToText.transcribe({
      file,
      language_code: options.languageCode as any,
      model: (options.model as any) || "saaras:v2"
    });
  }
}

