"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  DEFAULT_HEALTH_RANGE,
  HEALTH_RANGES,
  type HealthRange as Range,
} from "@/lib/health";

/** DESIGN.md → History views → Range: 1h / 24h / 7d, in the URL. */
export function HealthRange({ range }: { range: Range }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (
    <ToggleGroup
      variant="outline"
      aria-label="Range"
      spacing={0}
      value={[range]}
      onValueChange={(v) => {
        if (!v[0]) return;
        const next = new URLSearchParams(params);
        if (v[0] === DEFAULT_HEALTH_RANGE) next.delete("range");
        else next.set("range", v[0]);
        router.push(`${pathname}?${next}`, { scroll: false });
      }}
    >
      {Object.keys(HEALTH_RANGES).map((r) => (
        <ToggleGroupItem key={r} value={r} className="h-9 px-3 max-md:h-11">
          {r}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
