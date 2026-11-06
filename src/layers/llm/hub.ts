import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

// Embedded default hub definitions for serverless runtimes (Neon Functions, Vercel Edge, AWS Lambda)
// Ensures zero filesystem dependency when bundled into a single file
import sarvamHubJson from "../../../hub/llm/sarvam.json";
import indiaaiHubJson from "../../../hub/llm/indiaai.json";
import neonHubJson from "../../../hub/llm/neon.json";

export interface HubLLMDefinition {
  name: string;
  provider: string;
  version: string;
  base_url: string;
  endpoint: string;
  systemone_endpoint?: string;
  default_model: string;
  available_models: string[];
  headers: Record<string, string>;
  features: {
    tool_calling: boolean;
    streaming: boolean;
    reasoning: boolean;
    system_one_decisions?: boolean;
  };
}

export class HubResolver {
  private static cache: Map<string, HubLLMDefinition> = new Map([
    ["sarvam", sarvamHubJson as HubLLMDefinition],
    ["indiaai", indiaaiHubJson as HubLLMDefinition],
    ["neon", neonHubJson as HubLLMDefinition]
  ]);

  /**
   * Resolves a provider definition dynamically from cache, embedded hub, or disk.
   */
  public static loadLLM(providerName: string): HubLLMDefinition {
    if (this.cache.has(providerName)) {
      return this.cache.get(providerName)!;
    }

    const possiblePaths = [
      resolve(process.cwd(), "hub", "llm", `${providerName}.json`),
      resolve(process.cwd(), "OpenLiate", "hub", "llm", `${providerName}.json`),
      resolve(process.cwd(), "..", "hub", "llm", `${providerName}.json`),
      resolve(__dirname, "../../hub/llm", `${providerName}.json`),
      resolve(__dirname, "../../../hub/llm", `${providerName}.json`),
      resolve(__dirname, "../../../../hub/llm", `${providerName}.json`)
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

    throw new Error(`Model provider definition for "${providerName}" not found in hub/llm/${providerName}.json`);
  }
}
