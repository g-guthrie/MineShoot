import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

async function loadRuntimeMatchActionsHarness(options = {}) {
  const code = await fs.readFile(new URL('../../js/app/runtime-match-actions.js', import.meta.url), 'utf8');
  const predictedFeedback = [];
  const sentFire = [];
  const sentEquip = [];
  const triggerActions = [];
  const audioCalls = [];
  const weaponInfoUpdates = [];
  const weaponModelUpdates = [];
  const reticleUpdates = [];
  const setWeaponCalls = [];
  const debugMessages = [];
  const cancelSprintTemporarilyCalls = [];
  const fireOrder = [];
  const prepareWeaponFireCalls = [];
  const timers = [];
  const shotSample = { weaponId: 'rifle', aimOrigin: { x: 1, y: 2, z: 3 } };
  const observedSamples = [];
  let prepareWeaponFireResult = !!options.prepareWeaponFireResult;
  let sendEquipResult = options.sendEquipResult !== false;
  const playerState = {
    networkSprint: false,
    sprintKeyHeld: false,
    sprinting: false,
    ...((options && options.playerState) || {})
  };
  const sandbox = {
    console,
    Date: class FakeDate extends Date {
      static now() {
        return 1700000000000;
      }
    },
    setTimeout(callback, delayMs) {
      timers.push({ callback, delayMs: Number(delayMs || 0) });
      return timers.length;
    },
    clearTimeout() {},
    document: {
      hasFocus() {
        return true;
      }
    },
    globalThis: null,
    __MAYHEM_RUNTIME: {}
  };
  sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox);
  vm.runInContext(code, context);
  const factory = sandbox.__MAYHEM_RUNTIME.GameRuntimeMatchActions;
  const actions = factory.create({
    isMultiplayerMode() { return true; },
    getCamera() { return { fov: 56 }; },
    getGamePlayerApi() {
      return {
        canUseWeapon() { return true; },
        isRolling() { return false; },
        getNetworkInputState() { return { sprint: !!playerState.networkSprint }; },
        isSprintKeyHeld() { return !!playerState.sprintKeyHeld; },
        isSprinting() { return !!playerState.sprinting; },
        cancelSprintTemporarily(durationMs) {
          cancelSprintTemporarilyCalls.push(Number(durationMs || 0));
          playerState.networkSprint = false;
          playerState.sprinting = false;
          return true;
        },
        prepareWeaponFire() {
          fireOrder.push('prepare');
          prepareWeaponFireCalls.push(true);
          const result = prepareWeaponFireResult;
          prepareWeaponFireResult = false;
          return result;
        },
        triggerAction(action) {
          triggerActions.push(String(action || ''));
        },
        setWeaponModel(weaponId) {
          weaponModelUpdates.push(String(weaponId || ''));
        },
        getAdsState() {
          return {};
        }
      };
    },
    getGameUiApi() {
      return {
        updateWeaponInfo(weapon) {
          weaponInfoUpdates.push(JSON.parse(JSON.stringify(weapon || null)));
        },
        updateReticle(weapon, spec, adsState) {
          reticleUpdates.push({
            weapon: JSON.parse(JSON.stringify(weapon || null)),
            spec: JSON.parse(JSON.stringify(spec || null)),
            adsState: JSON.parse(JSON.stringify(adsState || null))
          });
        }
      };
    },
    getCurrentSelfCombatApi() {
      return {
        canUseGameplayActions() { return true; }
      };
    },
    getGameHitscanApi() {
      return {
        getCurrentWeapon() {
          return { id: 'rifle', cooldownMs: 400 };
        },
        getReticleSpec(weaponId) {
          return { id: String(weaponId || '') + '-reticle' };
        },
        setWeapon(weaponId) {
          setWeaponCalls.push(String(weaponId || ''));
          return { id: String(weaponId || '') };
        },
        canFire() {
          return options.canFire !== false;
        },
        captureShotSample() {
          fireOrder.push('sample');
          return shotSample;
        },
        shouldPredictNetHit(_camera, _hitboxMesh, _shotToken, _pelletIndex, sample) {
          observedSamples.push({ path: 'predict', sample });
          return true;
        },
        fire(camera, onHit, _onMiss, shotToken, sample) {
          fireOrder.push('fire');
          observedSamples.push({ path: 'fire', sample });
          onHit(
            { userData: { ownerType: 'net' } },
            { x: 1, y: 2, z: 3 },
            12,
            'body',
            24,
            { id: 'rifle' },
            0
          );
          return !!camera && typeof shotToken === 'string' && shotToken.length > 0;
        }
      };
    },
    getGameNetApi() {
      return {
        isConnected() { return options.netConnected !== false; }
      };
    },
    getGameNetFeedbackSyncApi() {
      return {
        emitPredictedLocalDamageFeedback(payload) {
          predictedFeedback.push(JSON.parse(JSON.stringify(payload)));
        }
      };
    },
    getCurrentMatchCommandApi() {
      if (options.commandApiUnavailable) return null;
      return {
        sendFire(weaponId, shotToken, sample) {
          sentFire.push({ weaponId: String(weaponId || ''), shotToken: String(shotToken || ''), sample });
          return options.sendFireResult !== false;
        },
        sendEquipWeapon(weaponId) {
          sentEquip.push(String(weaponId || ''));
          return sendEquipResult;
        }
      };
    },
    getGameAudioApi() {
      return {
        play(name, payload) {
          audioCalls.push({ name: String(name || ''), payload: JSON.parse(JSON.stringify(payload || {})) });
        }
      };
    },
    setTransientDebug(text, ms) {
      debugMessages.push({ text: String(text || ''), ms: Number(ms || 0) });
    }
  });

  return {
    actions,
    predictedFeedback,
    sentFire,
    sentEquip,
    observedSamples,
    triggerActions,
    audioCalls,
    weaponInfoUpdates,
    weaponModelUpdates,
    reticleUpdates,
    setWeaponCalls,
    debugMessages,
    cancelSprintTemporarilyCalls,
    fireOrder,
    prepareWeaponFireCalls,
    timers,
    playerState,
    setPrepareWeaponFireResult(value) {
      prepareWeaponFireResult = !!value;
    },
    setSendEquipResult(value) {
      sendEquipResult = !!value;
    },
    runNextTimer() {
      const timer = timers.shift();
      if (timer && typeof timer.callback === 'function') timer.callback();
      return timer || null;
    }
  };
}

