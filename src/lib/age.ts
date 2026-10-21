// Compact elapsed time for the header and Needs-you rows: "14s", "7m", "2h 14m", "3d".
export function formatAge(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return m % 60 ? `${h}h ${m % 60}m` : `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

// DESIGN.md: "Updated 7m ago" turns warning after 5 min without a successful refresh.
export const STALE_AFTER_MS = 5 * 60_000;
