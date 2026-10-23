import { beforeEach, expect, it, vi } from "vitest";

// The owner signer's client key never sits in the database in plaintext (#68).
const store = new Map<string, unknown>();
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({}));
vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("./history", () => ({
  historyEnabled: () => true,
  getSetting: async (k: string) => store.get(k) ?? null,
  setSetting: async (k: string, v: unknown) => void store.set(k, v),
  deleteSetting: async (k: string) => void store.delete(k),
}));
vi.stubEnv("BUZZ_PRIVATE_KEY", "test-key");

const { loadSignerRecord, selectSigner } = await import("./cost-source");

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
