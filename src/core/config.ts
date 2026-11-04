import fs from "fs";
import path from "path";
import os from "os";
import * as p from "@clack/prompts";

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
   * Ensure an API key exists. If missing:
   * - In interactive TTY terminal: Prompts user with a clean @clack/prompts box, saves to ~/.openliate/config.json
   * - In non-TTY / CI: Throws a formatted error with instructions
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

    const providerName = options.providerName || (keyName === "SARVAM_API_KEY" ? "Sarvam AI Sovereign Token Factory" : keyName);
    const docUrl = options.docUrl || (keyName === "SARVAM_API_KEY" ? "https://dashboard.sarvam.ai" : "https://docs.openliate.tech");

    const isTTY = Boolean(process.stdin.isTTY && process.stdout.isTTY);

    if (isTTY) {
      console.log("");
      p.intro(`\x1b[36mOpenLiate Runtime Setup\x1b[0m`);
      p.note(
        `Agent${options.agentName ? ` '${options.agentName}'` : ""} requires ${providerName} to execute.\n🔗 Get your API key at: ${docUrl}`,
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
      p.outro(`\x1b[32m✔ Saved securely to ~/.openliate/config.json! Resuming execution...\x1b[0m\n`);
      return keyVal;
    }

    // Non-interactive error banner
    const errBanner = `
===========================================================
  [OpenLiate] Missing API Key: ${keyName}
===========================================================

  Agent${options.agentName ? ` '${options.agentName}'` : ""} requires ${providerName}.

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

