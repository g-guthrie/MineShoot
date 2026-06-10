import test from 'node:test';
import assert from 'node:assert/strict';

import { gameplayTuning, getWeaponFalloffProfile } from '../../shared/gameplay-tuning.js';

test('primary weapon falloff shapes mirror their intended roles', () => {
  const machinegun = getWeaponFalloffProfile('machinegun');
  const pistol = getWeaponFalloffProfile('pistol');
  const rifle = getWeaponFalloffProfile('rifle');
  const shotgun = getWeaponFalloffProfile('shotgun');

  assert.deepEqual(machinegun, { start: 18, end: 36, minScalar: 0.72 });
  assert.deepEqual(pistol, { start: 7.5, end: 23, minScalar: 0.6 });
  assert.deepEqual(rifle, { start: 24, end: 48, minScalar: 0.72 });
  assert.deepEqual(shotgun, { start: 7.5, end: 12.5, minScalar: 0.35 });
});

test('hand cannon damage is bumped to carry its weight as a primary weapon', () => {
  assert.equal(gameplayTuning.weaponStats.pistol.bodyDamage, 79);
  assert.equal(gameplayTuning.weaponStats.pistol.headDamage, 119);
});
