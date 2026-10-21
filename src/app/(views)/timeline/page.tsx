import { Activity } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/states";

export const metadata: Metadata = { title: "Timeline · Hive" };

// ponytail: placeholder until the Timeline PR lands.
export default function TimelinePage() {
  return (
    <EmptyState icon={Activity} title="Timeline is not built yet">
      Today's hive activity from the Buzz relay.
    </EmptyState>
  );
}
