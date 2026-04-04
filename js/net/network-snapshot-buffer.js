/**
 * network-snapshot-buffer.js - Snapshot-buffer helpers shared by GameNet.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameNetSnapshotBuffer
 */
(function () {
    'use strict';

    var runtime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};

    function cloneSnapshotValue(value, protocol) {
        if (protocol && typeof protocol.cloneSnapshotValue === 'function') {
            return protocol.cloneSnapshotValue(value);
        }
        return value && typeof value === 'object'
            ? JSON.parse(JSON.stringify(value))
            : value;
    }

    function applySnapshotEntityPatch(baseEntity, patch, opts) {
        opts = opts || {};
        var protocol = opts.protocol || null;
        var cloneValue = typeof opts.cloneSnapshotValue === 'function'
            ? opts.cloneSnapshotValue
            : function (value) {
                return cloneSnapshotValue(value, protocol);
            };

        if (protocol && typeof protocol.applySnapshotEntityPatch === 'function') {
            return protocol.applySnapshotEntityPatch(baseEntity, patch);
        }

        var nextPatch = patch && typeof patch === 'object' ? patch : null;
        if (!nextPatch || !nextPatch.id) return null;

        var base = baseEntity && typeof baseEntity === 'object' ? cloneValue(baseEntity) : {};
        base.id = String(nextPatch.id);
        for (var key in nextPatch) {
            if (!Object.prototype.hasOwnProperty.call(nextPatch, key) || key === 'id') continue;
            base[key] = cloneValue(nextPatch[key]);
        }
        return base;
    }

    function resolveConnectionTimingState(opts) {
        if (opts && typeof opts.getConnectionTimingState === 'function') {
            return opts.getConnectionTimingState() || null;
        }
        if (opts && opts.connectionTimingState) {
            return opts.connectionTimingState || null;
        }
        return null;
    }

    function resolveRenderMap(opts) {
        if (opts && typeof opts.getRenderMap === 'function') {
            return opts.getRenderMap() || null;
        }
        return opts && opts.renderMap instanceof Map ? opts.renderMap : null;
    }

    function computeRemoteBufferDelayMs(frame, opts) {
        opts = opts || {};
        var timingState = resolveConnectionTimingState(opts);
        var snapshotState = timingState && timingState.snapshot ? timingState.snapshot : null;
        var cadenceMs = Math.max(0, Number(snapshotState && snapshotState.intervalMs || 0));
        var jitterMs = Math.max(0, Number(snapshotState && snapshotState.jitterMs || 0));
        var baseDelayMs = Math.min(
            180,
            Math.max(60, Math.max((cadenceMs * 1.25) + (jitterMs * 2), 60))
        );

        var extraDelayMs = 0;
        var renderMap = resolveRenderMap(opts);
        if (renderMap && frame && Array.isArray(frame.entities)) {
            for (var i = 0; i < frame.entities.length; i++) {
                var entity = frame.entities[i];
                if (!entity || !entity.id) continue;
                var render = renderMap.get(String(entity.id || ''));
                extraDelayMs = Math.max(extraDelayMs, Math.max(0, Number(render && render.lossDelayPaddingMs || 0)));
            }
        }
        return baseDelayMs + Math.min(120, extraDelayMs);
    }

    function enqueueBufferedRemoteFrame(frame, opts) {
        opts = opts || {};
        if (!frame) return false;

        var nowMs = typeof opts.nowMs === 'function' ? opts.nowMs : Date.now;
        var receivedAt = Math.max(0, Number(frame.receivedAt || nowMs()));
        var delayMs = typeof opts.computeRemoteBufferDelayMs === 'function'
            ? Math.max(0, Number(opts.computeRemoteBufferDelayMs(frame, opts) || 0))
            : computeRemoteBufferDelayMs(frame, opts);

        frame.readyAt = receivedAt + delayMs;

        if (typeof opts.enqueueRemoteFrame === 'function') {
            opts.enqueueRemoteFrame(frame);
            return true;
        }
        if (Array.isArray(opts.queue)) {
            opts.queue.push(frame);
            return true;
        }
        return false;
    }

    function drainBufferedRemoteFrames(opts) {
        opts = opts || {};
        if (opts.enabled === false) return 0;

        var nowMs = typeof opts.nowMs === 'function' ? opts.nowMs : Date.now;
        var readNextFrame = typeof opts.peekRemoteFrame === 'function'
            ? opts.peekRemoteFrame
            : function () {
                return Array.isArray(opts.queue) && opts.queue.length > 0 ? opts.queue[0] : null;
            };
        var shiftFrame = typeof opts.shiftRemoteFrame === 'function'
            ? opts.shiftRemoteFrame
            : function () {
                return Array.isArray(opts.queue) && opts.queue.length > 0 ? opts.queue.shift() : null;
            };

        var applyFrame = typeof opts.applyFrame === 'function' ? opts.applyFrame : null;
        var drained = 0;
        var now = nowMs();
        var nextFrame = readNextFrame();

        while (nextFrame && Number(nextFrame.readyAt || 0) <= now) {
            var frame = shiftFrame();
            if (!frame) break;
            if (applyFrame) applyFrame(frame, opts);
            drained += 1;
            nextFrame = readNextFrame();
        }

        return drained;
    }

    runtime.GameNetSnapshotBuffer = {
        cloneSnapshotValue: cloneSnapshotValue,
        applySnapshotEntityPatch: applySnapshotEntityPatch,
        computeRemoteBufferDelayMs: computeRemoteBufferDelayMs,
        enqueueBufferedRemoteFrame: enqueueBufferedRemoteFrame,
        drainBufferedRemoteFrames: drainBufferedRemoteFrames
    };
})();
