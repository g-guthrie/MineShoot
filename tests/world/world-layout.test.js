import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

import {
  createRotatedBoxAabb,
  createHeadlessRecorder,
  ensureHeadlessWorldRuntime
} from '../../shared/headless-world-runtime.js';
import {
  BIOME_ARCTIC,
  BIOME_WALL_STREET,
  BIOME_CITADEL,
  BIOME_DESERT,
  BIOME_GRID_COLS,
  BIOME_GRID_ROWS,
  BIOME_GRID_LINE_X,
  BIOME_GRID_LINE_Z,
  BIOME_JUNGLE,
  BIOME_NUCLEAR,
  BIOME_QUARRY,
  BIOME_RADAR,
  BIOME_URBAN,
  DEFAULT_QUADRANT_MAP,
  WORLD_SIZE,
  quadrantBounds,
  biomeAtPosition
} from '../../shared/world-layout.js';
import { buildWorldCollisionData } from '../../shared/world-collision.js';

const NUCLEAR_REACTOR_HEIGHT_SCALE = 1.25;
const NUCLEAR_STEAM_TILE_COUNT_PER_TOWER = 160;
const CITADEL_STEAM_TILE_COUNT = 56;

test('world layout expands to a 3x3 biome grid', () => {
  assert.equal(BIOME_GRID_COLS, 3);
  assert.equal(BIOME_GRID_ROWS, 3);
  assert.equal(DEFAULT_QUADRANT_MAP.length, 9);
  assert.deepEqual(
    DEFAULT_QUADRANT_MAP.map((entry) => entry.quadrant),
    ['r0c0', 'r0c1', 'r0c2', 'r1c0', 'r1c1', 'r1c2', 'r2c0', 'r2c1', 'r2c2']
  );
  assert.deepEqual(BIOME_GRID_LINE_X.map((value) => Math.round(value)), [56, 110]);
  assert.deepEqual(BIOME_GRID_LINE_Z.map((value) => Math.round(value)), [56, 110]);
  assert.equal(WORLD_SIZE, 166);
  assert.deepEqual(
    DEFAULT_QUADRANT_MAP.map((entry) => entry.biome),
    [
      BIOME_ARCTIC,
      BIOME_RADAR,
      BIOME_DESERT,
      BIOME_JUNGLE,
      BIOME_CITADEL,
      BIOME_NUCLEAR,
      BIOME_QUARRY,
      BIOME_WALL_STREET,
      BIOME_URBAN
    ]
  );
});

test('cell bounds cover the full biome cell footprint', () => {
  const centerCell = quadrantBounds('r1c1');
  assert.equal(Math.round(centerCell.maxX - centerCell.minX), 54);
  assert.equal(Math.round(centerCell.maxZ - centerCell.minZ), 54);

  const biome = biomeAtPosition((centerCell.minX + centerCell.maxX) * 0.5, (centerCell.minZ + centerCell.maxZ) * 0.5);
  assert.equal(biome, DEFAULT_QUADRANT_MAP[4].biome);
});

test('headless world collision data builds for the full 3x3 biome layout', () => {
  const data = buildWorldCollisionData({
    worldSeed: 'audit-seed',
    worldProfileVersion: 6,
    worldFlags: { envV2: true, terrainPhysicsV2: true }
  });

  assert.ok(Array.isArray(data.collidables));
  assert.ok(Array.isArray(data.spawnExclusionZones));
  assert.ok(data.collidables.length > 0);
  assert.ok(data.spawnExclusionZones.length > 0);
});

test('headless world collision data no longer includes thin seam colliders on biome divider lines', () => {
  const data = buildWorldCollisionData({
    worldSeed: 'audit-seed',
    worldProfileVersion: 6,
    worldFlags: { envV2: true, terrainPhysicsV2: true }
  });

  const seamLike = data.collidables.filter((box) => {
    const centerX = (box.min.x + box.max.x) * 0.5;
    const centerZ = (box.min.z + box.max.z) * 0.5;
    const spanX = box.max.x - box.min.x;
    const spanZ = box.max.z - box.min.z;
    const onVerticalSeam = (Math.abs(centerX - 56) < 0.05 || Math.abs(centerX - 110) < 0.05) && spanX < 0.5 && spanZ > 20;
    const onHorizontalSeam = (Math.abs(centerZ - 56) < 0.05 || Math.abs(centerZ - 110) < 0.05) && spanZ < 0.5 && spanX > 20;
    return onVerticalSeam || onHorizontalSeam;
  });

  assert.equal(seamLike.length, 0);
});

