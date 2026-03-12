import { GameHitscan } from './hitscan.js';

/**
 * bloom-reticle.js - Debug bloom ring for hitscan weapons.
 */

function defaultSpreadRadiusPx(weaponId) {
  if (GameHitscan && typeof GameHitscan.getSpreadRadiusPx === 'function') {
    return GameHitscan.getSpreadRadiusPx(weaponId);
  }
  return 0;
}

class BloomReticle {
  constructor(element, options = {}) {
    this.el = element || null;
    this.debugEnabled = false;
    this.getSpreadRadiusPx = typeof options.getSpreadRadiusPx === 'function'
      ? options.getSpreadRadiusPx
      : defaultSpreadRadiusPx;
  }

  radiusPxForWeapon(weapon, options = {}) {
    if (!weapon || weapon.id === 'shotgun') return 0;
    if (!!options.scoped) return 0;
    return this.getSpreadRadiusPx(weapon.id);
  }

  setDebugEnabled(enabled) {
    this.debugEnabled = !!enabled;
    if (!this.debugEnabled) this.hide();
  }

  hide() {
    if (!this.el) return;
    this.el.style.display = 'none';
  }

  updateForWeapon(weapon, options = {}) {
    if (!this.el) return;

    const isScoped = !!options.scoped;
    if (!this.debugEnabled || !weapon || weapon.id === 'shotgun' || isScoped) {
      this.hide();
      return;
    }

    const radiusPx = this.radiusPxForWeapon(weapon, options);
    if (!isFinite(radiusPx) || radiusPx <= 1) {
      this.hide();
      return;
    }
    const diameterPx = radiusPx * 2;

    this.el.style.display = 'block';
    this.el.style.width = Math.round(diameterPx) + 'px';
    this.el.style.height = Math.round(diameterPx) + 'px';
  }
}

export function createBloomReticle(element, options) {
  return new BloomReticle(element, options);
}
