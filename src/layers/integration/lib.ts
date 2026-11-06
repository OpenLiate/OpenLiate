import path from "node:path";
import fs from "node:fs";
import type { AgentTool } from "../agent/types";

export interface LoadedLib {
  name: string;
  module: any;
  exports: string[];
  type: "npm" | "local" | "builtin";
}

export class LiateLib {
  private static cache: Map<string, LoadedLib> = new Map();

  /**
   * Dynamically imports any npm library, local file, or Node.js/Bun builtin module.
   */
  public static async import(nameOrPath: string): Promise<LoadedLib> {
    if (this.cache.has(nameOrPath)) {
      return this.cache.get(nameOrPath)!;
    }

    let mod: any;
    let type: "npm" | "local" | "builtin" = "npm";

    // 1. Check if local relative/absolute file
    const isLocalPath = nameOrPath.startsWith("./") || nameOrPath.startsWith("../") || path.isAbsolute(nameOrPath);
    if (isLocalPath) {
      type = "local";
      const resolvedPath = path.resolve(process.cwd(), nameOrPath);
      try {
        mod = await import(resolvedPath);
      } catch (err: any) {
        throw new Error(`Layer [I] failed to import local library module '${nameOrPath}': ${err.message}`);
      }
    } else {
      // 2. Check builtin or npm package
      try {
        mod = await import(nameOrPath);
      } catch (err: any) {
        // Try fallback to resolving from node_modules in cwd
        try {
          const localNodeModules = path.resolve(process.cwd(), "node_modules", nameOrPath);
          mod = await import(localNodeModules);
        } catch {
          throw new Error(`Layer [I] failed to load library '${nameOrPath}'. Ensure it is installed via npm/bun: ${err.message}`);
        }
      }
    }

    const exports = Object.keys(mod || {});
    const loaded: LoadedLib = {
      name: nameOrPath,
      module: mod,
      exports,
      type
    };

    this.cache.set(nameOrPath, loaded);
    return loaded;
  }

  /**
   * Resolves multiple libraries declared in Layer [I] manifest
   */
  public static async resolveLibs(libs: string[] | Record<string, string>): Promise<Map<string, LoadedLib>> {
    const results = new Map<string, LoadedLib>();

    if (Array.isArray(libs)) {
      for (const libName of libs) {
        if (!libName || typeof libName !== "string") continue;
        try {
          const loaded = await this.import(libName);
          results.set(libName, loaded);
        } catch (err: any) {
          console.warn(`[OpenLiate Layer I] Warning: Could not resolve library '${libName}': ${err.message}`);
        }
      }
    } else if (typeof libs === "object" && libs !== null) {
      for (const [alias, spec] of Object.entries(libs)) {
        if (!spec || typeof spec !== "string") continue;
        try {
          const loaded = await this.import(spec);
          results.set(alias, loaded);
        } catch (err: any) {
          console.warn(`[OpenLiate Layer I] Warning: Could not resolve library '${alias}' (${spec}): ${err.message}`);
        }
      }
    }

    return results;
  }

  /**
   * Exposes callable functions from loaded libraries as native AgentTools.
   */
  public static asTools(loadedMap: Map<string, LoadedLib>): AgentTool[] {
    const tools: AgentTool[] = [];

    for (const [libKey, loaded] of loadedMap.entries()) {
      const mod = loaded.module?.default || loaded.module;
      if (!mod) continue;

      // Check if module is directly a function or has exported methods
      if (typeof mod === "function") {
        const safeName = `lib_${libKey.replace(/[^a-zA-Z0-9_]/g, "_")}`;
        tools.push({
          name: safeName,
          description: `Execute function from Layer [I] library '${libKey}'.`,
          parameters: {
            type: "object",
            properties: {
              input: { type: "string", description: "Input parameter or JSON payload for the library function." }
            }
          },
          execute: async (args: any) => {
            let parsed = args.input;
            try {
              parsed = JSON.parse(args.input);
            } catch {}
            return await mod(parsed);
          }
        });
      } else if (typeof mod === "object") {
        for (const [fnName, fnVal] of Object.entries(mod)) {
          if (typeof fnVal === "function" && !fnName.startsWith("_") && tools.length < 20) {
            const toolName = `lib_${libKey.replace(/[^a-zA-Z0-9_]/g, "_")}_${fnName}`;
            tools.push({
              name: toolName,
              description: `Execute '${fnName}' from Layer [I] library '${libKey}'.`,
              parameters: {
                type: "object",
                properties: {
                  args: { type: "array", description: "Arguments array to pass to the function.", items: { type: "string" } }
                }
              },
              execute: async (args: any) => {
                const callArgs = Array.isArray(args.args) ? args.args : [args.args];
                return await (fnVal as any)(...callArgs);
              }
            });
          }
        }
      }
    }

    return tools;
  }

  /**
   * Clear cache
   */
  public static clearCache(): void {
    this.cache.clear();
  }
}

