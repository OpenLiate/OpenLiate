export * from "./types";
export * from "./aum";
export * from "./config";
export * from "./uuid";
export * from "./version";

// -----------------------------------------------------------------
// Core Engine: OM (Orchestration Module)
// "Class is an Agent" — OOP base class matching AUM (Agent Unified Manifest)
//
// 1 Class = 5 Properties (`L · I · A · T · E`) = Identical to agent.json
//
// Usage:
//   import { liate } from "openliate";
//   class HelloAgent extends liate { L; I; A; T; E }
// -----------------------------------------------------------------
import { Agent as AgentRunner } from "../layers/agent/harness";
import type { AgentRunResult, AgentExecutionOptions } from "../layers/agent/types";
import type { AgentManifest } from "./types";

/**
 * OM (Orchestration Module) — Core Autonomous Execution Engine
 *
 * Base class for Class-based OOP Agents in OpenLiate.
 *
 * ```typescript
 * import { liate } from "openliate";
 *
 * class HelloAgent extends liate {
 *   L = "sarvam/sarvam-105b";
 *   I = { memory: "sessions/hello-agent" };
 *   A = { name: "hello_agent", intent: "Autonomous Agent" };
 *   T = ["fetch"];
 *   E = { SARVAM_API_KEY: "$SARVAM_API_KEY" };
 * }
 *
 * const agent = new HelloAgent();
 * await agent.run("Namaste world!");
 * ```
 */
export class liate {
  // 1. Shorthand: L · I · A · T · E
  public L?: any;
  public I?: any;
  public A?: any;
  public T?: any[];
  public E?: Record<string, string>;

  // 2. Full Name: LLM · Integration · Agent · Tools · Environment
  public LLM?: any;
  public Integration?: any;
  public Agent?: any;
  public Tools?: any[];
  public Environment?: Record<string, string>;

  // 3. Lowercase: llm · integration · agent · tools · environment
  public llm?: any;
  public integration?: any;
  public agent?: any;
  public tools?: any[];
  public environment?: Record<string, string>;

  private _runner?: AgentRunner;

  /**
   * Returns the underlying AgentRunner (Layer A runtime instance).
   */
  public getRunner(): AgentRunner {
    if (!this._runner) {
      const manifest = this.toManifest();
      this._runner = new AgentRunner({ manifest });
    }
    return this._runner;
  }

  /**
   * Executes the agent with a given prompt input.
   */
  public async run(input: string, options?: AgentExecutionOptions): Promise<AgentRunResult> {
    return this.getRunner().run(input, options);
  }

  /**
   * Converts this class-agent into a standard Web Request handler (Hono / Cloudflare / Vercel).
   */
  public toHandler(): (req: Request) => Promise<Response> {
    return this.getRunner().toHandler();
  }

  /**
   * Exports the declarative L·I·A·T·E manifest — identical shape to agent.json (AUM).
   */
  public toManifest(): AgentManifest {
    const L = this.L ?? this.LLM ?? this.llm;
    const I = this.I ?? this.Integration ?? this.integration;
    const A = this.A ?? this.Agent ?? this.agent ?? { name: this.constructor.name };
    const T = this.T ?? this.Tools ?? this.tools ?? [];
    const E = this.E ?? this.Environment ?? this.environment ?? {};

    if (!L) {
      throw new Error(
        `[OpenLiate Error]: Missing required Layer [L] (LLM) in class '${this.constructor.name}'. ` +
        `Declare 'L', 'LLM', or 'llm' on your class. ` +
        `OpenLiate never hardcodes or falls back to silent model defaults.`
      );
    }
    return {
      L,
      I,
      A,
      T,
      E
    };
  }
}

