import type { AgentTool } from "../../agent/types";

// Verhoeff algorithm multiplication table
const dTable = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]
];

// Verhoeff permutation table
const pTable = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8]
];

function validateAadhaar(numStr: string): { valid: boolean; error?: string; masked?: string } {
  const clean = numStr.replace(/[\s-]/g, "");
  if (!/^\d{12}$/.test(clean)) {
    return { valid: false, error: "Aadhaar must be exactly 12 numeric digits." };
  }
  if (clean.startsWith("0") || clean.startsWith("1")) {
    return { valid: false, error: "Aadhaar cannot start with 0 or 1." };
  }

  // Verhoeff checksum validation
  let c = 0;
  const reversed = clean.split("").reverse().map(Number);
  for (let i = 0; i < reversed.length; i++) {
    c = dTable[c][pTable[i % 8][reversed[i]]];
  }

  const valid = c === 0;
  const masked = `XXXX-XXXX-${clean.slice(8)}`;

  return {
    valid,
    masked,
    error: valid ? undefined : "Aadhaar checksum failed (invalid Verhoeff check digit)."
  };
}

const PAN_ENTITY_TYPES: Record<string, string> = {
  P: "Individual / Person",
  C: "Company",
  H: "Hindu Undivided Family (HUF)",
  F: "Firm / Partnership",
  A: "Association of Persons (AOP)",
  T: "Trust",
  B: "Body of Individuals (BOI)",
  L: "Local Authority",
  J: "Artificial Juridical Person",
  G: "Government Agency"
};

function validatePAN(panStr: string): { valid: boolean; error?: string; details?: Record<string, any> } {
  const clean = panStr.trim().toUpperCase();
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

  if (!panRegex.test(clean)) {
    return {
      valid: false,
      error: "PAN must follow standard 10-character format: 5 letters, 4 digits, 1 letter (e.g. ABCDE1234F)."
    };
  }

  const entityCode = clean[3];
  const entityType = PAN_ENTITY_TYPES[entityCode] || "Other / Unknown Entity";
  const masked = `${clean.slice(0, 2)}***${clean.slice(5)}`;

  return {
    valid: true,
    details: {
      pan: clean,
      masked,
      entityType,
      entityCode,
      surnameInitial: clean[4]
    }
  };
}

export const identityVerifierTool: AgentTool = {
  name: "verify_identity",
  description: "Verify and validate Indian identity credentials (Aadhaar 12-digit Verhoeff checksum and PAN card 10-character structure).",
  parameters: {
    type: "object",
    properties: {
      aadhaar: {
        type: "string",
        description: "12-digit Aadhaar number to validate"
      },
      pan: {
        type: "string",
        description: "10-character PAN number to validate (e.g. ABCDE1234F)"
      }
    }
  },
  execute: async (args: Record<string, any>) => {
    const results: Record<string, any> = {};

    if (args.aadhaar) {
      results.aadhaar = validateAadhaar(String(args.aadhaar));
    }

    if (args.pan) {
      results.pan = validatePAN(String(args.pan));
    }

    if (!args.aadhaar && !args.pan) {
      return JSON.stringify({
        error: "Please provide either 'aadhaar' or 'pan' to verify."
      });
    }

    return JSON.stringify(results, null, 2);
  }
};

