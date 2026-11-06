import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import fs from "fs";
import path from "path";
import os from "os";
import { CloudflareMcpOAuth, runCloudflareLinkFlow, deployCloudflare } from "../../src/cloud/worldwide/cloudflare";
import { AzionMcpOAuth, runAzionLinkFlow, deployAzion } from "../../src/cloud/worldwide/azion";
import { FastlyLink, runFastlyLinkFlow, deployFastly } from "../../src/cloud/worldwide/fastly";
import { link, unlink } from "../../src/cloud/link";

describe("Phase 2 Expansion: Worldwide Edge Cloud (16M Runs)", () => {
  const tempDir = path.join(os.tmpdir(), "openliate-edge-test-" + Date.now());

  beforeEach(() => {
    fs.mkdirSync(tempDir, { recursive: true });
    process.env.OPENLIATE_CONFIG_DIR = tempDir;
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
    delete process.env.OPENLIATE_CONFIG_DIR;
    delete process.env.FASTLY_API_TOKEN;
    delete process.env.CLOUDFLARE_API_TOKEN;
    delete process.env.AZION_PERSONAL_TOKEN;
  });

  describe("1. Fastly Compute (10M Runs · Direct API Key & @fastly/mcp)", () => {
    it("saves and loads Fastly API token without OAuth", () => {
      FastlyLink.saveToken({
        api_token: "fastly-test-token-1234567890",
        customer_id: "cust-test-1",
        saved_at: new Date().toISOString()
      });

      const loaded = FastlyLink.loadSavedToken();
      expect(loaded).not.toBeNull();
      expect(loaded?.api_token).toBe("fastly-test-token-1234567890");
      expect(loaded?.customer_id).toBe("cust-test-1");
    });

    it("clears Fastly saved token on unlink", () => {
      FastlyLink.saveToken({
        api_token: "fastly-to-clear",
        saved_at: new Date().toISOString()
      });
      expect(FastlyLink.loadSavedToken()).not.toBeNull();

      FastlyLink.clearSavedToken();
      expect(FastlyLink.loadSavedToken()).toBeNull();
    });

    it("configures Fastly MCP server in .openliate/mcp.json", () => {
      FastlyLink.configureMcpServer("test-fastly-token");
      const mcpPath = path.resolve(process.cwd(), ".openliate", "mcp.json");
      expect(fs.existsSync(mcpPath)).toBe(true);

      const mcpJson = JSON.parse(fs.readFileSync(mcpPath, "utf-8"));
      expect(mcpJson.mcpServers.fastly).toBeDefined();
      expect(mcpJson.mcpServers.fastly.env.FASTLY_API_TOKEN).toBe("test-fastly-token");
    });

    it("verifies Fastly token against API", async () => {
      const origFetch = globalThis.fetch;
      globalThis.fetch = (async (url: any) => {
        if (String(url).includes("api.fastly.com/verify")) {
          return new Response(JSON.stringify({ user: { id: "u1", name: "test" }, customer: { id: "c1" } }), { status: 200 });
        }
        return origFetch(url);
      }) as any;

      try {
        const res = await FastlyLink.verifyToken("fastly-valid-token-long-enough");
        expect(res.valid).toBe(true);
      } finally {
        globalThis.fetch = origFetch;
      }
    });

    it("executes runFastlyLinkFlow with explicit key", async () => {
      const token = await runFastlyLinkFlow("fastly-api-key-test-99999");
      expect(token).toBe("fastly-api-key-test-99999");

      const loaded = FastlyLink.loadSavedToken();
      expect(loaded?.api_token).toBe("fastly-api-key-test-99999");
    });
  });

  describe("2. Cloudflare Workers (3M Runs · V8 Isolates)", () => {
    it("saves and loads Cloudflare credentials", () => {
      CloudflareMcpOAuth.saveToken({
        access_token: "cf-token-123456789012345",
        account_id: "cf-acc-123",
        saved_at: new Date().toISOString()
      });

      const loaded = CloudflareMcpOAuth.loadSavedToken();
      expect(loaded).not.toBeNull();
      expect(loaded?.access_token).toBe("cf-token-123456789012345");
      expect(loaded?.account_id).toBe("cf-acc-123");
    });

    it("generates standard Cloudflare Workers script", () => {
      const script = CloudflareMcpOAuth.generateWorkerScript();
      expect(script).toContain("Cloudflare Workers");
      expect(script).toContain("runtimeApp.fetch");
    });

    it("clears Cloudflare credentials on unlink", () => {
      CloudflareMcpOAuth.saveToken({
        access_token: "cf-token-to-delete",
        saved_at: new Date().toISOString()
      });
      expect(CloudflareMcpOAuth.loadSavedToken()).not.toBeNull();

      CloudflareMcpOAuth.clearSavedToken();
      expect(CloudflareMcpOAuth.loadSavedToken()).toBeNull();
    });

    it("executes runCloudflareLinkFlow with key", async () => {
      const token = await runCloudflareLinkFlow("cf-token-key-long-enough-for-test");
      expect(token).toBe("cf-token-key-long-enough-for-test");
    });
  });

  describe("3. Azion Edge Functions (3M Runs · 500+ PoPs)", () => {
    it("saves and loads Azion credentials", () => {
      AzionMcpOAuth.saveToken({
        personal_token: "azion-personal-token-test-12345",
        saved_at: new Date().toISOString()
      });

      const loaded = AzionMcpOAuth.loadSavedToken();
      expect(loaded).not.toBeNull();
      expect(loaded?.personal_token).toBe("azion-personal-token-test-12345");
    });

    it("generates standard Azion Edge script", () => {
      const script = AzionMcpOAuth.generateEdgeScript();
      expect(script).toContain("Azion");
      expect(script).toContain("./azion");
      expect(script).toContain("app.fetch");
      expect(script).toContain("async fetch(request, env, ctx)");
    });

    it("clears Azion credentials on unlink", () => {
      AzionMcpOAuth.saveToken({
        personal_token: "azion-token-to-delete",
        saved_at: new Date().toISOString()
      });
      expect(AzionMcpOAuth.loadSavedToken()).not.toBeNull();

      AzionMcpOAuth.clearSavedToken();
      expect(AzionMcpOAuth.loadSavedToken()).toBeNull();
    });

    it("configures all 5 official Azion MCP servers in .openliate/mcp.json", () => {
      AzionMcpOAuth.configureMcpServer("test-azion-token-999");
      const mcpPath = path.resolve(process.cwd(), ".openliate", "mcp.json");
      expect(fs.existsSync(mcpPath)).toBe(true);

      const mcpJson = JSON.parse(fs.readFileSync(mcpPath, "utf-8"));
      expect(mcpJson.mcpServers["azion-build"]).toBeDefined();
      expect(mcpJson.mcpServers["azion-build"].url).toBe("https://build-mcp.azion.com/mcp");
      expect(mcpJson.mcpServers["azion-docs"]).toBeDefined();
      expect(mcpJson.mcpServers["azion-docs"].url).toBe("https://docs-mcp.azion.com/mcp");
      expect(mcpJson.mcpServers["azion-storage"]).toBeDefined();
      expect(mcpJson.mcpServers["azion-storage"].url).toBe("https://storage-mcp.azion.com/mcp");
      expect(mcpJson.mcpServers["azion-secure"]).toBeDefined();
      expect(mcpJson.mcpServers["azion-observe"]).toBeDefined();
    });

    it("executes runAzionLinkFlow with key", async () => {
      const token = await runAzionLinkFlow("azion-token-key-test-long");
      expect(token).toBe("azion-token-key-test-long");
    });
  });

  describe("4. Unified Link & Unlink across all 6 Sovereign Clouds", () => {
    it("unlinks all edge clouds cleanly via unlink('all')", async () => {
      CloudflareMcpOAuth.saveToken({ access_token: "cf-test", saved_at: "" });
      AzionMcpOAuth.saveToken({ personal_token: "az-test", saved_at: "" });
      FastlyLink.saveToken({ api_token: "fa-test", saved_at: "" });

      await unlink("all");

      expect(CloudflareMcpOAuth.loadSavedToken()).toBeNull();
      expect(AzionMcpOAuth.loadSavedToken()).toBeNull();
      expect(FastlyLink.loadSavedToken()).toBeNull();
    });
  });

  describe("5. RFC 9562 UUIDv7 Unique Deployment Identifiers & Slugs", () => {
    it("deployFastly generates unique UUIDv7, slug, and runtimeUrl", async () => {
      FastlyLink.saveToken({ api_token: "fa-mock-token-for-uuid7-test", saved_at: "" });
      const dep = await deployFastly({ agent: "test-agent", serviceId: "zgVVe4eR1vyv0pZn73g9M9" });

      expect(dep.uuid7).toBeDefined();
      expect(dep.uuid7.length).toBe(36);
      expect(dep.slug).toContain("test-agent");
      expect(dep.runtimeUrl).toContain(dep.slug);
      expect(dep.runtimeUrl).toContain("run");
    });

    it("deployCloudflare generates unique UUIDv7, slug, and runtimeUrl", async () => {
      CloudflareMcpOAuth.saveToken({ access_token: "cf-mock-token-for-uuid7-test", account_id: "test-acc-123", saved_at: "" });
      const dep = await deployCloudflare({ agent: "email-agent" });

      expect(dep.uuid7).toBeDefined();
      expect(dep.uuid7.length).toBe(36);
      expect(dep.slug).toContain("email-agent");
      expect(dep.runtimeUrl).toContain(dep.slug);
      expect(dep.runtimeUrl).toContain("workers.dev/run");
    });

    it("deployAzion generates unique UUIDv7, slug, and runtimeUrl", async () => {
      AzionMcpOAuth.saveToken({ personal_token: "az-mock-token-for-uuid7-test", saved_at: "" });
      const dep = await deployAzion({ agent: "auditor" });

      expect(dep.uuid7).toBeDefined();
      expect(dep.uuid7.length).toBe(36);
      expect(dep.slug).toContain("auditor");
      expect(dep.runtimeUrl).toContain(dep.slug);
      expect(dep.runtimeUrl).toContain("azionedge.net");
    });
  });
});

