import test from 'node:test';
import assert from 'node:assert/strict';

import {
  deadeyeCandidates,
  handleFire,
  handleThrow,
  reloadRemainingForWeapon,
  resolveLockedHostile,
  spawnProjectile,
  syncWeaponAmmoState
} from '../../../cloudflare/server/room/RoomCombatRuntime.js';

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
    aimOrigin: { x: 0.2, y: 1.8, z: -0.2 },
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
  assert.deepEqual(shotRequest.aimOrigin, { x: 0.2, y: 1.8, z: -0.2 });
  assert.ok(shotRequest.aimForward.z < 0);
  assert.deepEqual(sent, [{
    ownerId: 'p1',
    hitTargetId: 't1',
    out: { killed: false },
    hitType: 'head',
    weaponId: 'pistol'
  }]);
});

test('combat runtime rewinds targets and clamps far client aim origins to the authoritative eye', () => {
  const target = { id: 't1', alive: true, x: 20, y: 1.7, z: -8 };
  const player = {
    id: 'p1',
    alive: true,
    x: 0,
    y: 1.7,
    z: 0,
    yaw: 0,
    pitch: 0,
    lastShotAt: {},
    weaponId: 'rifle'
  };
  let shotRequest = null;
  let rewoundAt = 0;
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
    weaponId: 'rifle',
    shotToken: 'rw1',
    estimatedServerShotTime: 1234,
    aimOrigin: { x: 9, y: 9, z: 9 },
    aimForward: { x: 0, y: 0, z: -1 }
  }, {
    nowMs: () => 1500,
    weaponStats: { rifle: { cooldownMs: 100, magazineSize: 10 } },
    weaponFalloff: { rifle: [] },
    resolveHitscanShot(options) {
      shotRequest = options;
      return [];
    },
    applyDamageFromSource() { return null; },
    broadcastDamageEvent() {},
    broadcastDeathRespawn() {},
    canEquipWeaponId() { return true; },
    resolveHitscanShotTime() { return 1260; },
    buildRewoundHitscanTarget(entity, requestedShotTime) {
      rewoundAt = requestedShotTime;
      return {
        ...entity,
        x: 4,
        y: 1.7,
        z: -3,
        bodyBox: {
          min: { x: 3, y: 1, z: -4 },
          max: { x: 5, y: 2, z: -2 }
        },
        headBox: {
          min: { x: 3.7, y: 1.4, z: -3.4 },
          max: { x: 4.3, y: 1.9, z: -2.8 }
        }
      };
    },
    authoritativeHitscanOrigin() {
      return { x: 0, y: 1.7, z: 0 };
    },
    hitscanAimOriginMaxOffset: 0.9,
    playerEyeHeight: 1.7,
    remoteMuzzleFlashHoldMs: 90
  });

  assert.equal(rewoundAt, 1260);
  assert.deepEqual(shotRequest.aimOrigin, { x: 0, y: 1.7, z: 0 });
  assert.equal(shotRequest.targets.length, 1);
  assert.equal(shotRequest.targets[0].x, 4);
  assert.deepEqual(shotRequest.targets[0].bodyBox, {
    min: { x: 3, y: 1, z: -4 },
    max: { x: 5, y: 2, z: -2 }
  });
});

test('combat runtime applies rewound hits to the live room entity instead of the rewound clone', () => {
  const liveTarget = { id: 't1', alive: true, hp: 500, armor: 90, x: 0, y: 1.7, z: -6 };
  const rewoundClone = {
    ...liveTarget,
    x: 4,
    y: 1.7,
    z: -3,
    bodyBox: {
      min: { x: 3, y: 1, z: -4 },
      max: { x: 5, y: 2, z: -2 }
    },
    headBox: {
      min: { x: 3.7, y: 1.4, z: -3.4 },
      max: { x: 4.3, y: 1.9, z: -2.8 }
    }
  };
  const player = {
    id: 'p1',
    alive: true,
    x: 0,
    y: 1.7,
    z: 0,
    yaw: 0,
    pitch: 0,
    lastShotAt: {},
    lastShotTokenByWeapon: {},
    muzzleFlashUntil: 0,
    weaponId: 'rifle'
  };
  const appliedTargets = [];
  const broadcastTargets = [];
  const room = {
    canEntityUseWeapon() { return true; },
    syncWeaponAmmoState() { return { ammoInMag: 10, reloadUntil: 0, reloadedFlashUntil: 0 }; },
    reloadRemainingForWeapon() { return 0; },
    beginWeaponReload() { throw new Error('should not reload'); },
    consumeWeaponAmmo() {},
    entityForward() { return { x: 0, y: 0, z: -1 }; },
    getAliveEntities() { return [liveTarget]; },
    getEntityById(id) { return id === liveTarget.id ? liveTarget : null; },
    canTargetEntity(entity, sourceId) { return !!entity && entity.id !== sourceId; },
    worldCollidables() { return []; }
  };

  handleFire(room, player, {
    weaponId: 'rifle',
    shotToken: 'rewind-live-target'
  }, {
    nowMs: () => 400,
    weaponStats: {
      rifle: { cooldownMs: 100, magazineSize: 10, pellets: 1 }
    },
    weaponFalloff: { rifle: [] },
    buildRewoundHitscanTarget() {
      return rewoundClone;
    },
    resolveHitscanShot() {
      return [{ target: rewoundClone, damage: 104, hitType: 'head' }];
    },
    applyDamageFromSource(_source, target, damage, options) {
      appliedTargets.push({ target, damage, hitType: options.hitType });
      return { killed: false, damageApplied: damage };
    },
    broadcastDamageEvent(_room, ownerId, target, out, hitType, weaponId, shotToken) {
      broadcastTargets.push({ ownerId, target, out, hitType, weaponId, shotToken });
    },
    broadcastDeathRespawn() {},
    canEquipWeaponId() { return true; },
    playerEyeHeight: 1.7,
    remoteMuzzleFlashHoldMs: 90
  });

  assert.equal(appliedTargets.length, 1);
  assert.equal(appliedTargets[0].target, liveTarget);
  assert.equal(appliedTargets[0].target, broadcastTargets[0].target);
  assert.equal(appliedTargets[0].target === rewoundClone, false);
  assert.equal(appliedTargets[0].damage, 104);
  assert.equal(appliedTargets[0].hitType, 'head');
});

