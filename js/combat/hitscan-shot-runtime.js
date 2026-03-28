/**
 * hitscan-shot-runtime.js - Internal shot solving/runtime for hitscan weapons.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameHitscanShotRuntime
 */
(function () {
    'use strict';

    function create(opts) {
        opts = opts || {};

        var weaponRuntime = opts.weaponRuntime || null;
        var tracerRuntime = opts.tracerRuntime || null;
        if (!weaponRuntime) {
            throw new Error('GameHitscanShotRuntime requires a weapon runtime.');
        }
        if (!tracerRuntime) {
            throw new Error('GameHitscanShotRuntime requires a tracer runtime.');
        }

        var raycaster = new THREE.Raycaster();
        var losRaycaster = new THREE.Raycaster();
        var screenPoint = new THREE.Vector2(0, 0);
        var plasmaForward = new THREE.Vector3();
        var plasmaMuzzle = new THREE.Vector3();
        var tracerMissEnd = new THREE.Vector3();
        var playerForward = new THREE.Vector3();
        var hitFromPlayer = new THREE.Vector3();
        var eyeWorldScratch = new THREE.Vector3();
        var playerPositionScratch = new THREE.Vector3();
        var hitboxBoundsBox = new THREE.Box3();
        var projectedWorldPosScratch = new THREE.Vector3();
        var combatHitboxesScratch = [];
        var lockTargetsScratch = [];

        var TRACER_ORIGIN_FORWARD_OFFSET = 0.12;

        function runtime() {
            return globalThis.__MAYHEM_RUNTIME || {};
        }

        function sharedApi() {
            return runtime().GameShared || {};
        }

        function playerApi() {
            return runtime().GamePlayer || null;
        }

        function worldApi() {
            return runtime().GameWorld || null;
        }

        function netApi() {
            return runtime().GameNet || null;
        }

        function localNowMs(timing) {
            var stamp = Number(timing && timing.localNow);
            if (isFinite(stamp) && stamp >= 0) return stamp;
            if (typeof performance !== 'undefined' && performance && typeof performance.now === 'function') {
                return Number(performance.now()) || 0;
            }
            return Date.now();
        }

        function wallNowMs(timing) {
            var stamp = Number(timing && timing.wallNow);
            if (isFinite(stamp) && stamp >= 0) return stamp;
            return Date.now();
        }

        function appendArrayItems(out, list) {
            if (!list || !list.length) return out;
            for (var i = 0; i < list.length; i++) {
                out.push(list[i]);
            }
            return out;
        }

        function isNetCombatReady() {
            var net = netApi();
            if (!net || !net.isActive || !net.isActive()) return false;
            if (net.isConnected) return !!net.isConnected();
            return true;
        }

        function sharedHitscanAuthority() {
            return sharedApi().hitscanAuthority || null;
        }

        function sharedSeekCore() {
            return sharedApi().seekCore || null;
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
                var candidate = toSeekCandidate(lockTargets[i]);
                if (candidate) candidates.push(candidate);
            }
            var origin = camera.position;
            camera.getWorldDirection(plasmaForward);
            return seekCore.selectSeekTarget({
                origin: { x: origin.x, y: origin.y, z: origin.z },
                forward: { x: plasmaForward.x, y: plasmaForward.y, z: plasmaForward.z },
                candidates: candidates,
                maxRange: maxRange,
                coneHalfAngleDeg: options && typeof options.coneHalfAngleDeg === 'number' ? options.coneHalfAngleDeg : 180,
                ownerTypes: options && options.ownerTypes ? options.ownerTypes : null,
                boxSizePx: boxSizePx,
                viewportWidth: window.innerWidth,
                viewportHeight: window.innerHeight,
                projectToNdc: function (worldPos) {
                    if (!worldPos) return null;
                    var projected = projectedWorldPosScratch.set(
                        Number(worldPos.x || 0),
                        Number(worldPos.y || 0),
                        Number(worldPos.z || 0)
                    ).project(camera);
                    return { x: projected.x, y: projected.y, z: projected.z };
                },
                hasWorldLos: function (worldPos) {
                    return hasLineOfSight(camera, worldPos, maxRange);
                }
            });
        }

        function shouldDrawTracerForShot(_weapon) {
            return true;
        }

        function spawnTracer(camera, weapon, endPoint, originPoint) {
            tracerRuntime.spawnTracer(camera, weapon, endPoint, originPoint);
        }

        function getCombatHitboxes() {
            combatHitboxesScratch.length = 0;
            var net = netApi();
            var netRemote = net && net.remoteEntities ? net.remoteEntities : null;
            if (runtime().GameEnemy && runtime().GameEnemy.getHitboxArray) {
                appendArrayItems(combatHitboxesScratch, runtime().GameEnemy.getHitboxArray() || []);
            }
            if (isNetCombatReady() && net && net.getHitboxArray) {
                appendArrayItems(combatHitboxesScratch, net.getHitboxArray() || []);
                return combatHitboxesScratch;
            }
            if (isNetCombatReady() && netRemote && netRemote.getHitboxArray) {
                appendArrayItems(combatHitboxesScratch, netRemote.getHitboxArray() || []);
            }
            return combatHitboxesScratch;
        }

        function getLockTargets() {
            lockTargetsScratch.length = 0;
            var net = netApi();
            var netView = net && net.view ? net.view : null;

            if (runtime().GameEnemy && runtime().GameEnemy.getLockTargets) {
                appendArrayItems(lockTargetsScratch, runtime().GameEnemy.getLockTargets() || []);
            }
            if (isNetCombatReady() && net && net.getLockTargets) {
                appendArrayItems(lockTargetsScratch, net.getLockTargets() || []);
                if (lockTargetsScratch.length > 0) return lockTargetsScratch;
            }
            if (isNetCombatReady() && netView && netView.getLockTargets) {
                appendArrayItems(lockTargetsScratch, netView.getLockTargets() || []);
            }
            if (lockTargetsScratch.length > 0) return lockTargetsScratch;

            var hitboxes = getCombatHitboxes();
            for (var i = 0; i < hitboxes.length; i++) {
                var hitbox = hitboxes[i];
                if (!hitbox || !hitbox.userData || hitbox.userData.type !== 'body') continue;
                var desc = hitbox.userData.hitscanLockTargetDesc || (hitbox.userData.hitscanLockTargetDesc = {
                    targetId: '',
                    ownerType: 'unknown',
                    worldPos: hitbox.position,
                    hitbox: hitbox,
                    alive: true
                });
                desc.targetId = hitbox.userData.targetId || '';
                desc.ownerType = hitbox.userData.ownerType || 'unknown';
                desc.worldPos = hitbox.position;
                desc.hitbox = hitbox;
                desc.alive = true;
                lockTargetsScratch.push(desc);
            }
            return lockTargetsScratch;
        }

        function worldCollisionBoxes() {
            var world = worldApi();
            var worldMeshes = world && world.getCollidables ? world.getCollidables() : [];
            var out = [];
            for (var i = 0; i < worldMeshes.length; i++) {
                var mesh = worldMeshes[i];
                if (!mesh) continue;
                var box = mesh.userData && mesh.userData.collisionBox ? mesh.userData.collisionBox : null;
                if (!box) {
                    mesh.updateMatrixWorld(true);
                    box = hitboxBoundsBox.setFromObject(mesh);
                }
                if (!box || !box.min || !box.max) continue;
                out.push({
                    min: { x: Number(box.min.x || 0), y: Number(box.min.y || 0), z: Number(box.min.z || 0) },
                    max: { x: Number(box.max.x || 0), y: Number(box.max.y || 0), z: Number(box.max.z || 0) }
                });
            }
            return out;
        }

        function plainBoxFromHitbox(hitbox) {
            if (!hitbox) return null;
            hitbox.updateMatrixWorld(true);
            var box = hitboxBoundsBox.setFromObject(hitbox);
            if (!box || !box.min || !box.max) return null;
            return {
                min: { x: Number(box.min.x || 0), y: Number(box.min.y || 0), z: Number(box.min.z || 0) },
                max: { x: Number(box.max.x || 0), y: Number(box.max.y || 0), z: Number(box.max.z || 0) }
            };
        }

        function authorityTargetFromLockTarget(target) {
            if (!target || !target.worldPos) return null;
            var bodyHitbox = target.bodyHitbox || target.hitbox || null;
            var headHitbox = target.headHitbox || (target.enemyRef && target.enemyRef.headHitbox) || null;
            return {
                targetId: target.targetId || '',
                ownerType: target.ownerType || 'unknown',
                x: Number(target.worldPos.x || 0),
                y: Number(target.worldPos.y || 0),
                z: Number(target.worldPos.z || 0),
                worldPos: target.worldPos && target.worldPos.clone ? target.worldPos.clone() : target.worldPos,
                bodyHitbox: bodyHitbox,
                headHitbox: headHitbox,
                hitbox: bodyHitbox || headHitbox || null,
                enemyRef: target.enemyRef || null,
                bodyBox: plainBoxFromHitbox(bodyHitbox),
                headBox: plainBoxFromHitbox(headHitbox)
            };
        }

        function localAimOrigin(camera) {
            var player = playerApi();
            var eyeWorld = player && player.getEyeWorldPosition
                ? player.getEyeWorldPosition(eyeWorldScratch)
                : null;
            var sharedPoints = sharedApi().entityPoints || {};
            var eyeOrigin = null;
            if (eyeWorld && isFinite(Number(eyeWorld.x)) && isFinite(Number(eyeWorld.y)) && isFinite(Number(eyeWorld.z))) {
                eyeOrigin = {
                    x: Number(eyeWorld.x || 0),
                    y: Number(eyeWorld.y || 0),
                    z: Number(eyeWorld.z || 0)
                };
            } else if (camera && camera.position) {
                eyeOrigin = {
                    x: Number(camera.position.x || 0),
                    y: Number(camera.position.y || 0),
                    z: Number(camera.position.z || 0)
                };
            }
            if (!eyeOrigin) return null;
            if (!camera || !camera.getWorldDirection) return eyeOrigin;
            var cameraForward = new THREE.Vector3();
            camera.getWorldDirection(cameraForward);
            if (sharedPoints.logicalMuzzleOriginFromEye) {
                return sharedPoints.logicalMuzzleOriginFromEye(eyeOrigin, cameraForward);
            }
            return {
                x: eyeOrigin.x + (cameraForward.x * 0.77),
                y: eyeOrigin.y + (cameraForward.y * 0.77),
                z: eyeOrigin.z + (cameraForward.z * 0.77)
            };
        }

        function resolveCrosshairAimPoint(camera, maxDistance) {
            if (!camera || !camera.getWorldDirection) return null;
            var targetsHitboxes = getCombatHitboxes();
            var world = worldApi();
            var worldMeshes = world && world.getCollidables ? world.getCollidables() : [];
            var allTargets = targetsHitboxes.concat(worldMeshes);
            var distance = Math.max(1, Number(maxDistance || 0) || 256);
            screenPoint.set(0, 0);
            raycaster.setFromCamera(screenPoint, camera);
            raycaster.far = distance;
            var intersects = raycaster.intersectObjects(allTargets, false);
            if (intersects.length > 0) {
                return intersects[0].point.clone ? intersects[0].point.clone() : intersects[0].point;
            }
            return raycaster.ray.origin.clone().addScaledVector(raycaster.ray.direction, distance);
        }

        function localAimForward(camera, aimOrigin, maxDistance) {
            if (!camera || !aimOrigin || !camera.getWorldDirection) return null;
            var cameraForward = new THREE.Vector3();
            camera.getWorldDirection(cameraForward);
            var targetPoint = resolveCrosshairAimPoint(camera, maxDistance);
            if (!targetPoint) {
                targetPoint = new THREE.Vector3(
                    Number(camera.position.x || 0),
                    Number(camera.position.y || 0),
                    Number(camera.position.z || 0)
                ).addScaledVector(cameraForward, Math.max(1, Number(maxDistance || 0) || 256));
            }
            var aimDir = targetPoint.sub(new THREE.Vector3(
                Number(aimOrigin.x || 0),
                Number(aimOrigin.y || 0),
                Number(aimOrigin.z || 0)
            ));
            if (aimDir.lengthSq() <= 0.000001 || aimDir.dot(cameraForward) <= 0.0001) {
                return {
                    x: cameraForward.x,
                    y: cameraForward.y,
                    z: cameraForward.z
                };
            }
            aimDir.normalize();
            return {
                x: aimDir.x,
                y: aimDir.y,
                z: aimDir.z
            };
        }

        function resolvePlasmaMuzzle(camera) {
            var player = playerApi();
            if (camera && camera.getWorldDirection) {
                camera.getWorldDirection(plasmaForward);
            }
            if (player && player.getMuzzleWorldPosition) {
                var position = player.getMuzzleWorldPosition(plasmaMuzzle);
                if (position && typeof position.x === 'number') {
                    plasmaMuzzle.copy(position).addScaledVector(plasmaForward, TRACER_ORIGIN_FORWARD_OFFSET);
                    return plasmaMuzzle;
                }
            }
            if (camera && camera.position) {
                plasmaMuzzle.copy(camera.position).addScaledVector(plasmaForward, 0.65 + TRACER_ORIGIN_FORWARD_OFFSET);
                return plasmaMuzzle;
            }
            return null;
        }

        function buildLocalShotContext(camera, weapon, shotToken) {
            if (!camera || !weapon) return null;
            var lockTargets = getLockTargets() || [];
            var targets = [];
            for (var i = 0; i < lockTargets.length; i++) {
                var target = lockTargets[i];
                if (!target || target.alive === false || !target.worldPos) continue;
                var plain = authorityTargetFromLockTarget(target);
                if (plain) targets.push(plain);
            }
            var tracerOrigin = resolvePlasmaMuzzle(camera);
            var aimOrigin = tracerOrigin ? {
                x: Number(tracerOrigin.x || 0),
                y: Number(tracerOrigin.y || 0),
                z: Number(tracerOrigin.z || 0)
            } : localAimOrigin(camera);
            if (!aimOrigin) return null;
            var aimForward = localAimForward(camera, aimOrigin, weaponRuntime.getEffectiveMaxRange(weapon));
            if (!aimForward) {
                camera.getWorldDirection(plasmaForward);
                aimForward = {
                    x: plasmaForward.x,
                    y: plasmaForward.y,
                    z: plasmaForward.z
                };
            }
            return {
                aimOrigin: aimOrigin,
                aimForward: aimForward,
                tracerOrigin: tracerOrigin ? {
                    x: tracerOrigin.x,
                    y: tracerOrigin.y,
                    z: tracerOrigin.z
                } : null,
                weaponStats: weapon,
                falloffBands: weaponRuntime.getWeaponFalloffBands ? weaponRuntime.getWeaponFalloffBands(weapon.id) : [],
                adsActive: weaponRuntime.isAdsActiveForWeapon(weapon.id),
                viewFovDeg: weaponRuntime.getViewFovDeg(),
                shotToken: String(shotToken || ''),
                targets: targets,
                worldBoxes: worldCollisionBoxes()
            };
        }

        function resolveAutoLockPreview(camera, weapon) {
            var authority = sharedHitscanAuthority();
            if (!camera || !weapon || !authority || !authority.resolveAutoLockPreview) return null;
            var options = buildLocalShotContext(camera, weapon, 'preview');
            if (!options) return null;
            return authority.resolveAutoLockPreview(options);
        }

        function resolveAutoLockShotFromContext(shotContext) {
            var authority = sharedHitscanAuthority();
            if (!shotContext || !authority || !authority.resolveHitscanShot) return [];
            return authority.resolveHitscanShot(shotContext);
        }

        function shouldPredictNetHit(camera, hitboxMesh, shotToken, pelletIndex) {
            if (!camera || !hitboxMesh || !hitboxMesh.userData || hitboxMesh.userData.ownerType !== 'net') return true;
            if (!isNetCombatReady()) return false;
            var authority = sharedHitscanAuthority();
            if (!authority || !authority.resolveHitscanShot) return true;
            var weapon = weaponRuntime.getCurrentWeaponData();
            if (!weapon) return true;
            var shotContext = buildLocalShotContext(camera, weapon, shotToken);
            if (!shotContext) return false;
            var predicted = authority.resolveHitscanShot(shotContext);
            if (!Array.isArray(predicted) || predicted.length === 0) return false;
            var expectedTargetId = String(hitboxMesh.userData.targetId || '');
            var expectedNetEntityId = String(hitboxMesh.userData.netEntityId || '');
            var expectedPelletIndex = Number.isFinite(Number(pelletIndex)) ? Math.max(0, Math.floor(Number(pelletIndex))) : null;
            for (var i = 0; i < predicted.length; i++) {
                var shot = predicted[i];
                var target = shot && shot.target ? shot.target : null;
                var targetId = String(target && target.targetId || '');
                if (expectedPelletIndex != null) {
                    var predictedPelletIndex = Number.isFinite(Number(shot && shot.pelletIndex)) ? Math.max(0, Math.floor(Number(shot.pelletIndex))) : null;
                    if (predictedPelletIndex !== expectedPelletIndex) continue;
                }
                if (expectedTargetId && targetId === expectedTargetId) return true;
                if (expectedNetEntityId && targetId === ('net:' + expectedNetEntityId)) return true;
            }
            return false;
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
            var world = worldApi();
            var worldMeshes = world && world.getCollidables ? world.getCollidables() : [];
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
                var target = lockTargets[i];
                if (!target || target.alive === false || !target.worldPos) continue;
                if (!lockTargetPassesFilter(target, options)) continue;
                filtered.push(target);
            }
            var lock = selectSeekLock(camera, maxRange, boxSizePx, {
                coneHalfAngleDeg: 180,
                targetsList: filtered
            });
            return lock && lock.candidate ? lock.candidate.rawTarget : null;
        }

        function selectSeekTargetByRect(camera, maxRange, boxWidthPx, boxHeightPx, options) {
            if (!camera) return null;
            var seekCore = sharedSeekCore();
            if (!seekCore || !seekCore.selectSeekTarget) return null;
            var lockTargets = getLockTargets() || [];
            var filtered = [];
            for (var i = 0; i < lockTargets.length; i++) {
                var target = lockTargets[i];
                if (!target || target.alive === false || !target.worldPos) continue;
                if (!lockTargetPassesFilter(target, options)) continue;
                filtered.push(target);
            }
            var origin = camera.position;
            camera.getWorldDirection(plasmaForward);
            var lock = seekCore.selectSeekTarget({
                origin: { x: origin.x, y: origin.y, z: origin.z },
                forward: { x: plasmaForward.x, y: plasmaForward.y, z: plasmaForward.z },
                candidates: filtered.map(toSeekCandidate).filter(Boolean),
                maxRange: maxRange,
                coneHalfAngleDeg: 180,
                preferScreenCenter: true,
                boxWidthPx: boxWidthPx,
                boxHeightPx: boxHeightPx,
                viewportWidth: window.innerWidth,
                viewportHeight: window.innerHeight,
                projectToNdc: function (worldPos) {
                    if (!worldPos) return null;
                    var projected = projectedWorldPosScratch.set(
                        Number(worldPos.x || 0),
                        Number(worldPos.y || 0),
                        Number(worldPos.z || 0)
                    ).project(camera);
                    return { x: projected.x, y: projected.y, z: projected.z };
                },
                hasWorldLos: function (worldPos) {
                    return hasLineOfSight(camera, worldPos, maxRange);
                }
            });
            return lock && lock.candidate ? lock.candidate.rawTarget : null;
        }

        function traceSinglePellet(camera, weapon, pelletIndex, shotToken) {
            var targetsHitboxes = getCombatHitboxes();
            var world = worldApi();
            var worldMeshes = world && world.getCollidables ? world.getCollidables() : [];
            var allTargets = targetsHitboxes.concat(worldMeshes);
            var ndcOffset = weaponRuntime.getWeaponSpreadNdcOffset(weapon, pelletIndex, shotToken);
            var pelletScore = (ndcOffset.x * ndcOffset.x) + (ndcOffset.y * ndcOffset.y);
            var effectiveRange = weaponRuntime.getEffectiveMaxRange(weapon);

            screenPoint.set(ndcOffset.x, ndcOffset.y);
            raycaster.setFromCamera(screenPoint, camera);
            raycaster.far = effectiveRange;

            var intersects = raycaster.intersectObjects(allTargets, false);
            if (intersects.length === 0) {
                tracerMissEnd.copy(raycaster.ray.origin).addScaledVector(raycaster.ray.direction, effectiveRange);
                return {
                    hit: false,
                    traceEnd: tracerMissEnd.clone(),
                    pelletScore: pelletScore
                };
            }

            var hit = intersects[0];
            if (targetsHitboxes.indexOf(hit.object) === -1) {
                return {
                    hit: false,
                    traceEnd: hit.point.clone ? hit.point.clone() : hit.point,
                    pelletScore: pelletScore
                };
            }

            var player = playerApi();
            if (player && player.getRotation && player.getPosition) {
                var playerRot = player.getRotation();
                var playerPos = player.getPosition(playerPositionScratch);
                playerForward.set(-Math.sin(playerRot.yaw || 0), 0, -Math.cos(playerRot.yaw || 0));
                hitFromPlayer.copy(hit.point).sub(playerPos).setY(0);
                if (hitFromPlayer.lengthSq() > 0.0001) {
                    hitFromPlayer.normalize();
                    if (playerForward.dot(hitFromPlayer) <= 0.1) {
                        return {
                            hit: false,
                            traceEnd: hit.point.clone ? hit.point.clone() : hit.point,
                            pelletScore: pelletScore
                        };
                    }
                }
            }

            var hitType = hit.object.userData.type || 'body';
            var damage = weaponRuntime.getDamageForType(weapon, hitType);
            damage = weaponRuntime.applyDistanceFalloff(weapon, damage, hit.distance);

            return {
                hit: true,
                hitbox: hit.object,
                hitPoint: hit.point.clone ? hit.point.clone() : hit.point,
                distance: hit.distance,
                hitType: hitType,
                damage: damage,
                pelletIndex: Number(pelletIndex || 0),
                pelletScore: pelletScore,
                traceEnd: hit.point.clone ? hit.point.clone() : hit.point
            };
        }

        function fireSinglePellet(camera, weapon, pelletIndex, onHit, onTrace, shotToken) {
            var traced = traceSinglePellet(camera, weapon, pelletIndex, shotToken);
            if (!traced) return false;
            if (onTrace && traced.traceEnd) onTrace(traced.traceEnd);
            if (!traced.hit) return false;
            if (onHit) {
                onHit(traced.hitbox, traced.hitPoint, traced.distance, traced.hitType, traced.damage, weapon, traced.pelletIndex);
            }
            return true;
        }

        function fireHitscanPattern(camera, weapon, onHit, onMiss, shotToken) {
            var pellets = weapon.pellets || 1;
            var anyHit = false;
            var drawTracersForShot = shouldDrawTracerForShot(weapon);
            var shotgunTracerCap = 8;
            var tracerOrigin = resolvePlasmaMuzzle(camera);
            for (var i = 0; i < pellets; i++) {
                var shouldTraceThisPellet = drawTracersForShot && (weapon.id !== 'shotgun' || i < shotgunTracerCap);
                var hit = fireSinglePellet(
                    camera,
                    weapon,
                    i,
                    onHit,
                    shouldTraceThisPellet ? function (traceEnd) {
                        spawnTracer(camera, weapon, traceEnd, tracerOrigin);
                    } : null,
                    shotToken
                );
                anyHit = anyHit || hit;
            }
            if (!anyHit && onMiss) onMiss();
            return true;
        }

        function autoLockMissPoint(camera, weapon) {
            if (!camera || !weapon) return null;
            var effectiveRange = weaponRuntime.getEffectiveMaxRange(weapon);
            var muzzle = resolvePlasmaMuzzle(camera);
            if (!muzzle) return null;
            camera.getWorldDirection(plasmaForward);
            losRaycaster.set(muzzle, plasmaForward);
            losRaycaster.far = effectiveRange;
            var world = worldApi();
            var worldMeshes = world && world.getCollidables ? world.getCollidables() : [];
            var hits = losRaycaster.intersectObjects(worldMeshes, false);
            if (hits.length > 0 && hits[0] && hits[0].point) return hits[0].point;
            return muzzle.clone().addScaledVector(plasmaForward, effectiveRange);
        }

        function fireAutoLockShot(camera, weapon, onHit, onMiss, shotToken) {
            var shotContext = buildLocalShotContext(camera, weapon, shotToken);
            var shots = resolveAutoLockShotFromContext(shotContext);
            var tracerOrigin = shotContext && shotContext.tracerOrigin ? shotContext.tracerOrigin : resolvePlasmaMuzzle(camera);
            if (!shots || shots.length === 0) {
                var missPoint = autoLockMissPoint(camera, weapon);
                if (missPoint) spawnTracer(camera, weapon, missPoint, tracerOrigin);
                if (onMiss) onMiss();
                return true;
            }

            var shot = shots[0];
            var target = shot && shot.target ? shot.target : null;
            var hitbox = target
                ? (shot.hitType === 'head'
                    ? (target.headHitbox || target.hitbox || target.bodyHitbox || null)
                    : (target.bodyHitbox || target.hitbox || target.headHitbox || null))
                : null;

            if (shot.point) {
                spawnTracer(
                    camera,
                    weapon,
                    new THREE.Vector3(shot.point.x, shot.point.y, shot.point.z),
                    tracerOrigin
                );
            }
            if (onHit && hitbox && shot.point) {
                onHit(
                    hitbox,
                    new THREE.Vector3(shot.point.x, shot.point.y, shot.point.z),
                    Number(shot.distance || 0),
                    shot.hitType || 'body',
                    Number(shot.damage || 0),
                    weapon
                );
            } else if (!hitbox && onMiss) {
                onMiss();
            }
            return true;
        }

        function castCenter(camera, maxRange) {
            var hitboxes = getCombatHitboxes();
            var world = worldApi();
            var worldMeshes = world && world.getCollidables ? world.getCollidables() : [];
            var allTargets = hitboxes.concat(worldMeshes);
            if (allTargets.length === 0) return null;

            screenPoint.set(0, 0);
            raycaster.setFromCamera(screenPoint, camera);
            raycaster.far = maxRange;

            var hits = raycaster.intersectObjects(allTargets, false);
            if (hits.length === 0) return null;
            for (var i = 0; i < hits.length; i++) {
                var hit = hits[i];
                if (hitboxes.indexOf(hit.object) !== -1) {
                    return {
                        hitbox: hit.object,
                        hitType: hit.object.userData.type || 'body',
                        targetId: hit.object.userData.targetId || '',
                        distance: hit.distance,
                        point: hit.point
                    };
                }
                if (worldMeshes.indexOf(hit.object) !== -1) return null;
            }
            return null;
        }

        function fire(camera, onHit, onMiss, shotToken, timing) {
            var weapon = weaponRuntime.getCurrentWeaponData();
            if (!weapon) return false;
            var ammoInMag = weapon.magazineSize > 0 ? weaponRuntime.getAmmoInMag(weapon, timing) : 0;
            if (weapon.magazineSize > 0 && ammoInMag <= 0) {
                return false;
            }
            if (weaponRuntime.isReloadingWeapon(weapon, timing) && ammoInMag <= 0) {
                return false;
            }
            if (weapon.id === 'sniper' && !weaponRuntime.isAdsActiveForWeapon('sniper')) {
                return false;
            }
            if (weaponRuntime.getCooldownRemaining(timing) > 0) {
                return false;
            }

            weaponRuntime.markLocalShotFired(timing);
            var fired = weaponRuntime.getAutoLockConfig(weapon)
                ? fireAutoLockShot(camera, weapon, onHit, onMiss, shotToken)
                : fireHitscanPattern(camera, weapon, onHit, onMiss, shotToken);
            if (fired) {
                weaponRuntime.consumeAmmoForShot(weapon, timing);
            }
            return fired;
        }

        function canFire(timing) {
            var weapon = weaponRuntime.getCurrentWeaponData();
            if (!weapon) return false;
            var ammoInMag = weapon.magazineSize > 0 ? weaponRuntime.getAmmoInMag(weapon, timing) : 0;
            if (weapon.magazineSize > 0 && ammoInMag <= 0) {
                return false;
            }
            if (weaponRuntime.isReloadingWeapon(weapon, timing) && ammoInMag <= 0) return false;
            if (weapon.id === 'sniper' && !weaponRuntime.isAdsActiveForWeapon('sniper')) return false;
            return weaponRuntime.getCooldownRemaining(timing) <= 0;
        }

        function peekCenterTarget(camera, maxRange) {
            var weapon = weaponRuntime.getCurrentWeaponData();
            if (!weapon) return null;
            var range = (typeof maxRange === 'number' && maxRange > 0) ? maxRange : weaponRuntime.getEffectiveMaxRange(weapon);
            return castCenter(camera, range);
        }

        function peekAutoLockTarget(camera) {
            var weapon = weaponRuntime.getCurrentWeaponData();
            if (!weaponRuntime.getAutoLockConfig(weapon)) return null;
            var preview = resolveAutoLockPreview(camera, weapon);
            if (!preview || preview.kind !== 'lock' || !preview.target) return null;
            return {
                targetId: preview.target.targetId || '',
                ownerType: preview.target.ownerType || 'unknown',
                worldPos: preview.body && preview.body.point
                    ? new THREE.Vector3(preview.body.point.x, preview.body.point.y, preview.body.point.z)
                    : (preview.target.worldPos && preview.target.worldPos.clone ? preview.target.worldPos.clone() : null),
                hitbox: preview.target.bodyHitbox || preview.target.hitbox || null,
                enemyRef: preview.target.enemyRef || null
            };
        }

        function getReticleTargetPreview(camera) {
            var weapon = weaponRuntime.getCurrentWeaponData();
            if (!weapon || !camera) {
                return {
                    currentAimTargetId: '',
                    reticleTarget: {
                        group: 'crosshair',
                        active: false
                    }
                };
            }

            var reticleSpec = weaponRuntime.getReticleSpec(weapon.id) || {
                targetGroup: 'crosshair',
                targetSource: 'center'
            };
            var centerTarget = peekCenterTarget(camera);
            var areaTarget = reticleSpec.targetSource === 'lock'
                ? peekAutoLockTarget(camera)
                : null;
            var activeTarget = reticleSpec.targetSource === 'lock'
                ? areaTarget
                : centerTarget;

            return {
                currentAimTargetId: activeTarget && activeTarget.targetId ? activeTarget.targetId : '',
                reticleTarget: {
                    group: reticleSpec.targetGroup || 'crosshair',
                    active: !!(activeTarget && activeTarget.hitbox)
                }
            };
        }

        function buildNetworkFireIntent(shotToken) {
            var player = playerApi();
            var camera = player && player.getCamera ? player.getCamera() : null;
            var weapon = weaponRuntime.getCurrentWeaponData();
            if (!camera || !weapon) return null;
            var shotContext = buildLocalShotContext(camera, weapon, shotToken);
            if (!shotContext) return null;
            return {
                weaponId: weapon.id,
                aimOrigin: shotContext.aimOrigin,
                aimForward: shotContext.aimForward,
                adsActive: !!shotContext.adsActive,
                viewFovDeg: Number(shotContext.viewFovDeg || 0)
            };
        }

        return {
            fire: fire,
            canFire: canFire,
            peekCenterTarget: peekCenterTarget,
            peekAutoLockTarget: peekAutoLockTarget,
            getReticleTargetPreview: getReticleTargetPreview,
            selectLockTargetByBox: function (camera, maxRange, boxSizePx, options) {
                if (!camera) return null;
                var weapon = weaponRuntime.getCurrentWeaponData();
                var range = (typeof maxRange === 'number' && maxRange > 0)
                    ? maxRange
                    : weaponRuntime.getEffectiveMaxRange(weapon);
                var size = (typeof boxSizePx === 'number' && boxSizePx > 1) ? boxSizePx : 60;
                var target = selectSeekTargetByBox(camera, range, size, options || null);
                if (!target) return null;
                return {
                    targetId: target.targetId || '',
                    ownerType: target.ownerType || 'unknown',
                    worldPos: target.worldPos && target.worldPos.clone ? target.worldPos.clone() : null,
                    hitbox: target.hitbox || null,
                    bodyHitbox: target.bodyHitbox || target.hitbox || null,
                    headHitbox: target.headHitbox || null,
                    enemyRef: target.enemyRef || null
                };
            },
            selectLockTargetByRect: function (camera, maxRange, boxWidthPx, boxHeightPx, options) {
                if (!camera) return null;
                var weapon = weaponRuntime.getCurrentWeaponData();
                var range = (typeof maxRange === 'number' && maxRange > 0)
                    ? maxRange
                    : weaponRuntime.getEffectiveMaxRange(weapon);
                var width = (typeof boxWidthPx === 'number' && boxWidthPx > 1) ? boxWidthPx : 60;
                var height = (typeof boxHeightPx === 'number' && boxHeightPx > 1) ? boxHeightPx : 180;
                var target = selectSeekTargetByRect(camera, range, width, height, options || null);
                if (!target) return null;
                return {
                    targetId: target.targetId || '',
                    ownerType: target.ownerType || 'unknown',
                    worldPos: target.worldPos && target.worldPos.clone ? target.worldPos.clone() : null,
                    hitbox: target.hitbox || null,
                    bodyHitbox: target.bodyHitbox || target.hitbox || null,
                    headHitbox: target.headHitbox || null,
                    enemyRef: target.enemyRef || null
                };
            },
            shouldPredictNetHit: shouldPredictNetHit,
            buildNetworkFireIntent: buildNetworkFireIntent,
            localNowMs: localNowMs,
            wallNowMs: wallNowMs
        };
    }

    globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    globalThis.__MAYHEM_RUNTIME.GameHitscanShotRuntime = {
        create: create
    };
})();
