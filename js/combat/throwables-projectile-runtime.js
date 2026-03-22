/**
 * throwables-projectile-runtime.js - Live throwable projectile runtime.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameThrowablesProjectileRuntime
 */
(function () {
    'use strict';

    function create(opts) {
        opts = opts || {};

        var projectiles = [];
        var impactFlashes = [];
        var netProjectileMap = {};
        var predictedByClientId = {};
        var localThrowSeq = 1;

        var raycaster = new THREE.Raycaster();
        var tmpForward = new THREE.Vector3();
        var tmpStart = new THREE.Vector3();
        var tmpEnd = new THREE.Vector3();
        var tmpDir = new THREE.Vector3();
        var tmpTarget = new THREE.Vector3();
        var tmpNetVec = new THREE.Vector3();
        var tmpSegmentVec = new THREE.Vector3();
        var tmpSegmentDir = new THREE.Vector3();
        var tmpClosestPoint = new THREE.Vector3();
        var tmpEnemyCenter = new THREE.Vector3();
        var tmpDesiredVelocity = new THREE.Vector3();
        var tmpStickyAnchor = new THREE.Vector3();
        var tmpVisualDir = new THREE.Vector3();
        var tmpVisualLook = new THREE.Vector3();
        var tmpBoxCenter = new THREE.Vector3();
        var tmpBoxSize = new THREE.Vector3();
        var tmpRay = new THREE.Ray();
        var tmpBox = new THREE.Box3();
        var tmpPlayerPos = new THREE.Vector3();
        var tmpMuzzlePos = new THREE.Vector3();

        function scene() {
            return opts.getScene ? opts.getScene() : null;
        }

        function defs() {
            return opts.getDefs ? opts.getDefs() : {};
        }

        function mechanicsTuning() {
            return opts.getMechanicsTuning ? opts.getMechanicsTuning() : {};
        }

        function distanceTuning() {
            return opts.getDistanceTuning ? opts.getDistanceTuning() : {};
        }

        function runtimeDeps() {
            var runtime = globalThis.__MAYHEM_RUNTIME || {};
            return runtime.GameThrowablesProjectileRuntimeDeps || {};
        }

        function assetFactoryApi() {
            var deps = runtimeDeps();
            return deps.getAssetFactory ? deps.getAssetFactory() : ((globalThis.__MAYHEM_RUNTIME || {}).GameAssetFactory || null);
        }

        function worldRuntimeApi() {
            var deps = runtimeDeps();
            return deps.getWorldApi ? deps.getWorldApi() : ((globalThis.__MAYHEM_RUNTIME || {}).GameWorld || null);
        }

        function enemyRuntimeApi() {
            var deps = runtimeDeps();
            return deps.getEnemyApi ? deps.getEnemyApi() : ((globalThis.__MAYHEM_RUNTIME || {}).GameEnemy || null);
        }

        function audioRuntimeApi() {
            var deps = runtimeDeps();
            return deps.getAudioApi ? deps.getAudioApi() : ((globalThis.__MAYHEM_RUNTIME || {}).GameAudio || null);
        }

        function netRuntimeApi() {
            var deps = runtimeDeps();
            return deps.getNetApi ? deps.getNetApi() : ((globalThis.__MAYHEM_RUNTIME || {}).GameNet || null);
        }

        function playerRuntimeApi() {
            var deps = runtimeDeps();
            return deps.getPlayerApi ? deps.getPlayerApi() : ((globalThis.__MAYHEM_RUNTIME || {}).GamePlayer || null);
        }

        function sharedRuntimeApi() {
            var deps = runtimeDeps();
            return deps.getSharedApi ? deps.getSharedApi() : ((globalThis.__MAYHEM_RUNTIME || {}).GameShared || null);
        }

        function remoteEntitiesRuntimeApi() {
            var deps = runtimeDeps();
            return deps.getRemoteEntitiesApi ? deps.getRemoteEntitiesApi() : ((globalThis.__MAYHEM_RUNTIME || {}).GameNetEntities || null);
        }

        function buildThrowIntent(camera, options) {
            return opts.buildThrowIntent ? opts.buildThrowIntent(camera, options) : null;
        }

        function buildThrowVelocity(def, intent, useExplicitDirection) {
            return opts.buildThrowVelocity ? opts.buildThrowVelocity(def, intent, useExplicitDirection) : null;
        }

        function reportHit(onEnemyHit, hitPoint, damage, hitType, result, source, special) {
            if (opts.reportHit) {
                opts.reportHit(onEnemyHit, hitPoint, damage, hitType, result, source, special);
            }
        }

        function effectPaletteForProjectileType(type) {
            return opts.effectPaletteForProjectileType ? opts.effectPaletteForProjectileType(type) : {
                flash: 0xffffff,
                explosion: 0xffaa22
            };
        }

        function explosiveMinDamage(def) {
            return opts.explosiveMinDamage ? Number(opts.explosiveMinDamage(def) || 0) : 0;
        }

        function plasmaMaxLife(def) {
            return opts.plasmaMaxLife ? Number(opts.plasmaMaxLife(def) || 0) : 0;
        }

        function plasmaFuseDelay(def) {
            return opts.plasmaFuseDelay ? Number(opts.plasmaFuseDelay(def) || 0) : 0;
        }

        function getWorldTargets() {
            return opts.getWorldTargets ? opts.getWorldTargets() : { worldMeshes: [], hitboxes: [] };
        }

        function refillExplosives() {
            if (opts.refillExplosives) opts.refillExplosives();
        }

        function createFireZone(position) {
            if (opts.createFireZone) opts.createFireZone(position);
        }

        function createThrowableMesh(type) {
            if (type === 'frag') {
                return new THREE.Mesh(
                    new THREE.BoxGeometry(0.18, 0.18, 0.18),
                    new THREE.MeshLambertMaterial({ color: 0x2f7f2f })
                );
            }
            if (type === 'plasma') {
                return new THREE.Mesh(
                    new THREE.BoxGeometry(0.2, 0.2, 0.2),
                    new THREE.MeshLambertMaterial({ color: 0x22aabb, emissive: 0x112222 })
                );
            }
            if (type === 'missile') {
                var missile = new THREE.Group();
                var bodyMat = new THREE.MeshLambertMaterial({ color: 0xbdc6cf });
                var noseMat = new THREE.MeshLambertMaterial({ color: 0xffb870, emissive: 0x332010 });
                var finMat = new THREE.MeshLambertMaterial({ color: 0x5f6773 });
                var exhaustMat = new THREE.MeshBasicMaterial({
                    color: 0xffb25f,
                    transparent: true,
                    opacity: 0.9,
                    depthWrite: false
                });

                var body = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.13, 0.5), bodyMat);
                missile.add(body);

                var nose = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.18, 6), noseMat);
                nose.rotation.x = Math.PI * 0.5;
                nose.position.z = 0.34;
                missile.add(nose);

                var collar = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.08), finMat);
                collar.position.z = -0.12;
                missile.add(collar);

                for (var i = 0; i < 4; i++) {
                    var fin = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.14, 0.14), finMat);
                    fin.position.z = -0.18;
                    fin.rotation.z = (Math.PI * 0.5) * i;
                    missile.add(fin);
                }

                var exhaust = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.22, 5), exhaustMat);
                exhaust.rotation.x = -Math.PI * 0.5;
                exhaust.position.z = -0.36;
                missile.add(exhaust);

                missile.userData.projectileType = 'missile';
                missile.userData.exhaust = exhaust;
                return missile;
            }
            if (type === 'molotov') {
                var group = new THREE.Group();
                var bottleMat = new THREE.MeshLambertMaterial({ color: 0x6d3f1f });
                var glassMat = new THREE.MeshLambertMaterial({ color: 0x9b5a2a });
                var ragMat = new THREE.MeshLambertMaterial({ color: 0xffb15f, emissive: 0x4a2100 });
                var bottle = new THREE.Mesh(
                    new THREE.BoxGeometry(0.15, 0.22, 0.15),
                    bottleMat
                );
                bottle.position.y = 0.01;
                group.add(bottle);
                var neck = new THREE.Mesh(
                    new THREE.BoxGeometry(0.08, 0.12, 0.08),
                    glassMat
                );
                neck.position.y = 0.16;
                group.add(neck);
                var rag = new THREE.Mesh(
                    new THREE.BoxGeometry(0.08, 0.06, 0.08),
                    ragMat
                );
                rag.position.y = 0.24;
                group.add(rag);
                var assetFactory = assetFactoryApi();
                if (assetFactory && assetFactory.createParticleAsset) {
                    var flame = assetFactory.createParticleAsset('fire', { color: 0xff8b3d });
                    if (flame) {
                        flame.position.y = 0.32;
                        flame.scale.set(0.42, 0.62, 0.42);
                        group.add(flame);
                        group.userData.flame = flame;
                    }
                }
                group.userData.projectileType = 'molotov';
                return group;
            }
            var knife = new THREE.Mesh(
                new THREE.BoxGeometry(0.04, 0.04, 0.45),
                new THREE.MeshLambertMaterial({ color: 0xbfc5ca })
            );
            knife.rotation.x = Math.PI / 2;
            return knife;
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
            var sceneRef = scene();
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

            var assetFactory = assetFactoryApi();
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

        function orientProjectileVisual(mesh, velocity, age) {
            if (!mesh || !velocity) return;
            tmpVisualDir.copy(velocity);
            if (tmpVisualDir.lengthSq() <= 0.00001) return;
            tmpVisualDir.normalize();
            mesh.lookAt(tmpVisualLook.copy(mesh.position).add(tmpVisualDir));

            var projectileType = mesh.userData && mesh.userData.projectileType ? String(mesh.userData.projectileType) : '';
            if (projectileType === 'missile') {
                var roll = Number(age || 0) * 18;
                mesh.rotateZ(Math.sin(roll) * 0.045);
                var exhaust = mesh.userData.exhaust || null;
                if (exhaust) {
                    var pulse = 0.92 + (Math.sin((Number(age || 0) * 32)) * 0.16);
                    exhaust.scale.set(pulse, pulse, 1.15 + (Math.cos((Number(age || 0) * 26)) * 0.18));
                    if (exhaust.material) {
                        exhaust.material.opacity = 0.68 + (Math.sin((Number(age || 0) * 38)) * 0.18);
                    }
                }
                return;
            }

            if (projectileType === 'molotov') {
                mesh.rotateZ(Number(age || 0) * 0.34);
                mesh.rotateX(0.025 + (Math.sin(Number(age || 0) * 7.2) * 0.012));
                var flame = mesh.userData.flame || null;
                if (flame) {
                    var flamePulse = 0.92 + (Math.sin(Number(age || 0) * 18) * 0.18);
                    flame.scale.set(0.42 * flamePulse, 0.62 + (Math.sin(Number(age || 0) * 15) * 0.12), 0.42 * flamePulse);
                }
            }
        }

        function spawnProjectile(type, camera, options) {
            var sceneRef = scene();
            var currentDefs = defs();
            if (!sceneRef || !camera) return false;
            var def = currentDefs[type];
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
            if (!mesh.userData) mesh.userData = {};
            mesh.userData.projectileType = type;
            orientProjectileVisual(mesh, vel, 0);
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

        function segmentCollision(start, end) {
            tmpDir.copy(end).sub(start);
            var dist = tmpDir.length();
            if (dist < 0.0001) return null;

            function getGroundYAt(x, z) {
                var worldApi = worldRuntimeApi();
                if (worldApi && worldApi.getGroundHeightAt) {
                    return Number(worldApi.getGroundHeightAt(x, z) || 0);
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
            var allTargets = (targets.hitboxes || []).concat(targets.worldMeshes || []);
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

        function hitboxHalfExtents(hitbox) {
            if (!hitbox || !hitbox.geometry || !hitbox.geometry.parameters) return null;
            var params = hitbox.geometry.parameters;
            var scale = hitbox.scale || null;
            return {
                x: Math.abs(Number(params.width || 0) * Number(scale && scale.x != null ? scale.x : 1) * 0.5),
                y: Math.abs(Number(params.height || 0) * Number(scale && scale.y != null ? scale.y : 1) * 0.5),
                z: Math.abs(Number(params.depth || 0) * Number(scale && scale.z != null ? scale.z : 1) * 0.5)
            };
        }

        function segmentIntersectsExpandedHitbox(start, end, hitbox, expandRadius, outPoint) {
            if (!hitbox || !hitbox.position) return null;
            var half = hitboxHalfExtents(hitbox);
            if (!half) return null;

            tmpSegmentVec.copy(end).sub(start);
            var segmentLength = tmpSegmentVec.length();
            if (segmentLength <= 0.000001) return null;
            tmpSegmentDir.copy(tmpSegmentVec).divideScalar(segmentLength);

            var radius = Math.max(0, Number(expandRadius || 0));
            tmpBoxCenter.copy(hitbox.position);
            tmpBoxSize.set(
                (half.x + radius) * 2,
                (half.y + radius) * 2,
                (half.z + radius) * 2
            );
            tmpBox.setFromCenterAndSize(tmpBoxCenter, tmpBoxSize);
            tmpRay.set(start, tmpSegmentDir);
            var point = tmpRay.intersectBox(tmpBox, outPoint || tmpClosestPoint);
            if (!point) return null;
            var dist = point.distanceTo(start);
            if (dist > (segmentLength + 0.0001)) return null;
            return dist;
        }

        function findPlasmaCatchCandidate(start, end, maxDistance, catchRadius, trackedEnemy) {
            var radius = Math.max(0.05, Number(catchRadius || 0));
            if (radius <= 0.05) return null;
            var enemyApi = enemyRuntimeApi();
            var enemies = enemyApi && enemyApi.getEnemies ? enemyApi.getEnemies() : [];
            if (!enemies || !enemies.length) return null;

            var best = null;
            var bestDistance = isFinite(maxDistance) ? Number(maxDistance) : Infinity;

            for (var i = 0; i < enemies.length; i++) {
                var enemy = enemies[i];
                if (!enemy || !enemy.alive) continue;
                if (trackedEnemy && enemy !== trackedEnemy) continue;

                var hitboxes = [];
                if (enemy.bodyHitbox) hitboxes.push(enemy.bodyHitbox);
                if (enemy.headHitbox) hitboxes.push(enemy.headHitbox);
                if (!hitboxes.length) continue;

                for (var h = 0; h < hitboxes.length; h++) {
                    var hitbox = hitboxes[h];
                    var distanceAlong = segmentIntersectsExpandedHitbox(start, end, hitbox, radius, tmpClosestPoint);
                    if (distanceAlong == null || distanceAlong >= bestDistance) continue;
                    bestDistance = distanceAlong;
                    best = {
                        enemy: enemy,
                        hitbox: hitbox,
                        point: tmpClosestPoint.clone(),
                        distance: distanceAlong
                    };
                }
            }

            return best;
        }

        function stickPlasmaProjectile(projectile, point, enemy, def) {
            if (!projectile || !point) return;
            projectile.mesh.position.copy(point);
            projectile.velocity.set(0, 0, 0);
            projectile.stickyUntil = projectile.age + plasmaFuseDelay(def);
            projectile.stuckEnemy = enemy || null;
            projectile.trackingEnemy = null;
            projectile.trackingHitbox = null;
            projectile.trackingUntil = 0;
            projectile.stuckOffset.set(0, 0, 0);
            if (projectile.stuckEnemy && projectile.stuckEnemy.group && projectile.stuckEnemy.group.position) {
                projectile.stuckOffset.copy(point).sub(projectile.stuckEnemy.group.position);
            }
            spawnFlash(point, 0xffb347, 0.08, 0.08);
        }

        function explodeAt(position, radius, maxDamage, source, onEnemyHit) {
            var currentDefs = defs();
            var palette = effectPaletteForProjectileType(source);
            var def = currentDefs[String(source || '')] || {};
            var audioApi = audioRuntimeApi();
            if (audioApi && audioApi.play) {
                audioApi.play('explosion');
            }
            spawnExplosionBurst(position, palette.explosion, radius);

            var enemyApi = enemyRuntimeApi();
            var enemies = enemyApi && enemyApi.getEnemies ? enemyApi.getEnemies() : [];
            for (var i = 0; i < enemies.length; i++) {
                var enemy = enemies[i];
                if (!enemy || !enemy.alive) continue;

                var dist = enemy.group.position.distanceTo(position);
                if (dist > radius) continue;

                var falloff = 1 - (dist / radius);
                var damage = Math.max(explosiveMinDamage(def), Math.round(maxDamage * falloff));
                var result = enemyApi && enemyApi.damage ? enemyApi.damage(enemy.bodyHitbox, damage) : null;
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

        function removeProjectile(index) {
            var p = projectiles[index];
            if (!p) return;
            disposeSceneObject(p.mesh);
            var lastIndex = projectiles.length - 1;
            if (index !== lastIndex) {
                projectiles[index] = projectiles[lastIndex];
            }
            projectiles.pop();
        }

        function removePredictedProjectileByClientThrowId(clientThrowId) {
            var id = String(clientThrowId || '');
            if (!id) return false;
            delete predictedByClientId[id];
            for (var i = projectiles.length - 1; i >= 0; i--) {
                var p = projectiles[i];
                if (!p || p.clientThrowId !== id) continue;
                removeProjectile(i);
            }
            return true;
        }

        function removePredictedProjectileByAuthoritativeId(projectileId) {
            var id = String(projectileId || '');
            if (!id) return false;
            var removed = false;
            for (var key in predictedByClientId) {
                if (!Object.prototype.hasOwnProperty.call(predictedByClientId, key)) continue;
                var entry = predictedByClientId[key];
                if (!entry || String(entry.projectileId || '') !== id) continue;
                delete predictedByClientId[key];
                removed = true;
                for (var i = projectiles.length - 1; i >= 0; i--) {
                    var p = projectiles[i];
                    if (!p || p.clientThrowId !== key) continue;
                    removeProjectile(i);
                }
            }
            return removed;
        }

        function removeNetProjectileById(id) {
            var entry = netProjectileMap[id];
            if (!entry) return;
            disposeSceneObject(entry.mesh);
            delete netProjectileMap[id];
        }

        function removeNetProjectileVisual(projectileId) {
            var id = String(projectileId || '');
            if (!id) return false;
            if (!netProjectileMap[id]) return false;
            removeNetProjectileById(id);
            return true;
        }

        function detachSceneObject(object3d) {
            if (object3d && object3d.parent && typeof object3d.parent.remove === 'function') {
                object3d.parent.remove(object3d);
            }
        }

        function disposeSceneObject(object3d) {
            if (!object3d) return;
            detachSceneObject(object3d);
            if (typeof object3d.traverse === 'function') {
                object3d.traverse(function (node) {
                    if (node && node.geometry && typeof node.geometry.dispose === 'function') {
                        node.geometry.dispose();
                    }
                    var materials = node && node.material
                        ? (Array.isArray(node.material) ? node.material : [node.material])
                        : [];
                    for (var i = 0; i < materials.length; i++) {
                        if (materials[i] && typeof materials[i].dispose === 'function') {
                            materials[i].dispose();
                        }
                    }
                });
                return;
            }
            if (object3d.geometry && typeof object3d.geometry.dispose === 'function') {
                object3d.geometry.dispose();
            }
            var materials = object3d.material
                ? (Array.isArray(object3d.material) ? object3d.material : [object3d.material])
                : [];
            for (var mi = 0; mi < materials.length; mi++) {
                if (materials[mi] && typeof materials[mi].dispose === 'function') {
                    materials[mi].dispose();
                }
            }
        }

        function removeFlashAt(index) {
            var flash = impactFlashes[index];
            if (!flash) return;
            disposeSceneObject(flash.mesh);
            impactFlashes.splice(index, 1);
        }

        function resolveNetStickyTargetPosition(targetId, outVec3) {
            var id = String(targetId || '');
            if (!id) return null;
            var out = outVec3 || new THREE.Vector3();
            var netApi = netRuntimeApi();
            var selfState = netApi && netApi.getAuthoritativeSelfState ? netApi.getAuthoritativeSelfState() : null;
            if (selfState && id === String(selfState.id || '')) {
                var playerApi = playerRuntimeApi();
                var selfPos = playerApi && playerApi.getPosition ? playerApi.getPosition(tmpPlayerPos) : null;
                var sharedApi = sharedRuntimeApi();
                var entityConstants = sharedApi && sharedApi.entityConstants ? sharedApi.entityConstants : {};
                if (!selfPos) return null;
                out.set(
                    Number(selfPos.x || 0),
                    Number(selfPos.y || 0) - Number(entityConstants.EYE_HEIGHT || 1.6) + 1.0,
                    Number(selfPos.z || 0)
                );
                return out;
            }
            var remoteApi = remoteEntitiesRuntimeApi();
            var render = remoteApi && remoteApi.getRenderMap ? remoteApi.getRenderMap().get(id) : null;
            if (!render || !render.group) return null;
            out.set(
                Number(render.group.position.x || 0),
                Number(render.group.position.y || 0) + 1.0,
                Number(render.group.position.z || 0)
            );
            return out;
        }

        function updateNetProjectiles(dt) {
            for (var key in netProjectileMap) {
                if (!Object.prototype.hasOwnProperty.call(netProjectileMap, key)) continue;
                var entry = netProjectileMap[key];
                if (!entry || !entry.mesh || !entry.targetPosition) continue;
                if (entry.stickyUntil > 0 && entry.stuckToTargetId) {
                    var stickyTarget = resolveNetStickyTargetPosition(entry.stuckToTargetId, tmpStickyAnchor);
                    if (stickyTarget) {
                        entry.mesh.position.copy(stickyTarget).add(entry.stuckOffset || tmpNetVec.set(0, 0, 0));
                        entry.seeded = true;
                    } else if (!entry.seeded) {
                        entry.mesh.position.copy(entry.targetPosition);
                        entry.seeded = true;
                    } else {
                        entry.mesh.position.lerp(entry.targetPosition, Math.min(1, Math.max(0.12, dt * 18)));
                    }
                } else if (!entry.seeded) {
                    entry.mesh.position.copy(entry.targetPosition);
                    entry.seeded = true;
                } else {
                    var distSq = entry.mesh.position.distanceToSquared(entry.targetPosition);
                    if (distSq > 400) {
                        entry.mesh.position.copy(entry.targetPosition);
                    } else if (distSq > 0.000001) {
                        entry.mesh.position.lerp(entry.targetPosition, Math.min(1, Math.max(0.12, dt * 18)));
                    }
                }
                entry.age = Math.max(0, Number(entry.age || 0) + Math.max(0, Number(dt || 0)));
                orientProjectileVisual(entry.mesh, entry.velocity || tmpNetVec.set(0, 0, 0), entry.age);
            }
        }

        function updateProjectile(index, dt, onEnemyHit) {
            var currentDefs = defs();
            var p = projectiles[index];
            var def = currentDefs[p.type];
            var tuning = mechanicsTuning();
            var rangeTuning = distanceTuning();
            if (!p || !def) return;

            p.age += dt;

            if (p.type === 'plasma' && p.stickyUntil > 0) {
                if (p.stuckEnemy && p.stuckEnemy.alive && p.stuckEnemy.group && p.stuckEnemy.group.position) {
                    p.mesh.position.copy(p.stuckEnemy.group.position).add(p.stuckOffset);
                }
                orientProjectileVisual(p.mesh, p.velocity, p.age);
                if (p.age >= p.stickyUntil) {
                    explodeAt(p.mesh.position, def.radius, def.damage, p.type, onEnemyHit);
                    removeProjectile(index);
                }
                return;
            }

            /* Plasma no longer tracks — pure arc throw, Halo-style sticky */

            var isTrackingProjectile = (p.type === 'missile' || p.type === 'plasma_stream');
            if (isTrackingProjectile && p.age > 0.03) {
                var targetEnemy = null;
                var targetPoint = null;
                var nearestDist = Infinity;
                var enemyApi = enemyRuntimeApi();
                var enemies = enemyApi && enemyApi.getEnemies ? enemyApi.getEnemies() : [];
                var currentDir = (p.velocity.lengthSq() > 0.0001)
                    ? p.velocity.clone().normalize()
                    : (p.launchDir ? p.launchDir.clone() : new THREE.Vector3(0, 0, -1));
                var halfAngleDeg = (p.type === 'missile' || p.type === 'plasma_stream')
                    ? ((typeof def.lockHalfAngleDeg === 'number') ? def.lockHalfAngleDeg : 30)
                    : ((typeof def.acquireHalfAngleDeg === 'number') ? def.acquireHalfAngleDeg : (rangeTuning.plasmaAcquireHalfAngleDeg || 35));
                var cosLimit = Math.cos(halfAngleDeg * Math.PI / 180);
                var maxAcquireRange = (p.type === 'missile' || p.type === 'plasma_stream')
                    ? ((typeof def.acquireRange === 'number') ? def.acquireRange : 24)
                    : (rangeTuning.plasmaAcquireRange || 18);

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
                    var sharedApi = sharedRuntimeApi();
                    var seekCore = (sharedApi && sharedApi.seekCore)
                        ? sharedApi.seekCore
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
            if (p.type === 'plasma') {
                var catchHit = findPlasmaCatchCandidate(tmpStart, tmpEnd, hit ? hit.distance : Infinity, def.catchRadius, null);
                if (catchHit && (!hit || catchHit.distance <= hit.distance)) {
                    stickPlasmaProjectile(p, catchHit.point, catchHit.enemy, def);
                    return;
                }
            }

            if (hit) {
                if (hit.kind === 'enemy') {
                    var enemyApi = enemyRuntimeApi();
                    if (p.type === 'knife') {
                        var hitType = hit.object.userData.type || 'body';
                        var damage = hitType === 'head' ? def.headDamage : def.bodyDamage;
                        var result = enemyApi && enemyApi.damage ? enemyApi.damage(hit.object, damage) : null;
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
                        stickPlasmaProjectile(
                            p,
                            hit.point,
                            hit.object && hit.object.userData ? hit.object.userData.enemyRef : null,
                            def
                        );
                        return;
                    }

                    if (p.type === 'plasma_stream') {
                        var netApi = netRuntimeApi();
                        var netRuntime = netApi && netApi.runtime ? netApi.runtime : netApi;
                        var netActive = !!(netRuntime && netRuntime.isActive && netRuntime.isActive());
                        if (!netActive && hit.object && hit.object.userData) {
                            var streamHitType = hit.object.userData.type || 'body';
                            var streamDamage = streamHitType === 'head' ? (def.headDamage || def.damage || 15) : (def.bodyDamage || def.damage || 15);
                            var streamResult = enemyApi && enemyApi.damage ? enemyApi.damage(hit.object, streamDamage) : null;
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
                        stickPlasmaProjectile(p, hit.point, null, def);
                    } else if (p.type === 'plasma_stream') {
                        spawnFlash(hit.point, 0x66ddff, 0.07, 0.07);
                        removeProjectile(index);
                    } else {
                        explodeAt(hit.point, def.radius, def.damage, p.type, onEnemyHit);
                        removeProjectile(index);
                    }
                    return;
                }

                p.mesh.position.copy(hit.point);
                p.velocity.multiplyScalar(tuning.fragBounceVelocityDamping || 0.4);
                p.velocity.y = Math.abs(p.velocity.y) * (tuning.fragBounceVerticalDamping || 0.42);
                p.bounces++;
                if (p.bounces > (tuning.fragBounceMaxCount || 2) ||
                    p.velocity.lengthSq() < (tuning.fragBounceStopSpeedSq || 2.5)) {
                    p.velocity.set(0, 0, 0);
                }
            } else {
                p.mesh.position.copy(tmpEnd);
            }

            orientProjectileVisual(p.mesh, p.velocity, p.age);

            if (p.type === 'knife' && p.age >= def.life) {
                removeProjectile(index);
                return;
            }

            if (p.type === 'frag' && p.age >= def.fuse) {
                explodeAt(p.mesh.position, def.radius, def.damage, p.type, onEnemyHit);
                removeProjectile(index);
                return;
            }

            if (p.type === 'plasma' && p.age >= plasmaMaxLife(def)) {
                explodeAt(p.mesh.position, def.radius, def.damage, p.type, onEnemyHit);
                removeProjectile(index);
                return;
            }

            if ((p.type === 'missile' || p.type === 'plasma_stream') && p.age >= def.fuse) {
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

        function updateFlashes(dt) {
            for (var i = impactFlashes.length - 1; i >= 0; i--) {
                var flash = impactFlashes[i];
                flash.life -= dt;

                if (flash.life <= 0) {
                    removeFlashAt(i);
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
            var tuning = mechanicsTuning();
            var ttlMs = Math.max(1000, Number(tuning.predictedTtlMs || 5000));
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

        function buildClientThrowId() {
            localThrowSeq++;
            return 'cthrow-' + localThrowSeq + '-' + Date.now().toString(36);
        }

        function throwPredicted(type, camera, clientThrowId, intentPayload) {
            var currentDefs = defs();
            if (!currentDefs[type]) return false;
            var id = String(clientThrowId || '');
            if (!id) id = buildClientThrowId();
            var spawned = spawnProjectile(type, camera, {
                predicted: true,
                clientThrowId: id,
                intent: intentPayload || null
            });
            if (!spawned) return false;
            predictedByClientId[id] = {
                createdAt: Date.now(),
                acked: false,
                authoritativeSeen: false
            };
            return true;
        }

        function fireAbilityMissile(camera, options) {
            var sceneRef = scene();
            if (!sceneRef || !camera) return false;
            options = options || {};
            var projectileType = 'missile';
            camera.getWorldDirection(tmpForward);
            var muzzle = null;
            var playerApi = playerRuntimeApi();
            if (playerApi && playerApi.getMuzzleWorldPosition) {
                muzzle = playerApi.getMuzzleWorldPosition(tmpMuzzlePos);
            }
            var origin = muzzle && typeof muzzle.x === 'number'
                ? tmpStart.copy(muzzle).addScaledVector(tmpForward, 0.1)
                : tmpStart.copy(camera.position).addScaledVector(tmpForward, 0.75);
            var intent = buildThrowIntent(camera, {
                origin: origin
            });
            if (!intent) return false;

            var shouldPredict = false;
            if (typeof options.predictLocal === 'boolean') {
                shouldPredict = options.predictLocal;
            } else if (!(
                netRuntimeApi() &&
                netRuntimeApi().isActive &&
                netRuntimeApi().isActive()
            )) {
                shouldPredict = true;
            }

            if (shouldPredict) {
                var ok = spawnProjectile(projectileType, camera, {
                    intent: intent,
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
        }

        function update(dt, onEnemyHit) {
            purgeStalePredicted();
            for (var i = projectiles.length - 1; i >= 0; i--) {
                updateProjectile(i, dt, onEnemyHit);
            }
            updateNetProjectiles(dt);
            updateFlashes(dt);
        }

        function reset() {
            for (var i = projectiles.length - 1; i >= 0; i--) {
                var projectile = projectiles[i];
                disposeSceneObject(projectile && projectile.mesh);
            }
            for (var key in netProjectileMap) {
                if (!Object.prototype.hasOwnProperty.call(netProjectileMap, key)) continue;
                removeNetProjectileById(key);
            }
            for (var f = impactFlashes.length - 1; f >= 0; f--) {
                removeFlashAt(f);
            }
            projectiles = [];
            impactFlashes = [];
            netProjectileMap = {};
            predictedByClientId = {};
            localThrowSeq = 1;
        }

        return {
            buildClientThrowId: buildClientThrowId,
            createThrowableMesh: createThrowableMesh,
            fireAbilityMissile: fireAbilityMissile,
            getNetProjectileMap: function () { return netProjectileMap; },
            getPredictedByClientId: function () { return predictedByClientId; },
            getPredictedCount: function () { return Object.keys(predictedByClientId).length; },
            getProjectiles: function () { return projectiles; },
            orientProjectileVisual: orientProjectileVisual,
            removeNetProjectileById: removeNetProjectileById,
            removeNetProjectileVisual: removeNetProjectileVisual,
            removePredictedProjectileByAuthoritativeId: removePredictedProjectileByAuthoritativeId,
            removePredictedProjectileByClientThrowId: removePredictedProjectileByClientThrowId,
            removeProjectile: removeProjectile,
            reset: reset,
            segmentCollision: segmentCollision,
            spawnExplosionBurst: spawnExplosionBurst,
            spawnFlash: spawnFlash,
            spawnProjectile: spawnProjectile,
            throwPredicted: throwPredicted,
            update: update
        };
    }

    globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    globalThis.__MAYHEM_RUNTIME.GameThrowablesProjectileRuntime = {
        create: create
    };
})();
