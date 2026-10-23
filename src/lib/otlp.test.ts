import { describe, expect, it } from "vitest";
import { decodeCostPoints, UNATTRIBUTED } from "./otlp";

// A tiny protobuf writer, just enough to build OTLP requests.
const varint = (n: number | bigint) => {
  let v = BigInt(n);
  const out: number[] = [];
  do {
    let b = Number(v & BigInt(0x7f));
    v >>= BigInt(7);
    if (v) b |= 0x80;
    out.push(b);
  } while (v);
  return out;
};
const msg = (n: number, body: number[]) => [
  ...varint((n << 3) | 2),
  ...varint(body.length),
  ...body,
];
const str = (n: number, s: string) => msg(n, [...new TextEncoder().encode(s)]);
const int = (n: number, v: number) => [...varint(n << 3), ...varint(v)];
const fixed = (n: number, write: (d: DataView) => void) => {
  const b = new Uint8Array(8);
  write(new DataView(b.buffer));
  return [...varint((n << 3) | 1), ...b];
};
const kv = (n: number, key: string, value: string) =>
  msg(n, [...str(1, key), ...msg(2, str(1, value))]);

const T = BigInt(1_792_771_200_000); // ms
const point = (
  value: number,
  attrs: Record<string, string>,
  { asInt = false } = {},
) =>
  msg(1, [
    ...fixed(3, (d) => d.setBigUint64(0, T * BigInt(1_000_000), true)),
    ...(asInt
      ? fixed(6, (d) => d.setBigInt64(0, BigInt(value), true))
      : fixed(4, (d) => d.setFloat64(0, value, true))),
    ...Object.entries(attrs).flatMap(([k, v]) => kv(7, k, v)),
  ]);
const metric = (name: string, points: number[][], temporality = 1) =>
  msg(2, [
    ...str(1, name),
    ...str(3, "unit"),
    ...msg(7, [...points.flat(), ...int(2, temporality), ...int(3, 1)]),
  ]);
const request = (resource: Record<string, string>, metrics: number[][]) =>
  new Uint8Array(
    msg(1, [
      ...msg(
        1,
        Object.entries(resource).flatMap(([k, v]) => kv(1, k, v)),
      ),
      ...msg(2, [
        ...msg(1, str(1, "com.anthropic.claude_code")),
        ...metrics.flat(),
      ]),
    ]),
  );

describe("decodeCostPoints", () => {
  it("reads cost and token points with the agent from the resource", () => {
    const pts = decodeCostPoints(
      request({ agent: "Fern", "service.name": "claude-code" }, [
        metric("claude_code.cost.usage", [
          point(0.42, { model: "claude-opus-4", "session.id": "s1" }),
        ]),
        metric("claude_code.token.usage", [
          point(
            1200,
            { model: "claude-opus-4", type: "cacheRead" },
            { asInt: true },
          ),
        ]),
        metric("claude_code.session.count", [point(1, {})]),
      ]),
    );
    expect(pts).toHaveLength(2);
    expect(pts[0]).toMatchObject({
      agent: "Fern",
      model: "claude-opus-4",
      metric: "cost",
      type: "",
      value: 0.42,
      at: new Date(Number(T)),
    });
    expect(pts[1]).toMatchObject({
      metric: "tokens",
      type: "cacheRead",
      value: 1200,
    });
  });

  it("keys series by their other attributes", () => {
    const [a, b, c] = decodeCostPoints(
      request({ agent: "Fern" }, [
        metric("claude_code.cost.usage", [
          point(1, { model: "m", query_source: "main" }),
          point(1, { model: "m", query_source: "subagent" }),
          point(1, { query_source: "main", model: "m" }),
        ]),
      ]),
    );
    expect(a.series).not.toBe(b.series);
    expect(a.series).toBe(c.series);
  });

  it("skips cumulative sums, which would count spend twice", () => {
    expect(
      decodeCostPoints(
        request({ agent: "Fern" }, [
          metric("claude_code.cost.usage", [point(5, { model: "m" })], 2),
        ]),
      ),
    ).toEqual([]);
  });

  it("names a report without an agent attribute Unattributed", () => {
    const [p] = decodeCostPoints(
      request({}, [metric("claude_code.cost.usage", [point(1, {})])]),
    );
    expect(p.agent).toBe(UNATTRIBUTED);
  });

  it("throws on a truncated body", () => {
    const body = request({ agent: "Fern" }, [
      metric("claude_code.cost.usage", [point(1, {})]),
    ]);
    expect(() => decodeCostPoints(body.subarray(0, body.length - 3))).toThrow();
  });

  it("reads an empty request as no points", () => {
    expect(decodeCostPoints(new Uint8Array())).toEqual([]);
  });
});
