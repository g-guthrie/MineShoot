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
        var awarenessApi = demonicRuntime.GameAwarenessRuntime || null;
        var playerApi = demonicRuntime.GamePlayerRuntime || null;
        var worldApi = demonicRuntime.GameWorldRuntime || null;
        var netApi = demonicRuntime.GameNetRuntime || null;
        var weaponFeedbackApi = demonicRuntime.GameWeaponFeedbackRuntime || null;
        var combatApi = demonicRuntime.GameCombatRuntime || null;
        var abilityApi = demonicRuntime.GameAbilityRuntime || null;
        var cameraApi = demonicRuntime.GameCameraRuntime || null;
        var damageApi = demonicRuntime.GameDamageFeedbackRuntime || null;
        var hudApi = demonicRuntime.GameHudRuntime || null;
        var presentationApi = demonicRuntime.GamePresentationRuntime || null;
        var actorApi = demonicRuntime.GameActorRuntime || null;
        var sceneApi = demonicRuntime.GameSceneRuntime || null;
        var displaySettings = demonicRuntime.DisplaySettings || null;
        var loopApi = demonicRuntime.GameLoop || null;

        var input = inputApi && inputApi.create ? inputApi.create(context) : null;
        var world = worldApi && worldApi.create ? worldApi.create(context) : null;
        var net = netApi && netApi.create ? netApi.create(context) : null;
        var weaponFeedback = weaponFeedbackApi && weaponFeedbackApi.create ? weaponFeedbackApi.create(context) : null;
        var awareness = awarenessApi && awarenessApi.create ? awarenessApi.create({
            getPlayerSnapshot: function () {
                return player && player.getSnapshot ? player.getSnapshot() : {};
            },
            getWorldSnapshot: function () {
                return world && world.getSnapshot ? world.getSnapshot() : {};
            }
        }) : null;
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
            getWorldQuery: function () {
                return world && world.getQuery ? world.getQuery() : null;
            },
            getCombatSnapshot: function () {
                return combat && combat.getSnapshot ? combat.getSnapshot() : null;
            }
        }) : null;
        var camera = cameraApi && cameraApi.create ? cameraApi.create({
            getPlayerSnapshot: function () {
                return player && player.getSnapshot ? player.getSnapshot() : {};
            },
            getCombatSnapshot: function () {
                return combat && combat.getSnapshot ? combat.getSnapshot() : {};
            },
            getWeaponFeedbackSnapshot: function () {
                return weaponFeedback && weaponFeedback.getSnapshot ? weaponFeedback.getSnapshot() : {};
            }
        }) : null;
        var damageFeedback = damageApi && damageApi.create ? damageApi.create({
            getPlayerSnapshot: function () {
                return player && player.getSnapshot ? player.getSnapshot() : {};
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
            },
            getAwarenessSnapshot: function () {
                return awareness && awareness.getSnapshot ? awareness.getSnapshot() : {};
            },
            getDamageSnapshot: function () {
                return damageFeedback && damageFeedback.getSnapshot ? damageFeedback.getSnapshot() : {};
            }
        }) : null;
        var presentation = presentationApi && presentationApi.create ? presentationApi.create({
            getPlayerSnapshot: function () {
                return player && player.getSnapshot ? player.getSnapshot() : {};
            },
            getCombatSnapshot: function () {
                return combat && combat.getSnapshot ? combat.getSnapshot() : {};
            },
            getAbilitySnapshot: function () {
                return abilities && abilities.getSnapshot ? abilities.getSnapshot() : {};
            },
            getCameraSnapshot: function () {
                return camera && camera.getSnapshot ? camera.getSnapshot() : {};
            },
            getWeaponFeedbackSnapshot: function () {
                return weaponFeedback && weaponFeedback.getSnapshot ? weaponFeedback.getSnapshot() : {};
            }
        }) : null;
        var actor = actorApi && actorApi.create ? actorApi.create({
            getPlayerSnapshot: function () {
                return player && player.getSnapshot ? player.getSnapshot() : {};
            },
            getCombatSnapshot: function () {
                return combat && combat.getSnapshot ? combat.getSnapshot() : {};
            },
            getPresentationSnapshot: function () {
                return presentation && presentation.getSnapshot ? presentation.getSnapshot() : {};
            }
        }) : null;
        var scene = sceneApi && sceneApi.create ? sceneApi.create({
            host: options.sceneHost || null,
            getActorSnapshot: function () {
                return actor && actor.getSnapshot ? actor.getSnapshot() : {};
            },
            getPlayerSnapshot: function () {
                return player && player.getSnapshot ? player.getSnapshot() : {};
            },
            getCameraSnapshot: function () {
                return camera && camera.getSnapshot ? camera.getSnapshot() : {};
            },
            getAbilitySnapshot: function () {
                return abilities && abilities.getSnapshot ? abilities.getSnapshot() : {};
            },
            getHudSnapshot: function () {
                return hud && hud.getSnapshot ? hud.getSnapshot() : {};
            },
            getPresentationSnapshot: function () {
                return presentation && presentation.getSnapshot ? presentation.getSnapshot() : {};
            },
            getNetSnapshot: function () {
                return net && net.getSnapshot ? net.getSnapshot() : {};
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
            getTargetFps: function () {
                return displaySettings && displaySettings.getTargetFps ? displaySettings.getTargetFps() : 60;
            },
            onFrame: function (dt) {
                tickCount += 1;
                elapsedMs += dt * 1000;
                if (world && world.update) world.update(dt);
                if (player && player.update) player.update(dt);
                if (awareness && awareness.update) awareness.update(dt);
                if (combat && combat.update) combat.update(dt);
                if (abilities && abilities.update) abilities.update(dt);
                if (weaponFeedback && weaponFeedback.update) weaponFeedback.update(dt);
                if (camera && camera.update) camera.update(dt);
                if (damageFeedback && damageFeedback.update) damageFeedback.update(dt);
                if (hud && hud.update) hud.update(dt);
                if (presentation && presentation.update) presentation.update(dt);
                if (actor && actor.update) actor.update(dt);
                if (scene && scene.update) scene.update(dt);
                var inputState = input && input.getSnapshot ? input.getSnapshot() : null;
                var combatState = combat && combat.getSnapshot ? combat.getSnapshot() : null;
                if (inputState && inputState.triggerHeld && combatState && combatState.automatic && combatState.canFire) {
                    if (combat && combat.fire && combat.fire()) {
                        if (camera && camera.addFireKick) camera.addFireKick(0.06);
                    }
                }
                var playerState = player && player.getSnapshot ? player.getSnapshot() : null;
                combatState = combat && combat.getSnapshot ? combat.getSnapshot() : combatState;
                if (net && net.captureLocalIntent) {
                    net.captureLocalIntent({
                        inputState: inputState || {},
                        yaw: Number(playerState && playerState.yaw || 0),
                        pitch: Number(playerState && playerState.pitch || 0),
                        weaponId: String(combatState && combatState.selectedWeaponId || '')
                    });
                }
                if (net && net.setLocalSelfState) {
                    net.setLocalSelfState({
                        x: Number(playerState && playerState.x || 0),
                        y: Number(playerState && playerState.y || 0),
                        z: Number(playerState && playerState.z || 0),
                        yaw: Number(playerState && playerState.yaw || 0),
                        pitch: Number(playerState && playerState.pitch || 0),
                        weaponId: String(combatState && combatState.selectedWeaponId || ''),
                        alive: true
                    });
                }
                if (net && net.update) net.update(dt);
                if (typeof options.onUpdate === 'function') options.onUpdate(getSnapshot());
            }
        }) : null;

        function refreshDerivedState() {
            if (camera && camera.update) camera.update(0);
            if (hud && hud.update) hud.update(0);
            if (presentation && presentation.update) presentation.update(0);
            if (actor && actor.update) actor.update(0);
            if (scene && scene.update) scene.update(0);
            if (typeof options.onUpdate === 'function') options.onUpdate(getSnapshot());
        }

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
                net: net && net.getSnapshot ? net.getSnapshot() : null,
                awareness: awareness && awareness.getSnapshot ? awareness.getSnapshot() : null,
                combat: combat && combat.getSnapshot ? combat.getSnapshot() : null,
                abilities: abilities && abilities.getSnapshot ? abilities.getSnapshot() : null,
                weaponFeedback: weaponFeedback && weaponFeedback.getSnapshot ? weaponFeedback.getSnapshot() : null,
                camera: camera && camera.getSnapshot ? camera.getSnapshot() : null,
                damage: damageFeedback && damageFeedback.getSnapshot ? damageFeedback.getSnapshot() : null,
                hud: hud && hud.getSnapshot ? hud.getSnapshot() : null,
                presentation: presentation && presentation.getSnapshot ? presentation.getSnapshot() : null,
                actor: actor && actor.getSnapshot ? actor.getSnapshot() : null,
                display: {
                    targetFps: displaySettings && displaySettings.getTargetFps ? displaySettings.getTargetFps() : 60,
                    fpsLabel: displaySettings && displaySettings.fpsLabel
                        ? displaySettings.fpsLabel(displaySettings.getTargetFps ? displaySettings.getTargetFps() : 60)
                        : '60 FPS'
                }
            };
        }

        return {
            start: function () {
                if (bindings && bindings.bind) bindings.bind();
                if (loop && loop.start) loop.start();
                refreshDerivedState();
                return getSnapshot();
            },
            stop: function () {
                if (loop && loop.stop) loop.stop();
                if (bindings && bindings.unbind) bindings.unbind();
                if (net && net.destroy) net.destroy();
                if (scene && scene.destroy) scene.destroy();
                return getSnapshot();
            },
            setInputState: function (patch) {
                if (input && input.setState) input.setState(patch || null);
                refreshDerivedState();
                return getSnapshot();
            },
            fire: function () {
                var fired = combat && combat.fire ? combat.fire() : false;
                if (fired && weaponFeedback && weaponFeedback.triggerFire) {
                    var cameraState = camera && camera.getSnapshot ? camera.getSnapshot() : { scopeBlend: 0 };
                    weaponFeedback.triggerFire(Number(cameraState.scopeBlend || 0));
                }
                refreshDerivedState();
                return fired;
            },
            reload: function () {
                var ok = !!(combat && combat.reload && combat.reload());
                refreshDerivedState();
                return ok;
            },
            triggerAbility: function (slotIndex) {
                var result = abilities && abilities.trigger ? abilities.trigger(slotIndex) : { ok: false, reason: 'ability_runtime_missing' };
                refreshDerivedState();
                return result;
            },
            triggerDamageFeedback: function (sourcePos, damage) {
                if (damageFeedback && damageFeedback.trigger) {
                    damageFeedback.trigger(sourcePos, damage);
                }
                refreshDerivedState();
                return getSnapshot();
            },
            equipWeapon: function (weaponId) {
                var ok = !!(combat && combat.setWeapon && combat.setWeapon(weaponId));
                if (ok && weaponFeedback && weaponFeedback.setWeapon) {
                    weaponFeedback.setWeapon(weaponId);
                }
                refreshDerivedState();
                return ok;
            },
            cycleWeapon: function (delta) {
                if (combat && combat.cycleWeapon) {
                    var nextWeaponId = combat.cycleWeapon(delta);
                    if (weaponFeedback && weaponFeedback.setWeapon) {
                        weaponFeedback.setWeapon(nextWeaponId);
                    }
                    refreshDerivedState();
                    return getSnapshot();
                }
                refreshDerivedState();
                return getSnapshot();
            },
            getSnapshot: getSnapshot
        };
    }

    demonicRuntime.GameRuntimeCoordinator = {
        create: create
    };
})();
