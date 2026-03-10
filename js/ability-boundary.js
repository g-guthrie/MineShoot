(function () {
    'use strict';

    function runtime() {
        return globalThis.__MAYHEM_RUNTIME || {};
    }

    function getCatalog() {
        var shared = runtime().GameShared && runtime().GameShared.gameplayTuning;
        return (shared && shared.abilityCatalog) ? shared.abilityCatalog : {};
    }

    function getAbilityDef(abilityId) {
        var catalog = getCatalog();
        return catalog[abilityId] || null;
    }

    function getClassAbilityTuning() {
        var combatTuning = runtime().GameCombatTuning;
        return combatTuning && combatTuning.getClassAbilityTuning
            ? (combatTuning.getClassAbilityTuning() || {})
            : null;
    }

    function applyNumericOverrides(target, source, fields) {
        if (!target || !source || !fields) return;
        for (var key in fields) {
            if (!Object.prototype.hasOwnProperty.call(fields, key)) continue;
            var sourceKey = fields[key];
            if (source[sourceKey] == null) continue;
            target[key] = Number(source[sourceKey]);
        }
    }

    function getConfigForAbility(abilityId, abilityTuningFields) {
        var def = getAbilityDef(abilityId);
        if (!def) return null;
        var out = {};
        for (var key in def) {
            if (Object.prototype.hasOwnProperty.call(def, key)) out[key] = def[key];
        }
        applyNumericOverrides(out, getClassAbilityTuning(), abilityTuningFields && abilityTuningFields[abilityId]);
        return out;
    }

    function plainVec3(value) {
        if (!value) return null;
        var x = Number(value.x);
        var y = Number(value.y);
        var z = Number(value.z);
        if (!isFinite(x) || !isFinite(y) || !isFinite(z)) return null;
        return { x: x, y: y, z: z };
    }

    function aimPointFromCenterTarget(camera) {
        var hitscan = runtime().GameHitscan;
        if (!camera || !hitscan || !hitscan.peekCenterTarget) return null;
        var aim = hitscan.peekCenterTarget(camera, 90);
        return aim && aim.point ? plainVec3(aim.point) : null;
    }

    function widenedChokeWidth(lockBoxPx) {
        return Math.max(24, Number(lockBoxPx || 180) * 1.2);
    }

    function getChokeRectSize(camera, cfg) {
        var deadeyeDef = getAbilityDef('deadeye') || {};
        var deadeyeMinDot = Number(deadeyeDef.minDot || 0.22);
        var halfAngleRad = Math.acos(Math.max(-1, Math.min(1, deadeyeMinDot)));
        var vFovRad = Number(camera && camera.fov || 60) * Math.PI / 180;
        var tanHalf = Math.tan(halfAngleRad);
        var tanV = Math.tan(vFovRad * 0.5);
        var height = 180;
        if (isFinite(tanHalf) && isFinite(tanV) && tanV > 0.000001) {
            var yNdc = tanHalf / tanV;
            height = Math.max(60, Math.min(window.innerHeight * 0.86, yNdc * window.innerHeight));
        }
        return {
            width: widenedChokeWidth(cfg && cfg.lockBoxPx),
            height: height
        };
    }

    function prepareNetChokeCast(abilityId, camera, getConfigForAbilityFn) {
        var cfg = getConfigForAbilityFn(abilityId);
        var hitscan = runtime().GameHitscan;
        if (!cfg) return { ok: false, message: 'Choke not configured.' };
        if (!camera || !hitscan || !hitscan.selectLockTargetByRect) {
            return { ok: false, message: 'Choke targeting unavailable.' };
        }
        var chokeRect = getChokeRectSize(camera, cfg);
        var chokeTarget = hitscan.selectLockTargetByRect(
            camera,
            Number(cfg.range || 24),
            chokeRect.width,
            chokeRect.height,
            { ownerType: 'net' }
        );
        if (!chokeTarget || !chokeTarget.targetId || String(chokeTarget.targetId).indexOf('net:') !== 0) {
            return { ok: false, message: 'No target for Force Choke.' };
        }
        return {
            ok: true,
            castData: {
                lockTargetId: String(chokeTarget.targetId).slice(4),
                aimPoint: plainVec3(chokeTarget.worldPos)
            }
        };
    }

    function prepareNetHookCast(abilityId, camera, getConfigForAbilityFn) {
        var cfg = getConfigForAbilityFn(abilityId);
        if (!cfg) return { ok: false, message: 'Hook not configured.' };
        if (!camera) return { ok: false, message: 'Hook targeting unavailable.' };
        var aimPoint = aimPointFromCenterTarget(camera);
        return {
            ok: true,
            castData: aimPoint ? { aimPoint: aimPoint } : null
        };
    }

    function prepareNetMissileCast(camera) {
        var RT = runtime();
        if (!camera || !RT.GameThrowables || !RT.GameThrowables.fireAbilityMissile) {
            return { ok: false, message: 'Missile launch unavailable.' };
        }
        var projectileIntent = RT.GameThrowables.fireAbilityMissile(camera, {
            predictLocal: false,
            abilityId: 'missile'
        });
        return {
            ok: true,
            castData: projectileIntent ? {
                aimPoint: plainVec3(projectileIntent.aimPoint),
                projectileIntent: projectileIntent
            } : null,
            commit: function () {
                if (RT.GamePlayer && RT.GamePlayer.triggerAction) {
                    RT.GamePlayer.triggerAction('fire');
                }
                if (RT.GameAudio && RT.GameAudio.play && document.hasFocus()) {
                    RT.GameAudio.play('fire', { weapon: 'missile' });
                }
            }
        };
    }

    function prepareNetGenericCast(camera) {
        var aimPoint = aimPointFromCenterTarget(camera);
        return {
            ok: true,
            castData: aimPoint ? { aimPoint: aimPoint } : null
        };
    }

    function prepareNetCast(slot, abilityId, camera, options) {
        var castSlot = Number(slot) === 2 ? 2 : 1;
        if (!abilityId) {
            return { ok: false, message: 'Unknown ability: ' + abilityId };
        }
        var getConfigForAbilityFn = options && options.getConfigForAbility
            ? options.getConfigForAbility
            : function () { return null; };
        var prepared = null;
        if (abilityId === 'choke') {
            prepared = prepareNetChokeCast(abilityId, camera, getConfigForAbilityFn);
        } else if (abilityId === 'hook') {
            prepared = prepareNetHookCast(abilityId, camera, getConfigForAbilityFn);
        } else if (abilityId === 'missile') {
            prepared = prepareNetMissileCast(camera);
        } else {
            prepared = prepareNetGenericCast(camera);
        }
        if (!prepared || prepared.ok === false) {
            return {
                ok: false,
                slot: castSlot,
                abilityId: abilityId,
                message: prepared && prepared.message ? prepared.message : ('Unable to prepare cast for ' + abilityId + '.')
            };
        }
        return {
            ok: true,
            slot: castSlot,
            abilityId: abilityId,
            castData: prepared.castData || null,
            commit: typeof prepared.commit === 'function' ? prepared.commit : null
        };
    }

    function buildLoadoutState(loadout) {
        var state = loadout || {};
        return {
            slot1: state.slot1 || '',
            slot2: state.slot2 || '',
            activeAbility: state.slot1 || ''
        };
    }

    function buildCatalogList() {
        var catalog = getCatalog();
        var out = [];
        for (var id in catalog) {
            if (!Object.prototype.hasOwnProperty.call(catalog, id)) continue;
            var def = catalog[id];
            out.push({ id: def.id, name: def.name, description: def.description, slot: def.slot || 'ability' });
        }
        return out;
    }

    function cooldownSec(until, now) {
        return Math.max(0, (Number(until || 0) - Number(now || Date.now())) / 1000);
    }

    function buildHudState(loadout, cooldownUntilBySlot, deadeyeState, now) {
        var slot1Def = getAbilityDef(loadout && loadout.slot1);
        var slot2Def = getAbilityDef(loadout && loadout.slot2);
        var cooldowns = cooldownUntilBySlot || {};
        return {
            name: 'Abilities',
            slot1Name: slot1Def ? slot1Def.name : (loadout && loadout.slot1) || '',
            slot1Cooldown: cooldownSec(cooldowns.slot1 || 0, now),
            slot2Name: slot2Def ? slot2Def.name : (loadout && loadout.slot2) || '',
            slot2Cooldown: cooldownSec(cooldowns.slot2 || 0, now),
            extra: deadeyeState && deadeyeState.active
                ? ('DEADEYE ' + deadeyeState.lockCount + '/' + deadeyeState.targets.length)
                : ''
        };
    }

    function buildDeadeyeUiState(state, now) {
        if (!state || !state.active || !state.targets || !state.targets.length) return null;
        var stamp = Number(now || Date.now());
        var lockProgress = 0;
        if (state.lockEveryMs > 0) {
            lockProgress = 1 - Math.max(0, state.nextLockAt - stamp) / state.lockEveryMs;
        }
        lockProgress = Math.max(0, Math.min(1, lockProgress));
        var markers = [];
        for (var i = 0; i < state.targets.length; i++) {
            if (state.targets[i].dead) continue;
            var locked = i < state.lockCount;
            markers.push({
                worldPos: plainVec3(state.targets[i].worldPos),
                progress: locked ? 1 : (i === state.lockCount ? lockProgress : 0),
                locked: locked
            });
        }
        return { targets: markers };
    }

    function buildNetworkDeadeyeUiState(netDeadeyeState, resolveTargetWorldPos, now) {
        if (!netDeadeyeState || Number(netDeadeyeState.maxLocks || 0) <= 0) return null;
        var targetIds = Array.isArray(netDeadeyeState.targetIds) ? netDeadeyeState.targetIds : [];
        var lockCount = Math.max(0, Math.min(targetIds.length, Number(netDeadeyeState.lockCount || 0)));
        var lockEveryMs = Math.max(0, Number(netDeadeyeState.lockEveryMs || 0));
        var nextLockAt = Number(netDeadeyeState.nextLockAt || 0);
        var stamp = Number(now || Date.now());
        var lockProgress = 0;
        if (lockEveryMs > 0 && nextLockAt > 0) {
            lockProgress = 1 - Math.max(0, nextLockAt - stamp) / lockEveryMs;
        }
        lockProgress = Math.max(0, Math.min(1, lockProgress));
        var markers = [];
        for (var i = 0; i < targetIds.length; i++) {
            var targetId = targetIds[i];
            var locked = i < lockCount;
            var markerProgress = locked ? 1 : (i === lockCount ? lockProgress : 0);
            var worldPos = typeof resolveTargetWorldPos === 'function'
                ? plainVec3(resolveTargetWorldPos(targetId))
                : null;
            if (!worldPos) continue;
            markers.push({
                worldPos: worldPos,
                progress: markerProgress,
                locked: locked
            });
        }
        if (markers.length > 0) return { targets: markers };
        return {
            targets: [{
                screenCenter: true,
                progress: Number(netDeadeyeState.maxLocks || 0) > 0 ? (lockCount / Number(netDeadeyeState.maxLocks || 1)) : lockProgress,
                locked: false
            }]
        };
    }

    runtime().GameAbilityBoundary = {
        buildCatalogList: buildCatalogList,
        buildDeadeyeUiState: buildDeadeyeUiState,
        buildNetworkDeadeyeUiState: buildNetworkDeadeyeUiState,
        buildHudState: buildHudState,
        buildLoadoutState: buildLoadoutState,
        getAbilityDef: getAbilityDef,
        getCatalog: getCatalog,
        getChokeRectSize: getChokeRectSize,
        getConfigForAbility: getConfigForAbility,
        plainVec3: plainVec3,
        prepareNetCast: prepareNetCast
    };
})();
