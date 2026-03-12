/**
 * intersection-builder.js - Grid seam and junction builders for the authored biome map.
 * Keeps separator logic separate from cell-local biome modules.
 */

const THREE = globalThis.THREE;

export var edgeKits = {};
export var junctionBuilders = {};

function lerp(a, b, t) {
  return a + ((b - a) * t);
}

export function createSeamSpec(overrides) {
  var spec = overrides || {};
  var armWidth = Number(spec.armWidth);
  var height = Number(spec.height);
  var tintMix = Number(spec.tintMix);
  var tintThreshold = Number(spec.tintThreshold);
  if (!(armWidth > 0)) armWidth = 0.36;
  if (!(height > 0)) height = 0.08;
  if (!(tintMix >= 0)) tintMix = 0.12;
  if (!(tintThreshold > 0)) tintThreshold = 0.22;
  return {
    armWidth: armWidth,
    halfWidth: armWidth * 0.5,
    height: height,
    tintMix: tintMix,
    tintThreshold: tintThreshold
  };
}

function getCellEntry(biomeMap, row, col) {
  if (!Array.isArray(biomeMap)) return null;
  for (var i = 0; i < biomeMap.length; i++) {
    var entry = biomeMap[i];
    if (!entry) continue;
    if (Number(entry.row) === row && Number(entry.col) === col) return entry;
  }
  return null;
}

function pointOnEdge(bounds, edge, progress, inset) {
  var t = Math.max(0, Math.min(1, Number(progress || 0)));
  var edgeInset = Number(inset || 0);
  if (edge === 'east') {
    return { x: bounds.maxX - edgeInset, z: lerp(bounds.minZ, bounds.maxZ, t) };
  }
  if (edge === 'west') {
    return { x: bounds.minX + edgeInset, z: lerp(bounds.minZ, bounds.maxZ, t) };
  }
  if (edge === 'north') {
    return { x: lerp(bounds.minX, bounds.maxX, t), z: bounds.minZ + edgeInset };
  }
  return { x: lerp(bounds.minX, bounds.maxX, t), z: bounds.maxZ - edgeInset };
}

function seamAxis(edge) {
  return (edge === 'east' || edge === 'west') ? 'vertical' : 'horizontal';
}

function buildPalette(materialLibrary, biomeId) {
  var matLib = materialLibrary;
  if (biomeId === 'arctic') {
    return {
      base: matLib.getLambert({ color: 0xd7edf8 }),
      accent: matLib.getLambert({ color: 0xa8dff5, transparent: true, opacity: 0.8 }),
      detail: matLib.getLambert({ color: 0x7cbad6 })
    };
  }
  if (biomeId === 'desert') {
    return {
      base: matLib.getLambert({ color: 0xc79a5a }),
      accent: matLib.getLambert({ color: 0xb97842 }),
      detail: matLib.getLambert({ color: 0x8d6b4d })
    };
  }
  if (biomeId === 'jungle') {
    return {
      base: matLib.getLambert({ color: 0x4a5742 }),
      accent: matLib.getLambert({ color: 0x2f6a30 }),
      detail: matLib.getLambert({ color: 0x1f4a1f })
    };
  }
  if (biomeId === 'nuclear') {
    return {
      base: matLib.getLambert({ color: 0x6d747b }),
      accent: matLib.getLambert({ color: 0xd7b03c }),
      detail: matLib.getLambert({ color: 0x49525a })
    };
  }
  if (biomeId === 'citadel') {
    return {
      base: matLib.getLambert({ color: 0x74706a }),
      accent: matLib.getLambert({ color: 0x999289 }),
      detail: matLib.getLambert({ color: 0x4a463f })
    };
  }
  if (biomeId === 'quarry') {
    return {
      base: matLib.getLambert({ color: 0x806c5e }),
      accent: matLib.getLambert({ color: 0xbaa18b }),
      detail: matLib.getLambert({ color: 0x5c4a3e })
    };
  }
  if (biomeId === 'basin') {
    return {
      base: matLib.getLambert({ color: 0x65737a }),
      accent: matLib.getLambert({ color: 0x67a8ba }),
      detail: matLib.getLambert({ color: 0x385d68 })
    };
  }
  if (biomeId === 'radar') {
    return {
      base: matLib.getLambert({ color: 0x8e958d }),
      accent: matLib.getLambert({ color: 0xc6d4d0 }),
      detail: matLib.getLambert({ color: 0x4c5860 })
    };
  }
  return {
    base: matLib.getLambert({ color: 0x727980 }),
    accent: matLib.getLambert({ color: 0x8a939a }),
    detail: matLib.getLambert({ color: 0x44505a })
  };
}

