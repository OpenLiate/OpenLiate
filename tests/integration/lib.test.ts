import { describe, it, expect } from "bun:test";
import { LiateLib } from "../../src/layers/integration/lib";

describe("Layer [I] LiateLib Integration Suite", () => {
  it("dynamically imports standard library module", async () => {
    const loaded = await LiateLib.import("node:path");

    expect(loaded).toBeDefined();
    expect(loaded.name).toBe("node:path");
    expect(loaded.exports.length).toBeGreaterThan(0);
    expect(loaded.exports).toContain("join");
  });

  it("resolves declared libraries and synthesizes agent tools", async () => {
    const loadedMap = await LiateLib.resolveLibs(["node:path"]);
    expect(loadedMap.has("node:path")).toBe(true);

    const tools = LiateLib.asTools(loadedMap);
    expect(tools.length).toBeGreaterThan(0);
    const joinTool = tools.find((t) => t.name.includes("join"));
    expect(joinTool).toBeDefined();
  });

  it("handles record alias library maps", async () => {
    const loadedMap = await LiateLib.resolveLibs({
      pathHelper: "node:path"
    });

    expect(loadedMap.has("pathHelper")).toBe(true);
    const tools = LiateLib.asTools(loadedMap);
    expect(tools.some((t) => t.name.includes("pathHelper"))).toBe(true);
  });
});

