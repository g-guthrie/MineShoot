/**
 * audio.js - Procedural sound effects via Web Audio API (no asset files)
 * Loaded as global: window.GameAudio
 */
(function () {
    'use strict';

    var GameAudio = {};
    var ctx = null;

    function getCtx() {
        if (ctx) return ctx;
        var C = window.AudioContext || window.webkitAudioContext;
        if (!C) return null;
        ctx = new C();
        return ctx;
    }

    function unlock() {
        var c = getCtx();
        if (c && c.state === 'suspended') c.resume();
    }

    function playTone(opts) {
        var c = getCtx();
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

    function playNoise(opts) {
        var c = getCtx();
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
        unlock();
        options = options || {};
        var c = getCtx();
        if (!c) return;

        switch (soundId) {
            case 'fire':
                var weapon = (options.weapon || 'rifle');
                playTone({
                    freq: weaponFreq[weapon] || 200,
                    duration: weapon === 'shotgun' ? 0.14 : (weapon === 'sniper' ? 0.18 : 0.06),
                    vol: weapon === 'shotgun' ? 0.2 : 0.14,
                    type: 'square'
                });
                break;
            case 'plasma':
                playTone({ freq: 260, duration: 0.04, vol: 0.1, type: 'sawtooth' });
                break;
            case 'enemyHit':
                playTone({
                    freq: options.killed ? 140 : 320,
                    duration: options.killed ? 0.12 : 0.05,
                    vol: 0.12,
                    type: 'square'
                });
                break;
            case 'playerHit':
                playTone({ freq: 150, duration: 0.15, vol: 0.12, type: 'sawtooth' });
                break;
            case 'explosion':
                playNoise({ duration: 0.25, vol: 0.12 });
                playTone({ freq: 80, duration: 0.2, vol: 0.15, type: 'sawtooth' });
                break;
            case 'throw':
                playTone({ freq: 200, duration: 0.06, vol: 0.1, type: 'sine' });
                break;
            default:
                break;
        }
    };

    window.GameAudio = GameAudio;
})();
