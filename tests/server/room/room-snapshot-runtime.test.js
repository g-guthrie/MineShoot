import test from 'node:test';
import assert from 'node:assert/strict';

import {
  broadcastSnapshot,
  collectSnapshotFrame,
  ensureClientSnapshotState,
  ensureSnapshotBurstState,
  isEntityEngagedForViewer,
  markEntityEngaged,
  sendSnapshotToClient
} from '../../../cloudflare/server/room/RoomSnapshotRuntime.js';

function makeRoom() {
  const sent = [];
  return {
    roomName: 'global',
    gameMode: 'ffa',
    privateRoomConfig: { roomPhase: 'active' },
    matchState: {
      gameMode: 'ffa',
      started: false,
      ended: false,
      teamProgress: { alpha: 0, bravo: 0 },
      teamBaselineSize: { alpha: 0, bravo: 0 }
    },
    players: new Map(),
    bots: new Map(),
    projectiles: new Map(),
    fireZones: new Map(),
    clients: new Map(),
    activeSocketByUserId: new Map(),
    sent,
    materializeTrackedWeaponAmmoCalls: [],
    materializeTrackedWeaponAmmo(entity, now) {
      this.materializeTrackedWeaponAmmoCalls.push({ id: entity.id, now });
    },
    isEntityDisconnected(entity) {
      return !!entity.disconnected;
    },
    getEntityById(id) {
      return this.players.get(id) || this.bots.get(id) || null;
    },
    getAliveEntities() {
      return Array.from(this.players.values()).filter((entity) => entity.alive !== false);
    },
    canTargetEntity(entity, sourceId) {
      return !!entity && entity.id !== sourceId;
    },
    entityForward() {
      return { x: 0, y: 0, z: -1 };
    },
    send(ws, payload) {
      sent.push({ ws, payload });
    }
  };
}

function baseEntity(id, overrides = {}) {
  return {
    id,
    kind: 'player',
    username: id.toUpperCase(),
    classId: 'abilities',
    x: 0,
    y: 1.6,
    z: 0,
    yaw: 0,
    pitch: 0,
    seq: 0,
    weaponId: 'rifle',
    moveSpeedNorm: 0,
    sprinting: false,
    inputState: { forward: false, backward: false },
    velocityY: 0,
    isGrounded: true,
    jumpHoldTimer: 0,
    jumpHeldLast: false,
    hp: 100,
    hpMax: 100,
    armor: 0,
    armorMax: 0,
    kills: 0,
    deaths: 0,
    progressScore: 0,
    teamId: '',
    wallhackRadius: 90,
    alive: true,
    spawnShieldUntil: 0,
    streamHeat: 0,
    streamOverheatedUntil: 0,
    muzzleFlashUntil: 0,
    weaponLoadout: ['rifle', 'shotgun'],
    weaponAmmo: {},
    abilityLoadout: { slot1: 'choke', slot2: 'missile' },
    throwables: {},
    ...overrides
  };
}

function snapshotDeps() {
  return {
    msgType: 'snapshot',
    distanceBetween(a, b) {
      const dx = Number(a.x || 0) - Number(b.x || 0);
      const dy = Number(a.y || 0) - Number(b.y || 0);
      const dz = Number(a.z || 0) - Number(b.z || 0);
      return Math.sqrt((dx * dx) + (dy * dy) + (dz * dz));
    },
    isEntityEngagedForViewer,
    isPrivateMatchRoom: () => false,
    roomPhaseActive: 'active',
    emptyMatchState(gameMode) {
      return {
        gameMode,
        started: false,
        ended: false,
        teamProgress: { alpha: 0, bravo: 0 },
        teamBaselineSize: { alpha: 0, bravo: 0 }
      };
    },
    teamAlpha: 'alpha',
    teamBravo: 'bravo',
    nowMs: () => 123
  };
}

