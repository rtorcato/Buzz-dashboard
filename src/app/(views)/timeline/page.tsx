import { cn } from "cn";
import {
  Activity,
  ChevronDown,
  ExternalLink,
  GitBranch,
  GitMerge,
  GitPullRequest,
  GitPullRequestClosed,
  Hexagon,
  type LucideIcon,
  MessageSquare,
  PlugZap,
  Tag,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { LocalTime } from "@/components/local-time";
import { EmptyState, SourceDown } from "@/components/states";
import { TimelineFilters } from "@/components/timeline-filters";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  countEventsByDay,
  type EventQuery,
  historyEnabled,
  historyRepos,
  historyStats,
  listEvents,
} from "@/lib/history";
import { agentName, dayStarts, loadHive } from "@/lib/hive";
import { npubEncode } from "@/lib/npub";
import {
  type DayGroup,
  groupByDay,
  type Names,
  parseFilters,
  RANGES,
  type Row,
  type RowIcon,
  splitMatches,
  TYPES,
  toRow,
} from "@/lib/timeline";

export const metadata: Metadata = { title: "Timeline · Hive" };

const PAGE_SIZE = 100;
const MAX_ROWS = 1000;

const ICONS: Record<RowIcon, LucideIcon> = {
  merged: GitMerge,
  opened: GitPullRequest,
  closed: GitPullRequestClosed,
  claimed: Tag,
  message: MessageSquare,
  other: Activity,
};

// Day labels and buckets follow the server clock, like "Today" on the other
// views; row times use the viewer's Time settings.
const dayStart = (at: number) =>
  new Date(at * 1000).setHours(0, 0, 0, 0) / 1000;
// "Thu Oct 22", without the comma en-US puts after the weekday.
const dateLabel = (at: number) =>
  new Date(at * 1000)
    .toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    })
    .replace(",", "");
const shortDate = (d: Date) =>
  d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

function Highlight({ text, q }: { text: string; q: string }) {
  return splitMatches(text, q).map((part, i) =>
    i % 2 ? (
      // biome-ignore lint/suspicious/noArrayIndexKey: parts have no identity
      <mark key={i} className="rounded-sm bg-mark px-0.5 text-mark-foreground">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

// DESIGN.md → Timeline → Source badge. The label carries the meaning.
function SourceBadge({ source }: { source: Row["source"] }) {
  const buzz = source === "buzz";
  const Icon = buzz ? Hexagon : GitBranch;
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-1 rounded-md border px-1.5 text-xs font-medium",
        buzz ? "border-mark bg-mark text-mark-foreground" : "bg-card",
      )}
    >
      <Icon className="size-3" aria-hidden />
      {buzz ? "Buzz" : "GitHub"}
    </span>
  );
}

function FeedRow({ row, q }: { row: Row; q: string }) {
  const Icon = ICONS[row.icon];
  const where = row.source === "buzz" ? "in Buzz" : "on GitHub";
  return (
    <li className="relative grid grid-cols-[auto_1fr] gap-x-3 px-4 py-4 sm:px-6 md:grid-cols-[4.5rem_auto_1fr_auto]">
      <span className="hidden pt-1.5 font-mono text-sm text-muted-foreground tabular-nums md:block">
        <LocalTime at={row.at} />
      </span>
      <span className="flex size-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 space-y-1.5">
        <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
          <SourceBadge source={row.source} />
          <Avatar className="size-5">
            <AvatarFallback className="text-[10px] font-medium">
              {initials(row.actor)}
            </AvatarFallback>
          </Avatar>
          <span className="font-medium">{row.actor}</span>
          <span className="text-muted-foreground">{row.verb}</span>
          {row.target && (
            <span className="font-mono text-[13px]">
              <Highlight text={row.target} q={q} />
            </span>
          )}
        </p>
        {row.snippet && (
          <p className="break-words text-muted-foreground">
            <Highlight text={row.snippet} q={q} />
          </p>
        )}
        {row.chips.length > 0 && (
          <p className="flex flex-wrap gap-1.5">
            {row.chips.map((c) => (
              <span
                key={c}
                className="rounded-md border px-1.5 font-mono text-xs text-muted-foreground"
              >
                {c}
              </span>
            ))}
          </p>
        )}
      </div>
      {row.url && (
        <>
          <a
            href={row.url}
            target="_blank"
            rel="noreferrer"
            className="hidden size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground md:flex"
            aria-label={`Open ${row.target ?? "event"} ${where}`}
          >
            <ExternalLink className="size-4" aria-hidden />
          </a>
          {/* On phones the whole row is the link. */}
          <a
            href={row.url}
            target="_blank"
            rel="noreferrer"
            className="absolute inset-0 md:hidden"
          >
            <span className="sr-only">
              Open {row.target ?? "event"} {where}
            </span>
          </a>
        </>
      )}
    </li>
  );
}

