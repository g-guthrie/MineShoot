import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

async function loadCommandsApi() {
  const sandbox = {
    console,
    globalThis: {
      __MAYHEM_RUNTIME: {}
    }
  };
  const context = vm.createContext(sandbox);
  const code = await fs.readFile(new URL('../../js/net/commands.js', import.meta.url), 'utf8');
  vm.runInContext(code, context);
  return sandbox.globalThis.__MAYHEM_RUNTIME.GameNetCommands;
}

test('GameNetCommands forwards fire payloads that include estimated server shot time', async () => {
  const GameNetCommands = await loadCommandsApi();
  const sentMessages = [];
  const commands = GameNetCommands.create({
    wsSend(msg) {
      sentMessages.push(JSON.parse(JSON.stringify(msg)));
      return true;
    },
    fireMessageType: 'fire',
    buildFirePayload(msgType, weaponId, shotToken) {
      return {
        t: msgType,
        weaponId,
        shotToken,
        estimatedServerShotTime: 1005
      };
    }
  });

  assert.equal(commands.sendFire('rifle', 'shot_1'), true);
  assert.deepEqual(sentMessages, [{
    t: 'fire',
    weaponId: 'rifle',
    shotToken: 'shot_1',
    estimatedServerShotTime: 1005
  }]);
});

test('GameNetCommands forwards fire payloads unchanged when estimated server time is unavailable', async () => {
  const GameNetCommands = await loadCommandsApi();
  const sentMessages = [];
  const commands = GameNetCommands.create({
    wsSend(msg) {
      sentMessages.push(JSON.parse(JSON.stringify(msg)));
      return true;
    },
    fireMessageType: 'fire',
    buildFirePayload(msgType, weaponId, shotToken) {
      return {
        t: msgType,
        weaponId,
        shotToken
      };
    }
  });

  assert.equal(commands.sendFire('rifle', 'shot_2'), true);
  assert.deepEqual(sentMessages, [{
    t: 'fire',
    weaponId: 'rifle',
    shotToken: 'shot_2'
  }]);
  assert.equal('estimatedServerShotTime' in sentMessages[0], false);
});

test('GameNetCommands preserves pending weapon loadout state until the flush owner resolves it', async () => {
  const GameNetCommands = await loadCommandsApi();
  var pendingLoadout = null;
  var flushSeenPending = null;
  const commands = GameNetCommands.create({
    normalizeWeaponLoadoutPayload(slot1, slot2) {
      return { slot1, slot2 };
    },
    setPendingWeaponLoadout(value) {
      pendingLoadout = value;
    },
    flushPendingWeaponLoadout() {
      flushSeenPending = pendingLoadout;
      return false;
    }
  });

  assert.equal(commands.sendWeaponLoadout('rifle', 'shotgun'), false);
  assert.deepEqual(pendingLoadout, { slot1: 'rifle', slot2: 'shotgun' });
  assert.deepEqual(flushSeenPending, { slot1: 'rifle', slot2: 'shotgun' });
});

test('GameNetCommands delegates throw and ability payload shaping through the provided normalizers', async () => {
  const GameNetCommands = await loadCommandsApi();
  const sentMessages = [];
  const commands = GameNetCommands.create({
    wsSend(msg) {
      sentMessages.push(JSON.parse(JSON.stringify(msg)));
      return true;
    },
    normalizeThrowPayload(throwableId, clientThrowId, throwIntent) {
      return {
        t: 'throw',
        throwableId,
        clientThrowId,
        throwIntent
      };
    },
    normalizeReloadPayload(weaponId) {
      return {
        t: 'reload',
        weaponId
      };
    },
    normalizeAbilityLoadoutPayload(abilityId) {
      return {
        t: 'ability_loadout',
        abilityId
      };
    },
    normalizeClassCastPayload(castData) {
      return {
        t: 'class_cast',
        castData
      };
    }
  });

  assert.equal(commands.sendThrow('frag', 'throw_1', { power: 0.5 }), true);
  assert.equal(commands.sendReload('rifle'), true);
  assert.equal(commands.sendAbilityLoadout('choke'), true);
  assert.equal(commands.sendAbilityCast({ targetId: 'usr_remote' }), true);
  assert.deepEqual(sentMessages, [
    {
      t: 'throw',
      throwableId: 'frag',
      clientThrowId: 'throw_1',
      throwIntent: { power: 0.5 }
    },
    {
      t: 'reload',
      weaponId: 'rifle'
    },
    {
      t: 'ability_loadout',
      abilityId: 'choke'
    },
    {
      t: 'class_cast',
      castData: { targetId: 'usr_remote' }
    }
  ]);
});
