import { createHash } from "node:crypto";

// A minimal OTLP/HTTP protobuf reader for the two Claude Code metrics the
// Cost view needs (#42): claude_code.cost.usage and claude_code.token.usage.
// It walks only the fields on that path of ExportMetricsServiceRequest
// (opentelemetry/proto/collector/metrics/v1) and skips everything else, so
// there is no protobuf dependency.

export type CostPoint = {
  at: Date;
  agent: string;
  model: string;
  metric: "cost" | "tokens";
  /** Token type for "tokens", "" for "cost". */
  type: string;
  /** A hash of the point's other attributes. */
  series: string;
  value: number;
};

const METRICS: Record<string, CostPoint["metric"]> = {
  "claude_code.cost.usage": "cost",
  "claude_code.token.usage": "tokens",
};

/** Reports without the `agent` resource attribute land here. */
export const UNATTRIBUTED = "Unattributed";

const DELTA = 1;

type Field = { n: number; int: number; bytes: Uint8Array };

// Every top-level field of one protobuf message. Throws on a truncated or
// malformed buffer.
function fields(buf: Uint8Array): Field[] {
  const out: Field[] = [];
  let i = 0;
  // As a Number: every varint read here is a key, a length or an enum.
  const varint = () => {
    let r = 0;
    for (let mul = 1, n = 0; n < 10; mul *= 128, n++) {
      if (i >= buf.length) throw new Error("truncated varint");
      const b = buf[i++];
      r += (b & 0x7f) * mul;
      if (!(b & 0x80)) return r;
    }
    throw new Error("varint too long");
  };
  const take = (len: number) => {
    if (len < 0 || i + len > buf.length) throw new Error("truncated field");
    const b = buf.subarray(i, i + len);
    i += len;
    return b;
  };
  const none = new Uint8Array();
  while (i < buf.length) {
    const key = varint();
    const n = Math.floor(key / 8);
    switch (key % 8) {
      case 0:
        out.push({ n, int: varint(), bytes: none });
        break;
      case 1:
        out.push({ n, int: 0, bytes: take(8) });
        break;
      case 2:
        out.push({ n, int: 0, bytes: take(varint()) });
        break;
      case 5:
        take(4);
        break;
      default:
        throw new Error("unsupported wire type");
    }
  }
  return out;
}

const text = new TextDecoder();
const view = (b: Uint8Array) => new DataView(b.buffer, b.byteOffset, 8);

// KeyValue { key = 1; AnyValue value = 2 }, AnyValue { string_value = 1 }.
// Only string values are kept; Claude Code sends every attribute as one.
function attributes(kvs: Field[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const kv of kvs) {
    let key = "";
    let value: string | undefined;
    for (const f of fields(kv.bytes)) {
      if (f.n === 1) key = text.decode(f.bytes);
      if (f.n === 2) {
        const s = fields(f.bytes).find((v) => v.n === 1);
        if (s) value = text.decode(s.bytes);
      }
    }
    if (key && value !== undefined) out[key] = value;
  }
  return out;
}

const seriesKey = (attrs: Record<string, string>) =>
  createHash("sha256")
    .update(JSON.stringify(Object.entries(attrs).sort()))
    .digest("base64url")
    .slice(0, 22);

/**
 * The cost and token points in an OTLP ExportMetricsServiceRequest. Only
 * delta sums count, Claude Code's default: a cumulative point would count
 * the same spend again on every export.
 */
export function decodeCostPoints(buf: Uint8Array): CostPoint[] {
  const out: CostPoint[] = [];
  // ExportMetricsServiceRequest { repeated ResourceMetrics = 1 }
  for (const rm of fields(buf)) {
    if (rm.n !== 1) continue;
    const parts = fields(rm.bytes);
    // ResourceMetrics { Resource = 1; repeated ScopeMetrics = 2 }
    // Resource { repeated KeyValue attributes = 1 }
    const res = parts.find((f) => f.n === 1);
    const resource = res
      ? attributes(fields(res.bytes).filter((f) => f.n === 1))
      : {};
    const agent = resource.agent?.trim() || UNATTRIBUTED;
    for (const sm of parts) {
      if (sm.n !== 2) continue;
      // ScopeMetrics { repeated Metric metrics = 2 }
      for (const m of fields(sm.bytes)) {
        if (m.n !== 2) continue;
        // Metric { name = 1; Sum sum = 7 }
        const mf = fields(m.bytes);
        const name = mf.find((f) => f.n === 1);
        const metric = name && METRICS[text.decode(name.bytes)];
        const sum = mf.find((f) => f.n === 7);
        if (!metric || !sum) continue;
        // Sum { repeated NumberDataPoint = 1; aggregation_temporality = 2 }
        const sf = fields(sum.bytes);
        if (sf.find((f) => f.n === 2)?.int !== DELTA) continue;
        for (const dp of sf) {
          if (dp.n !== 1) continue;
          const point = dataPoint(fields(dp.bytes));
          if (!point) continue;
          const { model = "", type = "", ...rest } = point.attrs;
          out.push({
            at: point.at,
            agent,
            model,
            metric,
            type: metric === "tokens" ? type : "",
            series: seriesKey(rest),
            value: point.value,
          });
        }
      }
    }
  }
  return out;
}

// NumberDataPoint { time_unix_nano = 3 (fixed64); as_double = 4;
// as_int = 6 (sfixed64); attributes = 7 }
function dataPoint(f: Field[]) {
  const time = f.find((x) => x.n === 3);
  const dbl = f.find((x) => x.n === 4);
  const int = f.find((x) => x.n === 6);
  if (time?.bytes.length !== 8) return null;
  const value = dbl
    ? view(dbl.bytes).getFloat64(0, true)
    : int
      ? Number(view(int.bytes).getBigInt64(0, true))
      : null;
  if (value === null || !Number.isFinite(value) || value < 0) return null;
  const t = view(time.bytes);
  // Nanoseconds as two 32-bit halves; a double keeps far more than ms.
  const ms = Math.floor(
    (t.getUint32(4, true) * 2 ** 32 + t.getUint32(0, true)) / 1e6,
  );
  if (!ms) return null;
  return {
    at: new Date(ms),
    value,
    attrs: attributes(f.filter((x) => x.n === 7)),
  };
}
