// Runs once when the server starts. With DATABASE_URL set it applies the
// history store's migrations and starts the ingester (#39); without it the
// dashboard stays live-only and nothing here loads.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || !process.env.DATABASE_URL) {
    return;
  }
  const { startHistory } = await import("./lib/ingest");
  await startHistory();
}
