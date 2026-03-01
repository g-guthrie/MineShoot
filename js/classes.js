/**
 * classes.js - Player class selection and class abilities
 * Loaded as global: window.GameClasses
 */
(function () {
    'use strict';

    var GameClasses = {};

    var PRIM = globalThis.__GAME_PRIMITIVES__ || {};
    var COMBAT_PRIM = PRIM.combat || {};
    var COORDS_PRIM = PRIM.coords || {};
    var CLASS_PRESETS = COMBAT_PRIM.class_presets || {};
    var HEAD_TARGET_OFFSET_Y = Number(COORDS_PRIM.head_hitbox_offset_y || 2.475);
    var CLASS_ORDER = (COMBAT_PRIM.class_order || ['ninja', 'jedi', 'magician', 'sharpshooter', 'brawler']).slice();
    var NINJA_PRESET = CLASS_PRESETS.ninja || { armorMax: 80, wallhackRadius: 90 };
    var JEDI_PRESET = CLASS_PRESETS.jedi || { armorMax: 130, wallhackRadius: 85 };
    var MAGICIAN_PRESET = CLASS_PRESETS.magician || { armorMax: 100, wallhackRadius: 100 };
    var SHARPSHOOTER_PRESET = CLASS_PRESETS.sharpshooter || { armorMax: 90, wallhackRadius: 115 };
    var BRAWLER_PRESET = CLASS_PRESETS.brawler || { armorMax: 150, wallhackRadius: 75 };

    var CLASS_DEFS = {
        ninja: {
            id: 'ninja',
            name: 'Ninja',
            abilityName: 'Assassin Throw',
            ultimateName: 'Shadow Flurry',
            abilityCooldown: 6.0,
            ultimateCooldown: 20.0,
            loadoutWeapon: 'pistol',
            armorMax: NINJA_PRESET.armorMax,
            wallhackRadius: NINJA_PRESET.wallhackRadius
        },
        jedi: {
            id: 'jedi',
            name: 'Jedi',
            abilityName: 'Force Choke',
            ultimateName: 'Saber Sweep',
            abilityCooldown: 8.0,
            ultimateCooldown: 18.0,
            loadoutWeapon: 'shotgun',
            armorMax: JEDI_PRESET.armorMax,
            wallhackRadius: JEDI_PRESET.wallhackRadius
        },
        magician: {
            id: 'magician',
            name: 'Magician',
            abilityName: 'Fireball',
            ultimateName: 'Chain Lightning',
            abilityCooldown: 7.0,
            ultimateCooldown: 20.0,
            loadoutWeapon: 'rifle',
            armorMax: MAGICIAN_PRESET.armorMax,
            wallhackRadius: MAGICIAN_PRESET.wallhackRadius
        },
        sharpshooter: {
            id: 'sharpshooter',
            name: 'Sharpshooter',
            abilityName: 'Focus Shot',
            ultimateName: 'Deadeye',
            abilityCooldown: 8.0,
            ultimateCooldown: 22.0,
            loadoutWeapon: 'sniper',
            armorMax: SHARPSHOOTER_PRESET.armorMax,
            wallhackRadius: SHARPSHOOTER_PRESET.wallhackRadius
        },
        brawler: {
            id: 'brawler',
            name: 'Brawler',
            abilityName: 'Bat Swing',
            ultimateName: 'Rage Mode',
            abilityCooldown: 5.0,
            ultimateCooldown: 20.0,
            loadoutWeapon: 'machinegun',
            armorMax: BRAWLER_PRESET.armorMax,
            wallhackRadius: BRAWLER_PRESET.wallhackRadius
        }
    };

    var sceneRef = null;
    var currentClassId = 'sharpshooter';
    var queuedClassId = null;

    var abilityCooldownRemaining = 0;
    var ultimateCooldownRemaining = 0;

    // Sharpshooter state
    var focusShots = 0;
    var focusTimer = 0;
    var deadeyeChannel = 0;
    var deadeyeTargets = [];
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
        deadeyeChannel = 0;
        deadeyeTargets = [];
        rageTimer = 0;
        rageTickTimer = 0;
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
        tmpTarget.y += HEAD_TARGET_OFFSET_Y;

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

    function triggerNinjaAbility(camera, onEnemyHit) {
        var hit = castEnemyHitboxFromCenter(camera, 42);
        if (!hit || !hit.hitbox) return { ok: false, message: 'Ninja throw missed.' };

        var hitType = hit.hitbox.userData.type || 'body';
        var damage = hitType === 'head' ? 240 : 160;
        var ok = reportEnemyHit(hit.hitbox, damage, 'ninja-throw', onEnemyHit);
        if (ok) spawnPulse(hit.point, hitType === 'head' ? 0xffe680 : 0xffffff, 0.3, 0.18);
        return ok ? { ok: true, message: 'Assassin Throw!' } : { ok: false, message: 'No target.' };
    }

    function triggerNinjaUltimate(playerPos, onEnemyHit) {
        var targets = enemiesInRadius(playerPos, 11);
        if (targets.length === 0) return { ok: false, message: 'No enemies in Shadow Flurry range.' };

        for (var i = 0; i < targets.length; i++) {
            reportEnemyDamage(targets[i].enemy, 170, 'body', 'shadow-flurry', onEnemyHit);
            applySlow(targets[i].enemy, 2.4, 0.7);
        }

        spawnPulse(playerPos, 0x9b7dff, 0.45, 0.24);
        return { ok: true, message: 'Shadow Flurry!' };
    }

    function triggerJediAbility(playerPos, yaw, onEnemyHit) {
        var targets = enemiesInCone(playerPos, yaw, 13, 0.05);
        if (targets.length === 0) return { ok: false, message: 'No target for Force Choke.' };

        var enemy = targets[0].enemy;
        reportEnemyDamage(enemy, 95, 'body', 'force-choke', onEnemyHit);
        applyStun(enemy, 1.6);
        spawnPulse(enemy.group.position, 0x7ed7ff, 0.42, 0.22);
        return { ok: true, message: 'Force Choke!' };
    }

    function triggerJediUltimate(playerPos, yaw, onEnemyHit) {
        var targets = enemiesInCone(playerPos, yaw, 6.0, -0.15);
        if (targets.length === 0) return { ok: false, message: 'No targets for Saber Sweep.' };

        var hits = 0;
        for (var i = 0; i < targets.length; i++) {
            hits++;
            reportEnemyDamage(targets[i].enemy, 220, 'body', 'saber-sweep', onEnemyHit);
            applyStun(targets[i].enemy, 0.8);
        }

        spawnPulse(playerPos, 0x8cff88, 0.52, 0.2);
        return { ok: true, message: 'Saber Sweep x' + hits };
    }

    function triggerMagicianAbility(camera, onEnemyHit) {
        var point = getAimPoint(camera, 36);
        if (!point) return { ok: false, message: 'Fireball failed.' };

        var radius = 4.8;
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
        var targets = visibleEnemies(camera, 60, 0.15);
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

    function triggerSharpshooterUltimate(camera) {
        var targets = visibleEnemies(camera, 70, 0.18);
        if (targets.length === 0) return { ok: false, message: 'No targets for Deadeye.' };

        deadeyeTargets = targets.slice(0, 5);
        deadeyeChannel = 1.1;
        deadeyeDamage = 260;
        return { ok: true, message: 'Deadeye charging...' };
    }

    function triggerBrawlerAbility(playerPos, yaw, onEnemyHit) {
        var targets = enemiesInCone(playerPos, yaw, 4.2, -0.2);
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

    function stepSharpshooter(dt, onEnemyHit, notifier) {
        if (focusTimer > 0) {
            focusTimer -= dt;
            if (focusTimer <= 0) {
                focusTimer = 0;
                focusShots = 0;
            }
        }

        if (deadeyeChannel > 0) {
            deadeyeChannel -= dt;
            if (deadeyeChannel <= 0) {
                deadeyeChannel = 0;
                var landed = 0;
                for (var i = 0; i < deadeyeTargets.length; i++) {
                    if (reportEnemyDamage(deadeyeTargets[i], deadeyeDamage, 'body', 'deadeye', onEnemyHit)) {
                        landed++;
                        spawnPulse(deadeyeTargets[i].group.position, 0xffdf80, 0.4, 0.2);
                    }
                }
                deadeyeTargets = [];
                if (landed > 0) notify(notifier, 'Deadeye fired x' + landed, 1100);
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
            var targets = enemiesInRadius(playerPos, 5.2);
            for (var i = 0; i < targets.length; i++) {
                reportEnemyDamage(targets[i].enemy, 75, 'body', 'rage-mode', onEnemyHit);
            }
            spawnPulse(playerPos, 0xff8844, 0.42, 0.17);
        }
    }

    function extraHudText() {
        if (currentClassId === 'sharpshooter') {
            if (deadeyeChannel > 0) return 'DEADEYE ' + deadeyeChannel.toFixed(1) + 's';
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
            var entitlement = (window.GameRules && window.GameRules.getClassEntitlement)
                ? window.GameRules.getClassEntitlement(def.id)
                : null;
            out.push({
                id: def.id,
                name: def.name,
                abilityName: def.abilityName,
                ultimateName: def.ultimateName,
                abilityCooldown: def.abilityCooldown,
                ultimateCooldown: def.ultimateCooldown,
                loadoutWeapon: def.loadoutWeapon,
                defaultWeapon: entitlement ? entitlement.defaultWeapon : def.loadoutWeapon,
                recommendedLoadout: entitlement ? entitlement.recommendedLoadout : [def.loadoutWeapon],
                spellKitPlaceholders: entitlement ? entitlement.spellKitPlaceholders : [],
                armorMax: def.armorMax,
                wallhackRadius: def.wallhackRadius
            });
        }
        return out;
    };

    GameClasses.getCurrentClass = function () {
        var def = getClassDef();
        var entitlement = (window.GameRules && window.GameRules.getClassEntitlement)
            ? window.GameRules.getClassEntitlement(def.id)
            : null;
        return {
            id: def.id,
            name: def.name,
            abilityName: def.abilityName,
            ultimateName: def.ultimateName,
            loadoutWeapon: def.loadoutWeapon,
            defaultWeapon: entitlement ? entitlement.defaultWeapon : def.loadoutWeapon,
            recommendedLoadout: entitlement ? entitlement.recommendedLoadout : [def.loadoutWeapon],
            spellKitPlaceholders: entitlement ? entitlement.spellKitPlaceholders : [],
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
        return def.wallhackRadius || 90;
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
            if (abilityCooldownRemaining > 0) {
                return { ok: false, message: def.abilityName + ' on cooldown (' + abilityCooldownRemaining.toFixed(1) + 's)' };
            }

            if (currentClassId === 'ninja') outcome = triggerNinjaAbility(camera, onEnemyHit);
            else if (currentClassId === 'jedi') outcome = triggerJediAbility(playerPos, yaw, onEnemyHit);
            else if (currentClassId === 'magician') outcome = triggerMagicianAbility(camera, onEnemyHit);
            else if (currentClassId === 'sharpshooter') outcome = triggerSharpshooterAbility();
            else outcome = triggerBrawlerAbility(playerPos, yaw, onEnemyHit);

            if (outcome && outcome.ok) {
                abilityCooldownRemaining = def.abilityCooldown;
                notify(notifier, outcome.message || (def.abilityName + '!'));
            }
            return outcome || { ok: false, message: 'Ability failed.' };
        }

        if (slot === 2) {
            if (ultimateCooldownRemaining > 0) {
                return { ok: false, message: def.ultimateName + ' on cooldown (' + ultimateCooldownRemaining.toFixed(1) + 's)' };
            }

            if (currentClassId === 'ninja') outcome = triggerNinjaUltimate(playerPos, onEnemyHit);
            else if (currentClassId === 'jedi') outcome = triggerJediUltimate(playerPos, yaw, onEnemyHit);
            else if (currentClassId === 'magician') outcome = triggerMagicianUltimate(camera, onEnemyHit);
            else if (currentClassId === 'sharpshooter') outcome = triggerSharpshooterUltimate(camera);
            else outcome = triggerBrawlerUltimate();

            if (outcome && outcome.ok) {
                ultimateCooldownRemaining = def.ultimateCooldown;
                notify(notifier, outcome.message || (def.ultimateName + '!'), 1100);
            }
            return outcome || { ok: false, message: 'Ultimate failed.' };
        }

        return { ok: false, message: 'Unknown ability slot.' };
    };

    GameClasses.update = function (dt, camera, playerPos, rotation, onEnemyHit, notifier) {
        stepCooldowns(dt);

        if (currentClassId === 'sharpshooter') {
            stepSharpshooter(dt, onEnemyHit, notifier);
        } else if (currentClassId === 'brawler') {
            stepBrawler(dt, playerPos, onEnemyHit);
        }

        updateEffects(dt);
    };

    window.GameClasses = GameClasses;
})();
