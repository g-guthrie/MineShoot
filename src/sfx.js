/**
 * sfx.js - Procedural WebAudio sounds for combat feedback: hitmarker
 * ticks, headshot dings, kill confirms. Synthesized so pitch/length can
 * be tuned freely without asset hunting.
 */
let ctx = null;

function audioContext() {
  if (!ctx) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function tone({ freq = 800, endFreq, duration = 0.06, volume = 0.2, type = 'square', delay = 0 }) {
  const c = audioContext();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (endFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), t0 + duration);
  gain.gain.setValueAtTime(volume, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

export const sfx = {
  unlock() {
    audioContext();
  },

  /** Crisp two-click hit confirmation. */
  hitmarker() {
    tone({ freq: 2600, duration: 0.025, volume: 0.12, type: 'square' });
    tone({ freq: 1900, duration: 0.03, volume: 0.1, type: 'square', delay: 0.018 });
  },

  /** Brighter ding for headshots. */
  headshot() {
    tone({ freq: 3400, duration: 0.04, volume: 0.14, type: 'triangle' });
    tone({ freq: 2550, duration: 0.06, volume: 0.12, type: 'triangle', delay: 0.03 });
  },

  /** Rising kill-confirm chime. */
  kill() {
    tone({ freq: 880, duration: 0.07, volume: 0.16, type: 'triangle' });
    tone({ freq: 1320, duration: 0.09, volume: 0.16, type: 'triangle', delay: 0.06 });
    tone({ freq: 1760, duration: 0.12, volume: 0.14, type: 'triangle', delay: 0.12 });
  },

  /** Soft mechanical click for weapon switching / UI. */
  click() {
    tone({ freq: 1500, duration: 0.02, volume: 0.07, type: 'square' });
    tone({ freq: 900, duration: 0.025, volume: 0.06, type: 'square', delay: 0.02 });
  },

  /** Low thud when taking damage. */
  hurt(rate = 1) {
    tone({ freq: 220 * rate, endFreq: 90 * rate, duration: 0.12, volume: 0.22, type: 'triangle' });
    tone({ freq: 1100 * rate, duration: 0.025, volume: 0.08, type: 'square' });
  }
};
