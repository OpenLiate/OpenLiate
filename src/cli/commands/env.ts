import path from "path";
import fs from "fs";
import { ConfigManager } from "../../core/spec";

export async function handleKeyCommand(args: string[]): Promise<void> {
  const sub = args[1]?.toLowerCase();

  // Set / Add / Update Key
  if (sub === "set" || sub === "add" || sub === "update") {
    const pair = args.find(a => a !== sub && a.includes("="));
    if (!pair || !pair.includes("=")) {
      console.error("Usage: openliate key set KEY=VALUE (or: openliate key add KEY=VALUE)");
      process.exit(1);
    }
    const [k, ...rest] = pair.split("=");
    const v = rest.join("=").replace(/^["']|["']$/g, "");
    const keyName = k.trim();

    // Save globally in ~/.openliate/config.json
    ConfigManager.setGlobalKey(keyName, v);

    // Also save locally in .env.local if in a project directory
    try {
      const envPath = path.join(process.cwd(), ".env.local");
      let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf-8") : "";
      const regex = new RegExp(`^${keyName}=.*$`, "m");
      if (regex.test(content)) {
        content = content.replace(regex, `${keyName}="${v}"`);
      } else {
        content += `\n${keyName}="${v}"\n`;
      }
      fs.writeFileSync(envPath, content.trim() + "\n", "utf-8");
    } catch {}

    const masked = v.length > 8 ? `${v.slice(0, 4)}...${v.slice(-4)}` : "******";
    console.log(`[OK] Saved key '${keyName}' (Masked: ${masked})`);
    return;
  }

  // List Keys
  if (sub === "list" || sub === "ls" || !sub) {
    const config = ConfigManager.readSystemConfig();
    console.log(`\nConfigured Keys (~/.openliate/config.json):`);
    if (config.keys && Object.keys(config.keys).length > 0) {
      for (const [k, v] of Object.entries(config.keys)) {
        const masked = v.length > 8 ? `${v.slice(0, 4)}...${v.slice(-4)}` : "******";
        console.log(`  - ${k}: ${masked}`);
      }
    } else {
      console.log(`  (No keys configured yet. Add with: openliate key set KEY=VALUE)`);
    }
    console.log("");
    return;
  }

  // Remove / Rm / Delete / Unset Key
  if (sub === "rm" || sub === "remove" || sub === "delete" || sub === "unset") {
    const keyName = args[2]?.trim();
    if (!keyName) {
      console.error("Usage: openliate key rm <KEY_NAME>");
      process.exit(1);
    }

    const removed = ConfigManager.removeGlobalKey(keyName);

    // Remove from local .env.local if present
    try {
      const envPath = path.join(process.cwd(), ".env.local");
      if (fs.existsSync(envPath)) {
        let content = fs.readFileSync(envPath, "utf-8");
        const regex = new RegExp(`^${keyName}=.*$\n?`, "m");
        content = content.replace(regex, "");
        fs.writeFileSync(envPath, content, "utf-8");
      }
    } catch {}

    if (removed) {
      console.log(`[OK] Removed key '${keyName}'`);
    } else {
      console.log(`Key '${keyName}' was not found in ~/.openliate/config.json`);
    }
    return;
  }

  console.log(`Usage:
  openliate key set <KEY>=<VALUE>    Save or update an API key
  openliate key list                 List configured keys (masked)
  openliate key rm <KEY>             Remove an API key
`);
}

export const handleEnvCommand = handleKeyCommand;
