/**
 * abilities.js - Player ability runtime with mix-and-match loadout
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameAbilities
 */
(function () {
    'use strict';

    var GameAbilities = {};

    var abilityLoadout = { slot1: 'choke', slot2: 'deadeye' };
    var cooldownUntilBySlot = { slot1: 0, slot2: 0 };
    var deadeyeState = null;
    var hookState = null;
    var healState = null;
    var debugMode = false;
    var hasExplicitLoadoutSelection = false;

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

    function slotKeyForIndex(slotIndex) {
        return Number(slotIndex) === 2 ? 'slot2' : 'slot1';
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
        if (shared && shared.abilityCatalog) return shared.abilityCatalog;
        return {
            choke: {
                id: 'choke', slot: 'ability', name: 'Vader Choke',
                description: 'Single-target lift + damage in reticle box.',
                debugSummary: 'Square = choke target box.',
                tunableParams: ['lockBoxPx', 'range', 'targetTolerance', 'duration', 'castDamage', 'liftHeight', 'tickRate', 'dotPerTick'],
                cooldownMs: 8000, range: 24, lockBoxPx: 190, castDamage: 95, duration: 1.6, targetTolerance: 1.8
            },
            hook: {
                id: 'hook', slot: 'either', name: 'Chain Hook',
                description: 'Latch a target and yank them into close range.',
                debugSummary: 'Circle = hook catch radius debug.',
                tunableParams: ['reticleRadiusPx', 'catchRadius', 'range', 'travelSpeed', 'pullDistance', 'castDamage', 'cooldownMs'],
                cooldownMs: 7000, range: 26, lockBoxPx: 170, castDamage: 40, stunDuration: 0.7, pullDistance: 3.2, minDot: 0.03, catchRadius: 1.8, travelSpeed: 26
            },
            heal: {
                id: 'heal', slot: 'either', name: 'Heal',
                description: 'Brief self-heal with visible windup.',
                debugSummary: 'No geometry; instant heal plus green flash.',
                tunableParams: ['healAmount', 'cooldownMs'],
                cooldownMs: 9000, duration: 0.85, healAmount: 100
            },
            deadeye: {
                id: 'deadeye', slot: 'ultimate', name: 'Deadeye',
                description: 'Lock and execute marked targets.',
                debugSummary: 'Rectangle = deadeye acquisition FOV approximation.',
                tunableParams: ['range', 'minDot', 'duration', 'maxTargets', 'damage', 'cooldownMs'],
                cooldownMs: 22000, range: 80, minDot: 0.18, duration: 2.0, maxTargets: 3, damage: 260
            }
        };
    }

    function getAbilityDef(abilityId) {
        var catalog = getCatalog();
        return catalog[abilityId] || null;
    }

    function getConfigForAbility(abilityId) {
        var id = abilityId;
        var def = getAbilityDef(id);
        if (!def) return null;

        var out = {};
        for (var k in def) {
            if (Object.prototype.hasOwnProperty.call(def, k)) out[k] = def[k];
        }

        if (globalThis.__MAYHEM_RUNTIME.GameCombatTuning && globalThis.__MAYHEM_RUNTIME.GameCombatTuning.getClassAbilityTuning) {
            var tuning = globalThis.__MAYHEM_RUNTIME.GameCombatTuning.getClassAbilityTuning() || {};
            if (id === 'choke') {
                out.range = Number(tuning.chokeRange || out.range);
                out.lockBoxPx = Number(tuning.chokeLockBoxPx || out.lockBoxPx);
                out.targetTolerance = Number(tuning.chokeTargetTolerance || out.targetTolerance);
                out.castDamage = Number(tuning.chokeCastDamage || out.castDamage);
                out.duration = Number(tuning.chokeDuration || out.duration);
            } else if (id === 'hook') {
                out.range = Number(tuning.hookRange || out.range);
                out.lockBoxPx = Number(tuning.hookLockBoxPx || out.lockBoxPx);
                out.reticleRadiusPx = Number(tuning.hookReticleRadiusPx || out.reticleRadiusPx);
                out.castDamage = Number(tuning.hookCastDamage || out.castDamage);
                out.stunDuration = Number(tuning.hookStunDuration || out.stunDuration);
                out.pullDistance = Number(tuning.hookPullDistance || out.pullDistance);
                out.catchRadius = Number(tuning.hookCatchRadius || out.catchRadius);
                out.travelSpeed = Number(tuning.hookTravelSpeed || out.travelSpeed);
            } else if (id === 'heal') {
                out.duration = Number(tuning.healDuration || out.duration);
                out.healAmount = Number(tuning.healAmount || out.healAmount);
            } else if (id === 'deadeye') {
                out.range = Number(tuning.deadeyeLockRange || out.range);
                out.duration = Number(tuning.deadeyeDuration || out.duration);
                out.maxTargets = Number(tuning.deadeyeMaxTargets || out.maxTargets);
                out.damage = Number(tuning.deadeyeDamage || out.damage);
            }
        }

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
            if (camPos && item.worldPos && !deadeyeHasLOS(camPos, makeVector3Like(item.worldPos), cfg.range || 80)) continue;
            var result = globalThis.__MAYHEM_RUNTIME.GameEnemy.damage(item.hitbox, cfg.damage || 260);
            if (!result) continue;
            landed++;
            if (onEnemyHit) {
                onEnemyHit({
                    hitPoint: makeVector3Like(item.worldPos),
                    damage: cfg.damage || 260,
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
        if (!camera || !globalThis.__MAYHEM_RUNTIME.GameHitscan || !globalThis.__MAYHEM_RUNTIME.GameHitscan.selectLockTargetByBox) {
            return { ok: false, message: 'Choke targeting unavailable.' };
        }
        var target = globalThis.__MAYHEM_RUNTIME.GameHitscan.selectLockTargetByBox(
            camera,
            cfg.range || 24,
            cfg.lockBoxPx || 190,
            { ownerType: 'enemy' }
        );
        if (!target || !target.hitbox) {
            return { ok: false, message: 'No target in choke reticle.' };
        }
        var result = null;
        if (globalThis.__MAYHEM_RUNTIME.GameEnemy && globalThis.__MAYHEM_RUNTIME.GameEnemy.damage) {
            result = globalThis.__MAYHEM_RUNTIME.GameEnemy.damage(target.hitbox, cfg.castDamage || 95);
        }
        if (target.enemyRef && globalThis.__MAYHEM_RUNTIME.GameEnemy && globalThis.__MAYHEM_RUNTIME.GameEnemy.applyStun) {
            globalThis.__MAYHEM_RUNTIME.GameEnemy.applyStun(target.enemyRef, cfg.duration || 1.6);
        }
        if (result && onEnemyHit) {
            onEnemyHit({
                hitPoint: makeVector3Like(target.worldPos),
                damage: cfg.castDamage || 95,
                hitType: 'body',
                result: result
            });
        }
        setCooldownForSlot(slotIndex, debugMode ? 0 : now + Math.max(0, cfg.cooldownMs || 0));
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
        var endPos = camera.position.clone().addScaledVector(forward, Number(cfg.range || 26));
        var travelDistance = Math.max(1, endPos.distanceTo(startPos));
        var travelSpeed = Math.max(8, Number(cfg.travelSpeed || 26));
        var travelMs = Math.max(120, Math.round((travelDistance / travelSpeed) * 1000));
        hookState = {
            active: true,
            slotIndex: slotIndex,
            phase: 'travel',
            targetId: '',
            catchRadius: Number(cfg.catchRadius || 1.8),
            pullDistance: Number(cfg.pullDistance || 3.2),
            stunDuration: Number(cfg.stunDuration || 0.7),
            castDamage: Number(cfg.castDamage || 40),
            travelSpeed: Number(cfg.travelSpeed || 26),
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
            cfg.range || 80,
            cfg.minDot || 0.18,
            cfg.maxTargets || 3
        );
        if (!candidates.length) {
            return { ok: false, message: 'No Deadeye targets.' };
        }

        var durationMs = Math.max(1, Math.round((cfg.duration || 3.0) * 1000));
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
        if (globalThis.__MAYHEM_RUNTIME.GamePlayerCombat && globalThis.__MAYHEM_RUNTIME.GamePlayerCombat.heal) {
            globalThis.__MAYHEM_RUNTIME.GamePlayerCombat.heal(cfg.healAmount || 100);
        }
        healState = {
            active: true,
            slotIndex: slotIndex,
            startedAt: now,
            endsAt: now + 220,
            healAmount: Number(cfg.healAmount || 100)
        };
        setCooldownForSlot(slotIndex, debugMode ? 0 : now + Math.max(0, cfg.cooldownMs || 0));
        if (notifier) notifier('Healed.', 450);
        return { ok: true, kind: 'heal_start' };
    }

    var abilityHandlers = {
        choke: castChoke,
        hook: castHook,
        heal: castHeal,
        deadeye: castDeadeye
    };

    GameAbilities.init = function (_scene) {
        resetCooldowns();
        deadeyeState = null;
        clearHookState();
        clearHealState();

        var shared = globalThis.__MAYHEM_RUNTIME.GameShared && globalThis.__MAYHEM_RUNTIME.GameShared.gameplayTuning;
        if (!hasExplicitLoadoutSelection && shared && shared.defaultAbilityLoadout) {
            abilityLoadout.slot1 = shared.defaultAbilityLoadout.slot1 || 'choke';
            abilityLoadout.slot2 = shared.defaultAbilityLoadout.slot2 || 'deadeye';
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
        return {
            slot1: abilityLoadout.slot1,
            slot2: abilityLoadout.slot2,
            activeAbility: abilityLoadout.slot1
        };
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
        resetCooldowns();
        deadeyeState = null;
        clearHookState();
        return GameAbilities.getLoadout();
    };

    GameAbilities.setLoadout = function (slot1OrActive, slot2) {
        var catalog = getCatalog();
        var firstId = slot1OrActive && catalog[slot1OrActive] ? slot1OrActive : '';
        var secondId = slot2 && catalog[slot2] ? slot2 : '';
        var prevSlot1 = abilityLoadout.slot1;
        var prevSlot2 = abilityLoadout.slot2;
        if (firstId && secondId) {
            abilityLoadout.slot1 = firstId;
            abilityLoadout.slot2 = secondId;
            hasExplicitLoadoutSelection = true;
        } else if (firstId) {
            abilityLoadout.slot1 = firstId;
            hasExplicitLoadoutSelection = true;
        }
        resetCooldowns();
        deadeyeState = null;
        clearHookState();
        clearHealState();
        return {
            slot1: abilityLoadout.slot1,
            slot2: abilityLoadout.slot2,
            activeAbility: abilityLoadout.slot1
        };
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
                            Number((hookState.travelSpeed || 26))
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
