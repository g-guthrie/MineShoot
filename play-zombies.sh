#!/usr/bin/env bash
# One-command local launcher for the zombies game: installs dependencies
# if missing, starts the game server (:8080) and the engine client
# (:5173), and prints the play instructions.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cleanup() {
  echo
  echo "Shutting down..."
  kill 0 2>/dev/null || true
}
trap cleanup EXIT

if [ ! -d "$ROOT_DIR/zombies-game/node_modules" ]; then
  echo "[setup] Installing game server dependencies..."
  (cd "$ROOT_DIR/zombies-game" && npm install)
fi

if [ ! -d "$ROOT_DIR/hytopia-client/node_modules" ]; then
  echo "[setup] Installing engine client dependencies..."
  (cd "$ROOT_DIR/hytopia-client" && npm install)
fi

echo "[run] Starting game server on :8080..."
(cd "$ROOT_DIR/zombies-game" && npm start) &

echo "[run] Starting engine client on :5173..."
(cd "$ROOT_DIR/hytopia-client" && npx vite --port 5173) &

sleep 3
cat <<'EOF'

============================================================
  ZOMBIES — local multiplayer
------------------------------------------------------------
  1. FIRST TIME ONLY: open https://127.0.0.1:8080 and accept
     the self-signed certificate (Advanced -> Proceed).
  2. Open http://localhost:5173 in Chrome.
  3. Leave the connect field BLANK and click OK.
  4. Second player: another tab, same steps.
     Join within the 45s countdown to spawn into the round.

  Ctrl+C here stops both servers.
============================================================
EOF

wait
