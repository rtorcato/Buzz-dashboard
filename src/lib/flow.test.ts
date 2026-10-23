import { describe, expect, it } from "vitest";
import {
  type FlowEvent,
  type FlowPr,
  formatDuration,
  groupBy,
  isStalled,
  median,
  slowestIndex,
  slowestStep,
  stepTimes,
  summarize,
  tableRows,
  toPrs,
  topLabels,
} from "./flow";

const H = 3600;
const D = 86_400;
const NOW = 1_800_000_000;

const ev = (
  kind: string,
  at: number,
  data: Record<string, unknown> = {},
  number = 1,
): FlowEvent => ({
  kind,
  at: new Date(at * 1000),
  actor: "Shockwave",
  repo: "acme/app",
  title: "feat: thing",
  url: null,
  data: { number, author: "acme-bot", labels: ["ai-review"], ...data },
});

const pr = (over: Partial<FlowPr> = {}): FlowPr => ({
  key: "acme/app#1",
  repo: "acme/app",
  number: 1,
  title: "",
  url: null,
  agent: "Shockwave",
  labels: [],
  opened: NOW - 2 * D,
  firstReview: null,
  approved: null,
  merged: null,
  closed: null,
  changeRequests: 0,
  approvedFirst: false,
  lastActivity: NOW - 2 * D,
  ...over,
});

describe("toPrs", () => {
  it("reads review times and skips the author's own reviews", () => {
    const [p] = toPrs([
      ev("pr_opened", NOW - 10 * H),
      // A reply to a review thread is a COMMENTED review by the author.
      ev("pr_reviewed", NOW - 9 * H, {
        state: "COMMENTED",
        reviewer: "acme-bot",
      }),
      ev("pr_reviewed", NOW - 8 * H, {
        state: "CHANGES_REQUESTED",
        reviewer: "alice",
      }),
      ev("pr_reviewed", NOW - 4 * H, { state: "APPROVED", reviewer: "alice" }),
      ev("pr_merged", NOW - H),
    ]);
    expect(p).toMatchObject({
      key: "acme/app#1",
      agent: "Shockwave",
      labels: ["ai-review"],
      opened: NOW - 10 * H,
      firstReview: NOW - 8 * H,
      approved: NOW - 4 * H,
      merged: NOW - H,
      changeRequests: 1,
      approvedFirst: false,
      lastActivity: NOW - 4 * H,
    });
    expect(stepTimes(p, NOW)).toEqual([2 * H, 4 * H, 3 * H]);
  });

  it("drops a PR whose opening is not stored", () => {
    expect(toPrs([ev("pr_merged", NOW)])).toEqual([]);
  });
});

describe("stepTimes", () => {
  it("gives an unreviewed merge all to the first step", () => {
    expect(stepTimes(pr({ merged: NOW - D }), NOW)).toEqual([D, 0, 0]);
  });

  it("counts an open PR up to now", () => {
    expect(stepTimes(pr({ firstReview: NOW - D }), NOW)).toEqual([D, D, 0]);
  });
});

describe("isStalled", () => {
  it("needs an open PR quiet for 24h", () => {
    expect(isStalled(pr({ lastActivity: NOW - D }), NOW)).toBe(true);
    expect(isStalled(pr({ lastActivity: NOW - D + 1 }), NOW)).toBe(false);
    expect(isStalled(pr({ merged: NOW - 3 * D }), NOW)).toBe(false);
  });
});

describe("median and formatDuration", () => {
  it("handle even, odd and empty lists", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(median([])).toBeNull();
  });

  it("formats the two largest units", () => {
    expect(formatDuration(D + 4 * H + 59)).toBe("1d 4h");
    expect(formatDuration(9 * H + 20 * 60)).toBe("9h 20m");
    expect(formatDuration(2 * D)).toBe("2d");
    expect(formatDuration(30)).toBe("0m");
  });
});

// Merged in the window, each with the given hours waiting for a merge.
const merges = (start: number, waits: number[]) =>
  waits.map((w, i) =>
    pr({
      key: `acme/app#${start + i}`,
      number: start + i,
      opened: NOW - 3 * D - (start + i) * H,
      firstReview: NOW - 3 * D - (start + i) * H + H,
      approved: NOW - 3 * D - (start + i) * H + H,
      merged: NOW - 3 * D - (start + i) * H + H + w * H,
    }),
  );

describe("summarize", () => {
  it("compares the period with the one before", () => {
    const cur = pr({
      merged: NOW - D,
      opened: NOW - 2 * D,
      changeRequests: 2,
      approvedFirst: false,
    });
    const first = pr({
      key: "acme/app#2",
      merged: NOW - 2 * D,
      opened: NOW - 3 * D,
      approvedFirst: true,
    });
    const old = pr({ key: "acme/app#3", merged: NOW - 10 * D, opened: 0 });
    const stuck = pr({ key: "acme/app#4", lastActivity: NOW - 2 * D });
    const s = summarize([cur, first, old, stuck], NOW, 7);
    expect(s.merged).toHaveLength(2);
    expect(s.prevMerged).toEqual([old]);
    expect(s.medianCycle).toBe(D);
    expect(s.changeRequests).toBe(1);
    expect(s.approvedFirst).toBe(1);
    expect(s.stalled).toEqual([stuck]);
  });
});

describe("slowestStep", () => {
  it("names the step that grew most", () => {
    const s = slowestStep(merges(0, [10, 14, 20]), merges(10, [1, 2, 3]), NOW);
    expect(s).toMatchObject({ step: 2, median: 14 * H, ratio: 7 });
    expect(s?.waited.map((p) => p.number)).toEqual([1, 2]);
  });

  it("stays quiet without a notable change or enough PRs", () => {
    expect(slowestStep(merges(0, [2, 2, 2]), merges(10, [2, 2, 2]), NOW)).toBe(
      null,
    );
    expect(slowestStep(merges(0, [20, 20]), merges(10, [1, 1, 1]), NOW)).toBe(
      null,
    );
  });
});

describe("groupBy and slowestIndex", () => {
  it("groups merged PRs, most merged first", () => {
    const rows = groupBy(
      [
        ...merges(0, [2, 4]),
        { ...merges(5, [1])[0], repo: "acme/api", key: "acme/api#5" },
      ],
      (p) => p.repo,
      NOW,
    );
    expect(rows.map((r) => [r.name, r.merged])).toEqual([
      ["acme/app", 2],
      ["acme/api", 1],
    ]);
    expect(rows[0].steps).toEqual([H, 0, 3 * H]);
    expect(slowestIndex(rows[0].steps)).toBe(2);
    expect(slowestIndex([null, null, null])).toBeNull();
  });
});

describe("tableRows", () => {
  it("puts stalled PRs first, then open, then merged", () => {
    const merged = pr({ key: "m", merged: NOW - H, opened: NOW - 9 * D });
    const open = pr({ key: "o", lastActivity: NOW - H });
    const stalled = pr({ key: "s", lastActivity: NOW - 2 * D });
    const rows = tableRows([merged, open, stalled], [merged], NOW, "stalled");
    expect(rows.map((r) => r.key)).toEqual(["s", "o", "m"]);
    expect(
      tableRows([merged, open], [merged], NOW, "slowest").map((r) => r.key),
    ).toEqual(["m", "o"]);
  });
});

describe("topLabels", () => {
  it("ranks by use, then name", () => {
    expect(
      topLabels([
        pr({ labels: ["b", "a"] }),
        pr({ labels: ["b", "c"] }),
        pr({ labels: ["d"] }),
      ]),
    ).toEqual(["b", "a", "c", "d"]);
  });
});
