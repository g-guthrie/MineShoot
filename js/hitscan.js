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
    var plasmaForward = new THREE.Vector3();
    var plasmaMuzzle = new THREE.Vector3();
    var tracerStart = new THREE.Vector3();
    var tracerMissEnd = new THREE.Vector3();
    var tracerMaxCount = 96;
    var tracerPool = [];
    var tracerCursor = 0;
    var tracerScene = null;
    var tracerShotCounter = {};
    var tracerMeshMid = new THREE.Vector3();
    var tracerMeshUp = new THREE.Vector3(0, 1, 0);
    var tracerMeshQuat = new THREE.Quaternion();

    // Y is positive-down for UI layout consistency.
    var SHOTGUN_PATTERN = [
        [-0.90, -0.90], [0.00, -0.90], [0.90, -0.90],
        [-0.90,  0.00], [-0.35, -0.35], [0.35, 0.35], [0.90, 0.00],
        [-0.90,  0.90], [0.00,  0.90], [0.90, 0.90],
        [-0.45,  0.45], [0.45, -0.45]
    ];
    var SHOTGUN_RETICLE_SIZE_PX = 225;
    var SHOTGUN_RETICLE_REF_DISTANCE = 14;
    var SHOTGUN_RETICLE_THIRD_MIN_SCALE = 0.62;
    var SHOTGUN_RETICLE_THIRD_MAX_SCALE = 0.96;
    var SHOTGUN_RETICLE_POINTS = [];
    var PLASMA_RETICLE_SIZE_PX = 360;
    var PLASMA_RETICLE_REF_DISTANCE = 14;
    var PLASMA_RETICLE_THIRD_MIN_SCALE = 0.6;
    var PLASMA_RETICLE_THIRD_MAX_SCALE = 0.98;

    var PLASMA_RANGE = 24;
    var PLASMA_DAMAGE = 15;
    var PLASMA_TICK_INTERVAL = 0.1;
    var PLASMA_MAX_SUSTAIN = 2.5;
    var PLASMA_OVERHEAT_LOCKOUT = 1.6;

    for (var i = 0; i < SHOTGUN_PATTERN.length; i++) {
        SHOTGUN_RETICLE_POINTS.push([SHOTGUN_PATTERN[i][0], SHOTGUN_PATTERN[i][1]]);
    }

    var weaponOrder = ['rifle', 'pistol', 'machinegun', 'shotgun', 'sniper', 'seekergun', 'plasma'];
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
        },
        seekergun: {
            id: 'seekergun',
            name: 'Seeker Gun',
            automatic: true,
            cooldown: 320,
            bodyDamage: 0,
            headDamage: 0,
            pellets: 1,
            spreadNdc: 0,
            maxRange: 24
        },
        plasma: {
            id: 'plasma',
            name: 'Plasma Cannon',
            automatic: true,
            cooldown: 100,
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
        beamStart: new THREE.Vector3(),
        beamEnd: new THREE.Vector3()
    };

    function ensureTracerScene(camera) {
        if (tracerScene) return tracerScene;
        if (camera && camera.parent) {
            tracerScene = camera.parent;
            return tracerScene;
        }
        return null;
    }

    function allocTracer(camera) {
        if (!ensureTracerScene(camera)) return null;
        if (tracerPool.length < tracerMaxCount) {
            var mesh = new THREE.Mesh(
                new THREE.CylinderGeometry(0.03, 0.03, 1, 8),
                new THREE.MeshBasicMaterial({
                    color: 0xffe29a,
                    transparent: true,
                    opacity: 0,
                    depthWrite: false,
                    depthTest: false
                })
            );
            mesh.visible = false;
            mesh.renderOrder = 40;
            mesh.frustumCulled = false;
            tracerScene.add(mesh);
            tracerPool.push({
                mesh: mesh,
                origin: new THREE.Vector3(),
                dir: new THREE.Vector3(),
                head: new THREE.Vector3(),
                tail: new THREE.Vector3(),
                speed: 0,
                segmentLength: 0,
                traveled: 0,
                maxDistance: 0,
                life: 0,
                maxLife: 0.12,
                framesAlive: 0
            });
        }
        if (tracerPool.length === 0) return null;
        tracerCursor = (tracerCursor + 1) % tracerPool.length;
        return tracerPool[tracerCursor];
    }

    function shouldDrawTracerForShot(weapon) {
        if (!weapon || !weapon.id) return false;
        if (weapon.id === 'plasma' || weapon.id === 'seekergun') return false;
        if (weapon.id === 'machinegun') return true;
        return true;
    }

    function tracerColorForWeapon(weaponId) {
        if (weaponId === 'sniper') return 0xd9f2ff;
        if (weaponId === 'shotgun') return 0xffe2ad;
        if (weaponId === 'machinegun') return 0xfff7cf;
        return 0xffedbf;
    }

    function tracerLifeForWeapon(weaponId) {
        if (weaponId === 'machinegun') return 0.09;
        if (weaponId === 'shotgun') return 0.1;
        if (weaponId === 'sniper') return 0.12;
        return 0.11;
    }

    function tracerSpeedForWeapon(weaponId) {
        if (weaponId === 'machinegun') return 260;
        if (weaponId === 'shotgun') return 230;
        if (weaponId === 'sniper') return 320;
        return 280;
    }

    function tracerSegmentLengthForWeapon(weaponId) {
        if (weaponId === 'machinegun') return 1.7;
        if (weaponId === 'shotgun') return 1.9;
        if (weaponId === 'sniper') return 2.6;
        return 2.1;
    }

    function spawnTracer(camera, weaponId, endPoint) {
        if (!camera || !endPoint) return;
        var tracer = allocTracer(camera);
        if (!tracer || !tracer.mesh) return;

        resolvePlasmaMuzzle(camera);
        tracerStart.copy(plasmaMuzzle);
        tracer.origin.copy(tracerStart);
        tracer.dir.copy(endPoint).sub(tracerStart);
        var len = tracer.dir.length();
        if (len <= 0.001) return;
        tracer.dir.divideScalar(len);
        tracer.head.copy(tracer.origin);
        tracer.tail.copy(tracer.origin);
        tracer.traveled = 0;
        tracer.maxDistance = len;
        tracer.segmentLength = tracerSegmentLengthForWeapon(weaponId);
        tracer.speed = tracerSpeedForWeapon(weaponId);
        tracer.framesAlive = 0;

        tracer.maxLife = tracerLifeForWeapon(weaponId);
        tracer.life = tracer.maxLife;
        tracer.mesh.material.opacity = 1.0;
        tracer.mesh.material.color.setHex(tracerColorForWeapon(weaponId));
        tracer.mesh.visible = true;
    }

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

    function getSeekergunReticleSizePx() {
        return getPlasmaReticleSizePx() * 0.72;
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

    function selectPlasmaTarget(camera, maxRange, boxSizePx) {
        var targets = getLockTargets();
        if (!targets || targets.length === 0) return null;

        var halfNdcX = (boxSizePx * 0.5) / (window.innerWidth * 0.5);
        var halfNdcY = (boxSizePx * 0.5) / (window.innerHeight * 0.5);
        var best = null;
        var bestDist = Infinity;

        for (var i = 0; i < targets.length; i++) {
            var t = targets[i];
            if (!t || t.alive === false || !t.worldPos) continue;
            var projected = t.worldPos.clone().project(camera);
            if (projected.z > 1 || projected.z < -1) continue;
            if (Math.abs(projected.x) > halfNdcX || Math.abs(projected.y) > halfNdcY) continue;
            if (!hasLineOfSight(camera, t.worldPos, maxRange)) continue;

            var dist = camera.position.distanceTo(t.worldPos);
            if (dist > maxRange) continue;
            if (dist < bestDist) {
                best = t;
                bestDist = dist;
            }
        }

        return best;
    }

    function getSeekerTelemetry(camera, maxRange, boxSizePx) {
        var targets = getLockTargets() || [];
        var halfNdcX = (boxSizePx * 0.5) / (window.innerWidth * 0.5);
        var halfNdcY = (boxSizePx * 0.5) / (window.innerHeight * 0.5);
        var best = null;
        var bestDist = Infinity;
        var nearestNorm = Infinity;
        var nearestId = '';

        for (var i = 0; i < targets.length; i++) {
            var t = targets[i];
            if (!t || t.alive === false || !t.worldPos) continue;
            var projected = t.worldPos.clone().project(camera);
            if (projected.z > 1 || projected.z < -1) continue;

            if (halfNdcX > 0.0001 && halfNdcY > 0.0001) {
                var nx = projected.x / halfNdcX;
                var ny = projected.y / halfNdcY;
                var norm = Math.sqrt(nx * nx + ny * ny);
                if (norm < nearestNorm) {
                    nearestNorm = norm;
                    nearestId = t.targetId || '';
                }
            }

            if (Math.abs(projected.x) > halfNdcX || Math.abs(projected.y) > halfNdcY) continue;
            if (!hasLineOfSight(camera, t.worldPos, maxRange)) continue;

            var dist = camera.position.distanceTo(t.worldPos);
            if (dist > maxRange) continue;
            if (dist < bestDist) {
                best = t;
                bestDist = dist;
            }
        }

        var lockNorm = Infinity;
        if (best && best.worldPos && halfNdcX > 0.0001 && halfNdcY > 0.0001) {
            var bestProjected = best.worldPos.clone().project(camera);
            var bnx = bestProjected.x / halfNdcX;
            var bny = bestProjected.y / halfNdcY;
            lockNorm = Math.sqrt(bnx * bnx + bny * bny);
        }

        return {
            hasLock: !!best,
            lockTargetId: best && best.targetId ? best.targetId : '',
            nearestTargetId: nearestId,
            nearestNorm: isFinite(nearestNorm) ? nearestNorm : -1,
            lockNorm: isFinite(lockNorm) ? lockNorm : -1,
            reticleSizePx: boxSizePx,
            reticleHalfNdcX: halfNdcX,
            reticleHalfNdcY: halfNdcY,
            maxRange: maxRange,
            candidateCount: targets.length
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

    function fireSinglePellet(camera, weapon, pelletIndex, onHit, onTrace) {
        var targetsHitboxes = getCombatHitboxes();
        var worldMeshes = window.GameWorld.getCollidables ? window.GameWorld.getCollidables() : [];
        var allTargets = targetsHitboxes.concat(worldMeshes);
        var ndcOffset = getPelletNdcOffset(weapon, pelletIndex);

        screenPoint.set(ndcOffset.x, ndcOffset.y);
        raycaster.setFromCamera(screenPoint, camera);
        raycaster.far = weapon.maxRange;

        var intersects = raycaster.intersectObjects(allTargets, false);
        if (intersects.length === 0) {
            if (onTrace) {
                tracerMissEnd.copy(raycaster.ray.origin).addScaledVector(raycaster.ray.direction, weapon.maxRange);
                onTrace(tracerMissEnd);
            }
            return false;
        }

        var hit = intersects[0];
        if (onTrace) onTrace(hit.point);
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
        if (weapon.id === 'seekergun') {
            var seekerLock = selectPlasmaTarget(camera, weapon.maxRange, getSeekergunReticleSizePx());
            if (window.GameThrowables && window.GameThrowables.fireSeekerShot) {
                return !!window.GameThrowables.fireSeekerShot(camera, seekerLock || null);
            }
            return false;
        }

        var pellets = weapon.pellets || 1;
        var anyHit = false;
        var drawTracersForShot = shouldDrawTracerForShot(weapon);
        var shotgunTracerCap = 8;
        for (var i = 0; i < pellets; i++) {
            var shouldTraceThisPellet = drawTracersForShot && (weapon.id !== 'shotgun' || i < shotgunTracerCap);
            var hit = fireSinglePellet(
                camera,
                weapon,
                i,
                onHit,
                shouldTraceThisPellet ? function (traceEnd) {
                    spawnTracer(camera, weapon.id, traceEnd);
                } : null
            );
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
            coolPlasma(dt, nowSec);
            return GameHitscan.getPlasmaState();
        }

        var triggerHeld = !!options.triggerHeld;
        if (plasmaState.overheated && nowSec < plasmaState.overheatedUntil) {
            plasmaState.active = false;
            plasmaState.targetId = '';
            coolPlasma(dt, nowSec);
            return GameHitscan.getPlasmaState();
        }

        var target = selectPlasmaTarget(camera, PLASMA_RANGE, getPlasmaReticleSizePx());
        if (triggerHeld && target) {
            plasmaState.active = true;
            plasmaState.targetId = target.targetId || '';
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
            beamStart: plasmaState.beamStart.clone(),
            beamEnd: plasmaState.beamEnd.clone()
        };
    };

    GameHitscan.getSeekergunDebugInfo = function (camera) {
        if (!camera) return null;
        var weapon = getCurrentWeaponData();
        if (!weapon || weapon.id !== 'seekergun') return null;
        return getSeekerTelemetry(camera, weapon.maxRange, getSeekergunReticleSizePx());
    };

    GameHitscan.updateTracers = function (dt) {
        if (!dt || tracerPool.length === 0) return;
        var simDt = Math.min(dt, 1 / 30);
        for (var i = 0; i < tracerPool.length; i++) {
            var t = tracerPool[i];
            if (!t || !t.mesh || t.life <= 0) continue;
            t.life -= simDt;
            t.framesAlive++;

            var step = t.speed * simDt;
            t.traveled += step;
            if (t.traveled > t.maxDistance) t.traveled = t.maxDistance;
            t.head.copy(t.origin).addScaledVector(t.dir, t.traveled);
            var tailTravel = Math.max(0, t.traveled - t.segmentLength);
            t.tail.copy(t.origin).addScaledVector(t.dir, tailTravel);
            tracerMeshMid.copy(t.tail).add(t.head).multiplyScalar(0.5);
            t.mesh.position.copy(tracerMeshMid);
            tracerMeshQuat.setFromUnitVectors(tracerMeshUp, t.dir);
            t.mesh.quaternion.copy(tracerMeshQuat);
            t.mesh.scale.set(1, Math.max(0.05, t.segmentLength * 0.82), 1);

            if (t.life <= 0) {
                t.life = 0;
                t.mesh.visible = false;
                t.mesh.material.opacity = 0;
                continue;
            }
            if (t.traveled >= t.maxDistance && t.framesAlive > 1) {
                t.life = 0;
                t.mesh.visible = false;
                t.mesh.material.opacity = 0;
                continue;
            }
            var alpha = t.life / Math.max(0.0001, t.maxLife);
            t.mesh.material.opacity = alpha;
            t.mesh.visible = true;
        }
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
