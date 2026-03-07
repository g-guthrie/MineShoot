/**
 * hitscan.js - Player weapons and hitscan logic
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameHitscan
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
    var tracerInstancedMesh = null;
    var tracerPoolReady = false;
    var tracerTmpMatrix = new THREE.Matrix4();
    var tracerTmpPos = new THREE.Vector3();
    var tracerTmpQuat = new THREE.Quaternion();
    var tracerTmpScale = new THREE.Vector3();

    var tracerMeshMid = new THREE.Vector3();
    var tracerMeshUp = new THREE.Vector3(0, 1, 0);
    var tracerZeroMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
    var playerForward = new THREE.Vector3();
    var hitFromPlayer = new THREE.Vector3();

    // Y is positive-down for UI layout consistency.
    var SHOTGUN_MEDIUM_RING_RATIO = 0.5;
    var SHOTGUN_OUTER_RING_RATIO = 0.9;
    var SHOTGUN_RETICLE_SIZE_PX = 225;
    var SHOTGUN_RETICLE_REF_DISTANCE = 14;
    var SHOTGUN_RETICLE_THIRD_MIN_SCALE = 0.62;
    var SHOTGUN_RETICLE_THIRD_MAX_SCALE = 0.96;
    var SHOTGUN_RETICLE_POINTS = [];
    var PRIMITIVE_HITSCAN_SINGLE = 'hitscan_single';
    var PRIMITIVE_HITSCAN_MULTI = 'hitscan_multi';
    var PRIMITIVE_PROJECTILE_HOMING = 'projectile_homing';
    var SHOTGUN_ADS_SPREAD_SCALE = 0.42;

    function pushRingPoints(out, count, radius, angleOffsetRad) {
        for (var i = 0; i < count; i++) {
            var angle = angleOffsetRad + ((Math.PI * 2 * i) / count);
            out.push([Math.cos(angle) * radius, Math.sin(angle) * radius]);
        }
    }

    function buildShotgunPattern() {
        var points = [[0, 0]];
        pushRingPoints(points, 5, SHOTGUN_MEDIUM_RING_RATIO, -Math.PI * 0.5);
        pushRingPoints(points, 6, SHOTGUN_OUTER_RING_RATIO, -Math.PI * 0.5);
        return points;
    }

    var SHOTGUN_PATTERN = buildShotgunPattern();

    for (var i = 0; i < SHOTGUN_PATTERN.length; i++) {
        SHOTGUN_RETICLE_POINTS.push([SHOTGUN_PATTERN[i][0], SHOTGUN_PATTERN[i][1]]);
    }

    var combatTuning = globalThis.__MAYHEM_RUNTIME.GameCombatTuning;
    var sharedTuning = (globalThis.__MAYHEM_RUNTIME.GameShared && globalThis.__MAYHEM_RUNTIME.GameShared.gameplayTuning) || {};
    var sharedWeaponStats = sharedTuning.weaponStats || {};

    function buildWeaponFromShared(id) {
        var s = sharedWeaponStats[id] || {};
        var maxRange = (combatTuning && combatTuning.getWeaponRange) ? combatTuning.getWeaponRange(id) : (s.maxRange || 0);
        return {
            id: id,
            name: s.name || id,
            primitiveType: s.primitiveType || PRIMITIVE_HITSCAN_SINGLE,
            automatic: !!s.automatic,
            cooldown: Number(s.cooldownMs || 0),
            bodyDamage: Number(s.bodyDamage || 0),
            headDamage: Number(s.headDamage || 0),
            pellets: Number(s.pellets || 1),
            spreadNdc: Number(s.spreadNdc || 0),
            maxRange: maxRange
        };
    }

    var weaponCatalogOrder = ['rifle', 'pistol', 'machinegun', 'shotgun', 'sniper', 'seekergun'];
    var weaponOrder = weaponCatalogOrder.slice();
    var weapons = {};
    for (var wi = 0; wi < weaponCatalogOrder.length; wi++) {
        weapons[weaponCatalogOrder[wi]] = buildWeaponFromShared(weaponCatalogOrder[wi]);
    }

    var weaponFalloffTuning = {};
    for (var fi = 0; fi < weaponCatalogOrder.length; fi++) {
        var fid = weaponCatalogOrder[fi];
        weaponFalloffTuning[fid] = (combatTuning && combatTuning.getWeaponFalloffTuning)
            ? combatTuning.getWeaponFalloffTuning(fid)
            : ((sharedTuning.weaponFalloff && sharedTuning.weaponFalloff[fid]) || []);
    }

    var currentWeaponId = 'rifle';
    var lastFireTime = 0;
    function ensureTracerScene(camera) {
        if (tracerScene) return tracerScene;
        if (camera && camera.parent) {
            tracerScene = camera.parent;
            return tracerScene;
        }
        return null;
    }

    function sharedSeekProfiles() {
        var shared = globalThis.__MAYHEM_RUNTIME.GameShared || {};
        if (shared.seekProfiles) return shared.seekProfiles;
        return null;
    }

    function sharedSeekCore() {
        var shared = globalThis.__MAYHEM_RUNTIME.GameShared || {};
        if (shared.seekCore) return shared.seekCore;
        return null;
    }

    function seekProfileForWeapon(weaponId) {
        var profiles = sharedSeekProfiles();
        if (!profiles) return null;
        if (weaponId === 'seekergun') return profiles.seekergun_shot || null;
        return null;
    }

    function resolveSeekAimProfile(profile, adsActive) {
        if (globalThis.__MAYHEM_RUNTIME.GameShared && globalThis.__MAYHEM_RUNTIME.GameShared.resolveSeekAimProfile) {
            return globalThis.__MAYHEM_RUNTIME.GameShared.resolveSeekAimProfile(profile, adsActive);
        }
        if (!profile) return null;
        return {
            maxRange: adsActive ? (profile.adsMaxRange || profile.maxRange) : (profile.hipfireMaxRange || profile.maxRange),
            lockBoxPx: adsActive ? (profile.adsLockBoxPx || profile.lockBoxPx) : (profile.hipfireLockBoxPx || profile.lockBoxPx),
            coneHalfAngleDeg: adsActive ? (profile.adsConeHalfAngleDeg || profile.coneHalfAngleDeg) : (profile.hipfireConeHalfAngleDeg || profile.coneHalfAngleDeg)
        };
    }

    function adsState() {
        if (globalThis.__MAYHEM_RUNTIME.GamePlayer && globalThis.__MAYHEM_RUNTIME.GamePlayer.getAdsState) {
            return globalThis.__MAYHEM_RUNTIME.GamePlayer.getAdsState();
        }
        return null;
    }

    function isAdsActiveForWeapon(weaponId) {
        var state = adsState();
        return !!(state && state.active && state.weaponId === weaponId);
    }

    function toSeekCandidate(rawTarget) {
        if (!rawTarget || !rawTarget.worldPos) return null;
        return {
            id: rawTarget.targetId || '',
            ownerType: rawTarget.ownerType || 'unknown',
            corePos: rawTarget.worldPos,
            alive: rawTarget.alive !== false,
            rawTarget: rawTarget
        };
    }

    function selectSeekLock(camera, maxRange, boxSizePx, options) {
        if (!camera) return null;
        var seekCore = sharedSeekCore();
        if (!seekCore || !seekCore.selectSeekTarget) return null;
        var lockTargets = (options && Array.isArray(options.targetsList)) ? options.targetsList : (getLockTargets() || []);
        var candidates = [];
        for (var i = 0; i < lockTargets.length; i++) {
            var c = toSeekCandidate(lockTargets[i]);
            if (c) candidates.push(c);
        }
        var origin = camera.position;
        camera.getWorldDirection(plasmaForward);
        var forward = {
            x: plasmaForward.x,
            y: plasmaForward.y,
            z: plasmaForward.z
        };
        return seekCore.selectSeekTarget({
            origin: {
                x: origin.x,
                y: origin.y,
                z: origin.z
            },
            forward: forward,
            candidates: candidates,
            maxRange: maxRange,
            coneHalfAngleDeg: options && typeof options.coneHalfAngleDeg === 'number' ? options.coneHalfAngleDeg : 180,
            ownerTypes: options && options.ownerTypes ? options.ownerTypes : null,
            boxSizePx: boxSizePx,
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
            projectToNdc: function (worldPos) {
                if (!worldPos || !worldPos.clone || !worldPos.project) return null;
                var projected = worldPos.clone().project(camera);
                return { x: projected.x, y: projected.y, z: projected.z };
            },
            hasWorldLos: function (worldPos) {
                return hasLineOfSight(camera, worldPos, maxRange);
            }
        });
    }

    function fireHomingProjectile(camera, weapon) {
        var profile = seekProfileForWeapon(weapon && weapon.id ? weapon.id : '');
        var adsActive = isAdsActiveForWeapon(weapon.id);
        var seekAim = resolveSeekAimProfile(profile, adsActive) || {};
        var boxSize = Number(seekAim.lockBoxPx || getSeekergunReticleSizePx());
        var lock = selectSeekLock(camera, Number(seekAim.maxRange || weapon.maxRange), boxSize, {
            ownerTypes: ['enemy', 'net'],
            coneHalfAngleDeg: seekAim.coneHalfAngleDeg || (profile && typeof profile.coneHalfAngleDeg === 'number' ? profile.coneHalfAngleDeg : 180)
        });
        var seekerLock = lock && lock.candidate ? lock.candidate.rawTarget : null;
        if (globalThis.__MAYHEM_RUNTIME.GameThrowables && globalThis.__MAYHEM_RUNTIME.GameThrowables.fireSeekerShot) {
            return !!globalThis.__MAYHEM_RUNTIME.GameThrowables.fireSeekerShot(camera, seekerLock || null, '', {
                weaponId: weapon.id || 'seekergun'
            });
        }
        return false;
    }

    function fireHitscanPattern(camera, weapon, onHit, onMiss) {
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

        if (!anyHit && onMiss) onMiss();
        return true;
    }

    function initTracerPool(camera) {
        if (tracerPoolReady) return true;
        if (!ensureTracerScene(camera)) return false;

        var geo = new THREE.CylinderGeometry(0.03, 0.03, 0.75, 8);
        var mat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 1.0,
            depthWrite: false,
            depthTest: false
        });
        tracerInstancedMesh = new THREE.InstancedMesh(geo, mat, tracerMaxCount);
        tracerInstancedMesh.frustumCulled = false;
        tracerInstancedMesh.renderOrder = 40;

        for (var i = 0; i < tracerMaxCount; i++) {
            tracerInstancedMesh.setMatrixAt(i, tracerZeroMatrix);
            tracerPool.push({
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
                framesAlive: 0,
                baseColor: null
            });
        }
        tracerInstancedMesh.instanceMatrix.needsUpdate = true;
        tracerScene.add(tracerInstancedMesh);
        tracerPoolReady = true;
        return true;
    }

    function allocTracer(camera) {
        if (!initTracerPool(camera)) return null;
        tracerCursor = (tracerCursor + 1) % tracerMaxCount;
        return tracerCursor;
    }

    function shouldDrawTracerForShot(weapon) {
        if (!weapon || !weapon.id) return false;
        if (weapon.id === 'seekergun') return false;
        if (weapon.id === 'machinegun') return true;
        return true;
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
        var idx = allocTracer(camera);
        if (idx === null) return;
        var tracer = tracerPool[idx];

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
    }

    function getCombatHitboxes() {
        var out = [];
        if (globalThis.__MAYHEM_RUNTIME.GameEnemy && globalThis.__MAYHEM_RUNTIME.GameEnemy.getHitboxArray) {
            var local = globalThis.__MAYHEM_RUNTIME.GameEnemy.getHitboxArray() || [];
            out = out.concat(local);
        }
        if (globalThis.__MAYHEM_RUNTIME.GameNet && globalThis.__MAYHEM_RUNTIME.GameNet.getHitboxArray) {
            var net = globalThis.__MAYHEM_RUNTIME.GameNet.getHitboxArray() || [];
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

    var sharedDamage = (globalThis.__MAYHEM_RUNTIME.GameShared && globalThis.__MAYHEM_RUNTIME.GameShared.damage) || null;

    function applyDistanceFalloff(weapon, damage, distance) {
        if (!weapon || !weapon.id) return damage;
        var bands = weaponFalloffTuning[weapon.id];
        if (sharedDamage && sharedDamage.applyFalloff) return sharedDamage.applyFalloff(damage, distance, bands);
        if (!Array.isArray(bands) || bands.length === 0) return damage;
        for (var i = 0; i < bands.length; i++) {
            var band = bands[i];
            if (!band || typeof band.maxDistance !== 'number' || typeof band.scale !== 'number') continue;
            if (distance <= band.maxDistance) {
                return Math.max(1, Math.round(damage * Math.max(0, band.scale)));
            }
        }
        var tail = bands[bands.length - 1];
        var tailScale = (tail && typeof tail.scale === 'number') ? Math.max(0, tail.scale) : 1;
        return Math.max(1, Math.round(damage * tailScale));
    }

    function getThirdPersonCameraDistance() {
        if (!globalThis.__MAYHEM_RUNTIME.GamePlayer || !globalThis.__MAYHEM_RUNTIME.GamePlayer.getCamera || !globalThis.__MAYHEM_RUNTIME.GamePlayer.getPosition) return null;
        var camera = globalThis.__MAYHEM_RUNTIME.GamePlayer.getCamera();
        var playerPos = globalThis.__MAYHEM_RUNTIME.GamePlayer.getPosition();
        if (!camera || !playerPos || !camera.position || !camera.position.distanceTo) return null;
        return camera.position.distanceTo(playerPos);
    }

    function getShotgunReticleSizePx() {
        var size = SHOTGUN_RETICLE_SIZE_PX;

        var cameraDistance = getThirdPersonCameraDistance();
        if (typeof cameraDistance !== 'number' || !isFinite(cameraDistance) || cameraDistance <= 0.001) {
            return size * 0.78;
        }

        // Keep spread feel consistent relative to the player, not just camera distance.
        var scale = SHOTGUN_RETICLE_REF_DISTANCE / (SHOTGUN_RETICLE_REF_DISTANCE + cameraDistance);
        scale = Math.max(SHOTGUN_RETICLE_THIRD_MIN_SCALE, Math.min(SHOTGUN_RETICLE_THIRD_MAX_SCALE, scale));
        return size * scale;
    }

    function getSeekergunReticleSizePx() {
        var state = adsState();
        var profile = seekProfileForWeapon('seekergun');
        var seekAim = resolveSeekAimProfile(profile, !!(state && state.active && state.weaponId === 'seekergun'));
        return Number(seekAim && seekAim.lockBoxPx) || 260;
    }

    function getBloomCircleSizePx(weapon) {
        if (!weapon || weapon.id === 'shotgun') return 0;
        if (isAdsActiveForWeapon(weapon.id)) return 0;
        var spread = Math.max(0, Number(weapon.spreadNdc || 0));
        if (spread <= 0.00001) return 0;
        return spread * Math.min(window.innerWidth, window.innerHeight) * 0.5 * 2;
    }

    function getPelletNdcOffset(weapon, pelletIndex) {
        if (weapon.id === 'shotgun') {
            var p = SHOTGUN_PATTERN[pelletIndex % SHOTGUN_PATTERN.length];
            var halfSize = getShotgunReticleSizePx() * 0.5;
            if (isAdsActiveForWeapon('shotgun')) {
                halfSize *= SHOTGUN_ADS_SPREAD_SCALE;
            }
            return {
                x: (p[0] * halfSize) / (window.innerWidth * 0.5),
                y: -(p[1] * halfSize) / (window.innerHeight * 0.5)
            };
        }

        if (isAdsActiveForWeapon(weapon.id)) {
            return { x: 0, y: 0 };
        }

        return {
            x: (Math.random() * 2 - 1) * weapon.spreadNdc,
            y: (Math.random() * 2 - 1) * weapon.spreadNdc
        };
    }

    function getLockTargets() {
        var out = [];

        if (globalThis.__MAYHEM_RUNTIME.GameEnemy && globalThis.__MAYHEM_RUNTIME.GameEnemy.getLockTargets) {
            out = out.concat(globalThis.__MAYHEM_RUNTIME.GameEnemy.getLockTargets() || []);
        }
        if (globalThis.__MAYHEM_RUNTIME.GameNet && globalThis.__MAYHEM_RUNTIME.GameNet.getLockTargets) {
            out = out.concat(globalThis.__MAYHEM_RUNTIME.GameNet.getLockTargets() || []);
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

    function lockTargetPassesFilter(target, options) {
        if (!target) return false;
        if (!options) return true;

        if (options.ownerType && target.ownerType !== options.ownerType) return false;

        if (Array.isArray(options.ownerTypes) && options.ownerTypes.length > 0) {
            var matchedType = false;
            for (var i = 0; i < options.ownerTypes.length; i++) {
                if (target.ownerType === options.ownerTypes[i]) {
                    matchedType = true;
                    break;
                }
            }
            if (!matchedType) return false;
        }

        if (options.targetIdPrefix) {
            var targetId = String(target.targetId || '');
            if (targetId.indexOf(String(options.targetIdPrefix)) !== 0) return false;
        }

        return true;
    }

    function hasLineOfSight(camera, targetPos, maxRange) {
        if (!camera || !targetPos) return false;
        var worldMeshes = globalThis.__MAYHEM_RUNTIME.GameWorld.getCollidables ? globalThis.__MAYHEM_RUNTIME.GameWorld.getCollidables() : [];
        var toTarget = plasmaForward.copy(targetPos).sub(camera.position);
        var distance = toTarget.length();
        if (distance <= 0.001 || distance > maxRange) return false;
        toTarget.divideScalar(distance);

        if (!worldMeshes || worldMeshes.length === 0) return true;

        losRaycaster.set(camera.position, toTarget);
        losRaycaster.far = Math.max(0, distance - 0.12);
        return losRaycaster.intersectObjects(worldMeshes, false).length === 0;
    }

    function selectSeekTargetByBox(camera, maxRange, boxSizePx, options) {
        var lockTargets = getLockTargets() || [];
        var filtered = [];
        for (var i = 0; i < lockTargets.length; i++) {
            var t = lockTargets[i];
            if (!t || t.alive === false || !t.worldPos) continue;
            if (!lockTargetPassesFilter(t, options)) continue;
            filtered.push(t);
        }
        var lock = selectSeekLock(camera, maxRange, boxSizePx, {
            coneHalfAngleDeg: 180,
            targetsList: filtered
        });
        return lock && lock.candidate ? lock.candidate.rawTarget : null;
    }

    function getSeekerTelemetry(camera, maxRange, boxSizePx, coneHalfAngleDeg) {
        var lock = selectSeekLock(camera, maxRange, boxSizePx, {
            ownerTypes: ['enemy', 'net'],
            coneHalfAngleDeg: coneHalfAngleDeg
        });

        return {
            hasLock: !!(lock && lock.hasLock),
            lockTargetId: lock && lock.lockTargetId ? lock.lockTargetId : '',
            nearestTargetId: lock && lock.nearestTargetId ? lock.nearestTargetId : '',
            nearestNorm: lock && isFinite(lock.nearestNorm) ? lock.nearestNorm : -1,
            lockNorm: lock && isFinite(lock.lockNorm) ? lock.lockNorm : -1,
            reticleSizePx: boxSizePx,
            reticleHalfNdcX: lock && lock.reticleHalfNdcX ? lock.reticleHalfNdcX : 0,
            reticleHalfNdcY: lock && lock.reticleHalfNdcY ? lock.reticleHalfNdcY : 0,
            maxRange: maxRange,
            coneHalfAngleDeg: coneHalfAngleDeg,
            candidateCount: lock && typeof lock.candidateCount === 'number' ? lock.candidateCount : 0
        };
    }

    function resolvePlasmaMuzzle(camera) {
        if (globalThis.__MAYHEM_RUNTIME.GamePlayer && globalThis.__MAYHEM_RUNTIME.GamePlayer.getMuzzleWorldPosition) {
            var p = globalThis.__MAYHEM_RUNTIME.GamePlayer.getMuzzleWorldPosition();
            if (p && typeof p.x === 'number') {
                plasmaMuzzle.copy(p);
                return plasmaMuzzle;
            }
        }

        camera.getWorldDirection(plasmaForward);
        plasmaMuzzle.copy(camera.position).addScaledVector(plasmaForward, 0.65);
        return plasmaMuzzle;
    }

    function fireSinglePellet(camera, weapon, pelletIndex, onHit, onTrace) {
        var targetsHitboxes = getCombatHitboxes();
        var worldMeshes = globalThis.__MAYHEM_RUNTIME.GameWorld.getCollidables ? globalThis.__MAYHEM_RUNTIME.GameWorld.getCollidables() : [];
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

        if (globalThis.__MAYHEM_RUNTIME.GamePlayer && globalThis.__MAYHEM_RUNTIME.GamePlayer.getRotation && globalThis.__MAYHEM_RUNTIME.GamePlayer.getPosition) {
            var playerRot = globalThis.__MAYHEM_RUNTIME.GamePlayer.getRotation();
            var playerPos = globalThis.__MAYHEM_RUNTIME.GamePlayer.getPosition();
            playerForward.set(-Math.sin(playerRot.yaw || 0), 0, -Math.cos(playerRot.yaw || 0));
            hitFromPlayer.copy(hit.point).sub(playerPos).setY(0);
            if (hitFromPlayer.lengthSq() > 0.0001) {
                hitFromPlayer.normalize();
                if (playerForward.dot(hitFromPlayer) <= 0.1) {
                    return false;
                }
            }
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
        var worldMeshes = globalThis.__MAYHEM_RUNTIME.GameWorld.getCollidables ? globalThis.__MAYHEM_RUNTIME.GameWorld.getCollidables() : [];
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
        if (weapon.primitiveType === PRIMITIVE_PROJECTILE_HOMING) {
            return fireHomingProjectile(camera, weapon);
        }
        return fireHitscanPattern(camera, weapon, onHit, onMiss);
    };

    GameHitscan.getCurrentWeapon = function () {
        var weapon = getCurrentWeaponData();
        return {
            id: weapon.id,
            name: weapon.name,
            primitiveType: weapon.primitiveType || PRIMITIVE_HITSCAN_SINGLE,
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
            points: SHOTGUN_RETICLE_POINTS,
            bloomSize: 0,
            adsActive: isAdsActiveForWeapon(id)
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

    GameHitscan.tick = function (_dt) {
        return null;
    };

    GameHitscan.applySeekerReject = function (payload) {
        return payload || null;
    };

    GameHitscan.syncPlasmaStateFromNet = function (_state) {};

    GameHitscan.getSeekergunDebugInfo = function (camera) {
        if (!camera) return null;
        var weapon = getCurrentWeaponData();
        if (!weapon || weapon.id !== 'seekergun') return null;
        var state = adsState();
        var profile = seekProfileForWeapon('seekergun');
        var seekAim = resolveSeekAimProfile(profile, !!(state && state.active && state.weaponId === 'seekergun'));
        return getSeekerTelemetry(
            camera,
            Number(seekAim && seekAim.maxRange) || weapon.maxRange,
            Number(seekAim && seekAim.lockBoxPx) || getSeekergunReticleSizePx(),
            Number(seekAim && seekAim.coneHalfAngleDeg) || 20
        );
    };

    GameHitscan.selectLockTargetByBox = function (camera, maxRange, boxSizePx, options) {
        if (!camera) return null;
        var range = (typeof maxRange === 'number' && maxRange > 0) ? maxRange : getCurrentWeaponData().maxRange;
        var size = (typeof boxSizePx === 'number' && boxSizePx > 1) ? boxSizePx : getSeekergunReticleSizePx();
        var target = selectSeekTargetByBox(camera, range, size, options || null);
        if (!target) return null;
        return {
            targetId: target.targetId || '',
            ownerType: target.ownerType || 'unknown',
            worldPos: target.worldPos && target.worldPos.clone ? target.worldPos.clone() : null,
            hitbox: target.hitbox || null,
            enemyRef: target.enemyRef || null
        };
    };

    GameHitscan.updateTracers = function (dt) {
        if (!dt || !tracerPoolReady || tracerPool.length === 0) return;
        var simDt = Math.min(dt, 1 / 30);
        var matrixDirty = false;
        for (var i = 0; i < tracerPool.length; i++) {
            var t = tracerPool[i];
            if (!t || t.life <= 0) continue;
            t.life -= simDt;
            t.framesAlive++;

            var step = t.speed * simDt;
            t.traveled += step;
            if (t.traveled > t.maxDistance) t.traveled = t.maxDistance;
            t.head.copy(t.origin).addScaledVector(t.dir, t.traveled);
            var tailTravel = Math.max(0, t.traveled - t.segmentLength);
            t.tail.copy(t.origin).addScaledVector(t.dir, tailTravel);
            tracerMeshMid.copy(t.tail).add(t.head).multiplyScalar(0.5);

            var dead = false;
            if (t.life <= 0) {
                t.life = 0;
                dead = true;
            } else if (t.traveled >= t.maxDistance && t.framesAlive > 1) {
                t.life = 0;
                dead = true;
            }

            if (dead) {
                tracerInstancedMesh.setMatrixAt(i, tracerZeroMatrix);
                matrixDirty = true;
                continue;
            }

            tracerTmpPos.copy(tracerMeshMid);
            tracerTmpQuat.setFromUnitVectors(tracerMeshUp, t.dir);
            tracerTmpScale.set(1, Math.max(0.05, t.segmentLength * 0.82), 1);
            tracerTmpMatrix.compose(tracerTmpPos, tracerTmpQuat, tracerTmpScale);
            tracerInstancedMesh.setMatrixAt(i, tracerTmpMatrix);
            matrixDirty = true;
        }
        if (matrixDirty) tracerInstancedMesh.instanceMatrix.needsUpdate = true;
    };

    GameHitscan.getWeaponCatalog = function () {
        var out = [];
        for (var i = 0; i < weaponCatalogOrder.length; i++) {
            var id = weaponCatalogOrder[i];
            var weapon = weapons[id];
            var weaponDomain = (globalThis.__MAYHEM_RUNTIME.GameWeaponRegistry && globalThis.__MAYHEM_RUNTIME.GameWeaponRegistry.get)
                ? globalThis.__MAYHEM_RUNTIME.GameWeaponRegistry.get(id)
                : null;
            if (!weapon) continue;
            out.push({
                id: weapon.id,
                name: weapon.name,
                primitiveType: weapon.primitiveType || PRIMITIVE_HITSCAN_SINGLE,
                family: weaponDomain ? weaponDomain.family : '',
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

    globalThis.__MAYHEM_RUNTIME.GameHitscan = GameHitscan;
})();
