import type { CostRow } from "./history";

// Pure maths for the Cost view (#42), over the per-day sums from costByDay.
// Dollars are estimates at API list price; tokens are exact.

export const COST_DOCS =
  "https://docs.torcato.dev/buzz-dashboard/docs/cost-source";

export const COST_RANGES = { "7d": 7, "30d": 30, "90d": 90 } as const;
export type CostRange = keyof typeof COST_RANGES;
export const DEFAULT_COST_RANGE: CostRange = "7d";
export type CostUnit = "cost" | "tokens";

/** Index 0 is the priciest tier (--model-1), 2 the cheapest (--model-3). */
export type Tier = 0 | 1 | 2;
type ByTier = [number, number, number];

const zero = (): ByTier => [0, 0, 0];
const sum = (t: ByTier) => t[0] + t[1] + t[2];

/**
 * Each model's colour tier, by price per token, not by name, so a new model
 * family slots in. With more than three models the middle ones share tier 1.
 */
export function modelTiers(rows: CostRow[]): Map<string, Tier> {
  const cost = new Map<string, number>();
  const tokens = new Map<string, number>();
  for (const r of rows) {
    const m = r.metric === "cost" ? cost : tokens;
    m.set(r.model, (m.get(r.model) ?? 0) + r.value);
  }
  const models = [...new Set(rows.map((r) => r.model))];
  const price = (m: string) => (cost.get(m) ?? 0) / (tokens.get(m) || 1);
  models.sort((a, b) => price(b) - price(a) || a.localeCompare(b));
  const n = models.length;
  return new Map(
    models.map((m, i): [string, Tier] => [
      m,
      n <= 3 ? (i as Tier) : i === 0 ? 0 : i === n - 1 ? 2 : 1,
    ]),
  );
}

/** "claude-opus-4-5-20251101" → "opus-4-5". */
export const shortModel = (model: string) =>
  model.replace(/^claude-/, "").replace(/-\d{8}$/, "") || "unknown";

/** The models in each tier, short names joined, for the legend. */
export function tierNames(tiers: Map<string, Tier>): [string, string, string] {
  const out: [string[], string[], string[]] = [[], [], []];
  for (const [m, t] of tiers) out[t].push(shortModel(m));
  return out.map((n) => n.join(", ")) as [string, string, string];
}

export type Cell = {
  cost: ByTier;
  tokens: ByTier;
  input: number;
  cacheRead: number;
  cacheCreation: number;
};

const cell = (): Cell => ({
  cost: zero(),
  tokens: zero(),
  input: 0,
  cacheRead: 0,
  cacheCreation: 0,
});

function add(c: Cell, r: CostRow, tier: Tier) {
  if (r.metric === "cost") {
    c.cost[tier] += r.value;
    return;
  }
  c.tokens[tier] += r.value;
  if (r.type === "input") c.input += r.value;
  if (r.type === "cacheRead") c.cacheRead += r.value;
  if (r.type === "cacheCreation") c.cacheCreation += r.value;
}

function merge(cells: Cell[]): Cell {
  const out = cell();
  for (const c of cells) {
    for (const t of [0, 1, 2] as const) {
      out.cost[t] += c.cost[t];
      out.tokens[t] += c.tokens[t];
    }
    out.input += c.input;
    out.cacheRead += c.cacheRead;
    out.cacheCreation += c.cacheCreation;
  }
  return out;
}

/** Share of input tokens read from cache, or null with no input. */
export function cacheHit(c: Cell): number | null {
  const all = c.input + c.cacheRead + c.cacheCreation;
  return all ? c.cacheRead / all : null;
}

export const total = (c: Cell, unit: CostUnit) => sum(c[unit]);

export type AgentCost = {
  agent: string;
  /** Over the whole range. */
  total: Cell;
  /** One per day in `days`, oldest first. */
  days: Cell[];
};

export type CostSummary = {
  tiers: Map<string, Tier>;
  /** Local midnights in unix seconds, oldest first: the chart's days. */
  days: number[];
  today: Cell;
  week: Cell;
  lastWeek: Cell;
  range: Cell;
  /** Sorted by `unit` over the range, biggest first. */
  agents: AgentCost[];
  /** The agent with the most estimated cost in the last 7 days. */
  topAgent: { agent: string; cost: number; share: number } | null;
};

/**
 * `rows` must reach back at least 14 days and `days` (from dayStarts), so
 * This week has a last week to compare with.
 */
export function summarizeCost(
  rows: CostRow[],
  starts: number[],
  rangeDays: number,
  unit: CostUnit,
): CostSummary {
  const tiers = modelTiers(rows);
  const byDay = new Map<number, Map<string, Cell>>();
  for (const r of rows) {
    const day = r.day.getTime() / 1000;
    const agents = byDay.get(day) ?? new Map<string, Cell>();
    byDay.set(day, agents);
    const c = agents.get(r.agent) ?? cell();
    agents.set(r.agent, c);
    add(c, r, tiers.get(r.model) ?? 1);
  }
  const daysCell = (ds: number[]) =>
    merge(ds.flatMap((d) => [...(byDay.get(d)?.values() ?? [])]));
  const days = starts.slice(-rangeDays);
  const week = starts.slice(-7);
  const names = [
    ...new Set(days.flatMap((d) => [...(byDay.get(d)?.keys() ?? [])])),
  ];
  const agents = names
    .map((agent) => {
      const cells = days.map((d) => byDay.get(d)?.get(agent) ?? cell());
      return { agent, total: merge(cells), days: cells };
    })
    .sort(
      (a, b) =>
        total(b.total, unit) - total(a.total, unit) ||
        a.agent.localeCompare(b.agent),
    );
  const weekCell = daysCell(week);
  const weekCost = sum(weekCell.cost);
  let topAgent: CostSummary["topAgent"] = null;
  for (const agent of new Set(
    week.flatMap((d) => [...(byDay.get(d)?.keys() ?? [])]),
  )) {
    const cost = sum(
      merge(week.map((d) => byDay.get(d)?.get(agent) ?? cell())).cost,
    );
    if (cost > 0 && (!topAgent || cost > topAgent.cost)) {
      topAgent = { agent, cost, share: cost / weekCost };
    }
  }
  return {
    tiers,
    days,
    today: daysCell(starts.slice(-1)),
    week: weekCell,
    lastWeek: daysCell(starts.slice(-14, -7)),
    range: daysCell(days),
    agents,
    topAgent,
  };
}

/** "$38.40" under $100, "$212" above. */
export function formatUsd(n: number) {
  return n < 100
    ? `$${n.toFixed(2)}`
    : `$${Math.round(n).toLocaleString("en-US")}`;
}

/** "41.2M", "812k", "940". */
export function formatTokens(n: number) {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${Math.round(n / 1e3)}k`;
  return String(Math.round(n));
}

export const formatUnit = (n: number, unit: CostUnit) =>
  unit === "cost" ? formatUsd(n) : formatTokens(n);

/** A round grid step giving at most 6 lines: $5 for a normal day's cost. */
export function gridStep(max: number, unit: CostUnit) {
  const base = unit === "cost" ? 5 : 1_000_000;
  for (const m of [1, 2, 4, 10, 20, 40, 100, 200, 400, 1000]) {
    if (max / (base * m) <= 6) return base * m;
  }
  return Math.ceil(max / 6);
}
