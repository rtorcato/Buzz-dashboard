import { formatAge } from "./age";
import type { Settings } from "./settings";

type TimeFormat = Pick<Settings, "clock" | "timeZone" | "timestamps">;

/** A clock time such as "9:00 PM", or "Sun 12:00 PM" with `weekday`. */
export function formatClock(
  at: Date,
  { clock, timeZone }: TimeFormat,
  weekday = false,
): string {
  return at.toLocaleString([], {
    weekday: weekday ? "short" : undefined,
    hour: "numeric",
    minute: "2-digit",
    hour12: clock === "auto" ? undefined : clock === "12h",
    timeZone: timeZone === "utc" ? "UTC" : undefined,
  });
}

/** "2h ago", or a clock time when timestamps are absolute. */
export function formatWhen(atMs: number, nowMs: number, s: TimeFormat): string {
  return s.timestamps === "absolute"
    ? formatClock(new Date(atMs), s, nowMs - atMs > 12 * 3600_000)
    : `${formatAge(nowMs - atMs)} ago`;
}
