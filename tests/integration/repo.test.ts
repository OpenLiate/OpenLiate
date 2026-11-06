import { describe, it, expect } from "bun:test";
import { LiateRepo } from "../../src/layers/integration/repo";
import path from "node:path";

describe("Layer [I] LiateRepo Integration Suite", () => {
  it("resolves local git repository context", async () => {
    const context = await LiateRepo.resolveContext(".", { commits: 3 });

    expect(context).toBeDefined();
    expect(context.repo).toBe(".");
    expect(typeof context.branch).toBe("string");
    expect(Array.isArray(context.files)).toBe(true);
    expect(Array.isArray(context.recentCommits)).toBe(true);
    expect(typeof context.readme).toBe("string");
  });

  it("getLocalContext extracts branches and files from current directory", () => {
    const context = LiateRepo.getLocalContext(".", { commits: 2 });
    expect(context.branch).toBeDefined();
    expect(context.files).toBeDefined();
    expect(context.files!.length).toBeGreaterThan(0);
  });

  it("getRemoteContext cleanly formats repo slug without protocol prefixes", async () => {
    // Test remote resolver with non-existent or test repo slug
    const context = await LiateRepo.getRemoteContext("github.com/OpenLiate/OpenLiate", { commits: 1 });
    expect(context.repo).toBe("OpenLiate/OpenLiate");
    expect(context.branch).toBeDefined();
  });
});