test('runtime match actions use the real local fire flow for multiplayer prediction and net send', async () => {
  const harness = await loadRuntimeMatchActionsHarness();

  harness.actions.tryPlayerFire();

  assert.equal(harness.predictedFeedback.length, 1);
  assert.equal(harness.sentFire.length, 1);
  assert.equal(harness.triggerActions.includes('fire'), true);
  assert.equal(harness.audioCalls.length, 1);
  assert.equal(harness.sentFire[0].weaponId, 'rifle');
  assert.equal(harness.predictedFeedback[0].weaponId, 'rifle');
  assert.equal(harness.predictedFeedback[0].damage, 24);
  assert.equal(harness.predictedFeedback[0].shotToken, harness.sentFire[0].shotToken);
  assert.equal(harness.sentFire[0].sample, harness.observedSamples[0].sample);
  assert.equal(harness.observedSamples.every((entry) => entry.sample === harness.sentFire[0].sample), true);
});

test('runtime match actions do not start local fire prediction when fire send fails', async () => {
  const harness = await loadRuntimeMatchActionsHarness({
    sendFireResult: false
  });

  harness.actions.tryPlayerFire();

  assert.equal(harness.sentFire.length, 1);
  assert.deepEqual(harness.fireOrder, ['prepare', 'sample']);
  assert.equal(harness.predictedFeedback.length, 0);
  assert.equal(harness.observedSamples.length, 0);
  assert.deepEqual(harness.triggerActions, []);
  assert.deepEqual(harness.audioCalls, []);
});

