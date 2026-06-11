/**
 * weapons.js - Hitscan fire control and block placement. Each shot is
 * resolved client-side against the world, placed blocks, and remote player
 * hitboxes; the room server validates and applies damage.
 */
import { WEAPONS, WEAPON_SLOTS, BLOCKS, weaponOrDefault, blockKey, parseBlockKey } from '../shared/combat.js';
import { EYE_HEIGHT, PLAYER_RADIUS, PLAYER_HEIGHT } from '../shared/combat.js';
import { audio } from './audio.js';

const THREE = globalThis.THREE;

/**
 * Ray vs AABB slab test. Returns { t, normal } or null. allowInside treats
 * a ray starting inside the box as a point-blank hit (used for player
 * hitboxes, never for world geometry).
 */
function rayBox(origin, dir, box, maxDist, allowInside) {
  let tMin = 0;
  let tMax = maxDist;
  let normalAxis = -1;
  let normalSign = 1;

  const axes = ['x', 'y', 'z'];
  for (let i = 0; i < 3; i++) {
    const axis = axes[i];
    const o = origin[axis];
    const d = dir[axis];
    const lo = box.min[axis];
    const hi = box.max[axis];
    if (Math.abs(d) < 1e-9) {
      if (o < lo || o > hi) return null;
      continue;
    }
    const inv = 1 / d;
    let t1 = (lo - o) * inv;
    let t2 = (hi - o) * inv;
    let sign = -1;
    if (t1 > t2) {
      const tmp = t1; t1 = t2; t2 = tmp;
      sign = 1;
    }
    if (t1 > tMin) {
      tMin = t1;
      normalAxis = i;
      normalSign = sign;
    }
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return null;
  }
  if (normalAxis < 0) {
    if (allowInside) return { t: 0.001, normal: { x: 0, y: 1, z: 0 } };
    return null;
  }
  const normal = { x: 0, y: 0, z: 0 };
  normal[axes[normalAxis]] = normalSign;
  return { t: tMin, normal };
}

function pointAt(origin, dir, t) {
  return {
    x: origin.x + dir.x * t,
    y: origin.y + dir.y * t,
    z: origin.z + dir.z * t
  };
}

function boxesOverlap(a, b) {
  return a.min.x < b.max.x && a.max.x > b.min.x &&
         a.min.y < b.max.y && a.max.y > b.min.y &&
         a.min.z < b.max.z && a.max.z > b.min.z;
}

