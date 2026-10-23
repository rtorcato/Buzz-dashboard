import "server-only";

import { connection } from "next/server";
import { cache } from "react";
import { z } from "zod";
import { decryptSecret, encryptSecret } from "./auth";
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
  const stored = StoredSignerSchema.safeParse(await getSetting(SIGNER_KEY));
  if (!stored.success) return null;
  const { clientKey } = stored.data;
  // A plaintext key stored before #68: use it, and encrypt it in place.
  const legacy = /^[0-9a-f]{64}$/.test(clientKey);
  const parsed = SignerRecordSchema.safeParse({
    ...stored.data,
    clientKey: legacy ? clientKey : decryptSecret(clientKey),
  });
  // Unreadable after a BUZZ_PRIVATE_KEY rotation: the owner reconnects.
  if (!parsed.success) return null;
  if (legacy) await selectSigner(parsed.data);
  return parsed.data;
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

// The client key is stored encrypted (#68): with the bunker address it is
// enough to ask the owner's signer to decrypt for us.
const StoredSignerSchema = SignerRecordSchema.extend({
  clientKey: z.string(),
});

export async function selectSigner(record: SignerRecord) {
  await setSetting(SIGNER_KEY, {
    ...record,
    clientKey: encryptSecret(record.clientKey),
  });
  clearOtlpToken();
}

/** Back to OpenTelemetry. The signer may still list the app until revoked there. */
export async function selectOtel() {
  await deleteSetting(SIGNER_KEY);
  clearOtlpToken();
}

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
  clearOtlpToken();
  return { token, record };
}

// The OTLP receivers check the token on every report (#66). Reading it per
// request let a flood of bad-token posts use up the 5-connection pool, so the
// answer is kept in memory for a few seconds. Every write above clears it, and
// `generation` stops a read that started before the write from storing the
// old answer. ponytail: per process; another instance sees a change up to
// OTLP_TTL_MS late. Move it to a shared store if that ever matters.
const OTLP_TTL_MS = 10_000;
let otlpCache: { at: number; record: TokenRecord | null } | null = null;
let generation = 0;

function clearOtlpToken() {
  otlpCache = null;
  generation++;
}

/** The token the OTLP receivers accept: null without one or while the signer is the source. */
export async function otlpTokenRecord(
  now = Date.now(),
): Promise<TokenRecord | null> {
  if (otlpCache && now - otlpCache.at < OTLP_TTL_MS) return otlpCache.record;
  const started = generation;
  const record = (await loadSignerRecord()) ? null : await ingestTokenRecord();
  if (started === generation) otlpCache = { at: now, record };
  return record;
}
