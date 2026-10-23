import "server-only";

import {
  BUNKER_REGEX,
  type BunkerPointer,
  BunkerSigner,
} from "nostr-tools/nip46";
import { SimplePool } from "nostr-tools/pool";
import { generateSecretKey, verifyEvent } from "nostr-tools/pure";
import { z } from "zod";
import type { NewCostPoint } from "./history-schema";
import type { NostrEvent } from "./relay";

// The opt-in owner signer (#43): reads Buzz's per-turn metrics (NIP-AM,
// kind 44200) through the owner's NIP-46 remote signer. The relay serves them
// only to the owner, encrypted to the owner, so the signer signs the relay
// AUTH and decrypts each report. The owner key stays in the signer; the
// dashboard keeps only its own client key for talking to it.

export const TURN_KIND = 44200;
/** Waiting on the signer app, where the owner may have to approve. */
export const CONNECT_MS = 60_000;
export const REQUEST_MS = 30_000;

const hex64 = z.string().regex(/^[0-9a-f]{64}$/);

export const SignerRecordSchema = z.object({
  /** The owner key the signer signs as. */
  pubkey: hex64,
  /** The signer's address, without its one-time secret. */
  bunker: z.object({ pubkey: hex64, relays: z.array(z.string()).min(1) }),
  /** The dashboard's NIP-46 client key; the signer knows it as this app. */
  clientKey: hex64,
  /** Unix seconds. Reports before this are never read, so nothing counts twice. */
  since: z.number().int().nonnegative(),
  connectedAt: z.string(),
});
export type SignerRecord = z.infer<typeof SignerRecordSchema>;

/**
 * A `bunker://` address with at least one ws(s) relay, or null. NIP-05 names
 * are refused, since resolving one would fetch an arbitrary URL.
 */
export function parseBunker(input: string): BunkerPointer | null {
  const match = input.trim().match(BUNKER_REGEX);
  if (!match) return null;
  const qs = new URLSearchParams(match[2]);
  const relays = [...new Set(qs.getAll("relay"))];
  const ok = relays.every((r) => {
    try {
      return ["wss:", "ws:"].includes(new URL(r).protocol);
    } catch {
      return false;
    }
  });
  if (!relays.length || !ok) return null;
  return { pubkey: match[1], relays, secret: qs.get("secret") };
}

export class SignerError extends Error {}

export function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    p,
    new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new SignerError("The signer didn’t answer in time")),
        ms,
      );
    }),
  ]).finally(() => clearTimeout(timer));
}

/** Opens a signer session; always pass it to closeSigner when done. */
export function openSigner(clientKey: Uint8Array, bp: BunkerPointer) {
  const pool = new SimplePool();
  return { pool, signer: BunkerSigner.fromBunker(clientKey, bp, { pool }) };
}

export async function closeSigner(s: ReturnType<typeof openSigner>) {
  await s.signer.close();
  s.pool.destroy();
}

/**
 * Connects with the address's one-time secret and checks the signer signs as
 * one of `owners`. Resolves with the record to store.
 */
export async function connectSigner(
  bp: BunkerPointer,
  owners: string[],
  since: number,
  now = new Date(),
): Promise<SignerRecord> {
  const clientKey = generateSecretKey();
  const s = openSigner(clientKey, bp);
  try {
    await withTimeout(s.signer.connect(), CONNECT_MS);
    const pubkey = await withTimeout(s.signer.getPublicKey(), REQUEST_MS);
    if (!owners.includes(pubkey)) {
      throw new SignerError(
        "That signer isn’t for an owner key in BUZZ_OWNER_PUBKEY",
      );
    }
    return {
      pubkey,
      bunker: { pubkey: bp.pubkey, relays: bp.relays },
      clientKey: Buffer.from(clientKey).toString("hex"),
      since,
      connectedAt: now.toISOString(),
    };
  } finally {
    await closeSigner(s);
  }
}

/** The NIP-42 AUTH event for the signer to sign as the owner. */
export const authTemplate = (relay: string, challenge: string) => ({
  kind: 22242,
  created_at: Math.floor(Date.now() / 1000),
  tags: [
    ["relay", relay],
    ["challenge", challenge],
  ],
  content: "",
});

/** A validly signed turn report from an agent to `owner` (NIP-AM). */
export function isTurnFor(e: NostrEvent, owner: string): boolean {
  if (e.kind !== TURN_KIND) return false;
  const p = e.tags.filter((t) => t[0] === "p");
  const agent = e.tags.filter((t) => t[0] === "agent");
  if (p.length !== 1 || p[0][1] !== owner) return false;
  if (agent.length !== 1 || agent[0][1] !== e.pubkey) return false;
  // Only the NIP-01 fields: verifyEvent trusts a cached "verified" mark.
  const { id, pubkey, created_at, kind, tags, content, sig } = e;
  return verifyEvent({ id, pubkey, created_at, kind, tags, content, sig });
}

const count = z.number().nonnegative().nullish();
const TurnSchema = z.object({
  model: z.string().nullish(),
  channelId: z.string().nullish(),
  timestamp: z.string(),
  deltaReliable: z.boolean().optional(),
  turn: z
    .object({
      inputTokens: count,
      outputTokens: count,
      costUsd: count,
      cacheReadTokens: count,
      cacheWriteTokens: count,
    })
    .optional(),
});

/**
 * The cost points for one decrypted turn, in the same shape as OpenTelemetry's.
 * A null count is unknown, so it's left out rather than stored as zero.
 */
export function turnRows(
  e: NostrEvent,
  plaintext: string,
  agent: string,
): NewCostPoint[] {
  let payload: z.infer<typeof TurnSchema>;
  try {
    payload = TurnSchema.parse(JSON.parse(plaintext));
  } catch {
    return [];
  }
  const t = payload.turn;
  if (!t || payload.deltaReliable === false) return [];
  const ms = Date.parse(payload.timestamp);
  const base = {
    at: new Date(Number.isNaN(ms) ? e.created_at * 1000 : ms),
    agent,
    model: payload.model ?? "",
    series: e.id,
    channel: payload.channelId ?? null,
  };
  const rows: NewCostPoint[] = [];
  const add = (
    metric: string,
    type: string,
    value: number | null | undefined,
  ) => {
    if (value != null) rows.push({ ...base, metric, type, value });
  };
  add("cost", "", t.costUsd);
  // NIP-AM folds the cache into inputTokens; OpenTelemetry's "input" excludes it.
  add(
    "tokens",
    "input",
    t.inputTokens == null
      ? null
      : Math.max(
          0,
          t.inputTokens - (t.cacheReadTokens ?? 0) - (t.cacheWriteTokens ?? 0),
        ),
  );
  add("tokens", "output", t.outputTokens);
  add("tokens", "cacheRead", t.cacheReadTokens);
  add("tokens", "cacheCreation", t.cacheWriteTokens);
  return rows;
}
