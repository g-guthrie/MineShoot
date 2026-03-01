/**
 * hitscan.js - Player weapons and hitscan logic
 * Loaded as global: window.GameHitscan
 */
(function () {
    'use strict';

    var GameHitscan = {};

    var raycaster = new THREE.Raycaster();
    var screenPoint = new THREE.Vector2(0, 0);

    // Y is positive-down for UI layout consistency.
    var SHOTGUN_PATTERN = [
        [-0.90, -0.90], [0.00, -0.90], [0.90, -0.90],
        [-0.90,  0.00], [-0.35, -0.35], [0.35, 0.35], [0.90, 0.00],
        [-0.90,  0.90], [0.00,  0.90], [0.90, 0.90],
        [-0.45,  0.45], [0.45, -0.45]
    ];
    var SHOTGUN_RETICLE_SIZE_PX = 300;
    var SHOTGUN_RETICLE_REF_DISTANCE = 14;
    var SHOTGUN_RETICLE_THIRD_MIN_SCALE = 0.62;
    var SHOTGUN_RETICLE_THIRD_MAX_SCALE = 0.96;
    var SHOTGUN_RETICLE_POINTS = [];

    for (var i = 0; i < SHOTGUN_PATTERN.length; i++) {
        SHOTGUN_RETICLE_POINTS.push([SHOTGUN_PATTERN[i][0], SHOTGUN_PATTERN[i][1]]);
    }

    var weaponOrder = ['rifle', 'pistol', 'machinegun', 'shotgun', 'sniper'];
    var weapons = {
        rifle: {
            id: 'rifle',
            name: 'Rifle',
            automatic: false,
            cooldown: 190,
            bodyDamage: 36,
            headDamage: 68,
            pellets: 1,
            spreadNdc: 0.0018,
            maxRange: 120
        },
        pistol: {
            id: 'pistol',
            name: 'Pistol',
            automatic: false,
            cooldown: 280,
            bodyDamage: 30,
            headDamage: 56,
            pellets: 1,
            spreadNdc: 0.0032,
            maxRange: 92
        },
        machinegun: {
            id: 'machinegun',
            name: 'Machine Gun',
            automatic: true,
            cooldown: 80,
            bodyDamage: 16,
            headDamage: 30,
            pellets: 1,
            spreadNdc: 0.0078,
            maxRange: 88
        },
        shotgun: {
            id: 'shotgun',
            name: 'Shotgun',
            automatic: false,
            cooldown: 820,
            bodyDamage: 14,
            headDamage: 22,
            pellets: 12,
            spreadNdc: 0,
            maxRange: 42
        },
        sniper: {
            id: 'sniper',
            name: 'Sniper',
            automatic: false,
            cooldown: 1250,
            bodyDamage: 120,
            headDamage: 220,
            pellets: 1,
            spreadNdc: 0.00035,
            maxRange: 190
        }
    };

    var currentWeaponId = 'rifle';
    var lastFireTime = 0;

    function getCombatHitboxes() {
        var out = [];
        if (window.GameEnemy && window.GameEnemy.getHitboxArray) {
            var local = window.GameEnemy.getHitboxArray() || [];
            out = out.concat(local);
        }
        if (window.GameNet && window.GameNet.getHitboxArray) {
            var net = window.GameNet.getHitboxArray() || [];
            out = out.concat(net);
        }
        return out;
    }

    function getCurrentWeaponData() {
        return weapons[currentWeaponId] || weapons.rifle;
    }

    function getDamageForType(weapon, hitType) {
        return hitType === 'head' ? weapon.headDamage : weapon.bodyDamage;
    }

    function applyDistanceFalloff(weapon, damage, distance) {
        if (weapon.id !== 'shotgun') return damage;

        if (distance <= 8) return damage;
        if (distance >= 24) return Math.max(3, Math.round(damage * 0.25));

        var t = (distance - 8) / 16;
        var scale = 1 - (t * 0.75);
        return Math.max(3, Math.round(damage * scale));
    }

    function getPerspectiveMode() {
        if (!window.GamePlayer || !window.GamePlayer.getPerspective) return 'first';
        return window.GamePlayer.getPerspective();
    }

    function getThirdPersonCameraDistance() {
        if (!window.GamePlayer || !window.GamePlayer.getCamera || !window.GamePlayer.getPosition) return null;
        var camera = window.GamePlayer.getCamera();
        var playerPos = window.GamePlayer.getPosition();
        if (!camera || !playerPos || !camera.position || !camera.position.distanceTo) return null;
        return camera.position.distanceTo(playerPos);
    }

    function getShotgunReticleSizePx() {
        var size = SHOTGUN_RETICLE_SIZE_PX;
        if (getPerspectiveMode() !== 'third') return size;

        var cameraDistance = getThirdPersonCameraDistance();
        if (typeof cameraDistance !== 'number' || !isFinite(cameraDistance) || cameraDistance <= 0.001) {
            return size * 0.78;
        }

        // Keep spread feel consistent relative to the player, not just camera distance.
        var scale = SHOTGUN_RETICLE_REF_DISTANCE / (SHOTGUN_RETICLE_REF_DISTANCE + cameraDistance);
        scale = Math.max(SHOTGUN_RETICLE_THIRD_MIN_SCALE, Math.min(SHOTGUN_RETICLE_THIRD_MAX_SCALE, scale));
        return size * scale;
    }

    function getPelletNdcOffset(weapon, pelletIndex) {
        if (weapon.id === 'shotgun') {
            var p = SHOTGUN_PATTERN[pelletIndex % SHOTGUN_PATTERN.length];
            var halfSize = getShotgunReticleSizePx() * 0.5;
            return {
                x: (p[0] * halfSize) / (window.innerWidth * 0.5),
                y: -(p[1] * halfSize) / (window.innerHeight * 0.5)
            };
        }

        return {
            x: (Math.random() * 2 - 1) * weapon.spreadNdc,
            y: (Math.random() * 2 - 1) * weapon.spreadNdc
        };
    }

    function fireSinglePellet(camera, weapon, pelletIndex, onHit) {
        var targetsHitboxes = getCombatHitboxes();
        var worldMeshes = window.GameWorld.getCollidables ? window.GameWorld.getCollidables() : [];
        var allTargets = targetsHitboxes.concat(worldMeshes);
        var ndcOffset = getPelletNdcOffset(weapon, pelletIndex);

        screenPoint.set(ndcOffset.x, ndcOffset.y);
        raycaster.setFromCamera(screenPoint, camera);
        raycaster.far = weapon.maxRange;

        var intersects = raycaster.intersectObjects(allTargets, false);
        if (intersects.length === 0) return false;

        var hit = intersects[0];
        if (targetsHitboxes.indexOf(hit.object) === -1) {
            return false;
        }

        var hitType = hit.object.userData.type || 'body';
        var damage = getDamageForType(weapon, hitType);
        damage = applyDistanceFalloff(weapon, damage, hit.distance);

        if (onHit) {
            onHit(hit.object, hit.point, hit.distance, hitType, damage, weapon);
        }

        return true;
    }

    function castCenter(camera, maxRange) {
        var hitboxes = getCombatHitboxes();
        var worldMeshes = window.GameWorld.getCollidables ? window.GameWorld.getCollidables() : [];
        var allTargets = hitboxes.concat(worldMeshes);
        if (allTargets.length === 0) return null;

        screenPoint.set(0, 0);
        raycaster.setFromCamera(screenPoint, camera);
        raycaster.far = maxRange;

        var hits = raycaster.intersectObjects(allTargets, false);
        if (hits.length === 0) return null;

        for (var i = 0; i < hits.length; i++) {
            var h = hits[i];
            if (hitboxes.indexOf(h.object) !== -1) {
                return {
                    hitbox: h.object,
                    hitType: h.object.userData.type || 'body',
                    targetId: h.object.userData.targetId || '',
                    distance: h.distance,
                    point: h.point
                };
            }
            if (worldMeshes.indexOf(h.object) !== -1) {
                return null;
            }
        }

        return null;
    }

    /**
     * Attempt to fire the current weapon
     * @param {THREE.Camera} camera
     * @param {Function} onHit - callback(hitboxMesh, hitPoint, distance, hitType, damage, weapon)
     * @param {Function} onMiss - callback()
     * @returns {boolean} whether a shot was fired
     */
    GameHitscan.fire = function (camera, onHit, onMiss) {
        var now = performance.now();
        var weapon = getCurrentWeaponData();

        if (now - lastFireTime < weapon.cooldown) {
            return false;
        }

        lastFireTime = now;

        var pellets = weapon.pellets || 1;
        var anyHit = false;
        for (var i = 0; i < pellets; i++) {
            var hit = fireSinglePellet(camera, weapon, i, onHit);
            anyHit = anyHit || hit;
        }

        if (!anyHit && onMiss) {
            onMiss();
        }

        return true;
    };

    GameHitscan.getCurrentWeapon = function () {
        var weapon = getCurrentWeaponData();
        return {
            id: weapon.id,
            name: weapon.name,
            automatic: weapon.automatic,
            cooldown: weapon.cooldown,
            bodyDamage: weapon.bodyDamage,
            headDamage: weapon.headDamage,
            pellets: weapon.pellets,
            spreadNdc: weapon.spreadNdc,
            maxRange: weapon.maxRange
        };
    };

    GameHitscan.getReticleSpec = function (weaponId) {
        var id = weaponId || currentWeaponId;
        if (id !== 'shotgun') return null;

        return {
            type: 'shotgun',
            size: getShotgunReticleSizePx(),
            points: SHOTGUN_RETICLE_POINTS
        };
    };

    GameHitscan.getWeaponOrder = function () {
        return weaponOrder.slice();
    };

    GameHitscan.setWeapon = function (weaponId) {
        if (!weapons[weaponId]) return null;
        currentWeaponId = weaponId;
        return GameHitscan.getCurrentWeapon();
    };

    GameHitscan.cycleWeapon = function (delta) {
        var idx = weaponOrder.indexOf(currentWeaponId);
        if (idx === -1) idx = 0;

        if (delta > 0) {
            idx = (idx + 1) % weaponOrder.length;
        } else {
            idx = (idx - 1 + weaponOrder.length) % weaponOrder.length;
        }

        currentWeaponId = weaponOrder[idx];
        return GameHitscan.getCurrentWeapon();
    };

    GameHitscan.getDamage = function () {
        return getCurrentWeaponData().bodyDamage;
    };

    GameHitscan.getHeadDamage = function () {
        return getCurrentWeaponData().headDamage;
    };

    GameHitscan.getBodyDamage = function () {
        return getCurrentWeaponData().bodyDamage;
    };

    GameHitscan.getCooldown = function () {
        return getCurrentWeaponData().cooldown;
    };

    GameHitscan.canFire = function () {
        var weapon = getCurrentWeaponData();
        return (performance.now() - lastFireTime) >= weapon.cooldown;
    };

    GameHitscan.cooldownRemaining = function () {
        var weapon = getCurrentWeaponData();
        var elapsed = performance.now() - lastFireTime;
        return Math.max(0, weapon.cooldown - elapsed);
    };

    GameHitscan.peekCenterTarget = function (camera, maxRange) {
        var range = (typeof maxRange === 'number' && maxRange > 0) ? maxRange : getCurrentWeaponData().maxRange;
        return castCenter(camera, range);
    };

    window.GameHitscan = GameHitscan;
})();
