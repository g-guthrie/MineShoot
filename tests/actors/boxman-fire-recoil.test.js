import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyFireRecoilPose,
  createFireRecoilState,
  decayFireRecoilState,
  triggerFireRecoil
} from '../../js/actors/boxman-fire-recoil.js';

test('boxman fire recoil toggles side and clamps accumulated kick', () => {
  const recoil = createFireRecoilState();

  assert.equal(triggerFireRecoil(recoil, { strength: 10 }), true);
  assert.equal(recoil.side, -1);
  assert.equal(recoil.weaponKick, -0.22);
  assert.equal(Math.abs(recoil.lowerArmPitch - 1.65) < 0.000001, true);

  assert.equal(triggerFireRecoil(recoil, { side: 1, weaponKick: 1, lowerArmPitch: 10 }), true);
  assert.equal(recoil.side, 1);
  assert.equal(recoil.weaponKick, 0.05);
  assert.equal(recoil.lowerArmPitch, 2.5);
});

test('boxman fire recoil pose offsets the weapon from its authored base', () => {
  const copied = [];
  const position = {
    x: 0,
    y: 0,
    z: 0,
    copy(source) {
      copied.push(source);
      this.x = source.x;
      this.y = source.y;
      this.z = source.z;
    }
  };
  const rig = {
    weaponRoot: { position },
    weaponRootBasePos: { x: 1, y: 2, z: 3 },
    armLowerR: { rotation: { x: 0 } }
  };

  assert.equal(applyFireRecoilPose(rig, { side: -1, weaponKick: -0.2, lowerArmPitch: 0.5 }), true);
  assert.deepEqual(copied, [rig.weaponRootBasePos]);
  assert.equal(position.x, 0.964);
  assert.equal(position.z, 2.8);
  assert.equal(rig.armLowerR.rotation.x, 0.1);
});

test('boxman fire recoil decays toward neutral without overshoot', () => {
  const recoil = createFireRecoilState();
  triggerFireRecoil(recoil, { side: 1, strength: 1 });
  const before = Math.abs(recoil.weaponKick) + Math.abs(recoil.lowerArmPitch);

  assert.equal(decayFireRecoilState(recoil, 1 / 60), true);

  const after = Math.abs(recoil.weaponKick) + Math.abs(recoil.lowerArmPitch);
  assert.equal(after < before, true);
});
