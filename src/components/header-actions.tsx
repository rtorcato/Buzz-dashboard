"use client";

import { ClockAlert, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { CostChip } from "@/components/cost-chip";
import { Button } from "@/components/ui/button";
import { STALE_AFTER_MS } from "@/lib/age";
import { formatWhen } from "@/lib/format-time";
import { REFRESH_MS, useSettings } from "@/lib/settings";

export function HeaderActions({
  updatedAt,
  costToday,
}: {
  updatedAt: string | null;
  /** Estimated dollars today, or null with no cost source (#42). */
  costToday: number | null;
}) {
  const router = useRouter();
  const settings = useSettings();
  const refreshEvery = REFRESH_MS[settings.refresh];
  const [refreshing, startRefresh] = useTransition();
  const [now, setNow] = useState(() => Date.now());

  const refresh = () => startRefresh(() => router.refresh());

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    // Off still lets you refresh by hand.
    const poll = refreshEvery
      ? setInterval(() => router.refresh(), refreshEvery)
      : undefined;
    return () => {
      clearInterval(tick);
      clearInterval(poll);
    };
  }, [router, refreshEvery]);

  const age = updatedAt ? now - Date.parse(updatedAt) : 0;
  const stale = age > STALE_AFTER_MS;

  return (
    <div className="ml-auto flex items-center gap-2 whitespace-nowrap text-sm text-muted-foreground">
      {costToday !== null && (
        <>
          <CostChip value={costToday} />
          <span
            className="mx-1 hidden h-5 w-px bg-border sm:block"
            aria-hidden
          />
        </>
      )}
      {!updatedAt ? (
        <>
          <span
            className="size-2 rounded-full bg-muted-foreground/50"
            aria-hidden
          />
          <span>Not connected</span>
        </>
      ) : stale ? (
        <ClockAlert className="size-4 text-warning" aria-hidden />
      ) : (
        <span className="relative flex size-2" aria-hidden>
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60 motion-reduce:hidden" />
          <span className="relative inline-flex size-2 rounded-full bg-success" />
        </span>
      )}
      {updatedAt && (
        <span
          className={stale ? "text-warning tabular-nums" : "tabular-nums"}
          suppressHydrationWarning
        >
          {/* Phones drop "Updated" to make room for the cost chip. */}
          <span className="hidden sm:inline">Updated </span>
          {formatWhen(now - age, now, settings)}
        </span>
      )}
      <Button
        variant="ghost"
        size="icon"
        className="ml-1 size-9"
        aria-label="Refresh"
        onClick={refresh}
        disabled={refreshing}
      >
        <RefreshCw
          className={refreshing ? "animate-spin" : undefined}
          aria-hidden
        />
      </Button>
    </div>
  );
}