test('combat runtime aggregates multi-pellet shotgun hits per target by shot token', () => {
  const target = { id: 't1', alive: true, x: 0, y: 1.7, z: -6 };
  const player = {
    id: 'p1',
    alive: true,
    x: 0,
    y: 1.7,
    z: 0,
    yaw: 0,
    pitch: 0,
    lastShotAt: {},
    weaponId: 'shotgun'
  };
  const broadcasts = [];
  const applied = [];
  const room = {
    canEntityUseWeapon() { return true; },
    syncWeaponAmmoState() { return { ammoInMag: 6, reloadUntil: 0, reloadedFlashUntil: 0 }; },
    reloadRemainingForWeapon() { return 0; },
    beginWeaponReload() { throw new Error('should not reload'); },
    consumeWeaponAmmo() {},
    entityForward() { return { x: 0, y: 0, z: -1 }; },
    getAliveEntities() { return [target]; },
    canTargetEntity(entity, sourceId) { return !!entity && entity.id !== sourceId; },
    worldCollidables() { return []; }
  };

  handleFire(room, player, {
    weaponId: 'shotgun',
    shotToken: 'sg1'
  }, {
    nowMs: () => 400,
    weaponStats: {
      shotgun: {
        cooldownMs: 100,
        magazineSize: 6,
        pellets: 12,
        singleHitFromPellets: false
      }
    },
    weaponFalloff: { shotgun: [] },
    resolveHitscanShot() {
      return [
        { target, damage: 17, hitType: 'body' },
        { target, damage: 25, hitType: 'head' }
      ];
    },
    applyDamageFromSource(_source, _target, damage, options) {
      applied.push({ damage, hitType: options.hitType });
      return { killed: false, damageApplied: damage };
    },
    broadcastDamageEvent(_room, ownerId, hitTarget, out, hitType, weaponId, shotToken) {
      broadcasts.push({ ownerId, hitTargetId: hitTarget.id, out, hitType, weaponId, shotToken });
    },
    broadcastDeathRespawn() {},
    canEquipWeaponId() { return true; },
    playerEyeHeight: 1.7,
    shotTokenDamageAggregation: true,
    remoteMuzzleFlashHoldMs: 90
  });

  assert.deepEqual(applied, [{ damage: 42, hitType: 'head' }]);
  assert.deepEqual(broadcasts, [{
    ownerId: 'p1',
    hitTargetId: 't1',
    out: { killed: false, damageApplied: 42 },
    hitType: 'head',
    weaponId: 'shotgun',
    shotToken: 'sg1'
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

test('deadeyeCandidates prefers the target closest to the player aim line over raw distance', () => {
  const centered = { id: 'center', alive: true, x: 0, y: 1.7, z: -10 };
  const offCenterNear = { id: 'near', alive: true, x: 3, y: 1.7, z: -5 };
  const player = { id: 'p1', alive: true, x: 0, y: 1.7, z: 0, yaw: 0, pitch: 0 };
  const room = {
    hostilesInCone() {
      return [
        { entity: offCenterNear, dist: 5.83 },
        { entity: centered, dist: 10 }
      ];
    },
    entityAimTargetPosition(entity) {
      return { x: entity.x, y: entity.y, z: entity.z };
    },
    entityForward() {
      return { x: 0, y: 0, z: -1 };
    },
    hasWorldLineOfSight() {
      return true;
    }
  };

  const picks = deadeyeCandidates(room, player, 70, 0.22, 2);

  assert.deepEqual(picks.map((item) => item.id), ['center', 'near']);
});
