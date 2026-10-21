#!/usr/bin/env bash
# Run the dashboard in Docker on this machine.
# Usage: scripts/docker-dev.sh [logs|down]   (no argument: build and start)
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

case "${1:-up}" in
  up)
    if [[ ! -f .env ]]; then
      cp .env.example .env
      echo "Created .env from .env.example. Fill in these vars, then run this again:"
      echo "  BUZZ_RELAY_URL BUZZ_PRIVATE_KEY"
      echo "  GITHUB_TOKEN GITHUB_OWNERS"
      echo "  BUZZ_OWNER_PUBKEY or BUZZ_AUTH_TAG (one of them)"
      echo "Optional: MEDIA_BASE_URL and R2_* (the Media tab and status feed;"
      echo "  without them those views show \"source down\")."
      exit 1
    fi
    docker compose up --build -d
    echo "Dashboard: http://localhost:3000"
    ;;
  logs)
    docker compose logs -f
    ;;
  down)
    docker compose down
    ;;
  *)
    echo "Usage: $0 [logs|down]" >&2
    exit 1
    ;;
esac
