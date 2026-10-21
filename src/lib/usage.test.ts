import { describe, expect, it } from "vitest";
import type { Usage } from "./status-feed";
import { trippedDetail, usageState, weeklyBudget } from "./usage";

const T = (iso: string) => Date.parse(iso) / 1000;
const RESET = T("2026-10-18T12:00:00Z");
const u = (over: Partial<Usage>): Usage => ({
  fiveH: 40,
  sevenD: 50,
  paused: false,
  fiveHResetsAt: null,
  sevenDResetsAt: RESET,
  fiveHPauseAt: 90,
  sevenDPauseAt: 95,
  ...over,
});

describe("weeklyBudget", () => {
  it("is the % of the week elapsed + 10", () => {
    expect(weeklyBudget(RESET, RESET - 7 * 86400)).toBe(10);
    // Fri 16 Oct 20:00Z is 5d 8h into the week starting Sun 11 Oct 12:00Z.
    expect(weeklyBudget(RESET, T("2026-10-16T20:00:00Z"))).toBe(86);
    expect(weeklyBudget(RESET, RESET)).toBe(100);
  });
  it("is null without a reset time", () => {
    expect(weeklyBudget(null, RESET)).toBeNull();
  });
});

describe("usageState", () => {
  const now = T("2026-10-16T20:00:00Z"); // budget 86
  it("flags 7d over budget only when not paused", () => {
    expect(usageState(u({ sevenD: 87 }), now)).toMatchObject({
      budget: 86,
      overBudget: true,
      tripped: null,
      resumesAt: null,
    });
    expect(usageState(u({ sevenD: 86 }), now).overBudget).toBe(false);
    expect(usageState(u({ sevenD: 87, paused: true }), now).overBudget).toBe(
      false,
    );
  });
  it("names the limit that tripped and when it resets", () => {
    const fiveHReset = T("2026-10-16T21:00:00Z");
    expect(
      usageState(
        u({ fiveH: 78, paused: true, fiveHResetsAt: fiveHReset }),
        now,
      ),
    ).toMatchObject({ tripped: "5h", resumesAt: fiveHReset });
    expect(
      usageState(u({ fiveH: 78, sevenD: 96, paused: true }), now),
    ).toMatchObject({ tripped: "7d", resumesAt: RESET });
  });
  it("takes the higher reading without a 7d threshold", () => {
    const blind = { fiveHPauseAt: null, sevenDPauseAt: null, paused: true };
    expect(usageState(u({ ...blind, fiveH: 92 }), now).tripped).toBe("5h");
    expect(usageState(u({ ...blind, sevenD: 96 }), now).tripped).toBe("7d");
  });
});

describe("trippedDetail", () => {
  it("reads like DESIGN.md", () => {
    expect(trippedDetail(u({ fiveH: 92 }), "5h")).toBe(
      "5h window at 92% (pauses at 90%)",
    );
    expect(trippedDetail(u({ sevenD: 96 }), "7d")).toBe(
      "7d window at 96% (pauses at 95%)",
    );
  });
  it("leaves the threshold out when the feed does", () => {
    expect(trippedDetail(u({ fiveH: 92, fiveHPauseAt: null }), "5h")).toBe(
      "5h window at 92%",
    );
  });
});
