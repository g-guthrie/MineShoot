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
        var state = {
            x: 25,
            y: 1.6,
            z: 45,
            yaw: 0,
            pitch: 0,
            speed: 0,
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

        return {
            update: function (dt) {
                var input = inputSnapshot();
                var movingForward = !!input.moveForward && !input.moveBackward;
                var movingBackward = !!input.moveBackward && !input.moveForward;
                var movingSide = (!!input.moveLeft || !!input.moveRight);
                state.adsActive = !!input.ads;
                state.sprinting = !!input.sprint && movingForward && !state.adsActive;
                state.moving = !!(movingForward || movingBackward || movingSide);
                state.airborne = !!input.jumpQueued;
                state.speed = state.moving ? (state.sprinting ? state.runSpeed : state.jogSpeed) : 0;
                state.bobPhase += dt * 2.4;
                if (movingForward) state.z -= state.speed * dt;
                if (movingBackward) state.z += state.speed * dt * 0.72;
                if (input.moveLeft) state.x -= state.speed * dt * 0.84;
                if (input.moveRight) state.x += state.speed * dt * 0.84;
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
