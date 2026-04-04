/**
 * network-snapshot-apply.js - Snapshot application helpers extracted from network.js
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameNetNetworkSnapshotApply
 */
(function () {
    'use strict';

    var runtime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    var GameNetNetworkSnapshotApply = {};

    function isMapLike(value) {
        return !!value &&
            typeof value.get === 'function' &&
            typeof value.set === 'function' &&
            typeof value.has === 'function' &&
            typeof value.forEach === 'function';
    }

    function readFlag(state, key) {
        if (!state) return false;
        if (typeof state[key] === 'function') return !!state[key]();
        return !!state[key];
    }

    function getRemoteFrameCollector(state) {
        if (!state) return null;
        if (typeof state.getRemoteFrameCollector === 'function') {
            return state.getRemoteFrameCollector();
        }
        return state.remoteFrameCollector || null;
    }

    function setRemoteFrameCollector(state, value) {
        if (!state) return value;
        if (typeof state.setRemoteFrameCollector === 'function') {
            state.setRemoteFrameCollector(value);
            return value;
        }
        state.remoteFrameCollector = value;
        return value;
    }

    function cloneSnapshotValue(state, value) {
        var protocol = state && state.protocol ? state.protocol : null;
        if (protocol && typeof protocol.cloneSnapshotValue === 'function') {
            return protocol.cloneSnapshotValue(value);
        }
        return value && typeof value === 'object'
            ? JSON.parse(JSON.stringify(value))
            : value;
    }

    function applySnapshotEntityPatch(state, baseEntity, patch) {
        var protocol = state && state.protocol ? state.protocol : null;
        if (protocol && typeof protocol.applySnapshotEntityPatch === 'function') {
            return protocol.applySnapshotEntityPatch(baseEntity, patch);
        }
        var base = baseEntity && typeof baseEntity === 'object' ? cloneSnapshotValue(state, baseEntity) : {};
        var nextPatch = patch && typeof patch === 'object' ? patch : null;
        if (!nextPatch || !nextPatch.id) return null;
        base.id = String(nextPatch.id);
        for (var key in nextPatch) {
            if (!Object.prototype.hasOwnProperty.call(nextPatch, key) || key === 'id') continue;
            base[key] = cloneSnapshotValue(state, nextPatch[key]);
        }
        return base;
    }

    function rememberSnapshotBaseline(state, snapshotSeq) {
        var netState = state && state.netState ? state.netState : null;
        if (!netState || !(Number(snapshotSeq || 0) > 0) || !netState.rememberSnapshotBaseline) return;
        netState.rememberSnapshotBaseline(snapshotSeq, netState.getSnapshotMap());
        if (netState.setSnapshotAckSeq) {
            netState.setSnapshotAckSeq(snapshotSeq);
        }
    }

    function removeMissingRemoteVisuals(state, nextMap) {
        var gameNetEntities = state && state.GameNetEntities ? state.GameNetEntities : null;
        var netState = state && state.netState ? state.netState : null;
        if (!gameNetEntities || !netState || !gameNetEntities.getRenderMap) return;
        var renderMap = gameNetEntities.getRenderMap();
        var snapshotMap = isMapLike(nextMap) ? nextMap : (netState.getSnapshotMap ? netState.getSnapshotMap() : null);
        if (!isMapLike(snapshotMap)) return;
        var toRemove = [];
        renderMap.forEach(function (_value, id) {
            if (!snapshotMap.has(id)) toRemove.push(id);
        });
        for (var i = 0; i < toRemove.length; i++) {
            gameNetEntities.removeRemoteVisual(toRemove[i]);
        }
    }

    function updateRemoteFromSnapshot(state, entity, snapshotMeta) {
        if (!state || !state.sceneRef) return entity;
        if (typeof state.pendingSelfWeaponLoadout === 'function') {
            entity = state.pendingSelfWeaponLoadout(entity);
        }
        if (typeof state.translateSelfEntryState === 'function') {
            entity = state.translateSelfEntryState(entity);
        }
        if (!entity || !entity.id) return entity;

        var netState = state.netState || null;
        var connectionTiming = state.connectionTiming || null;
        var joinState = state.joinState || null;
        var gameNetEntities = state.GameNetEntities || null;
        var selfId = netState && netState.getSelfId ? netState.getSelfId() : null;

        if (entity.id === selfId) {
            if (connectionTiming && connectionTiming.shouldAcceptSelfSnapshot && !connectionTiming.shouldAcceptSelfSnapshot(entity, snapshotMeta)) {
                return entity;
            }
            if (netState && netState.setSelfState) {
                netState.setSelfState(entity);
            }
            if (joinState && joinState.resolveJoinOnSelfSnapshot) {
                joinState.resolveJoinOnSelfSnapshot(entity.id);
            }
            if (connectionTiming && connectionTiming.noteAcceptedSelfSnapshot) {
                var acceptance = connectionTiming.noteAcceptedSelfSnapshot(entity, snapshotMeta) || {};
                if (acceptance.ackSeq > 0 && netState && netState.ackInputSeq) {
                    netState.ackInputSeq(acceptance.ackSeq);
                }
            }
            if (
                netState &&
                (!netState.getInitialSpawnApplied || !netState.getInitialSpawnApplied()) &&
                typeof entity.x === 'number' &&
                typeof entity.z === 'number' &&
                netState.setPendingSpawnSync
            ) {
                netState.setPendingSpawnSync({
                    x: Number(entity.x || 0),
                    z: Number(entity.z || 0),
                    executeAt: Date.now(),
                    kind: 'initial'
                });
            }
            return entity;
        }

        if (readFlag(state, 'remoteReceiveJitterBufferEnabled')) {
            var collector = getRemoteFrameCollector(state);
            if (collector && Array.isArray(collector.entities)) {
                collector.entities.push(cloneSnapshotValue(state, entity));
                return entity;
            }
        }

        if (netState && netState.recordRemoteSnapshotEntity) {
            netState.recordRemoteSnapshotEntity(entity.id, entity, snapshotMeta && snapshotMeta.serverTime);
        }
        if (gameNetEntities && gameNetEntities.updateFromSnapshot) {
            gameNetEntities.updateFromSnapshot(entity, snapshotMeta);
        }
        return entity;
    }

    function decodeSnapshotEntities(state, entities, opts) {
        opts = opts || {};
        var patches = Array.isArray(opts.entityPatches) ? opts.entityPatches : [];
        if (!(readFlag(state, 'snapshotDeltaCompressionEnabled') && opts.delta && patches.length > 0)) {
            return Array.isArray(entities) ? entities : [];
        }
        var netState = state && state.netState ? state.netState : null;
        var baseline = netState && netState.getSnapshotBaseline
            ? netState.getSnapshotBaseline(Math.max(0, Number(opts.baseSnapshotSeq || 0)))
            : null;
        if (!isMapLike(baseline)) return null;

        var out = [];
        for (var i = 0; i < patches.length; i++) {
            var patch = patches[i];
            if (!patch || !patch.id) return null;
            var entity = applySnapshotEntityPatch(state, baseline.get(String(patch.id || '')) || null, patch);
            if (!entity || !entity.id) return null;
            out.push(entity);
        }
        return out;
    }

    function applySnapshot(state, entities, projectiles, fireZones, opts) {
        opts = opts || {};
        var netState = state && state.netState ? state.netState : null;
        var connectionTiming = state && state.connectionTiming ? state.connectionTiming : null;
        var gameNetEntities = state && state.GameNetEntities ? state.GameNetEntities : null;
        var snapshotHelper = state && state.snapshotHelper ? state.snapshotHelper : null;

        var shouldValidateSnapshotOrder = Number(opts.snapshotSeq || 0) > 0 || Number(opts.serverTime || 0) > 0;
        if (
            shouldValidateSnapshotOrder &&
            connectionTiming &&
            connectionTiming.canAcceptSnapshotTiming &&
            !connectionTiming.canAcceptSnapshotTiming(opts)
        ) {
            return null;
        }

        var decodedEntities = decodeSnapshotEntities(state, entities, opts);
        if (decodedEntities === null) {
            return null;
        }

        var acceptedSnapshot = connectionTiming && connectionTiming.updateSnapshotTiming
            ? connectionTiming.updateSnapshotTiming(opts)
            : true;
        if (shouldValidateSnapshotOrder && !acceptedSnapshot) return null;

        if (netState && netState.recordRemoteSnapshotTiming) {
            netState.recordRemoteSnapshotTiming(opts.serverTime, opts.receivedAt, opts.snapshotSeq);
        }

        if (readFlag(state, 'remoteReceiveJitterBufferEnabled')) {
            setRemoteFrameCollector(state, {
                delta: !!opts.delta,
                snapshotSeq: Math.max(0, Number(opts.snapshotSeq || 0)),
                serverTime: Number(opts.serverTime || 0),
                receivedAt: Number(opts.receivedAt || Date.now()),
                entities: [],
                removedEntityIds: Array.isArray(opts.removedEntityIds) ? opts.removedEntityIds.slice() : [],
                projectiles: projectiles !== undefined ? cloneSnapshotValue(state, projectiles) : undefined,
                fireZones: fireZones !== undefined ? cloneSnapshotValue(state, fireZones) : undefined
            });
        }

        if (snapshotHelper && typeof snapshotHelper.applySnapshot === 'function') {
            snapshotHelper.applySnapshot(decodedEntities, projectiles, fireZones, opts);
            var helperCollector = getRemoteFrameCollector(state);
            if (readFlag(state, 'remoteReceiveJitterBufferEnabled') && helperCollector && typeof state.enqueueBufferedRemoteFrame === 'function') {
                state.enqueueBufferedRemoteFrame(helperCollector);
                setRemoteFrameCollector(state, null);
            }
            rememberSnapshotBaseline(state, opts.snapshotSeq);
            return decodedEntities;
        }

        if (!Array.isArray(decodedEntities) || !netState || !gameNetEntities) return decodedEntities;

        if (!opts.delta && netState.clearSnapshotMap) {
            netState.clearSnapshotMap();
        }
        for (var i = 0; i < decodedEntities.length; i++) {
            var entity = decodedEntities[i];
            if (netState.setSnapshotEntity) {
                netState.setSnapshotEntity(entity.id, entity);
            }
            updateRemoteFromSnapshot(state, entity, opts);
        }

        var removedIds = Array.isArray(opts.removedEntityIds) ? opts.removedEntityIds : [];
        for (i = 0; i < removedIds.length; i++) {
            if (netState.deleteSnapshotEntity) {
                netState.deleteSnapshotEntity(removedIds[i]);
            }
            if (gameNetEntities.removeRemoteVisual) {
                gameNetEntities.removeRemoteVisual(removedIds[i]);
            }
        }

        removeMissingRemoteVisuals(state);
        if (netState.pruneRemoteSnapshotTimelines) {
            netState.pruneRemoteSnapshotTimelines(netState.getSnapshotMap());
        }

        var bufferedCollector = getRemoteFrameCollector(state);
        if (readFlag(state, 'remoteReceiveJitterBufferEnabled')) {
            setRemoteFrameCollector(state, null);
        }

        if (projectiles !== undefined && netState.setRemoteProjectileState) {
            netState.setRemoteProjectileState(projectiles);
        }
        if (fireZones !== undefined && netState.setRemoteFireZoneState) {
            netState.setRemoteFireZoneState(fireZones);
        }
        if (
            readFlag(state, 'remoteReceiveJitterBufferEnabled') &&
            bufferedCollector &&
            typeof state.enqueueBufferedRemoteFrame === 'function'
        ) {
            state.enqueueBufferedRemoteFrame(bufferedCollector);
        }

        rememberSnapshotBaseline(state, opts.snapshotSeq);
        return decodedEntities;
    }

    GameNetNetworkSnapshotApply.cloneSnapshotValue = cloneSnapshotValue;
    GameNetNetworkSnapshotApply.applySnapshotEntityPatch = applySnapshotEntityPatch;
    GameNetNetworkSnapshotApply.updateRemoteFromSnapshot = updateRemoteFromSnapshot;
    GameNetNetworkSnapshotApply.decodeSnapshotEntities = decodeSnapshotEntities;
    GameNetNetworkSnapshotApply.applySnapshot = applySnapshot;
    GameNetNetworkSnapshotApply.create = function (state) {
        return {
            cloneSnapshotValue: function (value) {
                return cloneSnapshotValue(state, value);
            },
            applySnapshotEntityPatch: function (baseEntity, patch) {
                return applySnapshotEntityPatch(state, baseEntity, patch);
            },
            updateRemoteFromSnapshot: function (entity, snapshotMeta) {
                return updateRemoteFromSnapshot(state, entity, snapshotMeta);
            },
            decodeSnapshotEntities: function (entities, opts) {
                return decodeSnapshotEntities(state, entities, opts);
            },
            applySnapshot: function (entities, projectiles, fireZones, opts) {
                return applySnapshot(state, entities, projectiles, fireZones, opts);
            }
        };
    };

    runtime.GameNetNetworkSnapshotApply = GameNetNetworkSnapshotApply;
})();
