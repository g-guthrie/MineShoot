/**
 * hitscan.js - Player weapons and hitscan logic
 * Loaded as global: window.GameHitscan
 */
(function () {
    'use strict';

    var GameHitscan = {};

    var raycaster = new THREE.Raycaster();
    var losRaycaster = new THREE.Raycaster();
    var screenPoint = new THREE.Vector2(0, 0);
    var tmpProjected = new THREE.Vector3();
    var tmpWorld = new THREE.Vector3();
    var plasmaForward = new THREE.Vector3();
    var plasmaMuzzle = new THREE.Vector3();
    var PRIM = globalThis.__GAME_PRIMITIVES__ || {};
    var COMBAT_PRIM = PRIM.combat || {};
    var WEAPON_PRIM = COMBAT_PRIM.weapon_stats || {};
    var PLASMA_PRIM = COMBAT_PRIM.plasma || {};

    function weaponNum(id, key, fallback) {
        var w = WEAPON_PRIM[id] || {};
        var v = w[key];
        return (typeof v === 'number' && isFinite(v)) ? v : fallback;
    }

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
    var PLASMA_RETICLE_SIZE_PX = 220;
    var PLASMA_RETICLE_REF_DISTANCE = 14;
    var PLASMA_RETICLE_THIRD_MIN_SCALE = 0.6;
    var PLASMA_RETICLE_THIRD_MAX_SCALE = 0.98;

    var PLASMA_RANGE = weaponNum('plasma', 'max_range', 24);
    var PLASMA_DAMAGE = weaponNum('plasma', 'body_damage', 15);
    var PLASMA_TICK_INTERVAL = 1 / Math.max(1, Number(PLASMA_PRIM.tick_hz || 10));
    var PLASMA_MAX_SUSTAIN = Number(PLASMA_PRIM.max_sustain_ms || 2500) / 1000;
    var PLASMA_OVERHEAT_LOCKOUT = Number(PLASMA_PRIM.overheat_ms || 1600) / 1000;

    for (var i = 0; i < SHOTGUN_PATTERN.length; i++) {
        SHOTGUN_RETICLE_POINTS.push([SHOTGUN_PATTERN[i][0], SHOTGUN_PATTERN[i][1]]);
    }

    var weaponOrder = (COMBAT_PRIM.weapon_order || ['rifle', 'pistol', 'machinegun', 'shotgun', 'sniper', 'plasma']).slice();
    var weapons = {
        rifle: {
            id: 'rifle',
            name: 'Rifle',
            automatic: false,
            cooldown: weaponNum('rifle', 'cooldown_ms', 190),
            bodyDamage: weaponNum('rifle', 'body_damage', 36),
            headDamage: weaponNum('rifle', 'head_damage', 68),
            pellets: 1,
            spreadNdc: 0.0018,
            maxRange: weaponNum('rifle', 'max_range', 120)
        },
        pistol: {
            id: 'pistol',
            name: 'Pistol',
            automatic: false,
            cooldown: weaponNum('pistol', 'cooldown_ms', 280),
            bodyDamage: weaponNum('pistol', 'body_damage', 30),
            headDamage: weaponNum('pistol', 'head_damage', 56),
            pellets: 1,
            spreadNdc: 0.0032,
            maxRange: weaponNum('pistol', 'max_range', 92)
        },
        machinegun: {
            id: 'machinegun',
            name: 'Machine Gun',
            automatic: true,
            cooldown: weaponNum('machinegun', 'cooldown_ms', 80),
            bodyDamage: weaponNum('machinegun', 'body_damage', 16),
            headDamage: weaponNum('machinegun', 'head_damage', 30),
            pellets: 1,
            spreadNdc: 0.0078,
            maxRange: weaponNum('machinegun', 'max_range', 88)
        },
        shotgun: {
            id: 'shotgun',
            name: 'Shotgun',
            automatic: false,
            cooldown: weaponNum('shotgun', 'cooldown_ms', 820),
            bodyDamage: weaponNum('shotgun', 'body_damage', 14),
            headDamage: weaponNum('shotgun', 'head_damage', 22),
            pellets: weaponNum('shotgun', 'pellets', 12),
            spreadNdc: 0,
            maxRange: weaponNum('shotgun', 'max_range', 42)
        },
        sniper: {
            id: 'sniper',
            name: 'Sniper',
            automatic: false,
            cooldown: weaponNum('sniper', 'cooldown_ms', 1250),
            bodyDamage: weaponNum('sniper', 'body_damage', 120),
            headDamage: weaponNum('sniper', 'head_damage', 220),
            pellets: 1,
            spreadNdc: 0.00035,
            maxRange: weaponNum('sniper', 'max_range', 190)
        },
        plasma: {
            id: 'plasma',
            name: 'Plasma Cannon',
            automatic: true,
            cooldown: weaponNum('plasma', 'cooldown_ms', 100),
            bodyDamage: PLASMA_DAMAGE,
            headDamage: PLASMA_DAMAGE,
            pellets: 1,
            spreadNdc: 0,
            maxRange: PLASMA_RANGE
        }
    };

    var currentWeaponId = 'rifle';
    var lastFireTime = 0;
    var plasmaTickTimer = 0;
    var plasmaState = {
        heat: 0,
        overheated: false,
        overheatedUntil: 0,
        active: false,
        targetId: '',
        lockReason: 'searching',
        overlapArea: 0,
        candidateCount: 0,
        overlapCount: 0,
        beamStart: new THREE.Vector3(),
        beamEnd: new THREE.Vector3()
    };

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

    function getPlasmaReticleSizePx() {
        var size = PLASMA_RETICLE_SIZE_PX;
        if (getPerspectiveMode() !== 'third') return size;

        var cameraDistance = getThirdPersonCameraDistance();
        if (typeof cameraDistance !== 'number' || !isFinite(cameraDistance) || cameraDistance <= 0.001) {
            return size * 0.78;
        }

        var scale = PLASMA_RETICLE_REF_DISTANCE / (PLASMA_RETICLE_REF_DISTANCE + cameraDistance);
        scale = Math.max(PLASMA_RETICLE_THIRD_MIN_SCALE, Math.min(PLASMA_RETICLE_THIRD_MAX_SCALE, scale));
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

    function getLockTargets() {
        var out = [];

        if (window.GameEnemy && window.GameEnemy.getLockTargets) {
            out = out.concat(window.GameEnemy.getLockTargets() || []);
        }
        if (window.GameNet && window.GameNet.getLockTargets) {
            out = out.concat(window.GameNet.getLockTargets() || []);
        }

        if (out.length > 0) return out;

        // Fallback to body hitboxes when lock target API is unavailable.
        var hitboxes = getCombatHitboxes();
        for (var i = 0; i < hitboxes.length; i++) {
            var hb = hitboxes[i];
            if (!hb || !hb.userData || hb.userData.type !== 'body') continue;
            out.push({
                targetId: hb.userData.targetId || '',
                ownerType: hb.userData.ownerType || 'unknown',
                worldPos: hb.position.clone(),
                hitbox: hb,
                alive: true
            });
        }

        return out;
    }

    function hasLineOfSight(camera, targetPos, maxRange) {
        if (!camera || !targetPos) return false;
        var worldMeshes = window.GameWorld.getCollidables ? window.GameWorld.getCollidables() : [];
        var toTarget = plasmaForward.copy(targetPos).sub(camera.position);
        var distance = toTarget.length();
        if (distance <= 0.001 || distance > maxRange) return false;
        toTarget.divideScalar(distance);

        if (!worldMeshes || worldMeshes.length === 0) return true;

        losRaycaster.set(camera.position, toTarget);
        losRaycaster.far = Math.max(0, distance - 0.12);
        return losRaycaster.intersectObjects(worldMeshes, false).length === 0;
    }

    function getRectOverlapArea(a, b) {
        var x0 = Math.max(a.minX, b.minX);
        var x1 = Math.min(a.maxX, b.maxX);
        var y0 = Math.max(a.minY, b.minY);
        var y1 = Math.min(a.maxY, b.maxY);
        if (x1 <= x0 || y1 <= y0) return 0;
        return (x1 - x0) * (y1 - y0);
    }

    function objectToNdcRect(camera, object3d) {
        if (!camera || !object3d || !object3d.geometry) return null;
        var geo = object3d.geometry;
        if (!geo.boundingBox) geo.computeBoundingBox();
        if (!geo.boundingBox) return null;

        object3d.updateMatrixWorld(true);
        var min = geo.boundingBox.min;
        var max = geo.boundingBox.max;
        var corners = [
            [min.x, min.y, min.z],
            [min.x, min.y, max.z],
            [min.x, max.y, min.z],
            [min.x, max.y, max.z],
            [max.x, min.y, min.z],
            [max.x, min.y, max.z],
            [max.x, max.y, min.z],
            [max.x, max.y, max.z]
        ];

        var anyFront = false;
        var minX = Infinity;
        var maxX = -Infinity;
        var minY = Infinity;
        var maxY = -Infinity;

        for (var i = 0; i < corners.length; i++) {
            tmpWorld.set(corners[i][0], corners[i][1], corners[i][2]).applyMatrix4(object3d.matrixWorld);
            tmpProjected.copy(tmpWorld).project(camera);
            if (tmpProjected.z > 1.2) continue;
            anyFront = true;
            if (tmpProjected.x < minX) minX = tmpProjected.x;
            if (tmpProjected.x > maxX) maxX = tmpProjected.x;
            if (tmpProjected.y < minY) minY = tmpProjected.y;
            if (tmpProjected.y > maxY) maxY = tmpProjected.y;
        }

        if (!anyFront || minX === Infinity || minY === Infinity) return null;
        return {
            minX: minX,
            maxX: maxX,
            minY: minY,
            maxY: maxY
        };
    }

    function targetOverlapArea(camera, target, reticleRect) {
        var area = 0;
        var hitboxes = [];
        if (target && Array.isArray(target.hitboxes) && target.hitboxes.length > 0) {
            hitboxes = target.hitboxes;
        } else if (target && target.hitbox) {
            hitboxes = [target.hitbox];
        }

        for (var i = 0; i < hitboxes.length; i++) {
            var hb = hitboxes[i];
            if (!hb) continue;
            var rect = objectToNdcRect(camera, hb);
            if (!rect) continue;
            area += getRectOverlapArea(rect, reticleRect);
        }

        if (area > 0) return area;
        if (!target || !target.worldPos) return 0;

        tmpProjected.copy(target.worldPos).project(camera);
        if (tmpProjected.z < -1 || tmpProjected.z > 1) return 0;
        if (tmpProjected.x < reticleRect.minX || tmpProjected.x > reticleRect.maxX) return 0;
        if (tmpProjected.y < reticleRect.minY || tmpProjected.y > reticleRect.maxY) return 0;
        return 0.000001;
    }

    function selectPlasmaTarget(camera, maxRange, boxSizePx) {
        var targets = getLockTargets();
        if (!targets || targets.length === 0) {
            return { target: null, reason: 'searching', candidateCount: 0, overlapCount: 0, overlapArea: 0 };
        }

        var halfNdcX = (boxSizePx * 0.5) / (window.innerWidth * 0.5);
        var halfNdcY = (boxSizePx * 0.5) / (window.innerHeight * 0.5);
        var reticleRect = {
            minX: -halfNdcX,
            maxX: halfNdcX,
            minY: -halfNdcY,
            maxY: halfNdcY
        };

        var best = null;
        var bestArea = -1;
        var bestDist = Infinity;
        var candidateCount = 0;
        var overlapCount = 0;
        var anyInRangeOverlap = false;
        var anyOverlapNoLos = false;

        for (var i = 0; i < targets.length; i++) {
            var t = targets[i];
            if (!t || t.alive === false || !t.worldPos) continue;
            candidateCount++;

            var overlapArea = targetOverlapArea(camera, t, reticleRect);
            if (overlapArea <= 0) continue;
            overlapCount++;

            var dist = camera.position.distanceTo(t.worldPos);
            if (dist > maxRange) {
                continue;
            }
            anyInRangeOverlap = true;
            if (!hasLineOfSight(camera, t.worldPos, maxRange)) {
                anyOverlapNoLos = true;
                continue;
            }

            if (overlapArea > bestArea || (Math.abs(overlapArea - bestArea) < 1e-8 && dist < bestDist)) {
                bestArea = overlapArea;
                bestDist = dist;
                best = t;
            }
        }

        if (best) {
            return {
                target: best,
                reason: 'locked',
                candidateCount: candidateCount,
                overlapCount: overlapCount,
                overlapArea: bestArea
            };
        }
        if (overlapCount === 0) {
            return {
                target: null,
                reason: 'searching',
                candidateCount: candidateCount,
                overlapCount: 0,
                overlapArea: 0
            };
        }
        if (!anyInRangeOverlap) {
            return {
                target: null,
                reason: 'out_of_range',
                candidateCount: candidateCount,
                overlapCount: overlapCount,
                overlapArea: 0
            };
        }
        if (anyOverlapNoLos) {
            return {
                target: null,
                reason: 'no_los',
                candidateCount: candidateCount,
                overlapCount: overlapCount,
                overlapArea: 0
            };
        }
        return {
            target: null,
            reason: 'searching',
            candidateCount: candidateCount,
            overlapCount: overlapCount,
            overlapArea: 0
        };
    }

    function resolvePlasmaMuzzle(camera) {
        if (window.GamePlayer && window.GamePlayer.getMuzzleWorldPosition) {
            var p = window.GamePlayer.getMuzzleWorldPosition();
            if (p && typeof p.x === 'number') {
                plasmaMuzzle.copy(p);
                return plasmaMuzzle;
            }
        }

        camera.getWorldDirection(plasmaForward);
        plasmaMuzzle.copy(camera.position).addScaledVector(plasmaForward, 0.65);
        return plasmaMuzzle;
    }

    function coolPlasma(dt, nowSec) {
        if (plasmaState.overheated && nowSec >= plasmaState.overheatedUntil) {
            plasmaState.overheated = false;
        }

        var coolRate = plasmaState.overheated ? 0.35 : 0.55;
        plasmaState.heat -= dt * coolRate;
        if (plasmaState.heat < 0) plasmaState.heat = 0;
    }

    function heatPlasma(dt, nowSec) {
        plasmaState.heat += dt / PLASMA_MAX_SUSTAIN;
        if (plasmaState.heat >= 1) {
            plasmaState.heat = 1;
            plasmaState.overheated = true;
            plasmaState.overheatedUntil = nowSec + PLASMA_OVERHEAT_LOCKOUT;
            plasmaState.active = false;
            plasmaState.targetId = '';
            plasmaTickTimer = 0;
        }
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
        if (weapon.id === 'plasma') return false;

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
        if (id === 'plasma') {
            return {
                type: 'plasma',
                size: getPlasmaReticleSizePx()
            };
        }
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
        if (weaponId !== 'plasma') {
            plasmaState.active = false;
            plasmaState.targetId = '';
        }
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
        if (currentWeaponId !== 'plasma') {
            plasmaState.active = false;
            plasmaState.targetId = '';
        }
        return GameHitscan.getCurrentWeapon();
    };

    GameHitscan.setWeaponOrder = function (nextOrder) {
        if (!Array.isArray(nextOrder) || nextOrder.length === 0) return weaponOrder.slice();
        var seen = {};
        var validated = [];
        for (var i = 0; i < nextOrder.length; i++) {
            var id = String(nextOrder[i] || '');
            if (!weapons[id] || seen[id]) continue;
            seen[id] = true;
            validated.push(id);
        }
        if (validated.length === 0) return weaponOrder.slice();
        weaponOrder = validated;
        if (weaponOrder.indexOf(currentWeaponId) === -1) {
            currentWeaponId = weaponOrder[0];
        }
        return weaponOrder.slice();
    };

    GameHitscan.equipSlot = function (slotIndex) {
        var idx = Math.max(0, Math.floor(slotIndex || 0));
        if (idx >= weaponOrder.length) return null;
        return GameHitscan.setWeapon(weaponOrder[idx]);
    };

    GameHitscan.getAllWeaponIds = function () {
        var ids = [];
        for (var key in weapons) {
            if (Object.prototype.hasOwnProperty.call(weapons, key)) ids.push(key);
        }
        return ids;
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

    GameHitscan.updatePlasmaBeam = function (dt, camera, options) {
        options = options || {};
        var nowSec = performance.now() * 0.001;
        var weapon = getCurrentWeaponData();
        if (weapon.id !== 'plasma' || !camera) {
            plasmaState.active = false;
            plasmaState.targetId = '';
            plasmaState.lockReason = 'searching';
            plasmaState.overlapArea = 0;
            plasmaState.candidateCount = 0;
            plasmaState.overlapCount = 0;
            coolPlasma(dt, nowSec);
            return GameHitscan.getPlasmaState();
        }

        var triggerHeld = !!options.triggerHeld;
        if (plasmaState.overheated && nowSec < plasmaState.overheatedUntil) {
            plasmaState.active = false;
            plasmaState.targetId = '';
            plasmaState.lockReason = 'overheated';
            plasmaState.overlapArea = 0;
            coolPlasma(dt, nowSec);
            return GameHitscan.getPlasmaState();
        }

        var selection = selectPlasmaTarget(camera, PLASMA_RANGE, getPlasmaReticleSizePx());
        var target = selection.target;
        plasmaState.candidateCount = selection.candidateCount || 0;
        plasmaState.overlapCount = selection.overlapCount || 0;
        plasmaState.overlapArea = selection.overlapArea || 0;

        if (triggerHeld && target) {
            plasmaState.active = true;
            plasmaState.targetId = target.targetId || '';
            plasmaState.lockReason = 'locked';
            resolvePlasmaMuzzle(camera);
            plasmaState.beamStart.copy(plasmaMuzzle);
            plasmaState.beamEnd.copy(target.worldPos);

            heatPlasma(dt, nowSec);

            plasmaTickTimer -= dt;
            while (plasmaTickTimer <= 0 && !plasmaState.overheated) {
                if (options.onLocalTick) {
                    options.onLocalTick(target, PLASMA_DAMAGE);
                }
                if (options.onNetTick && plasmaState.targetId) {
                    options.onNetTick(plasmaState.targetId);
                }
                plasmaTickTimer += PLASMA_TICK_INTERVAL;
            }
        } else {
            plasmaState.active = false;
            plasmaState.targetId = '';
            plasmaState.lockReason = triggerHeld ? (selection.reason || 'searching') : 'searching';
            plasmaTickTimer = 0;
            coolPlasma(dt, nowSec);
        }

        if (plasmaState.overheated && nowSec >= plasmaState.overheatedUntil && plasmaState.heat <= 0.95) {
            plasmaState.overheated = false;
        }

        return GameHitscan.getPlasmaState();
    };

    GameHitscan.getPlasmaState = function () {
        return {
            heat: plasmaState.heat,
            overheated: plasmaState.overheated,
            overheatedUntil: plasmaState.overheatedUntil,
            active: plasmaState.active,
            targetId: plasmaState.targetId,
            lockReason: plasmaState.lockReason || 'searching',
            overlapArea: plasmaState.overlapArea || 0,
            candidateCount: plasmaState.candidateCount || 0,
            overlapCount: plasmaState.overlapCount || 0,
            beamStart: plasmaState.beamStart.clone(),
            beamEnd: plasmaState.beamEnd.clone()
        };
    };

    GameHitscan.getPlasmaLockDebugState = function () {
        return {
            targetId: plasmaState.targetId || '',
            lockReason: plasmaState.lockReason || 'searching',
            overlapArea: plasmaState.overlapArea || 0,
            candidateCount: plasmaState.candidateCount || 0,
            overlapCount: plasmaState.overlapCount || 0,
            active: !!plasmaState.active,
            overheated: !!plasmaState.overheated
        };
    };

    GameHitscan.getWeaponCatalog = function () {
        var out = [];
        for (var i = 0; i < weaponOrder.length; i++) {
            var id = weaponOrder[i];
            var weapon = weapons[id];
            if (!weapon) continue;
            out.push({
                id: weapon.id,
                name: weapon.name,
                automatic: !!weapon.automatic,
                cooldown: weapon.cooldown,
                bodyDamage: weapon.bodyDamage,
                headDamage: weapon.headDamage,
                pellets: weapon.pellets,
                spreadNdc: weapon.spreadNdc,
                maxRange: weapon.maxRange
            });
        }
        return out;
    };

    window.GameHitscan = GameHitscan;
})();
