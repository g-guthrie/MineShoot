/**
 * spread-reticle.js - Debug spread ring for hitscan weapons.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameSpreadReticle
 */
(function () {
    'use strict';

    var GameSpreadReticle = {};

    function SpreadReticle(element) {
        this.el = element || null;
        this.debugEnabled = false;
    }

    SpreadReticle.prototype.radiusPxForWeapon = function (weapon, options) {
        options = options || {};
        if (!weapon || weapon.id === 'shotgun') return 0;
        if (!!options.scoped) return 0;
        if (globalThis.__MAYHEM_RUNTIME.GameHitscan && globalThis.__MAYHEM_RUNTIME.GameHitscan.getSpreadRadiusPx) {
            return globalThis.__MAYHEM_RUNTIME.GameHitscan.getSpreadRadiusPx(weapon.id);
        }
        return 0;
    };

    SpreadReticle.prototype.metricsForWeapon = function (weapon, options) {
        options = options || {};
        if (!weapon || weapon.id === 'shotgun' || !!options.scoped) {
            return { radiusPx: 0, radiusXpx: 0, radiusYpx: 0 };
        }
        if (globalThis.__MAYHEM_RUNTIME.GameHitscan && globalThis.__MAYHEM_RUNTIME.GameHitscan.getSpreadMetrics) {
            return globalThis.__MAYHEM_RUNTIME.GameHitscan.getSpreadMetrics(weapon.id);
        }
        var radiusPx = this.radiusPxForWeapon(weapon, options);
        return { radiusPx: radiusPx, radiusXpx: radiusPx, radiusYpx: radiusPx };
    };

    SpreadReticle.prototype.setDebugEnabled = function (enabled) {
        this.debugEnabled = !!enabled;
        if (!this.debugEnabled) this.hide();
    };

    SpreadReticle.prototype.hide = function () {
        if (!this.el) return;
        this.el.style.display = 'none';
    };

    SpreadReticle.prototype.updateForWeapon = function (weapon, options) {
        if (!this.el) return;
        options = options || {};

        var isScoped = !!options.scoped;
        if (!this.debugEnabled || !weapon || weapon.id === 'shotgun' || isScoped) {
            this.hide();
            return;
        }

        var metrics = this.metricsForWeapon(weapon, options);
        var radiusPx = Number(metrics && metrics.radiusPx || 0);
        if (!isFinite(radiusPx) || radiusPx <= 1) {
            this.hide();
            return;
        }
        var diameterXpx = Math.max(2, Number(metrics && metrics.radiusXpx || radiusPx) * 2);
        var diameterYpx = Math.max(2, Number(metrics && metrics.radiusYpx || radiusPx) * 2);

        this.el.style.display = 'block';
        this.el.style.width = Math.round(diameterXpx) + 'px';
        this.el.style.height = Math.round(diameterYpx) + 'px';
    };

    GameSpreadReticle.create = function (element) {
        return new SpreadReticle(element);
    };

    globalThis.__MAYHEM_RUNTIME.GameSpreadReticle = GameSpreadReticle;
})();
