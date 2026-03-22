/**
 * throwables-authoritative-sync.js - Authoritative throwable sync and network events.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameThrowablesAuthoritativeSync
 */
(function () {
    'use strict';

    function create(opts) {
        opts = opts || {};
        var impactEventPos = new THREE.Vector3();
        var explosionEventPos = new THREE.Vector3();

        function defs() {
            return opts.getDefs ? opts.getDefs() : {};
        }

        function scene() {
            return opts.getScene ? opts.getScene() : null;
        }

        function inventory() {
            return opts.getInventory ? opts.getInventory() : {};
        }

        function throwableOrder() {
            return opts.getThrowableOrder ? opts.getThrowableOrder() : [];
        }

        function predictedByClientId() {
            return opts.getPredictedByClientId ? opts.getPredictedByClientId() : {};
        }

        function netProjectileMap() {
            return opts.getNetProjectileMap ? opts.getNetProjectileMap() : {};
        }

        function netFireZoneMap() {
            return opts.getNetFireZoneMap ? opts.getNetFireZoneMap() : {};
        }

        function projectiles() {
            return opts.getProjectiles ? opts.getProjectiles() : [];
        }

        function debugTelemetry() {
            return opts.getDebugTelemetry ? opts.getDebugTelemetry() : null;
        }

        function reconcilePredictedAgainstAuthoritative(selfId, projectilesState) {
            var seenByClientThrowId = {};
            for (var i = 0; i < projectilesState.length; i++) {
                var p = projectilesState[i];
                if (!p || p.ownerId !== selfId) continue;
                if (!p.clientThrowId) continue;
                seenByClientThrowId[p.clientThrowId] = true;
            }

            var predictedState = predictedByClientId();
            var projectileState = projectiles();
            var telemetry = debugTelemetry();
            for (var key in seenByClientThrowId) {
                if (!Object.prototype.hasOwnProperty.call(seenByClientThrowId, key)) continue;
                if (predictedState[key]) {
                    predictedState[key].authoritativeSeen = true;
                    delete predictedState[key];
                }
                if (opts.releasePredictedCharge) {
                    opts.releasePredictedCharge(key, false);
                }
                if (telemetry) telemetry.lastReconcileClientThrowId = key;
                for (var j = projectileState.length - 1; j >= 0; j--) {
                    var localP = projectileState[j];
                    if (!localP || localP.clientThrowId !== key) continue;
                    opts.removeProjectile(j);
                }
            }
        }

        function confirmPredictedThrow(clientThrowId, ack) {
            var id = String(clientThrowId || '');
            var predictedState = predictedByClientId();
            if (!id || !predictedState[id]) return false;
            predictedState[id].acked = true;
            predictedState[id].projectileId = String(
                (ack && typeof ack === 'object' && ack.projectileId)
                    ? ack.projectileId
                    : ''
            );
            var telemetry = debugTelemetry();
            if (telemetry) telemetry.lastAckClientThrowId = id;
            return true;
        }

        function rejectPredictedThrow(clientThrowId) {
            var id = String(clientThrowId || '');
            if (!id) return false;
            var telemetry = debugTelemetry();
            if (telemetry) telemetry.lastRejectClientThrowId = id;
            if (opts.releasePredictedCharge) {
                opts.releasePredictedCharge(id, true);
            }
            return !!(opts.removePredictedProjectileByClientThrowId && opts.removePredictedProjectileByClientThrowId(id));
        }

        function setNetworkInventoryState(state) {
            if (!state || typeof state !== 'object') return;
            var inventoryState = inventory();
            var order = throwableOrder();
            for (var i = 0; i < order.length; i++) {
                var id = order[i];
                var src = state[id];
                if (!src || !inventoryState[id]) continue;
                inventoryState[id].charges = Math.max(0, Number(src.charges || 0));
                inventoryState[id].maxCharges = Math.max(1, Number(src.maxCharges || 1));
                inventoryState[id].cooldownRemaining = Math.max(0, Number(src.cooldownRemaining || 0));
            }
        }

        function syncAuthoritativeState(payload, selfId) {
            var sceneRef = scene();
            if (!sceneRef) return;
            payload = payload || {};
            var projectileDefs = defs();
            var projectilesState = Array.isArray(payload.projectiles) ? payload.projectiles : [];
            var fireZonesState = Array.isArray(payload.fireZones) ? payload.fireZones : [];
            var projectileMap = netProjectileMap();
            var fireZoneMap = netFireZoneMap();
            reconcilePredictedAgainstAuthoritative(selfId, projectilesState);

            var seenProjectile = {};
            for (var i = 0; i < projectilesState.length; i++) {
                var p = projectilesState[i];
                if (!p || !p.id || !projectileDefs[p.type]) continue;
                seenProjectile[p.id] = true;
                var entry = projectileMap[p.id];
                if (!entry) {
                    var mesh = opts.createThrowableMesh(p.type);
                    if (!mesh.userData) mesh.userData = {};
                    mesh.userData.projectileType = p.type;
                    sceneRef.add(mesh);
                    entry = {
                        id: p.id,
                        mesh: mesh,
                        type: p.type,
                        velocity: new THREE.Vector3(),
                        targetPosition: new THREE.Vector3(),
                        stuckOffset: new THREE.Vector3(),
                        age: 0,
                        seeded: false
                    };
                    projectileMap[p.id] = entry;
                }
                entry.targetPosition.set(Number(p.x || 0), Number(p.y || 0), Number(p.z || 0));
                entry.velocity.set(Number(p.vx || 0), Number(p.vy || 0), Number(p.vz || 0));
                entry.age = Math.max(0, Number(p.age || 0));
                entry.stickyUntil = Number(p.stickyUntil || 0);
                entry.stuckToTargetId = String(p.stuckToTargetId || '');
                entry.stuckOffset.set(
                    Number(p.stuckOffsetX || 0),
                    Number(p.stuckOffsetY || 0),
                    Number(p.stuckOffsetZ || 0)
                );
                if (!entry.seeded) {
                    entry.mesh.position.copy(entry.targetPosition);
                    entry.seeded = true;
                    opts.orientProjectileVisual(entry.mesh, entry.velocity, entry.age);
                }
            }

            for (var key in projectileMap) {
                if (!Object.prototype.hasOwnProperty.call(projectileMap, key)) continue;
                if (!seenProjectile[key]) opts.removeNetProjectileById(key);
            }

            var seenZone = {};
            for (var z = 0; z < fireZonesState.length; z++) {
                var zoneState = fireZonesState[z];
                if (!zoneState || !zoneState.id) continue;
                seenZone[zoneState.id] = true;
                var zone = fireZoneMap[zoneState.id];
                if (!zone) {
                    var zoneMesh = opts.buildFireZoneMesh(Number(zoneState.radius || (projectileDefs.molotov && projectileDefs.molotov.fireRadius) || 3));
                    zoneMesh.position.set(Number(zoneState.x || 0), Number(zoneState.y || 0) + 0.04, Number(zoneState.z || 0));
                    sceneRef.add(zoneMesh);
                    zone = { id: zoneState.id, mesh: zoneMesh, radius: Number(zoneState.radius || (projectileDefs.molotov && projectileDefs.molotov.fireRadius) || 3) };
                    fireZoneMap[zoneState.id] = zone;
                }
                zone.radius = Number(zoneState.radius || (projectileDefs.molotov && projectileDefs.molotov.fireRadius) || 3);
                zone.mesh.position.set(Number(zoneState.x || 0), Number(zoneState.y || 0) + 0.04, Number(zoneState.z || 0));
                opts.updateFireZoneVisual(zone, Date.now(), 1);
            }

            for (var zoneKey in fireZoneMap) {
                if (!Object.prototype.hasOwnProperty.call(fireZoneMap, zoneKey)) continue;
                if (!seenZone[zoneKey]) opts.removeNetFireZoneById(zoneKey);
            }
        }

        function applyNetworkEvent(event) {
            if (!event || !event.t) return;
            var projectileDefs = defs();
            if (event.t === 'throw_impact') {
                if (event.projectileType !== 'plasma') {
                    if (opts.removePredictedProjectileByAuthoritativeId) {
                        opts.removePredictedProjectileByAuthoritativeId(event.projectileId || '');
                    }
                    if (opts.removeNetProjectileVisual) {
                        opts.removeNetProjectileVisual(event.projectileId || '');
                    }
                }
                var impactPalette = opts.effectPaletteForProjectileType(event.projectileType || event.throwableId || '');
                opts.spawnFlash(
                    impactEventPos.set(Number(event.x || 0), Number(event.y || 0), Number(event.z || 0)),
                    impactPalette.flash,
                    event.projectileType === 'missile' ? 0.14 : 0.1,
                    event.projectileType === 'missile' ? 0.12 : 0.1
                );
                return;
            }
            if (event.t === 'throw_explode') {
                if (opts.removePredictedProjectileByAuthoritativeId) {
                    opts.removePredictedProjectileByAuthoritativeId(event.projectileId || '');
                }
                if (opts.removeNetProjectileVisual) {
                    opts.removeNetProjectileVisual(event.projectileId || '');
                }
                var explosionPalette = opts.effectPaletteForProjectileType(event.projectileType || event.throwableId || '');
                opts.spawnExplosionBurst(
                    explosionEventPos.set(Number(event.x || 0), Number(event.y || 0), Number(event.z || 0)),
                    explosionPalette.explosion,
                    Number(event.radius || (projectileDefs.frag && projectileDefs.frag.radius) || 5.4)
                );
                return;
            }
            if (event.t === 'aoe_end' && event.zoneId) {
                opts.removeNetFireZoneById(event.zoneId);
            }
        }

        return {
            confirmPredictedThrow: confirmPredictedThrow,
            rejectPredictedThrow: rejectPredictedThrow,
            setNetworkInventoryState: setNetworkInventoryState,
            syncAuthoritativeState: syncAuthoritativeState,
            applyNetworkEvent: applyNetworkEvent
        };
    }

    globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    globalThis.__MAYHEM_RUNTIME.GameThrowablesAuthoritativeSync = {
        create: create
    };
})();
