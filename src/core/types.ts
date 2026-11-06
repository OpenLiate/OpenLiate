/**
 * OpenLiate — Open Source Backend Layer for AI Agents
 * 
 * "If Stripe did payments in 7 lines of code, why not AI Agents in 5 lines of code?"
 * "Don't build AI agents. Integrate by parts."
 * 
 * The 5 Orthogonal Layers:
 * L[LM]         — Sovereign Language Models & Reasoning
 * I[ntegration] — Session Memory, npm Libraries, Git Repos & State
 * A[gent]       — Identity, Intent, Skills & ReAct Loop
 * T[ools]       — Model Context Protocol (MCP v2) & APIs
 * E[nvironment] — Environment Variables, Secrets & Configuration
 */

/**
 * [L] LLM Layer
 * Sovereign Language Models: Sarvam 105B, Neon AI Gateway, OpenAI-compatible providers.
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
 * Integrations: npm standard libraries, Session Memory, Git Repositories, Context.dev.
 */
export interface LayerI {
  knowledge?: string | string[] | Record<string, unknown>;
  memory?: string;
  state?: Record<string, unknown>;
  database?: string;
  webhooks?: string[];
  repo?: string | Record<string, unknown>;
  lib?: string[] | Record<string, unknown>;
  context?: string | Record<string, unknown>;
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
  skills?: string | string[];
  subagents?: (LayerA | string)[];
  [key: string]: unknown;
}

/**
 * [T] Tools Layer
 * Any Tool: MCP v2 (Local Stdio & Remote SSE), Custom REST APIs, Actuators.
 */
export interface ToolDefinition {
  name?: string;
  description?: string;
  command?: string;
  args?: string[];
  url?: string;
  tools?: string[];
  parameters?: Record<string, unknown>;
  execute?: (args: Record<string, unknown>) => Promise<unknown> | unknown;
  [key: string]: unknown;
}

export type LayerT =
  | Array<string | ToolDefinition>
  | Record<string, ToolDefinition | string | Record<string, unknown>>;

/**
 * [E] Environment Layer
 * Environment: Configuration, API keys, and environment variables (.env).
 */
export type LayerE = Record<string, string | undefined>;

/**
 * The Universal 5-Line Agent Manifest (AUM)
 * Pure LIATE authoring across 3 casing conventions:
 * 1. Shorthand: L · I · A · T · E
 * 2. Full Name: LLM · Integration · Agent · Tools · Environment
 * 3. Lowercase: llm · integration · agent · tools · environment
 */
export interface AgentManifest {
  L: LayerL;
  I?: LayerI;
  A: LayerA | string;
  T?: LayerT;
  E?: LayerE;

  // Full-name aliases
  LLM?: LayerL;
  llm?: LayerL;

  Integration?: LayerI;
  integration?: LayerI;

  Agent?: LayerA | string;
  agent?: LayerA | string;

  Tools?: LayerT;
  tools?: LayerT;

  Environment?: LayerE;
  environment?: LayerE;
}

/**
 * Standard Result returned from an Agent execution run
 */
export type { AgentRunResult } from "../layers/agent/types";

