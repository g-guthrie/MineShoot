import test from 'node:test';
import assert from 'node:assert/strict';
import { logicalHitscanOriginFromEye, logicalMuzzleOriginFromEye } from '../../../shared/entity-points.js';
import { broadcastRoomShotEffect, buildShotEffectPayload } from '../../../cloudflare/server/room/RoomBroadcast.js';

import {
  beginWeaponReload,
  canTargetEntity,
  handleFire,
  handleEquipWeapon,
  handleReload,
  handleRoll,
  handleThrow,
  isEntityRolling,
  reloadRemainingForWeapon,
  resolveLockedHostile,
  spawnProjectile,
  syncWeaponAmmoState
} from '../../../cloudflare/server/room/RoomCombatRuntime.js';

test('combat runtime does not target players lingering in disconnect grace', () => {
  const room = {
    isEntityDisconnected(entity) {
      return !!(entity && entity.disconnectedAt);
    },
    isEntitySpawnShielded() {
      return false;
    }
  };

  assert.equal(canTargetEntity(room, {
    id: 'u1',
    alive: true,
    disconnectedAt: 1234
  }, 'u2'), false);

  assert.equal(canTargetEntity(room, {
    id: 'u1',
    alive: true,
    disconnectedAt: 0
  }, 'u2'), true);
});

test('combat runtime does not target same-team players in TDM', () => {
  const room = {
    gameMode: 'tdm',
    players: new Map([
      ['u1', { id: 'u1', alive: true, teamId: 'alpha' }],
      ['u2', { id: 'u2', alive: true, teamId: 'alpha' }],
      ['u3', { id: 'u3', alive: true, teamId: 'bravo' }]
    ]),
    getEntityById(id) {
      return this.players.get(id) || null;
    },
    isEntitySpawnShielded() {
      return false;
    }
  };

  assert.equal(canTargetEntity(room, room.players.get('u2'), 'u1'), false);
  assert.equal(canTargetEntity(room, room.players.get('u3'), 'u1'), true);
});

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

test('combat runtime only starts manual reload when the magazine is not already full', () => {
  const weaponStats = { rifle: { magazineSize: 30, reloadMs: 1200 } };
  const room = {
    syncWeaponAmmoState(entity, weaponId, now) {
      return syncWeaponAmmoState(this, entity, weaponId, now, {
        weaponStats,
        createWeaponAmmoRuntime() { return { rifle: { ammoInMag: 30, reloadUntil: 0, reloadedFlashUntil: 0 } }; },
        defaultWeaponLoadout: ['rifle'],
        reloadedFlashHoldMs: 900
      });
    }
  };
  const entity = { weaponLoadout: ['rifle'] };

  assert.equal(beginWeaponReload(room, entity, 'rifle', 100, { weaponStats }), false);

  const ammo = room.syncWeaponAmmoState(entity, 'rifle', 100);
  ammo.ammoInMag = 7;

  assert.equal(beginWeaponReload(room, entity, 'rifle', 100, { weaponStats }), true);
  assert.equal(ammo.reloadUntil, 1300);
});

test('combat runtime keeps per-weapon reload progress alive when the player equips another weapon', () => {
  const weaponStats = {
    rifle: { magazineSize: 30, reloadMs: 1200 },
    sniper: { magazineSize: 5, reloadMs: 1800 }
  };
  const room = {
    syncWeaponAmmoState(entity, weaponId, now) {
      return syncWeaponAmmoState(this, entity, weaponId, now, {
        weaponStats,
        createWeaponAmmoRuntime() {
          return {
            rifle: { ammoInMag: 30, reloadUntil: 0, reloadedFlashUntil: 0 },
            sniper: { ammoInMag: 5, reloadUntil: 0, reloadedFlashUntil: 0 }
          };
        },
        defaultWeaponLoadout: ['rifle', 'sniper'],
        reloadedFlashHoldMs: 900
      });
    }
  };
  const player = { weaponLoadout: ['rifle', 'sniper'], weaponId: 'rifle' };
  const rifleAmmo = room.syncWeaponAmmoState(player, 'rifle', 100);
  rifleAmmo.ammoInMag = 7;

  assert.equal(beginWeaponReload(room, player, 'rifle', 100, { weaponStats }), true);

  handleEquipWeapon(room, player, { weaponId: 'sniper' }, {
    weaponStats,
    canEquipWeaponId() { return true; }
  });

  assert.equal(player.weaponId, 'sniper');
  assert.equal(reloadRemainingForWeapon(room, player, 'rifle', 200), 1100);
  assert.equal(reloadRemainingForWeapon(room, player, 'sniper', 200), 0);

  const after = room.syncWeaponAmmoState(player, 'rifle', 1300);
  assert.equal(after.ammoInMag, 30);
  assert.equal(after.reloadUntil, 0);
});

