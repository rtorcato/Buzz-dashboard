import { OwnerRequired, requireOwner } from "@/lib/auth";
import { rotateIngestToken } from "@/lib/cost-source";
import { historyEnabled } from "@/lib/history";
import { maskToken } from "@/lib/ingest-token";

// Creates or rotates the OTel ingest token (#42). Owner only. The full token
// is in this one response and never again; the server keeps its hash.
export async function POST(request: Request) {
  if (!historyEnabled()) return new Response(null, { status: 404 });
  // As on login: a JSON body needs a CORS preflight cross-site, which this
  // route never answers, so another site can't rotate the token.
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return Response.json({ error: "expected JSON" }, { status: 415 });
  }
  try {
    await requireOwner();
  } catch (err) {
    if (err instanceof OwnerRequired) {
      return Response.json(
        { error: "owner sign-in required" },
        { status: 403 },
      );
    }
    throw err;
  }
  const { token, record } = await rotateIngestToken();
  return Response.json(
    { token, masked: maskToken(record), createdAt: record.createdAt },
    { headers: { "cache-control": "no-store" } },
  );
}
