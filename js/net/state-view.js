/**
 * state-view.js - Read-only selectors and queue consumers for GameNet.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameNetStateView
 */
(function () {
    'use strict';

    function shiftQueue(queue) {
        if (!queue || !queue.length) return null;
        return queue.shift();
    }

    function cloneJsonLike(value) {
        if (value === null || typeof value !== 'object') return value;
        if (Array.isArray(value)) {
            var list = new Array(value.length);
            for (var i = 0; i < value.length; i++) {
                list[i] = cloneJsonLike(value[i]);
            }
            return list;
        }
        var out = {};
        for (var key in value) {
            if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
            out[key] = cloneJsonLike(value[key]);
        }
        return out;
    }

    function normalizeAngle(rad) {
        while (rad > Math.PI) rad -= Math.PI * 2;
        while (rad < -Math.PI) rad += Math.PI * 2;
        return rad;
    }

    function create(opts) {
        opts = opts || {};

        function clonePendingInputEntry(entry, defaultDtMs) {
            if (!entry) return null;
            return {
                seq: Number(entry.seq || 0),
                at: Number(entry.at || 0),
                dtMs: Math.max(1, Number(entry.dtMs || defaultDtMs)),
                yaw: Number(entry.yaw || 0),
                pitch: Number(entry.pitch || 0),
                inputState: entry.inputState ? {
                    forward: !!entry.inputState.forward,
                    backward: !!entry.inputState.backward,
                    left: !!entry.inputState.left,
                    right: !!entry.inputState.right,
                    jump: !!entry.inputState.jump,
                    sprint: !!entry.inputState.sprint,
                    adsActive: !!entry.inputState.adsActive
                } : null
            };
        }

        function getRemoteSnapshotTiming() {
            return opts.getRemoteSnapshotTiming ? opts.getRemoteSnapshotTiming() : null;
        }

        function getRemotePresentationClock(localNowMs) {
            var now = Math.max(0, Number(localNowMs || Date.now()));
            var timing = getRemoteSnapshotTiming();
            if (!timing || !(Number(timing.latestServerTime || 0) > 0)) return null;
            var cadenceMs = Math.max(1, Number(timing.cadenceMs || 0) || 33);
            var renderDelayMs = Math.max(66, Math.min(132, cadenceMs * 3));
            var estimatedServerNowMs = now - Number(timing.clockOffsetMs || 0);
            if (!isFinite(estimatedServerNowMs)) {
                estimatedServerNowMs = Number(timing.latestServerTime || 0);
            }
            var renderServerTimeMs = estimatedServerNowMs - renderDelayMs;
            if (!isFinite(renderServerTimeMs)) {
                renderServerTimeMs = Number(timing.latestServerTime || 0);
            }
            renderServerTimeMs = Math.min(Number(timing.latestServerTime || 0), renderServerTimeMs);
            return {
                latestServerTimeMs: Number(timing.latestServerTime || 0),
                latestReceivedAtMs: Number(timing.latestReceivedAt || 0),
                clockOffsetMs: Number(timing.clockOffsetMs || 0),
                cadenceMs: cadenceMs,
                renderDelayMs: renderDelayMs,
                estimatedServerNowMs: Number(estimatedServerNowMs.toFixed(3)),
                renderServerTimeMs: Number(renderServerTimeMs.toFixed(3))
            };
        }

        function cloneRemotePresentationSample(sample) {
            return sample ? {
                serverTime: Number(sample.serverTime || 0),
                x: Number(sample.x || 0),
                y: Number(sample.y || 0),
                z: Number(sample.z || 0),
                yaw: Number(sample.yaw || 0),
                pitch: Number(sample.pitch || 0),
                moveSpeedNorm: Number(sample.moveSpeedNorm || 0),
                sprinting: !!sample.sprinting,
                movingForward: !!sample.movingForward,
                movingBackward: !!sample.movingBackward,
                isGrounded: sample.isGrounded !== false,
                velocityY: Number(sample.velocityY || 0),
                weaponId: String(sample.weaponId || 'rifle')
            } : null;
        }

        function sampleRemoteEntityPresentation(entityId, localNowMs) {
            var history = opts.getRemoteSnapshotTimeline ? opts.getRemoteSnapshotTimeline(entityId) : null;
            if (!Array.isArray(history) || history.length === 0) return null;
            var clock = getRemotePresentationClock(localNowMs);
            var targetServerTime = clock ? Number(clock.renderServerTimeMs || 0) : Number(history[history.length - 1].serverTime || 0);
            if (!(targetServerTime > 0)) {
                return cloneRemotePresentationSample(history[history.length - 1]);
            }
            if (history.length === 1 || targetServerTime <= Number(history[0].serverTime || 0)) {
                return cloneRemotePresentationSample(history[0]);
            }
            for (var i = 1; i < history.length; i++) {
                var prev = history[i - 1];
                var next = history[i];
                var prevTime = Number(prev && prev.serverTime || 0);
                var nextTime = Number(next && next.serverTime || 0);
                if (targetServerTime > nextTime) continue;
                var spanMs = Math.max(1, nextTime - prevTime);
                var t = Math.max(0, Math.min(1, (targetServerTime - prevTime) / spanMs));
                var base = t < 0.5 ? prev : next;
                return {
                    serverTime: Number(targetServerTime.toFixed(3)),
                    x: Number((Number(prev.x || 0) + ((Number(next.x || 0) - Number(prev.x || 0)) * t)).toFixed(4)),
                    y: Number((Number(prev.y || 0) + ((Number(next.y || 0) - Number(prev.y || 0)) * t)).toFixed(4)),
                    z: Number((Number(prev.z || 0) + ((Number(next.z || 0) - Number(prev.z || 0)) * t)).toFixed(4)),
                    yaw: Number((Number(prev.yaw || 0) + (normalizeAngle(Number(next.yaw || 0) - Number(prev.yaw || 0)) * t)).toFixed(4)),
                    pitch: Number((Number(prev.pitch || 0) + ((Number(next.pitch || 0) - Number(prev.pitch || 0)) * t)).toFixed(4)),
                    moveSpeedNorm: Number((Number(prev.moveSpeedNorm || 0) + ((Number(next.moveSpeedNorm || 0) - Number(prev.moveSpeedNorm || 0)) * t)).toFixed(4)),
                    sprinting: !!(base && base.sprinting),
                    movingForward: !!(base && base.movingForward),
                    movingBackward: !!(base && base.movingBackward),
                    isGrounded: !base || base.isGrounded !== false,
                    velocityY: Number(base && base.velocityY || 0),
                    weaponId: String(base && base.weaponId || 'rifle')
                };
            }
            return cloneRemotePresentationSample(history[history.length - 1]);
        }

        function getExpectedWorldMeta() {
            var expected = opts.buildExpectedWorldMeta(opts.getRoomId());
            return {
                roomId: expected.roomId,
                worldSeed: expected.worldSeed,
                worldProfileVersion: expected.worldProfileVersion,
                worldFlags: opts.cloneWorldFlags(expected.worldFlags)
            };
        }

        function getWorldMeta() {
            var worldMeta = opts.getWorldMeta();
            if (!worldMeta) return null;
            return {
                roomId: worldMeta.roomId,
                worldSeed: worldMeta.worldSeed,
                worldProfileVersion: worldMeta.worldProfileVersion,
                worldFlags: opts.cloneWorldFlags(worldMeta.worldFlags)
            };
        }

        function getEntityStateList() {
            var out = [];
            opts.getRenderMap().forEach(function (r) {
                out.push({
                    id: r.id,
                    kind: r.kind,
                    username: r.username,
                    classId: r.classId,
                    hp: r.hp,
                    hpMax: r.hpMax,
                    armor: r.armor,
                    armorMax: r.armorMax,
                    alive: r.alive,
                    worldPos: r.group.position,
                    headY: 2.45,
                    targetId: 'net:' + r.id,
                    healState: r.healState || null
                });
            });
            return out;
        }

        function getAuthoritativeSelfState() {
            var selfState = opts.getSelfState();
            return selfState ? cloneJsonLike(selfState) : null;
        }

        function getAuthoritativeThrowableState() {
            var selfState = opts.getSelfState();
            return {
                projectiles: opts.getRemoteProjectileState().slice(),
                fireZones: opts.getRemoteFireZoneState().slice(),
                selfThrowables: (selfState && selfState.throwables) ? selfState.throwables : null
            };
        }

        function getSelfAbilityState() {
            var selfState = opts.getSelfState();
            if (!selfState) return null;
            var abilityFxView = globalThis.__MAYHEM_RUNTIME.GameAbilityFx;
            var snapshotAbilityState = abilityFxView && abilityFxView.buildSnapshotAbilityState
                ? abilityFxView.buildSnapshotAbilityState(selfState)
                : {
                    chokeState: null,
                    hookState: null,
                    healState: null
                };
            return {
                slot1CooldownRemaining: selfState.slot1CooldownRemaining || 0,
                slot2CooldownRemaining: selfState.slot2CooldownRemaining || 0,
                abilityCooldownRemaining: selfState.abilityCooldownRemaining || 0,
                ultimateCooldownRemaining: selfState.ultimateCooldownRemaining || 0,
                weaponLoadout: selfState.weaponLoadout || null,
                abilityLoadout: selfState.abilityLoadout || null,
                chokeState: snapshotAbilityState.chokeState,
                hookState: snapshotAbilityState.hookState,
                healState: snapshotAbilityState.healState,
                deadeyeState: selfState.deadeyeState || null
            };
        }

        function getMatchState() {
            var matchState = opts.getMatchState();
            return matchState ? JSON.parse(JSON.stringify(matchState)) : null;
        }

        function getInputSyncState() {
            var inputSeqHistory = opts.getInputSeqHistory();
            var latestPending = inputSeqHistory.length > 0 ? inputSeqHistory[inputSeqHistory.length - 1] : null;
            return {
                lastSentSeq: opts.getLastInputSeqSent(),
                lastAckedSeq: opts.getLastInputSeqAcked(),
                pendingInputCount: inputSeqHistory.length,
                hasUnsentInputTail: false,
                latestPendingAgeMs: latestPending ? Math.max(0, Date.now() - Number(latestPending.at || 0)) : 0
            };
        }

        function getSelfReconciliationState() {
            var authoritativeState = getAuthoritativeSelfState();
            if (!authoritativeState) return null;
            var inputSyncState = getInputSyncState();
            return {
                authoritativeState: authoritativeState,
                pendingInputs: getPendingInputSamples(),
                pendingInputCount: Number(inputSyncState.pendingInputCount || 0),
                hasUnsentInputTail: !!inputSyncState.hasUnsentInputTail,
                lastSentSeq: Number(inputSyncState.lastSentSeq || 0),
                lastAckedSeq: Number(inputSyncState.lastAckedSeq || 0),
                latestPendingAgeMs: Number(inputSyncState.latestPendingAgeMs || 0)
            };
        }

        function getPendingInputSamples() {
            var inputSeqHistory = opts.getInputSeqHistory();
            if (!inputSeqHistory.length) return [];
            var out = [];
            var defaultDtMs = Math.round(opts.getInputSendInterval() * 1000);
            for (var i = 0; i < inputSeqHistory.length; i++) {
                var entry = clonePendingInputEntry(inputSeqHistory[i], defaultDtMs);
                if (!entry) continue;
                out.push(entry);
            }
            return out;
        }

        function getRespawnState() {
            var pendingRespawnInfo = opts.getPendingRespawnInfo();
            if (!pendingRespawnInfo || !pendingRespawnInfo.active) return null;
            return {
                active: true,
                respawnAt: Number(pendingRespawnInfo.respawnAt || 0),
                remainingMs: Math.max(0, Number(pendingRespawnInfo.respawnAt || 0) - Date.now())
            };
        }

        function getEntityName(entityId) {
            var id = String(entityId || '');
            var selfState = opts.getSelfState();
            if (!id) return '';
            if (selfState && id === opts.getSelfId()) return String(selfState.username || selfState.id || '');
            var snapshotEntity = opts.getSnapshotMap().get(id);
            if (snapshotEntity) return String(snapshotEntity.username || snapshotEntity.id || '');
            var render = opts.getRenderMap().get(id);
            return render ? String(render.username || render.id || '') : '';
        }

        function getLockTargets() {
            var out = [];
            opts.getRenderMap().forEach(function (r) {
                if (!r || !r.alive) return;
                var worldPos = opts.getRenderCoreWorldPosition(r, new THREE.Vector3());
                if (!worldPos) return;
                out.push({
                    targetId: 'net:' + r.id,
                    ownerType: 'net',
                    worldPos: worldPos,
                    hitbox: r.bodyHitbox || null,
                    bodyHitbox: r.bodyHitbox || null,
                    headHitbox: r.headHitbox || null,
                    alive: true,
                    netEntityId: r.id
                });
            });
            return out;
        }

        return {
            getExpectedWorldMeta: getExpectedWorldMeta,
            getWorldMeta: getWorldMeta,
            getEntityStateList: getEntityStateList,
            getAuthoritativeSelfState: getAuthoritativeSelfState,
            getSelfState: getAuthoritativeSelfState,
            getAuthoritativeThrowableState: getAuthoritativeThrowableState,
            getSelfAbilityState: getSelfAbilityState,
            getMatchState: getMatchState,
            getInputSyncState: getInputSyncState,
            getSelfReconciliationState: getSelfReconciliationState,
            getPendingInputSamples: getPendingInputSamples,
            getRespawnState: getRespawnState,
            getRemotePresentationClock: getRemotePresentationClock,
            sampleRemoteEntityPresentation: sampleRemoteEntityPresentation,
            getGameMode: function () { return opts.getGameMode() || ''; },
            getPrivateRoomPhase: function () { return opts.getPrivateRoomPhase() || ''; },
            getEntityName: getEntityName,
            getLockTargets: getLockTargets,
            damagePointForEntityId: function (entityId) {
                return opts.damagePointForEntityId ? opts.damagePointForEntityId(entityId) : null;
            },
            getEntityMarkerWorldPos: function (entityId) { return opts.markerPointForEntityId(entityId); },
            getChokeVictimStateForEntity: function (entityId) { return opts.getChokeVictimStateForEntity(entityId); },
            consumeNotice: function () { return opts.consumeNotice(); },
            consumeThrowAck: function () { return shiftQueue(opts.throwAckQueue); },
            consumeThrowReject: function () { return shiftQueue(opts.throwRejectQueue); },
            consumeThrowableEvent: function () { return shiftQueue(opts.throwableEventQueue); },
            consumeAbilityEvent: function () { return shiftQueue(opts.abilityEventQueue); },
            consumeClassCastResult: function () { return shiftQueue(opts.classCastResultQueue); },
            consumeDamageFeedback: function () { return shiftQueue(opts.damageFeedbackQueue); },
            consumeIncomingDamageFeedback: function () { return shiftQueue(opts.incomingDamageFeedbackQueue); }
        };
    }

    globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    globalThis.__MAYHEM_RUNTIME.GameNetStateView = {
        create: create
    };
})();
