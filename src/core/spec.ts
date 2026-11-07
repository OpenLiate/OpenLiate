import fs from "fs";
import path from "path";
import os from "os";
import * as p from "@clack/prompts";

/**
 * OpenLiate — Open Source Backend Layer for AI Agents
 * 
 * "If Stripe did payments in 7 lines of code, why not AI Agents in 5 lines of code?"
 * "Don't build AI agents. Integrate by parts."
 * 
 * The 5 Layers:
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
 * AgentModule is canonical representation of the 5-layer Agent Manifest
 */
export type AgentModule = AgentManifest;

/**
 * Standard Result returned from an Agent execution run
 */
export type { AgentRunResult } from "../layers/agent/types";

export interface OpenLiateGlobalConfig {
  keys?: Record<string, string>;
  defaultProvider?: string;
  defaultModel?: string;
}

export class ConfigManager {
  /**
   * System-level directory: ~/.openliate
   */
  public static getSystemConfigDir(): string {
    const override = process.env.OPENLIATE_CONFIG_DIR;
    if (override) {
      if (!fs.existsSync(override)) {
        try { fs.mkdirSync(override, { recursive: true }); } catch {}
      }
      return override;
    }

    const homeDir = path.join(os.homedir(), ".openliate");
    if (!fs.existsSync(homeDir)) {
      try { fs.mkdirSync(homeDir, { recursive: true }); } catch {}
    }
    return homeDir;
  }

  /**
   * Workspace-level directory: ./.openliate
   */
  public static getLocalConfigDir(): string {
    const localDir = path.resolve(process.cwd(), ".openliate");
    if (!fs.existsSync(localDir)) {
      try { fs.mkdirSync(localDir, { recursive: true }); } catch {}
    }
    return localDir;
  }

  /**
   * Candidate directories in priority order:
   * 1. OPENLIATE_CONFIG_DIR (if set)
   * 2. Local workspace .openliate
   * 3. Parent workspace .openliate
   * 4. System home ~/.openliate
   */
  public static getConfigSearchDirs(): string[] {
    const dirs: string[] = [];

    const envOverride = process.env.OPENLIATE_CONFIG_DIR;
    if (envOverride) dirs.push(envOverride);

    dirs.push(
      path.resolve(process.cwd(), ".openliate"),
      path.resolve(process.cwd(), "..", ".openliate"),
      path.resolve(os.homedir(), ".openliate")
    );

    return dirs.filter(Boolean);
  }

  /**
   * Read system ~/.openliate/config.json (or local .openliate/config.json)
   */
  public static readSystemConfig(): OpenLiateGlobalConfig {
    const candidates = [
      path.join(this.getSystemConfigDir(), "config.json"),
      path.join(this.getLocalConfigDir(), "config.json")
    ];
    for (const filePath of candidates) {
      if (fs.existsSync(filePath)) {
        try {
          const raw = fs.readFileSync(filePath, "utf-8");
          return JSON.parse(raw);
        } catch {}
      }
    }
    return {};
  }

  /**
   * Write to system ~/.openliate/config.json (or local .openliate/config.json)
   */
  public static writeSystemConfig(config: OpenLiateGlobalConfig): void {
    let dir = this.getSystemConfigDir();
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const filePath = path.join(dir, "config.json");
      fs.writeFileSync(filePath, JSON.stringify(config, null, 2), "utf-8");
      return;
    } catch {}

