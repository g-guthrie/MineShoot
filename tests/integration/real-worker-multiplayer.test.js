import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';

import { buildExpectedWorldMeta } from '../../shared/protocol.js';
import { buildWorldCollisionData } from '../../shared/world-collision.js';
import { PLAYER_HEIGHT, PLAYER_RADIUS } from '../../shared/entity-constants.js';
import { gameplayTuning } from '../../shared/gameplay-tuning.js';
import { createRealWorkerHarness } from '../helpers/real-worker-harness.js';

const SNAPSHOT_TIMEOUT_MS = 15_000;
const TEST_TIMEOUT_MS = 180_000;
const FIXTURE_RADIUS = PLAYER_RADIUS + 0.2;
const MOVEMENT_STEP_DT_MS = 50;
const MOVEMENT_STEP_WAIT_MS = 15;
const MOVEMENT_STEPS = 16;
const COMBAT_FOV_DEG = 56;
const RIFLE_MAGAZINE_SIZE = Number(gameplayTuning.weaponStats && gameplayTuning.weaponStats.rifle && gameplayTuning.weaponStats.rifle.magazineSize || 14);
const RIFLE_SHOT_WAIT_MS = Math.max(
  50,
  Number(gameplayTuning.weaponStats && gameplayTuning.weaponStats.rifle && gameplayTuning.weaponStats.rifle.cooldownMs || 400) + 40
);

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

function countMessages(client, type, predicate = null) {
  let count = 0;
  for (let i = 0; i < client.messages.length; i++) {
    const message = client.messages[i] && client.messages[i].message;
    if (String(message && message.t || '') !== String(type || '')) continue;
    if (predicate && !predicate(message)) continue;
    count += 1;
  }
  return count;
}

async function expectNoMessage(client, type, predicate, waitMs = 700) {
  const before = countMessages(client, type, predicate);
  await delay(waitMs);
  const after = countMessages(client, type, predicate);
  assert.equal(after, before, `expected no new ${type} for ${client.userId}`);
}

async function equipLoadout(client, slot1, slot2, weaponId, timeoutMs = SNAPSHOT_TIMEOUT_MS) {
  await client.sendWeaponLoadout(slot1, slot2);
  await client.sendEquipWeapon(weaponId);
  await client.waitForSnapshot(() => {
    const entity = client.latestEntity(client.userId);
    return entity &&
      String(entity.weaponId || '') === String(weaponId || '') &&
      Array.isArray(entity.weaponLoadout) &&
      String(entity.weaponLoadout[0] || '') === String(slot1 || '') &&
      String(entity.weaponLoadout[1] || '') === String(slot2 || '');
  }, timeoutMs);
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

      await sendForwardBurst(socketB, 100, 12);
      await observer.waitForSnapshot(() => {
        const entity = observer.latestEntity(sharedUserId);
        return entity && Number(entity.z || 0) < (unchangedZ - 0.2);
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

    await equipLoadout(shooter, 'rifle', 'shotgun', 'rifle');

    let killed = false;
    let sawRespawn = false;
    for (let shotIndex = 0; shotIndex < 12 && !killed; shotIndex++) {
      const shooterState = shooter.latestEntity(shooter.userId);
      const targetState = shooter.latestEntity(target.userId);
      assert.ok(shooterState);
      assert.ok(targetState);

      const shotToken = `itest-shot-${shotIndex}`;
      const beforeHp = Number(targetState.hp || 0);
      const beforeArmor = Number(targetState.armor || 0);
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
        if (!current) return false;
        return Number(current.hp || 0) < beforeHp || Number(current.armor || 0) < beforeArmor;
      }, SNAPSHOT_TIMEOUT_MS);

      killed = !!targetDamage.killed;
      if (killed) {
        const respawn = await target.waitForMessage('death_respawn', (message) => {
          return String(message.entityId || '') === target.userId;
        }, SNAPSHOT_TIMEOUT_MS);
        sawRespawn = !!respawn;
      } else {
        await delay(RIFLE_SHOT_WAIT_MS);
      }
    }

    assert.equal(killed, true);
    assert.equal(sawRespawn, true);
  });
});

