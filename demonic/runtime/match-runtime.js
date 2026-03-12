(function () {
    'use strict';

    var demonicRuntime = globalThis.__DEMONIC_RUNTIME = globalThis.__DEMONIC_RUNTIME || {};

    function createStatusMarkup(snapshot) {
        var state = snapshot || {};
        var player = state.player || {};
        var combat = state.combat || {};
        var world = state.world || {};
        var net = state.net || {};
        return '' +
            '<div class="demonic-runtime-stage">' +
                '<div class="demonic-runtime-stage-head">' +
                    '<span>DEMONIC MATCH RUNTIME</span>' +
                    '<strong>' + String(state.phase || 'boot') + '</strong>' +
                '</div>' +
                '<pre>' +
                    'mode      :: ' + String(state.modeId || '') + '\n' +
                    'ruleset   :: ' + String(state.gameMode || '') + '\n' +
                    'room      :: ' + String(state.roomId || 'local') + '\n' +
                    'ticks     :: ' + String(state.tickCount || 0) + '\n' +
                    'elapsed   :: ' + String(Number(state.elapsedMs || 0).toFixed(0)) + 'ms\n' +
                    'player    :: (' + Number(player.x || 0).toFixed(1) + ', ' + Number(player.z || 0).toFixed(1) + ')\n' +
                    'weapon    :: ' + String(combat.selectedWeaponId || 'none') + '\n' +
                    'worldSeed :: ' + String(world.worldSeed || 'unset') + '\n' +
                    'authority :: ' + String(net.status || 'unknown') + '\n' +
                    'status    :: ' + String(state.statusText || 'initializing') +
                '</pre>' +
            '</div>';
    }

    function create(options) {
        options = options || {};

        var bootstrap = demonicRuntime.GameBootstrap || null;
        var host = bootstrap && bootstrap.showRuntimeHost ? bootstrap.showRuntimeHost() : null;
        var statusHost = bootstrap && bootstrap.getRuntimeStatusHost ? bootstrap.getRuntimeStatusHost() : host;
        var sceneHost = bootstrap && bootstrap.getRuntimeSceneHost ? bootstrap.getRuntimeSceneHost() : null;
        var mode = options.mode || null;
        var context = options.context || {};
        var coordinatorApi = demonicRuntime.GameRuntimeCoordinator || null;
        var coordinator = null;
        var snapshot = {
            phase: 'booting',
            modeId: String(mode && mode.id || ''),
            gameMode: String(context && context.gameMode || ''),
            roomId: String(context && context.roomId || ''),
            tickCount: 0,
            elapsedMs: 0,
            player: null,
            world: null,
            net: null,
            combat: null,
            abilities: null,
            camera: null,
            hud: null,
            presentation: null,
            actor: null,
            statusText: 'bootstrapping coordinator'
        };

        function render() {
            if (!statusHost) return;
            statusHost.innerHTML = createStatusMarkup(snapshot);
        }

        function start() {
            snapshot.phase = 'starting';
            snapshot.statusText = 'launch accepted';
            coordinator = coordinatorApi && coordinatorApi.create
                ? coordinatorApi.create({
                    mode: mode,
                    context: context,
                    sceneHost: sceneHost,
                    onUpdate: function (nextSnapshot) {
                        snapshot.phase = String(nextSnapshot && nextSnapshot.phase || 'running');
                        snapshot.tickCount = Number(nextSnapshot && nextSnapshot.tickCount || 0);
                        snapshot.elapsedMs = Number(nextSnapshot && nextSnapshot.elapsedMs || 0);
                        snapshot.player = nextSnapshot && nextSnapshot.player ? nextSnapshot.player : null;
                        snapshot.world = nextSnapshot && nextSnapshot.world ? nextSnapshot.world : null;
                        snapshot.net = nextSnapshot && nextSnapshot.net ? nextSnapshot.net : null;
                        snapshot.combat = nextSnapshot && nextSnapshot.combat ? nextSnapshot.combat : null;
                        snapshot.abilities = nextSnapshot && nextSnapshot.abilities ? nextSnapshot.abilities : null;
                        snapshot.camera = nextSnapshot && nextSnapshot.camera ? nextSnapshot.camera : null;
                        snapshot.hud = nextSnapshot && nextSnapshot.hud ? nextSnapshot.hud : null;
                        snapshot.presentation = nextSnapshot && nextSnapshot.presentation ? nextSnapshot.presentation : null;
                        snapshot.actor = nextSnapshot && nextSnapshot.actor ? nextSnapshot.actor : null;
                        snapshot.statusText = snapshot.tickCount < 3
                            ? 'warming runtime lane'
                            : 'runtime skeleton active';
                        render();
                    }
                })
                : null;
            if (coordinator && coordinator.start) {
                var startedSnapshot = coordinator.start();
                snapshot.phase = String(startedSnapshot && startedSnapshot.phase || 'starting');
                snapshot.tickCount = Number(startedSnapshot && startedSnapshot.tickCount || 0);
                snapshot.elapsedMs = Number(startedSnapshot && startedSnapshot.elapsedMs || 0);
                snapshot.player = startedSnapshot && startedSnapshot.player ? startedSnapshot.player : null;
                snapshot.world = startedSnapshot && startedSnapshot.world ? startedSnapshot.world : null;
                snapshot.net = startedSnapshot && startedSnapshot.net ? startedSnapshot.net : null;
                snapshot.combat = startedSnapshot && startedSnapshot.combat ? startedSnapshot.combat : null;
                snapshot.abilities = startedSnapshot && startedSnapshot.abilities ? startedSnapshot.abilities : null;
                snapshot.camera = startedSnapshot && startedSnapshot.camera ? startedSnapshot.camera : null;
                snapshot.hud = startedSnapshot && startedSnapshot.hud ? startedSnapshot.hud : null;
                snapshot.presentation = startedSnapshot && startedSnapshot.presentation ? startedSnapshot.presentation : null;
                snapshot.actor = startedSnapshot && startedSnapshot.actor ? startedSnapshot.actor : null;
            }
            render();
            return getSnapshot();
        }

        function stop() {
            if (coordinator && coordinator.stop) {
                var stopped = coordinator.stop();
                snapshot.phase = String(stopped && stopped.phase || 'stopped');
                snapshot.tickCount = Number(stopped && stopped.tickCount || snapshot.tickCount || 0);
                snapshot.elapsedMs = Number(stopped && stopped.elapsedMs || snapshot.elapsedMs || 0);
                snapshot.player = stopped && stopped.player ? stopped.player : snapshot.player;
                snapshot.world = stopped && stopped.world ? stopped.world : snapshot.world;
                snapshot.net = stopped && stopped.net ? stopped.net : snapshot.net;
                snapshot.combat = stopped && stopped.combat ? stopped.combat : snapshot.combat;
                snapshot.abilities = stopped && stopped.abilities ? stopped.abilities : snapshot.abilities;
                snapshot.camera = stopped && stopped.camera ? stopped.camera : snapshot.camera;
                snapshot.hud = stopped && stopped.hud ? stopped.hud : snapshot.hud;
                snapshot.presentation = stopped && stopped.presentation ? stopped.presentation : snapshot.presentation;
                snapshot.actor = stopped && stopped.actor ? stopped.actor : snapshot.actor;
            }
            snapshot.phase = 'stopped';
            snapshot.statusText = 'runtime halted';
            render();
            if (bootstrap && bootstrap.hideRuntimeHost) bootstrap.hideRuntimeHost();
            if (bootstrap && bootstrap.clearRuntimeHost) bootstrap.clearRuntimeHost();
            return getSnapshot();
        }

        function getSnapshot() {
            return {
                phase: String(snapshot.phase || ''),
                modeId: String(snapshot.modeId || ''),
                gameMode: String(snapshot.gameMode || ''),
                roomId: String(snapshot.roomId || ''),
                tickCount: Number(snapshot.tickCount || 0),
                elapsedMs: Number(snapshot.elapsedMs || 0),
                player: snapshot.player ? Object.assign({}, snapshot.player) : null,
                world: snapshot.world ? {
                    modeId: String(snapshot.world.modeId || ''),
                    roomId: String(snapshot.world.roomId || ''),
                    worldSeed: String(snapshot.world.worldSeed || ''),
                    groundHeight: Number(snapshot.world.groundHeight || 0),
                    bounds: snapshot.world.bounds ? Object.assign({}, snapshot.world.bounds) : null
                } : null,
                net: snapshot.net ? {
                    authorityMode: String(snapshot.net.authorityMode || ''),
                    backendKind: String(snapshot.net.backendKind || ''),
                    roomId: String(snapshot.net.roomId || ''),
                    authoritative: !!snapshot.net.authoritative,
                    apiBase: String(snapshot.net.apiBase || ''),
                    wsBase: String(snapshot.net.wsBase || ''),
                    selfId: String(snapshot.net.selfId || ''),
                    tickRate: Number(snapshot.net.tickRate || 0),
                    connectionState: String(snapshot.net.connectionState || ''),
                    connectionError: String(snapshot.net.connectionError || ''),
                    lastServerMessageAt: Number(snapshot.net.lastServerMessageAt || 0),
                    inputSync: snapshot.net.inputSync ? JSON.parse(JSON.stringify(snapshot.net.inputSync)) : null,
                    selfState: snapshot.net.selfState ? JSON.parse(JSON.stringify(snapshot.net.selfState)) : null,
                    predictedSelfState: snapshot.net.predictedSelfState ? JSON.parse(JSON.stringify(snapshot.net.predictedSelfState)) : null,
                    matchState: snapshot.net.matchState ? JSON.parse(JSON.stringify(snapshot.net.matchState)) : null,
                    status: String(snapshot.net.status || '')
                } : null,
                combat: snapshot.combat ? {
                    gameMode: String(snapshot.combat.gameMode || ''),
                    selectedWeaponId: String(snapshot.combat.selectedWeaponId || ''),
                    weaponCatalog: Array.isArray(snapshot.combat.weaponCatalog) ? snapshot.combat.weaponCatalog.slice() : [],
                    fireCooldownRemainingMs: Number(snapshot.combat.fireCooldownRemainingMs || 0),
                    reloadRemainingMs: Number(snapshot.combat.reloadRemainingMs || 0),
                    ammoInMag: Number(snapshot.combat.ammoInMag || 0),
                    magazineSize: Number(snapshot.combat.magazineSize || 0),
                    automatic: !!snapshot.combat.automatic,
                    cooldownMs: Number(snapshot.combat.cooldownMs || 0),
                    canFire: !!snapshot.combat.canFire,
                    lastShotAt: Number(snapshot.combat.lastShotAt || 0)
                } : null,
                abilities: snapshot.abilities ? JSON.parse(JSON.stringify(snapshot.abilities)) : null,
                camera: snapshot.camera ? JSON.parse(JSON.stringify(snapshot.camera)) : null,
                hud: snapshot.hud ? JSON.parse(JSON.stringify(snapshot.hud)) : null,
                presentation: snapshot.presentation ? JSON.parse(JSON.stringify(snapshot.presentation)) : null,
                actor: snapshot.actor ? JSON.parse(JSON.stringify(snapshot.actor)) : null,
                statusText: String(snapshot.statusText || '')
            };
        }

        render();

        return {
            start: start,
            stop: stop,
            getSnapshot: getSnapshot
        };
    }

    demonicRuntime.GameMatchRuntime = {
        create: create
    };
})();
