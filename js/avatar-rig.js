import { GameWeaponRegistry } from './domain/weapons/registry.js';

/**
 * avatar-rig.js - Shared blocky humanoid rig for player/enemy/remote visuals
 */

export const GameAvatarRig = {};
var DEG_TO_RAD = Math.PI / 180;
var ARM_SHORT_SIDE = 0.22;
var HALF_ARM_SHORT_SIDE = ARM_SHORT_SIDE * 0.5;
var GUN_MOUNT_SHIFT_X = -0.08;
var GUN_MOUNT_LIFT_Y = 0.1 + HALF_ARM_SHORT_SIDE;
var GUN_MOUNT_SHIFT_Z = -HALF_ARM_SHORT_SIDE;
var FOOT_PLANE_OFFSET_Y = 0.3;
var HEAD_EYE_Y = 0.06;
var HEAD_EYE_Z = -0.282;
var HEAD_EYE_X = 0.12;
var LEFT_PALM_NEUTRAL = { x: -0.01, y: -0.84, z: -0.03 };
var RIGHT_PALM_SOCKET = { x: 0.015, y: -0.98, z: -0.01 };
var HANDLE_ANCHOR_NAME = 'weaponHandleAnchor';
var BARREL_TIP_ANCHOR_NAME = 'weaponBarrelTipAnchor';

function ensureHex(value, fallback) {
  return (typeof value === 'number' && isFinite(value)) ? value : fallback;
}

function setPart(mesh, style) {
  if (!mesh || !style) return;
  if (style.p) mesh.position.set(style.p[0], style.p[1], style.p[2]);
  if (style.s) mesh.scale.set(style.s[0], style.s[1], style.s[2]);
  if (typeof style.c === 'number' && mesh.material && mesh.material.color) {
    mesh.material.color.setHex(style.c);
  }
}

function addXEye(head, xOffset, material) {
  if (!head) return null;
  var eye = new THREE.Group();
  eye.position.set(xOffset, HEAD_EYE_Y, HEAD_EYE_Z);

  var slashA = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.028, 0.02), material);
  slashA.rotation.z = 45 * DEG_TO_RAD;
  eye.add(slashA);

  var slashB = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.028, 0.02), material);
  slashB.rotation.z = -45 * DEG_TO_RAD;
  eye.add(slashB);

  head.add(eye);
  return eye;
}

function resolveWeaponEntry(weaponId) {
  var entry = GameWeaponRegistry && GameWeaponRegistry.get ? GameWeaponRegistry.get(weaponId) : null;
  if (entry && entry.visual) {
    return {
      weaponId: weaponId,
      visual: entry.visual
    };
  }
  var fallback = GameWeaponRegistry && GameWeaponRegistry.get ? GameWeaponRegistry.get('rifle') : null;
  return fallback && fallback.visual ? {
    weaponId: 'rifle',
    visual: fallback.visual
  } : null;
}

function setAnchorPosition(group, name, coords) {
  var anchor = group.getObjectByName(name);
  if (!anchor) {
    anchor = new THREE.Object3D();
    anchor.name = name;
    group.add(anchor);
  }
  anchor.position.set(coords[0], coords[1], coords[2]);
  return anchor;
}

