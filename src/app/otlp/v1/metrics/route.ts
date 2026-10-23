import { gunzipSync } from "node:zlib";
import { ingestTokenRecord, signerRecord } from "@/lib/cost-source";
import { historyEnabled, insertCostPoints } from "@/lib/history";
import { checkIngestToken } from "@/lib/ingest-token";
import { decodeCostPoints } from "@/lib/otlp";

// The OTLP/HTTP metrics receiver (#42). Claude Code posts here when an agent
// sets OTEL_EXPORTER_OTLP_ENDPOINT to <dashboard>/otlp; the exporter adds
// /v1/metrics itself. Every report needs the ingest token, and a refused one
// gets a bare 401 with no detail. The token only lets an agent post metrics.
// While the owner signer (#43) is the cost source, every report gets a 401 too,
// so the two sources never double-count.

/** One export from one agent is a few KB; this leaves plenty of room. */
const MAX_BYTES = 1_000_000;

const empty = (status: number) => new Response(null, { status });

export async function POST(request: Request) {
  if (!historyEnabled()) return empty(404);
  let record: Awaited<ReturnType<typeof ingestTokenRecord>>;
  try {
    record = (await signerRecord()) ? null : await ingestTokenRecord();
  } catch (err) {
    console.error("OTLP receiver:", err);
    return empty(503);
  }
  if (!checkIngestToken(request.headers.get("authorization"), record)) {
    return empty(401);
  }
  if (
    !request.headers.get("content-type")?.startsWith("application/x-protobuf")
  ) {
    return empty(415);
  }
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BYTES) {
    return empty(413);
  }
  let body = new Uint8Array(await request.arrayBuffer());
  if (body.length > MAX_BYTES) return empty(413);
  let points: ReturnType<typeof decodeCostPoints>;
  try {
    if (request.headers.get("content-encoding") === "gzip") {
      body = new Uint8Array(gunzipSync(body, { maxOutputLength: MAX_BYTES }));
    }
    points = decodeCostPoints(body);
  } catch {
    return empty(400);
  }
  try {
    await insertCostPoints(points);
  } catch (err) {
    console.error("OTLP receiver:", err);
    // The exporter retries a 503, and the primary key drops duplicates.
    return empty(503);
  }
  // An empty ExportMetricsServiceResponse: everything was accepted.
  return new Response(new Uint8Array(), {
    status: 200,
    headers: { "content-type": "application/x-protobuf" },
  });
}
