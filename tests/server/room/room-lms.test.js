import test from 'node:test';
import assert from 'node:assert/strict';

import {
  configureLmsBeaconAnchors,
  currentLmsBeacon,
  ensureLmsStartedState,
  initializeLmsMatchState,
  lmsRemainingPlayers,
  lmsWinnerId,
  rotateLmsBeacon,
  syncLmsPublicState,
  tickLmsMode
} from '../../../cloudflare/server/room/RoomLms.js';

const lmsRules = {
  startingLives: 3,
  maxLives: 5,
  chargePerExtraLife: 100,
  finalBankingCutoffRemaining: 1,
  beaconWarmupMs: 5000,
  beaconRotateMs: 8000,
  beaconBankRadius: 6,
  beaconChannelMs: 1200
};

function makeRoom() {
  const room = {
    roomName: 'lms-01',
    boundsMin: 2,
    boundsMax: 110,
    gameMode: 'lms',
    lmsBeaconAnchors: [],
    players: new Map([
      ['u1', { id: 'u1', alive: true, lmsLives: 0, lmsCharge: 0, lmsBankState: null, fixtureType: '' }],
      ['u2', { id: 'u2', alive: true, lmsLives: 0, lmsCharge: 0, lmsBankState: null, fixtureType: '' }]
    ]),
    matchState: { started: true, ended: false, startedAt: 10, lms: null },
    modeEntities() { return Array.from(this.players.values()); },
    createThrowableRuntime() { return {}; },
    spawnCalls: 0,
    spawnEntityRandomly() { this.spawnCalls += 1; },
    shieldCalls: 0,
    applySpawnShield() { this.shieldCalls += 1; },
    finishCalls: [],
    finishPublicMatch(winnerId, winnerTeam) { this.finishCalls.push({ winnerId, winnerTeam }); },
    leaderUpdates: 0,
    updateLeaderProgress() { this.leaderUpdates += 1; }
  };
  room.lmsMatchEntities = function () { return this.modeEntities(); };
  room.currentLmsBeacon = function () { return currentLmsBeacon(this); };
  room.lmsRemainingPlayers = function () { return lmsRemainingPlayers(this); };
  room.lmsWinnerId = function () { return lmsWinnerId(this); };
  room.syncLmsPublicState = function () { return syncLmsPublicState(this, { nowMs: () => 6000, lmsRules }); };
  room.rotateLmsBeacon = function (now) { return rotateLmsBeacon(this, { nowMs: () => now, lmsRules }, now); };
  room.initializeLmsMatchState = function (now) {
    return initializeLmsMatchState(this, {
      nowMs: () => now,
      lmsRules,
      resetEntityForLmsRound(entity, options) {
        entity.lmsLives = options.startingLives;
        entity.lmsCharge = 0;
        entity.lmsBankState = null;
      },
      createWeaponAmmoRuntime() { return {}; },
      createMovementInputState() { return {}; },
      gameModeLms: 'lms'
    }, now);
  };
  room.ensureLmsStartedState = function () {
    return ensureLmsStartedState(this, { gameModeLms: 'lms', nowMs: () => 9000 });
  };
  room.maybeRotateLmsBeacon = function (now) {
    return now >= 5000 ? undefined : undefined;
  };
  return room;
}

test('lms helper configures anchors and initializes/publicizes match state', () => {
  const room = makeRoom();
  configureLmsBeaconAnchors(room, {
    buildLmsBeaconAnchors() {
      return [{ id: 'b1', label: 'A', x: 10, z: 20 }];
    }
  });
  assert.equal(room.lmsBeaconAnchors.length, 1);

  room.initializeLmsMatchState(100);

  assert.equal(room.spawnCalls, 2);
  assert.equal(room.shieldCalls, 2);
  assert.equal(room.matchState.lms.activeBeaconIndex, 0);
  assert.equal(currentLmsBeacon(room).id, 'b1');

  syncLmsPublicState(room, { nowMs: () => 6000, lmsRules });
  assert.equal(room.matchState.lms.activeBeacon.id, 'b1');
  assert.equal(room.matchState.lms.remainingPlayers, 2);
  assert.equal(room.matchState.lms.bankingEnabled, true);
});

test('lms helper rotates beacons and resolves banking/winner flow', () => {
  const room = makeRoom();
  room.lmsBeaconAnchors = [
    { id: 'b1', label: 'A', x: 0, z: 0 },
    { id: 'b2', label: 'B', x: 10, z: 0 }
  ];
  room.matchState.lms = {
    startingLives: 3,
    maxLives: 5,
    chargePerExtraLife: 100,
    remainingPlayers: 2,
    finalBankingCutoffRemaining: 1,
    warmupEndsAt: 1,
    nextRotateAt: 0,
    activeBeaconIndex: 0,
    activeBeacon: { id: 'b1', label: 'A', x: 0, z: 0 },
    bankingEnabled: true
  };
  room.players.get('u1').x = 0;
  room.players.get('u1').z = 0;
  room.players.get('u1').lmsLives = 2;
  room.players.get('u1').lmsCharge = 100;
  room.players.get('u1').lmsBankState = {
    beaconId: 'b1',
    startedAt: 7000,
    endsAt: 8200
  };
  room.players.get('u2').x = 30;
  room.players.get('u2').z = 0;
  room.players.get('u2').lmsLives = 1;
  room.syncLmsPublicState = function () { return syncLmsPublicState(this, { nowMs: () => 9000, lmsRules }); };
  room.ensureLmsStartedState = function () { return ensureLmsStartedState(this, { gameModeLms: 'lms', nowMs: () => 9000 }); };
  room.maybeRotateLmsBeacon = function (_now) {};
  room.rotateLmsBeacon = function (now) {
    return rotateLmsBeacon(this, { nowMs: () => now, lmsRules }, now);
  };

  tickLmsMode(room, { nowMs: () => 9000, lmsRules, gameModeLms: 'lms' }, 9000);
  assert.equal(room.players.get('u1').lmsLives, 3);
  assert.equal(room.players.get('u1').lmsCharge, 0);
  assert.equal(room.matchState.lms.activeBeaconIndex, 1);
  assert.equal(room.leaderUpdates, 1);

  room.players.get('u2').lmsLives = 0;
  tickLmsMode(room, { nowMs: () => 9100, lmsRules, gameModeLms: 'lms' }, 9100);
  assert.deepEqual(room.finishCalls, [{ winnerId: 'u1', winnerTeam: '' }]);
});
