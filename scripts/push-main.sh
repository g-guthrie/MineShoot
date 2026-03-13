#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

branch="$(git branch --show-current)"
if [[ "$branch" != "main" ]]; then
  echo "[FAIL] push-main.sh only runs from main. Current branch: $branch"
  exit 1
fi

echo "[INFO] Pushing main to origin..."
git push origin main

echo
echo "[INFO] Watching Worker and Pages deploy status..."
"$ROOT_DIR/scripts/deploy-status.sh" --watch "$@"
