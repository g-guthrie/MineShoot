/**
 * gameplay-hud-sync.js - Per-frame HUD/status synchronization for gameplay runtime.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameGameplayHudSync
 */
(function () {
    'use strict';

    var runtime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    var GameGameplayHudSync = {};
    var lastReloadPresentationByWeaponId = {};

    function netView() {
        var net = runtime.GameNet || null;
        return net && net.view ? net.view : null;
    }

    function netEffects() {
        var net = runtime.GameNet || null;
        return net && net.effects ? net.effects : null;
    }

    function remoteEntitiesApi() {
        var net = runtime.GameNet || null;
        return net && net.remoteEntities ? net.remoteEntities : null;
    }

    function networkAuthoritativeNow() {
        var net = runtime.GameNet || null;
        var timingApi = net && net.timing ? net.timing : null;
        var stamp = timingApi && timingApi.getAuthoritativeNow
            ? Number(timingApi.getAuthoritativeNow() || 0)
            : 0;
        return stamp > 0 ? stamp : Date.now();
    }

    function combatTimings() {
        var shared = runtime.GameShared || null;
        return shared && shared.getCombatTimings
            ? (shared.getCombatTimings() || {})
            : ((shared && shared.combatTimings) || {});
    }

    function currentSelfCombatState(nowMs) {
        var combat = runtime.GamePlayerCombat || null;
        if (!combat) return null;
        if (combat.getState) {
            return combat.getState(nowMs);
        }
        return {
            hp: combat.getHP ? combat.getHP() : 0,
            hpMax: combat.getMaxHP ? combat.getMaxHP() : 1,
            armor: combat.getArmor ? combat.getArmor() : 0,
            armorMax: combat.getArmorMax ? combat.getArmorMax() : 1,
            alive: combat.isAlive ? combat.isAlive() : true,
            invulnerable: combat.isInvulnerable ? combat.isInvulnerable() : false,
            spawnShieldUntil: combat.isInvulnerable && combat.isInvulnerable()
                ? (Number(nowMs || Date.now()) + Math.max(0, Number(combatTimings().PLAYER_SPAWN_SHIELD_MS || 0)))
                : 0,
            respawn: combat.getRespawnState ? combat.getRespawnState(nowMs) : null
        };
    }

    function syncSelfCombatHud(nowMs) {
        var combatState = currentSelfCombatState(nowMs);
        if (!combatState || !runtime.GameUI) return combatState;
        if (runtime.GameUI.updateHealth) {
            runtime.GameUI.updateHealth(combatState.hp, combatState.hpMax);
        }
        if (runtime.GameUI.updateArmor) {
            runtime.GameUI.updateArmor(combatState.armor, combatState.armorMax);
        }
        if (runtime.GameUI.updateExtraLifeProgress && runtime.GamePlayerCombat && runtime.GamePlayerCombat.getExtraLifeProgressPct) {
            runtime.GameUI.updateExtraLifeProgress(runtime.GamePlayerCombat.getExtraLifeProgressPct());
        }
        return combatState;
    }

    function currentWeaponState(nowMs) {
        var combat = runtime.GamePlayerCombat || null;
        if (combat && combat.getCurrentWeaponState) {
            return combat.getCurrentWeaponState(nowMs);
        }
        if (runtime.GameHitscan && runtime.GameHitscan.getCurrentWeapon) {
            return runtime.GameHitscan.getCurrentWeapon();
        }
        return null;
    }

    function currentWeaponHudState(nowMs) {
        var combat = runtime.GamePlayerCombat || null;
        if (combat && combat.getWeaponHudState) {
            return combat.getWeaponHudState(nowMs);
        }
        if (runtime.GameHitscan && runtime.GameHitscan.getHudState) {
            return runtime.GameHitscan.getHudState();
        }
        return null;
    }

    function currentWeaponLoadout() {
        var combat = runtime.GamePlayerCombat || null;
        if (combat && combat.getWeaponLoadout) {
            var loadout = combat.getWeaponLoadout();
            if (loadout && Array.isArray(loadout.slots) && loadout.slots.length) {
                return loadout.slots.slice();
            }
        }
        if (runtime.GameHitscan && runtime.GameHitscan.getWeaponOrder) {
            return runtime.GameHitscan.getWeaponOrder();
        }
        return [];
    }

    function weaponPresentationFor(weaponId) {
        var shared = runtime.GameShared || null;
        return shared && shared.getWeaponPresentation ? shared.getWeaponPresentation(weaponId) : null;
    }

    function resolveReloadPresentationState(weaponState, previousState) {
        if (!weaponState) {
            return {
                reloading: false,
                reloadPct: 1,
                phase: 'ready',
                phasePct: 1,
                justStarted: false,
                justCompleted: false
            };
        }
        var shared = runtime.GameShared || null;
        var weaponPresentationApi = runtime.GameWeaponPresentation || null;
        if (weaponPresentationApi && weaponPresentationApi.resolveReloadState) {
            return weaponPresentationApi.resolveReloadState({
                reloadMs: Number(weaponState.reloadMs || 0),
                reloadRemaining: Number(weaponState.reloadRemaining || 0),
                reloadedFlashRemaining: Number(weaponState.reloadedFlashRemaining || 0)
            }, previousState || null);
        }
        if (shared && shared.resolveReloadPresentationState) {
            return shared.resolveReloadPresentationState({
                reloadMs: Number(weaponState.reloadMs || 0),
                reloadRemaining: Number(weaponState.reloadRemaining || 0),
                reloadedFlashRemaining: Number(weaponState.reloadedFlashRemaining || 0),
                reload: weaponPresentationFor(weaponState.id) ? weaponPresentationFor(weaponState.id).reload : null
            }, previousState || null);
        }
        var reloading = !!weaponState.reloading;
        var previous = previousState || null;
        return {
            reloading: reloading,
            reloadPct: reloading && Number(weaponState.reloadMs || 0) > 0
                ? Math.max(0, Math.min(1, 1 - (Number(weaponState.reloadRemaining || 0) / Math.max(1, Number(weaponState.reloadMs || 1)))))
                : 1,
            phase: reloading ? String(weaponState.reloadPhase || 'action') : (Number(weaponState.reloadedFlashRemaining || 0) > 0 ? 'complete' : 'ready'),
            phasePct: Math.max(0, Math.min(1, Number(weaponState.reloadPhasePct != null ? weaponState.reloadPhasePct : (reloading ? 0.5 : 1)))),
            justStarted: reloading && !(previous && previous.reloading),
            justCompleted: !reloading && Number(weaponState.reloadedFlashRemaining || 0) > 0 && !!(previous && previous.reloading)
        };
    }

    function syncReloadFeedback(weaponState, nowMs) {
        var combat = runtime.GamePlayerCombat || null;
        var loadout = currentWeaponLoadout();
        var nextReloadPresentationByWeaponId = {};
        for (var i = 0; i < loadout.length; i++) {
            var weaponId = String(loadout[i] || '');
            if (!weaponId) continue;
            var state = null;
            if (combat && combat.getWeaponState) {
                state = combat.getWeaponState(weaponId, nowMs);
            } else if (weaponState && weaponState.id === weaponId) {
                state = weaponState;
            }
            if (!state) continue;
            nextReloadPresentationByWeaponId[weaponId] = resolveReloadPresentationState(
                state,
                lastReloadPresentationByWeaponId[weaponId] || null
            );
        }
        if (weaponState && weaponState.id && !nextReloadPresentationByWeaponId[weaponState.id]) {
            nextReloadPresentationByWeaponId[weaponState.id] = resolveReloadPresentationState(
                weaponState,
                lastReloadPresentationByWeaponId[weaponState.id] || null
            );
        }

        var activeWeaponId = weaponState && weaponState.id ? String(weaponState.id || '') : '';
        var activeReloadPresentation = activeWeaponId ? nextReloadPresentationByWeaponId[activeWeaponId] : null;
        var previousActiveReloadPresentation = activeWeaponId ? (lastReloadPresentationByWeaponId[activeWeaponId] || null) : null;
        if (runtime.GameAudio && runtime.GameAudio.play && activeWeaponId && activeReloadPresentation) {
            var presentation = weaponPresentationFor(activeWeaponId);
            var audioIds = presentation && presentation.reload && presentation.reload.audio ? presentation.reload.audio : null;
            if (activeReloadPresentation.justStarted) {
                runtime.GameAudio.play('reload', {
                    weapon: activeWeaponId,
                    cue: 'start',
                    cueId: audioIds ? audioIds.start : ''
                });
            } else if (
                activeReloadPresentation.reloading &&
                (activeReloadPresentation.phase === 'action' || activeReloadPresentation.phase === 'manipulate') &&
                (!previousActiveReloadPresentation || (previousActiveReloadPresentation.phase !== 'action' && previousActiveReloadPresentation.phase !== 'manipulate'))
            ) {
                runtime.GameAudio.play('reload', {
                    weapon: activeWeaponId,
                    cue: 'manipulate',
                    cueId: audioIds ? audioIds.manipulate : ''
                });
            } else if (activeReloadPresentation.justCompleted) {
                runtime.GameAudio.play('reload', {
                    weapon: activeWeaponId,
                    cue: 'complete',
                    cueId: audioIds ? audioIds.complete : ''
                });
            }
        }

        lastReloadPresentationByWeaponId = nextReloadPresentationByWeaponId;
    }

    function currentThrowableDebugState(camera, debugVisualsOn) {
        if (!debugVisualsOn) return null;
        if (runtime.GameThrowables && runtime.GameThrowables.getDebugState) {
            return runtime.GameThrowables.getDebugState(camera);
        }
        return null;
    }

    function screenDiameterForWorldRadius(camera, worldRadius, worldDistance) {
        if (!camera) return 0;
        var radius = Math.max(0, Number(worldRadius || 0));
        var distance = Math.max(0.001, Number(worldDistance || 0));
        if (radius <= 0.0001) return 0;
        var vFovRad = Number(camera.fov || 60) * Math.PI / 180;
        var tanV = Math.tan(vFovRad * 0.5);
        if (!isFinite(tanV) || tanV <= 0.000001) return 0;
        return Math.max(0, (radius * window.innerHeight) / (distance * tanV));
    }

    function buildWeaponDebugState(weaponState) {
        if (!weaponState) return null;
        var hitscan = runtime.GameHitscan || null;
        var spreadRadiusPx = (hitscan && hitscan.getSpreadRadiusPx && weaponState.id)
            ? Number(hitscan.getSpreadRadiusPx(weaponState.id) || 0)
            : 0;
        var reticleSpec = (hitscan && hitscan.getReticleSpec && weaponState.id)
            ? hitscan.getReticleSpec(weaponState.id)
            : null;
        return {
            label: weaponState.name || weaponState.id || '--',
            spreadRadiusPx: spreadRadiusPx,
            reticleKind: reticleSpec && reticleSpec.type === 'circle' ? 'circle' : 'crosshair'
        };
    }

    GameGameplayHudSync.update = function (options) {
        options = options || {};

        var camera = options.camera || null;
        var dt = Number(options.dt || 0);
        var multiplayerMode = !!options.multiplayerMode;
        var debugVisualsOn = !!options.debugVisualsOn;
        var stamp = Date.now();
        var selfCombatState = syncSelfCombatHud(stamp);
        var weaponState = currentWeaponState(stamp);
        var weaponHudState = currentWeaponHudState(stamp);

        if (runtime.GamePlayer && runtime.GamePlayer.getEquippedWeaponId && runtime.GamePlayer.setWeaponModel && weaponState) {
            if (runtime.GamePlayer.getEquippedWeaponId() !== weaponState.id) {
                runtime.GamePlayer.setWeaponModel(weaponState.id);
            }
        }
        if (runtime.GameUI && runtime.GameUI.updateWeaponInfo && weaponState) {
            runtime.GameUI.updateWeaponInfo(weaponState);
        }
        if (runtime.GameUI && runtime.GameUI.updateCooldown && weaponHudState) {
            runtime.GameUI.updateCooldown(weaponHudState);
        }
        syncReloadFeedback(weaponState, stamp);
        if (runtime.GameUI && runtime.GameUI.updateDamageEffects) {
            runtime.GameUI.updateDamageEffects(dt);
        }
        if (runtime.GameUI && runtime.GameUI.updateThrowableInfo && runtime.GameThrowables && runtime.GameThrowables.getState) {
            runtime.GameUI.updateThrowableInfo(runtime.GameThrowables.getState());
        }

        if (!multiplayerMode && runtime.GamePlayer && runtime.GamePlayer.setStatusState) {
            runtime.GamePlayer.setStatusState({
                spawnShieldUntil: Number(selfCombatState && selfCombatState.spawnShieldUntil || 0)
            });
        }

        var throwableDebugState = currentThrowableDebugState(camera, debugVisualsOn);

        if (runtime.GameUI && runtime.GameUI.updatePlasmaState) {
            var plasmaDebugState = debugVisualsOn && throwableDebugState
                ? throwableDebugState.plasma
                : null;
            runtime.GameUI.updatePlasmaState({
                visible: !!plasmaDebugState,
                ringDiametersPx: plasmaDebugState
                    ? [
                        screenDiameterForWorldRadius(camera, plasmaDebugState.catchRadius, 20)
                    ]
                    : [],
                catchRadius: plasmaDebugState ? plasmaDebugState.catchRadius : 0,
                stickDelaySec: plasmaDebugState ? plasmaDebugState.stickDelaySec : 0,
                tone: 'throwable'
            });
        }
    };

    GameGameplayHudSync.syncSelfCombatHud = syncSelfCombatHud;

    runtime.GameGameplayHudSync = GameGameplayHudSync;
})();
