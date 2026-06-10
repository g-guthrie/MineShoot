/**
 * snapshots.js - Snapshot-state helper for GameNet.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameNetSnapshots
 */
(function () {
    'use strict';

    var GameNetSnapshots = {};

    GameNetSnapshots.create = function (callbacks) {
        callbacks = callbacks || {};
        var snapshotMap = new Map();

        function applySnapshot(entities, projectiles, fireZones, opts) {
            opts = opts || {};
            if (!Array.isArray(entities)) return;
            var snapshotMeta = {
                delta: !!opts.delta,
                serverTime: Number(opts.serverTime || 0),
                receivedAt: Number(opts.receivedAt || Date.now()),
                snapshotSeq: Math.max(0, Number(opts.snapshotSeq || 0))
            };

            if (!opts.delta) {
                snapshotMap.clear();
            }
            for (var i = 0; i < entities.length; i++) {
                var e = entities[i];
                snapshotMap.set(e.id, e);
                if (callbacks.onEntity) callbacks.onEntity(e, snapshotMeta);
            }
            var removedIds = Array.isArray(opts.removedEntityIds) ? opts.removedEntityIds : [];
            for (var r = 0; r < removedIds.length; r++) {
                snapshotMap.delete(removedIds[r]);
            }

            if (callbacks.onPrune) callbacks.onPrune(snapshotMap);
            if (callbacks.onProjectiles && projectiles !== undefined) {
                callbacks.onProjectiles(Array.isArray(projectiles) ? projectiles.slice() : []);
            }
            if (callbacks.onFireZones && fireZones !== undefined) {
                callbacks.onFireZones(Array.isArray(fireZones) ? fireZones.slice() : []);
            }
        }

        return {
            applySnapshot: applySnapshot,
            snapshotMap: snapshotMap
        };
    };

    globalThis.__MAYHEM_RUNTIME.GameNetSnapshots = GameNetSnapshots;
})();
