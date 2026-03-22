import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';

import { buildExpectedWorldMeta } from '../../shared/protocol.js';
import { buildWorldCollisionData } from '../../shared/world-collision.js';
import { PLAYER_HEIGHT, PLAYER_RADIUS } from '../../shared/entity-constants.js';
import { createRealWorkerHarness } from '../helpers/real-worker-harness.js';

const SNAPSHOT_TIMEOUT_MS = 15_000;
const TEST_TIMEOUT_MS = 180_000;
const FIXTURE_RADIUS = PLAYER_RADIUS + 0.2;
const MOVEMENT_STEP_DT_MS = 50;
const MOVEMENT_STEP_WAIT_MS = 15;
const MOVEMENT_STEPS = 16;
const COMBAT_FOV_DEG = 56;

let worker = null;

before(async () => {
  worker = await createRealWorkerHarness();
});

after(async () => {
  if (worker) await worker.close();
});

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildRoomId(label) {
  return `itest-${String(label || 'room').slice(0, 10)}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`.toLowerCase();
}

function buildUserId(label) {
  return `usr_${String(label || 'player').replace(/[^a-z0-9_]/gi, '').slice(0, 18)}_${Math.random().toString(36).slice(2, 8)}`;
}

function intersectsBox(x, z, radius, box) {
  const closestX = Math.max(Number(box.min.x || 0), Math.min(x, Number(box.max.x || 0)));
  const closestZ = Math.max(Number(box.min.z || 0), Math.min(z, Number(box.max.z || 0)));
  const dx = x - closestX;
  const dz = z - closestZ;
  return ((dx * dx) + (dz * dz)) < (radius * radius);
}

const worldCollision = buildWorldCollisionData(buildExpectedWorldMeta('itest-open-lane'));

function pointBlocked(x, z, radius = FIXTURE_RADIUS) {
  if (x < (worldCollision.boundsMin + radius) || x > (worldCollision.boundsMax - radius)) return true;
  if (z < (worldCollision.boundsMin + radius) || z > (worldCollision.boundsMax - radius)) return true;
  for (let i = 0; i < worldCollision.collidables.length; i++) {
    const box = worldCollision.collidables[i];
    if (!box || !box.min || !box.max) continue;
    if (Number(box.max.y || 0) <= 0.05) continue;
    if (Number(box.min.y || 0) >= PLAYER_HEIGHT) continue;
    if (intersectsBox(x, z, radius, box)) return true;
  }
  return false;
}

function segmentBlocked(start, end, radius = FIXTURE_RADIUS, step = 0.5) {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const distance = Math.sqrt((dx * dx) + (dz * dz));
  const steps = Math.max(1, Math.ceil(distance / step));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    if (pointBlocked(start.x + (dx * t), start.z + (dz * t), radius)) return true;
  }
  return false;
}

function findOpenLayout() {
  const sideOffsets = [6, -6, 8, -8];
  for (let x = 20; x <= 146; x += 4) {
    for (let z = 140; z >= 40; z -= 4) {
      const mover = { x, z };
      const target = { x, z: z - 16 };
      if (pointBlocked(mover.x, mover.z) || pointBlocked(target.x, target.z)) continue;
      if (segmentBlocked(mover, target)) continue;
      for (let i = 0; i < sideOffsets.length; i++) {
        const observer = { x: x + sideOffsets[i], z: z + 2 };
        if (pointBlocked(observer.x, observer.z)) continue;
        return { mover, observer, target };
      }
    }
  }
  throw new Error('Failed to find an open test layout in the shared world collision data.');
}

const openLayout = findOpenLayout();

function normalizeForward(from, to) {
  const dx = Number(to.x || 0) - Number(from.x || 0);
  const dy = Number(to.y || 0) - Number(from.y || 0);
  const dz = Number(to.z || 0) - Number(from.z || 0);
  const length = Math.sqrt((dx * dx) + (dy * dy) + (dz * dz)) || 1;
  return {
    x: dx / length,
    y: dy / length,
    z: dz / length
  };
}

function distanceXZ(a, b) {
  const dx = Number(a && a.x || 0) - Number(b && b.x || 0);
  const dz = Number(a && a.z || 0) - Number(b && b.z || 0);
  return Math.sqrt((dx * dx) + (dz * dz));
}

async function withDebug(roomId, clients, run) {
  try {
    await run();
  } catch (err) {
    err.message += '\n' + JSON.stringify(worker.debugState(roomId, clients), null, 2);
    throw err;
  } finally {
    for (let i = 0; i < clients.length; i++) {
      await clients[i].close().catch(() => null);
    }
  }
}

