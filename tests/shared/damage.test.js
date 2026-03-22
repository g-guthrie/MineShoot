import test from 'node:test';
import assert from 'node:assert/strict';

import { applyDamage, applyFalloff, sanitizeDamageAmount } from '../../shared/damage.js';

test('shared damage sanitization converts invalid values into safe no-op damage', () => {
  assert.equal(sanitizeDamageAmount(NaN), 0);
  assert.equal(sanitizeDamageAmount(Infinity), 0);
  assert.equal(sanitizeDamageAmount(-5), 0);
  assert.equal(sanitizeDamageAmount(undefined), 0);
  assert.equal(sanitizeDamageAmount(0), 0);
  assert.equal(sanitizeDamageAmount(2.4), 2);
});

test('shared applyDamage leaves health, armor, and regen delay untouched for invalid or zero damage', () => {
  const target = {
    hp: 100,
    armor: 50,
    armorMax: 50,
    armorRegenDelay: 3
  };

  const first = applyDamage(target, NaN);
  const second = applyDamage(target, 0);
  const third = applyDamage(target, -20);

  assert.deepEqual(first, { absorbed: 0, hpLost: 0, killed: false, hp: 100, armor: 50 });
  assert.deepEqual(second, { absorbed: 0, hpLost: 0, killed: false, hp: 100, armor: 50 });
  assert.deepEqual(third, { absorbed: 0, hpLost: 0, killed: false, hp: 100, armor: 50 });
  assert.equal(target.hp, 100);
  assert.equal(target.armor, 50);
  assert.equal(target.armorRegenDelay, 3);
});

test('shared applyFalloff returns zero for invalid damage inputs instead of propagating NaN', () => {
  const profile = [{ maxDistance: 10, scale: 1 }];

  assert.equal(applyFalloff(NaN, 5, profile), 0);
  assert.equal(applyFalloff(Infinity, 5, profile), 0);
  assert.equal(applyFalloff(-20, 5, profile), 0);
  assert.equal(applyFalloff(20, NaN, profile), 20);
});
