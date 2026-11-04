/**
 * OpenLiate Catalog — Sarvam AI Vision & Document Intelligence
 * OCR, Table Extraction, and Structured Field Parsing for Indian Documents.
 */

import { ConfigManager } from "../../core/config";

export interface SarvamVisionOptions {
  imageBase64?: string;
  imageUrl?: string;
  documentType?: "invoice" | "aadhaar" | "pan" | "general";
}

export interface SarvamVisionResult {
  text: string;
  tables?: Array<Record<string, any>>;
  fields?: Record<string, any>;
  confidence?: number;
}

export class SarvamVision {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey?: string, baseUrl: string = "https://api.sarvam.ai") {
    this.apiKey = apiKey || process.env.SARVAM_API_KEY || ConfigManager.getKey("SARVAM_API_KEY") || "";
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  /**
   * Extracts text, tables, and structured data from an image or document
   */
  public async extract(options: SarvamVisionOptions): Promise<SarvamVisionResult> {
    if (!this.apiKey) {
      this.apiKey = process.env.SARVAM_API_KEY || ConfigManager.getKey("SARVAM_API_KEY") || "";
    }

    if (!this.apiKey) {
      throw new Error("Missing SARVAM_API_KEY for Sarvam Vision.");
    }

    const endpoint = `${this.baseUrl}/vision/extract`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-subscription-key": this.apiKey,
        "Authorization": `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        image: options.imageBase64,
        image_url: options.imageUrl,
        doc_type: options.documentType || "general"
      })
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Sarvam Vision Error (${response.status}): ${err}`);
    }

    const data = await response.json();
    return {
      text: data.text || "",
      tables: data.tables,
      fields: data.fields,
      confidence: data.confidence
    };
  }
}

