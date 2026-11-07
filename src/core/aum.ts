import { z } from "zod";
import type { AgentModule } from "./spec";

export const AUMSchema = z.object({
  L: z.union([
    z.string().min(1, "Model definition cannot be empty"),
    z.object({
      provider: z.string(),
      model: z.string(),
      temperature: z.number().optional(),
      maxTokens: z.number().optional(),
      endpoint: z.string().optional()
    })
  ]),
  I: z.object({
    memory: z.string().optional(),
    context: z.union([z.string(), z.record(z.string(), z.any())]).optional(),
    system: z.string().optional(),
    skills: z.union([z.string(), z.array(z.string())]).optional(),
    database: z.string().optional(),
    webhooks: z.array(z.string()).optional()
  }).passthrough().optional().default({}),
  A: z.object({
    name: z.string().min(1, "Agent name is required"),
    version: z.string().optional().default("0.0.1"),
    intent: z.string().optional(),
    author: z.string().optional(),
    skills: z.union([z.string(), z.array(z.string())]).optional(),
    maxSteps: z.number().optional().default(10),
    subagents: z.array(z.string()).optional()
  }),
  T: z.union([
    z.array(z.union([z.string(), z.record(z.string(), z.any())])),
    z.record(z.string(), z.any())
  ]).optional().default([]),
  E: z.record(z.string(), z.string()).optional().default({})
});

export class AUM {
  /**
   * Normalizes module properties supporting pure LIATE authoring:
   * 1. Shorthand: L, I, A, T, E
   * 2. Full Name: LLM, Integration, Agent, Tools, Environment
   * 3. Lowercase: llm, integration, agent, tools, environment
   */
  public static normalize(rawObj: any): any {
    if (!rawObj || typeof rawObj !== "object") return rawObj;

    const L = rawObj.L ?? rawObj.LLM ?? rawObj.llm;
    const I = rawObj.I ?? rawObj.Integration ?? rawObj.integration;
    const A = rawObj.A ?? rawObj.Agent ?? rawObj.agent;
    const T = rawObj.T ?? rawObj.Tools ?? rawObj.tools;
    const E = rawObj.E ?? rawObj.Environment ?? rawObj.environment;

    return {
      ...rawObj,
      L,
      I: I ?? {},
      A: typeof A === "string" ? { name: A } : (A ?? {}),
      T: T ?? [],
      E: E ?? {}
    };
  }

  public static parse(moduleOrJson: string | object): AgentModule {
    let rawObj: any;

    if (typeof moduleOrJson === "string") {
      const trimmed = moduleOrJson.trim();
      if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        try {
          rawObj = JSON.parse(moduleOrJson);
        } catch (err: any) {
          throw new Error(`Failed to parse AUM module JSON: ${err.message}`);
        }
      } else if (trimmed.includes("class ") || trimmed.includes("extends liate") || trimmed.includes("export ")) {
        try {
          let code = trimmed
            .replace(/import\s+[\s\S]*?;/g, "")
            .replace(/export\s+default\s+/g, "")
            .replace(/export\s+/g, "")
            .replace(/extends\s+(liate|OpenLiate|LIATE)/g, "")
            .replace(/if\s*\(import\.meta\.main\)[\s\S]*$/, "");

          const match = code.match(/class\s+([A-Za-z0-9_]+)/);
          const className = match ? match[1] : "Agent";
          const fn = new Function(code + `\n return new ${className}();`);
          const inst = fn();
          rawObj = {
            L: inst.L ?? inst.LLM ?? inst.llm,
            I: inst.I ?? inst.Integration ?? inst.integration,
            A: inst.A ?? inst.Agent ?? inst.agent,
            T: inst.T ?? inst.Tools ?? inst.tools,
            E: inst.E ?? inst.Environment ?? inst.environment
          };
        } catch (err: any) {
          throw new Error(`Failed to parse agent TypeScript/JavaScript definition: ${err.message}`);
        }
      } else {
        try {
          rawObj = JSON.parse(moduleOrJson);
        } catch (err: any) {
          throw new Error(`Failed to parse AUM module: ${err.message}`);
        }
      }
    } else {
      rawObj = moduleOrJson;
    }

    const normalized = AUM.normalize(rawObj);
    const result = AUMSchema.safeParse(normalized);

    if (!result.success) {
      const issues = result.error.issues.map((i) => `[${i.path.join(".")}] ${i.message}`).join(", ");
      throw new Error(`Invalid AUM Module: ${issues}`);
    }

    return result.data as AgentModule;
  }

  public static resolveEnvironment(module: AgentModule, customEnv: Record<string, string | undefined> = process.env): AgentModule {
    const resolvedE: Record<string, string> = {};

    for (const [key, val] of Object.entries(module.E || {})) {
      if (typeof val === "string" && val.startsWith("$")) {
        const envVarName = val.slice(1);
        resolvedE[key] = customEnv[envVarName] || "";
      } else {
        resolvedE[key] = String(val);
      }
    }

    return {
      ...module,
      E: resolvedE
    };
  }
}
