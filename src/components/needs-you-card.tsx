import {
  ArrowRight,
  BellRing,
  Check,
  ChevronRight,
  CirclePause,
  CircleX,
  GitMerge,
  Info,
  type LucideIcon,
  OctagonAlert,
  PlugZap,
  Rocket,
} from "lucide-react";
import Link from "next/link";
import { LocalTime } from "@/components/local-time";
import { Card } from "@/components/ui/card";
import { formatAge } from "@/lib/age";
import {
  KIND_VIEW,
  type NeedsYou,
  type NeedsYouKind,
  oldestFirst,
} from "@/lib/needs-you";

const KIND: Record<NeedsYouKind, { icon: LucideIcon; tone: string }> = {
  release: {
    icon: Rocket,
    tone: "border-warning/25 bg-warning/10 text-warning",
  },
  ci: {
    icon: CircleX,
    tone: "border-destructive/20 bg-destructive/10 text-destructive",
  },
  blocked: {
    icon: OctagonAlert,
    tone: "border-destructive/20 bg-destructive/10 text-destructive",
  },
  merge: {
    icon: GitMerge,
    tone: "border-border bg-muted text-foreground",
  },
  // Amber, not red: it clears by itself at reset.
  paused: {
    icon: CirclePause,
    tone: "border-warning/25 bg-warning/10 text-warning",
  },
};

const capitalize = (s: string) => s[0].toUpperCase() + s.slice(1);

export function NeedsYouCard({ data, now }: { data: NeedsYou; now: number }) {
  // Rows a live source did report still show while the rest are disconnected.
  if (!data.connected && data.rows.length === 0) {
    return (
      <Card className="flex-row items-center gap-3 px-4 py-4 sm:px-6">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <PlugZap className="size-5" aria-hidden />
        </span>
        <div>
          <h2 className="font-semibold">Not connected yet.</h2>
          <p className="text-sm text-muted-foreground">
            No releases, CI or blocked work is being read yet, so this card
            can&apos;t say whether anything needs you.
          </p>
        </div>
      </Card>
    );
  }

  if (data.rows.length === 0) {
    return (
      <Card className="flex-row items-center gap-3 px-4 py-4 sm:px-6">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-success/10 text-success">
          <Check className="size-5" aria-hidden />
        </span>
        <div>
          <h2 className="font-semibold">All clear. Nothing needs you.</h2>
          <p className="text-sm text-muted-foreground">
            No releases waiting, main is green on every repo, nothing is
            blocked.
          </p>
        </div>
        <HeadsUp lines={data.headsUp} />
      </Card>
    );
  }

  return (
    <Card className="gap-0 py-0">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-6">
        <h2 className="flex items-center gap-2 font-semibold">
          <BellRing className="size-4 text-warning" aria-hidden />
          Needs you
          <span className="rounded-full bg-primary px-2 text-xs leading-5 text-primary-foreground tabular-nums">
            {data.rows.length}
          </span>
        </h2>
        <span className="hidden text-sm text-muted-foreground sm:inline">
          Oldest first
        </span>
      </div>
      <ul className="divide-y">
        {oldestFirst(data.rows).map((row) => {
          const { icon: Icon, tone } = KIND[row.kind];
          const view = KIND_VIEW[row.kind];
          return (
            <li key={row.kind}>
              <Link
                href={`/${view}`}
                className="flex min-h-11 items-center gap-3 px-4 py-3 outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 sm:px-6"
              >
                <span
                  className={`flex size-9 shrink-0 items-center justify-center rounded-full border ${tone}`}
                >
                  <Icon className="size-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{row.title}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {row.detail}
                    {row.kind !== "paused" ? (
                      <>
                        {" · "}
                        <span className="tabular-nums">
                          {formatAge(now - Date.parse(row.since))}
                        </span>
                      </>
                    ) : (
                      row.resetsAt != null && (
                        <>
                          {" · resets "}
                          <LocalTime at={row.resetsAt} />
                          {", in "}
                          <span className="tabular-nums">
                            {formatAge(row.resetsAt * 1000 - now)}
                          </span>
                        </>
                      )
                    )}
                  </p>
                </div>
                <span className="hidden items-center gap-1 text-sm font-medium sm:inline-flex">
                  {capitalize(view)}
                  <ArrowRight className="size-3.5" aria-hidden />
                </span>
                <ChevronRight
                  className="size-4 text-muted-foreground sm:hidden"
                  aria-hidden
                />
              </Link>
            </li>
          );
        })}
      </ul>
      <HeadsUp lines={data.headsUp} footer />
    </Card>
  );
}

function HeadsUp({ lines, footer }: { lines: string[]; footer?: boolean }) {
  if (lines.length === 0) return null;
  return (
    <div
      className={
        footer
          ? "space-y-1 border-t bg-muted/40 px-4 py-2.5 text-sm text-muted-foreground sm:px-6"
          : "ml-auto hidden space-y-1 text-sm text-muted-foreground md:block"
      }
    >
      {lines.map((line) => (
        <p key={line} className="flex items-center gap-2">
          <Info className="size-3.5 shrink-0" aria-hidden />
          Heads-up: {line}
        </p>
      ))}
    </div>
  );
}