function addStrip(ctx, center, width, height, depth, material, solid) {
  ctx.place.addBlock(center.x, height * 0.5, center.z, width, height, depth, material, solid === true);
}

function buildArcticEdge(ctx) {
  var p0 = pointOnEdge(ctx.bounds, ctx.edge, 0.22, 0.8);
  var p1 = pointOnEdge(ctx.bounds, ctx.edge, 0.5, 0.65);
  var p2 = pointOnEdge(ctx.bounds, ctx.edge, 0.78, 0.8);
  ctx.place.addBlock(p0.x, 0.38, p0.z, 0.95, 0.76, 0.85, ctx.palette.base, false);
  ctx.place.addBlock(p1.x, 0.55, p1.z, 1.2, 1.1, 0.95, ctx.palette.accent, false);
  ctx.place.addBlock(p2.x, 0.34, p2.z, 0.85, 0.68, 0.78, ctx.palette.base, false);
}

function buildUrbanEdge(ctx) {
  if (seamAxis(ctx.edge) === 'vertical') {
    addStrip(ctx, pointOnEdge(ctx.bounds, ctx.edge, 0.5, 0.45), 0.55, 0.26, (ctx.bounds.maxZ - ctx.bounds.minZ) * 0.66, ctx.palette.base, false);
    ctx.place.addBlock(pointOnEdge(ctx.bounds, ctx.edge, 0.2, 0.9).x, 0.7, pointOnEdge(ctx.bounds, ctx.edge, 0.2, 0.9).z, 0.22, 1.4, 0.22, ctx.palette.detail, false);
    ctx.place.addBlock(pointOnEdge(ctx.bounds, ctx.edge, 0.8, 0.9).x, 0.7, pointOnEdge(ctx.bounds, ctx.edge, 0.8, 0.9).z, 0.22, 1.4, 0.22, ctx.palette.detail, false);
  } else {
    addStrip(ctx, pointOnEdge(ctx.bounds, ctx.edge, 0.5, 0.45), (ctx.bounds.maxX - ctx.bounds.minX) * 0.66, 0.26, 0.55, ctx.palette.base, false);
    ctx.place.addBlock(pointOnEdge(ctx.bounds, ctx.edge, 0.2, 0.9).x, 0.7, pointOnEdge(ctx.bounds, ctx.edge, 0.2, 0.9).z, 0.22, 1.4, 0.22, ctx.palette.detail, false);
    ctx.place.addBlock(pointOnEdge(ctx.bounds, ctx.edge, 0.8, 0.9).x, 0.7, pointOnEdge(ctx.bounds, ctx.edge, 0.8, 0.9).z, 0.22, 1.4, 0.22, ctx.palette.detail, false);
  }
  ctx.place.addBlock(pointOnEdge(ctx.bounds, ctx.edge, 0.5, 0.45).x, 0.14, pointOnEdge(ctx.bounds, ctx.edge, 0.5, 0.45).z, seamAxis(ctx.edge) === 'vertical' ? 0.08 : 4.8, 0.08, seamAxis(ctx.edge) === 'vertical' ? 4.8 : 0.08, ctx.palette.accent, false);
}

function buildDesertEdge(ctx) {
  if (seamAxis(ctx.edge) === 'vertical') {
    addStrip(ctx, pointOnEdge(ctx.bounds, ctx.edge, 0.5, 0.75), 1.25, 0.28, (ctx.bounds.maxZ - ctx.bounds.minZ) * 0.74, ctx.palette.base, false);
  } else {
    addStrip(ctx, pointOnEdge(ctx.bounds, ctx.edge, 0.5, 0.75), (ctx.bounds.maxX - ctx.bounds.minX) * 0.74, 0.28, 1.25, ctx.palette.base, false);
  }
  ctx.place.addBlock(pointOnEdge(ctx.bounds, ctx.edge, 0.3, 0.95).x, 0.22, pointOnEdge(ctx.bounds, ctx.edge, 0.3, 0.95).z, 0.5, 0.44, 0.42, ctx.palette.detail, false);
  ctx.place.addBlock(pointOnEdge(ctx.bounds, ctx.edge, 0.7, 1.0).x, 0.18, pointOnEdge(ctx.bounds, ctx.edge, 0.7, 1.0).z, 0.42, 0.36, 0.36, ctx.palette.detail, false);
}

