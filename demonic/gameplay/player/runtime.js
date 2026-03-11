(function () {
    'use strict';

    var demonicRuntime = globalThis.__DEMONIC_RUNTIME = globalThis.__DEMONIC_RUNTIME || {};
    var mayhemRuntime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};

    function create(options) {
        options = options || {};
        var sharedGameplay = mayhemRuntime.GameShared && mayhemRuntime.GameShared.gameplayTuning
            ? mayhemRuntime.GameShared.gameplayTuning
            : {};
        var movement = sharedGameplay.movement || {};
        var ADS_MOVE_MULT = Number(movement.adsMoveMult || 0.4);
        var GRAVITY = Number(movement.gravity || 18);
        var MOUSE_SENSITIVITY = 0.002;
        var PITCH_LIMIT = 89 * (Math.PI / 180);
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

        function inputSnapshot() {
            return options.getInputSnapshot ? options.getInputSnapshot() : {};
        }

        function worldSnapshot() {
            return options.getWorldSnapshot ? options.getWorldSnapshot() : null;
        }

        return {
            update: function (dt) {
                var input = inputSnapshot();
                var world = worldSnapshot() || { bounds: { min: 0, max: 100 }, groundHeight: 0 };
                var lookDelta = options.consumeLookDelta ? options.consumeLookDelta() : { x: 0, y: 0 };
                state.yaw -= Number(lookDelta.x || 0) * MOUSE_SENSITIVITY;
                state.pitch -= Number(lookDelta.y || 0) * MOUSE_SENSITIVITY;
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

                var bounds = world.bounds || {};
                var minX = Number(bounds.minX != null ? bounds.minX : bounds.min || 0);
                var maxX = Number(bounds.maxX != null ? bounds.maxX : bounds.max || 100);
                var minZ = Number(bounds.minZ != null ? bounds.minZ : bounds.min || 0);
                var maxZ = Number(bounds.maxZ != null ? bounds.maxZ : bounds.max || 100);
                state.x = Math.max(minX, Math.min(maxX, state.x + moveX));
                state.z = Math.max(minZ, Math.min(maxZ, state.z + moveZ));

                var ground = Number(world.groundHeight || 0) + 1.6;
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
            }
        };
    }

    demonicRuntime.GamePlayerRuntime = {
        create: create
    };
})();
