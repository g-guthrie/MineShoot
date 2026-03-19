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
    var masterVolume = 75;
    var sfxVolume = 50;
    var noiseBuffer = null;
    var sampleCache = {};
    var sampleLoaders = {};
    var sampleWarmupStarted = false;
    var masterGainNode = null;
    var sfxGainNode = null;
    var chokeLoops = {
        caster: null,
        victim: null
    };

    function clampVolume(value, fallback) {
        var next = Number(value);
        if (!Number.isFinite(next)) return fallback;
        return Math.max(0, Math.min(100, Math.round(next)));
    }

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

    function loadVolumePreferences() {
        try {
            var store = window.localStorage || null;
            masterVolume = clampVolume(store ? store.getItem('mayhem_audio_master_volume') : null, 75);
            sfxVolume = clampVolume(store ? store.getItem('mayhem_audio_sfx_volume') : null, 50);
        } catch (err) {
            masterVolume = 75;
            sfxVolume = 50;
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

    function saveVolumePreference(key, value) {
        try {
            if (window.localStorage) {
                window.localStorage.setItem(key, String(value));
            }
        } catch (err) {
            // noop
        }
    }

    function syncGainLevels(c) {
        var currentCtx = c || ctx;
        if (masterGainNode && currentCtx) {
            masterGainNode.gain.setValueAtTime(masterVolume / 100, currentCtx.currentTime);
        }
        if (sfxGainNode && currentCtx) {
            sfxGainNode.gain.setValueAtTime(sfxVolume / 100, currentCtx.currentTime);
        }
    }

    function ensureGainGraph(c) {
        if (!c) return null;
        if (!masterGainNode || masterGainNode.context !== c) {
            masterGainNode = c.createGain();
            masterGainNode.connect(c.destination);
        }
        if (!sfxGainNode || sfxGainNode.context !== c) {
            sfxGainNode = c.createGain();
            sfxGainNode.connect(masterGainNode);
        }
        syncGainLevels(c);
        return {
            master: masterGainNode,
            sfx: sfxGainNode
        };
    }

    function sfxDestination(c) {
        var graph = ensureGainGraph(c);
        return graph && graph.sfx ? graph.sfx : (c ? c.destination : null);
    }

    function getCtx() {
        if (ctx) return ctx;
        var C = window.AudioContext || window.webkitAudioContext;
        if (!C) return null;
        ctx = new C();
        ensureGainGraph(ctx);
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
        gain.connect(sfxDestination(c));
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

    function playSampleLayer(c, buffer, opts) {
        if (!c || !buffer) return false;
        opts = opts || {};
        var start = c.currentTime + (opts.delay || 0);
        var source = c.createBufferSource();
        var gain = c.createGain();
        var nodes = [];
        source.buffer = buffer;
        source.playbackRate.setValueAtTime(
            Number(
                opts.playbackRate !== undefined
                    ? opts.playbackRate
                    : randomBetween(opts.playbackRateMin || 1, opts.playbackRateMax || 1)
            ),
            start
        );
        if (opts.filterType) {
            var filter = c.createBiquadFilter();
            filter.type = opts.filterType;
            filter.frequency.setValueAtTime(Math.max(40, Number(opts.frequency || 1200)), start);
            filter.Q.setValueAtTime(Math.max(0.0001, Number(opts.q || 0.7)), start);
            nodes.push(filter);
        }
        gain.gain.setValueAtTime(opts.gain !== undefined ? opts.gain : 1, start);
        nodes.push(gain);
        connectNodeChain(source, nodes, sfxDestination(c));
        source.start(start);
        if (opts.duration) {
            source.stop(start + Math.max(0.01, Number(opts.duration)));
        }
        return true;
    }

    function playSampleBuffer(c, sampleDef) {
        if (!c || !sampleDef || !sampleDef.url) return false;
        var buffer = sampleCache[sampleDef.url];
        if (!buffer) {
            loadSampleBuffer(c, sampleDef.url);
            return false;
        }
        return playSampleLayer(c, buffer, {
            gain: sampleDef.gain !== undefined ? sampleDef.gain : 1,
            playbackRateMin: sampleDef.playbackRateMin || 1,
            playbackRateMax: sampleDef.playbackRateMax || 1
        });
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
        gain.connect(sfxDestination(c));
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
        connectNodeChain(source, [filter, gain], sfxDestination(c));
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
            playNoiseBurst(c, { duration: 0.018, vol: 0.055, frequency: 4200, q: 1.8, filterType: 'highpass' });
            playNoiseBurst(c, { duration: 0.075, vol: 0.078, frequency: 1650, q: 0.95, filterType: 'bandpass', delay: 0.001 });
            playNoiseBurst(c, { duration: 0.11, vol: 0.03, frequency: 520, q: 0.7, filterType: 'lowpass', delay: 0.004 });
            playOscBurst(c, { type: 'sawtooth', startFreq: 340, endFreq: 120, duration: 0.055, vol: 0.05, attack: 0.001 });
            playOscBurst(c, { type: 'triangle', startFreq: 152, endFreq: 54, duration: 0.19, vol: 0.09, attack: 0.001, delay: 0.001 });
            playOscBurst(c, { type: 'sine', startFreq: 84, endFreq: 44, duration: 0.23, vol: 0.05, attack: 0.0012, delay: 0.004 });
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
        playNoiseBurst(c, { duration: 0.014, vol: 0.022, frequency: 4600, q: 2.1, filterType: 'highpass' });
        playNoiseBurst(c, { duration: 0.045, vol: 0.028, frequency: 1600, q: 1.0, filterType: 'bandpass', delay: 0.001 });
        playOscBurst(c, { type: 'sawtooth', startFreq: 320, endFreq: 120, duration: 0.05, vol: 0.022, attack: 0.0009, delay: 0.001 });
        playOscBurst(c, { type: 'triangle', startFreq: 142, endFreq: 56, duration: 0.16, vol: 0.04, attack: 0.001, delay: 0.001 });
        playOscBurst(c, { type: 'sine', startFreq: 80, endFreq: 44, duration: 0.21, vol: 0.026, attack: 0.0012, delay: 0.004 });
    }

    function playShotgunFireSample(c, sampleDef) {
        if (!c || !sampleDef || !sampleDef.url) return false;
        var buffer = sampleCache[sampleDef.url];
        if (!buffer) {
            loadSampleBuffer(c, sampleDef.url);
            return false;
        }
        var gain = sampleDef.gain !== undefined ? sampleDef.gain : 1;
        playSampleLayer(c, buffer, {
            gain: gain * 0.74,
            playbackRateMin: sampleDef.playbackRateMin || 1,
            playbackRateMax: sampleDef.playbackRateMax || 1
        });
        playSampleLayer(c, buffer, {
            gain: gain * 0.12,
            playbackRateMin: 1.04,
            playbackRateMax: 1.1,
            filterType: 'highpass',
            frequency: 2400,
            q: 0.85,
            duration: 0.085
        });
        playSampleLayer(c, buffer, {
            gain: gain * 0.13,
            playbackRateMin: 0.98,
            playbackRateMax: 1.03,
            filterType: 'bandpass',
            frequency: 760,
            q: 0.72,
            duration: 0.16,
            delay: 0.001
        });
        playSampleLayer(c, buffer, {
            gain: gain * 0.17,
            playbackRateMin: 0.93,
            playbackRateMax: 0.98,
            filterType: 'lowpass',
            frequency: 180,
            q: 0.65,
            duration: 0.22,
            delay: 0.002
        });
        playShotgunKickAccent(c);
        return true;
    }

    function playWeaponFire(c, weaponId) {
        var weapon = String(weaponId || 'rifle');
        if (weapon === 'missile' || weapon === 'plasma') {
            playWeaponFireProcedural(c, weapon);
            return;
        }
        if (weapon === 'shotgun' && playShotgunFireSample(c, weaponSampleDef(weapon))) {
            return;
        }
        if (playSampleBuffer(c, weaponSampleDef(weapon))) {
            return;
        }
        playWeaponFireProcedural(c, weapon);
    }

    function reloadProfileKey(cueId, weaponId) {
        var cue = String(cueId || '').toLowerCase();
        if (cue.indexOf('sidearm') !== -1) return 'sidearm';
        if (cue.indexOf('precision') !== -1) return 'precision';
        if (cue.indexOf('lmg') !== -1) return 'lmg';
        if (cue.indexOf('shotgun') !== -1) return 'shotgun';
        if (cue.indexOf('rifle') !== -1) return 'rifle';
        var weapon = String(weaponId || '').toLowerCase();
        if (weapon === 'pistol') return 'sidearm';
        if (weapon === 'sniper') return 'precision';
        if (weapon === 'machinegun') return 'lmg';
        if (weapon === 'shotgun') return 'shotgun';
        return 'rifle';
    }

    function playReloadCue(c, weaponId, cueName, cueId) {
        if (!c) return;
        var cue = String(cueName || 'start').toLowerCase();
        var profile = reloadProfileKey(cueId, weaponId);

        if (cue === 'start') {
            if (profile === 'sidearm') {
                playNoiseBurst(c, { duration: 0.028, vol: 0.018, frequency: 2800, q: 3.2, filterType: 'bandpass' });
                playOscBurst(c, { type: 'square', startFreq: 760, endFreq: 420, duration: 0.045, vol: 0.012, delay: 0.001 });
                return;
            }
            if (profile === 'precision') {
                playNoiseBurst(c, { duration: 0.032, vol: 0.022, frequency: 2200, q: 2.1, filterType: 'bandpass' });
                playOscBurst(c, { type: 'triangle', startFreq: 320, endFreq: 220, duration: 0.07, vol: 0.012, delay: 0.002 });
                return;
            }
            if (profile === 'shotgun') {
                playNoiseBurst(c, { duration: 0.038, vol: 0.026, frequency: 1700, q: 1.4, filterType: 'bandpass' });
                playOscBurst(c, { type: 'triangle', startFreq: 240, endFreq: 160, duration: 0.08, vol: 0.016, delay: 0.002 });
                return;
            }
            if (profile === 'lmg') {
                playNoiseBurst(c, { duration: 0.032, vol: 0.024, frequency: 1500, q: 1.2, filterType: 'bandpass' });
                playOscBurst(c, { type: 'triangle', startFreq: 220, endFreq: 140, duration: 0.075, vol: 0.015, delay: 0.002 });
                return;
            }
            playNoiseBurst(c, { duration: 0.03, vol: 0.02, frequency: 2100, q: 2.0, filterType: 'bandpass' });
            playOscBurst(c, { type: 'triangle', startFreq: 280, endFreq: 190, duration: 0.065, vol: 0.013, delay: 0.002 });
            return;
        }

        if (cue === 'manipulate') {
            if (profile === 'sidearm') {
                playNoiseBurst(c, { duration: 0.03, vol: 0.022, frequency: 3200, q: 3.4, filterType: 'highpass' });
                playNoiseBurst(c, { duration: 0.048, vol: 0.02, frequency: 1850, q: 2.0, filterType: 'bandpass', delay: 0.004 });
                playOscBurst(c, { type: 'square', startFreq: 940, endFreq: 520, duration: 0.05, vol: 0.012, delay: 0.002 });
                return;
            }
            if (profile === 'precision') {
                playNoiseBurst(c, { duration: 0.055, vol: 0.026, frequency: 1500, q: 1.4, filterType: 'bandpass' });
                playNoiseBurst(c, { duration: 0.03, vol: 0.018, frequency: 3200, q: 3.0, filterType: 'highpass', delay: 0.01 });
                playOscBurst(c, { type: 'triangle', startFreq: 240, endFreq: 130, duration: 0.11, vol: 0.016, delay: 0.004 });
                return;
            }
            if (profile === 'shotgun') {
                playNoiseBurst(c, { duration: 0.06, vol: 0.032, frequency: 1280, q: 1.1, filterType: 'bandpass' });
                playNoiseBurst(c, { duration: 0.04, vol: 0.02, frequency: 2400, q: 2.8, filterType: 'highpass', delay: 0.012 });
                playOscBurst(c, { type: 'sawtooth', startFreq: 210, endFreq: 120, duration: 0.12, vol: 0.018, delay: 0.004 });
                return;
            }
            if (profile === 'lmg') {
                playNoiseBurst(c, { duration: 0.05, vol: 0.03, frequency: 1180, q: 1.0, filterType: 'bandpass' });
                playNoiseBurst(c, { duration: 0.028, vol: 0.018, frequency: 2600, q: 2.6, filterType: 'highpass', delay: 0.008 });
                playOscBurst(c, { type: 'triangle', startFreq: 180, endFreq: 108, duration: 0.1, vol: 0.017, delay: 0.004 });
                return;
            }
            playNoiseBurst(c, { duration: 0.042, vol: 0.026, frequency: 1600, q: 1.3, filterType: 'bandpass' });
            playNoiseBurst(c, { duration: 0.03, vol: 0.016, frequency: 2800, q: 2.5, filterType: 'highpass', delay: 0.008 });
            playOscBurst(c, { type: 'triangle', startFreq: 220, endFreq: 130, duration: 0.095, vol: 0.015, delay: 0.004 });
            return;
        }

        if (profile === 'sidearm') {
            playNoiseBurst(c, { duration: 0.022, vol: 0.018, frequency: 3400, q: 3.0, filterType: 'highpass' });
            playOscBurst(c, { type: 'triangle', startFreq: 880, endFreq: 620, duration: 0.04, vol: 0.011, delay: 0.001 });
            return;
        }
        if (profile === 'precision') {
            playNoiseBurst(c, { duration: 0.028, vol: 0.02, frequency: 2600, q: 2.0, filterType: 'bandpass' });
            playOscBurst(c, { type: 'triangle', startFreq: 340, endFreq: 240, duration: 0.06, vol: 0.012, delay: 0.002 });
            return;
        }
        if (profile === 'shotgun') {
            playNoiseBurst(c, { duration: 0.034, vol: 0.024, frequency: 2000, q: 2.1, filterType: 'bandpass' });
            playOscBurst(c, { type: 'triangle', startFreq: 260, endFreq: 180, duration: 0.08, vol: 0.014, delay: 0.003 });
            return;
        }
        if (profile === 'lmg') {
            playNoiseBurst(c, { duration: 0.03, vol: 0.022, frequency: 1800, q: 1.6, filterType: 'bandpass' });
            playOscBurst(c, { type: 'triangle', startFreq: 230, endFreq: 160, duration: 0.075, vol: 0.014, delay: 0.002 });
            return;
        }
        playNoiseBurst(c, { duration: 0.026, vol: 0.02, frequency: 2400, q: 2.2, filterType: 'bandpass' });
        playOscBurst(c, { type: 'triangle', startFreq: 300, endFreq: 220, duration: 0.065, vol: 0.012, delay: 0.002 });
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
        playNoiseBurst(c, { duration: 0.045, vol: 0.06, frequency: 3400, q: 2.0, filterType: 'highpass' });
        playNoiseBurst(c, { duration: 0.12, vol: 0.04, frequency: 1200, q: 0.9, filterType: 'bandpass', delay: 0.004 });
        playNoiseBurst(c, { duration: 0.18, vol: 0.03, frequency: 640, q: 0.7, filterType: 'lowpass', delay: 0.008 });
        playOscBurst(c, { type: 'sawtooth', startFreq: 180, endFreq: 520, duration: 0.08, vol: 0.028, delay: 0.002 });
        playOscBurst(c, { type: 'triangle', startFreq: 420, endFreq: 170, duration: 0.14, vol: 0.022, delay: 0.018 });
    }

    function playFireBurning(c) {
        playNoiseBurst(c, { duration: 0.26, vol: 0.026, frequency: 1280, q: 0.95, filterType: 'bandpass' });
        playNoiseBurst(c, { duration: 0.2, vol: 0.018, frequency: 3000, q: 1.9, filterType: 'highpass', delay: 0.02 });
        playNoiseBurst(c, { duration: 0.24, vol: 0.014, frequency: 520, q: 0.65, filterType: 'lowpass', delay: 0.016 });
        playOscBurst(c, { type: 'triangle', startFreq: 96, endFreq: 74, duration: 0.18, vol: 0.012, delay: 0.01 });
    }

    function playChokeCast(c) {
        playNoiseBurst(c, { duration: 0.045, vol: 0.03, frequency: 2600, q: 2.2, filterType: 'bandpass' });
        playNoiseBurst(c, { duration: 0.09, vol: 0.024, frequency: 980, q: 0.9, filterType: 'lowpass', delay: 0.004 });
        playOscBurst(c, { type: 'sawtooth', startFreq: 220, endFreq: 540, duration: 0.08, vol: 0.028, attack: 0.001 });
        playOscBurst(c, { type: 'triangle', startFreq: 150, endFreq: 86, duration: 0.16, vol: 0.018, delay: 0.01 });
    }

    function stopChokeLoop(role) {
        var loop = chokeLoops[role];
        if (!loop) return;
        chokeLoops[role] = null;
        try {
            loop.gain.gain.cancelScheduledValues(loop.ctx.currentTime);
            loop.gain.gain.setValueAtTime(Math.max(0.0001, loop.gain.gain.value || 0.0001), loop.ctx.currentTime);
            loop.gain.gain.exponentialRampToValueAtTime(0.0001, loop.ctx.currentTime + 0.08);
        } catch (_err) {
            // noop
        }
        try { loop.primary.stop(loop.ctx.currentTime + 0.12); } catch (_err2) {}
        try { if (loop.secondary) loop.secondary.stop(loop.ctx.currentTime + 0.12); } catch (_err3) {}
        try { if (loop.noise) loop.noise.stop(loop.ctx.currentTime + 0.12); } catch (_err4) {}
    }

    function startChokeLoop(c, role) {
        if (!c || chokeLoops[role]) return;
        var master = c.createGain();
        var filter = c.createBiquadFilter();
        var primary = c.createOscillator();
        var secondary = c.createOscillator();
        var lfo = c.createOscillator();
        var lfoGain = c.createGain();
        var noise = c.createBufferSource();
        var noiseGain = c.createGain();
        var buffer = ensureNoiseBuffer(c);

        filter.type = role === 'victim' ? 'bandpass' : 'lowpass';
        filter.frequency.setValueAtTime(role === 'victim' ? 720 : 460, c.currentTime);
        filter.Q.setValueAtTime(role === 'victim' ? 1.4 : 0.8, c.currentTime);

        primary.type = role === 'victim' ? 'sawtooth' : 'triangle';
        primary.frequency.setValueAtTime(role === 'victim' ? 118 : 92, c.currentTime);

        secondary.type = 'sine';
        secondary.frequency.setValueAtTime(role === 'victim' ? 236 : 184, c.currentTime);

        lfo.type = 'sine';
        lfo.frequency.setValueAtTime(role === 'victim' ? 6.2 : 4.4, c.currentTime);
        lfoGain.gain.setValueAtTime(role === 'victim' ? 0.026 : 0.018, c.currentTime);
        lfo.connect(lfoGain);
        lfoGain.connect(master.gain);

        noise.buffer = buffer;
        noise.loop = true;
        noise.playbackRate.setValueAtTime(role === 'victim' ? 0.7 : 0.54, c.currentTime);
        noiseGain.gain.setValueAtTime(role === 'victim' ? 0.008 : 0.005, c.currentTime);

        primary.connect(filter);
        secondary.connect(filter);
        noise.connect(noiseGain);
        noiseGain.connect(filter);
        filter.connect(master);
        master.connect(sfxDestination(c));

        master.gain.setValueAtTime(0.0001, c.currentTime);
        master.gain.exponentialRampToValueAtTime(role === 'victim' ? 0.034 : 0.022, c.currentTime + 0.08);

        primary.start(c.currentTime);
        secondary.start(c.currentTime);
        lfo.start(c.currentTime);
        noise.start(c.currentTime);

        chokeLoops[role] = {
            ctx: c,
            gain: master,
            filter: filter,
            primary: primary,
            secondary: secondary,
            lfo: lfo,
            noise: noise
        };
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
                case 'chokeCast':
                    playChokeCast(c);
                    break;
                case 'explosion':
                    playNoiseBurst(c, { duration: 0.25, vol: 0.11, frequency: 640, q: 0.55, filterType: 'lowpass' });
                    playOscBurst(c, { type: 'sawtooth', startFreq: 110, endFreq: 42, duration: 0.22, vol: 0.12 });
                    break;
                case 'throw':
                    playOscBurst(c, { type: 'sine', startFreq: 240, endFreq: 160, duration: 0.06, vol: 0.05 });
                    break;
                case 'reload':
                    playReloadCue(c, options.weapon || 'rifle', options.cue || 'start', options.cueId || '');
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
        if (muted) {
            stopChokeLoop('caster');
            stopChokeLoop('victim');
        }
        saveMutedPreference();
        return muted;
    };

    GameAudio.isMuted = function () {
        return !!muted;
    };

    GameAudio.setMasterVolume = function (nextVolume) {
        masterVolume = clampVolume(nextVolume, masterVolume);
        saveVolumePreference('mayhem_audio_master_volume', masterVolume);
        syncGainLevels();
        return masterVolume;
    };

    GameAudio.getMasterVolume = function () {
        return masterVolume;
    };

    GameAudio.setSfxVolume = function (nextVolume) {
        sfxVolume = clampVolume(nextVolume, sfxVolume);
        saveVolumePreference('mayhem_audio_sfx_volume', sfxVolume);
        syncGainLevels();
        return sfxVolume;
    };

    GameAudio.getSfxVolume = function () {
        return sfxVolume;
    };

    GameAudio.setChokeAudioState = function (state) {
        state = state || {};
        if (muted) {
            stopChokeLoop('caster');
            stopChokeLoop('victim');
            return;
        }
        unlock(function (c) {
            if (!!state.casterActive) startChokeLoop(c, 'caster');
            else stopChokeLoop('caster');
            if (!!state.victimActive) startChokeLoop(c, 'victim');
            else stopChokeLoop('victim');
        });
    };

    loadMutedPreference();
    loadVolumePreferences();

    globalThis.__MAYHEM_RUNTIME.GameAudio = GameAudio;
})();
