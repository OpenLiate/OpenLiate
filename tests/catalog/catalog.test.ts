import { describe, it, expect } from "bun:test";
import { Sarvam, SARVAM_MODELS } from "../../src/catalog/sarvam/index";
import { Neon } from "../../src/catalog/neon/index";
import { Vercel } from "../../src/catalog/vercel/index";
import { Supabase } from "../../src/catalog/supabase/index";
import { Agent } from "../../src/layers/agent/harness";

describe("OpenLiate Catalog (Official 2026 SDK Stack)", () => {
  it("Sarvam Catalog: exports official models and SarvamAIClient instance", () => {
    expect(SARVAM_MODELS["sarvam-105b"]).toBeDefined();
    expect(SARVAM_MODELS["sarvam-105b"].contextWindow).toBe(128000);
    expect(SARVAM_MODELS["glm5.3"].contextWindow).toBe(1000000);
    expect(SARVAM_MODELS["bulbul-v4-flash"]).toBeDefined();
    expect(SARVAM_MODELS["saaras-v4"]).toBeDefined();

    const client = Sarvam.client("dummy_test_key");
    expect(client).toBeDefined();
    expect(client.raw).toBeDefined();
    expect(client.raw.chat).toBeDefined();
    expect(client.raw.textToSpeech).toBeDefined();
    expect(client.raw.speechToText).toBeDefined();
    expect(client.raw.text).toBeDefined();
  });

  it("Neon Catalog: initializes NeonDatabase and exposes serverless SQL driver", () => {
    expect(Neon.db).toBeDefined();
    expect(Neon.vector).toBeDefined();
    expect(Neon.mcp.oauth).toBeDefined();

    const db = Neon.db({ connectionString: "postgresql://user:pass@ep-cool-123.ap-southeast-1.aws.neon.tech/neondb?sslmode=require" });
    expect(db).toBeDefined();
    expect(db.sql).toBeDefined();
    expect(typeof db.createPool).toBe("function");
  });

  it("Vercel Catalog: exposes oauth, client, deploy, and official @vercel/sdk instance", () => {
    expect(Vercel.oauth).toBeDefined();
    expect(typeof Vercel.client).toBe("function");
    expect(typeof Vercel.deploy).toBe("function");
    expect(typeof Vercel.sdk).toBe("function");

    const vercelClient = Vercel.sdk("dummy_vercel_token");
    expect(vercelClient).toBeDefined();
    expect(vercelClient.deployments).toBeDefined();
  });

  it("Supabase Catalog: initializes SupabaseDatabase and exposes official SDK", () => {
    expect(Supabase.db).toBeDefined();
    expect(Supabase.oauth).toBeDefined();
    expect(typeof Supabase.client).toBe("function");
    expect(typeof Supabase.deploy).toBe("function");

    const db = Supabase.db({ supabaseUrl: "https://xyz.supabase.co", supabaseKey: "anon-key" });
    expect(db).toBeDefined();
    expect(db.client).toBeDefined();
  });

  it("Agent toHandler(): generates standard web request handler (Way 2)", async () => {
    const agent = new Agent({
      manifest: {
        L: "sarvam/sarvam-105b",
        I: { memory: "sessions/test" },
        A: { name: "handler_test", intent: "Handler Test Agent" },
        T: [],
        E: {}
      }
    });

    const handler = agent.toHandler();
    expect(typeof handler).toBe("function");

    // Test rejection of empty prompt
    const badReq = new Request("http://localhost:3000/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });

    const res = await handler(badReq);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Missing required 'prompt'");
  });
});
