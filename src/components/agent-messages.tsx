"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DayGroup } from "@/lib/agents";

const ALL = "all";

// The agent's messages, newest first, grouped by day, with a channel filter.
// ponytail: no per-message link; Buzz has no documented message URL yet.
export function AgentMessages({ groups }: { groups: DayGroup[] }) {
  const [channel, setChannel] = useState(ALL);
  const channels = [
    ...new Set(groups.flatMap((g) => g.items.map((i) => i.channel ?? ""))),
  ]
    .filter(Boolean)
    .sort();
  const items = [
    { value: ALL, label: "All channels" },
    ...channels.map((c) => ({ value: c, label: `#${c}` })),
  ];
  const shown = groups
    .map((g) => ({
      ...g,
      items: g.items.filter((i) => channel === ALL || i.channel === channel),
    }))
    .filter((g) => g.items.length > 0);

  if (groups.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No messages this week.</p>
    );
  }
  return (
    <div className="space-y-3">
      <Select
        items={items}
        value={channel}
        onValueChange={(v) => v && setChannel(v)}
      >
        <SelectTrigger className="h-9! min-w-44" aria-label="Filter by channel">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((i) => (
            <SelectItem key={i.value} value={i.value}>
              {i.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="max-h-[32rem] overflow-y-auto rounded-md border">
        {shown.map((g) => (
          <section key={g.label}>
            <h3 className="sticky top-0 border-b bg-muted/90 px-3 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur">
              {g.label}
            </h3>
            <ul className="divide-y">
              {g.items.map((i) => (
                <li key={i.id} className="flex items-baseline gap-3 px-3 py-2">
                  <span className="w-16 shrink-0 text-xs text-muted-foreground tabular-nums">
                    {i.time}
                  </span>
                  {i.channel && (
                    <span className="shrink-0 rounded bg-muted px-1.5 font-mono text-xs">
                      #{i.channel}
                    </span>
                  )}
                  <span className="min-w-0 truncate text-sm" title={i.text}>
                    {i.text}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
