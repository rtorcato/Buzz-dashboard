import { afterEach, describe, expect, it, vi } from "vitest";
import { sampleMode } from "./sample-data";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("sampleMode", () => {
  it("is off by default", () => {
    vi.stubEnv("BUZZ_SAMPLE_DATA", undefined);
    vi.stubEnv("NODE_ENV", "development");
    expect(sampleMode()).toBe(false);
  });

  it("is on with BUZZ_SAMPLE_DATA=1 outside production", () => {
    vi.stubEnv("BUZZ_SAMPLE_DATA", "1");
    vi.stubEnv("NODE_ENV", "development");
    expect(sampleMode()).toBe(true);
  });

  it("never loads in a production build", () => {
    vi.stubEnv("BUZZ_SAMPLE_DATA", "1");
    vi.stubEnv("NODE_ENV", "production");
    expect(sampleMode()).toBe(false);
  });
});
