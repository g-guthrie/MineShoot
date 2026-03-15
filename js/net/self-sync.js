/**
 * self-sync.js - Applies authoritative self-player network state to local runtime systems.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameNetSelfSync
 */
(function () {
    'use strict';

    function runtime() {
        return globalThis.__MAYHEM_RUNTIME || {};
    }

    function syncPlayerState(selfState, dt, options) {
        if (!selfState) return;
        var opts = options || {};
        var RT = runtime();
        var abilityFxView = RT.GameAbilityFx || null;
        var matchState = RT.GameNet && RT.GameNet.getMatchState
            ? RT.GameNet.getMatchState()
            : null;
        var spectatorLockUntil = Date.now() + 86400000;
        var outOfRoundLockUntil = selfState.outOfRound && matchState && !matchState.ended
            ? Math.max(Number(matchState.resetAt || 0), spectatorLockUntil)
            : 0;
        var selfAbilityFx = abilityFxView && abilityFxView.readAbilityFx
            ? abilityFxView.readAbilityFx(selfState)
            : ((selfState.abilityFx && typeof selfState.abilityFx === 'object')
                ? selfState.abilityFx
                : null);

        if (RT.GamePlayerCombat && RT.GamePlayerCombat.syncFromNetwork) {
            RT.GamePlayerCombat.syncFromNetwork(selfState);
        }

        if (RT.GameHitscan && RT.GameHitscan.syncAmmoStateFromNetwork && selfState.weaponAmmo) {
            RT.GameHitscan.syncAmmoStateFromNetwork(selfState.weaponAmmo);
        }

        if (RT.GamePlayer && RT.GamePlayer.setAliveVisual) {
            RT.GamePlayer.setAliveVisual(selfState.alive !== false);
        }

        if (RT.GamePlayer && RT.GamePlayer.setStatusState) {
            var selfChokeVictimState = abilityFxView && abilityFxView.toChokeVictimVisualState
                ? abilityFxView.toChokeVictimVisualState(selfAbilityFx ? selfAbilityFx.chokeVictim : null, Date.now())
                : { lift: 0, liftHeight: 0, startedAt: 0, endsAt: 0 };
            RT.GamePlayer.setStatusState({
                stunUntil: Math.max(Number(selfState.stunUntil || 0), outOfRoundLockUntil),
                hookPullStartedAt: Number(selfAbilityFx ? (selfAbilityFx.hookedStartedAt || 0) : 0),
                hookPullUntil: Number(selfAbilityFx ? (selfAbilityFx.hookedUntil || 0) : 0),
                chokeStartedAt: Number(selfChokeVictimState.startedAt || 0),
                chokeUntil: Number(selfChokeVictimState.endsAt || 0),
                chokeLift: Number(selfChokeVictimState.liftHeight || 0),
                spawnShieldUntil: Number(selfState.spawnShieldUntil || 0)
            });

            if (RT.GamePlayer.setActionRestrictions) {
                RT.GamePlayer.setActionRestrictions({
                    weaponUntil: Math.max(Number(selfState.weaponLockUntil || 0), outOfRoundLockUntil),
                    throwableUntil: Math.max(Number(selfState.throwableLockUntil || 0), outOfRoundLockUntil),
                    abilityUntil: Math.max(Number(selfState.abilityLockUntil || 0), outOfRoundLockUntil)
                });
            }
        }

        if (opts.skipMotionSync !== true) {
            if (
                selfAbilityFx && Number(selfAbilityFx.hookedUntil || 0) > Date.now() &&
                RT.GamePlayer &&
                RT.GamePlayer.applyAuthoritativeMotion
            ) {
                RT.GamePlayer.applyAuthoritativeMotion(selfState);
            } else if (
                selfState.alive !== false &&
                RT.GamePlayer &&
                RT.GamePlayer.reconcileAuthoritativeMotion
            ) {
                var inputSyncState = RT.GameNet && RT.GameNet.getInputSyncState
                    ? RT.GameNet.getInputSyncState()
                    : null;
                var connectionTimingState = RT.GameNet && RT.GameNet.getConnectionTimingState
                    ? RT.GameNet.getConnectionTimingState()
                    : null;
                var pendingInputs = RT.GameNet && RT.GameNet.getPendingInputSamples
                    ? RT.GameNet.getPendingInputSamples()
                    : [];
                RT.GamePlayer.reconcileAuthoritativeMotion(selfState, {
                    dt: dt,
                    allowReplayCorrection: true,
                    pendingInputCount: inputSyncState ? Number(inputSyncState.pendingInputCount || 0) : 0,
                    lastSentSeq: inputSyncState ? Number(inputSyncState.lastSentSeq || 0) : 0,
                    lastAckedSeq: inputSyncState ? Number(inputSyncState.lastAckedSeq || 0) : 0,
                    ackDrift: inputSyncState ? Number(inputSyncState.ackDrift || 0) : 0,
                    latestPendingAgeMs: inputSyncState ? Number(inputSyncState.latestPendingAgeMs || 0) : 0,
                    latestAckAgeMs: inputSyncState ? Number(inputSyncState.latestAckAgeMs || 0) : 0,
                    rttMs: connectionTimingState ? Number(connectionTimingState.rttMs || 0) : 0,
                    rttJitterMs: connectionTimingState ? Number(connectionTimingState.rttJitterMs || 0) : 0,
                    pendingInputs: pendingInputs,
                    snapshotAt: Date.now()
                });
            }
        }

        if (RT.GameThrowables && RT.GameThrowables.setNetworkInventoryState && RT.GameUI && RT.GameUI.updateThrowableInfo) {
            RT.GameThrowables.setNetworkInventoryState(selfState.throwables || null);
            RT.GameUI.updateThrowableInfo(RT.GameThrowables.getState());
        }
    }

    var RT = runtime();
    RT.GameNetSelfSync = {
        syncPlayerState: syncPlayerState
    };
})();
