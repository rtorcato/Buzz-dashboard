// Query params from a page's `searchParams`.

/** A param's value when it's set once and not empty, else null. */
export const one = (v: string | string[] | undefined) =>
  typeof v === "string" && v ? v : null;

/**
 * `raw` when it's one of `options`' own keys, else `fallback`. Not `in`,
 * which also takes inherited keys such as `toString` or `__proto__` (#77).
 */
export function ownKey<K extends string>(
  options: Record<K, unknown>,
  raw: string | null,
  fallback: K,
): K {
  return raw !== null && Object.hasOwn(options, raw) ? (raw as K) : fallback;
}
