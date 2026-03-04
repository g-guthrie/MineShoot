/**
 * event-bus.js - Lightweight synchronous event bus.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameEvents
 */
(function () {
    'use strict';

    var listeners = {};

    var GameEvents = {};

    GameEvents.on = function (eventName, callback) {
        if (!listeners[eventName]) listeners[eventName] = [];
        listeners[eventName].push(callback);
    };

    GameEvents.off = function (eventName, callback) {
        var list = listeners[eventName];
        if (!list) return;
        for (var i = list.length - 1; i >= 0; i--) {
            if (list[i] === callback) {
                list.splice(i, 1);
            }
        }
    };

    GameEvents.once = function (eventName, callback) {
        function wrapper(data) {
            GameEvents.off(eventName, wrapper);
            callback(data);
        }
        GameEvents.on(eventName, wrapper);
    };

    GameEvents.emit = function (eventName, data) {
        var list = listeners[eventName];
        if (!list || list.length === 0) return;
        var snapshot = list.slice();
        for (var i = 0; i < snapshot.length; i++) {
            try {
                snapshot[i](data);
            } catch (err) {
                console.error('[GameEvents] listener error on "' + eventName + '":', err);
            }
        }
    };

    GameEvents.clear = function () {
        listeners = {};
    };

    // Standard event name constants
    GameEvents.WEAPON_FIRED       = 'weapon.fired';
    GameEvents.PLAYER_DAMAGED     = 'player.damaged';
    GameEvents.PLAYER_KILLED      = 'player.killed';
    GameEvents.PLAYER_RESPAWNED   = 'player.respawned';
    GameEvents.ENEMY_DAMAGED      = 'enemy.damaged';
    GameEvents.ENEMY_KILLED       = 'enemy.killed';
    GameEvents.THROWABLE_THROWN   = 'throwable.thrown';
    GameEvents.THROWABLE_EXPLODED = 'throwable.exploded';
    GameEvents.ABILITY_CAST       = 'ability.cast';
    GameEvents.WEAPON_SWITCHED    = 'weapon.switched';
    GameEvents.MATCH_STARTED      = 'match.started';
    GameEvents.MATCH_ENDED        = 'match.ended';

    globalThis.__MAYHEM_RUNTIME.GameEvents = GameEvents;
})();
