/**
 * main.js - Game init, render loop, pointer lock, wires everything together
 * Loaded last. Orchestrates all modules.
 */
(function () {
    'use strict';

    // --- Core Three.js objects ---
    var renderer, scene, clock;
    var camera; // reference from player module

    // --- DOM references ---
    var overlay;

    // --- Game state ---
    var isPlaying = false;
    var playerHP = 100;
    var playerMaxHP = 100;

    // --- Enemy count ---
    var ENEMY_COUNT = 8;

    /**
     * Initialize the game
     */
    function init() {
        // Renderer
        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        document.body.appendChild(renderer.domElement);

        // Scene
        scene = new THREE.Scene();

        // Clock for delta time
        clock = new THREE.Clock();

        // Create world (ground, structures, lighting)
        window.GameWorld.create(scene);

        // Initialize UI
        window.GameUI.init();
        window.GameUI.updateHealth(playerHP, playerMaxHP);

        // Initialize player (camera + weapon)
        camera = window.GamePlayer.init(scene);

        // Initialize enemies
        window.GameEnemy.init(scene, ENEMY_COUNT);

        // Set up pointer lock
        setupPointerLock();

        // Set up shooting
        setupShooting();

        // Set up debug keys
        setupDebugKeys();

        // Handle window resize
        window.addEventListener('resize', function () {
            renderer.setSize(window.innerWidth, window.innerHeight);
        });

        // Start render loop
        animate();
    }

    /**
     * Set up pointer lock for mouse control
     */
    function setupPointerLock() {
        overlay = document.getElementById('overlay');

        // Click overlay to start
        overlay.addEventListener('click', function () {
            document.body.requestPointerLock();
        });

        // Also allow clicking the canvas
        renderer.domElement.addEventListener('click', function () {
            if (!document.pointerLockElement) {
                document.body.requestPointerLock();
            }
        });

        // Pointer lock change events
        document.addEventListener('pointerlockchange', function () {
            if (document.pointerLockElement) {
                // Locked - hide overlay, start playing
                overlay.style.display = 'none';
                isPlaying = true;
            } else {
                // Unlocked - show overlay
                overlay.style.display = 'flex';
                isPlaying = false;
            }
        });
    }

    /**
     * Set up shooting (left click)
     */
    function setupShooting() {
        document.addEventListener('mousedown', function (e) {
            if (e.button !== 0) return; // left click only
            if (!document.pointerLockElement) return;

            // Attempt to fire
            var fired = window.GameHitscan.fire(
                camera,
                // onHit callback
                function (hitboxMesh, hitPoint, distance) {
                    var damage = window.GameHitscan.getDamage();
                    var result = window.GameEnemy.damage(hitboxMesh, damage);

                    if (result) {
                        if (result.killed) {
                            // Kill!
                            window.GameUI.showKillMarker();
                            window.GameUI.addKill();
                            window.GameUI.showDamageNumber(hitPoint, damage, true, camera);
                        } else {
                            // Hit but not killed
                            window.GameUI.showHitMarker();
                            window.GameUI.showDamageNumber(hitPoint, damage, false, camera);
                        }
                    }
                },
                // onMiss callback
                function () {
                    // Could add miss visual/sound here
                }
            );

            if (fired) {
                window.GamePlayer.fireAnimation();
            }
        });
    }

    /**
     * Set up debug keys
     */
    function setupDebugKeys() {
        document.addEventListener('keydown', function (e) {
            if (e.code === 'KeyH') {
                var visible = window.GameEnemy.toggleHitboxVisibility();
                window.GameUI.setDebugInfo(visible ? 'Hitboxes: VISIBLE' : 'Hitboxes: HIDDEN');
                // Clear debug info after 2 seconds
                setTimeout(function () {
                    window.GameUI.setDebugInfo('');
                }, 2000);
            }
        });
    }

    /**
     * Main animation/render loop
     */
    function animate() {
        requestAnimationFrame(animate);

        var dt = clock.getDelta();

        // Cap delta time to prevent huge jumps
        if (dt > 0.1) dt = 0.1;

        // Update player movement
        window.GamePlayer.update(dt);

        // Update enemies (AI, flash effects, respawn timers)
        window.GameEnemy.update(dt, scene);

        // Render
        renderer.render(scene, camera);
    }

    // --- Start the game when DOM is ready ---
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
