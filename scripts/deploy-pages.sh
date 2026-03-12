#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PAGES_PROJECT_NAME="${PAGES_PROJECT_NAME:-mayhem}"
PAGES_BRANCH="${PAGES_BRANCH:-main}"
PAGES_DIR="${PAGES_DIR:-$ROOT_DIR/.cf-stage-current}"
WORKER_CONFIG="$ROOT_DIR/wrangler.toml"
PAGES_CONFIG="$ROOT_DIR/wrangler.pages.toml"
CONFIG_BACKUP="$(mktemp "$ROOT_DIR/.wrangler.worker.backup.XXXXXX")"

cleanup() {
  if [[ -f "$CONFIG_BACKUP" ]]; then
    mv "$CONFIG_BACKUP" "$WORKER_CONFIG"
  fi
}

trap cleanup EXIT

"$ROOT_DIR/scripts/stage-pages.sh" "$PAGES_DIR"
"$ROOT_DIR/scripts/run-wrangler.sh" --version >/dev/null
cp "$WORKER_CONFIG" "$CONFIG_BACKUP"
cp "$PAGES_CONFIG" "$WORKER_CONFIG"
"$ROOT_DIR/scripts/run-wrangler.sh" pages deploy "$PAGES_DIR" \
  --project-name "$PAGES_PROJECT_NAME" \
  --branch "$PAGES_BRANCH" \
  --commit-dirty=true \
  "$@"
