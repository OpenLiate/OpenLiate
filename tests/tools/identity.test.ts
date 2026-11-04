import { describe, expect, test } from "bun:test";
import { identityVerifierTool } from "../../src/layers/tools/builtin/identity";

describe("Layer 4: [T] Identity Verifier Tool (Aadhaar & PAN)", () => {
  test("validates valid and invalid PAN format", async () => {
    // Valid individual PAN (4th letter 'P')
    const res1 = await identityVerifierTool.execute({ pan: "ABCPE1234F" });
    const parsed1 = JSON.parse(res1 as string);
    expect(parsed1.pan.valid).toBe(true);
    expect(parsed1.pan.details.entityType).toBe("Individual / Person");
    expect(parsed1.pan.details.masked).toBe("AB***1234F");

    // Valid company PAN (4th letter 'C')
    const res2 = await identityVerifierTool.execute({ pan: "AAACE1234G" });
    const parsed2 = JSON.parse(res2 as string);
    expect(parsed2.pan.valid).toBe(true);
    expect(parsed2.pan.details.entityType).toBe("Company");

    // Invalid PAN length / format
    const res3 = await identityVerifierTool.execute({ pan: "INVALID_PAN" });
    const parsed3 = JSON.parse(res3 as string);
    expect(parsed3.pan.valid).toBe(false);
  });

  test("validates 12-digit Aadhaar length and Verhoeff check digit", async () => {
    // Invalid length
    const res1 = await identityVerifierTool.execute({ aadhaar: "12345" });
    const parsed1 = JSON.parse(res1 as string);
    expect(parsed1.aadhaar.valid).toBe(false);
    expect(parsed1.aadhaar.error).toContain("12 numeric digits");

    // Invalid check digit
    const res2 = await identityVerifierTool.execute({ aadhaar: "234567890123" });
    const parsed2 = JSON.parse(res2 as string);
    expect(parsed2.aadhaar.masked).toBe("XXXX-XXXX-0123");
  });
});
