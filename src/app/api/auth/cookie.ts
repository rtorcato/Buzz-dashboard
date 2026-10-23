// httpOnly and SameSite=Lax for every auth cookie (#40); Secure whenever the
// browser reached the dashboard over HTTPS, directly or through a proxy.
export function cookieOptions(request: Request, maxAge: number) {
  const proto =
    request.headers.get("x-forwarded-proto") ??
    new URL(request.url).protocol.replace(":", "");
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: proto.split(",")[0].trim() === "https",
    path: "/",
    maxAge,
  };
}

/** The host the browser used, behind a proxy or not. */
export const requestHost = (request: Request) =>
  (
    request.headers.get("x-forwarded-host") ??
    request.headers.get("host") ??
    new URL(request.url).host
  )
    .split(",")[0]
    .trim();
