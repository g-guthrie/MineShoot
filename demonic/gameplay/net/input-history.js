(function () {
    'use strict';

    var demonicRuntime = globalThis.__DEMONIC_RUNTIME = globalThis.__DEMONIC_RUNTIME || {};

    function create() {
        var nextSeq = 1;
        var lastSentSeq = 0;
        var lastAckedSeq = 0;
        var pending = [];
        var maxSamples = 96;

        function cloneInputState(inputState) {
            var state = inputState || {};
            return {
                moveForward: !!state.moveForward,
                moveBackward: !!state.moveBackward,
                moveLeft: !!state.moveLeft,
                moveRight: !!state.moveRight,
                sprint: !!state.sprint,
                ads: !!state.ads,
                jumpQueued: !!state.jumpQueued,
                triggerHeld: !!state.triggerHeld
            };
        }

        function cloneSample(entry) {
            if (!entry) return null;
            return {
                seq: Number(entry.seq || 0),
                at: Number(entry.at || 0),
                dtMs: Number(entry.dtMs || 0),
                yaw: Number(entry.yaw || 0),
                pitch: Number(entry.pitch || 0),
                weaponId: String(entry.weaponId || ''),
                dispatchedAt: Number(entry.dispatchedAt || 0),
                inputState: cloneInputState(entry.inputState)
            };
        }

        return {
            recordSample: function (snapshot, dtMs, meta) {
                var stamp = Date.now();
                var extra = meta || {};
                var seq = nextSeq++;
                pending.push({
                    seq: seq,
                    at: stamp,
                    dtMs: Math.max(1, Number(dtMs || 16)),
                    yaw: Number(extra.yaw || 0),
                    pitch: Number(extra.pitch || 0),
                    weaponId: String(extra.weaponId || ''),
                    dispatchedAt: 0,
                    inputState: cloneInputState(snapshot)
                });
                if (pending.length > maxSamples) pending.shift();
                return seq;
            },
            markDispatched: function (seq, stamp) {
                var at = Number(stamp || Date.now());
                for (var i = 0; i < pending.length; i++) {
                    var entry = pending[i];
                    if (Number(entry.seq || 0) !== Number(seq || 0)) continue;
                    entry.dispatchedAt = at;
                    lastSentSeq = Math.max(lastSentSeq, Number(seq || 0));
                    return cloneSample(entry);
                }
                return null;
            },
            acknowledgeThrough: function (seq) {
                lastAckedSeq = Math.max(lastAckedSeq, Number(seq || 0));
                pending = pending.filter(function (entry) {
                    return Number(entry.seq || 0) > lastAckedSeq;
                });
                return lastAckedSeq;
            },
            getLatest: function () {
                return cloneSample(pending.length ? pending[pending.length - 1] : null);
            },
            getSnapshot: function () {
                var latest = pending.length ? pending[pending.length - 1] : null;
                return {
                    lastSentSeq: Number(lastSentSeq || 0),
                    lastAckedSeq: Number(lastAckedSeq || 0),
                    pendingInputCount: pending.length,
                    latestPendingAgeMs: latest ? Math.max(0, Date.now() - Number(latest.at || 0)) : 0,
                    pendingInputs: pending.map(cloneSample)
                };
            }
        };
    }

    demonicRuntime.GameNetInputHistory = {
        create: create
    };
})();
