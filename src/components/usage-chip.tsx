"use client";

import { cn } from "cn";
import {
  CirclePause,
  ClockAlert,
  Gauge,
  type LucideIcon,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";
import { LocalTime } from "@/components/local-time";
import { AnimatedNumber } from "@/components/motion-primitives/animated-number";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatAge } from "@/lib/age";
import type { Usage } from "@/lib/status-feed";
import { pausesAt, usageState } from "@/lib/usage";

// DESIGN.md → "Usage chip" (#25).
export function UsageChip({
  usage,
  publishedAt,
  stale,
  now,
}: {
  usage: Usage | null;
  /** Unix seconds the status feed was written, or null if there is none. */
  publishedAt: number | null;
  /** Feed older than 10 minutes, or the last fetch failed (server-side). */
  stale: boolean;
  /** Epoch ms. */
  now: number;
}) {
  // Tooltips don't open on touch, so a tap toggles it on phones.
  const [open, setOpen] = useState(false);
  const nowS = now / 1000;
  const age = publishedAt === null ? 0 : nowS - publishedAt;
  const s = usage && usageState(usage, nowS);

  let Icon: LucideIcon = Gauge;
  if (s?.tripped) Icon = CirclePause;
  else if (usage && stale) Icon = ClockAlert;

  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger
        closeOnClick={false}
        onClick={() => setOpen((o) => !o)}
        aria-label={
          usage
            ? `Claude usage: 5h ${usage.fiveH}%, 7d ${usage.sevenD}%${s?.tripped ? ", paused" : ""}`
            : "Usage not reported"
        }
        className={cn(
          "flex h-9 items-center gap-2 rounded-md border px-2.5 text-xs outline-none transition-colors duration-200 focus-visible:ring-3 focus-visible:ring-ring/50",
          (!usage || stale) && "border-dashed",
          !usage && "text-muted-foreground",
          s?.tripped && "border-warning bg-warning/10",
        )}
      >
        <Icon
          className={cn(
            "size-4 shrink-0",
            (s?.tripped || (usage && stale)) && "text-warning",
          )}
          aria-hidden
        />
        {!usage || !s ? (
          <span className="hidden sm:inline">Usage not reported</span>
        ) : (
          <>
            {s.tripped && (
              <span className="hidden font-medium text-warning sm:inline">
                Paused
                {s.resumesAt !== null && (
                  <>
                    {" · resets "}
                    <LocalTime at={s.resumesAt} />
                  </>
                )}
              </span>
            )}
            <span
              className={cn(
                "hidden items-center gap-3 sm:flex",
                stale && "opacity-60",
              )}
            >
              <Meter
                label="5h"
                value={usage.fiveH}
                tick={usage.fiveHPauseAt}
                warn={s.tripped === "5h"}
              />
              <Meter
                label="7d"
                value={usage.sevenD}
                tick={s.budget}
                warn={s.overBudget || s.tripped === "7d"}
              />
            </span>
            <span className="tabular-nums sm:hidden">
              <AnimatedNumber value={usage.fiveH} />% ·{" "}
              <AnimatedNumber value={usage.sevenD} />%
            </span>
            {stale ? (
              <span
                className="hidden text-warning tabular-nums sm:inline"
                suppressHydrationWarning
              >
                as of {formatAge(age * 1000)} ago
              </span>
            ) : (
              s.overBudget && (
                <span className="hidden items-center gap-1 text-warning sm:flex">
                  <TrendingUp className="size-3.5" aria-hidden />
                  Over budget
                </span>
              )
            )}
          </>
        )}
      </TooltipTrigger>
      <TooltipContent side="bottom" className="block space-y-1 text-left">
        <p className="font-medium">Claude usage</p>
        {!usage || !s ? (
          <p>The status feed doesn&apos;t report usage yet.</p>
        ) : (
          <>
            <p className="tabular-nums">
              5-hour: {usage.fiveH}%{pausesAt(usage.fiveHPauseAt)}
              {usage.fiveHResetsAt !== null && (
                <>
                  {" · resets "}
                  <LocalTime at={usage.fiveHResetsAt} />
                </>
              )}
            </p>
            <p className="tabular-nums">
              Weekly: {usage.sevenD}%
              {s.budget !== null && ` · budget ${s.budget}%`}
              {pausesAt(usage.sevenDPauseAt)}
            </p>
            <p className="opacity-70">
              The budget is the share of the week gone, plus 10%.
              {usage.sevenDResetsAt !== null && (
                <>
                  {" The week resets "}
                  <LocalTime at={usage.sevenDResetsAt} weekday />.
                </>
              )}
            </p>
            <p className="opacity-70" suppressHydrationWarning>
              Reading {formatAge(age * 1000)} ago, from the status feed
            </p>
          </>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

function Meter({
  label,
  value,
  tick,
  warn,
}: {
  label: string;
  value: number;
  tick: number | null;
  warn: boolean;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="relative h-1.5 w-12 overflow-hidden rounded-full bg-muted">
        <span
          className={cn(
            "absolute inset-0 origin-left rounded-full transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none",
            warn ? "bg-warning" : "bg-foreground/60",
          )}
          style={{
            transform: `scaleX(${Math.min(100, Math.max(0, value)) / 100})`,
          }}
        />
        {tick !== null && (
          <span
            className="absolute inset-y-0 w-px bg-foreground"
            style={{ left: `${tick}%` }}
          />
        )}
      </span>
      <span className={cn("tabular-nums", warn && "text-warning")}>
        <AnimatedNumber value={value} />%
      </span>
    </span>
  );
}
