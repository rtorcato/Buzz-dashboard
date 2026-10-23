import "server-only";

import { connection } from "next/server";
import { cache } from "react";
import {
  deleteSetting,
  getSetting,
  historyEnabled,
  newestCostPoint,
  retentionDays,
  setSetting,
} from "./history";
import {
  newIngestToken,
  type TokenRecord,
  TokenRecordSchema,
} from "./ingest-token";
import { type SignerRecord, SignerRecordSchema } from "./signer";

// The one cost source. OpenTelemetry (#42) is connected once an ingest token
// exists. The opt-in owner signer (#43) is the other choice: while its record
// is stored it is the source, and the OTLP endpoint refuses reports, so the
// numbers never double-count.

const TOKEN_KEY = "otel_ingest_token";
const SIGNER_KEY = "cost_signer";

/** The stored owner signer, or null. Not per request: the ingester reads it too. */
export async function loadSignerRecord(): Promise<SignerRecord | null> {
  if (!historyEnabled()) return null;
  const parsed = SignerRecordSchema.safeParse(await getSetting(SIGNER_KEY));
  return parsed.success ? parsed.data : null;
}

/** The owner signer for this request, when it is the cost source. */
export const signerRecord = cache(async (): Promise<SignerRecord | null> => {
  await connection();
  return loadSignerRecord();
});

/**
 * Where the signer starts reading: after the newest stored report, so turns
 * OpenTelemetry already counted aren't counted again, and inside retention.
 */
export async function signerSince(now = new Date()): Promise<number> {
  const floor = Math.floor(now.getTime() / 1000) - retentionDays() * 86_400;
  const newest = await newestCostPoint();
  return newest
    ? Math.max(floor, Math.floor(newest.getTime() / 1000) + 1)
    : floor;
}

export const selectSigner = (record: SignerRecord) =>
  setSetting(SIGNER_KEY, record);

/** Back to OpenTelemetry. The signer may still list the app until revoked there. */
export const selectOtel = () => deleteSetting(SIGNER_KEY);

/** The stored ingest token, or null without one or without a database. */
export const ingestTokenRecord = cache(
  async (): Promise<TokenRecord | null> => {
    if (!historyEnabled()) return null;
    // Per request, never at build time: the token can change at any moment.
    await connection();
    const parsed = TokenRecordSchema.safeParse(await getSetting(TOKEN_KEY));
    return parsed.success ? parsed.data : null;
  },
);

/** True when a cost source is connected, so Cost and the cost chip show. */
export async function costConnected(): Promise<boolean> {
  try {
    const [signer, token] = await Promise.all([
      signerRecord(),
      ingestTokenRecord(),
    ]);
    return signer !== null || token !== null;
  } catch (err) {
    console.error("Cost source:", err);
    return false;
  }
}

/** Creates or rotates the token. The old one stops working at once. */
export async function rotateIngestToken() {
  const { token, record } = newIngestToken();
  await setSetting(TOKEN_KEY, record);
  return { token, record };
}
