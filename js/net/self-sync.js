/**
 * self-sync.js - Applies authoritative self-player network state to local runtime systems.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameNetSelfSync
 */
(function () {
    'use strict';

    var lastAppliedWeaponSnapshotRef = null;
    var lastAppliedRespawnSnapshotRef = null;

    function runtime() {
        return globalThis.__MAYHEM_RUNTIME || {};
    }

    function authoritativeNow(netApi) {
        var stamp = netApi && netApi.getAuthoritativeNow
            ? Number(netApi.getAuthoritativeNow() || 0)
            : 0;
        return stamp > 0 ? stamp : Date.now();
    }

    function toLocalTime(netApi, timestamp) {
        var stamp = Number(timestamp || 0);
        if (!(stamp > 0)) return 0;
        if (netApi && netApi.toLocalTime) {
            var localStamp = Number(netApi.toLocalTime(stamp) || 0);
            if (localStamp > 0) return localStamp;
        }
        return stamp;
    }

    function syncPlayerState(selfState, dt, options) {
        if (!selfState) return;
        var opts = options || {};
        var RT = runtime();
        var netApi = RT.GameNet || null;
        var abilityFxView = RT.GameAbilityFx || null;
        var matchState = netApi && netApi.getMatchState
            ? netApi.getMatchState()
            : null;
        var serverNow = authoritativeNow(netApi);
        var spectatorLockUntil = Date.now() + 86400000;
        var matchResetAt = toLocalTime(netApi, matchState && matchState.resetAt);
        var outOfRoundLockUntil = selfState.outOfRound && matchState && !matchState.ended
            ? Math.max(matchResetAt, spectatorLockUntil)
            : 0;
        var respawnState = opts && Object.prototype.hasOwnProperty.call(opts, 'respawnState')
            ? opts.respawnState
            : null;
        var weaponSnapshotChanged = selfState !== lastAppliedWeaponSnapshotRef;
        var respawnSnapshotChanged = respawnState !== lastAppliedRespawnSnapshotRef;
        var selfAbilityFx = abilityFxView && abilityFxView.readAbilityFx
            ? abilityFxView.readAbilityFx(selfState)
            : ((selfState.abilityFx && typeof selfState.abilityFx === 'object')
                ? selfState.abilityFx
                : null);

        if (RT.GamePlayerCombat && RT.GamePlayerCombat.syncFromNetwork && (weaponSnapshotChanged || respawnSnapshotChanged)) {
            RT.GamePlayerCombat.syncFromNetwork(Object.assign({}, selfState, {
                spawnShieldUntil: toLocalTime(netApi, selfState.spawnShieldUntil)
            }), {
                respawnState: respawnState,
                skipWeaponSync: !weaponSnapshotChanged
            });
            if (weaponSnapshotChanged) {
                lastAppliedWeaponSnapshotRef = selfState;
            }
            lastAppliedRespawnSnapshotRef = respawnState;
        }

        if (
            weaponSnapshotChanged &&
            !(RT.GamePlayerCombat && RT.GamePlayerCombat.syncWeaponState) &&
            RT.GameHitscan &&
            RT.GameHitscan.syncAmmoStateFromNetwork &&
            selfState.weaponAmmo
        ) {
            RT.GameHitscan.syncAmmoStateFromNetwork(selfState.weaponAmmo);
            lastAppliedWeaponSnapshotRef = selfState;
        }

        if (RT.GamePlayer && RT.GamePlayer.setAliveVisual) {
            RT.GamePlayer.setAliveVisual(selfState.alive !== false);
        }

        if (RT.GamePlayer && RT.GamePlayer.setStatusState) {
            var selfChokeVictimState = abilityFxView && abilityFxView.toChokeVictimVisualState
                ? abilityFxView.toChokeVictimVisualState(selfAbilityFx ? selfAbilityFx.chokeVictim : null, serverNow)
                : { lift: 0, liftHeight: 0, startedAt: 0, endsAt: 0 };
            RT.GamePlayer.setStatusState({
                stunUntil: Math.max(toLocalTime(netApi, selfState.stunUntil), outOfRoundLockUntil),
                hookPullStartedAt: toLocalTime(netApi, selfAbilityFx ? selfAbilityFx.hookedStartedAt : 0),
                hookPullUntil: toLocalTime(netApi, selfAbilityFx ? selfAbilityFx.hookedUntil : 0),
                chokeStartedAt: toLocalTime(netApi, selfChokeVictimState.startedAt),
                chokeUntil: toLocalTime(netApi, selfChokeVictimState.endsAt),
                chokeLift: Number(selfChokeVictimState.liftHeight || 0),
                spawnShieldUntil: toLocalTime(netApi, selfState.spawnShieldUntil)
            });

            if (RT.GamePlayer.setActionRestrictions) {
                RT.GamePlayer.setActionRestrictions({
                    weaponUntil: Math.max(toLocalTime(netApi, selfState.weaponLockUntil), outOfRoundLockUntil),
                    throwableUntil: Math.max(toLocalTime(netApi, selfState.throwableLockUntil), outOfRoundLockUntil),
                    abilityUntil: Math.max(toLocalTime(netApi, selfState.abilityLockUntil), outOfRoundLockUntil)
                });
            }
        }

        if (opts.skipMotionSync !== true) {
            if (
                selfAbilityFx && Number(selfAbilityFx.hookedUntil || 0) > serverNow &&
                RT.GamePlayer &&
                RT.GamePlayer.applyAuthoritativeMotion
            ) {
                RT.GamePlayer.applyAuthoritativeMotion(selfState);
            } else if (
                selfState.alive !== false &&
                RT.GamePlayer &&
                RT.GamePlayer.reconcileAuthoritativeMotion
            ) {
                var inputSyncState = netApi && netApi.getInputSyncState
                    ? netApi.getInputSyncState()
                    : null;
                var connectionTimingState = netApi && netApi.getConnectionTimingState
                    ? netApi.getConnectionTimingState()
                    : null;
                var pendingInputs = netApi && netApi.getPendingInputSamples
                    ? netApi.getPendingInputSamples()
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
