/**
 * player.js - WASD movement, first/third-person camera, variable jump, weapon model
 * Loaded as global: window.GamePlayer
 */
(function () {
    'use strict';

    var GamePlayer = {};

    var camera = null;
    var yaw = 0;
    var pitch = 0;

    var EYE_HEIGHT = 1.6;
    var JOG_SPEED = 8;
    var RUN_SPEED = 11;
    var JUMP_VELOCITY = 8.8;
    var JUMP_HOLD_ACCEL = 16;
    var MAX_JUMP_HOLD = 0.2;
    var JUMP_RELEASE_MULT = 0.42;
    var GRAVITY = 18;
    var MOUSE_SENSITIVITY = 0.002;
    var PITCH_LIMIT = 89 * (Math.PI / 180);

    var WORLD_MIN = 1;
    var WORLD_MAX = 49;
    var PLAYER_RADIUS = 0.35;
    var PLAYER_HEIGHT = 1.7;
    var EPSILON = 0.001;

    var THIRD_DIST = 4.4;
    var THIRD_HEIGHT = 0.7;
    var THIRD_SHOULDER = 1.35;
    var THIRD_SMOOTH = 12;
    var EXP_THIRD_DIST = THIRD_DIST * 0.85; // 15% closer.
    var EXP_THIRD_SHOULDER = THIRD_SHOULDER * 1.3; // Push character further left on screen.

    var playerX = 25;
    var playerZ = 45;
    var velocityY = 0;
    var posY = EYE_HEIGHT;
    var isGrounded = true;
    var jumpHoldTimer = 0;
    var jumpPressedLastFrame = false;

    var perspectiveMode = 'third';
    var experimentalCameraView = false;
    var thirdCameraInitialized = false;
    var viewOrigin = new THREE.Vector3();
    var viewDesired = new THREE.Vector3();
    var viewTarget = new THREE.Vector3();
    var viewDir = new THREE.Vector3();
    var plasmaForwardDir = new THREE.Vector3();
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

    var bobTimer = 0;
    var isMoving = false;
    var sprinting = false;
    var lastMoveSpeedNorm = 0;
    var loadoutSlots = ['rifle', 'pistol', 'machinegun', 'shotgun', 'sniper', 'plasma'];

    var gunBobX = 0;
    var gunBobY = 0;
    var gunRecoil = 0;
    var palmRecoil = 0;

    function hasInputCapture() {
        return !!document.pointerLockElement || !!window.__gameNoLockInput;
    }

    function createAvatarModel() {
        if (window.GameAvatarRig && window.GameAvatarRig.create) {
            var shared = window.GameAvatarRig.create('player', {
                bodyColor: 0x4a7fc1,
                skinColor: 0xd2a77d,
                legColor: 0x2f2f2f,
                weaponId: currentWeaponId
            });
            return {
                model: shared.root,
                rigApi: shared
            };
        }
        return { model: new THREE.Group(), rigApi: null };
    }

    function applyAvatarWeaponPose() {
        if (avatarRigApi && avatarRigApi.setWeapon) {
            avatarRigApi.setWeapon(currentWeaponId);
            avatarRig = avatarRigApi.rig || avatarRig;
        }
    }

    function applyUnifiedGunOffsets(dt) {
        if (!avatarRigApi || !avatarRigApi.rig) return;
        var rig = avatarRigApi.rig;
        if (!rig.gun || !rig.gunBasePos) return;

        var targetBobX = 0;
        var targetBobY = 0;
        if (perspectiveMode === 'first' && isMoving && isGrounded) {
            bobTimer += dt * 10;
            targetBobY = Math.sin(bobTimer) * 0.015;
            targetBobX = Math.cos(bobTimer * 0.5) * 0.008;
        }
        var bobBlend = Math.min(1, dt * 12);
        gunBobX += (targetBobX - gunBobX) * bobBlend;
        gunBobY += (targetBobY - gunBobY) * bobBlend;

        var recoilBlend = Math.min(1, dt * 18);
        gunRecoil += (0 - gunRecoil) * recoilBlend;
        palmRecoil += (0 - palmRecoil) * recoilBlend;

        rig.gun.position.set(
            rig.gunBasePos.x + gunBobX,
            rig.gunBasePos.y + gunBobY,
            rig.gunBasePos.z + gunRecoil
        );
        if (rig.palmRight) {
            rig.palmRight.rotation.x += palmRecoil;
        } else if (rig.palmLeft) {
            rig.palmLeft.rotation.x += palmRecoil;
        }
    }

    function updateAvatarAnimation(dt, speed) {
        if (avatarRigApi && avatarRigApi.updateLocomotion) {
            var speedNorm = Math.max(0, Math.min(1.4, speed / RUN_SPEED));
            avatarRigApi.updateAimPitch(pitch);
            avatarRigApi.updateLocomotion(speedNorm, sprinting, dt);
        }
    }

    function getWorldBounds() {
        if (window.GameWorld && window.GameWorld.getBounds) {
            return window.GameWorld.getBounds();
        }
        return { min: WORLD_MIN, max: WORLD_MAX };
    }

    function getDefaultSpawnPoint() {
        var bounds = getWorldBounds();
        var center = (typeof bounds.center === 'number')
            ? bounds.center
            : ((bounds.min + bounds.max) * 0.5);
        var z = Math.min(bounds.max - 4, center + Math.max(6, (bounds.max - bounds.min) * 0.34));
        return { x: center, z: z };
    }

    function getCollisionBoxes() {
        if (!window.GameWorld || !window.GameWorld.getCollidables) return [];

        var meshes = window.GameWorld.getCollidables();
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
        if (window.GameWorld && window.GameWorld.getGroundHeightAt) {
            return window.GameWorld.getGroundHeightAt(x, z);
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
        avatarGroup.position.set(playerX, posY - EYE_HEIGHT, playerZ);
        avatarGroup.rotation.y = yaw;
    }

    function updateCameraFromPlayer(dt) {
        if (!camera) return;

        var cosPitch = Math.cos(pitch);
        var forwardX = -Math.sin(yaw) * cosPitch;
        var forwardY = Math.sin(pitch);
        var forwardZ = -Math.cos(yaw) * cosPitch;
        var rightX = Math.cos(yaw);
        var rightZ = -Math.sin(yaw);

        if (avatarGroup) avatarGroup.visible = true;
        if (avatarRigApi && avatarRigApi.rig) {
            if (avatarRigApi.rig.headMesh) avatarRigApi.rig.headMesh.visible = true;
            if (avatarRigApi.rig.bodyMesh) avatarRigApi.rig.bodyMesh.visible = true;
        }
        updateAvatarPose();

        var camDist = experimentalCameraView ? EXP_THIRD_DIST : THIRD_DIST;
        var camShoulder = experimentalCameraView ? EXP_THIRD_SHOULDER : THIRD_SHOULDER;
        viewOrigin.set(playerX, posY + 0.3, playerZ);
        viewTarget.set(playerX + forwardX * 20, posY + forwardY * 20, playerZ + forwardZ * 20);
        viewDesired.set(
            playerX + (rightX * camShoulder) - (forwardX * camDist),
            posY + THIRD_HEIGHT,
            playerZ + (rightZ * camShoulder) - (forwardZ * camDist)
        );

        var worldMeshes = window.GameWorld && window.GameWorld.getCollidables ? window.GameWorld.getCollidables() : [];
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
        camera.lookAt(viewTarget);
    }

    function setupInput() {
        document.addEventListener('keydown', function (e) {
            switch (e.code) {
                case 'KeyW': keys.forward = true; break;
                case 'KeyA': keys.left = true; break;
                case 'KeyS': keys.backward = true; break;
                case 'KeyD': keys.right = true; break;
                case 'ShiftLeft':
                case 'ShiftRight':
                    keys.sprint = true;
                    break;
                case 'Space':
                    keys.jump = true;
                    e.preventDefault();
                    break;
                case 'KeyC':
                    experimentalCameraView = !experimentalCameraView;
                    thirdCameraInitialized = false;
                    updateCameraFromPlayer(1);
                    break;
            }
        });

        document.addEventListener('keyup', function (e) {
            switch (e.code) {
                case 'KeyW': keys.forward = false; break;
                case 'KeyA': keys.left = false; break;
                case 'KeyS': keys.backward = false; break;
                case 'KeyD': keys.right = false; break;
                case 'ShiftLeft':
                case 'ShiftRight':
                    keys.sprint = false;
                    break;
                case 'Space': keys.jump = false; break;
            }
        });

        document.addEventListener('mousemove', function (e) {
            if (!hasInputCapture()) return;
            yaw -= (e.movementX || 0) * MOUSE_SENSITIVITY;
            pitch -= (e.movementY || 0) * MOUSE_SENSITIVITY;
            pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch));
        });

        window.addEventListener('resize', function () {
            if (camera) {
                camera.aspect = window.innerWidth / window.innerHeight;
                camera.updateProjectionMatrix();
            }
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
        updateAvatarPose();
        updateCameraFromPlayer(1);
        return true;
    }

    GamePlayer.init = function (scene) {
        var bounds = getWorldBounds();
        var worldSpan = (typeof bounds.size === 'number') ? bounds.size : (bounds.max - bounds.min);
        var cameraFar = Math.max(120, worldSpan * 2.2);
        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, cameraFar);
        camera.rotation.order = 'YXZ';
        scene.add(camera);

        var spawn = getDefaultSpawnPoint();
        playerX = spawn.x;
        playerZ = spawn.z;
        posY = EYE_HEIGHT;

        var avatarModel = createAvatarModel();
        avatarGroup = avatarModel.model;
        avatarRig = avatarGroup.userData.rig || null;
        avatarRigApi = avatarModel.rigApi || null;
        scene.add(avatarGroup);

        applyAvatarWeaponPose();
        setupInput();
        updateAvatarPose();
        updateCameraFromPlayer(1);

        return camera;
    };

    GamePlayer.update = function (dt) {
        if (!camera) return;
        if (!hasInputCapture()) return;

        var jumpJustPressed = keys.jump && !jumpPressedLastFrame;
        var jumpJustReleased = !keys.jump && jumpPressedLastFrame;
        jumpPressedLastFrame = keys.jump;

        var forwardX = -Math.sin(yaw);
        var forwardZ = -Math.cos(yaw);
        var rightX = Math.cos(yaw);
        var rightZ = -Math.sin(yaw);
        var speedCap = keys.sprint ? RUN_SPEED : JOG_SPEED;

        var moveX = 0;
        var moveZ = 0;
        if (keys.forward)  { moveX += forwardX; moveZ += forwardZ; }
        if (keys.backward) { moveX -= forwardX; moveZ -= forwardZ; }
        if (keys.left)     { moveX -= rightX;   moveZ -= rightZ; }
        if (keys.right)    { moveX += rightX;   moveZ += rightZ; }

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
        var minBound = bounds.min + PLAYER_RADIUS;
        var maxBound = bounds.max - PLAYER_RADIUS;
        var startX = playerX;
        var startZ = playerZ;

        var nextX = playerX + moveX;
        nextX = Math.max(minBound, Math.min(maxBound, nextX));
        if (!isBlockedAt(nextX, playerZ, currentFeetY)) playerX = nextX;

        var nextZ = playerZ + moveZ;
        nextZ = Math.max(minBound, Math.min(maxBound, nextZ));
        if (!isBlockedAt(playerX, nextZ, currentFeetY)) playerZ = nextZ;

        var movedX = playerX - startX;
        var movedZ = playerZ - startZ;
        var horizontalSpeed = Math.sqrt(movedX * movedX + movedZ * movedZ) / Math.max(dt, 0.0001);
        lastMoveSpeedNorm = Math.max(0, Math.min(1.4, horizontalSpeed / RUN_SPEED));
        isMoving = horizontalSpeed > 0.06;
        sprinting = isMoving && keys.sprint;

        if (jumpJustPressed && isGrounded) {
            velocityY = JUMP_VELOCITY;
            isGrounded = false;
            jumpHoldTimer = MAX_JUMP_HOLD;
        }
        if (jumpJustReleased && velocityY > 0) {
            velocityY *= JUMP_RELEASE_MULT;
            jumpHoldTimer = 0;
        }
        if (keys.jump && jumpHoldTimer > 0 && velocityY > 0) {
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
        var recoilByWeapon = {
            pistol: { z: -0.025, x: -0.04 },
            rifle: { z: -0.03, x: -0.05 },
            machinegun: { z: -0.018, x: -0.04 },
            shotgun: { z: -0.05, x: -0.08 },
            sniper: { z: -0.06, x: -0.09 },
            plasma: { z: -0.012, x: -0.02 }
        };
        var recoil = recoilByWeapon[currentWeaponId] || recoilByWeapon.rifle;

        gunRecoil += recoil.z;
        palmRecoil += recoil.x;

        if (avatarRigApi.setMuzzleVisible) {
            avatarRigApi.setMuzzleVisible(true);
            setTimeout(function () {
                avatarRigApi.setMuzzleVisible(false);
            }, currentWeaponId === 'sniper' ? 90 : 60);
        }
    };

    GamePlayer.togglePerspective = function () {
        perspectiveMode = 'third';
        thirdCameraInitialized = false;
        updateCameraFromPlayer(1);
        return perspectiveMode;
    };

    GamePlayer.setPerspective = function (mode) {
        perspectiveMode = 'third';
        thirdCameraInitialized = false;
        updateCameraFromPlayer(1);
        return perspectiveMode;
    };

    GamePlayer.getPerspective = function () {
        return perspectiveMode;
    };

    GamePlayer.isExperimentalCameraView = function () {
        return experimentalCameraView;
    };

    GamePlayer.setWeaponModel = function (weaponId) {
        currentWeaponId = weaponId || 'rifle';
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

    GamePlayer.getEquippedWeaponId = function () {
        return currentWeaponId;
    };

    GamePlayer.getAnimNetState = function () {
        return {
            moveSpeedNorm: lastMoveSpeedNorm,
            sprinting: !!sprinting,
            aimPitch: pitch,
            equippedWeaponId: currentWeaponId
        };
    };

    GamePlayer.setLoadout = function (loadoutConfig) {
        if (!loadoutConfig || !Array.isArray(loadoutConfig.slots)) {
            return { slots: loadoutSlots.slice() };
        }

        var allowed = {};
        var hasAllowed = false;
        if (window.GameHitscan && window.GameHitscan.getAllWeaponIds) {
            var ids = window.GameHitscan.getAllWeaponIds();
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

    GamePlayer.equipSlot = function (slotIndex) {
        var idx = Math.max(0, Math.floor(slotIndex || 0));
        if (idx >= loadoutSlots.length) return null;
        return loadoutSlots[idx];
    };

    GamePlayer.respawn = function (x, z) {
        if (!camera) return false;
        return setSpawnPosition(x, z, 0);
    };

    GamePlayer.respawnRandom = function () {
        if (!camera) {
            var defaultSpawn = getDefaultSpawnPoint();
            return new THREE.Vector2(defaultSpawn.x, defaultSpawn.z);
        }

        var bounds = getWorldBounds();
        var spawnPadding = (window.GameWorld && window.GameWorld.getSpawnPadding)
            ? window.GameWorld.getSpawnPadding()
            : 4;
        var min = bounds.min + spawnPadding;
        var max = bounds.max - spawnPadding;

        for (var i = 0; i < 40; i++) {
            var randomSpawn = (window.GameWorld && window.GameWorld.getRandomSpawnPoint)
                ? window.GameWorld.getRandomSpawnPoint(spawnPadding)
                : null;
            var x = randomSpawn ? randomSpawn.x : (min + Math.random() * (max - min));
            var z = randomSpawn ? randomSpawn.z : (min + Math.random() * (max - min));
            if (!isBlockedAt(x, z, 0)) {
                setSpawnPosition(x, z, 0);
                return new THREE.Vector2(x, z);
            }
        }

        var spawn = getDefaultSpawnPoint();
        setSpawnPosition(spawn.x, spawn.z, 0);
        return new THREE.Vector2(spawn.x, spawn.z);
    };

    window.GamePlayer = GamePlayer;
})();
