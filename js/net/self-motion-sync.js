/**
 * self-motion-sync.js - Applies authoritative self motion correction to the player runtime.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameNetSelfMotionSync
 */
(function () {
    'use strict';

    var lastMotionSyncKey = '';

    function runtime() {
        return globalThis.__MAYHEM_RUNTIME || {};
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
            selfState.isGrounded ? '1' : '0',
            selfState.alive === false ? '0' : '1'
        ].join('|');
    }

    function fallbackReconciliationContract(authoritativeState) {
        var RT = runtime();
        var net = RT.GameNet || null;
        var netView = net && net.view ? net.view : net;
        var inputSyncState = netView && netView.getInputSyncState
            ? netView.getInputSyncState()
            : null;
        return {
            authoritativeState: authoritativeState || null,
            pendingInputs: netView && netView.getPendingInputSamples
                ? netView.getPendingInputSamples()
                : [],
            pendingInputCount: inputSyncState ? Number(inputSyncState.pendingInputCount || 0) : 0,
            hasUnsentInputTail: !!(inputSyncState && inputSyncState.hasUnsentInputTail),
            lastSentSeq: inputSyncState ? Number(inputSyncState.lastSentSeq || 0) : 0,
            lastAckedSeq: inputSyncState ? Number(inputSyncState.lastAckedSeq || 0) : 0
        };
    }

    function normalizeContract(reconcileState) {
        if (reconcileState && reconcileState.authoritativeState) return reconcileState;
        return fallbackReconciliationContract(reconcileState || null);
    }

    function syncPlayerMotion(reconcileState, dt) {
        var normalizedState = normalizeContract(reconcileState);
        var authoritativeState = normalizedState ? normalizedState.authoritativeState : null;
        if (!authoritativeState) return;

        var RT = runtime();
        var abilityFxView = RT.GameAbilityFx || null;
        var selfAbilityFx = abilityFxView && abilityFxView.readAbilityFx
            ? abilityFxView.readAbilityFx(authoritativeState)
            : ((authoritativeState.abilityFx && typeof authoritativeState.abilityFx === 'object')
                ? authoritativeState.abilityFx
                : null);
        var motionSyncKey = buildMotionSyncKey(authoritativeState);
        var motionChanged = motionSyncKey !== lastMotionSyncKey;

        if (
            selfAbilityFx && Number(selfAbilityFx.hookedUntil || 0) > Date.now() &&
            RT.GamePlayer &&
            RT.GamePlayer.applyAuthoritativeMotion
        ) {
            RT.GamePlayer.applyAuthoritativeMotion(authoritativeState, { deferViewSync: true });
            lastMotionSyncKey = motionSyncKey;
            return;
        }

        if (
            motionChanged &&
            authoritativeState.alive !== false &&
            RT.GamePlayer &&
            RT.GamePlayer.reconcileAuthoritativeMotion
        ) {
            RT.GamePlayer.reconcileAuthoritativeMotion(authoritativeState, {
                dt: dt,
                pendingInputCount: Number(normalizedState.pendingInputCount || 0),
                hasUnsentInputTail: !!normalizedState.hasUnsentInputTail,
                lastSentSeq: Number(normalizedState.lastSentSeq || 0),
                lastAckedSeq: Number(normalizedState.lastAckedSeq || 0),
                pendingInputs: Array.isArray(normalizedState.pendingInputs)
                    ? normalizedState.pendingInputs
                    : [],
                snapshotAt: Date.now(),
                deferViewSync: true
            });
            lastMotionSyncKey = motionSyncKey;
        }
    }

    runtime().GameNetSelfMotionSync = {
        syncPlayerMotion: syncPlayerMotion
    };
})();
