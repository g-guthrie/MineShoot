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

    function create(opts) {
        opts = opts || {};

        function sharedApi() {
            return opts.getSharedApi ? (opts.getSharedApi() || {}) : (globalThis.__MAYHEM_RUNTIME.GameShared || {});
        }

        function abilityFxApi() {
            return opts.getAbilityFxApi ? (opts.getAbilityFxApi() || null) : (globalThis.__MAYHEM_RUNTIME.GameAbilityFx || null);
        }

        function readArray(name) {
            var fn = opts[name];
            var value = typeof fn === 'function' ? fn() : [];
            return Array.isArray(value) ? value : [];
        }

        function readMap(name) {
            var fn = opts[name];
            var value = typeof fn === 'function' ? fn() : null;
            return value instanceof Map ? value : new Map();
        }

        function cloneInputState(inputState) {
            return inputState ? {
                forward: !!inputState.forward,
                backward: !!inputState.backward,
                left: !!inputState.left,
                right: !!inputState.right,
                jump: !!inputState.jump,
                sprint: !!inputState.sprint,
                adsActive: !!inputState.adsActive
            } : null;
        }

        function inputStatesEqual(a, b) {
            var left = cloneInputState(a);
            var right = cloneInputState(b);
            if (!left && !right) return true;
            if (!left || !right) return false;
            return left.forward === right.forward &&
                left.backward === right.backward &&
                left.left === right.left &&
                left.right === right.right &&
                left.jump === right.jump &&
                left.sprint === right.sprint &&
                left.adsActive === right.adsActive;
        }

        function hasActiveIntent(inputState) {
            var state = cloneInputState(inputState);
            return !!(state && (
                state.forward ||
                state.backward ||
                state.left ||
                state.right ||
                state.jump ||
                state.sprint
            ));
        }

        function clamp(value, min, max) {
            return Math.max(min, Math.min(max, value));
        }

        function normalizeAngle(rad) {
            var value = Number(rad || 0);
            while (value > Math.PI) value -= Math.PI * 2;
            while (value < -Math.PI) value += Math.PI * 2;
            return value;
        }

        function lerpNumber(a, b, t) {
            return Number(a || 0) + ((Number(b || 0) - Number(a || 0)) * t);
        }

        function choosePresentationValue(olderValue, newerValue, t) {
            return t >= 0.5 ? newerValue : olderValue;
        }

        function buildRemotePresentationSample(older, newer, t, serverTime) {
            var sampleT = clamp(Number(t || 0), 0, 1);
            var base = older || newer || null;
            var head = newer || older || null;
            if (!base || !head) return null;
            return {
                serverTime: Math.max(0, Number(serverTime != null ? serverTime : choosePresentationValue(base.serverTime, head.serverTime, sampleT)) || 0),
                x: lerpNumber(base.x, head.x, sampleT),
                y: lerpNumber(base.y, head.y, sampleT),
                z: lerpNumber(base.z, head.z, sampleT),
                yaw: Number(base.yaw || 0) + (normalizeAngle(Number(head.yaw || 0) - Number(base.yaw || 0)) * sampleT),
                pitch: lerpNumber(base.pitch, head.pitch, sampleT),
                moveSpeedNorm: lerpNumber(base.moveSpeedNorm, head.moveSpeedNorm, sampleT),
                sprinting: !!choosePresentationValue(!!base.sprinting, !!head.sprinting, sampleT),
                movingForward: !!choosePresentationValue(!!base.movingForward, !!head.movingForward, sampleT),
                movingBackward: !!choosePresentationValue(!!base.movingBackward, !!head.movingBackward, sampleT),
                isGrounded: choosePresentationValue(base.isGrounded !== false, head.isGrounded !== false, sampleT) !== false,
                velocityY: lerpNumber(base.velocityY, head.velocityY, sampleT),
                weaponId: String(choosePresentationValue(base.weaponId || 'rifle', head.weaponId || 'rifle', sampleT) || 'rifle')
            };
        }

        function getRemotePresentationClock(nowMs) {
            if (!opts.getRemoteSnapshotTiming) return null;
            var timing = opts.getRemoteSnapshotTiming();
            var latestServerTime = Math.max(0, Number(timing && timing.latestServerTime || 0));
            var latestReceivedAt = Math.max(0, Number(timing && timing.latestReceivedAt || 0));
            if (!(latestServerTime > 0) || !(latestReceivedAt > 0)) return null;
            var clockOffsetMs = Number(timing && timing.clockOffsetMs || 0);
            var cadenceMs = Math.max(0, Number(timing && timing.cadenceMs || 0));
            var sampleNowMs = Math.max(0, Number(nowMs || Date.now()));
            var estimatedServerTime = Math.max(
                latestServerTime,
                sampleNowMs - clockOffsetMs
            );
            var interpolationDelayMs = cadenceMs > 0
                ? clamp(cadenceMs * 2, 48, 180)
                : 95;
            return {
                nowMs: sampleNowMs,
                latestServerTime: latestServerTime,
                latestReceivedAt: latestReceivedAt,
                clockOffsetMs: clockOffsetMs,
                cadenceMs: cadenceMs,
                estimatedServerTime: estimatedServerTime,
                interpolationDelayMs: interpolationDelayMs,
                renderServerTime: Math.max(0, estimatedServerTime - interpolationDelayMs)
            };
        }

        function sampleRemoteEntityPresentation(entityId, nowMs) {
            if (!opts.getRemoteSnapshotTimeline) return null;
            var history = opts.getRemoteSnapshotTimeline(entityId);
            if (!Array.isArray(history) || history.length === 0) return null;

            var clock = getRemotePresentationClock(nowMs);
            if (!clock) {
                return buildRemotePresentationSample(history[history.length - 1], null, 0, Number(history[history.length - 1].serverTime || 0));
            }

            var renderServerTime = Math.max(0, Number(clock.renderServerTime || 0));
            if (history.length === 1 || renderServerTime <= Number(history[0].serverTime || 0)) {
                return buildRemotePresentationSample(history[0], null, 0, Number(history[0].serverTime || 0));
            }

            for (var i = 1; i < history.length; i++) {
                var newer = history[i];
                var older = history[i - 1];
                var olderTime = Number(older && older.serverTime || 0);
                var newerTime = Number(newer && newer.serverTime || 0);
                if (!(renderServerTime <= newerTime)) continue;
                var spanMs = Math.max(1, newerTime - olderTime);
                var t = clamp((renderServerTime - olderTime) / spanMs, 0, 1);
                return buildRemotePresentationSample(older, newer, t, renderServerTime);
            }

            var last = history[history.length - 1];
            var prev = history.length > 1 ? history[history.length - 2] : last;
            var stepMs = Math.max(1, Number(last && last.serverTime || 0) - Number(prev && prev.serverTime || 0));
            var extrapolationMs = clamp(
                renderServerTime - Number(last && last.serverTime || 0),
                0,
                Math.max(24, Math.min(96, Math.max(stepMs, Number(clock.cadenceMs || 0))))
            );
            var extrapolationT = extrapolationMs / stepMs;
            return buildRemotePresentationSample(last, {
                serverTime: Number(last && last.serverTime || 0) + extrapolationMs,
                x: Number(last && last.x || 0) + ((Number(last && last.x || 0) - Number(prev && prev.x || 0)) * extrapolationT),
                y: Number(last && last.y || 0) + ((Number(last && last.y || 0) - Number(prev && prev.y || 0)) * extrapolationT),
                z: Number(last && last.z || 0) + ((Number(last && last.z || 0) - Number(prev && prev.z || 0)) * extrapolationT),
                yaw: Number(last && last.yaw || 0) + (normalizeAngle(Number(last && last.yaw || 0) - Number(prev && prev.yaw || 0)) * extrapolationT),
                pitch: Number(last && last.pitch || 0) + ((Number(last && last.pitch || 0) - Number(prev && prev.pitch || 0)) * extrapolationT),
                moveSpeedNorm: Number(last && last.moveSpeedNorm || 0),
                sprinting: !!(last && last.sprinting),
                movingForward: !!(last && last.movingForward),
                movingBackward: !!(last && last.movingBackward),
                isGrounded: last ? last.isGrounded !== false : true,
                velocityY: Number(last && last.velocityY || 0),
                weaponId: String(last && last.weaponId || 'rifle')
            }, 1, renderServerTime);
        }

        function getExpectedWorldMeta() {
            if (typeof opts.buildExpectedWorldMeta !== 'function') {
                return {
                    roomId: '',
                    worldSeed: '',
                    worldProfileVersion: 0,
                    worldFlags: {}
                };
            }
            var expected = opts.buildExpectedWorldMeta(typeof opts.getRoomId === 'function' ? opts.getRoomId() : '') || {};
            return {
                roomId: expected.roomId || '',
                worldSeed: expected.worldSeed || '',
                worldProfileVersion: Number(expected.worldProfileVersion || 0),
                worldFlags: typeof opts.cloneWorldFlags === 'function' ? opts.cloneWorldFlags(expected.worldFlags) : {}
            };
        }

        function getWorldMeta() {
            var worldMeta = typeof opts.getWorldMeta === 'function' ? opts.getWorldMeta() : null;
            if (!worldMeta) return null;
            return {
                roomId: worldMeta.roomId,
                worldSeed: worldMeta.worldSeed,
                worldProfileVersion: worldMeta.worldProfileVersion,
                worldFlags: typeof opts.cloneWorldFlags === 'function' ? opts.cloneWorldFlags(worldMeta.worldFlags) : {}
            };
        }

        function getEntityStateList() {
            var out = [];
            readMap('getRenderMap').forEach(function (r) {
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
                    targetId: 'net:' + r.id,
                    healState: r.healState || null
                });
            });
            return out;
        }

        function getSelfState() {
            var selfState = opts.getSelfState();
            if (selfState) return selfState;
            var user = opts.getCurrentUser();
            if (!user) return null;
            var defaults = opts.classStats(user.classId || 'abilities');
            var shared = sharedApi();
            var survivability = shared.getSurvivabilityTuning ? (shared.getSurvivabilityTuning() || {}) : ((shared.gameplayTuning && shared.gameplayTuning.survivability) || {});
            return {
                id: user.id,
                hp: Number(survivability.hpMax || 360),
                hpMax: Number(survivability.hpMax || 360),
                armor: defaults.armorMax,
                armorMax: defaults.armorMax,
                classId: user.classId || 'abilities',
                wallhackRadius: defaults.wallhackRadius,
                throwables: null,
                kills: 0,
                deaths: 0,
                progressScore: 0,
                teamId: '',
                alive: true
            };
        }

        function getAuthoritativeThrowableState() {
            var selfState = typeof opts.getSelfState === 'function' ? opts.getSelfState() : null;
            return {
                projectiles: readArray('getRemoteProjectileState').slice(),
                fireZones: readArray('getRemoteFireZoneState').slice(),
                selfThrowables: (selfState && selfState.throwables) ? selfState.throwables : null
            };
        }

        function getSelfAbilityState() {
            var selfState = typeof opts.getSelfState === 'function' ? opts.getSelfState() : null;
            if (!selfState) return null;
            var abilityFxView = abilityFxApi();
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
            var matchState = typeof opts.getMatchState === 'function' ? opts.getMatchState() : null;
            return matchState ? JSON.parse(JSON.stringify(matchState)) : null;
        }

        function getAuthoritativeSelfState() {
            return opts.getSelfState ? (opts.getSelfState() || null) : null;
        }

        function getInputSyncState() {
            var inputSeqHistory = readArray('getInputSeqHistory');
            var latestPending = inputSeqHistory.length > 0 ? inputSeqHistory[inputSeqHistory.length - 1] : null;
            var lastSentSeq = typeof opts.getLastInputSeqSent === 'function' ? opts.getLastInputSeqSent() : 0;
            var lastAckedSeq = typeof opts.getLastInputSeqAcked === 'function' ? opts.getLastInputSeqAcked() : 0;
            var connectionTiming = opts.getConnectionTimingState ? opts.getConnectionTimingState() : null;
            var lastAcceptedSelfAckAt = opts.getLastAcceptedSelfAckAt ? Number(opts.getLastAcceptedSelfAckAt() || 0) : 0;
            var lastSentInputSample = opts.getLastSentInputSample ? opts.getLastSentInputSample() : null;
            var currentInputState = opts.getCurrentInputState ? opts.getCurrentInputState() : null;
            var currentRotation = opts.getCurrentRotation ? opts.getCurrentRotation() : null;
            var inputSendInterval = Math.max(0, Number(opts.getInputSendInterval ? opts.getInputSendInterval() : 0));
            var inputSendTimer = Math.max(0, Number(opts.getInputSendTimer ? opts.getInputSendTimer() : inputSendInterval));
            var elapsedSinceLastSendMs = inputSendInterval > 0
                ? Math.max(0, (inputSendInterval - inputSendTimer) * 1000)
                : 0;
            var currentYaw = Number(currentRotation && currentRotation.yaw || 0);
            var currentPitch = Number(currentRotation && currentRotation.pitch || 0);
            var sentYaw = Number(lastSentInputSample && lastSentInputSample.yaw || 0);
            var sentPitch = Number(lastSentInputSample && lastSentInputSample.pitch || 0);
            var rotationChanged = !!lastSentInputSample && (
                Math.abs(currentYaw - sentYaw) > 0.0001 ||
                Math.abs(currentPitch - sentPitch) > 0.0001
            );
            var inputChanged = !!lastSentInputSample && !inputStatesEqual(
                currentInputState,
                lastSentInputSample.inputState || null
            );
            var hasUnsentInputTail = !!lastSentInputSample && (
                inputChanged ||
                rotationChanged ||
                (hasActiveIntent(currentInputState) && elapsedSinceLastSendMs >= 2)
            );
            return {
                lastSentSeq: lastSentSeq,
                lastAckedSeq: lastAckedSeq,
                ackDrift: Math.max(0, Number(lastSentSeq || 0) - Number(lastAckedSeq || 0)),
                pendingInputCount: inputSeqHistory.length,
                hasUnsentInputTail: hasUnsentInputTail,
                latestPendingAgeMs: latestPending ? Math.max(0, Date.now() - Number(latestPending.at || 0)) : 0,
                latestAckAgeMs: lastAcceptedSelfAckAt > 0 ? Math.max(0, Date.now() - lastAcceptedSelfAckAt) : 0,
                estimatedRttMs: connectionTiming ? Math.max(0, Number(connectionTiming.rttMs || 0)) : 0,
                rttJitterMs: connectionTiming ? Math.max(0, Number(connectionTiming.rttJitterMs || 0)) : 0
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
                ackDrift: Number(inputSyncState.ackDrift || 0),
                latestPendingAgeMs: Number(inputSyncState.latestPendingAgeMs || 0),
                latestAckAgeMs: Number(inputSyncState.latestAckAgeMs || 0),
                rttMs: Number(inputSyncState.estimatedRttMs || 0),
                rttJitterMs: Number(inputSyncState.rttJitterMs || 0)
            };
        }

        function getPendingInputSamples() {
            var inputSeqHistory = readArray('getInputSeqHistory');
            if (!inputSeqHistory.length) return [];
            var out = [];
            for (var i = 0; i < inputSeqHistory.length; i++) {
                var entry = inputSeqHistory[i];
                if (!entry) continue;
                out.push({
                    seq: Number(entry.seq || 0),
                    at: Number(entry.at || 0),
                    dtMs: Math.max(1, Number(entry.dtMs || Math.round(((typeof opts.getInputSendInterval === 'function' ? opts.getInputSendInterval() : 0) || 0) * 1000))),
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
                });
            }
            return out;
        }

        function getRespawnState() {
            var pendingRespawnInfo = typeof opts.getPendingRespawnInfo === 'function' ? opts.getPendingRespawnInfo() : null;
            if (!pendingRespawnInfo || !pendingRespawnInfo.active) return null;
            return {
                active: true,
                respawnAt: Number(pendingRespawnInfo.respawnAt || 0),
                remainingMs: Math.max(0, Number(pendingRespawnInfo.respawnAt || 0) - Date.now())
            };
        }

        function getEntityName(entityId) {
            var id = String(entityId || '');
            var selfState = typeof opts.getSelfState === 'function' ? opts.getSelfState() : null;
            if (!id) return '';
            if (selfState && id === (typeof opts.getSelfId === 'function' ? opts.getSelfId() : '')) return String(selfState.username || selfState.id || '');
            var snapshotEntity = readMap('getSnapshotMap').get(id);
            if (snapshotEntity) return String(snapshotEntity.username || snapshotEntity.id || '');
            var render = readMap('getRenderMap').get(id);
            return render ? String(render.username || render.id || '') : '';
        }

        function getLockTargets() {
            var out = [];
            readMap('getRenderMap').forEach(function (r) {
                if (!r || !r.alive) return;
                var worldPos = typeof opts.getRenderCoreWorldPosition === 'function'
                    ? opts.getRenderCoreWorldPosition(r, new THREE.Vector3())
                    : null;
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
            getSelfState: getSelfState,
            getSelfReconciliationState: getSelfReconciliationState,
            getAuthoritativeThrowableState: getAuthoritativeThrowableState,
            getSelfAbilityState: getSelfAbilityState,
            getMatchState: getMatchState,
            getInputSyncState: getInputSyncState,
            getPendingInputSamples: getPendingInputSamples,
            getRespawnState: getRespawnState,
            getRemotePresentationClock: getRemotePresentationClock,
            sampleRemoteEntityPresentation: sampleRemoteEntityPresentation,
            getGameMode: function () { return typeof opts.getGameMode === 'function' ? (opts.getGameMode() || '') : ''; },
            getPrivateRoomPhase: function () { return typeof opts.getPrivateRoomPhase === 'function' ? (opts.getPrivateRoomPhase() || '') : ''; },
            getEntityName: getEntityName,
            getLockTargets: getLockTargets,
            damagePointForEntityId: function (entityId) {
                return opts.damagePointForEntityId ? opts.damagePointForEntityId(entityId) : null;
            },
            getEntityMarkerWorldPos: function (entityId) { return opts.markerPointForEntityId ? opts.markerPointForEntityId(entityId) : null; },
            getChokeVictimStateForEntity: function (entityId) { return opts.getChokeVictimStateForEntity ? opts.getChokeVictimStateForEntity(entityId) : null; },
            consumeNotice: function () { return opts.consumeNotice ? opts.consumeNotice() : ''; },
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