GameAvatarRig.create = function create(kind, options) {
  options = options || {};

  var root = new THREE.Group();
  var modelRoot = new THREE.Group();
  modelRoot.position.y = FOOT_PLANE_OFFSET_Y;
  root.add(modelRoot);
  var bodyMat = new THREE.MeshLambertMaterial({ color: ensureHex(options.bodyColor, 0x4a7fc1) });
  var skinMat = new THREE.MeshLambertMaterial({ color: ensureHex(options.skinColor, 0xd2a77d) });
  var legMat = new THREE.MeshLambertMaterial({ color: ensureHex(options.legColor, 0x2f2f2f) });
  var gunDark = new THREE.MeshLambertMaterial({ color: 0x2a2a2a });
  var gunDarker = new THREE.MeshLambertMaterial({ color: 0x161616 });
  var gunWood = new THREE.MeshLambertMaterial({ color: 0x8b5a2b });
  var gunMetal = new THREE.MeshLambertMaterial({ color: 0x666666 });
  var eyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });

  var body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.0, 0.5), bodyMat);
  body.position.y = 1.0;
  modelRoot.add(body);

  var head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.55), skinMat);
  head.position.y = 1.8;
  modelRoot.add(head);
  var eyeLeft = addXEye(head, -HEAD_EYE_X, eyeMat);
  var eyeRight = addXEye(head, HEAD_EYE_X, eyeMat);

  var eyeAnchor = new THREE.Object3D();
  eyeAnchor.position.set(0, 0.05, 0.18);
  head.add(eyeAnchor);

  var shoulderLeft = new THREE.Group();
  shoulderLeft.position.set(-0.52, 1.37, 0);
  var armL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.85, 0.22), skinMat);
  armL.position.y = -0.42;
  shoulderLeft.add(armL);
  var palmLeft = new THREE.Group();
  palmLeft.position.set(LEFT_PALM_NEUTRAL.x, LEFT_PALM_NEUTRAL.y, LEFT_PALM_NEUTRAL.z);
  shoulderLeft.add(palmLeft);
  modelRoot.add(shoulderLeft);

  var shoulderRight = new THREE.Group();
  shoulderRight.position.set(0.52, 1.37, 0);
  var armR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.85, 0.22), skinMat);
  armR.position.y = -0.42;
  shoulderRight.add(armR);

  var palmRight = new THREE.Group();
  palmRight.position.set(RIGHT_PALM_SOCKET.x, RIGHT_PALM_SOCKET.y, RIGHT_PALM_SOCKET.z);
  shoulderRight.add(palmRight);
  modelRoot.add(shoulderRight);

  var hipLeft = new THREE.Group();
  hipLeft.position.set(-0.18, 0.6, 0);
  var legL = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.9, 0.28), legMat);
  legL.position.y = -0.45;
  hipLeft.add(legL);
  modelRoot.add(hipLeft);

  var hipRight = new THREE.Group();
  hipRight.position.set(0.18, 0.6, 0);
  var legR = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.9, 0.28), legMat);
  legR.position.y = -0.45;
  hipRight.add(legR);
  modelRoot.add(hipRight);

  var gun = new THREE.Group();
  var gunBody = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.55), gunDark);
  gunBody.position.z = -0.04;
  gun.add(gunBody);

  var gunBarrel = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.26), gunDarker);
  gunBarrel.position.z = -0.42;
  gun.add(gunBarrel);

  var gunStock = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.11, 0.16), gunWood);
  gunStock.position.set(0, -0.03, 0.13);
  gun.add(gunStock);

  var gunGrip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.08), gunWood);
  gunGrip.position.set(0, -0.11, 0.03);
  gun.add(gunGrip);

  var scope = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.08, 0.23), gunMetal);
  scope.position.set(0, 0.09, -0.21);
  scope.visible = false;
  gun.add(scope);

  var pump = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.12), gunWood);
  pump.position.set(0, -0.03, -0.33);
  pump.visible = false;
  gun.add(pump);

  var coil = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.11, 0.11), gunMetal);
  coil.position.set(0, -0.1, -0.1);
  coil.visible = false;
  gun.add(coil);

  var muzzleMat = new THREE.MeshBasicMaterial({ color: ensureHex(options.muzzleColor, 0xffcc66) });
  var muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.08), muzzleMat);
  muzzle.position.set(0, 0, -0.58);
  muzzle.visible = false;
  gun.add(muzzle);

  var handleAnchor = new THREE.Object3D();
  handleAnchor.name = HANDLE_ANCHOR_NAME;
  gun.add(handleAnchor);

  var barrelTipAnchor = new THREE.Object3D();
  barrelTipAnchor.name = BARREL_TIP_ANCHOR_NAME;
  gun.add(barrelTipAnchor);

  palmRight.add(gun);

  var supportAnchor = new THREE.Object3D();
  supportAnchor.position.set(0, -0.01, -0.28);
  gun.add(supportAnchor);

  var coreAnchor = new THREE.Object3D();
  coreAnchor.position.set(0, 1.0, 0);
  modelRoot.add(coreAnchor);

  var throwableOriginAnchor = new THREE.Object3D();
  throwableOriginAnchor.position.set(0.01, -0.02, -0.12);
  palmLeft.add(throwableOriginAnchor);

  var rig = {
    armL: shoulderLeft,
    armR: shoulderRight,
    legL: hipLeft,
    legR: hipRight,
    armLMesh: armL,
    armRMesh: armR,
    legLMesh: legL,
    legRMesh: legR,
    bodyMesh: body,
    headMesh: head,
    gun: gun,
    gunBody: gunBody,
    gunBarrel: gunBarrel,
    gunStock: gunStock,
    gunGrip: gunGrip,
    scope: scope,
    pump: pump,
    coil: coil,
    muzzle: muzzle,
    supportAnchor: supportAnchor,
    coreAnchor: coreAnchor,
    throwableOriginAnchor: throwableOriginAnchor,
    eyeAnchor: eyeAnchor,
    eyeLeft: eyeLeft,
    eyeRight: eyeRight,
    palmLeft: palmLeft,
    palmRight: palmRight,
    weaponClass: 'gun',
    weaponId: 'rifle',
    gaitPhase: Math.random() * Math.PI * 2,
    aimPitch: 0,
    gunBasePos: new THREE.Vector3(),
    gunBaseRot: new THREE.Vector3(),
    supportBasePos: new THREE.Vector3(),
    footPlaneOffsetY: FOOT_PLANE_OFFSET_Y
  };

  function setWeapon(weaponId) {
    var resolved = resolveWeaponEntry(weaponId);
    var visual = resolved && resolved.visual ? resolved.visual : null;
    var mount = visual && visual.mount ? visual.mount : null;
    var parts = visual && visual.parts ? visual.parts : {};
    var anchors = visual && visual.anchors ? visual.anchors : {};
    var effects = visual && visual.effects ? visual.effects : {};
    var handlePos = anchors.handle || [0, 0, 0];
    var barrelTipPos = anchors.barrelTip || [0, 0, -0.58];
    var supportPos = anchors.support || [0, -0.01, -0.28];
    var mountPos = mount && mount.position ? mount.position : [0, 0.02, 0.08];
    var mountRot = mount && mount.rotation ? mount.rotation : [0, 0, 0];
    var muzzlePos = effects.muzzleFlash && effects.muzzleFlash.position ? effects.muzzleFlash.position : barrelTipPos;

    rig.weaponId = resolved && resolved.weaponId ? resolved.weaponId : 'rifle';
    rig.weaponClass = visual && visual.classId ? visual.classId : 'gun';

    rig.gun.position.set(
      mountPos[0] + GUN_MOUNT_SHIFT_X,
      mountPos[1] + GUN_MOUNT_LIFT_Y,
      mountPos[2] + GUN_MOUNT_SHIFT_Z
    );
    rig.gun.rotation.set(mountRot[0], mountRot[1], mountRot[2]);
    rig.gun.rotation.x = -75 * DEG_TO_RAD;

    var handleOffset = new THREE.Vector3(handlePos[0], handlePos[1], handlePos[2]);
    handleOffset.applyEuler(rig.gun.rotation);
    rig.gun.position.sub(handleOffset);

    rig.gunBasePos.copy(rig.gun.position);
    rig.gunBaseRot.copy(rig.gun.rotation);
    rig.supportBasePos.set(supportPos[0], supportPos[1], supportPos[2]);

    setPart(rig.gunBody, parts.body);
    setPart(rig.gunBarrel, parts.barrel);
    setPart(rig.gunStock, parts.stock);
    setPart(rig.gunGrip, parts.grip);

    rig.scope.visible = !!parts.scope;
    rig.pump.visible = !!parts.pump;
    rig.coil.visible = !!parts.coil;
    rig.muzzle.position.set(muzzlePos[0], muzzlePos[1], muzzlePos[2]);
    rig.supportAnchor.position.set(rig.supportBasePos.x, rig.supportBasePos.y, rig.supportBasePos.z);
    setAnchorPosition(rig.gun, HANDLE_ANCHOR_NAME, handlePos);
    setAnchorPosition(rig.gun, BARREL_TIP_ANCHOR_NAME, barrelTipPos);
  }

  function updateAimPitch(pitch) {
    rig.aimPitch = Math.max(-1.1, Math.min(1.1, pitch || 0));
  }

  function updateLocomotion(speedNorm, sprinting, dt, airborne, poseState) {
    speedNorm = Math.max(0, Math.min(1.4, speedNorm || 0));
    airborne = !!airborne;
    poseState = poseState || null;
    var choked = !!(poseState && poseState.choked);
    var chokeStartedAt = choked ? Number(poseState.startedAt || 0) : 0;
    if (speedNorm > 0.02) {
      rig.gaitPhase += dt * ((sprinting ? 13 : 9) * (0.35 + speedNorm));
    }

    var legAmp = 0.12 + speedNorm * 0.55;
    if (legAmp > 0.72) legAmp = 0.72;
    var walkSwing = Math.sin(rig.gaitPhase) * legAmp;
    if (choked) {
      var stamp = Date.now();
      var phase = chokeStartedAt ? ((stamp - chokeStartedAt) * 0.012) : (stamp * 0.012);
      var squirmAmp = 0.55;
      rig.legL.rotation.x = Math.sin(phase) * squirmAmp;
      rig.legR.rotation.x = Math.sin(phase + 2.1) * squirmAmp;
      rig.legL.rotation.z = Math.sin(phase + 0.6) * 0.12;
      rig.legR.rotation.z = Math.sin(phase + 2.7) * -0.12;
      rig.legL.position.x = -0.18;
      rig.legR.position.x = 0.18;
      rig.armL.rotation.x = Math.sin(phase + 1.0) * squirmAmp;
      rig.armL.rotation.y = -0.2 + (Math.sin(phase + 0.3) * 0.18);
      rig.armL.rotation.z = -0.35 + (Math.sin(phase + 1.4) * 0.2);
      rig.armR.rotation.x = 1.05 + (Math.sin(phase + 1.8) * 0.3);
      rig.armR.rotation.y = 0;
      rig.armR.rotation.z = 0.18 + (Math.sin(phase + 2.4) * 0.18);
      rig.palmRight.rotation.x = 0;
      rig.gun.rotation.x = rig.gunBaseRot.x;
      return;
    }
    if (airborne) {
      rig.legL.rotation.x = 0;
      rig.legR.rotation.x = 0;
      rig.legL.rotation.z = 0;
      rig.legR.rotation.z = 0;
      rig.legL.position.x = -0.18;
      rig.legR.position.x = 0.18;
      rig.armL.rotation.x = 0;
      rig.armL.rotation.y = 0;
      rig.armL.rotation.z = 0;
      rig.armR.rotation.x = 1.05 + (rig.aimPitch * 0.25);
      rig.armR.rotation.z = -0.08;
      rig.palmRight.rotation.x = 0;
      rig.gun.rotation.x = rig.gunBaseRot.x;
      return;
    }

    rig.legL.rotation.x = walkSwing;
    rig.legR.rotation.x = -walkSwing;
    rig.legL.rotation.z = 0;
    rig.legR.rotation.z = 0;
    rig.legL.position.x = -0.18;
    rig.legR.position.x = 0.18;
    rig.palmLeft.position.x = LEFT_PALM_NEUTRAL.x;
    rig.palmLeft.position.y = LEFT_PALM_NEUTRAL.y;
    rig.palmLeft.position.z = LEFT_PALM_NEUTRAL.z;

    if (rig.weaponClass === 'melee' || sprinting) {
      rig.armR.rotation.x = -walkSwing;
      rig.armR.rotation.z = 0.18;
      rig.armL.rotation.x = walkSwing;
      rig.armL.rotation.y = 0;
      rig.armL.rotation.z = -0.04;
      rig.palmRight.rotation.x = 0;
      rig.gun.rotation.x = rig.gunBaseRot.x;
    } else {
      var shoulderAim = rig.aimPitch * 0.35;
      var armBase = 75 * DEG_TO_RAD;
      rig.armR.rotation.x = armBase + shoulderAim;
      rig.armR.rotation.z = -0.08;
      rig.armL.rotation.x = walkSwing * 0.65;
      rig.armL.rotation.y = 0;
      rig.armL.rotation.z = 0;
      rig.palmRight.rotation.x = 0;
      rig.gun.rotation.x = rig.gunBaseRot.x;
    }
  }

  var tmpVec = new THREE.Vector3();
  function getCoreWorldPosition(outVec3) {
    var out = outVec3 || new THREE.Vector3();
    coreAnchor.getWorldPosition(out);
    return out;
  }

  function getMuzzleWorldPosition(outVec3) {
    var out = outVec3 || new THREE.Vector3();
    var barrelTip = rig.gun.getObjectByName(BARREL_TIP_ANCHOR_NAME);
    if (barrelTip) {
      barrelTip.getWorldPosition(out);
      return out;
    }
    muzzle.getWorldPosition(out);
    return out;
  }

  function getThrowableOriginWorldPosition(outVec3) {
    var out = outVec3 || new THREE.Vector3();
    throwableOriginAnchor.getWorldPosition(out);
    return out;
  }

  function getEyeWorldPosition(outVec3) {
    var out = outVec3 || new THREE.Vector3();
    eyeAnchor.getWorldPosition(out);
    return out;
  }

  function setMuzzleVisible(visible) {
    if (!muzzle) return;
    muzzle.visible = !!visible;
    if (!muzzle.material) return;
    if (visible) {
      if (rig.weaponId === 'seekergun') {
        muzzle.scale.set(0.95, 0.95, 1.4);
        muzzle.material.color.setHex(0x8fe7ff);
      } else if (rig.weaponId === 'shotgun' || rig.weaponId === 'sniper') {
        muzzle.scale.set(1.6, 1.6, 2.2);
        muzzle.material.color.setHex(0xfff0c2);
      } else if (rig.weaponId === 'machinegun') {
        muzzle.scale.set(1.05, 1.05, 1.5);
        muzzle.material.color.setHex(0xffd67d);
      } else {
        muzzle.scale.set(1.2, 1.2, 1.8);
        muzzle.material.color.setHex(0xffd896);
      }
    } else {
      muzzle.scale.set(1, 1, 1);
      if (rig.weaponId === 'seekergun') {
        muzzle.material.color.setHex(0x56b8d1);
      } else {
        muzzle.material.color.setHex(0xffcc66);
      }
    }
  }

  root.userData.bodyParts = [body, head, armL, armR, legL, legR];
  root.userData.originalColor = ensureHex(options.bodyColor, 0x4a7fc1);
  root.userData.originalPartColors = [
    body.material.color.getHex(),
    head.material.color.getHex(),
    armL.material.color.getHex(),
    armR.material.color.getHex(),
    legL.material.color.getHex(),
    legR.material.color.getHex()
  ];
  root.userData.weaponMuzzle = muzzle;
  root.userData.rig = rig;

  setWeapon(options.weaponId || 'rifle');
  updateAimPitch(0);
  updateLocomotion(0, false, 0);

  var throwPoseTimer = 0;
  function applyThrowPose(dt) {
    if (throwPoseTimer <= 0) return;
    throwPoseTimer -= dt;
    if (throwPoseTimer < 0) throwPoseTimer = 0;
    var t = Math.min(1, throwPoseTimer * 4);
    rig.armL.rotation.x = -1.4 * t;
    rig.armL.rotation.z = -0.3 * t;
  }

  function triggerThrowPose() {
    throwPoseTimer = 0.35;
  }

  var chokeGripTimer = 0;
  function applyChokeGripPose(dt) {
    if (chokeGripTimer <= 0) return;
    chokeGripTimer -= dt;
    if (chokeGripTimer < 0) chokeGripTimer = 0;
    rig.armR.rotation.x = 1.2;
    rig.armR.rotation.z = 0.15;
  }

  function triggerChokeGripPose(duration) {
    chokeGripTimer = Math.max(0.1, duration || 1.5);
  }

  return {
    root: root,
    rig: rig,
    footPlaneOffsetY: FOOT_PLANE_OFFSET_Y,
    setWeapon: setWeapon,
    updateLocomotion: updateLocomotion,
    updateAimPitch: updateAimPitch,
    getCoreWorldPosition: getCoreWorldPosition,
    getEyeWorldPosition: getEyeWorldPosition,
    getMuzzleWorldPosition: getMuzzleWorldPosition,
    getThrowableOriginWorldPosition: getThrowableOriginWorldPosition,
    setMuzzleVisible: setMuzzleVisible,
    applyThrowPose: applyThrowPose,
    triggerThrowPose: triggerThrowPose,
    applyChokeGripPose: applyChokeGripPose,
    triggerChokeGripPose: triggerChokeGripPose,
    getWeaponId: function () { return rig.weaponId; },
    _tmp: tmpVec
  };
};