function createGeometryRecorder() {
  const blocks = [];
  const decors = [];
  const flickers = [];
  const steamColumns = [];
  return {
    blocks,
    decors,
    flickers,
    steamColumns,
    place: {
      addBlock(x, y, z, w, h, d, material, isSolid) {
        const userData = {};
        blocks.push({
          kind: 'block',
          x: Number(x || 0),
          y: Number(y || 0),
          z: Number(z || 0),
          w: Number(w || 0),
          h: Number(h || 0),
          d: Number(d || 0),
          material,
          isSolid: isSolid !== false,
          userData
        });
        return {
          position: { x: Number(x || 0), y: Number(y || 0), z: Number(z || 0) },
          material: material || null,
          userData
        };
      },
      addRamp(x, y, z, w, h, d, material, rotY, tiltX, isSolid) {
        const userData = {};
        blocks.push({
          kind: 'ramp',
          x: Number(x || 0),
          y: Number(y || 0),
          z: Number(z || 0),
          w: Number(w || 0),
          h: Number(h || 0),
          d: Number(d || 0),
          rotY: Number(rotY || 0),
          tiltX: Number(tiltX || 0),
          material,
          isSolid: isSolid !== false,
          userData
        });
        return {
          position: { x: Number(x || 0), y: Number(y || 0), z: Number(z || 0) },
          material: material || null,
          userData
        };
      },
      addDecor(x, y, z, geometry, material, rotY, rotX, rotZ) {
        const userData = {};
        decors.push({
          kind: 'decor',
          x: Number(x || 0),
          y: Number(y || 0),
          z: Number(z || 0),
          geometry,
          material,
          rotY: Number(rotY || 0),
          rotX: Number(rotX || 0),
          rotZ: Number(rotZ || 0),
          userData
        });
        return {
          position: { x: Number(x || 0), y: Number(y || 0), z: Number(z || 0) },
          rotation: { x: Number(rotX || 0), y: Number(rotY || 0), z: Number(rotZ || 0) },
          material: material || null,
          geometry: geometry || null,
          userData
        };
      }
    },
    ctx: {
      scene: { add() {} },
      addExclusion() {},
      addWaterfallSheet() {},
      addMistCard() {},
      addLeafSway() {},
      addIceShimmer() {},
      addFlicker(data) { flickers.push(data); },
      addSteamColumn(data) { steamColumns.push(data); }
    }
  };
}

function solidGeometryAabbs(blocks) {
  return blocks
    .filter((block) => block.isSolid)
    .map((block) => createRotatedBoxAabb(
      block.x,
      block.y,
      block.z,
      block.w,
      block.h,
      block.d,
      block.rotY || 0,
      block.tiltX || 0
    ));
}

function pointHitsSolid(aabbs, x, y, z) {
  return aabbs.some((aabb) =>
    x >= aabb.min.x &&
    x <= aabb.max.x &&
    y >= aabb.min.y &&
    y <= aabb.max.y &&
    z >= aabb.min.z &&
    z <= aabb.max.z
  );
}

test('arctic mountain keeps a lower summit while adding more glacier texture', () => {
  const runtime = ensureHeadlessWorldRuntime();
  const builder = runtime.WorldQuadrants && runtime.WorldQuadrants.arctic;
  assert.equal(typeof builder, 'function');

  const rawBounds = quadrantBounds('r0c0');
  const recorder = createGeometryRecorder();
  const stats = builder(rawBounds, recorder.place, {
    ...recorder.ctx,
    biomeEntry: { biome: BIOME_ARCTIC },
    rawBounds
  });

  assert.ok(stats);
  assert.ok(stats.peakHeight >= 19.5);
  assert.ok(stats.peakHeight <= 21.5);
  assert.ok(stats.terraceCount <= 6);
  assert.ok(stats.minRouteShelfDepth >= 3.5);
  assert.ok(stats.minRouteShelfWidth >= 4.0);
  assert.ok(stats.summitWidth >= 4.0);
  assert.ok(stats.summitDepth >= 3.5);
  assert.equal(stats.glacierPatches, 6);
  assert.equal(stats.interiorSpireGroups, 5);
  assert.ok(stats.groundSpires >= 30);
  assert.ok(stats.crystals >= 36);
  assert.ok(stats.edgeTouchSides.north >= 1);
  assert.ok(stats.edgeTouchSides.east >= 1);
  assert.ok(stats.edgeTouchSides.south >= 1);
  assert.ok(stats.edgeTouchSides.west >= 1);
});

