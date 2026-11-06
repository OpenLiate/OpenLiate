import type { MemoryProvider } from "./types";
import { FileSessionMemory, InMemorySession } from "./memory";
import { ContextDevClient, type ContextDevConfig } from "../../catalog/neon/context";
import type { AgentTool } from "../agent/types";

export interface IntegrationConfig {
  memory?: string;
  context?: string | ContextDevConfig | Record<string, any>;
  webhooks?: string[];
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

  /**
   * Resolves Layer [I] Context integrations (e.g. Neon Functions Context.dev)
   * into executable AgentTools to enrich the agent's reasoning loop.
   */
  public static resolveContextTools(config?: string | IntegrationConfig): AgentTool[] {
    if (!config) return [];

    const contextSpec = typeof config === "object" ? config.context : config;
    if (!contextSpec) return [];

    if (
      contextSpec === "neon/context-dev" ||
      contextSpec === "context-dev" ||
      contextSpec === "context.dev" ||
      (typeof contextSpec === "object" && (contextSpec.provider === "context-dev" || contextSpec.provider === "neon"))
    ) {
      const clientConfig = typeof contextSpec === "object" ? (contextSpec as ContextDevConfig) : undefined;
      const client = new ContextDevClient(clientConfig);
      return client.asTools();
    }

    return [];
  }
}
