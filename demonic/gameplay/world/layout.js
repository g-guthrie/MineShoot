(function () {
    'use strict';

    var demonicRuntime = globalThis.__DEMONIC_RUNTIME = globalThis.__DEMONIC_RUNTIME || {};

    function cloneBlock(block) {
        return {
            id: String(block.id || ''),
            x: Number(block.x || 0),
            y: Number(block.y || 0),
            z: Number(block.z || 0),
            width: Number(block.width || 1),
            height: Number(block.height || 1),
            depth: Number(block.depth || 1),
            color: Number(block.color || 0x31223b)
        };
    }

    function createArenaLayout() {
        var blocks = [
            { id: 'center', x: 0, y: 1.2, z: 0, width: 10, height: 2.4, depth: 10, color: 0x31223b },
            { id: 'north-left', x: -22, y: 1.2, z: -18, width: 8, height: 2.4, depth: 6, color: 0x2a2034 },
            { id: 'north-right', x: 22, y: 1.2, z: -18, width: 8, height: 2.4, depth: 6, color: 0x2a2034 },
            { id: 'south-left', x: -22, y: 1.2, z: 20, width: 8, height: 2.4, depth: 6, color: 0x2a2034 },
            { id: 'south-right', x: 22, y: 1.2, z: 20, width: 8, height: 2.4, depth: 6, color: 0x2a2034 },
            { id: 'mid-left', x: -34, y: 1.5, z: 0, width: 5, height: 3, depth: 12, color: 0x382845 },
            { id: 'mid-right', x: 34, y: 1.5, z: 0, width: 5, height: 3, depth: 12, color: 0x382845 }
        ];

        return {
            worldSeed: 'demonic-seed-a',
            groundHeight: 0,
            bounds: {
                min: -50,
                max: 50,
                minX: -50,
                maxX: 50,
                minZ: -50,
                maxZ: 50,
                centerX: 0,
                centerZ: 0
            },
            spawnPoints: [
                { x: 0, z: 34 },
                { x: -26, z: 28 },
                { x: 26, z: 28 },
                { x: 0, z: -34 }
            ],
            threatPoints: [
                { x: 0, z: -42 },
                { x: 22, z: 18 },
                { x: -28, z: 26 }
            ],
            coverBlocks: blocks.map(cloneBlock)
        };
    }

    demonicRuntime.GameWorldLayout = {
        createArenaLayout: createArenaLayout
    };
})();
