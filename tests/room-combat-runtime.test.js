import test from 'node:test';
import assert from 'node:assert/strict';

import {
  handleFire,
  handleThrow,
  reloadRemainingForWeapon,
  resolveLockedHostile,
  spawnProjectile,
  syncWeaponAmmoState
} from '../cloudflare/server/room/RoomCombatRuntime.js';

test('combat runtime weapon ammo helpers reload and expose remaining time', () => {
  const room = {
    syncWeaponAmmoState(entity, weaponId, now) {
      return syncWeaponAmmoState(this, entity, weaponId, now, {
        weaponStats: { rifle: { magazineSize: 30, reloadMs: 1200 } },
        createWeaponAmmoRuntime() { return { rifle: { ammoInMag: 30, reloadUntil: 0, reloadedFlashUntil: 0 } }; },
        defaultWeaponLoadout: ['rifle'],
        reloadedFlashHoldMs: 900
      });
    }
  };
  const entity = { weaponLoadout: ['rifle'] };
  const ammo = room.syncWeaponAmmoState(entity, 'rifle', 100);
  ammo.reloadUntil = 1300;
  assert.equal(reloadRemainingForWeapon(room, entity, 'rifle', 200), 1100);
  const after = room.syncWeaponAmmoState(entity, 'rifle', 1300);
  assert.equal(after.ammoInMag, 30);
  assert.equal(after.reloadedFlashUntil, 2200);
});

test('combat runtime resolves locked hostiles and handles throw/fire envelopes', () => {
  const target = { id: 't1', alive: true, x: 4, y: 1.7, z: 0 };
  const player = {
    id: 'p1',
    alive: true,
    x: 0,
    y: 1.7,
    z: 0,
    yaw: -Math.PI / 2,
    pitch: 0,
    lastShotAt: {},
    weaponId: 'rifle'
  };
  const sent = [];
  const broadcasts = [];
  const room = {
    projectiles: new Map(),
    nextProjectileSeq: 1,
    getEntityById(id) { return id === 't1' ? target : null; },
    canTargetEntity(entity, sourceId) { return !!entity && entity.id !== sourceId; },
    entityForward() { return { x: 1, y: 0, z: 0 }; },
    entityAimTargetPosition(entity) { return { x: entity.x, y: entity.y, z: entity.z }; },
    hasWorldLineOfSight() { return true; },
    readClassAimPoint() { return { x: 4, y: 1.7, z: 0 }; },
    canEntityUseThrowable() { return true; },
    consumeThrowCharge() { return true; },
    spawnProjectile(playerArg, throwableId, clientThrowId) {
      return { id: 'proj_1', ownerId: playerArg.id, clientThrowId, type: throwableId };
    },
    send(_ws, payload) { sent.push(payload); },
    broadcast(payload) { broadcasts.push(payload); },
    canEntityUseWeapon() { return true; },
    syncWeaponAmmoState() { return { ammoInMag: 5, reloadUntil: 0, reloadedFlashUntil: 0 }; },
    reloadRemainingForWeapon() { return 0; },
    beginWeaponReload() { throw new Error('should not reload'); },
    consumeWeaponAmmo() {},
    entityForward() { return { x: 1, y: 0, z: 0 }; },
    getAliveEntities() { return [target]; },
    worldCollidables() { return []; }
  };

  const locked = resolveLockedHostile(room, player, 't1', 10, 0.1, { requireLos: true, aimPoint: { x: 4, y: 1.7, z: 0 }, targetTolerance: 1 }, {
    distance3(a, b) {
      const dx = a.x - b.x; const dy = a.y - b.y; const dz = a.z - b.z;
      return Math.sqrt(dx * dx + dy * dy + dz * dz);
    },
    normalize3(x, y, z) {
      const len = Math.sqrt(x * x + y * y + z * z) || 1;
      return { x: x / len, y: y / len, z: z / len };
    },
    dot3(a, b) { return (a.x * b.x) + (a.y * b.y) + (a.z * b.z); },
    playerEyeHeight: 1.7
  });
  assert.equal(locked, target);

  handleThrow(room, player, { throwableId: 'frag', clientThrowId: 'c1', throwIntent: null }, null, {
    normalizeThrowPayload(throwableId, clientThrowId) { return { throwableId, clientThrowId, throwIntent: null }; },
    throwableStats: { frag: { regen: 5 } },
    nowMs: () => 100,
    msgThrowReject: 'throw_reject',
    msgThrowSpawn: 'throw_spawn',
    remoteMuzzleFlashHoldMs: 90
  });
  assert.deepEqual(broadcasts, [{ t: 'throw_spawn', projectileId: 'proj_1', ownerId: 'p1', clientThrowId: 'c1', throwableId: 'frag' }]);

  handleFire(room, player, { weaponId: 'rifle', shotToken: 's1' }, {
    nowMs: () => 200,
    weaponStats: { rifle: { cooldownMs: 100, magazineSize: 30 } },
    weaponFalloff: { rifle: [] },
    resolveHitscanShot() { return [{ target, damage: 12, hitType: 'body' }]; },
    applyDamageFromSource() { return { killed: false }; },
    broadcastDamageEvent(_room, ownerId) { sent.push({ ownerId }); },
    broadcastDeathRespawn() {},
    canEquipWeaponId() { return true; },
    playerEyeHeight: 1.7,
    remoteMuzzleFlashHoldMs: 90
  });
  assert.deepEqual(sent, [{ ownerId: 'p1' }]);
});

