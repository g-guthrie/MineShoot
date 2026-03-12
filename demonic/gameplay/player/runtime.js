(function () {
    'use strict';

    var demonicRuntime = globalThis.__DEMONIC_RUNTIME = globalThis.__DEMONIC_RUNTIME || {};
    var mayhemRuntime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};

    function create(options) {
        options = options || {};
        var shared = mayhemRuntime.GameShared || {};
        var reconciliationApi = shared.authoritativeReconciliation || null;
        var feel = demonicRuntime.FeelTuning || {
            mouseSensitivity: 0.002,
            pitchLimitDeg: 89,
            movement: {
                jogSpeed: 8,
                runSpeed: 14,
                jumpVelocity: 8.8,
                gravity: 18,
                adsMoveMult: 0.4
            },
            camera: {
                adsSensitivityMult: 0.7,
                sniperScopeSensitivityMult: 0.42
            }
        };
        var movement = feel.movement || {};
        var cameraFeel = feel.camera || {};
        var ADS_MOVE_MULT = Number(movement.adsMoveMult || 0.4);
        var GRAVITY = Number(movement.gravity || 18);
        var MOUSE_SENSITIVITY = Number(feel.mouseSensitivity || 0.002);
        var PITCH_LIMIT = Number(feel.pitchLimitDeg || 89) * (Math.PI / 180);
        var state = {
            x: 25,
            y: 1.6,
            z: 45,
            yaw: 0,
            pitch: 0,
            speed: 0,
            verticalVelocity: 0,
            sprinting: false,
            adsActive: false,
            bobPhase: 0,
            airborne: false,
            moving: false,
            runSpeed: Number(movement.runSpeed || 14),
            jogSpeed: Number(movement.jogSpeed || 8),
            jumpVelocity: Number(movement.jumpVelocity || 8.8)
        };
        var lastReplayAckSeq = 0;

        function inputSnapshot() {
            return options.getInputSnapshot ? options.getInputSnapshot() : {};
        }

        function worldQuery() {
            return options.getWorldQuery ? options.getWorldQuery() : null;
        }

        function combatSnapshot() {
            return options.getCombatSnapshot ? options.getCombatSnapshot() : null;
        }

        function worldReplayOptions() {
            var world = worldQuery() || null;
            var bounds = world && world.getBounds ? world.getBounds() : null;
            return {
                bounds: bounds || { minX: -50, maxX: 50, minZ: -50, maxZ: 50 },
                collisionBoxes: [],
                getGroundHeightAt: function (x, z) {
                    return world && world.getGroundHeightAt ? Number(world.getGroundHeightAt(x, z) || 0) : 0;
                },
                movementLocked: false,
                eyeHeight: 1.6,
                playerHeight: 1.7,
                playerRadius: 0.35,
                epsilon: 0.001,
                fallbackYaw: Number(state.yaw || 0),
                fallbackPitch: Number(state.pitch || 0)
            };
        }

        function syncFromMotionState(nextState) {
            if (!nextState) return;
            state.x = Number(nextState.x || 0);
            state.y = Number(nextState.y || 0);
            state.z = Number(nextState.z || 0);
            state.yaw = Number(nextState.yaw || 0);
            state.pitch = Number(nextState.pitch || 0);
            state.verticalVelocity = Number(nextState.velocityY || 0);
            state.sprinting = !!nextState.sprinting;
            state.airborne = !nextState.isGrounded;
            state.moving = Number(nextState.moveSpeedNorm || 0) > 0.01;
            state.speed = Math.max(0, Number(nextState.moveSpeedNorm || 0)) * Number(state.runSpeed || 0);
        }

        function toReplayInputState(entry) {
            var input = entry && entry.inputState ? entry.inputState : {};
            return {
                forward: !!input.moveForward,
                backward: !!input.moveBackward,
                left: !!input.moveLeft,
                right: !!input.moveRight,
                jump: !!input.jumpQueued,
                sprint: !!input.sprint,
                adsActive: !!input.ads
            };
        }

        return {
            update: function (dt) {
                var input = inputSnapshot();
                var world = worldQuery() || null;
                var combat = combatSnapshot() || {};
                var lookDelta = options.consumeLookDelta ? options.consumeLookDelta() : { x: 0, y: 0 };
                var sniperScope = String(combat.selectedWeaponId || '') === 'sniper' && !!input.ads;
                var sensitivityMult = sniperScope
                    ? Number(cameraFeel.sniperScopeSensitivityMult || 0.42)
                    : (!!input.ads ? Number(cameraFeel.adsSensitivityMult || 0.7) : 1);
                var effectiveSensitivity = MOUSE_SENSITIVITY * sensitivityMult;
                state.yaw -= Number(lookDelta.x || 0) * effectiveSensitivity;
                state.pitch -= Number(lookDelta.y || 0) * effectiveSensitivity;
                state.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, state.pitch));

                var movingForward = !!input.moveForward && !input.moveBackward;
                var movingBackward = !!input.moveBackward && !input.moveForward;
                var movingSide = (!!input.moveLeft || !!input.moveRight);
                var jumpQueued = !!input.jumpQueued;
                state.adsActive = !!input.ads;
                state.sprinting = !!input.sprint && movingForward && !state.adsActive;
                state.moving = !!(movingForward || movingBackward || movingSide);
                var horizontalSpeed = state.moving ? (state.sprinting ? state.runSpeed : state.jogSpeed) : 0;
                if (state.adsActive) horizontalSpeed *= ADS_MOVE_MULT;
                state.speed = horizontalSpeed;
                state.bobPhase += dt * 2.4;

                var forwardX = -Math.sin(state.yaw);
                var forwardZ = -Math.cos(state.yaw);
                var rightX = Math.cos(state.yaw);
                var rightZ = -Math.sin(state.yaw);
                var moveX = 0;
                var moveZ = 0;
                if (movingForward) { moveX += forwardX; moveZ += forwardZ; }
                if (movingBackward) { moveX -= forwardX; moveZ -= forwardZ; }
                if (input.moveLeft) { moveX -= rightX; moveZ -= rightZ; }
                if (input.moveRight) { moveX += rightX; moveZ += rightZ; }
                var length = Math.sqrt(moveX * moveX + moveZ * moveZ);
                if (length > 0.0001) {
                    moveX = (moveX / length) * state.speed * dt;
                    moveZ = (moveZ / length) * state.speed * dt;
                }

                var clamped = world && world.clampHorizontalPosition
                    ? world.clampHorizontalPosition(state.x + moveX, state.z + moveZ)
                    : { x: state.x + moveX, z: state.z + moveZ };
                state.x = Number(clamped.x || 0);
                state.z = Number(clamped.z || 0);

                var ground = (world && world.getGroundHeightAt ? Number(world.getGroundHeightAt(state.x, state.z) || 0) : 0) + 1.6;
                if (jumpQueued && !state.airborne && Math.abs(state.y - ground) < 0.001) {
                    state.verticalVelocity = state.jumpVelocity;
                    state.airborne = true;
                }

                if (state.airborne || state.y > ground) {
                    state.verticalVelocity -= GRAVITY * dt;
                    state.y += state.verticalVelocity * dt;
                    if (state.y <= ground) {
                        state.y = ground;
                        state.verticalVelocity = 0;
                        state.airborne = false;
                    }
                } else {
                    state.y = ground;
                    state.verticalVelocity = 0;
                    state.airborne = false;
                }
            },
            getSnapshot: function () {
                return {
                    x: Number(state.x || 0),
                    y: Number(state.y || 0),
                    z: Number(state.z || 0),
                    yaw: Number(state.yaw || 0),
                    pitch: Number(state.pitch || 0),
                    speed: Number(state.speed || 0),
                    sprinting: !!state.sprinting,
                    adsActive: !!state.adsActive,
                    airborne: !!state.airborne,
                    moving: !!state.moving,
                    verticalVelocity: Number(state.verticalVelocity || 0),
                    bobPhase: Number(state.bobPhase || 0),
                    runSpeed: Number(state.runSpeed || 0),
                    jogSpeed: Number(state.jogSpeed || 0),
                    jumpVelocity: Number(state.jumpVelocity || 0)
                };
            },
            applyAuthoritativeMotion: function (nextState) {
                if (!reconciliationApi || !reconciliationApi.buildMotionStateFromSnapshot) {
                    syncFromMotionState(nextState || null);
                    return;
                }
                syncFromMotionState(reconciliationApi.buildMotionStateFromSnapshot(nextState || {}, worldReplayOptions()));
            },
            reconcileAuthoritativeMotion: function (nextState, reconciliation) {
                if (!reconciliationApi || !reconciliationApi.replayMotionState) {
                    this.applyAuthoritativeMotion(nextState);
                    return;
                }
                var pending = Array.isArray(reconciliation && reconciliation.pendingInputs)
                    ? reconciliation.pendingInputs.map(function (entry) {
                        return {
                            dtMs: Number(entry && entry.dtMs || 0),
                            yaw: Number(entry && entry.yaw || 0),
                            pitch: Number(entry && entry.pitch || 0),
                            inputState: toReplayInputState(entry)
                        };
                    })
                    : [];
                syncFromMotionState(reconciliationApi.replayMotionState(
                    nextState || {},
                    pending,
                    worldReplayOptions()
                ));
                lastReplayAckSeq = Math.max(lastReplayAckSeq, Number(reconciliation && reconciliation.lastAckedSeq || 0));
            },
            getLastReplayAckSeq: function () {
                return Number(lastReplayAckSeq || 0);
            }
        };
    }

    demonicRuntime.GamePlayerRuntime = {
        create: create
    };
})();
