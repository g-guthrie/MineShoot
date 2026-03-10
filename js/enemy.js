/**
 * enemy.js - Blocky humanoid enemies, hitboxes, AI movement/combat, wallhack silhouettes
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameEnemy
 */
(function () {
    'use strict';

    var GameEnemy = {};

    var enemies = [];
    var hitboxArray = [];
    var sceneRef = null;
    var hitboxVisible = true;
    var enemyTuning = (globalThis.__MAYHEM_RUNTIME.GameCombatTuning && globalThis.__MAYHEM_RUNTIME.GameCombatTuning.getEnemyTuning)
        ? globalThis.__MAYHEM_RUNTIME.GameCombatTuning.getEnemyTuning()
        : {
            fireRange: 34,
            headshotNearRange: 12,
            headshotMidRange: 22,
            defaultWallhackRadius: 90
        };
    var ENEMY_FIRE_RANGE = enemyTuning.fireRange;
    var ENEMY_BODY_DAMAGE = 14;
    var ENEMY_HEAD_DAMAGE = 26;
    var ENEMY_FIRE_COOLDOWN_MIN = 0.55;
    var ENEMY_FIRE_COOLDOWN_MAX = 1.25;
    var ENEMY_HEADSHOT_NEAR_RANGE = enemyTuning.headshotNearRange;
    var ENEMY_HEADSHOT_MID_RANGE = enemyTuning.headshotMidRange;
    var DEFAULT_WALLHACK_RADIUS = enemyTuning.defaultWallhackRadius;
    var hitboxFactory = globalThis.__MAYHEM_RUNTIME.GameHitboxFactory || null;

    var combatRaycaster = new THREE.Raycaster();
    var revealRaycaster = new THREE.Raycaster();
    var enemyShootOrigin = new THREE.Vector3();
    var enemyShootTarget = new THREE.Vector3();
    var enemyShootDir = new THREE.Vector3();
    var revealTarget = new THREE.Vector3();
    var revealDir = new THREE.Vector3();

    var skinColors = [0x44aa44, 0xaa4444, 0x4444aa, 0xaa44aa, 0xaaaa44, 0x44aaaa, 0xff8800, 0x8800ff];

    function selectableWeaponIds() {
        var shared = globalThis.__MAYHEM_RUNTIME.GameShared || {};
        var selected = shared.getSelectableWeaponIds ? shared.getSelectableWeaponIds() : null;
        return Array.isArray(selected) && selected.length ? selected : ['rifle'];
    }

    function getCurrentWallhackRadius() {
        if (globalThis.__MAYHEM_RUNTIME.GameNet && globalThis.__MAYHEM_RUNTIME.GameNet.isActive && globalThis.__MAYHEM_RUNTIME.GameNet.isActive() && globalThis.__MAYHEM_RUNTIME.GameNet.getSelfState) {
            var selfState = globalThis.__MAYHEM_RUNTIME.GameNet.getSelfState();
            if (selfState && typeof selfState.wallhackRadius === 'number') {
                return selfState.wallhackRadius;
            }
        }
        if (globalThis.__MAYHEM_RUNTIME.GameAbilities && globalThis.__MAYHEM_RUNTIME.GameAbilities.getWallhackRadius) {
            return globalThis.__MAYHEM_RUNTIME.GameAbilities.getWallhackRadius();
        }
        return DEFAULT_WALLHACK_RADIUS;
    }

    function getWorldBounds() {
        return globalThis.__MAYHEM_RUNTIME.GameWorld.getBounds();
    }

    function getPatrolBounds() {
        var bounds = getWorldBounds();
        return {
            minX: (typeof bounds.minX === 'number' ? bounds.minX : bounds.min) + 1,
            maxX: (typeof bounds.maxX === 'number' ? bounds.maxX : bounds.max) - 1,
            minZ: (typeof bounds.minZ === 'number' ? bounds.minZ : bounds.min) + 1,
            maxZ: (typeof bounds.maxZ === 'number' ? bounds.maxZ : bounds.max) - 1
        };
    }

    function getEnemySpawnPoint() {
        var bounds = getWorldBounds();
        var minX = (typeof bounds.minX === 'number' ? bounds.minX : bounds.min) + 4;
        var maxX = (typeof bounds.maxX === 'number' ? bounds.maxX : bounds.max) - 4;
        var minZ = (typeof bounds.minZ === 'number' ? bounds.minZ : bounds.min) + 4;
        var maxZ = (typeof bounds.maxZ === 'number' ? bounds.maxZ : bounds.max) - 4;

        if (globalThis.__MAYHEM_RUNTIME.GameWorld && globalThis.__MAYHEM_RUNTIME.GameWorld.getRandomSpawnPoint) {
            return globalThis.__MAYHEM_RUNTIME.GameWorld.getRandomSpawnPoint(6);
        }

        return {
            x: minX + Math.random() * (maxX - minX),
            z: minZ + Math.random() * (maxZ - minZ)
        };
    }

    function randomEnemyWeapon() {
        var enemyWeaponPool = selectableWeaponIds();
        return enemyWeaponPool[Math.floor(Math.random() * enemyWeaponPool.length)];
    }

    function cloneVisualForRevealGhost(visual) {
        if (!visual || !visual.clone) return null;
        var originalUserData = visual.userData;
        visual.userData = {};
        try {
            return visual.clone(true);
        } finally {
            visual.userData = originalUserData;
        }
    }

    function createRevealGhost(visual) {
        var ghost = cloneVisualForRevealGhost(visual);
        if (!ghost) return null;
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

    function syncHitboxPositions(enemy) {
        if (enemy && enemy.actorVisual && enemy.group && enemy.actorVisual.syncHitboxes) {
            enemy.actorVisual.syncHitboxes(enemy.group.position);
        }
    }

    function createEnemy(scene, index) {
        var color = skinColors[index % skinColors.length];
        var weaponId = randomEnemyWeapon();
        var localMatchId = 'guest-bot-' + String(index + 1);
        var group = new THREE.Group();
        var actorFactory = globalThis.__MAYHEM_RUNTIME.GameActorVisualFactory || null;
        var actorVisual = actorFactory && actorFactory.create ? actorFactory.create({
            kind: 'enemy',
            ownerType: 'enemy',
            bodyColor: color,
            skinColor: 0xd2a77d,
            legColor: 0x333333,
            weaponId: weaponId,
            targetId: localMatchId,
            hitboxOpacity: hitboxVisible ? 0.3 : 0,
            includeRevealGhost: true
        }) : null;
        var visual = actorVisual ? actorVisual.visual : new THREE.Group();
        group.add(visual);
        var revealGhost = actorVisual ? actorVisual.revealGhost : createRevealGhost(visual);
        if (revealGhost) {
            revealGhost.position.copy(visual.position);
            group.add(revealGhost);
        }

        var spawn = getEnemySpawnPoint();
        group.position.set(spawn.x, 0, spawn.z);

        scene.add(group);
        var bodyHitbox = actorVisual ? actorVisual.bodyHitbox : null;
        var headHitbox = actorVisual ? actorVisual.headHitbox : null;

        if (bodyHitbox) scene.add(bodyHitbox);
        if (headHitbox) scene.add(headHitbox);

        var enemy = {
            group: group,
            visual: visual,
            revealGhost: revealGhost,
            bodyHitbox: bodyHitbox,
            headHitbox: headHitbox,
            actorVisual: actorVisual,
            hp: 500,
            maxHp: 500,
            armor: 100,
            armorMax: 100,
            alive: true,
            index: index,
            localMatchId: localMatchId,
            displayName: 'BOT_' + String(index + 1),
            color: color,
            weaponType: weaponId,
            rig: visual.userData.rig || null,
            rigApi: actorVisual ? actorVisual.rigApi : null,

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
            slowMultiplier: 1,
            hookPullState: null,
            justBeenHookedUntil: 0,
            chokeVictimState: null,
            trackingNeedleState: null
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
        var worldMeshes = globalThis.__MAYHEM_RUNTIME.GameWorld.getCollidables ? globalThis.__MAYHEM_RUNTIME.GameWorld.getCollidables() : [];
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
        if (enemy.rigApi && enemy.rigApi.updateAnimation) {
            var speedNorm = Math.max(0, Math.min(1.4, enemy.moveSpeed / 2.3));
            enemy.rigApi.updateAnimation(dt, {
                speedNorm: speedNorm,
                sprinting: speedNorm > 0.85,
                airborne: false,
                aimPitch: engaging ? -0.05 : 0,
                hooked: !!enemy.hookPullState || Number(enemy.justBeenHookedUntil || 0) > Date.now(),
                choked: !!(enemy.chokeVictimState && enemy.chokeVictimState.endsAt > Date.now()),
                startedAt: enemy.chokeVictimState ? Number(enemy.chokeVictimState.startedAt || 0) : 0,
                adsActive: !!engaging,
                worldSpeed: enemy.moveSpeed,
                movingForward: speedNorm > 0.05
            });
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
        if (enemy.chokeVictimState && enemy.chokeVictimState.endsAt <= Date.now()) {
            enemy.chokeVictimState = null;
        }

        if (sharedDamageMod && sharedDamageMod.tickArmorRegen) {
            sharedDamageMod.tickArmorRegen(enemy, dt);
        } else {
            if (enemy.armorRegenDelay > 0) {
                enemy.armorRegenDelay -= dt;
                if (enemy.armorRegenDelay < 0) enemy.armorRegenDelay = 0;
            } else if (enemy.armor < enemy.armorMax) {
                enemy.armor += 12 * dt;
                if (enemy.armor > enemy.armorMax) enemy.armor = enemy.armorMax;
            }
        }
    }

    function updateAI(enemy, dt) {
        if (!enemy.alive) return;
        if (enemy.hookPullState) {
            var pull = enemy.hookPullState;
            var playerState = globalThis.__MAYHEM_RUNTIME.GamePlayer;
            var sourcePos = playerState && playerState.getPosition ? playerState.getPosition() : null;
            var sourceRot = playerState && playerState.getRotation ? playerState.getRotation() : null;
            if (!sourcePos || !sourceRot) {
                enemy.hookPullState = null;
                return;
            }
            var targetDist = Math.max(1.5, Number(pull.pullDistance || 3.2));
            var forwardX = -Math.sin(sourceRot.yaw || 0);
            var forwardZ = -Math.cos(sourceRot.yaw || 0);
            var patrolBounds = getPatrolBounds();
            var desiredX = Math.max(patrolBounds.minX, Math.min(patrolBounds.maxX, sourcePos.x + (forwardX * targetDist)));
            var desiredZ = Math.max(patrolBounds.minZ, Math.min(patrolBounds.maxZ, sourcePos.z + (forwardZ * targetDist)));
            var toX = desiredX - enemy.group.position.x;
            var toZ = desiredZ - enemy.group.position.z;
            var dist = Math.sqrt((toX * toX) + (toZ * toZ));
            var baseStep = Math.max(0.001, Number(pull.pullSpeed || 26)) * dt;
            var step = Math.min(dist, Math.max(baseStep * 0.45, dist * 0.24));
            if (dist <= 0.08) {
                enemy.group.position.x = desiredX;
                enemy.group.position.z = desiredZ;
                if (Number(pull.postHookStunDuration || 0) > 0) {
                    enemy.justBeenHookedUntil = Date.now() + Math.round(Number(pull.postHookStunDuration || 0) * 1000);
                    GameEnemy.applyStun(enemy, Number(pull.postHookStunDuration || 0));
                }
                enemy.hookPullState = null;
            } else {
                enemy.group.position.x += (toX / dist) * step;
                enemy.group.position.z += (toZ / dist) * step;
            }
            pull.facingYaw = Math.atan2(sourcePos.x - enemy.group.position.x, sourcePos.z - enemy.group.position.z) + Math.PI;
            enemy.visual.rotation.y = pull.facingYaw;
            enemy.revealGhost.rotation.y = pull.facingYaw;
            enemy.moveSpeed = 0;
            return;
        }
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
            if (pos.x < patrolBounds.minX) { pos.x = patrolBounds.minX; enemy.wanderDir.x = Math.abs(enemy.wanderDir.x); }
            if (pos.x > patrolBounds.maxX) { pos.x = patrolBounds.maxX; enemy.wanderDir.x = -Math.abs(enemy.wanderDir.x); }
            if (pos.z < patrolBounds.minZ) { pos.z = patrolBounds.minZ; enemy.wanderDir.z = Math.abs(enemy.wanderDir.z); }
            if (pos.z > patrolBounds.maxZ) { pos.z = patrolBounds.maxZ; enemy.wanderDir.z = -Math.abs(enemy.wanderDir.z); }

            var facing = Math.atan2(enemy.wanderDir.x, enemy.wanderDir.z) + Math.PI;
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
        var facing = Math.atan2(toPlayerX, toPlayerZ) + Math.PI;
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
            var headChance = distance < ENEMY_HEADSHOT_NEAR_RANGE ? 0.2 : (distance < ENEMY_HEADSHOT_MID_RANGE ? 0.12 : 0.07);
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

        var worldMeshes = globalThis.__MAYHEM_RUNTIME.GameWorld.getCollidables ? globalThis.__MAYHEM_RUNTIME.GameWorld.getCollidables() : [];
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
            if (globalThis.__MAYHEM_RUNTIME.GameLocalMatch && globalThis.__MAYHEM_RUNTIME.GameLocalMatch.isActive && globalThis.__MAYHEM_RUNTIME.GameLocalMatch.isActive()) {
                globalThis.__MAYHEM_RUNTIME.GameLocalMatch.registerEnemy(enemy);
            }
        }
    };

    function chokeLiftAt(state, now) {
        if (!state) return 0;
        var stamp = Number(now || Date.now());
        var startedAt = Number(state.startedAt || 0);
        var endsAt = Number(state.endsAt || 0);
        if (!(endsAt > stamp)) return 0;
        var maxLift = Number(state.liftHeight || 1.0);
        if (!(endsAt > startedAt)) return maxLift;
        var progress = Math.max(0, Math.min(1, (stamp - startedAt) / (endsAt - startedAt)));
        if (progress <= 0) return 0;
        if (progress >= 1) return 0;
        if (progress < 0.24) return maxLift * Math.sin((progress / 0.24) * (Math.PI * 0.5));
        if (progress > 0.76) return maxLift * Math.cos(((progress - 0.76) / 0.24) * (Math.PI * 0.5));
        return maxLift;
    }

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
                enemy.group.position.y = chokeLiftAt(enemy.chokeVictimState, Date.now());
                updateEnemyAnimation(enemy, dt, engaging);
                updateRevealGhost(enemy, playerPos, camera, dt);
                updateFlash(enemy, dt);
                updateMuzzleFlash(enemy, dt);
                syncHitboxPositions(enemy);
            } else {
                if (enemy.respawnTimer < 0) {
                    continue;
                }
                enemy.respawnTimer -= dt;
                if (enemy.respawnTimer <= 0) {
                    GameEnemy.respawn(enemy);
                }
            }
        }
    };

    var sharedDamageMod = (globalThis.__MAYHEM_RUNTIME.GameShared && globalThis.__MAYHEM_RUNTIME.GameShared.damage) || null;

    GameEnemy.damage = function (hitboxMesh, damage) {
        var enemy = hitboxMesh.userData.enemyRef;
        if (!enemy || !enemy.alive) return null;

        var hitType = hitboxMesh.userData.type;
        var result;
        if (sharedDamageMod && sharedDamageMod.applyDamage) {
            result = sharedDamageMod.applyDamage(enemy, damage);
        } else {
            var incoming = Math.max(1, Math.round(damage));
            enemy.armorRegenDelay = 6.0;
            if (enemy.armor > 0) {
                var absorbed = Math.min(enemy.armor, incoming);
                enemy.armor -= absorbed;
                incoming -= absorbed;
            }
            if (incoming > 0) enemy.hp -= incoming;
            var killed = enemy.hp <= 0;
            if (killed) enemy.hp = 0;
            result = { absorbed: 0, hpLost: incoming, killed: killed, hp: enemy.hp, armor: enemy.armor };
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

        if (result.killed) {
            GameEnemy.kill(enemy);
        }

        return {
            enemy: enemy,
            killed: result.killed,
            hitType: hitType,
            hp: result.hp,
            armor: result.armor
        };
    };

    GameEnemy.kill = function (enemy) {
        var localMatchResult = null;
        if (globalThis.__MAYHEM_RUNTIME.GameLocalMatch && globalThis.__MAYHEM_RUNTIME.GameLocalMatch.isActive && globalThis.__MAYHEM_RUNTIME.GameLocalMatch.isActive()) {
            localMatchResult = globalThis.__MAYHEM_RUNTIME.GameLocalMatch.onEnemyKilled(enemy);
        }
        enemy.alive = false;
        enemy.group.visible = false;
        enemy.muzzleFlashTimer = 0;
        if (enemy.weaponMuzzle) enemy.weaponMuzzle.visible = false;
        if (enemy.revealGhost) enemy.revealGhost.visible = false;
        enemy.chokeVictimState = null;
        enemy.justBeenHookedUntil = 0;

        removeHitboxes(enemy);

        enemy.respawnTimer = localMatchResult
            ? (typeof localMatchResult.respawnDelaySec === 'number' ? Number(localMatchResult.respawnDelaySec || 0) : -1)
            : 5.0;
        enemy.trackingNeedleState = null;
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
        enemy.hookPullState = null;
        enemy.justBeenHookedUntil = 0;
        enemy.chokeVictimState = null;
        enemy.trackingNeedleState = null;
        if (enemy.weaponMuzzle) enemy.weaponMuzzle.visible = false;
        if (enemy.revealGhost) enemy.revealGhost.visible = false;
        resetFireCooldown(enemy);
        if (globalThis.__MAYHEM_RUNTIME.GameLocalMatch && globalThis.__MAYHEM_RUNTIME.GameLocalMatch.isActive && globalThis.__MAYHEM_RUNTIME.GameLocalMatch.isActive()) {
            globalThis.__MAYHEM_RUNTIME.GameLocalMatch.onEnemyRespawn(enemy);
        }

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

    GameEnemy.pullTarget = function (enemy, playerPos, playerYaw, pullDistance, pullSpeed, stunDuration) {
        if (!enemy || !enemy.alive || !playerPos) return false;
        enemy.hookPullState = {
            pullDistance: Math.max(1.5, Number(pullDistance || 3.2)),
            pullSpeed: Math.max(8, Number(pullSpeed || 26)),
            facingYaw: Math.atan2(playerPos.x - enemy.group.position.x, playerPos.z - enemy.group.position.z) + Math.PI,
            postHookStunDuration: Math.max(0, Number(stunDuration || 0))
        };
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

    globalThis.__MAYHEM_RUNTIME.GameEnemy = GameEnemy;
})();
