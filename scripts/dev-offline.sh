#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

WRANGLER_BIN="${WRANGLER_BIN:-npx}"
WRANGLER_PKG="${WRANGLER_PKG:-wrangler@3}"
WORKER_PORT="${WORKER_PORT:-8787}"

WORKER_LOG="${WORKER_LOG:-$ROOT_DIR/.wrangler/offline-worker.log}"

mkdir -p "$ROOT_DIR/.wrangler"

worker_pid=""

cleanup() {
  if [[ -n "${worker_pid}" ]] && kill -0 "${worker_pid}" 2>/dev/null; then
    kill "${worker_pid}" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

echo "Starting local multiplayer dev server on http://127.0.0.1:${WORKER_PORT}"
"${WRANGLER_BIN}" "${WRANGLER_PKG}" dev cloudflare/worker.js --config wrangler.toml --port "${WORKER_PORT}" --local --assets . >"${WORKER_LOG}" 2>&1 &
worker_pid=$!

sleep 2
if ! kill -0 "${worker_pid}" 2>/dev/null; then
  echo "Local server failed to start. Log: ${WORKER_LOG}"
  exit 1
fi

echo
echo "Offline multiplayer dev is running."
echo "Open: http://127.0.0.1:${WORKER_PORT}/"
echo "Use the in-game mode menu:"
echo "  - Single Dev Server for local authoritative client/server testing"
echo "  - Single Full Sandbox for offline experiments"
echo "  - Cloudflare modes to target the deployed backend from localhost"
echo "Logs:"
echo "  ${WORKER_LOG}"
echo
echo "Press Ctrl+C to stop."

wait "${worker_pid}"
