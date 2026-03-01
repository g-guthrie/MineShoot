#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

rm -rf public
mkdir -p public

cp index.html public/index.html
rsync -a --delete js/ public/js/
rsync -a --delete shared/ public/shared/

if [[ -d dist ]]; then
  rsync -a --delete dist/ public/dist/
fi

echo "[assets] synced runtime files to ./public"
