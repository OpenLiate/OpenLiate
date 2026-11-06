/**
 * OpenLiate Catalog — Sarvam AI Models & Pricing Matrix (Indus Catalogue 2026)
 * Up to date as of late 2026.
 */

export interface ModelPricing {
  inputPerMillion: number;
  cachedInputPerMillion?: number;
  outputPerMillion: number;
}

export interface SarvamModelMetadata {
  id: string;
  name: string;
  category: "llm" | "audio" | "vision" | "translation" | "decision";
  contextWindow?: number;
  languages?: number;
  toolCalling?: boolean;
  reasoning?: boolean;
  pricing?: ModelPricing;
  description: string;
  recommendedFor: string;
}

export const SARVAM_MODELS: Record<string, SarvamModelMetadata> = {
  // System-1 Decisions API (/v2/systemone)
  "sarvam-prism": {
    id: "sarvam-prism",
    name: "Sarvam Prism",
    category: "decision",
    contextWindow: 128000,
    languages: 22,
    toolCalling: false,
    reasoning: false,
    pricing: {
      inputPerMillion: 10,
      cachedInputPerMillion: 3,
      outputPerMillion: 0
    },
    description: "Open-weight System-1 decision model built on Sarvam 105B with sub-50ms single forward-pass calibrated probabilities.",
    recommendedFor: "Autonomous agent routing, triage, intent classification, and security guardrails."
  },

  // LLMs — Token Factory (/v2/chat/completions)
  "sarvam-105b": {
    id: "sarvam-105b",
    name: "Sarvam 105B",
    category: "llm",
    contextWindow: 128000,
    languages: 11,
    toolCalling: true,
    reasoning: true,
    pricing: {
      inputPerMillion: 15,
      cachedInputPerMillion: 5,
      outputPerMillion: 60
    },
    description: "India's premier sovereign foundation model with switchable reasoning and native Indic multilingual tool-calling.",
    recommendedFor: "General agent reasoning, multi-turn conversational agents, and complex sovereign workflows."
  },
  "sarvam-105b-conversations": {
    id: "sarvam-105b-conversations",
    name: "Sarvam 105B Conversations",
    category: "llm",
    contextWindow: 32000,
    languages: 11,
    toolCalling: true,
    reasoning: false,
    pricing: {
      inputPerMillion: 15,
      cachedInputPerMillion: 5,
      outputPerMillion: 60
    },
    description: "Low-latency conversational model optimized for real-time speech and interactive voice agents.",
    recommendedFor: "Voice bots, interactive phone agents, and fast turnaround assistants."
  },
  "glm5.3": {
    id: "glm5.3",
    name: "GLM 5.3",
    category: "llm",
    contextWindow: 1000000,
    languages: 23,
    toolCalling: true,
    reasoning: true,
    pricing: {
      inputPerMillion: 126,
      cachedInputPerMillion: 20,
      outputPerMillion: 390
    },
    description: "1 Million token context window model built specifically for software engineering and coding agents.",
    recommendedFor: "Code generation, repository-level debugging, and long-horizon engineering tasks."
  },
  "glm5.3-flash": {
    id: "glm5.3-flash",
    name: "GLM 5.3 Flash",
    category: "llm",
    contextWindow: 1000000,
    languages: 23,
    toolCalling: true,
    reasoning: true,
    pricing: {
      inputPerMillion: 13.5,
      cachedInputPerMillion: 2.5,
      outputPerMillion: 45
    },
    description: "Ultra high-speed, cost-effective coding model with 1M context and adjustable reasoning.",
    recommendedFor: "High-throughput autonomous agents, instant code reviews, and scale-to-zero background tasks."
  },
  "gemma4": {
    id: "gemma4",
    name: "Gemma 4 31B",
    category: "llm",
    contextWindow: 128000,
    languages: 23,
    toolCalling: true,
    reasoning: false,
    pricing: {
      inputPerMillion: 35,
      cachedInputPerMillion: 10,
      outputPerMillion: 90
    },
    description: "High-capability multimodal model with native image input, tool calling, and log probabilities.",
    recommendedFor: "Multimodal visual reasoning, document image inspection, and tool-augmented pipelines."
  },
  "deepseekv4.1-flash-1017": {
    id: "deepseekv4.1-flash-1017",
    name: "DeepSeek V4.1 Flash 1017",
    category: "llm",
    contextWindow: 1000000,
    languages: 23,
    toolCalling: true,
    reasoning: true,
    pricing: {
      inputPerMillion: 25,
      cachedInputPerMillion: 0.5,
      outputPerMillion: 105
    },
    description: "Massive 1M context with switchable reasoning, image comprehension, and advanced tool calling.",
    recommendedFor: "Complex multi-step research, financial document auditing, and deep autonomous chains."
  },
  "deepseekv4-pro": {
    id: "deepseekv4-pro",
    name: "DeepSeek V4 Pro",
    category: "llm",
    contextWindow: 1000000,
    languages: 23,
    toolCalling: true,
    reasoning: true,
    pricing: {
      inputPerMillion: 115,
      cachedInputPerMillion: 4,
      outputPerMillion: 350
    },
    description: "DeepSeek's flagship coding and architecture agent engine with 1M context.",
    recommendedFor: "Enterprise autonomous software development and mission-critical code synthesis."
  },
  "kimi-k3": {
    id: "kimi-k3",
    name: "Kimi K3",
    category: "llm",
    contextWindow: 1000000,
    languages: 23,
    toolCalling: true,
    reasoning: true,
    pricing: {
      inputPerMillion: 270,
      cachedInputPerMillion: 27,
      outputPerMillion: 1350
    },
    description: "Long-horizon agent model tailored for autonomous investigations spanning days or thousands of steps.",
    recommendedFor: "Long-horizon research, enterprise legal analysis, and deep synthesis."
  },
  "mimo-v2.6-flash": {
    id: "mimo-v2.6-flash",
    name: "MiMo V2.6 Flash",
    category: "llm",
    contextWindow: 1000000,
    languages: 23,
    toolCalling: true,
    reasoning: true,
    pricing: {
      inputPerMillion: 12.5,
      cachedInputPerMillion: 0.25,
      outputPerMillion: 25
    },
    description: "Fast, extremely low-cost reasoning model with 1M context.",
    recommendedFor: "High-volume data transformation, background triage, and real-time event filtering."
  },

  // Audio / Speech
  "bulbul-v4-flash": {
    id: "bulbul-v4-flash",
    name: "Bulbul v4 Flash",
    category: "audio",
    languages: 11,
    description: "Text-to-speech with 200+ human-like voices across 11 Indic languages with pace, pitch, and loudness control.",
    recommendedFor: "Voice agents, audio summaries, and spoken IVR."
  },
  "saaras-v4": {
    id: "saaras-v4",
    name: "Saaras v4",
    category: "audio",
    languages: 23,
    description: "Speech-to-text with auto-language detection, speaker diarization, and keyterm prompting across 23 languages.",
    recommendedFor: "Audio meeting transcription, call center intelligence, and multimodal audio input."
  },

  // Vision
  "sarvam-vision": {
    id: "sarvam-vision",
    name: "Sarvam Vision",
    category: "vision",
    languages: 23,
    description: "OCR, table extraction, and structured field extraction tailored for Indian identity, tax, and legal documents.",
    recommendedFor: "Document understanding, Aadhaar/PAN/GST verification, and invoice processing."
  },

  // Translation
  "mayura-v1": {
    id: "mayura-v1",
    name: "Mayura v1",
    category: "translation",
    languages: 11,
    description: "Neural translation model with tone control, script control, and auto language detection.",
    recommendedFor: "High-fidelity Indic localization and multi-language agent communication."
  },
  "sarvam-translate-v1": {
    id: "sarvam-translate-v1",
    name: "Sarvam Translate v1",
    category: "translation",
    languages: 23,
    description: "Formal style, numeral control, and long-form document translation across 23 Indian languages.",
    recommendedFor: "Legal, governmental, and enterprise cross-language translation."
  }
};

export const DEFAULT_SARVAM_LLM = "sarvam-105b";
export const DEFAULT_SARVAM_FAST_LLM = "glm5.3-flash";
export const DEFAULT_SARVAM_TTS = "bulbul-v4-flash";
export const DEFAULT_SARVAM_STT = "saaras-v4";

