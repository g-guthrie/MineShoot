#!/usr/bin/env bash
# Snapshot the upstream SDK npm packages this project depends on into
# vendor-cache/ (gitignored — do not commit; their licenses don't permit
# public redistribution). If a package is ever unpublished from npm, install
# from these tarballs instead:
#   npm install vendor-cache/hytopia-0.15.2.tgz
# Keep a copy of vendor-cache/ somewhere off this machine.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CACHE="$ROOT/vendor-cache"
mkdir -p "$CACHE"
cd "$CACHE"

PACKAGES=(
  "hytopia@0.15.2"
  "@hytopia.com/assets@0.4.11"
  "@hytopia.com/server-protocol@1.4.57"
)

for pkg in "${PACKAGES[@]}"; do
  echo "Packing $pkg..."
  npm pack "$pkg" --silent
done

echo
echo "Snapshot complete:"
ls -lh "$CACHE"
