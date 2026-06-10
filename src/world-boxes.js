/**
 * world-boxes.js - Static world collision boxes, taken from the meshes the
 * visual world build already produced (each solid mesh carries a Box3 in
 * userData.collisionBox). Shared by movement and hitscan so the expensive
 * world build only happens once.
 */
let cached = null;

export function getWorldBoxes() {
  if (!cached) {
    const GameWorld = globalThis.__MAYHEM_RUNTIME.GameWorld;
    cached = (GameWorld.getCollidables() || [])
      .map((mesh) => mesh.userData && mesh.userData.collisionBox)
      .filter(Boolean);
  }
  return cached;
}
