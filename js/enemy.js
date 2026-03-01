/**
 * enemy.js - Blocky humanoid enemies, hitboxes, AI movement/combat, wallhack silhouettes
 * Loaded as global: window.GameEnemy
 */
(function () {
    'use strict';

    var GameEnemy = {};

    var enemies = [];
    var hitboxArray = [];
    var sceneRef = null;
    var hitboxVisible = true;

    var ENEMY_FIRE_RANGE = 34;
    var ENEMY_BODY_DAMAGE = 14;
    var ENEMY_HEAD_DAMAGE = 26;
    var ENEMY_FIRE_COOLDOWN_MIN = 0.55;
    var ENEMY_FIRE_COOLDOWN_MAX = 1.25;
    var DEFAULT_WALLHACK_RADIUS = 90;

    var combatRaycaster = new THREE.Raycaster();
    var revealRaycaster = new THREE.Raycaster();
    var enemyShootOrigin = new THREE.Vector3();
    var enemyShootTarget = new THREE.Vector3();
    var enemyShootDir = new THREE.Vector3();
    var revealTarget = new THREE.Vector3();
    var revealDir = new THREE.Vector3();

    var skinColors = [0x44aa44, 0xaa4444, 0x4444aa, 0xaa44aa, 0xaaaa44, 0x44aaaa, 0xff8800, 0x8800ff];
    var enemyWeaponPool = ['rifle', 'pistol', 'machinegun', 'shotgun', 'sniper', 'plasma'];

    function getCurrentWallhackRadius() {
        if (window.GameNet && window.GameNet.isActive && window.GameNet.isActive() && window.GameNet.getSelfState) {
            var selfState = window.GameNet.getSelfState();
            if (selfState && typeof selfState.wallhackRadius === 'number') {
                return selfState.wallhackRadius;
            }
        }
        if (window.GameClasses && window.GameClasses.getWallhackRadius) {
            return window.GameClasses.getWallhackRadius();
        }
        return DEFAULT_WALLHACK_RADIUS;
    }

    function getWorldBounds() {
        if (window.GameWorld && window.GameWorld.getBounds) {
            return window.GameWorld.getBounds();
        }
        return { min: 1, max: 49, center: 25, size: 50 };
    }

    function getPatrolBounds() {
        var bounds = getWorldBounds();
        return {
            min: bounds.min + 1,
            max: bounds.max - 1
        };
    }

    function getEnemySpawnPoint() {
        var bounds = getWorldBounds();
        var min = bounds.min + 4;
        var max = bounds.max - 4;

        if (window.GameWorld && window.GameWorld.getRandomSpawnPointSafe) {
            return window.GameWorld.getRandomSpawnPointSafe({
                padding: 6,
                tries: 100,
                feetY: 0,
                height: 2.2,
                radius: 0.72
            });
        }
        if (window.GameWorld && window.GameWorld.getRandomSpawnPoint) {
            return window.GameWorld.getRandomSpawnPoint(6);
        }

        return {
            x: min + Math.random() * (max - min),
            z: min + Math.random() * (max - min)
        };
    }

    function randomEnemyWeapon() {
        return enemyWeaponPool[Math.floor(Math.random() * enemyWeaponPool.length)];
    }

    function applyWeaponToRig(rig, weaponId) {
        if (!rig || !rig.gun || !rig.gunBody || !rig.gunBarrel) return;

        var pistol = weaponId === 'pistol';
        rig.twoHanded = !pistol;

        if (pistol) {
            rig.gun.position.set(0.44, 0.9, 0.22);
            rig.gun.rotation.set(0.05, 0, 0);
            rig.gunBody.scale.set(0.78, 0.88, 0.64);
            rig.gunBarrel.scale.set(0.7, 0.72, 0.64);
            if (rig.supportHand) rig.supportHand.visible = false;
            return;
        }

        rig.gun.position.set(0.24, 0.92, 0.24);
        rig.gun.rotation.set(0, 0, 0);
        if (rig.supportHand) rig.supportHand.visible = true;

        if (weaponId === 'shotgun') {
            rig.gunBody.scale.set(1.22, 1.0, 1.16);
            rig.gunBarrel.scale.set(1.6, 1.05, 1.3);
        } else if (weaponId === 'sniper') {
            rig.gunBody.scale.set(1.05, 0.88, 1.35);
            rig.gunBarrel.scale.set(1.06, 0.88, 1.88);
        } else if (weaponId === 'machinegun') {
            rig.gunBody.scale.set(1.22, 1.02, 1.05);
            rig.gunBarrel.scale.set(1.16, 1.0, 1.24);
        } else {
            rig.gunBody.scale.set(1.0, 1.0, 1.0);
            rig.gunBarrel.scale.set(1.0, 1.0, 1.0);
        }
    }

    function createSharedHumanoidModel(color, weaponId) {
        if (!window.GameAvatarRig || !window.GameAvatarRig.create) return null;
        var shared = window.GameAvatarRig.create('enemy', {
            bodyColor: color,
            skinColor: 0xd2a77d,
            legColor: 0x333333,
            weaponId: weaponId
        });
        if (!shared || !shared.root) return null;
        return shared;
    }

    function createHumanoidModel(color, weaponId, outMeta) {
        var sharedModel = createSharedHumanoidModel(color, weaponId);
        if (sharedModel) {
            if (outMeta) outMeta.rigApi = sharedModel;
            return sharedModel.root;
        }

        var group = new THREE.Group();
        var mat = new THREE.MeshLambertMaterial({ color: color });
        var darkMat = new THREE.MeshLambertMaterial({ color: 0x333333 });

        var body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.0, 0.5), mat);
        body.position.y = 0.5;
        group.add(body);

        var head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), mat);
        head.position.y = 1.25;
        group.add(head);

        var eyeGeo = new THREE.BoxGeometry(0.12, 0.08, 0.1);
        var eyeL = new THREE.Mesh(eyeGeo, darkMat);
        eyeL.position.set(-0.12, 1.3, 0.26);
        group.add(eyeL);

        var eyeR = new THREE.Mesh(eyeGeo, darkMat);
        eyeR.position.set(0.12, 1.3, 0.26);
        group.add(eyeR);

        var armGeo = new THREE.BoxGeometry(0.25, 0.8, 0.25);
        var armPivotL = new THREE.Group();
        armPivotL.position.set(-0.52, 0.86, 0);
        var armL = new THREE.Mesh(armGeo, mat);
        armL.position.y = -0.4;
        armPivotL.add(armL);
        group.add(armPivotL);

        var armPivotR = new THREE.Group();
        armPivotR.position.set(0.52, 0.86, 0);
        var armR = new THREE.Mesh(armGeo, mat);
        armR.position.y = -0.4;
        armPivotR.add(armR);
        group.add(armPivotR);

        var legGeo = new THREE.BoxGeometry(0.3, 0.8, 0.3);
        var legPivotL = new THREE.Group();
        legPivotL.position.set(-0.2, 0.02, 0);
        var legL = new THREE.Mesh(legGeo, darkMat);
        legL.position.y = -0.4;
        legPivotL.add(legL);
        group.add(legPivotL);

        var legPivotR = new THREE.Group();
        legPivotR.position.set(0.2, 0.02, 0);
        var legR = new THREE.Mesh(legGeo, darkMat);
        legR.position.y = -0.4;
        legPivotR.add(legR);
        group.add(legPivotR);

        var gun = new THREE.Group();
        var gunMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
        var gunBody = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.55), gunMat);
        gunBody.position.z = -0.04;
        gun.add(gunBody);

        var gunBarrel = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.26), gunMat);
        gunBarrel.position.z = -0.42;
        gun.add(gunBarrel);

        var supportHand = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.13, 0.13), mat);
        supportHand.position.set(-0.12, -0.03, -0.2);
        gun.add(supportHand);

        var muzzleMat = new THREE.MeshBasicMaterial({ color: 0xffcc66 });
        var muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.08), muzzleMat);
        muzzle.position.set(0, 0, -0.58);
        muzzle.visible = false;
        gun.add(muzzle);

        group.add(gun);

        var rig = {
            armL: armPivotL,
            armR: armPivotR,
            legL: legPivotL,
            legR: legPivotR,
            supportHand: supportHand,
            gun: gun,
            gunBody: gunBody,
            gunBarrel: gunBarrel,
            muzzle: muzzle,
            twoHanded: true,
            weaponId: weaponId
        };

        applyWeaponToRig(rig, weaponId);

        group.userData.bodyParts = [body, head, armL, armR, legL, legR];
        group.userData.originalColor = color;
        group.userData.weaponMuzzle = muzzle;
        group.userData.rig = rig;

        return group;
    }

    function createRevealGhost(visual) {
        var ghost = visual.clone(true);
        var mats = [];

        ghost.traverse(function (node) {
            if (!node.isMesh) return;
            var mat = new THREE.MeshBasicMaterial({
                color: 0x65d8ff,
                transparent: true,
                opacity: 0.26,
                depthTest: false,
                depthWrite: false
            });
            node.material = mat;
            node.renderOrder = 90;
            mats.push(mat);
        });

        ghost.visible = false;
        ghost.scale.set(1.05, 1.05, 1.05);
        ghost.userData.revealMaterials = mats;
        ghost.userData.baseOpacity = 0.26;
        return ghost;
    }

    function createHitboxMesh(type, index) {
        var geo, color;

        if (type === 'head') {
            geo = new THREE.BoxGeometry(1.55, 0.95, 1.55);
            color = 0xff4444;
        } else {
            geo = new THREE.BoxGeometry(2.7, 2.0, 2.7);
            color = 0x00aaff;
        }

        var mat = new THREE.MeshBasicMaterial({
            transparent: true,
            opacity: 0.3,
            wireframe: true,
            color: color,
            depthTest: type !== 'head'
        });

        var mesh = new THREE.Mesh(geo, mat);
        mesh.visible = true;
        mesh.renderOrder = type === 'head' ? 1 : 0;
        mesh.userData = {
            enemyIndex: index,
            type: type,
            enemyRef: null,
            targetId: 'enemy:' + index,
            ownerType: 'enemy'
        };

        return mesh;
    }

    function syncHitboxPositions(enemy) {
        var pos = enemy.group.position;

        if (enemy.bodyHitbox) {
            enemy.bodyHitbox.position.set(pos.x, pos.y + 1.0, pos.z);
        }

        if (enemy.headHitbox) {
            enemy.headHitbox.position.set(pos.x, pos.y + 2.475, pos.z);
        }
    }

    function createEnemy(scene, index) {
        var color = skinColors[index % skinColors.length];
        var weaponId = randomEnemyWeapon();
        var visualMeta = { rigApi: null };

        var group = new THREE.Group();

        var visual = createHumanoidModel(color, weaponId, visualMeta);
        visual.position.y = 1.0;
        group.add(visual);

        var revealGhost = createRevealGhost(visual);
        revealGhost.position.copy(visual.position);
        group.add(revealGhost);

        var spawn = getEnemySpawnPoint();
        group.position.set(spawn.x, 0, spawn.z);

        scene.add(group);

        var bodyHitbox = createHitboxMesh('body', index);
        var headHitbox = createHitboxMesh('head', index);

        scene.add(bodyHitbox);
        scene.add(headHitbox);

        var enemy = {
            group: group,
            visual: visual,
            revealGhost: revealGhost,
            bodyHitbox: bodyHitbox,
            headHitbox: headHitbox,
            hp: 500,
            maxHp: 500,
            armor: 100,
            armorMax: 100,
            alive: true,
            index: index,
            color: color,
            weaponType: weaponId,
            rig: visual.userData.rig || null,
            rigApi: visualMeta.rigApi,

            aiState: 'WANDER',
            aiTimer: 0,
            aiDuration: 0,
            wanderDir: new THREE.Vector3(),
            wanderSpeed: 0,
            moveSpeed: 0,

            flashTimer: 0,
            isFlashing: false,
            respawnTimer: 0,
            armorRegenDelay: 0,

            weaponMuzzle: visual.userData.weaponMuzzle || null,
            muzzleFlashTimer: 0,
            fireCooldown: 0,

            animPhase: Math.random() * Math.PI * 2,
            stunTimer: 0,
            slowTimer: 0,
            slowMultiplier: 1
        };

        bodyHitbox.userData.enemyRef = enemy;
        headHitbox.userData.enemyRef = enemy;

        syncHitboxPositions(enemy);
        startWander(enemy);
        resetFireCooldown(enemy);

        return enemy;
    }

    function startWander(enemy) {
        enemy.aiState = 'WANDER';
        var angle = Math.random() * Math.PI * 2;
        enemy.wanderSpeed = 1 + Math.random();
        enemy.wanderDir.set(Math.cos(angle), 0, Math.sin(angle));
        enemy.aiDuration = 2 + Math.random() * 2;
        enemy.aiTimer = 0;
    }

    function startPause(enemy) {
        enemy.aiState = 'PAUSE';
        enemy.aiDuration = 1 + Math.random();
        enemy.aiTimer = 0;
    }

    function resetFireCooldown(enemy) {
        enemy.fireCooldown = ENEMY_FIRE_COOLDOWN_MIN +
            (Math.random() * (ENEMY_FIRE_COOLDOWN_MAX - ENEMY_FIRE_COOLDOWN_MIN));
    }

    function hasLineOfSight(origin, target, maxDist) {
        var worldMeshes = window.GameWorld.getCollidables ? window.GameWorld.getCollidables() : [];
        if (!worldMeshes || worldMeshes.length === 0) return true;

        enemyShootDir.copy(target).sub(origin);
        var distance = enemyShootDir.length();
        if (distance <= 0.001) return true;
        if (typeof maxDist === 'number' && distance > maxDist) return false;

        enemyShootDir.divideScalar(distance);
        combatRaycaster.set(origin, enemyShootDir);
        combatRaycaster.far = distance;

        var blocks = combatRaycaster.intersectObjects(worldMeshes, false);
        return blocks.length === 0;
    }

    function updateEnemyAnimation(enemy, dt, engaging) {
        if (enemy.rigApi && enemy.rigApi.updateLocomotion) {
            var speedNorm = Math.max(0, Math.min(1.4, enemy.moveSpeed / 2.3));
            enemy.rigApi.updateAimPitch(engaging ? -0.05 : 0);
            enemy.rigApi.updateLocomotion(speedNorm, speedNorm > 0.85, dt);
            return;
        }
        if (!enemy.rig) return;

        var stride = Math.max(0, Math.min(1, enemy.moveSpeed / 2.2));
        enemy.animPhase += dt * (4 + enemy.moveSpeed * 4 + (engaging ? 1.5 : 0));

        var legAmplitude = 0.12 + stride * 0.52;
        var legSwing = Math.sin(enemy.animPhase) * legAmplitude;

        enemy.rig.legL.rotation.x = legSwing;
        enemy.rig.legR.rotation.x = -legSwing;

        if (enemy.rig.twoHanded) {
            enemy.rig.armR.rotation.x = -0.36 + Math.sin(enemy.animPhase * 2.1) * 0.03 - (engaging ? 0.03 : 0);
            enemy.rig.armR.rotation.z = 0.12;
            enemy.rig.armL.rotation.x = -0.32 + Math.cos(enemy.animPhase * 2.0) * 0.03 - (engaging ? 0.02 : 0);
            enemy.rig.armL.rotation.z = -0.12;
        } else {
            var sideSwing = -legSwing * 0.75;
            enemy.rig.armR.rotation.x = -0.4 - (engaging ? 0.07 : 0);
            enemy.rig.armR.rotation.z = 0.14;
            enemy.rig.armL.rotation.x = sideSwing;
            enemy.rig.armL.rotation.z = -0.04;
        }
    }

    function updateStatusTimers(enemy, dt) {
        if (enemy.stunTimer > 0) {
            enemy.stunTimer -= dt;
            if (enemy.stunTimer < 0) enemy.stunTimer = 0;
        }
        if (enemy.slowTimer > 0) {
            enemy.slowTimer -= dt;
            if (enemy.slowTimer < 0) {
                enemy.slowTimer = 0;
                enemy.slowMultiplier = 1;
            }
        }

        if (enemy.armorRegenDelay > 0) {
            enemy.armorRegenDelay -= dt;
            if (enemy.armorRegenDelay < 0) enemy.armorRegenDelay = 0;
        } else if (enemy.armor < enemy.armorMax) {
            enemy.armor += 12 * dt;
            if (enemy.armor > enemy.armorMax) enemy.armor = enemy.armorMax;
        }
    }

    function updateAI(enemy, dt) {
        if (!enemy.alive) return;
        if (enemy.stunTimer > 0) {
            enemy.moveSpeed = 0;
            return;
        }

        enemy.aiTimer += dt;

        if (enemy.aiState === 'WANDER') {
            var slowScale = enemy.slowTimer > 0 ? enemy.slowMultiplier : 1;
            var pos = enemy.group.position;
            pos.x += enemy.wanderDir.x * enemy.wanderSpeed * slowScale * dt;
            pos.z += enemy.wanderDir.z * enemy.wanderSpeed * slowScale * dt;
            enemy.moveSpeed = enemy.wanderSpeed * slowScale;

            var patrolBounds = getPatrolBounds();
            if (pos.x < patrolBounds.min) { pos.x = patrolBounds.min; enemy.wanderDir.x = Math.abs(enemy.wanderDir.x); }
            if (pos.x > patrolBounds.max) { pos.x = patrolBounds.max; enemy.wanderDir.x = -Math.abs(enemy.wanderDir.x); }
            if (pos.z < patrolBounds.min) { pos.z = patrolBounds.min; enemy.wanderDir.z = Math.abs(enemy.wanderDir.z); }
            if (pos.z > patrolBounds.max) { pos.z = patrolBounds.max; enemy.wanderDir.z = -Math.abs(enemy.wanderDir.z); }

            var facing = Math.atan2(enemy.wanderDir.x, enemy.wanderDir.z);
            enemy.visual.rotation.y = facing;
            enemy.revealGhost.rotation.y = facing;

            if (enemy.aiTimer >= enemy.aiDuration) {
                startPause(enemy);
            }
        } else {
            enemy.moveSpeed = 0;
            if (enemy.aiTimer >= enemy.aiDuration) {
                startWander(enemy);
            }
        }
    }

    function updateCombat(enemy, dt, playerPos, onPlayerHit) {
        if (!enemy.alive || !playerPos || !onPlayerHit) return false;
        if (enemy.stunTimer > 0) return false;

        enemy.fireCooldown -= dt;

        enemyShootOrigin.copy(enemy.group.position);
        enemyShootOrigin.y += 2.2;

        enemyShootTarget.copy(playerPos);
        enemyShootTarget.y -= 0.2;

        var distance = enemyShootOrigin.distanceTo(enemyShootTarget);
        if (distance > ENEMY_FIRE_RANGE) return false;

        var toPlayerX = enemyShootTarget.x - enemy.group.position.x;
        var toPlayerZ = enemyShootTarget.z - enemy.group.position.z;
        var facing = Math.atan2(toPlayerX, toPlayerZ);
        enemy.visual.rotation.y = facing;
        enemy.revealGhost.rotation.y = facing;

        if (enemy.fireCooldown > 0) return true;
        if (!hasLineOfSight(enemyShootOrigin, enemyShootTarget, ENEMY_FIRE_RANGE)) {
            resetFireCooldown(enemy);
            return true;
        }

        var hitChance = 0.85 - (distance / ENEMY_FIRE_RANGE) * 0.45;
        hitChance = Math.max(0.35, Math.min(0.9, hitChance));

        if (Math.random() <= hitChance) {
            var headChance = distance < 12 ? 0.2 : (distance < 22 ? 0.12 : 0.07);
            var isHeadshot = Math.random() < headChance;
            var hitType = isHeadshot ? 'head' : 'body';
            var damage = isHeadshot ? ENEMY_HEAD_DAMAGE : ENEMY_BODY_DAMAGE;
            onPlayerHit(damage, hitType, enemy);
        }

        if (enemy.weaponMuzzle) {
            enemy.weaponMuzzle.visible = true;
            enemy.muzzleFlashTimer = 0.06;
        }

        resetFireCooldown(enemy);
        return true;
    }

    function updateRevealGhost(enemy, playerPos, camera, dt) {
        if (!enemy.revealGhost) return;

        if (!enemy.alive || !playerPos || !camera) {
            enemy.revealGhost.visible = false;
            return;
        }

        var horizontalDist = Math.hypot(
            enemy.group.position.x - playerPos.x,
            enemy.group.position.z - playerPos.z
        );
        if (horizontalDist > getCurrentWallhackRadius()) {
            enemy.revealGhost.visible = false;
            return;
        }

        var worldMeshes = window.GameWorld.getCollidables ? window.GameWorld.getCollidables() : [];
        if (!worldMeshes || worldMeshes.length === 0) {
            enemy.revealGhost.visible = false;
            return;
        }

        revealTarget.copy(enemy.group.position);
        revealTarget.y += 2.2;

        revealDir.copy(revealTarget).sub(camera.position);
        var distToTarget = revealDir.length();
        if (distToTarget <= 0.001) {
            enemy.revealGhost.visible = false;
            return;
        }

        revealDir.divideScalar(distToTarget);
        revealRaycaster.set(camera.position, revealDir);
        revealRaycaster.far = distToTarget - 0.2;

        var blocked = revealRaycaster.intersectObjects(worldMeshes, false).length > 0;
        enemy.revealGhost.visible = blocked;

        if (blocked && enemy.revealGhost.userData.revealMaterials) {
            var pulse = 0.04 * Math.sin(performance.now() * 0.012 + enemy.index);
            var opacity = enemy.revealGhost.userData.baseOpacity + pulse;
            var mats = enemy.revealGhost.userData.revealMaterials;
            for (var i = 0; i < mats.length; i++) {
                mats[i].opacity = opacity;
            }
        }

        enemy.revealGhost.position.copy(enemy.visual.position);
    }

    function updateMuzzleFlash(enemy, dt) {
        if (!enemy.weaponMuzzle || enemy.muzzleFlashTimer <= 0) return;

        enemy.muzzleFlashTimer -= dt;
        if (enemy.muzzleFlashTimer <= 0) {
            enemy.weaponMuzzle.visible = false;
            enemy.muzzleFlashTimer = 0;
        }
    }

    function updateFlash(enemy, dt) {
        if (!enemy.isFlashing) return;

        enemy.flashTimer -= dt;
        if (enemy.flashTimer <= 0) {
            var parts = enemy.visual.userData.bodyParts;
            var origColor = enemy.visual.userData.originalColor;
            if (parts) {
                for (var i = 0; i < parts.length; i++) {
                    parts[i].material.color.setHex(i >= 4 ? 0x333333 : origColor);
                    parts[i].material.emissive.setHex(0x000000);
                }
            }
            enemy.isFlashing = false;
        }
    }

    function removeHitboxes(enemy) {
        var idx = hitboxArray.indexOf(enemy.bodyHitbox);
        if (idx !== -1) hitboxArray.splice(idx, 1);
        if (enemy.bodyHitbox.parent) {
            enemy.bodyHitbox.parent.remove(enemy.bodyHitbox);
        }

        idx = hitboxArray.indexOf(enemy.headHitbox);
        if (idx !== -1) hitboxArray.splice(idx, 1);
        if (enemy.headHitbox.parent) {
            enemy.headHitbox.parent.remove(enemy.headHitbox);
        }
    }

    function addHitboxes(enemy) {
        sceneRef.add(enemy.bodyHitbox);
        sceneRef.add(enemy.headHitbox);

        hitboxArray.push(enemy.bodyHitbox);
        hitboxArray.push(enemy.headHitbox);

        applyHitboxVisibility(enemy);
    }

    function applyHitboxVisibility(enemy) {
        var opacity = hitboxVisible ? 0.3 : 0;
        enemy.bodyHitbox.material.opacity = opacity;
        enemy.headHitbox.material.opacity = opacity;
        enemy.bodyHitbox.visible = true;
        enemy.headHitbox.visible = true;
    }

    GameEnemy.init = function (scene, count) {
        enemies = [];
        hitboxArray = [];
        sceneRef = scene;
        count = count || 8;

        for (var i = 0; i < count; i++) {
            var enemy = createEnemy(scene, i);
            enemies.push(enemy);
            hitboxArray.push(enemy.bodyHitbox);
            hitboxArray.push(enemy.headHitbox);
        }
    };

    /**
     * @param {number} dt
     * @param {THREE.Vector3} playerPos
     * @param {THREE.Camera|Function} cameraOrCallback
     * @param {Function=} maybeOnPlayerHit
     */
    GameEnemy.update = function (dt, playerPos, cameraOrCallback, maybeOnPlayerHit) {
        var camera = null;
        var onPlayerHit = maybeOnPlayerHit;

        if (typeof cameraOrCallback === 'function') {
            onPlayerHit = cameraOrCallback;
        } else {
            camera = cameraOrCallback;
        }

        for (var i = 0; i < enemies.length; i++) {
            var enemy = enemies[i];

            if (enemy.alive) {
                updateStatusTimers(enemy, dt);
                updateAI(enemy, dt);
                var engaging = updateCombat(enemy, dt, playerPos, onPlayerHit);
                updateEnemyAnimation(enemy, dt, engaging);
                updateRevealGhost(enemy, playerPos, camera, dt);
                updateFlash(enemy, dt);
                updateMuzzleFlash(enemy, dt);
                syncHitboxPositions(enemy);
            } else {
                enemy.respawnTimer -= dt;
                if (enemy.respawnTimer <= 0) {
                    GameEnemy.respawn(enemy);
                }
            }
        }
    };

    GameEnemy.damage = function (hitboxMesh, damage) {
        var enemy = hitboxMesh.userData.enemyRef;
        if (!enemy || !enemy.alive) return null;

        var hitType = hitboxMesh.userData.type;
        var incoming = Math.max(1, Math.round(damage));

        enemy.armorRegenDelay = 6.0;

        if (enemy.armor > 0) {
            var absorbed = Math.min(enemy.armor, incoming);
            enemy.armor -= absorbed;
            incoming -= absorbed;
        }

        if (incoming > 0) {
            enemy.hp -= incoming;
        }

        enemy.isFlashing = true;
        enemy.flashTimer = 0.15;
        var parts = enemy.visual.userData.bodyParts;
        if (parts) {
            for (var i = 0; i < parts.length; i++) {
                parts[i].material.color.setHex(0xff0000);
                parts[i].material.emissive.setHex(0x440000);
            }
        }

        var killed = false;
        if (enemy.hp <= 0) {
            enemy.hp = 0;
            killed = true;
            GameEnemy.kill(enemy);
        }

        return {
            enemy: enemy,
            killed: killed,
            hitType: hitType,
            hp: enemy.hp,
            armor: enemy.armor
        };
    };

    GameEnemy.kill = function (enemy) {
        enemy.alive = false;
        enemy.group.visible = false;
        enemy.muzzleFlashTimer = 0;
        if (enemy.weaponMuzzle) enemy.weaponMuzzle.visible = false;
        if (enemy.revealGhost) enemy.revealGhost.visible = false;

        removeHitboxes(enemy);

        enemy.respawnTimer = 5.0;
    };

    GameEnemy.respawn = function (enemy) {
        enemy.alive = true;
        enemy.hp = enemy.maxHp;
        enemy.armor = enemy.armorMax;
        enemy.armorRegenDelay = 0;

        var spawn = getEnemySpawnPoint();
        enemy.group.position.set(spawn.x, 0, spawn.z);
        enemy.group.visible = true;

        var parts = enemy.visual.userData.bodyParts;
        var origColor = enemy.visual.userData.originalColor;
        if (parts) {
            for (var i = 0; i < parts.length; i++) {
                parts[i].material.color.setHex(i >= 4 ? 0x333333 : origColor);
                parts[i].material.emissive.setHex(0x000000);
            }
        }

        enemy.moveSpeed = 0;
        enemy.isFlashing = false;
        enemy.muzzleFlashTimer = 0;
        enemy.stunTimer = 0;
        enemy.slowTimer = 0;
        enemy.slowMultiplier = 1;
        if (enemy.weaponMuzzle) enemy.weaponMuzzle.visible = false;
        if (enemy.revealGhost) enemy.revealGhost.visible = false;
        resetFireCooldown(enemy);

        addHitboxes(enemy);
        syncHitboxPositions(enemy);
        startWander(enemy);
    };

    GameEnemy.getHitboxArray = function () {
        return hitboxArray;
    };

    GameEnemy.getEnemies = function () {
        return enemies;
    };

    GameEnemy.getLockTargets = function () {
        var out = [];
        for (var i = 0; i < enemies.length; i++) {
            var enemy = enemies[i];
            if (!enemy || !enemy.alive) continue;

            var corePos = null;
            if (enemy.rigApi && enemy.rigApi.getCoreWorldPosition) {
                corePos = enemy.rigApi.getCoreWorldPosition(new THREE.Vector3());
            } else if (enemy.bodyHitbox && enemy.bodyHitbox.position) {
                corePos = enemy.bodyHitbox.position.clone();
            } else if (enemy.group && enemy.group.position) {
                corePos = enemy.group.position.clone();
                corePos.y += 1.0;
            }
            if (!corePos) continue;

            out.push({
                targetId: (enemy.bodyHitbox && enemy.bodyHitbox.userData && enemy.bodyHitbox.userData.targetId) || ('enemy:' + enemy.index),
                ownerType: 'enemy',
                worldPos: corePos,
                hitbox: enemy.bodyHitbox || null,
                alive: true,
                enemyRef: enemy
            });
        }
        return out;
    };

    GameEnemy.applyStun = function (enemy, duration) {
        if (!enemy || !enemy.alive) return false;
        enemy.stunTimer = Math.max(enemy.stunTimer || 0, duration || 0);
        return true;
    };

    GameEnemy.applySlow = function (enemy, duration, multiplier) {
        if (!enemy || !enemy.alive) return false;
        enemy.slowTimer = Math.max(enemy.slowTimer || 0, duration || 0);
        enemy.slowMultiplier = Math.max(0.15, Math.min(1, multiplier || 1));
        return true;
    };

    GameEnemy.getWallhackRadius = function () {
        return getCurrentWallhackRadius();
    };

    GameEnemy.setHitboxVisibility = function (visible) {
        hitboxVisible = !!visible;
        for (var i = 0; i < enemies.length; i++) {
            if (enemies[i].alive) {
                applyHitboxVisibility(enemies[i]);
            }
        }
        return hitboxVisible;
    };

    GameEnemy.toggleHitboxVisibility = function () {
        return GameEnemy.setHitboxVisibility(!hitboxVisible);
    };

    GameEnemy.isHitboxVisible = function () {
        return hitboxVisible;
    };

    window.GameEnemy = GameEnemy;
})();
