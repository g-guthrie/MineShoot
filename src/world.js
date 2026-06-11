/**
 * world.js - Compact three-biome arena: a marine lagoon with piers and
 * palms in the west, dense jungle with mossy ruins in the middle, and a
 * crashed space outpost on dark regolith in the east (with jump pads).
 * Everything is blocky box geometry; every solid registers a {min,max}
 * collision box for movement and hitscan.
 */
import { ARENA } from '../shared/combat.js';

const THREE = globalThis.THREE;

const MARINE_EDGE = 42;   // x < MARINE_EDGE is marine
const SPACE_EDGE = 82;    // x > SPACE_EDGE is space
const LAGOON_EDGE = 16;   // x < LAGOON_EDGE is underwater
const LAGOON_DEPTH = 1.2;

export function createWorld(scene) {
  const collidables = [];
  const animated = [];
  const spawnPoints = [];
  const jumpPads = [];

  const sharedGeo = new THREE.BoxGeometry(1, 1, 1);
  const materials = new Map();
  function material(color, emissive = 0) {
    const key = color + ':' + emissive;
    if (!materials.has(key)) {
      materials.set(key, new THREE.MeshLambertMaterial({ color, emissive }));
    }
    return materials.get(key);
  }

  function box(x, y, z, w, h, d, color, { solid = true, emissive = 0, rotY = 0 } = {}) {
    const mesh = new THREE.Mesh(sharedGeo, material(color, emissive));
    mesh.scale.set(w, h, d);
    mesh.position.set(x, y + h / 2, z);
    mesh.rotation.y = rotY;
    mesh.castShadow = h > 0.4;
    mesh.receiveShadow = true;
    scene.add(mesh);
    if (solid) {
      // Rotated props keep their unrotated footprint; close enough for
      // the small decorative angles used here.
      collidables.push({
        min: { x: x - w / 2, y, z: z - d / 2 },
        max: { x: x + w / 2, y: y + h, z: z + d / 2 }
      });
    }
    return mesh;
  }

  // ---------------------------------------------------------------------
  // Sky, light, ground
  // ---------------------------------------------------------------------
  scene.background = new THREE.Color(0x6a9bc2);
  scene.fog = new THREE.Fog(0x7eaec8, 70, 220);
  scene.add(new THREE.AmbientLight(0x6a7584, 0.9));
  scene.add(new THREE.HemisphereLight(0xd4e8ff, 0x4d6149, 0.7));
  const sun = new THREE.DirectionalLight(0xfff2dd, 1.5);
  sun.position.set(85, 90, 30);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -80;
  sun.shadow.camera.right = 80;
  sun.shadow.camera.top = 80;
  sun.shadow.camera.bottom = -80;
  sun.shadow.camera.far = 250;
  scene.add(sun);

  // Biome floors (visual only; ground height comes from groundAt).
  box(MARINE_EDGE / 2 + LAGOON_EDGE / 2, -0.5, 60, MARINE_EDGE - LAGOON_EDGE, 0.5, 120, 0xd9c089, { solid: false }); // beach sand
  box(LAGOON_EDGE / 2, -0.5 - LAGOON_DEPTH, 60, LAGOON_EDGE, 0.5, 120, 0xc4b07a, { solid: false }); // lagoon bed
  box((MARINE_EDGE + SPACE_EDGE) / 2, -0.5, 60, SPACE_EDGE - MARINE_EDGE, 0.5, 120, 0x4e7a3a, { solid: false }); // jungle grass
  box((SPACE_EDGE + ARENA.max) / 2, -0.5, 60, ARENA.max - SPACE_EDGE, 0.5, 120, 0x474a52, { solid: false }); // regolith

  // Water surface over the lagoon.
  const water = new THREE.Mesh(
    new THREE.BoxGeometry(LAGOON_EDGE, 0.12, 120),
    new THREE.MeshLambertMaterial({ color: 0x3f87b8, transparent: true, opacity: 0.75 })
  );
  water.position.set(LAGOON_EDGE / 2, -0.4, 60);
  scene.add(water);
  animated.push((t) => { water.position.y = -0.4 + Math.sin(t * 0.9) * 0.05; });

  // Perimeter cliffs.
  for (const [x, z, w, d] of [
    [60, -2, 124, 4], [60, 122, 124, 4], [-2, 60, 4, 124], [122, 60, 4, 124]
  ]) {
    box(x, 0, z, w, 6, d, 0x6b6f78);
  }

  // ---------------------------------------------------------------------
  // Marine (west): piers, beached boat, palms, coral
  // ---------------------------------------------------------------------
  function palm(x, z) {
    box(x, 0, z, 0.7, 5.2, 0.7, 0x8a5a33);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      box(x + Math.cos(a) * 1.6, 4.9, z + Math.sin(a) * 1.6, 2.6, 0.3, 1.1, 0x3f8f4a, { solid: false, rotY: -a });
    }
  }
  palm(24, 18); palm(30, 44); palm(22, 78); palm(28, 104); palm(36, 64);

  // Two piers reaching over the lagoon.
  for (const pz of [30, 88]) {
    box(10, 0.9, pz, 18, 0.4, 3.4, 0x9a6b3f);
    for (const px of [3, 9, 15]) {
      box(px, -LAGOON_DEPTH, pz - 1.4, 0.5, 2.4, 0.5, 0x7a5230);
      box(px, -LAGOON_DEPTH, pz + 1.4, 0.5, 2.4, 0.5, 0x7a5230);
    }
  }
  // Beached rowboat.
  box(20, 0, 58, 3, 1.1, 7, 0x8a4a2e, { rotY: 0.5 });
  // Coral clusters in the shallows.
  for (const [cx, cz, c] of [[6, 20, 0xd46a8e], [10, 50, 0xe0995a], [5, 72, 0x9a6ad4], [9, 100, 0xd46a8e]]) {
    box(cx, -LAGOON_DEPTH, cz, 1.4, 1.0, 1.4, c);
    box(cx + 0.9, -LAGOON_DEPTH, cz + 0.7, 0.8, 1.6, 0.8, c);
  }
  // Lifeguard tower (sniper perch).
  box(34, 0, 24, 4, 3.4, 4, 0xc9a36a);
  box(34, 3.4, 24, 5, 0.4, 5, 0xb08648);
  box(34, 5.8, 24, 5, 0.3, 5, 0xd9534f, { solid: false });

  spawnPoints.push({ x: 24, z: 30 }, { x: 30, z: 92 }, { x: 34, z: 60 });

  // ---------------------------------------------------------------------
  // Jungle (middle): canopy trees, mossy ruins, center plaza
  // ---------------------------------------------------------------------
  function tree(x, z, s = 1) {
    box(x, 0, z, 1.4 * s, 6 * s, 1.4 * s, 0x4a2f1d);
    box(x, 6 * s, z, 6 * s, 2.2 * s, 6 * s, 0x1f5c2d, { solid: false });
    box(x, 8.2 * s, z, 4 * s, 1.6 * s, 4 * s, 0x2a7a3a, { solid: false });
  }
  tree(50, 16); tree(64, 22, 1.2); tree(76, 14); tree(48, 100, 1.1);
  tree(62, 108); tree(78, 98, 1.3); tree(46, 52); tree(72, 70);

  // Mossy ruin: broken walls and an arch, the map's central cover.
  box(60, 0, 48, 10, 3.2, 1.2, 0x7d8473);
  box(55.5, 0, 53, 1.2, 4.4, 10, 0x7d8473);
  box(60, 0, 72, 12, 2.4, 1.2, 0x6f7565);
  box(66, 0, 60, 1.2, 5, 8, 0x7d8473);
  // Arch
  box(58, 0, 60, 1.4, 4.6, 1.4, 0x8a917f);
  box(62, 0, 60, 1.4, 4.6, 1.4, 0x8a917f);
  box(60, 4.6, 60, 6, 1.2, 1.6, 0x8a917f);
  // Fallen column to vault over.
  box(52, 0, 64, 7, 1.1, 1.6, 0x6f7565, { rotY: 0.3 });
  // Ferns.
  for (const [fx, fz] of [[46, 34], [70, 40], [54, 86], [74, 88], [58, 30]]) {
    box(fx, 0, fz, 1.6, 1.0, 0.3, 0x3a9a4a, { solid: false, rotY: 0.5 });
    box(fx, 0, fz, 0.3, 1.0, 1.6, 0x2f8a3f, { solid: false });
  }

  spawnPoints.push({ x: 50, z: 24 }, { x: 70, z: 96 }, { x: 60, z: 60 });

  // ---------------------------------------------------------------------
  // Space (east): regolith craters, crashed outpost, jump pads
  // ---------------------------------------------------------------------
  // Crater rims.
  function crater(x, z, r) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      box(x + Math.cos(a) * r, 0, z + Math.sin(a) * r, 1.8, 0.9 + (i % 3) * 0.3, 1.8, 0x5a5e66, { rotY: a });
    }
  }
  crater(94, 24, 4.5);
  crater(112, 76, 3.5);

  // Outpost: hub + corridor with emissive windows, tilted solar wing.
  box(102, 0, 44, 10, 5, 10, 0x9aa3ad);
  box(102, 5, 44, 7, 2.2, 7, 0xb8c0c9);
  box(93, 0, 44, 8, 3, 4, 0x8a939d);
  for (const wz of [42.5, 45.5]) {
    box(96, 1.2, wz, 1.6, 0.9, 0.1, 0x9fe8ff, { solid: false, emissive: 0x66d9ff });
  }
  box(108, 0.4, 52, 8, 0.3, 4, 0x2b4a73, { rotY: 0.4 });   // solar wing
  box(102, 7.2, 44, 0.3, 4, 0.3, 0xd0d6dd, { solid: false }); // antenna
  // Glow crystals.
  for (const [gx, gz] of [[90, 96], [108, 104], [116, 32]]) {
    box(gx, 0, gz, 1.1, 2.4, 1.1, 0x7ee8d0, { emissive: 0x35b89a, rotY: 0.6 });
  }
  // Jump pads: emissive discs with a low-gravity boost zone.
  for (const [px, pz] of [[90, 60], [112, 90], [108, 20]]) {
    box(px, 0, pz, 3, 0.25, 3, 0x2d3340);
    const glow = box(px, 0.25, pz, 2.2, 0.12, 2.2, 0x9fe8ff, { solid: false, emissive: 0x55c9f2 });
    animated.push((t) => { glow.material.emissiveIntensity = 0.7 + Math.sin(t * 3 + px) * 0.3; });
    jumpPads.push({ x: px, z: pz, r: 2.2 });
  }

  spawnPoints.push({ x: 92, z: 30 }, { x: 110, z: 100 }, { x: 100, z: 64 });

  // ---------------------------------------------------------------------
  // Cover pass: props scattered so every lane has something to fight over
  // ---------------------------------------------------------------------
  // Marine: rocks, driftwood, crates by the piers.
  for (const [x, z, s] of [[26, 12, 1.6], [38, 38, 2.0], [24, 70, 1.4], [38, 110, 1.8]]) {
    box(x, 0, z, s * 1.6, s, s * 1.3, 0x8d9097, { rotY: x * 0.7 });
    box(x + s, 0, z + 0.6, s, s * 0.6, s, 0x7c7f86, { rotY: x });
  }
  box(14, 0.9, 26, 1.6, 1.6, 1.6, 0xa97f4f, { rotY: 0.3 }); // pier crates
  box(15.5, 0.9, 27.5, 1.3, 1.3, 1.3, 0x8d6a42, { rotY: 0.8 });
  box(30, 0, 86, 5, 0.8, 1.1, 0x76573a, { rotY: 1.1 });     // driftwood

  // Jungle: boulders, log piles, extra ruin fragments.
  for (const [x, z, s] of [[48, 42, 1.8], [70, 30, 1.5], [52, 74, 1.6], [76, 80, 2.0]]) {
    box(x, 0, z, s * 1.5, s * 1.1, s * 1.4, 0x6f7565, { rotY: z * 0.4 });
  }
  box(58, 0, 94, 6, 1.0, 1.4, 0x5b4226, { rotY: 0.2 });
  box(58, 1.0, 94.6, 5, 0.9, 1.2, 0x6b4e2c, { rotY: 0.15 });
  box(44, 0, 64, 1.2, 2.6, 5, 0x7d8473);                    // wall fragment
  box(74, 0, 50, 5, 2.2, 1.2, 0x6f7565, { rotY: 0.4 });

  // Space: cargo containers and hull debris.
  box(92, 0, 84, 5, 2.4, 2.2, 0x365a8c, { rotY: 0.2 });
  box(98, 0, 88, 5, 2.4, 2.2, 0x8c5a36, { rotY: -0.3 });
  box(96, 2.4, 86, 4.6, 2.2, 2.1, 0x6e7176, { rotY: 0 });
  box(112, 0, 48, 4, 1.6, 3, 0x596068, { rotY: 0.7 });      // hull chunk
  box(88, 0, 14, 3, 1.2, 2.4, 0x596068, { rotY: 1.2 });

  // Biome border cover so crossing lanes isn't suicide.
  for (const z of [24, 60, 96]) {
    box(MARINE_EDGE, 0, z, 1.4, 2.2, 6, 0x9a8a6a, { rotY: 0.1 });
    box(SPACE_EDGE, 0, z + 8, 1.4, 2.2, 6, 0x5f646c, { rotY: -0.1 });
  }

  // Drifting clouds.
  for (let i = 0; i < 7; i++) {
    const cloud = box(15 + i * 16, 26 + (i % 3) * 4, (i * 37) % 120, 9, 1.4, 5, 0xe8edf2, { solid: false });
    cloud.material = cloud.material.clone();
    cloud.material.transparent = true;
    cloud.material.opacity = 0.85;
    const speed = 0.4 + (i % 3) * 0.2;
    animated.push((t, dt) => {
      cloud.position.x += speed * dt;
      if (cloud.position.x > 130) cloud.position.x = -10;
    });
  }

  let clock = 0;

  return {
    collidables,
    spawnPoints,
    center: ARENA.center,
    size: ARENA.max,

    groundAt(x, z) {
      if (x < LAGOON_EDGE) return -LAGOON_DEPTH;
      if (x < LAGOON_EDGE + 4) {
        // Slope from lagoon bed up to the beach.
        return -LAGOON_DEPTH * (1 - (x - LAGOON_EDGE) / 4);
      }
      return 0;
    },

    /** Space jump pads launch players ~1.5x higher. */
    jumpScaleAt(x, z) {
      for (const pad of jumpPads) {
        if (Math.hypot(x - pad.x, z - pad.z) < pad.r) return 1.55;
      }
      return 1;
    },

    randomSpawn(avoidPoints = []) {
      let best = spawnPoints[0];
      let bestDist = -1;
      for (const point of spawnPoints) {
        let nearest = Infinity;
        for (const avoid of avoidPoints) {
          nearest = Math.min(nearest, Math.hypot(point.x - avoid.x, point.z - avoid.z));
        }
        const score = nearest === Infinity ? Math.random() * 100 : nearest;
        if (score > bestDist) {
          bestDist = score;
          best = point;
        }
      }
      return { x: best.x + (Math.random() - 0.5) * 3, z: best.z + (Math.random() - 0.5) * 3 };
    },

    update(dt) {
      clock += dt;
      for (const tick of animated) tick(clock, dt);
    }
  };
}
