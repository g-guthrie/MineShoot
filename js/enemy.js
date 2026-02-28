/**
 * enemy.js - Blocky humanoid enemies, hitboxes 2x size, AI wandering, health
 * Loaded as global: window.GameEnemy
 */
(function () {
    'use strict';

    var GameEnemy = {};

    // Array of all enemy objects
    var enemies = [];

    // Array of hitbox meshes for raycasting (only alive enemies)
    var hitboxArray = [];

    // Show hitbox wireframes?
    var hitboxVisible = false;

    // Skin colors for enemy variety
    var skinColors = [0x44aa44, 0xaa4444, 0x4444aa, 0xaa44aa, 0xaaaa44, 0x44aaaa, 0xff8800, 0x8800ff];

    /**
     * Create a blocky humanoid visual model
     * @param {number} color - hex color
     * @returns {THREE.Group}
     */
    function createHumanoidModel(color) {
        var group = new THREE.Group();
        var mat = new THREE.MeshLambertMaterial({ color: color });
        var darkMat = new THREE.MeshLambertMaterial({ color: 0x333333 });

        // Body (0.8 x 1.0 x 0.5)
        var bodyGeo = new THREE.BoxGeometry(0.8, 1.0, 0.5);
        var body = new THREE.Mesh(bodyGeo, mat);
        body.position.y = 0.5; // center of body at y=0.5 relative to group center
        group.add(body);

        // Head (0.5 x 0.5 x 0.5)
        var headGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
        var head = new THREE.Mesh(headGeo, mat);
        head.position.y = 1.25;
        group.add(head);

        // Eyes
        var eyeGeo = new THREE.BoxGeometry(0.12, 0.08, 0.1);
        var eyeL = new THREE.Mesh(eyeGeo, darkMat);
        eyeL.position.set(-0.12, 1.3, 0.26);
        group.add(eyeL);
        var eyeR = new THREE.Mesh(eyeGeo, darkMat);
        eyeR.position.set(0.12, 1.3, 0.26);
        group.add(eyeR);

        // Left arm (0.25 x 0.8 x 0.25)
        var armGeo = new THREE.BoxGeometry(0.25, 0.8, 0.25);
        var armL = new THREE.Mesh(armGeo, mat);
        armL.position.set(-0.525, 0.5, 0);
        group.add(armL);

        // Right arm
        var armR = new THREE.Mesh(armGeo, mat);
        armR.position.set(0.525, 0.5, 0);
        group.add(armR);

        // Left leg (0.3 x 0.8 x 0.3)
        var legGeo = new THREE.BoxGeometry(0.3, 0.8, 0.3);
        var legL = new THREE.Mesh(legGeo, darkMat);
        legL.position.set(-0.2, -0.4, 0);
        group.add(legL);

        // Right leg
        var legR = new THREE.Mesh(legGeo, darkMat);
        legR.position.set(0.2, -0.4, 0);
        group.add(legR);

        // Store references for hit flash
        group.userData.bodyParts = [body, head, armL, armR, legL, legR];
        group.userData.originalColor = color;

        return group;
    }

    /**
     * Create a single enemy
     * @param {THREE.Scene} scene
     * @param {number} index
     * @returns {Object} enemy data
     */
    function createEnemy(scene, index) {
        var color = skinColors[index % skinColors.length];

        // Main group for the whole enemy
        var group = new THREE.Group();

        // Visual model
        var visual = createHumanoidModel(color);
        // Position visual so feet are at y=0 of group, model center roughly at y=1
        visual.position.y = 1.0;
        group.add(visual);

        // Hitbox mesh: 2x4x2 (double the ~1x2x1 visual), invisible but raycastable
        var hitboxGeo = new THREE.BoxGeometry(2, 4, 2);
        var hitboxMat = new THREE.MeshBasicMaterial({
            transparent: true,
            opacity: 0,
            wireframe: true,
            color: 0xff0000
        });
        var hitbox = new THREE.Mesh(hitboxGeo, hitboxMat);
        hitbox.position.y = 2.0; // center hitbox at 2.0 (covers 0 to 4 height)
        hitbox.visible = true; // must be true for raycaster
        group.add(hitbox);

        // Random spawn position
        var spawnX = 5 + Math.random() * 40;
        var spawnZ = 5 + Math.random() * 40;
        group.position.set(spawnX, 0, spawnZ);

        scene.add(group);

        // Enemy state object
        var enemy = {
            group: group,
            visual: visual,
            hitbox: hitbox,
            hp: 50,
            maxHp: 50,
            alive: true,
            index: index,
            color: color,

            // AI state
            aiState: 'WANDER', // 'WANDER' or 'PAUSE'
            aiTimer: 0,
            aiDuration: 0,
            wanderDir: new THREE.Vector3(),
            wanderSpeed: 0,

            // Hit flash
            flashTimer: 0,
            isFlashing: false,

            // Respawn
            respawnTimer: 0
        };

        // Store reference from hitbox to enemy for identification
        hitbox.userData.enemyIndex = index;
        hitbox.userData.enemyRef = enemy;

        // Start AI
        startWander(enemy);

        return enemy;
    }

    /**
     * Start wandering behavior
     */
    function startWander(enemy) {
        enemy.aiState = 'WANDER';
        var angle = Math.random() * Math.PI * 2;
        enemy.wanderSpeed = 1 + Math.random(); // 1-2 units/sec
        enemy.wanderDir.set(Math.cos(angle), 0, Math.sin(angle));
        enemy.aiDuration = 2 + Math.random() * 2; // 2-4 seconds
        enemy.aiTimer = 0;
    }

    /**
     * Start pause behavior
     */
    function startPause(enemy) {
        enemy.aiState = 'PAUSE';
        enemy.aiDuration = 1 + Math.random(); // 1-2 seconds
        enemy.aiTimer = 0;
    }

    /**
     * Update AI for an enemy
     */
    function updateAI(enemy, dt) {
        if (!enemy.alive) return;

        enemy.aiTimer += dt;

        if (enemy.aiState === 'WANDER') {
            // Move in wander direction
            var pos = enemy.group.position;
            pos.x += enemy.wanderDir.x * enemy.wanderSpeed * dt;
            pos.z += enemy.wanderDir.z * enemy.wanderSpeed * dt;

            // Clamp to world bounds (keep within 2-48 to stay off edges)
            var bounced = false;
            if (pos.x < 2)  { pos.x = 2;  enemy.wanderDir.x = Math.abs(enemy.wanderDir.x); bounced = true; }
            if (pos.x > 48) { pos.x = 48; enemy.wanderDir.x = -Math.abs(enemy.wanderDir.x); bounced = true; }
            if (pos.z < 2)  { pos.z = 2;  enemy.wanderDir.z = Math.abs(enemy.wanderDir.z); bounced = true; }
            if (pos.z > 48) { pos.z = 48; enemy.wanderDir.z = -Math.abs(enemy.wanderDir.z); bounced = true; }

            // Face movement direction
            var facing = Math.atan2(enemy.wanderDir.x, enemy.wanderDir.z);
            enemy.visual.rotation.y = facing;

            // Time to switch?
            if (enemy.aiTimer >= enemy.aiDuration) {
                startPause(enemy);
            }
        } else if (enemy.aiState === 'PAUSE') {
            // Just stand still
            if (enemy.aiTimer >= enemy.aiDuration) {
                startWander(enemy);
            }
        }
    }

    /**
     * Update hit flash effect
     */
    function updateFlash(enemy, dt) {
        if (!enemy.isFlashing) return;

        enemy.flashTimer -= dt;
        if (enemy.flashTimer <= 0) {
            // Restore original colors
            var parts = enemy.visual.userData.bodyParts;
            var origColor = enemy.visual.userData.originalColor;
            if (parts) {
                for (var i = 0; i < parts.length; i++) {
                    parts[i].material.color.setHex(
                        i >= 4 ? 0x333333 : origColor // legs/dark parts vs body parts
                    );
                    parts[i].material.emissive.setHex(0x000000);
                }
            }
            enemy.isFlashing = false;
        }
    }

    // ---- Public API ----

    /**
     * Initialize the enemy system, spawn enemies
     * @param {THREE.Scene} scene
     * @param {number} count - number of enemies to spawn
     */
    GameEnemy.init = function (scene, count) {
        enemies = [];
        hitboxArray = [];
        count = count || 8;

        for (var i = 0; i < count; i++) {
            var enemy = createEnemy(scene, i);
            enemies.push(enemy);
            hitboxArray.push(enemy.hitbox);
        }
    };

    /**
     * Update all enemies (AI, flash, respawn)
     * @param {number} dt - delta time
     * @param {THREE.Scene} scene
     */
    GameEnemy.update = function (dt, scene) {
        for (var i = 0; i < enemies.length; i++) {
            var enemy = enemies[i];

            if (enemy.alive) {
                updateAI(enemy, dt);
                updateFlash(enemy, dt);
            } else {
                // Respawn timer
                enemy.respawnTimer -= dt;
                if (enemy.respawnTimer <= 0) {
                    GameEnemy.respawn(enemy);
                }
            }
        }
    };

    /**
     * Apply damage to an enemy (found via hitbox)
     * @param {THREE.Mesh} hitboxMesh - the hitbox that was hit
     * @param {number} damage
     * @returns {Object} { enemy, killed, hitPoint }
     */
    GameEnemy.damage = function (hitboxMesh, damage) {
        var enemy = hitboxMesh.userData.enemyRef;
        if (!enemy || !enemy.alive) return null;

        enemy.hp -= damage;

        // Flash red
        enemy.isFlashing = true;
        enemy.flashTimer = 0.15;
        var parts = enemy.visual.userData.bodyParts;
        if (parts) {
            for (var i = 0; i < parts.length; i++) {
                parts[i].material.color.setHex(0xff0000);
                parts[i].material.emissive.setHex(0x440000);
            }
        }

        var killed = false;
        if (enemy.hp <= 0) {
            enemy.hp = 0;
            killed = true;
            GameEnemy.kill(enemy);
        }

        return { enemy: enemy, killed: killed };
    };

    /**
     * Kill an enemy
     */
    GameEnemy.kill = function (enemy) {
        enemy.alive = false;
        enemy.group.visible = false;

        // Remove hitbox from raycasting array immediately
        var idx = hitboxArray.indexOf(enemy.hitbox);
        if (idx !== -1) {
            hitboxArray.splice(idx, 1);
        }

        // Start respawn timer
        enemy.respawnTimer = 5.0;
    };

    /**
     * Respawn an enemy
     */
    GameEnemy.respawn = function (enemy) {
        enemy.alive = true;
        enemy.hp = enemy.maxHp;

        // Random new position
        enemy.group.position.set(
            5 + Math.random() * 40,
            0,
            5 + Math.random() * 40
        );
        enemy.group.visible = true;

        // Restore colors
        var parts = enemy.visual.userData.bodyParts;
        var origColor = enemy.visual.userData.originalColor;
        if (parts) {
            for (var i = 0; i < parts.length; i++) {
                parts[i].material.color.setHex(i >= 4 ? 0x333333 : origColor);
                parts[i].material.emissive.setHex(0x000000);
            }
        }
        enemy.isFlashing = false;

        // Add hitbox back to array
        hitboxArray.push(enemy.hitbox);

        // Restart AI
        startWander(enemy);
    };

    /**
     * Get the hitbox array (for raycasting)
     * @returns {THREE.Mesh[]}
     */
    GameEnemy.getHitboxArray = function () {
        return hitboxArray;
    };

    /**
     * Get all enemies
     */
    GameEnemy.getEnemies = function () {
        return enemies;
    };

    /**
     * Toggle hitbox wireframe visibility (press H)
     */
    GameEnemy.toggleHitboxVisibility = function () {
        hitboxVisible = !hitboxVisible;
        for (var i = 0; i < enemies.length; i++) {
            var mat = enemies[i].hitbox.material;
            mat.opacity = hitboxVisible ? 0.3 : 0;
        }
        return hitboxVisible;
    };

    /**
     * Get hitbox visibility state
     */
    GameEnemy.isHitboxVisible = function () {
        return hitboxVisible;
    };

    window.GameEnemy = GameEnemy;
})();
