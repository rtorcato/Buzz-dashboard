import type { Usage } from "./status-feed";

// DESIGN.md → "Usage chip": the pause thresholds come from the status feed,
// and the weekly budget is the % of the week elapsed + 10.
const WEEK_S = 7 * 24 * 3600;

/** Weekly budget %, or null when the feed has no 7d reset time to anchor the week. */
export function weeklyBudget(sevenDResetsAt: number | null, now: number) {
  if (sevenDResetsAt === null) return null;
  const elapsed = (now - (sevenDResetsAt - WEEK_S)) / WEEK_S;
  return Math.min(100, Math.round(Math.max(0, elapsed) * 100 + 10));
}

export type UsageState = {
  budget: number | null;
  overBudget: boolean;
  /** The limit that tripped the pause, or null when not paused. */
  tripped: "5h" | "7d" | null;
  /** Unix seconds the pause ends, or null if unknown or not paused. */
  resumesAt: number | null;
};

export function usageState(u: Usage, now: number): UsageState {
  const budget = weeklyBudget(u.sevenDResetsAt, now);
  // The feed's `paused` is the hive's own reading; the % only says which limit.
  // ponytail: without a 7d threshold, the higher reading is taken as the one
  // that tripped. Wrong only if 5h pauses lower and is the one that hit it.
  const sevenDTripped =
    u.sevenDPauseAt !== null ? u.sevenD >= u.sevenDPauseAt : u.sevenD > u.fiveH;
  const tripped = !u.paused ? null : sevenDTripped ? "7d" : "5h";
  return {
    budget,
    overBudget: !u.paused && budget !== null && u.sevenD > budget,
    tripped,
    resumesAt:
      tripped === "7d"
        ? u.sevenDResetsAt
        : tripped === "5h"
          ? u.fiveHResetsAt
          : null,
  };
}

/** " · pauses at 90%", or "" when the feed leaves the threshold out. */
export const pausesAt = (at: number | null) =>
  at === null ? "" : ` · pauses at ${at}%`;

/** "5h window at 92% (pauses at 90%)" for the Needs-you row. */
export function trippedDetail(u: Usage, tripped: "5h" | "7d") {
  const [value, at] =
    tripped === "5h" ? [u.fiveH, u.fiveHPauseAt] : [u.sevenD, u.sevenDPauseAt];
  return `${tripped} window at ${value}%${at === null ? "" : ` (pauses at ${at}%)`}`;
}
