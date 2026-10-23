import { cookies } from "next/headers";
import { authMode, CHALLENGE_COOKIE, newChallenge } from "@/lib/auth";
import { cookieOptions } from "../cookie";

// Step 1 of Nostr sign-in (#40): a one-time challenge for the extension to
// sign, kept in a short-lived sealed cookie. POST, so nothing caches it.
export async function POST(request: Request) {
  if (authMode() !== "nostr") return new Response(null, { status: 404 });
  const { challenge, cookie, maxAge } = newChallenge(
    Math.floor(Date.now() / 1000),
  );
  (await cookies()).set(
    CHALLENGE_COOKIE,
    cookie,
    cookieOptions(request, maxAge),
  );
  return Response.json({ challenge });
}