test('jungle keeps the waterfall and shrine anchors while opening the shrine court', () => {
  const runtime = ensureHeadlessWorldRuntime();
  const builder = runtime.WorldQuadrants && runtime.WorldQuadrants.jungle;
  assert.equal(typeof builder, 'function');

  const rawBounds = quadrantBounds('r1c0');
  const recorder = createHeadlessRecorder();
  const stats = builder(rawBounds, recorder.place, {
    ...recorder.ctx,
    biomeEntry: { biome: BIOME_JUNGLE },
    rawBounds
  });

  assert.ok(stats);
  assert.ok(Math.abs(stats.waterfallAnchorX - (rawBounds.minX + 2.75)) < 0.0001);
  assert.ok(Math.abs(stats.waterfallAnchorZ - (rawBounds.minZ + ((rawBounds.maxZ - rawBounds.minZ) * 0.34))) < 0.0001);
  assert.ok(Math.abs(stats.shrineCenterX - (rawBounds.minX + ((rawBounds.maxX - rawBounds.minX) * 0.67))) < 0.0001);
  assert.ok(Math.abs(stats.shrineCenterZ - (rawBounds.minZ + ((rawBounds.maxZ - rawBounds.minZ) * 0.56))) < 0.0001);
  assert.equal(stats.canopyTrees, 11);
  assert.equal(stats.giantTrees, 9);
  assert.equal(stats.bushyTrees, 9);
  assert.equal(stats.saplings, 5);
  assert.equal(stats.corridorBlockers, 3);
  assert.equal(stats.edgeTreeAssets, 6);

  const exactBorderTouches = recorder.collidables.filter((box) =>
    Math.abs(box.min.x - rawBounds.minX) < 0.0001 ||
    Math.abs(box.max.x - rawBounds.maxX) < 0.0001 ||
    Math.abs(box.min.z - rawBounds.minZ) < 0.0001 ||
    Math.abs(box.max.z - rawBounds.maxZ) < 0.0001
  );
  assert.equal(exactBorderTouches.length, 0);
});

test('citadel grows a larger flickering summit flame with a fuller steam plume', () => {
  const runtime = ensureHeadlessWorldRuntime();
  const builder = runtime.WorldQuadrants && runtime.WorldQuadrants.citadel;
  assert.equal(typeof builder, 'function');

  const rawBounds = quadrantBounds('r1c1');
  const recorder = createGeometryRecorder();
  const stats = builder(rawBounds, recorder.place, {
    ...recorder.ctx,
    biomeEntry: { biome: BIOME_CITADEL },
    rawBounds
  });

  assert.ok(stats);
  assert.equal(stats.terraces, 5);
  assert.equal(stats.stairs, 4);
  assert.equal(stats.flameLayers, 3);
  assert.equal(recorder.steamColumns.length, 1);
  assert.equal(stats.steamTileCount, CITADEL_STEAM_TILE_COUNT);
  assert.ok(Math.abs(recorder.steamColumns[0].tiles.length - CITADEL_STEAM_TILE_COUNT) < 0.0001);
  assert.ok(Math.abs(Number(recorder.steamColumns[0].rise || 0) - 4.6) < 0.0001);
  assert.ok(Math.abs(Number(recorder.steamColumns[0].baseOpacity || 0) - 0.11) < 0.0001);
  assert.ok(stats.steamPeakHeight > 33);
  assert.ok(stats.flameTopHeight > 24);

  const flameBlocks = recorder.blocks.filter((block) =>
    block.kind === 'block' &&
    block.isSolid === false &&
    block.y >= 20 &&
    block.h >= 1.5
  );
  assert.equal(flameBlocks.length, 3);
  assert.ok(flameBlocks.some((block) => Math.abs(block.w - 6.8) < 0.0001 && Math.abs(block.h - 1.9) < 0.0001));
  assert.ok(flameBlocks.some((block) => Math.abs(block.w - 4.8) < 0.0001 && Math.abs(block.h - 2.4) < 0.0001));
  assert.ok(flameBlocks.some((block) => Math.abs(block.w - 2.8) < 0.0001 && Math.abs(block.h - 2.9) < 0.0001));

  const flameFlickers = recorder.flickers.filter((flicker) => flicker && flicker.pulseFamily === 'citadel-flame');
  assert.equal(flameFlickers.length, 3);
  assert.ok(flameFlickers.some((flicker) => Math.abs(Number(flicker.amplitude || 0) - 0.28) < 0.0001));
  assert.ok(flameFlickers.some((flicker) => Math.abs(Number(flicker.amplitude || 0) - 0.22) < 0.0001));
  assert.ok(flameFlickers.some((flicker) => Math.abs(Number(flicker.amplitude || 0) - 0.18) < 0.0001));
  assert.ok(flameFlickers.every((flicker) => Number(flicker.opacityAmplitude || 0) >= 0.12));
});

