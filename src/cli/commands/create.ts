import * as p from "@clack/prompts";
import path from "path";
import { scaffoldProject } from "../../scaffold/project";

export async function handleCreateCommand(args: string[] = []): Promise<void> {
  // args[0] is "create" or "new"
  const isPythonArg = args.includes("--py") || args.includes("--python");
  const isTsArg = args.includes("--ts") || args.includes("--typescript");

  // Find the first argument that is not a flag
  const nonFlagArgs = args.slice(1).filter((a) => !a.startsWith("-"));
  let rawName = nonFlagArgs[0];
  let lang: "ts" | "py" = isPythonArg ? "py" : "ts";

  if (!rawName) {
    console.log("");
    p.intro("\x1b[36mOpenLiate — Scaffolding Sovereign AI Agent Project\x1b[0m");

    const promptedName = await p.text({
      message: "Enter agent project name:",
      placeholder: "my-agent",
      validate: (value) => {
        if (!value || !value.trim()) return "Project name is required.";
        if (/[^a-zA-Z0-9_-]/.test(value)) return "Only letters, numbers, hyphens, and underscores allowed.";
        return undefined;
      }
    });

    if (p.isCancel(promptedName)) {
      p.cancel("Agent scaffolding cancelled.");
      return;
    }

    rawName = promptedName as string;

    if (!isPythonArg && !isTsArg) {
      const selectedLang = await p.select({
        message: "Select language:",
        options: [
          { value: "ts", label: "TypeScript (agent.ts)", hint: "Runs via Bun/Node runtime" },
          { value: "py", label: "Python (agent.py)", hint: "Runs via Python openliate SDK" }
        ]
      });

      if (p.isCancel(selectedLang)) {
        p.cancel("Agent scaffolding cancelled.");
        return;
      }

      lang = selectedLang as "ts" | "py";
    }
  }

  try {
    const result = scaffoldProject({ name: rawName, lang });

    if (result.lang === "py") {
      console.log(`
===========================================================
  OpenLiate Python Agent Project Created Successfully!
===========================================================

Project:   ${result.projectName}
Class:     class ${result.className}(liate)
Directory: ${result.projectDir}

Generated Files:
  • pyproject.toml     Python project manifest with openliate dependency
  • requirements.txt   Pip dependencies
  • agent.py           Canonical 5-layer Python agent (L · I · A · T · E)
  • .env.example       Template for BYOAI API keys
  • .gitignore         Clean git ignores (.env, __pycache__, sessions)
  • README.md          Architecture & run guide

Next Steps:
  1. cd ${result.projectName}
  2. pip install -r requirements.txt
  3. python agent.py "Namaste, who are you?"
===========================================================
`);
    } else {
      console.log(`
===========================================================
  OpenLiate Agent Project Created Successfully!
===========================================================

Project:   ${result.projectName}
Class:     class ${result.className} extends liate
Directory: ${result.projectDir}

Generated Files:
  • package.json       Project manifest with run, serve & deploy scripts
  • agent.ts           Canonical 5-layer agent (L · I · A · T · E)
  • tsconfig.json      TypeScript ESM configuration
  • .env.example       Template for BYOAI API keys
  • .gitignore         Clean git ignores (node_modules, .env, sessions)
  • README.md          Architecture & multi-cloud deployment guide

Next Steps:
  1. cd ${result.projectName}
  2. openliate run ./agent.ts "Namaste, who are you?"
  3. openliate serve ./agent.ts --port 7071
  4. openliate deploy ./agent.ts --to fastly (or cf, neon, azion, vercel, supabase)
===========================================================
`);
    }
  } catch (err: any) {
    console.error(`\n[Create Error]: ${err.message}`);
    process.exit(1);
  }
}
