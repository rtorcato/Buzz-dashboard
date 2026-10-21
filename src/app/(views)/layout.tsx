import { Eye } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { HeaderActions } from "@/components/header-actions";
import { NeedsYouCard } from "@/components/needs-you-card";
import { SourceDown } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { ViewTabs } from "@/components/view-tabs";
import { countsByView, getNeedsYou } from "@/lib/needs-you";
import { loadStatusFeed } from "@/lib/status-feed";

export default async function ViewsLayout({
  children,
}: {
  children: ReactNode;
}) {
  const [needsYou, { feed, stale }] = await Promise.all([
    getNeedsYou(),
    loadStatusFeed(),
  ]);
  const now = Date.now();

  return (
    <>
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-3 px-4 sm:px-6">
          <Link
            href="/"
            className="-mx-1 flex min-h-11 items-center gap-3 rounded-md px-1 outline-none transition-opacity hover:opacity-80 focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <svg viewBox="0 0 32 32" className="size-8" aria-hidden="true">
              <rect width="32" height="32" rx="8" fill="#e19b34" />
              <path
                d="M16 5.8 L24.83 10.9 L24.83 21.1 L16 26.2 L7.17 21.1 L7.17 10.9Z"
                fill="#0A0E16"
                stroke="#0A0E16"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
              <path
                d="M8.6 16.6 H12.2 L14.2 11.6 L17.6 21 L19.6 16.6 H23.4"
                fill="none"
                stroke="#e19b34"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="font-semibold">Hive</span>
          </Link>
          <span className="hidden text-sm text-muted-foreground sm:inline">
            buzz-dashboard
          </span>
          <Badge variant="outline" className="hidden sm:inline-flex">
            <Eye aria-hidden />
            Read-only
          </Badge>
          <HeaderActions
            updatedAt={needsYou.updatedAt}
            feed={{
              usage: feed?.usage ?? null,
              publishedAt: feed?.publishedAt ?? null,
              stale,
            }}
          />
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1400px] flex-1 space-y-6 px-4 py-6 sm:px-6">
        <NeedsYouCard data={needsYou} now={now} />
        {needsYou.failures.map((f) => (
          <SourceDown key={f.source} source={f.source}>
            {f.detail}
          </SourceDown>
        ))}
        <ViewTabs counts={countsByView(needsYou.rows)} />
        {children}
      </main>
    </>
  );
}
