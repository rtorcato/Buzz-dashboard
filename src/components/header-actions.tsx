"use client";

import { ClockAlert, Moon, RefreshCw, Sun } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { UsageChip } from "@/components/usage-chip";
import { formatAge, STALE_AFTER_MS } from "@/lib/age";
import type { Usage } from "@/lib/status-feed";

const REFRESH_EVERY_MS = 60_000;

export function HeaderActions({
  updatedAt,
  feed,
}: {
  updatedAt: string | null;
  feed: { usage: Usage | null; publishedAt: number | null; stale: boolean };
}) {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [refreshing, startRefresh] = useTransition();
  const [now, setNow] = useState(() => Date.now());

  const refresh = () => startRefresh(() => router.refresh());

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const poll = setInterval(() => router.refresh(), REFRESH_EVERY_MS);
    return () => {
      clearInterval(tick);
      clearInterval(poll);
    };
  }, [router]);

  const age = updatedAt ? now - Date.parse(updatedAt) : 0;
  const stale = age > STALE_AFTER_MS;

  return (
    <div className="ml-auto flex items-center gap-2 whitespace-nowrap text-sm text-muted-foreground">
      <UsageChip {...feed} now={now} />
      <span className="mx-1 hidden h-5 w-px bg-border sm:block" aria-hidden />
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
          {/* Phones drop "Updated" to make room for the usage chip. */}
          <span className="hidden sm:inline">Updated </span>
          {formatAge(age)} ago
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
      <Button
        variant="ghost"
        size="icon"
        className="size-9"
        aria-label="Toggle theme"
        onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      >
        {/* CSS picks the icon so server and client render the same markup. */}
        <Moon className="dark:hidden" aria-hidden />
        <Sun className="hidden dark:block" aria-hidden />
      </Button>
    </div>
  );
}
