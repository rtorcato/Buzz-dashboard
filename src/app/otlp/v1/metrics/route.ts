import { insertCostPoints } from "@/lib/history";
import { decodeCostPoints } from "@/lib/otlp";
import { receiveOtlp } from "@/lib/otlp-receive";

// The OTLP/HTTP metrics receiver (#42). Claude Code posts here when an agent
// sets OTEL_EXPORTER_OTLP_ENDPOINT to <dashboard>/otlp; the exporter adds
// /v1/metrics itself. The ingest token only lets an agent post reports; see
// receiveOtlp for the checks. The primary key drops a retried point.
export const POST = (request: Request) =>
  receiveOtlp(request, "OTLP receiver", decodeCostPoints, insertCostPoints);
