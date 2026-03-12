import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

async function loadPlayerCombatRuntime() {
  const code = await fs.readFile(new URL('../demonic/gameplay/player/combat-runtime.js', import.meta.url), 'utf8');
  const sandbox = {
    __DEMONIC_RUNTIME: {},
    globalThis: null,
    Date,
    console
  };
  sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox);
  vm.runInContext(code, context);
  return sandbox.__DEMONIC_RUNTIME.GamePlayerCombatRuntime;
}

test('demonic player combat runtime mirrors authoritative self health and respawn state', async () => {
  const api = await loadPlayerCombatRuntime();
  let netSnapshot = {
    selfState: {
      hp: 420,
      hpMax: 500,
      armor: 50,
      armorMax: 90,
      alive: false,
      spawnShieldUntil: 0
    },
    lastIncomingDamage: {
      sourceId: 'usr_enemy',
      targetId: 'usr_test',
      damage: 80,
      hitType: 'head',
      weaponId: 'rifle',
      killed: false
    },
    respawnState: {
      entityId: 'usr_test',
      respawnAt: Date.now() + 2000,
      x: 12,
      z: 18
    }
  };

  const runtime = api.create({
    getNetSnapshot() {
      return netSnapshot;
    }
  });

  runtime.update(0.016);
  const feedback = runtime.consumeIncomingFeedback();
  const snapshot = runtime.getSnapshot();

  assert.equal(snapshot.hp, 420);
  assert.equal(snapshot.armor, 50);
  assert.equal(snapshot.alive, false);
  assert.equal(snapshot.respawnActive, true);
  assert.equal(snapshot.respawnRemainingMs > 0, true);
  assert.equal(feedback.damage, 80);
  assert.equal(runtime.canUseActions(), false);

  netSnapshot = {
    selfState: {
      hp: 500,
      hpMax: 500,
      armor: 90,
      armorMax: 90,
      alive: true,
      spawnShieldUntil: Date.now() + 1000
    },
    lastIncomingDamage: null,
    respawnState: null
  };

  runtime.update(0.016);
  const recovered = runtime.getSnapshot();
  assert.equal(recovered.alive, true);
  assert.equal(recovered.invulnerable, true);
  assert.equal(recovered.respawnActive, false);
  assert.equal(runtime.canUseActions(), true);
});
