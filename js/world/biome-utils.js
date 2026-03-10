export function pointInBounds(bounds, u, v) {
  const uu = Math.max(0, Math.min(1, Number(u || 0)));
  const vv = Math.max(0, Math.min(1, Number(v || 0)));
  return {
    x: bounds.minX + ((bounds.maxX - bounds.minX) * uu),
    z: bounds.minZ + ((bounds.maxZ - bounds.minZ) * vv)
  };
}

export function cloneMaterial(material) {
  return (material && typeof material.clone === 'function') ? material.clone() : material;
}
