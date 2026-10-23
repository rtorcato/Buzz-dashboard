import { publicOrigin } from "@/lib/auth";

// httpOnly and SameSite=Lax for every auth cookie (#40). Secure unless
// AUTH_PUBLIC_URL is plain http; the scheme comes from config, not from
// X-Forwarded-Proto (#63).
export function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: !publicOrigin()?.startsWith("http:"),
    path: "/",
    maxAge,
  };
}
