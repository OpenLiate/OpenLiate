import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface HubLLMDefinition {
  name: string;
  provider: string;
  version: string;
  base_url: string;
  endpoint: string;
  default_model: string;
  available_models: string[];
  headers: Record<string, string>;
  features: {
    tool_calling: boolean;
    streaming: boolean;
    reasoning: boolean;
  };
}

export class HubResolver {
  private static cache = new Map<string, HubLLMDefinition>();

  public static loadLLM(providerName: string, baseDir: string = process.cwd()): HubLLMDefinition {
    const cached = this.cache.get(providerName);
    if (cached) return cached;

    const possiblePaths = [
      join(baseDir, "hub", "llm", `${providerName}.json`),
      join(baseDir, "..", "hub", "llm", `${providerName}.json`),
      join(__dirname, "..", "..", "hub", "llm", `${providerName}.json`)
    ];

    for (const filePath of possiblePaths) {
      if (existsSync(filePath)) {
        try {
          const content = readFileSync(filePath, "utf-8");
          const def = JSON.parse(content) as HubLLMDefinition;
          this.cache.set(providerName, def);
          return def;
        } catch (err: any) {
          throw new Error(`Failed to parse hub definition at ${filePath}: ${err.message}`);
        }
      }
    }

    // Default fallback definition for Sarvam /v2 if hub file is not found
    if (providerName.toLowerCase() === "sarvam") {
      const defaultSarvam: HubLLMDefinition = {
        name: "sarvam",
        provider: "sarvam",
        version: "v2",
        base_url: "https://api.sarvam.ai/v2",
        endpoint: "https://api.sarvam.ai/v2/chat/completions",
        default_model: "glm5.3",
        available_models: ["glm5.3", "glm5.3-flash", "sarvam-105b", "gemma4", "deepseekv4.1-flash-1017"],
        headers: {
          "api-subscription-key": "$SARVAM_API_KEY",
          "Content-Type": "application/json"
        },
        features: {
          tool_calling: true,
          streaming: true,
          reasoning: true
        }
      };
      this.cache.set(providerName, defaultSarvam);
      return defaultSarvam;
    }

    throw new Error(`Model provider definition for "${providerName}" not found in hub/llm/`);
  }
}

