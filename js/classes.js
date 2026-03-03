/**
 * classes.js - Player class selection and class abilities
 * Loaded as global: window.GameClasses
 */
(function () {
    'use strict';

    var GameClasses = {};
    var classAbilityTuning = (window.GameCombatTuning && window.GameCombatTuning.getClassAbilityTuning)
        ? window.GameCombatTuning.getClassAbilityTuning()
        : {
            ninjaThrowRange: 42,
            ninjaUltimateRadius: 11,
            jediAbilityRange: 13,
            jediUltimateRange: 6.0,
            magicianAimRange: 36,
            magicianAbilityRadius: 4.8,
            magicianUltimateRange: 60,
            sharpshooterUltimateRange: 70,
            brawlerAbilityRange: 4.2,
            brawlerRageRadius: 5.2
        };

    function classWallhackRadiusFor(classId) {
        if (window.GameCombatTuning && window.GameCombatTuning.getClassWallhackRadius) {
            return window.GameCombatTuning.getClassWallhackRadius(classId);
        }
        var fallback = {
            ninja: 90,
            jedi: 85,
            magician: 100,
            sharpshooter: 115,
            brawler: 75
        };
        return fallback[classId] || fallback.sharpshooter;
    }

    var CLASS_ORDER = ['ninja', 'jedi', 'magician', 'sharpshooter', 'brawler'];
    var CLASS_DEFS = {
        ninja: {
            id: 'ninja',
            name: 'Ninja',
            abilityName: 'Shuriken Burst',
            ultimateName: 'Shadow Dash',
            abilityCooldown: 6.0,
            ultimateCooldown: 20.0,
            loadoutWeapon: 'pistol',
            armorMax: 80,
            wallhackRadius: classWallhackRadiusFor('ninja')
        },
        jedi: {
            id: 'jedi',
            name: 'Jedi',
            abilityName: 'Force Choke',
            ultimateName: 'Saber Throw',
            abilityCooldown: 8.0,
            ultimateCooldown: 18.0,
            loadoutWeapon: 'shotgun',
            armorMax: 130,
            wallhackRadius: classWallhackRadiusFor('jedi')
        },
        magician: {
            id: 'magician',
            name: 'Magician',
            abilityName: 'Fireball',
            ultimateName: 'Chain Lightning',
            abilityCooldown: 7.0,
            ultimateCooldown: 20.0,
            loadoutWeapon: 'rifle',
            armorMax: 100,
            wallhackRadius: classWallhackRadiusFor('magician')
        },
        sharpshooter: {
            id: 'sharpshooter',
            name: 'Sharpshooter',
            abilityName: 'Focus Shot',
            ultimateName: 'Deadeye',
            abilityCooldown: 8.0,
            ultimateCooldown: 22.0,
            loadoutWeapon: 'sniper',
            armorMax: 90,
            wallhackRadius: classWallhackRadiusFor('sharpshooter')
        },
        brawler: {
            id: 'brawler',
            name: 'Brawler',
            abilityName: 'Bat Swing',
            ultimateName: 'Rage Mode',
            abilityCooldown: 5.0,
            ultimateCooldown: 20.0,
            loadoutWeapon: 'machinegun',
            armorMax: 150,
            wallhackRadius: classWallhackRadiusFor('brawler')
        }
    };

    var sceneRef = null;
    var currentClassId = 'sharpshooter';
    var queuedClassId = null;
    var debugInstantCooldowns = false;

    var abilityCooldownRemaining = 0;
    var ultimateCooldownRemaining = 0;

    // Sharpshooter state
    var focusShots = 0;
    var focusTimer = 0;
    var deadeyeActive = false;
    var deadeyeRemaining = 0;
    var deadeyeDurationTotal = 0;
    var deadeyeMaxLocks = 0;
    var deadeyeLockTime = 0;
    var deadeyeRange = 0;
    var deadeyeLockedTargets = [];
    var deadeyeAcquiringTarget = null;
    var deadeyeDamage = 260;

    // Brawler state
    var rageTimer = 0;
    var rageTickTimer = 0;

    var effectBursts = [];

    var raycaster = new THREE.Raycaster();
    var centerPoint = new THREE.Vector2(0, 0);
    var tmpForward = new THREE.Vector3();
    var tmpTo = new THREE.Vector3();
    var tmpTarget = new THREE.Vector3();

    function getClassDef() {
        return CLASS_DEFS[currentClassId] || CLASS_DEFS.sharpshooter;
    }

    function notify(notifier, text, ms) {
        if (notifier && text) notifier(text, ms || 900);
    }

    function resetRuntimeState() {
        abilityCooldownRemaining = 0;
        ultimateCooldownRemaining = 0;
        focusShots = 0;
        focusTimer = 0;
        deadeyeActive = false;
        deadeyeRemaining = 0;
        deadeyeDurationTotal = 0;
        deadeyeMaxLocks = 0;
        deadeyeLockTime = 0;
        deadeyeRange = 0;
        deadeyeLockedTargets = [];
        deadeyeAcquiringTarget = null;
        rageTimer = 0;
        rageTickTimer = 0;
        ninjaShadowDashTimer = 0;
    }

    function spawnPulse(position, color, scale, life) {
        if (!sceneRef || !position) return;

        var mesh = new THREE.Mesh(
            new THREE.SphereGeometry(0.35, 10, 10),
            new THREE.MeshBasicMaterial({
                color: color,
                transparent: true,
                opacity: 0.72,
                depthTest: false,
                depthWrite: false
            })
        );
        mesh.position.copy(position);
        mesh.scale.set(scale, scale, scale);
        mesh.renderOrder = 70;
        sceneRef.add(mesh);

        effectBursts.push({
            mesh: mesh,
            life: life,
            maxLife: life,
            maxScale: scale * 3.2
        });
    }

    function updateEffects(dt) {
        for (var i = effectBursts.length - 1; i >= 0; i--) {
            var e = effectBursts[i];
            e.life -= dt;
            if (e.life <= 0) {
                if (e.mesh && e.mesh.parent) e.mesh.parent.remove(e.mesh);
                effectBursts.splice(i, 1);
                continue;
            }

            var t = 1 - (e.life / e.maxLife);
            var s = 0.6 + (e.maxScale - 0.6) * t;
            e.mesh.scale.set(s, s, s);
            e.mesh.material.opacity = Math.max(0, 0.72 * (1 - t));
        }
    }

    function getAliveEnemies() {
        var enemies = window.GameEnemy && window.GameEnemy.getEnemies ? window.GameEnemy.getEnemies() : [];
        var out = [];
        for (var i = 0; i < enemies.length; i++) {
            if (enemies[i] && enemies[i].alive) out.push(enemies[i]);
        }
        return out;
    }

    function enemiesInRadius(center, radius) {
        var enemies = getAliveEnemies();
        var out = [];

        for (var i = 0; i < enemies.length; i++) {
            var e = enemies[i];
            var d = e.group.position.distanceTo(center);
            if (d <= radius) {
                out.push({ enemy: e, distance: d });
            }
        }

        out.sort(function (a, b) { return a.distance - b.distance; });
        return out;
    }

    function enemiesInCone(origin, yaw, range, minDot) {
        var enemies = getAliveEnemies();
        var out = [];
        var forwardX = -Math.sin(yaw);
        var forwardZ = -Math.cos(yaw);

        for (var i = 0; i < enemies.length; i++) {
            var e = enemies[i];
            var dx = e.group.position.x - origin.x;
            var dz = e.group.position.z - origin.z;
            var d = Math.sqrt(dx * dx + dz * dz);
            if (d > range || d < 0.001) continue;

            var dot = (dx / d) * forwardX + (dz / d) * forwardZ;
            if (dot < minDot) continue;

            out.push({ enemy: e, distance: d, dot: dot });
        }

        out.sort(function (a, b) { return a.distance - b.distance; });
        return out;
    }

    function hasLineOfSightFromCamera(enemy, camera, maxDistance, minDot) {
        if (!enemy || !camera) return false;

        camera.getWorldDirection(tmpForward);
        tmpTarget.copy(enemy.group.position);
        tmpTarget.y += 2.2;

        tmpTo.copy(tmpTarget).sub(camera.position);
        var dist = tmpTo.length();
        if (dist <= 0.001 || dist > maxDistance) return false;

        tmpTo.divideScalar(dist);
        if (tmpTo.dot(tmpForward) < minDot) return false;

        var worldMeshes = window.GameWorld.getCollidables ? window.GameWorld.getCollidables() : [];
        if (!worldMeshes || worldMeshes.length === 0) return true;

        raycaster.set(camera.position, tmpTo);
        raycaster.far = dist - 0.2;
        return raycaster.intersectObjects(worldMeshes, false).length === 0;
    }

    function visibleEnemies(camera, maxDistance, minDot) {
        var enemies = getAliveEnemies();
        var out = [];

        for (var i = 0; i < enemies.length; i++) {
            if (hasLineOfSightFromCamera(enemies[i], camera, maxDistance, minDot)) {
                out.push(enemies[i]);
            }
        }

        out.sort(function (a, b) {
            return a.group.position.distanceTo(camera.position) - b.group.position.distanceTo(camera.position);
        });
        return out;
    }

    function castEnemyHitboxFromCenter(camera, maxRange) {
        if (!camera || !window.GameEnemy || !window.GameEnemy.getHitboxArray) return null;

        var hitboxes = window.GameEnemy.getHitboxArray() || [];
        var worldMeshes = window.GameWorld.getCollidables ? window.GameWorld.getCollidables() : [];
        var allTargets = hitboxes.concat(worldMeshes);
        if (allTargets.length === 0) return null;

        raycaster.setFromCamera(centerPoint, camera);
        raycaster.far = maxRange;

        var hits = raycaster.intersectObjects(allTargets, false);
        if (hits.length === 0) return null;

        for (var i = 0; i < hits.length; i++) {
            if (hitboxes.indexOf(hits[i].object) !== -1) {
                return {
                    hitbox: hits[i].object,
                    point: hits[i].point,
                    distance: hits[i].distance
                };
            }
            if (worldMeshes.indexOf(hits[i].object) !== -1) {
                return null;
            }
        }

        return null;
    }

    function getAimPoint(camera, maxDistance) {
        if (!camera) return null;

        var hitboxes = window.GameEnemy && window.GameEnemy.getHitboxArray ? (window.GameEnemy.getHitboxArray() || []) : [];
        var worldMeshes = window.GameWorld.getCollidables ? window.GameWorld.getCollidables() : [];
        var allTargets = hitboxes.concat(worldMeshes);

        raycaster.setFromCamera(centerPoint, camera);
        raycaster.far = maxDistance;

        if (allTargets.length > 0) {
            var hits = raycaster.intersectObjects(allTargets, false);
            if (hits.length > 0) return hits[0].point.clone();
        }

        camera.getWorldDirection(tmpForward);
        return camera.position.clone().addScaledVector(tmpForward, maxDistance);
    }

    function reportEnemyHit(hitbox, damage, source, onEnemyHit, special) {
        if (!hitbox || !window.GameEnemy || !window.GameEnemy.damage) return false;

        damage = Math.max(1, Math.round(damage));
        var result = window.GameEnemy.damage(hitbox, damage);
        if (!result) return false;

        if (onEnemyHit) {
            onEnemyHit({
                hitPoint: hitbox.position.clone(),
                damage: damage,
                hitType: hitbox.userData.type || 'body',
                result: result,
                source: source || 'class',
                special: special || null
            });
        }

        return true;
    }

    function reportEnemyDamage(enemy, damage, hitType, source, onEnemyHit, special) {
        if (!enemy || !enemy.alive) return false;
        var hitbox = (hitType === 'head') ? enemy.headHitbox : enemy.bodyHitbox;
        return reportEnemyHit(hitbox, damage, source, onEnemyHit, special);
    }

    function applyStun(enemy, duration) {
        if (window.GameEnemy && window.GameEnemy.applyStun) {
            window.GameEnemy.applyStun(enemy, duration);
        }
    }

    function applySlow(enemy, duration, multiplier) {
        if (window.GameEnemy && window.GameEnemy.applySlow) {
            window.GameEnemy.applySlow(enemy, duration, multiplier);
        }
    }

    var ninjaShadowDashTimer = 0;

    function triggerNinjaAbility(camera, onEnemyHit) {
        var count = classAbilityTuning.ninjaStarCount || 3;
        var spreadDeg = classAbilityTuning.ninjaStarSpreadDeg || 16;
        var damage = classAbilityTuning.ninjaStarBodyDamage || 120;
        var headDamage = classAbilityTuning.ninjaStarHeadDamage || 170;
        var range = classAbilityTuning.ninjaThrowRange || 42;
        var anyHit = false;

        for (var i = 0; i < count; i++) {
            var center = (count - 1) * 0.5;
            var offsetDeg = (i - center) * spreadDeg;
            var hit = castEnemyHitboxFromCenter(camera, range);
            if (hit && hit.hitbox) {
                var hitType = hit.hitbox.userData.type || 'body';
                var dmg = hitType === 'head' ? headDamage : damage;
                var ok = reportEnemyHit(hit.hitbox, dmg, 'ninja-star', onEnemyHit);
                if (ok) {
                    spawnPulse(hit.point, 0xcccccc, 0.2, 0.14);
                    anyHit = true;
                }
            }
        }

        if (anyHit) {
            spawnPulse(camera.position, 0xaaaaaa, 0.25, 0.12);
            return { ok: true, message: 'Shuriken Burst!' };
        }
        return { ok: true, message: 'Shurikens thrown!' };
    }

    function triggerNinjaUltimate(playerPos, onEnemyHit) {
        var steps = classAbilityTuning.shadowDashSteps || 4;
        var stepDur = classAbilityTuning.shadowDashStepDuration || 0.12;
        ninjaShadowDashTimer = steps * stepDur;
        spawnPulse(playerPos, 0x555555, 0.6, 0.3);
        return { ok: true, message: 'Shadow Dash!' };
    }

    function triggerJediAbility(playerPos, yaw, onEnemyHit) {
        var targets = enemiesInCone(playerPos, yaw, classAbilityTuning.jediAbilityRange, 0.05);
        if (targets.length === 0) return { ok: false, message: 'No target for Force Choke.' };

        var enemy = targets[0].enemy;
        reportEnemyDamage(enemy, 95, 'body', 'force-choke', onEnemyHit);
        applyStun(enemy, 1.6);
        spawnPulse(enemy.group.position, 0x7ed7ff, 0.42, 0.22);
        return { ok: true, message: 'Force Choke!' };
    }

    function triggerJediUltimate(playerPos, yaw, onEnemyHit) {
        var saberRange = classAbilityTuning.jediSaberMaxDistance || 22;
        var saberDamage = classAbilityTuning.jediSaberDamage || 175;
        var targets = enemiesInCone(playerPos, yaw, saberRange, -0.15);
        if (targets.length === 0) return { ok: false, message: 'No targets for Saber Throw.' };

        var hits = 0;
        for (var i = 0; i < targets.length; i++) {
            hits++;
            reportEnemyDamage(targets[i].enemy, saberDamage, 'body', 'saber-throw', onEnemyHit);
        }

        spawnPulse(playerPos, 0x44ff88, 0.52, 0.2);
        return { ok: true, message: 'Saber Throw x' + hits };
    }

    function triggerMagicianAbility(camera, onEnemyHit) {
        var point = getAimPoint(camera, classAbilityTuning.magicianAimRange);
        if (!point) return { ok: false, message: 'Fireball failed.' };

        var radius = classAbilityTuning.magicianAbilityRadius;
        var targets = enemiesInRadius(point, radius);
        for (var i = 0; i < targets.length; i++) {
            var falloff = 1 - (targets[i].distance / radius);
            var damage = Math.max(55, Math.round(180 * falloff));
            reportEnemyDamage(targets[i].enemy, damage, 'body', 'fireball', onEnemyHit);
            applySlow(targets[i].enemy, 1.8, 0.72);
        }

        spawnPulse(point, 0xff7f33, 0.55, 0.24);
        return { ok: true, message: 'Fireball cast.' };
    }

    function triggerMagicianUltimate(camera, onEnemyHit) {
        var targets = visibleEnemies(camera, classAbilityTuning.magicianUltimateRange, 0.15);
        if (targets.length === 0) return { ok: false, message: 'No targets for Chain Lightning.' };

        var count = Math.min(4, targets.length);
        for (var i = 0; i < count; i++) {
            var damage = Math.round(240 * Math.pow(0.68, i));
            reportEnemyDamage(targets[i], damage, 'body', 'chain-lightning', onEnemyHit);
            spawnPulse(targets[i].group.position, 0x66c8ff, 0.35, 0.18);
        }

        return { ok: true, message: 'Chain Lightning x' + count };
    }

    function triggerSharpshooterAbility() {
        focusShots = 1;
        focusTimer = 8.0;
        return { ok: true, message: 'Focus primed.' };
    }

    function isDeadeyeTargetLocked(enemy) {
        for (var i = 0; i < deadeyeLockedTargets.length; i++) {
            if (deadeyeLockedTargets[i] && deadeyeLockedTargets[i].enemy === enemy) return true;
        }
        return false;
    }

    function pickNextDeadeyeTarget(camera) {
        var visible = visibleEnemies(camera, deadeyeRange, 0.18);
        for (var i = 0; i < visible.length; i++) {
            var enemy = visible[i];
            if (!enemy || !enemy.alive) continue;
            if (deadeyeAcquiringTarget && deadeyeAcquiringTarget.enemy === enemy) continue;
            if (isDeadeyeTargetLocked(enemy)) continue;
            return enemy;
        }
        return null;
    }

    function buildDeadeyeMarker(enemy, progress, locked) {
        if (!enemy || !enemy.group || !enemy.group.position) return null;
        return {
            worldPos: {
                x: enemy.group.position.x,
                y: enemy.group.position.y + 2.2,
                z: enemy.group.position.z
            },
            progress: Math.max(0, Math.min(1, progress || 0)),
            locked: !!locked
        };
    }

    function fireDeadeye(camera, onEnemyHit, notifier, manualRelease) {
        if (!deadeyeActive && deadeyeLockedTargets.length === 0) {
            return { ok: false, message: 'Deadeye is not active.', skipCooldown: true };
        }

        var landed = 0;
        var losRange = deadeyeRange > 0 ? deadeyeRange : (classAbilityTuning.deadeyeLockRange || classAbilityTuning.sharpshooterUltimateRange || 70);
        for (var i = 0; i < deadeyeLockedTargets.length; i++) {
            var target = deadeyeLockedTargets[i] ? deadeyeLockedTargets[i].enemy : null;
            if (!target || !target.alive) continue;
            if (!hasLineOfSightFromCamera(target, camera, losRange, 0.18)) continue;
            if (reportEnemyDamage(target, deadeyeDamage, 'body', 'deadeye', onEnemyHit)) {
                landed++;
                spawnPulse(target.group.position, 0xffdf80, 0.4, 0.2);
            }
        }

        deadeyeActive = false;
        deadeyeRemaining = 0;
        deadeyeDurationTotal = 0;
        deadeyeMaxLocks = 0;
        deadeyeLockTime = 0;
        deadeyeRange = 0;
        deadeyeLockedTargets = [];
        deadeyeAcquiringTarget = null;

        if (landed > 0) {
            notify(notifier, 'Deadeye fired x' + landed, 1100);
        } else if (manualRelease) {
            notify(notifier, 'Deadeye released.', 900);
        }
        return {
            ok: true,
            message: landed > 0 ? ('Deadeye fired x' + landed) : 'Deadeye released.',
            skipCooldown: true
        };
    }

    function triggerSharpshooterUltimate(camera) {
        var range = classAbilityTuning.deadeyeLockRange || classAbilityTuning.sharpshooterUltimateRange || 70;
        var maxTargets = Math.max(1, Math.round(classAbilityTuning.deadeyeMaxTargets || 6));
        var duration = classAbilityTuning.deadeyeDuration || (classAbilityTuning.deadeyeLockTimePerTarget || 0.42) * maxTargets;
        var lockTime = duration / maxTargets;
        var targets = visibleEnemies(camera, range, 0.18);
        if (targets.length === 0) return { ok: false, message: 'No targets for Deadeye.' };

        deadeyeActive = true;
        deadeyeRange = range;
        deadeyeMaxLocks = maxTargets;
        deadeyeDurationTotal = duration;
        deadeyeRemaining = duration;
        deadeyeLockTime = lockTime;
        deadeyeLockedTargets = [];
        deadeyeAcquiringTarget = null;
        deadeyeDamage = classAbilityTuning.deadeyeDamage || 260;
        return { ok: true, message: 'Deadeye charging...' };
    }

    function triggerBrawlerAbility(playerPos, yaw, onEnemyHit) {
        var targets = enemiesInCone(playerPos, yaw, classAbilityTuning.brawlerAbilityRange, -0.2);
        if (targets.length === 0) return { ok: false, message: 'Bat swing missed.' };

        var count = Math.min(3, targets.length);
        for (var i = 0; i < count; i++) {
            reportEnemyDamage(targets[i].enemy, 130, 'body', 'bat-swing', onEnemyHit);
            applyStun(targets[i].enemy, 0.35);
        }
        spawnPulse(playerPos, 0xffaa66, 0.45, 0.2);
        return { ok: true, message: 'Bat Swing x' + count };
    }

    function triggerBrawlerUltimate() {
        rageTimer = 4.8;
        rageTickTimer = 0.01;
        return { ok: true, message: 'Rage Mode!' };
    }

    function stepCooldowns(dt) {
        if (abilityCooldownRemaining > 0) {
            abilityCooldownRemaining -= dt;
            if (abilityCooldownRemaining < 0) abilityCooldownRemaining = 0;
        }
        if (ultimateCooldownRemaining > 0) {
            ultimateCooldownRemaining -= dt;
            if (ultimateCooldownRemaining < 0) ultimateCooldownRemaining = 0;
        }
    }

    function stepSharpshooter(dt, camera, onEnemyHit, notifier) {
        if (focusTimer > 0) {
            focusTimer -= dt;
            if (focusTimer <= 0) {
                focusTimer = 0;
                focusShots = 0;
            }
        }

        if (deadeyeActive) {
            deadeyeRemaining -= dt;
            if (deadeyeRemaining < 0) deadeyeRemaining = 0;

            if (deadeyeAcquiringTarget && (!deadeyeAcquiringTarget.enemy || !deadeyeAcquiringTarget.enemy.alive ||
                !hasLineOfSightFromCamera(deadeyeAcquiringTarget.enemy, camera, deadeyeRange, 0.18))) {
                deadeyeAcquiringTarget = null;
            }

            if (deadeyeAcquiringTarget) {
                deadeyeAcquiringTarget.elapsed += dt;
                if (deadeyeAcquiringTarget.elapsed >= deadeyeLockTime) {
                    if (!isDeadeyeTargetLocked(deadeyeAcquiringTarget.enemy)) {
                        deadeyeLockedTargets.push({
                            enemy: deadeyeAcquiringTarget.enemy
                        });
                    }
                    deadeyeAcquiringTarget = null;
                }
            }

            if (!deadeyeAcquiringTarget && deadeyeLockedTargets.length < deadeyeMaxLocks) {
                var nextTarget = pickNextDeadeyeTarget(camera);
                if (nextTarget) {
                    deadeyeAcquiringTarget = {
                        enemy: nextTarget,
                        elapsed: 0
                    };
                }
            }

            if (deadeyeRemaining <= 0 || deadeyeLockedTargets.length >= deadeyeMaxLocks) {
                fireDeadeye(camera, onEnemyHit, notifier, false);
            }
        }
    }

    function stepBrawler(dt, playerPos, onEnemyHit) {
        if (rageTimer <= 0) return;

        rageTimer -= dt;
        if (rageTimer < 0) rageTimer = 0;

        rageTickTimer -= dt;
        if (rageTickTimer <= 0) {
            rageTickTimer += 0.45;
            var targets = enemiesInRadius(playerPos, classAbilityTuning.brawlerRageRadius);
            for (var i = 0; i < targets.length; i++) {
                reportEnemyDamage(targets[i].enemy, 75, 'body', 'rage-mode', onEnemyHit);
            }
            spawnPulse(playerPos, 0xff8844, 0.42, 0.17);
        }
    }

    function extraHudText() {
        if (currentClassId === 'ninja' && ninjaShadowDashTimer > 0) {
            return 'SHADOW DASH ' + ninjaShadowDashTimer.toFixed(1) + 's';
        }
        if (currentClassId === 'sharpshooter') {
            if (deadeyeActive) return 'DEADEYE ' + deadeyeRemaining.toFixed(1) + 's';
            if (focusShots > 0) return 'FOCUS READY';
        }
        if (currentClassId === 'brawler' && rageTimer > 0) {
            return 'RAGE ' + rageTimer.toFixed(1) + 's';
        }
        return '';
    }

    GameClasses.init = function (scene) {
        sceneRef = scene;
        effectBursts = [];
        resetRuntimeState();
    };

    GameClasses.getOrder = function () {
        return CLASS_ORDER.slice();
    };

    GameClasses.getCatalog = function () {
        var out = [];
        for (var i = 0; i < CLASS_ORDER.length; i++) {
            var id = CLASS_ORDER[i];
            var def = CLASS_DEFS[id];
            if (!def) continue;
            out.push({
                id: def.id,
                name: def.name,
                abilityName: def.abilityName,
                ultimateName: def.ultimateName,
                abilityCooldown: def.abilityCooldown,
                ultimateCooldown: def.ultimateCooldown,
                loadoutWeapon: def.loadoutWeapon,
                armorMax: def.armorMax,
                wallhackRadius: def.wallhackRadius
            });
        }
        return out;
    };

    GameClasses.getCurrentClass = function () {
        var def = getClassDef();
        return {
            id: def.id,
            name: def.name,
            abilityName: def.abilityName,
            ultimateName: def.ultimateName,
            loadoutWeapon: def.loadoutWeapon,
            armorMax: def.armorMax,
            wallhackRadius: def.wallhackRadius
        };
    };

    GameClasses.getHudState = function () {
        var def = getClassDef();
        return {
            id: def.id,
            name: def.name,
            abilityName: def.abilityName,
            ultimateName: def.ultimateName,
            abilityCooldown: abilityCooldownRemaining,
            ultimateCooldown: ultimateCooldownRemaining,
            extra: extraHudText(),
            queuedClassId: queuedClassId,
            queuedClassName: queuedClassId && CLASS_DEFS[queuedClassId] ? CLASS_DEFS[queuedClassId].name : ''
        };
    };

    GameClasses.setClass = function (classId) {
        if (!CLASS_DEFS[classId]) return null;
        currentClassId = classId;
        resetRuntimeState();

        var def = getClassDef();
        return {
            id: def.id,
            name: def.name,
            loadoutWeapon: def.loadoutWeapon,
            armorMax: def.armorMax,
            wallhackRadius: def.wallhackRadius
        };
    };

    GameClasses.queueClass = function (classId) {
        if (!CLASS_DEFS[classId]) return null;
        queuedClassId = classId;
        return {
            id: classId,
            name: CLASS_DEFS[classId].name
        };
    };

    GameClasses.getQueuedClass = function () {
        if (!queuedClassId || !CLASS_DEFS[queuedClassId]) return null;
        return {
            id: queuedClassId,
            name: CLASS_DEFS[queuedClassId].name
        };
    };

    GameClasses.applyQueuedClass = function () {
        if (!queuedClassId || !CLASS_DEFS[queuedClassId]) return null;
        var id = queuedClassId;
        queuedClassId = null;
        return GameClasses.setClass(id);
    };

    GameClasses.clearQueuedClass = function () {
        queuedClassId = null;
    };

    GameClasses.getArmorMax = function () {
        var def = getClassDef();
        return def.armorMax || 100;
    };

    GameClasses.getWallhackRadius = function () {
        var def = getClassDef();
        return def.wallhackRadius || classWallhackRadiusFor(def.id);
    };

    GameClasses.cycleClass = function (delta) {
        var idx = CLASS_ORDER.indexOf(currentClassId);
        if (idx < 0) idx = 0;
        if (delta > 0) idx = (idx + 1) % CLASS_ORDER.length;
        else idx = (idx - 1 + CLASS_ORDER.length) % CLASS_ORDER.length;
        return GameClasses.setClass(CLASS_ORDER[idx]);
    };

    GameClasses.modifyOutgoingDamage = function (damage, hitType, weaponId) {
        damage = Math.max(1, Math.round(damage));

        if (currentClassId === 'sharpshooter' && focusShots > 0) {
            focusShots--;
            focusTimer = 0;
            var boost = (weaponId === 'sniper') ? 1.8 : 1.55;
            return Math.max(1, Math.round(damage * boost));
        }

        if (currentClassId === 'ninja' && hitType === 'head') {
            return Math.max(1, Math.round(damage * 1.18));
        }

        if (currentClassId === 'magician' && weaponId === 'shotgun') {
            return Math.max(1, Math.round(damage * 0.92));
        }

        return damage;
    };

    GameClasses.modifyIncomingDamage = function (damage) {
        if (currentClassId === 'brawler') {
            return Math.max(1, Math.round(damage * 0.85));
        }
        if (currentClassId === 'jedi') {
            return Math.max(1, Math.round(damage * 0.9));
        }
        return Math.max(1, Math.round(damage));
    };

    GameClasses.triggerAbility = function (slot, camera, playerPos, rotation, onEnemyHit, notifier) {
        var def = getClassDef();
        var yaw = rotation && typeof rotation.yaw === 'number' ? rotation.yaw : 0;
        var outcome = null;

        if (slot === 1) {
            if (!debugInstantCooldowns && abilityCooldownRemaining > 0) {
                return { ok: false, message: def.abilityName + ' on cooldown (' + abilityCooldownRemaining.toFixed(1) + 's)' };
            }

            if (currentClassId === 'ninja') outcome = triggerNinjaAbility(camera, onEnemyHit);
            else if (currentClassId === 'jedi') outcome = triggerJediAbility(playerPos, yaw, onEnemyHit);
            else if (currentClassId === 'magician') outcome = triggerMagicianAbility(camera, onEnemyHit);
            else if (currentClassId === 'sharpshooter') outcome = triggerSharpshooterAbility();
            else outcome = triggerBrawlerAbility(playerPos, yaw, onEnemyHit);

            if (outcome && outcome.ok) {
                abilityCooldownRemaining = debugInstantCooldowns ? 0 : def.abilityCooldown;
                notify(notifier, outcome.message || (def.abilityName + '!'));
            }
            return outcome || { ok: false, message: 'Ability failed.' };
        }

        if (slot === 2) {
            if (currentClassId === 'sharpshooter' && deadeyeActive) {
                return fireDeadeye(camera, onEnemyHit, notifier, true);
            }
            if (!debugInstantCooldowns && ultimateCooldownRemaining > 0) {
                return { ok: false, message: def.ultimateName + ' on cooldown (' + ultimateCooldownRemaining.toFixed(1) + 's)' };
            }

            if (currentClassId === 'ninja') outcome = triggerNinjaUltimate(playerPos, onEnemyHit, camera);
            else if (currentClassId === 'jedi') outcome = triggerJediUltimate(playerPos, yaw, onEnemyHit);
            else if (currentClassId === 'magician') outcome = triggerMagicianUltimate(camera, onEnemyHit);
            else if (currentClassId === 'sharpshooter') outcome = triggerSharpshooterUltimate(camera);
            else outcome = triggerBrawlerUltimate();

            if (outcome && outcome.ok && !outcome.skipCooldown) {
                ultimateCooldownRemaining = debugInstantCooldowns ? 0 : def.ultimateCooldown;
                notify(notifier, outcome.message || (def.ultimateName + '!'), 1100);
            }
            return outcome || { ok: false, message: 'Ultimate failed.' };
        }

        return { ok: false, message: 'Unknown ability slot.' };
    };

    GameClasses.update = function (dt, camera, playerPos, rotation, onEnemyHit, notifier) {
        stepCooldowns(dt);

        if (ninjaShadowDashTimer > 0) {
            ninjaShadowDashTimer -= dt;
            if (ninjaShadowDashTimer < 0) ninjaShadowDashTimer = 0;
        }

        if (currentClassId === 'sharpshooter') {
            stepSharpshooter(dt, camera, onEnemyHit, notifier);
        } else if (currentClassId === 'brawler') {
            stepBrawler(dt, playerPos, onEnemyHit);
        }

        updateEffects(dt);
    };

    GameClasses.isShadowDashActive = function () {
        return ninjaShadowDashTimer > 0;
    };

    GameClasses.setDebugMode = function (enabled) {
        debugInstantCooldowns = !!enabled;
        if (debugInstantCooldowns) {
            abilityCooldownRemaining = 0;
            ultimateCooldownRemaining = 0;
        }
    };

    GameClasses.isDeadeyeActive = function () {
        return !!deadeyeActive;
    };

    GameClasses.getDeadeyeState = function () {
        if (!deadeyeActive || deadeyeDurationTotal <= 0) return null;
        var markers = [];
        for (var i = 0; i < deadeyeLockedTargets.length; i++) {
            var lockedMarker = buildDeadeyeMarker(deadeyeLockedTargets[i].enemy, 1, true);
            if (lockedMarker) markers.push(lockedMarker);
        }
        if (deadeyeAcquiringTarget && deadeyeAcquiringTarget.enemy) {
            var acquiringProgress = deadeyeLockTime > 0 ? (deadeyeAcquiringTarget.elapsed / deadeyeLockTime) : 1;
            var acquiringMarker = buildDeadeyeMarker(deadeyeAcquiringTarget.enemy, acquiringProgress, false);
            if (acquiringMarker) markers.push(acquiringMarker);
        }
        return {
            lockCount: deadeyeLockedTargets.length,
            maxLocks: deadeyeMaxLocks,
            progress: 1 - (deadeyeRemaining / deadeyeDurationTotal),
            targets: markers
        };
    };

    window.GameClasses = GameClasses;
})();
