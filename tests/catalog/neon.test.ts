import { describe, it, expect } from "bun:test";
import {
  Neon,
  NeonDatabase,
  NeonVectorStore,
  createClaimableDatabase,
  validateNeonCron,
  createScheduledHandler,
  NeonTriggers
} from "../../src/catalog/neon/index";
import fs from "fs";
import path from "path";

describe("Neon Catalog — Comprehensive Sprint 1 Suite", () => {
  describe("1. Neon Database & pgvector", () => {
    it("NeonDatabase: throws helpful error if DATABASE_URL is not set", () => {
      const origUrl = process.env.DATABASE_URL;
      const origNeonUrl = process.env.NEON_DATABASE_URL;
      delete process.env.DATABASE_URL;
      delete process.env.NEON_DATABASE_URL;

      try {
        const db = new NeonDatabase({});
        expect(() => db.sql).toThrow("Missing Neon DATABASE_URL");
        expect(() => db.createPool()).toThrow("Missing Neon DATABASE_URL");
      } finally {
        if (origUrl) process.env.DATABASE_URL = origUrl;
        if (origNeonUrl) process.env.NEON_DATABASE_URL = origNeonUrl;
      }
    });

    it("NeonDatabase: accepts explicit connection string and provides tagged sql and pool", () => {
      const connStr = "postgresql://tester:secret@ep-cool-1234.us-east-2.aws.neon.tech/neondb?sslmode=require";
      const db = Neon.db({ connectionString: connStr });
      expect(db).toBeDefined();
      expect(typeof db.sql).toBe("function");
      
      const pool = db.createPool();
      expect(pool).toBeDefined();
    });

    it("NeonVectorStore: initializes vector store facade with default and custom tables", () => {
      const db = Neon.db({ connectionString: "postgresql://tester:secret@ep-cool-1234.us-east-2.aws.neon.tech/neondb" });
      const vectorStore = Neon.vector(db, "custom_agent_embeddings");
      expect(vectorStore).toBeDefined();
      expect(typeof vectorStore.init).toBe("function");
    });
  });

  describe("2. Claimable Neon (neon-new)", () => {
    it("exports Neon.claimable, Neon.instant, and createClaimableDatabase", () => {
      expect(typeof Neon.claimable).toBe("function");
      expect(typeof Neon.instant).toBe("function");
      expect(typeof createClaimableDatabase).toBe("function");
    });
  });

  describe("3. Neon Scheduled Function Triggers", () => {
    it("validateNeonCron: correctly verifies 5-field numeric UTC expressions", () => {
      expect(validateNeonCron("* * * * *").valid).toBe(true);
      expect(validateNeonCron("*/15 * * * *").valid).toBe(true);
      expect(validateNeonCron("0 9 * * 1-5").valid).toBe(true);
      expect(validateNeonCron("0,30 * * * *").valid).toBe(true);
      expect(validateNeonCron("15 14 1 * *").valid).toBe(true);
    });

    it("validateNeonCron: rejects invalid expressions matching Neon specifications", () => {
      // 6 fields (seconds)
      const secResult = validateNeonCron("* * * * * *");
      expect(secResult.valid).toBe(false);
      expect(secResult.error).toContain("seconds field");

      // Macro expressions
      const macroResult = validateNeonCron("@daily");
      expect(macroResult.valid).toBe(false);
      expect(macroResult.error).toContain("macro expressions");

      // Zero step
      const stepZeroResult = validateNeonCron("*/0 * * * *");
      expect(stepZeroResult.valid).toBe(false);
      expect(stepZeroResult.error).toContain("zero step");

      // Named days/months
      const namedResult = validateNeonCron("0 9 * * MON");
      expect(namedResult.valid).toBe(false);
      expect(namedResult.error).toContain("named days or months");
    });

    it("Neon.scheduled: rejects requests missing X-Neon-Trigger-Invocation-Id header", async () => {
      const handler = createScheduledHandler(async () => ({ executed: true }));

      let statusCode = 200;
      let responseBody: any = null;

      const mockContext = {
        req: {
          header: (name: string) => null,
          json: async () => ({})
        },
        json: (body: any, status: number = 200) => {
          statusCode = status;
          responseBody = body;
          return { status, body };
        }
      };

      await handler(mockContext);
      expect(statusCode).toBe(403);
      expect(responseBody.error).toBe("not a trigger call");
    });

    it("Neon.schedule: executes scheduled task when valid X-Neon-Trigger-Invocation-Id is provided", async () => {
      let capturedScheduledAt = "";
      let capturedInvocationId = "";

      const scheduledHandler = Neon.schedule(async (event) => {
        capturedScheduledAt = event.scheduledAt;
        capturedInvocationId = event.invocationId || "";
        return { message: "Report generated successfully" };
      });

      let statusCode = 200;
      let responseBody: any = null;

      const mockContext = {
        req: {
          header: (name: string) => {
            if (name.toLowerCase() === "x-neon-trigger-invocation-id") {
              return "inv-test-9988";
            }
            return null;
          },
          json: async () => ({
            data: { scheduled_at: "2026-11-04T12:00:00.000Z" },
            trigger: "daily-sync-trigger"
          })
        },
        json: (body: any, status: number = 200) => {
          statusCode = status;
          responseBody = body;
          return { status, body };
        }
      };

      await scheduledHandler(mockContext);
      expect(statusCode).toBe(200);
      expect(responseBody.ok).toBe(true);
      expect(responseBody.scheduled_at).toBe("2026-11-04T12:00:00.000Z");
      expect(responseBody.invocation_id).toBe("inv-test-9988");
      expect(responseBody.result.message).toBe("Report generated successfully");
      expect(capturedScheduledAt).toBe("2026-11-04T12:00:00.000Z");
      expect(capturedInvocationId).toBe("inv-test-9988");
    });

    it("Neon.scheduler: initializes triggers API manager and validates required parameters", () => {
      const scheduler = Neon.scheduler();
      expect(scheduler).toBeDefined();
      expect(typeof scheduler.createScheduleTrigger).toBe("function");
      expect(typeof scheduler.listTriggers).toBe("function");
      expect(typeof scheduler.updateTrigger).toBe("function");
      expect(typeof scheduler.deleteTrigger).toBe("function");

      // Throws on missing auth
      expect(scheduler.listTriggers({})).rejects.toThrow("Missing NEON_API_KEY");
    });
  });

  describe("4. Neon AI Gateway Models Registry (hub/llm/neon.json)", () => {
    it("loads official 63 models from hub/llm/neon.json", () => {
      const filePath = path.resolve(__dirname, "../../hub/llm/neon.json");
      expect(fs.existsSync(filePath)).toBe(true);

      const content = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      expect(content.provider).toBe("neon");
      expect(content.available_models.length).toBe(63);

      // Verify frontier presence
      expect(content.available_models).toContain("claude-sonnet-4-6");
      expect(content.available_models).toContain("gpt-5");
      expect(content.available_models).toContain("gemini-3-flash");
      expect(content.available_models).toContain("meta-llama-3-3-70b-instruct");
      expect(content.available_models).toContain("deepseek-v4-1-flash");
      expect(content.available_models).toContain("qwen3-next-80b-a3b-instruct");

      // Verify embedding models
      expect(content.available_models).toContain("qwen3-embedding-0-6b");
      expect(content.available_models).toContain("gte-large-en");
      expect(content.available_models).toContain("bge-large-en");

      // Verify features
      expect(content.features.tool_calling).toBe(true);
      expect(content.features.streaming).toBe(true);
      expect(content.features.reasoning).toBe(true);
      expect(content.features.embeddings).toBe(true);
    });
  });
});

