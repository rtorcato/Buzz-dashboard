import { connection } from "next/server";
import { AlertSettings } from "@/components/alert-settings";
import { loadAlerts } from "@/lib/alert-store";
import { elide, RULE_IDS, type Rule, type RuleId, ruleOf } from "@/lib/alerts";
import { authMode, getOwner } from "@/lib/auth";
import { historyEnabled } from "@/lib/history";
import { OwnerNote } from "./sources";

// DESIGN.md → Settings tabs and Alerts (#45). Stored in the history database;
// signed out it is read-only.
export async function AlertsTab() {
  await connection();
  const history = historyEnabled();
  const [owner, config] = await Promise.all([
    getOwner(),
    loadAlerts().catch(() => null),
  ]);
  const rules =
    config &&
    (Object.fromEntries(
      RULE_IDS.map((id) => [id, ruleOf(config, id)]),
    ) as Record<RuleId, Rule>);
  return (
    <div className="space-y-6">
      <OwnerNote what="alerts" owner={owner} mode={authMode()} />
      {!history || !config || !rules ? (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          {history
            ? "The history database didn’t answer, so alerts can’t load."
            : "Alerts keep their settings in the history database. Set DATABASE_URL and restart to use them."}
        </p>
      ) : (
        <AlertSettings
          channels={config.channels.map((c) => ({
            id: c.id,
            type: c.type,
            target: elide(c.target),
            on: c.on,
          }))}
          rules={rules}
          quiet={config.quiet}
          canEdit={owner !== null}
        />
      )}
    </div>
  );
}