function DayLabel({ group, today }: { group: DayGroup; today: number }) {
  const name =
    group.start === today
      ? "Today"
      : group.start === dayStart(today - 43_200)
        ? "Yesterday"
        : null;
  return (
    <h3 className="sticky top-14 z-[1] border-b bg-muted/60 px-4 py-2 text-xs backdrop-blur sm:px-6">
      {name && <span className="mr-1.5 font-semibold">{name}</span>}
      <span className={name ? "text-muted-foreground" : "font-semibold"}>
        {dateLabel(group.start)}
      </span>
      <span className="text-muted-foreground"> · {group.rows.length}</span>
    </h3>
  );
}

// "Matches per day" (DESIGN.md → Timeline → Results line): today in chart-1.
function MatchStrip({ days, counts }: { days: number[]; counts: number[] }) {
  const max = Math.max(1, ...counts);
  return (
    <figure className="hidden w-full max-w-md shrink-0 md:block">
      <div
        className="flex h-11 items-end gap-0.5"
        role="img"
        aria-label={`Matches per day: ${counts.join(", ")}, oldest first`}
      >
        {counts.map((c, i) => (
          <span
            key={days[i]}
            className={cn(
              "flex-1 rounded-t-sm",
              i === counts.length - 1 ? "bg-chart-1" : "bg-chart-3",
            )}
            style={{ height: `${Math.max(4, (c / max) * 100)}%` }}
          />
        ))}
      </div>
      <figcaption className="mt-1 flex justify-between text-xs text-muted-foreground">
        <span>{shortDate(new Date(days[0] * 1000))}</span>
        <span>Matches per day</span>
        <span>Today</span>
      </figcaption>
    </figure>
  );
}

// No DATABASE_URL: the dashed not-connected box (DESIGN.md → History views).
function NotConnected() {
  return (
    <Card className="gap-4 px-4 sm:px-6">
      <div className="rounded-lg border border-dashed p-4">
        <p className="font-medium">Timeline history</p>
        <p className="text-sm text-muted-foreground">
          One searchable stream of GitHub and Buzz events, kept for 90 days.
        </p>
        <p className="mt-2 font-mono text-xs text-muted-foreground">
          not connected
        </p>
      </div>
      <Link
        href="/settings"
        className={cn(buttonVariants({ variant: "outline" }), "h-9 w-fit")}
      >
        <PlugZap aria-hidden />
        Connect a source
      </Link>
    </Card>
  );
}

const short = (hex: string) => {
  const npub = npubEncode(hex);
  return `${npub.slice(0, 10)}…${npub.slice(-4)}`;
};

