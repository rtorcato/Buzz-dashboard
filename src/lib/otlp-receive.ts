import "server-only";

import { gunzipSync } from "node:zlib";
import { ingestTokenRecord, signerRecord } from "./cost-source";
import { historyEnabled } from "./history";
import { checkIngestToken } from "./ingest-token";

// The checks both OTLP/HTTP receivers share (#42 metrics, #44 logs). Every
// report needs the ingest token, and a refused one gets a bare 401 with no
// detail. While the owner signer (#43) is the cost source, every report gets a
// 401 too, so the two sources never double-count.

/** One export from one agent is a few KB; this leaves plenty of room. */
const MAX_BYTES = 1_000_000;

const empty = (status: number) => new Response(null, { status });

/**
 * Checks, reads and decodes one OTLP/HTTP protobuf report, then stores it.
 * A decode failure is a 400; a store failure is a 503, which the exporter
 * retries, so `store` must drop duplicates.
 */
export async function receiveOtlp<T>(
  request: Request,
  label: string,
  decode: (body: Uint8Array) => T,
  store: (decoded: T) => Promise<void>,
): Promise<Response> {
  if (!historyEnabled()) return empty(404);
  let record: Awaited<ReturnType<typeof ingestTokenRecord>>;
  try {
    record = (await signerRecord()) ? null : await ingestTokenRecord();
  } catch (err) {
    console.error(`${label}:`, err);
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
  let decoded: T;
  try {
    if (request.headers.get("content-encoding") === "gzip") {
      body = new Uint8Array(gunzipSync(body, { maxOutputLength: MAX_BYTES }));
    }
    decoded = decode(body);
  } catch {
    return empty(400);
  }
  try {
    await store(decoded);
  } catch (err) {
    console.error(`${label}:`, err);
    return empty(503);
  }
  // An empty Export*ServiceResponse: everything was accepted.
  return new Response(new Uint8Array(), {
    status: 200,
    headers: { "content-type": "application/x-protobuf" },
  });
}
