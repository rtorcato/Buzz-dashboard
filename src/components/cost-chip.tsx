"use client";

import { Coins } from "lucide-react";
import Link from "next/link";
import { AnimatedNumber } from "@/components/motion-primitives/animated-number";
import { formatUsd } from "@/lib/cost";

// DESIGN.md → Shell → Cost chip (#42). Only rendered with a cost source.
export function CostChip({ value }: { value: number }) {
  return (
    <Link
      href="/cost"
      aria-label={`Estimated cost today, ${formatUsd(value)}`}
      className="flex h-9 items-center gap-2 rounded-md border px-2.5 text-xs outline-none transition-colors duration-200 hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <Coins className="size-4 shrink-0" aria-hidden />
      <AnimatedNumber
        value={value}
        format={formatUsd}
        className="font-semibold text-foreground"
      />
      <span className="hidden sm:inline">today · est.</span>
    </Link>
  );
}
