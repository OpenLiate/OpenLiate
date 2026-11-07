/**
 * Edge Dynamic Skill Resolver for liate-engine
 * Resolves skills.sh slugs, GitHub remote references, and caches them on the edge.
 */
export interface EdgeSkill {
  name: string;
  slug: string;
  instructions: string;
  source: 'skills.sh' | 'github' | 'inline' | 'cached';
  cachedAt?: number;
}

const skillMemoryCache: Map<string, EdgeSkill> = new Map();

export class EdgeSkillResolver {
  /**
   * Dynamically fetch and resolve a skill slug at runtime (0 disk dependency)
   */
  public static async resolve(slugOrUrl: string): Promise<EdgeSkill> {
    const cleanSlug = slugOrUrl.trim();

    // 1. Check in-memory edge cache
    if (skillMemoryCache.has(cleanSlug)) {
      return skillMemoryCache.get(cleanSlug)!;
    }

    // 2. Direct HTTPS URL
    if (cleanSlug.startsWith('http://') || cleanSlug.startsWith('https://')) {
      try {
        const res = await fetch(cleanSlug, { signal: AbortSignal.timeout(6000) });
        if (res.ok) {
          const text = await res.text();
          const skill: EdgeSkill = {
            name: cleanSlug.split('/').pop()?.replace(/\.md$/, '') || 'remote-skill',
            slug: cleanSlug,
            instructions: text,
            source: 'skills.sh',
            cachedAt: Date.now()
          };
          skillMemoryCache.set(cleanSlug, skill);
          return skill;
        }
      } catch {}
    }

    // 3. skills.sh / GitHub Slug (e.g. "vercel-labs/find-skills" or "skills.sh/vercel-labs/find-skills")
    const id = cleanSlug.replace(/^skills\.sh\//, '').replace(/^github:/, '');
    const idParts = id.split('/');

    if (idParts.length >= 2) {
      // 3a. Try skills.sh API
      try {
        const apiUrl = `https://skills.sh/api/v1/skills/${id}`;
        const res = await fetch(apiUrl, { signal: AbortSignal.timeout(6000) });
        if (res.ok) {
          const data: any = await res.json();
          const skillFile = data.files?.find((f: any) => f.path === 'SKILL.md' || f.path.endsWith('.md')) || data.files?.[0];
          if (skillFile?.contents) {
            const skill: EdgeSkill = {
              name: idParts.slice(1).join('-'),
              slug: id,
              instructions: skillFile.contents,
              source: 'skills.sh',
              cachedAt: Date.now()
            };
            skillMemoryCache.set(cleanSlug, skill);
            return skill;
          }
        }
      } catch {}

      // 3b. Resolve from GitHub Raw & Tree
      const owner = idParts[0];
      const repo = idParts[1];
      const targetSkill = idParts.slice(2).join('/') || repo;

      const candidateUrls = [
        `https://raw.githubusercontent.com/${owner}/${repo}/main/skills/${targetSkill}/SKILL.md`,
        `https://raw.githubusercontent.com/${owner}/${repo}/main/${targetSkill}/SKILL.md`,
        `https://raw.githubusercontent.com/${owner}/${repo}/main/skills/productivity/${targetSkill}/SKILL.md`,
        `https://raw.githubusercontent.com/${owner}/${repo}/main/skills/engineering/${targetSkill}/SKILL.md`,
        `https://raw.githubusercontent.com/${owner}/${repo}/main/skills/design/${targetSkill}/SKILL.md`,
        `https://raw.githubusercontent.com/${owner}/${repo}/main/skills/${repo}/SKILL.md`,
        `https://raw.githubusercontent.com/${owner}/${repo}/main/SKILL.md`,
        `https://raw.githubusercontent.com/${owner}/${repo}/master/SKILL.md`
      ];

      for (const url of candidateUrls) {
        try {
          const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
          if (res.ok) {
            const text = await res.text();
            if (text && !text.includes('404: Not Found')) {
              const skill: EdgeSkill = {
                name: targetSkill || `${owner}/${repo}`,
                slug: id,
                instructions: text,
                source: 'github',
                cachedAt: Date.now()
              };
              skillMemoryCache.set(cleanSlug, skill);
              return skill;
            }
          }
        } catch {}
      }

      // 3c. Dynamic GitHub Tree Discovery for arbitrary nested paths
      try {
        const treeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/main?recursive=1`, {
          headers: { 'User-Agent': 'OpenLiate' },
          signal: AbortSignal.timeout(6000)
        });
        if (treeRes.ok) {
          const treeData: any = await treeRes.json();
          const matchedPath = treeData.tree?.find((item: any) => {
            const p = item.path.toLowerCase();
            return (p.endsWith('skill.md') || p.endsWith('skill')) && p.includes(targetSkill.toLowerCase());
          })?.path;

          if (matchedPath) {
            const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/main/${matchedPath}`;
            const fileRes = await fetch(rawUrl, { signal: AbortSignal.timeout(5000) });
            if (fileRes.ok) {
              const text = await fileRes.text();
              const skill: EdgeSkill = {
                name: targetSkill || `${owner}/${repo}`,
                slug: id,
                instructions: text,
                source: 'github',
                cachedAt: Date.now()
              };
              skillMemoryCache.set(cleanSlug, skill);
              return skill;
            }
          }
        }
      } catch {}
    }

    const resolvedName = idParts[idParts.length - 1] || cleanSlug.split('/').pop()?.replace(/\.md$/, '') || 'skill';
    return {
      name: resolvedName,
      slug: cleanSlug,
      instructions: cleanSlug,
      source: 'skill' as any,
      cachedAt: Date.now()
    };
  }

  /**
   * List all currently cached edge skills
   */
  public static listCached(): EdgeSkill[] {
    return Array.from(skillMemoryCache.values());
  }

  /**
   * Clear edge memory cache
   */
  public static clearCache(): void {
    skillMemoryCache.clear();
  }
}

