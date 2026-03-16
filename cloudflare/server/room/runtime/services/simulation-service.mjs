import { buildSnapshotPayload } from '../RoomSimulation.mjs';
import { toEntityState } from '../../EntitySerializer.js';

export function getLastProcessedInputSeq(runtime, userId) {
  const player = runtime.players.get(String(userId || ''));
  return player ? Math.max(0, Number(player.lastProcessedInputSeq || 0)) : 0;
}

export function tickPlayers(runtime, dtSec) {
  for (const player of runtime.players.values()) {
    runtime.respawnIfNeeded(player);
    runtime.simulatePlayerMovement(player, dtSec);
    runtime.regenArmor(player, dtSec);
    runtime.syncPlayerResultFromEntity(player);
  }
  runtime.recordAllEntityHistory(runtime.nowMs());
}

export function buildSnapshot(runtime, forceFull) {
  const entities = [];
  for (const player of runtime.players.values()) {
    entities.push(player);
  }

  const snapshot = buildSnapshotPayload({
    messageType: runtime.MSG_S2C.SNAPSHOT,
    serverTime: runtime.nowMs(),
    gameMode: runtime.gameMode,
    matchState: runtime.serializeMatchState(),
    entities,
    toEntityState,
    previousState: runtime.lastBroadcastEntityState,
    forceFull
  });

  runtime.lastBroadcastEntityState = snapshot.nextEntityState;
  snapshot.payload.ratePreset = runtime.rateConfig.preset;
  snapshot.payload.renderHz = runtime.rateConfig.renderHz;
  snapshot.payload.simHz = runtime.rateConfig.simHz;
  snapshot.payload.snapshotHz = runtime.rateConfig.snapshotHz;
  return snapshot.payload;
}

export function tick(runtime, connectedUserIds, options = {}) {
  const now = runtime.nowMs();
  const maxSteps = Math.max(1, Number(options.maxCatchUpSteps || 1));
  const elapsedMs = Math.max(0, Math.min(runtime.rateConfig.simIntervalMs * maxSteps, now - runtime.lastTickAt));
  runtime.lastTickAt = now;
  runtime.simAccumulatorMs += elapsedMs;
  runtime.snapshotAccumulatorMs += elapsedMs;

  let steps = 0;
  while (runtime.simAccumulatorMs >= runtime.rateConfig.simIntervalMs && steps < maxSteps) {
    runtime.simAccumulatorMs -= runtime.rateConfig.simIntervalMs;
    runtime.maybeResetPublicMatch(connectedUserIds);
    runtime.startPublicMatchIfReady(connectedUserIds);
    tickPlayers(runtime, runtime.rateConfig.simIntervalMs / 1000);
    runtime.updateLeaderProgress();
    steps++;
  }
  if (steps === maxSteps) {
    runtime.simAccumulatorMs = 0;
  }

  if (runtime.snapshotAccumulatorMs >= runtime.rateConfig.snapshotIntervalMs) {
    runtime.snapshotAccumulatorMs = runtime.snapshotAccumulatorMs % runtime.rateConfig.snapshotIntervalMs;
    const forceFull = (now - runtime.lastFullSnapshotAt) >= Math.max(0, Number(options.fullResyncMs || 0));
    const payload = buildSnapshot(runtime, forceFull);
    runtime.lastSnapshotAt = now;
    if (forceFull) runtime.lastFullSnapshotAt = now;
    return payload;
  }

  return null;
}