async function waitForBothClientsToSee(roomId, clientA, clientB, ids) {
  await clientA.waitForSnapshot(() => ids.every((id) => clientA.latestEntity(id)), SNAPSHOT_TIMEOUT_MS);
  await clientB.waitForSnapshot(() => ids.every((id) => clientB.latestEntity(id)), SNAPSHOT_TIMEOUT_MS);

  const first = await clientA.waitForSnapshot(null, SNAPSHOT_TIMEOUT_MS);
  await clientA.waitForSnapshot((message) => Number(message.serverTime || 0) > Number(first.serverTime || 0), SNAPSHOT_TIMEOUT_MS);
}

async function applyFixtureAndWait(roomId, clients, players) {
  const result = await worker.applyFixture({
    roomId,
    players
  });
  assert.equal(result.ok, true);
  for (let i = 0; i < clients.length; i++) {
    await clients[i].waitForSnapshot(() => {
      return players.every((player) => {
        const entity = clients[i].latestEntity(player.userId);
        if (!entity) return false;
        if (Math.abs(Number(entity.x || 0) - Number(player.x || 0)) > 0.01) return false;
        if (Math.abs(Number(entity.z || 0) - Number(player.z || 0)) > 0.01) return false;
        if (Number.isFinite(Number(player.yaw)) && Math.abs(Number(entity.yaw || 0) - Number(player.yaw || 0)) > 0.001) return false;
        if (Number.isFinite(Number(player.pitch)) && Math.abs(Number(entity.pitch || 0) - Number(player.pitch || 0)) > 0.001) return false;
        if (player.clearSpawnShield && Number(entity.spawnShieldUntil || 0) !== 0) return false;
        if (player.weaponId && String(entity.weaponId || '') !== String(player.weaponId || '')) return false;
        return true;
      });
    }, SNAPSHOT_TIMEOUT_MS);
  }
  return result;
}

async function sendForwardBurst(client, startSeq, count) {
  for (let i = 0; i < count; i++) {
    await client.sendInput({
      seq: startSeq + i,
      dtMs: MOVEMENT_STEP_DT_MS,
      yaw: 0,
      pitch: 0,
      forward: true,
      weaponId: 'rifle'
    });
    await delay(MOVEMENT_STEP_WAIT_MS);
  }
  await client.sendInput({
    seq: startSeq + count,
    dtMs: MOVEMENT_STEP_DT_MS,
    yaw: 0,
    pitch: 0,
    forward: false,
    weaponId: 'rifle'
  });
}

async function waitForCondition(check, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = check();
    if (result) return result;
    await delay(50);
  }
  throw new Error(`Timed out waiting for ${label}.`);
}

function snapshotEntitySamples(client, entityId, startIndex) {
  const samples = [];
  for (let i = 0; i < client.messages.length; i++) {
    const entry = client.messages[i];
    if (entry.index < startIndex) continue;
    const message = entry.message;
    if (String(message && message.t || '') !== 'snapshot') continue;
    if (!Array.isArray(message.entities)) continue;
    const entity = message.entities.find((candidate) => String(candidate && candidate.id || '') === String(entityId || ''));
    if (!entity) continue;
    samples.push({
      x: Number(entity.x || 0),
      z: Number(entity.z || 0),
      serverTime: Number(message.serverTime || 0)
    });
  }
  return samples;
}

test('real worker: join and snapshot flow', { timeout: TEST_TIMEOUT_MS }, async () => {
  const roomId = buildRoomId('join');
  const alpha = await worker.connectClient({ roomId, userId: buildUserId('join_alpha'), username: 'JOIN_ALPHA' });
  const bravo = await worker.connectClient({ roomId, userId: buildUserId('join_bravo'), username: 'JOIN_BRAVO' });

  await withDebug(roomId, [alpha, bravo], async () => {
    const welcomeAlpha = await alpha.waitForMessage('welcome', null, SNAPSHOT_TIMEOUT_MS);
    const welcomeBravo = await bravo.waitForMessage('welcome', null, SNAPSHOT_TIMEOUT_MS);

    assert.equal(String(welcomeAlpha.selfId || ''), alpha.userId);
    assert.equal(String(welcomeBravo.selfId || ''), bravo.userId);

    await waitForBothClientsToSee(roomId, alpha, bravo, [alpha.userId, bravo.userId]);
  });
});

