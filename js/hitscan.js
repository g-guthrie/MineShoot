import { gameplayTuning } from '../shared/gameplay-tuning.js';
import { GameCombatTuning } from './combat-tuning.js';
import { GameNet } from './network.js';
import { GamePlayer } from './player.js';
import { GameWorld } from './world.js';

const THREE = globalThis.THREE;

/**
 * hitscan.js - Rifle-only hitscan runtime
 */

export const GameHitscan = {};

const raycaster = new THREE.Raycaster();
let tracerScene = null;
const tracerMaxCount = 48;
const tracerPool = [];
let tracerCursor = 0;
let tracerInstancedMesh = null;
let tracerPoolReady = false;
const tracerZeroMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
const tracerTmpMatrix = new THREE.Matrix4();
const tracerTmpPos = new THREE.Vector3();
const tracerTmpQuat = new THREE.Quaternion();
const tracerTmpScale = new THREE.Vector3();
const tracerMid = new THREE.Vector3();
const tracerUp = new THREE.Vector3(0, 1, 0);
const muzzlePos = new THREE.Vector3();
const forwardDir = new THREE.Vector3();
const missEnd = new THREE.Vector3();
const screenPoint = new THREE.Vector2(0, 0);

const weaponStats = gameplayTuning.weaponStats && gameplayTuning.weaponStats.rifle ? gameplayTuning.weaponStats.rifle : {
  id: 'rifle',
  name: 'Rifle',
  primitiveType: 'hitscan_single',
  automatic: false,
  cooldownMs: 260,
  bodyDamage: 44,
  headDamage: 104,
  maxRange: 110,
  hipfireSpread: 0.024,
  adsSpread: 0,
  adsSpreadMultiplier: 0,
  adsHitscanRangeMultiplier: 1.2,
  adsFovDeg: 56
};
const weaponFalloff = (gameplayTuning.weaponFalloff && gameplayTuning.weaponFalloff.rifle)
  ? gameplayTuning.weaponFalloff.rifle.slice()
  : [];
let lastFireTime = 0;

function activeWeapon() {
  return {
    id: 'rifle',
    name: String(weaponStats.name || 'Rifle'),
    primitiveType: 'hitscan_single',
    automatic: !!weaponStats.automatic,
    cooldown: Number(weaponStats.cooldownMs || 0),
    bodyDamage: Number(weaponStats.bodyDamage || 0),
    headDamage: Number(weaponStats.headDamage || 0),
    pellets: 1,
    hipfireSpread: Number(weaponStats.hipfireSpread || 0),
    adsSpread: Number(weaponStats.adsSpread != null ? weaponStats.adsSpread : weaponStats.hipfireSpread || 0),
    adsSpreadMultiplier: Number(weaponStats.adsSpreadMultiplier || 0),
    adsFovDeg: Number(weaponStats.adsFovDeg || 56),
    adsHitscanRangeMultiplier: Number(weaponStats.adsHitscanRangeMultiplier || 1),
    maxRange: getEffectiveMaxRange()
  };
}

function getPlayerApi() {
  return GamePlayer;
}

function getWorldApi() {
  return GameWorld;
}

function adsState() {
  const playerApi = getPlayerApi();
  return playerApi && playerApi.getAdsState ? playerApi.getAdsState() : null;
}

function isAdsActive() {
  const state = adsState();
  return !!(state && state.active);
}

function getBaseRange() {
  if (GameCombatTuning && GameCombatTuning.getWeaponRange) {
    return Number(GameCombatTuning.getWeaponRange('rifle') || 0);
  }
  return Number(weaponStats.maxRange || 0);
}

function getEffectiveMaxRange() {
  const base = getBaseRange();
  if (!isAdsActive()) return base;
  return base * Math.max(1, Number(weaponStats.adsHitscanRangeMultiplier || 1));
}

function spreadMetrics() {
  const spread = isAdsActive()
    ? Number(weaponStats.adsSpread != null ? weaponStats.adsSpread : 0)
    : Number(weaponStats.hipfireSpread || 0);
  if (!isFinite(spread) || spread <= 0.00001) {
    return { radiusPx: 0, radiusXpx: 0, radiusYpx: 0 };
  }
  return {
    radiusPx: spread * (window.innerHeight * 0.5),
    radiusXpx: spread * (window.innerWidth * 0.5),
    radiusYpx: spread * (window.innerHeight * 0.5)
  };
}

function randomSpreadOffsetNdc() {
  const metrics = spreadMetrics();
  if (!metrics.radiusPx) return { x: 0, y: 0 };
  const angle = Math.random() * Math.PI * 2;
  const radius = Math.sqrt(Math.random()) * metrics.radiusPx;
  return {
    x: (Math.cos(angle) * radius) / (window.innerWidth * 0.5),
    y: -((Math.sin(angle) * radius) / (window.innerHeight * 0.5))
  };
}

function getCombatHitboxes() {
  return GameNet.getHitboxArray ? (GameNet.getHitboxArray() || []) : [];
}

