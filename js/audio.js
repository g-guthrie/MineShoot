/**
 * audio.js - Procedural music + SFX for gameplay events
 * Loaded as global: window.GameAudio
 */
(function () {
    'use strict';

    var GameAudio = {};

    var AudioCtx = window.AudioContext || window.webkitAudioContext;
    var context = null;
    var masterGain = null;
    var musicGain = null;
    var sfxGain = null;
    var noiseBuffer = null;

    var gameplayActive = false;

    var musicTimer = null;
    var musicStep = 0;
    var musicNextTime = 0;
    var MUSIC_STEP_SECONDS = 60 / 108 / 2;

    var plasmaActive = false;
    var plasmaNodes = null;

    var eventCooldownsMs = {
        hit: 40,
        kill: 130,
        damage: 90,
        footstep: 70
    };
    var lastEventAt = {
        hit: 0,
        kill: 0,
        damage: 0,
        footstep: 0
    };

    function nowMs() {
        return performance && typeof performance.now === 'function' ? performance.now() : Date.now();
    }

    function canEmit(name) {
        var cooldown = eventCooldownsMs[name] || 0;
        if (!cooldown) return true;
        var now = nowMs();
        if (now - (lastEventAt[name] || 0) < cooldown) return false;
        lastEventAt[name] = now;
        return true;
    }

    function ensureContext() {
        if (context) return context;
        if (!AudioCtx) return null;

        try {
            context = new AudioCtx();
        } catch (err) {
            context = null;
            return null;
        }

        masterGain = context.createGain();
        masterGain.gain.value = 0.26;
        masterGain.connect(context.destination);

        musicGain = context.createGain();
        musicGain.gain.value = 0.20;
        musicGain.connect(masterGain);

        sfxGain = context.createGain();
        sfxGain.gain.value = 0.24;
        sfxGain.connect(masterGain);

        noiseBuffer = buildNoiseBuffer(context);
        return context;
    }

    function buildNoiseBuffer(ctx) {
        var duration = 1.0;
        var length = Math.floor(ctx.sampleRate * duration);
        var buffer = ctx.createBuffer(1, length, ctx.sampleRate);
        var channel = buffer.getChannelData(0);
        for (var i = 0; i < length; i++) {
            channel[i] = (Math.random() * 2 - 1) * 0.65;
        }
        return buffer;
    }

    function withCtx(fn) {
        var ctx = ensureContext();
        if (!ctx) return false;
        fn(ctx);
        return true;
    }

    function beepAt(ctx, destination, cfg) {
        var t = Math.max(ctx.currentTime, cfg.when || ctx.currentTime);
        var attack = (typeof cfg.attack === 'number') ? cfg.attack : 0.003;
        var release = (typeof cfg.release === 'number') ? cfg.release : 0.09;
        var sustain = Math.max(0.01, cfg.duration || 0.1);
        var end = t + sustain + release;

        var osc = ctx.createOscillator();
        osc.type = cfg.type || 'triangle';
        osc.frequency.setValueAtTime(cfg.freq || 220, t);
        if (typeof cfg.freqTo === 'number') {
            osc.frequency.exponentialRampToValueAtTime(Math.max(20, cfg.freqTo), t + sustain);
        }
        if (typeof cfg.detune === 'number') {
            osc.detune.setValueAtTime(cfg.detune, t);
        }

        var amp = ctx.createGain();
        var peak = Math.max(0.0001, cfg.gain || 0.08);
        amp.gain.setValueAtTime(0.0001, t);
        amp.gain.linearRampToValueAtTime(peak, t + attack);
        amp.gain.exponentialRampToValueAtTime(0.0001, end);

        var chainInput = osc;
        var chainOutput = amp;
        if (cfg.filter) {
            var filter = ctx.createBiquadFilter();
            filter.type = cfg.filter.type || 'lowpass';
            filter.frequency.setValueAtTime(cfg.filter.freq || 1600, t);
            filter.Q.value = (typeof cfg.filter.q === 'number') ? cfg.filter.q : 0.8;
            chainInput.connect(filter);
            filter.connect(amp);
        } else {
            chainInput.connect(amp);
        }
        amp.connect(destination);

        osc.start(t);
        osc.stop(end + 0.01);
    }

    function noiseAt(ctx, destination, cfg) {
        if (!noiseBuffer) return;
        var t = Math.max(ctx.currentTime, cfg.when || ctx.currentTime);
        var duration = Math.max(0.02, cfg.duration || 0.08);
        var release = (typeof cfg.release === 'number') ? cfg.release : 0.06;
        var end = t + duration + release;

        var src = ctx.createBufferSource();
        src.buffer = noiseBuffer;
        src.playbackRate.setValueAtTime(cfg.rate || 1, t);

        var filter = ctx.createBiquadFilter();
        filter.type = cfg.filterType || 'highpass';
        filter.frequency.setValueAtTime(cfg.filterFreq || 500, t);
        filter.Q.value = (typeof cfg.filterQ === 'number') ? cfg.filterQ : 0.9;

        var amp = ctx.createGain();
        var peak = Math.max(0.0001, cfg.gain || 0.05);
        amp.gain.setValueAtTime(0.0001, t);
        amp.gain.linearRampToValueAtTime(peak, t + 0.004);
        amp.gain.exponentialRampToValueAtTime(0.0001, end);

        src.connect(filter);
        filter.connect(amp);
        amp.connect(destination);

        src.start(t);
        src.stop(end + 0.01);
    }

    function startMusic() {
        withCtx(function (ctx) {
            if (musicTimer) return;
            musicStep = 0;
            musicNextTime = ctx.currentTime + 0.08;

            musicTimer = setInterval(function () {
                if (!context || context.state !== 'running') return;
                var horizon = context.currentTime + 0.24;
                while (musicNextTime < horizon) {
                    scheduleMusicStep(context, musicNextTime, musicStep++);
                    musicNextTime += MUSIC_STEP_SECONDS;
                }
            }, 90);
        });
    }

    function stopMusic() {
        if (musicTimer) {
            clearInterval(musicTimer);
            musicTimer = null;
        }
    }

    function scheduleMusicStep(ctx, when, stepIndex) {
        var lead = [220.0, 246.94, 261.63, 293.66, 329.63, 293.66, 261.63, 246.94];
        var bass = [110.0, 110.0, 123.47, 130.81, 146.83, 130.81, 123.47, 98.0];
        var l = lead[stepIndex % lead.length];
        var b = bass[stepIndex % bass.length];

        beepAt(ctx, musicGain, {
            when: when,
            type: 'triangle',
            freq: l,
            duration: 0.14,
            release: 0.12,
            gain: 0.045,
            filter: { type: 'lowpass', freq: 2200, q: 0.6 }
        });

        if ((stepIndex % 2) === 0) {
            beepAt(ctx, musicGain, {
                when: when,
                type: 'sine',
                freq: b,
                duration: 0.24,
                release: 0.15,
                gain: 0.05,
                filter: { type: 'lowpass', freq: 950, q: 0.7 }
            });
        }
    }

    function stopPlasmaHum() {
        if (!context || !plasmaNodes) return;
        var t = context.currentTime;
        try {
            plasmaNodes.gain.gain.cancelScheduledValues(t);
            plasmaNodes.gain.gain.setTargetAtTime(0.0001, t, 0.05);
            plasmaNodes.oscA.stop(t + 0.16);
            plasmaNodes.oscB.stop(t + 0.16);
        } catch (err) {
            // Keep gameplay resilient if an oscillator was already stopped.
        }
        plasmaNodes = null;
    }

    function setPlasmaHum(active, overheated) {
        withCtx(function (ctx) {
            var isOn = !!active;
            plasmaActive = isOn;
            if (!isOn) {
                stopPlasmaHum();
                return;
            }
            if (ctx.state !== 'running') return;

            if (!plasmaNodes) {
                var oscA = ctx.createOscillator();
                oscA.type = 'sawtooth';
                var oscB = ctx.createOscillator();
                oscB.type = 'triangle';

                var filter = ctx.createBiquadFilter();
                filter.type = 'bandpass';
                filter.frequency.value = 320;
                filter.Q.value = 0.9;

                var gain = ctx.createGain();
                gain.gain.value = 0.0001;

                oscA.connect(filter);
                oscB.connect(filter);
                filter.connect(gain);
                gain.connect(sfxGain);

                oscA.start();
                oscB.start();
                plasmaNodes = { oscA: oscA, oscB: oscB, filter: filter, gain: gain };
            }

            var t = ctx.currentTime;
            var base = overheated ? 128 : 176;
            plasmaNodes.oscA.frequency.setTargetAtTime(base, t, 0.035);
            plasmaNodes.oscB.frequency.setTargetAtTime(base * 1.98, t, 0.04);
            plasmaNodes.filter.frequency.setTargetAtTime(overheated ? 260 : 360, t, 0.06);
            plasmaNodes.gain.gain.setTargetAtTime(overheated ? 0.018 : 0.035, t, 0.05);
        });
    }

    GameAudio.init = function () {
        ensureContext();
    };

    GameAudio.unlock = function () {
        withCtx(function (ctx) {
            if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
                ctx.resume().then(function () {
                    if (gameplayActive) startMusic();
                    if (plasmaActive) setPlasmaHum(true, false);
                }).catch(function () {
                    // Browser blocked resume outside user gesture.
                });
            } else if (gameplayActive) {
                startMusic();
            }
        });
    };

    GameAudio.setGameplayActive = function (active) {
        gameplayActive = !!active;
        if (gameplayActive) {
            GameAudio.unlock();
            startMusic();
        } else {
            stopMusic();
            setPlasmaHum(false, false);
        }
    };

    GameAudio.playWeapon = function (weaponId) {
        withCtx(function (ctx) {
            if (ctx.state !== 'running') return;
            var id = String(weaponId || 'rifle');
            if (id === 'shotgun') {
                noiseAt(ctx, sfxGain, { gain: 0.09, duration: 0.07, release: 0.08, filterType: 'highpass', filterFreq: 650, rate: 0.8 });
                beepAt(ctx, sfxGain, { type: 'triangle', freq: 120, freqTo: 75, duration: 0.07, release: 0.13, gain: 0.1, filter: { type: 'lowpass', freq: 700, q: 1.1 } });
                return;
            }
            if (id === 'sniper') {
                beepAt(ctx, sfxGain, { type: 'square', freq: 190, freqTo: 110, duration: 0.09, release: 0.16, gain: 0.12, filter: { type: 'lowpass', freq: 1500, q: 1.4 } });
                noiseAt(ctx, sfxGain, { gain: 0.05, duration: 0.04, release: 0.05, filterType: 'highpass', filterFreq: 1100, rate: 0.92 });
                return;
            }
            if (id === 'machinegun') {
                beepAt(ctx, sfxGain, { type: 'square', freq: 172, freqTo: 125, duration: 0.035, release: 0.07, gain: 0.055, detune: (Math.random() * 40 - 20), filter: { type: 'lowpass', freq: 2200, q: 0.8 } });
                return;
            }
            if (id === 'pistol') {
                beepAt(ctx, sfxGain, { type: 'square', freq: 240, freqTo: 145, duration: 0.05, release: 0.08, gain: 0.08, filter: { type: 'lowpass', freq: 1800, q: 0.8 } });
                return;
            }
            if (id === 'plasma') {
                beepAt(ctx, sfxGain, { type: 'sawtooth', freq: 420, freqTo: 260, duration: 0.04, release: 0.06, gain: 0.06, filter: { type: 'bandpass', freq: 620, q: 1.2 } });
                return;
            }
            // Rifle default
            beepAt(ctx, sfxGain, { type: 'triangle', freq: 205, freqTo: 130, duration: 0.05, release: 0.09, gain: 0.075, filter: { type: 'lowpass', freq: 1600, q: 0.9 } });
        });
    };

    GameAudio.playHit = function (hitType) {
        if (!canEmit('hit')) return;
        withCtx(function (ctx) {
            if (ctx.state !== 'running') return;
            if (hitType === 'head') {
                beepAt(ctx, sfxGain, { type: 'triangle', freq: 920, freqTo: 680, duration: 0.045, release: 0.07, gain: 0.06 });
            } else {
                beepAt(ctx, sfxGain, { type: 'sine', freq: 620, freqTo: 480, duration: 0.03, release: 0.05, gain: 0.045 });
            }
        });
    };

    GameAudio.playKill = function () {
        if (!canEmit('kill')) return;
        withCtx(function (ctx) {
            if (ctx.state !== 'running') return;
            var t = ctx.currentTime;
            beepAt(ctx, sfxGain, { when: t, type: 'triangle', freq: 520, duration: 0.05, release: 0.06, gain: 0.07 });
            beepAt(ctx, sfxGain, { when: t + 0.06, type: 'triangle', freq: 740, duration: 0.07, release: 0.08, gain: 0.08 });
        });
    };

    GameAudio.playPlayerDamage = function (hitType, amount) {
        if (!canEmit('damage')) return;
        withCtx(function (ctx) {
            if (ctx.state !== 'running') return;
            var dmg = Math.max(1, Number(amount || 1));
            var gain = 0.035 + Math.min(0.045, dmg / 360);
            var base = hitType === 'head' ? 140 : 170;
            beepAt(ctx, sfxGain, { type: 'sine', freq: base, freqTo: 95, duration: 0.05, release: 0.12, gain: gain, filter: { type: 'lowpass', freq: 800, q: 1.1 } });
        });
    };

    GameAudio.playPlayerDeath = function () {
        withCtx(function (ctx) {
            if (ctx.state !== 'running') return;
            var t = ctx.currentTime;
            beepAt(ctx, sfxGain, { when: t, type: 'sawtooth', freq: 180, freqTo: 70, duration: 0.18, release: 0.2, gain: 0.08, filter: { type: 'lowpass', freq: 600, q: 1.0 } });
            noiseAt(ctx, sfxGain, { when: t + 0.02, gain: 0.03, duration: 0.08, release: 0.12, filterType: 'lowpass', filterFreq: 420, rate: 0.75 });
        });
    };

    GameAudio.playRespawn = function () {
        withCtx(function (ctx) {
            if (ctx.state !== 'running') return;
            var t = ctx.currentTime;
            beepAt(ctx, sfxGain, { when: t, type: 'sine', freq: 260, freqTo: 390, duration: 0.07, release: 0.11, gain: 0.05 });
            beepAt(ctx, sfxGain, { when: t + 0.07, type: 'triangle', freq: 390, freqTo: 520, duration: 0.08, release: 0.12, gain: 0.06 });
        });
    };

    GameAudio.playWeaponSwitch = function () {
        withCtx(function (ctx) {
            if (ctx.state !== 'running') return;
            beepAt(ctx, sfxGain, { type: 'triangle', freq: 410, freqTo: 330, duration: 0.02, release: 0.05, gain: 0.03 });
        });
    };

    GameAudio.playThrow = function (type) {
        withCtx(function (ctx) {
            if (ctx.state !== 'running') return;
            var id = String(type || '');
            if (id === 'knife') {
                beepAt(ctx, sfxGain, { type: 'square', freq: 820, freqTo: 520, duration: 0.035, release: 0.06, gain: 0.04, filter: { type: 'highpass', freq: 600, q: 0.6 } });
                return;
            }
            if (id === 'molotov') {
                noiseAt(ctx, sfxGain, { gain: 0.035, duration: 0.055, release: 0.08, filterType: 'bandpass', filterFreq: 900, filterQ: 0.8, rate: 1.1 });
                beepAt(ctx, sfxGain, { type: 'sine', freq: 290, freqTo: 190, duration: 0.05, release: 0.08, gain: 0.03 });
                return;
            }
            if (id === 'seeker') {
                beepAt(ctx, sfxGain, { type: 'sawtooth', freq: 510, freqTo: 610, duration: 0.04, release: 0.07, gain: 0.035 });
                return;
            }
            // Frag default
            beepAt(ctx, sfxGain, { type: 'triangle', freq: 330, freqTo: 250, duration: 0.05, release: 0.08, gain: 0.035 });
        });
    };

    GameAudio.playJump = function () {
        withCtx(function (ctx) {
            if (ctx.state !== 'running') return;
            beepAt(ctx, sfxGain, { type: 'triangle', freq: 280, freqTo: 360, duration: 0.04, release: 0.07, gain: 0.033 });
        });
    };

    GameAudio.playLand = function (speedNorm) {
        withCtx(function (ctx) {
            if (ctx.state !== 'running') return;
            var n = Math.max(0, Math.min(1.8, Number(speedNorm || 0.6)));
            var g = 0.03 + Math.min(0.05, n * 0.03);
            noiseAt(ctx, sfxGain, { gain: g, duration: 0.045, release: 0.08, filterType: 'lowpass', filterFreq: 760, rate: 0.78 });
            beepAt(ctx, sfxGain, { type: 'sine', freq: 160, freqTo: 110, duration: 0.04, release: 0.08, gain: g * 0.55, filter: { type: 'lowpass', freq: 620, q: 1.0 } });
        });
    };

    GameAudio.playFootstep = function (speedNorm, sprinting) {
        if (!canEmit('footstep')) return;
        withCtx(function (ctx) {
            if (ctx.state !== 'running') return;
            var n = Math.max(0, Math.min(1.8, Number(speedNorm || 0.5)));
            var base = sprinting ? 175 : 205;
            var g = 0.012 + Math.min(0.022, n * 0.015);
            beepAt(ctx, sfxGain, {
                type: 'triangle',
                freq: base + (Math.random() * 22 - 11),
                freqTo: base * 0.72,
                duration: 0.02,
                release: 0.06,
                gain: g,
                filter: { type: 'lowpass', freq: 780, q: 0.85 }
            });
        });
    };

    GameAudio.setPlasma = function (active, overheated) {
        setPlasmaHum(active, overheated);
    };

    window.GameAudio = GameAudio;
})();
