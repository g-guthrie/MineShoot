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

    var raycaster = new THREE.Raycaster();
    var tmpForward = new THREE.Vector3();
    var tmpRight = new THREE.Vector3();
    var tmpUp = new THREE.Vector3();
    var tmpStart = new THREE.Vector3();
    var tmpEnd = new THREE.Vector3();
    var tmpDir = new THREE.Vector3();
    var tmpTarget = new THREE.Vector3();

    var throwableOrder = ['frag', 'seeker', 'molotov', 'knife'];
    var defs = {
        frag: {
            id: 'frag',
            label: 'Frag',
            speed: 16,
            upward: 5.2,
            gravity: 19,
            fuse: 2.2,
            radius: 5.4,
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
            radius: 5.0,
            damage: 110,
            regen: 15
        },
        molotov: {
            id: 'molotov',
            label: 'Molotov',
            speed: 15,
            upward: 4.8,
            gravity: 21,
            fuse: 3.0,
            fireRadius: 3.2,
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
        if (inv.charges < inv.maxCharges && inv.cooldownRemaining <= 0) {
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
        if (type === 'seeker') {
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
        // knife
        var knife = new THREE.Mesh(
            new THREE.BoxGeometry(0.04, 0.04, 0.45),
            new THREE.MeshLambertMaterial({ color: 0xbfc5ca })
        );
        knife.rotation.x = Math.PI / 2;
        return knife;
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

    function spawnProjectile(type, camera) {
        if (!sceneRef || !camera) return false;
        var def = defs[type];
        if (!def) return false;

        camera.getWorldDirection(tmpForward);
        tmpRight.set(1, 0, 0).applyQuaternion(camera.quaternion);
        tmpUp.set(0, 1, 0).applyQuaternion(camera.quaternion);

        var origin = camera.position.clone()
            .addScaledVector(tmpForward, 0.75)
            .addScaledVector(tmpRight, 0.2)
            .addScaledVector(tmpUp, -0.15);

        var vel = tmpForward.clone().multiplyScalar(def.speed);
        vel.y += def.upward;

        var mesh = createThrowableMesh(type);
        mesh.position.copy(origin);
        sceneRef.add(mesh);

        projectiles.push({
            type: type,
            mesh: mesh,
            velocity: vel,
            age: 0,
            bounces: 0
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

        if (p.type === 'seeker' && p.age > 0.15) {
            var targetEnemy = findNearestEnemy(p.mesh.position, 22);
            if (targetEnemy) {
                tmpTarget.copy(targetEnemy.group.position);
                tmpTarget.y += 1.5;
                tmpDir.copy(tmpTarget).sub(p.mesh.position).normalize().multiplyScalar(def.speed + 2);
                p.velocity.lerp(tmpDir, Math.min(1, dt * 4.8));
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

            if (p.type === 'seeker') {
                explodeAt(hit.point, def.radius, def.damage, p.type, onEnemyHit);
                removeProjectile(index);
                return;
            }

            // Frag grenade can bounce before fuse pop.
            p.mesh.position.copy(hit.point);
            p.velocity.multiplyScalar(0.4);
            p.velocity.y = Math.abs(p.velocity.y) * 0.42;
            p.bounces++;
            if (p.bounces > 2 || p.velocity.lengthSq() < 2.5) {
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

        if (p.type === 'seeker' && p.age >= def.fuse) {
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

    GameThrowables.init = function (scene) {
        sceneRef = scene;
        projectiles = [];
        fireZones = [];
        impactFlashes = [];
        resetInventory();
    };

    GameThrowables.getTypes = function () {
        return throwableOrder.slice();
    };

    GameThrowables.getState = function () {
        return getThrowableState();
    };

    /**
     * Throw a specific type if charge is available
     * @param {string} type - frag|seeker|molotov|knife
     * @param {THREE.Camera} camera
     * @returns {Object} { ok, reason, state }
     */
    GameThrowables.throw = function (type, camera) {
        if (!defs[type]) {
            return { ok: false, reason: 'unknown', state: getThrowableState() };
        }
        if (!consumeCharge(type)) {
            return { ok: false, reason: 'cooldown', state: getThrowableState() };
        }

        var spawned = spawnProjectile(type, camera);
        if (!spawned) {
            inventory[type].charges++;
            return { ok: false, reason: 'spawn_failed', state: getThrowableState() };
        }

        return { ok: true, reason: '', state: getThrowableState() };
    };

    /**
     * Update projectiles, aoe zones, and inventory regen
     * @param {number} dt
     * @param {Function} onEnemyHit - callback({hitPoint, damage, hitType, result, source, special})
     */
    GameThrowables.update = function (dt, onEnemyHit) {
        regenCharges(dt);

        for (var i = projectiles.length - 1; i >= 0; i--) {
            updateProjectile(i, dt, onEnemyHit);
        }
        updateFireZones(dt, onEnemyHit);
        updateFlashes(dt);
    };

    window.GameThrowables = GameThrowables;
})();
