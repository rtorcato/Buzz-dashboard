import { createHash } from "node:crypto";
import { schnorr } from "@noble/curves/secp256k1.js";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({}));
vi.stubEnv("BUZZ_PRIVATE_KEY", "test-key");

const {
  authMode,
  cookieChallenge,
  LOGIN_KIND,
  newChallenge,
  newSession,
  PROXY_SECRET_HEADER,
  proxyUser,
  seal,
  unseal,
  verifyLogin,
} = await import("./auth");

const NOW = 1_800_000_000;
const hex = (b: Uint8Array) => Buffer.from(b).toString("hex");
const secret = schnorr.utils.randomSecretKey();
const pubkey = hex(schnorr.getPublicKey(secret));

function signed(over: { tags?: string[][]; kind?: number; at?: number } = {}) {
  const e = {
    pubkey,
    created_at: over.at ?? NOW,
    kind: over.kind ?? LOGIN_KIND,
    tags: over.tags ?? [
      ["challenge", "c".repeat(64)],
      ["u", "https://hive.example/api/auth/login"],
      ["method", "POST"],
    ],
    content: "",
  };
  const id = createHash("sha256")
    .update(
      JSON.stringify([0, e.pubkey, e.created_at, e.kind, e.tags, e.content]),
    )
    .digest("hex");
  return { ...e, id, sig: hex(schnorr.sign(Buffer.from(id, "hex"), secret)) };
}

const opts = {
  challenge: "c".repeat(64),
  host: "hive.example",
  owners: [pubkey],
  now: NOW,
};

describe("authMode", () => {
  it("is off unless configured completely", () => {
    expect(authMode({})).toBeNull();
    expect(authMode({ AUTH_MODE: "nostr" })).toBe("nostr");
    expect(authMode({ AUTH_MODE: "proxy", AUTH_PROXY_HEADER: "x-user" })).toBe(
      null,
    );
    expect(
      authMode({
        AUTH_MODE: "proxy",
        AUTH_PROXY_HEADER: "x-user",
        AUTH_PROXY_SECRET: "s",
      }),
    ).toBe("proxy");
  });
});

describe("seal", () => {
  it("round-trips and refuses tampering and expiry", () => {
    const token = seal({ a: 1 }, 60, NOW);
    expect(unseal(token, NOW)).toMatchObject({ a: 1, exp: NOW + 60 });
    expect(unseal(token, NOW + 60)).toBeNull();
    const [body, sig] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ a: 2, exp: NOW + 60 }));
    expect(unseal(`${forged.toString("base64url")}.${sig}`, NOW)).toBeNull();
    expect(unseal(`${body}.${sig}.x`, NOW)).toBeNull();
    expect(unseal(undefined, NOW)).toBeNull();
    expect(unseal(token, NOW, Buffer.alloc(32))).toBeNull();
  });

  it("keeps sessions and challenges apart", () => {
    const { cookie } = newChallenge(NOW);
    expect(cookieChallenge(cookie, NOW)).toMatch(/^[0-9a-f]{64}$/);
    expect(cookieChallenge(newSession(pubkey, NOW).value, NOW)).toBeNull();
  });
});

describe("verifyLogin", () => {
  it("accepts the owner's signed challenge", () => {
    expect(verifyLogin(signed(), opts)).toEqual({ pubkey });
  });

  it("refuses everything else", () => {
    const tags = (u: string, c = "c".repeat(64), m = "POST") => [
      ["challenge", c],
      ["u", u],
      ["method", m],
    ];
    const cases: [unknown, string][] = [
      [{ ...signed(), sig: "zz" }, "malformed event"],
      [signed({ kind: 1 }), "wrong kind"],
      [signed({ at: NOW - 61 }), "expired"],
      [
        signed({
          tags: tags("https://hive.example/api/auth/login", "d".repeat(64)),
        }),
        "wrong challenge",
      ],
      [
        signed({
          tags: tags("https://hive.example/api/auth/login", undefined, "GET"),
        }),
        "wrong method",
      ],
      [
        signed({ tags: tags("https://evil.example/api/auth/login") }),
        "wrong url",
      ],
      [signed({ tags: tags("https://hive.example/other") }), "wrong url"],
      [{ ...signed(), content: "x" }, "bad id"],
      [{ ...signed(), sig: signed({ at: NOW - 1 }).sig }, "bad signature"],
    ];
    for (const [event, error] of cases) {
      expect(verifyLogin(event, opts)).toEqual({ error });
    }
    expect(
      verifyLogin(signed(), { ...opts, owners: ["ab".repeat(32)] }),
    ).toEqual({ error: "not the owner" });
  });
});

describe("proxyUser", () => {
  const env = {
    AUTH_PROXY_HEADER: "x-authentik-username",
    AUTH_PROXY_SECRET: "s3cret",
  };
  const req = (h: Record<string, string>) => (name: string) => h[name] ?? null;

  it("trusts the header only with the proxy's secret", () => {
    const user = { "x-authentik-username": "sam" };
    expect(
      proxyUser(req({ ...user, [PROXY_SECRET_HEADER]: "s3cret" }), env),
    ).toBe("sam");
    expect(proxyUser(req(user), env)).toBeNull();
    expect(
      proxyUser(req({ ...user, [PROXY_SECRET_HEADER]: "nope" }), env),
    ).toBe(null);
    expect(proxyUser(req({ [PROXY_SECRET_HEADER]: "s3cret" }), env)).toBeNull();
  });

  it("applies AUTH_PROXY_USERS when set", () => {
    const h = req({
      "x-authentik-username": "kim",
      [PROXY_SECRET_HEADER]: "s3cret",
    });
    expect(proxyUser(h, { ...env, AUTH_PROXY_USERS: "sam, alex" })).toBeNull();
    expect(proxyUser(h, { ...env, AUTH_PROXY_USERS: "sam,kim" })).toBe("kim");
  });
});
