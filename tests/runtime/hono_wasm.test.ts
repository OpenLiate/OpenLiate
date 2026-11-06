import { describe, it, expect } from "bun:test";
import honoApp, { createRuntimeApp, startRuntimeServer } from "../../src/cloud/runtime/hono";
import wasmEntry from "../../src/cloud/runtime/wasm";

describe("Unified Runtime Suite: hono.ts & wasm.ts", () => {
  describe("1. Universal Web Standards Hono Engine (hono.ts)", () => {
    it("handles native Web Standards Request on GET /health", async () => {
      const req = new Request("http://localhost/health");
      const res = await honoApp.fetch(req);
      expect(res.status).toBe(200);

      const data = await res.json() as any;
      expect(data.status).toBe("ok");
      expect(data.runtime).toBe("openliate");
      expect(data.protocol).toBe("LAPI/v1");
      expect(data.doctrine).toContain("Sovereign AI Agents");
    });

    it("handles native Web Standards Request on GET / (Catalog & Routes)", async () => {
      const req = new Request("http://localhost/");
      const res = await honoApp.fetch(req);
      expect(res.status).toBe(200);

      const data = await res.json() as any;
      expect(data.name).toBe("OpenLiate");
      expect(data.endpoints.chat).toBe("POST /chat");
      expect(data.endpoints.models).toBe("GET /models");
      expect(data.endpoints.openai_chat).toBe("POST /v1/chat/completions");
      expect(data.endpoints.openai_models).toBe("GET /v1/models");
    });

    it("returns OpenAI-compatible model registry via GET /v1/models", async () => {
      const req = new Request("http://localhost/v1/models");
      const res = await honoApp.fetch(req);
      expect(res.status).toBe(200);

      const data = await res.json() as any;
      expect(data.object).toBe("list");
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.data.length).toBeGreaterThanOrEqual(2);
    });

    it("starts and stops local runtime server cleanly", async () => {
      const serverInstance = startRuntimeServer({ port: 7099, host: "127.0.0.1" });
      expect(serverInstance.port).toBe(7099);
      expect(typeof serverInstance.close).toBe("function");
      serverInstance.close();
    });
  });

  describe("2. Fastly WebAssembly Runtime Engine (wasm.ts)", () => {
    it("exports standard fetch interface accepting Web Request, env, and ctx", async () => {
      expect(typeof wasmEntry.fetch).toBe("function");

      const req = new Request("http://localhost/health");
      const res = await wasmEntry.fetch(req, {}, {});
      expect(res.status).toBe(200);

      const data = await res.json() as any;
      expect(data.status).toBe("ok");
      expect(data.runtime).toBe("openliate");
      expect(data.protocol).toBe("LAPI/v1");
    });

    it("proxies /v1/models through the WASM entrypoint", async () => {
      const req = new Request("http://localhost/v1/models");
      const res = await wasmEntry.fetch(req);
      expect(res.status).toBe(200);

      const data = await res.json() as any;
      expect(data.object).toBe("list");
      expect(Array.isArray(data.data)).toBe(true);
    });

    it("validates invalid POST /run request body gracefully", async () => {
      const req = new Request("http://localhost/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
      const res = await wasmEntry.fetch(req);
      expect(res.status).toBe(400);

      const err = await res.json() as any;
      expect(err.error).toContain("prompt");
    });
  });
});

