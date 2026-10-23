import { createHash } from "node:crypto";

// A minimal OTLP/HTTP protobuf reader for the two Claude Code metrics the
// Cost view needs (#42), claude_code.cost.usage and claude_code.token.usage,
// and the two log events Health needs (#44), api_request and api_error. It
// walks only the fields on those paths of ExportMetricsServiceRequest and
// ExportLogsServiceRequest (opentelemetry/proto/collector/*/v1) and skips
// everything else, so there is no protobuf dependency.

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

// KeyValue { key = 1; AnyValue value = 2 },
// AnyValue { string_value = 1; int_value = 3 }. Other value types are dropped;
// Claude Code sends attributes as strings, and a status code may be an int.
function attributes(kvs: Field[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const kv of kvs) {
    let key = "";
    let value: string | undefined;
    for (const f of fields(kv.bytes)) {
      if (f.n === 1) key = text.decode(f.bytes);
      if (f.n === 2) {
        const v = fields(f.bytes).find((v) => v.n === 1 || v.n === 3);
        if (v) value = v.n === 1 ? text.decode(v.bytes) : String(v.int);
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
  const ms = time && nanosToMs(time.bytes);
  if (!ms) return null;
  const value = dbl
    ? view(dbl.bytes).getFloat64(0, true)
    : int
      ? Number(view(int.bytes).getBigInt64(0, true))
      : null;
  if (value === null || !Number.isFinite(value) || value < 0) return null;
  return {
    at: new Date(ms),
    value,
    attrs: attributes(f.filter((x) => x.n === 7)),
  };
}

// A fixed64 Unix-nanosecond time as ms, or 0 when unset or malformed.
function nanosToMs(b: Uint8Array): number {
  if (b.length !== 8) return 0;
  const t = view(b);
  // Nanoseconds as two 32-bit halves; a double keeps far more than ms.
  return Math.floor(
    (t.getUint32(4, true) * 2 ** 32 + t.getUint32(0, true)) / 1e6,
  );
}

export type ApiEvent = {
  /** A hash of the record, so a retried export stores nothing new. */
  id: string;
  at: Date;
  agent: string;
  model: string;
  kind: "request" | "error";
  /** The HTTP status of an api_error, when it has one. */
  status: number | null;
};

const EVENTS: Record<string, ApiEvent["kind"]> = {
  api_request: "request",
  api_error: "error",
};

/**
 * The api_request and api_error events in an OTLP ExportLogsServiceRequest
 * (#44). Every other log record is dropped, and only the agent, model, time
 * and status code are kept: never a prompt, a response or an error message.
 */
export function decodeApiEvents(buf: Uint8Array): ApiEvent[] {
  const out: ApiEvent[] = [];
  // ExportLogsServiceRequest { repeated ResourceLogs = 1 }
  for (const rl of fields(buf)) {
    if (rl.n !== 1) continue;
    // ResourceLogs { Resource = 1; repeated ScopeLogs = 2 }
    const parts = fields(rl.bytes);
    const res = parts.find((f) => f.n === 1);
    const resource = res
      ? attributes(fields(res.bytes).filter((f) => f.n === 1))
      : {};
    const agent = resource.agent?.trim() || UNATTRIBUTED;
    for (const sl of parts) {
      if (sl.n !== 2) continue;
      // ScopeLogs { repeated LogRecord log_records = 2 }
      for (const lr of fields(sl.bytes)) {
        if (lr.n !== 2) continue;
        // LogRecord { time_unix_nano = 1 (fixed64); body = 5;
        // attributes = 6; observed_time_unix_nano = 11; event_name = 12 }
        const f = fields(lr.bytes);
        const attrs = attributes(f.filter((x) => x.n === 6));
        const kind = EVENTS[eventName(f, attrs).replace(/^claude_code\./, "")];
        if (!kind) continue;
        const time = f.find((x) => x.n === 1);
        const observed = f.find((x) => x.n === 11);
        const ms =
          (time && nanosToMs(time.bytes)) ||
          (observed && nanosToMs(observed.bytes));
        if (!ms) continue;
        const status = Number(attrs.status_code);
        out.push({
          id: seriesKey({ ...attrs, "~agent": agent, "~at": String(ms) }),
          at: new Date(ms),
          agent,
          model: attrs.model ?? "",
          kind,
          status:
            kind === "error" && Number.isInteger(status) && status > 0
              ? status
              : null,
        });
      }
    }
  }
  return out;
}

// Claude Code names the event in the `event.name` attribute; newer exporters
// also fill LogRecord.event_name, and some put it in the body.
function eventName(f: Field[], attrs: Record<string, string>): string {
  const named = f.find((x) => x.n === 12);
  if (named?.bytes.length) return text.decode(named.bytes);
  if (attrs["event.name"]) return attrs["event.name"];
  const body = f.find((x) => x.n === 5);
  const s = body && fields(body.bytes).find((v) => v.n === 1);
  return s ? text.decode(s.bytes) : "";
}
