import { cn } from "cn";
import {
  BookOpen,
  Calendar,
  Check,
  ChevronRight,
  Coins,
  DatabaseZap,
  Info,
  type LucideIcon,
  PlugZap,
  Trophy,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { CostControls } from "@/components/cost-controls";
import { EmptyState, SourceDown } from "@/components/states";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  type AgentCost,
  COST_DOCS,
  COST_RANGES,
  type CostRange,
  type CostUnit,
  cacheHit,
  DEFAULT_COST_RANGE,
  formatTokens,
  formatUnit,
  formatUsd,
  gridStep,
  summarizeCost,
  type Tier,
  tierNames,
  total,
} from "@/lib/cost";
import { costConnected } from "@/lib/cost-source";
import { costByDay, historyEnabled } from "@/lib/history";
import { dayStarts } from "@/lib/hive";

export const metadata: Metadata = { title: "Cost · Hive" };

const SOURCES = "/settings?tab=sources";
const MINI_CHARTS = 4;
/** Tier 0 is the top of each stack, so the cheapest model sits at the bottom. */
const TIER_BG = ["bg-model-1", "bg-model-2", "bg-model-3"];

const one = (v: string | string[] | undefined) =>
  typeof v === "string" && v ? v : null;

const initials = (name: string) =>
  name
    .split(/[\s-]+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const pct = (n: number | null) =>
  n === null ? "—" : `${Math.round(n * 100)}%`;

const dayLabel = (s: number) =>
  new Date(s * 1000).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

export default async function CostPage({ searchParams }: PageProps<"/cost">) {
  // Cost lives in the history store (#39); without it the view isn't there.
  if (!historyEnabled()) notFound();
  const params = await searchParams;
  const rangeParam = one(params.range);
  const range: CostRange =
    rangeParam && rangeParam in COST_RANGES
      ? (rangeParam as CostRange)
      : DEFAULT_COST_RANGE;
  const unit: CostUnit = one(params.unit) === "tokens" ? "tokens" : "cost";
  const days = COST_RANGES[range];

  const header = (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
      <EstimatePill />
      <p className="text-sm text-muted-foreground max-md:hidden">
        Not what a subscription plan bills. Tokens are exact; dollars are the
        list-price equivalent.
      </p>
      <div className="md:ml-auto">
        <CostControls unit={unit} range={range} />
      </div>
    </div>
  );

  if (!(await costConnected())) {
    return (
      <div className="space-y-6">
        <h2 className="sr-only">Cost</h2>
        {header}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {["Today", "This week", "Cache hit rate", "Top agent"].map((l) => (
            <Stat key={l} label={l} value="–" sub="not connected" />
          ))}
        </div>
        <NotConnected />
      </div>
    );
  }

  const now = new Date();
  // At least 14 days, so This week has a last week to compare with.
  const starts = dayStarts(now, Math.max(days, 14));
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  let rows: Awaited<ReturnType<typeof costByDay>>;
  try {
    rows = await costByDay(new Date(starts[0] * 1000), timeZone);
  } catch (err) {
    console.error("Cost:", err);
    return (
      <SourceDown source="the history database">
        The cost query failed. Check DATABASE_URL and that Postgres is running;
        the other views are unaffected.
      </SourceDown>
    );
  }
  const s = summarizeCost(rows, starts, days, unit);
  const names = tierNames(s.tiers);
  const period = days === 7 ? "last 7 days" : `last ${days} days`;
  const showAll = one(params.agents) === "all";
  const charted = showAll ? s.agents : s.agents.slice(0, MINI_CHARTS);

  return (
    <div className="space-y-6">
      <h2 className="sr-only">Cost</h2>
      {header}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat
          label="Today"
          icon={Coins}
          value={formatUsd(total(s.today, "cost"))}
          sub={`est. · ${formatTokens(total(s.today, "tokens"))} tokens`}
        />
        <Stat
          label="This week"
          icon={Calendar}
          value={formatUsd(total(s.week, "cost"))}
          sub={`est. · ${formatUsd(total(s.lastWeek, "cost"))} last week`}
        />
        <Stat
          label="Cache hit rate"
          icon={DatabaseZap}
          value={pct(cacheHit(s.range))}
          sub="of input tokens read from cache"
        />
        <Stat
          label="Top agent"
          icon={Trophy}
          value={s.topAgent?.agent ?? "—"}
          sub={
            s.topAgent
              ? `${formatUsd(s.topAgent.cost)} this week · ${pct(s.topAgent.share)} of total`
              : "no spend this week"
          }
        />
      </div>

      {s.agents.length === 0 ? (
        <EmptyState icon={Coins} title="No cost reports in this range">
          Agents report every minute while they work. Check{" "}
          <Link href={SOURCES} className="underline underline-offset-3">
            Settings → Sources
          </Link>{" "}
          to see which agents are reporting.
        </EmptyState>
      ) : (
        <>
          <Card className="gap-4 px-4 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-medium">
                  Daily {unit === "cost" ? "cost" : "tokens"} per agent, by
                  model
                </h3>
                <p className="text-xs text-muted-foreground">
                  same scale on every chart · {period}
                </p>
              </div>
              <Legend names={names} />
            </div>
            <MiniCharts
              agents={charted}
              days={s.days}
              unit={unit}
              names={names}
            />
            {!showAll && s.agents.length > MINI_CHARTS && (
              <Link
                href={`/cost?${new URLSearchParams({ ...(params as Record<string, string>), agents: "all" })}`}
                scroll={false}
                className="flex w-fit items-center gap-1 text-sm underline underline-offset-3"
              >
                {s.agents.length - MINI_CHARTS} more agents
                <ChevronRight className="size-4" aria-hidden />
              </Link>
            )}
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <TopAgents agents={s.agents} unit={unit} period={period} />
            <Card className="gap-4 px-4 sm:px-6">
              <div>
                <h3 className="font-medium">Cost per channel</h3>
                <p className="text-xs text-muted-foreground">
                  from each turn’s channel
                </p>
              </div>
              <NotConnectedBox
                name="Cost per channel"
                text="Needs per-turn reports, which carry each turn’s channel. Cost reports from OpenTelemetry don’t."
              />
              <p className="text-xs text-muted-foreground">
                Per channel, not per issue: a turn knows its channel, not which
                issue it worked on.
              </p>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function EstimatePill() {
  return (
    <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-dashed px-2.5 py-1 text-xs font-medium">
      <Info className="size-3.5" aria-hidden />
      Estimated, at API list price
    </span>
  );
}

function Stat({
  label,
  icon: Icon,
  value,
  sub,
}: {
  label: string;
  icon?: LucideIcon;
  value: ReactNode;
  sub: string;
}) {
  return (
    <Card className="gap-0 p-5">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{label}</span>
        {Icon && <Icon className="size-4" aria-hidden />}
      </div>
      <div className="mt-2 truncate text-3xl font-semibold tracking-tight tabular-nums">
        {value}
      </div>
      <p
        className={cn(
          "mt-1 text-xs text-muted-foreground",
          sub === "not connected" && "font-mono",
        )}
      >
        {sub}
      </p>
    </Card>
  );
}

function NotConnectedBox({ name, text }: { name: string; text: string }) {
  return (
    <div className="rounded-lg border border-dashed p-4">
      <p className="text-sm font-medium">{name}</p>
      <p className="text-sm text-muted-foreground">{text}</p>
      <p className="mt-2 font-mono text-xs text-muted-foreground">
        not connected
      </p>
    </div>
  );
}

// DESIGN.md → Cost → Not connected. The copy never names the connection
// method, which differs per deployment.
function NotConnected() {
  return (
    <Card className="items-center gap-4 px-6 py-10 text-center">
      <span className="flex size-12 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <PlugZap className="size-6" aria-hidden />
      </span>
      <h3 className="text-lg font-semibold">Connect a cost source</h3>
      <p className="max-w-lg text-sm text-muted-foreground">
        Your agents already report tokens and an estimated cost for every turn.
        The dashboard can’t read those reports until a cost source is connected.
        Until then this page stays empty, with no guessed numbers.
      </p>
      <ul className="space-y-1 text-left text-sm text-muted-foreground">
        {[
          "Daily cost and tokens per agent, split by model",
          "Cache hit rate, top agents and cost per channel",
          "Cost alerts, e.g. “an agent is over $40 today”",
        ].map((t) => (
          <li key={t} className="flex items-center gap-2">
            <Check className="size-4 shrink-0" aria-hidden />
            {t}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap justify-center gap-2">
        <Link href={SOURCES} className={cn(buttonVariants(), "h-9")}>
          <PlugZap aria-hidden />
          Connect a cost source
        </Link>
        <a
          href={COST_DOCS}
          target="_blank"
          rel="noreferrer"
          className={cn(buttonVariants({ variant: "outline" }), "h-9")}
        >
          <BookOpen aria-hidden />
          How cost data works
        </a>
      </div>
      <p className="text-xs text-muted-foreground">
        Only the hive owner can connect it. The dashboard stays read-only either
        way.
      </p>
    </Card>
  );
}

function Legend({ names }: { names: [string, string, string] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {names.map((n, i) =>
        n ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: tiers are fixed and ordered
          <li key={i} className="flex items-center gap-1.5">
            <span
              className={cn("size-2.5 rounded-sm", TIER_BG[i])}
              aria-hidden
            />
            {n}
          </li>
        ) : null,
      )}
    </ul>
  );
}

const STACK: Tier[] = [2, 1, 0];

// Small multiples on one shared y scale, so a tall bar means more money
// wherever it is. Plain divs, like the Flow charts: no chart library.
function MiniCharts({
  agents,
  days,
  unit,
  names,
}: {
  agents: AgentCost[];
  days: number[];
  unit: CostUnit;
  names: [string, string, string];
}) {
  const max = Math.max(
    ...agents.flatMap((a) => a.days.map((c) => total(c, unit))),
    0,
  );
  const step = gridStep(max, unit);
  const scale = Math.max(step, Math.ceil(max / step) * step);
  const lines = Array.from({ length: scale / step + 1 }, (_, i) => i * step);
  // On phones the charts show the last 7 days.
  const phoneFrom = days.length - 7;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {agents.map((a) => (
        <div key={a.agent} className="space-y-2 rounded-lg border p-3">
          <div className="flex items-center gap-2">
            <Avatar className="size-6">
              <AvatarFallback className="text-[10px] font-medium">
                {initials(a.agent)}
              </AvatarFallback>
            </Avatar>
            <span className="min-w-0 flex-1 truncate text-sm font-medium">
              {a.agent}
            </span>
            <span className="text-sm tabular-nums">
              {formatUnit(total(a.total, unit), unit)}
            </span>
          </div>
          <div className="relative h-28">
            {lines.map((l) => (
              <span
                key={l}
                className="absolute inset-x-0 border-t border-dashed border-border"
                style={{ bottom: `${(l / scale) * 100}%` }}
                aria-hidden
              />
            ))}
            <div className="relative flex h-full items-end gap-0.5">
              {a.days.map((c, i) => {
                const t = total(c, unit);
                const tip = [
                  `${a.agent} · ${dayLabel(days[i])}`,
                  ...STACK.filter((k) => c[unit][k] > 0).map(
                    (k) => `${names[k]}: ${formatUnit(c[unit][k], unit)}`,
                  ),
                  `${formatUsd(total(c, "cost"))} est. · ${formatTokens(total(c, "tokens"))} tokens · ${pct(cacheHit(c))} cached`,
                ].join("\n");
                return (
                  <div
                    key={days[i]}
                    title={tip}
                    className={cn(
                      "flex h-full flex-1 flex-col-reverse gap-0.5",
                      i < phoneFrom && "max-sm:hidden",
                    )}
                  >
                    <span className="sr-only">{tip}</span>
                    {STACK.map((k) => {
                      const h = (c[unit][k] / scale) * 100;
                      return h > 0 ? (
                        <span
                          key={k}
                          className={cn(
                            "w-full last:rounded-t-[4px]",
                            TIER_BG[k],
                          )}
                          style={{ height: `${h}%` }}
                        />
                      ) : null;
                    })}
                    {t === 0 && <span className="h-px w-full bg-border" />}
                  </div>
                );
              })}
            </div>
          </div>
          {days.length <= 14 && (
            <div
              className="flex gap-0.5 text-center text-[10px] text-muted-foreground"
              aria-hidden
            >
              {days.map((d, i) => (
                <span
                  key={d}
                  className={cn("flex-1", i < phoneFrom && "max-sm:hidden")}
                >
                  {dayLabel(d)[0]}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function TopAgents({
  agents,
  unit,
  period,
}: {
  agents: AgentCost[];
  unit: CostUnit;
  period: string;
}) {
  const max = Math.max(...agents.map((a) => total(a.total, unit)), 0) || 1;
  return (
    <Card className="gap-0 py-0">
      <div className="px-4 py-4 sm:px-6">
        <h3 className="font-medium">Top agents by {unit}</h3>
        <p className="text-xs text-muted-foreground">{period}</p>
      </div>
      <div className="overflow-x-auto border-t">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr className="border-b">
              <th className="px-4 py-2 font-medium sm:pl-6">Agent</th>
              <th className="px-2 py-2 font-medium">
                {unit === "cost" ? "Cost" : "Tokens"} by model
              </th>
              <th className="px-2 py-2 text-right font-medium">Est. cost</th>
              <th className="px-2 py-2 text-right font-medium max-md:hidden">
                Tokens
              </th>
              <th className="px-4 py-2 text-right font-medium max-md:hidden sm:pr-6">
                Cache hit
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {agents.map((a) => (
              <tr key={a.agent}>
                <td className="max-w-40 truncate px-4 py-2.5 sm:pl-6">
                  {a.agent}
                </td>
                <td className="min-w-24 px-2 py-2.5">
                  <div
                    className="flex h-2.5 gap-0.5"
                    style={{ width: `${(total(a.total, unit) / max) * 100}%` }}
                    aria-hidden
                  >
                    {STACK.map((k) =>
                      a.total[unit][k] > 0 ? (
                        <span
                          key={k}
                          className={cn("h-full rounded-sm", TIER_BG[k])}
                          style={{ flexGrow: a.total[unit][k] }}
                        />
                      ) : null,
                    )}
                  </div>
                </td>
                <td className="px-2 py-2.5 text-right tabular-nums">
                  {formatUsd(total(a.total, "cost"))}
                </td>
                <td className="px-2 py-2.5 text-right tabular-nums max-md:hidden">
                  {formatTokens(total(a.total, "tokens"))}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums max-md:hidden sm:pr-6">
                  {pct(cacheHit(a.total))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
