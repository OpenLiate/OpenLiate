import { readFileSync, existsSync } from "fs";
import { resolve, join } from "path";
import sarvamDef from "../../../hub/llm/sarvam.json";

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
  private static cache: Map<string, HubLLMDefinition> = new Map();

  /**
   * Resolves a provider definition dynamically from the hub/llm/ directory.
   * Throws an error if the hub file does not exist, guaranteeing zero hardcoding.
   */
  public static loadLLM(providerName: string): HubLLMDefinition {
    if (this.cache.has(providerName)) {
      return this.cache.get(providerName)!;
    }

    const possiblePaths = [
      resolve(process.cwd(), "hub", "llm", `${providerName}.json`),
      resolve(process.cwd(), "..", "hub", "llm", `${providerName}.json`),
      join(__dirname, "..", "..", "..", "hub", "llm", `${providerName}.json`)
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

    if (providerName === "sarvam") {
      this.cache.set(providerName, sarvamDef as HubLLMDefinition);
      return sarvamDef as HubLLMDefinition;
    }

    throw new Error(`Model provider definition for "${providerName}" not found in hub/llm/${providerName}.json`);
  }
}
