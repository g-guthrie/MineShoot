#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if ! command -v npx >/dev/null 2>&1; then
  echo "npx is required (Node.js + npm)." >&2
  exit 1
fi

echo "[ground-truth] starting Cloudflare Worker local authority stack..."
./scripts/sync-public-assets.sh
exec npx wrangler dev --env local --persist-to .wrangler/state/local
