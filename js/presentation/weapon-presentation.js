(function () {
    'use strict';

    var runtime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    var GameWeaponPresentation = {};
    var UNIVERSAL_RELOAD_PRESENT_END = 0.18;
    var UNIVERSAL_RELOAD_ACTION_END = 0.72;

    function clamp01(value) {
        return Math.max(0, Math.min(1, Number(value || 0)));
    }

    function resolveWeaponEntry(weaponId) {
        var visuals = runtime.GameWeaponVisuals || null;
        if (!visuals || !visuals.get) return null;
        return visuals.get(weaponId);
    }

    function weaponDefinition(weaponId) {
        var entry = resolveWeaponEntry(weaponId);
        return entry && entry.platform ? entry.platform : null;
    }

    function resolveReloadState(options, previousState) {
        var opts = options || {};
        var reloadMs = Math.max(0, Number(opts.reloadMs || 0));
        var reloadRemaining = Math.max(0, Number(opts.reloadRemaining || 0));
        var reloadedFlashRemaining = Math.max(0, Number(opts.reloadedFlashRemaining || 0));
        var previous = previousState || null;
        var reloading = reloadMs > 0 && reloadRemaining > 0;
        var reloadPct = reloading ? clamp01(1 - (reloadRemaining / Math.max(1, reloadMs))) : 1;
        var phase = 'ready';
        var phasePct = 1;
        if (reloading) {
            if (reloadPct < UNIVERSAL_RELOAD_PRESENT_END) {
                phase = 'present';
                phasePct = clamp01(reloadPct / UNIVERSAL_RELOAD_PRESENT_END);
            } else if (reloadPct < UNIVERSAL_RELOAD_ACTION_END) {
                phase = 'action';
                phasePct = clamp01((reloadPct - UNIVERSAL_RELOAD_PRESENT_END) / (UNIVERSAL_RELOAD_ACTION_END - UNIVERSAL_RELOAD_PRESENT_END));
            } else {
                phase = 'recover';
                phasePct = clamp01((reloadPct - UNIVERSAL_RELOAD_ACTION_END) / (1 - UNIVERSAL_RELOAD_ACTION_END));
            }
        } else if (reloadedFlashRemaining > 0) {
            phase = 'complete';
            phasePct = 1;
        }
        var previousPhase = previous ? String(previous.phase || '') : '';
        var previousReloading = !!(previous && previous.reloading);
        return {
            reloading: reloading,
            reloadPct: reloadPct,
            phase: phase,
            phasePct: phasePct,
            justStarted: reloading && !previousReloading,
            justCompleted: !reloading && reloadedFlashRemaining > 0 && (previousReloading || previousPhase !== 'complete'),
            reloadRemaining: reloadRemaining,
            reloadedFlashRemaining: reloadedFlashRemaining
        };
    }

    GameWeaponPresentation.getWeaponDefinition = weaponDefinition;
    GameWeaponPresentation.resolveReloadState = resolveReloadState;

    runtime.GameWeaponPresentation = GameWeaponPresentation;
})();
