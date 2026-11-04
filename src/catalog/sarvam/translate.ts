/**
 * OpenLiate Catalog — Sarvam AI Translation Tools
 * - Mayura v1 & Sarvam Translate across 23 Indic Languages
 */

import { ConfigManager } from "../../core/config";

export interface SarvamTranslateOptions {
  input: string;
  sourceLanguageCode?: string; // e.g. "en-IN", "hi-IN", "auto"
  targetLanguageCode: string; // e.g. "hi-IN", "ta-IN", "te-IN", "kn-IN", "bn-IN", "mr-IN", "gu-IN", "pa-IN", "ml-IN", "or-IN"
  speakerGender?: "Male" | "Female";
  mode?: "formal" | "code-mixed";
  model?: "mayura:v1" | "sarvam-translate-v1";
}

export interface SarvamTranslateResult {
  translatedText: string;
  sourceLanguageCode?: string;
}

export class SarvamTranslate {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey?: string, baseUrl: string = "https://api.sarvam.ai") {
    this.apiKey = apiKey || process.env.SARVAM_API_KEY || ConfigManager.getKey("SARVAM_API_KEY") || "";
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  /**
   * Translates text between English and Indian languages with formal/script control
   */
  public async translate(options: SarvamTranslateOptions): Promise<SarvamTranslateResult> {
    if (!this.apiKey) {
      this.apiKey = process.env.SARVAM_API_KEY || ConfigManager.getKey("SARVAM_API_KEY") || "";
    }

    if (!this.apiKey) {
      throw new Error("Missing SARVAM_API_KEY for Sarvam Translate.");
    }

    const payload = {
      input: options.input,
      source_language_code: options.sourceLanguageCode || "auto",
      target_language_code: options.targetLanguageCode,
      speaker_gender: options.speakerGender || "Male",
      mode: options.mode || "formal",
      model: options.model || "sarvam-translate-v1"
    };

    const endpoint = `${this.baseUrl}/translate`;
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
      const err = await response.text();
      throw new Error(`Sarvam Translate Error (${response.status}): ${err}`);
    }

    const data = await response.json();
    return {
      translatedText: data.translated_text || "",
      sourceLanguageCode: data.source_language_code
    };
  }
}

