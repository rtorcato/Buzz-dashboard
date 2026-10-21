// Liveness only: never calls the relay or GitHub, so a source outage doesn't
// make Docker restart the container.
export function GET() {
  return Response.json({ ok: true });
}
