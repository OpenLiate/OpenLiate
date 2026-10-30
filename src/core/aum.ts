import { z } from "zod";
import type { AgentManifest, ModelConfig, IntegrationConfig, AgentConfig, ToolConfig, EnvironmentConfig } from "../engine/types";

export const AUMSchema = z.object({
  version: z.string().optional().default("1.0.0"),
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
    system: z.string().optional(),
    skills: z.union([z.string(), z.array(z.string())]).optional(),
    database: z.string().optional()
  }).optional().default({}),
  A: z.object({
    name: z.string().min(1, "Agent name is required"),
    version: z.string().optional().default("1.0.0"),
    intent: z.string().optional(),
    author: z.string().optional(),
    skills: z.union([z.string(), z.array(z.string())]).optional(),
    subagents: z.array(z.string()).optional()
  }),
  T: z.union([
    z.array(z.string()),
    z.record(z.any())
  ]).optional().default([]),
  E: z.record(z.string()).optional().default({})
});

export class AUM {
  public static parse(manifestOrJson: string | object): AgentManifest {
    let rawObj: any;

    if (typeof manifestOrJson === "string") {
      try {
        rawObj = JSON.parse(manifestOrJson);
      } catch (err: any) {
        throw new Error(`Failed to parse AUM manifest JSON: ${err.message}`);
      }
    } else {
      rawObj = manifestOrJson;
    }

    const result = AUMSchema.safeParse(rawObj);

    if (!result.success) {
      const issues = result.error.issues.map((i) => `[${i.path.join(".")}] ${i.message}`).join(", ");
      throw new Error(`Invalid AUM Manifest: ${issues}`);
    }

    return result.data as AgentManifest;
  }

  public static resolveEnvironment(manifest: AgentManifest, customEnv: Record<string, string | undefined> = process.env): AgentManifest {
    const resolvedE: Record<string, string> = {};

    for (const [key, val] of Object.entries(manifest.E || {})) {
      if (typeof val === "string" && val.startsWith("$")) {
        const envVarName = val.slice(1);
        resolvedE[key] = customEnv[envVarName] || "";
      } else {
        resolvedE[key] = String(val);
      }
    }

    return {
      ...manifest,
      E: resolvedE
    };
  }
}

