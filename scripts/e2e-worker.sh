#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

WORKER_PORT="${WORKER_PORT:-8791}"
PERSIST_DIR="${WRANGLER_PERSIST_DIR:-$ROOT_DIR/.wrangler/e2e-state}"
REUSE_EXISTING_SERVER="${REUSE_EXISTING_SERVER:-0}"

mkdir -p "$ROOT_DIR/.wrangler"
rm -rf "$PERSIST_DIR"

if lsof -nP -iTCP:"${WORKER_PORT}" -sTCP:LISTEN >/dev/null 2>&1; then
  if [[ "$REUSE_EXISTING_SERVER" == "1" ]]; then
    echo "Reusing existing worker on port ${WORKER_PORT}." >&2
    exit 0
  fi
  echo "Port ${WORKER_PORT} is already in use. Stop the existing process before starting E2E worker." >&2
  exit 1
fi

for migration in "$ROOT_DIR"/migrations/*.sql; do
  "$ROOT_DIR/scripts/wrangler.sh" d1 execute minecraft-fps-db-prod --config wrangler.toml --local --persist-to "$PERSIST_DIR" --file="$migration" >/dev/null
done

exec "$ROOT_DIR/scripts/wrangler.sh" dev cloudflare/worker.js --config wrangler.toml --port "$WORKER_PORT" --local --persist-to "$PERSIST_DIR"
