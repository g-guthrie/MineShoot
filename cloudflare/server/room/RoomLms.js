export function configureLmsBeaconAnchors(room, deps) {
  deps = deps || {};
  const buildLmsBeaconAnchors = deps.buildLmsBeaconAnchors;
  room.lmsBeaconAnchors = buildLmsBeaconAnchors({
    boundsMin: room.boundsMin || 2,
    boundsMax: room.boundsMax || 110
  });
}

export function lmsMatchEntities(room) {
  return room.modeEntities().filter((entity) => (
    !!entity &&
    !(room && typeof room.isEntityDisconnected === 'function' && room.isEntityDisconnected(entity)) &&
    Number(entity.disconnectedAt || 0) <= 0
  ));
}

export function currentLmsBeacon(room) {
  if (!room.matchState || !room.matchState.lms) return null;
  const index = Number(room.matchState.lms.activeBeaconIndex || 0);
  if (!room.lmsBeaconAnchors.length) return null;
  return room.lmsBeaconAnchors[Math.max(0, Math.min(room.lmsBeaconAnchors.length - 1, index))] || null;
}

export function lmsRemainingPlayers(room) {
  let remaining = 0;
  const entities = room.lmsMatchEntities();
  for (let i = 0; i < entities.length; i++) {
    if (Number(entities[i].lmsLives || 0) > 0) remaining++;
  }
  return remaining;
}

export function lmsWinnerId(room) {
  const entities = room.lmsMatchEntities();
  for (let i = 0; i < entities.length; i++) {
    if (Number(entities[i].lmsLives || 0) > 0) return entities[i].id;
  }
  return '';
}

export function syncLmsPublicState(room, deps) {
  deps = deps || {};
  const nowMs = deps.nowMs;
  const lmsRules = deps.lmsRules || {};
  if (!room.matchState || !room.matchState.lms) return;
  const lms = room.matchState.lms;
  const beacon = room.currentLmsBeacon();
  lms.activeBeacon = beacon ? {
    id: beacon.id,
    label: beacon.label,
    x: Number(beacon.x.toFixed(3)),
    z: Number(beacon.z.toFixed(3))
  } : null;
  lms.remainingPlayers = room.lmsRemainingPlayers();
  lms.bankingEnabled = !!(lms.warmupEndsAt && nowMs() >= lms.warmupEndsAt) &&
    lms.remainingPlayers > Number(lms.finalBankingCutoffRemaining || lmsRules.finalBankingCutoffRemaining);
}

export function initializeLmsMatchState(room, deps, now) {
  deps = deps || {};
  const lmsRules = deps.lmsRules || {};
  const resetEntityForLmsRound = deps.resetEntityForLmsRound;
  const createWeaponAmmoRuntime = deps.createWeaponAmmoRuntime;
  const createMovementInputState = deps.createMovementInputState;
  const gameModeLms = deps.gameModeLms || 'lms';
  const currentNow = now != null ? now : (deps.nowMs ? deps.nowMs() : 0);

  if (room.gameMode !== gameModeLms || !room.matchState) return;
  const entities = room.lmsMatchEntities();
  room.matchState.lms = {
    startingLives: lmsRules.startingLives,
    maxLives: lmsRules.maxLives,
    chargePerExtraLife: lmsRules.chargePerExtraLife,
    remainingPlayers: 0,
    finalBankingCutoffRemaining: lmsRules.finalBankingCutoffRemaining,
    warmupEndsAt: currentNow + lmsRules.beaconWarmupMs,
    nextRotateAt: currentNow + lmsRules.beaconRotateMs,
    activeBeaconIndex: room.lmsBeaconAnchors.length ? 0 : -1,
    activeBeacon: null,
    bankingEnabled: false
  };
  for (let i = 0; i < entities.length; i++) {
    const entity = entities[i];
    resetEntityForLmsRound(entity, {
      startingLives: lmsRules.startingLives,
      createThrowableRuntime: () => room.createThrowableRuntime(),
      createWeaponAmmoRuntime,
      createMovementInputState,
      zeroAim: entity.fixtureType === 'sim_player'
    });
    room.spawnEntityRandomly(entity);
    room.applySpawnShield(entity);
  }
  room.syncLmsPublicState();
}

