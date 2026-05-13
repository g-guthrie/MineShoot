import { WEAPONS } from '../shared/constants.js';

export class AudioBus {
  constructor() {
    this.cache = new Map();
    this.enabled = true;
  }

  playWeapon(weaponId) {
    if (!this.enabled) return;
    const weapon = WEAPONS[weaponId] || WEAPONS.rifle;
    if (!weapon.sound) return;
    let audio = this.cache.get(weapon.sound);
    if (!audio) {
      audio = new Audio(weapon.sound);
      audio.preload = 'auto';
      this.cache.set(weapon.sound, audio);
    }
    const instance = audio.cloneNode();
    instance.volume = 0.55;
    instance.play().catch(() => {});
  }
}

