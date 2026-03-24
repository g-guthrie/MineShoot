/**
 * self-motion-sync.js - Applies authoritative self motion correction to the player runtime.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameNetSelfMotionSync
 */
(function () {
    'use strict';

    var lastMotionSyncKey = '';
    var lastAcceptedSelfSeq = 0;

    function runtime() {
        return globalThis.__MAYHEM_RUNTIME || {};
    }

    function authoritativeNow(netApi) {
        var timingApi = netApi && netApi.timing ? netApi.timing : null;
        var stamp = timingApi && timingApi.getAuthoritativeNow
            ? Number(timingApi.getAuthoritativeNow() || 0)
            : 0;
        return stamp > 0 ? stamp : Date.now();
    }

    function buildMotionSyncKey(selfState) {
        if (!selfState || typeof selfState !== 'object') return '';
        var precision = function (value) {
            return Math.round(Number(value || 0) * 1000);
        };
        return [
            String(selfState.id || ''),
            precision(selfState.x),
            precision(selfState.y),
            precision(selfState.z),
            precision(selfState.yaw),
            precision(selfState.pitch),
            precision(selfState.velocityY),
            precision(selfState.jumpHoldTimer),
            precision(selfState.moveSpeedNorm),
            selfState.isGrounded ? '1' : '0',
            selfState.jumpHeldLast ? '1' : '0',
            selfState.sprinting ? '1' : '0',
            selfState.alive === false ? '0' : '1',
            String(selfState.weaponId || '')
        ].join('|');
    }

    function fallbackReconciliationContract(authoritativeState) {
        var RT = runtime();
        var net = RT.GameNet || null;
        var netView = net && net.view ? net.view : null;
        var timingApi = net && net.timing ? net.timing : null;
        var inputSyncState = netView && netView.getInputSyncState
            ? netView.getInputSyncState()
            : null;
        var connectionTimingState = timingApi && timingApi.getConnectionTimingState
            ? timingApi.getConnectionTimingState()
            : null;
        return {
            authoritativeState: authoritativeState || null,
            pendingInputs: netView && netView.getPendingInputSamples
                ? netView.getPendingInputSamples()
                : [],
            pendingInputCount: inputSyncState ? Number(inputSyncState.pendingInputCount || 0) : 0,
            ackDrift: inputSyncState ? Number(inputSyncState.ackDrift || 0) : 0,
            latestPendingAgeMs: inputSyncState ? Number(inputSyncState.latestPendingAgeMs || 0) : 0,
            latestAckAgeMs: inputSyncState ? Number(inputSyncState.latestAckAgeMs || 0) : 0,
            hasUnsentInputTail: !!(inputSyncState && inputSyncState.hasUnsentInputTail),
            lastSentSeq: inputSyncState ? Number(inputSyncState.lastSentSeq || 0) : 0,
            lastAckedSeq: inputSyncState ? Number(inputSyncState.lastAckedSeq || 0) : 0,
            acceptedSelfSeq: Math.max(0, Number(authoritativeState && authoritativeState.seq || 0)),
            inputSendIntervalMs: inputSyncState ? Number(inputSyncState.inputSendIntervalMs || 0) : 0,
            authoritativeMotionRevision: buildMotionSyncKey(authoritativeState),
            rttMs: connectionTimingState ? Number(connectionTimingState.rttMs || 0) : 0,
            rttJitterMs: connectionTimingState ? Number(connectionTimingState.rttJitterMs || 0) : 0
        };
    }

    function normalizeContract(reconcileState) {
        var normalized = (reconcileState && reconcileState.authoritativeState)
            ? Object.assign({}, reconcileState)
            : fallbackReconciliationContract(reconcileState || null);
        if (!normalized.authoritativeMotionRevision) {
            normalized.authoritativeMotionRevision = buildMotionSyncKey(normalized.authoritativeState);
        }
        if (!(Number(normalized.acceptedSelfSeq || 0) > 0)) {
            normalized.acceptedSelfSeq = Math.max(0, Number(
                normalized.authoritativeState && normalized.authoritativeState.seq || 0
            ));
        }
        return normalized;
    }

    function syncPlayerMotion(reconcileState, dt) {
        var normalizedState = normalizeContract(reconcileState);
        var authoritativeState = normalizedState ? normalizedState.authoritativeState : null;
        if (!authoritativeState) {
            lastMotionSyncKey = '';
            lastAcceptedSelfSeq = 0;
            return;
        }

        var RT = runtime();
        var netApi = RT.GameNet || null;
        var abilityFxView = RT.GameAbilityFx || null;
        var selfAbilityFx = abilityFxView && abilityFxView.readAbilityFx
            ? abilityFxView.readAbilityFx(authoritativeState)
            : ((authoritativeState.abilityFx && typeof authoritativeState.abilityFx === 'object')
                ? authoritativeState.abilityFx
                : null);
        var motionSyncKey = String(normalizedState.authoritativeMotionRevision || buildMotionSyncKey(authoritativeState));
        var motionChanged = motionSyncKey !== lastMotionSyncKey;
        var acceptedSelfSeq = Math.max(0, Number(normalizedState.acceptedSelfSeq || 0));
        var ackAdvanced = acceptedSelfSeq > 0 && acceptedSelfSeq !== lastAcceptedSelfSeq;
        var replayStateActive = Number(normalizedState.pendingInputCount || 0) > 0 || !!normalizedState.hasUnsentInputTail;
        var serverNow = authoritativeNow(netApi);

        if (
            selfAbilityFx && Number(selfAbilityFx.hookedUntil || 0) > serverNow &&
            RT.GamePlayer &&
            RT.GamePlayer.applyAuthoritativeMotion
        ) {
            RT.GamePlayer.applyAuthoritativeMotion(authoritativeState, { deferViewSync: true });
            lastMotionSyncKey = motionSyncKey;
            lastAcceptedSelfSeq = acceptedSelfSeq;
            return;
        }

        if (
            (motionChanged || (ackAdvanced && replayStateActive)) &&
            authoritativeState.alive !== false &&
            RT.GamePlayer &&
            RT.GamePlayer.reconcileAuthoritativeMotion
        ) {
            RT.GamePlayer.reconcileAuthoritativeMotion(authoritativeState, {
                dt: dt,
                ackAdvanced: ackAdvanced,
                acceptedSelfSeq: acceptedSelfSeq,
                authoritativeMotionRevision: motionSyncKey,
                pendingInputCount: Number(normalizedState.pendingInputCount || 0),
                hasUnsentInputTail: !!normalizedState.hasUnsentInputTail,
                lastSentSeq: Number(normalizedState.lastSentSeq || 0),
                lastAckedSeq: Number(normalizedState.lastAckedSeq || 0),
                ackDrift: Number(normalizedState.ackDrift || 0),
                latestPendingAgeMs: Number(normalizedState.latestPendingAgeMs || 0),
                latestAckAgeMs: Number(normalizedState.latestAckAgeMs || 0),
                inputSendIntervalMs: Number(normalizedState.inputSendIntervalMs || 0),
                rttMs: Number(normalizedState.rttMs || 0),
                rttJitterMs: Number(normalizedState.rttJitterMs || 0),
                pendingInputs: Array.isArray(normalizedState.pendingInputs)
                    ? normalizedState.pendingInputs
                    : [],
                snapshotAt: Date.now(),
                deferViewSync: true
            });
        }

        if (motionChanged) lastMotionSyncKey = motionSyncKey;
        if (ackAdvanced) lastAcceptedSelfSeq = acceptedSelfSeq;
    }

    runtime().GameNetSelfMotionSync = {
        syncPlayerMotion: syncPlayerMotion
    };
})();