test('desert adds a mid-scale hero arch while keeping the fortress edges', () => {
  const runtime = ensureHeadlessWorldRuntime();
  const builder = runtime.WorldQuadrants && runtime.WorldQuadrants.desert;
  assert.equal(typeof builder, 'function');

  const rawBounds = quadrantBounds('r0c2');
  const recorder = createHeadlessRecorder();
  const stats = builder(rawBounds, recorder.place, {
    ...recorder.ctx,
    biomeEntry: { biome: BIOME_DESERT },
    rawBounds
  });

  assert.ok(stats);
  assert.ok(Math.abs(stats.centerHeroArchX - (rawBounds.minX + ((rawBounds.maxX - rawBounds.minX) * 0.52))) < 0.0001);
  assert.ok(Math.abs(stats.centerHeroArchZ - (rawBounds.minZ + ((rawBounds.maxZ - rawBounds.minZ) * 0.54))) < 0.0001);
  assert.ok(stats.centerHeroArchHeight >= 8.8);
  assert.ok(stats.centerHeroArchHeight <= 9.2);
  assert.ok(stats.centerHeroArchSpan >= 11.5);
  assert.ok(stats.centerHeroArchClearWidth >= 4.8);
  assert.equal(stats.centerSupportCount, 4);
  assert.ok(stats.centerHeroArchHeight > stats.westArchPeakHeight);
  assert.ok(stats.centerHeroArchSpan > stats.westArchSpan);

  const northTouches = recorder.collidables.filter((box) =>
    Math.abs(box.min.z - rawBounds.minZ) < 0.0001
  );
  const eastTouches = recorder.collidables.filter((box) =>
    Math.abs(box.max.x - rawBounds.maxX) < 0.0001
  );
  assert.ok(northTouches.length >= 1);
  assert.ok(eastTouches.length >= 1);
});

test('desert removes the broken fence clutter from the interior', () => {
  const runtime = ensureHeadlessWorldRuntime();
  const builder = runtime.WorldQuadrants && runtime.WorldQuadrants.desert;
  assert.equal(typeof builder, 'function');

  const rawBounds = quadrantBounds('r0c2');
  const recorder = createGeometryRecorder();
  builder(rawBounds, recorder.place, {
    ...recorder.ctx,
    biomeEntry: { biome: BIOME_DESERT },
    rawBounds
  });

  const fencePosts = recorder.blocks.filter((block) =>
    block.kind === 'block' &&
    block.isSolid === false &&
    Math.abs(block.w - 0.18) < 0.0001 &&
    Math.abs(block.d - 0.18) < 0.0001 &&
    block.h >= 1.6 &&
    block.h <= 2.4
  );
  const fenceRails = recorder.blocks.filter((block) =>
    block.kind === 'ramp' &&
    block.isSolid === false &&
    block.w <= 0.14 &&
    block.h <= 0.14 &&
    block.d >= 1.3
  );

  assert.equal(fencePosts.length, 0);
  assert.equal(fenceRails.length, 0);
});

test('nuclear cooling towers stay flush to the east wall while the plant becomes two clean reactor buildings', () => {
  const runtime = ensureHeadlessWorldRuntime();
  const builder = runtime.WorldQuadrants && runtime.WorldQuadrants.nuclear;
  assert.equal(typeof builder, 'function');

  const rawBounds = quadrantBounds('r1c2');
  const recorder = createGeometryRecorder();
  const stats = builder(rawBounds, recorder.place, {
    ...recorder.ctx,
    biomeEntry: { biome: BIOME_NUCLEAR },
    rawBounds
  });

  assert.ok(stats);
  assert.ok(stats.towerPeakHeight >= 42.3);
  assert.ok(stats.towerPeakHeight <= 42.7);
  assert.ok(Math.abs(stats.towerEastFaceX - rawBounds.maxX) < 0.001);
  assert.ok(stats.towerBaseWidth >= 15.5);
  assert.equal(stats.reactorBuildings, 2);
  assert.ok(stats.buildingGap >= 4);
  assert.equal(stats.stairBuildingNorth, 1);
  assert.equal(stats.northStairStepCount, 5);
  assert.ok(stats.northStairTopY < stats.northBuildingRoofY);

  const reactorBodies = recorder.blocks.filter((block) =>
    block.kind === 'block' &&
    block.userData &&
    block.userData.role === 'reactor-building'
  );
  assert.equal(reactorBodies.length, 2);

  const northReactor = reactorBodies.find((block) => block.userData.reactorId === 'north');
  const southReactor = reactorBodies.find((block) => block.userData.reactorId === 'south');
  assert.ok(northReactor);
  assert.ok(southReactor);
  assert.ok(northReactor.z < southReactor.z);
  assert.ok(Math.abs(northReactor.w - 11.8) < 0.0001);
  assert.ok(Math.abs(northReactor.d - 17.6) < 0.0001);
  assert.ok(Math.abs(northReactor.h - (6.2 * NUCLEAR_REACTOR_HEIGHT_SCALE)) < 0.0001);
  assert.ok(Math.abs(southReactor.w - 15.4) < 0.0001);
  assert.ok(Math.abs(southReactor.d - 22.9) < 0.0001);
  assert.ok(Math.abs(southReactor.h - (8.3 * NUCLEAR_REACTOR_HEIGHT_SCALE)) < 0.0001);
  assert.ok(Math.abs(stats.northBuildingRoofY - northReactor.h) < 0.0001);
  assert.ok(Math.abs(stats.southBuildingRoofY - southReactor.h) < 0.0001);
  assert.ok((southReactor.w / northReactor.w) >= 1.28);
  assert.ok((southReactor.d / northReactor.d) >= 1.28);
  assert.ok((southReactor.h / northReactor.h) >= 1.28);

  const northStairs = recorder.blocks.filter((block) =>
    block.userData &&
    block.userData.role === 'reactor-stair-step' &&
    block.userData.reactorId === 'north'
  );
  const southStairs = recorder.blocks.filter((block) =>
    block.userData &&
    block.userData.role === 'reactor-stair-step' &&
    block.userData.reactorId === 'south'
  );
  assert.equal(northStairs.length, 5);
  assert.equal(southStairs.length, 0);
  assert.ok(northStairs.every((step) => step.w <= 1.1));
  assert.ok(northStairs.every((step) => step.d <= 1.0));
  const sortedNorthStairs = northStairs.slice().sort((a, b) => a.userData.stepIndex - b.userData.stepIndex);
  assert.ok(sortedNorthStairs.at(-1).x > sortedNorthStairs[0].x);
  assert.ok(sortedNorthStairs.at(-1).z < sortedNorthStairs[0].z);
  assert.ok(sortedNorthStairs.at(-1).y < northReactor.h);

  const oldCampusBody = recorder.blocks.find((block) =>
    block.kind === 'block' &&
    Math.abs(block.w - 18.4) < 0.0001 &&
    Math.abs(block.h - 7.2) < 0.0001 &&
    Math.abs(block.d - 13.8) < 0.0001
  );
  assert.equal(oldCampusBody, undefined);
});

