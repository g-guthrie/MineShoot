/**
 * gameplay-hud-sync.js - Per-frame HUD/status synchronization for gameplay runtime.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameGameplayHudSync
 */
(function () {
    'use strict';

    var runtime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    var GameGameplayHudSync = {};

    function currentAbilityLoadoutState(multiplayerMode) {
        if (multiplayerMode && runtime.GameNet && runtime.GameNet.getSelfAbilityState) {
            var netState = runtime.GameNet.getSelfAbilityState();
            return netState && netState.abilityLoadout ? netState.abilityLoadout : null;
        }
        if (runtime.GameAbilities && runtime.GameAbilities.getLoadout) {
            return runtime.GameAbilities.getLoadout();
        }
        return null;
    }

    function currentAbilityCatalogMap() {
        var shared = runtime.GameShared && runtime.GameShared.gameplayTuning;
        return shared && shared.abilityCatalog ? shared.abilityCatalog : {};
    }

    function buildAbilityDebugText(loadout) {
        if (!loadout) return '';
        var catalog = currentAbilityCatalogMap();
        var lines = [];

        function addSlot(label, abilityId) {
            if (!abilityId) return;
            var def = catalog[abilityId] || null;
            lines.push(label + ' ' + String((def && def.name) || abilityId).toUpperCase());
            lines.push(String((def && def.debugSummary) || 'No dev overlay summary.'));
            if (def && Array.isArray(def.tunableParams) && def.tunableParams.length) {
                lines.push('tune: ' + def.tunableParams.join(', '));
            }
            lines.push('');
        }

        addSlot('R', loadout.slot1);
        addSlot('F', loadout.slot2);
        return lines.join('\n').trim();
    }

    function deadeyeDebugRectSizePx(camera, minDot) {
        if (!camera || !isFinite(minDot)) return null;
        var clampedDot = Math.max(-1, Math.min(1, Number(minDot)));
        var halfAngleRad = Math.acos(clampedDot);
        var vFovRad = Number(camera.fov || 60) * Math.PI / 180;
        var tanHalf = Math.tan(halfAngleRad);
        var tanV = Math.tan(vFovRad * 0.5);
        if (!isFinite(tanHalf) || !isFinite(tanV) || tanV <= 0.000001) return null;
        var aspect = Math.max(0.0001, Number(camera.aspect || (window.innerWidth / Math.max(1, window.innerHeight))));
        var xNdc = tanHalf / (tanV * aspect);
        var yNdc = tanHalf / tanV;
        return {
            width: Math.max(60, Math.min(window.innerWidth * 0.86, xNdc * window.innerWidth)),
            height: Math.max(60, Math.min(window.innerHeight * 0.86, yNdc * window.innerHeight))
        };
    }

    function currentHealState(multiplayerMode) {
        if (multiplayerMode && runtime.GameNet && runtime.GameNet.getSelfAbilityState) {
            var netSelfAbility = runtime.GameNet.getSelfAbilityState();
            return netSelfAbility ? netSelfAbility.healState : null;
        }
        if (runtime.GameAbilities && runtime.GameAbilities.getHealState) {
            return runtime.GameAbilities.getHealState();
        }
        return null;
    }

    function currentChokeCasterState(multiplayerMode) {
        if (multiplayerMode && runtime.GameNet && runtime.GameNet.getSelfAbilityState) {
            var netAbility = runtime.GameNet.getSelfAbilityState();
            return netAbility ? netAbility.chokeState : null;
        }
        if (runtime.GameAbilities && runtime.GameAbilities.getChokeState) {
            return runtime.GameAbilities.getChokeState();
        }
        return null;
    }

    function currentDeadeyeUiState(multiplayerMode) {
        var abilityBoundary = runtime.GameAbilityBoundary || null;
        if (multiplayerMode && runtime.GameNet && runtime.GameNet.getSelfAbilityState) {
            var abilState = runtime.GameNet.getSelfAbilityState();
            if (abilState && abilState.deadeyeState && abilState.deadeyeState.maxLocks > 0) {
                return abilityBoundary && abilityBoundary.buildNetworkDeadeyeUiState
                    ? abilityBoundary.buildNetworkDeadeyeUiState(
                        abilState.deadeyeState,
                        function (targetId) {
                            return runtime.GameNet.damagePointForEntityId
                                ? runtime.GameNet.damagePointForEntityId(targetId)
                                : (
                                    runtime.GameNet.getEntityMarkerWorldPos
                                        ? runtime.GameNet.getEntityMarkerWorldPos(targetId)
                                        : null
                                );
                        },
                        Date.now()
                    )
                    : null;
            }
            return null;
        }
        return runtime.GameAbilities && runtime.GameAbilities.getDeadeyeState
            ? runtime.GameAbilities.getDeadeyeState()
            : null;
    }

    function syncDeadeyeHighlights(multiplayerMode, deadeyeState) {
        var markMap = {};
        if (deadeyeState && Array.isArray(deadeyeState.targets)) {
            for (var i = 0; i < deadeyeState.targets.length; i++) {
                var target = deadeyeState.targets[i];
                if (!target || !target.targetId) continue;
                markMap[String(target.targetId)] = {
                    locked: !!target.locked,
                    progress: Number(target.progress || 0)
                };
            }
        }

        if (multiplayerMode) {
            if (runtime.GameNetEntities && runtime.GameNetEntities.setDeadeyeHighlights) {
                runtime.GameNetEntities.setDeadeyeHighlights(markMap);
            }
            return;
        }

        if (runtime.GameEnemy && runtime.GameEnemy.setDeadeyeHighlights) {
            runtime.GameEnemy.setDeadeyeHighlights(markMap);
        }
    }

    GameGameplayHudSync.update = function (options) {
        options = options || {};

        var camera = options.camera || null;
        var dt = Number(options.dt || 0);
        var multiplayerMode = !!options.multiplayerMode;
        var debugVisualsOn = !!options.debugVisualsOn;

        if (runtime.GameUI && runtime.GameUI.updateCooldown && runtime.GameHitscan && runtime.GameHitscan.getHudState) {
            runtime.GameUI.updateCooldown(runtime.GameHitscan.getHudState());
        }
        if (runtime.GameUI && runtime.GameUI.updateDamageEffects) {
            runtime.GameUI.updateDamageEffects(dt);
        }
        if (!multiplayerMode && runtime.GameUI && runtime.GameUI.updateAbilityInfo && runtime.GameAbilities && runtime.GameAbilities.getHudState) {
            runtime.GameUI.updateAbilityInfo(runtime.GameAbilities.getHudState());
        }

        if (runtime.GamePlayer && runtime.GamePlayer.setHealFlash) {
            var selfHealState = currentHealState(multiplayerMode);
            runtime.GamePlayer.setHealFlash(!!(selfHealState && selfHealState.endsAt > Date.now()));
        }

        if (runtime.GameAudio && runtime.GameAudio.setChokeAudioState) {
            var selfChokeCasterState = currentChokeCasterState(multiplayerMode);
            runtime.GameAudio.setChokeAudioState({
                casterActive: !!(selfChokeCasterState && selfChokeCasterState.endsAt > Date.now()),
                victimActive: !!(runtime.GamePlayer && runtime.GamePlayer.isChoked && runtime.GamePlayer.isChoked())
            });
        }

        if (!multiplayerMode && runtime.GamePlayer && runtime.GamePlayer.setStatusState) {
            runtime.GamePlayer.setStatusState({
                stunUntil: 0,
                hookPullUntil: 0,
                chokeStartedAt: 0,
                chokeUntil: 0,
                chokeLift: 0,
                spawnShieldUntil: (runtime.GamePlayerCombat && runtime.GamePlayerCombat.isInvulnerable && runtime.GamePlayerCombat.isInvulnerable())
                    ? (Date.now() + 120)
                    : 0
            });
        }

        var abilityLoadoutState = currentAbilityLoadoutState(multiplayerMode);
        var abilityTuningState = runtime.GameCombatTuning && runtime.GameCombatTuning.getClassAbilityTuning
            ? runtime.GameCombatTuning.getClassAbilityTuning() || {}
            : {};
        var slot1Ability = abilityLoadoutState ? String(abilityLoadoutState.slot1 || '') : '';
        var slot2Ability = abilityLoadoutState ? String(abilityLoadoutState.slot2 || '') : '';

        if (runtime.GameUI && runtime.GameUI.updateChokeReticle) {
            var chokeVisible = !!debugVisualsOn && (slot1Ability === 'choke' || slot2Ability === 'choke');
            var chokeRectSize = runtime.GameAbilities && runtime.GameAbilities.getChokeRectSize
                ? runtime.GameAbilities.getChokeRectSize(camera)
                : { width: 216, height: 180 };
            runtime.GameUI.updateChokeReticle(chokeVisible, chokeRectSize.width, chokeRectSize.height);
        }

        if (runtime.GameUI && runtime.GameUI.updateHookReticle) {
            var hookVisible = !!debugVisualsOn && (slot1Ability === 'hook' || slot2Ability === 'hook');
            var hookReticleSize = Number(abilityTuningState.hookReticleRadiusPx || 52) * 2;
            runtime.GameUI.updateHookReticle(hookVisible, hookReticleSize);
        }

        if (runtime.GameUI && runtime.GameUI.updateDeadeyeDebugRect) {
            var deadeyeVisible = !!debugVisualsOn && (slot1Ability === 'deadeye' || slot2Ability === 'deadeye');
            var deadeyeMinDot = Number(((currentAbilityCatalogMap().deadeye || {}).minDot) || 0.18);
            var deadeyeRect = deadeyeDebugRectSizePx(camera, deadeyeMinDot);
            runtime.GameUI.updateDeadeyeDebugRect(
                deadeyeVisible,
                deadeyeRect ? deadeyeRect.width : 220,
                deadeyeRect ? deadeyeRect.height : 160
            );
        }

        if (runtime.GameUI && runtime.GameUI.updateAbilityDebugPanel) {
            runtime.GameUI.updateAbilityDebugPanel(
                !!debugVisualsOn && !!abilityLoadoutState,
                buildAbilityDebugText(abilityLoadoutState)
            );
        }

        var deadeyeUiState = currentDeadeyeUiState(multiplayerMode);
        syncDeadeyeHighlights(multiplayerMode, deadeyeUiState);
        if (runtime.GameUI && runtime.GameUI.updateDeadeyeReticle) {
            runtime.GameUI.updateDeadeyeReticle(camera, deadeyeUiState);
        }
    };

    runtime.GameGameplayHudSync = GameGameplayHudSync;
})();
