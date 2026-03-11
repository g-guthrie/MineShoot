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
                input: sessionState.runtimeSnapshot.input ? {
                    moveForward: !!sessionState.runtimeSnapshot.input.moveForward,
                    moveBackward: !!sessionState.runtimeSnapshot.input.moveBackward,
                    moveLeft: !!sessionState.runtimeSnapshot.input.moveLeft,
                    moveRight: !!sessionState.runtimeSnapshot.input.moveRight,
                    sprint: !!sessionState.runtimeSnapshot.input.sprint,
                    ads: !!sessionState.runtimeSnapshot.input.ads,
                    jumpQueued: !!sessionState.runtimeSnapshot.input.jumpQueued,
                    triggerHeld: !!sessionState.runtimeSnapshot.input.triggerHeld
                } : null,
                camera: sessionState.runtimeSnapshot.camera ? {
                    fov: Number(sessionState.runtimeSnapshot.camera.fov || 0),
                    scopeBlend: Number(sessionState.runtimeSnapshot.camera.scopeBlend || 0),
                    sprintBlend: Number(sessionState.runtimeSnapshot.camera.sprintBlend || 0),
                    recoilKick: Number(sessionState.runtimeSnapshot.camera.recoilKick || 0)
                } : null,
                player: sessionState.runtimeSnapshot.player ? {
                    x: Number(sessionState.runtimeSnapshot.player.x || 0),
                    y: Number(sessionState.runtimeSnapshot.player.y || 0),
                    z: Number(sessionState.runtimeSnapshot.player.z || 0),
                    yaw: Number(sessionState.runtimeSnapshot.player.yaw || 0),
                    pitch: Number(sessionState.runtimeSnapshot.player.pitch || 0),
                    speed: Number(sessionState.runtimeSnapshot.player.speed || 0),
                    sprinting: !!sessionState.runtimeSnapshot.player.sprinting,
                    adsActive: !!sessionState.runtimeSnapshot.player.adsActive,
                    airborne: !!sessionState.runtimeSnapshot.player.airborne,
                    moving: !!sessionState.runtimeSnapshot.player.moving,
                    bobPhase: Number(sessionState.runtimeSnapshot.player.bobPhase || 0),
                    runSpeed: Number(sessionState.runtimeSnapshot.player.runSpeed || 0),
                    jogSpeed: Number(sessionState.runtimeSnapshot.player.jogSpeed || 0),
                    jumpVelocity: Number(sessionState.runtimeSnapshot.player.jumpVelocity || 0)
                } : null,
                world: sessionState.runtimeSnapshot.world ? {
                    modeId: String(sessionState.runtimeSnapshot.world.modeId || ''),
                    roomId: String(sessionState.runtimeSnapshot.world.roomId || ''),
                    worldSeed: String(sessionState.runtimeSnapshot.world.worldSeed || ''),
                    bounds: sessionState.runtimeSnapshot.world.bounds ? {
                        min: Number(sessionState.runtimeSnapshot.world.bounds.min || 0),
                        max: Number(sessionState.runtimeSnapshot.world.bounds.max || 0),
                        centerX: Number(sessionState.runtimeSnapshot.world.bounds.centerX || 0),
                        centerZ: Number(sessionState.runtimeSnapshot.world.bounds.centerZ || 0)
                    } : null
                } : null,
                combat: sessionState.runtimeSnapshot.combat ? {
                    gameMode: String(sessionState.runtimeSnapshot.combat.gameMode || ''),
                    selectedWeaponId: String(sessionState.runtimeSnapshot.combat.selectedWeaponId || ''),
                    weaponCatalog: Array.isArray(sessionState.runtimeSnapshot.combat.weaponCatalog) ? sessionState.runtimeSnapshot.combat.weaponCatalog.slice() : [],
                    fireCooldownRemainingMs: Number(sessionState.runtimeSnapshot.combat.fireCooldownRemainingMs || 0),
                    lastShotAt: Number(sessionState.runtimeSnapshot.combat.lastShotAt || 0)
                } : null,
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
