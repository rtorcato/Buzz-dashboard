"use client";

import { ArrowUpDown, Folder } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ALL, FilterSelect } from "@/components/timeline-filters";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  DEFAULT_FLOW_RANGE,
  FLOW_RANGES,
  FLOW_SORTS,
  type FlowRange,
  type FlowSort,
} from "@/lib/flow";

// Every control writes the URL, so the server does the work and a view is a
// link, the same as the Timeline filters.
function useSetParam() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value && value !== ALL) next.set(key, value);
    else next.delete(key);
    // A new filter shows the whole table from the top again.
    next.delete("slow");
    next.delete("all");
    router.push(`${pathname}?${next}`, { scroll: false });
  };
}

/** DESIGN.md → Pipeline flow → Header row: range, repo and agent. */
export function FlowFilters({
  range,
  repo,
  agent,
  repos,
  agents,
}: {
  range: FlowRange;
  repo: string | null;
  agent: string | null;
  repos: string[];
  agents: string[];
}) {
  const set = useSetParam();
  return (
    <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1 md:overflow-visible">
      <ToggleGroup
        variant="outline"
        aria-label="Range"
        className="shrink-0"
        spacing={0}
        value={[range]}
        onValueChange={(next) =>
          set("range", next[0] === DEFAULT_FLOW_RANGE ? null : next[0])
        }
      >
        {Object.keys(FLOW_RANGES).map((r) => (
          <ToggleGroupItem key={r} value={r} className="h-9 px-3 max-md:h-11">
            {r}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <FilterSelect
        label="Repo"
        icon={Folder}
        items={[
          { value: ALL, label: "All repos" },
          ...repos.map((r) => ({ value: r, label: r, mono: true })),
        ]}
        value={repo ?? ALL}
        onChange={(v) => set("repo", v)}
      />
      <FilterSelect
        label="Agent"
        items={[
          { value: ALL, label: "All agents" },
          ...agents.map((a) => ({ value: a, label: a })),
        ]}
        value={agent ?? ALL}
        onChange={(v) => set("agent", v)}
      />
    </div>
  );
}

/** The PRs table's sort, "Stalled first" by default. */
export function FlowSortSelect({ sort }: { sort: FlowSort }) {
  const set = useSetParam();
  return (
    <FilterSelect
      label="Sort"
      icon={ArrowUpDown}
      items={Object.entries(FLOW_SORTS).map(([value, label]) => ({
        value,
        label,
      }))}
      value={sort}
      onChange={(v) => set("sort", v === "stalled" ? null : v)}
    />
  );
}
