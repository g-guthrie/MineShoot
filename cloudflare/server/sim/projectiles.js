export function integrateProjectileMotion(projectile, dtSec, applyGravity = true) {
  if (applyGravity) {
    projectile.vy -= Number(projectile.gravity || 0) * dtSec;
  }
  projectile.x += projectile.vx * dtSec;
  projectile.y += projectile.vy * dtSec;
  projectile.z += projectile.vz * dtSec;
}
