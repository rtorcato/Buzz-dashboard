import "server-only";

import path from "node:path";
import { where } from "@rtorcato/db-common";
import { toDrizzleWhere } from "@rtorcato/db-drizzle";
import { createDb, type DbHandle } from "@rtorcato/db-drizzle/connection";
import {
  and,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNotNull,
  lt,
  max,
  min,
  or,
  type SQL,
  sql,
} from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { FLOW_KINDS } from "./flow";
import {
  costPoints,
  events,
  type HistoryEvent,
  type NewCostPoint,
  settings,
} from "./history-schema";

// The optional history store (#39). Without DATABASE_URL the dashboard is the
// live-only view: historyEnabled() is false and nothing here opens a
// connection. The history views (#41 to #47) read through listEvents and
// historyStats.

const schema = { events, costPoints, settings };
type Db = DbHandle<typeof schema>["db"];

/** True when DATABASE_URL is set, so the history views and nav show. */
export const historyEnabled = () => Boolean(process.env.DATABASE_URL);

const DEFAULT_RETENTION_DAYS = 90;

/** HISTORY_RETENTION_DAYS, a whole number of days; 90 when unset or invalid. */
export function retentionDays(raw = process.env.HISTORY_RETENTION_DAYS) {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : DEFAULT_RETENTION_DAYS;
}

let handle: DbHandle<typeof schema> | undefined;

/** The shared pool. Throws when DATABASE_URL is unset; check historyEnabled(). */
export function historyDb(): Db {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  // A timeout so an unreachable host can't hang the server start.
  handle ??= createDb(
    { connectionString: url, max: 5, connectionTimeoutMillis: 10_000 },
    schema,
  );
  return handle.db;
}

/** Applies any pending migrations from drizzle/. Safe to run on every start. */
export async function migrateHistory() {
  // The Docker image copies drizzle/ next to server.js, which is the cwd.
  await migrate(historyDb(), {
    migrationsFolder: path.join(process.cwd(), "drizzle"),
  });
}

/** Deletes events and cost points past the retention window; returns how many. */
export async function pruneHistory(now = new Date()) {
  const cutoff = new Date(now.getTime() - retentionDays() * 86_400_000);
  const [res, cost] = await Promise.all([
    historyDb().delete(events).where(lt(events.at, cutoff)),
    historyDb().delete(costPoints).where(lt(costPoints.at, cutoff)),
  ]);
  return (res.rowCount ?? 0) + (cost.rowCount ?? 0);
}

export type EventQuery = {
  /** Inclusive. */
  since?: Date;
  /** Exclusive. */
  until?: Date;
  source?: "github" | "buzz";
  kinds?: string[];
  repo?: string;
  /** Any of these actors: an agent's name and its pubkeys. */
  actors?: string[];
  channel?: string;
  /** Case-insensitive substring of the title, body or repo. */
  text?: string;
  /** Default 100, at most 1000. */
  limit?: number;
};

const COLS = {
  at: events.at,
  source: events.source,
  kind: events.kind,
  repo: events.repo,
  actor: events.actor,
  channel: events.channel,
};

// Every filter in `q` as one condition; limit is not a filter.
function matching(q: EventQuery): SQL | undefined {
  const filter = Object.fromEntries(
    Object.entries({
      at: { gte: q.since, lt: q.until },
      source: q.source,
      kind: q.kinds && { in: q.kinds },
      repo: q.repo,
      actor: q.actors && { in: q.actors },
      channel: q.channel,
    }).filter(([, v]) => v !== undefined),
  );
  // where() keeps undefined operator values, so drop them per column.
  const conds = where(filter).filter((c) => c.val !== undefined);
  const text = q.text?.trim();
  // Escape LIKE wildcards so "50%" matches itself.
  const like = text && `%${text.replace(/[\\%_]/g, "\\$&")}%`;
  return and(
    toDrizzleWhere(conds, COLS),
    like
      ? or(
          ilike(events.title, like),
          ilike(events.body, like),
          ilike(events.repo, like),
        )
      : undefined,
  );
}

/** Stored events matching every given filter, newest first. */
export function listEvents(q: EventQuery = {}): Promise<HistoryEvent[]> {
  return historyDb()
    .select()
    .from(events)
    .where(matching(q))
    .orderBy(desc(events.at), desc(events.sourceId))
    .limit(Math.min(Math.max(q.limit ?? 100, 1), 1000));
}

/**
 * Every stored PR event since `since`, oldest first, for the Pipeline flow
 * (#47). Only the columns it reads, and no row limit: a PR needs all of its
 * events to be measured.
 */
export function prEvents(since: Date) {
  // ponytail: a few thousand rows at 90 days and ~30 PRs a day. Aggregate in
  // SQL if the store grows past what one page load can sort.
  return historyDb()
    .select({
      kind: events.kind,
      at: events.at,
      actor: events.actor,
      repo: events.repo,
      title: events.title,
      url: events.url,
      data: events.data,
    })
    .from(events)
    .where(matching({ since, source: "github", kinds: [...FLOW_KINDS] }))
    .orderBy(events.at);
}

/**
 * How many events match, per day in `timeZone` (an IANA name), oldest first.
 * Days with no match are left out. For the Timeline's "Matches per day".
 */
export async function countEventsByDay(
  q: EventQuery,
  timeZone: string,
): Promise<{ day: Date; count: number }[]> {
  const day = sql<Date>`date_trunc('day', ${events.at}, ${timeZone})`;
  const rows = await historyDb()
    .select({ day, count: count() })
    .from(events)
    .where(matching(q))
    // By position: the time zone is a bound parameter, so repeating `day`
    // would be a different expression to Postgres.
    .groupBy(sql`1`)
    .orderBy(sql`1`);
  return rows.map((r) => ({ day: new Date(r.day), count: r.count }));
}

