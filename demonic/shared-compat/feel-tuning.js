const DEFAULT_FEEL_TUNING = {
  mouseSensitivity: 0.002,
  pitchLimitDeg: 89,
  camera: {
    thirdHeight: 0.7,
    thirdSmooth: 12,
    cameraDist: 4.4 * 0.85,
    cameraShoulder: 1.35 * 1.3,
    cameraFov: 75,
    firstPersonSmooth: 20,
    adsFov: 56,
    adsDist: 1.72,
    adsShoulder: 2,
    adsHeight: 0.46,
    adsBlendSpeed: 16,
    adsSensitivityMult: 0.7,
    sniperScopeFov: 24,
    sniperScopeDist: 0.14,
    sniperScopeShoulder: 0.08,
    sniperScopeHeight: 0.12,
    sniperScopeBlendSpeed: 18,
    sniperScopeSensitivityMult: 0.42
  }
};

export function getFeelTuning(shared) {
  const runtimeShared = shared || {};
  const gameplay = runtimeShared.gameplayTuning || {};
  const movement = gameplay.movement || {};
  const camera = DEFAULT_FEEL_TUNING.camera;

  return {
    mouseSensitivity: DEFAULT_FEEL_TUNING.mouseSensitivity,
    pitchLimitDeg: DEFAULT_FEEL_TUNING.pitchLimitDeg,
    movement: {
      jogSpeed: Number(movement.jogSpeed || 8),
      runSpeed: Number(movement.runSpeed || 14),
      jumpVelocity: Number(movement.jumpVelocity || 8.8),
      jumpHoldAccel: Number(movement.jumpHoldAccel || 16),
      maxJumpHold: Number(movement.maxJumpHold || 0.2),
      jumpReleaseMult: Number(movement.jumpReleaseMult || 0.42),
      gravity: Number(movement.gravity || 18),
      adsMoveMult: Number(movement.adsMoveMult || 0.4)
    },
    camera: {
      thirdHeight: camera.thirdHeight,
      thirdSmooth: camera.thirdSmooth,
      cameraDist: camera.cameraDist,
      cameraShoulder: camera.cameraShoulder,
      cameraFov: camera.cameraFov,
      firstPersonSmooth: camera.firstPersonSmooth,
      adsFov: camera.adsFov,
      adsDist: camera.adsDist,
      adsShoulder: camera.adsShoulder,
      adsHeight: camera.adsHeight,
      adsBlendSpeed: camera.adsBlendSpeed,
      adsSensitivityMult: camera.adsSensitivityMult,
      sniperScopeFov: camera.sniperScopeFov,
      sniperScopeDist: camera.sniperScopeDist,
      sniperScopeShoulder: camera.sniperScopeShoulder,
      sniperScopeHeight: camera.sniperScopeHeight,
      sniperScopeBlendSpeed: camera.sniperScopeBlendSpeed,
      sniperScopeSensitivityMult: camera.sniperScopeSensitivityMult
    }
  };
}
