/**
 * audio.js - Web Audio runtime with sampled weapon fire and procedural fallback sounds
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameAudio
 */
(function () {
    'use strict';

    var GameAudio = {};
    var sharedRecipes = (globalThis.__MAYHEM_RUNTIME.GameShared && globalThis.__MAYHEM_RUNTIME.GameShared.assetRecipes) || {};
    var ctx = null;
    var unlockInFlight = false;
    var pendingPlaybacks = [];
    var muted = false;
    var noiseBuffer = null;
    var sampleCache = {};
    var sampleLoaders = {};
    var sampleWarmupStarted = false;

    function weaponPresentationFor(weaponId) {
        var shared = globalThis.__MAYHEM_RUNTIME.GameShared || {};
        return shared.getWeaponPresentation ? shared.getWeaponPresentation(weaponId) : null;
    }

    function weaponSampleDef(weaponId) {
        var presentation = weaponPresentationFor(weaponId) || weaponPresentationFor('rifle');
        return presentation && presentation.audioSample ? presentation.audioSample : null;
    }

    function loadMutedPreference() {
        try {
            var raw = window.localStorage ? window.localStorage.getItem('mayhem_audio_muted') : null;
            muted = raw === '1';
        } catch (err) {
            muted = false;
        }
    }

    function saveMutedPreference() {
        try {
            if (window.localStorage) {
                window.localStorage.setItem('mayhem_audio_muted', muted ? '1' : '0');
            }
        } catch (err) {
            // noop
        }
    }

    function getCtx() {
        if (ctx) return ctx;
        var C = window.AudioContext || window.webkitAudioContext;
        if (!C) return null;
        ctx = new C();
        return ctx;
    }

    function flushPending(c) {
        if (!c || c.state !== 'running') {
            pendingPlaybacks.length = 0;
            return;
        }
        preloadWeaponSamples(c);
        var queue = pendingPlaybacks.slice();
        pendingPlaybacks.length = 0;
        for (var i = 0; i < queue.length; i++) {
            try {
                queue[i](c);
            } catch (err) {
                // noop
            }
        }
    }

    function unlock(onReady) {
        var c = getCtx();
        if (!c) return;

        if (typeof onReady === 'function') {
            pendingPlaybacks.push(onReady);
        }

        if (c.state === 'running') {
            flushPending(c);
            return;
        }

        if (unlockInFlight) return;
        unlockInFlight = true;

        function finish() {
            unlockInFlight = false;
            flushPending(c);
        }

        try {
            var maybePromise = c.resume();
            if (maybePromise && typeof maybePromise.then === 'function') {
                maybePromise.then(finish).catch(function () {
                    unlockInFlight = false;
                    pendingPlaybacks.length = 0;
                });
            } else {
                setTimeout(finish, 0);
            }
        } catch (err) {
            unlockInFlight = false;
            pendingPlaybacks.length = 0;
        }
    }

    function playTone(c, opts) {
        if (!c) return;
        opts = opts || {};
        var freq = opts.freq || 220;
        var duration = opts.duration || 0.08;
        var vol = opts.vol !== undefined ? opts.vol : 0.15;
        var type = opts.type || 'square';
        var attack = opts.attack !== undefined ? opts.attack : 0.01;

        var osc = c.createOscillator();
        var gain = c.createGain();
        osc.connect(gain);
        gain.connect(c.destination);
        osc.type = type;
        osc.frequency.setValueAtTime(freq, c.currentTime);
        gain.gain.setValueAtTime(0, c.currentTime);
        gain.gain.linearRampToValueAtTime(vol, c.currentTime + attack);
        gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
        osc.start(c.currentTime);
        osc.stop(c.currentTime + duration);
    }

    function ensureNoiseBuffer(c) {
        if (!c) return null;
        if (noiseBuffer && noiseBuffer.sampleRate === c.sampleRate) return noiseBuffer;
        var duration = 0.7;
        var bufferSize = Math.max(1, Math.floor(c.sampleRate * duration));
        noiseBuffer = c.createBuffer(1, bufferSize, c.sampleRate);
        var data = noiseBuffer.getChannelData(0);
        for (var i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * (0.65 + Math.random() * 0.35);
        }
        return noiseBuffer;
    }

    function connectNodeChain(source, nodes, destination) {
        var current = source;
        for (var i = 0; i < nodes.length; i++) {
            current.connect(nodes[i]);
            current = nodes[i];
        }
        current.connect(destination);
    }

    function randomBetween(min, max) {
        if (max <= min) return min;
        return min + (Math.random() * (max - min));
    }

    function getFetch() {
        if (typeof window === 'undefined' || typeof window.fetch !== 'function') return null;
        return window.fetch.bind(window);
    }

    function decodeAudioData(c, arrayBuffer) {
        if (!c || !arrayBuffer) return Promise.resolve(null);
        return new Promise(function (resolve, reject) {
            try {
                var clonedBuffer = arrayBuffer.slice(0);
                var maybePromise = c.decodeAudioData(clonedBuffer, resolve, reject);
                if (maybePromise && typeof maybePromise.then === 'function') {
                    maybePromise.then(resolve).catch(reject);
                }
            } catch (err) {
                reject(err);
            }
        });
    }

    function loadSampleBuffer(c, url) {
        if (!c || !url) return Promise.resolve(null);
        if (Object.prototype.hasOwnProperty.call(sampleCache, url)) {
            return Promise.resolve(sampleCache[url]);
        }
        if (sampleLoaders[url]) return sampleLoaders[url];
        var fetcher = getFetch();
        if (!fetcher) return Promise.resolve(null);
        sampleLoaders[url] = fetcher(url)
            .then(function (response) {
                if (!response || !response.ok) {
                    throw new Error('Failed to fetch sample: ' + url);
                }
                return response.arrayBuffer();
            })
            .then(function (arrayBuffer) {
                return decodeAudioData(c, arrayBuffer);
            })
            .then(function (buffer) {
                sampleCache[url] = buffer || null;
                return sampleCache[url];
            })
            .catch(function () {
                sampleCache[url] = null;
                return null;
            })
            .then(function (result) {
                delete sampleLoaders[url];
                return result;
            }, function (err) {
                delete sampleLoaders[url];
                throw err;
            });
        return sampleLoaders[url];
    }

    function preloadWeaponSamples(c) {
        if (sampleWarmupStarted || !c || c.state !== 'running') return;
        sampleWarmupStarted = true;
        var seen = {};
        var shared = globalThis.__MAYHEM_RUNTIME.GameShared || {};
        var weaponIds = shared.getSelectableWeaponIds ? shared.getSelectableWeaponIds() : ['pistol', 'rifle', 'machinegun', 'shotgun', 'sniper'];
        for (var i = 0; i < weaponIds.length; i++) {
            var sampleDef = weaponSampleDef(weaponIds[i]);
            if (!sampleDef || !sampleDef.url || seen[sampleDef.url]) continue;
            seen[sampleDef.url] = true;
            loadSampleBuffer(c, sampleDef.url);
        }
    }

    function playSampleBuffer(c, sampleDef) {
        if (!c || !sampleDef || !sampleDef.url) return false;
        var buffer = sampleCache[sampleDef.url];
        if (!buffer) {
            loadSampleBuffer(c, sampleDef.url);
            return false;
        }
        var source = c.createBufferSource();
        var gain = c.createGain();
        source.buffer = buffer;
        source.playbackRate.setValueAtTime(randomBetween(sampleDef.playbackRateMin || 1, sampleDef.playbackRateMax || 1), c.currentTime);
        gain.gain.setValueAtTime(sampleDef.gain !== undefined ? sampleDef.gain : 1, c.currentTime);
        source.connect(gain);
        gain.connect(c.destination);
        source.start(c.currentTime);
        return true;
    }

    function playOscBurst(c, opts) {
        if (!c) return;
        opts = opts || {};
        var start = c.currentTime + (opts.delay || 0);
        var duration = Math.max(0.01, Number(opts.duration || 0.08));
        var attack = Math.max(0.0008, Number(opts.attack || 0.002));
        var end = start + duration;
        var startFreq = Math.max(20, Number(opts.startFreq || opts.freq || 220));
        var endFreq = Math.max(20, Number(opts.endFreq || startFreq));
        var peak = Math.max(0.0001, Number(opts.vol || 0.12));

        var osc = c.createOscillator();
        var gain = c.createGain();
        osc.type = opts.type || 'triangle';
        osc.frequency.setValueAtTime(startFreq, start);
        osc.frequency.exponentialRampToValueAtTime(endFreq, end);
        if (typeof opts.detune === 'number') {
            osc.detune.setValueAtTime(opts.detune, start);
        }
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(peak, start + attack);
        gain.gain.exponentialRampToValueAtTime(0.0001, end);
        osc.connect(gain);
        gain.connect(c.destination);
        osc.start(start);
        osc.stop(end + 0.02);
    }

    function playNoiseBurst(c, opts) {
        if (!c) return;
        opts = opts || {};
        var buffer = ensureNoiseBuffer(c);
        if (!buffer) return;
        var start = c.currentTime + (opts.delay || 0);
        var duration = Math.max(0.01, Number(opts.duration || 0.08));
        var end = start + duration;
        var source = c.createBufferSource();
        var gain = c.createGain();
        var filter = c.createBiquadFilter();
        source.buffer = buffer;
        source.playbackRate.setValueAtTime(Number(opts.playbackRate || 1), start);
        filter.type = opts.filterType || 'bandpass';
        filter.frequency.setValueAtTime(Math.max(80, Number(opts.frequency || 1200)), start);
        filter.Q.setValueAtTime(Math.max(0.0001, Number(opts.q || 0.8)), start);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, Number(opts.vol || 0.06)), start + Math.max(0.0008, Number(opts.attack || 0.002)));
        gain.gain.exponentialRampToValueAtTime(0.0001, end);
        connectNodeChain(source, [filter, gain], c.destination);
        source.start(start);
        source.stop(end + 0.02);
    }

    function playWeaponFireProcedural(c, weaponId) {
        var weapon = String(weaponId || 'rifle');
        if (weapon === 'pistol') {
            playNoiseBurst(c, { duration: 0.02, vol: 0.06, frequency: 4200, q: 1.8, filterType: 'highpass' });
            playNoiseBurst(c, { duration: 0.042, vol: 0.05, frequency: 1850, q: 1.4, filterType: 'bandpass', delay: 0.0015 });
            playOscBurst(c, { type: 'triangle', startFreq: 280, endFreq: 118, duration: 0.082, vol: 0.052 });
            playOscBurst(c, { type: 'sine', startFreq: 148, endFreq: 82, duration: 0.11, vol: 0.026, delay: 0.005 });
            return;
        }
        if (weapon === 'rifle') {
            playNoiseBurst(c, { duration: 0.024, vol: 0.068, frequency: 4600, q: 1.5, filterType: 'highpass' });
            playNoiseBurst(c, { duration: 0.056, vol: 0.058, frequency: 1700, q: 1.1, filterType: 'bandpass', delay: 0.002 });
            playOscBurst(c, { type: 'triangle', startFreq: 255, endFreq: 92, duration: 0.12, vol: 0.058 });
            playOscBurst(c, { type: 'sawtooth', startFreq: 640, endFreq: 170, duration: 0.04, vol: 0.022, delay: 0.001 });
            playOscBurst(c, { type: 'sine', startFreq: 108, endFreq: 62, duration: 0.14, vol: 0.02, delay: 0.006 });
            return;
        }
        if (weapon === 'machinegun') {
            playNoiseBurst(c, { duration: 0.024, vol: 0.034, frequency: 3600, q: 1.6, filterType: 'highpass' });
            playOscBurst(c, { type: 'sawtooth', startFreq: 520, endFreq: 170, duration: 0.045, vol: 0.055 });
            playOscBurst(c, { type: 'triangle', startFreq: 150, endFreq: 92, duration: 0.08, vol: 0.03, delay: 0.003 });
            return;
        }
        if (weapon === 'shotgun') {
            playNoiseBurst(c, { duration: 0.12, vol: 0.09, frequency: 1500, q: 0.7, filterType: 'bandpass' });
            playOscBurst(c, { type: 'triangle', startFreq: 180, endFreq: 52, duration: 0.22, vol: 0.13 });
            playOscBurst(c, { type: 'square', startFreq: 520, endFreq: 110, duration: 0.08, vol: 0.06, delay: 0.002 });
            return;
        }
        if (weapon === 'sniper') {
            playNoiseBurst(c, { duration: 0.09, vol: 0.095, frequency: 4200, q: 1.4, filterType: 'highpass' });
            playOscBurst(c, { type: 'square', startFreq: 980, endFreq: 180, duration: 0.11, vol: 0.09 });
            playOscBurst(c, { type: 'triangle', startFreq: 240, endFreq: 72, duration: 0.24, vol: 0.06, delay: 0.006 });
            return;
        }
        if (weapon === 'missile' || weapon === 'plasma') {
            playOscBurst(c, { type: 'sawtooth', startFreq: 420, endFreq: 980, duration: 0.06, vol: 0.05 });
            playOscBurst(c, { type: 'triangle', startFreq: 960, endFreq: 320, duration: 0.12, vol: 0.04, delay: 0.01 });
            playNoiseBurst(c, { duration: 0.04, vol: 0.022, frequency: 2800, q: 2.1, filterType: 'bandpass', delay: 0.004 });
            return;
        }
        playNoiseBurst(c, { duration: 0.045, vol: 0.05, frequency: 2600, q: 1.2, filterType: 'bandpass' });
        playOscBurst(c, { type: 'square', startFreq: 680, endFreq: 180, duration: 0.07, vol: 0.065 });
        playOscBurst(c, { type: 'triangle', startFreq: 170, endFreq: 95, duration: 0.11, vol: 0.04, delay: 0.004 });
    }

    function playShotgunKickAccent(c) {
        playNoiseBurst(c, { duration: 0.028, vol: 0.03, frequency: 2400, q: 2.2, filterType: 'highpass' });
        playOscBurst(c, { type: 'triangle', startFreq: 150, endFreq: 64, duration: 0.12, vol: 0.032, attack: 0.0012, delay: 0.001 });
        playOscBurst(c, { type: 'sine', startFreq: 84, endFreq: 52, duration: 0.16, vol: 0.018, attack: 0.0015, delay: 0.004 });
    }

    function playWeaponFire(c, weaponId) {
        var weapon = String(weaponId || 'rifle');
        if (weapon === 'missile' || weapon === 'plasma') {
            playWeaponFireProcedural(c, weapon);
            return;
        }
        if (playSampleBuffer(c, weaponSampleDef(weapon))) {
            if (weapon === 'shotgun') {
                playShotgunKickAccent(c);
            }
            return;
        }
        playWeaponFireProcedural(c, weapon);
    }

    function playKillFinisher(c, head) {
        var accentStart = head ? 1240 : 1080;
        var accentEnd = head ? 760 : 660;
        var bodyStart = head ? 320 : 286;
        var bodyEnd = head ? 120 : 108;

        // Strong, consistent kill confirm with a bright transient and a heavy body.
        playNoiseBurst(c, { duration: 0.018, vol: 0.1, frequency: 6200, q: 2.8, filterType: 'highpass' });
        playNoiseBurst(c, { duration: 0.085, vol: 0.078, frequency: 2600, q: 1.5, filterType: 'bandpass', delay: 0.0015 });
        playNoiseBurst(c, { duration: 0.14, vol: 0.055, frequency: 980, q: 0.9, filterType: 'bandpass', delay: 0.006 });

        playOscBurst(c, { type: 'square', startFreq: accentStart, endFreq: accentEnd, duration: 0.045, vol: 0.055, delay: 0.001 });
        playOscBurst(c, { type: 'triangle', startFreq: bodyStart, endFreq: bodyEnd, duration: 0.22, vol: 0.125, delay: 0.002 });
        playOscBurst(c, { type: 'sine', startFreq: head ? 520 : 440, endFreq: head ? 300 : 250, duration: 0.12, vol: 0.046, delay: 0.014 });
        playOscBurst(c, { type: 'triangle', startFreq: head ? 700 : 620, endFreq: head ? 460 : 400, duration: 0.07, vol: 0.04, delay: 0.024 });
    }

    function playBulletImpact(c, opts) {
        opts = opts || {};
        var killed = !!opts.killed;
        var head = opts.hitType === 'head';
        var weapon = String(opts.weapon || '');
        var isShotgun = weapon === 'shotgun';
        playNoiseBurst(c, {
            duration: isShotgun ? 0.042 : (head ? 0.055 : 0.07),
            vol: (head ? 0.04 : 0.048) * (isShotgun ? 1.08 : 1),
            frequency: head ? (isShotgun ? 3080 : 2600) : (isShotgun ? 2200 : 1800),
            q: head ? 2.2 : (isShotgun ? 1.7 : 1.3),
            filterType: 'bandpass'
        });
        playNoiseBurst(c, {
            duration: isShotgun ? 0.034 : 0.05,
            vol: isShotgun ? 0.032 : 0.02,
            frequency: isShotgun ? 3400 : 4200,
            q: isShotgun ? 2.4 : 1.6,
            filterType: 'highpass',
            delay: isShotgun ? 0.0015 : 0.004
        });
        if (isShotgun) {
            playNoiseBurst(c, {
                duration: 0.026,
                vol: head ? 0.022 : 0.026,
                frequency: 1900,
                q: 3.2,
                filterType: 'bandpass',
                delay: 0.003
            });
        }
        playOscBurst(c, {
            type: head ? 'square' : 'triangle',
            startFreq: head ? (isShotgun ? 620 : 540) : (isShotgun ? 250 : 220),
            endFreq: head ? (isShotgun ? 260 : 220) : (isShotgun ? 135 : 110),
            duration: killed ? 0.12 : (isShotgun ? 0.05 : 0.07),
            vol: killed ? 0.018 : (isShotgun ? 0.018 : 0.028),
            delay: 0.002
        });
        if (killed) {
            playKillFinisher(c, head);
        }
    }

    function playPlayerHit(c) {
        playNoiseBurst(c, { duration: 0.08, vol: 0.03, frequency: 900, q: 0.9, filterType: 'bandpass' });
        playOscBurst(c, { type: 'triangle', startFreq: 128, endFreq: 76, duration: 0.09, vol: 0.022 });
        playOscBurst(c, { type: 'square', startFreq: 210, endFreq: 120, duration: 0.05, vol: 0.012, delay: 0.004 });
    }

    function playThemeSong(c) {
        var notes = [
            { type: 'triangle', startFreq: 392, endFreq: 392, duration: 0.16, delay: 0.00, vol: 0.03 },
            { type: 'triangle', startFreq: 494, endFreq: 494, duration: 0.16, delay: 0.12, vol: 0.03 },
            { type: 'triangle', startFreq: 587, endFreq: 587, duration: 0.18, delay: 0.24, vol: 0.034 },
            { type: 'sine', startFreq: 784, endFreq: 784, duration: 0.24, delay: 0.38, vol: 0.04 }
        ];
        for (var i = 0; i < notes.length; i++) {
            playOscBurst(c, notes[i]);
        }
        playNoiseBurst(c, { duration: 0.12, vol: 0.012, frequency: 2200, q: 1.4, filterType: 'bandpass', delay: 0.02 });
    }

    function playSwordClash(c) {
        playNoiseBurst(c, { duration: 0.045, vol: 0.05, frequency: 3600, q: 2.4, filterType: 'highpass' });
        playNoiseBurst(c, { duration: 0.11, vol: 0.04, frequency: 2100, q: 1.8, filterType: 'bandpass', delay: 0.002 });
        playOscBurst(c, { type: 'square', startFreq: 1260, endFreq: 620, duration: 0.09, vol: 0.03, delay: 0.001 });
    }

    function playPunchHit(c) {
        playNoiseBurst(c, { duration: 0.06, vol: 0.036, frequency: 880, q: 0.72, filterType: 'bandpass' });
        playOscBurst(c, { type: 'triangle', startFreq: 146, endFreq: 86, duration: 0.08, vol: 0.03 });
    }

    function playLevelUpNoise(c) {
        playOscBurst(c, { type: 'triangle', startFreq: 392, endFreq: 392, duration: 0.08, vol: 0.028 });
        playOscBurst(c, { type: 'triangle', startFreq: 523, endFreq: 523, duration: 0.1, vol: 0.03, delay: 0.08 });
        playOscBurst(c, { type: 'sine', startFreq: 659, endFreq: 784, duration: 0.16, vol: 0.038, delay: 0.16 });
    }

    function playAmbientWeather(c) {
        playNoiseBurst(c, { duration: 0.34, vol: 0.026, frequency: 720, q: 0.6, filterType: 'lowpass' });
        playNoiseBurst(c, { duration: 0.22, vol: 0.012, frequency: 2200, q: 1.2, filterType: 'bandpass', delay: 0.03 });
        playOscBurst(c, { type: 'sine', startFreq: 78, endFreq: 62, duration: 0.28, vol: 0.01, delay: 0.05 });
    }

    function playDoorOpen(c) {
        playNoiseBurst(c, { duration: 0.08, vol: 0.028, frequency: 460, q: 0.7, filterType: 'lowpass' });
        playNoiseBurst(c, { duration: 0.05, vol: 0.018, frequency: 1800, q: 1.4, filterType: 'bandpass', delay: 0.01 });
        playOscBurst(c, { type: 'triangle', startFreq: 180, endFreq: 120, duration: 0.12, vol: 0.016 });
    }

    function playPigOink(c) {
        playOscBurst(c, { type: 'square', startFreq: 310, endFreq: 230, duration: 0.12, vol: 0.028 });
        playOscBurst(c, { type: 'square', startFreq: 250, endFreq: 180, duration: 0.09, vol: 0.02, delay: 0.03 });
    }

    function playZombieGrowl(c) {
        playNoiseBurst(c, { duration: 0.16, vol: 0.018, frequency: 620, q: 0.9, filterType: 'bandpass' });
        playOscBurst(c, { type: 'sawtooth', startFreq: 118, endFreq: 74, duration: 0.18, vol: 0.026 });
        playOscBurst(c, { type: 'triangle', startFreq: 92, endFreq: 64, duration: 0.22, vol: 0.022, delay: 0.02 });
    }

    function playZombieHurt(c) {
        playNoiseBurst(c, { duration: 0.12, vol: 0.022, frequency: 880, q: 1.0, filterType: 'bandpass' });
        playOscBurst(c, { type: 'triangle', startFreq: 150, endFreq: 82, duration: 0.12, vol: 0.024 });
    }

    function playPortalIdle(c) {
        playOscBurst(c, { type: 'sine', startFreq: 240, endFreq: 220, duration: 0.26, vol: 0.014 });
        playOscBurst(c, { type: 'triangle', startFreq: 480, endFreq: 420, duration: 0.22, vol: 0.01, delay: 0.04 });
    }

    function playPortalTravel(c) {
        playNoiseBurst(c, { duration: 0.08, vol: 0.024, frequency: 2400, q: 1.8, filterType: 'bandpass' });
        playOscBurst(c, { type: 'sawtooth', startFreq: 240, endFreq: 920, duration: 0.1, vol: 0.03 });
    }

    function playPortalTeleport(c) {
        playNoiseBurst(c, { duration: 0.18, vol: 0.03, frequency: 1200, q: 0.8, filterType: 'bandpass' });
        playOscBurst(c, { type: 'triangle', startFreq: 920, endFreq: 210, duration: 0.22, vol: 0.04 });
    }

    function playFireIgnite(c) {
        playNoiseBurst(c, { duration: 0.06, vol: 0.05, frequency: 2600, q: 1.6, filterType: 'highpass' });
        playNoiseBurst(c, { duration: 0.14, vol: 0.025, frequency: 980, q: 0.8, filterType: 'bandpass', delay: 0.01 });
    }

    function playFireBurning(c) {
        playNoiseBurst(c, { duration: 0.22, vol: 0.02, frequency: 1400, q: 0.9, filterType: 'bandpass' });
        playNoiseBurst(c, { duration: 0.18, vol: 0.012, frequency: 3200, q: 1.8, filterType: 'highpass', delay: 0.03 });
    }

    GameAudio.play = function (soundId, options) {
        if (muted) return;
        options = options || {};
        unlock(function (c) {
            switch (soundId) {
                case 'fire':
                    playWeaponFire(c, options.weapon || 'rifle');
                    break;
                case 'plasma':
                    playWeaponFire(c, 'plasma');
                    break;
                case 'bulletImpact':
                case 'enemyHit':
                    playBulletImpact(c, options);
                    break;
                case 'playerHit':
                    playPlayerHit(c);
                    break;
                case 'themeSong':
                    playThemeSong(c);
                    break;
                case 'swordClash':
                    playSwordClash(c);
                    break;
                case 'punchHit':
                    playPunchHit(c);
                    break;
                case 'levelUpNoise':
                    playLevelUpNoise(c);
                    break;
                case 'ambientWeather':
                    playAmbientWeather(c);
                    break;
                case 'doorOpen':
                    playDoorOpen(c);
                    break;
                case 'pigOink':
                    playPigOink(c);
                    break;
                case 'zombieGrowl':
                    playZombieGrowl(c);
                    break;
                case 'zombieHurt':
                    playZombieHurt(c);
                    break;
                case 'portalIdle':
                    playPortalIdle(c);
                    break;
                case 'portalTravel':
                    playPortalTravel(c);
                    break;
                case 'portalTeleport':
                    playPortalTeleport(c);
                    break;
                case 'fireIgnite':
                    playFireIgnite(c);
                    break;
                case 'fireBurning':
                    playFireBurning(c);
                    break;
                case 'explosion':
                    playNoiseBurst(c, { duration: 0.25, vol: 0.11, frequency: 640, q: 0.55, filterType: 'lowpass' });
                    playOscBurst(c, { type: 'sawtooth', startFreq: 110, endFreq: 42, duration: 0.22, vol: 0.12 });
                    break;
                case 'throw':
                    playOscBurst(c, { type: 'sine', startFreq: 240, endFreq: 160, duration: 0.06, vol: 0.05 });
                    break;
                default:
                    break;
            }
        });
    };

    GameAudio.playAssetCue = function (soundId, options) {
        GameAudio.play(soundId, options);
    };

    GameAudio.getAssetCueIds = function () {
        var defs = sharedRecipes && sharedRecipes.definitions ? sharedRecipes.definitions.sound : null;
        return defs ? Object.keys(defs) : ['themeSong', 'swordClash', 'punchHit', 'levelUpNoise', 'ambientWeather'];
    };

    GameAudio.unlock = function () {
        unlock();
    };

    GameAudio.setMuted = function (nextMuted) {
        muted = !!nextMuted;
        saveMutedPreference();
        return muted;
    };

    GameAudio.isMuted = function () {
        return !!muted;
    };

    loadMutedPreference();

    globalThis.__MAYHEM_RUNTIME.GameAudio = GameAudio;
})();
