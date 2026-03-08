/**
 * snapshots.js - Snapshot-state helper for GameNet.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameNetSnapshots
 */
(function () {
    'use strict';

    var GameNetSnapshots = {};

    GameNetSnapshots.create = function (hooks) {
        hooks = hooks || {};
        var snapshotMap = new Map();

        function applySnapshot(entities, projectiles, fireZones, opts) {
            opts = opts || {};
            if (!Array.isArray(entities)) return;

            if (!opts.delta) {
                snapshotMap.clear();
            }
            for (var i = 0; i < entities.length; i++) {
                var e = entities[i];
                snapshotMap.set(e.id, e);
                if (hooks.onEntity) hooks.onEntity(e);
            }
            var removedIds = Array.isArray(opts.removedEntityIds) ? opts.removedEntityIds : [];
            for (var r = 0; r < removedIds.length; r++) {
                snapshotMap.delete(removedIds[r]);
            }

            if (hooks.onPrune) hooks.onPrune(snapshotMap);
            if (hooks.onProjectiles) hooks.onProjectiles(Array.isArray(projectiles) ? projectiles.slice() : []);
            if (hooks.onFireZones) hooks.onFireZones(Array.isArray(fireZones) ? fireZones.slice() : []);
        }

        return {
            applySnapshot: applySnapshot,
            snapshotMap: snapshotMap
        };
    };

    globalThis.__MAYHEM_RUNTIME.GameNetSnapshots = GameNetSnapshots;
})();
