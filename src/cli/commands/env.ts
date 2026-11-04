import path from "path";
import fs from "fs";
import { ConfigManager } from "../../core/config";

export async function handleEnvCommand(args: string[]): Promise<void> {
  const sub = args[1];
  if (sub === "set") {
    const pair = args.find(a => a !== "set" && a.includes("="));
    if (!pair || !pair.includes("=")) {
      console.error("Usage: openliate env set KEY=VALUE");
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
    console.log(`✔ Set ${keyName} in ~/.openliate/config.json & .env.local (Masked: ${masked})`);
    return;
  }

  if (sub === "list" || sub === "ls") {
    const config = ConfigManager.readSystemConfig();
    console.log(`\nGlobal Configuration (~/.openliate/config.json):`);
    if (config.keys && Object.keys(config.keys).length > 0) {
      for (const [k, v] of Object.entries(config.keys)) {
        const masked = v.length > 8 ? `${v.slice(0, 4)}...${v.slice(-4)}` : "******";
        console.log(`  - ${k}: ${masked}`);
      }
    } else {
      console.log(`  (No global keys configured yet)`);
    }
    console.log("");
    return;
  }

  console.log(`Usage:
  openliate env set KEY=VALUE    Save key globally in ~/.openliate and locally
  openliate env list             List configured global keys
`);
}