export default async function TimelinePage({
  searchParams,
}: PageProps<"/timeline">) {
  if (!historyEnabled()) return <NotConnected />;

  const params = await searchParams;
  const filters = parseFilters(params);
  const limit = Math.min(
    MAX_ROWS,
    Math.max(PAGE_SIZE, Number(params.n) || PAGE_SIZE),
  );
  const now = new Date();
  const days = dayStarts(now, RANGES[filters.range].days);

  const { hive } = await loadHive();
  const agents = hive?.agents ?? [];
  const byKey = new Map(
    agents.flatMap((a) => a.pubkeys.map((k) => [k, a.name])),
  );
  const names: Names = {
    actor: (raw) =>
      byKey.get(raw) ??
      (/^[0-9a-f]{64}$/.test(raw) ? short(raw) : agentName(raw)),
    channel: (id) => hive?.channels[id] ?? null,
  };
  const agent = agents.find((a) => a.name === filters.agent);

  const query: EventQuery = {
    since: new Date(days[0] * 1000),
    source: filters.source ?? undefined,
    kinds: filters.type ? [...TYPES[filters.type].kinds] : undefined,
    repo: filters.repo ?? undefined,
    // GitHub rows name the agent (maybe by a former name); Buzz rows key it.
    actors: filters.agent
      ? [
          filters.agent,
          ...(agent?.formerNames ?? []),
          ...(agent?.pubkeys ?? []),
        ]
      : undefined,
    text: filters.q || undefined,
  };

  let data: Awaited<ReturnType<typeof readHistory>>;
  try {
    data = await readHistory(query, limit, filters.q !== "");
  } catch (err) {
    console.error("Timeline:", err);
    return (
      <SourceDown source="the history database">
        The Timeline query failed. Check DATABASE_URL and that Postgres is
        running; the other views are unaffected.
      </SourceDown>
    );
  }
  const { events, stats, repos, perDay } = data;

  const rows = events.map((e) => toRow(e, names, filters.q));
  const groups = groupByDay(rows, dayStart);
  const filtered = Object.keys(params).some((k) => k !== "n");
  const counts = perDay
    ? days.map(
        (d) => perDay.find((p) => p.day.getTime() / 1000 === d)?.count ?? 0,
      )
    : null;
  const nextLimit = Math.min(MAX_ROWS, limit + PAGE_SIZE);
  const olderHref = `/timeline?${new URLSearchParams({
    ...Object.fromEntries(
      Object.entries(params).filter(
        (e): e is [string, string] => typeof e[1] === "string",
      ),
    ),
    n: String(nextLimit),
  })}`;

  return (
    <div className="space-y-6">
      <h2 className="sr-only">Timeline</h2>
      <Card className="gap-4 px-4 sm:px-6">
        <TimelineFilters
          filters={filters}
          repos={repos}
          agents={agents.map((a) => a.name).sort()}
        />
        {counts && (
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
              <p aria-live="polite">
                <strong className="tabular-nums">
                  {counts.reduce((a, b) => a + b, 0).toLocaleString()}
                </strong>{" "}
                results for{" "}
                <span className="font-mono text-[13px]">{filters.q}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                {RANGES[filters.range].label} · newest first · matches message
                text, PR and issue titles and repo names
              </p>
            </div>
            <MatchStrip days={days} counts={counts} />
          </div>
        )}
      </Card>

      {rows.length === 0 ? (
        filtered ? (
          <EmptyState icon={Activity} title="Nothing matches">
            No stored events match these filters.{" "}
            <Link href="/timeline" className="underline underline-offset-3">
              Clear filters
            </Link>
          </EmptyState>
        ) : (
          <EmptyState icon={Activity} title="No history yet">
            The ingester stores GitHub and Buzz events every minute, so the
            first ones show up here shortly.
          </EmptyState>
        )
      ) : (
        <Card className="gap-0 divide-y overflow-visible py-0 [&>section:first-child>h3]:rounded-t-xl">
          {groups.map((g) => (
            <section key={g.start} aria-label={dateLabel(g.start)}>
              <DayLabel group={g} today={dayStart(now.getTime() / 1000)} />
              <ol className="divide-y">
                {g.rows.map((r) => (
                  <FeedRow key={r.id} row={r} q={filters.q} />
                ))}
              </ol>
            </section>
          ))}
          <footer className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-4 sm:px-6">
            <p className="text-xs text-muted-foreground">
              {stats.since && <>Stored since {shortDate(stats.since)} · </>}
              <span className="tabular-nums">
                {stats.events.toLocaleString()}
              </span>{" "}
              events
              {stats.events > 0 &&
                ` · ${Math.round((stats.buzz / stats.events) * 100)}% from Buzz`}
            </p>
            {rows.length === limit && limit < MAX_ROWS && (
              <Link
                href={olderHref}
                scroll={false}
                className={cn(buttonVariants({ variant: "outline" }), "h-9")}
              >
                Load older
                <ChevronDown aria-hidden />
              </Link>
            )}
          </footer>
        </Card>
      )}
    </div>
  );
}

async function readHistory(query: EventQuery, limit: number, search: boolean) {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [events, stats, repos, perDay] = await Promise.all([
    listEvents({ ...query, limit }),
    historyStats(),
    historyRepos(),
    search ? countEventsByDay(query, timeZone) : null,
  ]);
  return { events, stats, repos, perDay };
}
