import "server-only";

import { ingestTokenRecord, signerRecord } from "./cost-source";
import {
  type FailingAgent,
  failingAgents,
  type HealthSource,
  SLOT_S,
  SOURCE_KINDS,
} from "./health";
import { healthBuckets, historyEnabled } from "./history";

/** Health's error-rate source: the connected cost source, or null with none. */
export async function healthSource(): Promise<HealthSource | null> {
  if (!historyEnabled()) return null;
  if (await signerRecord()) return "signer";
  return (await ingestTokenRecord()) ? "otel" : null;
}

/** The agents failing right now, for Needs you; null without a source. */
export async function loadFailing(
  now: number,
): Promise<{ source: HealthSource; failing: FailingAgent[] } | null> {
  const source = await healthSource();
  if (!source) return null;
  // The last hour, plus the slot it starts in.
  const buckets = await healthBuckets(
    new Date((now - 3600 - SLOT_S) * 1000),
    SOURCE_KINDS[source],
  );
  return { source, failing: failingAgents(buckets, now) };
}
