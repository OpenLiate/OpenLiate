import type { ModelConfig } from "../core/types";
import { OMNIROUTE_MODELS } from "./omniroute/models";

export interface NormalizedModel {
  provider: "sarvam" | "omniroute" | "openai" | "anthropic" | "google" | "ollama" | "custom";
  model: string;
  temperature?: number;
  maxTokens?: number;
  endpoint?: string;
}

export function normalizeModelConfig(input: string | ModelConfig): NormalizedModel {
  if (typeof input === "string") {
    const parts = input.split("/");
    if (parts.length === 2) {
      const provider = parts[0].toLowerCase();
      const model = parts[1];
      return {
        provider: mapProvider(provider),
        model
      };
    }
    // auto, auto-free, or any bare model string in OmniRoute catalog → omniroute (the free gateway)
    const lower = input.toLowerCase();
    if (
      lower === "auto" ||
      lower === "auto-free" ||
      lower.startsWith("omniroute") ||
      Boolean(OMNIROUTE_MODELS[lower])
    ) {
      return {
        provider: "omniroute",
        model: input
      };
    }
    return {
      provider: "sarvam",
      model: input
    };
  }

  return {
    provider: mapProvider(input.provider),
    model: input.model,
    temperature: input.temperature,
    maxTokens: input.maxTokens,
    endpoint: input.endpoint
  };
}

function mapProvider(provider: string): NormalizedModel["provider"] {
  const p = provider.toLowerCase();
  if (p === "omniroute") return "omniroute";
  if (p === "sarvam") return "sarvam";
  if (p === "openai") return "openai";
  if (p === "anthropic" || p === "claude") return "anthropic";
  if (p === "google" || p === "gemini") return "google";
  if (p === "ollama") return "ollama";
  return "custom";
}
