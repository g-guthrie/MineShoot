(function () {
    'use strict';
    var root = globalThis.__MAYHEM_RUNTIME.GameWeaponPrimitives = globalThis.__MAYHEM_RUNTIME.GameWeaponPrimitives || {};

    root.cooldownReady = function (lastAt, cooldownMs, now) {
        var n = typeof now === 'number' ? now : Date.now();
        return (n - Number(lastAt || 0)) >= Number(cooldownMs || 0);
    };
})();