test('combat runtime starts an authoritative roll window from the reported movement direction', () => {
  const room = {
    isEntityMovementLocked() {
      return false;
    }
  };
  const player = {
    alive: true,
    isGrounded: true,
    rollStartedAt: 0,
    rollUntil: 0,
    rollInputState: null
  };

  assert.equal(handleRoll(room, player, {
    movingForward: false,
    movingBackward: true,
    movingLeft: false,
    movingRight: true
  }, {
    nowMs: () => 1000
  }), true);
  assert.equal(player.rollStartedAt, 1000);
  assert.equal(player.rollUntil, 1520);
  assert.deepEqual(player.rollInputState, {
    movingForward: false,
    movingBackward: true,
    movingLeft: false,
    movingRight: true
  });
  assert.equal(isEntityRolling(player, 1200), true);
  assert.equal(isEntityRolling(player, 1600), false);
});

test('combat runtime refuses to start an authoritative roll without movement intent', () => {
  const room = {
    isEntityMovementLocked() {
      return false;
    }
  };
  const player = {
    alive: true,
    isGrounded: true,
    rollStartedAt: 0,
    rollUntil: 0
  };

  assert.equal(handleRoll(room, player, {}, {
    nowMs: () => 1000
  }), false);
  assert.equal(player.rollUntil, 0);
});

test('combat runtime handleReload validates the weapon and forwards to the room reload helper', () => {
  const player = {
    id: 'p1',
    alive: true,
    weaponId: 'shotgun'
  };
  const room = {
    canEntityUseWeapon() { return true; },
    beginWeaponReloadCalls: [],
    beginWeaponReload(entity, weaponId, now) {
      this.beginWeaponReloadCalls.push({ entity, weaponId, now });
      return true;
    }
  };

  const reloaded = handleReload(room, player, { weaponId: 'rifle' }, {
    nowMs: () => 450,
    weaponStats: { rifle: { magazineSize: 30, reloadMs: 1200 } },
    canEquipWeaponId() { return true; }
  });

  assert.equal(reloaded, true);
  assert.equal(player.weaponId, 'rifle');
  assert.deepEqual(room.beginWeaponReloadCalls, [{
    entity: player,
    weaponId: 'rifle',
    now: 450
  }]);
});

test('combat runtime handleReload rejects reload when weapon use is locked', () => {
  const player = {
    id: 'p1',
    alive: true,
    weaponId: 'rifle'
  };
  const room = {
    canEntityUseWeapon() { return false; },
    beginWeaponReload() {
      throw new Error('should not begin reload');
    }
  };

  const reloaded = handleReload(room, player, { weaponId: 'rifle' }, {
    nowMs: () => 450,
    weaponStats: { rifle: { magazineSize: 30, reloadMs: 1200 } },
    canEquipWeaponId() { return true; }
  });

  assert.equal(reloaded, false);
  assert.equal(player.weaponId, 'rifle');
});

