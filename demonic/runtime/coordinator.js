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
        var inputBindingsApi = demonicRuntime.GameInputBindings || null;
        var playerApi = demonicRuntime.GamePlayerRuntime || null;
        var worldApi = demonicRuntime.GameWorldRuntime || null;
        var combatApi = demonicRuntime.GameCombatRuntime || null;
        var abilityApi = demonicRuntime.GameAbilityRuntime || null;
        var cameraApi = demonicRuntime.GameCameraRuntime || null;
        var hudApi = demonicRuntime.GameHudRuntime || null;
        var loopApi = demonicRuntime.GameLoop || null;

        var input = inputApi && inputApi.create ? inputApi.create(context) : null;
        var world = worldApi && worldApi.create ? worldApi.create(context) : null;
        var combat = combatApi && combatApi.create ? combatApi.create({
            context: context.context || {},
            getInputSnapshot: function () {
                return input && input.getSnapshot ? input.getSnapshot() : {};
            }
        }) : null;
        var abilities = abilityApi && abilityApi.create ? abilityApi.create(context) : null;
        var player = playerApi && playerApi.create ? playerApi.create({
            getInputSnapshot: function () {
                return input && input.getSnapshot ? input.getSnapshot() : {};
            },
            consumeLookDelta: function () {
                return input && input.consumeLookDelta ? input.consumeLookDelta() : { x: 0, y: 0 };
            },
            getWorldSnapshot: function () {
                return world && world.getSnapshot ? world.getSnapshot() : null;
            }
        }) : null;
        var camera = cameraApi && cameraApi.create ? cameraApi.create({
            getPlayerSnapshot: function () {
                return player && player.getSnapshot ? player.getSnapshot() : {};
            },
            getCombatSnapshot: function () {
                return combat && combat.getSnapshot ? combat.getSnapshot() : {};
            }
        }) : null;
        var hud = hudApi && hudApi.create ? hudApi.create({
            getCombatSnapshot: function () {
                return combat && combat.getSnapshot ? combat.getSnapshot() : {};
            },
            getAbilitySnapshot: function () {
                return abilities && abilities.getSnapshot ? abilities.getSnapshot() : {};
            },
            getPlayerSnapshot: function () {
                return player && player.getSnapshot ? player.getSnapshot() : {};
            }
        }) : null;
        var bindings = inputBindingsApi && inputBindingsApi.create ? inputBindingsApi.create({
            input: input,
            onFire: function () {
                if (combat && combat.fire && combat.fire()) {
                    if (camera && camera.addFireKick) camera.addFireKick(0.12);
                }
            },
            onEquipWeapon: function (slotIndex) {
                var snapshot = combat && combat.getSnapshot ? combat.getSnapshot() : null;
                var catalog = snapshot && Array.isArray(snapshot.weaponCatalog) ? snapshot.weaponCatalog : [];
                var weaponId = catalog[Number(slotIndex || 0)] || '';
                if (weaponId && combat && combat.setWeapon) {
                    combat.setWeapon(weaponId);
                }
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
                if (abilities && abilities.update) abilities.update(dt);
                if (camera && camera.update) camera.update(dt);
                if (hud && hud.update) hud.update(dt);
                var inputState = input && input.getSnapshot ? input.getSnapshot() : null;
                var combatState = combat && combat.getSnapshot ? combat.getSnapshot() : null;
                if (inputState && inputState.triggerHeld && combatState && combatState.automatic && combatState.canFire) {
                    if (combat && combat.fire && combat.fire()) {
                        if (camera && camera.addFireKick) camera.addFireKick(0.06);
                    }
                }
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
                abilities: abilities && abilities.getSnapshot ? abilities.getSnapshot() : null,
                camera: camera && camera.getSnapshot ? camera.getSnapshot() : null,
                hud: hud && hud.getSnapshot ? hud.getSnapshot() : null
            };
        }

        return {
            start: function () {
                if (bindings && bindings.bind) bindings.bind();
                if (loop && loop.start) loop.start();
                return getSnapshot();
            },
            stop: function () {
                if (loop && loop.stop) loop.stop();
                if (bindings && bindings.unbind) bindings.unbind();
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
            reload: function () {
                return !!(combat && combat.reload && combat.reload());
            },
            triggerAbility: function (slotIndex) {
                return abilities && abilities.trigger ? abilities.trigger(slotIndex) : { ok: false, reason: 'ability_runtime_missing' };
            },
            equipWeapon: function (weaponId) {
                return !!(combat && combat.setWeapon && combat.setWeapon(weaponId));
            },
            cycleWeapon: function (delta) {
                if (combat && combat.cycleWeapon) {
                    combat.cycleWeapon(delta);
                    return getSnapshot();
                }
                return getSnapshot();
            },
            getSnapshot: getSnapshot
        };
    }

    demonicRuntime.GameRuntimeCoordinator = {
        create: create
    };
})();
