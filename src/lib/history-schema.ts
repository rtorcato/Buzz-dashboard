import {
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

// The history store (#39). One append-only table of events from the sources
// the dashboard already reads. `pnpm db:generate` turns a change here into a
// new migration under drizzle/; the server applies it on start.
export const events = pgTable(
  "events",
  {
    /** "github" or "buzz". */
    source: text("source").notNull(),
    /** Unique per source: a Nostr event id, or "owner/repo#12:merged". */
    sourceId: text("source_id").notNull(),
    /** "message", "pr_opened", "pr_merged", "pr_closed" or "claimed". */
    kind: text("kind").notNull(),
    at: timestamp("at", { withTimezone: true }).notNull(),
    /** The agent's name when known, else a GitHub login or a hex pubkey. */
    actor: text("actor"),
    /** "owner/name" for GitHub events. */
    repo: text("repo"),
    /** Buzz channel id (the `h` tag). */
    channel: text("channel"),
    /** PR or issue title. */
    title: text("title"),
    url: text("url"),
    probe: text("probe"),
    /** Message text. */
    body: text("body"),
    /** Source-specific extras, e.g. a PR's labels and number. */
    data: jsonb("data").$type<Record<string, unknown>>(),
    ingestedAt: timestamp("ingested_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  // The primary key makes ingest idempotent: a re-read inserts nothing new.
  (t) => [
    primaryKey({ columns: [t.source, t.sourceId] }),
    index("events_at_idx").on(t.at),
  ],
);

export type HistoryEvent = typeof events.$inferSelect;
export type NewHistoryEvent = typeof events.$inferInsert;
