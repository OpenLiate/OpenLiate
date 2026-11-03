import type { ModelConfig } from "../core/types";

export interface NormalizedModel {
  provider: "sarvam" | "openai" | "anthropic" | "google" | "ollama" | "custom";
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
  if (p === "sarvam") return "sarvam";
  if (p === "openai") return "openai";
  if (p === "anthropic" || p === "claude") return "anthropic";
  if (p === "google" || p === "gemini") return "google";
  if (p === "ollama") return "ollama";
  return "custom";
}

