/**
 * audio.js - Procedural sound effects via Web Audio API (no asset files)
 * Loaded as global: window.GameAudio
 */
(function () {
    'use strict';

    var GameAudio = {};
    var ctx = null;
    var unlockInFlight = false;
    var pendingPlaybacks = [];

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

    function playNoise(c, opts) {
        if (!c) return;
        opts = opts || {};
        var duration = opts.duration || 0.12;
        var vol = opts.vol !== undefined ? opts.vol : 0.08;

        var bufferSize = c.sampleRate * duration;
        var buffer = c.createBuffer(1, bufferSize, c.sampleRate);
        var data = buffer.getChannelData(0);
        for (var i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1);
        var src = c.createBufferSource();
        src.buffer = buffer;
        var gain = c.createGain();
        gain.gain.setValueAtTime(vol, c.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
        src.connect(gain);
        gain.connect(c.destination);
        src.start(c.currentTime);
    }

    var weaponFreq = {
        rifle: 180,
        pistol: 320,
        machinegun: 200,
        shotgun: 120,
        sniper: 90,
        plasma: 280
    };

    GameAudio.play = function (soundId, options) {
        options = options || {};
        unlock(function (c) {
            switch (soundId) {
                case 'fire':
                    var weapon = (options.weapon || 'rifle');
                    playTone(c, {
                        freq: weaponFreq[weapon] || 200,
                        duration: weapon === 'shotgun' ? 0.14 : (weapon === 'sniper' ? 0.18 : 0.06),
                        vol: weapon === 'shotgun' ? 0.2 : 0.14,
                        type: 'square'
                    });
                    break;
                case 'plasma':
                    playTone(c, { freq: 260, duration: 0.04, vol: 0.1, type: 'sawtooth' });
                    break;
                case 'enemyHit':
                    playTone(c, {
                        freq: options.killed ? 140 : 320,
                        duration: options.killed ? 0.12 : 0.05,
                        vol: 0.12,
                        type: 'square'
                    });
                    break;
                case 'playerHit':
                    playTone(c, { freq: 150, duration: 0.15, vol: 0.12, type: 'sawtooth' });
                    break;
                case 'explosion':
                    playNoise(c, { duration: 0.25, vol: 0.12 });
                    playTone(c, { freq: 80, duration: 0.2, vol: 0.15, type: 'sawtooth' });
                    break;
                case 'throw':
                    playTone(c, { freq: 200, duration: 0.06, vol: 0.1, type: 'sine' });
                    break;
                default:
                    break;
            }
        });
    };

    GameAudio.unlock = function () {
        unlock();
    };

    window.GameAudio = GameAudio;
})();
