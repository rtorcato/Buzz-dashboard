import { Rocket } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/states";

export const metadata: Metadata = { title: "Releases · Hive" };

// ponytail: placeholder until the Releases PR lands.
export default function ReleasesPage() {
  return (
    <EmptyState icon={Rocket} title="Releases is not built yet">
      Release approvals, red CI on main and npm publishes.
    </EmptyState>
  );
}
