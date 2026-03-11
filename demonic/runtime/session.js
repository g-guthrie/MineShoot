(function () {
    'use strict';

    var demonicRuntime = globalThis.__DEMONIC_RUNTIME = globalThis.__DEMONIC_RUNTIME || {};
    var sessionState = {
        phase: 'menu',
        mode: null,
        context: null,
        enteredAt: 0,
        runtimeSnapshot: null
    };

    function cloneMode(mode) {
        if (!mode) return null;
        return {
            id: String(mode.id || ''),
            label: String(mode.label || ''),
            backendLabel: String(mode.backendLabel || ''),
            authorityMode: String(mode.authorityMode || ''),
            roomId: String(mode.roomId || ''),
            gameMode: String(mode.gameMode || '')
        };
    }

    function cloneContext(context) {
        var source = context || {};
        return {
            modeId: String(source.modeId || ''),
            roomId: String(source.roomId || ''),
            gameMode: String(source.gameMode || ''),
            notice: String(source.notice || '')
        };
    }

    function snapshot() {
        return {
            phase: sessionState.phase,
            mode: cloneMode(sessionState.mode),
            context: cloneContext(sessionState.context),
            enteredAt: Number(sessionState.enteredAt || 0),
            runtimeSnapshot: sessionState.runtimeSnapshot ? {
                phase: String(sessionState.runtimeSnapshot.phase || ''),
                modeId: String(sessionState.runtimeSnapshot.modeId || ''),
                gameMode: String(sessionState.runtimeSnapshot.gameMode || ''),
                roomId: String(sessionState.runtimeSnapshot.roomId || ''),
                tickCount: Number(sessionState.runtimeSnapshot.tickCount || 0),
                elapsedMs: Number(sessionState.runtimeSnapshot.elapsedMs || 0),
                statusText: String(sessionState.runtimeSnapshot.statusText || '')
            } : null
        };
    }

    function setState(nextPhase, mode, context, runtimeSnapshot) {
        sessionState.phase = String(nextPhase || 'menu');
        sessionState.mode = cloneMode(mode);
        sessionState.context = cloneContext(context);
        sessionState.enteredAt = nextPhase === 'in_match' ? Date.now() : 0;
        sessionState.runtimeSnapshot = runtimeSnapshot || null;
        return snapshot();
    }

    demonicRuntime.GameSession = {
        prepareLaunch: function (context) {
            return setState('launching', null, context, null);
        },
        enterGameplay: function (_event, mode, context, runtimeSnapshot) {
            return Promise.resolve({
                ok: true,
                entered: true,
                snapshot: setState('in_match', mode, context, runtimeSnapshot || null)
            });
        },
        returnToMenu: function () {
            return setState('menu', null, null, null);
        },
        syncRuntimeSnapshot: function (nextSnapshot) {
            sessionState.runtimeSnapshot = nextSnapshot || null;
            return snapshot();
        },
        getState: snapshot
    };
})();
