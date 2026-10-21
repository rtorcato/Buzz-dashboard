import { describe, expect, it } from "vitest";
import { npubEncode } from "./npub";

describe("npubEncode", () => {
  it("matches the relay's npub for a known key", () => {
    expect(
      npubEncode(
        "f69e227dc3e10dc3dc5f115d4b4fb2c32d1cd6bab5993bfff3f7c64a6e34df10",
      ),
    ).toBe("npub1760zylwruyxu8hzlz9w5knajcvk3e446kkvnhlln7lry5m35mugqrl3lj6");
  });
});
