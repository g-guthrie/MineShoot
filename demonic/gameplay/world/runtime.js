(function () {
    'use strict';

    var demonicRuntime = globalThis.__DEMONIC_RUNTIME = globalThis.__DEMONIC_RUNTIME || {};

    function create(context) {
        var layoutApi = demonicRuntime.GameWorldLayout || null;
        var boundsApi = demonicRuntime.GameWorldBounds || null;
        var collisionApi = demonicRuntime.GameWorldCollision || null;
        var layout = layoutApi && layoutApi.createArenaLayout ? layoutApi.createArenaLayout(context) : {
            worldSeed: 'demonic-seed-a',
            groundHeight: 0,
            bounds: { min: 0, max: 100, centerX: 50, centerZ: 50 },
            spawnPoints: [{ x: 50, z: 84 }],
            threatPoints: [],
            coverBlocks: []
        };
        var state = {
            modeId: String(context && context.mode && context.mode.id || ''),
            roomId: String(context && context.context && context.context.roomId || ''),
            worldSeed: String(layout.worldSeed || 'demonic-seed-a'),
            groundHeight: Number(layout.groundHeight || 0),
            threatPoints: Array.isArray(layout.threatPoints) ? layout.threatPoints.slice() : [],
            spawnPoints: Array.isArray(layout.spawnPoints) ? layout.spawnPoints.slice() : [],
            coverBlocks: Array.isArray(layout.coverBlocks) ? layout.coverBlocks.slice() : [],
            bounds: layout.bounds || {
                min: 0,
                max: 100,
                centerX: 50,
                centerZ: 50
            }
        };
        var bounds = boundsApi && boundsApi.create ? boundsApi.create(state) : null;
        var collision = collisionApi && collisionApi.create ? collisionApi.create({
            getBoundsApi: function () { return bounds; },
            getGroundHeightAt: function () { return state.groundHeight; },
            playerRadius: 0.35,
            playerHeight: 1.7,
            epsilon: 0.001
        }) : null;

        return {
            update: function (_dt) {},
            getQuery: function () {
                return {
                    getBounds: function () {
                        return bounds && bounds.getBounds ? bounds.getBounds() : null;
                    },
                    getDefaultSpawnPoint: function () {
                        if (state.spawnPoints && state.spawnPoints.length) {
                            return {
                                x: Number(state.spawnPoints[0].x || 0),
                                z: Number(state.spawnPoints[0].z || 0)
                            };
                        }
                        return bounds && bounds.getDefaultSpawnPoint ? bounds.getDefaultSpawnPoint() : { x: 0, z: 0 };
                    },
                    clampHorizontalPosition: function (x, z) {
                        return collision && collision.clampHorizontalPosition
                            ? collision.clampHorizontalPosition(x, z)
                            : { x: Number(x || 0), z: Number(z || 0) };
                    },
                    getGroundHeightAt: function (x, z) {
                        return collision && collision.getGroundHeightAt ? collision.getGroundHeightAt(x, z) : 0;
                    },
                    isBlockedAt: function (x, z, feetY) {
                        return collision && collision.isBlockedAt ? collision.isBlockedAt(x, z, feetY) : false;
                    },
                    findLandingSurfaceY: function (x, z, currentFeetY, nextFeetY) {
                        return collision && collision.findLandingSurfaceY
                            ? collision.findLandingSurfaceY(x, z, currentFeetY, nextFeetY)
                            : 0;
                    },
                    findCeilingY: function (x, z, currentHeadY, nextHeadY) {
                        return collision && collision.findCeilingY
                            ? collision.findCeilingY(x, z, currentHeadY, nextHeadY)
                            : null;
                    }
                };
            },
            getSnapshot: function () {
                var currentBounds = bounds && bounds.getBounds ? bounds.getBounds() : state.bounds;
                return {
                    modeId: String(state.modeId || ''),
                    roomId: String(state.roomId || ''),
                    worldSeed: String(state.worldSeed || ''),
                    groundHeight: Number(state.groundHeight || 0),
                    threatPoints: state.threatPoints.map(function (point) {
                        return {
                            x: Number(point.x || 0),
                            z: Number(point.z || 0)
                        };
                    }),
                    spawnPoints: state.spawnPoints.map(function (point) {
                        return {
                            x: Number(point.x || 0),
                            z: Number(point.z || 0)
                        };
                    }),
                    coverBlocks: state.coverBlocks.map(function (block) {
                        return {
                            id: String(block.id || ''),
                            x: Number(block.x || 0),
                            y: Number(block.y || 0),
                            z: Number(block.z || 0),
                            width: Number(block.width || 0),
                            height: Number(block.height || 0),
                            depth: Number(block.depth || 0),
                            color: Number(block.color || 0)
                        };
                    }),
                    bounds: {
                        min: Number(currentBounds.min || 0),
                        max: Number(currentBounds.max || 0),
                        minX: Number(currentBounds.minX || 0),
                        maxX: Number(currentBounds.maxX || 0),
                        minZ: Number(currentBounds.minZ || 0),
                        maxZ: Number(currentBounds.maxZ || 0),
                        centerX: Number(currentBounds.centerX || 0),
                        centerZ: Number(currentBounds.centerZ || 0)
                    }
                };
            }
        };
    }

    demonicRuntime.GameWorldRuntime = {
        create: create
    };
})();