export function ensureLmsStartedState(room, deps) {
  deps = deps || {};
  const gameModeLms = deps.gameModeLms || 'lms';
  const nowMs = deps.nowMs;
  if (room.gameMode !== gameModeLms || !room.matchState || !room.matchState.started || room.matchState.ended) return;
  if (!room.matchState.lms || !room.matchState.lms.activeBeacon) {
    room.initializeLmsMatchState(room.matchState.startedAt || nowMs());
  }
}

export function rotateLmsBeacon(room, deps, now) {
  deps = deps || {};
  const lmsRules = deps.lmsRules || {};
  const currentNow = now != null ? now : (deps.nowMs ? deps.nowMs() : 0);
  if (!room.matchState || !room.matchState.lms || !room.lmsBeaconAnchors.length) return;
  const lms = room.matchState.lms;
  const nextIndex = (Number(lms.activeBeaconIndex || 0) + 1) % room.lmsBeaconAnchors.length;
  lms.activeBeaconIndex = nextIndex;
  lms.nextRotateAt = currentNow + lmsRules.beaconRotateMs;
  for (const entity of room.lmsMatchEntities()) {
    if (entity) entity.lmsBankState = null;
  }
  room.syncLmsPublicState();
}

export function maybeRotateLmsBeacon(room, deps, now) {
  const currentNow = now != null ? now : (deps && deps.nowMs ? deps.nowMs() : 0);
  if (!room.matchState || !room.matchState.lms || !room.lmsBeaconAnchors.length) return;
  const lms = room.matchState.lms;
  if (currentNow < Number(lms.nextRotateAt || 0)) return;
  room.rotateLmsBeacon(currentNow);
}

export function tickLmsMode(room, deps, now) {
  deps = deps || {};
  const nowMs = deps.nowMs;
  const lmsRules = deps.lmsRules || {};
  const gameModeLms = deps.gameModeLms || 'lms';
  const currentNow = now != null ? now : (nowMs ? nowMs() : 0);
  if (room.gameMode !== gameModeLms || !room.matchState || !room.matchState.started || room.matchState.ended) return;
  room.ensureLmsStartedState();
  room.maybeRotateLmsBeacon(currentNow);
  room.syncLmsPublicState();
  if (room.lmsRemainingPlayers() <= 1) {
    room.finishPublicMatch(room.lmsWinnerId(), '');
    return;
  }
  const beacon = room.currentLmsBeacon();
  const lms = room.matchState.lms;
  if (!beacon || !lms) return;

  for (const entity of room.lmsMatchEntities()) {
    if (!entity || !entity.alive || Number(entity.lmsLives || 0) <= 0) {
      if (entity) entity.lmsBankState = null;
      continue;
    }
    const hasCharge = Number(entity.lmsCharge || 0) >= lmsRules.chargePerExtraLife;
    const canGainLife = Number(entity.lmsLives || 0) < lmsRules.startingLives;
    const dx = Number(entity.x || 0) - beacon.x;
    const dz = Number(entity.z || 0) - beacon.z;
    const inRange = Math.sqrt((dx * dx) + (dz * dz)) <= lmsRules.beaconBankRadius;
    const interrupted = entity.lmsBankState && Number(entity.lastDamageAt || 0) > Number(entity.lmsBankState.startedAt || 0);
    if (!lms.bankingEnabled || !hasCharge || !canGainLife || !inRange || interrupted) {
      entity.lmsBankState = null;
      continue;
    }
    if (!entity.lmsBankState || entity.lmsBankState.beaconId !== beacon.id) {
      entity.lmsBankState = {
        beaconId: beacon.id,
        startedAt: currentNow,
        endsAt: currentNow + lmsRules.beaconChannelMs
      };
      continue;
    }
    if (currentNow < Number(entity.lmsBankState.endsAt || 0)) continue;
    entity.lmsCharge = Math.max(0, Number(entity.lmsCharge || 0) - lmsRules.chargePerExtraLife);
    entity.lmsLives = Math.min(lmsRules.startingLives, Number(entity.lmsLives || 0) + 1);
    entity.progressScore = entity.lmsLives;
    entity.lmsBankState = null;
    room.rotateLmsBeacon(currentNow);
    break;
  }
  room.updateLeaderProgress();
}
