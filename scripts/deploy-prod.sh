#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PAGES_PROJECT="${CF_PAGES_PROJECT:-mayhem}"
PAGES_BRANCH="${CF_PAGES_BRANCH:-main}"
PAGES_DIR="${CF_PAGES_DIR:-dist}"
DEPLOY_MESSAGE="${DEPLOY_MESSAGE:-}"
SKIP_BUILD=0

usage() {
  cat <<'EOF'
Usage:
  ./scripts/deploy-prod.sh [--skip-build] [--message "Deploy message"]
  npm run deploy:prod -- [--skip-build] [--message "Deploy message"]

Options:
  --skip-build         Skip `npm run build` before deploying.
  --message <text>     Custom message attached to the Pages deployment.
  -h, --help           Show this help text.

Environment overrides:
  CF_PAGES_PROJECT     Pages project name. Default: mayhem
  CF_PAGES_BRANCH      Pages branch target. Default: main
  CF_PAGES_DIR         Built Pages asset directory. Default: dist
  DEPLOY_MESSAGE       Default deploy message when --message is not provided.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-build)
      SKIP_BUILD=1
      shift
      ;;
    --message)
      if [[ $# -lt 2 ]]; then
        echo "[FAIL] --message requires a value." >&2
        exit 1
      fi
      DEPLOY_MESSAGE="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "[FAIL] Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ -z "$DEPLOY_MESSAGE" ]]; then
  DEPLOY_MESSAGE="Manual workspace deploy"
fi

if [[ "$SKIP_BUILD" -eq 0 ]]; then
  echo "[INFO] Building frontend..."
  npm run build
else
  echo "[INFO] Skipping build."
fi

echo
echo "[INFO] Deploying Worker..."
"$ROOT_DIR/scripts/wrangler.sh" deploy

echo
echo "[INFO] Deploying Pages..."
"$ROOT_DIR/scripts/wrangler.sh" pages deploy "$PAGES_DIR" \
  --project-name "$PAGES_PROJECT" \
  --branch "$PAGES_BRANCH" \
  --commit-dirty=true \
  --commit-message "$DEPLOY_MESSAGE"
