import type { MemoryProvider } from "./types";
import { FileSessionMemory, InMemorySession } from "./memory";

export interface IntegrationConfig {
  memory?: string;
  type?: string;
  [key: string]: any;
}

export class IntegrationResolver {
  public static resolveMemory(
    config?: string | IntegrationConfig | MemoryProvider,
    metadata?: Record<string, any>,
    sessionId?: string
  ): MemoryProvider {
    if (!config) {
      return new InMemorySession(sessionId || "ephemeral", metadata);
    }

    if (typeof config === "object" && "append" in config && "getMessages" in config) {
      return config as MemoryProvider;
    }

    const memoryTarget = typeof config === "string" ? config : (config.memory || config.type);

    if (!memoryTarget || memoryTarget === ":memory:" || memoryTarget === "memory" || memoryTarget === "in-memory") {
      return new InMemorySession(sessionId || "ephemeral", metadata);
    }

    // Local file path (e.g. "sessions/hello-agent" or "./data/session.json")
    try {
      return new FileSessionMemory(memoryTarget, metadata);
    } catch {
      return new InMemorySession(sessionId || "ephemeral", metadata);
    }
  }
}
