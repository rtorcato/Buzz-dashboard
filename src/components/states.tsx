import { type LucideIcon, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Shared section states from DESIGN.md (States board). Views compose these.

export function LoadingCard({ label = "Loading" }: { label?: string }) {
  return (
    <Card className="gap-3 px-6" aria-busy="true">
      <span className="sr-only">{label}</span>
      {["w-3/5", "w-5/6", "w-2/3"].map((w) => (
        <div key={w} className="flex items-center gap-3">
          <Skeleton className="size-9 rounded-full" />
          <Skeleton className={`h-4 ${w}`} />
        </div>
      ))}
    </Card>
  );
}

// A failed source shows this on its own sections only; the rest keep rendering.
export function SourceDown({
  source,
  children,
}: {
  source: string;
  children: ReactNode;
}) {
  return (
    <Alert
      variant="destructive"
      className="border-destructive/30 bg-destructive/5 px-4 py-3"
    >
      <TriangleAlert aria-hidden />
      <AlertTitle>Can&apos;t reach {source}</AlertTitle>
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
}) {
  return (
    <Card className="items-center gap-2 px-6 py-10 text-center">
      <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-5" aria-hidden />
      </span>
      <p className="font-medium">{title}</p>
      <p className="text-sm text-muted-foreground">{children}</p>
    </Card>
  );
}