test('snapshot runtime collects serialized frame data for live players, bots, projectiles, and fire zones', () => {
  const room = makeRoom();
  room.players.set('u1', baseEntity('u1'));
  room.players.set('u2', baseEntity('u2', { disconnected: true }));
  room.bots.set('bot1', baseEntity('bot1', { kind: 'bot' }));
  room.projectiles.set('p1', { id: 'p1', alive: true, type: 'frag', ownerId: 'u1', x: 1, y: 2, z: 3, vx: 0, vy: 0, vz: 0, age: 0, stickyUntil: 0, stuckToTargetId: '', stuckOffsetX: 0, stuckOffsetY: 0, stuckOffsetZ: 0 });
  room.projectiles.set('p2', { id: 'p2', alive: false });
  room.fireZones.set('f1', { id: 'f1', ownerId: 'u1', x: 2, y: 0, z: 3, radius: 4, life: 5 });

  const frame = collectSnapshotFrame(room, 500);

  assert.deepEqual(frame.entities.map((entity) => entity.id), ['u1', 'bot1']);
  assert.deepEqual(room.materializeTrackedWeaponAmmoCalls, [{ id: 'u1', now: 500 }, { id: 'bot1', now: 500 }]);
  assert.equal(frame.projectiles.length, 1);
  assert.equal(frame.projectiles[0].id, 'p1');
  assert.equal(frame.fireZones.length, 1);
  assert.equal(frame.fireZones[0].id, 'f1');
  assert.equal(frame.serializedById.get('u1') != null, true);
});

test('snapshot runtime sends viewer deltas and preserves snapshot bookkeeping', () => {
  const room = makeRoom();
  const ws = { id: 'socket-1' };
  room.players.set('u1', baseEntity('u1'));
  room.players.set('u2', baseEntity('u2', { x: 10 }));
  room.clients.set(ws, { userId: 'u1' });
  room.activeSocketByUserId.set('u1', ws);

  const frame = collectSnapshotFrame(room, 700);
  const meta = room.clients.get(ws);

  assert.equal(sendSnapshotToClient(room, ws, meta, frame, { forceFull: true }, snapshotDeps()), true);
  assert.equal(room.sent.length, 1);
  assert.equal(room.sent[0].payload.entities.length, 2);
  assert.equal(ensureClientSnapshotState(meta).entityStateById.size, 2);

  room.sent.length = 0;
  const nextFrame = collectSnapshotFrame(room, 760);
  assert.equal(sendSnapshotToClient(room, ws, meta, nextFrame, {}, snapshotDeps()), false);

  room.players.get('u2').x = 11;
  const changedFrame = collectSnapshotFrame(room, 820);
  assert.equal(sendSnapshotToClient(room, ws, meta, changedFrame, {}, snapshotDeps()), true);
  assert.equal(room.sent.length, 1);
  assert.deepEqual(room.sent[0].payload.entities.map((entity) => entity.id), ['u2']);
});

test('snapshot runtime tracks engagements and broadcasts to active clients only', () => {
  const room = makeRoom();
  const activeWs = { id: 'active' };
  const staleWs = { id: 'stale' };
  const viewer = baseEntity('u1');
  const target = baseEntity('u2', { x: 0, z: -20 });
  room.players.set('u1', viewer);
  room.players.set('u2', target);
  room.clients.set(activeWs, { userId: 'u1' });
  room.clients.set(staleWs, { userId: 'u1' });
  room.activeSocketByUserId.set('u1', activeWs);

  assert.equal(markEntityEngaged(room, 'u1', 'u2', 1000, 100), true);
  assert.equal(isEntityEngagedForViewer(viewer, 'u2', 500), true);
  assert.equal(isEntityEngagedForViewer(viewer, 'u2', 1200), false);

  broadcastSnapshot(room, true, snapshotDeps());
  assert.equal(room.sent.length, 1);
  assert.equal(room.sent[0].ws, activeWs);
  assert.ok(ensureSnapshotBurstState(room.clients.get(activeWs)));
});
