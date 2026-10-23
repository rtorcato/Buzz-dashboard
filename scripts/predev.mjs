// Runs before `pnpm dev`. When DATABASE_URL (from the env or .env.local)
// points at this machine, it starts the compose `postgres` service for the
// history store (#39). Unset means live-only mode, and Docker is never touched.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

// Doesn't override the env, matching Next's own precedence.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const url = process.env.DATABASE_URL;
if (!url) {
  console.log("predev: DATABASE_URL unset, live-only mode.");
  process.exit(0);
}

let host;
try {
  host = new URL(url).hostname;
} catch {
  console.error("predev: DATABASE_URL isn't a valid URL.");
  process.exit(1);
}
// A remote database needs no local container.
if (!["127.0.0.1", "localhost", "[::1]"].includes(host)) process.exit(0);

if (spawnSync("docker", ["info"], { stdio: "ignore" }).status !== 0) {
  console.error(
    "predev: DATABASE_URL is set but Docker isn't running. Start Docker, or unset DATABASE_URL in .env.local for live-only mode.",
  );
  process.exit(1);
}

const up = spawnSync("docker", ["compose", "up", "-d", "--wait", "postgres"], {
  stdio: "inherit",
});
process.exit(up.status ?? 1);
