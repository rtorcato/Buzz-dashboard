import type { Metadata } from "next";
import { SettingsForm } from "@/components/settings-form";
import { loadHive } from "@/lib/hive";
import { loadStatusFeed } from "@/lib/status-feed";
import pkg from "../../../../package.json";

export const metadata: Metadata = { title: "Settings · Hive" };

export default async function SettingsPage() {
  const [{ hive }, { feed }] = await Promise.all([
    loadHive(),
    loadStatusFeed(),
  ]);
  // Same roster as the Agents view: one entry per live agent, no messages.
  const agents = (hive?.agents ?? [])
    .filter((a) => a.lastSeenAt !== null)
    .map((a) => ({ ...a, messages: [] }));
  return (
    <SettingsForm
      agents={agents}
      version={pkg.version}
      publishedAt={feed?.publishedAt ?? null}
    />
  );
}
