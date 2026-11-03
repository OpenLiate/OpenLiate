import fs from "fs";
import path from "path";
import os from "os";
import type { SandboxConfig } from "./types";
import { ConfigManager } from "../config/index";

export class EnvironmentResolver {
  /**
   * Automatically loads .env and .env.local files from cwd, manifest dir, parent dirs, and home dir
   */
  public static loadEnv(targetPath?: string): void {
    // 1. Load keys from ~/.openliate/config.json
    try {
      const globalConfig = ConfigManager.readSystemConfig();
      if (globalConfig.keys) {
        for (const [k, v] of Object.entries(globalConfig.keys)) {
          if (!process.env[k]) {
            process.env[k] = v;
          }
        }
      }
    } catch {}

    // 2. Load env files
    const candidates = [
      path.resolve(process.cwd(), ".env"),
      path.resolve(process.cwd(), ".env.local"),
      path.resolve(process.cwd(), ".openliate", ".env"),
      path.resolve(process.cwd(), "..", ".env"),
      path.resolve(process.cwd(), "..", ".env.local"),
      targetPath ? path.resolve(path.dirname(targetPath), ".env") : "",
      targetPath ? path.resolve(path.dirname(targetPath), ".env.local") : "",
      path.resolve(os.homedir(), ".openliate", ".env"),
      path.resolve(os.homedir(), ".openliate", "config.env"),
      path.resolve(os.homedir(), ".env")
    ].filter(Boolean);

    for (const file of candidates) {
      if (fs.existsSync(file)) {
        try {
          const content = fs.readFileSync(file, "utf-8");
          for (const line of content.split("\n")) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith("#")) continue;
            const [k, ...v] = trimmed.split("=");
            if (k && !process.env[k.trim()]) {
              process.env[k.trim()] = v.join("=").trim().replace(/^["']|["']$/g, "");
            }
          }
        } catch {}
      }
    }
  }

  /**
   * Expands variable references (e.g. "$API_KEY" -> process.env.API_KEY)
   */
  public static resolve(
    declaredEnv: Record<string, string>,
    systemEnv: Record<string, string | undefined> = process.env
  ): Record<string, string> {
    const resolved: Record<string, string> = {};

    for (const [key, val] of Object.entries(declaredEnv)) {
      if (typeof val === "string" && val.startsWith("$")) {
        const varName = val.slice(1);
        resolved[key] = systemEnv[varName] || "";
      } else {
        resolved[key] = String(val ?? "");
      }
    }

    return resolved;
  }

  /**
   * Masks sensitive credentials in logs (e.g. sk_live_1234... -> sk_l***5678)
   */
  public static maskSecret(value: string): string {
    if (!value || value.length <= 8) {
      return "******";
    }
    const prefix = value.slice(0, 4);
    const suffix = value.slice(-4);
    return `${prefix}***${suffix}`;
  }

  /**
   * Constructs an isolated sandbox configuration
   */
  public static createSandbox(
    env: Record<string, string>,
    options: Partial<SandboxConfig> = {}
  ): SandboxConfig {
    const resolvedEnv = this.resolve(env);

    return {
      allowedDomains: options.allowedDomains || ["api.sarvam.ai", "api.agentmail.to"],
      denyNetwork: options.denyNetwork ?? false,
      timeoutMs: options.timeoutMs ?? 30000,
      env: resolvedEnv
    };
  }
}
