// NIP-19 `npub` for a hex pubkey: bech32 (BIP-173) over the 32 key bytes.
// ponytail: encode only, ~20 lines, rather than a bech32 dependency.
const CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];

function polymod(values: number[]) {
  let chk = 1;
  for (const v of values) {
    const top = chk >>> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ v;
    for (let i = 0; i < 5; i++) if ((top >>> i) & 1) chk ^= GEN[i];
  }
  return chk;
}

export function npubEncode(hex: string): string {
  const hrp = "npub";
  // 8-bit bytes → 5-bit groups, zero-padded.
  const data: number[] = [];
  let acc = 0;
  let bits = 0;
  for (const byte of hex.match(/../g) ?? []) {
    acc = (acc << 8) | Number.parseInt(byte, 16);
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      data.push((acc >>> bits) & 31);
    }
  }
  if (bits) data.push((acc << (5 - bits)) & 31);
  const expand = [...hrp].map((c) => c.charCodeAt(0) >> 5);
  expand.push(0, ...[...hrp].map((c) => c.charCodeAt(0) & 31));
  const mod = polymod([...expand, ...data, 0, 0, 0, 0, 0, 0]) ^ 1;
  const checksum = Array.from(
    { length: 6 },
    (_, i) => (mod >>> (5 * (5 - i))) & 31,
  );
  return `${hrp}1${[...data, ...checksum].map((d) => CHARSET[d]).join("")}`;
}
