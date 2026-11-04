import type { ModelConfig } from "../../core/types";
import { HubResolver } from "./hub";

export interface NormalizedModel {
  provider: "sarvam" | "neon";
  model: string;
  temperature?: number;
  maxTokens?: number;
  endpoint?: string;
}

export function normalizeModelConfig(input?: string | ModelConfig): NormalizedModel {
  if (!input) {
    const hubDef = HubResolver.loadLLM("sarvam");
    return {
      provider: "sarvam",
      model: hubDef.default_model
    };
  }

  if (typeof input === "string") {
    const trimmed = input.trim();
    if (!trimmed) {
      const hubDef = HubResolver.loadLLM("sarvam");
      return {
        provider: "sarvam",
        model: hubDef.default_model
      };
    }

    const parts = trimmed.split("/");
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
      model: trimmed
    };
  }

  let providerStr = input.provider;
  let modelStr = input.model;

  if (!providerStr && modelStr && modelStr.includes("/")) {
    const parts = modelStr.split("/");
    providerStr = parts[0];
    modelStr = parts[1];
  }

  return {
    provider: mapProvider(providerStr),
    model: modelStr || HubResolver.loadLLM("sarvam").default_model,
    temperature: input.temperature,
    maxTokens: input.maxTokens,
    endpoint: input.endpoint
  };
}

function mapProvider(provider?: string): NormalizedModel["provider"] {
  if (!provider) return "sarvam";
  const p = provider.toLowerCase();
  if (p === "neon" || p === "neon-gateway") return "neon";
  // Default everything to sarvam — sovereign primary provider
  return "sarvam";
}
