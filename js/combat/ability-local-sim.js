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

    function copyVector3Like(out, value) {
        if (!out || !value) return null;
        return out.set(Number(value.x || 0), Number(value.y || 0), Number(value.z || 0));
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
        var chokeCasterState = null;
        var deadeyeState = null;
        var losRaycaster = new THREE.Raycaster();
        var losDir = new THREE.Vector3();
        var hookScratchStart = new THREE.Vector3();
        var hookScratchEnd = new THREE.Vector3();
        var hookScratchHead = new THREE.Vector3();
        var hookForwardScratch = new THREE.Vector3();
        var deadeyeOriginScratch = new THREE.Vector3();
        var deadeyeForwardScratch = new THREE.Vector3();
        var deadeyeWorldPosScratch = new THREE.Vector3();
        var deadeyeToScratch = new THREE.Vector3();

        function setVectorField(target, key, value) {
            if (!target) return null;
            if (!value) {
                target[key] = null;
                return null;
            }
            if (!target[key]) target[key] = new THREE.Vector3();
            return copyVector3Like(target[key], value);
        }

        function runtime() {
            return globalThis.__MAYHEM_RUNTIME || {};
        }

        function cooldownUntil() {
            return opts.cooldownUntil ? opts.cooldownUntil() : 0;
        }

        function setCooldownUntil(until) {
            if (opts.setCooldownUntil) opts.setCooldownUntil(until);
        }

        function getAbilityId() {
            return opts.getAbilityId ? opts.getAbilityId() : '';
        }

        function getConfig() {
            return opts.getConfigForAbility ? opts.getConfigForAbility(getAbilityId()) : null;
        }

        function isDebugMode() {
            return !!(opts.isDebugMode && opts.isDebugMode());
        }

        function clearHookState() {
            hookState = null;
            syncActionRestrictions();
        }

        function clearChokeCasterState() {
            chokeCasterState = null;
        }

        function clearTransientState() {
            deadeyeState = null;
            clearHookState();
            clearChokeCasterState();
            syncActionRestrictions();
        }

        function syncActionRestrictions() {
            var player = runtime().GamePlayer || null;
            if (!player || !player.setActionRestrictions) return;
            var weaponUntil = 0;
            var throwableUntil = 0;
            if (hookState && hookState.active) {
                weaponUntil = Math.max(weaponUntil, Number(hookState.lockEndsAt || hookState.endsAt || 0));
                throwableUntil = Math.max(throwableUntil, Number(hookState.lockEndsAt || hookState.endsAt || 0));
            }
            if (deadeyeState && deadeyeState.active) {
                weaponUntil = Math.max(weaponUntil, Number(deadeyeState.lockEndsAt || deadeyeState.endsAt || 0));
                throwableUntil = Math.max(throwableUntil, Number(deadeyeState.lockEndsAt || deadeyeState.endsAt || 0));
            }
            player.setActionRestrictions({
                weaponUntil: weaponUntil,
                throwableUntil: throwableUntil,
                abilityUntil: 0
            });
        }

        function currentHookOriginWorldPosition(out, fallback) {
            var player = runtime().GamePlayer || null;
            if (player && player.getThrowableOriginWorldPosition) {
                var liveOrigin = player.getThrowableOriginWorldPosition(out || hookScratchStart);
                if (liveOrigin) return copyVector3Like(out, liveOrigin);
            }
            return copyVector3Like(out, fallback);
        }

        function hookHeadWorldPosition(state, now, out) {
            if (!state) return null;
            if (state.phase === 'retract') {
                var retractStart = copyVector3Like(hookScratchStart, state.retractStartPos || state.attachPos || state.endPos || state.headPos || state.startPos);
                var retractEnd = currentHookOriginWorldPosition(hookScratchEnd, state.startPos);
                if (!retractStart || !retractEnd) return null;
                var retractStartedAt = Number(state.retractStartedAt || 0);
                var retractEndsAt = Math.max(retractStartedAt + 1, Number(state.endsAt || retractStartedAt + 1));
                var retractT = Math.max(0, Math.min(1, (Number(now || nowMs()) - retractStartedAt) / (retractEndsAt - retractStartedAt)));
                return out ? copyVector3Like(out, retractStart).lerp(retractEnd, retractT) : retractStart.lerp(retractEnd, retractT);
            }
            if (!state.startPos || !state.endPos) return null;
            var start = copyVector3Like(hookScratchStart, state.startPos);
            var end = copyVector3Like(hookScratchEnd, state.endPos);
            if (!start || !end) return null;
            var startAt = Number(state.startedAt || 0);
            var hitAt = Math.max(startAt + 1, Number(state.hitAt || startAt + 1));
            var t = Math.max(0, Math.min(1, (Number(now || nowMs()) - startAt) / (hitAt - startAt)));
            return out ? copyVector3Like(out, start).lerp(end, t) : start.lerp(end, t);
        }

        function beginHookRetract(state, now) {
            if (!state) return;
            var retractDuration = Math.max(120, Number(state.hitAt || 0) - Number(state.startedAt || 0));
            state.phase = 'retract';
            state.targetId = '';
            setVectorField(state, 'retractStartPos', state.retractStartPos || state.attachPos || state.endPos || state.headPos || state.startPos);
            state.attachPos = null;
            state.retractStartedAt = now;
            setVectorField(state, 'headPos', state.retractStartPos);
            state.endsAt = now + retractDuration;
        }

        function deadeyeOriginWorldPosition(camera, out) {
            var player = runtime().GamePlayer || null;
            if (player && player.getEyeWorldPosition) {
                var eye = player.getEyeWorldPosition(out || deadeyeOriginScratch);
                if (eye) return copyVector3Like(out, eye);
            }
            return camera && camera.position ? copyVector3Like(out, camera.position) : null;
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
                if (!deadeyeHasLOS(point, target.worldPos, Math.sqrt(distSq) + 0.25)) continue;
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
            if (!camera) return [];
            var list = [];
            var enemyApi = runtime().GameEnemy;
            if (enemyApi && enemyApi.getLockTargets) {
                var localTargets = enemyApi.getLockTargets() || [];
                for (var li = 0; li < localTargets.length; li++) list.push(localTargets[li]);
            }
            var net = runtime().GameNet || null;
            var netView = net && net.view ? net.view : net;
            if (netView && netView.getLockTargets) {
                var netTargets = netView.getLockTargets() || [];
                for (var ni = 0; ni < netTargets.length; ni++) list.push(netTargets[ni]);
            }
            if (!list.length) return [];

            var origin = deadeyeOriginWorldPosition(camera, deadeyeOriginScratch);
            if (!origin) return [];
            var forward = deadeyeForwardScratch;
            camera.getWorldDirection(forward);
            var out = [];
            for (var i = 0; i < list.length; i++) {
                var target = list[i];
                if (!target || !target.worldPos || !target.hitbox) continue;
                var worldPos = copyVector3Like(deadeyeWorldPosScratch, target.worldPos);
                if (!worldPos) continue;
                var to = deadeyeToScratch.copy(worldPos).sub(origin);
                var dist = to.length();
                if (dist <= 0.001 || dist > range) continue;
                to.divideScalar(dist);
                if (forward.dot(to) < minDot) continue;
                if (!deadeyeHasLOS(origin, worldPos, range)) continue;
                out.push({
                    targetId: String(target.targetId || ''),
                    worldPos: makeVector3Like(worldPos),
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
                    var nextWorldPos = copyVector3Like(deadeyeWorldPosScratch, live.worldPos);
                    var origin = deadeyeOriginWorldPosition(camera, deadeyeOriginScratch);
                    var forward = deadeyeForwardScratch;
                    if (camera && camera.getWorldDirection) camera.getWorldDirection(forward);
                    if (
                        camera &&
                        origin &&
                        nextWorldPos &&
                        (
                            !deadeyeHasLOS(origin, nextWorldPos, cfg && cfg.range || 80) ||
                            forward.dot(deadeyeToScratch.copy(nextWorldPos).sub(origin).normalize()) < Number(cfg && cfg.minDot || 0.18)
                        )
                    ) {
                        stored.dead = true;
                    } else {
                        stored.worldPos = stored.worldPos
                            ? copyVector3Like(stored.worldPos, nextWorldPos)
                            : makeVector3Like(nextWorldPos);
                        if (live.hitbox) stored.hitbox = live.hitbox;
                    }
                } else {
                    stored.dead = true;
                }
            }
        }

        function fireDeadeye(camera, onEnemyHit, notifier, reason) {
            var enemyApi = runtime().GameEnemy;
            if (!deadeyeState || !deadeyeState.active) {
                return { ok: false, message: 'Deadeye not active.' };
            }

            var cfg = getConfig() || {};
            var count = Math.max(0, Math.min(deadeyeState.targets.length, deadeyeState.lockCount));
            if (count <= 0) {
                deadeyeState = null;
                syncActionRestrictions();
                return { ok: false, message: 'No Deadeye locks acquired.' };
            }

            var origin = deadeyeOriginWorldPosition(camera, deadeyeOriginScratch);
            var landed = 0;
            for (var i = 0; i < count; i++) {
                var item = deadeyeState.targets[i];
                if (!item || item.dead || !item.hitbox || !enemyApi || !enemyApi.damage) continue;
                if (origin && item.worldPos && !deadeyeHasLOS(origin, item.worldPos, cfg.range || 70)) continue;
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
            syncActionRestrictions();
            if (notifier) notifier('Deadeye fired (' + landed + ' hit).', 800);
            return { ok: landed > 0, landed: landed, reason: reason || 'manual' };
        }

        function castChoke(camera, onEnemyHit, notifier) {
            var RT = runtime();
            var now = nowMs();
            var cfg = getConfig();
            if (!cfg) return { ok: false, message: 'Choke not configured.' };
            var endsAt = now + Math.round((cfg.duration || 1.6) * 1000);

            if (!isDebugMode() && now < cooldownUntil()) {
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
            setCooldownUntil(isDebugMode() ? 0 : now + Math.max(0, cfg.cooldownMs || 0));
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

        function castHook(camera, playerPos, rotation, notifier) {
            var RT = runtime();
            var now = nowMs();
            var cfg = getConfig();
            if (!cfg) return { ok: false, message: 'Hook not configured.' };
            if (!isDebugMode() && now < cooldownUntil()) {
                return { ok: false, message: 'Hook is cooling down.' };
            }
            if (!camera || !playerPos || !rotation) {
                return { ok: false, message: 'Hook targeting unavailable.' };
            }
            var forward = hookForwardScratch;
            camera.getWorldDirection(forward);
            var centerTarget = (RT.GameHitscan && RT.GameHitscan.peekCenterTarget)
                ? RT.GameHitscan.peekCenterTarget(camera, Number(cfg.range || 24))
                : null;
            var startPos = (RT.GamePlayer && RT.GamePlayer.getThrowableOriginWorldPosition)
                ? makeVector3Like(RT.GamePlayer.getThrowableOriginWorldPosition(hookScratchStart))
                : copyVector3Like(hookScratchStart, camera.position);
            var endPos = centerTarget && centerTarget.point
                ? makeVector3Like(centerTarget.point)
                : copyVector3Like(hookScratchEnd, camera.position).addScaledVector(forward, Number(cfg.range || 24));
            var travelDistance = Math.max(1, endPos.distanceTo(startPos));
            var travelSpeed = Math.max(8, Number(cfg.travelSpeed || 24));
            var travelMs = Math.max(120, Math.round((travelDistance / travelSpeed) * 1000));
            hookState = {
                active: true,
                phase: 'travel',
                targetId: '',
                catchRadius: Number(cfg.catchRadius || 1.6),
                pullDistance: Number(cfg.pullDistance || 3.2),
                stunDuration: Number(cfg.stunDuration || 0.5),
                castDamage: Number(cfg.castDamage || 35),
                travelSpeed: Number(cfg.travelSpeed || 24),
                pullSpeed: Number(cfg.pullSpeed || cfg.travelSpeed || 24),
                playerPos: makeVector3Like(playerPos),
                playerYaw: Number(rotation.yaw || 0),
                startPos: startPos,
                endPos: endPos,
                headPos: makeVector3Like(startPos),
                attachPos: null,
                startedAt: now,
                hitAt: now + travelMs,
                endsAt: now + travelMs,
                lockEndsAt: now + travelMs
            };
            syncActionRestrictions();
            setCooldownUntil(isDebugMode() ? 0 : now + Math.max(0, cfg.cooldownMs || 0));
            if (notifier) notifier('Chain Hook out.', 550);
            return { ok: true, kind: 'hook_start' };
        }

        function castDeadeye(camera, onEnemyHit, notifier) {
            var now = nowMs();
            var cfg = getConfig();
            if (!cfg) return { ok: false, message: 'Deadeye not configured.' };

            if (deadeyeState && deadeyeState.active) {
                return fireDeadeye(camera, onEnemyHit, notifier, 'manual');
            }
            if (!isDebugMode() && now < cooldownUntil()) {
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
                abilityId: getAbilityId(),
                startedAt: now,
                endsAt: now + durationMs,
                lockEveryMs: lockEveryMs,
                nextLockAt: now + lockEveryMs,
                lockCount: 0,
                targets: candidates,
                lockEndsAt: now + durationMs
            };
            syncActionRestrictions();
            setCooldownUntil(isDebugMode() ? 0 : now + Math.max(0, cfg.cooldownMs || 0));
            if (notifier) notifier('Deadeye primed. Press ' + runtime().GameInputLabels.getBindingLabel('ability_1', 'E') + ' again to fire.', 900);
            return { ok: true, kind: 'deadeye_start', targetCount: candidates.length };
        }

        function castMissile(camera, notifier) {
            var RT = runtime();
            var now = nowMs();
            var cfg = getConfig();
            if (!cfg) return { ok: false, message: 'Missile not configured.' };
            if (!isDebugMode() && now < cooldownUntil()) {
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
            setCooldownUntil(isDebugMode() ? 0 : now + Math.max(0, cfg.cooldownMs || 0));
            if (notifier) notifier('Missile away.', 500);
            return { ok: true, kind: 'missile_launch' };
        }

        function triggerAbility(camera, playerPos, rotation, onEnemyHit, notifier) {
            var abilityId = getAbilityId();
            if (abilityId === 'choke') return castChoke(camera, onEnemyHit, notifier);
            if (abilityId === 'hook') return castHook(camera, playerPos, rotation, notifier);
            if (abilityId === 'missile') return castMissile(camera, notifier);
            if (abilityId === 'deadeye') return castDeadeye(camera, onEnemyHit, notifier);
            return { ok: false, message: 'Unknown ability: ' + abilityId };
        }

        function update(camera, onEnemyHit, notifier) {
            var RT = runtime();
            var now = nowMs();
            if (hookState && hookState.active) {
                if (hookState.phase === 'travel') {
                    setVectorField(hookState, 'headPos', hookHeadWorldPosition(hookState, now, hookScratchHead));
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
                                Number(hookState.pullSpeed || hookState.travelSpeed || 26),
                                Number(hookState.stunDuration || 0)
                            );
                        }
                        hookState.phase = 'latched';
                        hookState.targetId = String(hookTarget.targetId || '');
                        setVectorField(hookState, 'attachPos', hookTarget.worldPos);
                        setVectorField(hookState, 'headPos', hookTarget.worldPos);
                        hookState.endsAt = now + 140;
                        hookState.lockEndsAt = hookState.endsAt;
                        syncActionRestrictions();
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
                        hookState.lockEndsAt = hookState.endsAt;
                        syncActionRestrictions();
                        if (notifier) notifier('Hook missed.', 500);
                    }
                } else if (hookState.phase === 'latched') {
                    var liveHookTarget = findHookTargetById(hookState.targetId);
                    if (!liveHookTarget) {
                        setVectorField(hookState, 'retractStartPos', hookState.attachPos || hookState.headPos || hookState.endPos || hookState.startPos);
                        beginHookRetract(hookState, now);
                    } else {
                        setVectorField(hookState, 'attachPos', liveHookTarget.worldPos);
                        setVectorField(hookState, 'headPos', liveHookTarget.worldPos);
                        if (now >= (hookState.endsAt || 0)) {
                            setVectorField(hookState, 'retractStartPos', hookState.attachPos || hookState.headPos || hookState.endPos || hookState.startPos);
                            beginHookRetract(hookState, now);
                            hookState.lockEndsAt = hookState.endsAt;
                            syncActionRestrictions();
                        }
                    }
                } else if (hookState.phase === 'retract') {
                    setVectorField(hookState, 'headPos', hookHeadWorldPosition(hookState, now, hookScratchHead) || hookState.headPos || hookState.startPos);
                    if (now >= (hookState.endsAt || 0)) {
                        clearHookState();
                    }
                } else if (now >= (hookState.endsAt || 0)) {
                    clearHookState();
                }
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
                syncActionRestrictions();
                return;
            }
            while (deadeyeState.lockCount < deadeyeState.targets.length && now >= deadeyeState.nextLockAt) {
                deadeyeState.lockCount += 1;
                deadeyeState.nextLockAt += deadeyeState.lockEveryMs;
            }
            if (now >= deadeyeState.endsAt) {
                fireDeadeye(camera, onEnemyHit, notifier, 'auto');
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
                pullSpeed: Number(hookState.pullSpeed || hookState.travelSpeed || 26),
                startedAt: hookState.startedAt || 0,
                hitAt: hookState.hitAt || 0,
                endsAt: hookState.endsAt
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
