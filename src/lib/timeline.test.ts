import { describe, expect, it } from "vitest";
import type { HistoryEvent } from "./history-schema";
import {
  groupByDay,
  type Names,
  parseFilters,
  snippet,
  splitMatches,
  toRow,
} from "./timeline";

const names: Names = {
  actor: (raw) => (raw === "ab".repeat(32) ? "Fern" : raw),
  channel: (id) => (id === "c1" ? "example-app" : null),
};

const event = (e: Partial<HistoryEvent>): HistoryEvent => ({
  source: "github",
  sourceId: "x",
  kind: "pr_opened",
  at: new Date("2026-10-22T15:12:00Z"),
  actor: null,
  repo: null,
  channel: null,
  title: null,
  url: null,
  body: null,
  data: null,
  ingestedAt: new Date(),
  ...e,
});

describe("parseFilters", () => {
  it("keeps known values and drops the rest", () => {
    expect(
      parseFilters({
        q: " example-app#42 ",
        source: "buzz",
        type: "prs",
        range: "30d",
        repo: "o/r",
      }),
    ).toEqual({
      q: "example-app#42",
      repo: "o/r",
      agent: null,
      source: "buzz",
      type: "prs",
      range: "30d",
    });
    const junk = parseFilters({ source: "gitlab", type: "x", range: "1y" });
    expect([junk.source, junk.type, junk.range]).toEqual([null, null, "14d"]);
  });
});

describe("snippet", () => {
  it("centres a long text on the first match", () => {
    const text = `${"a ".repeat(200)}needle${" b".repeat(200)}`;
    const s = snippet(text, "NEEDLE");
    expect(s).toContain("needle");
    expect(s.startsWith("…")).toBe(true);
    expect(s.endsWith("…")).toBe(true);
  });

  it("leaves short text alone and flattens whitespace", () => {
    expect(snippet("one\n\ntwo")).toBe("one two");
  });
});

describe("splitMatches", () => {
  it("puts matches at odd indexes, case-insensitive, regex-safe", () => {
    expect(splitMatches("Fix a+b and A+B", "a+b")).toEqual([
      "Fix ",
      "a+b",
      " and ",
      "A+B",
      "",
    ]);
    expect(splitMatches("text", "")).toEqual(["text"]);
  });
});

describe("toRow", () => {
  it("builds a GitHub PR row", () => {
    const row = toRow(
      event({
        kind: "pr_merged",
        actor: "Atlas",
        repo: "o/example-app",
        title: "feat: empty state",
        url: "https://github.com/o/example-app/pull/42",
        data: { number: 42 },
      }),
      names,
    );
    expect(row).toMatchObject({
      source: "github",
      icon: "merged",
      actor: "Atlas",
      verb: "merged",
      target: "example-app#42",
      snippet: "feat: empty state",
      chips: ["example-app"],
    });
  });

  it("builds a Buzz message row with the agent and channel names", () => {
    const row = toRow(
      event({
        source: "buzz",
        kind: "message",
        actor: "ab".repeat(32),
        channel: "c1",
        body: "PR up",
      }),
      names,
    );
    expect(row).toMatchObject({
      source: "buzz",
      icon: "message",
      actor: "Fern",
      verb: "posted in #example-app",
      target: null,
      chips: ["#example-app"],
    });
  });

  it("falls back for unknown channels and kinds", () => {
    expect(
      toRow(event({ source: "buzz", channel: "zz", body: "hi" }), names).verb,
    ).toBe("posted");
    expect(toRow(event({ kind: "pr_reopened" }), names)).toMatchObject({
      icon: "other",
      verb: "pr reopened",
      actor: "Someone",
    });
  });
});

describe("groupByDay", () => {
  it("starts a group whenever the day changes", () => {
    const rows = [30, 20, 5].map((at) =>
      toRow(event({ sourceId: String(at), at: new Date(at * 1000) }), names),
    );
    const groups = groupByDay(rows, (at) => (at >= 10 ? 10 : 0));
    expect(groups.map((g) => [g.start, g.rows.length])).toEqual([
      [10, 2],
      [0, 1],
    ]);
  });
});