test('nuclear keeps a continuous flush green window band while removing the warning sign', () => {
  const runtime = ensureHeadlessWorldRuntime();
  const builder = runtime.WorldQuadrants && runtime.WorldQuadrants.nuclear;
  assert.equal(typeof builder, 'function');

  const rawBounds = quadrantBounds('r1c2');
  const recorder = createGeometryRecorder();
  const stats = builder(rawBounds, recorder.place, {
    ...recorder.ctx,
    biomeEntry: { biome: BIOME_NUCLEAR },
    rawBounds
  });

  const signParts = recorder.decors.filter((decor) =>
    decor.userData &&
    String(decor.userData.role || '').indexOf('warning-sign') === 0
  );
  assert.equal(signParts.length, 0);
  assert.equal(stats.warningSignCount, 0);

  const oldBitmapBacking = recorder.blocks.find((block) =>
    block.kind === 'block' &&
    block.isSolid === false &&
    Math.abs(block.w - 7.3) < 0.0001 &&
    Math.abs(block.h - 7.3) < 0.0001 &&
    Math.abs(block.d - 0.08) < 0.0001
  );
  assert.equal(oldBitmapBacking, undefined);

  const glowSegments = recorder.blocks.filter((block) =>
    block.userData &&
    block.userData.role === 'reactor-glow-strip' &&
    block.userData.reactorId === 'south'
  );
  const glowBacking = recorder.blocks.filter((block) =>
    block.userData &&
    block.userData.role === 'reactor-window-back' &&
    block.userData.reactorId === 'south'
  );
  assert.equal(glowBacking.length, 0);
  assert.equal(glowSegments.length, 3);
  assert.equal(stats.glowMainFace, 'south');
  assert.deepEqual(
    glowSegments.map((segment) => segment.userData.face).sort(),
    ['east', 'south', 'west']
  );
  assert.deepEqual(stats.glowWrapFaces.slice().sort(), ['east', 'west']);
  const westGlow = glowSegments.find((segment) => segment.userData.face === 'west');
  const eastGlow = glowSegments.find((segment) => segment.userData.face === 'east');
  const southGlow = glowSegments.find((segment) => segment.userData.face === 'south');
  assert.ok(Math.abs(southGlow.y - stats.glowStripY) < 0.0001);
  assert.ok(Math.abs(stats.glowStripY - ((stats.southBuildingRoofY - 0.75) - (stats.southBuildingRoofY * 0.05))) < 0.0001);
  assert.ok(stats.glowStripY < stats.southBuildingRoofY);
  assert.ok((stats.southBuildingRoofY - stats.glowStripY) < 1.5);
  assert.ok(Math.abs(southGlow.w - stats.glowMainSpan) < 0.0001);
  assert.ok(Math.abs(westGlow.d - stats.glowWrapSpan) < 0.0001);
  assert.ok(Math.abs(eastGlow.d - stats.glowWrapSpan) < 0.0001);
  assert.ok(southGlow.w > westGlow.d);
  assert.ok(southGlow.w > eastGlow.d);
  assert.ok(Math.abs(southGlow.h - stats.glowVisibleHeight) < 0.0001);
  assert.ok(Math.abs(westGlow.h - stats.glowVisibleHeight) < 0.0001);
  assert.ok(Math.abs(eastGlow.h - stats.glowVisibleHeight) < 0.0001);
  assert.ok(Math.abs(southGlow.d - stats.glowBandDepth) < 0.0001);
  assert.ok(Math.abs(westGlow.w - stats.glowBandDepth) < 0.0001);
  assert.ok(Math.abs(eastGlow.w - stats.glowBandDepth) < 0.0001);
  assert.ok(Math.abs(stats.glowBackingHeight - 0) < 0.0001);
  assert.ok(Math.abs(stats.glowVisibleHeight - 0.96) < 0.0001);
  assert.ok(stats.glowVisibleHeight > 0.8);
  assert.ok(Math.abs(stats.glowBandDepth - 0.18) < 0.0001);
  assert.ok(Math.abs(stats.glowStandOff - 0.01) < 0.0001);

  const glowFlickers = recorder.flickers.filter((flicker) => flicker && flicker.pulseFamily === 'nuclear-window');
  assert.equal(glowFlickers.length, 3);
  for (const flicker of glowFlickers) {
    assert.ok(Math.abs(Number(flicker.baseIntensity || 0) - 0.62) < 0.0001);
    assert.ok(Math.abs(Number(flicker.amplitude || 0) - 0.08) < 0.0001);
    assert.ok(Math.abs(Number(flicker.freq || 0) - 0.34) < 0.0001);
    assert.ok(Math.abs(Number(flicker.opacityBase || 0) - 0.88) < 0.0001);
    assert.ok(Math.abs(Number(flicker.opacityAmplitude || 0) - 0.05) < 0.0001);
  }
  assert.ok(glowFlickers.every((flicker) => Math.abs(Number(flicker.phase || 0) - 0.85) < 0.0001));

  assert.equal(recorder.steamColumns.length, 2);
  assert.ok(recorder.steamColumns.every((steam) => Math.abs(Number(steam.rise || 0) - 16.8) < 0.0001));
  assert.ok(recorder.steamColumns.every((steam) => Array.isArray(steam.tiles) && steam.tiles.length === NUCLEAR_STEAM_TILE_COUNT_PER_TOWER));
  assert.ok(Math.abs(stats.steamTileCount - (NUCLEAR_STEAM_TILE_COUNT_PER_TOWER * 2)) < 0.0001);
  assert.ok(Math.abs(stats.glowWrapSpan - 2.748) < 0.0001);
  assert.ok(stats.glowMainSpan > 15);
});

