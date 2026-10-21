import { GitPullRequest } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/states";

export const metadata: Metadata = { title: "Pipeline · Hive" };

// ponytail: placeholder until the Pipeline PR lands.
export default function PipelinePage() {
  return (
    <EmptyState icon={GitPullRequest} title="Pipeline is not built yet">
      ai-* label counts and PR throughput from GitHub.
    </EmptyState>
  );
}