test('real worker: sniper fire without ads is rejected by the server', { timeout: TEST_TIMEOUT_MS }, async () => {
  const roomId = buildRoomId('sniper');
  const shooter = await worker.connectClient({ roomId, userId: buildUserId('sniper_shooter'), username: 'SNIPER_SHOOTER' });
  const target = await worker.connectClient({ roomId, userId: buildUserId('sniper_target'), username: 'SNIPER_TARGET' });

  await withDebug(roomId, [shooter, target], async () => {
    await shooter.waitForMessage('welcome', null, SNAPSHOT_TIMEOUT_MS);
    await target.waitForMessage('welcome', null, SNAPSHOT_TIMEOUT_MS);
    await waitForBothClientsToSee(roomId, shooter, target, [shooter.userId, target.userId]);

    await applyFixtureAndWait(roomId, [shooter, target], [
      { userId: shooter.userId, x: openLayout.mover.x, z: openLayout.mover.z, yaw: 0, pitch: 0, clearSpawnShield: true, weaponId: 'sniper' },
      { userId: target.userId, x: openLayout.target.x, z: openLayout.target.z, yaw: Math.PI, pitch: 0, clearSpawnShield: true, weaponId: 'rifle' }
    ]);

    await equipLoadout(shooter, 'sniper', 'rifle', 'sniper');

    const shooterState = shooter.latestEntity(shooter.userId);
    const targetState = shooter.latestEntity(target.userId);
    const beforeAmmo = Number(shooterState.weaponAmmo.sniper.ammoInMag || 0);
    const beforeArmor = Number(targetState.armor || 0);
    const shotToken = 'sniper-no-ads';

    await shooter.sendFire({
      weaponId: 'sniper',
      shotToken,
      adsActive: false,
      viewFovDeg: 75,
      aimOrigin: { x: shooterState.x, y: shooterState.y, z: shooterState.z },
      aimForward: normalizeForward(shooterState, targetState),
      estimatedServerShotTime: Number(shooter.latestSnapshot && shooter.latestSnapshot.serverTime || 0)
    });

    await expectNoMessage(target, 'damage_event', (message) => String(message.shotToken || '') === shotToken, 900);
    await target.waitForSnapshot(() => {
      const current = target.latestEntity(target.userId);
      return current && Number(current.armor || 0) === beforeArmor;
    }, SNAPSHOT_TIMEOUT_MS);
    await shooter.waitForSnapshot(() => {
      const current = shooter.latestEntity(shooter.userId);
      const ammo = current && current.weaponAmmo && current.weaponAmmo.sniper;
      return ammo && Number(ammo.ammoInMag || 0) === beforeAmmo;
    }, SNAPSHOT_TIMEOUT_MS);
  });
});

