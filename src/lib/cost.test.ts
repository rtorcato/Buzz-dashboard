import { describe, expect, it } from "vitest";
import {
  cacheHit,
  formatTokens,
  formatUsd,
  gridStep,
  modelTiers,
  shortModel,
  summarizeCost,
  total,
} from "./cost";
import type { CostRow } from "./history";

const DAY = 86_400;
// 14 local midnights, oldest first, in unix seconds.
const starts = Array.from({ length: 14 }, (_, i) => 1_790_000_000 + i * DAY);
const row = (
  dayIndex: number,
  agent: string,
  model: string,
  metric: "cost" | "tokens",
  value: number,
  type = "",
): CostRow => ({
  day: new Date(starts[dayIndex] * 1000),
  agent,
  model,
  metric,
  type,
  value,
});

describe("modelTiers", () => {
  it("ranks models by price per token, not by name", () => {
    const tiers = modelTiers([
      row(0, "a", "cheap", "cost", 1),
      row(0, "a", "cheap", "tokens", 1000, "input"),
      row(0, "a", "pricey", "cost", 10),
      row(0, "a", "pricey", "tokens", 100, "input"),
      row(0, "a", "mid", "cost", 5),
      row(0, "a", "mid", "tokens", 1000, "input"),
    ]);
    expect(tiers.get("pricey")).toBe(0);
    expect(tiers.get("mid")).toBe(1);
    expect(tiers.get("cheap")).toBe(2);
  });

  it("folds extra models into the middle tier", () => {
    const rows = [10, 8, 6, 4, 2].flatMap((p, i) => [
      row(0, "a", `m${i}`, "cost", p),
      row(0, "a", `m${i}`, "tokens", 1, "input"),
    ]);
    expect([...modelTiers(rows).values()]).toEqual([0, 1, 1, 1, 2]);
  });
});

describe("summarizeCost", () => {
  const rows = [
    row(13, "Fern", "opus", "cost", 10),
    row(13, "Fern", "opus", "tokens", 100, "input"),
    row(13, "Fern", "opus", "tokens", 300, "cacheRead"),
    row(12, "Gale", "haiku", "cost", 2),
    row(12, "Gale", "haiku", "tokens", 1000, "output"),
    row(3, "Gale", "haiku", "cost", 7),
  ];

  it("splits today, this week and last week", () => {
    const s = summarizeCost(rows, starts, 7, "cost");
    expect(total(s.today, "cost")).toBe(10);
    expect(total(s.week, "cost")).toBe(12);
    expect(total(s.lastWeek, "cost")).toBe(7);
    expect(s.days).toHaveLength(7);
    expect(s.topAgent).toEqual({ agent: "Fern", cost: 10, share: 10 / 12 });
  });

  it("sorts agents by the chosen unit", () => {
    expect(
      summarizeCost(rows, starts, 7, "cost").agents.map((a) => a.agent),
    ).toEqual(["Fern", "Gale"]);
    expect(
      summarizeCost(rows, starts, 7, "tokens").agents.map((a) => a.agent),
    ).toEqual(["Gale", "Fern"]);
  });

  it("keeps a cell per day, by tier", () => {
    const fern = summarizeCost(rows, starts, 7, "cost").agents[0];
    expect(fern.days).toHaveLength(7);
    expect(fern.days[6].cost).toEqual([10, 0, 0]);
    expect(cacheHit(fern.total)).toBe(0.75);
  });

  it("has no cache hit rate without input tokens", () => {
    const s = summarizeCost([row(13, "a", "m", "cost", 1)], starts, 7, "cost");
    expect(cacheHit(s.range)).toBeNull();
    expect(summarizeCost([], starts, 7, "cost").topAgent).toBeNull();
  });
});

describe("formatting", () => {
  it("formats money, tokens, models and grid steps", () => {
    expect(formatUsd(38.4)).toBe("$38.40");
    expect(formatUsd(212.4)).toBe("$212");
    expect(formatTokens(41_200_000)).toBe("41.2M");
    expect(formatTokens(812_300)).toBe("812k");
    expect(shortModel("claude-opus-4-5-20251101")).toBe("opus-4-5");
    expect(gridStep(17, "cost")).toBe(5);
    expect(gridStep(90, "cost")).toBe(20);
    expect(gridStep(3_000_000, "tokens")).toBe(1_000_000);
  });
});
