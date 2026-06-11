#!/usr/bin/env bash
# One-command local dev for both game modes:
#   zombies server (https://127.0.0.1:8080, self-signed)
#   pvp server     (https://127.0.0.1:8082, self-signed)
#   proxy          (http/ws://127.0.0.1:8081 -> zombies, :8083 -> pvp)
#   client         (vite, http://localhost:5173)
# Ctrl-C stops everything.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLAY_URL="http://localhost:5173"

# Reclaim our dev ports from leftover instances of these same processes.
# Anything else holding a port is a real conflict, so bail instead.
reclaim_port() {
  local port=$1
  local pids
  pids=$(lsof -tnP -iTCP:"$port" -sTCP:LISTEN 2>/dev/null) || return 0
  for pid in $pids; do
    local cmd
    cmd=$(ps -o command= -p "$pid")
    if echo "$cmd" | grep -qE 'tsx[ /]|local-hytopia-proxy|vite'; then
      echo "Stopping leftover dev process on :$port (pid $pid)"
      kill "$pid" 2>/dev/null || true
    else
      echo "Port $port is held by another process (pid $pid): $cmd" >&2
      echo "Stop it first, then re-run." >&2
      exit 1
    fi
  done
  sleep 1
}

for port in 8080 8081 8082 8083 5173; do
  reclaim_port "$port"
done

pids=()
cleanup() {
  trap - INT TERM EXIT
  echo
  echo "Shutting down..."
  for pid in "${pids[@]}"; do kill "$pid" 2>/dev/null || true; done
  wait 2>/dev/null || true
}
trap cleanup INT TERM EXIT

echo "Starting zombies server on :8080..."
(cd "$ROOT/zombies-game" && npx tsx index.ts) &
pids+=($!)

echo "Starting pvp server on :8082..."
(cd "$ROOT/hytopia-game" && PORT=8082 npx tsx index.ts) &
pids+=($!)

echo "Starting proxy on :8081 (zombies) and :8083 (pvp)..."
node "$ROOT/scripts/local-hytopia-proxy.mjs" &
pids+=($!)

echo "Starting client on :5173..."
(cd "$ROOT/hytopia-client" && npx vite --port 5173 --strictPort) &
pids+=($!)

# Wait for the servers to come up (model preload takes a few seconds).
for _ in $(seq 1 90); do
  if curl -sk -o /dev/null https://127.0.0.1:8080 2>/dev/null \
     && curl -sk -o /dev/null https://127.0.0.1:8082 2>/dev/null; then break; fi
  sleep 1
done

echo
echo "==================================================="
echo "  Play at: $PLAY_URL  (mode selector)"
echo "  Direct:  $PLAY_URL/?join=127.0.0.1:8081  (zombies)"
echo "           $PLAY_URL/?join=127.0.0.1:8083  (pvp)"
echo "==================================================="
echo

wait
