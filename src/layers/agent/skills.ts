/**
 * OpenLiate — Skills Engine [Layer A]
 * Procedural Knowledge, Guidelines & Universal skills.sh Ecosystem Hub
 * Dynamically resolves 1.5M+ open agent skills from skills.sh, GitHub raw,
 * local markdown files, and workspace `.openliate/skills/` with security auditing
 * and persistent disk caching.
 */

import fs from "fs";
import path from "path";
import os from "os";
import { EdgeSkillResolver } from "../../skills/resolver";

export interface SkillAuditReport {
  name: string;
  status: "pass" | "warn" | "block";
  riskScore: number;
  issues: string[];
}

export class SkillSecurityScanner {
  private static CRITICAL_PATTERNS = [
    /rm\s+-rf/i,
    /drop\s+table/i,
    /ignore\s+all\s+previous\s+instructions/i,
    /bypass\s+(?:all\s+)?guardrails/i,
    /format\s+[a-z]:/i,
    /shutdown\s+-(?:s|h|r)/i,
    /curl\s+[^|\n]+\|\s*(?:ba|z)?sh/i,
    /wget\s+[^|\n]+\|\s*(?:ba|z)?sh/i,
    /mkfs(?:\.[a-z0-9]+)?\s+/i,
    /:()\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/,
    /(?:chmod\s+(?:-R\s+)?777\s+\/|chown\s+(?:-R\s+)?[a-z0-9]+:\s*\/)/i
  ];

