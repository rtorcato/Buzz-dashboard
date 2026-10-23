import "server-only";

import { and, eq, max } from "drizzle-orm";
import { readServerEnv } from "./env";
import { type GitHub, readGitHub } from "./github";
import {
  historyDb,
  migrateHistory,
  pruneHistory,
  retentionDays,
} from "./history";
import { events, type NewHistoryEvent } from "./history-schema";
import { queryAll } from "./hive";
import type { NostrEvent } from "./relay";
import { sampleMode } from "./sample-data";

// The history ingester (#39): every minute it appends what the dashboard
// already reads (GitHub PRs and claims, Buzz channel messages) to the history
// store. Every row is keyed on its source id, so a restart or an overlapping
// read never double-counts.

const INTERVAL_MS = 60_000;
// Relay events can land a little after their created_at, so each read starts
// this far before the newest stored message.
const OVERLAP_S = 10 * 60;
const BATCH = 1000;

const toDate = (secs: number) => new Date(secs * 1000);

/** PR opened / merged / closed and issue claims, one row each. */
export function githubRows(github: GitHub): NewHistoryEvent[] {
  const rows: NewHistoryEvent[] = [];
  for (const pr of github.prs) {
    const key = `${pr.repo}#${pr.number}`;
    const base = {
      source: "github",
      actor: pr.agent ?? pr.author,
      repo: pr.repo,
      title: pr.title,
      url: pr.url,
      data: { number: pr.number, labels: pr.labels, author: pr.author },
    };
    rows.push({
      ...base,
      sourceId: `${key}:opened`,
      kind: "pr_opened",
      at: toDate(pr.createdAt),
    });
    if (pr.mergedAt) {
      rows.push({
        ...base,
        sourceId: `${key}:merged`,
        kind: "pr_merged",
        at: toDate(pr.mergedAt),
      });
    } else if (pr.closedAt) {
      rows.push({
        ...base,
        sourceId: `${key}:closed`,
        kind: "pr_closed",
        at: toDate(pr.closedAt),
      });
    }
  }
  for (const c of github.claims) {
    // A PR's claim is its opening, and an issue with no trusted "Claimed by"
    // comment has no claim time to record.
    if (c.isPr || !c.agent) continue;
    rows.push({
      source: "github",
      // An issue can be claimed again later, so the time is part of the key.
      sourceId: `${c.repo}#${c.number}:claimed:${c.claimedAt}`,
      kind: "claimed",
      at: toDate(c.claimedAt),
      actor: c.agent,
      repo: c.repo,
      title: c.title,
      url: c.url,
      data: { number: c.number, labels: c.labels, author: c.author },
    });
  }
  return rows;
}

/** Channel messages (kind 9). The actor is the hex pubkey; views name it. */
export function buzzRows(messages: NostrEvent[]): NewHistoryEvent[] {
  return messages
    .filter((e) => e.kind === 9)
    .map((e) => ({
      source: "buzz",
      sourceId: e.id,
      kind: "message",
      at: toDate(e.created_at),
      actor: e.pubkey,
      channel: e.tags.find((t) => t[0] === "h")?.[1] ?? null,
      body: e.content,
    }));
}

async function insert(rows: NewHistoryEvent[]) {
  for (let i = 0; i < rows.length; i += BATCH) {
    await historyDb()
      .insert(events)
      .values(rows.slice(i, i + BATCH))
      .onConflictDoNothing();
  }
}

async function ingestGitHub() {
  const result = await readGitHub();
  if (!result.github) throw new Error(`GitHub: ${result.error}`);
  await insert(githubRows(result.github));
}

async function ingestBuzz(now: Date) {
  const [row] = await historyDb()
    .select({ newest: max(events.at) })
    .from(events)
    .where(and(eq(events.source, "buzz"), eq(events.kind, "message")));
  const floor = Math.floor(now.getTime() / 1000) - retentionDays() * 86_400;
  const since = row?.newest
    ? Math.floor(row.newest.getTime() / 1000) - OVERLAP_S
    : floor;
  // ponytail: queryAll stops at 10 relay pages (10,000 messages), so a first
  // run on a busy relay keeps only the newest of them. Page further back if a
  // full 90-day backfill matters.
  await insert(
    buzzRows(
      await queryAll(readServerEnv(), {
        kinds: [9],
        since: Math.max(since, floor),
      }),
    ),
  );
}

/** One pass: both sources, then the retention prune. Throws on any failure. */
export async function ingestOnce(now = new Date()) {
  const results = await Promise.allSettled([ingestGitHub(), ingestBuzz(now)]);
  await pruneHistory(now);
  const failed = results.flatMap((r) =>
    r.status === "rejected" ? [String(r.reason?.message ?? r.reason)] : [],
  );
  if (failed.length) throw new Error(failed.join("; "));
}

// next dev re-imports modules on reload, so the guard lives on globalThis.
const state = globalThis as { __historyIngester?: true };

/**
 * Runs the migrations, then ingests every minute. Called once from
 * instrumentation.ts when DATABASE_URL is set. A database that is down at
 * start doesn't stop the live dashboard: the next pass retries.
 */
export async function startHistory() {
  if (state.__historyIngester) return;
  state.__historyIngester = true;
  let migrated = false;
  const migrateOnce = async () => {
    if (migrated) return;
    await migrateHistory();
    migrated = true;
    console.log("History store: migrations applied.");
  };
  try {
    await migrateOnce();
  } catch (err) {
    console.error(`History store: migration failed, retrying: ${message(err)}`);
  }
  // Sample mode is fake data, so it never reaches the store.
  if (sampleMode()) return;

  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await migrateOnce();
      await ingestOnce();
    } catch (err) {
      console.error(`History ingest failed: ${message(err)}`);
    } finally {
      running = false;
    }
  };
  void tick();
  setInterval(tick, INTERVAL_MS).unref();
}

const message = (err: unknown) =>
  err instanceof Error ? err.message : String(err);