test('combat runtime relies on generic weapon locks instead of a custom special case', () => {
  const target = { id: 't1', alive: true, x: 0, y: 1.7, z: -8 };
  const player = {
    id: 'p1',
    alive: true,
    lastShotAt: {},
    weaponId: 'rifle'
  };
  const sent = [];
  const room = {
    canEntityUseWeapon() { return true; },
    canTargetEntity() { return true; },
    worldCollidables() { return []; },
    syncWeaponAmmoState() { return { ammoInMag: 5, reloadUntil: 0, reloadedFlashUntil: 0 }; },
    reloadRemainingForWeapon() { return 0; },
    consumeWeaponAmmo() {},
    entityForward() { return { x: 0, y: 0, z: -1 }; },
    getAliveEntities() { return [target]; }
  };

  handleFire(room, player, { weaponId: 'rifle', shotToken: 'special-fire' }, {
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
        pellets: 1
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
  assert.equal(shotRequest.weaponStats.pellets, 1);
  assert.deepEqual(shotRequest.aimOrigin, { x: 0, y: 1.7, z: 0 });
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

test('combat runtime resolves aim origins from the rewound shooter eye when firing while moving', () => {
  const target = { id: 't1', alive: true, x: 20, y: 1.7, z: -8 };
  const player = {
    id: 'p1',
    alive: true,
    x: 2.2,
    y: 2.6,
    z: -1.4,
    yaw: 0,
    pitch: 0,
    lastShotAt: {},
    weaponId: 'rifle'
  };
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
    weaponId: 'rifle',
    shotToken: 'move-origin',
    estimatedServerShotTime: 1234,
    aimOrigin: { x: 0.35, y: 1.72, z: -0.15 },
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
    buildRewoundHitscanTarget(entity) {
      return entity;
    },
    authoritativeHitscanOrigin(_player, requestedShotTime) {
      assert.equal(requestedShotTime, 1260);
      return logicalHitscanOriginFromEye({ x: 0, y: 1.7, z: 0 }, { x: 0, y: 0, z: -1 });
    },
    hitscanAimOriginMaxOffset: 0.9,
    playerEyeHeight: 1.7,
    remoteMuzzleFlashHoldMs: 90
  });

  assert.deepEqual(shotRequest.aimOrigin, logicalHitscanOriginFromEye({ x: 0, y: 1.7, z: 0 }, { x: 0, y: 0, z: -1 }));
});

test('combat runtime rejects client aim that diverges too far from the rewound shooter facing', () => {
  const target = { id: 't1', alive: true, x: 20, y: 1.7, z: -8 };
  const player = {
    id: 'p1',
    alive: true,
    x: 2.2,
    y: 2.6,
    z: -1.4,
    yaw: 0.75,
    pitch: 0.2,
    lastShotAt: {},
    weaponId: 'pistol'
  };
  let shotRequest = null;
  let ammoConsumed = 0;
  let burstCount = 0;
  let engagementCount = 0;
  const shotRejects = [];
  const room = {
    canEntityUseWeapon() { return true; },
    syncWeaponAmmoState() { return { ammoInMag: 10, reloadUntil: 0, reloadedFlashUntil: 0 }; },
    reloadRemainingForWeapon() { return 0; },
    beginWeaponReload() { throw new Error('should not reload'); },
    consumeWeaponAmmo() { ammoConsumed += 1; },
    entityForward() { return { x: 0.9, y: 0, z: 0.1 }; },
    getAliveEntities() { return [target]; },
    canTargetEntity(entity, sourceId) { return !!entity && entity.id !== sourceId; },
    worldCollidables() { return []; }
  };

  handleFire(room, player, {
    weaponId: 'rifle',
    shotToken: 'move-forward',
    estimatedServerShotTime: 1234,
    aimOrigin: { x: 0.1, y: 1.7, z: 0 },
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
    broadcastShotReject(_room, _player, rejection) {
      shotRejects.push(rejection);
    },
    canEquipWeaponId() { return true; },
    resolveHitscanShotTime() { return 1260; },
    buildRewoundHitscanTarget(entity) {
      return entity;
    },
    authoritativeHitscanOrigin() {
      return { x: 0, y: 1.7, z: 0 };
    },
    authoritativeHitscanForward(_player, requestedShotTime) {
      assert.equal(requestedShotTime, 1260);
      return { x: 0, y: 0, z: 1 };
    },
    markFireEngagement() {
      engagementCount += 1;
      return ['t1'];
    },
    markSnapshotBurst() {
      burstCount += 1;
    },
    hitscanAimDirectionMinDot: 0.95,
    hitscanAimOriginMaxOffset: 0.9,
    playerEyeHeight: 1.7,
    remoteMuzzleFlashHoldMs: 90
  });

  assert.equal(shotRequest, null);
  assert.equal(ammoConsumed, 0);
  assert.equal(burstCount, 0);
  assert.equal(engagementCount, 0);
  assert.equal(player.weaponId, 'pistol');
  assert.equal(player.lastShotAt.rifle, undefined);
  assert.equal(player.lastShotTokenByWeapon.rifle, undefined);
  assert.equal(player.muzzleFlashUntil, undefined);
  assert.deepEqual(shotRejects, [{
    shotToken: 'move-forward',
    weaponId: 'rifle',
    reason: 'aim_direction_mismatch',
    serverTime: 1260
  }]);
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

test('combat runtime emits one authoritative shotgun damage event per pellet while preserving pellet order', () => {
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
        { target, damage: 17, hitType: 'body', pelletIndex: 0 },
        { target, damage: 25, hitType: 'head', pelletIndex: 1 }
      ];
    },
    applyDamageFromSource(_source, _target, damage, options) {
      applied.push({ damage, hitType: options.hitType });
      return { killed: false, damageApplied: damage };
    },
    broadcastDamageEvent(_room, ownerId, hitTarget, out, hitType, weaponId, shotToken, pelletIndex) {
      broadcasts.push({ ownerId, hitTargetId: hitTarget.id, out, hitType, weaponId, shotToken, pelletIndex });
    },
    broadcastDeathRespawn() {},
    canEquipWeaponId() { return true; },
    playerEyeHeight: 1.7,
    remoteMuzzleFlashHoldMs: 90
  });

  assert.deepEqual(applied, [
    { damage: 17, hitType: 'body' },
    { damage: 25, hitType: 'head' }
  ]);
  assert.deepEqual(broadcasts, [
    {
      ownerId: 'p1',
      hitTargetId: 't1',
      out: { killed: false, damageApplied: 17 },
      hitType: 'body',
      weaponId: 'shotgun',
      shotToken: 'sg1',
      pelletIndex: 0
    },
    {
      ownerId: 'p1',
      hitTargetId: 't1',
      out: { killed: false, damageApplied: 25 },
      hitType: 'head',
      weaponId: 'shotgun',
      shotToken: 'sg1',
      pelletIndex: 1
    }
  ]);
});

