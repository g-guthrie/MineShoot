(function () {
    'use strict';

    var demonicRuntime = globalThis.__DEMONIC_RUNTIME = globalThis.__DEMONIC_RUNTIME || {};

    function create(options) {
        options = options || {};
        var context = {
            mode: options.mode || null,
            context: options.context || {}
        };
        var inputApi = demonicRuntime.GameInputRuntime || null;
        var playerApi = demonicRuntime.GamePlayerRuntime || null;
        var worldApi = demonicRuntime.GameWorldRuntime || null;
        var combatApi = demonicRuntime.GameCombatRuntime || null;
        var cameraApi = demonicRuntime.GameCameraRuntime || null;
        var loopApi = demonicRuntime.GameLoop || null;

        var input = inputApi && inputApi.create ? inputApi.create(context) : null;
        var player = playerApi && playerApi.create ? playerApi.create({
            getInputSnapshot: function () {
                return input && input.getSnapshot ? input.getSnapshot() : {};
            }
        }) : null;
        var world = worldApi && worldApi.create ? worldApi.create(context) : null;
        var combat = combatApi && combatApi.create ? combatApi.create(context) : null;
        var camera = cameraApi && cameraApi.create ? cameraApi.create({
            getPlayerSnapshot: function () {
                return player && player.getSnapshot ? player.getSnapshot() : {};
            },
            getCombatSnapshot: function () {
                return combat && combat.getSnapshot ? combat.getSnapshot() : {};
            }
        }) : null;
        var tickCount = 0;
        var elapsedMs = 0;

        var loop = loopApi && loopApi.create ? loopApi.create({
            onFrame: function (dt) {
                tickCount += 1;
                elapsedMs += dt * 1000;
                if (world && world.update) world.update(dt);
                if (player && player.update) player.update(dt);
                if (combat && combat.update) combat.update(dt);
                if (camera && camera.update) camera.update(dt);
                if (typeof options.onUpdate === 'function') options.onUpdate(getSnapshot());
            }
        }) : null;

        function getSnapshot() {
            return {
                phase: loop && loop.isRunning && loop.isRunning() ? 'running' : 'starting',
                tickCount: Number(tickCount || 0),
                elapsedMs: Number(elapsedMs || 0),
                mode: options.mode ? {
                    id: String(options.mode.id || ''),
                    label: String(options.mode.label || ''),
                    authorityMode: String(options.mode.authorityMode || ''),
                    backendLabel: String(options.mode.backendLabel || '')
                } : null,
                input: input && input.getSnapshot ? input.getSnapshot() : null,
                player: player && player.getSnapshot ? player.getSnapshot() : null,
                world: world && world.getSnapshot ? world.getSnapshot() : null,
                combat: combat && combat.getSnapshot ? combat.getSnapshot() : null,
                camera: camera && camera.getSnapshot ? camera.getSnapshot() : null
            };
        }

        return {
            start: function () {
                if (loop && loop.start) loop.start();
                return getSnapshot();
            },
            stop: function () {
                if (loop && loop.stop) loop.stop();
                return getSnapshot();
            },
            setInputState: function (patch) {
                if (input && input.setState) input.setState(patch || null);
                return getSnapshot();
            },
            fire: function () {
                var fired = combat && combat.fire ? combat.fire() : false;
                if (fired && camera && camera.addFireKick) {
                    camera.addFireKick(0.12);
                }
                return fired;
            },
            equipWeapon: function (weaponId) {
                return !!(combat && combat.setWeapon && combat.setWeapon(weaponId));
            },
            getSnapshot: getSnapshot
        };
    }

    demonicRuntime.GameRuntimeCoordinator = {
        create: create
    };
})();
