"use client";

import { Activity, Bot } from "lucide-react";
import { Stat } from "@/components/agents-view";

// The live Timeline's 2 stat cards (DESIGN.md → Views → Timeline, #53). A
// client component because Stat takes its icon as a prop.
export function TimelineLiveStats({
  events,
  buzz,
  active,
  agents,
}: {
  events: number;
  buzz: number;
  active: number;
  agents: number;
}) {
  return (
    <>
      <Stat
        label="Events today"
        icon={Activity}
        value={events}
        sub={`${buzz} from Buzz · ${events - buzz} from GitHub`}
      />
      <Stat
        label="Agents active today"
        icon={Bot}
        value={
          <>
            {active}
            <span className="text-lg text-muted-foreground"> / {agents}</span>
          </>
        }
        sub="Posted or worked on GitHub today"
      />
    </>
  );
}
