import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export interface RepoIssue {
  number: number;
  title: string;
  state: string;
  author?: string;
  labels?: string[];
  createdAt?: string;
  url?: string;
}

export interface RepoPullRequest {
  number: number;
  title: string;
  state: string;
  author?: string;
  draft?: boolean;
  createdAt?: string;
  url?: string;
}

export interface RepoRelease {
  tag: string;
  name: string;
  publishedAt?: string;
}

export interface RepoContext {
  repo: string;
  branch?: string;
  files?: string[];
  readme?: string;
  recentCommits?: string[];
  issues?: RepoIssue[];
  pullRequests?: RepoPullRequest[];
  releases?: RepoRelease[];
}

export interface RepoOptions {
  issues?: boolean | number;
  pulls?: boolean | number;
  commits?: boolean | number;
  releases?: boolean | number;
}

export class LiateRepo {
  /**
   * Resolves repository context either from local git repository (if in Codespaces/local)
   * or via GitHub API (if on serverless edge).
   */
  public static async resolveContext(repoNameOrPath: string, options?: RepoOptions): Promise<RepoContext> {
    const isLocalDir = fs.existsSync(repoNameOrPath) || repoNameOrPath === "." || repoNameOrPath.startsWith("./");

    if (isLocalDir) {
      return this.getLocalContext(repoNameOrPath, options);
    }

    // Try detecting if current directory matches repoNameOrPath or is a git repo
    try {
      const gitRemote = execSync("git remote get-url origin", { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }).trim();
      if (gitRemote.includes(repoNameOrPath)) {
        return this.getLocalContext(".", options);
      }
    } catch {}

    // Remote repo resolution via GitHub API (Edge cloud)
    return this.getRemoteContext(repoNameOrPath, options);
  }