  private static SUSPICIOUS_PATTERNS = [
    /process\.env\.[a-z0-9_]*(?:key|secret|token|password)/i,
    /send\s+to\s+https?:/i,
    /exfiltrat(?:e|ion)/i,
    /(?:document\.cookie|window\.localStorage)\s*(?:=|\[|\.)/i,
    /(?:cat|type)\s+.*(?:\.ssh\/id_|\/etc\/shadow|\/etc\/passwd)/i,
    /(?:new\s+Function|eval)\s*\(\s*(?:atob|unescape|decodeURIComponent)\s*\(/i
  ];

  public static audit(name: string, instructions: string): SkillAuditReport {
    const issues: string[] = [];
    let riskScore = 0;

    for (const pattern of this.CRITICAL_PATTERNS) {
      if (pattern.test(instructions)) {
        issues.push(`Detected critical high-risk pattern: ${pattern.toString()}`);
        riskScore += 70;
      }
    }

    for (const pattern of this.SUSPICIOUS_PATTERNS) {
      if (pattern.test(instructions)) {
        issues.push(`Detected suspicious pattern: ${pattern.toString()}`);
        riskScore += 35;
      }
    }

    let status: "pass" | "warn" | "block" = "pass";
    if (riskScore >= 70) {
      status = "block";
    } else if (riskScore > 0) {
      status = "warn";
    }

    return {
      name,
      status,
      riskScore,
      issues
    };
  }
}

export interface ResolvedSkill {
  name: string;
  source: "local" | "skills.sh" | "github" | "hub" | "inline" | "cached";
  content: string;
  slug?: string;
  audit?: SkillAuditReport;
}

export class SkillsResolver {
  private static memoryCache: Map<string, ResolvedSkill> = new Map();

  /**
   * Clear in-memory cache
   */
  public static clearCache(): void {
    this.memoryCache.clear();
    EdgeSkillResolver.clearCache();
  }

  /**
   * Primary workspace skills directory: ./.openliate/skills
   */
  public static getWorkspaceSkillsDir(): string {
    const p = path.resolve(process.cwd(), ".openliate", "skills");
    if (!fs.existsSync(p)) {
      try {
        fs.mkdirSync(p, { recursive: true });
      } catch {}
    }
    return p;
  }

  /**
   * Cache directory for remote skills.sh items: ./.openliate/skills/cache
   */
  public static getCacheDir(): string {
    const p = path.resolve(this.getWorkspaceSkillsDir(), "cache");
    if (!fs.existsSync(p)) {
      try {
        fs.mkdirSync(p, { recursive: true });
      } catch {}
    }
    return p;
  }

  /**
   * Strips YAML frontmatter (---\n...\n---) from markdown skills
   */
  public static stripFrontmatter(content: string): string {
    const trimmed = content.trim();
    if (trimmed.startsWith("---")) {
      const secondDivider = trimmed.indexOf("---", 3);
      if (secondDivider !== -1) {
        return trimmed.slice(secondDivider + 3).trim();
      }
    }
    return trimmed;
  }

  /**
   * Determine whether a string refers to a remote skills.sh or GitHub skill slug
   */
  public static isRemoteRef(ref: string): boolean {
    if (!ref || typeof ref !== "string") return false;
    let trimmed = ref.trim();
    if (trimmed.startsWith("skill:")) {
      trimmed = trimmed.slice(6).trim();
    }
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return true;
    if (trimmed.startsWith("skills.sh/") || trimmed.startsWith("github:")) return true;
    if (trimmed.startsWith(".") || trimmed.startsWith("/") || trimmed.startsWith("\\") || trimmed.endsWith(".md")) {
      return false;
    }
    return /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+(\/[a-zA-Z0-9_.-]+)?$/.test(trimmed);
  }

  /**
   * Parse a skill reference into owner, repo, and optional sub-path
   */
  public static parseSkillRef(ref: string): { owner: string; repo: string; skill?: string; cleanId: string } {
    let clean = ref.trim();
    if (clean.startsWith("skill:")) {
      clean = clean.slice(6).trim();
    }
    clean = clean.replace(/^skills\.sh\//, "").replace(/^github:/, "").replace(/^@/, "");
    const parts = clean.split("/");
    const owner = parts[0] || "";
    const repo = parts[1] || "";
    const skill = parts.length > 2 ? parts.slice(2).join("/") : undefined;
    return { owner, repo, skill, cleanId: clean };
  }

  /**
   * Resolves a skill reference synchronously from local files, workspace, or cache
   */
  public static resolveSkill(skillRef: string, manifestBaseDir: string = process.cwd()): ResolvedSkill | null {
    let trimmed = skillRef.trim();
    if (!trimmed) return null;

    if (trimmed.startsWith("skill:")) {
      trimmed = trimmed.slice(6).trim();
    }

    // Check in-memory cache
    if (this.memoryCache.has(trimmed)) {
      return this.memoryCache.get(trimmed)!;
    }

    // 1. Direct file path & Hub check
    const candidatePaths = [
      path.resolve(manifestBaseDir, trimmed),
      path.resolve(process.cwd(), trimmed),
      path.resolve(process.cwd(), ".openliate", "skills", trimmed, "SKILL.md"),
      path.resolve(process.cwd(), ".openliate", "skills", `${trimmed}.md`),
      path.resolve(process.cwd(), ".openliate", "skills", trimmed),
      path.resolve(process.cwd(), ".openliate", "skills", "cache", `${trimmed.replace(/[^a-zA-Z0-9_.-]/g, "_")}.md`),
      path.resolve(os.homedir(), ".openliate", "skills", trimmed, "SKILL.md"),
      path.resolve(os.homedir(), ".openliate", "skills", `${trimmed}.md`),
      path.resolve(manifestBaseDir, "skills", trimmed, "SKILL.md"),
      path.resolve(manifestBaseDir, "skills", `${trimmed}.md`),
      path.resolve(manifestBaseDir, `${trimmed}.md`),
      path.resolve(process.cwd(), "hub", "skills", trimmed, "SKILL.md"),
      path.resolve(process.cwd(), "hub", "skills", `${trimmed}.md`),
      path.resolve(process.cwd(), "OpenLiate", "hub", "skills", trimmed, "SKILL.md"),
      path.resolve(process.cwd(), "OpenLiate", "hub", "skills", `${trimmed}.md`)
    ];

    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        const stat = fs.statSync(p);
        let targetFile = p;
        if (stat.isDirectory()) {
          const subSkill = path.join(p, "SKILL.md");
          const subSkills = path.join(p, "skills.md");
          if (fs.existsSync(subSkill)) {
            targetFile = subSkill;
          } else if (fs.existsSync(subSkills)) {
            targetFile = subSkills;
          } else {
            continue;
          }
        }

        try {
          const raw = fs.readFileSync(targetFile, "utf-8");
          const clean = this.stripFrontmatter(raw);
          const skillName = path.basename(path.dirname(targetFile)) !== "skills" && path.basename(path.dirname(targetFile)) !== "cache"
            ? path.basename(path.dirname(targetFile))
            : path.basename(targetFile, path.extname(targetFile));

          const audit = SkillSecurityScanner.audit(skillName, clean);
          const res: ResolvedSkill = {
            name: skillName,
            source: targetFile.includes("cache") ? "cached" : "local",
            content: clean,
            audit
          };
          this.memoryCache.set(trimmed, res);
          return res;
        } catch {}
      }
    }

    // 2. Only multi-line text or explicit markdown headers count as direct skill instructions
    if (!this.isRemoteRef(trimmed) && (trimmed.includes("\n") || trimmed.startsWith("#"))) {
      const clean = this.stripFrontmatter(trimmed);
      const titleMatch = clean.match(/^#+\s*(.+)$/m);
      const rawTitle = titleMatch ? titleMatch[1].replace(/skill/i, "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_") : "";
      const skillName = rawTitle || "skill";
      const audit = SkillSecurityScanner.audit(skillName, clean);
      return {
        name: skillName,
        source: "local",
        content: clean,
        audit
      };
    }

    return null;
  }

  /**
   * Resolves a skill asynchronously, fetching from skills.sh or GitHub raw if not found locally
   */
  public static async resolveSkillAsync(skillRef: string, manifestBaseDir: string = process.cwd()): Promise<ResolvedSkill | null> {
    const local = this.resolveSkill(skillRef, manifestBaseDir);
    if (local) return local;

    let trimmed = skillRef.trim();
    if (trimmed.startsWith("skill:")) {
      trimmed = trimmed.slice(6).trim();
    }

    // 1. Resolve via EdgeSkillResolver (skills.sh API, GitHub Raw, Edge Memory)
    if (this.isRemoteRef(trimmed) || trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      try {
        const edge = await EdgeSkillResolver.resolve(trimmed);
        if (edge && edge.source !== "inline" && edge.instructions && edge.instructions !== trimmed) {
          const clean = this.stripFrontmatter(edge.instructions);
          const audit = SkillSecurityScanner.audit(edge.name, clean);
          const result: ResolvedSkill = {
            name: edge.name,
            source: edge.source === "skills.sh" ? "skills.sh" : "github",
            content: clean,
            slug: edge.slug,
            audit
          };
          this.cacheSkill(trimmed, result);
          return result;
        }
      } catch {}
    }

    // 1. Direct HTTPS URL
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      try {
        const res = await fetch(trimmed, {
          signal: AbortSignal.timeout(6000),
          headers: { "User-Agent": "OpenLiate/0.1.1" }
        });
        if (res.ok) {
          const text = await res.text();
          const clean = this.stripFrontmatter(text);
          const name = trimmed.split("/").pop()?.replace(/\.md$/, "") || "remote-skill";
          const audit = SkillSecurityScanner.audit(name, clean);
          const result: ResolvedSkill = {
            name,
            source: "skills.sh",
            content: clean,
            slug: trimmed,
            audit
          };
          this.cacheSkill(trimmed, result);
          return result;
        }
      } catch {}
    }

    // 2. skills.sh / GitHub reference (e.g. "vercel-labs/skills/find-skills" or "vercel-labs/find-skills")
    if (this.isRemoteRef(trimmed)) {
      const { owner, repo, skill: subSkill, cleanId } = this.parseSkillRef(trimmed);
      const idParts = cleanId.split("/");

      // 2a. Try official skills.sh API
      try {
        const apiUrl = `https://skills.sh/api/v1/skills/${cleanId}`;
        const headers: Record<string, string> = { "User-Agent": "OpenLiate/0.1.1" };
        const token = process.env.VERCEL_OIDC_TOKEN || process.env.SKILLS_SH_TOKEN;
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const res = await fetch(apiUrl, { signal: AbortSignal.timeout(5000), headers });
        if (res.ok) {
          const data: any = await res.json();
          const skillFile = data.files?.find((f: any) => f.path === "SKILL.md" || f.path.endsWith(".md")) || data.files?.[0];
          if (skillFile?.contents) {
            const clean = this.stripFrontmatter(skillFile.contents);
            const skillName = subSkill || repo || idParts.slice(1).join("-");
            const audit = SkillSecurityScanner.audit(skillName, clean);
            const resolved: ResolvedSkill = {
              name: skillName,
              source: "skills.sh",
              content: clean,
              slug: cleanId,
              audit
            };
            this.cacheSkill(trimmed, resolved);
            return resolved;
          }
        }
      } catch {}

      // 2b. Fallback to GitHub raw candidate URLs
      const skillName = subSkill || (idParts.length > 2 ? idParts.slice(2).join("/") : repo);
      const candidateUrls: string[] = [];

      if (idParts.length >= 3) {
        candidateUrls.push(
          `https://raw.githubusercontent.com/${owner}/${repo}/main/skills/${skillName}/SKILL.md`,
          `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/skills/${skillName}/SKILL.md`,
          `https://raw.githubusercontent.com/${owner}/${repo}/main/${skillName}/SKILL.md`,
          `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/${skillName}/SKILL.md`,
          `https://raw.githubusercontent.com/${owner}/${repo}/main/SKILL.md`,
          `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/SKILL.md`
        );
      } else {
        candidateUrls.push(
          `https://raw.githubusercontent.com/${owner}/${repo}/main/SKILL.md`,
          `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/SKILL.md`,
          `https://raw.githubusercontent.com/${owner}/skills/main/skills/${repo}/SKILL.md`,
          `https://raw.githubusercontent.com/${owner}/skills/HEAD/skills/${repo}/SKILL.md`,
          `https://raw.githubusercontent.com/${owner}/${repo}/main/skills/${repo}/SKILL.md`,
          `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/skills/${repo}/SKILL.md`,
          `https://raw.githubusercontent.com/${owner}/${repo}/master/SKILL.md`
        );
      }

      for (const url of candidateUrls) {
        try {
          const res = await fetch(url, {
            signal: AbortSignal.timeout(5000),
            headers: { "User-Agent": "OpenLiate/0.1.1" }
          });
          if (res.ok) {
            const text = await res.text();
            if (text && !text.includes("404: Not Found") && text.trim().length > 10) {
              const clean = this.stripFrontmatter(text);
              const audit = SkillSecurityScanner.audit(skillName, clean);
              const resolved: ResolvedSkill = {
                name: skillName,
                source: "github",
                content: clean,
                slug: cleanId,
                audit
              };
              this.cacheSkill(trimmed, resolved);
              return resolved;
            }
          }
        } catch {}
      }
    }

    return null;
  }

  /**
   * Caches a resolved skill in memory and to .openliate/skills/cache/
   */
  private static cacheSkill(key: string, skill: ResolvedSkill): void {
    this.memoryCache.set(key, skill);
    try {
      const cacheDir = this.getCacheDir();
      const safeKey = key.replace(/[^a-zA-Z0-9_.-]/g, "_") + ".md";
      const target = path.join(cacheDir, safeKey);
      fs.writeFileSync(target, skill.content, "utf-8");
    } catch {}
  }

  /**
   * Compiles one or more skills synchronously into a single formatted system prompt block
   */
  public static compileSkills(
    skills?: string | string[],
    manifestBaseDir: string = process.cwd()
  ): string {
    if (!skills) return "";

    const skillList = Array.isArray(skills) ? skills : [skills];
    const resolvedSkills: ResolvedSkill[] = [];

    for (const ref of skillList) {
      const res = this.resolveSkill(ref, manifestBaseDir);
      if (res && res.content) {
        if (res.audit && res.audit.status === "block") {
          console.warn(`[Skills Security] BLOCKED unsafe skill "${res.name}":`, res.audit.issues);
          continue;
        }
        resolvedSkills.push(res);
      }
    }

    if (resolvedSkills.length === 0) return "";

    const sections = resolvedSkills.map((s, idx) => {
      return `### [Skill ${idx + 1}: ${s.name}]\n${s.content}`;
    });

    return `\n\n## Domain Skills & Procedural Guidelines:\n${sections.join("\n\n")}`;
  }

  /**
   * Compiles skills asynchronously, resolving remote skills.sh/GitHub references if needed
   */
  public static async compileSkillsAsync(
    skills?: string | string[],
    manifestBaseDir: string = process.cwd()
  ): Promise<string> {
    if (!skills) return "";

    const skillList = Array.isArray(skills) ? skills : [skills];
    const resolvedSkills: ResolvedSkill[] = [];

    for (const ref of skillList) {
      const res = await this.resolveSkillAsync(ref, manifestBaseDir);
      if (res && res.content) {
        if (res.audit && res.audit.status === "block") {
          console.warn(`[Skills Security] BLOCKED unsafe skill "${res.name}":`, res.audit.issues);
          continue;
        }
        resolvedSkills.push(res);
      }
    }

    if (resolvedSkills.length === 0) return "";

    const sections = resolvedSkills.map((s, idx) => {
      return `### [Skill ${idx + 1}: ${s.name}]\n${s.content}`;
    });

    return `\n\n## Domain Skills & Procedural Guidelines:\n${sections.join("\n\n")}`;
  }

  /**
   * Save a reusable skill to .openliate/skills/<skillName>/SKILL.md
   */
  public static saveSkill(name: string, content: string): string {
    const dir = path.join(this.getWorkspaceSkillsDir(), name);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const targetFile = path.join(dir, "SKILL.md");
    fs.writeFileSync(targetFile, content.trim() + "\n", "utf-8");
    return targetFile;
  }

  /**
   * Install a remote skill from skills.sh into .openliate/skills/<name>/SKILL.md
   */
  public static async install(ref: string, destinationDir?: string): Promise<string> {
    const resolved = await this.resolveSkillAsync(ref);
    if (!resolved) {
      throw new Error(`Failed to resolve remote skill "${ref}" from skills.sh or GitHub.`);
    }

    if ((resolved.name === "inline_skill" || resolved.name === "inline-skill" || resolved.source === "inline") && this.isRemoteRef(ref)) {
      throw new Error(`Failed to resolve remote skill "${ref}": remote endpoint not found or unreachable.`);
    }

    if (resolved.audit && resolved.audit.status === "block") {
      throw new Error(`Cannot install skill "${ref}": security audit blocked (${resolved.audit.issues.join(", ")})`);
    }

    const baseDir = destinationDir || this.getWorkspaceSkillsDir();
    const safeName = resolved.name.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
    const targetDir = path.join(baseDir, safeName);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const targetFile = path.join(targetDir, "SKILL.md");
    const header = `---\nname: ${safeName}\nsource: ${resolved.source || "skills.sh"}\nslug: ${resolved.slug || ref}\n---\n\n`;
    fs.writeFileSync(targetFile, header + resolved.content, "utf-8");
    return targetFile;
  }

  /**
   * Lists available skill names in .openliate/skills
   */
  public static listWorkspaceSkills(): string[] {
    const dir = this.getWorkspaceSkillsDir();
    if (!fs.existsSync(dir)) return [];
    try {
      return fs.readdirSync(dir).filter(item => {
        if (item === "cache") return false;
        const full = path.join(dir, item);
        return fs.statSync(full).isDirectory() || item.endsWith(".md");
      });
    } catch {
      return [];
    }
  }
}
