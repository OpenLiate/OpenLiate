import type { MemoryProvider } from "./types";
import { FileSessionMemory, InMemorySession } from "./memory";

export interface IntegrationConfig {
  memory?: string;
  [key: string]: any;
}

export class IntegrationResolver {
  public static resolveMemory(config?: string | IntegrationConfig, metadata?: Record<string, any>): MemoryProvider {
    if (!config) {
      return new InMemorySession("ephemeral", metadata);
    }

    const memoryTarget = typeof config === "string" ? config : config.memory;

    if (!memoryTarget || memoryTarget === ":memory:") {
      return new InMemorySession("ephemeral", metadata);
    }

    // Local file path (e.g. "sessions/hello-agent" or "./data/session.json")
    return new FileSessionMemory(memoryTarget, metadata);
  }
}
