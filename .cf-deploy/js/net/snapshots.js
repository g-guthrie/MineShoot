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

        function applySnapshot(entities, projectiles, fireZones) {
            if (!Array.isArray(entities)) return;

            snapshotMap.clear();
            for (var i = 0; i < entities.length; i++) {
                var e = entities[i];
                snapshotMap.set(e.id, e);
                if (hooks.onEntity) hooks.onEntity(e);
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