test('combat runtime suppresses duplicate shotgun pellets when shot token aggregation is enabled', () => {
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
  const applied = [];
  const broadcasts = [];
  const room = {
    canEntityUseWeapon() { return true; },
    syncWeaponAmmoState() { return { ammoInMag: 6, reloadUntil: 0, reloadedFlashUntil: 0 }; },
    reloadRemainingForWeapon() { return 0; },
    beginWeaponReload() { throw new Error('should not reload'); },
    consumeWeaponAmmo() {},
    entityForward() { return { x: 0, y: 0, z: -1 }; },
    getAliveEntities() { return [target]; },
    getEntityById(id) { return id === target.id ? target : null; },
    canTargetEntity(entity, sourceId) { return !!entity && entity.id !== sourceId; },
    worldCollidables() { return []; }
  };

  handleFire(room, player, {
    weaponId: 'shotgun',
    shotToken: 'sg-dup'
  }, {
    nowMs: () => 400,
    shotTokenDamageAggregation: true,
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
        { target, damage: 17, hitType: 'body', pelletIndex: 0 },
        { target, damage: 17, hitType: 'body', pelletIndex: 0 }
      ];
    },
    applyDamageFromSource(_source, _target, damage, options) {
      applied.push({ damage, hitType: options.hitType });
      return { killed: false, damageApplied: damage };
    },
    broadcastDamageEvent(_room, ownerId, hitTarget, out, hitType, weaponId, shotToken, pelletIndex) {
      broadcasts.push({ ownerId, hitTargetId: hitTarget.id, out, hitType, weaponId, shotToken, pelletIndex });
    },
    broadcastDeathRespawn() {},
    canEquipWeaponId() { return true; },
    playerEyeHeight: 1.7,
    remoteMuzzleFlashHoldMs: 90
  });

  assert.deepEqual(applied, [{ damage: 17, hitType: 'body' }]);
  assert.deepEqual(broadcasts, [{
    ownerId: 'p1',
    hitTargetId: 't1',
    out: { killed: false, damageApplied: 17 },
    hitType: 'body',
    weaponId: 'shotgun',
    shotToken: 'sg-dup',
    pelletIndex: 0
  }]);
});

