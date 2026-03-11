/**
 * throwables.js - Frag/plasma/molotov/knife logic with regen inventory
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameThrowables
 */
(function () {
    'use strict';

    var GameThrowables = {};

    var sceneRef = null;
    var projectiles = [];
    var fireZones = [];
    var impactFlashes = [];
    var netProjectileMap = {};
    var netFireZoneMap = {};
    var predictedByClientId = {};
    var localThrowSeq = 1;
    var debugInstantCooldowns = false;
    var debugPreviewVolumesEnabled = false;
    var debugTelemetry = {
        lastIntent: null,
        lastAckClientThrowId: '',
        lastRejectClientThrowId: '',
        lastReconcileClientThrowId: '',
        predictedCount: 0
    };

    var raycaster = new THREE.Raycaster();
    var centerPoint = new THREE.Vector2(0, 0);
    var tmpForward = new THREE.Vector3();
    var tmpRight = new THREE.Vector3();
    var tmpUp = new THREE.Vector3();
    var tmpStart = new THREE.Vector3();
    var tmpEnd = new THREE.Vector3();
    var tmpDir = new THREE.Vector3();
    var tmpTarget = new THREE.Vector3();
    var tmpNetVec = new THREE.Vector3();
    var tmpForwardAxis = new THREE.Vector3(0, 0, -1);
    var tmpSpinAxis = new THREE.Vector3(0, 0, 1);
    var trajPos = new THREE.Vector3();
    var trajVel = new THREE.Vector3();
    var trajStart = new THREE.Vector3();
    var trajEnd = new THREE.Vector3();
    var trajectoryPreview = {
        dotsNear: null,
        dotsFar: null,
        impact: null,
        areaSphere: null,
        areaDisk: null,
        activeType: ''
    };
    var trajectoryPreviewTuning = {
        stepSec: 1 / 60,
        maxPoints: 120,
        maxPreviewTime: 4.0,
        hiddenStartDistance: 3.75,
        pointStrideNear: 4,
        pointStrideFar: 6,
        aimPitchBoost: 1.5
    };
    var throwableDistanceTuning = (globalThis.__MAYHEM_RUNTIME.GameCombatTuning && globalThis.__MAYHEM_RUNTIME.GameCombatTuning.getThrowableDistanceTuning)
        ? globalThis.__MAYHEM_RUNTIME.GameCombatTuning.getThrowableDistanceTuning()
        : {
            fragRadius: 5.4,
            plasmaRadius: 5.0,
            missileRadius: 2.4,
            molotovFireRadius: 3.2,
            plasmaAcquireRange: 18,
            plasmaAcquireHalfAngleDeg: 35,
            plasmaStickExplodeDelay: 0.65
        };
    var throwableMechanicsTuning = (globalThis.__MAYHEM_RUNTIME.GameCombatTuning && globalThis.__MAYHEM_RUNTIME.GameCombatTuning.getThrowableMechanicsTuning)
        ? globalThis.__MAYHEM_RUNTIME.GameCombatTuning.getThrowableMechanicsTuning()
        : {
            aimRayRange: 100,
            fragBounceMaxCount: 2,
            fragBounceVelocityDamping: 0.4,
            fragBounceVerticalDamping: 0.42,
            fragBounceStopSpeedSq: 2.5,
            predictedTtlMs: 5000,
            throwIntentOriginMaxOffset: 1.2,
            throwIntentDirectionMinDot: -0.2
        };

    var sharedTuning = (globalThis.__MAYHEM_RUNTIME.GameShared && globalThis.__MAYHEM_RUNTIME.GameShared.gameplayTuning) || {};
    var sharedThrowables = sharedTuning.throwables || {};
    var throwableOrder = (sharedThrowables.order && sharedThrowables.order.slice()) || ['frag', 'plasma', 'molotov', 'knife'];
    var throwableCategories = sharedTuning.throwableCategories || {
        grenade: { label: 'Grenades', items: ['frag', 'plasma', 'molotov'], previewType: 'trajectory' },
        blade:   { label: 'Blades & Objects', items: ['knife'], previewType: 'none' }
    };
    var selectedThrowableId = 'frag';

    function buildDefsFromShared() {
        var out = {};
        var ids = ['frag', 'plasma', 'missile', 'molotov', 'knife'];
        for (var i = 0; i < ids.length; i++) {
            var id = ids[i];
            var src = sharedThrowables[id];
            if (!src) continue;
            var def = {};
            for (var k in src) {
                if (Object.prototype.hasOwnProperty.call(src, k)) def[k] = src[k];
            }
            if (id === 'frag') def.radius = throwableDistanceTuning.fragRadius;
            if (id === 'plasma') {
                def.radius = throwableDistanceTuning.plasmaRadius;
                def.acquireHalfAngleDeg = throwableDistanceTuning.plasmaAcquireHalfAngleDeg || def.acquireHalfAngleDeg || 35;
                def.stickExplodeDelay = throwableDistanceTuning.plasmaStickExplodeDelay || def.stickExplodeDelay || 0.65;
            }
            if (id === 'missile') def.radius = throwableDistanceTuning.missileRadius;
            if (id === 'molotov') def.fireRadius = throwableDistanceTuning.molotovFireRadius;
            out[id] = def;
        }
        return out;
    }
    var defs = buildDefsFromShared();

    var inventory = {};

    function resetInventory() {
        inventory = {};
        for (var i = 0; i < throwableOrder.length; i++) {
            var id = throwableOrder[i];
            inventory[id] = {
                charges: 1,
                maxCharges: 1,
                cooldownRemaining: 0
            };
        }
    }

    function getWorldTargets() {
        var worldMeshes = globalThis.__MAYHEM_RUNTIME.GameWorld.getCollidables ? globalThis.__MAYHEM_RUNTIME.GameWorld.getCollidables() : [];
        var hitboxes = globalThis.__MAYHEM_RUNTIME.GameEnemy.getHitboxArray ? globalThis.__MAYHEM_RUNTIME.GameEnemy.getHitboxArray() : [];
        return {
            worldMeshes: worldMeshes || [],
            hitboxes: hitboxes || []
        };
    }

    function getThrowableState() {
        var out = {};
        for (var i = 0; i < throwableOrder.length; i++) {
            var id = throwableOrder[i];
            var inv = inventory[id];
            out[id] = {
                id: id,
                label: defs[id].label,
                charges: inv.charges,
                maxCharges: inv.maxCharges,
                cooldownRemaining: inv.cooldownRemaining
            };
        }
        return out;
    }

    function consumeCharge(type) {
        var inv = inventory[type];
        if (!inv || inv.charges <= 0) return false;
        inv.charges--;
        if (debugInstantCooldowns) {
            inv.charges = inv.maxCharges;
            inv.cooldownRemaining = 0;
        } else if (inv.charges < inv.maxCharges && inv.cooldownRemaining <= 0) {
            inv.cooldownRemaining = defs[type].regen;
        }
        return true;
    }

    function regenCharges(dt) {
        for (var i = 0; i < throwableOrder.length; i++) {
            var id = throwableOrder[i];
            var inv = inventory[id];
            if (!inv || inv.charges >= inv.maxCharges) continue;

            inv.cooldownRemaining -= dt;
            if (inv.cooldownRemaining <= 0) {
                inv.charges++;
                if (inv.charges < inv.maxCharges) {
                    inv.cooldownRemaining += defs[id].regen;
                } else {
                    inv.cooldownRemaining = 0;
                }
            }
        }
    }

    function refillExplosives() {
        var ids = ['frag', 'plasma', 'molotov'];
        for (var i = 0; i < ids.length; i++) {
            var inv = inventory[ids[i]];
            if (!inv) continue;
            inv.charges = inv.maxCharges;
            inv.cooldownRemaining = 0;
        }
    }

    function createThrowableMesh(type) {
        if (type === 'frag') {
            return new THREE.Mesh(
                new THREE.BoxGeometry(0.18, 0.18, 0.18),
                new THREE.MeshLambertMaterial({ color: 0x2f7f2f })
            );
        }
        if (type === 'plasma' || type === 'missile') {
            var color = (type === 'missile') ? 0xffb066 : 0x22aabb;
            var emissive = (type === 'missile') ? 0x442200 : 0x112222;
            return new THREE.Mesh(
                new THREE.BoxGeometry(0.2, 0.2, 0.2),
                new THREE.MeshLambertMaterial({ color: color, emissive: emissive })
            );
        }
        if (type === 'molotov') {
            var group = new THREE.Group();
            var bottle = new THREE.Mesh(
                new THREE.BoxGeometry(0.15, 0.22, 0.15),
                new THREE.MeshLambertMaterial({ color: 0x6d3f1f })
            );
            bottle.position.y = 0.01;
            group.add(bottle);
            var rag = new THREE.Mesh(
                new THREE.BoxGeometry(0.08, 0.06, 0.08),
                new THREE.MeshLambertMaterial({ color: 0xffaa33 })
            );
            rag.position.y = 0.14;
            group.add(rag);
            return group;
        }
        // knife
        var knife = new THREE.Mesh(
            new THREE.BoxGeometry(0.04, 0.04, 0.45),
            new THREE.MeshLambertMaterial({ color: 0xbfc5ca })
        );
        knife.rotation.x = Math.PI / 2;
        return knife;
    }

    function removeNetProjectileById(id) {
        var entry = netProjectileMap[id];
        if (!entry) return;
        if (entry.mesh && entry.mesh.parent) entry.mesh.parent.remove(entry.mesh);
        delete netProjectileMap[id];
    }

    function removeNetFireZoneById(id) {
        var zone = netFireZoneMap[id];
        if (!zone) return;
        if (zone.mesh && zone.mesh.parent) zone.mesh.parent.remove(zone.mesh);
        delete netFireZoneMap[id];
    }

    function buildFireZoneMesh(radius) {
        var root = new THREE.Group();
        var disk = new THREE.Mesh(
            new THREE.CylinderGeometry(radius, radius, 0.08, 16),
            new THREE.MeshBasicMaterial({
                color: 0xff7733,
                transparent: true,
                opacity: 0.45
            })
        );
        root.add(disk);

        var assetFactory = globalThis.__MAYHEM_RUNTIME.GameAssetFactory || null;
        if (assetFactory && assetFactory.createParticleAsset) {
            var flame = assetFactory.createParticleAsset('fire', { color: 0xff8833 });
            if (flame) {
                flame.position.y = 0.18;
                flame.scale.set(Math.max(0.85, radius * 0.26), Math.max(0.85, radius * 0.34), Math.max(0.85, radius * 0.26));
                root.add(flame);
            }
        }

        return root;
    }

    function collectFadeMaterials(root) {
        var mats = [];

        function push(mat) {
            if (!mat) return;
            if (Array.isArray(mat)) {
                for (var i = 0; i < mat.length; i++) push(mat[i]);
                return;
            }
            if (mats.indexOf(mat) !== -1) return;
            mat.transparent = true;
            mats.push(mat);
        }

        if (!root) return mats;
        if (root.material) push(root.material);
        if (root.traverse) {
            root.traverse(function (node) {
                if (!node || !node.material) return;
                push(node.material);
            });
        }
        return mats;
    }

    function spawnFlashObject(object3d, position, baseScale, life, options) {
        if (!sceneRef || !object3d) return;
        options = options || {};
        var fadeMaterials = collectFadeMaterials(object3d);
        object3d.position.copy(position);
        object3d.scale.set(baseScale, baseScale, baseScale);
        sceneRef.add(object3d);
        impactFlashes.push({
            mesh: object3d,
            materials: fadeMaterials,
            baseMaterialOpacities: fadeMaterials.map(function (mat) {
                return (typeof mat.opacity === 'number') ? mat.opacity : 1;
            }),
            life: life,
            maxLife: life,
            startScale: Number(baseScale || 0.2),
            endScale: Number(options.endScale || (baseScale * 2.0)),
            startOpacity: Number(options.opacity || 0.85)
        });
    }

    function spawnFlash(position, color, baseScale, life, options) {
        options = options || {};
        var flash = new THREE.Mesh(
            new THREE.SphereGeometry(Number(options.geometryRadius || 0.4), 8, 8),
            new THREE.MeshBasicMaterial({
                color: color,
                transparent: true,
                opacity: Number(options.opacity || 0.85),
                wireframe: !!options.wireframe,
                depthTest: options.depthTest !== false,
                depthWrite: !!options.depthWrite
            })
        );
        spawnFlashObject(flash, position, baseScale, life, options);
    }

    function spawnExplosionBurst(position, color, radius) {
        var blastRadius = Math.max(0.6, Number(radius || 1.2));
        spawnFlash(position, color, Math.max(0.28, blastRadius * 0.18), 0.18, {
            endScale: Math.max(0.9, blastRadius * 0.8),
            opacity: 0.92,
            depthTest: false
        });
        spawnFlash(position, color, Math.max(0.18, blastRadius * 0.12), 0.26, {
            geometryRadius: 0.5,
            endScale: Math.max(1.4, blastRadius * 2.05),
            opacity: 0.3,
            wireframe: true,
            depthTest: false
        });

        var assetFactory = globalThis.__MAYHEM_RUNTIME.GameAssetFactory || null;
        if (assetFactory && assetFactory.createParticleAsset) {
            var sparks = assetFactory.createParticleAsset('sparks', { color: color });
            if (sparks) {
                spawnFlashObject(sparks, position, Math.max(0.4, blastRadius * 0.24), 0.16, {
                    endScale: Math.max(0.95, blastRadius * 0.9),
                    opacity: 0.92
                });
            }
            var fire = assetFactory.createParticleAsset('fire', { color: color });
            if (fire) {
                spawnFlashObject(fire, position, Math.max(0.24, blastRadius * 0.15), 0.22, {
                    endScale: Math.max(1.15, blastRadius * 1.35),
                    opacity: 0.74
                });
            }
        }
    }

    function getDefaultThrowOrigin(camera, forward, right, up) {
        var hand = null;
        if (globalThis.__MAYHEM_RUNTIME.GamePlayer && globalThis.__MAYHEM_RUNTIME.GamePlayer.getThrowableOriginWorldPosition) {
            hand = globalThis.__MAYHEM_RUNTIME.GamePlayer.getThrowableOriginWorldPosition();
        }
        if (hand && typeof hand.x === 'number' && typeof hand.y === 'number' && typeof hand.z === 'number') {
            return hand.clone();
        }
        return camera.position.clone()
            .addScaledVector(forward, 0.75)
            .addScaledVector(right, 0.2)
            .addScaledVector(up, -0.15);
    }

    function buildThrowIntent(camera, options) {
        if (!camera) return null;
        options = options || {};

        camera.getWorldDirection(tmpForward);
        tmpRight.set(1, 0, 0).applyQuaternion(camera.quaternion);
        tmpUp.set(0, 1, 0).applyQuaternion(camera.quaternion);

        var origin = options.origin
            ? options.origin.clone()
            : getDefaultThrowOrigin(camera, tmpForward, tmpRight, tmpUp);

        var direction = null;
        var aimPoint = null;
        var rayRange = Math.max(1, Number(throwableMechanicsTuning.aimRayRange || 100));

        if (options.direction) {
            direction = options.direction.clone().normalize();
            aimPoint = origin.clone().addScaledVector(direction, rayRange);
        } else {
            var targets = getWorldTargets();
            var allTargets = targets.hitboxes.concat(targets.worldMeshes);
            if (allTargets.length > 0) {
                raycaster.setFromCamera(centerPoint, camera);
                raycaster.far = rayRange;
                var hits = raycaster.intersectObjects(allTargets, false);
                if (hits.length > 0) {
                    aimPoint = hits[0].point.clone();
                }
            }
            if (!aimPoint) {
                aimPoint = camera.position.clone().addScaledVector(tmpForward, rayRange);
            }
            direction = aimPoint.clone().sub(origin).normalize();
        }

        if (!direction || !isFinite(direction.x) || !isFinite(direction.y) || !isFinite(direction.z) || direction.lengthSq() < 0.00001) {
            direction = tmpForward.clone();
        }

        var intent = {
            origin: origin,
            direction: direction.normalize(),
            aimPoint: aimPoint ? aimPoint.clone() : origin.clone().addScaledVector(direction, rayRange),
            rayRange: rayRange
        };
        debugTelemetry.lastIntent = {
            origin: { x: intent.origin.x, y: intent.origin.y, z: intent.origin.z },
            direction: { x: intent.direction.x, y: intent.direction.y, z: intent.direction.z },
            aimPoint: intent.aimPoint ? { x: intent.aimPoint.x, y: intent.aimPoint.y, z: intent.aimPoint.z } : null
        };
        return intent;
    }

    function buildThrowVelocity(def, intent, useExplicitDirection) {
        if (!def || !intent || !intent.direction) return null;

        var baseDir = intent.direction.clone().normalize();
        var aimPitchBoost = Math.max(0, Number(trajectoryPreviewTuning.aimPitchBoost || 1));
        if (baseDir.y > 0 && aimPitchBoost !== 1) {
            baseDir.y *= aimPitchBoost;
            baseDir.normalize();
        }

        var speed = Math.max(0, Number(def.speed || 0));
        var upward = Math.max(0, Number(def.upward || 0));
        var vel = baseDir.multiplyScalar(speed);
        vel.y += useExplicitDirection ? (upward * 0.15) : upward;
        return vel;
    }

    function spawnProjectile(type, camera, options) {
        if (!sceneRef || !camera) return false;
        var def = defs[type];
        if (!def) return false;
        options = options || {};

        var intent = options.intent || buildThrowIntent(camera, options);
        if (!intent || !intent.origin || !intent.direction) return false;
        var origin = intent.origin.clone();
        var baseDir = intent.direction.clone().normalize();
        var vel = buildThrowVelocity(def, intent, !!options.direction);
        if (!vel) return false;

        var mesh = createThrowableMesh(type);
        mesh.position.copy(origin);
        sceneRef.add(mesh);

        projectiles.push({
            type: type,
            mesh: mesh,
            velocity: vel,
            launchDir: baseDir.clone().normalize(),
            age: 0,
            bounces: 0,
            forcedTargetId: options.targetId || '',
            stickyUntil: 0,
            stuckEnemy: null,
            stuckOffset: new THREE.Vector3(),
            predicted: !!options.predicted,
            clientThrowId: options.clientThrowId || '',
            projectileId: options.projectileId || '',
            throwIntent: {
                origin: { x: origin.x, y: origin.y, z: origin.z },
                direction: { x: baseDir.x, y: baseDir.y, z: baseDir.z },
                aimPoint: intent.aimPoint ? { x: intent.aimPoint.x, y: intent.aimPoint.y, z: intent.aimPoint.z } : null
            }
        });

        return true;
    }

    function findNearestEnemy(position, maxDistance) {
        var enemies = globalThis.__MAYHEM_RUNTIME.GameEnemy.getEnemies ? globalThis.__MAYHEM_RUNTIME.GameEnemy.getEnemies() : [];
        var nearest = null;
        var nearestDist = maxDistance;

        for (var i = 0; i < enemies.length; i++) {
            var enemy = enemies[i];
            if (!enemy || !enemy.alive) continue;

            var d = enemy.group.position.distanceTo(position);
            if (d < nearestDist) {
                nearestDist = d;
                nearest = enemy;
            }
        }

        return nearest;
    }

    function segmentCollision(start, end) {
        tmpDir.copy(end).sub(start);
        var dist = tmpDir.length();
        if (dist < 0.0001) return null;

        function getGroundYAt(x, z) {
            if (globalThis.__MAYHEM_RUNTIME.GameWorld && globalThis.__MAYHEM_RUNTIME.GameWorld.getGroundHeightAt) {
                return Number(globalThis.__MAYHEM_RUNTIME.GameWorld.getGroundHeightAt(x, z) || 0);
            }
            return 0;
        }

        function findGroundHit() {
            var samples = 10;
            var prevT = 0;
            var prevX = start.x;
            var prevY = start.y;
            var prevZ = start.z;
            var prevDiff = prevY - getGroundYAt(prevX, prevZ);

            for (var i = 1; i <= samples; i++) {
                var t = i / samples;
                var x = start.x + ((end.x - start.x) * t);
                var y = start.y + ((end.y - start.y) * t);
                var z = start.z + ((end.z - start.z) * t);
                var diff = y - getGroundYAt(x, z);
                var descending = y < prevY;
                if (diff <= 0 && prevDiff >= 0 && (prevDiff > 0 || descending)) {
                    var lo = prevT;
                    var hi = t;
                    for (var iter = 0; iter < 8; iter++) {
                        var mid = (lo + hi) * 0.5;
                        var mx = start.x + ((end.x - start.x) * mid);
                        var my = start.y + ((end.y - start.y) * mid);
                        var mz = start.z + ((end.z - start.z) * mid);
                        var md = my - getGroundYAt(mx, mz);
                        if (md <= 0) hi = mid;
                        else lo = mid;
                    }

                    var hitT = hi;
                    var hx = start.x + ((end.x - start.x) * hitT);
                    var hz = start.z + ((end.z - start.z) * hitT);
                    var hy = getGroundYAt(hx, hz);
                    var point = new THREE.Vector3(hx, hy, hz);
                    return {
                        kind: 'world',
                        object: null,
                        point: point,
                        distance: point.distanceTo(start)
                    };
                }
                prevT = t;
                prevY = y;
                prevDiff = diff;
            }
            return null;
        }

        var rayHit = null;
        var targets = getWorldTargets();
        var allTargets = targets.hitboxes.concat(targets.worldMeshes);
        if (allTargets.length > 0) {
            tmpDir.divideScalar(dist);
            raycaster.set(start, tmpDir);
            raycaster.far = dist + 0.03;

            var hits = raycaster.intersectObjects(allTargets, false);
            if (hits.length > 0) {
                var hit = hits[0];
                rayHit = {
                    kind: targets.hitboxes.indexOf(hit.object) !== -1 ? 'enemy' : 'world',
                    object: hit.object,
                    point: hit.point,
                    distance: Number(hit.distance || 0)
                };
            }
        }

        var groundHit = findGroundHit();
        if (!rayHit) return groundHit;
        if (!groundHit) return rayHit;
        return (groundHit.distance <= rayHit.distance) ? groundHit : rayHit;
    }

    function clearTrajectoryPreview() {
        trajectoryPreview.activeType = '';
        if (trajectoryPreview.dotsNear) trajectoryPreview.dotsNear.visible = false;
        if (trajectoryPreview.dotsFar) trajectoryPreview.dotsFar.visible = false;
        if (trajectoryPreview.impact) trajectoryPreview.impact.visible = false;
        if (trajectoryPreview.areaSphere) trajectoryPreview.areaSphere.visible = false;
        if (trajectoryPreview.areaDisk) trajectoryPreview.areaDisk.visible = false;
    }

    function ensureTrajectoryPreviewMeshes() {
        if (!sceneRef) return false;

        if (!trajectoryPreview.dotsNear) {
            var nearGeo = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(0, 0, 0)
            ]);
            var nearMat = new THREE.PointsMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0.34,
                size: 0.18,
                sizeAttenuation: true,
                depthTest: false,
                depthWrite: false
            });
            trajectoryPreview.dotsNear = new THREE.Points(nearGeo, nearMat);
            trajectoryPreview.dotsNear.visible = false;
            trajectoryPreview.dotsNear.renderOrder = 60;
            trajectoryPreview.dotsNear.frustumCulled = false;
            trajectoryPreview.dotsNear.layers.set(0);
            sceneRef.add(trajectoryPreview.dotsNear);
        }

        if (!trajectoryPreview.dotsFar) {
            var farGeo = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(0, 0, 0)
            ]);
            var farMat = new THREE.PointsMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0.86,
                size: 0.12,
                sizeAttenuation: true,
                depthTest: false,
                depthWrite: false
            });
            trajectoryPreview.dotsFar = new THREE.Points(farGeo, farMat);
            trajectoryPreview.dotsFar.visible = false;
            trajectoryPreview.dotsFar.renderOrder = 60;
            trajectoryPreview.dotsFar.frustumCulled = false;
            trajectoryPreview.dotsFar.layers.set(0);
            sceneRef.add(trajectoryPreview.dotsFar);
        }

        if (!trajectoryPreview.impact) {
            trajectoryPreview.impact = new THREE.Mesh(
                new THREE.SphereGeometry(0.12, 10, 10),
                new THREE.MeshBasicMaterial({
                    color: 0xffffff,
                    transparent: true,
                    opacity: 0.95,
                    depthTest: false,
                    depthWrite: false
                })
            );
            trajectoryPreview.impact.visible = false;
            trajectoryPreview.impact.renderOrder = 61;
            trajectoryPreview.impact.layers.set(0);
            sceneRef.add(trajectoryPreview.impact);
        }

        if (!trajectoryPreview.areaSphere) {
            trajectoryPreview.areaSphere = new THREE.Mesh(
                new THREE.SphereGeometry(1, 18, 14),
                new THREE.MeshBasicMaterial({
                    color: 0xffd480,
                    transparent: true,
                    opacity: 0.12,
                    wireframe: true,
                    depthTest: true,
                    depthWrite: false
                })
            );
            trajectoryPreview.areaSphere.visible = false;
            trajectoryPreview.areaSphere.renderOrder = 59;
            trajectoryPreview.areaSphere.layers.set(0);
            sceneRef.add(trajectoryPreview.areaSphere);
        }

        if (!trajectoryPreview.areaDisk) {
            trajectoryPreview.areaDisk = new THREE.Mesh(
                new THREE.CylinderGeometry(1, 1, 0.05, 28),
                new THREE.MeshBasicMaterial({
                    color: 0xff7a33,
                    transparent: true,
                    opacity: 0.2,
                    wireframe: true,
                    depthTest: true,
                    depthWrite: false
                })
            );
            trajectoryPreview.areaDisk.visible = false;
            trajectoryPreview.areaDisk.renderOrder = 59;
            trajectoryPreview.areaDisk.layers.set(0);
            sceneRef.add(trajectoryPreview.areaDisk);
        }

        return true;
    }

    function previewColorsForType(type) {
        if (type === 'molotov') {
            return { lineNear: 0xb77730, lineFar: 0xffffff, impact: 0xff8a3d };
        }
        return { lineNear: 0x98a4b8, lineFar: 0xffffff, impact: 0xffffff };
    }

    function updateTrajectoryAreaPreview(type, sim, previewColors) {
        if (!trajectoryPreview.areaSphere || !trajectoryPreview.areaDisk) return;
        trajectoryPreview.areaSphere.visible = false;
        trajectoryPreview.areaDisk.visible = false;
        if (!debugPreviewVolumesEnabled || !sim || !sim.impactPoint) return;

        if (type === 'frag') {
            var fragRadius = Math.max(0.2, Number(defs.frag && defs.frag.radius || 0));
            if (trajectoryPreview.areaSphere.material && trajectoryPreview.areaSphere.material.color) {
                trajectoryPreview.areaSphere.material.color.setHex(previewColors.impact);
            }
            trajectoryPreview.areaSphere.position.copy(sim.impactPoint);
            trajectoryPreview.areaSphere.scale.set(fragRadius, fragRadius, fragRadius);
            trajectoryPreview.areaSphere.visible = true;
            return;
        }

        if (type === 'molotov') {
            var fireRadius = Math.max(0.2, Number(defs.molotov && defs.molotov.fireRadius || 0));
            if (trajectoryPreview.areaDisk.material && trajectoryPreview.areaDisk.material.color) {
                trajectoryPreview.areaDisk.material.color.setHex(previewColors.impact);
            }
            trajectoryPreview.areaDisk.position.set(sim.impactPoint.x, sim.impactPoint.y + 0.03, sim.impactPoint.z);
            trajectoryPreview.areaDisk.scale.set(fireRadius, 1, fireRadius);
            trajectoryPreview.areaDisk.visible = true;
        }
    }

    function splitPreviewPoints(points) {
        if (!Array.isArray(points) || points.length < 2) {
            return { near: [], far: [] };
        }
        var splitIndex = Math.max(2, Math.min(points.length - 1, Math.floor(points.length * 0.38)));
        return {
            near: points.slice(0, splitIndex),
            far: points.slice(splitIndex - 1)
        };
    }

    function sparsePreviewPoints(points, stride) {
        if (!Array.isArray(points) || points.length < 2) return [];
        var step = Math.max(1, Math.round(Number(stride || 1)));
        if (step <= 1) return points.slice();
        var out = [points[0]];
        for (var i = step; i < points.length - 1; i += step) {
            out.push(points[i]);
        }
        out.push(points[points.length - 1]);
        return out;
    }

    function previewLifetimeForType(type, def) {
        if (!def) return 2.2;
        if (type === 'knife') return Math.max(0.2, Number(def.life || 1.8));
        if (typeof def.fuse === 'number') return Math.max(0.2, Number(def.fuse));
        if (typeof def.life === 'number') return Math.max(0.2, Number(def.life));
        return 2.2;
    }

    function simulateTrajectory(type, intent) {
        var def = defs[type];
        if (!def || !intent || !intent.origin || !intent.direction) {
            return { points: [], impactPoint: null };
        }

        var dt = Math.max(1 / 120, Number(trajectoryPreviewTuning.stepSec || (1 / 60)));
        var maxPoints = Math.max(8, Math.round(Number(trajectoryPreviewTuning.maxPoints || 120)));
        var maxTime = Math.min(
            Math.max(0.5, Number(trajectoryPreviewTuning.maxPreviewTime || 4)),
            previewLifetimeForType(type, def) + 0.9
        );

        trajPos.copy(intent.origin);
        var previewVelocity = buildThrowVelocity(def, intent, false);
        if (!previewVelocity) {
            return { points: [], impactPoint: null };
        }
        trajVel.copy(previewVelocity);

        var points = [trajPos.clone()];
        var age = 0;
        var bounces = 0;

        while (age < maxTime && points.length < maxPoints) {
            trajStart.copy(trajPos);
            trajVel.y -= Number(def.gravity || 0) * dt;
            trajEnd.copy(trajPos).addScaledVector(trajVel, dt);

            var hit = segmentCollision(trajStart, trajEnd);
            if (hit) {
                points.push(hit.point.clone());

                if (type === 'frag' && hit.kind === 'world') {
                    trajPos.copy(hit.point);
                    trajVel.multiplyScalar(throwableMechanicsTuning.fragBounceVelocityDamping || 0.4);
                    trajVel.y = Math.abs(trajVel.y) * (throwableMechanicsTuning.fragBounceVerticalDamping || 0.42);
                    bounces++;
                    if (bounces > (throwableMechanicsTuning.fragBounceMaxCount || 2) ||
                        trajVel.lengthSq() < (throwableMechanicsTuning.fragBounceStopSpeedSq || 2.5)) {
                        trajVel.set(0, 0, 0);
                    }
                    age += dt;
                    if (age >= previewLifetimeForType(type, def)) {
                        return { points: points, impactPoint: trajPos.clone() };
                    }
                    continue;
                }

                return { points: points, impactPoint: hit.point.clone() };
            }

            trajPos.copy(trajEnd);
            points.push(trajPos.clone());
            age += dt;

            if (age >= previewLifetimeForType(type, def)) {
                return { points: points, impactPoint: trajPos.clone() };
            }
        }

        return {
            points: points,
            impactPoint: points.length ? points[points.length - 1].clone() : null
        };
    }

    function trimPreviewStart(points, hiddenDistance) {
        var distToHide = Math.max(0, Number(hiddenDistance || 0));
        if (!Array.isArray(points) || points.length < 2 || distToHide <= 0.0001) {
            return Array.isArray(points) ? points.slice() : [];
        }

        var remaining = distToHide;
        var out = null;

        for (var i = 1; i < points.length; i++) {
            var prev = points[i - 1];
            var curr = points[i];
            var segLen = prev.distanceTo(curr);
            if (segLen <= 0.0001) continue;
            if (remaining >= segLen) {
                remaining -= segLen;
                continue;
            }
            var t = remaining > 0 ? (remaining / segLen) : 0;
            var start = prev.clone().lerp(curr, t);
            out = [start];
            for (var j = i; j < points.length; j++) {
                out.push(points[j].clone());
            }
            break;
        }

        if (!out || out.length < 2) {
            return points.slice(-2);
        }
        return out;
    }

    function updateTrajectoryPreview(type, intent) {
        if (!defs[type] || !intent) {
            clearTrajectoryPreview();
            return null;
        }
        if (!ensureTrajectoryPreviewMeshes()) return null;

        var sim = simulateTrajectory(type, intent);
        if (!sim || !sim.points || sim.points.length < 2) {
            clearTrajectoryPreview();
            return null;
        }

        var visiblePoints = trimPreviewStart(sim.points, trajectoryPreviewTuning.hiddenStartDistance || 0);
        if (!visiblePoints || visiblePoints.length < 2) {
            clearTrajectoryPreview();
            return null;
        }

        var splitPoints = splitPreviewPoints(visiblePoints);
        var nearPoints = sparsePreviewPoints(splitPoints.near, trajectoryPreviewTuning.pointStrideNear || 4);
        var farPoints = sparsePreviewPoints(splitPoints.far, trajectoryPreviewTuning.pointStrideFar || 6);
        var previewColors = previewColorsForType(type);
        if (trajectoryPreview.dotsNear.material && trajectoryPreview.dotsNear.material.color) {
            trajectoryPreview.dotsNear.material.color.setHex(previewColors.lineNear);
        }
        if (trajectoryPreview.dotsFar.material && trajectoryPreview.dotsFar.material.color) {
            trajectoryPreview.dotsFar.material.color.setHex(previewColors.lineFar);
        }
        trajectoryPreview.dotsNear.geometry.setFromPoints(nearPoints.length >= 2 ? nearPoints : visiblePoints.slice(0, 2));
        trajectoryPreview.dotsNear.geometry.computeBoundingSphere();
        trajectoryPreview.dotsNear.visible = true;
        trajectoryPreview.dotsFar.geometry.setFromPoints(farPoints.length >= 2 ? farPoints : visiblePoints.slice(-2));
        trajectoryPreview.dotsFar.geometry.computeBoundingSphere();
        trajectoryPreview.dotsFar.visible = true;
        trajectoryPreview.activeType = type;

        if (sim.impactPoint) {
            if (trajectoryPreview.impact.material && trajectoryPreview.impact.material.color) {
                trajectoryPreview.impact.material.color.setHex(previewColors.impact);
            }
            trajectoryPreview.impact.position.copy(sim.impactPoint);
            trajectoryPreview.impact.visible = true;
        } else {
            trajectoryPreview.impact.visible = false;
        }
        updateTrajectoryAreaPreview(type, sim, previewColors);

        return {
            type: type,
            points: sim.points.length,
            impactPoint: sim.impactPoint ? {
                x: sim.impactPoint.x,
                y: sim.impactPoint.y,
                z: sim.impactPoint.z
            } : null
        };
    }

    function reportHit(onEnemyHit, hitPoint, damage, hitType, result, source, special) {
        if (!onEnemyHit || !result) return;
        onEnemyHit({
            hitPoint: hitPoint.clone(),
            damage: damage,
            hitType: hitType,
            result: result,
            source: source,
            special: special || null
        });
    }

    function explodeAt(position, radius, maxDamage, source, onEnemyHit) {
        if (globalThis.__MAYHEM_RUNTIME.GameAudio && globalThis.__MAYHEM_RUNTIME.GameAudio.play) {
            globalThis.__MAYHEM_RUNTIME.GameAudio.play('explosion');
        }
        spawnExplosionBurst(position, 0xffaa22, radius);

        var enemies = globalThis.__MAYHEM_RUNTIME.GameEnemy.getEnemies ? globalThis.__MAYHEM_RUNTIME.GameEnemy.getEnemies() : [];
        for (var i = 0; i < enemies.length; i++) {
            var enemy = enemies[i];
            if (!enemy || !enemy.alive) continue;

            var dist = enemy.group.position.distanceTo(position);
            if (dist > radius) continue;

            var falloff = 1 - (dist / radius);
            var damage = Math.max(20, Math.round(maxDamage * falloff));
            var result = globalThis.__MAYHEM_RUNTIME.GameEnemy.damage(enemy.bodyHitbox, damage);
            reportHit(
                onEnemyHit,
                enemy.bodyHitbox.position,
                damage,
                'body',
                result,
                source
            );
        }
    }

    function createFireZone(position) {
        if (!sceneRef) return;

        var fireMesh = new THREE.Mesh(
            new THREE.CylinderGeometry(defs.molotov.fireRadius, defs.molotov.fireRadius, 0.08, 16),
            new THREE.MeshBasicMaterial({
                color: 0xff7733,
                transparent: true,
                opacity: 0.45
            })
        );
        fireMesh.position.set(position.x, 0.04, position.z);
        sceneRef.add(fireMesh);

        fireZones.push({
            mesh: fireMesh,
            center: new THREE.Vector3(position.x, 0, position.z),
            radius: defs.molotov.fireRadius,
            life: defs.molotov.fireDuration,
            tickTimer: 0
        });

        if (globalThis.__MAYHEM_RUNTIME.GameAudio && globalThis.__MAYHEM_RUNTIME.GameAudio.play) {
            globalThis.__MAYHEM_RUNTIME.GameAudio.play('explosion');
        }
        spawnExplosionBurst(position, 0xff6622, defs.molotov.fireRadius || 3.2);
    }

    function removeProjectile(index) {
        var p = projectiles[index];
        if (!p) return;
        if (p.mesh && p.mesh.parent) p.mesh.parent.remove(p.mesh);
        projectiles.splice(index, 1);
    }

    function updateProjectile(index, dt, onEnemyHit) {
        var p = projectiles[index];
        var def = defs[p.type];
        if (!p || !def) return;

        p.age += dt;

        if (p.type === 'plasma' && p.stickyUntil > 0) {
            if (p.stuckEnemy && p.stuckEnemy.alive && p.stuckEnemy.group && p.stuckEnemy.group.position) {
                p.mesh.position.copy(p.stuckEnemy.group.position).add(p.stuckOffset);
            }
            if (p.age >= p.stickyUntil) {
                explodeAt(p.mesh.position, def.radius, def.damage, p.type, onEnemyHit);
                removeProjectile(index);
            }
            return;
        }

        var isTrackingProjectile = (p.type === 'plasma' || p.type === 'missile' || p.type === 'plasma_stream');
        if (isTrackingProjectile && p.age > 0.03) {
            var targetEnemy = null;
            var targetPoint = null;
            var nearestDist = Infinity;
            var enemies = globalThis.__MAYHEM_RUNTIME.GameEnemy.getEnemies ? globalThis.__MAYHEM_RUNTIME.GameEnemy.getEnemies() : [];
            var currentDir = (p.velocity.lengthSq() > 0.0001)
                ? p.velocity.clone().normalize()
                : (p.launchDir ? p.launchDir.clone() : new THREE.Vector3(0, 0, -1));
            var halfAngleDeg = (p.type === 'missile' || p.type === 'plasma_stream')
                ? ((typeof def.lockHalfAngleDeg === 'number') ? def.lockHalfAngleDeg : 30)
                : ((typeof def.acquireHalfAngleDeg === 'number') ? def.acquireHalfAngleDeg : (throwableDistanceTuning.plasmaAcquireHalfAngleDeg || 35));
            var cosLimit = Math.cos(halfAngleDeg * Math.PI / 180);
            var maxAcquireRange = (p.type === 'missile' || p.type === 'plasma_stream')
                ? ((typeof def.acquireRange === 'number') ? def.acquireRange : 24)
                : (throwableDistanceTuning.plasmaAcquireRange || 18);

            for (var ei = 0; ei < enemies.length; ei++) {
                var enemy = enemies[ei];
                if (!enemy || !enemy.alive || !enemy.group || !enemy.group.position) continue;
                if (p.forcedTargetId) {
                    var enemyTargetId = (enemy.bodyHitbox && enemy.bodyHitbox.userData && enemy.bodyHitbox.userData.targetId)
                        ? enemy.bodyHitbox.userData.targetId
                        : ('enemy:' + enemy.index);
                    if (enemyTargetId !== p.forcedTargetId) continue;
                }

                tmpTarget.copy(enemy.group.position);
                tmpTarget.y += 1.5;
                tmpDir.copy(tmpTarget).sub(p.mesh.position);
                var dist = tmpDir.length();
                if (dist <= 0.001 || dist > maxAcquireRange || dist >= nearestDist) continue;
                tmpDir.divideScalar(dist);
                if (currentDir.dot(tmpDir) < cosLimit) continue;
                targetEnemy = enemy;
                targetPoint = tmpTarget.clone();
                nearestDist = dist;
                if (p.forcedTargetId) break;
            }

            if (targetEnemy) {
                var homingSpeed = def.speed + (def.homingBoost || 2);
                var homingLerp = def.homingLerp || 4.8;
                var seekCore = (globalThis.__MAYHEM_RUNTIME.GameShared && globalThis.__MAYHEM_RUNTIME.GameShared.seekCore)
                    ? globalThis.__MAYHEM_RUNTIME.GameShared.seekCore
                    : null;
                if (seekCore && seekCore.steerHomingVelocity) {
                    var nextVelocity = seekCore.steerHomingVelocity({
                        projectilePos: { x: p.mesh.position.x, y: p.mesh.position.y, z: p.mesh.position.z },
                        targetPos: { x: (targetPoint || tmpTarget).x, y: (targetPoint || tmpTarget).y, z: (targetPoint || tmpTarget).z },
                        velocity: { x: p.velocity.x, y: p.velocity.y, z: p.velocity.z },
                        speed: def.speed || 14,
                        boost: def.homingBoost || 2,
                        lerp: homingLerp,
                        dt: dt
                    });
                    p.velocity.set(Number(nextVelocity.x || 0), Number(nextVelocity.y || 0), Number(nextVelocity.z || 0));
                } else {
                    tmpDir.copy(targetPoint || tmpTarget).sub(p.mesh.position).normalize().multiplyScalar(homingSpeed);
                    p.velocity.lerp(tmpDir, Math.min(1, dt * homingLerp));
                }
            }
        }

        p.velocity.y -= def.gravity * dt;

        tmpStart.copy(p.mesh.position);
        tmpEnd.copy(p.mesh.position).addScaledVector(p.velocity, dt);

        var hit = segmentCollision(tmpStart, tmpEnd);
        if (hit) {
            if (hit.kind === 'enemy') {
                if (p.type === 'knife') {
                    var hitType = hit.object.userData.type || 'body';
                    var damage = hitType === 'head' ? def.headDamage : def.bodyDamage;
                    var result = globalThis.__MAYHEM_RUNTIME.GameEnemy.damage(hit.object, damage);
                    var special = null;

                    if (result && hitType === 'head') {
                        refillExplosives();
                        special = { explosiveRefill: true };
                    }

                    reportHit(onEnemyHit, hit.point, damage, hitType, result, p.type, special);
                    spawnFlash(hit.point, hitType === 'head' ? 0xffd14a : 0xffffff, 0.12, 0.1);
                    removeProjectile(index);
                    return;
                }

                if (p.type === 'molotov') {
                    createFireZone(hit.point);
                    removeProjectile(index);
                    return;
                }

                if (p.type === 'plasma') {
                    p.mesh.position.copy(hit.point);
                    p.velocity.set(0, 0, 0);
                    p.stickyUntil = p.age + (def.stickExplodeDelay || 0.65);
                    p.stuckEnemy = hit.object && hit.object.userData ? hit.object.userData.enemyRef : null;
                    p.stuckOffset.set(0, 0, 0);
                    if (p.stuckEnemy && p.stuckEnemy.group && p.stuckEnemy.group.position) {
                        p.stuckOffset.copy(hit.point).sub(p.stuckEnemy.group.position);
                    }
                    spawnFlash(hit.point, 0xffb347, 0.08, 0.08);
                    return;
                }

                if (p.type === 'plasma_stream') {
                    var netActive = !!(globalThis.__MAYHEM_RUNTIME.GameNet && globalThis.__MAYHEM_RUNTIME.GameNet.isActive && globalThis.__MAYHEM_RUNTIME.GameNet.isActive());
                    if (!netActive && hit.object && hit.object.userData) {
                        var streamHitType = hit.object.userData.type || 'body';
                        var streamDamage = streamHitType === 'head' ? (def.headDamage || def.damage || 15) : (def.bodyDamage || def.damage || 15);
                        var streamResult = globalThis.__MAYHEM_RUNTIME.GameEnemy.damage(hit.object, streamDamage);
                        reportHit(onEnemyHit, hit.point, streamDamage, streamHitType, streamResult, 'plasma_stream');
                    }
                    spawnFlash(hit.point, 0x66ddff, 0.08, 0.08);
                    removeProjectile(index);
                } else {
                    explodeAt(hit.point, def.radius, def.damage, p.type, onEnemyHit);
                    removeProjectile(index);
                }
                return;
            }

            // World collision
            if (p.type === 'knife') {
                spawnFlash(hit.point, 0xffffff, 0.08, 0.08);
                removeProjectile(index);
                return;
            }

            if (p.type === 'molotov') {
                createFireZone(hit.point);
                removeProjectile(index);
                return;
            }

            if (p.type === 'plasma' || p.type === 'missile' || p.type === 'plasma_stream') {
                if (p.type === 'plasma') {
                    p.mesh.position.copy(hit.point);
                    p.velocity.set(0, 0, 0);
                    p.stickyUntil = p.age + (def.stickExplodeDelay || 0.65);
                    p.stuckEnemy = null;
                    p.stuckOffset.set(0, 0, 0);
                } else if (p.type === 'plasma_stream') {
                    spawnFlash(hit.point, 0x66ddff, 0.07, 0.07);
                    removeProjectile(index);
                } else {
                    explodeAt(hit.point, def.radius, def.damage, p.type, onEnemyHit);
                    removeProjectile(index);
                }
                return;
            }

            // Frag grenade can bounce before fuse pop.
            p.mesh.position.copy(hit.point);
            p.velocity.multiplyScalar(throwableMechanicsTuning.fragBounceVelocityDamping || 0.4);
            p.velocity.y = Math.abs(p.velocity.y) * (throwableMechanicsTuning.fragBounceVerticalDamping || 0.42);
            p.bounces++;
            if (p.bounces > (throwableMechanicsTuning.fragBounceMaxCount || 2) ||
                p.velocity.lengthSq() < (throwableMechanicsTuning.fragBounceStopSpeedSq || 2.5)) {
                p.velocity.set(0, 0, 0);
            }
        } else {
            p.mesh.position.copy(tmpEnd);
        }

        if (p.type === 'knife' && p.age >= def.life) {
            removeProjectile(index);
            return;
        }

        if (p.type === 'frag' && p.age >= def.fuse) {
            explodeAt(p.mesh.position, def.radius, def.damage, p.type, onEnemyHit);
            removeProjectile(index);
            return;
        }

        if ((p.type === 'plasma' || p.type === 'missile' || p.type === 'plasma_stream') && p.age >= def.fuse) {
            if (p.type === 'plasma_stream') {
                removeProjectile(index);
            } else {
                explodeAt(p.mesh.position, def.radius, def.damage, p.type, onEnemyHit);
                removeProjectile(index);
            }
            return;
        }

        if (p.type === 'molotov' && p.age >= def.fuse) {
            createFireZone(p.mesh.position);
            removeProjectile(index);
        }
    }

    function updateFireZones(dt, onEnemyHit) {
        for (var i = fireZones.length - 1; i >= 0; i--) {
            var z = fireZones[i];
            z.life -= dt;
            z.tickTimer -= dt;

            if (z.tickTimer <= 0) {
                z.tickTimer += defs.molotov.fireTickRate;
                var enemies = globalThis.__MAYHEM_RUNTIME.GameEnemy.getEnemies ? globalThis.__MAYHEM_RUNTIME.GameEnemy.getEnemies() : [];
                for (var j = 0; j < enemies.length; j++) {
                    var enemy = enemies[j];
                    if (!enemy || !enemy.alive) continue;

                    var d = enemy.group.position.distanceTo(z.center);
                    if (d > z.radius) continue;

                    var dmg = defs.molotov.fireTickDamage;
                    var result = globalThis.__MAYHEM_RUNTIME.GameEnemy.damage(enemy.bodyHitbox, dmg);
                    reportHit(
                        onEnemyHit,
                        enemy.bodyHitbox.position,
                        dmg,
                        'body',
                        result,
                        'molotov'
                    );
                }
            }

            if (z.life <= 0) {
                if (z.mesh && z.mesh.parent) z.mesh.parent.remove(z.mesh);
                fireZones.splice(i, 1);
            }
        }
    }

    function updateFlashes(dt) {
        for (var i = impactFlashes.length - 1; i >= 0; i--) {
            var flash = impactFlashes[i];
            flash.life -= dt;

            if (flash.life <= 0) {
                if (flash.mesh && flash.mesh.parent) flash.mesh.parent.remove(flash.mesh);
                impactFlashes.splice(i, 1);
                continue;
            }

            var t = 1 - (flash.life / flash.maxLife);
            var scale = flash.startScale + ((flash.endScale - flash.startScale) * t);
            flash.mesh.scale.set(scale, scale, scale);
            if (flash.materials && flash.materials.length) {
                for (var m = 0; m < flash.materials.length; m++) {
                    flash.materials[m].opacity = Math.max(0, (flash.baseMaterialOpacities[m] || 1) * flash.startOpacity * (1 - t));
                }
            } else if (flash.mesh.material) {
                flash.mesh.material.opacity = Math.max(0, flash.startOpacity * (1 - t));
            }
        }
    }

    function purgeStalePredicted() {
        var now = Date.now();
        var ttlMs = Math.max(1000, Number(throwableMechanicsTuning.predictedTtlMs || 5000));
        for (var key in predictedByClientId) {
            if (!Object.prototype.hasOwnProperty.call(predictedByClientId, key)) continue;
            var entry = predictedByClientId[key];
            if (!entry || !entry.createdAt) {
                delete predictedByClientId[key];
                continue;
            }
            if ((now - entry.createdAt) <= ttlMs) continue;
            delete predictedByClientId[key];
            for (var i = projectiles.length - 1; i >= 0; i--) {
                var p = projectiles[i];
                if (!p || p.clientThrowId !== key) continue;
                removeProjectile(i);
            }
        }
    }

    GameThrowables.init = function (scene) {
        if (trajectoryPreview.dotsNear && trajectoryPreview.dotsNear.parent) {
            trajectoryPreview.dotsNear.parent.remove(trajectoryPreview.dotsNear);
        }
        if (trajectoryPreview.dotsFar && trajectoryPreview.dotsFar.parent) {
            trajectoryPreview.dotsFar.parent.remove(trajectoryPreview.dotsFar);
        }
        if (trajectoryPreview.impact && trajectoryPreview.impact.parent) {
            trajectoryPreview.impact.parent.remove(trajectoryPreview.impact);
        }
        if (trajectoryPreview.areaSphere && trajectoryPreview.areaSphere.parent) {
            trajectoryPreview.areaSphere.parent.remove(trajectoryPreview.areaSphere);
        }
        if (trajectoryPreview.areaDisk && trajectoryPreview.areaDisk.parent) {
            trajectoryPreview.areaDisk.parent.remove(trajectoryPreview.areaDisk);
        }
        trajectoryPreview.dotsNear = null;
        trajectoryPreview.dotsFar = null;
        trajectoryPreview.impact = null;
        trajectoryPreview.areaSphere = null;
        trajectoryPreview.areaDisk = null;
        trajectoryPreview.activeType = '';

        sceneRef = scene;
        projectiles = [];
        fireZones = [];
        impactFlashes = [];
        netProjectileMap = {};
        netFireZoneMap = {};
        predictedByClientId = {};
        localThrowSeq = 1;
        debugTelemetry.lastIntent = null;
        debugTelemetry.lastAckClientThrowId = '';
        debugTelemetry.lastRejectClientThrowId = '';
        debugTelemetry.lastReconcileClientThrowId = '';
        debugTelemetry.predictedCount = 0;
        resetInventory();
    };

    GameThrowables.getTypes = function () {
        return throwableOrder.slice();
    };

    GameThrowables.getCatalog = function () {
        var out = [];
        for (var i = 0; i < throwableOrder.length; i++) {
            var id = throwableOrder[i];
            var def = defs[id];
            if (!def) continue;
            out.push({
                id: def.id,
                label: def.label,
                speed: def.speed,
                upward: def.upward,
                gravity: def.gravity,
                fuse: def.fuse,
                radius: def.radius,
                damage: def.damage,
                fireRadius: def.fireRadius,
                fireDuration: def.fireDuration,
                fireTickDamage: def.fireTickDamage,
                fireTickRate: def.fireTickRate,
                life: def.life,
                bodyDamage: def.bodyDamage,
                headDamage: def.headDamage,
                regen: def.regen
            });
        }
        return out;
    };

    GameThrowables.getState = function () {
        return getThrowableState();
    };

    GameThrowables.getMissileTuning = function () {
        var def = defs.missile;
        if (!def) return null;
        return {
            speed: def.speed,
            gravity: def.gravity,
            fuse: def.fuse,
            homingBoost: def.homingBoost || 0,
            homingLerp: def.homingLerp || 0,
            lockHalfAngleDeg: def.lockHalfAngleDeg || 0
        };
    };

    /**
     * Throw a specific type if charge is available
     * @param {string} type - frag|plasma|molotov|knife
     * @param {THREE.Camera} camera
     * @returns {Object} { ok, reason, state }
     */
    GameThrowables.buildThrowIntent = function (camera, options) {
        var intent = buildThrowIntent(camera, options);
        if (!intent) return null;
        return {
            origin: { x: intent.origin.x, y: intent.origin.y, z: intent.origin.z },
            direction: { x: intent.direction.x, y: intent.direction.y, z: intent.direction.z },
            aimPoint: intent.aimPoint ? { x: intent.aimPoint.x, y: intent.aimPoint.y, z: intent.aimPoint.z } : null
        };
    };

    function intentToVectors(intent) {
        if (!intent || !intent.origin || !intent.direction) return null;
        var origin = new THREE.Vector3(
            Number(intent.origin.x || 0),
            Number(intent.origin.y || 0),
            Number(intent.origin.z || 0)
        );
        var direction = new THREE.Vector3(
            Number(intent.direction.x || 0),
            Number(intent.direction.y || 0),
            Number(intent.direction.z || 0)
        );
        if (!isFinite(direction.x) || !isFinite(direction.y) || !isFinite(direction.z) || direction.lengthSq() < 0.00001) return null;
        return {
            origin: origin,
            direction: direction.normalize()
        };
    }

    GameThrowables.updateTrajectoryPreview = function (type, camera, intentPayload) {
        if (!type || !defs[type] || !camera) {
            clearTrajectoryPreview();
            return null;
        }

        var intent = intentToVectors(intentPayload);
        if (!intent) {
            intent = buildThrowIntent(camera);
        }
        return updateTrajectoryPreview(type, intent);
    };

    GameThrowables.clearTrajectoryPreview = function () {
        clearTrajectoryPreview();
    };

    GameThrowables.getTrajectoryPreviewTuning = function () {
        return {
            stepSec: trajectoryPreviewTuning.stepSec,
            maxPoints: trajectoryPreviewTuning.maxPoints,
            maxPreviewTime: trajectoryPreviewTuning.maxPreviewTime
        };
    };

    GameThrowables.throw = function (type, camera, intentPayload) {
        if (!defs[type]) {
            return { ok: false, reason: 'unknown', state: getThrowableState() };
        }
        if (!consumeCharge(type)) {
            return { ok: false, reason: 'cooldown', state: getThrowableState() };
        }

        var intent = intentToVectors(intentPayload);
        var spawned = spawnProjectile(type, camera, intent ? { intent: intent } : undefined);
        if (!spawned) {
            inventory[type].charges++;
            return { ok: false, reason: 'spawn_failed', state: getThrowableState() };
        }

        return { ok: true, reason: '', state: getThrowableState() };
    };

    GameThrowables.buildClientThrowId = function () {
        localThrowSeq++;
        return 'cthrow-' + localThrowSeq + '-' + Date.now().toString(36);
    };

    GameThrowables.throwPredicted = function (type, camera, clientThrowId, intentPayload) {
        if (!defs[type]) return false;
        var id = String(clientThrowId || '');
        if (!id) id = GameThrowables.buildClientThrowId();
        var intent = intentToVectors(intentPayload);
        var spawned = spawnProjectile(type, camera, {
            predicted: true,
            clientThrowId: id,
            intent: intent || null
        });
        if (!spawned) return false;
        predictedByClientId[id] = {
            createdAt: Date.now(),
            acked: false,
            authoritativeSeen: false
        };
        return true;
    };

    GameThrowables.confirmPredictedThrow = function (clientThrowId) {
        var id = String(clientThrowId || '');
        if (!id || !predictedByClientId[id]) return false;
        predictedByClientId[id].acked = true;
        debugTelemetry.lastAckClientThrowId = id;
        return true;
    };

    GameThrowables.rejectPredictedThrow = function (clientThrowId) {
        var id = String(clientThrowId || '');
        if (!id) return false;
        delete predictedByClientId[id];
        debugTelemetry.lastRejectClientThrowId = id;
        for (var i = projectiles.length - 1; i >= 0; i--) {
            var p = projectiles[i];
            if (!p || p.clientThrowId !== id) continue;
            removeProjectile(i);
        }
        return true;
    };

    function reconcilePredictedAgainstAuthoritative(selfId, projectilesState) {
        var seenByClientThrowId = {};
        for (var i = 0; i < projectilesState.length; i++) {
            var p = projectilesState[i];
            if (!p || p.ownerId !== selfId) continue;
            if (!p.clientThrowId) continue;
            seenByClientThrowId[p.clientThrowId] = true;
        }

        for (var key in seenByClientThrowId) {
            if (!Object.prototype.hasOwnProperty.call(seenByClientThrowId, key)) continue;
            if (predictedByClientId[key]) {
                predictedByClientId[key].authoritativeSeen = true;
                delete predictedByClientId[key];
            }
            debugTelemetry.lastReconcileClientThrowId = key;
            for (var j = projectiles.length - 1; j >= 0; j--) {
                var localP = projectiles[j];
                if (!localP || localP.clientThrowId !== key) continue;
                removeProjectile(j);
            }
        }
    }

    GameThrowables.setNetworkInventoryState = function (state) {
        if (!state || typeof state !== 'object') return;
        for (var i = 0; i < throwableOrder.length; i++) {
            var id = throwableOrder[i];
            var src = state[id];
            if (!src || !inventory[id]) continue;
            inventory[id].charges = Math.max(0, Number(src.charges || 0));
            inventory[id].maxCharges = Math.max(1, Number(src.maxCharges || 1));
            inventory[id].cooldownRemaining = Math.max(0, Number(src.cooldownRemaining || 0));
        }
    };

    GameThrowables.syncAuthoritativeState = function (payload, selfId) {
        if (!sceneRef) return;
        payload = payload || {};
        var projectilesState = Array.isArray(payload.projectiles) ? payload.projectiles : [];
        var fireZonesState = Array.isArray(payload.fireZones) ? payload.fireZones : [];
        reconcilePredictedAgainstAuthoritative(selfId, projectilesState);

        var seenProjectile = {};
        for (var i = 0; i < projectilesState.length; i++) {
            var p = projectilesState[i];
            if (!p || !p.id || !defs[p.type]) continue;
            seenProjectile[p.id] = true;
            var entry = netProjectileMap[p.id];
            if (!entry) {
                var mesh = createThrowableMesh(p.type);
                sceneRef.add(mesh);
                entry = { id: p.id, mesh: mesh, type: p.type };
                netProjectileMap[p.id] = entry;
            }
            entry.mesh.position.set(Number(p.x || 0), Number(p.y || 0), Number(p.z || 0));
        }

        for (var key in netProjectileMap) {
            if (!Object.prototype.hasOwnProperty.call(netProjectileMap, key)) continue;
            if (!seenProjectile[key]) removeNetProjectileById(key);
        }

        var seenZone = {};
        for (var z = 0; z < fireZonesState.length; z++) {
            var zoneState = fireZonesState[z];
            if (!zoneState || !zoneState.id) continue;
            seenZone[zoneState.id] = true;
            var zone = netFireZoneMap[zoneState.id];
            if (!zone) {
                var zoneMesh = buildFireZoneMesh(Number(zoneState.radius || defs.molotov.fireRadius || 3));
                zoneMesh.position.set(Number(zoneState.x || 0), 0.04, Number(zoneState.z || 0));
                sceneRef.add(zoneMesh);
                zone = { id: zoneState.id, mesh: zoneMesh };
                netFireZoneMap[zoneState.id] = zone;
            }
            zone.mesh.position.set(Number(zoneState.x || 0), 0.04, Number(zoneState.z || 0));
        }

        for (var zk in netFireZoneMap) {
            if (!Object.prototype.hasOwnProperty.call(netFireZoneMap, zk)) continue;
            if (!seenZone[zk]) removeNetFireZoneById(zk);
        }
    };

    GameThrowables.applyNetworkEvent = function (event) {
        if (!event || !event.t) return;
        if (event.t === 'throw_impact') {
            spawnFlash(new THREE.Vector3(Number(event.x || 0), Number(event.y || 0), Number(event.z || 0)), 0xffffff, 0.1, 0.1);
            return;
        }
        if (event.t === 'throw_explode') {
            spawnExplosionBurst(
                new THREE.Vector3(Number(event.x || 0), Number(event.y || 0), Number(event.z || 0)),
                0xffaa22,
                Number(event.radius || defs.frag.radius || 5.4)
            );
            return;
        }
        if (event.t === 'aoe_end' && event.zoneId) {
            removeNetFireZoneById(event.zoneId);
        }
    };

    GameThrowables.fireAbilityMissile = function (camera, options) {
        if (!sceneRef || !camera) return false;
        options = options || {};
        var projectileType = 'missile';
        camera.getWorldDirection(tmpForward);
        var muzzle = null;
        if (globalThis.__MAYHEM_RUNTIME.GamePlayer && globalThis.__MAYHEM_RUNTIME.GamePlayer.getMuzzleWorldPosition) {
            muzzle = globalThis.__MAYHEM_RUNTIME.GamePlayer.getMuzzleWorldPosition();
        }
        var origin = muzzle && typeof muzzle.x === 'number'
            ? muzzle.clone().addScaledVector(tmpForward, 0.1)
            : camera.position.clone().addScaledVector(tmpForward, 0.75);
        var intent = buildThrowIntent(camera, {
            origin: origin,
            direction: tmpForward.clone()
        });
        if (!intent) return false;

        var shouldPredict = false;
        if (typeof options.predictLocal === 'boolean') {
            shouldPredict = options.predictLocal;
        } else if (!(
            globalThis.__MAYHEM_RUNTIME.GameNet &&
            globalThis.__MAYHEM_RUNTIME.GameNet.isActive &&
            globalThis.__MAYHEM_RUNTIME.GameNet.isActive()
        )) {
            shouldPredict = true;
        }

        if (shouldPredict) {
            var ok = spawnProjectile(projectileType, camera, {
                intent: intent,
                origin: origin,
                direction: tmpForward.clone(),
                predicted: true,
                clientThrowId: 'missile-' + Date.now().toString(36) + '-' + (localThrowSeq++).toString(36)
            });
            if (!ok) return false;
        }
        return {
            origin: { x: intent.origin.x, y: intent.origin.y, z: intent.origin.z },
            direction: { x: intent.direction.x, y: intent.direction.y, z: intent.direction.z },
            aimPoint: intent.aimPoint ? { x: intent.aimPoint.x, y: intent.aimPoint.y, z: intent.aimPoint.z } : null
        };
    };

    /**
     * Update projectiles, aoe zones, and inventory regen
     * @param {number} dt
     * @param {Function} onEnemyHit - callback({hitPoint, damage, hitType, result, source, special})
     */
    GameThrowables.update = function (dt, onEnemyHit) {
        regenCharges(dt);
        purgeStalePredicted();
        debugTelemetry.predictedCount = Object.keys(predictedByClientId).length;

        for (var i = projectiles.length - 1; i >= 0; i--) {
            updateProjectile(i, dt, onEnemyHit);
        }
        updateFireZones(dt, onEnemyHit);
        updateFlashes(dt);
    };

    GameThrowables.setDebugMode = function (enabled) {
        debugInstantCooldowns = !!enabled;
        debugPreviewVolumesEnabled = !!enabled;
        if (debugInstantCooldowns) {
            for (var i = 0; i < throwableOrder.length; i++) {
                var inv = inventory[throwableOrder[i]];
                if (inv) {
                    inv.charges = inv.maxCharges;
                    inv.cooldownRemaining = 0;
                }
            }
        } else {
            clearTrajectoryPreview();
        }
    };

    GameThrowables.getDebugTelemetry = function () {
        return {
            lastIntent: debugTelemetry.lastIntent ? {
                origin: debugTelemetry.lastIntent.origin,
                direction: debugTelemetry.lastIntent.direction,
                aimPoint: debugTelemetry.lastIntent.aimPoint
            } : null,
            lastAckClientThrowId: debugTelemetry.lastAckClientThrowId,
            lastRejectClientThrowId: debugTelemetry.lastRejectClientThrowId,
            lastReconcileClientThrowId: debugTelemetry.lastReconcileClientThrowId,
            predictedCount: debugTelemetry.predictedCount
        };
    };

    GameThrowables.getSelectedThrowable = function () {
        return selectedThrowableId;
    };

    GameThrowables.setSelectedThrowable = function (id) {
        if (defs[id] && defs[id].category && throwableOrder.indexOf(id) !== -1) {
            selectedThrowableId = id;
            return true;
        }
        return false;
    };

    GameThrowables.getCategories = function () {
        var out = {};
        for (var catId in throwableCategories) {
            if (!Object.prototype.hasOwnProperty.call(throwableCategories, catId)) continue;
            var cat = throwableCategories[catId];
            var items = [];
            for (var i = 0; i < cat.items.length; i++) {
                var def = defs[cat.items[i]];
                if (def) items.push({ id: def.id, label: def.label });
            }
            out[catId] = { label: cat.label, previewType: cat.previewType, items: items };
        }
        return out;
    };

    GameThrowables.getCategoryForType = function (type) {
        var def = defs[type];
        return (def && def.category) ? def.category : '';
    };

    GameThrowables.getPreviewType = function (type) {
        var def = defs[type];
        if (!def || !def.category) return 'none';
        var cat = throwableCategories[def.category];
        return cat ? cat.previewType : 'none';
    };

    GameThrowables.getThrowableDef = function (type) {
        return defs[type] || null;
    };

    GameThrowables.checkPlasmaLockInCone = function (camera) {
        if (!camera || !globalThis.__MAYHEM_RUNTIME.GameEnemy || !globalThis.__MAYHEM_RUNTIME.GameEnemy.getEnemies) return false;
        var enemies = globalThis.__MAYHEM_RUNTIME.GameEnemy.getEnemies();
        if (!enemies || !enemies.length) return false;

        var origin = camera.position;
        var forward = new THREE.Vector3();
        camera.getWorldDirection(forward);

        var plasmaDef = defs['plasma'];
        var halfAngleDeg = (plasmaDef && plasmaDef.acquireHalfAngleDeg) ? plasmaDef.acquireHalfAngleDeg : 35;
        var cosLimit = Math.cos(halfAngleDeg * Math.PI / 180);
        var maxRange = throwableDistanceTuning.plasmaAcquireRange || 18;

        for (var i = 0; i < enemies.length; i++) {
            var enemy = enemies[i];
            if (!enemy || !enemy.alive || !enemy.group || !enemy.group.position) continue;
            var toEnemy = enemy.group.position.clone().sub(origin);
            toEnemy.y += 1.5;
            var dist = toEnemy.length();
            if (dist <= 0.001 || dist > maxRange) continue;
            toEnemy.divideScalar(dist);
            if (forward.dot(toEnemy) >= cosLimit) return true;
        }
        return false;
    };

    globalThis.__MAYHEM_RUNTIME.GameThrowables = GameThrowables;
})();
