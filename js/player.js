/**
 * player.js - WASD movement, camera, jumping, weapon model
 * Loaded as global: window.GamePlayer
 */
(function () {
    'use strict';

    var GamePlayer = {};

    // Player state
    var camera = null;
    var yaw = 0;    // rotation around Y axis (left/right)
    var pitch = 0;  // rotation around X axis (up/down)

    var EYE_HEIGHT = 1.6;
    var MOVE_SPEED = 8;   // units per second
    var JUMP_VELOCITY = 7;
    var GRAVITY = 18;
    var MOUSE_SENSITIVITY = 0.002;
    var PITCH_LIMIT = 89 * (Math.PI / 180); // 89 degrees in radians

    // World bounds
    var WORLD_MIN = 1;
    var WORLD_MAX = 49;

    // Movement state
    var velocityY = 0;
    var posY = EYE_HEIGHT; // camera Y position
    var isGrounded = true;

    // Input state
    var keys = {
        forward: false,
        backward: false,
        left: false,
        right: false,
        jump: false
    };

    // Weapon model
    var weaponGroup = null;

    // Weapon bob
    var bobTimer = 0;
    var isMoving = false;

    /**
     * Create the player camera and weapon
     * @param {THREE.Scene} scene
     * @returns {THREE.PerspectiveCamera}
     */
    GamePlayer.init = function (scene) {
        // Create camera
        camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            100
        );
        camera.rotation.order = 'YXZ';
        camera.position.set(25, EYE_HEIGHT, 45); // Start near edge
        scene.add(camera);

        // Create weapon model (simple blocky rifle)
        weaponGroup = new THREE.Group();

        // Gun body
        var gunBodyGeo = new THREE.BoxGeometry(0.08, 0.08, 0.5);
        var gunMat = new THREE.MeshLambertMaterial({ color: 0x444444 });
        var gunBody = new THREE.Mesh(gunBodyGeo, gunMat);
        gunBody.position.set(0, 0, -0.15);
        weaponGroup.add(gunBody);

        // Gun barrel
        var barrelGeo = new THREE.BoxGeometry(0.04, 0.04, 0.3);
        var barrelMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
        var barrel = new THREE.Mesh(barrelGeo, barrelMat);
        barrel.position.set(0, 0.02, -0.45);
        weaponGroup.add(barrel);

        // Gun stock
        var stockGeo = new THREE.BoxGeometry(0.06, 0.1, 0.15);
        var stockMat = new THREE.MeshLambertMaterial({ color: 0x8B5A2B });
        var stock = new THREE.Mesh(stockGeo, stockMat);
        stock.position.set(0, -0.02, 0.15);
        weaponGroup.add(stock);

        // Gun grip
        var gripGeo = new THREE.BoxGeometry(0.05, 0.12, 0.06);
        var grip = new THREE.Mesh(gripGeo, stockMat);
        grip.position.set(0, -0.1, 0.05);
        weaponGroup.add(grip);

        // Position weapon in bottom-right of view
        weaponGroup.position.set(0.25, -0.2, -0.4);
        weaponGroup.rotation.set(0, 0, 0);

        camera.add(weaponGroup);

        // Set up input handlers
        setupInput();

        return camera;
    };

    /**
     * Set up keyboard and mouse input
     */
    function setupInput() {
        document.addEventListener('keydown', function (e) {
            switch (e.code) {
                case 'KeyW': keys.forward = true; break;
                case 'KeyA': keys.left = true; break;
                case 'KeyS': keys.backward = true; break;
                case 'KeyD': keys.right = true; break;
                case 'Space':
                    keys.jump = true;
                    e.preventDefault();
                    break;
            }
        });

        document.addEventListener('keyup', function (e) {
            switch (e.code) {
                case 'KeyW': keys.forward = false; break;
                case 'KeyA': keys.left = false; break;
                case 'KeyS': keys.backward = false; break;
                case 'KeyD': keys.right = false; break;
                case 'Space': keys.jump = false; break;
            }
        });

        document.addEventListener('mousemove', function (e) {
            if (!document.pointerLockElement) return;

            var dx = e.movementX || 0;
            var dy = e.movementY || 0;

            yaw -= dx * MOUSE_SENSITIVITY;
            pitch -= dy * MOUSE_SENSITIVITY;

            // Clamp pitch to +-89 degrees
            pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch));

            // Apply rotation to camera
            camera.rotation.y = yaw;
            camera.rotation.x = pitch;
        });

        // Handle window resize
        window.addEventListener('resize', function () {
            if (camera) {
                camera.aspect = window.innerWidth / window.innerHeight;
                camera.updateProjectionMatrix();
            }
        });
    }

    /**
     * Update player movement and physics
     * @param {number} dt - delta time in seconds
     */
    GamePlayer.update = function (dt) {
        if (!camera) return;
        if (!document.pointerLockElement) return;

        // Calculate movement vectors from yaw
        var forwardX = -Math.sin(yaw);
        var forwardZ = -Math.cos(yaw);
        var rightX = Math.cos(yaw);
        var rightZ = -Math.sin(yaw);

        // Accumulate movement direction
        var moveX = 0;
        var moveZ = 0;

        if (keys.forward)  { moveX += forwardX; moveZ += forwardZ; }
        if (keys.backward) { moveX -= forwardX; moveZ -= forwardZ; }
        if (keys.left)     { moveX -= rightX;   moveZ -= rightZ; }
        if (keys.right)    { moveX += rightX;   moveZ += rightZ; }

        // Normalize diagonal movement
        var length = Math.sqrt(moveX * moveX + moveZ * moveZ);
        if (length > 0) {
            moveX = (moveX / length) * MOVE_SPEED * dt;
            moveZ = (moveZ / length) * MOVE_SPEED * dt;
            isMoving = true;
        } else {
            isMoving = false;
        }

        // Apply horizontal movement
        camera.position.x += moveX;
        camera.position.z += moveZ;

        // Clamp to world bounds
        camera.position.x = Math.max(WORLD_MIN, Math.min(WORLD_MAX, camera.position.x));
        camera.position.z = Math.max(WORLD_MIN, Math.min(WORLD_MAX, camera.position.z));

        // Jumping & gravity
        if (keys.jump && isGrounded) {
            velocityY = JUMP_VELOCITY;
            isGrounded = false;
        }

        if (!isGrounded) {
            velocityY -= GRAVITY * dt;
            posY += velocityY * dt;

            if (posY <= EYE_HEIGHT) {
                posY = EYE_HEIGHT;
                velocityY = 0;
                isGrounded = true;
            }
        }

        camera.position.y = posY;

        // Weapon bob effect
        if (isMoving && isGrounded) {
            bobTimer += dt * 10;
            weaponGroup.position.y = -0.2 + Math.sin(bobTimer) * 0.015;
            weaponGroup.position.x = 0.25 + Math.cos(bobTimer * 0.5) * 0.008;
        } else {
            // Smoothly return to default position
            weaponGroup.position.y += (-0.2 - weaponGroup.position.y) * dt * 5;
            weaponGroup.position.x += (0.25 - weaponGroup.position.x) * dt * 5;
        }
    };

    /**
     * Play weapon fire animation (recoil kick)
     */
    GamePlayer.fireAnimation = function () {
        if (!weaponGroup) return;
        // Quick recoil: push weapon back, then it returns naturally
        weaponGroup.position.z = -0.35;
        weaponGroup.rotation.x = -0.08;

        // Animate back (will happen in update but we also tween here)
        var startTime = performance.now();
        function recoilReturn() {
            var elapsed = performance.now() - startTime;
            var t = Math.min(1, elapsed / 150); // 150ms return
            weaponGroup.position.z = -0.35 + ((-0.4) - (-0.35)) * t;
            weaponGroup.rotation.x = -0.08 * (1 - t);
            if (t < 1) {
                requestAnimationFrame(recoilReturn);
            }
        }
        requestAnimationFrame(recoilReturn);
    };

    /**
     * Get the camera
     * @returns {THREE.PerspectiveCamera}
     */
    GamePlayer.getCamera = function () {
        return camera;
    };

    /**
     * Get player position
     */
    GamePlayer.getPosition = function () {
        return camera ? camera.position.clone() : new THREE.Vector3();
    };

    /**
     * Get player yaw and pitch
     */
    GamePlayer.getRotation = function () {
        return { yaw: yaw, pitch: pitch };
    };

    window.GamePlayer = GamePlayer;
})();