test('combat runtime still applies distinct pellet indexes once each when shot token aggregation is enabled', () => {
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
  const applied = [];
  const broadcasts = [];
  const room = {
    canEntityUseWeapon() { return true; },
    syncWeaponAmmoState() { return { ammoInMag: 6, reloadUntil: 0, reloadedFlashUntil: 0 }; },
    reloadRemainingForWeapon() { return 0; },
    beginWeaponReload() { throw new Error('should not reload'); },
    consumeWeaponAmmo() {},
    entityForward() { return { x: 0, y: 0, z: -1 }; },
    getAliveEntities() { return [target]; },
    getEntityById(id) { return id === target.id ? target : null; },
    canTargetEntity(entity, sourceId) { return !!entity && entity.id !== sourceId; },
    worldCollidables() { return []; }
  };

  handleFire(room, player, {
    weaponId: 'shotgun',
    shotToken: 'sg-multi'
  }, {
    nowMs: () => 400,
    shotTokenDamageAggregation: true,
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
        { target, damage: 17, hitType: 'body', pelletIndex: 0 },
        { target, damage: 25, hitType: 'head', pelletIndex: 1 }
      ];
    },
    applyDamageFromSource(_source, _target, damage, options) {
      applied.push({ damage, hitType: options.hitType });
      return { killed: false, damageApplied: damage };
    },
    broadcastDamageEvent(_room, ownerId, hitTarget, out, hitType, weaponId, shotToken, pelletIndex) {
      broadcasts.push({ ownerId, hitTargetId: hitTarget.id, out, hitType, weaponId, shotToken, pelletIndex });
    },
    broadcastDeathRespawn() {},
    canEquipWeaponId() { return true; },
    playerEyeHeight: 1.7,
    remoteMuzzleFlashHoldMs: 90
  });

  assert.deepEqual(applied, [
    { damage: 17, hitType: 'body' },
    { damage: 25, hitType: 'head' }
  ]);
  assert.equal(broadcasts.length, 2);
  assert.deepEqual(broadcasts.map((entry) => entry.pelletIndex), [0, 1]);
});

test('combat runtime broadcasts authoritative shot effects for world-space tracers', () => {
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
  const shotEffects = [];
  const room = {
    canEntityUseWeapon() { return true; },
    syncWeaponAmmoState() { return { ammoInMag: 10, reloadUntil: 0, reloadedFlashUntil: 0 }; },
    reloadRemainingForWeapon() { return 0; },
    beginWeaponReload() { throw new Error('should not reload'); },
    consumeWeaponAmmo() {},
    entityForward() { return { x: 0, y: 0, z: -1 }; },
    getAliveEntities() { return []; },
    canTargetEntity(entity, sourceId) { return !!entity && entity.id !== sourceId; },
    worldCollidables() { return []; }
  };

  handleFire(room, player, {
    weaponId: 'rifle',
    shotToken: 'trace-1'
  }, {
    nowMs: () => 200,
    weaponStats: {
      rifle: {
        cooldownMs: 100,
        magazineSize: 10,
        pellets: 1
      }
    },
    weaponFalloff: { rifle: [] },
    resolveHitscanShot() { return []; },
    resolveHitscanTrace() {
      return [{
        hit: false,
        hitType: 'miss',
        pelletIndex: 0,
        point: { x: 0, y: 1.7, z: -40 }
      }];
    },
    applyDamageFromSource() { return null; },
    broadcastShotEffect(_room, effect) { shotEffects.push(effect); },
    broadcastDamageEvent() {},
    broadcastDeathRespawn() {},
    canEquipWeaponId() { return true; },
    authoritativeHitscanOrigin() {
      return logicalMuzzleOriginFromEye({ x: 0, y: 1.7, z: 0 }, { x: 0, y: 0, z: -1 });
    },
    playerEyeHeight: 1.7,
    remoteMuzzleFlashHoldMs: 90
  });

  assert.deepEqual(shotEffects, [{
    sourceId: 'p1',
    weaponId: 'rifle',
    shotToken: 'trace-1',
    origin: logicalMuzzleOriginFromEye({ x: 0, y: 1.7, z: 0 }, { x: 0, y: 0, z: -1 }),
    traces: [{
      x: 0,
      y: 1.7,
      z: -40,
      pelletIndex: 0,
      hitType: 'miss'
    }]
  }]);
});

