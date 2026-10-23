import { cookies } from "next/headers";
import {
  authMode,
  CHALLENGE_COOKIE,
  cookieChallenge,
  newSession,
  ownerPubkeys,
  SESSION_COOKIE,
  verifyLogin,
} from "@/lib/auth";
import { cookieOptions, requestHost } from "../cookie";

// Step 2 of Nostr sign-in (#40): the signed challenge in, a session cookie
// out. The challenge cookie is single-use: it is cleared whatever happens.
export async function POST(request: Request) {
  if (authMode() !== "nostr") return new Response(null, { status: 404 });
  // A JSON body makes a cross-site form post impossible without a CORS
  // preflight, which this route never answers.
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return Response.json({ error: "expected JSON" }, { status: 415 });
  }
  const jar = await cookies();
  const now = Math.floor(Date.now() / 1000);
  const challenge = cookieChallenge(jar.get(CHALLENGE_COOKIE)?.value, now);
  jar.delete(CHALLENGE_COOKIE);
  if (!challenge) {
    return Response.json({ error: "challenge expired" }, { status: 401 });
  }
  let event: unknown;
  try {
    event = await request.json();
  } catch {
    return Response.json({ error: "malformed event" }, { status: 400 });
  }
  const result = verifyLogin(event, {
    challenge,
    host: requestHost(request),
    owners: ownerPubkeys(),
    now,
  });
  if ("error" in result) {
    return Response.json(
      { error: result.error },
      { status: result.error === "not the owner" ? 403 : 401 },
    );
  }
  const { value, maxAge } = newSession(result.pubkey, now);
  jar.set(SESSION_COOKIE, value, cookieOptions(request, maxAge));
  return Response.json({ pubkey: result.pubkey });
}
