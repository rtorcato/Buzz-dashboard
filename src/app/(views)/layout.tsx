import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { AppEffects } from "@/components/app-effects";
import { AppSidebar } from "@/components/app-sidebar";
import { HeaderActions } from "@/components/header-actions";
import { NeedsYouCard } from "@/components/needs-you-card";
import { SourceDown } from "@/components/states";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { historyEnabled } from "@/lib/history";
import { countsByView, getNeedsYou } from "@/lib/needs-you";
import { loadStatusFeed } from "@/lib/status-feed";

export default async function ViewsLayout({
  children,
}: {
  children: ReactNode;
}) {
  const [needsYou, { feed, stale }, jar] = await Promise.all([
    getNeedsYou(),
    loadStatusFeed(),
    cookies(),
  ]);
  const now = Date.now();
  const counts = countsByView(needsYou.rows);

  return (
    <TooltipProvider>
      {/* The sidebar's own cookie remembers expanded or collapsed. */}
      <SidebarProvider
        defaultOpen={jar.get("sidebar_state")?.value !== "false"}
      >
        <AppSidebar counts={counts} history={historyEnabled()} />
        <SidebarInset className="min-w-0">
          <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
            <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-3 px-4 sm:px-6">
              <SidebarTrigger className="-ml-2 size-9 md:size-8" />
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
            {children}
          </main>
        </SidebarInset>
        <AppEffects needsYou={needsYou.rows.reduce((n, r) => n + r.count, 0)} />
      </SidebarProvider>
    </TooltipProvider>
  );
}