function applyFalloff(damage, distance) {
  const profile = GameCombatTuning && GameCombatTuning.getWeaponFalloffTuning
    ? GameCombatTuning.getWeaponFalloffTuning('rifle')
    : weaponFalloff;
  if (!Array.isArray(profile) || profile.length === 0) return Math.max(1, Math.round(damage));
  for (let i = 0; i < profile.length; i++) {
    const band = profile[i];
    if (!band || typeof band.maxDistance !== 'number' || typeof band.scale !== 'number') continue;
    if (distance <= band.maxDistance) {
      return Math.max(1, Math.round(damage * Math.max(0, band.scale)));
    }
  }
  const tail = profile[profile.length - 1];
  return Math.max(1, Math.round(damage * Math.max(0, Number(tail && tail.scale) || 1)));
}

function ensureTracerScene(camera) {
  if (tracerScene) return tracerScene;
  if (camera && camera.parent) {
    tracerScene = camera.parent;
    return tracerScene;
  }
  return null;
}

function initTracerPool(camera) {
  if (tracerPoolReady) return true;
  if (!ensureTracerScene(camera)) return false;

  const geometry = new THREE.CylinderGeometry(0.03, 0.03, 0.75, 8);
  const material = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 1,
    depthWrite: false,
    depthTest: false
  });

  tracerInstancedMesh = new THREE.InstancedMesh(geometry, material, tracerMaxCount);
  tracerInstancedMesh.frustumCulled = false;
  tracerInstancedMesh.renderOrder = 40;

  for (let i = 0; i < tracerMaxCount; i++) {
    tracerInstancedMesh.setMatrixAt(i, tracerZeroMatrix);
    tracerPool.push({
      origin: new THREE.Vector3(),
      dir: new THREE.Vector3(),
      head: new THREE.Vector3(),
      tail: new THREE.Vector3(),
      speed: 280,
      segmentLength: 1.25,
      traveled: 0,
      maxDistance: 0,
      life: 0,
      maxLife: 0.11,
      framesAlive: 0
    });
  }

  tracerInstancedMesh.instanceMatrix.needsUpdate = true;
  tracerScene.add(tracerInstancedMesh);
  tracerPoolReady = true;
  return true;
}

function spawnTracer(camera, endPoint) {
  if (!camera || !endPoint) return;
  if (!initTracerPool(camera)) return;

  tracerCursor = (tracerCursor + 1) % tracerMaxCount;
  const tracer = tracerPool[tracerCursor];
  resolveMuzzle(camera);
  tracer.origin.copy(muzzlePos);
  tracer.dir.copy(endPoint).sub(muzzlePos);
  const len = tracer.dir.length();
  if (len <= 0.001) return;
  tracer.dir.divideScalar(len);
  tracer.head.copy(tracer.origin);
  tracer.tail.copy(tracer.origin);
  tracer.traveled = 0;
  tracer.maxDistance = len;
  tracer.framesAlive = 0;
  tracer.maxLife = 0.11;
  tracer.life = tracer.maxLife;
  tracer.speed = 280;
  tracer.segmentLength = 1.25;
}

function resolveMuzzle(camera) {
  const playerApi = getPlayerApi();
  if (playerApi && playerApi.getMuzzleWorldPosition) {
    const pos = playerApi.getMuzzleWorldPosition();
    if (pos && typeof pos.x === 'number') {
      muzzlePos.copy(pos);
      return muzzlePos;
    }
  }
  camera.getWorldDirection(forwardDir);
  muzzlePos.copy(camera.position).addScaledVector(forwardDir, 0.65);
  return muzzlePos;
}

function castRay(camera, ndcX, ndcY, maxRange) {
  const hitboxes = getCombatHitboxes();
  const worldApi = getWorldApi();
  const worldMeshes = worldApi && worldApi.getCollidables ? worldApi.getCollidables() : [];
  const objects = hitboxes.concat(worldMeshes);
  if (!objects.length) return null;

  screenPoint.set(ndcX, ndcY);
  raycaster.setFromCamera(screenPoint, camera);
  raycaster.far = maxRange;

  const hits = raycaster.intersectObjects(objects, false);
  if (!hits.length) {
    missEnd.copy(raycaster.ray.origin).addScaledVector(raycaster.ray.direction, maxRange);
    return { hit: false, point: missEnd.clone() };
  }

  for (let i = 0; i < hits.length; i++) {
    const hit = hits[i];
    if (hitboxes.indexOf(hit.object) !== -1) {
      return {
        hit: true,
        hitbox: hit.object,
        point: hit.point.clone ? hit.point.clone() : hit.point,
        distance: hit.distance,
        hitType: hit.object.userData.type || 'body'
      };
    }
    if (worldMeshes.indexOf(hit.object) !== -1) {
      return {
        hit: false,
        point: hit.point.clone ? hit.point.clone() : hit.point
      };
    }
  }

  return null;
}

