/**
 * player-camera.js - Shared camera and scope helpers for GamePlayer.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GamePlayerCamera
 */
(function () {
    'use strict';

    function isSniperScopeWeapon(currentWeaponId) {
        return String(currentWeaponId || '') === 'sniper';
    }

    function scopeTargetActive(currentWeaponId, hasInputCapture, isSprintInputActive) {
        return isSniperScopeWeapon(currentWeaponId) &&
            !!hasInputCapture &&
            !isSprintInputActive;
    }

    function scopeStateSnapshot(viewApi, state) {
        var base = state || {};
        if (viewApi && viewApi.getAdsState) {
            return viewApi.getAdsState({
                currentWeaponId: base.currentWeaponId,
                scopeTargetActive: !!base.scopeTargetActive,
                sniperMode: !!base.sniperMode
            });
        }
        return {
            weaponId: base.currentWeaponId,
            active: !!base.scopeTargetActive,
            blend: 0,
            sniper: !!base.sniperMode,
            scopeActive: false,
            ready: false,
            phase: 'inactive'
        };
    }

    function isScopeModeActive(scopeState, currentWeaponId) {
        return !!(scopeState && scopeState.active && String(scopeState.weaponId || '') === String(currentWeaponId || ''));
    }

    function isSniperScopeReady(scopeState, currentWeaponId) {
        return !!(scopeState && scopeState.ready && String(scopeState.weaponId || '') === String(currentWeaponId || ''));
    }

    function cancelScopedView(viewApi) {
        if (viewApi && viewApi.cancelScope) viewApi.cancelScope();
    }

    function setAdsEnabled(enabled, viewApi) {
        if (!enabled) cancelScopedView(viewApi);
        return false;
    }

    function syncAvatarVisibility(viewApi, state) {
        if (!viewApi || !viewApi.syncAvatarVisibility) return;
        viewApi.syncAvatarVisibility(state || {});
    }

    function resetRecoilState(viewApi) {
        if (viewApi && viewApi.resetRecoilState) viewApi.resetRecoilState();
    }

    function applyUnifiedGunOffsets(viewApi, dt, avatarRigApi) {
        if (viewApi && viewApi.applyUnifiedGunOffsets) viewApi.applyUnifiedGunOffsets(dt, avatarRigApi);
    }

    function updateAvatarAnimation(viewApi, dt, speed, state) {
        if (!viewApi || !viewApi.updateAvatarAnimation) return;
        viewApi.updateAvatarAnimation(dt, speed, state || {});
    }

    function updateCamera(viewApi, dt, state) {
        if (!viewApi || !viewApi.updateCamera) return;
        viewApi.updateCamera(dt, state || {});
    }

    function triggerFireAction(viewApi, state) {
        if (!viewApi || !viewApi.triggerFireAction) return;
        viewApi.triggerFireAction(state || {});
    }

    globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    globalThis.__MAYHEM_RUNTIME.GamePlayerCamera = {
        isSniperScopeWeapon: isSniperScopeWeapon,
        scopeTargetActive: scopeTargetActive,
        scopeStateSnapshot: scopeStateSnapshot,
        isScopeModeActive: isScopeModeActive,
        isSniperScopeReady: isSniperScopeReady,
        cancelScopedView: cancelScopedView,
        setAdsEnabled: setAdsEnabled,
        syncAvatarVisibility: syncAvatarVisibility,
        resetRecoilState: resetRecoilState,
        applyUnifiedGunOffsets: applyUnifiedGunOffsets,
        updateAvatarAnimation: updateAvatarAnimation,
        updateCamera: updateCamera,
        triggerFireAction: triggerFireAction
    };
})();
