/**
 * combat-query.js - canonical combat target query aggregation
 * Loaded as global: window.GameCombatQuery
 */
(function () {
    'use strict';

    var GameCombatQuery = {};

    function ensureArray(out) {
        return Array.isArray(out) ? out : [];
    }

    GameCombatQuery.appendHitboxes = function (out) {
        out = ensureArray(out);

        if (window.GameEnemy) {
            if (window.GameEnemy.appendHitboxes) {
                window.GameEnemy.appendHitboxes(out);
            } else if (window.GameEnemy.getHitboxArray) {
                var local = window.GameEnemy.getHitboxArray() || [];
                for (var i = 0; i < local.length; i++) out.push(local[i]);
            }
        }

        if (window.GameNet) {
            if (window.GameNet.appendHitboxes) {
                window.GameNet.appendHitboxes(out);
            } else if (window.GameNet.getHitboxArray) {
                var net = window.GameNet.getHitboxArray() || [];
                for (var j = 0; j < net.length; j++) out.push(net[j]);
            }
        }

        return out;
    };

    GameCombatQuery.appendLockTargets = function (out) {
        out = ensureArray(out);

        if (window.GameEnemy) {
            if (window.GameEnemy.appendLockTargets) {
                window.GameEnemy.appendLockTargets(out);
            } else if (window.GameEnemy.getLockTargets) {
                var local = window.GameEnemy.getLockTargets() || [];
                for (var i = 0; i < local.length; i++) out.push(local[i]);
            }
        }

        if (window.GameNet) {
            if (window.GameNet.appendLockTargets) {
                window.GameNet.appendLockTargets(out);
            } else if (window.GameNet.getLockTargets) {
                var net = window.GameNet.getLockTargets() || [];
                for (var j = 0; j < net.length; j++) out.push(net[j]);
            }
        }

        return out;
    };

    GameCombatQuery.appendWorldCollidables = function (out) {
        out = ensureArray(out);
        if (!window.GameWorld || !window.GameWorld.getCollidables) return out;
        var meshes = window.GameWorld.getCollidables() || [];
        for (var i = 0; i < meshes.length; i++) out.push(meshes[i]);
        return out;
    };

    window.GameCombatQuery = GameCombatQuery;
})();
