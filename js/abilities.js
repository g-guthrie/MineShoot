/**
 * abilities.js - Player ability runtime with mix-and-match loadout
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameAbilities
 */
(function () {
    'use strict';

    var GameAbilities = {};

    var DEFAULT_ABILITY_LOADOUT = { slot1: 'choke', slot2: 'deadeye' };
    var abilityLoadout = cloneLoadout(DEFAULT_ABILITY_LOADOUT);
    var cooldownUntilBySlot = { slot1: 0, slot2: 0 };
    var deadeyeState = null;
    var hookState = null;
    var healState = null;
    var debugMode = false;
    var hasExplicitLoadoutSelection = false;
    var abilityTuningFields = {
        choke: {
            range: 'chokeRange',
            lockBoxPx: 'chokeLockBoxPx',
            targetTolerance: 'chokeTargetTolerance',
            castDamage: 'chokeCastDamage',
            duration: 'chokeDuration'
        },
        hook: {
            range: 'hookRange',
            lockBoxPx: 'hookLockBoxPx',
            reticleRadiusPx: 'hookReticleRadiusPx',
            castDamage: 'hookCastDamage',
            stunDuration: 'hookStunDuration',
            pullDistance: 'hookPullDistance',
            catchRadius: 'hookCatchRadius',
            travelSpeed: 'hookTravelSpeed'
        },
        heal: {
            duration: 'healDuration',
            healAmount: 'healAmount'
        },
        deadeye: {
            range: 'deadeyeLockRange',
            duration: 'deadeyeDuration',
            maxTargets: 'deadeyeMaxTargets',
            damage: 'deadeyeDamage'
        }
    };

    var profileDefaults = {
        armorMax: 90,
        wallhackRadius: 90,
        loadoutWeapon: 'rifle'
    };

    function nowMs() {
        return Date.now();
    }

    function cooldownSec(until) {
        return Math.max(0, (Number(until || 0) - nowMs()) / 1000);
    }

    function cloneLoadout(loadout) {
        return {
            slot1: loadout && loadout.slot1 ? loadout.slot1 : DEFAULT_ABILITY_LOADOUT.slot1,
            slot2: loadout && loadout.slot2 ? loadout.slot2 : DEFAULT_ABILITY_LOADOUT.slot2
        };
    }

    function slotKeyForIndex(slotIndex) {
        return Number(slotIndex) === 2 ? 'slot2' : 'slot1';
    }

    function buildLoadoutState() {
        return {
            slot1: abilityLoadout.slot1,
            slot2: abilityLoadout.slot2,
            activeAbility: abilityLoadout.slot1
        };
    }

    function getAbilityIdForSlot(slotIndex) {
        return abilityLoadout[slotKeyForIndex(slotIndex)] || '';
    }

    function cooldownUntilForSlot(slotIndex) {
        return cooldownUntilBySlot[slotKeyForIndex(slotIndex)] || 0;
    }

    function setCooldownForSlot(slotIndex, until) {
        cooldownUntilBySlot[slotKeyForIndex(slotIndex)] = Number(until || 0);
    }

    function setSharedCooldown(until) {
        var next = Number(until || 0);
        cooldownUntilBySlot.slot1 = next;
        cooldownUntilBySlot.slot2 = next;
    }

    function resetCooldowns() {
        cooldownUntilBySlot.slot1 = 0;
        cooldownUntilBySlot.slot2 = 0;
    }

    function clearHookState() {
        hookState = null;
    }

    function clearHealState() {
        healState = null;
    }

    function clearTransientStates() {
        deadeyeState = null;
        clearHookState();
        clearHealState();
    }

    function resetAbilityRuntimeState() {
        resetCooldowns();
        clearTransientStates();
    }

    function hookHeadWorldPosition(state, now) {
        if (!state || !state.startPos || !state.endPos) return null;
        var start = makeVector3Like(state.startPos);
        var end = makeVector3Like(state.endPos);
        if (!start || !end) return null;
        var startAt = Number(state.startedAt || 0);
        var hitAt = Math.max(startAt + 1, Number(state.hitAt || startAt + 1));
        var t = Math.max(0, Math.min(1, (Number(now || nowMs()) - startAt) / (hitAt - startAt)));
        return start.lerp(end, t);
    }

    function getCatalog() {
        var shared = globalThis.__MAYHEM_RUNTIME.GameShared && globalThis.__MAYHEM_RUNTIME.GameShared.gameplayTuning;
        return (shared && shared.abilityCatalog) ? shared.abilityCatalog : {};
    }

    function getAbilityDef(abilityId) {
        var catalog = getCatalog();
        return catalog[abilityId] || null;
    }

    function getClassAbilityTuning() {
        return globalThis.__MAYHEM_RUNTIME.GameCombatTuning && globalThis.__MAYHEM_RUNTIME.GameCombatTuning.getClassAbilityTuning
            ? (globalThis.__MAYHEM_RUNTIME.GameCombatTuning.getClassAbilityTuning() || {})
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

    function getConfigForAbility(abilityId) {
        var id = abilityId;
        var def = getAbilityDef(id);
        if (!def) return null;

        var out = {};
        for (var k in def) {
            if (Object.prototype.hasOwnProperty.call(def, k)) out[k] = def[k];
        }

        applyNumericOverrides(out, getClassAbilityTuning(), abilityTuningFields[id]);

        return out;
    }

    function makeVector3Like(v) {
        if (!v) return null;
        if (v.clone) return v.clone();
        return new THREE.Vector3(Number(v.x || 0), Number(v.y || 0), Number(v.z || 0));
    }

    function distanceSqXYZ(a, b) {
        if (!a || !b) return Infinity;
        var dx = Number(a.x || 0) - Number(b.x || 0);
        var dy = Number(a.y || 0) - Number(b.y || 0);
        var dz = Number(a.z || 0) - Number(b.z || 0);
        return (dx * dx) + (dy * dy) + (dz * dz);
    }

    function findHookTargetNearPoint(point, catchRadius) {
        if (!point || !globalThis.__MAYHEM_RUNTIME.GameEnemy || !globalThis.__MAYHEM_RUNTIME.GameEnemy.getLockTargets) return null;
        var list = globalThis.__MAYHEM_RUNTIME.GameEnemy.getLockTargets() || [];
        var best = null;
        var maxDistSq = Math.max(0.01, Number(catchRadius || 1.8));
        maxDistSq *= maxDistSq;
        var bestDistSq = maxDistSq;
        for (var i = 0; i < list.length; i++) {
            var target = list[i];
            if (!target || target.alive === false || !target.worldPos || !target.enemyRef || !target.hitbox) continue;
            var distSq = distanceSqXYZ(target.worldPos, point);
            if (distSq > bestDistSq) continue;
            if (!deadeyeHasLOS(makeVector3Like(point), makeVector3Like(target.worldPos), Math.sqrt(distSq) + 0.25)) continue;
            best = target;
            bestDistSq = distSq;
        }
        return best;
    }

    var losRaycaster = new THREE.Raycaster();
    var losDir = new THREE.Vector3();

    function deadeyeHasLOS(origin, targetPos, maxRange) {
        if (!origin || !targetPos) return false;
        var collidables = globalThis.__MAYHEM_RUNTIME.GameWorld && globalThis.__MAYHEM_RUNTIME.GameWorld.getCollidables
            ? globalThis.__MAYHEM_RUNTIME.GameWorld.getCollidables() : [];
        losDir.copy(targetPos).sub(origin);
        var dist = losDir.length();
        if (dist <= 0.001 || dist > maxRange) return false;
        losDir.divideScalar(dist);
        if (!collidables || collidables.length === 0) return true;
        losRaycaster.set(origin, losDir);
        losRaycaster.far = Math.max(0, dist - 0.12);
        return losRaycaster.intersectObjects(collidables, false).length === 0;
    }

    function collectDeadeyeCandidates(camera, range, minDot, maxTargets) {
        if (!camera || !globalThis.__MAYHEM_RUNTIME.GameEnemy || !globalThis.__MAYHEM_RUNTIME.GameEnemy.getLockTargets) return [];
        var list = globalThis.__MAYHEM_RUNTIME.GameEnemy.getLockTargets() || [];
        if (!list.length) return [];

        var origin = camera.position.clone();
        var forward = new THREE.Vector3();
        camera.getWorldDirection(forward);
        var out = [];
        for (var i = 0; i < list.length; i++) {
            var t = list[i];
            if (!t || !t.worldPos || !t.hitbox) continue;
            var worldPos = makeVector3Like(t.worldPos);
            if (!worldPos) continue;
            var to = worldPos.clone().sub(origin);
            var dist = to.length();
            if (dist <= 0.001 || dist > range) continue;
            to.divideScalar(dist);
            if (forward.dot(to) < minDot) continue;
            if (!deadeyeHasLOS(origin, worldPos, range)) continue;
            out.push({
                targetId: String(t.targetId || ''),
                worldPos: worldPos,
                hitbox: t.hitbox,
                dist: dist
            });
        }
        out.sort(function (a, b) { return a.dist - b.dist; });
        return out.slice(0, Math.max(1, maxTargets));
    }

    function buildDeadeyeUiState(state) {
        if (!state || !state.active || !state.targets || !state.targets.length) return null;
        var now = nowMs();
        var lockProgress = 0;
        if (state.lockEveryMs > 0) {
            lockProgress = 1 - Math.max(0, state.nextLockAt - now) / state.lockEveryMs;
        }
        lockProgress = Math.max(0, Math.min(1, lockProgress));

        var markers = [];
        for (var i = 0; i < state.targets.length; i++) {
            if (state.targets[i].dead) continue;
            var locked = i < state.lockCount;
            markers.push({
                worldPos: makeVector3Like(state.targets[i].worldPos),
                progress: locked ? 1 : (i === state.lockCount ? lockProgress : 0),
                locked: locked
            });
        }
        return { targets: markers };
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

    function refreshDeadeyeTargetPositions(camera, cfg) {
        if (!deadeyeState || !deadeyeState.active || !deadeyeState.targets) return;
        var liveList = null;
        if (globalThis.__MAYHEM_RUNTIME.GameEnemy && globalThis.__MAYHEM_RUNTIME.GameEnemy.getLockTargets) {
            liveList = globalThis.__MAYHEM_RUNTIME.GameEnemy.getLockTargets() || [];
        }

        var byId = {};
        if (liveList) {
            for (var i = 0; i < liveList.length; i++) {
                var lt = liveList[i];
                if (lt && lt.targetId && lt.worldPos) byId[lt.targetId] = lt;
            }
        }

        for (var t = 0; t < deadeyeState.targets.length; t++) {
            var stored = deadeyeState.targets[t];
            if (!stored || !stored.targetId || stored.dead) continue;
            var live = byId[stored.targetId];
            if (live && live.worldPos) {
                var nextWorldPos = makeVector3Like(live.worldPos);
                if (
                    camera &&
                    nextWorldPos &&
                    (
                        !deadeyeHasLOS(camera.position.clone(), nextWorldPos, cfg && cfg.range || 80) ||
                        camera.getWorldDirection(new THREE.Vector3()).dot(nextWorldPos.clone().sub(camera.position).normalize()) < Number(cfg && cfg.minDot || 0.18)
                    )
                ) {
                    stored.dead = true;
                } else {
                    stored.worldPos = nextWorldPos;
                    if (live.hitbox) stored.hitbox = live.hitbox;
                }
            } else {
                stored.dead = true;
            }
        }
    }

    function fireDeadeye(slotIndex, camera, onEnemyHit, notifier, reason) {
        if (!deadeyeState || !deadeyeState.active) {
            return { ok: false, message: 'Deadeye not active.' };
        }

        var cfg = getConfigForAbility(deadeyeState.abilityId) || {};
        var count = Math.max(0, Math.min(deadeyeState.targets.length, deadeyeState.lockCount));
        if (count <= 0) {
            deadeyeState = null;
            setCooldownForSlot(slotIndex, debugMode ? 0 : nowMs() + Math.max(0, cfg.cooldownMs || 0));
            return { ok: false, message: 'No Deadeye locks acquired.' };
        }

        var camPos = camera ? camera.position : null;
        var landed = 0;
        for (var i = 0; i < count; i++) {
            var item = deadeyeState.targets[i];
            if (!item || item.dead || !item.hitbox || !globalThis.__MAYHEM_RUNTIME.GameEnemy || !globalThis.__MAYHEM_RUNTIME.GameEnemy.damage) continue;
            if (camPos && item.worldPos && !deadeyeHasLOS(camPos, makeVector3Like(item.worldPos), cfg.range || 70)) continue;
            var result = globalThis.__MAYHEM_RUNTIME.GameEnemy.damage(item.hitbox, cfg.damage || 180);
            if (!result) continue;
            landed++;
            if (onEnemyHit) {
                onEnemyHit({
                    hitPoint: makeVector3Like(item.worldPos),
                    damage: cfg.damage || 180,
                    hitType: 'body',
                    result: result
                });
            }
        }

        deadeyeState = null;
        setCooldownForSlot(slotIndex, debugMode ? 0 : nowMs() + Math.max(0, cfg.cooldownMs || 0));
        if (notifier) notifier('Deadeye fired (' + landed + ' hit).', 800);
        return { ok: landed > 0, landed: landed, reason: reason || 'manual' };
    }

    function castChoke(slotIndex, camera, _playerPos, _rotation, onEnemyHit, notifier) {
        var now = nowMs();
        var cfg = getConfigForAbility(getAbilityIdForSlot(slotIndex));
        if (!cfg) return { ok: false, message: 'Choke not configured.' };

        if (!debugMode && now < cooldownUntilForSlot(slotIndex)) {
            return { ok: false, message: 'Choke is cooling down.' };
        }
        if (!camera || !globalThis.__MAYHEM_RUNTIME.GameHitscan || !globalThis.__MAYHEM_RUNTIME.GameHitscan.selectLockTargetByRect) {
            return { ok: false, message: 'Choke targeting unavailable.' };
        }
        var chokeRect = getChokeRectSize(camera, cfg);
        var target = globalThis.__MAYHEM_RUNTIME.GameHitscan.selectLockTargetByRect(
            camera,
            cfg.range || 24,
            chokeRect.width,
            chokeRect.height,
            { ownerType: 'enemy' }
        );
        if (!target || !target.hitbox) {
            return { ok: false, message: 'No target in choke reticle.' };
        }
        var chokeResult = null;
        if (Number(cfg.castDamage || 0) > 0 && globalThis.__MAYHEM_RUNTIME.GameEnemy && globalThis.__MAYHEM_RUNTIME.GameEnemy.damage) {
            chokeResult = globalThis.__MAYHEM_RUNTIME.GameEnemy.damage(target.hitbox, cfg.castDamage || 0);
        }
        if (target.enemyRef && globalThis.__MAYHEM_RUNTIME.GameEnemy && globalThis.__MAYHEM_RUNTIME.GameEnemy.applyStun) {
            globalThis.__MAYHEM_RUNTIME.GameEnemy.applyStun(target.enemyRef, cfg.duration || 1.6);
            target.enemyRef.chokeVictimState = {
                sourceId: 'player',
                startedAt: now,
                endsAt: now + Math.round((cfg.duration || 1.6) * 1000),
                liftHeight: Number(cfg.liftHeight || 1.0)
            };
        }
        if (globalThis.__MAYHEM_RUNTIME.GamePlayer && globalThis.__MAYHEM_RUNTIME.GamePlayer.triggerChokeGripPose) {
            globalThis.__MAYHEM_RUNTIME.GamePlayer.triggerChokeGripPose(cfg.duration || 1.6);
        }
        setCooldownForSlot(slotIndex, debugMode ? 0 : now + Math.max(0, cfg.cooldownMs || 0));
        if (chokeResult && onEnemyHit) {
            onEnemyHit({
                hitPoint: makeVector3Like(target.worldPos),
                damage: cfg.castDamage || 0,
                hitType: 'body',
                result: chokeResult
            });
        }
        if (notifier) notifier('Choke cast.', 700);
        return { ok: true, kind: 'choke' };
    }

    function castHook(slotIndex, camera, playerPos, rotation, onEnemyHit, notifier) {
        var now = nowMs();
        var cfg = getConfigForAbility(getAbilityIdForSlot(slotIndex));
        if (!cfg) return { ok: false, message: 'Hook not configured.' };

        if (!debugMode && now < cooldownUntilForSlot(slotIndex)) {
            return { ok: false, message: 'Hook is cooling down.' };
        }
        if (!camera || !playerPos || !rotation || !globalThis.__MAYHEM_RUNTIME.GameHitscan || !globalThis.__MAYHEM_RUNTIME.GameHitscan.peekCenterTarget) {
            return { ok: false, message: 'Hook targeting unavailable.' };
        }
        var forward = new THREE.Vector3();
        camera.getWorldDirection(forward);
        var startPos = (globalThis.__MAYHEM_RUNTIME.GamePlayer && globalThis.__MAYHEM_RUNTIME.GamePlayer.getThrowableOriginWorldPosition)
            ? globalThis.__MAYHEM_RUNTIME.GamePlayer.getThrowableOriginWorldPosition()
            : camera.position.clone();
        var endPos = camera.position.clone().addScaledVector(forward, Number(cfg.range || 24));
        var travelDistance = Math.max(1, endPos.distanceTo(startPos));
        var travelSpeed = Math.max(8, Number(cfg.travelSpeed || 24));
        var travelMs = Math.max(120, Math.round((travelDistance / travelSpeed) * 1000));
        hookState = {
            active: true,
            slotIndex: slotIndex,
            phase: 'travel',
            targetId: '',
            catchRadius: Number(cfg.catchRadius || 1.6),
            pullDistance: Number(cfg.pullDistance || 3.2),
            stunDuration: Number(cfg.stunDuration || 0.5),
            castDamage: Number(cfg.castDamage || 35),
            travelSpeed: Number(cfg.travelSpeed || 24),
            playerPos: makeVector3Like(playerPos),
            playerYaw: Number(rotation.yaw || 0),
            startPos: startPos,
            endPos: endPos,
            headPos: startPos.clone(),
            startedAt: now,
            hitAt: now + travelMs,
            endsAt: now + travelMs
        }
        setCooldownForSlot(slotIndex, debugMode ? 0 : now + Math.max(0, cfg.cooldownMs || 0));
        if (notifier) notifier('Chain Hook out.', 550);
        return { ok: true, kind: 'hook_start' };
    }

    function castDeadeye(slotIndex, camera, _playerPos, _rotation, onEnemyHit, notifier) {
        var now = nowMs();
        var cfg = getConfigForAbility(getAbilityIdForSlot(slotIndex));
        if (!cfg) return { ok: false, message: 'Deadeye not configured.' };

        if (deadeyeState && deadeyeState.active && deadeyeState.slotKey === slotKeyForIndex(slotIndex)) {
            return fireDeadeye(slotIndex, camera, onEnemyHit, notifier, 'manual');
        }
        if (!debugMode && now < cooldownUntilForSlot(slotIndex)) {
            return { ok: false, message: 'Deadeye is cooling down.' };
        }

        var candidates = collectDeadeyeCandidates(
            camera,
            cfg.range || 70,
            cfg.minDot || 0.22,
            cfg.maxTargets || 2
        );
        if (!candidates.length) {
            return { ok: false, message: 'No Deadeye targets.' };
        }

        var durationMs = Math.max(1, Math.round((cfg.duration || 1.5) * 1000));
        var lockEveryMs = Math.max(1, Math.round(durationMs / Math.max(1, candidates.length)));
        deadeyeState = {
            active: true,
            abilityId: getAbilityIdForSlot(slotIndex),
            slotKey: slotKeyForIndex(slotIndex),
            startedAt: now,
            endsAt: now + durationMs,
            lockEveryMs: lockEveryMs,
            nextLockAt: now + lockEveryMs,
            lockCount: 0,
            targets: candidates
        };
        if (notifier) notifier('Deadeye primed. Press R again to fire.', 900);
        return { ok: true, kind: 'deadeye_start', targetCount: candidates.length };
    }

    function castHeal(slotIndex, _camera, _playerPos, _rotation, _onEnemyHit, notifier) {
        var now = nowMs();
        var cfg = getConfigForAbility(getAbilityIdForSlot(slotIndex));
        if (!cfg) return { ok: false, message: 'Heal not configured.' };
        if (!debugMode && now < cooldownUntilForSlot(slotIndex)) {
            return { ok: false, message: 'Heal is cooling down.' };
        }
        healState = {
            active: true,
            slotIndex: slotIndex,
            startedAt: now,
            endsAt: now + Math.round(Math.max(0.1, Number(cfg.duration || 0.85)) * 1000),
            healAmount: Number(cfg.healAmount || 150),
            applied: false
        };
        setCooldownForSlot(slotIndex, debugMode ? 0 : now + Math.max(0, cfg.cooldownMs || 0));
        if (notifier) notifier('Healing...', 450);
        return { ok: true, kind: 'heal_start' };
    }

    var abilityHandlers = {
        choke: castChoke,
        hook: castHook,
        heal: castHeal,
        deadeye: castDeadeye
    };

    GameAbilities.init = function (_scene) {
        resetAbilityRuntimeState();

        var shared = globalThis.__MAYHEM_RUNTIME.GameShared && globalThis.__MAYHEM_RUNTIME.GameShared.gameplayTuning;
        if (!hasExplicitLoadoutSelection && shared && shared.defaultAbilityLoadout) {
            abilityLoadout = cloneLoadout(shared.defaultAbilityLoadout);
        }
    };

    GameAbilities.getOrder = function () {
        return [];
    };

    GameAbilities.getCatalog = function () {
        var catalog = getCatalog();
        var out = [];
        for (var id in catalog) {
            if (!Object.prototype.hasOwnProperty.call(catalog, id)) continue;
            var def = catalog[id];
            out.push({ id: def.id, name: def.name, description: def.description, slot: def.slot || 'ability' });
        }
        return out;
    };

    GameAbilities.getCurrentClass = function () {
        return { id: 'abilities', name: 'Abilities' };
    };

    GameAbilities.getLoadout = function () {
        return buildLoadoutState();
    };

    GameAbilities.setLoadoutSlot = function (slotIndex, abilityId) {
        var catalog = getCatalog();
        var id = abilityId && catalog[abilityId] ? abilityId : '';
        if (!id) {
            return GameAbilities.getLoadout();
        }
        var ownKey = slotKeyForIndex(slotIndex);
        var otherKey = ownKey === 'slot1' ? 'slot2' : 'slot1';
        abilityLoadout[ownKey] = id;
        if (abilityLoadout[otherKey] === id) {
            var replacement = '';
            for (var catalogId in catalog) {
                if (!Object.prototype.hasOwnProperty.call(catalog, catalogId)) continue;
                if (catalogId === id) continue;
                replacement = catalogId;
                break;
            }
            abilityLoadout[otherKey] = replacement;
        }
        hasExplicitLoadoutSelection = true;
        resetAbilityRuntimeState();
        return buildLoadoutState();
    };

    GameAbilities.setLoadout = function (slot1OrActive, slot2) {
        var catalog = getCatalog();
        var firstId = slot1OrActive && catalog[slot1OrActive] ? slot1OrActive : '';
        var secondId = slot2 && catalog[slot2] ? slot2 : '';
        if (firstId && secondId) {
            abilityLoadout.slot1 = firstId;
            abilityLoadout.slot2 = secondId;
            hasExplicitLoadoutSelection = true;
        } else if (firstId) {
            abilityLoadout.slot1 = firstId;
            hasExplicitLoadoutSelection = true;
        }
        resetAbilityRuntimeState();
        return buildLoadoutState();
    };

    GameAbilities.getHudState = function () {
        var slot1Def = getAbilityDef(abilityLoadout.slot1);
        var slot2Def = getAbilityDef(abilityLoadout.slot2);
        return {
            name: 'Abilities',
            slot1Name: slot1Def ? slot1Def.name : abilityLoadout.slot1,
            slot1Cooldown: cooldownSec(cooldownUntilForSlot(1)),
            slot2Name: slot2Def ? slot2Def.name : abilityLoadout.slot2,
            slot2Cooldown: cooldownSec(cooldownUntilForSlot(2)),
            extra: deadeyeState && deadeyeState.active
                ? ('DEADEYE ' + deadeyeState.lockCount + '/' + deadeyeState.targets.length)
                : ''
        };
    };

    GameAbilities.setClass = function (_id) {
        return {
            id: 'abilities',
            name: 'Abilities',
            armorMax: profileDefaults.armorMax,
            wallhackRadius: profileDefaults.wallhackRadius,
            loadoutWeapon: profileDefaults.loadoutWeapon
        };
    };

    GameAbilities.queueClass = function (_id) {
        return null;
    };

    GameAbilities.getQueuedClass = function () {
        return null;
    };

    GameAbilities.applyQueuedClass = function () {
        return null;
    };

    GameAbilities.clearQueuedClass = function () {};

    GameAbilities.getArmorMax = function () {
        return profileDefaults.armorMax;
    };

    GameAbilities.getWallhackRadius = function () {
        return profileDefaults.wallhackRadius;
    };

    GameAbilities.modifyOutgoingDamage = function (damage, _hitType, _weaponId) {
        return damage;
    };

    GameAbilities.modifyIncomingDamage = function (damage) {
        return damage;
    };

    GameAbilities.triggerAbility = function (slot, camera, _playerPos, _rotation, onEnemyHit, notifier) {
        var abilityId = getAbilityIdForSlot(slot);
        var handler = abilityHandlers[abilityId];
        if (!handler) {
            return { ok: false, message: 'Unknown ability: ' + abilityId };
        }
        return handler(Number(slot) === 2 ? 2 : 1, camera, _playerPos, _rotation, onEnemyHit, notifier);
    };

    GameAbilities.update = function (_dt, camera, _playerPos, _rotation, onEnemyHit, notifier) {
        var now = nowMs();
        if (hookState && hookState.active) {
            if (hookState.phase === 'travel') {
                hookState.headPos = hookHeadWorldPosition(hookState, now);
                var hookTarget = findHookTargetNearPoint(hookState.headPos, hookState.catchRadius);
                if (hookTarget) {
                    var hookResult = null;
                    if (globalThis.__MAYHEM_RUNTIME.GameEnemy && globalThis.__MAYHEM_RUNTIME.GameEnemy.damage) {
                        hookResult = globalThis.__MAYHEM_RUNTIME.GameEnemy.damage(hookTarget.hitbox, hookState.castDamage || 40);
                    }
                    if (globalThis.__MAYHEM_RUNTIME.GameEnemy && globalThis.__MAYHEM_RUNTIME.GameEnemy.pullTarget) {
                        globalThis.__MAYHEM_RUNTIME.GameEnemy.pullTarget(
                            hookTarget.enemyRef,
                            hookState.playerPos,
                            hookState.playerYaw || 0,
                            hookState.pullDistance || 3.2,
                            Number((hookState.travelSpeed || 26)),
                            Number((hookState.stunDuration || 0))
                        );
                    }
                    hookState.phase = 'latched';
                    hookState.targetId = String(hookTarget.targetId || '');
                    hookState.headPos = makeVector3Like(hookTarget.worldPos);
                    hookState.endsAt = now + 260;
                    if (hookResult && onEnemyHit) {
                        onEnemyHit({
                            hitPoint: makeVector3Like(hookTarget.worldPos),
                            damage: hookState.castDamage || 40,
                            hitType: 'body',
                            result: hookResult
                        });
                    }
                    if (notifier) notifier('Chain Hook landed.', 700);
                } else if (now >= (hookState.hitAt || 0)) {
                    clearHookState();
                    if (notifier) notifier('Hook missed.', 500);
                }
            } else if (now >= (hookState.endsAt || 0)) {
                clearHookState();
            }
        }
        if (healState && healState.active && now >= (healState.endsAt || 0)) {
            if (!healState.applied && globalThis.__MAYHEM_RUNTIME.GamePlayerCombat && globalThis.__MAYHEM_RUNTIME.GamePlayerCombat.heal) {
                globalThis.__MAYHEM_RUNTIME.GamePlayerCombat.heal(healState.healAmount || 150);
                healState.applied = true;
            }
            clearHealState();
        }
        if (!deadeyeState || !deadeyeState.active) return;

        var deadeyeCfg = getConfigForAbility(deadeyeState.abilityId) || {};
        refreshDeadeyeTargetPositions(camera, deadeyeCfg);
        deadeyeState.targets = deadeyeState.targets.filter(function (t) { return t && !t.dead; });
        if (deadeyeState.lockCount > deadeyeState.targets.length) {
            deadeyeState.lockCount = deadeyeState.targets.length;
        }
        if (!deadeyeState.targets.length) {
            deadeyeState = null;
            return;
        }

        while (deadeyeState.lockCount < deadeyeState.targets.length && now >= deadeyeState.nextLockAt) {
            deadeyeState.lockCount += 1;
            deadeyeState.nextLockAt += deadeyeState.lockEveryMs;
        }
        if (deadeyeState.lockCount >= deadeyeState.targets.length || now >= deadeyeState.endsAt) {
            fireDeadeye(deadeyeState.slotKey === 'slot2' ? 2 : 1, camera, onEnemyHit, notifier, 'auto');
        }
    };

    GameAbilities.setDebugMode = function (enabled) {
        debugMode = !!enabled;
    };

    GameAbilities.isDeadeyeActive = function () {
        return !!(deadeyeState && deadeyeState.active);
    };

    GameAbilities.getDeadeyeState = function () {
        return buildDeadeyeUiState(deadeyeState);
    };

    GameAbilities.getChokeRectSize = function (camera) {
        return getChokeRectSize(camera, getConfigForAbility('choke') || null);
    };

    GameAbilities.getHookState = function () {
        return hookState && hookState.active ? {
            targetId: hookState.targetId,
            phase: hookState.phase,
            startPos: hookState.startPos ? makeVector3Like(hookState.startPos) : null,
            endPos: hookState.endPos ? makeVector3Like(hookState.endPos) : null,
            headPos: hookState.headPos ? makeVector3Like(hookState.headPos) : null,
            catchRadius: Number(hookState.catchRadius || 1.8),
            startedAt: hookState.startedAt || 0,
            hitAt: hookState.hitAt || 0,
            endsAt: hookState.endsAt
        } : null;
    };

    GameAbilities.getHealState = function () {
        return healState && healState.active ? {
            startedAt: healState.startedAt,
            endsAt: healState.endsAt,
            healAmount: healState.healAmount || 100
        } : null;
    };

    GameAbilities.debugDump = function () {
        return {
            debugMode: debugMode,
            slot1: abilityLoadout.slot1,
            slot2: abilityLoadout.slot2,
            cooldownSlot1: cooldownSec(cooldownUntilForSlot(1)),
            cooldownSlot2: cooldownSec(cooldownUntilForSlot(2)),
            deadeye: deadeyeState ? {
                lockCount: deadeyeState.lockCount,
                targetCount: deadeyeState.targets.length
            } : null
        };
    };

    globalThis.__MAYHEM_RUNTIME.GameAbilities = GameAbilities;
})();
