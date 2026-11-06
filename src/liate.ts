/**
 * OpenLiate — Sovereign AI Agent Backend
 * Universal Entrypoint: SDK Exports & Direct CLI Runner
 *
 * Can be imported in code:
 *   import { Agent, MCP } from "openliate";
 *
 * Or executed directly via Bun / Node (matches YC demo video):
 *   bun run src/liate.ts run hub/agents/sarvam-agent/agent.json "Hi how are you"
 */

// 1. The 5 Sovereign LIATE Pillars (Layer 1 to 5)
export * from "./layers/llm/sarvam";
export * from "./layers/llm/model";
export * from "./layers/llm/hub";
export * from "./layers/integration/memory";
export * from "./layers/integration/types";
export * from "./layers/integration/knowledge";
export * from "./layers/agent/harness";
export * from "./layers/agent/types";
export * from "./layers/agent/loop";
export * from "./layers/tools/types";
export * from "./layers/tools/mcp";
export * from "./layers/tools/server";
export * from "./layers/tools/registry";
export * from "./layers/tools/builtin/fetch";
export * from "./layers/tools/builtin/identity";
export * from "./layers/environment/sandbox";
export * from "./layers/environment/types";

// 2. Core, Infrastructure, Cloud Link & Runtime Server
export type { AgentRunResult } from "./layers/agent/types";
export type { SarvamChatOptions } from "./layers/llm/sarvam";
export { base64url, generatePKCE, type ClientRegistration } from "./core/pkce";
export * from "./core/index";
export * from "./link/index";
export * from "./server/runtime";
export * from "./catalog/index";
export * from "./skills/resolver";
export * from "./routes/skills";

// 3. Direct CLI Runner
import { main } from "./cli/index";

if (import.meta.main || process.argv[1]?.endsWith("liate.ts")) {
  main().catch((err) => {
    console.error("Fatal:", err);
    process.exit(1);
  });
}

