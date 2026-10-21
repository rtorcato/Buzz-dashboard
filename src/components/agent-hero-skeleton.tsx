"use client";

import { useParams } from "next/navigation";
import { Morph } from "@/components/agents-view";
import { Skeleton } from "@/components/ui/skeleton";
import { morphName } from "@/lib/agents";

// The page suspends into this skeleton on navigation, so the card's avatar and
// name morph into these placeholders first, then into the hero when it lands.
// Without matching names here no pair forms and nothing morphs.
export function AgentHeroSkeleton() {
  const { name = "" } = useParams<{ name: string }>();
  const slug = decodeURIComponent(name);
  return (
    <>
      <Morph name={morphName("avatar", slug)}>
        <Skeleton className="size-28 shrink-0 rounded-full sm:size-44" />
      </Morph>
      <div className="w-full space-y-3">
        <Morph name={morphName("name", slug)}>
          <Skeleton className="h-8 w-48" />
        </Morph>
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-9 w-full" />
      </div>
    </>
  );
}
