(function () {
    'use strict';
    var families = globalThis.__MAYHEM_RUNTIME.GameWeaponFamilies = globalThis.__MAYHEM_RUNTIME.GameWeaponFamilies || {};
    families.hitscan = {
        id: 'hitscan',
        canFire: function (state) {
            if (!globalThis.__MAYHEM_RUNTIME.GameWeaponPrimitives || !globalThis.__MAYHEM_RUNTIME.GameWeaponPrimitives.cooldownReady) return true;
            return globalThis.__MAYHEM_RUNTIME.GameWeaponPrimitives.cooldownReady(state && state.lastFireAt, state && state.cooldownMs, state && state.nowMs);
        }
    };
})();
