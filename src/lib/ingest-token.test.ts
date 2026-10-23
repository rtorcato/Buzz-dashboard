import { describe, expect, it } from "vitest";
import {
  checkIngestToken,
  maskToken,
  newIngestToken,
  TOKEN_PREFIX,
} from "./ingest-token";

describe("ingest token", () => {
  const { token, record } = newIngestToken(new Date("2026-10-22T12:00:00Z"));

  it("stores only a hash and the last 4 characters", () => {
    expect(token.startsWith(TOKEN_PREFIX)).toBe(true);
    expect(JSON.stringify(record)).not.toContain(
      token.slice(TOKEN_PREFIX.length),
    );
    expect(record.last4).toBe(token.slice(-4));
    expect(maskToken(record)).toMatch(/^hive_otel_•+.{4}$/);
  });

  it("accepts the bearer token and nothing else", () => {
    expect(checkIngestToken(`Bearer ${token}`, record)).toBe(true);
    expect(checkIngestToken(`bearer  ${token} `, record)).toBe(true);
    expect(checkIngestToken(token, record)).toBe(false);
    expect(checkIngestToken(`Bearer ${token}x`, record)).toBe(false);
    expect(checkIngestToken(null, record)).toBe(false);
    expect(checkIngestToken(`Bearer ${token}`, null)).toBe(false);
    expect(checkIngestToken(`Bearer ${newIngestToken().token}`, record)).toBe(
      false,
    );
  });
});
