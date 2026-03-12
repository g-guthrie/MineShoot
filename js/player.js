import { GameWorld } from './world.js';
import { GameActorVisualFactory } from './actor-visual-factory.js';

/**
 * player.js - Rifle-only local player motor and camera
 */
export const GamePlayer = {};

    var camera = null;
    var sceneRef = null;
    var yaw = 0;
    var pitch = 0;

    var EYE_HEIGHT = 1.6;
    var JOG_SPEED = 8;
    var RUN_SPEED = 14;
    var JUMP_VELOCITY = 8.8;
    var JUMP_HOLD_ACCEL = 16;
    var MAX_JUMP_HOLD = 0.2;
    var JUMP_RELEASE_MULT = 0.42;
    var GRAVITY = 18;
    var MOUSE_SENSITIVITY = 0.002;
    var PITCH_LIMIT = 89 * (Math.PI / 180);

    var PLAYER_RADIUS = 0.35;
    var PLAYER_HEIGHT = 1.7;
    var EPSILON = 0.001;

    var CAMERA_FOV = 75;
    var ADS_FOV = 56;
    var CAMERA_DIST = 4.4 * 0.85;
    var CAMERA_SHOULDER = 1.35 * 1.3;
    var THIRD_HEIGHT = 0.7;
    var THIRD_SMOOTH = 12;
    var ADS_DIST = 1.72;
    var ADS_SHOULDER = 2;
    var ADS_HEIGHT = 0.46;
    var ADS_BLEND_SPEED = 16;
    var ADS_MOVE_MULT = 0.4;
    var ADS_SENSITIVITY_MULT = 0.7;

    var playerX = 25;
    var playerZ = 45;
    var posY = EYE_HEIGHT;
    var velocityY = 0;
    var isGrounded = true;
    var jumpHoldTimer = 0;
    var jumpPressedLastFrame = false;
    var sprintPressedLastFrame = false;
    var sprintQueued = false;
    var scopeHeld = false;
    var scopeBlend = 0;
    var thirdCameraInitialized = false;
    var currentWeaponId = 'rifle';

    var keys = {
        forward: false,
        backward: false,
        left: false,
        right: false,
        jump: false,
        sprint: false
    };

    var avatarGroup = null;
    var avatarRigApi = null;
    var actorVisual = null;
    var bodyHitbox = null;
    var headHitbox = null;
    var hitboxVisible = false;

    var viewOrigin = new THREE.Vector3();
    var viewDesired = new THREE.Vector3();
    var viewTarget = new THREE.Vector3();
    var adsDesired = new THREE.Vector3();
    var viewDir = new THREE.Vector3();
    var muzzleForward = new THREE.Vector3();
    var viewRay = new THREE.Raycaster();

    var gunBobX = 0;
    var gunBobY = 0;
    var gunRecoil = 0;
    var palmRecoil = 0;
    var sprinting = false;
    var lastMoveSpeedNorm = 0;

    var statusState = {
        stunUntil: 0,
        spawnShieldUntil: 0
    };

    function hasInputCapture() {
        return !!document.pointerLockElement;
    }

    function nowMs() {
        return Date.now();
    }

    function isStunned(now) {
        return Number(statusState.stunUntil || 0) > Number(now || nowMs());
    }

    function isSpawnShielded(now) {
        return Number(statusState.spawnShieldUntil || 0) > Number(now || nowMs());
    }

    function isMovementLocked(now) {
        return isStunned(now);
    }

    function isActionLocked(now) {
        return isMovementLocked(now);
    }

    function clearExpiredStatusState(now) {
        var stamp = Number(now || nowMs());
        if (!isStunned(stamp)) statusState.stunUntil = 0;
        if (!isSpawnShielded(stamp)) statusState.spawnShieldUntil = 0;
    }

    function applyStatusState(patch) {
        patch = patch || {};
        if (typeof patch.stunUntil === 'number') statusState.stunUntil = Number(patch.stunUntil || 0);
        if (typeof patch.spawnShieldUntil === 'number') statusState.spawnShieldUntil = Number(patch.spawnShieldUntil || 0);
        clearExpiredStatusState(nowMs());
        setSpawnShieldVisual(isSpawnShielded());
    }

    function isAdsActive() {
        return !!scopeHeld;
    }

    function canUseAds() {
        return hasInputCapture();
    }

    function toggleAds() {
        if (!canUseAds()) {
            scopeHeld = false;
            return false;
        }
        scopeHeld = !scopeHeld;
        return scopeHeld;
    }

    function getWorldBounds() {
        return GameWorld.getBounds();
    }

    function getGroundHeightAt(x, z) {
        if (GameWorld && GameWorld.getGroundHeightAt) {
            return GameWorld.getGroundHeightAt(x, z);
        }
        return 0;
    }

    function getCollisionBoxes() {
        if (!GameWorld || !GameWorld.getCollidables) return [];
        var meshes = GameWorld.getCollidables();
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
        return best === null || best < baseGroundY ? baseGroundY : best;
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
        avatarGroup.position.set(playerX, posY - EYE_HEIGHT, playerZ);
        avatarGroup.rotation.y = yaw;
        syncHitboxPositions();
    }

    function syncHitboxPositions() {
        if (actorVisual && actorVisual.syncHitboxes) {
            actorVisual.syncHitboxes({ x: playerX, y: posY - EYE_HEIGHT, z: playerZ });
        }
    }

    function setAliveVisual(active) {
        if (avatarGroup) avatarGroup.visible = !!active;
        if (bodyHitbox) bodyHitbox.visible = !!active && hitboxVisible;
        if (headHitbox) headHitbox.visible = !!active && hitboxVisible;
    }

    function ensureHitboxes() {
        if (!sceneRef || actorVisual) return;
        var factory = GameActorVisualFactory || null;
        if (!factory || !factory.create) return;
        actorVisual = factory.create({
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

    function applyAvatarWeaponPose() {
        if (avatarRigApi && avatarRigApi.setWeapon) {
            avatarRigApi.setWeapon('rifle');
        }
    }

    function applyUnifiedGunOffsets(dt) {
        if (!avatarRigApi || !avatarRigApi.rig) return;
        var rig = avatarRigApi.rig;
        if (!rig.gun || !rig.gunBasePos) return;

        gunBobX += (0 - gunBobX) * Math.min(1, dt * 12);
        gunBobY += (0 - gunBobY) * Math.min(1, dt * 12);
        gunRecoil += (0 - gunRecoil) * Math.min(1, dt * 18);
        palmRecoil += (0 - palmRecoil) * Math.min(1, dt * 18);

        rig.gun.position.set(
            rig.gunBasePos.x + gunBobX,
            rig.gunBasePos.y + gunBobY,
            rig.gunBasePos.z + gunRecoil
        );
        if (rig.palmRight) {
            rig.palmRight.rotation.x += palmRecoil;
        }
    }

    function updateAvatarAnimation(dt, speed) {
        if (avatarRigApi && avatarRigApi.updateLocomotion) {
            var speedNorm = Math.max(0, Math.min(1.4, speed / RUN_SPEED));
            avatarRigApi.updateAimPitch(pitch);
            avatarRigApi.updateLocomotion(speedNorm, sprinting, dt, !isGrounded, null);
        }
    }

    function updateCameraFromPlayer(dt) {
        if (!camera) return;

        var cosPitch = Math.cos(pitch);
        var forwardX = -Math.sin(yaw) * cosPitch;
        var forwardY = Math.sin(pitch);
        var forwardZ = -Math.cos(yaw) * cosPitch;
        var rightX = Math.cos(yaw);
        var rightZ = -Math.sin(yaw);

        scopeBlend += ((isAdsActive() ? 1 : 0) - scopeBlend) * Math.min(1, dt * ADS_BLEND_SPEED);
        if (Math.abs(scopeBlend) < 0.001) scopeBlend = 0;
        if (Math.abs(1 - scopeBlend) < 0.001) scopeBlend = 1;

        updateAvatarPose();

        viewTarget.set(playerX + forwardX * 20, posY + forwardY * 20, playerZ + forwardZ * 20);
        viewOrigin.set(playerX, posY + 0.3, playerZ);
        viewDesired.set(
            playerX + (rightX * CAMERA_SHOULDER) - (forwardX * CAMERA_DIST),
            posY + THIRD_HEIGHT,
            playerZ + (rightZ * CAMERA_SHOULDER) - (forwardZ * CAMERA_DIST)
        );
        adsDesired.set(
            playerX + (rightX * ADS_SHOULDER) - (forwardX * ADS_DIST),
            posY + ADS_HEIGHT,
            playerZ + (rightZ * ADS_SHOULDER) - (forwardZ * ADS_DIST)
        );
        viewDesired.lerp(adsDesired, scopeBlend);

        var worldMeshes = GameWorld && GameWorld.getCollidables
            ? GameWorld.getCollidables()
            : [];
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

        if (!thirdCameraInitialized) {
            camera.position.copy(viewDesired);
            thirdCameraInitialized = true;
        } else {
            camera.position.lerp(viewDesired, Math.min(1, dt * THIRD_SMOOTH));
        }
        var targetFov = CAMERA_FOV + ((ADS_FOV - CAMERA_FOV) * scopeBlend);
        camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 16);
        camera.updateProjectionMatrix();
        camera.lookAt(viewTarget);
    }

    function setupInput() {
        document.addEventListener('keydown', function (e) {
            switch (e.code) {
                case 'KeyW': keys.forward = true; break;
                case 'KeyA': keys.left = true; break;
                case 'KeyS': keys.backward = true; break;
                case 'KeyD': keys.right = true; break;
                case 'KeyE': keys.sprint = true; break;
                case 'ShiftLeft':
                case 'ShiftRight':
                    if (!e.repeat && hasInputCapture()) {
                        e.preventDefault();
                        toggleAds();
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
                case 'KeyE': keys.sprint = false; break;
                case 'Space': keys.jump = false; break;
            }
        });

        document.addEventListener('mousemove', function (e) {
            if (!hasInputCapture()) return;
            var sensitivity = MOUSE_SENSITIVITY * (1 - (scopeBlend * (1 - ADS_SENSITIVITY_MULT)));
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
        playerX = Number(x || 0);
        playerZ = Number(z || 0);
        resetVerticalState(typeof feetY === 'number' ? feetY : 0);
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
        posY = (typeof state.y === 'number' && isFinite(state.y))
            ? Number(state.y)
            : (getGroundHeightAt(playerX, playerZ) + EYE_HEIGHT);
        velocityY = 0;
        isGrounded = true;
        jumpHoldTimer = 0;

        if (typeof state.yaw === 'number' && isFinite(state.yaw)) yaw = Number(state.yaw);
        if (typeof state.pitch === 'number' && isFinite(state.pitch)) {
            pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, Number(state.pitch)));
        }

        updateAvatarPose();
        updateCameraFromPlayer(1 / 60);
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

        var spawn = (GameWorld && GameWorld.getRandomSpawnPoint)
            ? GameWorld.getRandomSpawnPoint(
                GameWorld.getSpawnPadding ? GameWorld.getSpawnPadding() : 8
            )
            : { x: 25, z: 45 };
        playerX = spawn.x;
        playerZ = spawn.z;
        posY = getGroundHeightAt(playerX, playerZ) + EYE_HEIGHT;

        ensureHitboxes();
        applyAvatarWeaponPose();
        setupInput();
        updateAvatarPose();
        updateCameraFromPlayer(1);
        return camera;
    };

    GamePlayer.update = function (dt) {
        if (!camera || !hasInputCapture()) return;
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
            if (keys.forward) { moveX += forwardX; moveZ += forwardZ; }
            if (keys.backward) { moveX -= forwardX; moveZ -= forwardZ; }
            if (keys.left) { moveX -= rightX; moveZ -= rightZ; }
            if (keys.right) { moveX += rightX; moveZ += rightZ; }
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
        var nextX = Math.max(minBoundX, Math.min(maxBoundX, playerX + moveX));
        if (!isBlockedAt(nextX, playerZ, currentFeetY)) playerX = nextX;
        var nextZ = Math.max(minBoundZ, Math.min(maxBoundZ, playerZ + moveZ));
        if (!isBlockedAt(playerX, nextZ, currentFeetY)) playerZ = nextZ;

        var movedX = playerX - startX;
        var movedZ = playerZ - startZ;
        var horizontalSpeed = Math.sqrt(movedX * movedX + movedZ * movedZ) / Math.max(dt, 0.0001);
        lastMoveSpeedNorm = Math.max(0, Math.min(1.4, horizontalSpeed / RUN_SPEED));
        sprinting = sprintAllowed && horizontalSpeed > 0.06;

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
        gunRecoil += -0.05;
        palmRecoil += -0.09;
        if (avatarRigApi.setMuzzleVisible) {
            avatarRigApi.setMuzzleVisible(true);
            setTimeout(function () {
                avatarRigApi.setMuzzleVisible(false);
            }, 60);
        }
    };

    GamePlayer.isExperimentalCameraView = function () {
        return true;
    };

    GamePlayer.setWeaponModel = function (_weaponId) {
        currentWeaponId = 'rifle';
        scopeHeld = false;
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
        camera.getWorldDirection(muzzleForward);
        return camera.position.clone().addScaledVector(muzzleForward, 0.65);
    };

    GamePlayer.getCoreWorldPosition = function () {
        if (avatarRigApi && avatarRigApi.getCoreWorldPosition) {
            return avatarRigApi.getCoreWorldPosition();
        }
        if (!camera) return null;
        return camera.position.clone().setY(camera.position.y - 0.6);
    };

    GamePlayer.getEquippedWeaponId = function () {
        return 'rifle';
    };

    GamePlayer.getScopeState = function () {
        return {
            weaponId: 'rifle',
            active: isAdsActive() && scopeBlend > 0.02,
            scoped: false,
            sniper: false,
            blend: scopeBlend
        };
    };

    GamePlayer.getAdsState = function () {
        return {
            weaponId: 'rifle',
            active: isAdsActive(),
            blend: scopeBlend,
            sniper: false
        };
    };

    GamePlayer.isSprinting = function () {
        return !!sprinting;
    };

    GamePlayer.getAnimNetState = function () {
        return {
            moveSpeedNorm: lastMoveSpeedNorm,
            sprinting: !!sprinting,
            aimPitch: pitch,
            equippedWeaponId: 'rifle'
        };
    };

    GamePlayer.setLoadout = function () {
        return { slots: ['rifle'] };
    };

    GamePlayer.getLoadout = function () {
        return { slots: ['rifle'] };
    };

    GamePlayer.setHitboxVisibility = function (visible) {
        ensureHitboxes();
        return setHitboxVisibility(visible);
    };

    GamePlayer.setStatusState = function (state) {
        applyStatusState({
            stunUntil: state && state.stunUntil ? Number(state.stunUntil || 0) : 0,
            spawnShieldUntil: state && state.spawnShieldUntil ? Number(state.spawnShieldUntil || 0) : 0
        });
    };

    GamePlayer.syncAuthoritativeSelfState = function (selfState) {
        if (!selfState) return false;
        setAliveVisual(selfState.alive !== false);
        applyStatusState({
            stunUntil: selfState.stunUntil ? Number(selfState.stunUntil || 0) : 0,
            spawnShieldUntil: selfState.spawnShieldUntil ? Number(selfState.spawnShieldUntil || 0) : 0
        });
        return true;
    };

    GamePlayer.setAliveVisual = function (active) {
        setAliveVisual(active);
    };

    GamePlayer.setHealFlash = function (active) {
        setHealFlash(!!active);
    };

    GamePlayer.setSpawnShield = function (active) {
        applyStatusState({
            spawnShieldUntil: active ? nowMs() + 1000 : 0
        });
    };

    GamePlayer.isStunned = function () {
        return isStunned();
    };

    GamePlayer.isHookPulled = function () {
        return false;
    };

    GamePlayer.isChoked = function () {
        return false;
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

    GamePlayer.equipSlot = function (slotIndex) {
        return Number(slotIndex) === 0 ? 'rifle' : null;
    };

    GamePlayer.respawn = function (x, z) {
        return setSpawnPosition(x, z, getGroundHeightAt(x, z));
    };

    GamePlayer.applyAuthoritativeMotion = function (state) {
        return applyAuthoritativeMotion(state);
    };

    GamePlayer.respawnRandom = function () {
        var spawn = (GameWorld && GameWorld.getRandomSpawnPoint)
            ? GameWorld.getRandomSpawnPoint(
                GameWorld.getSpawnPadding ? GameWorld.getSpawnPadding() : 8
            )
            : { x: 25, z: 45 };
        setSpawnPosition(spawn.x, spawn.z, getGroundHeightAt(spawn.x, spawn.z));
        return new THREE.Vector2(spawn.x, spawn.z);
    };
