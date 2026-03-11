(function () {
    'use strict';

    var demonicRuntime = globalThis.__DEMONIC_RUNTIME = globalThis.__DEMONIC_RUNTIME || {};

    function createStatusMarkup(snapshot) {
        var state = snapshot || {};
        var player = state.player || {};
        var combat = state.combat || {};
        var world = state.world || {};
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
                    'status    :: ' + String(state.statusText || 'initializing') +
                '</pre>' +
            '</div>';
    }

    function create(options) {
        options = options || {};

        var bootstrap = demonicRuntime.GameBootstrap || null;
        var host = bootstrap && bootstrap.showRuntimeHost ? bootstrap.showRuntimeHost() : null;
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
            combat: null,
            statusText: 'bootstrapping coordinator'
        };

        function render() {
            if (!host) return;
            host.innerHTML = createStatusMarkup(snapshot);
        }

        function start() {
            snapshot.phase = 'starting';
            snapshot.statusText = 'launch accepted';
            coordinator = coordinatorApi && coordinatorApi.create
                ? coordinatorApi.create({
                    mode: mode,
                    context: context,
                    onUpdate: function (nextSnapshot) {
                        snapshot.phase = String(nextSnapshot && nextSnapshot.phase || 'running');
                        snapshot.tickCount = Number(nextSnapshot && nextSnapshot.tickCount || 0);
                        snapshot.elapsedMs = Number(nextSnapshot && nextSnapshot.elapsedMs || 0);
                        snapshot.player = nextSnapshot && nextSnapshot.player ? nextSnapshot.player : null;
                        snapshot.world = nextSnapshot && nextSnapshot.world ? nextSnapshot.world : null;
                        snapshot.combat = nextSnapshot && nextSnapshot.combat ? nextSnapshot.combat : null;
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
                snapshot.combat = startedSnapshot && startedSnapshot.combat ? startedSnapshot.combat : null;
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
                snapshot.combat = stopped && stopped.combat ? stopped.combat : snapshot.combat;
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
                    bounds: snapshot.world.bounds ? Object.assign({}, snapshot.world.bounds) : null
                } : null,
                combat: snapshot.combat ? {
                    gameMode: String(snapshot.combat.gameMode || ''),
                    selectedWeaponId: String(snapshot.combat.selectedWeaponId || ''),
                    weaponCatalog: Array.isArray(snapshot.combat.weaponCatalog) ? snapshot.combat.weaponCatalog.slice() : [],
                    fireCooldownRemainingMs: Number(snapshot.combat.fireCooldownRemainingMs || 0)
                } : null,
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
