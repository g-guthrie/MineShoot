/**
 * audio.js - Web Audio runtime with sampled weapon fire and procedural fallback sounds
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameAudio
 */
(function () {
    'use strict';

    var GameAudio = {};
    var audioCueIds = [
        'fire',
        'plasma',
        'bulletImpact',
        'enemyHit',
        'playerHit',
        'fireIgnite',
        'fireBurning',
        'molotov_ignite',
        'explosion',
        'explosion_frag',
        'explosion_plasma',
        'explosion_molotov',
        'throw',
        'throw_frag',
        'throw_molotov',
        'throw_knife',
        'throw_plasma',
        'throwable_impact',
        'knife_impact',
        'plasma_stick',
        'reload',
        'footstep',
        'jump',
        'movementWind'
    ];
    var ctx = null;
    var unlockInFlight = false;
    var pendingPlaybacks = [];
    var muted = false;
    var noiseBuffer = null;
    var sampleCache = {};
    var sampleLoaders = {};
    var sampleWarmupStarted = false;
    var playbackGainScale = 1;
    var movementWindUnlockQueued = false;
    var movementWindRequest = null;
    var movementWindLoop = {
        source: null,
        gain: null,
        filter: null,
        currentGain: 0
    };
    var movementSampleDefs = {
        footstepWalk: {
            url: '/assets/audio/movement/footstep-concrete.ogg',
            gain: 0.03375,
            playbackRateMin: 1.0,
            playbackRateMax: 1.0,
            filterType: 'lowpass',
            frequency: 2600,
            q: 0.7
        },
        footstepRun: {
            url: '/assets/audio/movement/footstep-concrete.ogg',
            gain: 0.050625,
            playbackRateMin: 1.06,
            playbackRateMax: 1.06,
            filterType: 'lowpass',
            frequency: 3100,
            q: 0.72
        },
        jump: {
            url: '/assets/audio/movement/jump.ogg',
            gain: 0.56,
            playbackRateMin: 1.0,
            playbackRateMax: 1.0
        },
        movementWind: {
            url: '/assets/audio/movement/wind-woosh-loop.ogg',
            gain: 0.18
        }
    };
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
        gain.gain.linearRampToValueAtTime(scaledGain(vol), c.currentTime + attack);
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

    function finiteNumber(value, fallback) {
        var parsed = Number(value);
        return isFinite(parsed) ? parsed : (fallback || 0);
    }

    function scaledGain(value) {
        return Math.max(0.0001, finiteNumber(value, 0) * Math.max(0, playbackGainScale));
    }

    function readVec3(value) {
        if (!value || typeof value !== 'object') return null;
        var x = Number(value.x);
        var y = Number(value.y);
        var z = Number(value.z);
        if (!isFinite(x) || !isFinite(y) || !isFinite(z)) return null;
        return { x: x, y: y, z: z };
    }

    function eventPositionFromOptions(options) {
        options = options || {};
        return readVec3(options.sourcePosition) ||
            readVec3(options.worldPosition) ||
            readVec3(options.position) ||
            readVec3(options.origin) ||
            readVec3(options);
    }

    function listenerPositionFromOptions(options) {
        options = options || {};
        return readVec3(options.listenerPosition) ||
            readVec3(options.listener) ||
            readVec3(options.cameraPosition);
    }

    function distanceBetweenVec3(a, b) {
        if (!a || !b) return 0;
        var dx = finiteNumber(a.x, 0) - finiteNumber(b.x, 0);
        var dy = finiteNumber(a.y, 0) - finiteNumber(b.y, 0);
        var dz = finiteNumber(a.z, 0) - finiteNumber(b.z, 0);
        return Math.sqrt((dx * dx) + (dy * dy) + (dz * dz));
    }

    function distanceGainForOptions(options) {
        options = options || {};
        var explicit = Number(options.gainScale !== undefined ? options.gainScale : options.volume);
        var scale = isFinite(explicit) ? Math.max(0, explicit) : 1;
        var source = eventPositionFromOptions(options);
        var listener = listenerPositionFromOptions(options);
        if (!source || !listener) return Math.min(2, scale);

        var distance = Math.max(0, distanceBetweenVec3(source, listener));
        var nearDistance = Math.max(0, finiteNumber(options.nearDistance, 5.5));
        var reference = Math.max(0.001, finiteNumber(options.referenceDistance || options.distanceReference, 11));
        var rolloff = Math.max(0.5, Math.min(4, finiteNumber(options.distanceRolloff, 1.75)));
        var maxDistance = Math.max(reference, finiteNumber(options.maxDistance, 105));
        var minGain = Math.max(0, Math.min(0.25, finiteNumber(options.minGain, 0)));
        if (distance >= maxDistance) return 0;
        if (distance <= nearDistance) return Math.min(2, scale);

        var normalized = Math.max(0, (distance - nearDistance) / reference);
        var attenuated = 1 / (1 + Math.pow(normalized, rolloff));
        var fadeStart = maxDistance * 0.82;
        if (distance > fadeStart) {
            var fade = Math.max(0, Math.min(1, (maxDistance - distance) / Math.max(1, maxDistance - fadeStart)));
            attenuated *= fade;
        }
        return Math.min(2, scale * Math.max(minGain, attenuated));
    }

    function withPlaybackGain(scale, fn) {
        var previous = playbackGainScale;
        playbackGainScale = previous * Math.max(0, finiteNumber(scale, 1));
        try {
            return fn();
        } finally {
            playbackGainScale = previous;
        }
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
        var movementIds = Object.keys(movementSampleDefs);
        for (var j = 0; j < movementIds.length; j++) {
            var movementDef = movementSampleDefs[movementIds[j]];
            if (!movementDef || !movementDef.url || seen[movementDef.url]) continue;
            seen[movementDef.url] = true;
            loadSampleBuffer(c, movementDef.url);
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
        gain.gain.setValueAtTime(scaledGain(opts.gain !== undefined ? opts.gain : 1), start);
        nodes.push(gain);
        connectNodeChain(source, nodes, c.destination);
        source.start(start);
        if (opts.duration) {
            source.stop(start + Math.max(0.01, Number(opts.duration)));
        }
        return true;
    }

    function playSampleBuffer(c, sampleDef) {
        return playConfiguredSample(c, sampleDef);
    }

    function playConfiguredSample(c, sampleDef, overrides) {
        if (!c || !sampleDef || !sampleDef.url) return false;
        var buffer = sampleCache[sampleDef.url];
        if (!buffer) {
            loadSampleBuffer(c, sampleDef.url);
            return false;
        }
        var opts = overrides || {};
        return playSampleLayer(c, buffer, {
            gain: opts.gain !== undefined ? opts.gain : (sampleDef.gain !== undefined ? sampleDef.gain : 1),
            playbackRateMin: opts.playbackRateMin || sampleDef.playbackRateMin || 1,
            playbackRateMax: opts.playbackRateMax || sampleDef.playbackRateMax || 1,
            filterType: opts.filterType || sampleDef.filterType || '',
            frequency: opts.frequency || sampleDef.frequency,
            q: opts.q || sampleDef.q,
            duration: opts.duration || sampleDef.duration,
            delay: opts.delay || sampleDef.delay || 0
        });
    }

    function clamp01(value) {
        var parsed = Number(value || 0);
        if (!isFinite(parsed)) return 0;
        return Math.max(0, Math.min(1, parsed));
    }

    function normalizeMovementWindRequest(options) {
        options = options || {};
        return {
            active: !!options.active,
            intensity: clamp01(options.intensity),
            adsActive: !!options.adsActive,
            scopeActive: !!options.scopeActive,
            sniper: !!options.sniper,
            hidden: !!options.hidden
        };
    }

    function movementWindTargetGain(options) {
        var request = normalizeMovementWindRequest(options);
        if (request.hidden || request.adsActive || request.scopeActive || request.sniper) return 0;
        if (!request.active && request.intensity <= 0.03) return 0;
        var baseGain = movementSampleDefs.movementWind && movementSampleDefs.movementWind.gain !== undefined
            ? Number(movementSampleDefs.movementWind.gain)
            : 0.18;
        return Math.max(0, baseGain * (0.25 + (request.intensity * 0.75)));
    }

    function resetMovementWindLoop() {
        if (movementWindLoop.source && movementWindLoop.source.stop) {
            try {
                movementWindLoop.source.stop(0);
            } catch (_err) {
                // noop
            }
        }
        movementWindLoop.source = null;
        movementWindLoop.gain = null;
        movementWindLoop.filter = null;
        movementWindLoop.currentGain = 0;
    }

    function rampMovementWindGain(c, targetGain, fadeSeconds) {
        if (!c || !movementWindLoop.gain || !movementWindLoop.gain.gain) return false;
        var now = Number(c.currentTime || 0);
        var target = Math.max(0.0001, Number(targetGain || 0));
        var start = Math.max(0.0001, Number(movementWindLoop.currentGain || 0));
        var fade = Math.max(0.015, Number(fadeSeconds || 0.16));
        try {
            if (movementWindLoop.gain.gain.cancelScheduledValues) {
                movementWindLoop.gain.gain.cancelScheduledValues(now);
            }
            movementWindLoop.gain.gain.setValueAtTime(start, now);
            movementWindLoop.gain.gain.linearRampToValueAtTime(target, now + fade);
        } catch (_err) {
            try {
                movementWindLoop.gain.gain.setValueAtTime(target, now);
            } catch (__err) {
                // noop
            }
        }
        movementWindLoop.currentGain = targetGain > 0 ? targetGain : 0;
        return true;
    }

    function ensureMovementWindLoop(c) {
        var sampleDef = movementSampleDefs.movementWind;
        if (!c || !sampleDef || !sampleDef.url) return false;
        if (movementWindLoop.source && movementWindLoop.gain) return true;
        var buffer = sampleCache[sampleDef.url];
        if (!buffer) {
            loadSampleBuffer(c, sampleDef.url).then(function (loadedBuffer) {
                if (!loadedBuffer || !movementWindRequest) return;
                updateMovementWindLoop(c, movementWindRequest);
            });
            return false;
        }

        var source = c.createBufferSource();
        var gain = c.createGain();
        var filter = c.createBiquadFilter();
        source.buffer = buffer;
        source.loop = true;
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(150, c.currentTime);
        filter.Q.setValueAtTime(0.55, c.currentTime);
        gain.gain.setValueAtTime(0.0001, c.currentTime);
        connectNodeChain(source, [filter, gain], c.destination);
        source.start(c.currentTime);
        movementWindLoop.source = source;
        movementWindLoop.gain = gain;
        movementWindLoop.filter = filter;
        movementWindLoop.currentGain = 0;
        return true;
    }

    function updateMovementWindLoop(c, options) {
        if (!c) return false;
        movementWindRequest = normalizeMovementWindRequest(options);
        var targetGain = muted ? 0 : movementWindTargetGain(movementWindRequest);
        if (targetGain <= 0.0005) {
            return rampMovementWindGain(c, 0, 0.2);
        }
        if (!ensureMovementWindLoop(c)) return false;
        return rampMovementWindGain(c, targetGain, 0.12);
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
        var peak = scaledGain(opts.vol || 0.12);

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
        gain.gain.exponentialRampToValueAtTime(scaledGain(opts.vol || 0.06), start + Math.max(0.0008, Number(opts.attack || 0.002)));
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

    function playFootstep(c, options) {
        var running = !!(options && (options.running || options.sprinting || options.mode === 'run'));
        var sampleDef = running ? movementSampleDefs.footstepRun : movementSampleDefs.footstepWalk;
        if (playConfiguredSample(c, sampleDef)) return;
        playNoiseBurst(c, {
            duration: running ? 0.035 : 0.03,
            vol: running ? 0.004875 : 0.003375,
            frequency: running ? 980 : 760,
            q: 0.8,
            filterType: 'bandpass'
        });
    }

    function playJump(c, options) {
        if (playConfiguredSample(c, movementSampleDefs.jump, options || null)) return;
        playNoiseBurst(c, { duration: 0.03375, vol: 0.0135, frequency: 1200, q: 1.2, filterType: 'bandpass' });
        playOscBurst(c, { type: 'triangle', startFreq: 220, endFreq: 120, duration: 0.075, vol: 0.0140625, delay: 0.002 });
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
        playNoiseBurst(c, { duration: 0.024, vol: 0.11, frequency: 3200, q: 1.9, filterType: 'highpass' });
        playNoiseBurst(c, { duration: 0.09, vol: 0.16, frequency: 1100, q: 1.05, filterType: 'bandpass', delay: 0.001 });
        playOscBurst(c, { type: 'triangle', startFreq: 156, endFreq: 82, duration: 0.12, vol: 0.095, delay: 0.001 });
        playOscBurst(c, { type: 'square', startFreq: 240, endFreq: 130, duration: 0.065, vol: 0.05, delay: 0.004 });
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

    function normalizeThrowableAudioType(options) {
        options = options || {};
        var id = String(options.throwable || options.throwableId || options.projectileType || options.type || '').toLowerCase();
        if (id === 'grenade') return 'frag';
        if (id === 'firegrenade' || id === 'fire_grenade') return 'molotov';
        if (id === 'plasma_stream') return 'plasma';
        return id;
    }

    function cueOptions(options, throwableType) {
        options = options || {};
        var result = {};
        for (var key in options) {
            if (Object.prototype.hasOwnProperty.call(options, key)) result[key] = options[key];
        }
        if (throwableType) {
            result.throwable = throwableType;
            result.projectileType = throwableType;
        }
        return result;
    }

    function playThrowableThrow(c, options) {
        var type = normalizeThrowableAudioType(options);
        if (type === 'knife') {
            playNoiseBurst(c, { duration: 0.055, vol: 0.026, frequency: 3600, q: 2.8, filterType: 'highpass' });
            playNoiseBurst(c, { duration: 0.036, vol: 0.014, frequency: 1700, q: 1.9, filterType: 'bandpass', delay: 0.004 });
            playOscBurst(c, { type: 'sine', startFreq: 520, endFreq: 260, duration: 0.045, vol: 0.018, delay: 0.002 });
            return;
        }
        if (type === 'molotov') {
            playNoiseBurst(c, { duration: 0.06, vol: 0.028, frequency: 2400, q: 2.2, filterType: 'highpass' });
            playNoiseBurst(c, { duration: 0.07, vol: 0.017, frequency: 720, q: 0.8, filterType: 'bandpass', delay: 0.006 });
            playOscBurst(c, { type: 'triangle', startFreq: 210, endFreq: 118, duration: 0.09, vol: 0.018, delay: 0.002 });
            return;
        }
        if (type === 'plasma') {
            playOscBurst(c, { type: 'sawtooth', startFreq: 320, endFreq: 760, duration: 0.055, vol: 0.035 });
            playOscBurst(c, { type: 'triangle', startFreq: 900, endFreq: 360, duration: 0.115, vol: 0.028, delay: 0.012 });
            playNoiseBurst(c, { duration: 0.052, vol: 0.018, frequency: 3100, q: 2.4, filterType: 'bandpass', delay: 0.004 });
            return;
        }
        playNoiseBurst(c, { duration: 0.055, vol: 0.02, frequency: 1120, q: 1.05, filterType: 'bandpass' });
        playOscBurst(c, { type: 'triangle', startFreq: 190, endFreq: 110, duration: 0.08, vol: 0.02, delay: 0.002 });
    }

    function playKnifeImpact(c, options) {
        var impact = String((options && (options.impactType || options.hitType)) || 'world').toLowerCase();
        var head = impact === 'head';
        var body = head || impact === 'body' || impact === 'enemy';
        if (body) {
            playNoiseBurst(c, { duration: 0.048, vol: head ? 0.034 : 0.03, frequency: head ? 2600 : 1500, q: head ? 2.2 : 1.15, filterType: 'bandpass' });
            playNoiseBurst(c, { duration: 0.03, vol: head ? 0.024 : 0.014, frequency: head ? 5200 : 3300, q: 2.6, filterType: 'highpass', delay: 0.004 });
            playOscBurst(c, { type: head ? 'square' : 'triangle', startFreq: head ? 760 : 230, endFreq: head ? 360 : 105, duration: head ? 0.06 : 0.08, vol: head ? 0.024 : 0.022, delay: 0.001 });
            return;
        }
        playNoiseBurst(c, { duration: 0.028, vol: 0.03, frequency: 5200, q: 3.0, filterType: 'highpass' });
        playNoiseBurst(c, { duration: 0.05, vol: 0.018, frequency: 1700, q: 1.6, filterType: 'bandpass', delay: 0.002 });
        playOscBurst(c, { type: 'square', startFreq: 1180, endFreq: 640, duration: 0.045, vol: 0.016, delay: 0.002 });
        playOscBurst(c, { type: 'triangle', startFreq: 260, endFreq: 128, duration: 0.075, vol: 0.015, delay: 0.005 });
    }

    function playPlasmaStick(c) {
        playNoiseBurst(c, { duration: 0.06, vol: 0.025, frequency: 3300, q: 2.5, filterType: 'bandpass' });
        playOscBurst(c, { type: 'sine', startFreq: 360, endFreq: 1120, duration: 0.07, vol: 0.03, delay: 0.001 });
        playOscBurst(c, { type: 'triangle', startFreq: 1120, endFreq: 580, duration: 0.09, vol: 0.018, delay: 0.045 });
    }

    function playMolotovIgnite(c) {
        playNoiseBurst(c, { duration: 0.024, vol: 0.03, frequency: 5400, q: 3.1, filterType: 'highpass' });
        playNoiseBurst(c, { duration: 0.04, vol: 0.018, frequency: 1900, q: 2.0, filterType: 'bandpass', delay: 0.004 });
        playFireIgnite(c);
    }

    function playThrowableImpact(c, options) {
        var type = normalizeThrowableAudioType(options);
        if (type === 'knife') {
            playKnifeImpact(c, options);
            return;
        }
        if (type === 'plasma') {
            playPlasmaStick(c);
            return;
        }
        if (type === 'molotov') {
            playMolotovIgnite(c);
            return;
        }
        playNoiseBurst(c, { duration: 0.04, vol: 0.018, frequency: 1500, q: 1.0, filterType: 'bandpass' });
        playOscBurst(c, { type: 'triangle', startFreq: 180, endFreq: 95, duration: 0.055, vol: 0.012, delay: 0.002 });
    }

    function playThrowableExplosion(c, options) {
        var type = normalizeThrowableAudioType(options);
        if (type === 'plasma') {
            playNoiseBurst(c, { duration: 0.04, vol: 0.07, frequency: 4400, q: 2.0, filterType: 'bandpass' });
            playNoiseBurst(c, { duration: 0.18, vol: 0.052, frequency: 1450, q: 1.0, filterType: 'bandpass', delay: 0.004 });
            playOscBurst(c, { type: 'sawtooth', startFreq: 720, endFreq: 180, duration: 0.15, vol: 0.075 });
            playOscBurst(c, { type: 'sine', startFreq: 128, endFreq: 58, duration: 0.22, vol: 0.058, delay: 0.006 });
            return;
        }
        if (type === 'molotov') {
            playMolotovIgnite(c);
            return;
        }
        if (type === 'missile') {
            playNoiseBurst(c, { duration: 0.035, vol: 0.09, frequency: 3900, q: 1.6, filterType: 'highpass' });
            playNoiseBurst(c, { duration: 0.26, vol: 0.09, frequency: 720, q: 0.65, filterType: 'lowpass', delay: 0.002 });
            playOscBurst(c, { type: 'sawtooth', startFreq: 150, endFreq: 44, duration: 0.28, vol: 0.13 });
            return;
        }
        playNoiseBurst(c, { duration: 0.028, vol: 0.075, frequency: 4200, q: 1.8, filterType: 'highpass' });
        playNoiseBurst(c, { duration: 0.16, vol: 0.076, frequency: 960, q: 0.8, filterType: 'bandpass', delay: 0.002 });
        playNoiseBurst(c, { duration: 0.24, vol: 0.054, frequency: 420, q: 0.55, filterType: 'lowpass', delay: 0.006 });
        playOscBurst(c, { type: 'sawtooth', startFreq: 128, endFreq: 42, duration: 0.24, vol: 0.12, delay: 0.001 });
    }

    GameAudio.play = function (soundId, options) {
        if (muted) return;
        options = options || {};
        var gainScale = distanceGainForOptions(options);
        if (!(gainScale > 0.0005)) return;
        unlock(function (c) {
            withPlaybackGain(gainScale, function () {
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
                    case 'fireIgnite':
                        playFireIgnite(c);
                        break;
                    case 'fireBurning':
                        playFireBurning(c);
                        break;
                    case 'molotov_ignite':
                        playMolotovIgnite(c);
                        break;
                    case 'explosion':
                        playThrowableExplosion(c, options);
                        break;
                    case 'explosion_frag':
                        playThrowableExplosion(c, cueOptions(options, 'frag'));
                        break;
                    case 'explosion_plasma':
                        playThrowableExplosion(c, cueOptions(options, 'plasma'));
                        break;
                    case 'explosion_molotov':
                        playThrowableExplosion(c, cueOptions(options, 'molotov'));
                        break;
                    case 'throw':
                        playThrowableThrow(c, options);
                        break;
                    case 'throw_frag':
                        playThrowableThrow(c, cueOptions(options, 'frag'));
                        break;
                    case 'throw_molotov':
                        playThrowableThrow(c, cueOptions(options, 'molotov'));
                        break;
                    case 'throw_knife':
                        playThrowableThrow(c, cueOptions(options, 'knife'));
                        break;
                    case 'throw_plasma':
                        playThrowableThrow(c, cueOptions(options, 'plasma'));
                        break;
                    case 'throwable_impact':
                        playThrowableImpact(c, options);
                        break;
                    case 'knife_impact':
                        playKnifeImpact(c, options);
                        break;
                    case 'plasma_stick':
                        playPlasmaStick(c);
                        break;
                    case 'reload':
                        playReloadCue(c, options.weapon || 'rifle', options.cue || 'start', options.cueId || '');
                        break;
                    case 'footstep':
                        playFootstep(c, options);
                        break;
                    case 'jump':
                        playJump(c, options);
                        break;
                    default:
                        break;
                }
            });
        });
    };

    GameAudio.distanceGain = function (options) {
        return distanceGainForOptions(options || {});
    };

    GameAudio.playAssetCue = function (soundId, options) {
        GameAudio.play(soundId, options);
    };

    GameAudio.updateMovementWind = function (options) {
        movementWindRequest = normalizeMovementWindRequest(options);
        var targetGain = movementWindTargetGain(movementWindRequest);
        if (muted || targetGain <= 0.0005) {
            if (ctx) updateMovementWindLoop(ctx, movementWindRequest);
            return;
        }

        var c = getCtx();
        if (!c) return;
        if (c.state === 'running') {
            updateMovementWindLoop(c, movementWindRequest);
            return;
        }

        if (movementWindUnlockQueued) return;
        movementWindUnlockQueued = true;
        unlock(function (readyCtx) {
            movementWindUnlockQueued = false;
            updateMovementWindLoop(readyCtx, movementWindRequest);
        });
    };

    GameAudio.getAssetCueIds = function () {
        return audioCueIds.slice();
    };

    GameAudio.unlock = function () {
        unlock();
    };

    GameAudio.setMuted = function (nextMuted) {
        muted = !!nextMuted;
        if (muted && ctx) updateMovementWindLoop(ctx, { active: false, intensity: 0, hidden: true });
        saveMutedPreference();
        return muted;
    };

    GameAudio.isMuted = function () {
        return !!muted;
    };

    GameAudio.stopAll = function () {
        pendingPlaybacks.length = 0;
        unlockInFlight = false;
        sampleWarmupStarted = false;
        movementWindUnlockQueued = false;
        movementWindRequest = null;
        resetMovementWindLoop();
        noiseBuffer = null;
        var currentCtx = ctx;
        ctx = null;
        if (currentCtx && typeof currentCtx.close === 'function') {
            try {
                var maybePromise = currentCtx.close();
                if (maybePromise && typeof maybePromise.catch === 'function') {
                    maybePromise.catch(function () {});
                }
            } catch (_err) {
                // noop
            }
        }
    };

    loadMutedPreference();

    globalThis.__MAYHEM_RUNTIME.GameAudio = GameAudio;
})();