test('real worker: movement replication converges across clients', { timeout: TEST_TIMEOUT_MS }, async () => {
  const roomId = buildRoomId('move');
  const mover = await worker.connectClient({ roomId, userId: buildUserId('mover'), username: 'MOVER' });
  const observer = await worker.connectClient({ roomId, userId: buildUserId('observer'), username: 'OBSERVER' });

  await withDebug(roomId, [mover, observer], async () => {
    await mover.waitForMessage('welcome', null, SNAPSHOT_TIMEOUT_MS);
    await observer.waitForMessage('welcome', null, SNAPSHOT_TIMEOUT_MS);
    await waitForBothClientsToSee(roomId, mover, observer, [mover.userId, observer.userId]);

    await applyFixtureAndWait(roomId, [mover, observer], [
      { userId: mover.userId, x: openLayout.mover.x, z: openLayout.mover.z, yaw: 0, pitch: 0, clearSpawnShield: true, weaponId: 'rifle' },
      { userId: observer.userId, x: openLayout.observer.x, z: openLayout.observer.z, yaw: 0, pitch: 0, clearSpawnShield: true, weaponId: 'rifle' }
    ]);

    const baseline = observer.latestEntity(mover.userId);
    assert.ok(baseline);
    const startZ = Number(baseline.z || 0);

    await sendForwardBurst(mover, 1, MOVEMENT_STEPS);

    await observer.waitForSnapshot(() => {
      const entity = observer.latestEntity(mover.userId);
      return entity && Number(entity.z || 0) < (startZ - 1.5);
    }, SNAPSHOT_TIMEOUT_MS);

    await waitForCondition(() => {
      const moverSelf = mover.latestEntity(mover.userId);
      const moverRemote = observer.latestEntity(mover.userId);
      if (!moverSelf || !moverRemote) return false;
      return distanceXZ(moverSelf, moverRemote) < 0.9 ? { moverSelf, moverRemote } : false;
    }, SNAPSHOT_TIMEOUT_MS, 'movement convergence');
  });
});

test('real worker: duplicate sockets are superseded cleanly', { timeout: TEST_TIMEOUT_MS }, async () => {
  const roomId = buildRoomId('dupe');
  const sharedUserId = buildUserId('dupe');
  const observer = await worker.connectClient({ roomId, userId: buildUserId('dupe_observer'), username: 'DUP_OBSERVER' });
  const socketA = await worker.connectClient({ roomId, userId: sharedUserId, username: 'DUP_ALPHA' });

  await withDebug(roomId, [observer, socketA], async () => {
    await observer.waitForMessage('welcome', null, SNAPSHOT_TIMEOUT_MS);
    await socketA.waitForMessage('welcome', null, SNAPSHOT_TIMEOUT_MS);
    await waitForBothClientsToSee(roomId, observer, socketA, [observer.userId, sharedUserId]);

    const socketB = await worker.connectClient({ roomId, userId: sharedUserId, username: 'DUP_ALPHA' });
    try {
      await socketB.waitForMessage('welcome', null, SNAPSHOT_TIMEOUT_MS);
      const maybeClose = await Promise.race([
        socketA.waitForClose(1500).catch(() => null),
        delay(1500).then(() => null)
      ]);
      if (maybeClose) {
        assert.equal(maybeClose.code, 4001);
      }

      await applyFixtureAndWait(roomId, [observer, socketB], [
        { userId: sharedUserId, x: openLayout.mover.x, z: openLayout.mover.z, yaw: 0, pitch: 0, clearSpawnShield: true, weaponId: 'rifle' },
        { userId: observer.userId, x: openLayout.observer.x, z: openLayout.observer.z, yaw: 0, pitch: 0, clearSpawnShield: true, weaponId: 'rifle' }
      ]);

      const unchangedZ = Number(observer.latestEntity(sharedUserId).z || 0);
      await assert.rejects(
        socketA.sendInput({
          seq: 1,
          dtMs: MOVEMENT_STEP_DT_MS,
          yaw: 0,
          pitch: 0,
          forward: true,
          weaponId: 'rifle'
        })
      );
      await delay(250);
      assert.equal(Number(observer.latestEntity(sharedUserId).z || 0), unchangedZ);

      await sendForwardBurst(socketB, 1, 8);
      await observer.waitForSnapshot(() => {
        const entity = observer.latestEntity(sharedUserId);
        return entity && Number(entity.z || 0) < (unchangedZ - 1);
      }, SNAPSHOT_TIMEOUT_MS);
      assert.ok(observer.latestEntity(sharedUserId));
    } finally {
      await socketB.close().catch(() => null);
    }
  });
});