test('real worker: firing faster than cooldown only produces one authoritative hit', { timeout: TEST_TIMEOUT_MS }, async () => {
  const roomId = buildRoomId('cooldown');
  const shooter = await worker.connectClient({ roomId, userId: buildUserId('cooldown_shooter'), username: 'COOLDOWN_SHOOTER' });
  const target = await worker.connectClient({ roomId, userId: buildUserId('cooldown_target'), username: 'COOLDOWN_TARGET' });

  await withDebug(roomId, [shooter, target], async () => {
    await shooter.waitForMessage('welcome', null, SNAPSHOT_TIMEOUT_MS);
    await target.waitForMessage('welcome', null, SNAPSHOT_TIMEOUT_MS);
    await waitForBothClientsToSee(roomId, shooter, target, [shooter.userId, target.userId]);

    await applyFixtureAndWait(roomId, [shooter, target], [
      { userId: shooter.userId, x: openLayout.mover.x, z: openLayout.mover.z, yaw: 0, pitch: 0, clearSpawnShield: true, weaponId: 'rifle' },
      { userId: target.userId, x: openLayout.target.x, z: openLayout.target.z, yaw: Math.PI, pitch: 0, clearSpawnShield: true, weaponId: 'rifle' }
    ]);

    await equipLoadout(shooter, 'rifle', 'shotgun', 'rifle');

    const shooterState = shooter.latestEntity(shooter.userId);
    const targetState = shooter.latestEntity(target.userId);
    const beforeAmmo = Number(shooterState.weaponAmmo.rifle.ammoInMag || 0);
    const aimForward = normalizeForward(shooterState, targetState);

    await shooter.sendFire({
      weaponId: 'rifle',
      shotToken: 'cooldown-1',
      adsActive: true,
      viewFovDeg: COMBAT_FOV_DEG,
      aimOrigin: { x: shooterState.x, y: shooterState.y, z: shooterState.z },
      aimForward,
      estimatedServerShotTime: Number(shooter.latestSnapshot && shooter.latestSnapshot.serverTime || 0)
    });
    await shooter.sendFire({
      weaponId: 'rifle',
      shotToken: 'cooldown-2',
      adsActive: true,
      viewFovDeg: COMBAT_FOV_DEG,
      aimOrigin: { x: shooterState.x, y: shooterState.y, z: shooterState.z },
      aimForward,
      estimatedServerShotTime: Number(shooter.latestSnapshot && shooter.latestSnapshot.serverTime || 0)
    });

    await target.waitForMessage('damage_event', (message) => String(message.shotToken || '') === 'cooldown-1', SNAPSHOT_TIMEOUT_MS);
    await expectNoMessage(target, 'damage_event', (message) => String(message.shotToken || '') === 'cooldown-2', 900);
    await shooter.waitForSnapshot(() => {
      const current = shooter.latestEntity(shooter.userId);
      const ammo = current && current.weaponAmmo && current.weaponAmmo.rifle;
      return ammo && Number(ammo.ammoInMag || 0) === (beforeAmmo - 1);
    }, SNAPSHOT_TIMEOUT_MS);
  });
});

