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

test('GameNetCommands flushes the click-frame input before sending fire', async () => {
  const GameNetCommands = await loadCommandsApi();
  const order = [];
  const commands = GameNetCommands.create({
    wsSend(msg) {
      order.push('send:' + msg.t);
      return true;
    },
    fireMessageType: 'fire',
    flushInputBeforeFire() {
      order.push('flush');
      return true;
    },
    buildFirePayload(msgType, weaponId, shotToken) {
      order.push('build');
      return { t: msgType, weaponId, shotToken };
    }
  });

  assert.equal(commands.sendFire('rifle', 'shot_input_first'), true);
  assert.deepEqual(order, ['flush', 'build', 'send:fire']);
});

test('GameNetCommands does not send fire after a failed click-frame input flush', async () => {
  const GameNetCommands = await loadCommandsApi();
  const order = [];
  const commands = GameNetCommands.create({
    wsSend(msg) {
      order.push('send:' + msg.t);
      return true;
    },
    fireMessageType: 'fire',
    flushInputBeforeFire() {
      order.push('flush');
      return false;
    },
    buildFirePayload(msgType, weaponId, shotToken) {
      order.push('build');
      return { t: msgType, weaponId, shotToken };
    }
  });

  assert.equal(commands.sendFire('rifle', 'shot_input_failed'), false);
  assert.deepEqual(order, ['flush']);
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

test('GameNetCommands emits an enter-match command through the websocket sender', async () => {
  const GameNetCommands = await loadCommandsApi();
  const sentMessages = [];
  const commands = GameNetCommands.create({
    wsSend(msg) {
      sentMessages.push(JSON.parse(JSON.stringify(msg)));
      return true;
    },
    enterMatchMessageType: 'enter_match'
  });

  assert.equal(commands.sendEnterMatch(), true);
  assert.deepEqual(sentMessages, [{
    t: 'enter_match'
  }]);
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

test('GameNetCommands rejects invalid normalized weapon loadout before seeding pending state', async () => {
  const GameNetCommands = await loadCommandsApi();
  var pendingLoadout = { slot1: 'rifle', slot2: 'shotgun' };
  var flushCalls = 0;
  const commands = GameNetCommands.create({
    normalizeWeaponLoadoutPayload() {
      return null;
    },
    setPendingWeaponLoadout(value) {
      pendingLoadout = value;
    },
    flushPendingWeaponLoadout() {
      flushCalls += 1;
      return true;
    }
  });

  assert.equal(commands.sendWeaponLoadout('', ''), false);
  assert.deepEqual(pendingLoadout, { slot1: 'rifle', slot2: 'shotgun' });
  assert.equal(flushCalls, 0);
});

test('GameNetCommands delegates throw and reload payload shaping through the provided normalizers', async () => {
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
    }
  });

  assert.equal(commands.sendThrow('frag', 'throw_1', { power: 0.5 }), true);
  assert.equal(commands.sendReload('rifle'), true);
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
    }
  ]);
});

test('GameNetCommands rejects invalid normalized throw and reload payloads', async () => {
  const GameNetCommands = await loadCommandsApi();
  const sentMessages = [];
  const commands = GameNetCommands.create({
    wsSend(msg) {
      sentMessages.push(JSON.parse(JSON.stringify(msg)));
      return true;
    },
    normalizeThrowPayload() {
      return null;
    },
    normalizeReloadPayload() {
      return null;
    }
  });

  assert.equal(commands.sendThrow('frag', 'throw_bad', null), false);
  assert.equal(commands.sendReload('rifle'), false);
  assert.deepEqual(sentMessages, []);
});

test('GameNetCommands emits a roll command with the current movement direction', async () => {
  const GameNetCommands = await loadCommandsApi();
  const sentMessages = [];
  const commands = GameNetCommands.create({
    wsSend(msg) {
      sentMessages.push(JSON.parse(JSON.stringify(msg)));
      return true;
    },
    rollMessageType: 'roll'
  });

  assert.equal(commands.sendRoll({
    movingForward: false,
    movingBackward: true,
    movingLeft: false,
    movingRight: true
  }), true);
  assert.deepEqual(sentMessages, [{
    t: 'roll',
    movingForward: false,
    movingBackward: true,
    movingLeft: false,
    movingRight: true
  }]);
});
