import { describe, expect, it } from "vitest";
import { COST_RANGES, DEFAULT_COST_RANGE } from "./cost";
import { DEFAULT_FLOW_RANGE, FLOW_RANGES, FLOW_SORTS } from "./flow";
import { DEFAULT_HEALTH_RANGE, HEALTH_RANGES } from "./health";
import { one, ownKey } from "./query";

describe("ownKey", () => {
  it("keeps a known value", () => {
    expect(ownKey(COST_RANGES, "30d", DEFAULT_COST_RANGE)).toBe("30d");
  });

  it("falls back on unknown and inherited keys", () => {
    for (const bad of ["1y", "toString", "constructor", "__proto__", null]) {
      expect(ownKey(COST_RANGES, bad, DEFAULT_COST_RANGE)).toBe(
        DEFAULT_COST_RANGE,
      );
      expect(ownKey(HEALTH_RANGES, bad, DEFAULT_HEALTH_RANGE)).toBe(
        DEFAULT_HEALTH_RANGE,
      );
      expect(ownKey(FLOW_RANGES, bad, DEFAULT_FLOW_RANGE)).toBe(
        DEFAULT_FLOW_RANGE,
      );
      expect(ownKey(FLOW_SORTS, bad, "stalled")).toBe("stalled");
    }
  });
});

describe("one", () => {
  it("takes a single non-empty value only", () => {
    expect(one("7d")).toBe("7d");
    expect(one("")).toBeNull();
    expect(one(["7d", "30d"])).toBeNull();
    expect(one(undefined)).toBeNull();
  });
});
