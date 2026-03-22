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
    var hitboxVisible = false;
    var ENEMY_BODY_DAMAGE = 14;
    var ENEMY_HEAD_DAMAGE = 26;
    var ENEMY_FIRE_COOLDOWN_MIN = 0.55;
    var ENEMY_FIRE_COOLDOWN_MAX = 1.25;

    var combatRaycaster = new THREE.Raycaster();
    var revealRaycaster = new THREE.Raycaster();
    var enemyShootOrigin = new THREE.Vector3();
    var enemyShootTarget = new THREE.Vector3();
    var enemyShootDir = new THREE.Vector3();
    var revealTarget = new THREE.Vector3();
    var revealDir = new THREE.Vector3();
    var playerHookSourcePos = new THREE.Vector3();
    var lockTargetsScratch = [];

    var skinColors = [0x44aa44, 0xaa4444, 0x4444aa, 0xaa44aa, 0xaaaa44, 0x44aaaa, 0xff8800, 0x8800ff];

    function sharedApi() {
        return globalThis.__MAYHEM_RUNTIME.GameShared || {};
    }

    function enemyTuning() {
        var tuningApi = globalThis.__MAYHEM_RUNTIME.GameCombatTuning || null;
        return (tuningApi && tuningApi.getEnemyTuning)
            ? tuningApi.getEnemyTuning()
            : {
                fireRange: 34,
                headshotNearRange: 12,
                headshotMidRange: 22,
                defaultWallhackRadius: 90
            };
    }

    function fireRange() {
        return Number(enemyTuning().fireRange || 34);
    }

    function headshotNearRange() {
        return Number(enemyTuning().headshotNearRange || 12);
    }

    function headshotMidRange() {
        return Number(enemyTuning().headshotMidRange || 22);
    }

    function defaultWallhackRadius() {
        return Number(enemyTuning().defaultWallhackRadius || 90);
    }

    function entityConstantsApi() {
        return sharedApi().entityConstants || {};
    }

    function enemyHpDefault() {
        var constants = entityConstantsApi();
        return Number(constants.ENEMY_HP || constants.ENEMY_HP_MAX || constants.DEFAULT_HP_MAX || constants.DEFAULT_HP || 0);
    }

    function enemyArmorDefault() {
        var constants = entityConstantsApi();
        return Number(constants.ENEMY_ARMOR || constants.ENEMY_ARMOR_MAX || constants.DEFAULT_ARMOR_MAX || constants.DEFAULT_ARMOR || 0);
    }

    function enemyArmorRegenDelay() {
        var shared = sharedApi();
        return Number((shared.getSurvivabilityTuning ? (shared.getSurvivabilityTuning() || {}).armorRegenDelaySec : 8.0) || 8.0);
    }

    function damageApi() {
        return sharedApi().damage || null;
    }

    function selectableWeaponIds() {
        var shared = globalThis.__MAYHEM_RUNTIME.GameShared || {};
        var selected = shared.getSelectableWeaponIds ? shared.getSelectableWeaponIds() : null;
        return Array.isArray(selected) && selected.length ? selected : ['rifle'];
    }

    function getCurrentWallhackRadius() {
        var net = globalThis.__MAYHEM_RUNTIME.GameNet || null;
        var netRuntime = net && net.runtime ? net.runtime : net;
        var netView = net && net.view ? net.view : net;
        if (netRuntime && netRuntime.isActive && netRuntime.isActive() && netView && netView.getAuthoritativeSelfState) {
            var selfState = netView.getAuthoritativeSelfState();
            if (selfState && typeof selfState.wallhackRadius === 'number') {
                return selfState.wallhackRadius;
            }
        }
        if (globalThis.__MAYHEM_RUNTIME.GameAbilities && globalThis.__MAYHEM_RUNTIME.GameAbilities.getWallhackRadius) {
            return globalThis.__MAYHEM_RUNTIME.GameAbilities.getWallhackRadius();
        }
        return defaultWallhackRadius();
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

    function syncHitboxPositions(enemy) {
        if (enemy && enemy.actorVisual && enemy.group && enemy.actorVisual.syncHitboxes) {
            enemy.actorVisual.syncHitboxes(enemy.group.position);
        }
    }

    function createEnemy(scene, index) {
        var color = skinColors[index % skinColors.length];
        var weaponId = randomEnemyWeapon();
        var localMatchId = 'guest-bot-' + String(index + 1);
        var actorFactory = globalThis.__MAYHEM_RUNTIME.GameActorVisualFactory || null;
        if (!actorFactory || !actorFactory.create) {
            throw new Error('GameEnemy requires GameActorVisualFactory.create.');
        }
        var actorVisual = actorFactory.create({
            ownerType: 'enemy',
            bodyColor: color,
            skinColor: 0xd2a77d,
            legColor: 0x333333,
            weaponId: weaponId,
            targetId: localMatchId,
            hitboxOpacity: hitboxVisible ? 0.3 : 0,
            includeRevealGhost: true
        });
        var group = actorVisual.root || actorVisual.visual;
        var visual = actorVisual.visual;
        var revealGhost = actorVisual.revealGhost;

        var spawn = getEnemySpawnPoint();
        if (actorVisual.setWorldTransform) {
            actorVisual.setWorldTransform({ x: spawn.x, y: 0, z: spawn.z }, 0);
        } else {
            group.position.set(spawn.x, 0, spawn.z);
        }

        scene.add(group);
        var bodyHitbox = actorVisual.bodyHitbox;
        var headHitbox = actorVisual.headHitbox;

        if (bodyHitbox) scene.add(bodyHitbox);
        if (headHitbox) scene.add(headHitbox);

        var enemy = {
            group: group,
            visual: visual,
            revealGhost: revealGhost,
            bodyHitbox: bodyHitbox,
            headHitbox: headHitbox,
            actorVisual: actorVisual,
            hp: enemyHpDefault(),
            maxHp: enemyHpDefault(),
            armor: enemyArmorDefault(),
            armorMax: enemyArmorDefault(),
            alive: true,
            index: index,
            localMatchId: localMatchId,
            displayName: 'BOT_' + String(index + 1),
            color: color,
            weaponType: weaponId,
            rig: actorVisual.rig || null,
            rigApi: actorVisual.rigApi,

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

            muzzleFlashTimer: 0,
            fireCooldown: 0,

            animPhase: Math.random() * Math.PI * 2,
            stunTimer: 0,
            slowTimer: 0,
            slowMultiplier: 1,
            hookPullState: null,
            justBeenHookedStartedAt: 0,
            justBeenHookedUntil: 0,
            deadeyeMark: null,
            chokeVictimState: null,
            trackingNeedleState: null
        };

        if (bodyHitbox && bodyHitbox.userData) bodyHitbox.userData.enemyRef = enemy;
        if (headHitbox && headHitbox.userData) headHitbox.userData.enemyRef = enemy;
        actorVisual.setHitboxVisibility(hitboxVisible);

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

    function updateEnemyAnimation(enemy, dt, engaging, nowMs) {
        if (enemy.actorVisual && enemy.actorVisual.updateAnimation) {
            var speedNorm = Math.max(0, Math.min(1.4, enemy.moveSpeed / 2.3));
            enemy.actorVisual.updateAnimation(dt, {
                speedNorm: speedNorm,
                sprinting: speedNorm > 0.85,
                airborne: false,
                aimPitch: engaging ? -0.05 : 0,
                hooked: !!enemy.hookPullState || Number(enemy.justBeenHookedUntil || 0) > nowMs,
                hookStartedAt: enemy.hookPullState
                    ? Number(enemy.hookPullState.startedAt || 0)
                    : Number(enemy.justBeenHookedStartedAt || 0),
                choked: !!(enemy.chokeVictimState && enemy.chokeVictimState.endsAt > nowMs),
                startedAt: enemy.chokeVictimState ? Number(enemy.chokeVictimState.startedAt || 0) : 0,
                adsActive: !!engaging,
                worldSpeed: enemy.moveSpeed,
                movingForward: speedNorm > 0.05
            });
        }
    }

    function updateStatusTimers(enemy, dt, nowMs) {
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
        if (enemy.chokeVictimState && enemy.chokeVictimState.endsAt <= nowMs) {
            enemy.chokeVictimState = null;
        }

        var sharedDamageMod = damageApi();
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

    function finalizeHookPull(enemy, pull, desiredX, desiredZ, nowMs) {
        enemy.group.position.x = desiredX;
        enemy.group.position.z = desiredZ;
        if (Number(pull.postHookStunDuration || 0) > 0) {
            enemy.justBeenHookedStartedAt = nowMs;
            enemy.justBeenHookedUntil = nowMs + Math.round(Number(pull.postHookStunDuration || 0) * 1000);
            GameEnemy.applyStun(enemy, Number(pull.postHookStunDuration || 0));
        }
        enemy.hookPullState = null;
    }

    function updateAI(enemy, dt, nowMs, patrolBounds) {
        if (!enemy.alive) return;
        if (enemy.hookPullState) {
            var pull = enemy.hookPullState;
            var playerState = globalThis.__MAYHEM_RUNTIME.GamePlayer;
            var sourcePos = playerState && playerState.getPosition ? playerState.getPosition(playerHookSourcePos) : null;
            var sourceRot = playerState && playerState.getRotation ? playerState.getRotation() : null;
            if (!sourcePos || !sourceRot) {
                enemy.hookPullState = null;
                return;
            }
            var targetDist = Math.max(1.5, Number(pull.pullDistance || 3.2));
            var desiredX = Math.max(patrolBounds.minX, Math.min(patrolBounds.maxX, sourcePos.x + (-Math.sin(sourceRot.yaw || 0) * targetDist)));
            var desiredZ = Math.max(patrolBounds.minZ, Math.min(patrolBounds.maxZ, sourcePos.z + (-Math.cos(sourceRot.yaw || 0) * targetDist)));
            var toX = desiredX - enemy.group.position.x;
            var toZ = desiredZ - enemy.group.position.z;
            var dist = Math.sqrt((toX * toX) + (toZ * toZ));
            var sourceDx = sourcePos.x - enemy.group.position.x;
            var sourceDz = sourcePos.z - enemy.group.position.z;
            var sourceDist = Math.sqrt((sourceDx * sourceDx) + (sourceDz * sourceDz));
            var baseStep = Math.max(0.001, Number(pull.pullSpeed || 26)) * dt;
            var step = Math.min(dist, Math.max(baseStep * 0.45, dist * 0.24));
            if (sourceDist <= (targetDist + 0.08) || dist <= 0.08 || nowMs >= Number(pull.endsAt || 0)) {
                finalizeHookPull(enemy, pull, desiredX, desiredZ, nowMs);
            } else {
                enemy.group.position.x += (toX / dist) * step;
                enemy.group.position.z += (toZ / dist) * step;
                sourceDx = sourcePos.x - enemy.group.position.x;
                sourceDz = sourcePos.z - enemy.group.position.z;
                sourceDist = Math.sqrt((sourceDx * sourceDx) + (sourceDz * sourceDz));
                if (sourceDist <= (targetDist + 0.08)) {
                    finalizeHookPull(enemy, pull, desiredX, desiredZ, nowMs);
                }
            }
            pull.facingYaw = Math.atan2(sourcePos.x - enemy.group.position.x, sourcePos.z - enemy.group.position.z) + Math.PI;
            if (enemy.actorVisual && enemy.actorVisual.setYaw) enemy.actorVisual.setYaw(pull.facingYaw);
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

            if (pos.x < patrolBounds.minX) { pos.x = patrolBounds.minX; enemy.wanderDir.x = Math.abs(enemy.wanderDir.x); }
            if (pos.x > patrolBounds.maxX) { pos.x = patrolBounds.maxX; enemy.wanderDir.x = -Math.abs(enemy.wanderDir.x); }
            if (pos.z < patrolBounds.minZ) { pos.z = patrolBounds.minZ; enemy.wanderDir.z = Math.abs(enemy.wanderDir.z); }
            if (pos.z > patrolBounds.maxZ) { pos.z = patrolBounds.maxZ; enemy.wanderDir.z = -Math.abs(enemy.wanderDir.z); }

            var facing = Math.atan2(enemy.wanderDir.x, enemy.wanderDir.z) + Math.PI;
            if (enemy.actorVisual && enemy.actorVisual.setYaw) enemy.actorVisual.setYaw(facing);

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
        if (distance > fireRange()) return false;

        var toPlayerX = enemyShootTarget.x - enemy.group.position.x;
        var toPlayerZ = enemyShootTarget.z - enemy.group.position.z;
        var facing = Math.atan2(toPlayerX, toPlayerZ) + Math.PI;
        if (enemy.actorVisual && enemy.actorVisual.setYaw) enemy.actorVisual.setYaw(facing);

        if (enemy.fireCooldown > 0) return true;
        if (!hasLineOfSight(enemyShootOrigin, enemyShootTarget, fireRange())) {
            resetFireCooldown(enemy);
            return true;
        }

        var hitChance = 0.85 - (distance / fireRange()) * 0.45;
        hitChance = Math.max(0.35, Math.min(0.9, hitChance));

        if (Math.random() <= hitChance) {
            var headChance = distance < headshotNearRange() ? 0.2 : (distance < headshotMidRange() ? 0.12 : 0.07);
            var isHeadshot = Math.random() < headChance;
            var hitType = isHeadshot ? 'head' : 'body';
            var damage = isHeadshot ? ENEMY_HEAD_DAMAGE : ENEMY_BODY_DAMAGE;
            onPlayerHit(damage, hitType, enemy);
        }

        if (enemy.actorVisual && enemy.actorVisual.setMuzzleVisible) {
            enemy.actorVisual.setMuzzleVisible(true);
            enemy.muzzleFlashTimer = 0.06;
        }

        resetFireCooldown(enemy);
        return true;
    }

    function updateRevealGhost(enemy, playerPos, camera, dt) {
        if (!enemy.actorVisual || !enemy.revealGhost) return;

        if (enemy.alive && enemy.chokeVictimState && enemy.chokeVictimState.endsAt > Date.now()) {
            enemy.actorVisual.setRevealGhostState(false);
            return;
        }

        if (enemy.alive && enemy.deadeyeMark) {
            var deadeyePulse = 0.06 * Math.sin((performance.now() * 0.016) + enemy.index);
            var deadeyeOpacity = enemy.deadeyeMark.locked
                ? 0.46
                : (0.24 + (Math.max(0, Math.min(1, Number(enemy.deadeyeMark.progress || 0))) * 0.18));
            enemy.actorVisual.setRevealGhostState(true, deadeyeOpacity + deadeyePulse, 0xffc46d);
            return;
        }

        if (!enemy.alive || !playerPos || !camera) {
            enemy.actorVisual.setRevealGhostState(false);
            return;
        }

        var horizontalDist = Math.hypot(
            enemy.group.position.x - playerPos.x,
            enemy.group.position.z - playerPos.z
        );
        if (horizontalDist > getCurrentWallhackRadius()) {
            enemy.actorVisual.setRevealGhostState(false);
            return;
        }

        var worldMeshes = globalThis.__MAYHEM_RUNTIME.GameWorld.getCollidables ? globalThis.__MAYHEM_RUNTIME.GameWorld.getCollidables() : [];
        if (!worldMeshes || worldMeshes.length === 0) {
            enemy.actorVisual.setRevealGhostState(false);
            return;
        }

        revealTarget.copy(enemy.group.position);
        revealTarget.y += 2.2;

        revealDir.copy(revealTarget).sub(camera.position);
        var distToTarget = revealDir.length();
        if (distToTarget <= 0.001) {
            enemy.actorVisual.setRevealGhostState(false);
            return;
        }

        revealDir.divideScalar(distToTarget);
        revealRaycaster.set(camera.position, revealDir);
        revealRaycaster.far = distToTarget - 0.2;

        var blocked = revealRaycaster.intersectObjects(worldMeshes, false).length > 0;
        var pulse = 0.04 * Math.sin(performance.now() * 0.012 + enemy.index);
        enemy.actorVisual.setRevealGhostState(blocked, 0.26 + pulse, 0x65d8ff);
    }

    function updateMuzzleFlash(enemy, dt) {
        if (!enemy.actorVisual || enemy.muzzleFlashTimer <= 0) return;

        enemy.muzzleFlashTimer -= dt;
        if (enemy.muzzleFlashTimer <= 0) {
            enemy.actorVisual.setMuzzleVisible(false);
            enemy.muzzleFlashTimer = 0;
        }
    }

    function updateFlash(enemy, dt) {
        if (!enemy.isFlashing) return;

        enemy.flashTimer -= dt;
        if (enemy.flashTimer <= 0) {
            if (enemy.actorVisual && enemy.actorVisual.setDamageFlash) enemy.actorVisual.setDamageFlash(false);
            enemy.isFlashing = false;
        }
    }

    function removeHitboxes(enemy) {
        var idx = hitboxArray.indexOf(enemy.bodyHitbox);
        if (idx !== -1) hitboxArray.splice(idx, 1);
        if (enemy.bodyHitbox && enemy.bodyHitbox.parent) {
            enemy.bodyHitbox.parent.remove(enemy.bodyHitbox);
        }

        idx = hitboxArray.indexOf(enemy.headHitbox);
        if (idx !== -1) hitboxArray.splice(idx, 1);
        if (enemy.headHitbox && enemy.headHitbox.parent) {
            enemy.headHitbox.parent.remove(enemy.headHitbox);
        }
    }

    function addHitboxes(enemy) {
        if (enemy.bodyHitbox) sceneRef.add(enemy.bodyHitbox);
        if (enemy.headHitbox) sceneRef.add(enemy.headHitbox);

        if (enemy.bodyHitbox) hitboxArray.push(enemy.bodyHitbox);
        if (enemy.headHitbox) hitboxArray.push(enemy.headHitbox);

        applyHitboxVisibility(enemy);
    }

    function applyHitboxVisibility(enemy) {
        if (enemy.actorVisual && enemy.actorVisual.setHitboxVisibility) {
            enemy.actorVisual.setHitboxVisibility(hitboxVisible);
        }
    }

    GameEnemy.init = function (scene, count) {
        GameEnemy.dispose();
        enemies = [];
        hitboxArray = [];
        lockTargetsScratch.length = 0;
        sceneRef = scene;
        count = count || 8;

        for (var i = 0; i < count; i++) {
            var enemy = createEnemy(scene, i);
            enemies.push(enemy);
            if (enemy.bodyHitbox) hitboxArray.push(enemy.bodyHitbox);
            if (enemy.headHitbox) hitboxArray.push(enemy.headHitbox);
            if (globalThis.__MAYHEM_RUNTIME.GameLocalMatch &&
                globalThis.__MAYHEM_RUNTIME.GameLocalMatch.isActive &&
                globalThis.__MAYHEM_RUNTIME.GameLocalMatch.isActive() &&
                globalThis.__MAYHEM_RUNTIME.GameLocalMatch.registerEnemy) {
                globalThis.__MAYHEM_RUNTIME.GameLocalMatch.registerEnemy(enemy);
            }
        }
    };

    function destroyEnemy(enemy) {
        if (!enemy) return;
        removeHitboxes(enemy);
        if (enemy.actorVisual && enemy.actorVisual.destroy) {
            enemy.actorVisual.destroy();
        } else {
            if (enemy.group && enemy.group.parent) enemy.group.parent.remove(enemy.group);
            if (enemy.bodyHitbox && enemy.bodyHitbox.parent) enemy.bodyHitbox.parent.remove(enemy.bodyHitbox);
            if (enemy.headHitbox && enemy.headHitbox.parent) enemy.headHitbox.parent.remove(enemy.headHitbox);
        }
        enemy.actorVisual = null;
        enemy.group = null;
        enemy.bodyHitbox = null;
        enemy.headHitbox = null;
        enemy.visual = null;
        enemy.revealGhost = null;
        enemy.lockTargetWorldPos = null;
        enemy.lockTargetDescriptor = null;
    }

    GameEnemy.dispose = function () {
        for (var i = 0; i < enemies.length; i++) {
            destroyEnemy(enemies[i]);
        }
        enemies = [];
        hitboxArray = [];
        lockTargetsScratch.length = 0;
        sceneRef = null;
    };

    function chokeLiftAt(state, now) {
        var abilityFxView = globalThis.__MAYHEM_RUNTIME.GameAbilityFx || null;
        if (abilityFxView && abilityFxView.chokeLiftAt) {
            return abilityFxView.chokeLiftAt(state, now);
        }
        return 0;
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
        var nowMs = Date.now();
        var patrolBounds = getPatrolBounds();

        if (typeof cameraOrCallback === 'function') {
            onPlayerHit = cameraOrCallback;
        } else {
            camera = cameraOrCallback;
        }

        for (var i = 0; i < enemies.length; i++) {
            var enemy = enemies[i];

            if (enemy.alive) {
                updateStatusTimers(enemy, dt, nowMs);
                updateAI(enemy, dt, nowMs, patrolBounds);
                var engaging = updateCombat(enemy, dt, playerPos, onPlayerHit);
                enemy.group.position.y = chokeLiftAt(enemy.chokeVictimState, nowMs);
                updateEnemyAnimation(enemy, dt, engaging, nowMs);
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

    GameEnemy.damage = function (hitboxMesh, damage) {
        var enemy = hitboxMesh.userData.enemyRef;
        if (!enemy || !enemy.alive) return null;

        var hitType = hitboxMesh.userData.type;
        var result;
        var sharedDamageMod = damageApi();
        if (sharedDamageMod && sharedDamageMod.applyDamage) {
            result = sharedDamageMod.applyDamage(enemy, damage);
        } else {
            var incoming = Math.max(1, Math.round(damage));
            enemy.armorRegenDelay = enemyArmorRegenDelay();
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
        if (enemy.actorVisual && enemy.actorVisual.setDamageFlash) enemy.actorVisual.setDamageFlash(true);

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
        if (globalThis.__MAYHEM_RUNTIME.GameLocalMatch &&
            globalThis.__MAYHEM_RUNTIME.GameLocalMatch.isActive &&
            globalThis.__MAYHEM_RUNTIME.GameLocalMatch.isActive() &&
            globalThis.__MAYHEM_RUNTIME.GameLocalMatch.onEnemyKilled) {
            localMatchResult = globalThis.__MAYHEM_RUNTIME.GameLocalMatch.onEnemyKilled(enemy);
        }
        enemy.alive = false;
        enemy.group.visible = false;
        enemy.muzzleFlashTimer = 0;
        if (enemy.actorVisual && enemy.actorVisual.setAlive) enemy.actorVisual.setAlive(false);
        if (enemy.actorVisual && enemy.actorVisual.setMuzzleVisible) enemy.actorVisual.setMuzzleVisible(false);
        if (enemy.actorVisual && enemy.actorVisual.setRevealGhostState) enemy.actorVisual.setRevealGhostState(false);
        enemy.chokeVictimState = null;
        enemy.justBeenHookedStartedAt = 0;
        enemy.justBeenHookedUntil = 0;
        enemy.deadeyeMark = null;

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
        if (enemy.actorVisual && enemy.actorVisual.setAlive) enemy.actorVisual.setAlive(true);
        if (enemy.actorVisual && enemy.actorVisual.setDamageFlash) enemy.actorVisual.setDamageFlash(false);

        enemy.moveSpeed = 0;
        enemy.isFlashing = false;
        enemy.muzzleFlashTimer = 0;
        enemy.stunTimer = 0;
        enemy.slowTimer = 0;
        enemy.slowMultiplier = 1;
        enemy.hookPullState = null;
        enemy.justBeenHookedStartedAt = 0;
        enemy.justBeenHookedUntil = 0;
        enemy.deadeyeMark = null;
        enemy.chokeVictimState = null;
        enemy.trackingNeedleState = null;
        if (enemy.actorVisual && enemy.actorVisual.setMuzzleVisible) enemy.actorVisual.setMuzzleVisible(false);
        if (enemy.actorVisual && enemy.actorVisual.setRevealGhostState) enemy.actorVisual.setRevealGhostState(false);
        resetFireCooldown(enemy);
        if (globalThis.__MAYHEM_RUNTIME.GameLocalMatch &&
            globalThis.__MAYHEM_RUNTIME.GameLocalMatch.isActive &&
            globalThis.__MAYHEM_RUNTIME.GameLocalMatch.isActive() &&
            globalThis.__MAYHEM_RUNTIME.GameLocalMatch.onEnemyRespawn) {
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
        lockTargetsScratch.length = 0;
        for (var i = 0; i < enemies.length; i++) {
            var enemy = enemies[i];
            if (!enemy || !enemy.alive) continue;

            var corePos = enemy.lockTargetWorldPos || (enemy.lockTargetWorldPos = new THREE.Vector3());
            if (enemy.actorVisual && enemy.actorVisual.getCoreWorldPosition) {
                corePos = enemy.actorVisual.getCoreWorldPosition(corePos);
            } else if (enemy.bodyHitbox && enemy.bodyHitbox.position) {
                corePos.copy(enemy.bodyHitbox.position);
            } else if (enemy.group && enemy.group.position) {
                corePos.copy(enemy.group.position);
                corePos.y += 1.0;
            } else {
                corePos = null;
            }
            if (!corePos) continue;

            var desc = enemy.lockTargetDescriptor || (enemy.lockTargetDescriptor = {
                targetId: '',
                ownerType: 'enemy',
                worldPos: corePos,
                hitbox: null,
                bodyHitbox: null,
                headHitbox: null,
                alive: true,
                enemyRef: enemy
            });
            desc.targetId = (enemy.bodyHitbox && enemy.bodyHitbox.userData && enemy.bodyHitbox.userData.targetId) || ('enemy:' + enemy.index);
            desc.ownerType = 'enemy';
            desc.worldPos = corePos;
            desc.hitbox = enemy.bodyHitbox || null;
            desc.bodyHitbox = enemy.bodyHitbox || null;
            desc.headHitbox = enemy.headHitbox || null;
            desc.alive = true;
            desc.enemyRef = enemy;
            lockTargetsScratch.push(desc);
        }
        return lockTargetsScratch;
    };

    GameEnemy.setDeadeyeHighlights = function (markMap) {
        var marks = markMap || {};
        for (var i = 0; i < enemies.length; i++) {
            var enemy = enemies[i];
            if (!enemy) continue;
            var targetId = (enemy.bodyHitbox && enemy.bodyHitbox.userData && enemy.bodyHitbox.userData.targetId) || ('enemy:' + enemy.index);
            enemy.deadeyeMark = marks[targetId] || null;
        }
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
        var desiredDist = Math.max(1.5, Number(pullDistance || 3.2));
        var speed = Math.max(8, Number(pullSpeed || 26));
        var dx = Number(playerPos.x || 0) - enemy.group.position.x;
        var dz = Number(playerPos.z || 0) - enemy.group.position.z;
        var currentDist = Math.sqrt((dx * dx) + (dz * dz));
        var travelDist = Math.max(0, currentDist - desiredDist);
        var durationMs = Math.max(120, Math.round((travelDist / speed) * 1000));
        enemy.hookPullState = {
            pullDistance: desiredDist,
            pullSpeed: speed,
            startedAt: Date.now(),
            endsAt: Date.now() + durationMs,
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