test('real worker: authoritative fire produces damage and death through the server', { timeout: TEST_TIMEOUT_MS }, async () => {
  const roomId = buildRoomId('fire');
  const shooter = await worker.connectClient({ roomId, userId: buildUserId('shooter'), username: 'SHOOTER' });
  const target = await worker.connectClient({ roomId, userId: buildUserId('target'), username: 'TARGET' });

  await withDebug(roomId, [shooter, target], async () => {
    await shooter.waitForMessage('welcome', null, SNAPSHOT_TIMEOUT_MS);
    await target.waitForMessage('welcome', null, SNAPSHOT_TIMEOUT_MS);
    await waitForBothClientsToSee(roomId, shooter, target, [shooter.userId, target.userId]);

    await applyFixtureAndWait(roomId, [shooter, target], [
      { userId: shooter.userId, x: openLayout.mover.x, z: openLayout.mover.z, yaw: 0, pitch: 0, clearSpawnShield: true, weaponId: 'rifle' },
      { userId: target.userId, x: openLayout.target.x, z: openLayout.target.z, yaw: Math.PI, pitch: 0, clearSpawnShield: true, weaponId: 'rifle' }
    ]);

    await shooter.sendWeaponLoadout('rifle', 'shotgun');
    await shooter.sendEquipWeapon('rifle');
    await shooter.waitForSnapshot(() => {
      const entity = shooter.latestEntity(shooter.userId);
      return entity &&
        String(entity.weaponId || '') === 'rifle' &&
        Array.isArray(entity.weaponLoadout) &&
        String(entity.weaponLoadout[0] || '') === 'rifle';
    }, SNAPSHOT_TIMEOUT_MS);

    let killed = false;
    let sawRespawn = false;
    for (let shotIndex = 0; shotIndex < 12 && !killed; shotIndex++) {
      const shooterState = shooter.latestEntity(shooter.userId);
      const targetState = shooter.latestEntity(target.userId);
      assert.ok(shooterState);
      assert.ok(targetState);

      const shotToken = `itest-shot-${shotIndex}`;
      const beforeHp = Number(targetState.hp || 0);
      const aimForward = normalizeForward(shooterState, targetState);

      await shooter.sendFire({
        weaponId: 'rifle',
        shotToken,
        adsActive: true,
        viewFovDeg: COMBAT_FOV_DEG,
        aimOrigin: {
          x: Number(shooterState.x || 0),
          y: Number(shooterState.y || 0),
          z: Number(shooterState.z || 0)
        },
        aimForward,
        estimatedServerShotTime: Number(shooter.latestSnapshot && shooter.latestSnapshot.serverTime || 0)
      });

      const targetDamage = await target.waitForMessage('damage_event', (message) => {
        return String(message.shotToken || '') === shotToken &&
          String(message.sourceId || '') === shooter.userId &&
          String(message.targetId || '') === target.userId;
      }, SNAPSHOT_TIMEOUT_MS);
      const shooterDamage = await shooter.waitForMessage('damage_event', (message) => {
        return String(message.shotToken || '') === shotToken &&
          String(message.sourceId || '') === shooter.userId &&
          String(message.targetId || '') === target.userId;
      }, SNAPSHOT_TIMEOUT_MS);

      assert.equal(String(targetDamage.shotToken || ''), shotToken);
      assert.equal(String(shooterDamage.shotToken || ''), shotToken);

      await target.waitForSnapshot(() => {
        const current = target.latestEntity(target.userId);
        return current && Number(current.hp || 0) < beforeHp;
      }, SNAPSHOT_TIMEOUT_MS);

      killed = !!targetDamage.killed;
      if (killed) {
        const respawn = await target.waitForMessage('death_respawn', (message) => {
          return String(message.entityId || '') === target.userId;
        }, SNAPSHOT_TIMEOUT_MS);
        sawRespawn = !!respawn;
      } else {
        await delay(125);
      }
    }

    assert.equal(killed, true);
    assert.equal(sawRespawn, true);
  });
});