test('combat runtime uses a validated client muzzle origin for remote tracer visuals only', () => {
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
  const shotEffects = [];
  const authoritativeOrigin = logicalMuzzleOriginFromEye({ x: 0, y: 1.7, z: 0 }, { x: 0, y: 0, z: -1 });
  const clientMuzzleOrigin = { x: 0.42, y: 1.62, z: -0.24 };
  const room = {
    canEntityUseWeapon() { return true; },
    syncWeaponAmmoState() { return { ammoInMag: 10, reloadUntil: 0, reloadedFlashUntil: 0 }; },
    reloadRemainingForWeapon() { return 0; },
    beginWeaponReload() { throw new Error('should not reload'); },
    consumeWeaponAmmo() {},
    entityForward() { return { x: 0, y: 0, z: -1 }; },
    getAliveEntities() { return []; },
    canTargetEntity(entity, sourceId) { return !!entity && entity.id !== sourceId; },
    worldCollidables() { return []; }
  };

  handleFire(room, player, {
    weaponId: 'rifle',
    shotToken: 'visual-origin',
    aimOrigin: clientMuzzleOrigin,
    aimForward: { x: 0, y: 0, z: -1 }
  }, {
    nowMs: () => 300,
    weaponStats: {
      rifle: {
        cooldownMs: 100,
        magazineSize: 10,
        pellets: 1
      }
    },
    weaponFalloff: { rifle: [] },
    resolveHitscanShot(options) {
      shotRequest = options;
      return [];
    },
    resolveHitscanTrace() {
      return [{
        hit: false,
        hitType: 'miss',
        pelletIndex: 0,
        point: { x: 0, y: 1.7, z: -40 }
      }];
    },
    applyDamageFromSource() { return null; },
    broadcastShotEffect(_room, effect) { shotEffects.push(effect); },
    broadcastDamageEvent() {},
    broadcastDeathRespawn() {},
    canEquipWeaponId() { return true; },
    authoritativeHitscanOrigin() {
      return authoritativeOrigin;
    },
    playerEyeHeight: 1.7,
    remoteMuzzleFlashHoldMs: 90
  });

  assert.deepEqual(shotRequest.aimOrigin, authoritativeOrigin);
  assert.equal(shotEffects.length, 1);
  assert.deepEqual(shotEffects[0].origin, clientMuzzleOrigin);
});