test('wall street keeps an open center street while shifting building mass to the biome edges', () => {
  const runtime = ensureHeadlessWorldRuntime();
  const builder = runtime.WorldQuadrants && runtime.WorldQuadrants['wall-street'];
  assert.equal(typeof builder, 'function');

  const rawBounds = quadrantBounds('r2c1');
  const recorder = createGeometryRecorder();
  const stats = builder(rawBounds, recorder.place, {
    ...recorder.ctx,
    biomeEntry: { biome: BIOME_WALL_STREET },
    rawBounds
  });

  assert.ok(stats);
  assert.equal(stats.busStops, 2);
  assert.equal(stats.cover, 8);
  assert.ok(stats.towerPeakHeight >= 59);
  assert.ok(stats.towerPeakHeight <= 60);
  assert.ok(stats.upperShaftWidth >= 8);
  assert.ok(Math.abs(stats.exchangeCenterZ - (rawBounds.minZ + ((rawBounds.maxZ - rawBounds.minZ) * 0.84))) < 0.0001);
  assert.ok(Math.abs(stats.towerCenterZ - (rawBounds.minZ + ((rawBounds.maxZ - rawBounds.minZ) * 0.866))) < 0.0001);
  const expectedWallStreetZ = (v) => rawBounds.minZ + ((rawBounds.maxZ - rawBounds.minZ) * v);
  assert.ok(Math.abs(stats.westBlockCenterZ - expectedWallStreetZ(0.47)) < 0.0001);
  assert.ok(Math.abs(stats.eastBlockCenterZ - expectedWallStreetZ(0.47)) < 0.0001);
  assert.ok(Math.abs(stats.westSupportCenterZ - expectedWallStreetZ(0.72)) < 0.0001);
  assert.ok(Math.abs(stats.eastSupportCenterZ - expectedWallStreetZ(0.72)) < 0.0001);
  assert.ok(Math.abs(stats.westKioskCenterZ - expectedWallStreetZ(0.22)) < 0.0001);
  assert.ok(Math.abs(stats.eastKioskCenterZ - expectedWallStreetZ(0.22)) < 0.0001);
  assert.ok(Math.abs(stats.westBusStopCenterZ - expectedWallStreetZ(0.31)) < 0.0001);
  assert.ok(Math.abs(stats.eastBusStopCenterZ - expectedWallStreetZ(0.31)) < 0.0001);
  assert.ok(Math.abs(stats.rearWallSouthFaceZ - rawBounds.maxZ) < 0.0001);
  assert.ok(stats.westBlockPeakHeight > stats.eastBlockPeakHeight);
  assert.equal(stats.northSupportCount, 2);
  assert.equal(stats.centerCoverCount, 0);
  assert.equal(stats.westAlleyCoverCount, 4);
  assert.equal(stats.eastAlleyCoverCount, 4);

  const plazaSpan = (rawBounds.maxX - rawBounds.minX) - 1.2;
  const broadPlazaBase = recorder.blocks.filter((block) =>
    block.kind === 'block' &&
    block.isSolid === false &&
    Math.abs(block.y - 0.04) < 0.0001 &&
    Math.abs(block.w - plazaSpan) < 0.0001 &&
    Math.abs(block.h - 0.08) < 0.0001 &&
    Math.abs(block.d - plazaSpan) < 0.0001
  );
  assert.equal(broadPlazaBase.length, 1);

  const centerApproachStrip = recorder.blocks.filter((block) =>
    block.kind === 'block' &&
    block.isSolid === false &&
    Math.abs(block.y - 0.082) < 0.0001 &&
    Math.abs(block.w - 13.4) < 0.0001 &&
    Math.abs(block.h - 0.084) < 0.0001 &&
    block.d > 30
  );
  assert.equal(centerApproachStrip.length, 1);

  const alleyStrips = recorder.blocks.filter((block) =>
    block.kind === 'block' &&
    block.isSolid === false &&
    Math.abs(block.y - 0.082) < 0.0001 &&
    Math.abs(block.w - 3.8) < 0.0001 &&
    Math.abs(block.h - 0.084) < 0.0001 &&
    Math.abs(block.d - 19.8) < 0.0001
  );
  assert.equal(alleyStrips.length, 2);

  const curbPlanters = recorder.blocks.filter((block) =>
    block.kind === 'block' &&
    block.isSolid === true &&
    Math.abs(block.y - 0.56) < 0.0001 &&
    Math.abs(block.h - 1.12) < 0.0001 &&
    (
      (Math.abs(block.w - 1.8) < 0.0001 && Math.abs(block.d - 1.2) < 0.0001) ||
      (Math.abs(block.w - 1.6) < 0.0001 && Math.abs(block.d - 2.1) < 0.0001) ||
      (Math.abs(block.w - 2.4) < 0.0001 && Math.abs(block.d - 1.5) < 0.0001)
    )
  );
  assert.equal(curbPlanters.length, 6);

  const northEdgePlanters = curbPlanters.filter((block) =>
    Math.abs(block.w - 1.8) < 0.0001 &&
    Math.abs(block.d - 1.2) < 0.0001 &&
    block.z < expectedWallStreetZ(0.12)
  );
  assert.equal(northEdgePlanters.length, 2);

  const busStopRoofs = recorder.blocks.filter((block) =>
    block.kind === 'block' &&
    block.isSolid === true &&
    Math.abs(block.y - 2.42) < 0.0001 &&
    Math.abs(block.w - 5.4) < 0.0001 &&
    Math.abs(block.h - 0.28) < 0.0001 &&
    Math.abs(block.d - 3.1) < 0.0001
  );
  assert.equal(busStopRoofs.length, 2);

  const northOfficeBodies = recorder.blocks.filter((block) =>
    block.kind === 'block' &&
    block.isSolid === true &&
    (
      (Math.abs(block.w - 7.2) < 0.0001 && Math.abs(block.d - 5.8) < 0.0001 && Math.abs(block.h - 9.1) < 0.0001) ||
      (Math.abs(block.w - 5.8) < 0.0001 && Math.abs(block.d - 5.0) < 0.0001 && Math.abs(block.h - 7.5) < 0.0001)
    )
  );
  assert.equal(northOfficeBodies.length, 0);

  const lobbyPilasters = recorder.blocks.filter((block) =>
    block.kind === 'block' &&
    block.isSolid === true &&
    Math.abs(block.w - 1.26) < 0.0001 &&
    Math.abs(block.h - 8.4) < 0.0001 &&
    Math.abs(block.d - 4.8) < 0.0001
  );
  assert.equal(lobbyPilasters.length, 4);

  const solidAabbs = solidGeometryAabbs(recorder.blocks);
  const centerX = (rawBounds.minX + rawBounds.maxX) * 0.5;
  const westShotX = rawBounds.minX + 3.5;
  const eastShotX = rawBounds.maxX - 3.5;

  for (const z of [118, 124, 132, 140, 146]) {
    assert.equal(pointHitsSolid(solidAabbs, centerX, 2.5, z), false);
  }
  assert.equal(pointHitsSolid(solidAabbs, centerX, 2.5, 152), true);

  assert.equal(pointHitsSolid(solidAabbs, westShotX, 2.5, 122), true);
  for (const z of [116, 118, 128, 144]) {
    assert.equal(pointHitsSolid(solidAabbs, westShotX, 2.5, z), false);
  }
  for (const z of [122, 126]) {
    assert.equal(pointHitsSolid(solidAabbs, eastShotX, 2.5, z), true);
  }
  for (const z of [116, 118, 134, 144]) {
    assert.equal(pointHitsSolid(solidAabbs, eastShotX, 2.5, z), false);
  }

  const southFlushSolids = recorder.blocks.filter((block) =>
    block.kind === 'block' &&
    block.isSolid === true &&
    Math.abs((block.z + (block.d * 0.5)) - rawBounds.maxZ) < 0.0001
  );
  assert.ok(southFlushSolids.length >= 1);
});