function buildJungleEdge(ctx) {
  if (seamAxis(ctx.edge) === 'vertical') {
    addStrip(ctx, pointOnEdge(ctx.bounds, ctx.edge, 0.5, 0.72), 0.92, 0.18, (ctx.bounds.maxZ - ctx.bounds.minZ) * 0.7, ctx.palette.base, false);
  } else {
    addStrip(ctx, pointOnEdge(ctx.bounds, ctx.edge, 0.5, 0.72), (ctx.bounds.maxX - ctx.bounds.minX) * 0.7, 0.18, 0.92, ctx.palette.base, false);
  }
  var vineA = pointOnEdge(ctx.bounds, ctx.edge, 0.28, 1.05);
  var vineB = pointOnEdge(ctx.bounds, ctx.edge, 0.74, 1.05);
  ctx.place.addBlock(vineA.x, 0.8, vineA.z, 0.18, 1.6, 0.18, ctx.palette.accent, false);
  ctx.place.addBlock(vineB.x, 0.58, vineB.z, 0.16, 1.16, 0.16, ctx.palette.accent, false);
}

function buildNuclearEdge(ctx) {
  if (seamAxis(ctx.edge) === 'vertical') {
    addStrip(ctx, pointOnEdge(ctx.bounds, ctx.edge, 0.5, 0.48), 0.7, 0.32, (ctx.bounds.maxZ - ctx.bounds.minZ) * 0.72, ctx.palette.base, false);
    ctx.place.addBlock(pointOnEdge(ctx.bounds, ctx.edge, 0.5, 0.48).x, 0.16, pointOnEdge(ctx.bounds, ctx.edge, 0.5, 0.48).z, 0.12, 0.12, (ctx.bounds.maxZ - ctx.bounds.minZ) * 0.64, ctx.palette.accent, false);
  } else {
    addStrip(ctx, pointOnEdge(ctx.bounds, ctx.edge, 0.5, 0.48), (ctx.bounds.maxX - ctx.bounds.minX) * 0.72, 0.32, 0.7, ctx.palette.base, false);
    ctx.place.addBlock(pointOnEdge(ctx.bounds, ctx.edge, 0.5, 0.48).x, 0.16, pointOnEdge(ctx.bounds, ctx.edge, 0.5, 0.48).z, (ctx.bounds.maxX - ctx.bounds.minX) * 0.64, 0.12, 0.12, ctx.palette.accent, false);
  }
  var postA = pointOnEdge(ctx.bounds, ctx.edge, 0.18, 0.82);
  var postB = pointOnEdge(ctx.bounds, ctx.edge, 0.82, 0.82);
  ctx.place.addBlock(postA.x, 0.78, postA.z, 0.24, 1.56, 0.24, ctx.palette.detail, false);
  ctx.place.addBlock(postB.x, 0.78, postB.z, 0.24, 1.56, 0.24, ctx.palette.detail, false);
}

function buildCitadelEdge(ctx) {
  if (seamAxis(ctx.edge) === 'vertical') {
    addStrip(ctx, pointOnEdge(ctx.bounds, ctx.edge, 0.5, 0.55), 1.1, 0.44, (ctx.bounds.maxZ - ctx.bounds.minZ) * 0.62, ctx.palette.base, false);
  } else {
    addStrip(ctx, pointOnEdge(ctx.bounds, ctx.edge, 0.5, 0.55), (ctx.bounds.maxX - ctx.bounds.minX) * 0.62, 0.44, 1.1, ctx.palette.base, false);
  }
  var crenelA = pointOnEdge(ctx.bounds, ctx.edge, 0.32, 0.88);
  var crenelB = pointOnEdge(ctx.bounds, ctx.edge, 0.68, 0.88);
  ctx.place.addBlock(crenelA.x, 0.84, crenelA.z, 0.8, 0.72, 0.8, ctx.palette.accent, false);
  ctx.place.addBlock(crenelB.x, 0.84, crenelB.z, 0.8, 0.72, 0.8, ctx.palette.accent, false);
}

