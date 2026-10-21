"use client";

import {
  Activity,
  Bot,
  GitPullRequest,
  Images,
  type LucideIcon,
  Rocket,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { View } from "@/lib/needs-you";

// Media never needs the owner, so it has no count pill.
type Tab = View | "media";

const TABS: { view: Tab; label: string; icon: LucideIcon }[] = [
  { view: "agents", label: "Agents", icon: Bot },
  { view: "pipeline", label: "Pipeline", icon: GitPullRequest },
  { view: "releases", label: "Releases", icon: Rocket },
  { view: "timeline", label: "Timeline", icon: Activity },
  { view: "media", label: "Media", icon: Images },
];

// shadcn Tabs rendered as route links: the URL is the selected tab.
export function ViewTabs({ counts }: { counts: Partial<Record<Tab, number>> }) {
  const active = usePathname().split("/")[1];
  return (
    <nav
      aria-label="Views"
      className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0"
    >
      <Tabs value={active}>
        <TabsList className="h-10! p-1">
          {TABS.map(({ view, label, icon: Icon }) => (
            <TabsTrigger
              key={view}
              value={view}
              nativeButton={false}
              render={
                <Link
                  href={`/${view}`}
                  aria-current={view === active ? "page" : undefined}
                />
              }
              className="px-3"
            >
              <Icon aria-hidden />
              {label}
              {counts[view] ? (
                <span className="rounded-full bg-destructive/15 px-1.5 text-xs leading-5 text-destructive tabular-nums">
                  {counts[view]}
                  <span className="sr-only"> need you</span>
                </span>
              ) : null}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </nav>
  );
}
