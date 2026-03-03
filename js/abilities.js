/**
 * abilities.js - Shared player ability runtime (Deadeye + Choke)
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameAbilities
 */
(function () {
    'use strict';

    var GameAbilities = {};

    var profile = {
        id: 'abilities',
        name: 'Abilities',
        armorMax: 90,
        wallhackRadius: 90,
        loadoutWeapon: 'rifle'
    };

    var chokeCooldownUntil = 0;
    var deadeyeCooldownUntil = 0;
    var deadeyeState = null;
    var debugMode = false;

    function nowMs() {
        return Date.now();
    }

    function cooldownSec(until) {
        return Math.max(0, (Number(until || 0) - nowMs()) / 1000);
    }

    function getSharedAbilityConfig() {
        var out = {
            choke: {
                range: 24,
                lockBoxPx: 190,
                castDamage: 95,
                duration: 1.6,
                cooldownMs: 8000
            },
            deadeye: {
                range: 80,
                minDot: 0.18,
                duration: 4.0,
                maxTargets: 6,
                damage: 260,
                cooldownMs: 22000
            }
        };

        if (globalThis.__MAYHEM_RUNTIME.GameCombatTuning && globalThis.__MAYHEM_RUNTIME.GameCombatTuning.getClassAbilityTuning) {
            var tuning = globalThis.__MAYHEM_RUNTIME.GameCombatTuning.getClassAbilityTuning() || {};
            out.choke.range = Number(tuning.jediChokeRange || out.choke.range);
            out.choke.lockBoxPx = Number(tuning.jediChokeLockBoxPx || out.choke.lockBoxPx);
            out.choke.castDamage = Number(tuning.jediChokeCastDamage || out.choke.castDamage);
            out.choke.duration = Number(tuning.jediChokeDuration || out.choke.duration);
            out.deadeye.range = Number(tuning.deadeyeLockRange || out.deadeye.range);
            out.deadeye.duration = Number(tuning.deadeyeDuration || out.deadeye.duration);
            out.deadeye.maxTargets = Number(tuning.deadeyeMaxTargets || out.deadeye.maxTargets);
            out.deadeye.damage = Number(tuning.deadeyeDamage || out.deadeye.damage);
        }

        if (globalThis.__MAYHEM_RUNTIME.GameCombatTuning && globalThis.__MAYHEM_RUNTIME.GameCombatTuning.getRawSharedTuning) {
            var raw = globalThis.__MAYHEM_RUNTIME.GameCombatTuning.getRawSharedTuning();
            var abilities = raw && raw.classAbilities ? raw.classAbilities : null;
            if (abilities && abilities.jedi) {
                out.choke.cooldownMs = Number(abilities.jedi.abilityCooldownMs || out.choke.cooldownMs);
            }
            if (abilities && abilities.sharpshooter) {
                out.deadeye.cooldownMs = Number(abilities.sharpshooter.ultimateCooldownMs || out.deadeye.cooldownMs);
            }
        }

        return out;
    }

    function makeVector3Like(v) {
        if (!v) return null;
        if (v.clone) return v.clone();
        return new THREE.Vector3(Number(v.x || 0), Number(v.y || 0), Number(v.z || 0));
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
            var locked = i < state.lockCount;
            markers.push({
                worldPos: makeVector3Like(state.targets[i].worldPos),
                progress: locked ? 1 : (i === state.lockCount ? lockProgress : 0),
                locked: locked
            });
        }
        return { targets: markers };
    }

    function fireDeadeye(onEnemyHit, notifier, reason) {
        if (!deadeyeState || !deadeyeState.active) {
            return { ok: false, message: 'Deadeye not active.' };
        }

        var cfg = getSharedAbilityConfig().deadeye;
        var count = Math.max(0, Math.min(deadeyeState.targets.length, deadeyeState.lockCount));
        if (count <= 0) {
            deadeyeState = null;
            deadeyeCooldownUntil = nowMs() + Math.max(0, cfg.cooldownMs);
            return { ok: false, message: 'No Deadeye locks acquired.' };
        }

        var landed = 0;
        for (var i = 0; i < count; i++) {
            var item = deadeyeState.targets[i];
            if (!item || !item.hitbox || !globalThis.__MAYHEM_RUNTIME.GameEnemy || !globalThis.__MAYHEM_RUNTIME.GameEnemy.damage) continue;
            var result = globalThis.__MAYHEM_RUNTIME.GameEnemy.damage(item.hitbox, cfg.damage);
            if (!result) continue;
            landed++;
            if (onEnemyHit) {
                onEnemyHit({
                    hitPoint: makeVector3Like(item.worldPos),
                    damage: cfg.damage,
                    hitType: 'body',
                    result: result
                });
            }
        }

        deadeyeState = null;
        deadeyeCooldownUntil = nowMs() + Math.max(0, cfg.cooldownMs);
        if (notifier) notifier('Deadeye fired (' + landed + ' hit).', 800);
        return { ok: landed > 0, landed: landed, reason: reason || 'manual' };
    }

    GameAbilities.init = function (_scene) {
        chokeCooldownUntil = 0;
        deadeyeCooldownUntil = 0;
        deadeyeState = null;
    };

    GameAbilities.getOrder = function () {
        return [];
    };

    GameAbilities.getCatalog = function () {
        return [
            { id: 'choke', name: 'Vader Choke', description: 'Single-target lift + damage in reticle box.' },
            { id: 'deadeye', name: 'Deadeye', description: 'Lock and execute marked targets.' }
        ];
    };

    GameAbilities.getCurrentClass = function () {
        return { id: profile.id, name: profile.name };
    };

    GameAbilities.getHudState = function () {
        return {
            name: 'Abilities',
            abilityName: 'Choke',
            ultimateName: 'Deadeye',
            abilityCooldown: cooldownSec(chokeCooldownUntil),
            ultimateCooldown: cooldownSec(deadeyeCooldownUntil),
            extra: deadeyeState && deadeyeState.active
                ? ('DEADEYE ' + deadeyeState.lockCount + '/' + deadeyeState.targets.length)
                : ''
        };
    };

    GameAbilities.setClass = function (_id) {
        return {
            id: profile.id,
            name: profile.name,
            armorMax: profile.armorMax,
            wallhackRadius: profile.wallhackRadius,
            loadoutWeapon: profile.loadoutWeapon
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
        return profile.armorMax;
    };

    GameAbilities.getWallhackRadius = function () {
        return profile.wallhackRadius;
    };

    GameAbilities.modifyOutgoingDamage = function (damage, _hitType, _weaponId) {
        return damage;
    };

    GameAbilities.modifyIncomingDamage = function (damage) {
        return damage;
    };

    GameAbilities.triggerAbility = function (slot, camera, _playerPos, _rotation, onEnemyHit, notifier) {
        var now = nowMs();
        var cfg = getSharedAbilityConfig();

        if (slot === 1) {
            if (now < chokeCooldownUntil) {
                return { ok: false, message: 'Choke is cooling down.' };
            }
            if (!camera || !globalThis.__MAYHEM_RUNTIME.GameHitscan || !globalThis.__MAYHEM_RUNTIME.GameHitscan.selectLockTargetByBox) {
                return { ok: false, message: 'Choke targeting unavailable.' };
            }
            var target = globalThis.__MAYHEM_RUNTIME.GameHitscan.selectLockTargetByBox(
                camera,
                cfg.choke.range,
                cfg.choke.lockBoxPx,
                { ownerType: 'local' }
            );
            if (!target || !target.hitbox) {
                return { ok: false, message: 'No target in choke reticle.' };
            }
            var result = null;
            if (globalThis.__MAYHEM_RUNTIME.GameEnemy && globalThis.__MAYHEM_RUNTIME.GameEnemy.damage) {
                result = globalThis.__MAYHEM_RUNTIME.GameEnemy.damage(target.hitbox, cfg.choke.castDamage);
            }
            if (target.enemyRef && globalThis.__MAYHEM_RUNTIME.GameEnemy && globalThis.__MAYHEM_RUNTIME.GameEnemy.applyStun) {
                globalThis.__MAYHEM_RUNTIME.GameEnemy.applyStun(target.enemyRef, cfg.choke.duration);
            }
            if (result && onEnemyHit) {
                onEnemyHit({
                    hitPoint: makeVector3Like(target.worldPos),
                    damage: cfg.choke.castDamage,
                    hitType: 'body',
                    result: result
                });
            }
            chokeCooldownUntil = now + Math.max(0, cfg.choke.cooldownMs);
            if (notifier) notifier('Choke cast.', 700);
            return { ok: true, kind: 'choke' };
        }

        if (slot === 2) {
            if (deadeyeState && deadeyeState.active) {
                return fireDeadeye(onEnemyHit, notifier, 'manual');
            }
            if (now < deadeyeCooldownUntil) {
                return { ok: false, message: 'Deadeye is cooling down.' };
            }

            var candidates = collectDeadeyeCandidates(
                camera,
                cfg.deadeye.range,
                cfg.deadeye.minDot,
                cfg.deadeye.maxTargets
            );
            if (!candidates.length) {
                return { ok: false, message: 'No Deadeye targets.' };
            }

            var durationMs = Math.max(1, Math.round(cfg.deadeye.duration * 1000));
            var lockEveryMs = Math.max(1, Math.round(durationMs / Math.max(1, cfg.deadeye.maxTargets)));
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

        return { ok: false, message: 'Unknown ability slot.' };
    };

    GameAbilities.update = function (_dt, _camera, _playerPos, _rotation, onEnemyHit, notifier) {
        if (!deadeyeState || !deadeyeState.active) return;
        var now = nowMs();
        while (deadeyeState.lockCount < deadeyeState.targets.length && now >= deadeyeState.nextLockAt) {
            deadeyeState.lockCount += 1;
            deadeyeState.nextLockAt += deadeyeState.lockEveryMs;
        }
        if (now >= deadeyeState.endsAt) {
            fireDeadeye(onEnemyHit, notifier, 'auto');
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
            chokeCooldown: cooldownSec(chokeCooldownUntil),
            deadeyeCooldown: cooldownSec(deadeyeCooldownUntil),
            deadeye: deadeyeState ? {
                lockCount: deadeyeState.lockCount,
                targetCount: deadeyeState.targets.length
            } : null
        };
    };

    globalThis.__MAYHEM_RUNTIME.GameAbilities = GameAbilities;
})();