function buildQuarryEdge(ctx) {
  if (seamAxis(ctx.edge) === 'vertical') {
    addStrip(ctx, pointOnEdge(ctx.bounds, ctx.edge, 0.5, 0.72), 1.45, 0.36, (ctx.bounds.maxZ - ctx.bounds.minZ) * 0.72, ctx.palette.base, false);
  } else {
    addStrip(ctx, pointOnEdge(ctx.bounds, ctx.edge, 0.5, 0.72), (ctx.bounds.maxX - ctx.bounds.minX) * 0.72, 0.36, 1.45, ctx.palette.base, false);
  }
  ctx.place.addBlock(pointOnEdge(ctx.bounds, ctx.edge, 0.24, 1.0).x, 0.3, pointOnEdge(ctx.bounds, ctx.edge, 0.24, 1.0).z, 0.62, 0.6, 0.54, ctx.palette.detail, false);
  ctx.place.addBlock(pointOnEdge(ctx.bounds, ctx.edge, 0.74, 0.96).x, 0.42, pointOnEdge(ctx.bounds, ctx.edge, 0.74, 0.96).z, 0.9, 0.84, 0.72, ctx.palette.accent, false);
}

function buildBasinEdge(ctx) {
  if (seamAxis(ctx.edge) === 'vertical') {
    addStrip(ctx, pointOnEdge(ctx.bounds, ctx.edge, 0.5, 0.6), 0.9, 0.24, (ctx.bounds.maxZ - ctx.bounds.minZ) * 0.76, ctx.palette.base, false);
    ctx.place.addBlock(pointOnEdge(ctx.bounds, ctx.edge, 0.5, 0.6).x, 0.08, pointOnEdge(ctx.bounds, ctx.edge, 0.5, 0.6).z, 0.5, 0.08, (ctx.bounds.maxZ - ctx.bounds.minZ) * 0.62, ctx.palette.accent, false);
  } else {
    addStrip(ctx, pointOnEdge(ctx.bounds, ctx.edge, 0.5, 0.6), (ctx.bounds.maxX - ctx.bounds.minX) * 0.76, 0.24, 0.9, ctx.palette.base, false);
    ctx.place.addBlock(pointOnEdge(ctx.bounds, ctx.edge, 0.5, 0.6).x, 0.08, pointOnEdge(ctx.bounds, ctx.edge, 0.5, 0.6).z, (ctx.bounds.maxX - ctx.bounds.minX) * 0.62, 0.08, 0.5, ctx.palette.accent, false);
  }
}

function buildRadarEdge(ctx) {
  if (seamAxis(ctx.edge) === 'vertical') {
    addStrip(ctx, pointOnEdge(ctx.bounds, ctx.edge, 0.5, 0.55), 0.92, 0.22, (ctx.bounds.maxZ - ctx.bounds.minZ) * 0.72, ctx.palette.base, false);
    ctx.place.addBlock(pointOnEdge(ctx.bounds, ctx.edge, 0.5, 0.55).x, 0.14, pointOnEdge(ctx.bounds, ctx.edge, 0.5, 0.55).z, 0.12, 0.12, (ctx.bounds.maxZ - ctx.bounds.minZ) * 0.6, ctx.palette.accent, false);
  } else {
    addStrip(ctx, pointOnEdge(ctx.bounds, ctx.edge, 0.5, 0.55), (ctx.bounds.maxX - ctx.bounds.minX) * 0.72, 0.22, 0.92, ctx.palette.base, false);
    ctx.place.addBlock(pointOnEdge(ctx.bounds, ctx.edge, 0.5, 0.55).x, 0.14, pointOnEdge(ctx.bounds, ctx.edge, 0.5, 0.55).z, (ctx.bounds.maxX - ctx.bounds.minX) * 0.6, 0.12, 0.12, ctx.palette.accent, false);
  }
}

function defaultBiomeEdgeKit(ctx) {
  if (!ctx) return;
  var center = pointOnEdge(ctx.bounds, ctx.edge, 0.5, 0.6);
  if (seamAxis(ctx.edge) === 'vertical') {
    addStrip(ctx, center, 0.9, 0.18, (ctx.bounds.maxZ - ctx.bounds.minZ) * 0.72, ctx.palette.base, false);
  } else {
    addStrip(ctx, center, (ctx.bounds.maxX - ctx.bounds.minX) * 0.72, 0.18, 0.9, ctx.palette.base, false);
  }
}

