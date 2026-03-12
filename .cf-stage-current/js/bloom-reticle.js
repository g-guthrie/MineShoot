/**
 * bloom-reticle.js - Debug bloom ring for hitscan weapons.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameBloomReticle
 */
(function () {
    'use strict';

    var GameBloomReticle = {};

    function BloomReticle(element) {
        this.el = element || null;
        this.debugEnabled = false;
    }

    BloomReticle.prototype.radiusPxForWeapon = function (weapon, options) {
        options = options || {};
        if (!weapon || weapon.id === 'shotgun') return 0;
        if (!!options.scoped) return 0;
        if (globalThis.__MAYHEM_RUNTIME.GameHitscan && globalThis.__MAYHEM_RUNTIME.GameHitscan.getSpreadRadiusPx) {
            return globalThis.__MAYHEM_RUNTIME.GameHitscan.getSpreadRadiusPx(weapon.id);
        }
        return 0;
    };

    BloomReticle.prototype.setDebugEnabled = function (enabled) {
        this.debugEnabled = !!enabled;
        if (!this.debugEnabled) this.hide();
    };

    BloomReticle.prototype.hide = function () {
        if (!this.el) return;
        this.el.style.display = 'none';
    };

    BloomReticle.prototype.updateForWeapon = function (weapon, options) {
        if (!this.el) return;
        options = options || {};

        var isScoped = !!options.scoped;
        if (!this.debugEnabled || !weapon || weapon.id === 'shotgun' || isScoped) {
            this.hide();
            return;
        }

        var radiusPx = this.radiusPxForWeapon(weapon, options);
        if (!isFinite(radiusPx) || radiusPx <= 1) {
            this.hide();
            return;
        }
        var diameterPx = radiusPx * 2;

        this.el.style.display = 'block';
        this.el.style.width = Math.round(diameterPx) + 'px';
        this.el.style.height = Math.round(diameterPx) + 'px';
    };

    GameBloomReticle.create = function (element) {
        return new BloomReticle(element);
    };

    globalThis.__MAYHEM_RUNTIME.GameBloomReticle = GameBloomReticle;
})();
