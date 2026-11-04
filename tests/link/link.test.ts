import { describe, it, expect } from "bun:test";
import path from "path";
import {
  link,
  linkNeon,
  linkVercel,
  linkSupabase,
  relink,
  unlink
} from "../../src/link/index";
import { NeonMcpOAuth } from "../../src/link/neon";
import { VercelMcpOAuth } from "../../src/link/vercel";
import { SupabaseMcpOAuth } from "../../src/link/supabase";

describe("Cloud Link: Multi-Cloud (openliate link / relink / unlink)", () => {
  it("exports link, linkNeon, linkVercel, linkSupabase, relink, and unlink functions", () => {
    expect(typeof link).toBe("function");
    expect(typeof linkNeon).toBe("function");
    expect(typeof linkVercel).toBe("function");
    expect(typeof linkSupabase).toBe("function");
    expect(typeof relink).toBe("function");
    expect(typeof unlink).toBe("function");
  });

  it("stores provider cloud credentials inside .openliate/link/ folder", () => {
    const neonPath = NeonMcpOAuth.getTokenPath();
    expect(neonPath).toContain(".openliate");
    expect(neonPath).toContain("link");
    expect(path.basename(neonPath)).toBe("neon.json");

    const vercelPath = VercelMcpOAuth.getTokenPath();
    expect(vercelPath).toContain(".openliate");
    expect(vercelPath).toContain("link");
    expect(path.basename(vercelPath)).toBe("vercel.json");

    const supabasePath = SupabaseMcpOAuth.getTokenPath();
    expect(supabasePath).toContain(".openliate");
    expect(supabasePath).toContain("link");
    expect(path.basename(supabasePath)).toBe("supabase.json");
  });
});
