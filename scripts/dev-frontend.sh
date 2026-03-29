#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

FRONTEND_PORT="${FRONTEND_PORT:-3000}"
WORKER_PORT="${WORKER_PORT:-8787}"
WORKER_PROXY_PORT="${WORKER_PROXY_PORT:-$WORKER_PORT}"
PERSIST_DIR="${WRANGLER_PERSIST_DIR:-$ROOT_DIR/.wrangler/frontend-state}"
VITE_BIN="${VITE_BIN:-$ROOT_DIR/node_modules/.bin/vite}"
WRANGLER_BIN="${WRANGLER_BIN:-$ROOT_DIR/scripts/wrangler.sh}"
REUSE_EXISTING_WORKER="${REUSE_EXISTING_WORKER:-1}"
WRANGLER_ENV="${WRANGLER_ENV:-}"

worker_pid=""

cleanup() {
  if [[ -n "${worker_pid}" ]] && kill -0 "${worker_pid}" 2>/dev/null; then
    kill "${worker_pid}" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

if [[ ! -x "$VITE_BIN" ]]; then
  echo "Missing local Vite binary at ${VITE_BIN}. Run npm install first." >&2
  exit 1
fi

if ! lsof -nP -iTCP:"${WORKER_PROXY_PORT}" -sTCP:LISTEN >/dev/null 2>&1; then
  rm -rf "$PERSIST_DIR"
  mkdir -p "$ROOT_DIR/.wrangler"

  for migration in "$ROOT_DIR"/migrations/*.sql; do
    migration_cmd=(
      "$WRANGLER_BIN"
      d1 execute minecraft-fps-db-prod
      --config wrangler.toml
      --local
      --persist-to "$PERSIST_DIR"
      --file="$migration"
    )
    if [[ -n "$WRANGLER_ENV" ]]; then
      migration_cmd+=(--env "$WRANGLER_ENV")
    fi
    "${migration_cmd[@]}" >/dev/null
  done

  worker_cmd=(
    "$WRANGLER_BIN"
    dev cloudflare/worker.js
    --config wrangler.toml
    --port "$WORKER_PROXY_PORT"
    --local
    --persist-to "$PERSIST_DIR"
  )
  if [[ -n "$WRANGLER_ENV" ]]; then
    worker_cmd+=(--env "$WRANGLER_ENV")
  fi

  "${worker_cmd[@]}" >/dev/null 2>&1 &
  worker_pid=$!

  for _ in $(seq 1 120); do
    if curl -s "http://127.0.0.1:${WORKER_PROXY_PORT}/api/me" >/dev/null 2>&1; then
      break
    fi
    if ! kill -0 "${worker_pid}" 2>/dev/null; then
      echo "Local worker exited before becoming ready." >&2
      exit 1
    fi
    sleep 0.5
  done

  if ! curl -s "http://127.0.0.1:${WORKER_PROXY_PORT}/api/me" >/dev/null 2>&1; then
    echo "Timed out waiting for local worker on 127.0.0.1:${WORKER_PROXY_PORT}" >&2
    exit 1
  fi
else
  if [[ "$REUSE_EXISTING_WORKER" != "1" ]]; then
    echo "Port ${WORKER_PROXY_PORT} is already in use. Stop the existing worker or set REUSE_EXISTING_WORKER=1." >&2
    exit 1
  fi
fi

exec env WORKER_PROXY_PORT="${WORKER_PROXY_PORT}" "$VITE_BIN" --host 127.0.0.1 --port "${FRONTEND_PORT}"
