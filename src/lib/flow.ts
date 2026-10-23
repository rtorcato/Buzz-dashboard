// The Pipeline Flow tab (DESIGN.md → Pipeline flow, #47): where do PRs wait?
// Pure functions over stored PR events (pr_opened, pr_reviewed, pr_merged,
// pr_closed), so the page only queries and renders.

export const FLOW_KINDS = [
  "pr_opened",
  "pr_reviewed",
  "pr_merged",
  "pr_closed",
] as const;

/** The default PR lifecycle steps, in order. */
export const STEPS = [
  "Opened → first review",
  "Review and changes",
  "Approved → merged",
] as const;

/** "PRs waited a median 9h 20m {phrase}". */
export const STEP_WAITS = [
  "for a first review",
  "through review and changes",
  "for a merge after approval",
] as const;

export const FLOW_RANGES = { "7d": 7, "30d": 30, "90d": 90 } as const;
export type FlowRange = keyof typeof FLOW_RANGES;
export const DEFAULT_FLOW_RANGE: FlowRange = "7d";

export const FLOW_SORTS = {
  stalled: "Stalled first",
  slowest: "Slowest first",
  newest: "Newest first",
} as const;
export type FlowSort = keyof typeof FLOW_SORTS;

/** No activity for this long and an open PR is stalled. */
export const STALL_S = 24 * 3600;

/** The columns flow reads from a stored event. */
export type FlowEvent = {
  kind: string;
  at: Date;
  actor: string | null;
  repo: string | null;
  title: string | null;
  url: string | null;
  data: Record<string, unknown> | null;
};

export type FlowPr = {
  /** "owner/repo#12". */
  key: string;
  repo: string;
  number: number;
  title: string;
  url: string | null;
  /** The opening row's actor: the agent from the `@Name` header, else the login. */
  agent: string;
  labels: string[];
  /** Unix seconds. */
  opened: number;
  firstReview: number | null;
  approved: number | null;
  merged: number | null;
  closed: number | null;
  changeRequests: number;
  /** The first review was an approval. */
  approvedFirst: boolean;
  /** Newest of the opening and the reviews. */
  lastActivity: number;
};

const secs = (d: Date) => Math.floor(d.getTime() / 1000);
const str = (v: unknown) => (typeof v === "string" ? v : null);

/**
 * One record per PR that has its opening stored. A review by the PR's own
 * author (a reply to a review thread is one) is not a review.
 */
export function toPrs(events: FlowEvent[]): FlowPr[] {
  const byKey = new Map<string, FlowEvent[]>();
  for (const e of events) {
    const number = e.data?.number;
    if (!e.repo || typeof number !== "number") continue;
    const key = `${e.repo}#${number}`;
    byKey.set(key, [...(byKey.get(key) ?? []), e]);
  }
  const prs: FlowPr[] = [];
  for (const [key, rows] of byKey) {
    const open = rows.find((r) => r.kind === "pr_opened");
    if (!open?.repo) continue;
    const author = str(open.data?.author);
    const reviews = rows
      .filter(
        (r) => r.kind === "pr_reviewed" && str(r.data?.reviewer) !== author,
      )
      .map((r) => ({ at: secs(r.at), state: str(r.data?.state) }))
      .sort((a, b) => a.at - b.at);
    const at = (kind: string) => {
      const r = rows.find((x) => x.kind === kind);
      return r ? secs(r.at) : null;
    };
    const opened = secs(open.at);
    prs.push({
      key,
      repo: open.repo,
      number: open.data?.number as number,
      title: open.title ?? "",
      url: open.url,
      agent: open.actor ?? author ?? "Someone",
      labels: Array.isArray(open.data?.labels)
        ? open.data.labels.filter((l): l is string => typeof l === "string")
        : [],
      opened,
      firstReview: reviews[0]?.at ?? null,
      approved: reviews.find((r) => r.state === "APPROVED")?.at ?? null,
      merged: at("pr_merged"),
      closed: at("pr_closed"),
      changeRequests: reviews.filter((r) => r.state === "CHANGES_REQUESTED")
        .length,
      approvedFirst: reviews[0]?.state === "APPROVED",
      lastActivity: Math.max(opened, ...reviews.map((r) => r.at)),
    });
  }
  return prs;
}

export const isOpen = (pr: FlowPr) => pr.merged === null && pr.closed === null;

/**
 * Seconds in each step, in STEPS order, up to the merge or `now`. A step that
 * never happened (no review, no approval) adds its time to the step before:
 * a PR merged with no review spent it all waiting for one.
 */
export function stepTimes(pr: FlowPr, now: number): [number, number, number] {
  const end = pr.merged ?? pr.closed ?? now;
  const b1 = Math.min(pr.firstReview ?? end, end);
  const b2 = Math.max(b1, Math.min(pr.approved ?? end, end));
  return [b1 - pr.opened, b2 - b1, end - b2];
}

/** The step an open PR is waiting in: 0, 1 or 2. */
export const currentStep = (pr: FlowPr) =>
  pr.approved !== null ? 2 : pr.firstReview !== null ? 1 : 0;

export const isStalled = (pr: FlowPr, now: number) =>
  isOpen(pr) && now - pr.lastActivity >= STALL_S;

