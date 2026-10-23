import { z } from "zod";
import { OwnerRequired, ownerPubkeys, requireOwner } from "@/lib/auth";
import { selectOtel, selectSigner, signerSince } from "@/lib/cost-source";
import { historyEnabled } from "@/lib/history";
import { npubEncode } from "@/lib/npub";
import { connectSigner, parseBunker, SignerError } from "@/lib/signer";

// Switches the cost source (#43). POST connects the owner signer and makes it
// the source; DELETE goes back to OpenTelemetry. Owner only.

const BodySchema = z.object({
  bunker: z.string().max(2000),
  /** The "could decrypt my DMs" box. The server won't connect without it. */
  understood: z.literal(true),
});

async function guard(request: Request): Promise<Response | null> {
  if (!historyEnabled()) return new Response(null, { status: 404 });
  // As on login: a JSON body needs a CORS preflight cross-site, which this
  // route never answers, so another site can't switch the source.
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
  return null;
}

export async function POST(request: Request) {
  const refused = await guard(request);
  if (refused) return refused;
  const body = BodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return Response.json({ error: "Tick the box first" }, { status: 400 });
  }
  const bp = parseBunker(body.data.bunker);
  if (!bp) {
    return Response.json(
      { error: "That isn’t a bunker:// address with a relay" },
      { status: 400 },
    );
  }
  try {
    const record = await connectSigner(bp, ownerPubkeys(), await signerSince());
    await selectSigner(record);
    return Response.json(
      { npub: npubEncode(record.pubkey) },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (err) {
    // The signer answers a refusal with a plain string, e.g. "invalid secret".
    const error =
      err instanceof SignerError
        ? err.message
        : typeof err === "string"
          ? `The signer refused: ${err.slice(0, 200)}`
          : null;
    if (error) return Response.json({ error }, { status: 502 });
    console.error("Owner signer:", err);
    return Response.json(
      { error: "Couldn’t reach the signer. Check the address and try again." },
      { status: 502 },
    );
  }
}

export async function DELETE(request: Request) {
  const refused = await guard(request);
  if (refused) return refused;
  await selectOtel();
  return new Response(null, { status: 204 });
}
