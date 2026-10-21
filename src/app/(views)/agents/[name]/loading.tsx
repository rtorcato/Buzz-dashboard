import { AgentHeroSkeleton } from "@/components/agent-hero-skeleton";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Keeps each card's height so nothing jumps when the page lands: hero and stats first.
export default function AgentLoading() {
  return (
    <div className="space-y-4" aria-busy="true">
      <span className="sr-only">Loading agent</span>
      <Skeleton className="h-5 w-40" />
      <Card className="flex-col items-center gap-6 p-6 sm:flex-row">
        <AgentHeroSkeleton />
      </Card>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {["a", "b", "c", "d"].map((k) => (
          <Skeleton key={k} className="h-28 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Skeleton className="h-64 rounded-xl xl:col-span-2" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  );
}
