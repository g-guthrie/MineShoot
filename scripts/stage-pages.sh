#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

OUTPUT_DIR="${1:-$ROOT_DIR/.cf-stage-current}"
BUILD_DIR="${BUILD_DIR:-$ROOT_DIR/dist}"

rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

npm run build

cp -R "$BUILD_DIR"/. "$OUTPUT_DIR"/

if [[ -d "$ROOT_DIR/assets" ]]; then
  mkdir -p "$OUTPUT_DIR/assets"
  cp -R "$ROOT_DIR/assets"/. "$OUTPUT_DIR/assets"/
fi
