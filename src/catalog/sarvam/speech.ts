/**
 * OpenLiate Catalog — Sarvam AI Speech Tools
 * - Bulbul v4 Flash (Text-to-Speech: 200+ voices, 11 languages, pace, pitch, loudness)
 * - Saaras v4 (Speech-to-Text: 23 languages, diarization, auto language detect)
 */

import { ConfigManager } from "../../core/config";

export interface BulbulTtsOptions {
  inputs: string[];
  targetLanguageCode?: string; // e.g. "hi-IN", "en-IN", "ta-IN", "te-IN", "kn-IN", "bn-IN", "mr-IN", "gu-IN", "ml-IN", "pa-IN", "or-IN"
  speaker?: string;           // e.g. "meera", "pavithra", "mahesh", "arvind", "amartya"
  pitch?: number;             // -20 to 20
  pace?: number;              // 0.5 to 2.0
  loudness?: number;          // -20 to 20
  speechSampleRate?: number;  // 8000, 16000, 22050, 44100
  enablePreprocessing?: boolean;
  model?: "bulbul:v1" | "bulbul:v2" | "bulbul-v4-flash";
}

export interface BulbulTtsResponse {
  audios: string[]; // Base64 encoded WAV audio strings
}

export interface SaarasSttOptions {
  audioBase64?: string;
  audioUrl?: string;
  languageCode?: string;      // "hi-IN", "en-IN", or "unknown" for auto-detect
  model?: "saaras:v1" | "saaras:v2" | "saaras-v4";
  withDiarization?: boolean;
}

export interface SaarasSttResponse {
  transcript: string;
  languageCode?: string;
  diarizedTranscript?: Array<{
    speaker: string;
    transcript: string;
    start: number;
    end: number;
  }>;
}

export class SarvamSpeech {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey?: string, baseUrl: string = "https://api.sarvam.ai") {
    this.apiKey = apiKey || process.env.SARVAM_API_KEY || ConfigManager.getKey("SARVAM_API_KEY") || "";
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  /**
   * Bulbul v4 Flash: Converts text into high-fidelity Indic spoken audio
   */
  public async textToSpeech(options: BulbulTtsOptions): Promise<BulbulTtsResponse> {
    if (!this.apiKey) {
      this.apiKey = process.env.SARVAM_API_KEY || ConfigManager.getKey("SARVAM_API_KEY") || "";
    }

    if (!this.apiKey) {
      throw new Error("Missing SARVAM_API_KEY for Bulbul TTS.");
    }

    const payload = {
      inputs: options.inputs,
      target_language_code: options.targetLanguageCode || "hi-IN",
      speaker: options.speaker || "meera",
      pitch: options.pitch ?? 0,
      pace: options.pace ?? 1.0,
      loudness: options.loudness ?? 1.0,
      speech_sample_rate: options.speechSampleRate ?? 22050,
      enable_preprocessing: options.enablePreprocessing ?? true,
      model: options.model || "bulbul-v4-flash"
    };

    const endpoint = `${this.baseUrl}/text-to-speech`;
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
      throw new Error(`Bulbul TTS Error (${response.status}): ${err}`);
    }

    const data = await response.json();
    return {
      audios: data.audios || []
    };
  }

  /**
   * Saaras v4: Transcribes spoken audio into text with speaker diarization across 23 languages
   */
  public async speechToText(options: SaarasSttOptions): Promise<SaarasSttResponse> {
    if (!this.apiKey) {
      this.apiKey = process.env.SARVAM_API_KEY || ConfigManager.getKey("SARVAM_API_KEY") || "";
    }

    if (!this.apiKey) {
      throw new Error("Missing SARVAM_API_KEY for Saaras STT.");
    }

    const endpoint = `${this.baseUrl}/speech-to-text`;
    
    // Support multipart form-data or JSON payload
    let body: any;
    let headers: Record<string, string> = {
      "api-subscription-key": this.apiKey,
      "Authorization": `Bearer ${this.apiKey}`
    };

    if (options.audioBase64) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify({
        audio: options.audioBase64,
        language_code: options.languageCode || "unknown",
        model: options.model || "saaras-v4",
        with_diarization: options.withDiarization ?? false
      });
    } else {
      throw new Error("Saaras STT requires audioBase64 string.");
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Saaras STT Error (${response.status}): ${err}`);
    }

    const data = await response.json();
    return {
      transcript: data.transcript || "",
      languageCode: data.language_code,
      diarizedTranscript: data.diarized_transcript?.entries
    };
  }
}