test('wall street keeps collision inside bounds while allowing non-solid curb bleed', () => {
  const runtime = ensureHeadlessWorldRuntime();
  const builder = runtime.WorldQuadrants && runtime.WorldQuadrants['wall-street'];
  assert.equal(typeof builder, 'function');

  const rawBounds = quadrantBounds('r2c1');
  const geometryRecorder = createGeometryRecorder();
  builder(rawBounds, geometryRecorder.place, {
    ...geometryRecorder.ctx,
    biomeEntry: { biome: BIOME_WALL_STREET },
    rawBounds
  });

  const overflowBlocks = geometryRecorder.blocks.filter((block) => {
    const bounds = createRotatedBoxAabb(
      block.x,
      block.y,
      block.z,
      block.w,
      block.h,
      block.d,
      block.rotY || 0,
      block.tiltX || 0
    );
    return bounds.min.x < rawBounds.minX - 0.0001 ||
      bounds.max.x > rawBounds.maxX + 0.0001 ||
      bounds.min.z < rawBounds.minZ - 0.0001 ||
      bounds.max.z > rawBounds.maxZ + 0.0001;
  });
  assert.ok(overflowBlocks.every((block) => block.isSolid === false));

  const collisionRecorder = createHeadlessRecorder();
  builder(rawBounds, collisionRecorder.place, {
    ...collisionRecorder.ctx,
    biomeEntry: { biome: BIOME_WALL_STREET },
    rawBounds
  });
  const overflowColliders = collisionRecorder.collidables.filter((box) =>
    box.min.x < rawBounds.minX - 0.0001 ||
    box.max.x > rawBounds.maxX + 0.0001 ||
    box.min.z < rawBounds.minZ - 0.0001 ||
    box.max.z > rawBounds.maxZ + 0.0001
  );
  assert.equal(overflowColliders.length, 0);
});

