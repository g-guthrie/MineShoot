(function () {
    'use strict';

    var demonicRuntime = globalThis.__DEMONIC_RUNTIME = globalThis.__DEMONIC_RUNTIME || {};

    function clone(value) {
        return value ? JSON.parse(JSON.stringify(value)) : null;
    }

    function create() {
        var roomState = {
            roomId: '',
            authorityMode: '',
            backendKind: '',
            authoritative: false,
            gameMode: '',
            privateRoomPhase: '',
            selfId: '',
            tickRate: 0,
            connectionState: 'idle',
            worldSeed: '',
            worldProfileVersion: 0,
            worldFlags: null
        };
        var selfState = null;
        var matchState = null;

        return {
            setRoomState: function (patch) {
                var next = patch || {};
                roomState.roomId = String(next.roomId != null ? next.roomId : roomState.roomId);
                roomState.authorityMode = String(next.authorityMode != null ? next.authorityMode : roomState.authorityMode);
                roomState.backendKind = String(next.backendKind != null ? next.backendKind : roomState.backendKind);
                roomState.authoritative = next.authoritative != null ? !!next.authoritative : roomState.authoritative;
                roomState.gameMode = String(next.gameMode != null ? next.gameMode : roomState.gameMode);
                roomState.privateRoomPhase = String(next.privateRoomPhase != null ? next.privateRoomPhase : roomState.privateRoomPhase);
                roomState.selfId = String(next.selfId != null ? next.selfId : roomState.selfId);
                roomState.tickRate = next.tickRate != null ? Math.max(0, Number(next.tickRate || 0)) : roomState.tickRate;
                roomState.connectionState = String(next.connectionState != null ? next.connectionState : roomState.connectionState);
                roomState.worldSeed = String(next.worldSeed != null ? next.worldSeed : roomState.worldSeed);
                roomState.worldProfileVersion = next.worldProfileVersion != null
                    ? Math.max(0, Number(next.worldProfileVersion || 0))
                    : roomState.worldProfileVersion;
                roomState.worldFlags = next.worldFlags != null ? clone(next.worldFlags) : roomState.worldFlags;
            },
            setSelfState: function (nextState) {
                selfState = clone(nextState);
            },
            setMatchState: function (nextState) {
                matchState = clone(nextState);
            },
            getSnapshot: function () {
                return {
                    roomState: clone(roomState),
                    selfState: clone(selfState),
                    matchState: clone(matchState)
                };
            }
        };
    }

    demonicRuntime.GameNetStateView = {
        create: create
    };
})();