test('runtime match actions do not apply multiplayer weapon equip locally when equip send fails', async () => {
  const harness = await loadRuntimeMatchActionsHarness();

  assert.equal(harness.actions.applyWeapon({ id: 'rifle', name: 'Rifle' }), true);
  harness.setSendEquipResult(false);

  assert.equal(harness.actions.applyWeapon({ id: 'shotgun', name: 'Shotgun' }), false);

  assert.deepEqual(harness.sentEquip, ['rifle', 'shotgun']);
  assert.deepEqual(harness.weaponInfoUpdates, [{ id: 'rifle', name: 'Rifle' }]);
  assert.deepEqual(harness.weaponModelUpdates, ['rifle']);
  assert.equal(harness.reticleUpdates.length, 1);
  assert.deepEqual(harness.setWeaponCalls, ['rifle']);
  assert.deepEqual(harness.debugMessages, [
    { text: 'Weapon: Rifle', ms: 950 },
    { text: 'Weapon equip send failed.', ms: 700 }
  ]);
});

test('runtime match actions do not apply multiplayer weapon equip locally when equip networking is unavailable', async () => {
  const harness = await loadRuntimeMatchActionsHarness({
    commandApiUnavailable: true
  });

  assert.equal(harness.actions.applyWeapon({ id: 'shotgun', name: 'Shotgun' }), false);

  assert.deepEqual(harness.sentEquip, []);
  assert.deepEqual(harness.weaponInfoUpdates, []);
  assert.deepEqual(harness.weaponModelUpdates, []);
  assert.deepEqual(harness.reticleUpdates, []);
  assert.deepEqual(harness.setWeaponCalls, []);
  assert.deepEqual(harness.debugMessages, [{
    text: 'Weapon equip unavailable.',
    ms: 700
  }]);
});

test('runtime match actions delay sprint-break shots until the weapon raise window', async () => {
  const harness = await loadRuntimeMatchActionsHarness({
    playerState: {
      networkSprint: true,
      sprintKeyHeld: true,
      sprinting: true
    }
  });

  harness.actions.tryPlayerFire();

  assert.equal(harness.sentFire.length, 0);
  assert.equal(harness.predictedFeedback.length, 0);
  assert.equal(harness.cancelSprintTemporarilyCalls.length, 1);
  assert.equal(harness.timers.length, 1);
  assert.ok(harness.timers[0].delayMs >= 90);
  assert.ok(harness.timers[0].delayMs <= 145);

  harness.runNextTimer();

  assert.equal(harness.sentFire.length, 1);
  assert.equal(harness.predictedFeedback.length, 1);
  assert.equal(harness.triggerActions.includes('fire'), true);
  assert.equal(harness.cancelSprintTemporarilyCalls.length, 2);
});

test('runtime match actions cancel stop recovery before sampling a shot', async () => {
  const harness = await loadRuntimeMatchActionsHarness({
    prepareWeaponFireResult: true
  });

  harness.actions.tryPlayerFire();

  assert.deepEqual(harness.fireOrder, ['prepare']);
  assert.equal(harness.sentFire.length, 0);
  assert.equal(harness.predictedFeedback.length, 0);
  assert.equal(harness.prepareWeaponFireCalls.length, 1);
  assert.equal(harness.timers.length, 1);
  assert.ok(harness.timers[0].delayMs >= 70);
  assert.ok(harness.timers[0].delayMs <= 120);

  harness.runNextTimer();

  assert.deepEqual(harness.fireOrder, ['prepare', 'sample', 'fire']);
  assert.equal(harness.sentFire.length, 1);
  assert.equal(harness.predictedFeedback.length, 1);
  assert.equal(harness.triggerActions.includes('fire'), true);
});
