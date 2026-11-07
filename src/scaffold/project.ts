import fs from "fs";
import path from "path";
import { OPENLIATE_VERSION } from "../core/version";

export interface ScaffoldOptions {
  name: string;
  targetDir?: string;
  lang?: "ts" | "py";
}

export interface ScaffoldResult {
  projectName: string;
  className: string;
  lang: "ts" | "py";
  projectDir: string;
  files: string[];
}

function toPascalCase(str: string): string {
  return str
    .split(/[-_]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join("");
}

export function scaffoldProject(options: ScaffoldOptions): ScaffoldResult {
  const rawName = options.name.trim();
  if (!rawName) {
    throw new Error("Agent project name is required.");
  }

  const cleanName = rawName
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!cleanName) {
    throw new Error(`Invalid agent project name '${rawName}'. Use alphanumeric characters and hyphens.`);
  }

  const className = toPascalCase(cleanName) + (cleanName.toLowerCase().endsWith("agent") ? "" : "Agent");
  const targetDir = options.targetDir ? path.resolve(options.targetDir) : path.resolve(process.cwd(), cleanName);
  const lang: "ts" | "py" = options.lang === "py" ? "py" : "ts";

  if (fs.existsSync(targetDir)) {
    const existing = fs.readdirSync(targetDir);
    if (existing.length > 0) {
      throw new Error(`Target directory '${targetDir}' already exists and is not empty.`);
    }
  } else {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  let filesToWrite: Record<string, string>;

  if (lang === "py") {
    const pyprojectContent = `[project]
name = "${cleanName}"
version = "0.1.0"
description = "AI Agent built with OpenLiate"
requires-python = ">=3.9"
dependencies = [
    "openliate>=0.1.3"
]
`;

    const requirementsContent = `openliate>=0.1.3\n`;

    const agentPyContent = `import sys
import os
from openliate import liate

class ${className}(liate):
    """
    ${className} — AI Agent
    Implements the 5 Layers of LIATE:
      [L] LLM: Language Model
      [I] Integration: Conversation Memory & Knowledge
      [A] Agent: Name, Intent & Step Limits
      [T] Tools: Model Context Protocol (MCP) & Tools
      [E] Environment: Environment Variables & API Keys
    """
    # [L] Layer 1: LLM (Sarvam / Neon AI Gateway)
    L = "sarvam/sarvam-105b"

    # [I] Layer 2: Integration & Conversation Memory
    I = {
        "memory": "sessions/${cleanName}"
    }

    # [A] Layer 3: Agent Intent & Harness Configuration
    A = {
        "name": "${cleanName}",
        "intent": "AI Agent built with OpenLiate",
        "max_steps": 5
    }

    # [T] Layer 4: MCP Tools & Tool Integrations
    T = {
        "fetch": {
            "command": "uvx",
            "args": ["mcp-server-fetch"],
            "tools": ["*"]
        }
    }

    # [E] Layer 5: Environment Keys
    E = {
        "SARVAM_API_KEY": os.environ.get("SARVAM_API_KEY", "$SARVAM_API_KEY")
    }

def main():
    agent = ${className}()
    prompt = sys.argv[1] if len(sys.argv) > 1 else "Namaste, who are you?"
    print(f"Running agent '{agent.A['name']}' with prompt: \\"{prompt}\\"...\\n")
    try:
        result = agent.run(prompt)
        print(result.response)
    except ConnectionError as e:
        print("[Note]:", str(e))

if __name__ == "__main__":
    main()
`;

    const envExampleContent = `# API Keys
SARVAM_API_KEY=sk_live_...
NEON_AI_GATEWAY_TOKEN=
`;

    const gitignoreContent = `.env
__pycache__/
*.pyc
sessions/
.openliate/
`;

    const readmeContent = `# ${cleanName}

AI Agent built with [OpenLiate](https://openliate.tech).

## Architecture: 5 Layers of LIATE

- **[L] LLM:** Language Model (Sarvam 105B)
- **[I] Integration:** File-based conversation sessions
- **[A] Agent:** Agent harness with step guardrails
- **[T] Tools:** Model Context Protocol (MCP) fetch tool
- **[E] Environment:** Environment variables & API keys

## Quickstart

### 1. Install Dependencies
\`\`\`bash
pip install -r requirements.txt
\`\`\`

### 2. Configure API Keys
Copy \`.env.example\` to \`.env\` and add your API keys:
\`\`\`bash
cp .env.example .env
\`\`\`

### 3. Run Locally
\`\`\`bash
python agent.py "Namaste, who are you?"
# or
openliate run ./agent.py "Namaste, who are you?"
\`\`\`
`;

    filesToWrite = {
      "pyproject.toml": pyprojectContent,
      "requirements.txt": requirementsContent,
      "agent.py": agentPyContent,
      ".env.example": envExampleContent,
      ".gitignore": gitignoreContent,
      "README.md": readmeContent
    };
  } else {
    const packageJsonContent = JSON.stringify(
      {
        name: cleanName,
        version: "0.1.0",
        description: `AI Agent powered by OpenLiate`,
        type: "module",
        main: "agent.ts",
        scripts: {
          start: "openliate run ./agent.ts",
          serve: "openliate serve ./agent.ts --port 7071",
          "deploy:fastly": "openliate deploy ./agent.ts --to fastly",
          "deploy:cloudflare": "openliate deploy ./agent.ts --to cloudflare",
          "deploy:azion": "openliate deploy ./agent.ts --to azion",
          "deploy:neon": "openliate deploy ./agent.ts --to neon",
          "deploy:vercel": "openliate deploy ./agent.ts --to vercel",
          "deploy:supabase": "openliate deploy ./agent.ts --to supabase"
        },
        dependencies: {
          openliate: `^${OPENLIATE_VERSION}`
        }
      },
      null,
      2
    ) + "\n";

    const agentTsContent = `import { liate } from "openliate";

/**
 * ${className} — AI Agent
 * Implements the 5 Layers of LIATE:
 *   [L] LLM: Language Model
 *   [I] Integration: Conversation Memory & Knowledge
 *   [A] Agent: Name, Intent & Step Limits
 *   [T] Tools: Model Context Protocol (MCP) & Tools
 *   [E] Environment: Environment Variables & API Keys
 */
export class ${className} extends liate {
  // [L] Layer 1: LLM (Sarvam / Neon AI Gateway)
  L = "sarvam/sarvam-105b";

  // [I] Layer 2: Integration & Conversation Memory
  I = {
    memory: "sessions/${cleanName}"
  };

  // [A] Layer 3: Agent Intent & Harness Configuration
  A = {
    name: "${cleanName}",
    intent: "AI Agent built with OpenLiate",
    maxSteps: 5
  };

  // [T] Layer 4: MCP Tools & Tool Integrations
  T = {
    fetch: {
      command: "uvx",
      args: ["mcp-server-fetch"],
      tools: ["*"]
    }
  };

  // [E] Layer 5: Environment Keys
  E = {
    SARVAM_API_KEY: "$SARVAM_API_KEY"
  };
}

// Allows running directly via \`bun run agent.ts "Your prompt"\`
if (import.meta.main) {
  const agent = new ${className}();
  const prompt = process.argv.slice(2).join(" ") || "Namaste, who are you?";
  console.log(\`Running agent '\${agent.A.name}' with prompt: "\${prompt}"...\\n\`);
  const result = await agent.run(prompt);
  console.log(result.text);
}
`;

    const tsConfigContent = JSON.stringify(
      {
        compilerOptions: {
          lib: ["ESNext", "DOM"],
          module: "ESNext",
          target: "ESNext",
          moduleResolution: "bundler",
          moduleDetection: "force",
          strict: true,
          skipLibCheck: true,
          allowSyntheticDefaultImports: true,
          esModuleInterop: true,
          forceConsistentCasingInFileNames: true,
          allowJs: true
        },
        include: ["**/*.ts"]
      },
      null,
      2
    ) + "\n";

    const envExampleContent = `# API Keys
SARVAM_API_KEY=sk_live_...
NEON_AI_GATEWAY_TOKEN=
`;

    const gitignoreContent = `node_modules/
.env
sessions/
.openliate/
dist/
`;

    const readmeContent = `# ${cleanName}

AI Agent built with [OpenLiate](https://openliate.tech).

## Architecture: 5 Layers of LIATE

- **[L] LLM:** Language Model (Sarvam 105B)
- **[I] Integration:** File-based conversation sessions
- **[A] Agent:** Agent harness with step guardrails
- **[T] Tools:** Model Context Protocol (MCP) fetch tool
- **[E] Environment:** Environment variables & API keys

## Quickstart

### 1. Install Dependencies
\`\`\`bash
npm install
# or
bun install
\`\`\`

### 2. Configure API Keys
Copy \`.env.example\` to \`.env\` and add your API keys:
\`\`\`bash
cp .env.example .env
\`\`\`

### 3. Run Locally
\`\`\`bash
openliate run ./agent.ts "Namaste, who are you?"
# or
bun run agent.ts "Namaste, who are you?"
\`\`\`

### 4. Serve HTTP API
Serve your agent as a standard HTTP Liate API on port 7071:
\`\`\`bash
openliate serve ./agent.ts --port 7071
\`\`\`

### 5. Multi-Cloud Deployment (18.5M Runs)
Deploy live to serverless cloud compute:
\`\`\`bash
openliate deploy ./agent.ts --to fastly        # Fastly WASM Compute (10M runs)
openliate deploy ./agent.ts --to cloudflare    # Cloudflare Workers (3M runs)
openliate deploy ./agent.ts --to azion         # Azion Edge Functions (3M runs)
openliate deploy ./agent.ts --to neon          # Neon Cloud Compute (1M runs)
openliate deploy ./agent.ts --to vercel        # Vercel Fluid Compute (1M runs)
openliate deploy ./agent.ts --to supabase      # Supabase Edge Functions (500k runs)
\`\`\`
`;

    filesToWrite = {
      "package.json": packageJsonContent,
      "agent.ts": agentTsContent,
      "tsconfig.json": tsConfigContent,
      ".env.example": envExampleContent,
      ".gitignore": gitignoreContent,
      "README.md": readmeContent
    };
  }

  const writtenFiles: string[] = [];
  for (const [relPath, content] of Object.entries(filesToWrite)) {
    const fullPath = path.join(targetDir, relPath);
    fs.writeFileSync(fullPath, content, "utf-8");
    writtenFiles.push(fullPath);
  }

  return {
    projectName: cleanName,
    className,
    lang,
    projectDir: targetDir,
    files: writtenFiles
  };
}

export const scaffoldAgent = scaffoldProject;