    // Workspace .openliate directory
    try {
      dir = this.getLocalConfigDir();
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const filePath = path.join(dir, "config.json");
      fs.writeFileSync(filePath, JSON.stringify(config, null, 2), "utf-8");
    } catch {}
  }

  /**
   * Get an API key from:
   * 1. Process environment (process.env[key])
   * 2. System config (~/.openliate/config.json)
   * 3. System env file (~/.openliate/.env)
   */
  public static getKey(keyName: string): string | undefined {
    if (process.env[keyName]) {
      return process.env[keyName];
    }

    // Check ~/.openliate/config.json
    const config = this.readSystemConfig();
    if (config.keys && config.keys[keyName]) {
      process.env[keyName] = config.keys[keyName];
      return config.keys[keyName];
    }

    // Check candidate config dirs for .env
    for (const d of this.getConfigSearchDirs()) {
      const envFile = path.join(d, ".env");
      if (fs.existsSync(envFile)) {
        try {
          const content = fs.readFileSync(envFile, "utf-8");
          for (const line of content.split("\n")) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith("#")) continue;
            const [k, ...v] = trimmed.split("=");
            if (k && k.trim() === keyName) {
              const val = v.join("=").trim().replace(/^["']|["']$/g, "");
              process.env[keyName] = val;
              return val;
            }
          }
        } catch {}
      }
    }

    return undefined;
  }

  /**
   * Set an API key globally in ~/.openliate/config.json
   */
  public static setGlobalKey(keyName: string, value: string): void {
    const config = this.readSystemConfig();
    if (!config.keys) config.keys = {};
    config.keys[keyName] = value;
    this.writeSystemConfig(config);
    process.env[keyName] = value;
  }

  /**
   * Remove an API key globally from ~/.openliate/config.json
   */
  public static removeGlobalKey(keyName: string): boolean {
    const config = this.readSystemConfig();
    if (config.keys && keyName in config.keys) {
      delete config.keys[keyName];
      this.writeSystemConfig(config);
      delete process.env[keyName];
      return true;
    }
    return false;
  }

  /**
   * Ensure an API key exists.
   */
  public static async ensureApiKey(
    keyName: string,
    options: {
      providerName?: string;
      docUrl?: string;
      agentName?: string;
    } = {}
  ): Promise<string> {
    const existing = this.getKey(keyName);
    if (existing) return existing;

    const providerName = options.providerName || (keyName === "SARVAM_API_KEY" ? "Sarvam AI Token Factory" : keyName);
    const docUrl = options.docUrl || (keyName === "SARVAM_API_KEY" ? "https://dashboard.sarvam.ai" : "https://docs.openliate.tech");

    const isTTY = Boolean(process.stdin.isTTY && process.stdout.isTTY);

    if (isTTY) {
      console.log("");
      p.intro(`\x1b[36mOpenLiate Runtime Setup\x1b[0m`);
      p.note(
        `Agent${options.agentName ? ` '${options.agentName}'` : ""} requires ${providerName} to execute.\nGet your API key at: ${docUrl}`,
        `Missing Key: ${keyName}`
      );

      const entered = await p.password({
        message: `Paste your ${keyName}:`,
        validate: (value) => {
          if (!value || !value.trim()) return "Key cannot be empty.";
        }
      });

      if (p.isCancel(entered) || typeof entered !== "string") {
        p.cancel("Operation cancelled.");
        process.exit(1);
      }

      const keyVal = entered.trim();
      this.setGlobalKey(keyName, keyVal);
      p.outro(`\x1b[32m[Saved] Saved securely to ~/.openliate/config.json! Resuming execution...\x1b[0m\n`);
      return keyVal;
    }

    const errBanner = `
===========================================================
  [OpenLiate] Missing API Key: ${keyName}
===========================================================

  Agent${options.agentName ? ` '${options.agentName}'` : ""} requires ${providerName} (Free Credits at https://dashboard.sarvam.ai).

  How to provide this key:
  1. CLI Global Setup:
     $ openliate env set ${keyName}="your_key"

  2. Project Environment (.env.local):
     Add ${keyName}="your_key" in your current folder.

  3. On-The-Fly HTTP (No server config needed):
     Pass { "keys": { "${keyName}": "..." } } in your request payload.

  Get your key at: ${docUrl}
===========================================================
`;
    throw new Error(errBanner);
  }
}

