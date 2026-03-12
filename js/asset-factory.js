/**
 * asset-factory.js - Explicit registry for optional environment assets.
 * The current rifle slice can run with an empty registry.
 */

const scopedBuilders = new Map();

function scopeMap(scope) {
  const key = String(scope || '');
  if (!scopedBuilders.has(key)) {
    scopedBuilders.set(key, new Map());
  }
  return scopedBuilders.get(key);
}

export const GameAssetFactory = {
  register(scope, assetId, builder) {
    if (!assetId || typeof builder !== 'function') return false;
    scopeMap(scope).set(String(assetId), builder);
    return true;
  },
  create(scope, assetId, options) {
    const scoped = scopedBuilders.get(String(scope || ''));
    if (!scoped) return null;
    const builder = scoped.get(String(assetId || ''));
    if (typeof builder !== 'function') return null;
    return builder(options || {});
  },
  has(scope, assetId) {
    const scoped = scopedBuilders.get(String(scope || ''));
    return !!(scoped && scoped.has(String(assetId || '')));
  },
  clear(scope) {
    if (scope == null) {
      scopedBuilders.clear();
      return;
    }
    scopedBuilders.delete(String(scope));
  }
};
