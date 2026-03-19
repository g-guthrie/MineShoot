#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

WRANGLER_VERSION="${WRANGLER_VERSION:-}"
if [[ -z "$WRANGLER_VERSION" ]]; then
  WRANGLER_VERSION="$(node -p "const pkg=require('./package.json'); (pkg.devDependencies&&pkg.devDependencies.wrangler)||(pkg.dependencies&&pkg.dependencies.wrangler)||'latest'")"
fi
WRANGLER_VERSION="${WRANGLER_VERSION#^}"

exec npx -p node@20 -p "wrangler@${WRANGLER_VERSION}" sh -lc 'wrangler "$@"' sh "$@"
