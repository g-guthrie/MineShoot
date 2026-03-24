(function () {
    'use strict';

    var runtime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    var GameWeaponPresentation = {};
    var DEG_TO_RAD = Math.PI / 180;
    var UNIVERSAL_RELOAD_PRESENT_END = 0.18;
    var UNIVERSAL_RELOAD_ACTION_END = 0.72;

    function clamp01(value) {
        return Math.max(0, Math.min(1, Number(value || 0)));
    }

    function smoothstep(value) {
        var t = clamp01(value);
        return t * t * (3 - (2 * t));
    }

    function lerpNumber(a, b, t) {
        return Number(a || 0) + ((Number(b || 0) - Number(a || 0)) * clamp01(t));
    }

    function resolveWeaponEntry(weaponId) {
        var visuals = runtime.GameWeaponVisuals || null;
        if (!visuals || !visuals.get) return null;
        return visuals.get(weaponId);
    }

    function weaponDefinition(weaponId) {
        var entry = resolveWeaponEntry(weaponId);
        return entry && entry.platform ? entry.platform : null;
    }

    function resolveReloadState(options, previousState) {
        var opts = options || {};
        var reloadMs = Math.max(0, Number(opts.reloadMs || 0));
        var reloadRemaining = Math.max(0, Number(opts.reloadRemaining || 0));
        var reloadedFlashRemaining = Math.max(0, Number(opts.reloadedFlashRemaining || 0));
        var previous = previousState || null;
        var reloading = reloadMs > 0 && reloadRemaining > 0;
        var reloadPct = reloading ? clamp01(1 - (reloadRemaining / Math.max(1, reloadMs))) : 1;
        var phase = 'ready';
        var phasePct = 1;
        if (reloading) {
            if (reloadPct < UNIVERSAL_RELOAD_PRESENT_END) {
                phase = 'present';
                phasePct = clamp01(reloadPct / UNIVERSAL_RELOAD_PRESENT_END);
            } else if (reloadPct < UNIVERSAL_RELOAD_ACTION_END) {
                phase = 'action';
                phasePct = clamp01((reloadPct - UNIVERSAL_RELOAD_PRESENT_END) / (UNIVERSAL_RELOAD_ACTION_END - UNIVERSAL_RELOAD_PRESENT_END));
            } else {
                phase = 'recover';
                phasePct = clamp01((reloadPct - UNIVERSAL_RELOAD_ACTION_END) / (1 - UNIVERSAL_RELOAD_ACTION_END));
            }
        } else if (reloadedFlashRemaining > 0) {
            phase = 'complete';
            phasePct = 1;
        }
        var previousPhase = previous ? String(previous.phase || '') : '';
        var previousReloading = !!(previous && previous.reloading);
        return {
            reloading: reloading,
            reloadPct: reloadPct,
            phase: phase,
            phasePct: phasePct,
            justStarted: reloading && !previousReloading,
            justCompleted: !reloading && reloadedFlashRemaining > 0 && (previousReloading || previousPhase !== 'complete'),
            reloadRemaining: reloadRemaining,
            reloadedFlashRemaining: reloadedFlashRemaining
        };
    }

    function resetLeftPalm(rig) {
        if (!rig || !rig.palmLeft || !rig.leftPalmNeutral) return;
        rig.palmLeft.position.set(rig.leftPalmNeutral.x, rig.leftPalmNeutral.y, rig.leftPalmNeutral.z);
        rig.palmLeft.rotation.set(0, 0, 0);
    }

    function applyRightAimPose(rig, definition, aimPitch, extraShoulder, extraWrist) {
        if (!rig || !rig.armR || !rig.palmRight) return;
        var mountAim = definition && definition.mount ? definition.mount.aim : null;
        var shoulderFactor = mountAim ? Number(mountAim.shoulderFactor || 0.7) : 0.7;
        var wristFactor = mountAim ? Number(mountAim.wristFactor || 0.3) : 0.3;
        rig.armR.rotation.x = rig.baseRightShoulderPitch + (Number(aimPitch || 0) * shoulderFactor) + Number(extraShoulder || 0);
        rig.palmRight.rotation.x = (Number(aimPitch || 0) * wristFactor) + Number(extraWrist || 0);
    }

    function applyLeftFallbackPose(rig, pose) {
        if (!rig || !rig.armL) return;
        resetLeftPalm(rig);
        rig.armL.rotation.x = Number(pose && pose.armX || 0);
        rig.armL.rotation.y = Number(pose && pose.armY || 0);
        rig.armL.rotation.z = Number(pose && pose.armZ || 0);
        if (rig.palmLeft && pose && pose.palm) {
            rig.palmLeft.position.set(
                Number(pose.palm.x || 0),
                Number(pose.palm.y || 0),
                Number(pose.palm.z || 0)
            );
        }
    }

    function holdProfileForDefinition(definition) {
        var holdClass = definition ? String(definition.holdClass || '') : '';
        if (holdClass === 'oneHandCompact') {
            return {
                gunPitch: 0,
                gunYaw: 0,
                gunRoll: 0,
                armRoll: -0.08,
                walkShoulderSway: 0.05,
                walkWristSway: 0.04,
                leftIdle: { armX: 0, armY: 0, armZ: 0, palm: { x: -0.01, y: -0.84, z: -0.03 } },
                leftSprint: { armX: -0.12, armY: 0, armZ: 0, palm: { x: -0.01, y: -0.84, z: -0.03 } },
                leftAirborne: { armX: 0, armY: 0, armZ: -0.24, palm: { x: -0.01, y: -0.84, z: -0.03 } },
                leftReload: { armX: 1.05, armY: -0.18, armZ: 0.36, palm: { x: -0.04, y: -0.72, z: -0.06 } }
            };
        }
        if (holdClass === 'twoHandPrecision') {
            return {
                gunPitch: -0.01,
                gunYaw: 0,
                gunRoll: -0.02,
                armRoll: -0.08,
                walkShoulderSway: 0.04,
                walkWristSway: 0.025,
                leftIdle: { armX: 0, armY: 0, armZ: 0, palm: { x: -0.01, y: -0.84, z: -0.03 } },
                leftSprint: { armX: -0.22, armY: -0.04, armZ: 0.16, palm: { x: -0.02, y: -0.82, z: -0.01 } },
                leftAirborne: { armX: 0.08, armY: -0.02, armZ: 0.16, palm: { x: -0.01, y: -0.84, z: -0.02 } },
                leftReload: { armX: 0.9, armY: -0.18, armZ: 0.22, palm: { x: -0.03, y: -0.72, z: -0.12 } }
            };
        }
        return {
            gunPitch: 0,
            gunYaw: 0,
            gunRoll: 0,
            armRoll: -0.08,
            walkShoulderSway: 0.045,
            walkWristSway: 0.03,
            leftIdle: { armX: 0, armY: 0, armZ: 0, palm: { x: -0.01, y: -0.84, z: -0.03 } },
            leftSprint: { armX: -0.12, armY: 0, armZ: 0, palm: { x: -0.01, y: -0.84, z: -0.03 } },
            leftAirborne: { armX: 0, armY: 0, armZ: -0.24, palm: { x: -0.01, y: -0.84, z: -0.03 } },
            leftReload: { armX: 1.0, armY: -0.16, armZ: 0.34, palm: { x: -0.04, y: -0.71, z: -0.08 } }
        };
    }

    function applySupportPose(rig, definition, aimPitch, adsActive, pointArmAtTargetFn, modelRoot, sharedVectors) {
        if (!rig || !definition || !rig.armL) return;
        var supportZone = definition.zones ? definition.zones.supportZone : null;
        if (!supportZone) return;
        resetLeftPalm(rig);
        rig.palmLeft.position.set(-0.015, -0.9 - (adsActive ? 0.03 : 0), -0.12 - (adsActive ? 0.02 : 0));
        rig.palmLeft.rotation.set(0.08, -0.03, -0.14);
        if (!pointArmAtTargetFn || !modelRoot || !sharedVectors) return;
        sharedVectors.supportTarget.set(supportZone[0], supportZone[1], supportZone[2]);
        rig.gun.localToWorld(sharedVectors.supportTarget);
        pointArmAtTargetFn(
            rig.armL,
            sharedVectors.supportTarget,
            modelRoot,
            0.06 + (Number(aimPitch || 0) * 0.06) + (adsActive ? 0.02 : 0),
            -0.06,
            -0.08 - (adsActive ? 0.02 : 0)
        );
    }

    function applyBasePose(rig, animState, options) {
        if (!rig || !rig.weaponDefinition || rig.weaponClass === 'melee') return;
        var definition = rig.weaponDefinition;
        var hold = holdProfileForDefinition(definition);
        var speedNorm = clamp01(animState && animState.speedNorm);
        var locomotionSwing = Number(options && options.locomotionSwing || 0);
        var sprinting = !!(animState && animState.sprinting);
        var airborne = !!(animState && animState.airborne);
        var adsActive = !!(animState && animState.adsActive);
        var aimPitch = Number(animState && animState.aimPitch || 0);

        applyRightAimPose(
            rig,
            definition,
            aimPitch,
            (-locomotionSwing * hold.walkShoulderSway * (sprinting ? 1.15 : 1)),
            (locomotionSwing * hold.walkWristSway * (sprinting ? 1.15 : 1))
        );
        rig.armR.rotation.z = hold.armRoll;

        rig.gun.rotation.x += hold.gunPitch + (adsActive ? -0.01 : 0);
        rig.gun.rotation.y += hold.gunYaw + (adsActive ? 0.01 : 0);
        rig.gun.rotation.z += hold.gunRoll;

        if (definition.holdClass === 'twoHandPrecision' && !sprinting && !airborne) {
            applySupportPose(
                rig,
                definition,
                aimPitch,
                adsActive,
                options && options.pointArmAtTarget,
                options && options.modelRoot,
                options && options.sharedVectors
            );
            return;
        }

        if (airborne) {
            applyLeftFallbackPose(rig, hold.leftAirborne);
            if (animState && animState.movingForward && !animState.movingBackward) {
                rig.armL.rotation.x = -0.26;
            } else if (animState && animState.movingBackward && !animState.movingForward) {
                rig.armL.rotation.x = 0.26;
            }
            return;
        }
        if (sprinting) {
            applyLeftFallbackPose(rig, hold.leftSprint);
            rig.armL.rotation.x += locomotionSwing * 0.85;
            return;
        }
        applyLeftFallbackPose(rig, hold.leftIdle);
        rig.armL.rotation.x += locomotionSwing * 0.65;
    }

    function applyReloadOverlay(rig, reloadPct) {
        if (!rig || !rig.weaponDefinition || rig.weaponClass === 'melee') return;
        var definition = rig.weaponDefinition;
        var hold = holdProfileForDefinition(definition);
        var state = resolveReloadState({
            reloadMs: 1,
            reloadRemaining: Math.max(0, 1 - clamp01(reloadPct))
        }, null);
        var phase = String(state.phase || 'ready');
        var phasePct = smoothstep(state.phasePct);
        if (phase === 'ready' || phase === 'complete') return;

        var gunPitch = 0;
        var gunYaw = 0;
        var gunRoll = 0;
        var rightWrist = 0;
        var rightShoulder = 0;
        if (phase === 'present') {
            gunPitch = lerpNumber(0, -0.06, phasePct);
            gunYaw = lerpNumber(0, 0.05, phasePct);
            gunRoll = lerpNumber(0, -0.12, phasePct);
            rightWrist = lerpNumber(0, 0.05, phasePct);
            rightShoulder = lerpNumber(0, 0.05, phasePct);
        } else if (phase === 'action') {
            gunPitch = lerpNumber(-0.06, -0.1, phasePct);
            gunYaw = lerpNumber(0.05, 0.09, phasePct);
            gunRoll = lerpNumber(-0.12, -0.22, phasePct);
            rightWrist = lerpNumber(0.05, 0.12, phasePct);
            rightShoulder = lerpNumber(0.05, 0.08, phasePct);
        } else {
            gunPitch = lerpNumber(-0.1, -0.02, phasePct);
            gunYaw = lerpNumber(0.09, 0.02, phasePct);
            gunRoll = lerpNumber(-0.22, -0.05, phasePct);
            rightWrist = lerpNumber(0.12, 0.02, phasePct);
            rightShoulder = lerpNumber(0.08, 0.02, phasePct);
        }

        rig.gun.rotation.x += gunPitch;
        rig.gun.rotation.y += gunYaw;
        rig.gun.rotation.z += gunRoll;
        rig.armR.rotation.x += rightShoulder;
        rig.palmRight.rotation.x += rightWrist;

        applyLeftFallbackPose(rig, hold.leftReload);
        if (definition.holdClass === 'twoHandPrecision') {
            rig.armL.rotation.y += 0.1;
            rig.armL.rotation.z += 0.06;
        } else {
            rig.armL.rotation.y -= 0.18;
            rig.armL.rotation.z += 0.08;
        }
    }

    GameWeaponPresentation.getWeaponDefinition = weaponDefinition;
    GameWeaponPresentation.resolveReloadState = resolveReloadState;
    GameWeaponPresentation.applyBasePose = applyBasePose;
    GameWeaponPresentation.applyReloadOverlay = applyReloadOverlay;
    GameWeaponPresentation._test = {
        resolveWeaponEntry: resolveWeaponEntry,
        resolveReloadState: resolveReloadState
    };

    runtime.GameWeaponPresentation = GameWeaponPresentation;
})();
