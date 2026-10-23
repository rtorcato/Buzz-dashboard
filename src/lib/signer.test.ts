import { encrypt, getConversationKey } from "nostr-tools/nip44";
import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
} from "nostr-tools/pure";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { isTurnFor, parseBunker, turnRows } = await import("./signer");

const agentKey = generateSecretKey();
const agent = getPublicKey(agentKey);
const ownerKey = generateSecretKey();
const owner = getPublicKey(ownerKey);

const payload = {
  harness: "claude",
  model: "claude-sonnet-4-5",
  channelId: "chan-1",
  timestamp: "2026-10-23T12:00:00.000Z",
  turn: {
    inputTokens: 1000,
    outputTokens: 50,
    totalTokens: 1050,
    costUsd: 0.02,
    cacheReadTokens: 600,
    cacheWriteTokens: 100,
  },
  deltaReliable: true,
};

const turn = (
  tags = [
    ["p", owner],
    ["agent", agent],
  ],
) =>
  finalizeEvent(
    {
      kind: 44200,
      created_at: 1_792_000_000,
      tags,
      content: encrypt(
        JSON.stringify(payload),
        getConversationKey(agentKey, owner),
      ),
    },
    agentKey,
  );

describe("parseBunker", () => {
  const pk = "ab".repeat(32);

  it("reads the signer key, relays and secret", () => {
    expect(
      parseBunker(
        ` bunker://${pk}?relay=wss://relay.example&relay=wss://relay.example&secret=s3 `,
      ),
    ).toEqual({ pubkey: pk, relays: ["wss://relay.example"], secret: "s3" });
  });

  it("refuses no relay, a non-websocket relay and NIP-05 names", () => {
    expect(parseBunker(`bunker://${pk}`)).toBeNull();
    expect(parseBunker(`bunker://${pk}?relay=https://x.example`)).toBeNull();
    expect(parseBunker("sam@example.com")).toBeNull();
    expect(parseBunker(`bunker://${pk.slice(2)}?relay=wss://x`)).toBeNull();
  });
});

describe("isTurnFor", () => {
  it("accepts a signed turn from an agent to the owner", () => {
    expect(isTurnFor(turn(), owner)).toBe(true);
  });

  it("refuses another owner, a mismatched agent tag and a bad signature", () => {
    expect(isTurnFor(turn(), agent)).toBe(false);
    expect(
      isTurnFor(
        turn([
          ["p", owner],
          ["agent", owner],
        ]),
        owner,
      ),
    ).toBe(false);
    expect(isTurnFor({ ...turn(), content: "x" }, owner)).toBe(false);
  });
});

describe("turnRows", () => {
  const e = turn();

  it("maps a turn to cost points, with cache taken out of input", () => {
    const rows = turnRows(e, JSON.stringify(payload), "Jazz");
    const base = {
      at: new Date(payload.timestamp),
      agent: "Jazz",
      model: "claude-sonnet-4-5",
      series: e.id,
      channel: "chan-1",
    };
    expect(rows).toEqual([
      { ...base, metric: "cost", type: "", value: 0.02 },
      { ...base, metric: "tokens", type: "input", value: 300 },
      { ...base, metric: "tokens", type: "output", value: 50 },
      { ...base, metric: "tokens", type: "cacheRead", value: 600 },
      { ...base, metric: "tokens", type: "cacheCreation", value: 100 },
    ]);
  });

  it("leaves unknown counts out rather than storing zero", () => {
    const rows = turnRows(
      e,
      JSON.stringify({
        ...payload,
        turn: { inputTokens: null, outputTokens: 5, costUsd: null },
      }),
      "Jazz",
    );
    expect(rows.map((r) => [r.type, r.value])).toEqual([["output", 5]]);
  });

  it("cuts the stored free text to 128 characters", () => {
    const rows = turnRows(
      e,
      JSON.stringify({
        ...payload,
        model: "m".repeat(500),
        channelId: "c".repeat(500),
      }),
      "J",
    );
    expect(rows[0].model).toHaveLength(128);
    expect(rows[0].channel).toHaveLength(128);
  });

  it("skips unreliable deltas and anything that doesn't parse", () => {
    expect(
      turnRows(e, JSON.stringify({ ...payload, deltaReliable: false }), "J"),
    ).toEqual([]);
    expect(turnRows(e, "not json", "J")).toEqual([]);
    expect(
      turnRows(e, JSON.stringify({ ...payload, turn: { costUsd: -1 } }), "J"),
    ).toEqual([]);
  });
});
