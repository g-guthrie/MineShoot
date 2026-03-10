/**
 * self-sync.js - Applies authoritative self-player network state to local runtime systems.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameNetSelfSync
 */
(function () {
    'use strict';

    function runtime() {
        return globalThis.__MAYHEM_RUNTIME || {};
    }

    function emptyChokeVictimState() {
        return { lift: 0, liftHeight: 0, startedAt: 0, endsAt: 0 };
    }

    function syncPlayerState(selfState, dt) {
        if (!selfState) return;
        var RT = runtime();
        var selfAbilityFx = (selfState.abilityFx && typeof selfState.abilityFx === 'object')
            ? selfState.abilityFx
            : null;

        if (RT.GameAbilities && RT.GameAbilities.clearQueuedClass) {
            RT.GameAbilities.clearQueuedClass();
        }

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
            var selfChokeVictimState = emptyChokeVictimState();
            if (RT.GameNet && RT.GameNet.getChokeVictimStateForEntity && selfState.id) {
                selfChokeVictimState = RT.GameNet.getChokeVictimStateForEntity(selfState.id) || selfChokeVictimState;
            }
            RT.GamePlayer.setStatusState({
                stunUntil: Number(selfState.stunUntil || 0),
                hookPullUntil: Number(selfAbilityFx ? (selfAbilityFx.hookedUntil || 0) : 0),
                chokeStartedAt: Number(selfChokeVictimState.startedAt || 0),
                chokeUntil: Number(selfChokeVictimState.endsAt || 0),
                chokeLift: Number(selfChokeVictimState.liftHeight || 0),
                spawnShieldUntil: Number(selfState.spawnShieldUntil || 0)
            });

            if (RT.GamePlayer.setActionRestrictions) {
                var selfAbilityState = RT.GameNet && RT.GameNet.getSelfAbilityState
                    ? RT.GameNet.getSelfAbilityState()
                    : null;
                var chokeCastUntil = (selfAbilityState && selfAbilityState.chokeState)
                    ? Number(selfAbilityState.chokeState.endsAt || 0)
                    : 0;
                RT.GamePlayer.setActionRestrictions({
                    weaponUntil: chokeCastUntil,
                    throwableUntil: chokeCastUntil,
                    abilityUntil: chokeCastUntil
                });
            }
        }

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
            var pendingInputs = RT.GameNet && RT.GameNet.getPendingInputSamples
                ? RT.GameNet.getPendingInputSamples()
                : [];
            RT.GamePlayer.reconcileAuthoritativeMotion(selfState, {
                dt: dt,
                pendingInputCount: inputSyncState ? Number(inputSyncState.pendingInputCount || 0) : 0,
                lastSentSeq: inputSyncState ? Number(inputSyncState.lastSentSeq || 0) : 0,
                lastAckedSeq: inputSyncState ? Number(inputSyncState.lastAckedSeq || 0) : 0,
                pendingInputs: pendingInputs,
                snapshotAt: Date.now()
            });
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
