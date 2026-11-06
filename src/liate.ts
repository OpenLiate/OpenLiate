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
export * from "./layers/llm/model";
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
export * from "./layers/environment/sandbox";
export * from "./layers/environment/types";

// 2. Core, Infrastructure, Cloud Link & Runtime Server
export type { AgentRunResult } from "./layers/agent/types";
export { base64url, generatePKCE, type ClientRegistration } from "./core/pkce";
export * from "./core/om";
export * from "./cloud/link";
export * from "./cloud/runtime/hono";
export * from "./cloud/runtime/wasm";
export * from "./layers/integration/repo";
export * from "./layers/integration/lib";
export * from "./skills/resolver";
export * from "./routes/skills";

// 3. Direct CLI Runner (only when executed directly as script, not when imported)
const isDirectScript = typeof process !== "undefined" &&
  Boolean(process.argv?.[1]) &&
  !process.argv[1].includes("node_modules") &&
  (process.argv[1].endsWith("liate.ts") || process.argv[1].endsWith("openliate.ts"));

if (isDirectScript) {
  import("./cli/index").then(({ main }) => {
    main().catch((err) => {
      console.error("Fatal:", err);
      process.exit(1);
    });
  });
}

