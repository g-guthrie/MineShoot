/**
 * throwables.js - Frag/seeker/molotov/knife logic with regen inventory
 * Loaded as global: window.GameThrowables
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
    var throwableDistanceTuning = (window.GameCombatTuning && window.GameCombatTuning.getThrowableDistanceTuning)
        ? window.GameCombatTuning.getThrowableDistanceTuning()
        : {
            fragRadius: 5.4,
            seekerRadius: 5.0,
            seekerShotRadius: 4.6,
            molotovFireRadius: 3.2,
            seekerAcquireRange: 22
        };
    var throwableMechanicsTuning = (window.GameCombatTuning && window.GameCombatTuning.getThrowableMechanicsTuning)
        ? window.GameCombatTuning.getThrowableMechanicsTuning()
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

    var throwableOrder = ['frag', 'seeker', 'molotov', 'knife'];
    var defs = {
        frag: {
            id: 'frag',
            label: 'Frag',
            speed: 16,
            upward: 5.2,
            gravity: 19,
            fuse: 2.2,
            radius: throwableDistanceTuning.fragRadius,
            damage: 125,
            regen: 10
        },
        seeker: {
            id: 'seeker',
            label: 'Seeker',
            speed: 14,
            upward: 4.4,
            gravity: 12,
            fuse: 3.4,
            radius: throwableDistanceTuning.seekerRadius,
            damage: 110,
            homingBoost: 2.0,
            homingLerp: 4.8,
            regen: 15
        },
        seekershot: {
            id: 'seekershot',
            label: 'Seeker Shot',
            speed: 34,
            upward: 0.6,
            gravity: 5,
            fuse: 1.8,
            radius: throwableDistanceTuning.seekerShotRadius,
            damage: 95,
            homingBoost: 4.5,
            homingLerp: 3.8,
            lockHalfAngleDeg: 30
        },
        molotov: {
            id: 'molotov',
            label: 'Molotov',
            speed: 15,
            upward: 4.8,
            gravity: 21,
            fuse: 3.0,
            fireRadius: throwableDistanceTuning.molotovFireRadius,
            fireDuration: 5.5,
            fireTickDamage: 18,
            fireTickRate: 0.35,
            regen: 14
        },
        knife: {
            id: 'knife',
            label: 'Knife',
            speed: 28,
            upward: 1.4,
            gravity: 7,
            life: 1.8,
            bodyDamage: 100,
            headDamage: 250,
            regen: 8
        }
    };

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
        var worldMeshes = window.GameWorld.getCollidables ? window.GameWorld.getCollidables() : [];
        var hitboxes = window.GameEnemy.getHitboxArray ? window.GameEnemy.getHitboxArray() : [];
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
        var ids = ['frag', 'seeker', 'molotov'];
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
        if (type === 'seeker' || type === 'seekershot') {
            return new THREE.Mesh(
                new THREE.BoxGeometry(0.2, 0.2, 0.2),
                new THREE.MeshLambertMaterial({ color: 0x22aabb, emissive: 0x112222 })
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
        if (type === 'ninjastar') {
            var starGroup = new THREE.Group();
            var starMat = new THREE.MeshLambertMaterial({ color: 0x888888, emissive: 0x222222 });
            for (var s = 0; s < 4; s++) {
                var blade = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.22, 0.06), starMat);
                blade.rotation.z = (s * Math.PI) / 4;
                starGroup.add(blade);
            }
            var core = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.08), starMat);
            starGroup.add(core);
            return starGroup;
        }
        if (type === 'lightsaber') {
            var saberGroup = new THREE.Group();
            var hilt = new THREE.Mesh(
                new THREE.BoxGeometry(0.06, 0.06, 0.18),
                new THREE.MeshLambertMaterial({ color: 0x444444 })
            );
            saberGroup.add(hilt);
            var bladeMesh = new THREE.Mesh(
                new THREE.BoxGeometry(0.04, 0.04, 0.7),
                new THREE.MeshBasicMaterial({ color: 0x44ff66, transparent: true, opacity: 0.88 })
            );
            bladeMesh.position.z = -0.44;
            saberGroup.add(bladeMesh);
            return saberGroup;
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
        return new THREE.Mesh(
            new THREE.CylinderGeometry(radius, radius, 0.08, 16),
            new THREE.MeshBasicMaterial({
                color: 0xff7733,
                transparent: true,
                opacity: 0.45
            })
        );
    }

    function spawnFlash(position, color, baseScale, life) {
        if (!sceneRef) return;
        var flash = new THREE.Mesh(
            new THREE.SphereGeometry(0.4, 8, 8),
            new THREE.MeshBasicMaterial({
                color: color,
                transparent: true,
                opacity: 0.85
            })
        );
        flash.position.copy(position);
        flash.scale.set(baseScale, baseScale, baseScale);
        sceneRef.add(flash);
        impactFlashes.push({
            mesh: flash,
            life: life,
            maxLife: life
        });
    }

    function getDefaultThrowOrigin(camera, forward, right, up) {
        var hand = null;
        if (window.GamePlayer && window.GamePlayer.getThrowableOriginWorldPosition) {
            hand = window.GamePlayer.getThrowableOriginWorldPosition();
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

    function spawnProjectile(type, camera, options) {
        if (!sceneRef || !camera) return false;
        var def = defs[type];
        if (!def) return false;
        options = options || {};

        var intent = options.intent || buildThrowIntent(camera, options);
        if (!intent || !intent.origin || !intent.direction) return false;
        var origin = intent.origin.clone();
        var baseDir = intent.direction.clone().normalize();
        var vel = baseDir.multiplyScalar(def.speed);
        if (!options.direction) {
            vel.y += def.upward;
        } else if (def.upward) {
            vel.y += def.upward * 0.15;
        }

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
        var enemies = window.GameEnemy.getEnemies ? window.GameEnemy.getEnemies() : [];
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

        tmpDir.divideScalar(dist);
        raycaster.set(start, tmpDir);
        raycaster.far = dist + 0.03;

        var targets = getWorldTargets();
        var allTargets = targets.hitboxes.concat(targets.worldMeshes);
        if (allTargets.length === 0) return null;

        var hits = raycaster.intersectObjects(allTargets, false);
        if (hits.length === 0) return null;

        var hit = hits[0];
        var kind = targets.hitboxes.indexOf(hit.object) !== -1 ? 'enemy' : 'world';

        return {
            kind: kind,
            object: hit.object,
            point: hit.point
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
        if (window.GameAudio && window.GameAudio.play) {
            window.GameAudio.play('explosion');
        }
        spawnFlash(position, 0xffaa22, 0.2, 0.18);

        var enemies = window.GameEnemy.getEnemies ? window.GameEnemy.getEnemies() : [];
        for (var i = 0; i < enemies.length; i++) {
            var enemy = enemies[i];
            if (!enemy || !enemy.alive) continue;

            var dist = enemy.group.position.distanceTo(position);
            if (dist > radius) continue;

            var falloff = 1 - (dist / radius);
            var damage = Math.max(20, Math.round(maxDamage * falloff));
            var result = window.GameEnemy.damage(enemy.bodyHitbox, damage);
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

        if (window.GameAudio && window.GameAudio.play) {
            window.GameAudio.play('explosion');
        }
        spawnFlash(position, 0xff6622, 0.25, 0.2);
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

        var isSeekerLike = (p.type === 'seeker' || p.type === 'seekershot');
        if (isSeekerLike && p.age > 0.03) {
            var targetEnemy = null;
            if (p.forcedTargetId && window.GameEnemy && window.GameEnemy.getLockTargets) {
                var lockTargets = window.GameEnemy.getLockTargets() || [];
                for (var lt = 0; lt < lockTargets.length; lt++) {
                    if (lockTargets[lt] && lockTargets[lt].targetId === p.forcedTargetId && lockTargets[lt].enemyRef && lockTargets[lt].enemyRef.alive) {
                        targetEnemy = lockTargets[lt].enemyRef;
                        break;
                    }
                }
            }
            if (!targetEnemy) {
                targetEnemy = findNearestEnemy(p.mesh.position, throwableDistanceTuning.seekerAcquireRange);
            }
            if (targetEnemy) {
                tmpTarget.copy(targetEnemy.group.position);
                tmpTarget.y += 1.5;
                if (p.type === 'seekershot') {
                    var currentDir = (p.velocity.lengthSq() > 0.0001)
                        ? p.velocity.clone().normalize()
                        : (p.launchDir ? p.launchDir.clone() : new THREE.Vector3(0, 0, -1));
                    var toTargetDir = tmpTarget.clone().sub(p.mesh.position).normalize();
                    var halfAngleDeg = (typeof def.lockHalfAngleDeg === 'number') ? def.lockHalfAngleDeg : 30;
                    var cosLimit = Math.cos(halfAngleDeg * Math.PI / 180);
                    if (currentDir.dot(toTargetDir) < cosLimit) {
                        targetEnemy = null;
                    }
                }
            }
            if (targetEnemy) {
                var homingSpeed = def.speed + (def.homingBoost || 2);
                var homingLerp = def.homingLerp || 4.8;
                tmpDir.copy(tmpTarget).sub(p.mesh.position).normalize().multiplyScalar(homingSpeed);
                p.velocity.lerp(tmpDir, Math.min(1, dt * homingLerp));
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
                    var result = window.GameEnemy.damage(hit.object, damage);
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

                explodeAt(hit.point, def.radius, def.damage, p.type, onEnemyHit);
                removeProjectile(index);
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

            if (p.type === 'seeker' || p.type === 'seekershot') {
                explodeAt(hit.point, def.radius, def.damage, p.type, onEnemyHit);
                removeProjectile(index);
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

        if ((p.type === 'seeker' || p.type === 'seekershot') && p.age >= def.fuse) {
            explodeAt(p.mesh.position, def.radius, def.damage, p.type, onEnemyHit);
            removeProjectile(index);
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
                var enemies = window.GameEnemy.getEnemies ? window.GameEnemy.getEnemies() : [];
                for (var j = 0; j < enemies.length; j++) {
                    var enemy = enemies[j];
                    if (!enemy || !enemy.alive) continue;

                    var d = enemy.group.position.distanceTo(z.center);
                    if (d > z.radius) continue;

                    var dmg = defs.molotov.fireTickDamage;
                    var result = window.GameEnemy.damage(enemy.bodyHitbox, dmg);
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
            flash.mesh.scale.set(0.2 + t * 1.8, 0.2 + t * 1.8, 0.2 + t * 1.8);
            flash.mesh.material.opacity = Math.max(0, 0.85 * (1 - t));
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

    GameThrowables.getSeekerShotTuning = function () {
        var def = defs.seekershot;
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
     * @param {string} type - frag|seeker|molotov|knife
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
            var isAbilityProj = (p.type === 'ninjastar' || p.type === 'lightsaber');
            if (!p || !p.id || (!defs[p.type] && !isAbilityProj)) continue;
            seenProjectile[p.id] = true;
            var entry = netProjectileMap[p.id];
            if (!entry) {
                var mesh = createThrowableMesh(p.type);
                sceneRef.add(mesh);
                entry = { id: p.id, mesh: mesh, type: p.type };
                netProjectileMap[p.id] = entry;
            }
            entry.mesh.position.set(Number(p.x || 0), Number(p.y || 0), Number(p.z || 0));
            if (p.type === 'ninjastar') {
                entry.mesh.rotation.z += 0.35;
            } else if (p.type === 'lightsaber') {
                entry.mesh.rotation.z += 0.25;
                entry.mesh.rotation.y += 0.15;
            }
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
            spawnFlash(new THREE.Vector3(Number(event.x || 0), Number(event.y || 0), Number(event.z || 0)), 0xffaa22, 0.2, 0.18);
            return;
        }
        if (event.t === 'aoe_end' && event.zoneId) {
            removeNetFireZoneById(event.zoneId);
        }
    };

    GameThrowables.fireSeekerShot = function (camera, lockTarget) {
        if (!sceneRef || !camera) return false;
        camera.getWorldDirection(tmpForward);
        var muzzle = null;
        if (window.GamePlayer && window.GamePlayer.getMuzzleWorldPosition) {
            muzzle = window.GamePlayer.getMuzzleWorldPosition();
        }
        var origin = muzzle && typeof muzzle.x === 'number'
            ? muzzle.clone().addScaledVector(tmpForward, 0.1)
            : camera.position.clone().addScaledVector(tmpForward, 0.75);
        return spawnProjectile('seekershot', camera, {
            origin: origin,
            direction: tmpForward.clone(),
            targetId: lockTarget && lockTarget.targetId ? lockTarget.targetId : ''
        });
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
        if (debugInstantCooldowns) {
            for (var i = 0; i < throwableOrder.length; i++) {
                var inv = inventory[throwableOrder[i]];
                if (inv) {
                    inv.charges = inv.maxCharges;
                    inv.cooldownRemaining = 0;
                }
            }
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

    window.GameThrowables = GameThrowables;
})();
