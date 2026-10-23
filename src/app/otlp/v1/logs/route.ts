import { insertAgentEvents } from "@/lib/history";
import { decodeApiEvents } from "@/lib/otlp";
import { receiveOtlp } from "@/lib/otlp-receive";

// The OTLP/HTTP logs receiver (#44), next to the metrics one: same ingest
// token, same bare 401, same one-source rule. Claude Code sends api_error as
// a log event, not a metric, once an agent sets OTEL_LOGS_EXPORTER=otlp. Only
// api_request and api_error survive decoding, and only their agent, model,
// time and status code are stored.
export const POST = (request: Request) =>
  receiveOtlp(request, "OTLP logs receiver", decodeApiEvents, (events) =>
    insertAgentEvents(events.map((e) => ({ ...e, reason: null }))),
  );
