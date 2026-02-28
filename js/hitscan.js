/**
 * hitscan.js - Raycasting against hitbox meshes only, fire rate cooldown
 * Loaded as global: window.GameHitscan
 */
(function () {
    'use strict';

    var GameHitscan = {};

    var raycaster = new THREE.Raycaster();
    var screenCenter = new THREE.Vector2(0, 0);

    // Fire rate: 333ms cooldown (3 shots per second)
    var FIRE_COOLDOWN = 333; // ms
    var DAMAGE_PER_HIT = 25;
    var lastFireTime = 0;

    /**
     * Attempt to fire a hitscan shot
     * @param {THREE.Camera} camera
     * @param {Function} onHit - callback(hitboxMesh, hitPoint, distance)
     * @param {Function} onMiss - callback()
     * @returns {boolean} whether a shot was fired
     */
    GameHitscan.fire = function (camera, onHit, onMiss) {
        var now = performance.now();

        // Check cooldown
        if (now - lastFireTime < FIRE_COOLDOWN) {
            return false;
        }

        lastFireTime = now;

        // Set raycaster from camera center
        raycaster.setFromCamera(screenCenter, camera);

        // Only test against hitbox array!
        var hitboxes = window.GameEnemy.getHitboxArray();
        var intersects = raycaster.intersectObjects(hitboxes, false);

        if (intersects.length > 0) {
            var hit = intersects[0];
            if (onHit) {
                onHit(hit.object, hit.point, hit.distance);
            }
        } else {
            if (onMiss) {
                onMiss();
            }
        }

        return true;
    };

    /**
     * Get damage per hit
     */
    GameHitscan.getDamage = function () {
        return DAMAGE_PER_HIT;
    };

    /**
     * Get fire cooldown in ms
     */
    GameHitscan.getCooldown = function () {
        return FIRE_COOLDOWN;
    };

    /**
     * Check if weapon is ready to fire
     */
    GameHitscan.canFire = function () {
        return (performance.now() - lastFireTime) >= FIRE_COOLDOWN;
    };

    /**
     * Get time until next shot is ready (0 if ready)
     */
    GameHitscan.cooldownRemaining = function () {
        var elapsed = performance.now() - lastFireTime;
        return Math.max(0, FIRE_COOLDOWN - elapsed);
    };

    window.GameHitscan = GameHitscan;
})();
