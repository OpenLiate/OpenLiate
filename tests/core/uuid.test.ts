import { describe, it, expect } from "bun:test";
import { generateUUIDv7 } from "../../src/core/uuid";

describe("UUIDv7 (RFC 9562) Generator", () => {
  it("generates a valid 36-character UUIDv7 string", () => {
    const id = generateUUIDv7();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("generates monotonically ordered UUIDs over time", async () => {
    const id1 = generateUUIDv7();
    await new Promise((r) => setTimeout(r, 2));
    const id2 = generateUUIDv7();
    expect(id1 < id2).toBe(true);
  });
});

