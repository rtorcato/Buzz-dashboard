import { createHash } from "node:crypto";
import { schnorr } from "@noble/curves/secp256k1.js";
import { beforeEach, expect, it, vi } from "vitest";

// The #63 attack end to end: the request's Host and X-Forwarded-Host must not
// decide which site a login event is bound to.
const hex = (b: Uint8Array) => Buffer.from(b).toString("hex");
const secret = schnorr.utils.randomSecretKey();
const pubkey = hex(schnorr.getPublicKey(secret));

const jar = new Map<string, string>();
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      jar.has(name) ? { value: jar.get(name) } : undefined,
    set: (name: string, value: string) => jar.set(name, value),
    delete: (name: string) => jar.delete(name),
  }),
}));
// Vitest doesn't read the tsconfig "@/" alias, so point it at the real module.
vi.mock("@/lib/auth", () => import("../../../../lib/auth"));
vi.stubEnv("BUZZ_PRIVATE_KEY", "test-key");
vi.stubEnv("BUZZ_RELAY_URL", "wss://relay.example");
vi.stubEnv("BUZZ_OWNER_PUBKEY", pubkey);
vi.stubEnv("AUTH_MODE", "nostr");
vi.stubEnv("AUTH_PUBLIC_URL", "https://hive.example");

const { CHALLENGE_COOKIE, newChallenge, SESSION_COOKIE } = await import(
  "../../../../lib/auth"
);
const { POST } = await import("./route");

let challenge = "";
beforeEach(() => {
  jar.clear();
  const c = newChallenge(Math.floor(Date.now() / 1000));
  challenge = c.challenge;
  jar.set(CHALLENGE_COOKIE, c.cookie);
});

function login(u: string, headers: Record<string, string>) {
  const e = {
    pubkey,
    created_at: Math.floor(Date.now() / 1000),
    kind: 27235,
    tags: [
      ["challenge", challenge],
      ["u", u],
      ["method", "POST"],
    ],
    content: "",
  };
  const id = createHash("sha256")
    .update(
      JSON.stringify([0, e.pubkey, e.created_at, e.kind, e.tags, e.content]),
    )
    .digest("hex");
  const sig = hex(schnorr.sign(Buffer.from(id, "hex"), secret));
  return POST(
    new Request("http://attacker.example/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify({ ...e, id, sig }),
    }),
  );
}

it("refuses an event signed for another host, whatever Host claims", async () => {
  const res = await login("https://attacker.example/api/auth/login", {
    host: "attacker.example",
    "x-forwarded-host": "attacker.example",
    "x-forwarded-proto": "https",
  });
  expect(res.status).toBe(401);
  expect(await res.json()).toEqual({ error: "wrong url" });
  expect(jar.has(SESSION_COOKIE)).toBe(false);
});

it("accepts an event signed for AUTH_PUBLIC_URL", async () => {
  const res = await login("https://hive.example/api/auth/login", {
    host: "attacker.example",
  });
  expect(res.status).toBe(200);
  expect(jar.has(SESSION_COOKIE)).toBe(true);
});