function buildHybridPylon(ctx) {
  var place = ctx.place;
  var matLib = ctx.materialLibrary;
  var seamSpec = ctx.seamSpec;
  var centerX = ctx.centerX;
  var centerZ = ctx.centerZ;
  var baseMat = matLib.getLambert({ color: 0x5f665e });
  var accentMat = matLib.getLambert({ color: 0x98ada1 });

  place.addBlock(centerX, 0.55, centerZ, seamSpec.armWidth * 2.5, 1.1, seamSpec.armWidth * 2.5, baseMat, true);
  place.addBlock(centerX, 1.35, centerZ, seamSpec.armWidth * 1.6, 0.5, seamSpec.armWidth * 1.6, accentMat, false);
  place.addBlock(centerX, 2.05, centerZ, seamSpec.armWidth * 0.78, 0.9, seamSpec.armWidth * 0.78, accentMat, true);
  if (ctx.fx && typeof ctx.fx.addFlicker === 'function') {
    var beacon = place.addBlock(centerX, 2.68, centerZ, seamSpec.armWidth * 0.32, 0.18, seamSpec.armWidth * 0.32, new THREE.MeshStandardMaterial({
      color: 0xbfd7d2,
      emissive: 0xbfd7d2,
      emissiveIntensity: 0.62
    }), false);
    ctx.fx.addFlicker({ material: beacon.material, freq: 2.6, phase: (centerX + centerZ) * 0.01 });
  }
  return {
    centerX: centerX,
    centerZ: centerZ,
    beacon: true
  };
}

export function buildGridDecor(ctx) {
  if (!ctx || !ctx.place || !ctx.materialLibrary || !ctx.layout) return null;
  var place = ctx.place;
  var matLib = ctx.materialLibrary;
  var layout = ctx.layout;
  var biomeMap = Array.isArray(ctx.biomeMap) ? ctx.biomeMap : [];
  var seamSpec = createSeamSpec(ctx.seamSpec);
  var seamMaterial = ctx.seamMaterial || matLib.getLambert({ color: 0x58605d });
  var junctionBuilder = typeof ctx.junctionBuilder === 'function'
    ? ctx.junctionBuilder
    : junctionBuilders.hybrid_pylon;

  var seamLinesX = Array.isArray(layout.BIOME_GRID_LINE_X) ? layout.BIOME_GRID_LINE_X.slice() : [];
  var seamLinesZ = Array.isArray(layout.BIOME_GRID_LINE_Z) ? layout.BIOME_GRID_LINE_Z.slice() : [];
  var gridCols = Number(layout.BIOME_GRID_COLS || 0);
  var gridRows = Number(layout.BIOME_GRID_ROWS || 0);
  var worldMin = Number(layout.WORLD_MIN || 0);
  var worldMax = Number(layout.WORLD_MAX || 0);

  for (var sx = 0; sx < seamLinesX.length; sx++) {
    var x = seamLinesX[sx];
    place.addBlock(x, seamSpec.height * 0.5, (worldMin + worldMax) * 0.5, seamSpec.armWidth, seamSpec.height, worldMax - worldMin, seamMaterial, false);
    for (var row = 0; row < gridRows; row++) {
      var westEntry = getCellEntry(biomeMap, row, sx);
      var eastEntry = getCellEntry(biomeMap, row, sx + 1);
      var bounds = layout.quadrantBounds({ row: row, col: sx }, 0);
      bounds.maxX = x;
      if (westEntry && edgeKits[westEntry.biome]) {
        edgeKits[westEntry.biome]({
          place: place,
          bounds: bounds,
          edge: 'east',
          seamSpec: seamSpec,
          materialLibrary: matLib,
          fx: ctx.fx || null,
          palette: buildPalette(matLib, westEntry.biome)
        });
      }
      bounds = layout.quadrantBounds({ row: row, col: sx + 1 }, 0);
      bounds.minX = x;
      if (eastEntry && edgeKits[eastEntry.biome]) {
        edgeKits[eastEntry.biome]({
          place: place,
          bounds: bounds,
          edge: 'west',
          seamSpec: seamSpec,
          materialLibrary: matLib,
          fx: ctx.fx || null,
          palette: buildPalette(matLib, eastEntry.biome)
        });
      }
    }
  }

  for (var sz = 0; sz < seamLinesZ.length; sz++) {
    var z = seamLinesZ[sz];
    place.addBlock((worldMin + worldMax) * 0.5, seamSpec.height * 0.5, z, worldMax - worldMin, seamSpec.height, seamSpec.armWidth, seamMaterial, false);
    for (var col = 0; col < gridCols; col++) {
      var northEntry = getCellEntry(biomeMap, sz, col);
      var southEntry = getCellEntry(biomeMap, sz + 1, col);
      var northBounds = layout.quadrantBounds({ row: sz, col: col }, 0);
      northBounds.maxZ = z;
      if (northEntry) {
        var northEdgeCtx = {
          place: place,
          bounds: northBounds,
          edge: 'south',
          seamSpec: seamSpec,
          materialLibrary: matLib,
          fx: ctx.fx || null,
          palette: buildPalette(matLib, northEntry.biome)
        };
        (edgeKits[northEntry.biome] || edgeKits.default)(northEdgeCtx);
      }
      var southBounds = layout.quadrantBounds({ row: sz + 1, col: col }, 0);
      southBounds.minZ = z;
      if (southEntry) {
        var southEdgeCtx = {
          place: place,
          bounds: southBounds,
          edge: 'north',
          seamSpec: seamSpec,
          materialLibrary: matLib,
          fx: ctx.fx || null,
          palette: buildPalette(matLib, southEntry.biome)
        };
        (edgeKits[southEntry.biome] || edgeKits.default)(southEdgeCtx);
      }
    }
  }

  for (var jx = 0; jx < seamLinesX.length; jx++) {
    for (var jz = 0; jz < seamLinesZ.length; jz++) {
      junctionBuilder({
        centerX: seamLinesX[jx],
        centerZ: seamLinesZ[jz],
        seamSpec: seamSpec,
        place: place,
        materialLibrary: matLib,
        fx: ctx.fx || null,
        neighbors: {
          nw: getCellEntry(biomeMap, jz, jx),
          ne: getCellEntry(biomeMap, jz, jx + 1),
          sw: getCellEntry(biomeMap, jz + 1, jx),
          se: getCellEntry(biomeMap, jz + 1, jx + 1)
        }
      });
    }
  }

  return {
    seamSpec: seamSpec,
    seamCount: (seamLinesX.length * gridRows) + (seamLinesZ.length * gridCols),
    junctionCount: seamLinesX.length * seamLinesZ.length,
    worldMin: worldMin,
    worldMax: worldMax
  };
}

