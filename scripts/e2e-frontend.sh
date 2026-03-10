#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

for _ in $(seq 1 120); do
  if curl -s "http://127.0.0.1:8791/" >/dev/null 2>&1; then
    exec env WORKER_PROXY_PORT=8791 vite --host 127.0.0.1 --port 4173
  fi
  sleep 0.5
done

echo "Timed out waiting for local worker on 127.0.0.1:8791" >&2
exit 1