  public static getLocalContext(dir: string, options?: RepoOptions): RepoContext {
    let branch = "main";
    let recentCommits: string[] = [];
    let files: string[] = [];
    let readme = "";

    try {
      branch = execSync("git rev-parse --abbrev-ref HEAD", { cwd: dir, encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    } catch {}

    try {
      const commitLimit = typeof options?.commits === "number" ? options.commits : 5;
      const commitLog = execSync(`git log -n ${commitLimit} --oneline`, { cwd: dir, encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }).trim();
      recentCommits = commitLog.split("\n").filter(Boolean);
    } catch {}

    try {
      const gitFiles = execSync("git ls-files", { cwd: dir, encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }).trim();
      files = gitFiles.split("\n").filter(Boolean).slice(0, 100);
    } catch {}

    const readmeCandidates = ["README.md", "readme.md", "README", "readme.txt"];
    for (const rName of readmeCandidates) {
      const readmePath = path.join(dir, rName);
      if (fs.existsSync(readmePath)) {
        try {
          readme = fs.readFileSync(readmePath, "utf-8").slice(0, 2000);
          break;
        } catch {}
      }
    }

    return {
      repo: dir,
      branch,
      files,
      readme,
      recentCommits
    };
  }

  public static async getRemoteContext(repoSlug: string, options?: RepoOptions): Promise<RepoContext> {
    const cleanRepo = repoSlug.replace(/^github\.com\//, "").replace(/^https?:\/\/github\.com\//, "");
    let branch = "main";
    let files: string[] = [];
    let readme = "";
    let recentCommits: string[] = [];
    let issues: RepoIssue[] = [];
    let pullRequests: RepoPullRequest[] = [];
    let releases: RepoRelease[] = [];

    const headers: Record<string, string> = {
      "User-Agent": "OpenLiate-Agent-Runtime"
    };
    if (process.env.GITHUB_TOKEN) {
      headers["Authorization"] = `token ${process.env.GITHUB_TOKEN}`;
    }

    // 1. Resolve default branch
    try {
      const repoInfoRes = await fetch(`https://api.github.com/repos/${cleanRepo}`, { headers });
      if (repoInfoRes.ok) {
        const repoData: any = await repoInfoRes.json();
        if (repoData.default_branch) {
          branch = repoData.default_branch;
        }
      }
    } catch {}

    // 2. Fetch repository file tree
    try {
      const treeRes = await fetch(`https://api.github.com/repos/${cleanRepo}/git/trees/${branch}?recursive=1`, { headers });
      if (treeRes.ok) {
        const treeData: any = await treeRes.json();
        if (treeData.tree && Array.isArray(treeData.tree)) {
          files = treeData.tree.map((f: any) => f.path).slice(0, 100);
        }
      }
    } catch {}

    // 3. Fetch recent commits
    try {
      const commitLimit = typeof options?.commits === "number" ? options.commits : 5;
      const commitsRes = await fetch(`https://api.github.com/repos/${cleanRepo}/commits?sha=${branch}&per_page=${commitLimit}`, { headers });
      if (commitsRes.ok) {
        const commitsData: any = await commitsRes.json();
        if (Array.isArray(commitsData)) {
          recentCommits = commitsData.map((c: any) => `${c.sha.slice(0, 7)} ${c.commit?.message?.split("\n")[0]}`);
        }
      }
    } catch {}

    // 4. Fetch README
    try {
      const readmeRes = await fetch(`https://api.github.com/repos/${cleanRepo}/readme`, {
        headers: {
          ...headers,
          Accept: "application/vnd.github.raw"
        }
      });
      if (readmeRes.ok) {
        readme = (await readmeRes.text()).slice(0, 2000);
      } else {
        const rawRes = await fetch(`https://raw.githubusercontent.com/${cleanRepo}/${branch}/README.md`, { headers });
        if (rawRes.ok) {
          readme = (await rawRes.text()).slice(0, 2000);
        }
      }
    } catch {}

    // 5. Fetch Open Issues
    if (options?.issues) {
      try {
        const issueLimit = typeof options.issues === "number" ? options.issues : 8;
        const issuesRes = await fetch(`https://api.github.com/repos/${cleanRepo}/issues?state=open&per_page=${issueLimit * 2}`, { headers });
        if (issuesRes.ok) {
          const rawItems: any = await issuesRes.json();
          if (Array.isArray(rawItems)) {
            issues = rawItems
              .filter((item: any) => !item.pull_request)
              .slice(0, issueLimit)
              .map((item: any) => ({
                number: item.number,
                title: item.title,
                state: item.state,
                author: item.user?.login,
                labels: Array.isArray(item.labels) ? item.labels.map((l: any) => l.name) : [],
                createdAt: item.created_at,
                url: item.html_url
              }));
          }
        }
      } catch {}
    }

    // 6. Fetch Open Pull Requests
    if (options?.pulls) {
      try {
        const pullsLimit = typeof options.pulls === "number" ? options.pulls : 8;
        const pullsRes = await fetch(`https://api.github.com/repos/${cleanRepo}/pulls?state=open&per_page=${pullsLimit}`, { headers });
        if (pullsRes.ok) {
          const rawPulls: any = await pullsRes.json();
          if (Array.isArray(rawPulls)) {
            pullRequests = rawPulls.slice(0, pullsLimit).map((pr: any) => ({
              number: pr.number,
              title: pr.title,
              state: pr.state,
              author: pr.user?.login,
              draft: Boolean(pr.draft),
              createdAt: pr.created_at,
              url: pr.html_url
            }));
          }
        }
      } catch {}
    }

    // 7. Fetch Releases
    if (options?.releases) {
      try {
        const releasesLimit = typeof options.releases === "number" ? options.releases : 5;
        const releasesRes = await fetch(`https://api.github.com/repos/${cleanRepo}/releases?per_page=${releasesLimit}`, { headers });
        if (releasesRes.ok) {
          const rawReleases: any = await releasesRes.json();
          if (Array.isArray(rawReleases)) {
            releases = rawReleases.slice(0, releasesLimit).map((rel: any) => ({
              tag: rel.tag_name,
              name: rel.name || rel.tag_name,
              publishedAt: rel.published_at
            }));
          }
        }
      } catch {}
    }

    return {
      repo: cleanRepo,
      branch,
      files,
      readme,
      recentCommits,
      issues: issues.length > 0 ? issues : undefined,
      pullRequests: pullRequests.length > 0 ? pullRequests : undefined,
      releases: releases.length > 0 ? releases : undefined
    };
  }
}

