/**
 * join-state.js - Join attempt lifecycle for GameNet room admission.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameNetJoinState
 */
(function () {
    'use strict';

    function create(opts) {
        opts = opts || {};
        var joinAttempt = null;

        function clearJoinAttemptTimer(attempt) {
            var current = attempt || joinAttempt;
            if (!current || !current.timer) return;
            clearTimeout(current.timer);
            current.timer = null;
        }

        function resetJoinAttempt() {
            clearJoinAttemptTimer(joinAttempt);
            joinAttempt = null;
        }

        function failJoin(reason) {
            if (!joinAttempt) return false;
            var current = joinAttempt;
            joinAttempt = null;
            clearJoinAttemptTimer(current);
            if (typeof current.reject === 'function') {
                current.reject(new Error(String(reason || 'Room join failed.')));
            }
            return true;
        }

        function maybeResolveJoinAttempt() {
            if (!joinAttempt || !joinAttempt.welcomeReceived || !joinAttempt.selfSnapshotReceived) return false;
            var current = joinAttempt;
            joinAttempt = null;
            clearJoinAttemptTimer(current);
            if (typeof current.resolve === 'function') {
                current.resolve({
                    roomId: current.expectedRoomId,
                    selfId: current.selfId || (opts.getSelfId ? opts.getSelfId() : '') || ''
                });
            }
            return true;
        }

        function markJoinConnectStart() {
            if (!joinAttempt || joinAttempt.timer) return;
            joinAttempt.timer = setTimeout(function () {
                failJoin('Timed out joining room ' + String(
                    joinAttempt && joinAttempt.expectedRoomId ||
                    (opts.getRoomId ? opts.getRoomId() : '') ||
                    'global'
                ).toUpperCase() + '.');
            }, Math.max(1, Number(joinAttempt.timeoutMs || 5000)));
        }

        function resolveJoinOnWelcome(data) {
            if (!joinAttempt) return false;
            var actualRoomId = opts.sanitizeRoomId
                ? opts.sanitizeRoomId(data && data.roomId || (opts.getRoomId ? opts.getRoomId() : '') || 'global')
                : String(data && data.roomId || '').trim().toLowerCase();
            if (actualRoomId !== joinAttempt.expectedRoomId) {
                failJoin(
                    'Joined unexpected room ' + actualRoomId.toUpperCase() +
                    ' while expecting ' + joinAttempt.expectedRoomId.toUpperCase() + '.'
                );
                return false;
            }
            joinAttempt.welcomeReceived = true;
            joinAttempt.selfId = String(data && data.selfId || (opts.getSelfId ? opts.getSelfId() : '') || '');
            return maybeResolveJoinAttempt();
        }

        function resolveJoinOnSelfSnapshot(entityId) {
            if (!joinAttempt) return false;
            var expectedSelfId = String(joinAttempt.selfId || (opts.getSelfId ? opts.getSelfId() : '') || '');
            if (expectedSelfId && String(entityId || '') !== expectedSelfId) return false;
            joinAttempt.selfSnapshotReceived = true;
            return maybeResolveJoinAttempt();
        }

        function beginJoinAttempt(rawOpts) {
            var nextOpts = rawOpts || {};
            failJoin('Superseded by a newer room join attempt.');
            resetJoinAttempt();
            return new Promise(function (resolve, reject) {
                joinAttempt = {
                    expectedRoomId: opts.sanitizeRoomId
                        ? opts.sanitizeRoomId(nextOpts.expectedRoomId || (opts.getRoomId ? opts.getRoomId() : '') || 'global')
                        : String(nextOpts.expectedRoomId || '').trim().toLowerCase(),
                    timeoutMs: Math.max(1, Number(nextOpts.timeoutMs || 5000)),
                    welcomeReceived: false,
                    selfSnapshotReceived: false,
                    selfId: '',
                    timer: null,
                    resolve: resolve,
                    reject: reject
                };
                if (nextOpts.startTimerImmediately === true) {
                    markJoinConnectStart();
                }
            });
        }

        return {
            beginJoinAttempt: beginJoinAttempt,
            clearJoinAttemptTimer: clearJoinAttemptTimer,
            resetJoinAttempt: resetJoinAttempt,
            failJoin: failJoin,
            markJoinConnectStart: markJoinConnectStart,
            resolveJoinOnWelcome: resolveJoinOnWelcome,
            resolveJoinOnSelfSnapshot: resolveJoinOnSelfSnapshot,
            hasJoinAttempt: function () { return !!joinAttempt; },
            getJoinAttempt: function () { return joinAttempt; }
        };
    }

    globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    globalThis.__MAYHEM_RUNTIME.GameNetJoinState = {
        create: create
    };
})();
