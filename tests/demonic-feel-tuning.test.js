import test from 'node:test';
import assert from 'node:assert/strict';

import { getFeelTuning } from '../demonic/shared-compat/feel-tuning.js';

test('demonic feel tuning mirrors Mayhem-style movement and camera defaults from shared tuning', () => {
  const feel = getFeelTuning({
    gameplayTuning: {
      movement: {
        jogSpeed: 8,
        runSpeed: 14,
        jumpVelocity: 8.8,
        jumpHoldAccel: 16,
        maxJumpHold: 0.2,
        jumpReleaseMult: 0.42,
        gravity: 18,
        adsMoveMult: 0.4
      }
    }
  });

  assert.equal(feel.movement.runSpeed, 14);
  assert.equal(feel.movement.jumpVelocity, 8.8);
  assert.equal(feel.camera.cameraFov, 75);
  assert.equal(feel.camera.sniperScopeFov, 24);
  assert.equal(feel.camera.adsSensitivityMult, 0.7);
  assert.equal(feel.camera.sniperScopeSensitivityMult, 0.42);
});
