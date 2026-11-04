/**
 * OpenLiate Catalog — OmniRoute Multi-Provider Gateway
 * Built for 'cheaper-inference/OmniRoute' (https://www.omniroute.online)
 * Aggregates 150+ free-tier providers to unlock ~1.62B+ recurring tokens/month.
 */

export interface OmniRouteModelMetadata {
  id: string;
  name: string;
  providerStrategy: "auto-fallback" | "free-tier" | "cost-optimized";
  contextWindow: number;
  description: string;
}

export const OMNIROUTE_DEFAULT_LOCAL_URL = "http://localhost:20128/v1";
export const OMNIROUTE_DEFAULT_REMOTE_URL = "https://api.omniroute.online/v1";

export const OMNIROUTE_MODELS: Record<string, OmniRouteModelMetadata> = {
  "auto-free": {
    id: "auto-free",
    name: "OmniRoute Auto-Free Router",
    providerStrategy: "auto-fallback",
    contextWindow: 128000,
    description: "Intelligent auto-router that shifts traffic across 150+ free tiers with zero downtime."
  },
  "llama-3.3-70b": {
    id: "llama-3.3-70b",
    name: "Llama 3.3 70B",
    providerStrategy: "free-tier",
    contextWindow: 128000,
    description: "High-power open-weights reasoning model with cross-provider failover."
  },
  "deepseek-v3": {
    id: "deepseek-v3",
    name: "DeepSeek V3",
    providerStrategy: "free-tier",
    contextWindow: 64000,
    description: "Fast code synthesis and multi-turn agent conversations."
  },
  "qwen-2.5-72b": {
    id: "qwen-2.5-72b",
    name: "Qwen 2.5 72B",
    providerStrategy: "free-tier",
    contextWindow: 128000,
    description: "Top-tier multilingual and agent tool-calling performance."
  }
};

export const DEFAULT_OMNIROUTE_MODEL = "auto-free";
