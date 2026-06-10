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
        var lockTargetsScratch = [];
        var entityStatesScratch = [];

        function sharedApi() {
            return opts.getSharedApi ? (opts.getSharedApi() || {}) : (globalThis.__MAYHEM_RUNTIME.GameShared || {});
        }

        function interpolationApi() {
            return (globalThis.__MAYHEM_RUNTIME || {}).GameNetInterpolation || null;
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

        function inputSeqModulo() {
            return 4294967296;
        }

        function normalizeInputSeq(value) {
            var modulo = inputSeqModulo();
            var floored = Math.max(0, Math.floor(Number(value || 0)));
            return ((floored % modulo) + modulo) % modulo;
        }

        function forwardInputSeqDiff(nextSeq, priorSeq) {
            var modulo = inputSeqModulo();
            var next = normalizeInputSeq(nextSeq);
            var prior = normalizeInputSeq(priorSeq);
            if (next === prior) return 0;
            return ((next - prior) % modulo + modulo) % modulo;
        }

        function sampleFootY(entry) {
            if (!entry) return 0;
            return Number((entry.footY != null ? entry.footY : entry.y) || 0);
        }

        function buildRemotePresentationSample(older, newer, t, serverTime) {
            var api = interpolationApi();
            if (!api || !api.clamp || !api.lerpNumber || !api.normalizeAngle || !api.choosePresentationValue || !api.interpolateFootY) {
                return null;
            }
            var sampleT = api.clamp(Number(t || 0), 0, 1);
            var base = older || newer || null;
            var head = newer || older || null;
            if (!base || !head) return null;
            var spanMs = Math.max(1, Number(head.serverTime || 0) - Number(base.serverTime || 0));
            var baseFootY = sampleFootY(base);
            var headFootY = sampleFootY(head);
            return {
                serverTime: Math.max(0, Number(serverTime != null ? serverTime : api.choosePresentationValue(base.serverTime, head.serverTime, sampleT)) || 0),
                x: api.lerpNumber(base.x, head.x, sampleT),
                y: api.interpolateFootY(
                    Object.assign({}, base, { footY: baseFootY }),
                    Object.assign({}, head, { footY: headFootY }),
                    sampleT,
                    spanMs
                ),
                z: api.lerpNumber(base.z, head.z, sampleT),
                yaw: Number(base.yaw || 0) + (api.normalizeAngle(Number(head.yaw || 0) - Number(base.yaw || 0)) * sampleT),
                pitch: api.lerpNumber(base.pitch, head.pitch, sampleT),
                moveSpeedNorm: api.lerpNumber(base.moveSpeedNorm, head.moveSpeedNorm, sampleT),
                sprinting: !!api.choosePresentationValue(!!base.sprinting, !!head.sprinting, sampleT),
                fastBackpedal: !!api.choosePresentationValue(!!base.fastBackpedal, !!head.fastBackpedal, sampleT),
                movingForward: !!api.choosePresentationValue(!!base.movingForward, !!head.movingForward, sampleT),
                movingBackward: !!api.choosePresentationValue(!!base.movingBackward, !!head.movingBackward, sampleT),
                movingLeft: !!api.choosePresentationValue(!!base.movingLeft, !!head.movingLeft, sampleT),
                movingRight: !!api.choosePresentationValue(!!base.movingRight, !!head.movingRight, sampleT),
                isGrounded: api.choosePresentationValue(base.isGrounded !== false, head.isGrounded !== false, sampleT) !== false,
                velocityY: api.lerpNumber(base.velocityY, head.velocityY, sampleT),
                weaponId: String(api.choosePresentationValue(base.weaponId || 'rifle', head.weaponId || 'rifle', sampleT) || 'rifle')
            };
        }

        function getRemotePresentationClock(nowMs) {
            if (!opts.getRemoteSnapshotTiming) return null;
            var api = interpolationApi();
            return api && api.buildPresentationClock
                ? api.buildPresentationClock(opts.getRemoteSnapshotTiming(), nowMs)
                : null;
        }

        function sampleRemotePresentationFromRender(render, nowMs) {
            if (!render) return null;
            var api = interpolationApi();
            if (!api || !api.interpolateBufferedTransform || !Array.isArray(render.snapshotHistory) || render.snapshotHistory.length === 0) {
                return null;
            }
            var sampleNowMs = Math.max(0, Number(nowMs || Date.now()));
            var presentState = api.interpolateBufferedTransform(render, sampleNowMs);
            if (!presentState) return null;
            if (presentState && render.freezeBlendFrom && Number(render.freezeBlendStartAt || 0) > 0 && api.blendTransforms) {
                var interpolationTuning = api.readInterpolationTuning ? (api.readInterpolationTuning() || {}) : {};
                var freezeBlendDurationMs = Math.max(
                    1,
                    Number(render.freezeBlendDurationMs || interpolationTuning.freezeRecoveryBlendMs || 48)
                );
                var freezeBlendT = api.clamp(
                    (sampleNowMs - Number(render.freezeBlendStartAt || 0)) / freezeBlendDurationMs,
                    0,
                    1
                );
                var easedT = api.easeOutCubic ? api.easeOutCubic(freezeBlendT) : freezeBlendT;
                presentState = api.blendTransforms(render.freezeBlendFrom, presentState, easedT);
            }
            var history = render.snapshotHistory;
            var latest = history[history.length - 1] || {};
            var renderClock = api.buildPresentationClock
                ? api.buildPresentationClock({
                    latestServerTime: Number(latest.serverTime || 0),
                    latestReceivedAt: Number(latest.receivedAt || sampleNowMs),
                    clockOffsetMs: Number(render.serverTimeOffsetMs),
                    cadenceMs: Number(render.snapshotIntervalMs || 0),
                    jitterMs: Number(render.snapshotJitterMs || 0),
                    interpolationDelayMs: Number(render.interpolationDelayMs || 0)
                }, sampleNowMs)
                : null;
            return {
                serverTime: Math.max(
                    0,
                    Number(renderClock && renderClock.renderServerTime || latest.serverTime || 0)
                ),
                x: Number(presentState.x || 0),
                y: Number(presentState.footY || 0),
                z: Number(presentState.z || 0),
                yaw: Number(presentState.yaw || 0),
                pitch: Number(presentState.pitch || 0),
                moveSpeedNorm: Number(presentState.moveSpeedNorm || 0),
                sprinting: !!presentState.sprinting,
                fastBackpedal: !!presentState.fastBackpedal,
                movingForward: !!presentState.movingForward,
                movingBackward: !!presentState.movingBackward,
                movingLeft: !!presentState.movingLeft,
                movingRight: !!presentState.movingRight,
                isGrounded: presentState.isGrounded !== false,
                velocityY: Number(presentState.velocityY || 0),
                weaponId: String(render.weaponId || 'rifle')
            };
        }

        function sampleRemoteEntityPresentation(entityId, nowMs) {
            var render = readMap('getRenderMap').get(String(entityId || ''));
            var renderSample = sampleRemotePresentationFromRender(render, nowMs);
            if (renderSample) return renderSample;
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
                var api = interpolationApi();
                if (!api || !api.clamp) return null;
                var t = api.clamp((renderServerTime - olderTime) / spanMs, 0, 1);
                return buildRemotePresentationSample(older, newer, t, renderServerTime);
            }

            var last = history[history.length - 1];
            var prev = history.length > 1 ? history[history.length - 2] : last;
            var stepMs = Math.max(1, Number(last && last.serverTime || 0) - Number(prev && prev.serverTime || 0));
            var api = interpolationApi();
            if (!api || !api.clamp || !api.normalizeAngle) return null;
            var maxExtrapMs = api.computeMaxExtrapolation
                ? api.computeMaxExtrapolation(
                    api.clamp(Number(clock.cadenceMs || stepMs), 16, 140),
                    0
                )
                : 0;
            var rawExtrapMs = api.clamp(
                renderServerTime - Number(last && last.serverTime || 0),
                0,
                maxExtrapMs
            );
            var extrapolationT = api.dampedExtrapolationScale
                ? api.dampedExtrapolationScale(rawExtrapMs, maxExtrapMs, stepMs)
                : 0;
            var extrapolationMs = extrapolationT * stepMs;
            return buildRemotePresentationSample(last, {
                serverTime: Number(last && last.serverTime || 0) + extrapolationMs,
                x: Number(last && last.x || 0) + ((Number(last && last.x || 0) - Number(prev && prev.x || 0)) * extrapolationT),
                y: api.projectBallisticFootY && last && last.isGrounded === false
                    ? api.projectBallisticFootY(Object.assign({}, last, { footY: sampleFootY(last) }), extrapolationMs)
                    : (sampleFootY(last) + ((sampleFootY(last) - sampleFootY(prev)) * extrapolationT)),
                z: Number(last && last.z || 0) + ((Number(last && last.z || 0) - Number(prev && prev.z || 0)) * extrapolationT),
                yaw: Number(last && last.yaw || 0) + (api.normalizeAngle(Number(last && last.yaw || 0) - Number(prev && prev.yaw || 0)) * extrapolationT),
                pitch: Number(last && last.pitch || 0) + ((Number(last && last.pitch || 0) - Number(prev && prev.pitch || 0)) * extrapolationT),
                moveSpeedNorm: Number(last && last.moveSpeedNorm || 0),
                sprinting: !!(last && last.sprinting),
                fastBackpedal: !!(last && last.fastBackpedal),
                movingForward: !!(last && last.movingForward),
                movingBackward: !!(last && last.movingBackward),
                movingLeft: !!(last && last.movingLeft),
                movingRight: !!(last && last.movingRight),
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

        function isRenderTargetActive(render) {
            if (!render || render.alive === false) return false;
            if (render.group && render.group.visible === false) return false;
            var hasCombatHitbox = !!(render.bodyHitbox || render.headHitbox);
            if (!hasCombatHitbox) return true;
            var bodyVisible = !!(render.bodyHitbox && render.bodyHitbox.visible !== false);
            var headVisible = !!(render.headHitbox && render.headHitbox.visible !== false);
            return bodyVisible || headVisible;
        }

        function getEntityStateList() {
            entityStatesScratch.length = 0;
            readMap('getRenderMap').forEach(function (r) {
                if (!isRenderTargetActive(r)) return;
                var desc = r.entityStateDescriptor || (r.entityStateDescriptor = {
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
                    targetId: 'net:' + r.id
                });
                desc.id = r.id;
                desc.kind = r.kind;
                desc.username = r.username;
                desc.classId = r.classId;
                desc.hp = r.hp;
                desc.hpMax = r.hpMax;
                desc.armor = r.armor;
                desc.armorMax = r.armorMax;
                desc.alive = r.alive;
                desc.worldPos = r.group.position;
                desc.targetId = 'net:' + r.id;
                entityStatesScratch.push(desc);
            });
            return entityStatesScratch;
        }

        function getSelfState() {
            var selfState = opts.getSelfState();
            if (selfState) return selfState;
            var user = opts.getCurrentUser();
            if (!user) return null;
            var defaults = opts.classStats(user.classId || 'ffa');
            var shared = sharedApi();
            var survivability = shared.getSurvivabilityTuning ? (shared.getSurvivabilityTuning() || {}) : ((shared.gameplayTuning && shared.gameplayTuning.survivability) || {});
            var entityConstants = shared.entityConstants || {};
            var hpMax = Math.max(0, Number(survivability.hpMax || entityConstants.DEFAULT_HP_MAX || 0));
            var armorMax = Math.max(0, Number(defaults.armorMax || entityConstants.DEFAULT_ARMOR_MAX || 0));
            return {
                id: user.id,
                hp: hpMax,
                hpMax: hpMax,
                armor: armorMax,
                armorMax: armorMax,
                stocksRemaining: 3,
                maxStocks: 5,
                bonusLivesEarned: 0,
                extraLifeProgressPct: 0,
                eliminated: false,
                classId: user.classId || 'ffa',
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

        function getMatchState() {
            var matchState = typeof opts.getMatchState === 'function' ? opts.getMatchState() : null;
            return matchState ? JSON.parse(JSON.stringify(matchState)) : null;
        }

        function getAuthoritativeSelfState() {
            return opts.getSelfState ? (opts.getSelfState() || null) : null;
        }

        function buildAuthoritativeMotionRevision(state) {
            var shared = sharedApi();
            var reconcile = shared && shared.authoritativeReconciliation ? shared.authoritativeReconciliation : null;
            if (reconcile && reconcile.buildAuthoritativeMotionRevision) {
                return reconcile.buildAuthoritativeMotionRevision(state);
            }
            return state && typeof state === 'object' ? String(state.id || '') : '';
        }

        function getInputSyncState() {
            var inputSeqHistory = readArray('getInputSeqHistory');
            var latestPending = inputSeqHistory.length > 0 ? inputSeqHistory[inputSeqHistory.length - 1] : null;
            var oldestPending = inputSeqHistory.length > 0 ? inputSeqHistory[0] : null;
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
                ackDrift: forwardInputSeqDiff(lastSentSeq, lastAckedSeq),
                pendingInputCount: inputSeqHistory.length,
                hasUnsentInputTail: hasUnsentInputTail,
                latestPendingAgeMs: latestPending ? Math.max(0, Date.now() - Number(latestPending.at || 0)) : 0,
                oldestPendingAgeMs: oldestPending ? Math.max(0, Date.now() - Number(oldestPending.at || 0)) : 0,
                latestAckAgeMs: lastAcceptedSelfAckAt > 0 ? Math.max(0, Date.now() - lastAcceptedSelfAckAt) : 0,
                inputSendIntervalMs: Math.max(0, inputSendInterval * 1000),
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
                authoritativeMotionRevision: buildAuthoritativeMotionRevision(authoritativeState),
                acceptedSelfSeq: Math.max(0, Number(authoritativeState.seq || 0)),
                pendingInputs: getPendingInputSamples(),
                pendingInputCount: Number(inputSyncState.pendingInputCount || 0),
                hasUnsentInputTail: !!inputSyncState.hasUnsentInputTail,
                lastSentSeq: Number(inputSyncState.lastSentSeq || 0),
                lastAckedSeq: Number(inputSyncState.lastAckedSeq || 0),
                ackDrift: Number(inputSyncState.ackDrift || 0),
                latestPendingAgeMs: Number(inputSyncState.latestPendingAgeMs || 0),
                oldestPendingAgeMs: Number(inputSyncState.oldestPendingAgeMs || 0),
                latestAckAgeMs: Number(inputSyncState.latestAckAgeMs || 0),
                inputSendIntervalMs: Number(inputSyncState.inputSendIntervalMs || 0),
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
                    weaponId: String(entry.weaponId || ''),
                    movementLocked: !!entry.movementLocked,
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
            var localRespawnAt = Number(
                pendingRespawnInfo.localRespawnAt || pendingRespawnInfo.respawnAt || 0
            );
            return {
                active: true,
                respawnAt: localRespawnAt,
                remainingMs: Math.max(0, localRespawnAt - Date.now())
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
            lockTargetsScratch.length = 0;
            readMap('getRenderMap').forEach(function (r) {
                if (!isRenderTargetActive(r)) return;
                var worldPos = typeof opts.getRenderCoreWorldPosition === 'function'
                    ? opts.getRenderCoreWorldPosition(r, r.lockTargetWorldPos || (r.lockTargetWorldPos = new THREE.Vector3()))
                    : null;
                if (!worldPos) return;
                var desc = r.lockTargetDescriptor || (r.lockTargetDescriptor = {
                    targetId: '',
                    ownerType: 'net',
                    worldPos: worldPos,
                    hitbox: null,
                    bodyHitbox: null,
                    headHitbox: null,
                    alive: true,
                    netEntityId: ''
                });
                desc.targetId = 'net:' + r.id;
                desc.ownerType = 'net';
                desc.worldPos = worldPos;
                desc.hitbox = r.bodyHitbox || null;
                desc.bodyHitbox = r.bodyHitbox || null;
                desc.headHitbox = r.headHitbox || null;
                desc.alive = r.alive !== false;
                desc.netEntityId = r.id;
                lockTargetsScratch.push(desc);
            });
            return lockTargetsScratch;
        }

        return {
            getExpectedWorldMeta: getExpectedWorldMeta,
            getWorldMeta: getWorldMeta,
            getEntityStateList: getEntityStateList,
            getAuthoritativeSelfState: getAuthoritativeSelfState,
            getSelfState: getSelfState,
            getSelfReconciliationState: getSelfReconciliationState,
            getAuthoritativeThrowableState: getAuthoritativeThrowableState,
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
            consumeNotice: function () { return opts.consumeNotice ? opts.consumeNotice() : ''; },
            consumeThrowAck: function () { return shiftQueue(opts.throwAckQueue); },
            consumeThrowReject: function () { return shiftQueue(opts.throwRejectQueue); },
            consumeThrowableEvent: function () { return shiftQueue(opts.throwableEventQueue); },
            consumeShotEffect: function () { return shiftQueue(opts.shotEffectQueue); },
            consumeShotReject: function () { return shiftQueue(opts.shotRejectQueue); },
            consumeDamageFeedback: function () { return shiftQueue(opts.damageFeedbackQueue); },
            consumeIncomingDamageFeedback: function () { return shiftQueue(opts.incomingDamageFeedbackQueue); }
        };
    }

    globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    globalThis.__MAYHEM_RUNTIME.GameNetStateView = {
        create: create
    };
})();
