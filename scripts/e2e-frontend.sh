#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

FRONTEND_PORT="${FRONTEND_PORT:-4173}"
WORKER_PROXY_PORT="${WORKER_PROXY_PORT:-8791}"
VITE_BIN="${VITE_BIN:-$ROOT_DIR/node_modules/.bin/vite}"
REUSE_EXISTING_SERVER="${REUSE_EXISTING_SERVER:-0}"

if lsof -nP -iTCP:"${FRONTEND_PORT}" -sTCP:LISTEN >/dev/null 2>&1; then
  if [[ "$REUSE_EXISTING_SERVER" == "1" ]]; then
    echo "Reusing existing frontend on port ${FRONTEND_PORT}." >&2
    exit 0
  fi
  echo "Port ${FRONTEND_PORT} is already in use. Stop the existing process before starting E2E frontend." >&2
  exit 1
fi

if [[ ! -x "$VITE_BIN" ]]; then
  echo "Missing local Vite binary at ${VITE_BIN}. Run npm install first." >&2
  exit 1
fi

for _ in $(seq 1 120); do
  if curl -s "http://127.0.0.1:${WORKER_PROXY_PORT}/" >/dev/null 2>&1; then
    exec env WORKER_PROXY_PORT="${WORKER_PROXY_PORT}" "$VITE_BIN" --host 127.0.0.1 --port "${FRONTEND_PORT}"
  fi
  sleep 0.5
done

echo "Timed out waiting for local worker on 127.0.0.1:${WORKER_PROXY_PORT}" >&2
exit 1
