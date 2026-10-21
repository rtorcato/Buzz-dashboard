import { schnorr } from "@noble/curves/secp256k1.js";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { signAuthEvent } = await import("./relay");

const env = {
  buzzRelayUrl: "wss://relay.example",
  buzzPrivateKey: "11".repeat(32),
};

describe("signAuthEvent", () => {
  it("signs a valid NIP-42 auth event for the challenge", () => {
    const e = signAuthEvent(env, "abc", 1000);
    expect(e.kind).toBe(22242);
    expect(e.tags).toEqual([
      ["relay", "wss://relay.example"],
      ["challenge", "abc"],
    ]);
    expect(
      schnorr.verify(
        Buffer.from(e.sig, "hex"),
        Buffer.from(e.id, "hex"),
        Buffer.from(e.pubkey, "hex"),
      ),
    ).toBe(true);
  });

  it("adds the NIP-OA tag when set", () => {
    const tag = ["auth", "owner", "", "sig"];
    const e = signAuthEvent(
      { ...env, buzzAuthTag: JSON.stringify(tag) },
      "abc",
    );
    expect(e.tags[2]).toEqual(tag);
  });

  it("rejects a key that isn't hex", () => {
    expect(() =>
      signAuthEvent({ ...env, buzzPrivateKey: "nsec1abc" }, "abc"),
    ).toThrow("64-character hex");
  });
});
