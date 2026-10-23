import { beforeEach, expect, it, vi } from "vitest";

// The owner signer's client key never sits in the database in plaintext (#68).
const store = new Map<string, unknown>();
let reads = 0;
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({}));
vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("./history", () => ({
  historyEnabled: () => true,
  getSetting: async (k: string) => {
    reads++;
    return store.get(k) ?? null;
  },
  setSetting: async (k: string, v: unknown) => void store.set(k, v),
  deleteSetting: async (k: string) => void store.delete(k),
}));
vi.stubEnv("BUZZ_PRIVATE_KEY", "test-key");

const {
  loadSignerRecord,
  otlpTokenRecord,
  rotateIngestToken,
  selectOtel,
  selectSigner,
} = await import("./cost-source");

const record = {
  pubkey: "a".repeat(64),
  bunker: { pubkey: "b".repeat(64), relays: ["wss://relay.example"] },
  clientKey: "c".repeat(64),
  since: 0,
  connectedAt: "2026-10-23T00:00:00.000Z",
};
const stored = () => store.get("cost_signer") as typeof record;

beforeEach(() => store.clear());

it("stores the client key encrypted and reads it back", async () => {
  await selectSigner(record);
  expect(JSON.stringify(stored())).not.toContain(record.clientKey);
  expect(await loadSignerRecord()).toEqual(record);
});

it("encrypts a plaintext key stored before #68 on first read", async () => {
  store.set("cost_signer", record);
  expect(await loadSignerRecord()).toEqual(record);
  expect(stored().clientKey).not.toBe(record.clientKey);
  expect(await loadSignerRecord()).toEqual(record);
});

it("drops the signer when the key can't be opened", async () => {
  await selectSigner(record);
  vi.stubEnv("BUZZ_PRIVATE_KEY", "rotated");
  expect(await loadSignerRecord()).toBeNull();
  vi.stubEnv("BUZZ_PRIVATE_KEY", "test-key");
});

// The OTLP receivers don't query the database on every report (#66).
it("caches the OTLP token for a few seconds and drops it on every change", async () => {
  const { record: first } = await rotateIngestToken();
  reads = 0;
  expect(await otlpTokenRecord(0)).toEqual(first);
  expect(await otlpTokenRecord(9_999)).toEqual(first);
  expect(reads).toBe(2); // signer + token, once
  await otlpTokenRecord(10_000);
  expect(reads).toBe(4);

  const { record: second } = await rotateIngestToken();
  expect(await otlpTokenRecord(10_001)).toEqual(second);
  await selectSigner(record);
  expect(await otlpTokenRecord(10_002)).toBeNull();
  await selectOtel();
  expect(await otlpTokenRecord(10_003)).toEqual(second);
});
