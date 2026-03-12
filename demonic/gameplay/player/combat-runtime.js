(function () {
    'use strict';

    var demonicRuntime = globalThis.__DEMONIC_RUNTIME = globalThis.__DEMONIC_RUNTIME || {};

    function clone(value) {
        return value ? JSON.parse(JSON.stringify(value)) : null;
    }

    function eventKey(event) {
        if (!event) return '';
        return [
            String(event.sourceId || ''),
            String(event.targetId || ''),
            String(event.weaponId || ''),
            String(event.hitType || ''),
            Number(event.damage || 0),
            event.killed ? '1' : '0'
        ].join('|');
    }

    function respawnKey(state) {
        if (!state) return '';
        return [
            String(state.entityId || ''),
            Number(state.respawnAt || 0),
            Number(state.x || 0),
            Number(state.z || 0),
            String(state.classApplied || '')
        ].join('|');
    }

    function create(options) {
        options = options || {};

        var state = {
            hp: 500,
            hpMax: 500,
            armor: 90,
            armorMax: 90,
            alive: true,
            invulnerable: false,
            respawnAt: 0,
            respawnRemainingMs: 0,
            respawnActive: false,
            lastIncomingDamage: null
        };
        var pendingFeedback = null;
        var lastIncomingDamageKey = '';
        var lastRespawnKey = '';

        function netSnapshot() {
            return options.getNetSnapshot ? options.getNetSnapshot() : {};
        }

        function syncFromSelfState(selfState) {
            if (!selfState) return;
            if (typeof selfState.hp === 'number') state.hp = Number(selfState.hp || 0);
            if (typeof selfState.hpMax === 'number') state.hpMax = Math.max(1, Number(selfState.hpMax || 1));
            if (typeof selfState.armor === 'number') state.armor = Math.max(0, Number(selfState.armor || 0));
            if (typeof selfState.armorMax === 'number') state.armorMax = Math.max(0, Number(selfState.armorMax || 0));
            state.alive = selfState.alive !== false;
            state.invulnerable = Number(selfState.spawnShieldUntil || 0) > Date.now();
            if (state.alive && !state.respawnActive) {
                state.respawnAt = 0;
                state.respawnRemainingMs = 0;
            }
        }

        function syncRespawn(respawnState) {
            var key = respawnKey(respawnState);
            if (!key || key === lastRespawnKey) return;
            lastRespawnKey = key;
            state.alive = false;
            state.respawnAt = Math.max(Date.now(), Number(respawnState.respawnAt || 0));
            state.respawnRemainingMs = Math.max(0, state.respawnAt - Date.now());
            state.respawnActive = true;
        }

        function syncIncomingDamage(damageState) {
            var key = eventKey(damageState);
            if (!key || key === lastIncomingDamageKey) return;
            lastIncomingDamageKey = key;
            state.lastIncomingDamage = clone(damageState);
            pendingFeedback = {
                damage: Math.max(0, Number(damageState.damage || 0)),
                hitType: String(damageState.hitType || 'body'),
                sourceId: String(damageState.sourceId || ''),
                weaponId: String(damageState.weaponId || ''),
                killed: !!damageState.killed
            };
        }

        return {
            update: function () {
                var net = netSnapshot() || {};
                syncFromSelfState(net.selfState || null);
                syncIncomingDamage(net.lastIncomingDamage || null);
                syncRespawn(net.respawnState || null);
                if (!net.respawnState && state.alive) {
                    state.respawnAt = 0;
                    state.respawnRemainingMs = 0;
                    state.respawnActive = false;
                    lastRespawnKey = '';
                }
                if (state.respawnAt > 0) {
                    state.respawnRemainingMs = Math.max(0, Number(state.respawnAt || 0) - Date.now());
                    state.respawnActive = state.respawnRemainingMs > 0 || !state.alive;
                } else {
                    state.respawnRemainingMs = 0;
                    state.respawnActive = false;
                }
                if (state.alive && state.respawnRemainingMs <= 0) {
                    state.respawnActive = false;
                    state.respawnAt = 0;
                }
            },
            canUseActions: function () {
                return !!state.alive && !state.respawnActive;
            },
            consumeIncomingFeedback: function () {
                var out = pendingFeedback ? clone(pendingFeedback) : null;
                pendingFeedback = null;
                return out;
            },
            getSnapshot: function () {
                return {
                    hp: Number(state.hp || 0),
                    hpMax: Number(state.hpMax || 0),
                    armor: Number(state.armor || 0),
                    armorMax: Number(state.armorMax || 0),
                    alive: !!state.alive,
                    invulnerable: !!state.invulnerable,
                    respawnAt: Number(state.respawnAt || 0),
                    respawnRemainingMs: Number(state.respawnRemainingMs || 0),
                    respawnActive: !!state.respawnActive,
                    lastIncomingDamage: clone(state.lastIncomingDamage)
                };
            }
        };
    }

    demonicRuntime.GamePlayerCombatRuntime = {
        create: create
    };
})();