test('real worker: reconnecting within grace keeps one player identity alive', { timeout: TEST_TIMEOUT_MS }, async () => {
  const roomId = buildRoomId('rejoin');
  const reconnectUserId = buildUserId('rejoin');
  const observer = await worker.connectClient({ roomId, userId: buildUserId('rejoin_observer'), username: 'REJOIN_OBSERVER' });
  const first = await worker.connectClient({ roomId, userId: reconnectUserId, username: 'REJOIN_ALPHA' });

  await withDebug(roomId, [observer, first], async () => {
    await observer.waitForMessage('welcome', null, SNAPSHOT_TIMEOUT_MS);
    await first.waitForMessage('welcome', null, SNAPSHOT_TIMEOUT_MS);
    await waitForBothClientsToSee(roomId, observer, first, [observer.userId, reconnectUserId]);

    await applyFixtureAndWait(roomId, [observer, first], [
      { userId: reconnectUserId, x: openLayout.mover.x, z: openLayout.mover.z, yaw: 0, pitch: 0, clearSpawnShield: true, weaponId: 'rifle' },
      { userId: observer.userId, x: openLayout.observer.x, z: openLayout.observer.z, yaw: 0, pitch: 0, clearSpawnShield: true, weaponId: 'rifle' }
    ]);

    await first.close();
    await delay(250);

    const second = await worker.connectClient({ roomId, userId: reconnectUserId, username: 'REJOIN_ALPHA' });
    try {
      await second.waitForMessage('welcome', null, SNAPSHOT_TIMEOUT_MS);
      await observer.waitForSnapshot(() => !!observer.latestEntity(reconnectUserId), SNAPSHOT_TIMEOUT_MS);
      const baselineZ = Number(observer.latestEntity(reconnectUserId).z || 0);

      await sendForwardBurst(second, 1, 8);
      await observer.waitForSnapshot(() => {
        const entity = observer.latestEntity(reconnectUserId);
        return entity && Number(entity.z || 0) < (baselineZ - 0.35);
      }, SNAPSHOT_TIMEOUT_MS);

      assert.ok(observer.latestEntity(reconnectUserId));
    } finally {
      await second.close().catch(() => null);
    }
  });
});

test('real worker: delayed inputs still converge without giant teleports', { timeout: TEST_TIMEOUT_MS }, async () => {
  const roomId = buildRoomId('delay');
  const delayedMover = await worker.connectClient({
    roomId,
    userId: buildUserId('delay_mover'),
    username: 'DELAY_MOVER',
    outboundDelayMs: 70,
    outboundJitterMs: 20,
    randomSeed: 42
  });
  const observer = await worker.connectClient({ roomId, userId: buildUserId('delay_observer'), username: 'DELAY_OBSERVER' });

  await withDebug(roomId, [delayedMover, observer], async () => {
    await delayedMover.waitForMessage('welcome', null, SNAPSHOT_TIMEOUT_MS);
    await observer.waitForMessage('welcome', null, SNAPSHOT_TIMEOUT_MS);
    await waitForBothClientsToSee(roomId, delayedMover, observer, [delayedMover.userId, observer.userId]);

    await applyFixtureAndWait(roomId, [delayedMover, observer], [
      { userId: delayedMover.userId, x: openLayout.mover.x, z: openLayout.mover.z, yaw: 0, pitch: 0, clearSpawnShield: true, weaponId: 'rifle' },
      { userId: observer.userId, x: openLayout.observer.x, z: openLayout.observer.z, yaw: 0, pitch: 0, clearSpawnShield: true, weaponId: 'rifle' }
    ]);

    const startIndex = observer.messages.length;
    const startSnapshot = observer.latestSnapshot;
    const startServerTime = Number(startSnapshot && startSnapshot.serverTime || 0);

    await sendForwardBurst(delayedMover, 1, MOVEMENT_STEPS);
    await observer.waitForSnapshot((message) => Number(message.serverTime || 0) > startServerTime, SNAPSHOT_TIMEOUT_MS);

    await waitForCondition(() => {
      const moverSelf = delayedMover.latestEntity(delayedMover.userId);
      const moverRemote = observer.latestEntity(delayedMover.userId);
      if (!moverSelf || !moverRemote) return false;
      return distanceXZ(moverSelf, moverRemote) < 1.2 ? true : false;
    }, SNAPSHOT_TIMEOUT_MS, 'delayed movement convergence');

    const samples = snapshotEntitySamples(observer, delayedMover.userId, startIndex);
    assert.ok(samples.length >= 2);
    let maxStep = 0;
    for (let i = 1; i < samples.length; i++) {
      maxStep = Math.max(maxStep, distanceXZ(samples[i], samples[i - 1]));
    }
    assert.ok(maxStep < 4.0, `expected no giant teleports, saw step ${maxStep.toFixed(3)}`);
  });
});
