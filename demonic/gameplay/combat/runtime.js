(function () {
    'use strict';

    var demonicRuntime = globalThis.__DEMONIC_RUNTIME = globalThis.__DEMONIC_RUNTIME || {};
    var mayhemRuntime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};

    function create(context) {
        context = context || {};
        var shared = mayhemRuntime.GameShared || {};
        var hudStateApi = demonicRuntime.GameCombatHudState || null;
        var hudState = hudStateApi && hudStateApi.create ? hudStateApi.create(context) : null;
        var catalog = shared.getSelectableWeaponIds ? shared.getSelectableWeaponIds() : ['machinegun', 'shotgun', 'rifle', 'pistol', 'sniper'];
        var selectedWeaponId = String((catalog[0] || 'machinegun'));
        var gameMode = String(context && context.context && context.context.gameMode || 'ffa');
        var fireCooldownRemainingMs = 0;
        var lastShotAt = 0;
        var reloadRemainingMs = 0;
        var ammoByWeaponId = {};

        for (var i = 0; i < catalog.length; i++) {
            var weaponId = String(catalog[i] || '');
            var stats = shared.getWeaponStats ? shared.getWeaponStats(weaponId) : null;
            ammoByWeaponId[weaponId] = Math.max(0, Number(stats && stats.magazineSize || 0));
        }

        function weaponStats() {
            return shared.getWeaponStats ? shared.getWeaponStats(selectedWeaponId) : null;
        }

        function weaponCatalogEntry(id) {
            var stats = shared.getWeaponStats ? shared.getWeaponStats(id) : null;
            if (!stats) return null;
            return {
                id: String(stats.id || id),
                name: String(stats.name || id),
                primitiveType: String(stats.primitiveType || ''),
                automatic: !!stats.automatic,
                cooldownMs: Math.max(0, numericOr(stats.cooldownMs, 0)),
                reloadMs: Math.max(0, numericOr(stats.reloadMs, 0)),
                magazineSize: Math.max(0, numericOr(stats.magazineSize, 0)),
                bodyDamage: Math.max(0, numericOr(stats.bodyDamage, 0)),
                headDamage: Math.max(0, numericOr(stats.headDamage, 0)),
                pellets: Math.max(1, numericOr(stats.pellets, 1)),
                hipfireSpread: Math.max(0, numericOr(stats.hipfireSpread, 0)),
                adsSpread: Math.max(0, numericOr(stats.adsSpread, 0)),
                adsFovDeg: Math.max(0, numericOr(stats.adsFovDeg, 0))
            };
        }

        function numericOr(value, fallback) {
            var numeric = Number(value);
            return Number.isFinite(numeric) ? numeric : fallback;
        }

        function inputSnapshot() {
            return context.getInputSnapshot ? context.getInputSnapshot() : {};
        }

        function ammoInMagFor(weaponId) {
            return Math.max(0, Number(ammoByWeaponId[String(weaponId || '')] || 0));
        }

        function isReloading() {
            return reloadRemainingMs > 0;
        }

        function beginReload() {
                var stats = weaponStats() || {};
                if (Number(stats.magazineSize || 0) <= 0) return false;
                if (isReloading()) return false;
                if (ammoInMagFor(selectedWeaponId) >= Number(stats.magazineSize || 0)) return false;
                reloadRemainingMs = Math.max(0, Number(stats.reloadMs || 0));
            return reloadRemainingMs > 0;
        }

        return {
            update: function (dt) {
                fireCooldownRemainingMs = Math.max(0, fireCooldownRemainingMs - (dt * 1000));
                if (reloadRemainingMs > 0) {
                    reloadRemainingMs = Math.max(0, reloadRemainingMs - (dt * 1000));
                    if (reloadRemainingMs <= 0) {
                        var stats = weaponStats() || {};
                        ammoByWeaponId[selectedWeaponId] = Math.max(0, Number(stats.magazineSize || 0));
                    }
                }
            },
            fire: function () {
                if (fireCooldownRemainingMs > 0 || isReloading()) return false;
                var stats = weaponStats() || {};
                var input = inputSnapshot();
                if (String(stats.id || selectedWeaponId) === 'sniper' && !input.ads) {
                    return false;
                }
                if (numericOr(stats.magazineSize, 0) > 0 && ammoInMagFor(selectedWeaponId) <= 0) {
                    beginReload();
                    return false;
                }
                fireCooldownRemainingMs = Math.max(0, numericOr(stats.cooldownMs, 250));
                if (numericOr(stats.magazineSize, 0) > 0) {
                    ammoByWeaponId[selectedWeaponId] = Math.max(0, ammoInMagFor(selectedWeaponId) - 1);
                    if (ammoByWeaponId[selectedWeaponId] <= 0) {
                        beginReload();
                    }
                }
                lastShotAt = Date.now();
                return true;
            },
            setWeapon: function (weaponId) {
                if (catalog.indexOf(String(weaponId || '')) === -1) return false;
                selectedWeaponId = String(weaponId || selectedWeaponId);
                reloadRemainingMs = 0;
                return true;
            },
            cycleWeapon: function (delta) {
                var idx = catalog.indexOf(selectedWeaponId);
                if (idx < 0) idx = 0;
                var direction = Number(delta || 1) >= 0 ? 1 : -1;
                idx = (idx + direction + catalog.length) % catalog.length;
                selectedWeaponId = catalog[idx];
                reloadRemainingMs = 0;
                return selectedWeaponId;
            },
            reload: function () {
                return beginReload();
            },
            canFire: function () {
                return fireCooldownRemainingMs <= 0 && !isReloading();
            },
            getSnapshot: function () {
                var stats = weaponStats() || {};
                var ammoInMag = ammoInMagFor(selectedWeaponId);
                var hud = hudState && hudState.build ? hudState.build({
                    reloadRemainingMs: reloadRemainingMs,
                    fireCooldownRemainingMs: fireCooldownRemainingMs,
                    reloadMs: numericOr(stats.reloadMs, 0),
                    cooldownMs: numericOr(stats.cooldownMs, 0)
                }) : { status: 'ready', ready: true, pct: 1 };
                return {
                    gameMode: gameMode,
                    selectedWeaponId: selectedWeaponId,
                    weaponCatalog: catalog.map(weaponCatalogEntry).filter(Boolean),
                    fireCooldownRemainingMs: Number(fireCooldownRemainingMs || 0),
                    reloadRemainingMs: Number(reloadRemainingMs || 0),
                    ammoInMag: Number(ammoInMag || 0),
                    magazineSize: Math.max(0, numericOr(stats.magazineSize, 0)),
                    automatic: !!stats.automatic,
                    cooldownMs: Math.max(0, numericOr(stats.cooldownMs, 0)),
                    reloadMs: Math.max(0, numericOr(stats.reloadMs, 0)),
                    bodyDamage: Math.max(0, numericOr(stats.bodyDamage, 0)),
                    headDamage: Math.max(0, numericOr(stats.headDamage, 0)),
                    pellets: Math.max(1, numericOr(stats.pellets, 1)),
                    hipfireSpread: Math.max(0, numericOr(stats.hipfireSpread, 0)),
                    adsSpread: Math.max(0, numericOr(stats.adsSpread, 0)),
                    adsFovDeg: Math.max(0, numericOr(stats.adsFovDeg, 0)),
                    lastShotAt: Number(lastShotAt || 0),
                    canFire: fireCooldownRemainingMs <= 0 && !isReloading(),
                    hudState: hud
                };
            }
        };
    }

    demonicRuntime.GameCombatRuntime = {
        create: create
    };
})();
