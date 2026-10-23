"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  COST_RANGES,
  type CostRange,
  type CostUnit,
  DEFAULT_COST_RANGE,
} from "@/lib/cost";

/** DESIGN.md → Cost → Controls: unit and range, both in the URL. */
export function CostControls({
  unit,
  range,
}: {
  unit: CostUnit;
  range: CostRange;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const set = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`${pathname}?${next}`, { scroll: false });
  };
  return (
    <div className="flex items-center gap-2">
      <ToggleGroup
        variant="outline"
        aria-label="Unit"
        spacing={0}
        value={[unit]}
        onValueChange={(v) =>
          v[0] && set("unit", v[0] === "cost" ? null : v[0])
        }
      >
        <ToggleGroupItem value="cost" className="h-9 px-3 max-md:h-11">
          Cost
        </ToggleGroupItem>
        <ToggleGroupItem value="tokens" className="h-9 px-3 max-md:h-11">
          Tokens
        </ToggleGroupItem>
      </ToggleGroup>
      <ToggleGroup
        variant="outline"
        aria-label="Range"
        spacing={0}
        value={[range]}
        onValueChange={(v) =>
          v[0] && set("range", v[0] === DEFAULT_COST_RANGE ? null : v[0])
        }
      >
        {Object.keys(COST_RANGES).map((r) => (
          <ToggleGroupItem key={r} value={r} className="h-9 px-3 max-md:h-11">
            {r}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}