export function stampIntersection(ctx) {
  if (!ctx || !ctx.place || !ctx.materialLibrary) return null;
  var seamSpec = createSeamSpec(ctx.seamSpec);
  var seamMaterial = ctx.seamMaterial || ctx.materialLibrary.getLambert({ color: 0x58605d });
  ctx.place.addBlock(ctx.centerX, seamSpec.height * 0.5, ctx.centerZ, seamSpec.armWidth, seamSpec.height, Number(ctx.span || 0), seamMaterial, false);
  ctx.place.addBlock(ctx.centerX, seamSpec.height * 0.5, ctx.centerZ, Number(ctx.span || 0), seamSpec.height, seamSpec.armWidth, seamMaterial, false);
  var builder = ctx.builder;
  if (typeof builder !== 'function') builder = buildHybridPylon;
  return builder({
    centerX: ctx.centerX,
    centerZ: ctx.centerZ,
    seamSpec: seamSpec,
    place: ctx.place,
    materialLibrary: ctx.materialLibrary,
    fx: ctx.fx || null,
    neighbors: ctx.neighbors || null
  });
}

export function registerEdgeKit(biomeId, builder) {
  if (!biomeId || typeof builder !== 'function') return;
  edgeKits[String(biomeId)] = builder;
}

export function registerJunctionBuilder(builderId, builder) {
  if (!builderId || typeof builder !== 'function') return;
  junctionBuilders[String(builderId)] = builder;
}

edgeKits.default = defaultBiomeEdgeKit;
registerEdgeKit('arctic', buildArcticEdge);
registerEdgeKit('urban', buildUrbanEdge);
registerEdgeKit('desert', buildDesertEdge);
registerEdgeKit('jungle', buildJungleEdge);
registerEdgeKit('nuclear', buildNuclearEdge);
registerEdgeKit('citadel', buildCitadelEdge);
registerEdgeKit('quarry', buildQuarryEdge);
registerEdgeKit('basin', buildBasinEdge);
registerEdgeKit('radar', buildRadarEdge);
registerJunctionBuilder('hybrid_pylon', buildHybridPylon);
