export function pointInBounds(bounds, u, v) {
  const uu = Math.max(0, Math.min(1, Number(u || 0)));
  const vv = Math.max(0, Math.min(1, Number(v || 0)));
  return {
    x: bounds.minX + ((bounds.maxX - bounds.minX) * uu),
    z: bounds.minZ + ((bounds.maxZ - bounds.minZ) * vv)
  };
}

export function cloneMaterial(material) {
  if (!material || typeof material.clone !== 'function') return material;
  const clone = material.clone();
  // Clones are per-mesh, not part of the shared cache: they must be
  // disposable on world rebuild, so drop the shared-material marker.
  if (clone.userData) delete clone.userData.__mayhemSharedMaterial;
  return clone;
}
