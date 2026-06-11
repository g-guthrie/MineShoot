/**
 * audio.js - Tiny HTMLAudio pool for weapon/movement sounds.
 */
const SOURCES = {
  wind: '/assets/audio/movement/wind-woosh-loop.ogg',
  rifle: '/assets/audio/weapons/rifle.mp3',
  pistol: '/assets/audio/weapons/pistol.mp3',
  shotgun: '/assets/audio/weapons/shotgun.mp3',
  sniper: '/assets/audio/weapons/sniper.mp3',
  jump: '/assets/audio/movement/jump.ogg',
  footstep: '/assets/audio/movement/footstep-concrete.ogg',
  land: '/assets/audio/movement/footstep-concrete.ogg',
  hurt: '/assets/audio/movement/jump.ogg'
};

const templates = new Map();
let unlocked = false;

function template(name) {
  if (!templates.has(name)) {
    const src = SOURCES[name];
    if (!src) return null;
    const el = new Audio(src);
    el.preload = 'auto';
    templates.set(name, el);
  }
  return templates.get(name);
}

export const audio = {
  unlock() {
    unlocked = true;
    for (const name of Object.keys(SOURCES)) template(name);
  },

  play(name, volume = 1, rate = 1) {
    if (!unlocked) return;
    const base = template(name);
    if (!base) return;
    try {
      const el = base.cloneNode();
      el.volume = Math.max(0, Math.min(1, volume));
      el.playbackRate = rate;
      el.play().catch(() => {});
    } catch (err) { /* autoplay restrictions */ }
  },

  /** Quiet ambient loop; restarting an active loop is a no-op. */
  loop(name, volume = 0.1) {
    const base = template(name);
    if (!base) return;
    if (base.__looping) return;
    base.__looping = true;
    base.loop = true;
    base.volume = volume;
    base.play().catch(() => { base.__looping = false; });
  },

  stopLoop(name) {
    const base = templates.get(name);
    if (base && base.__looping) {
      base.pause();
      base.__looping = false;
    }
  },

  playAt(name, distance, maxDistance = 80, baseVolume = 1, rate = 1) {
    if (distance > maxDistance) return;
    const falloff = 1 - (distance / maxDistance);
    this.play(name, baseVolume * falloff * falloff, rate);
  },

  /** Random per-hit pitch between -200 and +600 cents, HYTOPIA-style. */
  hurtPitch() {
    const cents = -200 + Math.random() * 800;
    return Math.pow(2, cents / 1200);
  }
};
