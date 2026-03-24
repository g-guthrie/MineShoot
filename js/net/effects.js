/**
 * effects.js - Effect and helper owner for GameNet.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameNetEffects
 */
(function () {
    'use strict';

    var runtime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    var GameNetEffects = {};

    GameNetEffects.create = function (opts) {
        opts = opts || {};
        var selfPointScratch = {
            x: 0,
            y: 0,
            z: 0,
            set: function (x, y, z) {
                this.x = x;
                this.y = y;
                this.z = z;
                return this;
            }
        };

        function createPointScratch() {
            if (typeof THREE !== 'undefined' && THREE && typeof THREE.Vector3 === 'function') {
                return new THREE.Vector3();
            }
            return {
                x: 0,
                y: 0,
                z: 0,
                set: function (x, y, z) {
                    this.x = x;
                    this.y = y;
                    this.z = z;
                    return this;
                },
                copy: function (other) {
                    return this.set(other.x, other.y, other.z);
                }
            };
        }

        var renderCoreWorldPosScratch = createPointScratch();

        function setPoint(out, x, y, z) {
            if (out && typeof out.set === 'function') {
                return out.set(x, y, z);
            }
            if (out && typeof out === 'object') {
                out.x = x;
                out.y = y;
                out.z = z;
                return out;
            }
            return { x: x, y: y, z: z };
        }

        function GameNetEntities() {
            return opts.getEntitiesApi ? opts.getEntitiesApi() : null;
        }

        function netState() {
            return opts.getNetState ? opts.getNetState() : null;
        }

        function connectionTiming() {
            return opts.getConnectionTiming ? opts.getConnectionTiming() : null;
        }

        function playerApi() {
            return opts.getPlayerApi ? opts.getPlayerApi() : null;
        }

        function playerCombatApi() {
            return opts.getPlayerCombatApi ? opts.getPlayerCombatApi() : null;
        }

        function abilityFxApi() {
            return opts.getAbilityFxApi ? opts.getAbilityFxApi() : null;
        }

        function damagePointY(entityY) {
            return opts.damagePointY ? opts.damagePointY(entityY) : (entityY + 1.06);
        }

        function markerPointY(entityY) {
            return opts.markerPointY ? opts.markerPointY(entityY) : (entityY + 2.25);
        }

        function flushPendingWeaponLoadout() {
            var state = netState();
            var pending = state && state.getPendingWeaponLoadout ? state.getPendingWeaponLoadout() : null;
            if (!pending) return false;
            var wsSend = opts.wsSend || null;
            if (!wsSend || !wsSend({
                t: opts.weaponLoadoutMessageType || 'weapon_loadout',
                slot1: pending.slot1,
                slot2: pending.slot2
            })) return false;
            return true;
        }

        function clearRemoteWorldState() {
            var state = netState();
            var entitiesApi = GameNetEntities();
            if (state && state.clearSnapshotMap) {
                state.clearSnapshotMap();
            }
            if (state && state.pruneRemoteSnapshotTimelines) {
                state.pruneRemoteSnapshotTimelines(new Map());
            }
            if (state && state.setRemoteProjectileState) {
                state.setRemoteProjectileState([]);
            }
            if (state && state.setRemoteFireZoneState) {
                state.setRemoteFireZoneState([]);
            }
            if (entitiesApi && entitiesApi.cleanup) {
                entitiesApi.cleanup();
            }
        }

        function applyPendingSpawnSync() {
            var state = netState();
            var pendingSpawnSync = state && state.getPendingSpawnSync ? state.getPendingSpawnSync() : null;
            if (!pendingSpawnSync) return;
            if (Date.now() < Number(pendingSpawnSync.executeAt || 0)) return;
            var gamePlayer = playerApi();
            if (!gamePlayer || !gamePlayer.respawn) return;
            gamePlayer.respawn(
                Number(pendingSpawnSync.x || 0),
                Number(pendingSpawnSync.z || 0)
            );
            var combatApi = playerCombatApi();
            if (combatApi && combatApi.setInvulnTimer) {
                combatApi.setInvulnTimer(pendingSpawnSync.kind === 'respawn' ? 1.0 : 0.6);
            }
            if (pendingSpawnSync.kind === 'initial' && state && state.setInitialSpawnApplied) {
                state.setInitialSpawnApplied(true);
            }
            if (state && state.setPendingSpawnSync) {
                state.setPendingSpawnSync(null);
            }
        }

        function pointForEntityId(entityId, translateY, outPoint) {
            if (!entityId) return null;
            var state = netState();
            var entitiesApi = GameNetEntities();

            if (state && state.getSelfId && entityId === state.getSelfId()) {
                var gamePlayer = playerApi();
                var selfPos = gamePlayer && gamePlayer.getPosition ? gamePlayer.getPosition(selfPointScratch) : null;
                if (!selfPos) return null;
                return setPoint(outPoint, selfPos.x, translateY ? translateY(selfPos.y) : selfPos.y, selfPos.z);
            }

            var renderMap = entitiesApi && entitiesApi.getRenderMap ? entitiesApi.getRenderMap() : null;
            var render = renderMap ? renderMap.get(entityId) : null;
            if (!render || !render.group) return null;
            return setPoint(
                outPoint,
                render.group.position.x,
                translateY ? translateY(render.group.position.y) : render.group.position.y,
                render.group.position.z
            );
        }

        function damagePointForEntityId(entityId, outPoint) {
            return pointForEntityId(entityId, damagePointY, outPoint);
        }

        function markerPointForEntityId(entityId, outPoint) {
            return pointForEntityId(entityId, markerPointY, outPoint);
        }

        function getRenderCoreWorldPosition(render, outVec3) {
            if (!render) return null;
            var out = outVec3 || renderCoreWorldPosScratch;
            if (render.actorVisual && render.actorVisual.getCoreWorldPosition) {
                return render.actorVisual.getCoreWorldPosition(out);
            }
            out.copy(render.group.position);
            out.y += 1.0;
            return out;
        }

        function getChokeVictimStateForEntity(entityId) {
            var timing = connectionTiming();
            var state = netState();
            var entitiesApi = GameNetEntities();
            var abilityFxView = abilityFxApi();
            var emptyState = abilityFxView && abilityFxView.emptyChokeVictimState
                ? abilityFxView.emptyChokeVictimState()
                : { lift: 0, liftHeight: 0, startedAt: 0, endsAt: 0 };
            function withLocalTimestamps(nextState) {
                if (!nextState) return emptyState;
                return {
                    lift: Number(nextState.lift || 0),
                    liftHeight: Number(nextState.liftHeight || 0),
                    startedAt: timing && timing.toLocalClockTime ? timing.toLocalClockTime(nextState.startedAt) : Number(nextState.startedAt || 0),
                    endsAt: timing && timing.toLocalClockTime ? timing.toLocalClockTime(nextState.endsAt) : Number(nextState.endsAt || 0)
                };
            }
            if (!entityId) return emptyState;
            var now = timing && timing.authoritativeNowMs ? timing.authoritativeNowMs() : Date.now();
            var selfState = state && state.getSelfState ? state.getSelfState() : null;
            var selfFx = abilityFxView && abilityFxView.readAbilityFx
                ? abilityFxView.readAbilityFx(selfState)
                : (selfState && selfState.abilityFx ? selfState.abilityFx : null);
            var selfChokeVictim = selfFx && selfFx.chokeVictim ? selfFx.chokeVictim : null;
            if (selfState && selfState.id === entityId && selfChokeVictim && selfChokeVictim.endsAt > now) {
                return abilityFxView && abilityFxView.toChokeVictimVisualState
                    ? withLocalTimestamps(abilityFxView.toChokeVictimVisualState(selfChokeVictim, now))
                    : emptyState;
            }
            var renderMap = entitiesApi && entitiesApi.getRenderMap ? entitiesApi.getRenderMap() : null;
            var render = renderMap ? renderMap.get(entityId) : null;
            if (render && render.chokeVictimState && render.chokeVictimState.endsAt > now) {
                return abilityFxView && abilityFxView.toChokeVictimVisualState
                    ? withLocalTimestamps(abilityFxView.toChokeVictimVisualState(render.chokeVictimState, now))
                    : emptyState;
            }
            return emptyState;
        }

        return {
            flushPendingWeaponLoadout: flushPendingWeaponLoadout,
            clearRemoteWorldState: clearRemoteWorldState,
            applyPendingSpawnSync: applyPendingSpawnSync,
            damagePointForEntityId: damagePointForEntityId,
            markerPointForEntityId: markerPointForEntityId,
            getRenderCoreWorldPosition: getRenderCoreWorldPosition,
            getChokeVictimStateForEntity: getChokeVictimStateForEntity
        };
    };

    runtime.GameNetEffects = GameNetEffects;
})();
