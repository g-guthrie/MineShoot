#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

rm -rf "$ROOT_DIR/.wrangler/state" "$ROOT_DIR/.wrangler/tmp"

for migration in "$ROOT_DIR"/migrations/*.sql; do
  "$ROOT_DIR/scripts/wrangler.sh" d1 execute minecraft-fps-db-prod --config wrangler.toml --local --file="$migration" >/dev/null
done

exec "$ROOT_DIR/scripts/wrangler.sh" dev cloudflare/worker.js --config wrangler.toml --port 8791 --local
