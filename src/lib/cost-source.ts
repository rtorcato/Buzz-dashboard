import "server-only";

import { connection } from "next/server";
import { cache } from "react";
import { getSetting, historyEnabled, setSetting } from "./history";
import {
  newIngestToken,
  type TokenRecord,
  TokenRecordSchema,
} from "./ingest-token";

// The one cost source (#42). OpenTelemetry is connected once an ingest token
// exists. The opt-in NIP-46 signer (#43) will be the other choice, and the
// Settings → Sources radio keeps it to one at a time so numbers never
// double-count.

const TOKEN_KEY = "otel_ingest_token";

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
    return (await ingestTokenRecord()) !== null;
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
