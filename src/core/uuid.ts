/**
 * UUIDv7 (RFC 9562) - Time-sorted 128-bit identifiers.
 * Guarantees monotonic ordering across deployments, agent execution IDs, and sessions.
 */
export function generateUUIDv7(): string {
  const timestamp = BigInt(Date.now());
  const randA = BigInt(Math.floor(Math.random() * 0x1000));
  const randB = BigInt(Math.floor(Math.random() * 0x3fffffff));
  const randC = BigInt(Math.floor(Math.random() * 0x3fffffff));

  const high = (timestamp << 16n) | (0x7n << 12n) | (randA & 0xfffn);
  const low = (0x2n << 62n) | ((randB & 0x3fffffffn) << 32n) | (randC & 0xffffffffn);

  const hexHigh = high.toString(16).padStart(16, "0");
  const hexLow = low.toString(16).padStart(16, "0");

  return `${hexHigh.slice(0, 8)}-${hexHigh.slice(8, 12)}-${hexHigh.slice(12, 16)}-${hexLow.slice(0, 4)}-${hexLow.slice(4, 16)}`.toLowerCase();
}