test('desert arch shadow slabs sit below the solid spans instead of overlapping them', () => {
  const runtime = ensureHeadlessWorldRuntime();
  const builder = runtime.WorldQuadrants && runtime.WorldQuadrants.desert;
  assert.equal(typeof builder, 'function');

  const rawBounds = quadrantBounds('r0c2');
  const recorder = createGeometryRecorder();
  builder(rawBounds, recorder.place, {
    ...recorder.ctx,
    biomeEntry: { biome: BIOME_DESERT },
    rawBounds
  });

  const smallSpan = recorder.blocks.find((block) =>
    block.kind === 'block' &&
    block.isSolid === true &&
    Math.abs(block.w - 8.0) < 0.0001 &&
    Math.abs(block.h - 1.2) < 0.0001 &&
    Math.abs(block.d - 2.0) < 0.0001
  );
  const smallShadow = recorder.blocks.find((block) =>
    block.kind === 'block' &&
    block.isSolid === false &&
    Math.abs(block.w - 6.0) < 0.0001 &&
    Math.abs(block.h - 0.28) < 0.0001 &&
    Math.abs(block.d - 1.4) < 0.0001
  );
  const largeSpan = recorder.blocks.find((block) =>
    block.kind === 'block' &&
    block.isSolid === true &&
    Math.abs(block.w - 11.8) < 0.0001 &&
    Math.abs(block.h - 1.4) < 0.0001 &&
    Math.abs(block.d - 3.0) < 0.0001
  );
  const largeShadow = recorder.blocks.find((block) =>
    block.kind === 'block' &&
    block.isSolid === false &&
    Math.abs(block.w - 7.8) < 0.0001 &&
    Math.abs(block.h - 0.24) < 0.0001 &&
    Math.abs(block.d - 1.8) < 0.0001
  );

  assert.ok(smallSpan);
  assert.ok(smallShadow);
  assert.ok(largeSpan);
  assert.ok(largeShadow);
  assert.ok((smallShadow.y + (smallShadow.h * 0.5)) < (smallSpan.y - (smallSpan.h * 0.5)));
  assert.ok((largeShadow.y + (largeShadow.h * 0.5)) < (largeSpan.y - (largeSpan.h * 0.5)));
});
