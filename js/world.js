/**
 * world.js - Ground plane, cover structures, lighting
 * Loaded as global: window.GameWorld
 */
(function () {
    'use strict';

    var GameWorld = {};

    // Array of solid meshes for raycast collision
    var collidables = [];

    /**
     * Create the game world: ground, structures, lighting
     * @param {THREE.Scene} scene
     */
    GameWorld.create = function (scene) {
        collidables = [];
        // --- Ground plane ---
        var groundGeo = new THREE.PlaneGeometry(50, 50);
        var groundMat = new THREE.MeshLambertMaterial({ color: 0x3a7d3a }); // grass green
        var ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.set(25, 0, 25);
        ground.receiveShadow = true;
        scene.add(ground);

        // --- Grid pattern on ground for visual reference ---
        var gridHelper = new THREE.GridHelper(50, 50, 0x2a5d2a, 0x2a5d2a);
        gridHelper.position.set(25, 0.01, 25);
        scene.add(gridHelper);

        // --- Cover structures (Minecraft-style blocks) ---
        var blockMat = new THREE.MeshLambertMaterial({ color: 0x8B7355 }); // brown/wood
        var stoneMat = new THREE.MeshLambertMaterial({ color: 0x888888 }); // stone
        var brickMat = new THREE.MeshLambertMaterial({ color: 0x994444 }); // brick red

        // Helper: create a block (also stores in collidables for raycasting)
        function addBlock(x, y, z, w, h, d, material) {
            var geo = new THREE.BoxGeometry(w, h, d);
            var mesh = new THREE.Mesh(geo, material);
            mesh.position.set(x, y, z);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            scene.add(mesh);
            collidables.push(mesh);
            return mesh;
        }

        // Wall segments scattered around
        // Central structure
        addBlock(25, 1.5, 25, 4, 3, 1, stoneMat);
        addBlock(25, 1.5, 27, 1, 3, 3, stoneMat);
        addBlock(25, 1.5, 23, 1, 3, 3, stoneMat);

        // Corner structures
        addBlock(10, 1, 10, 3, 2, 3, blockMat);
        addBlock(10, 3, 10, 1, 2, 1, blockMat); // tower part

        addBlock(40, 1, 10, 3, 2, 3, brickMat);
        addBlock(40, 3, 10, 1, 2, 1, brickMat);

        addBlock(10, 1, 40, 3, 2, 3, brickMat);
        addBlock(10, 3, 40, 1, 2, 1, brickMat);

        addBlock(40, 1, 40, 3, 2, 3, blockMat);
        addBlock(40, 3, 40, 1, 2, 1, blockMat);

        // Walls / cover
        addBlock(20, 1, 15, 6, 2, 1, stoneMat);
        addBlock(30, 1, 35, 6, 2, 1, stoneMat);
        addBlock(15, 1, 30, 1, 2, 6, blockMat);
        addBlock(35, 1, 20, 1, 2, 6, blockMat);

        // Scattered single blocks
        addBlock(8, 0.5, 25, 1, 1, 1, blockMat);
        addBlock(42, 0.5, 25, 1, 1, 1, blockMat);
        addBlock(25, 0.5, 8, 1, 1, 1, stoneMat);
        addBlock(25, 0.5, 42, 1, 1, 1, stoneMat);

        // More cover variety
        addBlock(18, 1, 22, 2, 2, 2, brickMat);
        addBlock(32, 1, 28, 2, 2, 2, brickMat);
        addBlock(22, 1, 38, 2, 2, 2, stoneMat);
        addBlock(28, 1, 12, 2, 2, 2, stoneMat);

        // --- Lighting ---
        // Ambient light for base illumination
        var ambientLight = new THREE.AmbientLight(0x606060, 1.0);
        scene.add(ambientLight);

        // Directional light (sun)
        var dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
        dirLight.position.set(30, 50, 30);
        dirLight.castShadow = false; // skip shadows for performance in file:// context
        scene.add(dirLight);

        // Hemisphere light for nicer sky/ground coloring
        var hemiLight = new THREE.HemisphereLight(0x87CEEB, 0x3a7d3a, 0.5);
        scene.add(hemiLight);

        // --- Sky color ---
        scene.background = new THREE.Color(0x87CEEB);

        // --- Fog for depth ---
        scene.fog = new THREE.Fog(0x87CEEB, 30, 60);
    };

    /**
     * Get array of solid world meshes for raycast collision checks
     * @returns {THREE.Mesh[]}
     */
    GameWorld.getCollidables = function () {
        return collidables;
    };

    window.GameWorld = GameWorld;
})();
