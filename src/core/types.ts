/**
 * OPENLIATE — Open Source Backend Layer for AI Agents
 * 
 * "If Stripe did payments in 7 lines of code, why not AI Agents in 5 lines of code?"
 * "Don't build AI agents. Integrate by parts."
 * 
 * The 5 Orthogonal Layers:
 * L[LM]         — Model
 * I[ntegration] — Knowledge & State
 * A[gent]       — Harness & Reasoning Loop
 * T[ools]       — Tools & MCP
 * E[nvironment] — Sandbox & Security
 */

/**
 * [L] Large Models Layer
 * Any Model: Text LLMs, Image Gen (Nano Banana), Video Gen (SeaDance), Decision Models (OpenJev).
 * Foundation models are cognitive inputs, NEVER actuators/tools.
 */
export type LayerL = 
  | string
  | {
      provider?: string;
      model: string;
      baseUrl?: string;
      apiKey?: string;
      temperature?: number;
      maxTokens?: number;
    };

export type ModelConfig = LayerL;

/**
 * [I] Integration Layer
 * Any Integration: Libraries (Zod), Memory, Context Window, Persistent State,
 * Neon Postgres, Frameworks (LlamaIndex), Webhooks, Git Repos.
 */
export interface LayerI {
  memory?: string;
  state?: Record<string, unknown>;
  database?: string;
  webhooks?: string[];
  repo?: string;
  [key: string]: unknown;
}

/**
 * [A] Agent Layer
 * Any Agent: Identity, Name, Intent, Version, ReAct Loop, Subagents,
 * Multi-Agent Swarms, External Framework Wrappers (CrewAI / LangGraph).
 */
export interface LayerA {
  name: string;
  intent?: string;
  version?: string;
  system?: string;
  maxTurns?: number;
  /** Portable agent skills from Vercel Labs (skills.sh) or local SKILL.md rules */
  skills?: string[];
  subagents?: LayerA[];
  [key: string]: unknown;
}

/**
 * [T] Tools Layer
 * Any Tool: MCP v2 (Local Stdio & Remote SSE), Custom REST APIs, Actuators.
 */
export interface ToolDefinition {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
  execute?: (args: Record<string, unknown>) => Promise<unknown> | unknown;
}

export type LayerT = Array<string | ToolDefinition>;

/**
 * [E] Environment Layer
 * Any Environment: Secrets (.env keys), Neon Sandbox Isolates, Guardrails.
 */
export type LayerE = Record<string, string | undefined>;

/**
 * The Universal 5-Line Agent Manifest (AUM)
 */
export interface AgentManifest {
  L: LayerL;
  I?: LayerI;
  A: LayerA | string;
  T?: LayerT;
  E?: LayerE;
}

/**
 * Standard Result returned from an Agent execution run
 */
export interface AgentRunResult {
  agent: string;
  answer: string;
  turns: number;
  latencyMs: number;
  toolsExecuted: number;
  error?: string;
}