export function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = xs.toSorted((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** "1d 4h", "9h 20m", "45m"; under a minute is "0m". */
export function formatDuration(s: number): string {
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return h % 24 ? `${d}d ${h % 24}h` : `${d}d`;
  if (h > 0) return m % 60 ? `${h}h ${m % 60}m` : `${h}h`;
  return `${m}m`;
}

/** PRs merged in [from, to). */
export const mergedIn = (prs: FlowPr[], from: number, to: number) =>
  prs.filter((p) => p.merged !== null && p.merged >= from && p.merged < to);

const cycle = (p: FlowPr) => (p.merged ?? 0) - p.opened;

export type FlowSummary = {
  merged: FlowPr[];
  prevMerged: FlowPr[];
  medianCycle: number | null;
  prevMedianCycle: number | null;
  /** Change requests per merged PR. */
  changeRequests: number | null;
  approvedFirst: number;
  stalled: FlowPr[];
};

/** The 4 stat cards: this period against the one before it. */
export function summarize(
  prs: FlowPr[],
  now: number,
  days: number,
): FlowSummary {
  const from = now - days * 86_400;
  const merged = mergedIn(prs, from, now + 1);
  const prevMerged = mergedIn(prs, from - days * 86_400, from);
  return {
    merged,
    prevMerged,
    medianCycle: median(merged.map(cycle)),
    prevMedianCycle: median(prevMerged.map(cycle)),
    changeRequests: merged.length
      ? merged.reduce((n, p) => n + p.changeRequests, 0) / merged.length
      : null,
    approvedFirst: merged.filter((p) => p.approvedFirst).length,
    stalled: prs.filter((p) => isStalled(p, now)),
  };
}

/** The median of each step over `prs`, in STEPS order. */
export const stepMedians = (prs: FlowPr[], now: number) =>
  STEPS.map((_, i) => median(prs.map((p) => stepTimes(p, now)[i]))) as [
    number | null,
    number | null,
    number | null,
  ];

/** Long enough to count a PR as one that waited in the slowest step. */
export const LONG_WAIT_S = 12 * 3600;

export type SlowStep = {
  step: number;
  median: number;
  /** This period's median over the last one's. */
  ratio: number;
  /** Merged PRs this period that waited LONG_WAIT_S or more in the step. */
  waited: FlowPr[];
};

/**
 * The step whose median grew most against the period before, or null when
 * none grew by half again. Needs 3 merged PRs in each period, so one slow PR
 * doesn't make a headline.
 */
export function slowestStep(
  merged: FlowPr[],
  prevMerged: FlowPr[],
  now: number,
): SlowStep | null {
  if (merged.length < 3 || prevMerged.length < 3) return null;
  const cur = stepMedians(merged, now);
  const prev = stepMedians(prevMerged, now);
  let best: SlowStep | null = null;
  STEPS.forEach((_, step) => {
    const c = cur[step] ?? 0;
    // A step that took under a minute last time would make any growth huge.
    const p = Math.max(prev[step] ?? 0, 60);
    const ratio = c / p;
    if (ratio >= 1.5 && c >= 3600 && (!best || ratio > best.ratio)) {
      best = {
        step,
        median: c,
        ratio,
        waited: merged.filter((pr) => stepTimes(pr, now)[step] >= LONG_WAIT_S),
      };
    }
  });
  return best;
}

export type GroupRow = {
  name: string;
  merged: number;
  medianCycle: number | null;
  steps: [number | null, number | null, number | null];
};

/** Merged PRs grouped by `by`, most merged first. */
export function groupBy(
  merged: FlowPr[],
  by: (p: FlowPr) => string,
  now: number,
): GroupRow[] {
  const groups = new Map<string, FlowPr[]>();
  for (const p of merged) groups.set(by(p), [...(groups.get(by(p)) ?? []), p]);
  return [...groups]
    .map(([name, prs]) => ({
      name,
      merged: prs.length,
      medianCycle: median(prs.map(cycle)),
      steps: stepMedians(prs, now),
    }))
    .sort((a, b) => b.merged - a.merged || a.name.localeCompare(b.name));
}

/** Index of the longest step, or null when nothing is known. */
export function slowestIndex(steps: (number | null)[]): number | null {
  let best: number | null = null;
  steps.forEach((s, i) => {
    if (s !== null && (best === null || s > (steps[best] ?? 0))) best = i;
  });
  return best;
}

/** The PRs table: this period's merges and every open PR, sorted. */
export function tableRows(
  prs: FlowPr[],
  merged: FlowPr[],
  now: number,
  sort: FlowSort,
): FlowPr[] {
  const rows = [...merged, ...prs.filter(isOpen)];
  const total = (p: FlowPr) => (p.merged ?? now) - p.opened;
  const by: Record<FlowSort, (a: FlowPr, b: FlowPr) => number> = {
    stalled: (a, b) =>
      Number(isStalled(b, now)) - Number(isStalled(a, now)) ||
      Number(isOpen(b)) - Number(isOpen(a)) ||
      total(b) - total(a),
    slowest: (a, b) => total(b) - total(a),
    newest: (a, b) => b.opened - a.opened,
  };
  return rows.sort(by[sort]);
}

/** Up to `n` of the most used labels, for the Custom stages example row. */
export function topLabels(prs: FlowPr[], n = 4): string[] {
  const counts = new Map<string, number>();
  for (const p of prs)
    for (const l of p.labels) counts.set(l, (counts.get(l) ?? 0) + 1);
  return [...counts]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n)
    .map(([l]) => l);
}
