#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

usage() {
  cat <<'EOF'
Usage:
  ./scripts/blender-export.sh <blend-file> <output-file> [options]

Options:
  --object <name>         Export one object by name
  --collection <name>     Export one collection by name
  --format <auto|binary|separate>
  --materials <export|placeholder|viewport|none>
  --animations            Include animations
  --apply-modifiers       Apply export-time modifiers

Examples:
  ./scripts/blender-export.sh ~/Downloads/pistol.blend public/assets/models/weapons/pistol.gltf --collection Weapon
  ./scripts/blender-export.sh ~/Downloads/rifle.blend public/assets/models/weapons/rifle.glb --object Rifle --format binary
EOF
}

if [[ $# -lt 2 ]]; then
  usage
  exit 1
fi

BLEND_FILE="$1"
OUTPUT_FILE="$2"
shift 2

if [[ ! -f "$BLEND_FILE" ]]; then
  echo "Blend file not found: $BLEND_FILE" >&2
  exit 1
fi

if command -v Blender >/dev/null 2>&1; then
  BLENDER_BIN="$(command -v Blender)"
elif [[ -x "/Applications/Blender.app/Contents/MacOS/Blender" ]]; then
  BLENDER_BIN="/Applications/Blender.app/Contents/MacOS/Blender"
else
  echo "Blender executable not found on PATH or in /Applications." >&2
  exit 1
fi

exec "$BLENDER_BIN" \
  --background \
  --factory-startup \
  "$BLEND_FILE" \
  --python "$ROOT_DIR/scripts/blender/export_gltf.py" \
  -- \
  --output "$OUTPUT_FILE" \
  "$@"