test('combat runtime applies pistol shared shot results without a special server branch', () => {
  const target = { id: 't1', alive: true, x: 0, y: 1.7, z: -8 };
  const player = {
    id: 'p1',
    alive: true,
    x: 0,
    y: 1.7,
    z: 0,
    yaw: 0,
    pitch: 0,
    lastShotAt: {},
    weaponId: 'pistol'
  };
  const sent = [];
  let shotRequest = null;
  const room = {
    canEntityUseWeapon() { return true; },
    syncWeaponAmmoState() { return { ammoInMag: 10, reloadUntil: 0, reloadedFlashUntil: 0 }; },
    reloadRemainingForWeapon() { return 0; },
    beginWeaponReload() { throw new Error('should not reload'); },
    consumeWeaponAmmo() {},
    entityForward() { return { x: 0, y: 0, z: -1 }; },
    getAliveEntities() { return [target]; },
    canTargetEntity(entity, sourceId) { return !!entity && entity.id !== sourceId; },
    worldCollidables() { return []; }
  };

  handleFire(room, player, {
    weaponId: 'pistol',
    shotToken: 'sp1',
    aimOrigin: { x: 1, y: 2, z: 3 },
    aimForward: { x: 0, y: 0.2, z: -1 }
  }, {
    nowMs: () => 300,
    weaponStats: {
      pistol: {
        cooldownMs: 100,
        magazineSize: 10,
        pellets: 12,
        singleHitFromPellets: true
      }
    },
    weaponFalloff: { pistol: [] },
    resolveHitscanShot(options) {
      shotRequest = options;
      return [{
        target,
        damage: 46,
        hitType: 'head'
      }];
    },
    applyDamageFromSource() { return { killed: false }; },
    broadcastDamageEvent(_room, ownerId, hitTarget, out, hitType, weaponId) {
      sent.push({ ownerId, hitTargetId: hitTarget.id, out, hitType, weaponId });
    },
    broadcastDeathRespawn() {},
    canEquipWeaponId() { return true; },
    playerEyeHeight: 1.7,
    remoteMuzzleFlashHoldMs: 90
  });

  assert.equal(shotRequest.shotToken, 'sp1');
  assert.equal(shotRequest.weaponStats.id, 'pistol');
  assert.equal(shotRequest.weaponStats.singleHitFromPellets, true);
  assert.deepEqual(shotRequest.aimOrigin, { x: 1, y: 2, z: 3 });
  assert.ok(shotRequest.aimForward.z < 0);
  assert.deepEqual(sent, [{
    ownerId: 'p1',
    hitTargetId: 't1',
    out: { killed: false },
    hitType: 'head',
    weaponId: 'pistol'
  }]);
});

test('spawnProjectile uses the full aim vector so trajectory changes with pitch', () => {
  const room = {
    projectiles: new Map(),
    nextProjectileSeq: 1,
    validateThrowIntent() {
      return {
        origin: { x: 1, y: 2, z: 3 },
        direction: { x: 0, y: 0.6, z: -0.8 }
      };
    }
  };

  const projectile = spawnProjectile(room, { id: 'p1' }, 'frag', 'c1', null, null, {
    throwableStats: {
      frag: { speed: 22.5, upward: 5.2, hitRadius: 1.2, fuse: 2.2 }
    },
    nowMs: () => 100
  });

  assert.equal(projectile.x, 1);
  assert.equal(projectile.y, 2);
  assert.equal(projectile.z, 3);
  assert.equal(projectile.vx, 0);
  assert.equal(projectile.vy, 18.7);
  assert.equal(projectile.vz, -18);
});