test('real worker: reload blocks fire until the server finishes reloading', { timeout: TEST_TIMEOUT_MS }, async () => {
  const roomId = buildRoomId('reload');
  const shooter = await worker.connectClient({ roomId, userId: buildUserId('reload_shooter'), username: 'RELOAD_SHOOTER' });
  const target = await worker.connectClient({ roomId, userId: buildUserId('reload_target'), username: 'RELOAD_TARGET' });

  await withDebug(roomId, [shooter, target], async () => {
    await shooter.waitForMessage('welcome', null, SNAPSHOT_TIMEOUT_MS);
    await target.waitForMessage('welcome', null, SNAPSHOT_TIMEOUT_MS);
    await waitForBothClientsToSee(roomId, shooter, target, [shooter.userId, target.userId]);

    await applyFixtureAndWait(roomId, [shooter, target], [
      { userId: shooter.userId, x: openLayout.mover.x, z: openLayout.mover.z, yaw: 0, pitch: 0, clearSpawnShield: true, weaponId: 'rifle' },
      { userId: target.userId, x: openLayout.target.x, z: openLayout.target.z, yaw: Math.PI, pitch: 0, clearSpawnShield: true, weaponId: 'rifle' }
    ]);

    await equipLoadout(shooter, 'rifle', 'shotgun', 'rifle');
    const aim = normalizeForward(shooter.latestEntity(shooter.userId), target.latestEntity(target.userId));

    for (let shotIndex = 0; shotIndex < 2; shotIndex++) {
      const shooterState = shooter.latestEntity(shooter.userId);
      await shooter.sendFire({
        weaponId: 'rifle',
        shotToken: `reload-primer-${shotIndex}`,
        adsActive: true,
        viewFovDeg: COMBAT_FOV_DEG,
        aimOrigin: { x: shooterState.x, y: shooterState.y, z: shooterState.z },
        aimForward: aim,
        estimatedServerShotTime: Number(shooter.latestSnapshot && shooter.latestSnapshot.serverTime || 0)
      });
      await target.waitForMessage('damage_event', (message) => String(message.shotToken || '') === `reload-primer-${shotIndex}`, SNAPSHOT_TIMEOUT_MS);
      await delay(RIFLE_SHOT_WAIT_MS);
    }

    await shooter.sendReload('rifle');
    await shooter.waitForSnapshot(() => {
      const current = shooter.latestEntity(shooter.userId);
      const ammo = current && current.weaponAmmo && current.weaponAmmo.rifle;
      return ammo && !!ammo.reloading;
    }, SNAPSHOT_TIMEOUT_MS);

    const duringReloadAmmo = Number(shooter.latestEntity(shooter.userId).weaponAmmo.rifle.ammoInMag || 0);
    await shooter.sendFire({
      weaponId: 'rifle',
      shotToken: 'reload-blocked',
      adsActive: true,
      viewFovDeg: COMBAT_FOV_DEG,
      aimOrigin: {
        x: shooter.latestEntity(shooter.userId).x,
        y: shooter.latestEntity(shooter.userId).y,
        z: shooter.latestEntity(shooter.userId).z
      },
      aimForward: aim,
      estimatedServerShotTime: Number(shooter.latestSnapshot && shooter.latestSnapshot.serverTime || 0)
    });

    await expectNoMessage(target, 'damage_event', (message) => String(message.shotToken || '') === 'reload-blocked', 900);
    await delay(300);
    const blockedFireState = shooter.latestEntity(shooter.userId);
    assert.ok(blockedFireState && blockedFireState.weaponAmmo && blockedFireState.weaponAmmo.rifle);
    assert.equal(Number(blockedFireState.weaponAmmo.rifle.ammoInMag || 0), duringReloadAmmo);
    assert.equal(!!blockedFireState.weaponAmmo.rifle.reloading, true);

    await shooter.waitForSnapshot(() => {
      const current = shooter.latestEntity(shooter.userId);
      const ammo = current && current.weaponAmmo && current.weaponAmmo.rifle;
      return ammo && !ammo.reloading && Number(ammo.ammoInMag || 0) >= RIFLE_MAGAZINE_SIZE;
    }, SNAPSHOT_TIMEOUT_MS);

    const postReloadState = shooter.latestEntity(shooter.userId);
    await shooter.sendFire({
      weaponId: 'rifle',
      shotToken: 'reload-after',
      adsActive: true,
      viewFovDeg: COMBAT_FOV_DEG,
      aimOrigin: { x: postReloadState.x, y: postReloadState.y, z: postReloadState.z },
      aimForward: aim,
      estimatedServerShotTime: Number(shooter.latestSnapshot && shooter.latestSnapshot.serverTime || 0)
    });
    await target.waitForMessage('damage_event', (message) => String(message.shotToken || '') === 'reload-after', SNAPSHOT_TIMEOUT_MS);
  });
});

