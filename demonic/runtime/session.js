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
                    recoilKick: Number(sessionState.runtimeSnapshot.camera.recoilKick || 0),
                    position: sessionState.runtimeSnapshot.camera.position ? {
                        x: Number(sessionState.runtimeSnapshot.camera.position.x || 0),
                        y: Number(sessionState.runtimeSnapshot.camera.position.y || 0),
                        z: Number(sessionState.runtimeSnapshot.camera.position.z || 0)
                    } : null,
                    target: sessionState.runtimeSnapshot.camera.target ? {
                        x: Number(sessionState.runtimeSnapshot.camera.target.x || 0),
                        y: Number(sessionState.runtimeSnapshot.camera.target.y || 0),
                        z: Number(sessionState.runtimeSnapshot.camera.target.z || 0)
                    } : null
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
                    groundHeight: Number(sessionState.runtimeSnapshot.world.groundHeight || 0),
                    bounds: sessionState.runtimeSnapshot.world.bounds ? {
                        min: Number(sessionState.runtimeSnapshot.world.bounds.min || 0),
                        max: Number(sessionState.runtimeSnapshot.world.bounds.max || 0),
                        centerX: Number(sessionState.runtimeSnapshot.world.bounds.centerX || 0),
                        centerZ: Number(sessionState.runtimeSnapshot.world.bounds.centerZ || 0)
                    } : null
                } : null,
                net: sessionState.runtimeSnapshot.net ? {
                    authorityMode: String(sessionState.runtimeSnapshot.net.authorityMode || ''),
                    backendKind: String(sessionState.runtimeSnapshot.net.backendKind || ''),
                    roomId: String(sessionState.runtimeSnapshot.net.roomId || ''),
                    authoritative: !!sessionState.runtimeSnapshot.net.authoritative,
                    apiBase: String(sessionState.runtimeSnapshot.net.apiBase || ''),
                    wsBase: String(sessionState.runtimeSnapshot.net.wsBase || ''),
                    status: String(sessionState.runtimeSnapshot.net.status || '')
                } : null,
                combat: sessionState.runtimeSnapshot.combat ? {
                    gameMode: String(sessionState.runtimeSnapshot.combat.gameMode || ''),
                    selectedWeaponId: String(sessionState.runtimeSnapshot.combat.selectedWeaponId || ''),
                    weaponCatalog: Array.isArray(sessionState.runtimeSnapshot.combat.weaponCatalog) ? sessionState.runtimeSnapshot.combat.weaponCatalog.slice() : [],
                    fireCooldownRemainingMs: Number(sessionState.runtimeSnapshot.combat.fireCooldownRemainingMs || 0),
                    reloadRemainingMs: Number(sessionState.runtimeSnapshot.combat.reloadRemainingMs || 0),
                    ammoInMag: Number(sessionState.runtimeSnapshot.combat.ammoInMag || 0),
                    magazineSize: Number(sessionState.runtimeSnapshot.combat.magazineSize || 0),
                    automatic: !!sessionState.runtimeSnapshot.combat.automatic,
                    cooldownMs: Number(sessionState.runtimeSnapshot.combat.cooldownMs || 0),
                    canFire: !!sessionState.runtimeSnapshot.combat.canFire,
                    lastShotAt: Number(sessionState.runtimeSnapshot.combat.lastShotAt || 0)
                } : null,
                abilities: sessionState.runtimeSnapshot.abilities ? {
                    loadout: sessionState.runtimeSnapshot.abilities.loadout ? {
                        slot1: String(sessionState.runtimeSnapshot.abilities.loadout.slot1 || ''),
                        slot2: String(sessionState.runtimeSnapshot.abilities.loadout.slot2 || '')
                    } : null,
                    hud: sessionState.runtimeSnapshot.abilities.hud ? {
                        slot1Name: String(sessionState.runtimeSnapshot.abilities.hud.slot1Name || ''),
                        slot2Name: String(sessionState.runtimeSnapshot.abilities.hud.slot2Name || ''),
                        slot1CooldownMs: Number(sessionState.runtimeSnapshot.abilities.hud.slot1CooldownMs || 0),
                        slot2CooldownMs: Number(sessionState.runtimeSnapshot.abilities.hud.slot2CooldownMs || 0)
                    } : null,
                    lastCast: sessionState.runtimeSnapshot.abilities.lastCast ? {
                        slot: String(sessionState.runtimeSnapshot.abilities.lastCast.slot || ''),
                        abilityId: String(sessionState.runtimeSnapshot.abilities.lastCast.abilityId || ''),
                        castAt: Number(sessionState.runtimeSnapshot.abilities.lastCast.castAt || 0)
                    } : null
                } : null,
                hud: sessionState.runtimeSnapshot.hud ? {
                    weaponInfo: String(sessionState.runtimeSnapshot.hud.weaponInfo || ''),
                    abilityInfo: String(sessionState.runtimeSnapshot.hud.abilityInfo || ''),
                    cooldownStatus: String(sessionState.runtimeSnapshot.hud.cooldownStatus || ''),
                    cooldownMs: Number(sessionState.runtimeSnapshot.hud.cooldownMs || 0),
                    movementInfo: String(sessionState.runtimeSnapshot.hud.movementInfo || '')
                } : null,
                presentation: sessionState.runtimeSnapshot.presentation ? {
                    pose: String(sessionState.runtimeSnapshot.presentation.pose || ''),
                    reticle: sessionState.runtimeSnapshot.presentation.reticle ? {
                        type: String(sessionState.runtimeSnapshot.presentation.reticle.type || ''),
                        size: Number(sessionState.runtimeSnapshot.presentation.reticle.size || 0),
                        label: String(sessionState.runtimeSnapshot.presentation.reticle.label || '')
                    } : null,
                    adsState: sessionState.runtimeSnapshot.presentation.adsState ? {
                        weaponId: String(sessionState.runtimeSnapshot.presentation.adsState.weaponId || ''),
                        active: !!sessionState.runtimeSnapshot.presentation.adsState.active,
                        scopeBlend: Number(sessionState.runtimeSnapshot.presentation.adsState.scopeBlend || 0),
                        scopeActive: !!sessionState.runtimeSnapshot.presentation.adsState.scopeActive
                    } : null,
                    weaponPresentation: sessionState.runtimeSnapshot.presentation.weaponPresentation ? {
                        weaponId: String(sessionState.runtimeSnapshot.presentation.weaponPresentation.weaponId || ''),
                        recoilKick: Number(sessionState.runtimeSnapshot.presentation.weaponPresentation.recoilKick || 0),
                        ammoInMag: Number(sessionState.runtimeSnapshot.presentation.weaponPresentation.ammoInMag || 0)
                    } : null,
                    abilityPresentation: sessionState.runtimeSnapshot.presentation.abilityPresentation ? {
                        slot1Active: !!sessionState.runtimeSnapshot.presentation.abilityPresentation.slot1Active,
                        slot2Active: !!sessionState.runtimeSnapshot.presentation.abilityPresentation.slot2Active
                    } : null
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
