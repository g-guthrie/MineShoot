#!/usr/bin/env bash
# THE world pipeline. Every artifact derived from the world regenerates
# here, in dependency order — running steps individually is how spawn
# points ended up inside the nuclear cooling tower after decor went solid.
#
#   bash tools/rebuild-world.sh
#
# After it finishes, restart the game server (boot re-optimizes the model
# by checksum) and hard-refresh clients.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "== 1/4 export world mesh + colliders (taste passes included)"
node tools/export-boxman-glb.mjs

echo "== 2/4 regenerate spawn points against the new colliders"
node tools/generate-spawns.mjs

echo "== 3/4 drop stale optimized-model caches (boot rebuilds by checksum)"
rm -rf assets/models/environment/.optimized/boxman-world \
       ../zombies-game/assets/models/environment/.optimized/boxman-world

echo "== 4/4 sync the zombies world copy"
cp assets/models/environment/boxman-world.glb ../zombies-game/assets/models/environment/
cp assets/maps/boxman-world.colliders.json ../zombies-game/assets/maps/

echo "world rebuilt: mesh, colliders, spawns, zombies copy."
echo "verify mirrors too: node tools/check-mirrors.mjs"
