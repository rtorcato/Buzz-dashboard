"use client";

import {
  Activity,
  Bot,
  Eye,
  GitPullRequest,
  Images,
  type LucideIcon,
  Rocket,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignInBlock, type SignInState } from "@/components/sign-in";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import type { View } from "@/lib/needs-you";

// Media never needs the owner, so it has no count.
type Item = View | "media";

// `history: true` marks a view that reads the history store (#39), like
// Health and Cost; it leaves the sidebar when DATABASE_URL is unset.
const VIEWS: {
  view: Item;
  label: string;
  icon: LucideIcon;
  history?: true;
}[] = [
  { view: "agents", label: "Agents", icon: Bot },
  { view: "pipeline", label: "Pipeline", icon: GitPullRequest },
  { view: "releases", label: "Releases", icon: Rocket },
  { view: "timeline", label: "Timeline", icon: Activity },
  { view: "media", label: "Media", icon: Images },
];

// DESIGN.md → Sidebar. The route is the selected item.
export function AppSidebar({
  counts,
  history,
  signIn,
}: {
  counts: Partial<Record<Item, number>>;
  /** True when the history store is configured. */
  history: boolean;
  /** Null when owner sign-in is off (#40). */
  signIn: SignInState | null;
}) {
  const active = usePathname().split("/")[1];
  const { setOpenMobile } = useSidebar();
  // Picking a view closes the phone drawer.
  const close = () => setOpenMobile(false);

  return (
    <Sidebar collapsible="icon" aria-label="Main">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={<Link href="/" onClick={close} />}
              tooltip="Hive"
            >
              <svg
                viewBox="0 0 32 32"
                className="size-8! shrink-0"
                aria-hidden="true"
              >
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
              <span className="grid flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
                <span className="font-semibold">Hive</span>
                <span className="text-xs text-muted-foreground">
                  buzz-dashboard
                </span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Views</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {VIEWS.filter((v) => history || !v.history).map(
                ({ view, label, icon: Icon }) => {
                  const count = counts[view] ?? 0;
                  return (
                    <SidebarMenuItem key={view}>
                      <SidebarMenuButton
                        isActive={view === active}
                        className="max-md:h-11"
                        tooltip={count ? `${label} · ${count} need you` : label}
                        render={
                          <Link
                            href={`/${view}`}
                            onClick={close}
                            aria-current={view === active ? "page" : undefined}
                          />
                        }
                      >
                        <Icon aria-hidden />
                        <span>{label}</span>
                        {count > 0 && (
                          // On the icon rail the pill becomes a dot on the icon.
                          <span
                            className="absolute top-1.5 left-6 hidden size-1.5 rounded-full bg-destructive group-data-[collapsible=icon]:block"
                            aria-hidden
                          />
                        )}
                      </SidebarMenuButton>
                      {count > 0 && (
                        <SidebarMenuBadge className="bg-destructive/15 text-red-700 dark:text-destructive">
                          {count}
                          <span className="sr-only"> need you</span>
                        </SidebarMenuBadge>
                      )}
                    </SidebarMenuItem>
                  );
                },
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        {signIn && <SignInBlock state={signIn} />}
        <div className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground group-data-[collapsible=icon]:justify-center">
          <Eye className="size-4 shrink-0" aria-hidden />
          <span className="group-data-[collapsible=icon]:sr-only">
            Read-only
          </span>
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={active === "settings"}
              className="max-md:h-11"
              tooltip="Settings"
              render={
                <Link
                  href="/settings"
                  onClick={close}
                  aria-current={active === "settings" ? "page" : undefined}
                />
              }
            >
              <Settings aria-hidden />
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
