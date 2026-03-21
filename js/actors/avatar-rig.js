/**
 * avatar-rig.js - Shared blocky humanoid rig for player/enemy/remote visuals
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameAvatarRig
 */
(function () {
    'use strict';

    var GameAvatarRig = {};
    var entityConstants = (globalThis.__MAYHEM_RUNTIME && globalThis.__MAYHEM_RUNTIME.GameShared && globalThis.__MAYHEM_RUNTIME.GameShared.entityConstants) || {};
    var DEG_TO_RAD = Math.PI / 180;
    // Local rig axes:
    //   +X = actor right
    //   -X = actor left
    //   +Y = up
    //   -Y = down
    //   -Z = forward / face / muzzle direction
    //   +Z = backward
    function readVec3(value, fallback) {
        return {
            x: (value && typeof value.x === 'number') ? value.x : fallback.x,
            y: (value && typeof value.y === 'number') ? value.y : fallback.y,
            z: (value && typeof value.z === 'number') ? value.z : fallback.z
        };
    }

    var AVATAR_TORSO_SIZE = readVec3(entityConstants.AVATAR_TORSO_SIZE, { x: 0.8, y: 1.0, z: 0.5 });
    var AVATAR_TORSO_CENTER_OFFSET = readVec3(entityConstants.AVATAR_TORSO_CENTER_OFFSET, { x: 0, y: 1.3, z: 0 });
    var AVATAR_HEAD_SIZE = readVec3(entityConstants.AVATAR_HEAD_SIZE, { x: 0.55, y: 0.55, z: 0.55 });
    var AVATAR_HEAD_CENTER_OFFSET = readVec3(entityConstants.AVATAR_HEAD_CENTER_OFFSET, { x: 0, y: 2.1, z: 0 });
    var AVATAR_ARM_SIZE = readVec3(entityConstants.AVATAR_ARM_SIZE, { x: 0.22, y: 0.85, z: 0.22 });
    var AVATAR_ARM_LEFT_CENTER_OFFSET = readVec3(entityConstants.AVATAR_ARM_LEFT_CENTER_OFFSET, { x: -0.52, y: 1.25, z: 0 });
    var AVATAR_ARM_RIGHT_CENTER_OFFSET = readVec3(entityConstants.AVATAR_ARM_RIGHT_CENTER_OFFSET, { x: 0.52, y: 1.25, z: 0 });
    var AVATAR_LEG_SIZE = readVec3(entityConstants.AVATAR_LEG_SIZE, { x: 0.28, y: 0.9, z: 0.28 });
    var AVATAR_LEG_LEFT_CENTER_OFFSET = readVec3(entityConstants.AVATAR_LEG_LEFT_CENTER_OFFSET, { x: -0.18, y: 0.45, z: 0 });
    var AVATAR_LEG_RIGHT_CENTER_OFFSET = readVec3(entityConstants.AVATAR_LEG_RIGHT_CENTER_OFFSET, { x: 0.18, y: 0.45, z: 0 });
    var ARM_SHORT_SIDE = AVATAR_ARM_SIZE.x;
    var HALF_ARM_SHORT_SIDE = ARM_SHORT_SIDE * 0.5;
    var GUN_MOUNT_SHIFT_X = -0.08;
    var GUN_MOUNT_LIFT_Y = 0.1 + HALF_ARM_SHORT_SIDE;
    var GUN_MOUNT_SHIFT_Z = -HALF_ARM_SHORT_SIDE;
    var FOOT_PLANE_OFFSET_Y = (typeof entityConstants.AVATAR_FOOT_PLANE_OFFSET_Y === 'number') ? entityConstants.AVATAR_FOOT_PLANE_OFFSET_Y : 0.3;
    var UPPER_BODY_PIVOT_OFFSET = {
        x: AVATAR_TORSO_CENTER_OFFSET.x,
        y: (AVATAR_TORSO_CENTER_OFFSET.y - FOOT_PLANE_OFFSET_Y) - (AVATAR_TORSO_SIZE.y * 0.5),
        z: AVATAR_TORSO_CENTER_OFFSET.z
    };
    var HEAD_EYE_Y = 0.06;
    var HEAD_EYE_Z = -0.282;
    var HEAD_EYE_X = 0.12;
    var FIREARM_AIM_PITCH_SHOULDER_FACTOR = 0.7;
    var FIREARM_AIM_PITCH_WRIST_FACTOR = 0.3;
    var FIREARM_SPRINT_AIM_PITCH_SHOULDER_FACTOR = 0.55;
    var FIREARM_SPRINT_AIM_PITCH_WRIST_FACTOR = 0.25;
    var AIRBORNE_ARM_SIDE_SPLAY = -15 * DEG_TO_RAD;
    var AIRBORNE_ARM_SWEEP = 15 * DEG_TO_RAD;
    var WALK_FORWARD_LEAN = 3.5 * DEG_TO_RAD;
    var RUN_FORWARD_LEAN = 6.5 * DEG_TO_RAD;
    var AIRBORNE_DIRECTIONAL_LEAN_SCALE = 0.75;
    var AIRBORNE_DIRECTIONAL_LEAN_MIN = WALK_FORWARD_LEAN * 0.65;
    var UPPER_BODY_LEAN_BLEND_SPEED = 10;
    var LEFT_PALM_NEUTRAL = { x: -0.01, y: -0.84, z: -0.03 };
    var RIGHT_PALM_SOCKET = { x: 0.015, y: -0.98, z: -0.01 };
    var HANDLE_ANCHOR_NAME = 'weaponHandleAnchor';
    var BARREL_TIP_ANCHOR_NAME = 'weaponBarrelTipAnchor';
    var INFERRED_JOG_SPEED = 8;
    var INFERRED_RUN_SPEED = 14;
    var DEFAULT_GUN_WRIST_PITCH = -75 * DEG_TO_RAD;
    var GUN_CARRY_SHOULDER_SWAY = 0.0675;
    var GUN_CARRY_WRIST_SWAY = 0.03375;
    var SPRINT_SWING_MULTIPLIER = 1.16;
    var GUN_CARRY_BASE_PITCH = 75 * DEG_TO_RAD;
    var SUPPORT_ARM_WALK_SWAY = 0.65;
    var MELEE_ARM_SPLAY_Z = 0.18;

    function clamp01(value) {
        return Math.max(0, Math.min(1, Number(value || 0)));
    }

    function resetSupportHandPose(rig) {
        if (!rig || !rig.palmLeft) return;
        if (rig.armLBasePos && rig.armL) {
            rig.armL.position.copy(rig.armLBasePos);
        }
        rig.palmLeft.position.set(LEFT_PALM_NEUTRAL.x, LEFT_PALM_NEUTRAL.y, LEFT_PALM_NEUTRAL.z);
        rig.palmLeft.rotation.set(0, 0, 0);
    }

    function resetPrimaryHandPose(rig) {
        if (!rig) return;
        if (rig.armR) {
            rig.armR.rotation.set(0, 0, 0);
        }
        if (rig.palmRight) {
            rig.palmRight.rotation.set(0, 0, 0);
        }
    }

    function resetGunMountPose(rig) {
        if (!rig || !rig.gun || !rig.gunBaseRot) return;
        rig.gun.rotation.set(rig.gunBaseRot.x, rig.gunBaseRot.y, rig.gunBaseRot.z);
    }

    function applyFirearmAimPitch(rig, shoulderBase, shoulderFactor, wristFactor) {
        if (!rig || !rig.armR || !rig.palmRight) return;
        rig.armR.rotation.x = shoulderBase + (rig.aimPitch * Number(shoulderFactor || 0));
        rig.palmRight.rotation.x = rig.aimPitch * Number(wristFactor || 0);
    }

    function updateUpperBodyLean(rig, targetLean, dt) {
        if (!rig || !rig.upperBodyPivot) return;
        var blend = Math.min(1, Math.max(0, Number(dt || 0)) * UPPER_BODY_LEAN_BLEND_SPEED);
        rig.upperBodyLeanX += (Number(targetLean || 0) - rig.upperBodyLeanX) * blend;
        if (Math.abs(rig.upperBodyLeanX) < 0.0001 && Math.abs(targetLean) < 0.0001) {
            rig.upperBodyLeanX = 0;
        }
        rig.upperBodyPivot.rotation.x = rig.upperBodyLeanX;
    }

    function resolveDirectionalUpperBodyLean(airborne, hooked, choked, movingForward, movingBackward, sprinting, worldSpeed) {
        if (hooked || choked || movingForward === movingBackward) return 0;
        var leanBase = sprinting ? RUN_FORWARD_LEAN : WALK_FORWARD_LEAN;
        var leanSpeedTarget = sprinting ? INFERRED_RUN_SPEED : INFERRED_JOG_SPEED;
        if (airborne) {
            var airborneLean = leanBase * clamp01(worldSpeed / Math.max(0.001, leanSpeedTarget)) * AIRBORNE_DIRECTIONAL_LEAN_SCALE;
            airborneLean = Math.max(AIRBORNE_DIRECTIONAL_LEAN_MIN, airborneLean);
            return (movingForward ? -1 : 1) * airborneLean;
        }
        if (movingForward && worldSpeed > 0.02) {
            return -leanBase * clamp01(worldSpeed / Math.max(0.001, leanSpeedTarget));
        }
        return 0;
    }

    function createReloadPoseState() {
        return {
            armX: 0, armY: 0, armZ: 0,
            palmX: 0, palmY: 0, palmZ: 0,
            palmRotX: 0, palmRotY: 0, palmRotZ: 0,
            gunPitch: 0, gunYaw: 0, gunRoll: 0,
            rightArmX: 0, rightArmY: 0, rightArmZ: 0,
            rightWristX: 0,
            targetOffsetX: 0, targetOffsetY: 0, targetOffsetZ: 0,
            aimX: 0, aimY: 0, aimZ: 0,
            torsoRoll: 0, torsoLeanX: 0,
            phase: 'ready',
            phasePct: 1
        };
    }

    function getSupportPoseForWeapon(weaponId, aimPitch, walkSwing, adsActive) {
        if (weaponId !== 'sniper') return null;

        var aim = Number(aimPitch || 0);
        var walk = Number(walkSwing || 0);
        var adsTighten = adsActive ? 1 : 0;

        return {
            // Keep the sniper support hand tucked under the fore-end instead of
            // reaching across the entire torso or curling over the top rail.
            armX: 0.72 + (aim * 0.08) + (adsTighten * 0.02),
            armY: -0.28 - (Math.abs(walk) * 0.035) - (adsTighten * 0.015),
            armZ: -0.32 - (adsTighten * 0.025),
            palmX: -0.02,
            palmY: -0.93,
            palmZ: -0.16 - (adsTighten * 0.015),
            palmRotX: 0.08,
            palmRotY: -0.03,
            palmRotZ: -0.16,
            targetX: 0.1 + (aim * 0.07) + (adsTighten * 0.012),
            targetY: -0.08,
            targetZ: -0.1 - (adsTighten * 0.015)
        };
    }

    function applyLeftArmPose(rig, pose) {
        if (!rig || !pose || !rig.armL) return;
        if (rig.armLBasePos) {
            rig.armL.position.copy(rig.armLBasePos);
            rig.armL.position.x += Number(pose.armX != null ? pose.armX : pose.shoulderX || 0);
            rig.armL.position.y += Number(pose.armY != null ? pose.armY : pose.shoulderY || 0);
            rig.armL.position.z += Number(pose.armZ != null ? pose.armZ : pose.shoulderZ || 0);
        }
        if (rig.palmLeft) {
            rig.palmLeft.position.set(pose.palmX, pose.palmY, pose.palmZ);
            rig.palmLeft.rotation.set(
                Number(pose.palmRotX || 0),
                Number(pose.palmRotY || 0),
                Number(pose.palmRotZ || 0)
            );
        }
    }

    function smoothstep(value) {
        var t = clamp01(value);
        return t * t * (3 - (2 * t));
    }

    function lerpNumber(a, b, t) {
        return Number(a || 0) + ((Number(b || 0) - Number(a || 0)) * clamp01(t));
    }

    function fillReloadPose(out, a, b, t) {
        var from = a || {};
        var to = b || {};
        var pose = out || createReloadPoseState();
        pose.armX = lerpNumber(from.armX, to.armX, t);
        pose.armY = lerpNumber(from.armY, to.armY, t);
        pose.armZ = lerpNumber(from.armZ, to.armZ, t);
        pose.palmX = lerpNumber(from.palmX, to.palmX, t);
        pose.palmY = lerpNumber(from.palmY, to.palmY, t);
        pose.palmZ = lerpNumber(from.palmZ, to.palmZ, t);
        pose.palmRotX = lerpNumber(from.palmRotX, to.palmRotX, t);
        pose.palmRotY = lerpNumber(from.palmRotY, to.palmRotY, t);
        pose.palmRotZ = lerpNumber(from.palmRotZ, to.palmRotZ, t);
        pose.gunPitch = lerpNumber(from.gunPitch, to.gunPitch, t);
        pose.gunYaw = lerpNumber(from.gunYaw, to.gunYaw, t);
        pose.gunRoll = lerpNumber(from.gunRoll, to.gunRoll, t);
        pose.rightArmX = lerpNumber(from.rightArmX, to.rightArmX, t);
        pose.rightArmY = lerpNumber(from.rightArmY, to.rightArmY, t);
        pose.rightArmZ = lerpNumber(from.rightArmZ, to.rightArmZ, t);
        pose.rightWristX = lerpNumber(from.rightWristX, to.rightWristX, t);
        pose.targetOffsetX = lerpNumber(from.targetOffsetX, to.targetOffsetX, t);
        pose.targetOffsetY = lerpNumber(from.targetOffsetY, to.targetOffsetY, t);
        pose.targetOffsetZ = lerpNumber(from.targetOffsetZ, to.targetOffsetZ, t);
        pose.aimX = lerpNumber(from.aimX, to.aimX, t);
        pose.aimY = lerpNumber(from.aimY, to.aimY, t);
        pose.aimZ = lerpNumber(from.aimZ, to.aimZ, t);
        pose.torsoRoll = lerpNumber(from.torsoRoll, to.torsoRoll, t);
        pose.torsoLeanX = lerpNumber(from.torsoLeanX, to.torsoLeanX, t);
        return pose;
    }

    function reloadPresentationForWeapon(weaponId) {
        var shared = globalThis.__MAYHEM_RUNTIME.GameShared || {};
        var presentation = shared.getWeaponPresentation ? shared.getWeaponPresentation(weaponId) : null;
        return presentation && presentation.reload ? presentation.reload : {
            profileId: 'rifle',
            raiseEnd: 0.16,
            manipulateEnd: 0.68
        };
    }

    var RELOAD_PROFILES = {
        sidearm: {
            ready: {
                armX: 0.04, armY: 0.01, armZ: 0.03,
                palmX: -0.02, palmY: -0.8, palmZ: -0.08,
                palmRotX: 0.12, palmRotY: -0.04, palmRotZ: -0.12,
                targetOffsetX: -0.01, targetOffsetY: 0.03, targetOffsetZ: 0.05,
                aimX: 0.06, aimY: -0.04, aimZ: -0.02,
                gunPitch: -0.01, gunYaw: 0.02, gunRoll: -0.04
            },
            raise: {
                armX: 0.1, armY: 0.06, armZ: 0.09,
                palmX: -0.03, palmY: -0.72, palmZ: -0.09,
                palmRotX: 0.28, palmRotY: -0.12, palmRotZ: -0.28,
                targetOffsetX: -0.015, targetOffsetY: 0.05, targetOffsetZ: 0.09,
                aimX: 0.07, aimY: -0.03, aimZ: -0.01,
                gunPitch: -0.07, gunYaw: 0.06, gunRoll: -0.14,
                rightArmX: 0.04, rightArmY: -0.02, rightArmZ: 0.03, rightWristX: 0.05,
                torsoRoll: 0.03, torsoLeanX: 0.01
            },
            manipulate: {
                armX: 0.15, armY: 0.11, armZ: 0.13,
                palmX: -0.035, palmY: -0.64, palmZ: -0.07,
                palmRotX: 0.52, palmRotY: -0.16, palmRotZ: -0.4,
                targetOffsetX: -0.02, targetOffsetY: 0.085, targetOffsetZ: 0.12,
                aimX: 0.09, aimY: -0.02, aimZ: 0.0,
                gunPitch: -0.12, gunYaw: 0.09, gunRoll: -0.22,
                rightArmX: 0.08, rightArmY: -0.04, rightArmZ: 0.05, rightWristX: 0.12,
                torsoRoll: 0.05, torsoLeanX: 0.02
            },
            actionPulse: { gunYaw: -0.025, gunRoll: 0.05, palmRotX: 0.05, targetOffsetZ: 0.015, rightWristX: 0.03 }
        },
        lmg: {
            ready: {
                armX: 0.05, armY: 0.0, armZ: 0.04,
                palmX: -0.03, palmY: -0.82, palmZ: -0.14,
                palmRotX: 0.1, palmRotY: -0.03, palmRotZ: -0.1,
                targetOffsetX: -0.03, targetOffsetY: 0.03, targetOffsetZ: 0.08,
                aimX: 0.09, aimY: -0.05, aimZ: -0.03
            },
            raise: {
                armX: 0.1, armY: 0.04, armZ: 0.11,
                palmX: -0.04, palmY: -0.76, palmZ: -0.18,
                palmRotX: 0.18, palmRotY: -0.08, palmRotZ: -0.18,
                targetOffsetX: -0.04, targetOffsetY: 0.06, targetOffsetZ: 0.12,
                aimX: 0.1, aimY: -0.04, aimZ: -0.02,
                gunPitch: -0.04, gunYaw: 0.05, gunRoll: -0.1,
                rightArmX: 0.04, rightArmY: -0.01, rightArmZ: 0.04, rightWristX: 0.04,
                torsoRoll: 0.05, torsoLeanX: 0.02
            },
            manipulate: {
                armX: 0.17, armY: 0.08, armZ: 0.18,
                palmX: -0.045, palmY: -0.7, palmZ: -0.2,
                palmRotX: 0.28, palmRotY: -0.12, palmRotZ: -0.22,
                targetOffsetX: -0.05, targetOffsetY: 0.09, targetOffsetZ: 0.16,
                aimX: 0.12, aimY: -0.03, aimZ: -0.01,
                gunPitch: -0.07, gunYaw: 0.06, gunRoll: -0.18,
                rightArmX: 0.07, rightArmY: -0.02, rightArmZ: 0.06, rightWristX: 0.1,
                torsoRoll: 0.08, torsoLeanX: 0.03
            },
            actionPulse: { gunYaw: -0.015, gunRoll: 0.04, palmRotX: 0.03, targetOffsetZ: 0.012, rightWristX: 0.02 }
        },
        shotgun: {
            ready: {
                armX: 0.05, armY: 0.0, armZ: 0.05,
                palmX: -0.03, palmY: -0.83, palmZ: -0.16,
                palmRotX: 0.08, palmRotY: -0.03, palmRotZ: -0.1,
                targetOffsetX: -0.03, targetOffsetY: 0.03, targetOffsetZ: 0.1,
                aimX: 0.1, aimY: -0.05, aimZ: -0.03
            },
            raise: {
                armX: 0.12, armY: 0.04, armZ: 0.12,
                palmX: -0.04, palmY: -0.76, palmZ: -0.2,
                palmRotX: 0.16, palmRotY: -0.08, palmRotZ: -0.16,
                targetOffsetX: -0.04, targetOffsetY: 0.06, targetOffsetZ: 0.18,
                aimX: 0.1, aimY: -0.04, aimZ: -0.02,
                gunPitch: -0.03, gunYaw: 0.04, gunRoll: -0.1,
                rightArmX: 0.04, rightArmY: -0.01, rightArmZ: 0.04, rightWristX: 0.05,
                torsoRoll: 0.05, torsoLeanX: 0.02
            },
            manipulate: {
                armX: 0.22, armY: 0.06, armZ: 0.21,
                palmX: -0.045, palmY: -0.71, palmZ: -0.24,
                palmRotX: 0.24, palmRotY: -0.11, palmRotZ: -0.18,
                targetOffsetX: -0.06, targetOffsetY: 0.08, targetOffsetZ: 0.24,
                aimX: 0.12, aimY: -0.04, aimZ: -0.01,
                gunPitch: -0.05, gunYaw: 0.05, gunRoll: -0.16,
                rightArmX: 0.06, rightArmY: -0.02, rightArmZ: 0.05, rightWristX: 0.08,
                torsoRoll: 0.07, torsoLeanX: 0.02
            },
            actionPulse: { gunYaw: 0.01, gunRoll: 0.035, palmRotX: 0.02, targetOffsetZ: 0.03, rightWristX: 0.015 }
        },
        precision: {
            ready: {
                armX: 0.04, armY: 0.0, armZ: 0.04,
                palmX: -0.03, palmY: -0.84, palmZ: -0.14,
                palmRotX: 0.09, palmRotY: -0.03, palmRotZ: -0.12,
                targetOffsetX: -0.03, targetOffsetY: 0.03, targetOffsetZ: 0.09,
                aimX: 0.09, aimY: -0.05, aimZ: -0.03
            },
            raise: {
                armX: 0.09, armY: 0.05, armZ: 0.09,
                palmX: -0.035, palmY: -0.77, palmZ: -0.18,
                palmRotX: 0.18, palmRotY: -0.08, palmRotZ: -0.18,
                targetOffsetX: -0.04, targetOffsetY: 0.06, targetOffsetZ: 0.14,
                aimX: 0.1, aimY: -0.04, aimZ: -0.02,
                gunPitch: -0.035, gunYaw: 0.04, gunRoll: -0.08,
                rightArmX: 0.03, rightArmY: -0.01, rightArmZ: 0.03, rightWristX: 0.035,
                torsoRoll: 0.03, torsoLeanX: 0.015
            },
            manipulate: {
                armX: 0.16, armY: 0.1, armZ: 0.15,
                palmX: -0.04, palmY: -0.7, palmZ: -0.2,
                palmRotX: 0.26, palmRotY: -0.1, palmRotZ: -0.2,
                targetOffsetX: -0.045, targetOffsetY: 0.095, targetOffsetZ: 0.16,
                aimX: 0.11, aimY: -0.03, aimZ: -0.01,
                gunPitch: -0.06, gunYaw: 0.05, gunRoll: -0.12,
                rightArmX: 0.06, rightArmY: -0.02, rightArmZ: 0.04, rightWristX: 0.08,
                torsoRoll: 0.05, torsoLeanX: 0.025
            },
            actionPulse: { gunYaw: -0.01, gunRoll: 0.025, palmRotX: 0.02, targetOffsetZ: 0.012, rightWristX: 0.01 }
        },
        rifle: {
            ready: {
                armX: 0.05, armY: 0.0, armZ: 0.04,
                palmX: -0.03, palmY: -0.83, palmZ: -0.15,
                palmRotX: 0.08, palmRotY: -0.03, palmRotZ: -0.1,
                targetOffsetX: -0.03, targetOffsetY: 0.03, targetOffsetZ: 0.09,
                aimX: 0.1, aimY: -0.05, aimZ: -0.03
            },
            raise: {
                armX: 0.12, armY: 0.04, armZ: 0.11,
                palmX: -0.04, palmY: -0.76, palmZ: -0.18,
                palmRotX: 0.17, palmRotY: -0.08, palmRotZ: -0.16,
                targetOffsetX: -0.04, targetOffsetY: 0.06, targetOffsetZ: 0.14,
                aimX: 0.1, aimY: -0.04, aimZ: -0.02,
                gunPitch: -0.04, gunYaw: 0.05, gunRoll: -0.1,
                rightArmX: 0.04, rightArmY: -0.01, rightArmZ: 0.04, rightWristX: 0.04,
                torsoRoll: 0.05, torsoLeanX: 0.02
            },
            manipulate: {
                armX: 0.2, armY: 0.08, armZ: 0.18,
                palmX: -0.045, palmY: -0.7, palmZ: -0.2,
                palmRotX: 0.26, palmRotY: -0.11, palmRotZ: -0.2,
                targetOffsetX: -0.05, targetOffsetY: 0.1, targetOffsetZ: 0.17,
                aimX: 0.12, aimY: -0.03, aimZ: -0.01,
                gunPitch: -0.07, gunYaw: 0.06, gunRoll: -0.18,
                rightArmX: 0.07, rightArmY: -0.02, rightArmZ: 0.05, rightWristX: 0.1,
                torsoRoll: 0.07, torsoLeanX: 0.03
            },
            actionPulse: { gunYaw: -0.015, gunRoll: 0.03, palmRotX: 0.025, targetOffsetZ: 0.015, rightWristX: 0.012 }
        }
    };

    function reloadProfileSpecForWeapon(weaponId) {
        var reloadPresentation = reloadPresentationForWeapon(weaponId);
        var profileId = String(reloadPresentation.profileId || 'rifle');
        return RELOAD_PROFILES[profileId] || RELOAD_PROFILES.rifle;
    }

    function resolveReloadTiming(weaponId, reloadPct, reloadPhase, reloadPhasePct) {
        var reloadPresentation = reloadPresentationForWeapon(weaponId);
        var t = clamp01(reloadPct);
        var phase = String(reloadPhase || '');
        var phasePct = clamp01(reloadPhasePct);
        if (!phase) {
            if (t < reloadPresentation.raiseEnd) {
                phase = 'raise';
                phasePct = t / Math.max(0.0001, reloadPresentation.raiseEnd);
            } else if (t < reloadPresentation.manipulateEnd) {
                phase = 'manipulate';
                phasePct = (t - reloadPresentation.raiseEnd) / Math.max(0.0001, reloadPresentation.manipulateEnd - reloadPresentation.raiseEnd);
            } else {
                phase = 'settle';
                phasePct = (t - reloadPresentation.manipulateEnd) / Math.max(0.0001, 1 - reloadPresentation.manipulateEnd);
            }
        }
        return {
            phase: phase,
            phasePct: clamp01(phasePct),
            reloadPresentation: reloadPresentation
        };
    }

    function resolveReloadPoseForWeapon(out, weaponId, reloadPct, reloadPhase, reloadPhasePct) {
        var profile = reloadProfileSpecForWeapon(weaponId);
        var timing = resolveReloadTiming(weaponId, reloadPct, reloadPhase, reloadPhasePct);
        var phase = timing.phase;
        var phasePct = timing.phasePct;
        var pose = out || createReloadPoseState();
        if (phase === 'raise') {
            fillReloadPose(pose, profile.ready, profile.raise, smoothstep(phasePct));
        } else if (phase === 'settle') {
            fillReloadPose(pose, profile.manipulate, profile.ready, smoothstep(phasePct));
        } else {
            var enterPct = smoothstep(Math.min(1, phasePct / 0.38));
            fillReloadPose(pose, profile.raise, profile.manipulate, enterPct);
            if (phasePct > 0.42) {
                var pulsePct = smoothstep((phasePct - 0.42) / 0.58);
                var actionPulse = Math.sin(pulsePct * Math.PI);
                var pulse = profile.actionPulse || null;
                if (pulse) {
                    pose.gunYaw += actionPulse * (pulse.gunYaw || 0);
                    pose.gunRoll += actionPulse * (pulse.gunRoll || 0);
                    pose.palmRotX += actionPulse * (pulse.palmRotX || 0);
                    pose.targetOffsetZ += actionPulse * (pulse.targetOffsetZ || 0);
                    pose.rightWristX += actionPulse * (pulse.rightWristX || 0);
                }
            }
        }
        pose.phase = phase;
        pose.phasePct = phasePct;
        return pose;
    }

    function getReloadPoseForWeapon(weaponId, reloadPct, reloadPhase, reloadPhasePct) {
        return resolveReloadPoseForWeapon(createReloadPoseState(), weaponId, reloadPct, reloadPhase, reloadPhasePct);
    }

    function applyReloadPose(rig, weaponId, reloadPct, modelRoot, reloadPhase, reloadPhasePct, reloadTarget, reloadPose, pointArmAtTargetFn) {
        if (!rig || !rig.armL || !rig.gun) return;

        var pose = resolveReloadPoseForWeapon(reloadPose, weaponId, reloadPct, reloadPhase, reloadPhasePct);
        applyLeftArmPose(rig, pose);
        if (rig.supportAnchor && modelRoot && pointArmAtTargetFn) {
            reloadTarget.set(
                rig.supportBasePos.x + (pose.targetOffsetX || 0),
                rig.supportBasePos.y + (pose.targetOffsetY || 0),
                rig.supportBasePos.z + (pose.targetOffsetZ || 0)
            );
            rig.gun.localToWorld(reloadTarget);
            pointArmAtTargetFn(
                rig.armL,
                reloadTarget,
                modelRoot,
                pose.aimX,
                pose.aimY,
                pose.aimZ
            );
        }
        if (rig.upperBodyPivot) {
            rig.upperBodyPivot.rotation.x += pose.torsoLeanX;
            rig.upperBodyPivot.rotation.z += pose.torsoRoll;
        }
        rig.gun.rotation.x += pose.gunPitch;
        rig.gun.rotation.y += pose.gunYaw;
        rig.gun.rotation.z += pose.gunRoll;
        if (rig.armR) {
            rig.armR.rotation.x += pose.rightArmX;
            rig.armR.rotation.y += pose.rightArmY;
            rig.armR.rotation.z += pose.rightArmZ;
        }
        if (rig.palmRight) {
            rig.palmRight.rotation.x += pose.rightWristX;
        }
    }

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
        var visualsApi = globalThis.__MAYHEM_RUNTIME.GameWeaponVisuals || null;
        if (visualsApi && visualsApi.get) return visualsApi.get(weaponId);
        return null;
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

    function setProceduralWeaponVisible(rig, visible) {
        if (!rig) return;
        rig.gunBody.visible = !!visible;
        rig.gunBarrel.visible = !!visible;
        rig.gunStock.visible = !!visible;
        rig.gunGrip.visible = !!visible;
        rig.scope.visible = !!visible && !!rig.scopeEnabled;
        rig.pump.visible = !!visible && !!rig.pumpEnabled;
        rig.coil.visible = !!visible && !!rig.coilEnabled;
    }

    function disposeSceneResources(root) {
        if (!root || !root.traverse) return;
        var geometries = [];
        var materials = [];
        root.traverse(function (node) {
            if (node && node.geometry && typeof node.geometry.dispose === 'function' && geometries.indexOf(node.geometry) === -1) {
                geometries.push(node.geometry);
            }
            if (!node || !node.material) return;
            var nodeMaterials = Array.isArray(node.material) ? node.material : [node.material];
            for (var i = 0; i < nodeMaterials.length; i++) {
                var material = nodeMaterials[i];
                if (material && typeof material.dispose === 'function' && materials.indexOf(material) === -1) {
                    materials.push(material);
                }
            }
        });
        for (var g = 0; g < geometries.length; g++) {
            geometries[g].dispose();
        }
        for (var m = 0; m < materials.length; m++) {
            materials[m].dispose();
        }
    }

    GameAvatarRig.create = function (options) {
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

        var upperBodyPivot = new THREE.Group();
        upperBodyPivot.position.set(UPPER_BODY_PIVOT_OFFSET.x, UPPER_BODY_PIVOT_OFFSET.y, UPPER_BODY_PIVOT_OFFSET.z);
        modelRoot.add(upperBodyPivot);

        var body = new THREE.Mesh(new THREE.BoxGeometry(AVATAR_TORSO_SIZE.x, AVATAR_TORSO_SIZE.y, AVATAR_TORSO_SIZE.z), bodyMat);
        body.position.set(
            AVATAR_TORSO_CENTER_OFFSET.x - UPPER_BODY_PIVOT_OFFSET.x,
            (AVATAR_TORSO_CENTER_OFFSET.y - FOOT_PLANE_OFFSET_Y) - UPPER_BODY_PIVOT_OFFSET.y,
            AVATAR_TORSO_CENTER_OFFSET.z - UPPER_BODY_PIVOT_OFFSET.z
        );
        upperBodyPivot.add(body);

        var head = new THREE.Mesh(new THREE.BoxGeometry(AVATAR_HEAD_SIZE.x, AVATAR_HEAD_SIZE.y, AVATAR_HEAD_SIZE.z), skinMat);
        head.position.set(
            AVATAR_HEAD_CENTER_OFFSET.x - UPPER_BODY_PIVOT_OFFSET.x,
            (AVATAR_HEAD_CENTER_OFFSET.y - FOOT_PLANE_OFFSET_Y) - UPPER_BODY_PIVOT_OFFSET.y,
            AVATAR_HEAD_CENTER_OFFSET.z - UPPER_BODY_PIVOT_OFFSET.z
        );
        upperBodyPivot.add(head);
        var eyeLeft = addXEye(head, -HEAD_EYE_X, eyeMat);
        var eyeRight = addXEye(head, HEAD_EYE_X, eyeMat);

        var eyeAnchor = new THREE.Object3D();
        eyeAnchor.position.set(0, 0.05, 0.18);
        head.add(eyeAnchor);

        var shoulderLeft = new THREE.Group();
        shoulderLeft.position.set(
            AVATAR_ARM_LEFT_CENTER_OFFSET.x - UPPER_BODY_PIVOT_OFFSET.x,
            (AVATAR_ARM_LEFT_CENTER_OFFSET.y - FOOT_PLANE_OFFSET_Y + (AVATAR_ARM_SIZE.y * 0.5)) - UPPER_BODY_PIVOT_OFFSET.y,
            AVATAR_ARM_LEFT_CENTER_OFFSET.z - UPPER_BODY_PIVOT_OFFSET.z
        );
        var armL = new THREE.Mesh(new THREE.BoxGeometry(AVATAR_ARM_SIZE.x, AVATAR_ARM_SIZE.y, AVATAR_ARM_SIZE.z), skinMat);
        armL.position.y = -(AVATAR_ARM_SIZE.y * 0.5);
        shoulderLeft.add(armL);
        var palmLeft = new THREE.Group();
        palmLeft.position.set(LEFT_PALM_NEUTRAL.x, LEFT_PALM_NEUTRAL.y, LEFT_PALM_NEUTRAL.z);
        shoulderLeft.add(palmLeft);
        upperBodyPivot.add(shoulderLeft);

        var shoulderRight = new THREE.Group();
        shoulderRight.position.set(
            AVATAR_ARM_RIGHT_CENTER_OFFSET.x - UPPER_BODY_PIVOT_OFFSET.x,
            (AVATAR_ARM_RIGHT_CENTER_OFFSET.y - FOOT_PLANE_OFFSET_Y + (AVATAR_ARM_SIZE.y * 0.5)) - UPPER_BODY_PIVOT_OFFSET.y,
            AVATAR_ARM_RIGHT_CENTER_OFFSET.z - UPPER_BODY_PIVOT_OFFSET.z
        );
        var armR = new THREE.Mesh(new THREE.BoxGeometry(AVATAR_ARM_SIZE.x, AVATAR_ARM_SIZE.y, AVATAR_ARM_SIZE.z), skinMat);
        armR.position.y = -(AVATAR_ARM_SIZE.y * 0.5);
        shoulderRight.add(armR);

        var palmRight = new THREE.Group();
        palmRight.position.set(RIGHT_PALM_SOCKET.x, RIGHT_PALM_SOCKET.y, RIGHT_PALM_SOCKET.z);
        shoulderRight.add(palmRight);
        upperBodyPivot.add(shoulderRight);

        var hipLeft = new THREE.Group();
        hipLeft.position.set(AVATAR_LEG_LEFT_CENTER_OFFSET.x, AVATAR_LEG_LEFT_CENTER_OFFSET.y - FOOT_PLANE_OFFSET_Y + (AVATAR_LEG_SIZE.y * 0.5), AVATAR_LEG_LEFT_CENTER_OFFSET.z);
        var legL = new THREE.Mesh(new THREE.BoxGeometry(AVATAR_LEG_SIZE.x, AVATAR_LEG_SIZE.y, AVATAR_LEG_SIZE.z), legMat);
        legL.position.y = -(AVATAR_LEG_SIZE.y * 0.5);
        hipLeft.add(legL);
        modelRoot.add(hipLeft);

        var hipRight = new THREE.Group();
        hipRight.position.set(AVATAR_LEG_RIGHT_CENTER_OFFSET.x, AVATAR_LEG_RIGHT_CENTER_OFFSET.y - FOOT_PLANE_OFFSET_Y + (AVATAR_LEG_SIZE.y * 0.5), AVATAR_LEG_RIGHT_CENTER_OFFSET.z);
        var legR = new THREE.Mesh(new THREE.BoxGeometry(AVATAR_LEG_SIZE.x, AVATAR_LEG_SIZE.y, AVATAR_LEG_SIZE.z), legMat);
        legR.position.y = -(AVATAR_LEG_SIZE.y * 0.5);
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
        coreAnchor.position.set(
            AVATAR_TORSO_CENTER_OFFSET.x - UPPER_BODY_PIVOT_OFFSET.x,
            (AVATAR_TORSO_CENTER_OFFSET.y - FOOT_PLANE_OFFSET_Y) - UPPER_BODY_PIVOT_OFFSET.y,
            AVATAR_TORSO_CENTER_OFFSET.z - UPPER_BODY_PIVOT_OFFSET.z
        );
        upperBodyPivot.add(coreAnchor);

        var throwableOriginAnchor = new THREE.Object3D();
        throwableOriginAnchor.position.set(0.01, -0.02, -0.12);
        palmLeft.add(throwableOriginAnchor);

        var armDown = new THREE.Vector3(0, -1, 0);
        var shoulderWorld = new THREE.Vector3();
        var targetWorld = new THREE.Vector3();
        var parentLocalA = new THREE.Vector3();
        var parentLocalB = new THREE.Vector3();
        var aimDir = new THREE.Vector3();
        var aimQuat = new THREE.Quaternion();
        var aimEuler = new THREE.Euler();
        var handleOffset = new THREE.Vector3();
        var reloadTarget = new THREE.Vector3();
        var reloadPoseScratch = createReloadPoseState();
        var disposed = false;

        function pointArmAtTarget(armGroup, targetVec, parentGroup, extraX, extraY, extraZ) {
            if (!armGroup || !targetVec || !parentGroup) return;
            armGroup.getWorldPosition(shoulderWorld);
            parentLocalA.copy(shoulderWorld);
            parentLocalB.copy(targetVec);
            parentGroup.worldToLocal(parentLocalA);
            parentGroup.worldToLocal(parentLocalB);
            aimDir.copy(parentLocalB).sub(parentLocalA);
            if (aimDir.lengthSq() < 0.000001) return;
            aimDir.normalize();
            aimQuat.setFromUnitVectors(armDown, aimDir);
            aimEuler.setFromQuaternion(aimQuat, 'XYZ');
            armGroup.rotation.x = aimEuler.x + (extraX || 0);
            armGroup.rotation.y = aimEuler.y + (extraY || 0);
            armGroup.rotation.z = aimEuler.z + (extraZ || 0);
        }

        var rig = {
            upperBodyPivot: upperBodyPivot,
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
            weaponId: '',
            gaitPhase: Math.random() * Math.PI * 2,
            aimPitch: 0,
            upperBodyLeanX: 0,
            gunBasePos: new THREE.Vector3(),
            gunBaseRot: new THREE.Vector3(),
            supportBasePos: new THREE.Vector3(),
            armLBasePos: shoulderLeft.position.clone(),
            footPlaneOffsetY: FOOT_PLANE_OFFSET_Y,
            scopeEnabled: false,
            pumpEnabled: false,
            coilEnabled: false
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

            if (rig.weaponId === (resolved && resolved.weaponId ? resolved.weaponId : 'rifle')) {
                return;
            }

            rig.weaponId = resolved && resolved.weaponId ? resolved.weaponId : 'rifle';
            rig.weaponClass = visual && visual.classId ? visual.classId : 'gun';

            // Keep weapon body above the hand line so grip/stock read as hand-held.
            rig.gun.position.set(
                mountPos[0] + GUN_MOUNT_SHIFT_X,
                mountPos[1] + GUN_MOUNT_LIFT_Y,
                mountPos[2] + GUN_MOUNT_SHIFT_Z
            );
            // Let each weapon fine-tune its wrist pitch relative to the forearm.
            rig.gun.rotation.set(
                DEFAULT_GUN_WRIST_PITCH + Number(mountRot[0] || 0),
                Number(mountRot[1] || 0),
                Number(mountRot[2] || 0)
            );

            handleOffset.set(handlePos[0], handlePos[1], handlePos[2]);
            handleOffset.applyEuler(rig.gun.rotation);
            rig.gun.position.sub(handleOffset);

            rig.gunBasePos.copy(rig.gun.position);
            rig.gunBaseRot.copy(rig.gun.rotation);
            rig.supportBasePos.set(supportPos[0], supportPos[1], supportPos[2]);

            setPart(rig.gunBody, parts.body);
            setPart(rig.gunBarrel, parts.barrel);
            setPart(rig.gunStock, parts.stock);
            setPart(rig.gunGrip, parts.grip);

            rig.scopeEnabled = !!parts.scope;
            rig.pumpEnabled = !!parts.pump;
            rig.coilEnabled = !!parts.coil;
            setProceduralWeaponVisible(rig, true);
            rig.muzzle.position.set(muzzlePos[0], muzzlePos[1], muzzlePos[2]);
            rig.supportAnchor.position.set(rig.supportBasePos.x, rig.supportBasePos.y, rig.supportBasePos.z);
            setAnchorPosition(rig.gun, HANDLE_ANCHOR_NAME, handlePos);
            setAnchorPosition(rig.gun, BARREL_TIP_ANCHOR_NAME, barrelTipPos);
        }

        function setAimPitch(pitch) {
            rig.aimPitch = Math.max(-1.1, Math.min(1.1, pitch || 0));
        }

        function applyAnimState(animState, dt) {
            animState = animState || null;
            var speedNorm = Math.max(0, Math.min(1.4, Number(animState && animState.speedNorm || 0)));
            var sprinting = !!(animState && animState.sprinting);
            var airborne = !!(animState && animState.airborne);
            var choked = !!(animState && animState.choked);
            var chokeStartedAt = choked ? Number(animState.startedAt || 0) : 0;
            var hooked = !!(animState && animState.hooked);
            var hookStartedAt = hooked ? Number(animState.hookStartedAt || 0) : 0;
            var movingForward = !!(animState && animState.movingForward);
            var movingBackward = !!(animState && animState.movingBackward);
            var legAmp = 0.12 + speedNorm * 0.55;
            if (legAmp > 0.72) legAmp = 0.72;
            var worldSpeed = animState && typeof animState.worldSpeed === 'number'
                ? Math.max(0, Number(animState.worldSpeed || 0))
                : (speedNorm * (sprinting ? INFERRED_RUN_SPEED : INFERRED_JOG_SPEED));
            var targetUpperBodyLean = resolveDirectionalUpperBodyLean(
                airborne,
                hooked,
                choked,
                movingForward,
                movingBackward,
                sprinting,
                worldSpeed
            );
            updateUpperBodyLean(rig, targetUpperBodyLean, dt);
            rig.upperBodyPivot.rotation.z = 0;
            if (worldSpeed > 0.02) {
                var strideLength = 1.6 + (legAmp * 3.2);
                rig.gaitPhase += ((worldSpeed * Math.max(0, dt || 0)) / Math.max(0.001, strideLength)) * Math.PI * 2;
            }
            var walkSwing = Math.sin(rig.gaitPhase) * legAmp;
            resetSupportHandPose(rig);
            resetPrimaryHandPose(rig);
            resetGunMountPose(rig);
            if (hooked && !choked) {
                var hookStamp = Date.now();
                var hookPhase = hookStartedAt ? ((hookStamp - hookStartedAt) * 0.02) : (hookStamp * 0.018);
                rig.legL.rotation.x = -0.28 + (Math.sin(hookPhase) * 0.16);
                rig.legR.rotation.x = -0.16 + (Math.sin(hookPhase + 1.3) * 0.16);
                rig.legL.rotation.z = 0.06 + (Math.sin(hookPhase + 0.4) * 0.035);
                rig.legR.rotation.z = -0.06 + (Math.sin(hookPhase + 1.8) * 0.035);
                rig.legL.position.x = AVATAR_LEG_LEFT_CENTER_OFFSET.x;
                rig.legR.position.x = AVATAR_LEG_RIGHT_CENTER_OFFSET.x;
                rig.armL.rotation.x = -0.54 + (Math.sin(hookPhase + 0.8) * 0.16);
                rig.armL.rotation.y = -0.12;
                rig.armL.rotation.z = -0.28;
                rig.armR.rotation.x = 0.98 + (Math.sin(hookPhase + 2.0) * 0.14);
                rig.armR.rotation.y = 0.06;
                rig.armR.rotation.z = 0.08;
                rig.palmRight.rotation.x = -0.08;
                return;
            }
            if (choked) {
                var stamp = Date.now();
                var phase = chokeStartedAt ? ((stamp - chokeStartedAt) * 0.02) : (stamp * 0.02);
                var legSquirmAmp = 0.34;
                var armSquirmAmp = 0.28;
                rig.legL.rotation.x = Math.sin(phase) * legSquirmAmp;
                rig.legR.rotation.x = Math.sin(phase + 1.6) * legSquirmAmp;
                rig.legL.rotation.z = Math.sin(phase + 0.9) * 0.08;
                rig.legR.rotation.z = Math.sin(phase + 2.3) * -0.08;
                rig.legL.position.x = AVATAR_LEG_LEFT_CENTER_OFFSET.x;
                rig.legR.position.x = AVATAR_LEG_RIGHT_CENTER_OFFSET.x;
                rig.armL.rotation.x = -0.18 + (Math.sin(phase + 0.8) * armSquirmAmp);
                rig.armL.rotation.y = -0.12 + (Math.sin(phase + 0.3) * 0.12);
                rig.armL.rotation.z = -0.24 + (Math.sin(phase + 1.2) * 0.12);
                rig.armR.rotation.x = 0.92 + (Math.sin(phase + 1.7) * 0.18);
                rig.armR.rotation.y = 0;
                rig.armR.rotation.z = 0.08 + (Math.sin(phase + 2.1) * 0.12);
                rig.palmRight.rotation.x = 0;
                return;
            }
            if (airborne) {
                var airborneArmSweep = 0;
                if (movingForward !== movingBackward) {
                    airborneArmSweep = movingForward ? -AIRBORNE_ARM_SWEEP : AIRBORNE_ARM_SWEEP;
                }
                rig.legL.rotation.x = 0;
                rig.legR.rotation.x = 0;
                rig.legL.rotation.z = 0;
                rig.legR.rotation.z = 0;
                rig.legL.position.x = AVATAR_LEG_LEFT_CENTER_OFFSET.x;
                rig.legR.position.x = AVATAR_LEG_RIGHT_CENTER_OFFSET.x;
                rig.armL.rotation.x = airborneArmSweep;
                rig.armL.rotation.y = 0;
                rig.armL.rotation.z = AIRBORNE_ARM_SIDE_SPLAY;
                applyFirearmAimPitch(rig, 1.05, FIREARM_AIM_PITCH_SHOULDER_FACTOR, FIREARM_AIM_PITCH_WRIST_FACTOR);
                rig.armR.rotation.z = -0.08;
            } else {
                rig.legL.rotation.x = walkSwing;
                rig.legR.rotation.x = -walkSwing;
                rig.legL.rotation.z = 0;
                rig.legR.rotation.z = 0;
                rig.legL.position.x = AVATAR_LEG_LEFT_CENTER_OFFSET.x;
                rig.legR.position.x = AVATAR_LEG_RIGHT_CENTER_OFFSET.x;

                if (rig.weaponClass === 'melee') {
                    rig.armR.rotation.x = -walkSwing;
                    rig.armR.rotation.z = MELEE_ARM_SPLAY_Z;
                    rig.armL.rotation.x = walkSwing;
                    rig.armL.rotation.y = 0;
                    rig.armL.rotation.z = -0.04;
                    rig.palmRight.rotation.x = 0;
                } else {
                    var locomotionSwing = sprinting ? (walkSwing * SPRINT_SWING_MULTIPLIER) : walkSwing;
                    var rightArmCarrySwing = -locomotionSwing * GUN_CARRY_SHOULDER_SWAY;
                    var rightWristSwing = locomotionSwing * GUN_CARRY_WRIST_SWAY;
                    var supportPose = getSupportPoseForWeapon(rig.weaponId, rig.aimPitch, locomotionSwing, !!(animState && animState.adsActive));
                    applyFirearmAimPitch(rig, GUN_CARRY_BASE_PITCH, FIREARM_AIM_PITCH_SHOULDER_FACTOR, FIREARM_AIM_PITCH_WRIST_FACTOR);
                    rig.armR.rotation.x += rightArmCarrySwing;
                    rig.armR.rotation.z = -0.08;
                    rig.palmRight.rotation.x += rightWristSwing;
                    if (supportPose) {
                        applyLeftArmPose(rig, supportPose);
                        rig.supportAnchor.getWorldPosition(targetWorld);
                        pointArmAtTarget(
                            rig.armL,
                            targetWorld,
                            rig.upperBodyPivot,
                            supportPose.targetX,
                            supportPose.targetY,
                            supportPose.targetZ
                        );
                    } else {
                        rig.armL.rotation.x = locomotionSwing * SUPPORT_ARM_WALK_SWAY;
                        rig.armL.rotation.y = 0;
                        rig.armL.rotation.z = 0;
                    }
                }
            }

            if (animState && animState.reloading && rig.weaponClass !== 'melee') {
                applyReloadPose(
                    rig,
                    rig.weaponId,
                    animState.reloadPct,
                    rig.upperBodyPivot,
                    animState.reloadPhase,
                    animState.reloadPhasePct,
                    reloadTarget,
                    reloadPoseScratch,
                    pointArmAtTarget
                );
            }
        }
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
                if (rig.weaponId === 'missile' || rig.weaponId === 'plasma') {
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
                if (rig.weaponId === 'missile' || rig.weaponId === 'plasma') {
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
        setAimPitch(0);
        applyAnimState({ speedNorm: 0, sprinting: false, airborne: false }, 0);

        var throwPoseTimer = 0;
        function applyThrowAction(dt) {
            if (throwPoseTimer <= 0) return;
            throwPoseTimer -= dt;
            if (throwPoseTimer < 0) throwPoseTimer = 0;
            var t = Math.min(1, throwPoseTimer * 4);
            rig.armL.rotation.x = -1.4 * t;
            rig.armL.rotation.z = -0.3 * t;
        }

        function startThrowAction() {
            throwPoseTimer = 0.35;
        }

        var firePoseTimer = 0;
        var firePoseDuration = 0.12;
        var firePoseStrength = 1;
        function applyFireAction(dt) {
            if (firePoseTimer <= 0) return;
            firePoseTimer -= dt;
            if (firePoseTimer < 0) firePoseTimer = 0;
            var t = firePoseDuration > 0 ? (firePoseTimer / firePoseDuration) : 0;
            var amount = Math.max(0, Math.min(1, t)) * firePoseStrength;

            rig.armR.rotation.x += 0.11 * amount;
            rig.armR.rotation.z += 0.02 * amount;
            rig.armL.rotation.x += 0.06 * amount;
            rig.armL.rotation.z -= 0.03 * amount;
        }

        function startFireAction(duration, strength) {
            firePoseDuration = Math.max(0.06, Number(duration || 0.12));
            firePoseTimer = firePoseDuration;
            firePoseStrength = Math.max(0.4, Math.min(1.8, Number(strength || 1)));
        }

        var reloadPoseTimer = 0;
        var reloadPoseDuration = 0.6;
        function applyReloadAction(dt) {
            if (reloadPoseTimer <= 0) return false;
            reloadPoseTimer -= dt;
            if (reloadPoseTimer < 0) reloadPoseTimer = 0;
            var elapsed = Math.max(0, reloadPoseDuration - reloadPoseTimer);
            var pct = reloadPoseDuration > 0 ? clamp01(elapsed / reloadPoseDuration) : 1;
            applyReloadPose(rig, rig.weaponId, pct, rig.upperBodyPivot, null, null, reloadTarget, reloadPoseScratch, pointArmAtTarget);
            return true;
        }

        function startReloadAction(duration) {
            reloadPoseDuration = Math.max(0.12, Number(duration || 0.6));
            reloadPoseTimer = reloadPoseDuration;
        }

        var chokeGripTimer = 0;
        function applyChokeGripAction(dt) {
            if (chokeGripTimer <= 0) return;
            chokeGripTimer -= dt;
            if (chokeGripTimer < 0) chokeGripTimer = 0;
            rig.armL.rotation.x = 1.08;
            rig.armL.rotation.y = -0.08;
            rig.armL.rotation.z = -0.42;
        }

        function startChokeGripAction(duration) {
            chokeGripTimer = Math.max(0.1, duration || 1.5);
        }

        var jumpPoseTimer = 0;
        var jumpPoseDuration = 0.18;
        var jumpPoseLegTiltDir = -1;
        function applyJumpAction(dt) {
            if (jumpPoseTimer <= 0) return;
            jumpPoseTimer -= dt;
            if (jumpPoseTimer < 0) jumpPoseTimer = 0;
            var t = jumpPoseDuration > 0 ? (jumpPoseTimer / jumpPoseDuration) : 0;
            var amount = Math.max(0, Math.min(1, t));
            rig.legL.rotation.x += 0.42 * amount * jumpPoseLegTiltDir;
            rig.legR.rotation.x += 0.42 * amount * jumpPoseLegTiltDir;
            rig.armL.rotation.x += 0.12 * amount;
            rig.armR.rotation.x += 0.08 * amount;
        }

        function startJumpAction(duration, options) {
            var opts = options || {};
            jumpPoseDuration = Math.max(0.08, Number(duration || 0.18));
            jumpPoseTimer = jumpPoseDuration;
            jumpPoseLegTiltDir = opts.reverseLegTilt ? 1 : -1;
        }

        function triggerAction(action, options) {
            var kind = String(action || '').toLowerCase();
            var opts = options || {};
            if (kind === 'throw') {
                startThrowAction();
                return true;
            }
            if (kind === 'fire') {
                startFireAction(opts.duration, opts.strength);
                return true;
            }
            if (kind === 'reload') {
                startReloadAction(opts.duration);
                return true;
            }
            if (kind === 'choke_grip') {
                startChokeGripAction(opts.duration);
                return true;
            }
            if (kind === 'jump') {
                startJumpAction(opts.duration, opts);
                return true;
            }
            return false;
        }

        function updateAnimation(dt, animState) {
            animState = animState || {};
            setAimPitch(animState.aimPitch || 0);
            applyAnimState(animState, dt);
            if (animState.reloading) {
                reloadPoseTimer = Math.max(0, reloadPoseTimer - Math.max(0, Number(dt || 0)));
            } else {
                applyReloadAction(dt);
            }
            applyThrowAction(dt);
            applyFireAction(dt);
            applyChokeGripAction(dt);
            applyJumpAction(dt);
        }

        function dispose() {
            if (disposed) return;
            disposed = true;
            disposeSceneResources(root);
        }

        return {
            root: root,
            rig: rig,
            footPlaneOffsetY: FOOT_PLANE_OFFSET_Y,
            setWeapon: setWeapon,
            updateAnimation: updateAnimation,
            getCoreWorldPosition: getCoreWorldPosition,
            getEyeWorldPosition: getEyeWorldPosition,
            getMuzzleWorldPosition: getMuzzleWorldPosition,
            getThrowableOriginWorldPosition: getThrowableOriginWorldPosition,
            setMuzzleVisible: setMuzzleVisible,
            triggerAction: triggerAction,
            getWeaponId: function () { return rig.weaponId; },
            dispose: dispose
        };
    };

    GameAvatarRig._test = {
        getSupportPoseForWeapon: getSupportPoseForWeapon,
        getReloadPoseForWeapon: getReloadPoseForWeapon,
        resolveWeaponEntry: resolveWeaponEntry
    };

    globalThis.__MAYHEM_RUNTIME.GameAvatarRig = GameAvatarRig;
})();