export function createWeapons({ camera, scene, world, player, blocks, remotes, viewmodel, net, hud, onFire }) {
  const effects = remotes.effects;

  const slots = WEAPON_SLOTS.map((id) => ({
    id,
    ammo: WEAPONS[id].magSize,
    reloadUntil: 0,
    lastFireAt: 0
  }));
  let currentSlot = 0;
  let adsActive = false;

  hud.setWeapon(slots[0].id);
  hud.setAmmo(slots[0].ammo, false);
  hud.setBlocks(BLOCKS.startCarried);
  viewmodel.setWeapon(slots[0].id);

  // Ghost preview cube for block placement.
  const ghostMaterial = new THREE.MeshBasicMaterial({
    color: 0x7ec850, transparent: true, opacity: 0.3, depthWrite: false
  });
  const ghost = new THREE.Mesh(
    new THREE.BoxGeometry(BLOCKS.size * 0.99, BLOCKS.size * 0.99, BLOCKS.size * 0.99),
    ghostMaterial
  );
  ghost.visible = false;
  scene.add(ghost);

  function slot() {
    return slots[currentSlot];
  }

  function weapon() {
    return WEAPONS[slot().id];
  }

  function isReloading() {
    return slot().reloadUntil > performance.now();
  }

  function rayDir(spreadDeg, pelletIndex, pattern) {
    const base = player.forwardDir();
    if (!spreadDeg) return base;
    const spread = (spreadDeg * Math.PI) / 180;
    const forward = new THREE.Vector3(base.x, base.y, base.z);
    const up = Math.abs(forward.y) > 0.95
      ? new THREE.Vector3(1, 0, 0)
      : new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(forward, up).normalize();
    const trueUp = new THREE.Vector3().crossVectors(right, forward);

    let offsetX;
    let offsetY;
    if (pattern && pattern.length) {
      // Deterministic pellet pattern with a touch of jitter.
      const entry = pattern[pelletIndex % pattern.length];
      const jitter = 0.07 * Math.tan(spread);
      offsetX = entry.x * Math.tan(spread) + (Math.random() - 0.5) * jitter;
      offsetY = entry.y * Math.tan(spread) + (Math.random() - 0.5) * jitter;
    } else {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.sqrt(Math.random()) * Math.tan(spread);
      offsetX = Math.cos(angle) * radius;
      offsetY = Math.sin(angle) * radius;
    }
    forward
      .addScaledVector(right, offsetX)
      .addScaledVector(trueUp, offsetY)
      .normalize();
    return { x: forward.x, y: forward.y, z: forward.z };
  }

  /** Nearest static-world hit: world collider boxes + ground march. */
  function raycastWorld(origin, dir, maxDist) {
    let best = null;
    const boxes = world.collidables;
    for (let i = 0; i < boxes.length; i++) {
      const hit = rayBox(origin, dir, boxes[i], best ? best.t : maxDist);
      if (hit && (!best || hit.t < best.t)) best = hit;
    }

    // Ground: march the ray and find where it dips under the ground height.
    const step = 0.9;
    const limit = best ? best.t : maxDist;
    let prevT = 0;
    let prevAbove = origin.y - (world.groundAt(origin.x, origin.z) || 0);
    for (let t = step; t <= limit; t += step) {
      const p = pointAt(origin, dir, t);
      const above = p.y - (world.groundAt(p.x, p.z) || 0);
      if (above <= 0 && prevAbove > 0) {
        const f = prevAbove / (prevAbove - above);
        const tHit = prevT + (t - prevT) * f;
        if (!best || tHit < best.t) {
          best = { t: tHit, normal: { x: 0, y: 1, z: 0 } };
        }
        break;
      }
      prevT = t;
      prevAbove = above;
    }
    return best;
  }

  function resolveShot(origin, dir, maxDist) {
    const world = raycastWorld(origin, dir, maxDist);
    let limit = world ? world.t : maxDist;
    let result = world
      ? { kind: 'world', t: world.t, point: pointAt(origin, dir, world.t) }
      : { kind: 'miss', t: maxDist, point: pointAt(origin, dir, maxDist) };

    const blockHit = blocks.raycast(origin, dir, limit);
    if (blockHit && blockHit.t < limit) {
      limit = blockHit.t;
      result = { kind: 'block', key: blockHit.key, t: blockHit.t, point: pointAt(origin, dir, blockHit.t) };
    }

    for (const target of remotes.targets()) {
      const headHit = rayBox(origin, dir, target.head, limit, true);
      if (headHit && headHit.t < limit) {
        limit = headHit.t;
        result = { kind: 'player', id: target.id, head: true, t: headHit.t, point: pointAt(origin, dir, headHit.t) };
        continue;
      }
      const bodyHit = rayBox(origin, dir, target.body, limit, true);
      if (bodyHit && bodyHit.t < limit) {
        limit = bodyHit.t;
        result = { kind: 'player', id: target.id, head: false, t: bodyHit.t, point: pointAt(origin, dir, bodyHit.t) };
      }
    }
    return result;
  }

  function fire() {
    const s = slot();
    const w = weapon();
    const now = performance.now();
    if (now < s.reloadUntil || now - s.lastFireAt < w.cooldownMs) return;
    if (s.ammo <= 0) {
      reload();
      return;
    }
    s.lastFireAt = now;
    s.ammo -= 1;
    hud.setAmmo(s.ammo, false);

    const origin = {
      x: player.entity.x,
      y: player.entity.y,
      z: player.entity.z
    };

    const playerHits = new Map(); // id -> { pellets, head }
    const blockHits = new Map();  // key -> count
    let firstPoint = null;
    const spread = adsActive && w.adsSpreadDeg != null ? w.adsSpreadDeg : w.spreadDeg;

    for (let p = 0; p < w.pellets; p++) {
      const dir = rayDir(spread, p, w.pelletPattern);
      const result = resolveShot(origin, dir, w.range);
      if (!firstPoint) firstPoint = result.point;

      const muzzle = viewmodel.muzzleWorldPosition() || origin;
      effects.addTracer(muzzle, result.point);
      if (result.kind !== 'miss') effects.addImpact(result.point);

      if (result.kind === 'player') {
        const entry = playerHits.get(result.id) || { pellets: 0, head: false };
        entry.pellets += 1;
        entry.head = entry.head || result.head;
        playerHits.set(result.id, entry);
      } else if (result.kind === 'block') {
        blockHits.set(result.key, (blockHits.get(result.key) || 0) + 1);
      }
    }

    net.send({
      t: 'fire',
      weapon: s.id,
      ox: origin.x, oy: origin.y, oz: origin.z,
      tx: firstPoint.x, ty: firstPoint.y, tz: firstPoint.z
    });

    for (const [id, entry] of playerHits) {
      net.send({ t: 'hit', target: id, weapon: s.id, pellets: entry.pellets, head: entry.head });
      hud.hitmarker(entry.head);
    }
    for (const [key, count] of blockHits) {
      const sends = Math.min(count, BLOCKS.hp);
      for (let i = 0; i < sends; i++) net.send({ t: 'block_hit', k: key });
    }

    viewmodel.kick(w.pellets > 1 ? 1.6 : 1, w.cooldownMs);
    audio.play(w.sound, 0.55);
    if (onFire) onFire(w);

    if (s.ammo <= 0) reload();
  }

  function reload() {
    const s = slot();
    const w = weapon();
    if (s.ammo >= w.magSize || isReloading()) return;
    s.reloadUntil = performance.now() + w.reloadMs;
    hud.setAmmo(s.ammo, true);
    viewmodel.startReload(w.reloadMs);
    setTimeout(() => {
      s.ammo = w.magSize;
      if (slots[currentSlot] === s) hud.setAmmo(s.ammo, false);
    }, w.reloadMs);
  }

  /**
   * Find the placement cell: the empty cell adjacent to whatever surface is
   * under the crosshair (placed block face, world geometry, or terrain).
   */
  function placementCell() {
    const origin = { x: player.entity.x, y: player.entity.y, z: player.entity.z };
    const dir = player.forwardDir();
    const range = BLOCKS.placeRange;

    const blockHit = blocks.raycast(origin, dir, range);
    const worldHit = raycastWorld(origin, dir, range);

    let cell = null;
    if (blockHit && (!worldHit || blockHit.t < worldHit.t)) {
      cell = blockHit.prevCell;
    } else if (worldHit) {
      const p = pointAt(origin, dir, worldHit.t);
      const nudged = {
        x: p.x + worldHit.normal.x * 0.02,
        y: p.y + worldHit.normal.y * 0.02,
        z: p.z + worldHit.normal.z * 0.02
      };
      cell = parseBlockKey(blocks.keyAt(nudged.x, nudged.y, nudged.z));
    }
    if (!cell) return null;

    const key = blockKey(cell.ix, cell.iy, cell.iz);
    if (blocks.has(key)) return null;

    // Don't let players entomb themselves.
    const s = BLOCKS.size;
    const cellBox = {
      min: { x: cell.ix * s, y: cell.iy * s, z: cell.iz * s },
      max: { x: (cell.ix + 1) * s, y: (cell.iy + 1) * s, z: (cell.iz + 1) * s }
    };
    const feetY = player.entity.y - EYE_HEIGHT;
    const selfBox = {
      min: { x: player.entity.x - PLAYER_RADIUS, y: feetY, z: player.entity.z - PLAYER_RADIUS },
      max: { x: player.entity.x + PLAYER_RADIUS, y: feetY + PLAYER_HEIGHT, z: player.entity.z + PLAYER_RADIUS }
    };
    if (boxesOverlap(cellBox, selfBox)) return null;

    return { key, cell };
  }

  return {
    currentId: () => slot().id,
    currentWeapon: () => weapon(),
    isReloading,

    setAds(active) {
      adsActive = !!active;
    },
    isAds: () => adsActive,

    selectSlot(which) {
      let next = currentSlot;
      if (which === 'next') next = (currentSlot + 1) % slots.length;
      else if (which === 'prev') next = (currentSlot + slots.length - 1) % slots.length;
      else next = Math.max(0, Math.min(slots.length - 1, which));
      if (next === currentSlot) return;
      slots[currentSlot].reloadUntil = 0; // cancel reload on switch
      currentSlot = next;
      hud.setWeapon(slot().id);
      hud.setAmmo(slot().ammo, false);
      viewmodel.setWeapon(slot().id);
    },

    triggerDown() {
      fire();
    },

    triggerUp() {},

    reload,

    placeBlock() {
      const placement = placementCell();
      if (!placement) return;
      net.send({ t: 'place', k: placement.key });
    },

    updateGhost() {
      const placement = placementCell();
      if (!placement) {
        ghost.visible = false;
        return;
      }
      const s = BLOCKS.size;
      ghost.position.set(
        (placement.cell.ix + 0.5) * s,
        (placement.cell.iy + 0.5) * s,
        (placement.cell.iz + 0.5) * s
      );
      ghost.visible = true;
    },

    setGhostVisible(visible) {
      if (!visible) ghost.visible = false;
    },

    update(dt, fireHeld) {
      if (fireHeld && weapon().auto) fire();
    },

    updateEffects(dt) {
      viewmodel.updateEffects(dt);
    }
  };
}