test('real worker: third player observer receives the same authoritative damage event', { timeout: TEST_TIMEOUT_MS }, async () => {
  const roomId = buildRoomId('observe');
  const shooter = await worker.connectClient({ roomId, userId: buildUserId('observe_shooter'), username: 'OBS_SHOOTER' });
  const target = await worker.connectClient({ roomId, userId: buildUserId('observe_target'), username: 'OBS_TARGET' });
  const observer = await worker.connectClient({ roomId, userId: buildUserId('observe_viewer'), username: 'OBS_VIEWER' });

  await withDebug(roomId, [shooter, target, observer], async () => {
    await shooter.waitForMessage('welcome', null, SNAPSHOT_TIMEOUT_MS);
    await target.waitForMessage('welcome', null, SNAPSHOT_TIMEOUT_MS);
    await observer.waitForMessage('welcome', null, SNAPSHOT_TIMEOUT_MS);
    await waitForBothClientsToSee(roomId, shooter, target, [shooter.userId, target.userId]);
    await observer.waitForSnapshot(() => {
      return observer.latestEntity(shooter.userId) &&
        observer.latestEntity(target.userId) &&
        observer.latestEntity(observer.userId);
    }, SNAPSHOT_TIMEOUT_MS);

    await applyFixtureAndWait(roomId, [shooter, target, observer], [
      { userId: shooter.userId, x: openLayout.mover.x, z: openLayout.mover.z, yaw: 0, pitch: 0, clearSpawnShield: true, weaponId: 'rifle' },
      { userId: target.userId, x: openLayout.target.x, z: openLayout.target.z, yaw: Math.PI, pitch: 0, clearSpawnShield: true, weaponId: 'rifle' },
      { userId: observer.userId, x: openLayout.observer.x, z: openLayout.observer.z, yaw: 0, pitch: 0, clearSpawnShield: true, weaponId: 'rifle' }
    ]);

    await equipLoadout(shooter, 'rifle', 'shotgun', 'rifle');
    const shooterState = shooter.latestEntity(shooter.userId);
    const targetState = shooter.latestEntity(target.userId);

    await shooter.sendFire({
      weaponId: 'rifle',
      shotToken: 'observer-damage',
      adsActive: true,
      viewFovDeg: COMBAT_FOV_DEG,
      aimOrigin: { x: shooterState.x, y: shooterState.y, z: shooterState.z },
      aimForward: normalizeForward(shooterState, targetState),
      estimatedServerShotTime: Number(shooter.latestSnapshot && shooter.latestSnapshot.serverTime || 0)
    });

    const observedDamage = await observer.waitForMessage('damage_event', (message) => {
      return String(message.shotToken || '') === 'observer-damage' &&
        String(message.sourceId || '') === shooter.userId &&
        String(message.targetId || '') === target.userId;
    }, SNAPSHOT_TIMEOUT_MS);
    assert.equal(String(observedDamage.weaponId || ''), 'rifle');
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

test('real worker: packet loss with delay still converges without repeated giant teleports', { timeout: TEST_TIMEOUT_MS }, async () => {
  const roomId = buildRoomId('loss');
  const lossyMover = await worker.connectClient({
    roomId,
    userId: buildUserId('loss_mover'),
    username: 'LOSS_MOVER',
    outboundDelayMs: 60,
    outboundJitterMs: 25,
    outboundDropRate: 0.25,
    randomSeed: 7
  });
  const observer = await worker.connectClient({ roomId, userId: buildUserId('loss_observer'), username: 'LOSS_OBSERVER' });

  await withDebug(roomId, [lossyMover, observer], async () => {
    await lossyMover.waitForMessage('welcome', null, SNAPSHOT_TIMEOUT_MS);
    await observer.waitForMessage('welcome', null, SNAPSHOT_TIMEOUT_MS);
    await waitForBothClientsToSee(roomId, lossyMover, observer, [lossyMover.userId, observer.userId]);

    await applyFixtureAndWait(roomId, [lossyMover, observer], [
      { userId: lossyMover.userId, x: openLayout.mover.x, z: openLayout.mover.z, yaw: 0, pitch: 0, clearSpawnShield: true, weaponId: 'rifle' },
      { userId: observer.userId, x: openLayout.observer.x, z: openLayout.observer.z, yaw: 0, pitch: 0, clearSpawnShield: true, weaponId: 'rifle' }
    ]);

    const startIndex = observer.messages.length;
    const startSnapshot = observer.latestSnapshot;
    const startServerTime = Number(startSnapshot && startSnapshot.serverTime || 0);

    await sendForwardBurst(lossyMover, 1, MOVEMENT_STEPS);
    await observer.waitForSnapshot((message) => Number(message.serverTime || 0) > startServerTime, SNAPSHOT_TIMEOUT_MS);

    await waitForCondition(() => {
      const moverSelf = lossyMover.latestEntity(lossyMover.userId);
      const moverRemote = observer.latestEntity(lossyMover.userId);
      if (!moverSelf || !moverRemote) return false;
      return distanceXZ(moverSelf, moverRemote) < 1.8 ? true : false;
    }, SNAPSHOT_TIMEOUT_MS, 'lossy delayed movement convergence');

    const samples = snapshotEntitySamples(observer, lossyMover.userId, startIndex);
    assert.ok(samples.length >= 2);
    let maxStep = 0;
    for (let i = 1; i < samples.length; i++) {
      maxStep = Math.max(maxStep, distanceXZ(samples[i], samples[i - 1]));
    }
    assert.ok(maxStep < 4.5, `expected no repeated giant teleports, saw step ${maxStep.toFixed(3)}`);

    const stats = lossyMover.getTransportStats();
    assert.ok(stats.droppedOutboundCount > 0);
  });
});
