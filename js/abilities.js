/**
 * abilities.js - Player ability runtime with mix-and-match loadout
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameAbilities
 */
(function () {
    'use strict';

    var GameAbilities = {};

    var activeAbility = 'deadeye';
    var abilityLoadout = { slot1: 'choke', slot2: 'deadeye' };
    var cooldownUntilBySlot = { slot1: 0, slot2: 0 };
    var deadeyeState = null;
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

    function activeSlotKey() {
        if (activeAbility && activeAbility === abilityLoadout.slot2) return 'slot2';
        return 'slot1';
    }

    function activeCooldownUntil() {
        return cooldownUntilBySlot[activeSlotKey()] || 0;
    }

    function setActiveCooldown(until) {
        cooldownUntilBySlot[activeSlotKey()] = Number(until || 0);
    }

    function resetCooldowns() {
        cooldownUntilBySlot.slot1 = 0;
        cooldownUntilBySlot.slot2 = 0;
    }

    function getCatalog() {
        var shared = globalThis.__MAYHEM_RUNTIME.GameShared && globalThis.__MAYHEM_RUNTIME.GameShared.gameplayTuning;
        if (shared && shared.abilityCatalog) return shared.abilityCatalog;
        return {
            choke: {
                id: 'choke', slot: 'ability', name: 'Vader Choke',
                description: 'Single-target lift + damage in reticle box.',
                cooldownMs: 8000, range: 24, lockBoxPx: 190, castDamage: 95, duration: 1.6
            },
            deadeye: {
                id: 'deadeye', slot: 'ultimate', name: 'Deadeye',
                description: 'Lock and execute marked targets.',
                cooldownMs: 22000, range: 80, minDot: 0.18, duration: 2.0, maxTargets: 3, damage: 260
            }
        };
    }

    function getAbilityDef(abilityId) {
        var catalog = getCatalog();
        return catalog[abilityId] || null;
    }

    function getActiveConfig() {
        var id = activeAbility;
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
                out.castDamage = Number(tuning.chokeCastDamage || out.castDamage);
                out.duration = Number(tuning.chokeDuration || out.duration);
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

    function refreshDeadeyeTargetPositions() {
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
                stored.worldPos = makeVector3Like(live.worldPos);
                if (live.hitbox) stored.hitbox = live.hitbox;
            } else {
                stored.dead = true;
            }
        }
    }

    function fireDeadeye(camera, onEnemyHit, notifier, reason) {
        if (!deadeyeState || !deadeyeState.active) {
            return { ok: false, message: 'Deadeye not active.' };
        }

        var cfg = getActiveConfig() || {};
        var count = Math.max(0, Math.min(deadeyeState.targets.length, deadeyeState.lockCount));
        if (count <= 0) {
            deadeyeState = null;
            setActiveCooldown(debugMode ? 0 : nowMs() + Math.max(0, cfg.cooldownMs || 0));
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
        setActiveCooldown(debugMode ? 0 : nowMs() + Math.max(0, cfg.cooldownMs || 0));
        if (notifier) notifier('Deadeye fired (' + landed + ' hit).', 800);
        return { ok: landed > 0, landed: landed, reason: reason || 'manual' };
    }

    function castChoke(camera, onEnemyHit, notifier) {
        var now = nowMs();
        var cfg = getActiveConfig();
        if (!cfg) return { ok: false, message: 'Choke not configured.' };

        if (!debugMode && now < activeCooldownUntil()) {
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
        setActiveCooldown(debugMode ? 0 : now + Math.max(0, cfg.cooldownMs || 0));
        if (notifier) notifier('Choke cast.', 700);
        return { ok: true, kind: 'choke' };
    }

    function castDeadeye(camera, onEnemyHit, notifier) {
        var now = nowMs();
        var cfg = getActiveConfig();
        if (!cfg) return { ok: false, message: 'Deadeye not configured.' };

        if (deadeyeState && deadeyeState.active) {
            return fireDeadeye(camera, onEnemyHit, notifier, 'manual');
        }
        if (!debugMode && now < activeCooldownUntil()) {
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

        var durationMs = Math.max(1, Math.round((cfg.duration || 2.0) * 1000));
        var lockEveryMs = Math.max(1, Math.round(durationMs / Math.max(1, cfg.maxTargets || 3)));
        deadeyeState = {
            active: true,
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

    var abilityHandlers = {
        choke: castChoke,
        deadeye: castDeadeye
    };

    GameAbilities.init = function (_scene) {
        resetCooldowns();
        deadeyeState = null;

        var shared = globalThis.__MAYHEM_RUNTIME.GameShared && globalThis.__MAYHEM_RUNTIME.GameShared.gameplayTuning;
        if (!hasExplicitLoadoutSelection && shared && shared.defaultAbilityLoadout) {
            abilityLoadout.slot1 = shared.defaultAbilityLoadout.slot1 || 'choke';
            abilityLoadout.slot2 = shared.defaultAbilityLoadout.slot2 || 'deadeye';
            activeAbility = abilityLoadout.slot2 || abilityLoadout.slot1;
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
            activeAbility: activeAbility
        };
    };

    GameAbilities.setLoadout = function (slot1OrActive, slot2) {
        var catalog = getCatalog();
        var firstId = slot1OrActive && catalog[slot1OrActive] ? slot1OrActive : '';
        var secondId = slot2 && catalog[slot2] ? slot2 : '';
        var prevSlot1 = abilityLoadout.slot1;
        var prevSlot2 = abilityLoadout.slot2;
        var prevActiveAbility = activeAbility;
        var prevActiveSlot = activeSlotKey();

        if (firstId && secondId) {
            if ((catalog[firstId].slot === 'ability' || catalog[firstId].slot === 'either')) {
                abilityLoadout.slot1 = firstId;
            }
            if ((catalog[secondId].slot === 'ultimate' || catalog[secondId].slot === 'either')) {
                abilityLoadout.slot2 = secondId;
            }
            if (prevActiveAbility && (prevActiveAbility === abilityLoadout.slot1 || prevActiveAbility === abilityLoadout.slot2)) {
                activeAbility = prevActiveAbility;
            } else if (prevActiveSlot === 'slot1' && abilityLoadout.slot1) {
                activeAbility = abilityLoadout.slot1;
            } else if (prevActiveSlot === 'slot2' && abilityLoadout.slot2) {
                activeAbility = abilityLoadout.slot2;
            } else if (prevActiveAbility === prevSlot1 && abilityLoadout.slot1) {
                activeAbility = abilityLoadout.slot1;
            } else if (prevActiveAbility === prevSlot2 && abilityLoadout.slot2) {
                activeAbility = abilityLoadout.slot2;
            } else {
                activeAbility = abilityLoadout.slot1 || abilityLoadout.slot2 || activeAbility;
            }
            hasExplicitLoadoutSelection = true;
        } else if (firstId) {
            if (catalog[firstId].slot === 'ultimate') {
                abilityLoadout.slot2 = firstId;
            } else {
                abilityLoadout.slot1 = firstId;
            }
            activeAbility = firstId;
            hasExplicitLoadoutSelection = true;
        }
        resetCooldowns();
        deadeyeState = null;
        return {
            slot1: abilityLoadout.slot1,
            slot2: abilityLoadout.slot2,
            activeAbility: activeAbility
        };
    };

    GameAbilities.getHudState = function () {
        var def = getAbilityDef(activeAbility);
        var isUltimate = !!(def && (def.slot === 'ultimate' || def.id === abilityLoadout.slot2));
        return {
            name: 'Abilities',
            abilityName: def ? def.name : activeAbility,
            abilityCooldown: cooldownSec(activeCooldownUntil()),
            activeSlot: isUltimate ? 2 : 1,
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

    GameAbilities.triggerAbility = function (_slot, camera, _playerPos, _rotation, onEnemyHit, notifier) {
        var handler = abilityHandlers[activeAbility];
        if (!handler) {
            return { ok: false, message: 'Unknown ability: ' + activeAbility };
        }
        return handler(camera, onEnemyHit, notifier);
    };

    GameAbilities.update = function (_dt, camera, _playerPos, _rotation, onEnemyHit, notifier) {
        if (!deadeyeState || !deadeyeState.active) return;
        var now = nowMs();

        refreshDeadeyeTargetPositions();

        while (deadeyeState.lockCount < deadeyeState.targets.length && now >= deadeyeState.nextLockAt) {
            deadeyeState.lockCount += 1;
            deadeyeState.nextLockAt += deadeyeState.lockEveryMs;
        }
        if (deadeyeState.lockCount >= deadeyeState.targets.length || now >= deadeyeState.endsAt) {
            fireDeadeye(camera, onEnemyHit, notifier, 'auto');
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

    GameAbilities.debugDump = function () {
        return {
            debugMode: debugMode,
            activeAbility: activeAbility,
            cooldown: cooldownSec(activeCooldownUntil()),
            deadeye: deadeyeState ? {
                lockCount: deadeyeState.lockCount,
                targetCount: deadeyeState.targets.length
            } : null
        };
    };

    globalThis.__MAYHEM_RUNTIME.GameAbilities = GameAbilities;
})();