/** Every repo with a stored event, A to Z, for the repo filter. */
export async function historyRepos(): Promise<string[]> {
  const rows = await historyDb()
    .selectDistinct({ repo: events.repo })
    .from(events)
    .where(isNotNull(events.repo))
    .orderBy(events.repo);
  return rows.flatMap((r) => (r.repo ? [r.repo] : []));
}

export type HistoryStats = {
  events: number;
  /** How many of them came from Buzz. */
  buzz: number;
  /** The oldest stored event, or null when the store is empty. */
  since: Date | null;
  retentionDays: number;
};

/** For the "History from the database · since Sep 30" source lines. */
export async function historyStats(): Promise<HistoryStats> {
  const [row] = await historyDb()
    .select({
      events: count(),
      buzz: sql<number>`count(*) filter (where ${events.source} = 'buzz')`.mapWith(
        Number,
      ),
      since: min(events.at),
    })
    .from(events);
  return {
    events: row?.events ?? 0,
    buzz: row?.buzz ?? 0,
    since: row?.since ?? null,
    retentionDays: retentionDays(),
  };
}

/** A stored setting (#40: owner-only state), or null when unset. */
export async function getSetting(key: string): Promise<unknown> {
  const [row] = await historyDb()
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, key));
  return row?.value ?? null;
}

export async function setSetting(key: string, value: unknown) {
  await historyDb()
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value, updatedAt: new Date() },
    });
}

export async function deleteSetting(key: string) {
  await historyDb().delete(settings).where(eq(settings.key, key));
}

/** Stores cost points; a retried report inserts nothing new. */
export async function insertCostPoints(rows: NewCostPoint[]) {
  // Postgres takes at most 65,535 parameters a statement, 8 per row here.
  for (let i = 0; i < rows.length; i += 5000) {
    await historyDb()
      .insert(costPoints)
      .values(rows.slice(i, i + 5000))
      .onConflictDoNothing();
  }
}

export type CostRow = {
  /** Local midnight in `timeZone`. */
  day: Date;
  agent: string;
  model: string;
  metric: string;
  type: string;
  value: number;
};

/** Cost and token sums since `since`, per day in `timeZone`, agent and model. */
export async function costByDay(
  since: Date,
  timeZone: string,
): Promise<CostRow[]> {
  // ponytail: sums raw delta points on every load. Roll them up into daily
  // rows if a 90-day range gets slow.
  const day = sql<Date>`date_trunc('day', ${costPoints.at}, ${timeZone})`;
  const rows = await historyDb()
    .select({
      day,
      agent: costPoints.agent,
      model: costPoints.model,
      metric: costPoints.metric,
      type: costPoints.type,
      value: sql<number>`sum(${costPoints.value})`.mapWith(Number),
    })
    .from(costPoints)
    .where(gte(costPoints.at, since))
    // By position, as in countEventsByDay: the time zone is a parameter.
    .groupBy(sql`1`, sql`2`, sql`3`, sql`4`, sql`5`);
  return rows.map((r) => ({ ...r, day: new Date(r.day) }));
}

/** Estimated dollars reported since `since`, for the header's cost chip. */
export async function costSince(since: Date): Promise<number> {
  const [row] = await historyDb()
    .select({
      value: sql<number>`coalesce(sum(${costPoints.value}), 0)`.mapWith(Number),
    })
    .from(costPoints)
    .where(and(gte(costPoints.at, since), eq(costPoints.metric, "cost")));
  return row?.value ?? 0;
}

/** Each agent that reported since `since`: its last report and tokens since `today`. */
export function costReporters(since: Date, today: Date) {
  return historyDb()
    .select({
      agent: costPoints.agent,
      last: max(costPoints.at),
      tokensToday:
        sql<number>`coalesce(sum(${costPoints.value}) filter (where ${costPoints.metric} = 'tokens' and ${costPoints.at} >= ${today}), 0)`.mapWith(
          Number,
        ),
    })
    .from(costPoints)
    .where(gte(costPoints.at, since))
    .groupBy(costPoints.agent);
}

/** The newest stored cost point's time, or null with none. */
export async function newestCostPoint(): Promise<Date | null> {
  const [row] = await historyDb()
    .select({ at: max(costPoints.at) })
    .from(costPoints);
  return row?.at ?? null;
}

/** Which of these series (turn event ids, for the owner signer) are stored. */
export async function knownSeries(ids: string[]): Promise<Set<string>> {
  const known = new Set<string>();
  // Well under Postgres's 65,535 parameters a statement.
  for (let i = 0; i < ids.length; i += 10_000) {
    const rows = await historyDb()
      .selectDistinct({ series: costPoints.series })
      .from(costPoints)
      .where(inArray(costPoints.series, ids.slice(i, i + 10_000)));
    for (const r of rows) known.add(r.series);
  }
  return known;
}

/** Estimated dollars and turns per channel since `since`, costliest first. */
export function costByChannel(since: Date) {
  return historyDb()
    .select({
      channel: costPoints.channel,
      cost: sql<number>`coalesce(sum(${costPoints.value}) filter (where ${costPoints.metric} = 'cost'), 0)`.mapWith(
        Number,
      ),
      turns: sql<number>`count(distinct ${costPoints.series})`.mapWith(Number),
    })
    .from(costPoints)
    .where(and(gte(costPoints.at, since), isNotNull(costPoints.channel)))
    .groupBy(costPoints.channel)
    .orderBy(sql`2 desc`);
}

export type { HistoryEvent } from "./history-schema";
