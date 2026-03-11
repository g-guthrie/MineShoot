(function () {
    'use strict';

    function nowMs() {
        return Date.now();
    }

    function makeVector3Like(value) {
        if (!value) return null;
        if (value.clone) return value.clone();
        return new THREE.Vector3(Number(value.x || 0), Number(value.y || 0), Number(value.z || 0));
    }

    function distanceSqXYZ(a, b) {
        if (!a || !b) return Infinity;
        var dx = Number(a.x || 0) - Number(b.x || 0);
        var dy = Number(a.y || 0) - Number(b.y || 0);
        var dz = Number(a.z || 0) - Number(b.z || 0);
        return (dx * dx) + (dy * dy) + (dz * dz);
    }

    function create(opts) {
        opts = opts || {};

        var hookState = null;
        var healState = null;
        var chokeCasterState = null;
        var deadeyeState = null;
        var losRaycaster = new THREE.Raycaster();
        var losDir = new THREE.Vector3();

        function runtime() {
            return globalThis.__MAYHEM_RUNTIME || {};
        }

        function cooldownUntilForSlot(slotIndex) {
            return opts.cooldownUntilForSlot ? opts.cooldownUntilForSlot(slotIndex) : 0;
        }

        function setCooldownForSlot(slotIndex, until) {
            if (opts.setCooldownForSlot) opts.setCooldownForSlot(slotIndex, until);
        }

        function getAbilityIdForSlot(slotIndex) {
            return opts.getAbilityIdForSlot ? opts.getAbilityIdForSlot(slotIndex) : '';
        }

        function getConfigForSlot(slotIndex) {
            return opts.getConfigForAbility ? opts.getConfigForAbility(getAbilityIdForSlot(slotIndex)) : null;
        }

        function isDebugMode() {
            return !!(opts.isDebugMode && opts.isDebugMode());
        }

        function clearHookState() {
            hookState = null;
        }

        function clearHealState() {
            healState = null;
        }

        function clearChokeCasterState() {
            chokeCasterState = null;
        }

        function clearTransientState() {
            deadeyeState = null;
            clearHookState();
            clearHealState();
            clearChokeCasterState();
        }

        function currentHookOriginWorldPosition(fallback) {
            var player = runtime().GamePlayer || null;
            if (player && player.getThrowableOriginWorldPosition) {
                var liveOrigin = player.getThrowableOriginWorldPosition();
                if (liveOrigin) return makeVector3Like(liveOrigin);
            }
            return makeVector3Like(fallback);
        }

        function hookHeadWorldPosition(state, now) {
            if (!state) return null;
            if (state.phase === 'retract') {
                var retractStart = makeVector3Like(state.retractStartPos || state.attachPos || state.endPos || state.headPos || state.startPos);
                var retractEnd = currentHookOriginWorldPosition(state.startPos);
                if (!retractStart || !retractEnd) return null;
                var retractStartedAt = Number(state.retractStartedAt || 0);
                var retractEndsAt = Math.max(retractStartedAt + 1, Number(state.endsAt || retractStartedAt + 1));
                var retractT = Math.max(0, Math.min(1, (Number(now || nowMs()) - retractStartedAt) / (retractEndsAt - retractStartedAt)));
                return retractStart.lerp(retractEnd, retractT);
            }
            if (!state.startPos || !state.endPos) return null;
            var start = makeVector3Like(state.startPos);
            var end = makeVector3Like(state.endPos);
            if (!start || !end) return null;
            var startAt = Number(state.startedAt || 0);
            var hitAt = Math.max(startAt + 1, Number(state.hitAt || startAt + 1));
            var t = Math.max(0, Math.min(1, (Number(now || nowMs()) - startAt) / (hitAt - startAt)));
            return start.lerp(end, t);
        }

        function beginHookRetract(state, now) {
            if (!state) return;
            var retractDuration = Math.max(120, Number(state.hitAt || 0) - Number(state.startedAt || 0));
            state.phase = 'retract';
            state.targetId = '';
            state.retractStartPos = makeVector3Like(state.retractStartPos || state.attachPos || state.endPos || state.headPos || state.startPos);
            state.attachPos = null;
            state.retractStartedAt = now;
            state.headPos = makeVector3Like(state.retractStartPos);
            state.endsAt = now + retractDuration;
        }

        function deadeyeOriginWorldPosition(camera) {
            var player = runtime().GamePlayer || null;
            if (player && player.getEyeWorldPosition) {
                var eye = player.getEyeWorldPosition();
                if (eye) return makeVector3Like(eye);
            }
            return camera && camera.position ? camera.position.clone() : null;
        }

        function deadeyeHasLOS(origin, targetPos, maxRange) {
            if (!origin || !targetPos) return false;
            var world = runtime().GameWorld;
            var collidables = world && world.getCollidables ? world.getCollidables() : [];
            losDir.copy(targetPos).sub(origin);
            var dist = losDir.length();
            if (dist <= 0.001 || dist > maxRange) return false;
            losDir.divideScalar(dist);
            if (!collidables || collidables.length === 0) return true;
            losRaycaster.set(origin, losDir);
            losRaycaster.far = Math.max(0, dist - 0.12);
            return losRaycaster.intersectObjects(collidables, false).length === 0;
        }

        function findHookTargetNearPoint(point, catchRadius) {
            var enemyApi = runtime().GameEnemy;
            if (!point || !enemyApi || !enemyApi.getLockTargets) return null;
            var list = enemyApi.getLockTargets() || [];
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

        function findHookTargetById(targetId) {
            var enemyApi = runtime().GameEnemy;
            if (!targetId || !enemyApi || !enemyApi.getLockTargets) return null;
            var list = enemyApi.getLockTargets() || [];
            for (var i = 0; i < list.length; i++) {
                var target = list[i];
                if (target && String(target.targetId || '') === String(targetId) && target.alive !== false) {
                    return target;
                }
            }
            return null;
        }

        function collectDeadeyeCandidates(camera, range, minDot, maxTargets) {
            var enemyApi = runtime().GameEnemy;
            if (!camera || !enemyApi || !enemyApi.getLockTargets) return [];
            var list = enemyApi.getLockTargets() || [];
            if (!list.length) return [];

            var origin = deadeyeOriginWorldPosition(camera);
            if (!origin) return [];
            var forward = new THREE.Vector3();
            camera.getWorldDirection(forward);
            var out = [];
            for (var i = 0; i < list.length; i++) {
                var target = list[i];
                if (!target || !target.worldPos || !target.hitbox) continue;
                var worldPos = makeVector3Like(target.worldPos);
                if (!worldPos) continue;
                var to = worldPos.clone().sub(origin);
                var dist = to.length();
                if (dist <= 0.001 || dist > range) continue;
                to.divideScalar(dist);
                if (forward.dot(to) < minDot) continue;
                if (!deadeyeHasLOS(origin, worldPos, range)) continue;
                out.push({
                    targetId: String(target.targetId || ''),
                    worldPos: worldPos,
                    hitbox: target.hitbox,
                    dist: dist,
                    dot: forward.dot(to)
                });
            }
            out.sort(function (a, b) {
                if (Math.abs((b.dot || 0) - (a.dot || 0)) > 0.0001) return (b.dot || 0) - (a.dot || 0);
                return a.dist - b.dist;
            });
            return out.slice(0, Math.max(1, maxTargets));
        }

        function refreshDeadeyeTargetPositions(camera, cfg) {
            var enemyApi = runtime().GameEnemy;
            if (!deadeyeState || !deadeyeState.active || !deadeyeState.targets || !enemyApi || !enemyApi.getLockTargets) return;
            var liveList = enemyApi.getLockTargets() || [];
            var byId = {};
            for (var i = 0; i < liveList.length; i++) {
                var liveTarget = liveList[i];
                if (liveTarget && liveTarget.targetId && liveTarget.worldPos) byId[liveTarget.targetId] = liveTarget;
            }

            for (var t = 0; t < deadeyeState.targets.length; t++) {
                var stored = deadeyeState.targets[t];
                if (!stored || !stored.targetId || stored.dead) continue;
                var live = byId[stored.targetId];
                if (live && live.worldPos) {
                    var nextWorldPos = makeVector3Like(live.worldPos);
                    var origin = deadeyeOriginWorldPosition(camera);
                    if (
                        camera &&
                        origin &&
                        nextWorldPos &&
                        (
                            !deadeyeHasLOS(origin, nextWorldPos, cfg && cfg.range || 80) ||
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
            var enemyApi = runtime().GameEnemy;
            if (!deadeyeState || !deadeyeState.active) {
                return { ok: false, message: 'Deadeye not active.' };
            }

            var cfg = getConfigForSlot(slotIndex) || {};
            var count = Math.max(0, Math.min(deadeyeState.targets.length, deadeyeState.lockCount));
            if (count <= 0) {
                deadeyeState = null;
                return { ok: false, message: 'No Deadeye locks acquired.' };
            }

            var origin = deadeyeOriginWorldPosition(camera);
            var landed = 0;
            for (var i = 0; i < count; i++) {
                var item = deadeyeState.targets[i];
                if (!item || item.dead || !item.hitbox || !enemyApi || !enemyApi.damage) continue;
                if (origin && item.worldPos && !deadeyeHasLOS(origin, makeVector3Like(item.worldPos), cfg.range || 70)) continue;
                var result = enemyApi.damage(item.hitbox, cfg.damage || 180);
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
            if (notifier) notifier('Deadeye fired (' + landed + ' hit).', 800);
            return { ok: landed > 0, landed: landed, reason: reason || 'manual' };
        }

        function castChoke(slotIndex, camera, onEnemyHit, notifier) {
            var RT = runtime();
            var now = nowMs();
            var cfg = getConfigForSlot(slotIndex);
            if (!cfg) return { ok: false, message: 'Choke not configured.' };
            var endsAt = now + Math.round((cfg.duration || 1.6) * 1000);

            if (!isDebugMode() && now < cooldownUntilForSlot(slotIndex)) {
                return { ok: false, message: 'Choke is cooling down.' };
            }
            if (!camera || !RT.GameHitscan || !RT.GameHitscan.selectLockTargetByRect) {
                return { ok: false, message: 'Choke targeting unavailable.' };
            }
            var chokeRectSize = opts.getChokeRectSize ? opts.getChokeRectSize(camera, cfg) : { width: 216, height: 180 };
            var target = RT.GameHitscan.selectLockTargetByRect(
                camera,
                cfg.range || 24,
                chokeRectSize.width,
                chokeRectSize.height,
                { ownerType: 'enemy' }
            );
            if (!target || !target.hitbox) {
                return { ok: false, message: 'No target in choke reticle.' };
            }
            var chokeResult = null;
            if (Number(cfg.castDamage || 0) > 0 && RT.GameEnemy && RT.GameEnemy.damage) {
                chokeResult = RT.GameEnemy.damage(target.hitbox, cfg.castDamage || 0);
            }
            if (target.enemyRef && RT.GameEnemy && RT.GameEnemy.applyStun) {
                RT.GameEnemy.applyStun(target.enemyRef, cfg.duration || 1.6);
                target.enemyRef.chokeVictimState = {
                    sourceId: 'player',
                    startedAt: now,
                    endsAt: endsAt,
                    liftHeight: Number(cfg.liftHeight || 1.0)
                };
            }
            chokeCasterState = {
                startedAt: now,
                endsAt: endsAt
            };
            if (RT.GamePlayer && RT.GamePlayer.triggerAction) {
                RT.GamePlayer.triggerAction('choke_grip', { duration: cfg.duration || 1.6 });
            }
            if (RT.GameAudio && RT.GameAudio.play) {
                RT.GameAudio.play('chokeCast');
            }
            setCooldownForSlot(slotIndex, isDebugMode() ? 0 : now + Math.max(0, cfg.cooldownMs || 0));
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

        function castHook(slotIndex, camera, playerPos, rotation, notifier) {
            var RT = runtime();
            var now = nowMs();
            var cfg = getConfigForSlot(slotIndex);
            if (!cfg) return { ok: false, message: 'Hook not configured.' };
            if (!isDebugMode() && now < cooldownUntilForSlot(slotIndex)) {
                return { ok: false, message: 'Hook is cooling down.' };
            }
            if (!camera || !playerPos || !rotation) {
                return { ok: false, message: 'Hook targeting unavailable.' };
            }
            var forward = new THREE.Vector3();
            camera.getWorldDirection(forward);
            var centerTarget = (RT.GameHitscan && RT.GameHitscan.peekCenterTarget)
                ? RT.GameHitscan.peekCenterTarget(camera, Number(cfg.range || 24))
                : null;
            var startPos = (RT.GamePlayer && RT.GamePlayer.getThrowableOriginWorldPosition)
                ? RT.GamePlayer.getThrowableOriginWorldPosition()
                : camera.position.clone();
            var endPos = centerTarget && centerTarget.point
                ? makeVector3Like(centerTarget.point)
                : camera.position.clone().addScaledVector(forward, Number(cfg.range || 24));
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
                attachPos: null,
                startedAt: now,
                hitAt: now + travelMs,
                endsAt: now + travelMs
            };
            setCooldownForSlot(slotIndex, isDebugMode() ? 0 : now + Math.max(0, cfg.cooldownMs || 0));
            if (notifier) notifier('Chain Hook out.', 550);
            return { ok: true, kind: 'hook_start' };
        }

        function castDeadeye(slotIndex, camera, onEnemyHit, notifier) {
            var now = nowMs();
            var cfg = getConfigForSlot(slotIndex);
            if (!cfg) return { ok: false, message: 'Deadeye not configured.' };

            if (deadeyeState && deadeyeState.active && deadeyeState.slotKey === opts.slotKeyForIndex(slotIndex)) {
                return fireDeadeye(slotIndex, camera, onEnemyHit, notifier, 'manual');
            }
            if (!isDebugMode() && now < cooldownUntilForSlot(slotIndex)) {
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
                slotKey: opts.slotKeyForIndex(slotIndex),
                startedAt: now,
                endsAt: now + durationMs,
                lockEveryMs: lockEveryMs,
                nextLockAt: now + lockEveryMs,
                lockCount: 0,
                targets: candidates
            };
            setCooldownForSlot(slotIndex, isDebugMode() ? 0 : now + Math.max(0, cfg.cooldownMs || 0));
            if (notifier) notifier('Deadeye primed. Press R again to fire.', 900);
            return { ok: true, kind: 'deadeye_start', targetCount: candidates.length };
        }

        function castHeal(slotIndex, notifier) {
            var now = nowMs();
            var cfg = getConfigForSlot(slotIndex);
            if (!cfg) return { ok: false, message: 'Heal not configured.' };
            if (!isDebugMode() && now < cooldownUntilForSlot(slotIndex)) {
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
            setCooldownForSlot(slotIndex, isDebugMode() ? 0 : now + Math.max(0, cfg.cooldownMs || 0));
            if (notifier) notifier('Healing...', 450);
            return { ok: true, kind: 'heal_start' };
        }

        function castMissile(slotIndex, camera, notifier) {
            var RT = runtime();
            var now = nowMs();
            var cfg = getConfigForSlot(slotIndex);
            if (!cfg) return { ok: false, message: 'Missile not configured.' };
            if (!isDebugMode() && now < cooldownUntilForSlot(slotIndex)) {
                return { ok: false, message: 'Missile is cooling down.' };
            }
            if (!camera || !RT.GameThrowables || !RT.GameThrowables.fireAbilityMissile) {
                return { ok: false, message: 'Missile launch unavailable.' };
            }
            var ok = RT.GameThrowables.fireAbilityMissile(camera, { abilityId: 'missile' });
            if (!ok) return { ok: false, message: 'Missile launch failed.' };
            if (RT.GamePlayer && RT.GamePlayer.triggerAction) {
                RT.GamePlayer.triggerAction('fire');
            }
            if (RT.GameAudio && RT.GameAudio.play) {
                RT.GameAudio.play('fire', { weapon: 'missile' });
            }
            setCooldownForSlot(slotIndex, isDebugMode() ? 0 : now + Math.max(0, cfg.cooldownMs || 0));
            if (notifier) notifier('Missile away.', 500);
            return { ok: true, kind: 'missile_launch' };
        }

        function triggerAbility(slot, camera, playerPos, rotation, onEnemyHit, notifier) {
            var castSlot = Number(slot) === 2 ? 2 : 1;
            var abilityId = getAbilityIdForSlot(castSlot);
            if (abilityId === 'choke') return castChoke(castSlot, camera, onEnemyHit, notifier);
            if (abilityId === 'hook') return castHook(castSlot, camera, playerPos, rotation, notifier);
            if (abilityId === 'missile') return castMissile(castSlot, camera, notifier);
            if (abilityId === 'heal') return castHeal(castSlot, notifier);
            if (abilityId === 'deadeye') return castDeadeye(castSlot, camera, onEnemyHit, notifier);
            return { ok: false, message: 'Unknown ability: ' + abilityId };
        }

        function update(camera, onEnemyHit, notifier) {
            var RT = runtime();
            var now = nowMs();
            if (hookState && hookState.active) {
                if (hookState.phase === 'travel') {
                    hookState.headPos = hookHeadWorldPosition(hookState, now);
                    var hookTarget = findHookTargetNearPoint(hookState.headPos, hookState.catchRadius);
                    if (hookTarget) {
                        var hookResult = null;
                        if (RT.GameEnemy && RT.GameEnemy.damage) {
                            hookResult = RT.GameEnemy.damage(hookTarget.hitbox, hookState.castDamage || 40);
                        }
                        if (RT.GameEnemy && RT.GameEnemy.pullTarget) {
                            RT.GameEnemy.pullTarget(
                                hookTarget.enemyRef,
                                hookState.playerPos,
                                hookState.playerYaw || 0,
                                hookState.pullDistance || 3.2,
                                Number(hookState.travelSpeed || 26),
                                Number(hookState.stunDuration || 0)
                            );
                        }
                        hookState.phase = 'latched';
                        hookState.targetId = String(hookTarget.targetId || '');
                        hookState.attachPos = makeVector3Like(hookTarget.worldPos);
                        hookState.headPos = makeVector3Like(hookTarget.worldPos);
                        hookState.endsAt = now + 140;
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
                        beginHookRetract(hookState, now);
                        if (notifier) notifier('Hook missed.', 500);
                    }
                } else if (hookState.phase === 'latched') {
                    var liveHookTarget = findHookTargetById(hookState.targetId);
                    if (!liveHookTarget) {
                        hookState.retractStartPos = makeVector3Like(hookState.attachPos || hookState.headPos || hookState.endPos || hookState.startPos);
                        beginHookRetract(hookState, now);
                    } else {
                        hookState.attachPos = makeVector3Like(liveHookTarget.worldPos);
                        hookState.headPos = makeVector3Like(liveHookTarget.worldPos);
                        if (now >= (hookState.endsAt || 0)) {
                            hookState.retractStartPos = makeVector3Like(hookState.attachPos || hookState.headPos || hookState.endPos || hookState.startPos);
                            beginHookRetract(hookState, now);
                        }
                    }
                } else if (hookState.phase === 'retract') {
                    hookState.headPos = hookHeadWorldPosition(hookState, now) || hookState.headPos || hookState.startPos;
                    if (now >= (hookState.endsAt || 0)) {
                        clearHookState();
                    }
                } else if (now >= (hookState.endsAt || 0)) {
                    clearHookState();
                }
            }
            if (healState && healState.active && now >= (healState.endsAt || 0)) {
                if (!healState.applied && RT.GamePlayerCombat && RT.GamePlayerCombat.heal) {
                    RT.GamePlayerCombat.heal(healState.healAmount || 150);
                    healState.applied = true;
                }
                clearHealState();
            }
            if (chokeCasterState && now >= (chokeCasterState.endsAt || 0)) {
                clearChokeCasterState();
            }
            if (!deadeyeState || !deadeyeState.active) return;

            var deadeyeCfg = opts.getConfigForAbility ? opts.getConfigForAbility(deadeyeState.abilityId) || {} : {};
            refreshDeadeyeTargetPositions(camera, deadeyeCfg);
            deadeyeState.targets = deadeyeState.targets.filter(function (target) { return target && !target.dead; });
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
        }

        function getHookState() {
            return hookState && hookState.active ? {
                targetId: hookState.targetId,
                phase: hookState.phase,
                startPos: hookState.startPos ? makeVector3Like(hookState.startPos) : null,
                endPos: hookState.endPos ? makeVector3Like(hookState.endPos) : null,
                headPos: hookState.headPos ? makeVector3Like(hookState.headPos) : null,
                attachPos: hookState.attachPos ? makeVector3Like(hookState.attachPos) : null,
                catchRadius: Number(hookState.catchRadius || 1.8),
                startedAt: hookState.startedAt || 0,
                hitAt: hookState.hitAt || 0,
                endsAt: hookState.endsAt
            } : null;
        }

        function getHealState() {
            return healState && healState.active ? {
                startedAt: healState.startedAt,
                endsAt: healState.endsAt,
                healAmount: healState.healAmount || 100
            } : null;
        }

        function getChokeState() {
            return chokeCasterState ? {
                startedAt: chokeCasterState.startedAt || 0,
                endsAt: chokeCasterState.endsAt || 0
            } : null;
        }

        function getSnapshot() {
            return {
                deadeyeActive: !!(deadeyeState && deadeyeState.active),
                deadeyeState: deadeyeState,
                chokeState: getChokeState(),
                healState: getHealState(),
                hookState: getHookState()
            };
        }

        return {
            clearTransientState: clearTransientState,
            getSnapshot: getSnapshot,
            triggerAbility: triggerAbility,
            update: update
        };
    }

    globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    globalThis.__MAYHEM_RUNTIME.GameAbilityLocalSim = {
        create: create
    };
})();