GameHitscan.fire = function fire(camera, onHit, onMiss) {
  const now = performance.now();
  if ((now - lastFireTime) < Number(weaponStats.cooldownMs || 0)) return false;
  lastFireTime = now;

  const offset = randomSpreadOffsetNdc();
  const range = getEffectiveMaxRange();
  const cast = castRay(camera, offset.x, offset.y, range);
  if (!cast) {
    if (onMiss) onMiss();
    return true;
  }

  spawnTracer(camera, cast.point);
  if (!cast.hit) {
    if (onMiss) onMiss();
    return true;
  }

  let damage = cast.hitType === 'head'
    ? Number(weaponStats.headDamage || 0)
    : Number(weaponStats.bodyDamage || 0);
  damage = applyFalloff(damage, cast.distance || 0);

  if (onHit) {
    onHit(cast.hitbox, cast.point, cast.distance || 0, cast.hitType, damage, activeWeapon());
  }
  return true;
};

GameHitscan.getCurrentWeapon = function getCurrentWeapon() {
  return activeWeapon();
};

GameHitscan.getReticleSpec = function getReticleSpec() {
  return null;
};

GameHitscan.getWeaponOrder = function getWeaponOrder() {
  return ['rifle'];
};

GameHitscan.setWeapon = function setWeapon(weaponId) {
  return String(weaponId || 'rifle') === 'rifle' ? activeWeapon() : null;
};

GameHitscan.cycleWeapon = function cycleWeapon() {
  return activeWeapon();
};

GameHitscan.setWeaponOrder = function setWeaponOrder() {
  return ['rifle'];
};

GameHitscan.equipSlot = function equipSlot(slotIndex) {
  return Number(slotIndex) === 0 ? activeWeapon() : null;
};

GameHitscan.getAllWeaponIds = function getAllWeaponIds() {
  return ['rifle'];
};

GameHitscan.getHeadDamage = function getHeadDamage() {
  return Number(weaponStats.headDamage || 0);
};

GameHitscan.getBodyDamage = function getBodyDamage() {
  return Number(weaponStats.bodyDamage || 0);
};

GameHitscan.getCooldown = function getCooldown() {
  return Number(weaponStats.cooldownMs || 0);
};

GameHitscan.canFire = function canFire() {
  return (performance.now() - lastFireTime) >= Number(weaponStats.cooldownMs || 0);
};

GameHitscan.cooldownRemaining = function cooldownRemaining() {
  return Math.max(0, Number(weaponStats.cooldownMs || 0) - (performance.now() - lastFireTime));
};

GameHitscan.peekCenterTarget = function peekCenterTarget(camera, maxRange) {
  const cast = castRay(camera, 0, 0, typeof maxRange === 'number' && maxRange > 0 ? maxRange : getEffectiveMaxRange());
  if (!cast || !cast.hit) return null;
  return {
    hitbox: cast.hitbox,
    hitType: cast.hitType || 'body',
    targetId: cast.hitbox && cast.hitbox.userData ? cast.hitbox.userData.targetId || '' : '',
    distance: cast.distance || 0,
    point: cast.point
  };
};

GameHitscan.tick = function tick() {
  return null;
};

GameHitscan.updateTracers = function updateTracers(dt) {
  if (!dt || !tracerPoolReady || !tracerPool.length) return;
  const simDt = Math.min(dt, 1 / 30);
  let matrixDirty = false;
  for (let i = 0; i < tracerPool.length; i++) {
    const tracer = tracerPool[i];
    if (!tracer || tracer.life <= 0) continue;
    tracer.life -= simDt;
    tracer.framesAlive++;
    tracer.traveled += tracer.speed * simDt;
    if (tracer.traveled > tracer.maxDistance) tracer.traveled = tracer.maxDistance;
    tracer.head.copy(tracer.origin).addScaledVector(tracer.dir, tracer.traveled);
    tracer.tail.copy(tracer.origin).addScaledVector(tracer.dir, Math.max(0, tracer.traveled - tracer.segmentLength));
    tracerMid.copy(tracer.tail).add(tracer.head).multiplyScalar(0.5);

    const dead = tracer.life <= 0 || (tracer.traveled >= tracer.maxDistance && tracer.framesAlive > 1);
    if (dead) {
      tracer.life = 0;
      tracerInstancedMesh.setMatrixAt(i, tracerZeroMatrix);
      matrixDirty = true;
      continue;
    }

    tracerTmpPos.copy(tracerMid);
    tracerTmpQuat.setFromUnitVectors(tracerUp, tracer.dir);
    tracerTmpScale.set(1, Math.max(0.05, tracer.segmentLength * 0.82), 1);
    tracerTmpMatrix.compose(tracerTmpPos, tracerTmpQuat, tracerTmpScale);
    tracerInstancedMesh.setMatrixAt(i, tracerTmpMatrix);
    matrixDirty = true;
  }
  if (matrixDirty) tracerInstancedMesh.instanceMatrix.needsUpdate = true;
};

GameHitscan.getWeaponCatalog = function getWeaponCatalog() {
  return [activeWeapon()];
};

GameHitscan.getSpreadRadiusPx = function getSpreadRadiusPx() {
  return spreadMetrics().radiusPx || 0;
};
