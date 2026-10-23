"use client";

import { AlarmClock, Check, Sun, Timer } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { post } from "@/components/alert-settings";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatClock } from "@/lib/format-time";
import { useSettings } from "@/lib/settings";

/** 9:00 AM tomorrow on the viewer's clock (UTC with that setting). */
function tomorrowAt9(now: number, utc: boolean) {
  const d = new Date(now);
  if (utc) {
    d.setUTCDate(d.getUTCDate() + 1);
    d.setUTCHours(9, 0, 0, 0);
  } else {
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
  }
  return d.getTime();
}

// Needs you row actions (#46, DESIGN.md → Needs you: snooze and ack). Both
// buttons open the same menu. It stops the row's alerts, never the row.
export function SnoozeMenu({ keys, title }: { keys: string[]; title: string }) {
  const router = useRouter();
  const settings = useSettings();
  const [error, setError] = useState<string | null>(null);

  const mute = async (until: number | null) => {
    setError(null);
    const err = await post({ op: "mute", keys, until });
    if (err) setError(err);
    else router.refresh();
  };

  const trigger = (label: string) => (
    <Button
      variant="ghost"
      size="icon"
      className="size-11 sm:size-9"
      aria-label={label}
      title={label}
    />
  );

  return (
    <div className="flex shrink-0 items-center gap-1 pr-2 sm:pr-4">
      {error && (
        <p role="alert" className="max-w-40 text-xs text-destructive">
          {error}
        </p>
      )}
      <span className="mr-1 h-6 w-px bg-border" aria-hidden />
      <DropdownMenu>
        <DropdownMenuTrigger render={trigger("Snooze alerts")}>
          <AlarmClock aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuTrigger render={trigger("Stop alerting me about this")}>
          <Check aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <MenuItems
            title={title}
            onPick={mute}
            clock={(at) => formatClock(new Date(at), settings)}
            utc={settings.timeZone === "utc"}
          />
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// Rendered only while the menu is open, so the times are fresh each time.
function MenuItems({
  title,
  onPick,
  clock,
  utc,
}: {
  title: string;
  onPick: (until: number | null) => void;
  clock: (at: number) => string;
  utc: boolean;
}) {
  const now = Date.now();
  const hour = now + 3_600_000;
  const tomorrow = tomorrowAt9(now, utc);
  return (
    <>
      <DropdownMenuGroup>
        <DropdownMenuLabel className="space-y-0.5">
          <span className="block font-medium text-foreground">
            Stop alerting me about this
          </span>
          <span className="block truncate">“{title}”</span>
        </DropdownMenuLabel>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={() => onPick(hour)}>
        <Timer aria-hidden />
        For 1 hour
        <span className="ml-auto text-xs text-muted-foreground">
          until {clock(hour)}
        </span>
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => onPick(tomorrow)}>
        <Sun aria-hidden />
        Until tomorrow
        <span className="ml-auto text-xs text-muted-foreground">
          {clock(tomorrow)}
        </span>
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => onPick(null)}>
        <Check aria-hidden />
        Until it changes
        <span className="ml-auto text-xs text-muted-foreground">ack</span>
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <p className="px-1.5 py-1 text-xs text-muted-foreground">
        It stays on this page. Alerts stop on every channel, and start again
        early if it gets worse.
      </p>
    </>
  );
}
