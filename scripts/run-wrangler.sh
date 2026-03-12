#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

WRANGLER_NODE_BIN="${WRANGLER_NODE_BIN:-$HOME/.nvm/versions/node/v20.20.0/bin}"

if [[ -x "${WRANGLER_NODE_BIN}/node" ]]; then
  export PATH="${WRANGLER_NODE_BIN}:$PATH"
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required to run Wrangler."
  exit 1
fi

NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]" 2>/dev/null || echo 0)"
if [[ "${NODE_MAJOR}" -lt 20 ]]; then
  echo "Wrangler requires Node 20+."
  echo "Install/select Node 20 or set WRANGLER_NODE_BIN to a Node 20 bin directory."
  exit 1
fi

exec npx wrangler "$@"