test('combat runtime broadcasts every shotgun pellet trace for authoritative world-space tracers', () => {
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
  const shotEffects = [];
  const room = {
    canEntityUseWeapon() { return true; },
    syncWeaponAmmoState() { return { ammoInMag: 6, reloadUntil: 0, reloadedFlashUntil: 0 }; },
    reloadRemainingForWeapon() { return 0; },
    beginWeaponReload() { throw new Error('should not reload'); },
    consumeWeaponAmmo() {},
    entityForward() { return { x: 0, y: 0, z: -1 }; },
    getAliveEntities() { return []; },
    canTargetEntity(entity, sourceId) { return !!entity && entity.id !== sourceId; },
    worldCollidables() { return []; }
  };

  handleFire(room, player, {
    weaponId: 'shotgun',
    shotToken: 'sg-traces'
  }, {
    nowMs: () => 500,
    weaponStats: {
      shotgun: {
        cooldownMs: 100,
        magazineSize: 6,
        pellets: 12
      }
    },
    weaponFalloff: { shotgun: [] },
    resolveHitscanShot() { return []; },
    resolveHitscanTrace() {
      return Array.from({ length: 12 }, (_value, pelletIndex) => ({
        hit: false,
        hitType: 'miss',
        pelletIndex,
        point: { x: pelletIndex, y: 1.7, z: -10 - pelletIndex }
      }));
    },
    applyDamageFromSource() { return null; },
    broadcastShotEffect(_room, effect) { shotEffects.push(effect); },
    broadcastDamageEvent() {},
    broadcastDeathRespawn() {},
    canEquipWeaponId() { return true; },
    playerEyeHeight: 1.7,
    remoteMuzzleFlashHoldMs: 90
  });

  assert.equal(shotEffects.length, 1);
  assert.equal(shotEffects[0].traces.length, 12);
  assert.deepEqual(shotEffects[0].traces.map((trace) => trace.pelletIndex), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
});

test('shot effect payload preserves the full current shotgun pellet tracer set', () => {
  const payload = buildShotEffectPayload({
    sourceId: 'p1',
    weaponId: 'shotgun',
    shotToken: 'payload-traces',
    origin: { x: 1, y: 2, z: 3 },
    traces: Array.from({ length: 12 }, (_value, pelletIndex) => ({
      x: pelletIndex,
      y: 2,
      z: -pelletIndex,
      pelletIndex,
      hitType: 'miss'
    }))
  }, 'shot_effect');

  assert.equal(payload.traces.length, 12);
  assert.deepEqual(payload.traces.map((trace) => trace.pelletIndex), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
});

test('shot effect broadcasts reach the shooter and the other active players', () => {
  const sentByUser = new Map();
  function socketFor(userId) {
    return {
      send(payload) {
        const list = sentByUser.get(userId) || [];
        list.push(JSON.parse(payload));
        sentByUser.set(userId, list);
      }
    };
  }

  const shooterSocket = socketFor('p1');
  const remoteSocket = socketFor('p2');
  const room = {
    clients: new Map([
      [shooterSocket, { userId: 'p1' }],
      [remoteSocket, { userId: 'p2' }]
    ]),
    activeSocketByUserId: new Map([
      ['p1', shooterSocket],
      ['p2', remoteSocket]
    ])
  };

  broadcastRoomShotEffect(room, {
    sourceId: 'p1',
    weaponId: 'rifle',
    shotToken: 'all-players',
    origin: { x: 1, y: 2, z: 3 },
    traces: [{ x: 4, y: 5, z: 6, pelletIndex: 0, hitType: 'miss' }]
  }, 'shot_effect');

  assert.equal(sentByUser.get('p1').length, 1);
  assert.equal(sentByUser.get('p2').length, 1);
  assert.deepEqual(sentByUser.get('p1')[0], sentByUser.get('p2')[0]);
  assert.equal(sentByUser.get('p1')[0].sourceId, 'p1');
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

test('spawnProjectile clamps extreme throwable tuning values to safe server ranges', () => {
  const room = {
    projectiles: new Map(),
    nextProjectileSeq: 1,
    validateThrowIntent() {
      return {
        origin: { x: 0, y: 1.6, z: 0 },
        direction: { x: 1, y: 1, z: -1 }
      };
    }
  };

  const projectile = spawnProjectile(room, { id: 'p1' }, 'frag', 'c1', null, null, {
    throwableStats: {
      frag: {
        speed: 500,
        upward: 50,
        hitRadius: 1000,
        catchRadius: 99,
        trackDuration: 99,
        trackLerp: 99,
        fuse: 99,
        maxLife: 99
      }
    },
    nowMs: () => 100
  });

  assert.equal(projectile.hitRadius, 2);
  assert.equal(projectile.catchRadius, 3);
  assert.equal(projectile.trackDurationSec, 5);
  assert.equal(projectile.trackLerp, 20);
  assert.equal(projectile.fuseSec, 10);
  assert.equal(projectile.lifeSec, 0);
  assert.equal(projectile.vx > 0, true);
  assert.equal(projectile.vy <= 80, true);
});

test('combat runtime rejects invalid throwable ids without consuming charges', () => {
  const player = {
    id: 'p1',
    alive: true,
    throwables: {
      frag: { charges: 2, maxCharges: 2 }
    }
  };
  const sent = [];
  const room = {
    canEntityUseThrowable() { return true; },
    consumeThrowCharge() {
      throw new Error('should not consume charges');
    },
    spawnProjectile() {
      throw new Error('should not spawn projectile');
    },
    send(_ws, payload) {
      sent.push(payload);
    }
  };

  handleThrow(room, player, { throwableId: 'exploit', clientThrowId: 'bad1', throwIntent: null }, {}, {
    normalizeThrowPayload(throwableId, clientThrowId, throwIntent) {
      return { throwableId, clientThrowId, throwIntent };
    },
    throwableStats: { frag: { regen: 5, speed: 10, upward: 2, hitRadius: 1.2, life: 1 } },
    nowMs: () => 100,
    msgThrowReject: 'throw_reject',
    msgThrowSpawn: 'throw_spawn',
    remoteMuzzleFlashHoldMs: 90
  });

  assert.deepEqual(sent, [{
    t: 'throw_reject',
    throwableId: 'exploit',
    clientThrowId: 'bad1',
    reason: 'invalid_throwable'
  }]);
  assert.equal(player.throwables.frag.charges, 2);
});
