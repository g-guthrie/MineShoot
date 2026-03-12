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
        var authoritativeState = selfState || null;
        var syncOptions = options || {};
        var respawnState = Object.prototype.hasOwnProperty.call(syncOptions, 'respawnState')
            ? syncOptions.respawnState
            : null;
        if (!authoritativeState && !respawnState) return;
        var RT = runtime();
        var net = RT.GameNet || null;
        var netView = net && net.view ? net.view : net;
        var abilityFxView = RT.GameAbilityFx || null;
        var matchState = netView && netView.getMatchState
            ? netView.getMatchState()
            : null;
        if (!authoritativeState) {
            if (RT.GamePlayerCombat && RT.GamePlayerCombat.syncRespawnState) {
                RT.GamePlayerCombat.syncRespawnState(respawnState);
            }
            return;
        }
        var spectatorLockUntil = Date.now() + 86400000;
        var outOfRoundLockUntil = authoritativeState.outOfRound && matchState && !matchState.ended
            ? Math.max(Number(matchState.resetAt || 0), spectatorLockUntil)
            : 0;
        var selfAbilityFx = abilityFxView && abilityFxView.readAbilityFx
            ? abilityFxView.readAbilityFx(authoritativeState)
            : ((authoritativeState.abilityFx && typeof authoritativeState.abilityFx === 'object')
                ? authoritativeState.abilityFx
                : null);
        if (RT.GamePlayerCombat) {
            if (RT.GamePlayerCombat.syncAuthoritativeState) {
                RT.GamePlayerCombat.syncAuthoritativeState(authoritativeState);
            } else if (RT.GamePlayerCombat.syncFromNetwork) {
                RT.GamePlayerCombat.syncFromNetwork(authoritativeState);
            }
            if (RT.GamePlayerCombat.syncWeaponState) {
                RT.GamePlayerCombat.syncWeaponState(authoritativeState);
            }
            if (RT.GamePlayerCombat.syncRespawnState) {
                RT.GamePlayerCombat.syncRespawnState(respawnState);
            }
        }

        if ((!RT.GamePlayerCombat || !RT.GamePlayerCombat.syncWeaponState) && RT.GameHitscan && RT.GameHitscan.syncAmmoStateFromNetwork && authoritativeState.weaponAmmo) {
            RT.GameHitscan.syncAmmoStateFromNetwork(authoritativeState.weaponAmmo);
        }

        if (RT.GamePlayer && RT.GamePlayer.setAliveVisual) {
            RT.GamePlayer.setAliveVisual(authoritativeState.alive !== false);
        }

        if (RT.GamePlayer && RT.GamePlayer.setStatusState) {
            var selfChokeVictimState = abilityFxView && abilityFxView.toChokeVictimVisualState
                ? abilityFxView.toChokeVictimVisualState(selfAbilityFx ? selfAbilityFx.chokeVictim : null, Date.now())
                : { lift: 0, liftHeight: 0, startedAt: 0, endsAt: 0 };
            RT.GamePlayer.setStatusState({
                stunUntil: Math.max(Number(authoritativeState.stunUntil || 0), outOfRoundLockUntil),
                hookPullStartedAt: Number(selfAbilityFx ? (selfAbilityFx.hookedStartedAt || 0) : 0),
                hookPullUntil: Number(selfAbilityFx ? (selfAbilityFx.hookedUntil || 0) : 0),
                chokeStartedAt: Number(selfChokeVictimState.startedAt || 0),
                chokeUntil: Number(selfChokeVictimState.endsAt || 0),
                chokeLift: Number(selfChokeVictimState.liftHeight || 0),
                spawnShieldUntil: Number(authoritativeState.spawnShieldUntil || 0)
            });

            if (RT.GamePlayer.setActionRestrictions) {
                RT.GamePlayer.setActionRestrictions({
                    weaponUntil: Math.max(Number(authoritativeState.weaponLockUntil || 0), outOfRoundLockUntil),
                    throwableUntil: Math.max(Number(authoritativeState.throwableLockUntil || 0), outOfRoundLockUntil),
                    abilityUntil: Math.max(Number(authoritativeState.abilityLockUntil || 0), outOfRoundLockUntil)
                });
            }
        }

        if (RT.GameThrowables && RT.GameThrowables.setNetworkInventoryState && RT.GameUI && RT.GameUI.updateThrowableInfo) {
            RT.GameThrowables.setNetworkInventoryState(authoritativeState.throwables || null);
            RT.GameUI.updateThrowableInfo(RT.GameThrowables.getState());
        }
    }

    var RT = runtime();
    RT.GameNetSelfSync = {
        syncPlayerState: syncPlayerState
    };
})();
