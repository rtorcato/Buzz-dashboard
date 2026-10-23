import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/auth";

// Sign out (#40): drops the session cookie. Harmless to call signed out.
export async function POST() {
  (await cookies()).delete(SESSION_COOKIE);
  return new Response(null, { status: 204 });
}
