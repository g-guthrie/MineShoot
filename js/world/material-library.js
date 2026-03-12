/**
 * material-library.js - Shared material cache for cross-biome deduplication.
 */

const THREE = globalThis.THREE;

var lambertCache = {};
var basicCache = {};
var requested = 0;
var created = 0;

function makeKey(opts) {
  var parts = [
    (opts.color !== undefined) ? opts.color : '_',
    opts.transparent ? 1 : 0,
    (opts.opacity !== undefined) ? opts.opacity : '_',
    (opts.emissive !== undefined) ? opts.emissive : '_',
    (opts.emissiveIntensity !== undefined) ? opts.emissiveIntensity : '_',
    opts.side !== undefined ? opts.side : '_',
    opts.vertexColors ? 1 : 0
  ];
  return parts.join('|');
}

function getLambert(opts) {
  requested++;
  var key = makeKey(opts);
  if (lambertCache[key]) return lambertCache[key];
  created++;
  var mat = new THREE.MeshLambertMaterial(opts);
  lambertCache[key] = mat;
  return mat;
}

function getBasic(opts) {
  requested++;
  var key = makeKey(opts);
  if (basicCache[key]) return basicCache[key];
  created++;
  var mat = new THREE.MeshBasicMaterial(opts);
  basicCache[key] = mat;
  return mat;
}

function getStats() {
  return { requested: requested, created: created, saved: requested - created };
}

export const GameMaterialLibrary = {
  getLambert: getLambert,
  getBasic: getBasic,
  getStats: getStats
};
