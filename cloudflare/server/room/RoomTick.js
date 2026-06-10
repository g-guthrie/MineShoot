export function ensureRoomTick(room, deps = {}) {
  if (!room || room.tickHandle) return;
  const nowMs = deps.nowMs || Date.now;
  const setTimer = deps.setInterval || setInterval;
  const tickMs = Math.max(1, Number(deps.tickMs || 1000 / 60));
  room.lastTickAt = nowMs();
  // Re-anchor the simulation clock to wall time: a room resuming after idle
  // would otherwise keep a stale simulationNowMs and stamp everything in the
  // past until the accumulator caught up (which it never does).
  room.simulationNowMs = room.lastTickAt;
  room.simulationAccumulatorMs = 0;
  room.snapshotAccumulatorMs = 0;
  room.lastSnapshotAt = 0;
  room.tickHandle = setTimer(() => {
    try {
      room.tick();
    } catch (err) {
      const logger = deps.console || console;
      if (logger && typeof logger.error === 'function') logger.error('tick error', err);
    }
  }, tickMs);
}

export function stopRoomTickIfEmpty(room, deps = {}) {
  if (!room || room.clients && room.clients.size > 0) return false;
  if (room.players instanceof Map) {
    for (const player of room.players.values()) {
      if (!player) continue;
      if (typeof room.isServerOwnedFixtureEntity === 'function' && room.isServerOwnedFixtureEntity(player)) continue;
      if (player.fixtureType === 'sim_player') continue;
      return false;
    }
  }
  if (typeof room.removePublicMatchBots === 'function') room.removePublicMatchBots();
  if (
    typeof room.resetPublicRoomToIdle === 'function' &&
    typeof room.isPublicMatchRoom === 'function' &&
    room.isPublicMatchRoom()
  ) {
    room.resetPublicRoomToIdle();
  }
  if (room.tickHandle) {
    const clearTimer = deps.clearInterval || clearInterval;
    clearTimer(room.tickHandle);
    room.tickHandle = null;
  }
  room.inSimulationTick = false;
  room.simulationAccumulatorMs = 0;
  room.snapshotAccumulatorMs = 0;
  return true;
}

export function currentRoomNowMs(room, nowMs = Date.now) {
  if (room && room.inSimulationTick) {
    return Math.max(0, Number(room.simulationNowMs || 0));
  }
  return nowMs();
}

export function tickRoom(room, deps = {}) {
  if (!room) return;
  const nowMs = deps.nowMs || Date.now;
  const tickProjectiles = deps.tickProjectiles || function () {};
  const tickFireZones = deps.tickFireZones || function () {};
  const simTickMs = Math.max(1, Number(deps.simTickMs || 1000 / 60));
  const snapshotTickMs = Math.max(1, Number(deps.snapshotTickMs || simTickMs));
  const maxFrameMs = Math.max(simTickMs, Number(deps.maxFrameMs || 250));
  const maxSteps = Math.max(1, Math.floor(Number(deps.maxSteps || 6)));

  const now = nowMs();
  const frameDeltaMs = Math.max(0, Math.min(maxFrameMs, now - Number(room.lastTickAt || now)));
  room.lastTickAt = now;

  room.cleanupDisconnectedPlayers(now);
  if (!room.clients || room.clients.size === 0) {
    room.stopTickIfEmpty();
    return;
  }
  room.syncRoomFixtures();
  room.simulationAccumulatorMs = Math.min(maxFrameMs, Math.max(0, Number(room.simulationAccumulatorMs || 0)) + frameDeltaMs);
  room.snapshotAccumulatorMs = Math.min(maxFrameMs, Math.max(0, Number(room.snapshotAccumulatorMs || 0)) + frameDeltaMs);

  let simSteps = 0;
  while (room.simulationAccumulatorMs >= simTickMs && simSteps < maxSteps) {
    room.inSimulationTick = true;
    room.simulationNowMs = Number(room.simulationNowMs || now) + simTickMs;
    const dtSec = simTickMs / 1000;
    room.maybeResetPublicMatch();
    room.startPublicMatchIfReady();
    room.tickEntityMatchEntries();
    room.tickPlayers(dtSec);
    room.recordAliveEntityPoseHistories(room.currentNowMs());
    tickProjectiles(room, dtSec);
    tickFireZones(room, dtSec);
    room.updateLeaderProgress();
    room.simulationAccumulatorMs -= simTickMs;
    simSteps += 1;
  }
  room.inSimulationTick = false;

  if (simSteps >= maxSteps && room.simulationAccumulatorMs >= simTickMs) {
    room.simulationAccumulatorMs = Math.min(room.simulationAccumulatorMs, simTickMs);
  }

  // simulationNowMs only ever advances by the dt actually stepped above, so
  // snapshot stamps always match the simulated state. In steady state it
  // tracks wall time exactly (simulationNowMs + accumulator === now); when
  // the maxFrameMs/maxSteps clamps drop time, only the accumulator is
  // re-anchored (the clamps above) — re-deriving the stamp from
  // `now - accumulator` here would jump it past the time entities were
  // simulated to, and clients would read the gap as a backward-velocity
  // glitch. ensureRoomTick re-anchors the clock when a room resumes.

  if (room.snapshotAccumulatorMs >= snapshotTickMs) {
    room.broadcastSnapshot(false);
    room.snapshotAccumulatorMs = room.snapshotAccumulatorMs % snapshotTickMs;
    room.lastSnapshotAt = now;
  }

  room.stopTickIfEmpty();
}
