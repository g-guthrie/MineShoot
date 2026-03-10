/**
 * lobby-sync-runtime.js - Menu polling and window lifecycle wiring.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameLobbySyncRuntime
 */
(function () {
    'use strict';

    var runtime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    var GameLobbySyncRuntime = {};

    GameLobbySyncRuntime.create = function (ctx) {
        ctx = ctx || {};

        var partyPollHandle = 0;
        var friendsPollHandle = 0;
        var privateRoomPollHandle = 0;
        var started = false;

        function refreshParty(silent) {
            return ctx.refreshPartyState ? ctx.refreshPartyState(silent) : Promise.resolve(null);
        }

        function refreshFriends(silent) {
            return ctx.refreshFriendsState ? ctx.refreshFriendsState(silent) : Promise.resolve(null);
        }

        function refreshPrivateRoom(silent) {
            return ctx.refreshPrivateRoomState ? ctx.refreshPrivateRoomState(silent) : Promise.resolve(null);
        }

        function refreshAll(silent) {
            refreshParty(silent);
            refreshFriends(silent);
        }

        function focusListener() {
            refreshAll(true);
        }

        function authChangedListener() {
            refreshAll(true);
            if (ctx.updateSocialSubtitle) ctx.updateSocialSubtitle();
        }

        function pagehideListener() {
            var identity = ctx.getPartyIdentity ? ctx.getPartyIdentity() : null;
            if (!identity || identity.kind !== 'guest' || !navigator.sendBeacon) return;
            try {
                var payload = ctx.buildGuestLeavePayload ? ctx.buildGuestLeavePayload(identity) : null;
                if (!payload) return;
                navigator.sendBeacon(ctx.resolvePartyUrl(), new Blob([JSON.stringify(payload)], { type: 'application/json' }));
                navigator.sendBeacon(ctx.resolvePrivateRoomUrl(), new Blob([JSON.stringify(payload)], { type: 'application/json' }));
            } catch (_err) {
                // no-op
            }
        }

        function start() {
            if (started) return;
            started = true;

            if (partyPollHandle) window.clearInterval(partyPollHandle);
            partyPollHandle = window.setInterval(function () {
                refreshParty(true);
            }, 5000);

            if (friendsPollHandle) window.clearInterval(friendsPollHandle);
            friendsPollHandle = window.setInterval(function () {
                refreshFriends(true);
            }, 5000);

            if (privateRoomPollHandle) window.clearInterval(privateRoomPollHandle);
            privateRoomPollHandle = window.setInterval(function () {
                refreshPrivateRoom(true);
            }, 2500);

            window.addEventListener('focus', focusListener);
            window.addEventListener('mayhem-auth-changed', authChangedListener);
            window.addEventListener('pagehide', pagehideListener);
        }

        function stop() {
            if (!started) return;
            started = false;

            if (partyPollHandle) {
                window.clearInterval(partyPollHandle);
                partyPollHandle = 0;
            }
            if (friendsPollHandle) {
                window.clearInterval(friendsPollHandle);
                friendsPollHandle = 0;
            }
            if (privateRoomPollHandle) {
                window.clearInterval(privateRoomPollHandle);
                privateRoomPollHandle = 0;
            }

            if (typeof window.removeEventListener === 'function') {
                window.removeEventListener('focus', focusListener);
                window.removeEventListener('mayhem-auth-changed', authChangedListener);
                window.removeEventListener('pagehide', pagehideListener);
            }
        }

        return {
            start: start,
            refreshAll: refreshAll,
            focusListener: focusListener,
            authChangedListener: authChangedListener,
            pagehideListener: pagehideListener,
            stop: stop
        };
    };

    runtime.GameLobbySyncRuntime = GameLobbySyncRuntime;
})();
