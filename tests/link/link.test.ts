import { describe, it, expect } from "bun:test";
import {
  link,
  linkNeon,
  linkVercel,
  linkSupabase,
  relink,
  unlink
} from "../../src/link/index";

describe("Cloud Link: Multi-Cloud Mesh (liate link / relink / unlink)", () => {
  it("exports link, linkNeon, linkVercel, linkSupabase, relink, and unlink functions", () => {
    expect(typeof link).toBe("function");
    expect(typeof linkNeon).toBe("function");
    expect(typeof linkVercel).toBe("function");
    expect(typeof linkSupabase).toBe("function");
    expect(typeof relink).toBe("function");
    expect(typeof unlink).toBe("function");
  });
});

