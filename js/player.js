/**
 * player.js - WASD movement, switchable first/third-person camera, variable jump, weapon model
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GamePlayer
 */
(function () {
    'use strict';

    var GamePlayer = {};

    var camera = null;
    var yaw = 0;
    var pitch = 0;

    var sharedGameplay = globalThis.__MAYHEM_RUNTIME.GameShared && globalThis.__MAYHEM_RUNTIME.GameShared.gameplayTuning;
    var movementTuning = sharedGameplay && sharedGameplay.movement ? sharedGameplay.movement : {};
    var entityConstants = globalThis.__MAYHEM_RUNTIME.GameShared && globalThis.__MAYHEM_RUNTIME.GameShared.entityConstants
        ? globalThis.__MAYHEM_RUNTIME.GameShared.entityConstants
        : {};

    var EYE_HEIGHT = Number(entityConstants.EYE_HEIGHT || 1.6);
    var JOG_SPEED = Number(movementTuning.jogSpeed || 8);
    var RUN_SPEED = Number(movementTuning.runSpeed || 14);
    var JUMP_VELOCITY = Number(movementTuning.jumpVelocity || 8.8);
    var JUMP_HOLD_ACCEL = Number(movementTuning.jumpHoldAccel || 16);
    var MAX_JUMP_HOLD = Number(movementTuning.maxJumpHold || 0.2);
    var JUMP_RELEASE_MULT = Number(movementTuning.jumpReleaseMult || 0.42);
    var GRAVITY = Number(movementTuning.gravity || 18);
    var MOUSE_SENSITIVITY = 0.002;
    var PITCH_LIMIT = 89 * (Math.PI / 180);

    var PLAYER_RADIUS = Number(entityConstants.PLAYER_RADIUS || 0.35);
    var PLAYER_HEIGHT = Number(entityConstants.PLAYER_HEIGHT || 1.7);
    var EPSILON = 0.001;

    var THIRD_HEIGHT = 0.7;
    var THIRD_SMOOTH = 12;
    var CAMERA_DIST = 4.4 * 0.85;
    var CAMERA_SHOULDER = 1.35 * 1.3;
    var CAMERA_FOV = 75;
    var FIRST_PERSON_SMOOTH = 20;
    var ADS_FOV = 56;
    var ADS_DIST = 1.72;
    var ADS_SHOULDER = 2;
    var ADS_HEIGHT = 0.46;
    var ADS_BLEND_SPEED = 16;
    var ADS_MOVE_MULT = Number(movementTuning.adsMoveMult || 0.4);
    var ADS_SENSITIVITY_MULT = 0.7;
    var SNIPER_SCOPE_FOV = 24;
    var SNIPER_SCOPE_DIST = 0.14;
    var SNIPER_SCOPE_SHOULDER = 0.08;
    var SNIPER_SCOPE_HEIGHT = 0.12;
    var SNIPER_SCOPE_BLEND_SPEED = 18;
    var SNIPER_SCOPE_SENSITIVITY_MULT = 0.42;

    var playerX = 25;
    var playerZ = 45;
    var velocityY = 0;
    var posY = EYE_HEIGHT;
    var isGrounded = true;
    var jumpHoldTimer = 0;
    var jumpPressedLastFrame = false;
    var sprintPressedLastFrame = false;
    var sprintQueued = false;
    var scopeHeld = false;
    var scopeBlend = 0;

    var thirdCameraInitialized = false;
    var viewOrigin = new THREE.Vector3();
    var viewDesired = new THREE.Vector3();
    var viewTarget = new THREE.Vector3();
    var adsDesired = new THREE.Vector3();
    var viewDir = new THREE.Vector3();
    var eyeWorld = new THREE.Vector3();
    var plasmaForwardDir = new THREE.Vector3();
    var throwableRightDir = new THREE.Vector3();
    var viewRay = new THREE.Raycaster();

    var keys = {
        forward: false,
        backward: false,
        left: false,
        right: false,
        jump: false,
        sprint: false
    };

    var currentWeaponId = 'rifle';

    var avatarGroup = null;
    var avatarRig = null;
    var avatarRigApi = null;
    var actorVisual = null;
    var sceneRef = null;
    var bodyHitbox = null;
    var headHitbox = null;
    var hitboxVisible = false;

    var bobTimer = 0;
    var isMoving = false;
    var sprinting = false;
    var lastMoveSpeedNorm = 0;
    var loadoutSlots = ['rifle', 'pistol', 'machinegun', 'shotgun', 'sniper'];

    var gunBobX = 0;
    var gunBobY = 0;
    var gunRecoil = 0;
    var palmRecoil = 0;
    var cameraKickPitch = 0;
    var cameraKickYaw = 0;
    var cameraKickRoll = 0;
    var lastReplayAckSeq = 0;
    var requestedCameraMode = 'third';
    var authoritativeCameraMode = 'third';
    var hasAuthoritativeCameraMode = false;
    var avatarAliveVisible = true;
    var statusState = {
        stunUntil: 0,
        hookPullUntil: 0,
        chokeStartedAt: 0,
        chokeUntil: 0,
        chokeLift: 0,
        spawnShieldUntil: 0,
        weaponUntil: 0,
        throwableUntil: 0,
        abilityUntil: 0
    };

    function hasInputCapture() {
        return !!document.pointerLockElement;
    }

    function movementHelper() {
        var shared = globalThis.__MAYHEM_RUNTIME.GameShared || {};
        return shared.authoritativeMovement || null;
    }

    function reconciliationHelper() {
        var shared = globalThis.__MAYHEM_RUNTIME.GameShared || {};
        return shared.authoritativeReconciliation || null;
    }

    function nowMs() {
        return Date.now();
    }

    function isStunned(now) {
        return Number(statusState.stunUntil || 0) > Number(now || nowMs());
    }

    function isHookPulled(now) {
        return Number(statusState.hookPullUntil || 0) > Number(now || nowMs());
    }

    function isChoked(now) {
        return Number(statusState.chokeUntil || 0) > Number(now || nowMs());
    }

    function isSpawnShielded(now) {
        return Number(statusState.spawnShieldUntil || 0) > Number(now || nowMs());
    }

    function actionRestrictionUntil(actionType) {
        if (actionType === 'weapon') return Number(statusState.weaponUntil || 0);
        if (actionType === 'throwable') return Number(statusState.throwableUntil || 0);
        if (actionType === 'ability') return Number(statusState.abilityUntil || 0);
        return 0;
    }

    function isActionRestricted(actionType, now) {
        return actionRestrictionUntil(actionType) > Number(now || nowMs());
    }

    function isMovementLocked(now) {
        return isStunned(now) || isHookPulled(now) || isChoked(now);
    }

    function isActionLocked(now) {
        return isMovementLocked(now) ||
            isActionRestricted('weapon', now) ||
            isActionRestricted('throwable', now) ||
            isActionRestricted('ability', now);
    }

    function canUseWeapon(now) {
        return !isMovementLocked(now) && !isActionRestricted('weapon', now);
    }

    function canUseThrowable(now) {
        return !isMovementLocked(now) && !isActionRestricted('throwable', now);
    }

    function canUseAbility(now) {
        return !isMovementLocked(now) && !isActionRestricted('ability', now);
    }

    function clearExpiredStatusState(now) {
        var stamp = Number(now || nowMs());
        if (!isStunned(stamp)) statusState.stunUntil = 0;
        if (!isHookPulled(stamp)) statusState.hookPullUntil = 0;
        if (!isChoked(stamp)) {
            statusState.chokeStartedAt = 0;
            statusState.chokeUntil = 0;
            statusState.chokeLift = 0;
        }
        if (!isSpawnShielded(stamp)) statusState.spawnShieldUntil = 0;
        if (!isActionRestricted('weapon', stamp)) statusState.weaponUntil = 0;
        if (!isActionRestricted('throwable', stamp)) statusState.throwableUntil = 0;
        if (!isActionRestricted('ability', stamp)) statusState.abilityUntil = 0;
    }

    function applyStatusState(patch) {
        patch = patch || {};
        if (typeof patch.stunUntil === 'number') statusState.stunUntil = Number(patch.stunUntil || 0);
        if (typeof patch.hookPullUntil === 'number') statusState.hookPullUntil = Number(patch.hookPullUntil || 0);
        if (typeof patch.chokeStartedAt === 'number') statusState.chokeStartedAt = Number(patch.chokeStartedAt || 0);
        if (typeof patch.chokeUntil === 'number') statusState.chokeUntil = Number(patch.chokeUntil || 0);
        if (typeof patch.chokeLift === 'number') statusState.chokeLift = Number(patch.chokeLift || 0);
        if (typeof patch.spawnShieldUntil === 'number') statusState.spawnShieldUntil = Number(patch.spawnShieldUntil || 0);
        if (typeof patch.weaponUntil === 'number') statusState.weaponUntil = Number(patch.weaponUntil || 0);
        if (typeof patch.throwableUntil === 'number') statusState.throwableUntil = Number(patch.throwableUntil || 0);
        if (typeof patch.abilityUntil === 'number') statusState.abilityUntil = Number(patch.abilityUntil || 0);
        clearExpiredStatusState(nowMs());
        setSpawnShieldVisual(isSpawnShielded());
    }

    function chokeLiftAt(now) {
        var stamp = Number(now || nowMs());
        if (!isChoked(stamp)) return 0;
        var maxLift = Number(statusState.chokeLift || 0);
        var startedAt = Number(statusState.chokeStartedAt || 0);
        var endsAt = Number(statusState.chokeUntil || 0);
        if (!(endsAt > startedAt)) return maxLift;
        var progress = Math.max(0, Math.min(1, (stamp - startedAt) / (endsAt - startedAt)));
        if (progress <= 0) return 0;
        if (progress >= 1) return 0;
        if (progress < 0.24) return maxLift * Math.sin((progress / 0.24) * (Math.PI * 0.5));
        if (progress > 0.76) return maxLift * Math.cos(((progress - 0.76) / 0.24) * (Math.PI * 0.5));
        return maxLift;
    }

    function activeChokeLift() {
        return chokeLiftAt(nowMs());
    }

    function weaponSupportsAds() {
        return currentWeaponId === 'rifle' ||
            currentWeaponId === 'pistol' ||
            currentWeaponId === 'machinegun' ||
            currentWeaponId === 'shotgun' ||
            currentWeaponId === 'sniper';
    }

    function isSniperScopeWeapon() {
        return currentWeaponId === 'sniper';
    }

    function canUseAds() {
        if (globalThis.__MAYHEM_RUNTIME.GameHitscan && globalThis.__MAYHEM_RUNTIME.GameHitscan.isAdsBlocked && globalThis.__MAYHEM_RUNTIME.GameHitscan.isAdsBlocked()) {
            return false;
        }
        return weaponSupportsAds() && hasInputCapture();
    }

    function isAdsActive() {
        return canUseAds() && scopeHeld;
    }

    function setAdsEnabled(enabled) {
        scopeHeld = !!enabled && canUseAds();
        return scopeHeld;
    }

    function toggleAds() {
        if (!canUseAds()) {
            scopeHeld = false;
            return false;
        }
        scopeHeld = !scopeHeld;
        return scopeHeld;
    }

    function applyAvatarWeaponPose() {
        if (avatarRigApi && avatarRigApi.setWeapon) {
            avatarRigApi.setWeapon(currentWeaponId);
            avatarRig = avatarRigApi.rig || avatarRig;
        }
    }

    function normalizeCameraMode(mode) {
        return String(mode || '').toLowerCase() === 'first' ? 'first' : 'third';
    }

    function isFirstPersonCameraMode(mode) {
        return normalizeCameraMode(mode) === 'first';
    }

    function effectiveCameraMode() {
        var net = globalThis.__MAYHEM_RUNTIME.GameNet;
        var networkAuthoritative = !!(net && net.isActive && net.isActive());
        if (networkAuthoritative && hasAuthoritativeCameraMode) {
            return authoritativeCameraMode;
        }
        return requestedCameraMode;
    }

    function syncAvatarVisibility(firstPersonMode, sniperMode) {
        if (!avatarGroup) return;

        var avatarVisible = avatarAliveVisible && (!sniperMode || scopeBlend < 0.55);
        avatarGroup.visible = avatarVisible;

        if (!avatarRigApi || !avatarRigApi.rig) {
            return;
        }

        if (avatarRigApi.setFirstPersonActive) {
            avatarRigApi.setFirstPersonActive(!!firstPersonMode && avatarVisible);
        }

        if (!avatarVisible) {
            return;
        }

        var rig = avatarRigApi.rig;
        var hideFullBody = !!firstPersonMode;

        if (rig.thirdPerson) rig.thirdPerson.visible = !hideFullBody;
        if (rig.firstPerson) rig.firstPerson.visible = hideFullBody;
        if (rig.headMesh) rig.headMesh.visible = !hideFullBody;
        if (rig.bodyMesh) rig.bodyMesh.visible = !hideFullBody;
        if (rig.legLMesh) rig.legLMesh.visible = !hideFullBody;
        if (rig.legRMesh) rig.legRMesh.visible = !hideFullBody;
        if (rig.armLMesh) rig.armLMesh.visible = !hideFullBody;
        if (rig.armRMesh) rig.armRMesh.visible = !hideFullBody;
        if (rig.fpArmLMesh) rig.fpArmLMesh.visible = hideFullBody;
        if (rig.fpArmRMesh) rig.fpArmRMesh.visible = hideFullBody;
    }

    function resetRecoilState() {
        gunBobX = 0;
        gunBobY = 0;
        gunRecoil = 0;
        palmRecoil = 0;
        cameraKickPitch = 0;
        cameraKickYaw = 0;
        cameraKickRoll = 0;
    }

    function applyUnifiedGunOffsets(dt) {
        if (!avatarRigApi || !avatarRigApi.rig) return;
        var rig = avatarRigApi.rig;
        if (!rig.gun) return;

        var targetBobX = 0;
        var targetBobY = 0;
        var bobBlend = Math.min(1, dt * 12);
        gunBobX += (targetBobX - gunBobX) * bobBlend;
        gunBobY += (targetBobY - gunBobY) * bobBlend;

        var recoilBlend = Math.min(1, dt * 18);
        gunRecoil += (0 - gunRecoil) * recoilBlend;
        palmRecoil += (0 - palmRecoil) * recoilBlend;

        var cameraKickPitchBlend = Math.min(1, dt * 14);
        var cameraKickYawBlend = Math.min(1, dt * 16);
        var cameraKickRollBlend = Math.min(1, dt * 12);
        cameraKickPitch += (0 - cameraKickPitch) * cameraKickPitchBlend;
        cameraKickYaw += (0 - cameraKickYaw) * cameraKickYawBlend;
        cameraKickRoll += (0 - cameraKickRoll) * cameraKickRollBlend;

        rig.gun.position.x += gunBobX;
        rig.gun.position.y += gunBobY;
        rig.gun.position.z += gunRecoil;
        if (rig.palmRight) {
            rig.palmRight.rotation.x += palmRecoil;
        } else if (rig.palmLeft) {
            rig.palmLeft.rotation.x += palmRecoil;
        }
    }

    function updateAvatarAnimation(dt, speed) {
        if (avatarRigApi && avatarRigApi.updateLocomotion) {
            var speedNorm = Math.max(0, Math.min(1.4, speed / RUN_SPEED));
            avatarRigApi.updateAimPitch(pitch + (cameraKickPitch * 0.35));
            avatarRigApi.updateLocomotion(speedNorm, sprinting, dt, !isGrounded, {
                hooked: isHookPulled(),
                choked: isChoked(),
                startedAt: statusState.chokeStartedAt || 0,
                adsActive: isAdsActive(),
                movingForward: !!keys.forward,
                movingBackward: !!keys.backward,
                movingLeft: !!keys.left,
                movingRight: !!keys.right
            });
            if (avatarRigApi.applyChokeGripPose) avatarRigApi.applyChokeGripPose(dt);
        }
    }

    function getWorldBounds() {
        return globalThis.__MAYHEM_RUNTIME.GameWorld.getBounds();
    }

    function getDefaultSpawnPoint() {
        var bounds = getWorldBounds();
        var centerX = (typeof bounds.centerX === 'number')
            ? bounds.centerX
            : ((bounds.min + bounds.max) * 0.5);
        var centerZ = (typeof bounds.centerZ === 'number')
            ? bounds.centerZ
            : ((bounds.min + bounds.max) * 0.5);
        var minZ = (typeof bounds.minZ === 'number') ? bounds.minZ : bounds.min;
        var maxZ = (typeof bounds.maxZ === 'number') ? bounds.maxZ : bounds.max;
        var z = Math.min(maxZ - 4, centerZ + Math.max(6, (maxZ - minZ) * 0.34));
        return { x: centerX, z: z };
    }

    function getSpawnThreatPoints() {
        var points = [];
        if (globalThis.__MAYHEM_RUNTIME.GameEnemy && globalThis.__MAYHEM_RUNTIME.GameEnemy.getLockTargets) {
            var localTargets = globalThis.__MAYHEM_RUNTIME.GameEnemy.getLockTargets() || [];
            for (var i = 0; i < localTargets.length; i++) {
                var localTarget = localTargets[i];
                if (!localTarget || !localTarget.worldPos) continue;
                points.push({
                    x: Number(localTarget.worldPos.x || 0),
                    z: Number(localTarget.worldPos.z || 0)
                });
            }
        }
        if (globalThis.__MAYHEM_RUNTIME.GameNet && globalThis.__MAYHEM_RUNTIME.GameNet.getLockTargets) {
            var netTargets = globalThis.__MAYHEM_RUNTIME.GameNet.getLockTargets() || [];
            for (var n = 0; n < netTargets.length; n++) {
                var netTarget = netTargets[n];
                if (!netTarget || !netTarget.worldPos) continue;
                points.push({
                    x: Number(netTarget.worldPos.x || 0),
                    z: Number(netTarget.worldPos.z || 0)
                });
            }
        }
        return points;
    }

    function getCollisionBoxes() {
        if (!globalThis.__MAYHEM_RUNTIME.GameWorld || !globalThis.__MAYHEM_RUNTIME.GameWorld.getCollidables) return [];

        var meshes = globalThis.__MAYHEM_RUNTIME.GameWorld.getCollidables();
        if (!meshes || meshes.length === 0) return [];

        var boxes = [];
        for (var i = 0; i < meshes.length; i++) {
            var mesh = meshes[i];
            if (!mesh) continue;
            if (!mesh.userData) mesh.userData = {};

            var box = mesh.userData.collisionBox;
            if (!box) {
                mesh.updateMatrixWorld(true);
                box = new THREE.Box3().setFromObject(mesh);
                mesh.userData.collisionBox = box;
            }
            boxes.push(box);
        }
        return boxes;
    }

    function getGroundHeightAt(x, z) {
        if (globalThis.__MAYHEM_RUNTIME.GameWorld && globalThis.__MAYHEM_RUNTIME.GameWorld.getGroundHeightAt) {
            return globalThis.__MAYHEM_RUNTIME.GameWorld.getGroundHeightAt(x, z);
        }
        return 0;
    }

    function intersectsXZ(x, z, radius, box) {
        var closestX = Math.max(box.min.x, Math.min(x, box.max.x));
        var closestZ = Math.max(box.min.z, Math.min(z, box.max.z));
        var dx = x - closestX;
        var dz = z - closestZ;
        return ((dx * dx + dz * dz) < (radius * radius));
    }

    function isBlockedAt(nextX, nextZ, feetY) {
        var boxes = getCollisionBoxes();
        if (boxes.length === 0) return false;

        var headY = feetY + PLAYER_HEIGHT;
        for (var i = 0; i < boxes.length; i++) {
            var box = boxes[i];
            if (headY <= box.min.y + EPSILON || feetY >= box.max.y - EPSILON) continue;
            if (intersectsXZ(nextX, nextZ, PLAYER_RADIUS, box)) return true;
        }
        return false;
    }

    function findLandingSurfaceY(x, z, currentFeetY, nextFeetY) {
        var boxes = getCollisionBoxes();
        var baseGroundY = getGroundHeightAt(x, z);
        if (boxes.length === 0) return baseGroundY;

        var best = null;
        for (var i = 0; i < boxes.length; i++) {
            var box = boxes[i];
            var top = box.max.y;
            if (!intersectsXZ(x, z, PLAYER_RADIUS * 0.9, box)) continue;
            if (top <= currentFeetY + EPSILON && top >= nextFeetY - EPSILON) {
                if (best === null || top > best) best = top;
            }
        }
        if (best === null || best < baseGroundY) return baseGroundY;
        return best;
    }

    function findCeilingY(x, z, currentHeadY, nextHeadY) {
        var boxes = getCollisionBoxes();
        if (boxes.length === 0) return null;

        var best = null;
        for (var i = 0; i < boxes.length; i++) {
            var box = boxes[i];
            var bottom = box.min.y;
            if (!intersectsXZ(x, z, PLAYER_RADIUS * 0.9, box)) continue;
            if (bottom >= currentHeadY - EPSILON && bottom <= nextHeadY + EPSILON) {
                if (best === null || bottom < best) best = bottom;
            }
        }
        return best;
    }

    function updateAvatarPose() {
        if (!avatarGroup) return;
        avatarGroup.position.set(playerX, posY - EYE_HEIGHT + activeChokeLift(), playerZ);
        avatarGroup.rotation.y = yaw;
        syncHitboxPositions();
    }

    function syncHitboxPositions() {
        var feetY = posY - EYE_HEIGHT + activeChokeLift();
        if (actorVisual && actorVisual.syncHitboxes) {
            actorVisual.syncHitboxes({ x: playerX, y: feetY, z: playerZ });
        }
    }

    function setAliveVisual(active) {
        avatarAliveVisible = !!active;
        syncAvatarVisibility(isFirstPersonCameraMode(effectiveCameraMode()), isSniperScopeWeapon());
        if (bodyHitbox) bodyHitbox.visible = !!active && hitboxVisible;
        if (headHitbox) headHitbox.visible = !!active && hitboxVisible;
    }

    function ensureHitboxes() {
        if (!sceneRef || actorVisual) return;
        var actorFactory = globalThis.__MAYHEM_RUNTIME.GameActorVisualFactory || null;
        if (!actorFactory || !actorFactory.create) return;
        actorVisual = actorFactory.create({
            kind: 'player',
            ownerType: 'player',
            bodyColor: 0x4a7fc1,
            skinColor: 0xd2a77d,
            legColor: 0x2f2f2f,
            weaponId: currentWeaponId,
            targetId: 'self',
            hitboxOpacity: hitboxVisible ? 0.3 : 0
        });
        avatarGroup = actorVisual.visual;
        avatarRigApi = actorVisual.rigApi;
        avatarRig = avatarGroup && avatarGroup.userData ? avatarGroup.userData.rig || null : null;
        bodyHitbox = actorVisual.bodyHitbox;
        headHitbox = actorVisual.headHitbox;
        sceneRef.add(avatarGroup);
        if (bodyHitbox) sceneRef.add(bodyHitbox);
        if (headHitbox) sceneRef.add(headHitbox);
        syncHitboxPositions();
    }

    function setHitboxVisibility(visible) {
        hitboxVisible = !!visible;
        if (actorVisual && actorVisual.setHitboxVisibility) {
            actorVisual.setHitboxVisibility(hitboxVisible);
        }
        return hitboxVisible;
    }

    function setHealFlash(active) {
        if (!avatarGroup || !avatarGroup.userData || !avatarGroup.userData.bodyParts) return;
        var parts = avatarGroup.userData.bodyParts;
        var originalColors = avatarGroup.userData.originalPartColors || [];
        for (var i = 0; i < parts.length; i++) {
            var part = parts[i];
            if (!part || !part.material || !part.material.color) continue;
            if (active) {
                part.material.color.setHex(0x6dff9a);
                if (part.material.emissive) part.material.emissive.setHex(0x163d18);
            } else {
                part.material.color.setHex(typeof originalColors[i] === 'number' ? originalColors[i] : 0xffffff);
                if (part.material.emissive) part.material.emissive.setHex(0x000000);
            }
        }
    }

    function setSpawnShieldVisual(active) {
        if (!avatarGroup) return;
        avatarGroup.traverse(function (node) {
            if (!node || !node.isMesh || !node.material) return;
            var mat = node.material;
            if (mat.__spawnShieldBaseOpacity === undefined) {
                mat.__spawnShieldBaseOpacity = (typeof mat.opacity === 'number') ? mat.opacity : 1;
                mat.__spawnShieldBaseTransparent = !!mat.transparent;
            }
            if (active) {
                mat.transparent = true;
                mat.opacity = Math.min(mat.__spawnShieldBaseOpacity, 0.42);
            } else {
                mat.opacity = mat.__spawnShieldBaseOpacity;
                mat.transparent = mat.__spawnShieldBaseTransparent;
            }
            mat.needsUpdate = true;
        });
    }

    function updateCameraFromPlayer(dt) {
        if (!camera) return;

        var firstPersonMode = isFirstPersonCameraMode(effectiveCameraMode());
        var renderYaw = yaw + cameraKickYaw;
        var renderPitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch + cameraKickPitch));
        var cosPitch = Math.cos(renderPitch);
        var forwardX = -Math.sin(renderYaw) * cosPitch;
        var forwardY = Math.sin(renderPitch);
        var forwardZ = -Math.cos(renderYaw) * cosPitch;
        var rightX = Math.cos(renderYaw);
        var rightZ = -Math.sin(renderYaw);

        var chokeLift = activeChokeLift();
        var adsActive = isAdsActive();
        var sniperMode = isSniperScopeWeapon();
        var targetScopeBlend = adsActive ? 1 : 0;
        var blendSpeed = sniperMode ? SNIPER_SCOPE_BLEND_SPEED : ADS_BLEND_SPEED;
        scopeBlend += (targetScopeBlend - scopeBlend) * Math.min(1, dt * blendSpeed);
        if (Math.abs(scopeBlend) < 0.001) scopeBlend = 0;
        if (Math.abs(1 - scopeBlend) < 0.001) scopeBlend = 1;

        syncAvatarVisibility(firstPersonMode, sniperMode);
        updateAvatarPose();

        viewTarget.set(playerX + forwardX * 20, posY + forwardY * 20, playerZ + forwardZ * 20);
        viewTarget.y += chokeLift;
        if (firstPersonMode) {
            if (avatarRigApi && avatarRigApi.getEyeWorldPosition) {
                avatarRigApi.getEyeWorldPosition(eyeWorld);
                viewOrigin.copy(eyeWorld);
            } else {
                viewOrigin.set(playerX, posY + chokeLift, playerZ);
            }
            viewDesired.copy(viewOrigin);
        } else {
            viewOrigin.set(playerX, posY + 0.3 + chokeLift, playerZ);
            viewDesired.set(
                playerX + (rightX * CAMERA_SHOULDER) - (forwardX * CAMERA_DIST),
                posY + THIRD_HEIGHT + chokeLift,
                playerZ + (rightZ * CAMERA_SHOULDER) - (forwardZ * CAMERA_DIST)
            );
            adsDesired.set(
                playerX + (rightX * (sniperMode ? SNIPER_SCOPE_SHOULDER : ADS_SHOULDER)) - (forwardX * (sniperMode ? SNIPER_SCOPE_DIST : ADS_DIST)),
                posY + (sniperMode ? SNIPER_SCOPE_HEIGHT : ADS_HEIGHT) + chokeLift,
                playerZ + (rightZ * (sniperMode ? SNIPER_SCOPE_SHOULDER : ADS_SHOULDER)) - (forwardZ * (sniperMode ? SNIPER_SCOPE_DIST : ADS_DIST))
            );
            viewDesired.lerp(adsDesired, scopeBlend);

            var worldMeshes = globalThis.__MAYHEM_RUNTIME.GameWorld && globalThis.__MAYHEM_RUNTIME.GameWorld.getCollidables ? globalThis.__MAYHEM_RUNTIME.GameWorld.getCollidables() : [];
            if (worldMeshes && worldMeshes.length > 0) {
                viewDir.copy(viewDesired).sub(viewOrigin);
                var dist = viewDir.length();
                if (dist > 0.001) {
                    viewDir.divideScalar(dist);
                    viewRay.set(viewOrigin, viewDir);
                    viewRay.far = dist;
                    var hits = viewRay.intersectObjects(worldMeshes, false);
                    if (hits.length > 0) {
                        var safeDist = Math.max(0.8, hits[0].distance - 0.2);
                        viewDesired.copy(viewOrigin).addScaledVector(viewDir, safeDist);
                    }
                }
            }
        }

        if (!thirdCameraInitialized) {
            camera.position.copy(viewDesired);
            thirdCameraInitialized = true;
        } else {
            camera.position.lerp(viewDesired, Math.min(1, dt * (firstPersonMode ? FIRST_PERSON_SMOOTH : THIRD_SMOOTH)));
        }
        var scopedFov = sniperMode ? SNIPER_SCOPE_FOV : ADS_FOV;
        var targetFov = CAMERA_FOV + ((scopedFov - CAMERA_FOV) * scopeBlend);
        camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 16);
        camera.updateProjectionMatrix();
        camera.lookAt(viewTarget);
        camera.rotation.z += cameraKickRoll;
    }

    function setupInput() {
        document.addEventListener('keydown', function (e) {
            switch (e.code) {
                case 'KeyW': keys.forward = true; break;
                case 'KeyA': keys.left = true; break;
                case 'KeyS': keys.backward = true; break;
                case 'KeyD': keys.right = true; break;
                case 'KeyE':
                    keys.sprint = true;
                    break;
                case 'ShiftLeft':
                case 'ShiftRight':
                    if (!e.repeat) {
                        if (hasInputCapture()) {
                            e.preventDefault();
                            toggleAds();
                        }
                    }
                    break;
                case 'Space':
                    keys.jump = true;
                    e.preventDefault();
                    break;
            }
        });

        document.addEventListener('keyup', function (e) {
            switch (e.code) {
                case 'KeyW': keys.forward = false; break;
                case 'KeyA': keys.left = false; break;
                case 'KeyS': keys.backward = false; break;
                case 'KeyD': keys.right = false; break;
                case 'KeyE':
                    keys.sprint = false;
                    break;
                case 'ShiftLeft':
                case 'ShiftRight':
                    break;
                case 'Space': keys.jump = false; break;
            }
        });

        document.addEventListener('mousemove', function (e) {
            if (!hasInputCapture()) return;
            var sensitivityMult = isSniperScopeWeapon() ? SNIPER_SCOPE_SENSITIVITY_MULT : ADS_SENSITIVITY_MULT;
            var sensitivity = MOUSE_SENSITIVITY * (1 - (scopeBlend * (1 - sensitivityMult)));
            yaw -= (e.movementX || 0) * sensitivity;
            pitch -= (e.movementY || 0) * sensitivity;
            pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch));
        });

        document.addEventListener('mousedown', function (e) {
            if (e.button !== 2) return;
            if (!hasInputCapture()) return;
            e.preventDefault();
            toggleAds();
        });

        document.addEventListener('contextmenu', function (e) {
            if (!hasInputCapture()) return;
            e.preventDefault();
        });

        window.addEventListener('resize', function () {
            if (camera) {
                camera.aspect = window.innerWidth / window.innerHeight;
                camera.updateProjectionMatrix();
            }
        });

        window.addEventListener('blur', function () {
            scopeHeld = false;
        });
        document.addEventListener('pointerlockchange', function () {
            if (!hasInputCapture()) scopeHeld = false;
        });
    }

    function resetVerticalState(feetY) {
        velocityY = 0;
        posY = feetY + EYE_HEIGHT;
        isGrounded = true;
        jumpHoldTimer = 0;
    }

    function setSpawnPosition(x, z, feetY) {
        if (!camera) return false;
        feetY = (typeof feetY === 'number') ? feetY : 0;
        playerX = x;
        playerZ = z;
        resetVerticalState(feetY);
        resetRecoilState();
        updateAvatarPose();
        updateCameraFromPlayer(1);
        return true;
    }

    function applyAuthoritativeMotion(state) {
        if (!camera || !state) return false;
        var x = Number(state.x);
        var z = Number(state.z);
        if (!Number.isFinite(x) || !Number.isFinite(z)) return false;

        playerX = x;
        playerZ = z;

        if (typeof state.y === 'number' && isFinite(state.y)) {
            posY = Number(state.y);
        } else {
            posY = getGroundHeightAt(playerX, playerZ) + EYE_HEIGHT;
        }
        velocityY = 0;
        isGrounded = true;
        jumpHoldTimer = 0;

        if (typeof state.yaw === 'number' && isFinite(state.yaw)) {
            yaw = Number(state.yaw);
        }
        if (typeof state.pitch === 'number' && isFinite(state.pitch)) {
            pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, Number(state.pitch)));
        }

        resetRecoilState();
        updateAvatarPose();
        updateCameraFromPlayer(1 / 60);
        return true;
    }

    function applyMotionState(state, dt) {
        if (!state) return false;
        playerX = Number(state.x || 0);
        playerZ = Number(state.z || 0);
        posY = Number(state.y || EYE_HEIGHT);
        yaw = (typeof state.yaw === 'number' && isFinite(state.yaw)) ? Number(state.yaw) : yaw;
        pitch = (typeof state.pitch === 'number' && isFinite(state.pitch))
            ? Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, Number(state.pitch)))
            : pitch;
        velocityY = Number(state.velocityY || 0);
        isGrounded = !!state.isGrounded;
        jumpHoldTimer = Number(state.jumpHoldTimer || 0);
        jumpPressedLastFrame = !!state.jumpHeldLast;
        lastMoveSpeedNorm = Number(state.moveSpeedNorm || 0);
        sprinting = !!state.sprinting;
        updateAvatarPose();
        updateCameraFromPlayer(Math.max(1 / 240, Number(dt || (1 / 60))));
        return true;
    }

    function replayAuthoritativeMotion(state, pendingInputs, options) {
        if (!camera || !state) return false;
        var helper = movementHelper();
        var reconcile = reconciliationHelper();
        if (!helper || !helper.stepAuthoritativeMovement || !reconcile || !reconcile.replayMotionState) {
            return applyAuthoritativeMotion(state);
        }

        var opts = options || {};
        var ackSeq = Math.max(0, Number(opts.lastAckedSeq || 0));
        if (ackSeq > 0) lastReplayAckSeq = ackSeq;
        var motionState = reconcile.replayMotionState(state, Array.isArray(pendingInputs) ? pendingInputs.slice() : [], {
            stepMovement: helper.stepAuthoritativeMovement,
            bounds: getWorldBounds(),
            collisionBoxes: getCollisionBoxes(),
            getGroundHeightAt: getGroundHeightAt,
            movementLocked: function () { return isMovementLocked(); },
            eyeHeight: EYE_HEIGHT,
            playerHeight: PLAYER_HEIGHT,
            playerRadius: PLAYER_RADIUS,
            epsilon: EPSILON,
            fallbackYaw: yaw,
            fallbackPitch: pitch
        });
        return applyMotionState(motionState, opts.dt);
    }

    function hasMovementIntentInput() {
        return !!(keys.forward || keys.backward || keys.left || keys.right || keys.jump || keys.sprint);
    }

    function reconcileAuthoritativeMotion(state, options) {
        if (!camera || !state) return false;
        var x = Number(state.x);
        var z = Number(state.z);
        if (!Number.isFinite(x) || !Number.isFinite(z)) return false;

        var opts = options || {};
        var dt = Math.max(1 / 240, Number(opts.dt || (1 / 60)));
        var dx = x - playerX;
        var dz = z - playerZ;
        var horizontalDistSq = (dx * dx) + (dz * dz);
        var hardSnapDistance = Number(opts.hardSnapDistance || 1.35);
        var softCorrectDistance = Number(opts.softCorrectDistance || 0.2);
        var pendingInputCount = Math.max(0, Number(opts.pendingInputCount || 0));
        var ackDrift = Math.max(0, Number(opts.lastSentSeq || 0) - Number(opts.lastAckedSeq || 0));
        var movingIntent = hasMovementIntentInput() && !isMovementLocked();
        var canCorrectWhileMoving = pendingInputCount <= 1 && ackDrift <= 1;
        var pendingInputs = Array.isArray(opts.pendingInputs) ? opts.pendingInputs : [];
        var reconcile = reconciliationHelper();

        if (reconcile && reconcile.shouldReplayAuthoritativeCorrection && reconcile.shouldReplayAuthoritativeCorrection({
            pendingInputCount: pendingInputCount,
            lastAckedSeq: Number(opts.lastAckedSeq || 0),
            lastReplayAckSeq: lastReplayAckSeq
        })) {
            return replayAuthoritativeMotion(state, pendingInputs, opts);
        }

        if (opts.force || horizontalDistSq >= (hardSnapDistance * hardSnapDistance)) {
            return applyAuthoritativeMotion(state);
        }

        if ((movingIntent && !canCorrectWhileMoving) || horizontalDistSq < (softCorrectDistance * softCorrectDistance)) {
            return false;
        }

        var blend = Math.min(1, dt * 8);
        playerX += dx * blend;
        playerZ += dz * blend;

        if (horizontalDistSq < 0.0004) {
            playerX = x;
            playerZ = z;
        }

        updateAvatarPose();
        updateCameraFromPlayer(dt);
        return true;
    }

    GamePlayer.init = function (scene) {
        sceneRef = scene;
        var bounds = getWorldBounds();
        var worldSpan = (typeof bounds.size === 'number')
            ? bounds.size
            : Math.max(
                (typeof bounds.maxX === 'number' ? bounds.maxX : bounds.max) - (typeof bounds.minX === 'number' ? bounds.minX : bounds.min),
                (typeof bounds.maxZ === 'number' ? bounds.maxZ : bounds.max) - (typeof bounds.minZ === 'number' ? bounds.minZ : bounds.min)
            );
        var cameraFar = Math.max(120, worldSpan * 2.2);
        camera = new THREE.PerspectiveCamera(CAMERA_FOV, window.innerWidth / window.innerHeight, 0.1, cameraFar);
        camera.rotation.order = 'YXZ';
        scene.add(camera);

        var spawn = (globalThis.__MAYHEM_RUNTIME.GameWorld && globalThis.__MAYHEM_RUNTIME.GameWorld.getRandomSpawnPoint)
            ? globalThis.__MAYHEM_RUNTIME.GameWorld.getRandomSpawnPoint(
                globalThis.__MAYHEM_RUNTIME.GameWorld.getSpawnPadding ? globalThis.__MAYHEM_RUNTIME.GameWorld.getSpawnPadding() : 8
            )
            : getDefaultSpawnPoint();
        playerX = spawn.x;
        playerZ = spawn.z;
        posY = EYE_HEIGHT;

        ensureHitboxes();

        resetRecoilState();
        applyAvatarWeaponPose();
        setupInput();
        updateAvatarPose();
        updateCameraFromPlayer(1);

        return camera;
    };

    GamePlayer.update = function (dt) {
        if (!camera) return;
        if (!hasInputCapture()) return;
        clearExpiredStatusState(nowMs());

        var jumpJustPressed = keys.jump && !jumpPressedLastFrame;
        var jumpJustReleased = !keys.jump && jumpPressedLastFrame;
        jumpPressedLastFrame = keys.jump;
        var sprintJustPressed = keys.sprint && !sprintPressedLastFrame;
        var sprintJustReleased = !keys.sprint && sprintPressedLastFrame;
        sprintPressedLastFrame = keys.sprint;

        var forwardX = -Math.sin(yaw);
        var forwardZ = -Math.cos(yaw);
        var rightX = Math.cos(yaw);
        var rightZ = -Math.sin(yaw);
        var movementLocked = isMovementLocked();
        var adsActive = isAdsActive();
        if (movementLocked) {
            sprintQueued = false;
            keys.sprint = false;
        }
        if (sprintJustReleased) {
            sprintQueued = false;
        } else if (!movementLocked && sprintJustPressed && isGrounded) {
            sprintQueued = true;
        }
        var sprintAllowed = !movementLocked && !adsActive && keys.sprint && sprintQueued;
        var speedCap = adsActive ? (JOG_SPEED * ADS_MOVE_MULT) : (sprintAllowed ? RUN_SPEED : JOG_SPEED);

        var moveX = 0;
        var moveZ = 0;
        if (!movementLocked) {
            if (keys.forward)  { moveX += forwardX; moveZ += forwardZ; }
            if (keys.backward) { moveX -= forwardX; moveZ -= forwardZ; }
            if (keys.left)     { moveX -= rightX;   moveZ -= rightZ; }
            if (keys.right)    { moveX += rightX;   moveZ += rightZ; }
        }

        var length = Math.sqrt(moveX * moveX + moveZ * moveZ);
        if (length > 0) {
            moveX = (moveX / length) * speedCap * dt;
            moveZ = (moveZ / length) * speedCap * dt;
        } else {
            moveX = 0;
            moveZ = 0;
        }

        var bounds = getWorldBounds();
        var currentFeetY = posY - EYE_HEIGHT;
        var minBoundX = (typeof bounds.minX === 'number' ? bounds.minX : bounds.min) + PLAYER_RADIUS;
        var maxBoundX = (typeof bounds.maxX === 'number' ? bounds.maxX : bounds.max) - PLAYER_RADIUS;
        var minBoundZ = (typeof bounds.minZ === 'number' ? bounds.minZ : bounds.min) + PLAYER_RADIUS;
        var maxBoundZ = (typeof bounds.maxZ === 'number' ? bounds.maxZ : bounds.max) - PLAYER_RADIUS;
        var startX = playerX;
        var startZ = playerZ;

        var nextX = playerX + moveX;
        nextX = Math.max(minBoundX, Math.min(maxBoundX, nextX));
        if (!isBlockedAt(nextX, playerZ, currentFeetY)) playerX = nextX;

        var nextZ = playerZ + moveZ;
        nextZ = Math.max(minBoundZ, Math.min(maxBoundZ, nextZ));
        if (!isBlockedAt(playerX, nextZ, currentFeetY)) playerZ = nextZ;

        var movedX = playerX - startX;
        var movedZ = playerZ - startZ;
        var horizontalSpeed = Math.sqrt(movedX * movedX + movedZ * movedZ) / Math.max(dt, 0.0001);
        lastMoveSpeedNorm = Math.max(0, Math.min(1.4, horizontalSpeed / RUN_SPEED));
        isMoving = horizontalSpeed > 0.06;
        sprinting = sprintAllowed && isMoving;

        if (jumpJustPressed && adsActive) {
            scopeHeld = false;
            jumpJustPressed = false;
        }

        if (!movementLocked && jumpJustPressed && isGrounded) {
            velocityY = JUMP_VELOCITY;
            isGrounded = false;
            jumpHoldTimer = MAX_JUMP_HOLD;
        }
        if (!movementLocked && jumpJustReleased && velocityY > 0) {
            velocityY *= JUMP_RELEASE_MULT;
            jumpHoldTimer = 0;
        }
        if (!movementLocked && keys.jump && jumpHoldTimer > 0 && velocityY > 0) {
            velocityY += JUMP_HOLD_ACCEL * dt;
            jumpHoldTimer -= dt;
            if (jumpHoldTimer < 0) jumpHoldTimer = 0;
        }

        velocityY -= GRAVITY * dt;
        var nextFeetY = currentFeetY + (velocityY * dt);

        if (velocityY <= 0) {
            var landingY = findLandingSurfaceY(playerX, playerZ, currentFeetY, nextFeetY);
            if (nextFeetY <= landingY + EPSILON) {
                nextFeetY = landingY;
                velocityY = 0;
                isGrounded = true;
                jumpHoldTimer = 0;
            } else {
                isGrounded = false;
            }
        } else {
            var currentHeadY = currentFeetY + PLAYER_HEIGHT;
            var nextHeadY = nextFeetY + PLAYER_HEIGHT;
            var ceilingY = findCeilingY(playerX, playerZ, currentHeadY, nextHeadY);
            if (ceilingY !== null && nextHeadY >= ceilingY - EPSILON) {
                nextFeetY = ceilingY - PLAYER_HEIGHT;
                velocityY = 0;
                jumpHoldTimer = 0;
            }
            isGrounded = false;
        }

        var baseGround = getGroundHeightAt(playerX, playerZ);
        if (nextFeetY < baseGround) {
            nextFeetY = baseGround;
            velocityY = 0;
            isGrounded = true;
            jumpHoldTimer = 0;
        }

        posY = nextFeetY + EYE_HEIGHT;
        updateAvatarPose();
        updateAvatarAnimation(dt, horizontalSpeed);
        applyUnifiedGunOffsets(dt);
        updateCameraFromPlayer(dt);
    };

    GamePlayer.fireAnimation = function () {
        if (!avatarRigApi || !avatarRigApi.rig || !avatarRigApi.rig.gun) return;

        // Recoil layering here follows the same high-level MIT-licensed pattern
        // used in HYTOPIA's examples: camera-attached viewmodel + per-shot feedback.
        // This implementation is local to this project and not a verbatim copy.
        var recoilByWeapon = {
            pistol: { z: -0.04, x: -0.08, pitch: 0.014, yaw: 0.007, roll: 0.005, armR: 0.2, armL: 0.08, muzzleMs: 60 },
            rifle: { z: -0.05, x: -0.09, pitch: 0.018, yaw: 0.009, roll: 0.006, armR: 0.22, armL: 0.1, muzzleMs: 60 },
            machinegun: { z: -0.024, x: -0.045, pitch: 0.009, yaw: 0.006, roll: 0.004, armR: 0.14, armL: 0.06, muzzleMs: 55 },
            shotgun: { z: -0.09, x: -0.16, pitch: 0.03, yaw: 0.012, roll: 0.008, armR: 0.26, armL: 0.12, muzzleMs: 70 },
            sniper: { z: -0.12, x: -0.2, pitch: 0.04, yaw: 0.01, roll: 0.007, armR: 0.3, armL: 0.12, muzzleMs: 90 },
        };
        var recoil = recoilByWeapon[currentWeaponId] || recoilByWeapon.rifle;
        var scopeMultiplier = 1 - (scopeBlend * 0.2);
        var yawKick = (Math.random() - 0.5) * recoil.yaw * scopeMultiplier;
        var rollKick = -yawKick * (recoil.roll / Math.max(recoil.yaw, 0.0001));

        gunRecoil += recoil.z * scopeMultiplier;
        palmRecoil += recoil.x * scopeMultiplier;
        cameraKickPitch += recoil.pitch * scopeMultiplier;
        cameraKickYaw += yawKick;
        cameraKickRoll += rollKick;

        if (avatarRigApi.setMuzzleVisible) {
            avatarRigApi.setMuzzleVisible(true);
            setTimeout(function () {
                avatarRigApi.setMuzzleVisible(false);
            }, recoil.muzzleMs);
        }
        if (avatarRigApi.triggerFirePose) {
            avatarRigApi.triggerFirePose(recoil.muzzleMs / 1000, 0.9 + (Math.abs(recoil.z) * 4));
        }
        if (avatarRigApi.rig) {
            if (avatarRigApi.rig.armR) avatarRigApi.rig.armR.rotation.x += recoil.x * recoil.armR;
            if (avatarRigApi.rig.armL) avatarRigApi.rig.armL.rotation.x += recoil.x * recoil.armL;
            if (avatarRigApi.rig.fpArmR) avatarRigApi.rig.fpArmR.rotation.x += recoil.x * recoil.armR;
            if (avatarRigApi.rig.fpArmL) avatarRigApi.rig.fpArmL.rotation.x += recoil.x * recoil.armL;
        }
    };

    GamePlayer.isExperimentalCameraView = function () {
        return true;
    };

    GamePlayer.setAuthoritativeCameraMode = function (mode) {
        authoritativeCameraMode = normalizeCameraMode(mode);
        hasAuthoritativeCameraMode = true;
        return authoritativeCameraMode;
    };

    GamePlayer.setCameraMode = function (mode) {
        requestedCameraMode = normalizeCameraMode(mode);
        if (!(globalThis.__MAYHEM_RUNTIME.GameNet && globalThis.__MAYHEM_RUNTIME.GameNet.isActive && globalThis.__MAYHEM_RUNTIME.GameNet.isActive())) {
            authoritativeCameraMode = requestedCameraMode;
            hasAuthoritativeCameraMode = true;
        }
        return {
            requested: requestedCameraMode,
            effective: effectiveCameraMode()
        };
    };

    GamePlayer.toggleCameraMode = function () {
        var nextMode = isFirstPersonCameraMode(effectiveCameraMode()) ? 'third' : 'first';
        return GamePlayer.setCameraMode(nextMode);
    };

    GamePlayer.getCameraMode = function () {
        return {
            requested: requestedCameraMode,
            authoritative: authoritativeCameraMode,
            effective: effectiveCameraMode()
        };
    };

    GamePlayer.setWeaponModel = function (weaponId) {
        currentWeaponId = weaponId || 'rifle';
        scopeHeld = false;
        resetRecoilState();
        applyAvatarWeaponPose();
        return true;
    };

    GamePlayer.getCamera = function () {
        return camera;
    };

    GamePlayer.getPosition = function () {
        return new THREE.Vector3(playerX, posY, playerZ);
    };

    GamePlayer.getRotation = function () {
        return { yaw: yaw, pitch: pitch };
    };

    GamePlayer.getMuzzleWorldPosition = function () {
        if (avatarRigApi && avatarRigApi.getMuzzleWorldPosition) {
            return avatarRigApi.getMuzzleWorldPosition();
        }
        if (!camera) return null;
        camera.getWorldDirection(plasmaForwardDir);
        return camera.position.clone().addScaledVector(plasmaForwardDir, 0.65);
    };

    GamePlayer.getCoreWorldPosition = function () {
        if (avatarRigApi && avatarRigApi.getCoreWorldPosition) {
            return avatarRigApi.getCoreWorldPosition();
        }
        if (!camera) return null;
        return camera.position.clone().setY(camera.position.y - 0.6);
    };

    GamePlayer.getThrowableOriginWorldPosition = function () {
        if (avatarRigApi && avatarRigApi.getThrowableOriginWorldPosition) {
            return avatarRigApi.getThrowableOriginWorldPosition();
        }
        if (!camera) return null;
        camera.getWorldDirection(plasmaForwardDir);
        throwableRightDir.set(1, 0, 0).applyQuaternion(camera.quaternion);
        return camera.position.clone()
            .addScaledVector(plasmaForwardDir, 0.55)
            .addScaledVector(throwableRightDir, -0.34)
            .setY(camera.position.y - 0.58);
    };

    GamePlayer.getEquippedWeaponId = function () {
        return currentWeaponId;
    };

    GamePlayer.getScopeState = function () {
        return {
            weaponId: currentWeaponId,
            active: isAdsActive() && scopeBlend > 0.02,
            scoped: isSniperScopeWeapon() && scopeBlend > 0.7,
            sniper: isSniperScopeWeapon(),
            blend: scopeBlend
        };
    };

    GamePlayer.getAdsState = function () {
        return {
            weaponId: currentWeaponId,
            active: isAdsActive(),
            blend: scopeBlend,
            sniper: isSniperScopeWeapon()
        };
    };

    GamePlayer.setAdsEnabled = function (enabled) {
        return setAdsEnabled(enabled);
    };

    GamePlayer.isSprinting = function () {
        return !!sprinting;
    };

    GamePlayer.getAnimNetState = function () {
        return {
            moveSpeedNorm: lastMoveSpeedNorm,
            sprinting: !!sprinting,
            aimPitch: pitch,
            equippedWeaponId: currentWeaponId
        };
    };

    GamePlayer.getNetworkInputState = function () {
        return {
            forward: !!keys.forward,
            backward: !!keys.backward,
            left: !!keys.left,
            right: !!keys.right,
            jump: !!keys.jump,
            sprint: !!keys.sprint,
            adsActive: !!isAdsActive(),
            cameraMode: requestedCameraMode
        };
    };

    GamePlayer.setLoadout = function (loadoutConfig) {
        if (!loadoutConfig || !Array.isArray(loadoutConfig.slots)) {
            return { slots: loadoutSlots.slice() };
        }

        var allowed = {};
        var hasAllowed = false;
        if (globalThis.__MAYHEM_RUNTIME.GameHitscan && globalThis.__MAYHEM_RUNTIME.GameHitscan.getAllWeaponIds) {
            var ids = globalThis.__MAYHEM_RUNTIME.GameHitscan.getAllWeaponIds();
            for (var n = 0; n < ids.length; n++) {
                allowed[ids[n]] = true;
                hasAllowed = true;
            }
        }

        var next = [];
        var seen = {};
        for (var i = 0; i < loadoutConfig.slots.length; i++) {
            var id = String(loadoutConfig.slots[i] || '');
            if (!id || seen[id]) continue;
            if (hasAllowed && !allowed[id]) continue;
            seen[id] = true;
            next.push(id);
        }
        if (next.length > 0) {
            loadoutSlots = next;
        }
        return { slots: loadoutSlots.slice() };
    };

    GamePlayer.getLoadout = function () {
        return { slots: loadoutSlots.slice() };
    };

    GamePlayer.setHitboxVisibility = function (visible) {
        ensureHitboxes();
        return setHitboxVisibility(visible);
    };

    GamePlayer.setStatusState = function (state) {
        applyStatusState({
            stunUntil: state && state.stunUntil ? Number(state.stunUntil || 0) : 0,
            hookPullUntil: state && state.hookPullUntil ? Number(state.hookPullUntil || 0) : 0,
            chokeStartedAt: state && state.chokeStartedAt ? Number(state.chokeStartedAt || 0) : 0,
            chokeUntil: state && state.chokeUntil ? Number(state.chokeUntil || 0) : 0,
            chokeLift: state && state.chokeLift ? Number(state.chokeLift || 0) : 0,
            spawnShieldUntil: state && state.spawnShieldUntil ? Number(state.spawnShieldUntil || 0) : 0
        });
    };

    GamePlayer.setChokeVictimState = function (state) {
        applyStatusState({
            chokeStartedAt: state && state.startedAt ? Number(state.startedAt || 0) : 0,
            chokeUntil: state && state.endsAt ? Number(state.endsAt || 0) : 0,
            chokeLift: state && state.lift ? Number(state.lift || 0) : 0
        });
    };

    GamePlayer.setAliveVisual = function (active) {
        setAliveVisual(active);
    };

    GamePlayer.setHealFlash = function (active) {
        setHealFlash(!!active);
    };

    GamePlayer.triggerChokeGripPose = function (duration) {
        if (!avatarRigApi || !avatarRigApi.triggerChokeGripPose) return false;
        avatarRigApi.triggerChokeGripPose(duration);
        return true;
    };

    GamePlayer.triggerThrowPose = function () {
        if (!avatarRigApi || !avatarRigApi.triggerThrowPose) return false;
        avatarRigApi.triggerThrowPose();
        return true;
    };

    GamePlayer.setSpawnShield = function (active) {
        applyStatusState({
            spawnShieldUntil: active ? nowMs() + 1000 : 0
        });
    };

    GamePlayer.setActionRestrictions = function (state) {
        applyStatusState({
            weaponUntil: state && state.weaponUntil ? Number(state.weaponUntil || 0) : 0,
            throwableUntil: state && state.throwableUntil ? Number(state.throwableUntil || 0) : 0,
            abilityUntil: state && state.abilityUntil ? Number(state.abilityUntil || 0) : 0
        });
    };

    GamePlayer.isStunned = function () {
        return isStunned();
    };

    GamePlayer.isHookPulled = function () {
        return isHookPulled();
    };

    GamePlayer.isChoked = function () {
        return isChoked();
    };

    GamePlayer.isSpawnShielded = function () {
        return isSpawnShielded();
    };

    GamePlayer.isMovementLocked = function () {
        return isMovementLocked();
    };

    GamePlayer.isActionLocked = function () {
        return isActionLocked();
    };

    GamePlayer.canUseWeapon = function () {
        return canUseWeapon();
    };

    GamePlayer.canUseThrowable = function () {
        return canUseThrowable();
    };

    GamePlayer.canUseAbility = function () {
        return canUseAbility();
    };

    GamePlayer.equipSlot = function (slotIndex) {
        var idx = Math.max(0, Math.floor(slotIndex || 0));
        if (idx >= loadoutSlots.length) return null;
        return loadoutSlots[idx];
    };

    GamePlayer.respawn = function (x, z) {
        if (!camera) return false;
        return setSpawnPosition(x, z, getGroundHeightAt(x, z));
    };

    GamePlayer.applyAuthoritativeMotion = function (state) {
        return applyAuthoritativeMotion(state);
    };

    GamePlayer.reconcileAuthoritativeMotion = function (state, options) {
        return reconcileAuthoritativeMotion(state, options);
    };

    GamePlayer.replayAuthoritativeMotion = function (state, pendingInputs, options) {
        return replayAuthoritativeMotion(state, pendingInputs, options);
    };

    GamePlayer.respawnRandom = function () {
        if (!camera) {
            var defaultSpawn = getDefaultSpawnPoint();
            return new THREE.Vector2(defaultSpawn.x, defaultSpawn.z);
        }

        var bounds = getWorldBounds();
        var spawnPadding = (globalThis.__MAYHEM_RUNTIME.GameWorld && globalThis.__MAYHEM_RUNTIME.GameWorld.getSpawnPadding)
            ? globalThis.__MAYHEM_RUNTIME.GameWorld.getSpawnPadding()
            : 4;
        var minX = (typeof bounds.minX === 'number' ? bounds.minX : bounds.min) + spawnPadding;
        var maxX = (typeof bounds.maxX === 'number' ? bounds.maxX : bounds.max) - spawnPadding;
        var minZ = (typeof bounds.minZ === 'number' ? bounds.minZ : bounds.min) + spawnPadding;
        var maxZ = (typeof bounds.maxZ === 'number' ? bounds.maxZ : bounds.max) - spawnPadding;

        for (var i = 0; i < 40; i++) {
            var randomSpawn = (globalThis.__MAYHEM_RUNTIME.GameWorld && globalThis.__MAYHEM_RUNTIME.GameWorld.getRandomSpawnPoint)
                ? globalThis.__MAYHEM_RUNTIME.GameWorld.getRandomSpawnPoint(spawnPadding, {
                    avoidPoints: getSpawnThreatPoints(),
                    minClearance: 14
                })
                : null;
            var x = randomSpawn ? randomSpawn.x : (minX + Math.random() * (maxX - minX));
            var z = randomSpawn ? randomSpawn.z : (minZ + Math.random() * (maxZ - minZ));
            var groundY = getGroundHeightAt(x, z);
            if (!isBlockedAt(x, z, groundY)) {
                setSpawnPosition(x, z, groundY);
                return new THREE.Vector2(x, z);
            }
        }

        var spawn = getDefaultSpawnPoint();
        setSpawnPosition(spawn.x, spawn.z, getGroundHeightAt(spawn.x, spawn.z));
        return new THREE.Vector2(spawn.x, spawn.z);
    };

    globalThis.__MAYHEM_RUNTIME.GamePlayer = GamePlayer;
})();
