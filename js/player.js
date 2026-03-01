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
    var PRIM = globalThis.__GAME_PRIMITIVES__ || {};
    var COMBAT_PRIM = PRIM.combat || {};
    var COORDS_PRIM = PRIM.coords || {};
    var ENTITY_PRIM = PRIM.entity || {};
    var WORLD_PRIM = PRIM.world || {};

    var EYE_HEIGHT = Number(COORDS_PRIM.eye_offset_y || 1.6);
    var JOG_SPEED = 8;
    var RUN_SPEED = 11;
    var JUMP_VELOCITY = 8.8;
    var JUMP_HOLD_ACCEL = 16;
    var MAX_JUMP_HOLD = 0.2;
    var JUMP_RELEASE_MULT = 0.42;
    var GRAVITY = 18;
    var MOUSE_SENSITIVITY = 0.002;
    var PITCH_LIMIT = 89 * (Math.PI / 180);

    var WORLD_MIN = Number(WORLD_PRIM.min || 1);
    var WORLD_MAX = Number(WORLD_PRIM.max || 49);
    var PLAYER_RADIUS = Number(ENTITY_PRIM.capsule_radius || 0.58);
    var PLAYER_HEIGHT = Number(ENTITY_PRIM.capsule_height || 1.7);
    var EPSILON = 0.001;

    var THIRD_DIST = 4.4;
    var THIRD_HEIGHT = 0.7;
    var THIRD_SHOULDER = 1.35;
    var THIRD_SMOOTH = 12;
    var RECONCILE_SNAP_DIST = 1.6;

    // Logical player state (camera derives from this)
    var playerX = 25;
    var playerZ = 45;
    var velocityY = 0;
    var feetY = 0;
    var isGrounded = true;
    var jumpHoldTimer = 0;
    var jumpPressedLastFrame = false;

    var perspectiveMode = 'first'; // 'first' | 'third'
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

    var weaponGroup = null;
    var weaponParts = {};
    var muzzleFlash = null;
    var muzzleLight = null;
    var muzzleLightTimer = 0;
    var currentWeaponId = 'rifle';
    var tmpMuzzleWorldPos = null;

    var avatarGroup = null;
    var avatarRigApi = null;
    var collisionDebugGroup = null;
    var collisionDebugFeet = null;
    var collisionDebugHead = null;
    var collisionDebugVisible = true;

    var bobTimer = 0;
    var isMoving = false;
    var sprinting = false;
    var lastMoveSpeedNorm = 0;
    var loadoutSlots = (COMBAT_PRIM.weapon_order || ['rifle']).slice();

    function hasInputCapture() {
        if (window.GameRuntime && window.GameRuntime.getState) {
            var runtimeState = window.GameRuntime.getState();
            return !!(runtimeState.pointerLocked || runtimeState.fallbackInput);
        }
        if (window.GameUIShell && window.GameUIShell.hasCapture) {
            return window.GameUIShell.hasCapture();
        }
        return !!document.pointerLockElement || !!window.__gameNoLockInput;
    }

    function canAcceptGameplayInput() {
        if (window.GameRuntime && window.GameRuntime.canAcceptGameplayInput) {
            return window.GameRuntime.canAcceptGameplayInput();
        }
        if (window.GameUIShell && window.GameUIShell.canAcceptGameplayInput) {
            return window.GameUIShell.canAcceptGameplayInput();
        }
        return hasInputCapture();
    }

    function isTextInputElement(el) {
        if (!el) return false;
        var tag = (el.tagName || '').toUpperCase();
        if (el.isContentEditable) return true;
        return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    }

    function shouldIgnoreKeyboardEvent(e) {
        if (!e) return false;
        if (isTextInputElement(e.target)) return true;
        if (window.GameUIShell && window.GameUIShell.isTextInputFocused && window.GameUIShell.isTextInputFocused()) {
            return true;
        }
        return false;
    }

    function clearMovementKeys() {
        keys.forward = false;
        keys.backward = false;
        keys.left = false;
        keys.right = false;
        keys.jump = false;
        keys.sprint = false;
    }

    function createAvatarModel() {
        if (!window.GameAvatarRig || !window.GameAvatarRig.create) {
            throw new Error('GameAvatarRig is required for canonical avatar rendering.');
        }
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

    function applyAvatarWeaponPose() {
        if (!avatarRigApi || !avatarRigApi.setWeapon) return;
        avatarRigApi.setWeapon(currentWeaponId);
    }

    function updateAvatarAnimation(dt, speed) {
        if (!avatarRigApi) return;
        var speedNorm = Math.max(0, Math.min(1.4, speed / RUN_SPEED));
        if (avatarRigApi.setMotionState) {
            var strafeOnly = (keys.left || keys.right) && !(keys.forward || keys.backward);
            avatarRigApi.setMotionState({
                speedNorm: speedNorm,
                sprinting: sprinting,
                grounded: isGrounded,
                strafing: strafeOnly
            });
        }
        if (avatarRigApi.setActionState) {
            avatarRigApi.setActionState({
                aiming: true,
                firing: false
            });
        }
        if (avatarRigApi.updateAimPitch) {
            avatarRigApi.updateAimPitch(pitch);
        }
        if (avatarRigApi.updatePose) {
            avatarRigApi.updatePose(dt);
        } else if (avatarRigApi.updateLocomotion) {
            avatarRigApi.updateLocomotion(speedNorm, sprinting, dt);
        }
    }

    function setPart(mesh, px, py, pz, sx, sy, sz, colorHex) {
        if (!mesh) return;
        mesh.position.set(px, py, pz);
        mesh.scale.set(sx, sy, sz);
        if (typeof colorHex === 'number' && mesh.material && mesh.material.color) {
            mesh.material.color.setHex(colorHex);
        }
    }

    function applyWeaponStyle(weaponId) {
        if (!weaponGroup || !weaponParts.body) return false;

        var style = null;
        if (window.GameAvatarRig && window.GameAvatarRig.getWeaponStyle) {
            style = window.GameAvatarRig.getWeaponStyle(weaponId);
        }
        if (!style || !style.body || !style.barrel || !style.stock || !style.grip) {
            return false;
        }
        currentWeaponId = weaponId;

        setPart(
            weaponParts.body,
            style.body.p[0], style.body.p[1], style.body.p[2],
            style.body.s[0], style.body.s[1], style.body.s[2],
            style.body.c
        );
        setPart(
            weaponParts.barrel,
            style.barrel.p[0], style.barrel.p[1], style.barrel.p[2],
            style.barrel.s[0], style.barrel.s[1], style.barrel.s[2],
            style.barrel.c
        );
        setPart(
            weaponParts.stock,
            style.stock.p[0], style.stock.p[1], style.stock.p[2],
            style.stock.s[0], style.stock.s[1], style.stock.s[2],
            style.stock.c
        );
        setPart(
            weaponParts.grip,
            style.grip.p[0], style.grip.p[1], style.grip.p[2],
            style.grip.s[0], style.grip.s[1], style.grip.s[2],
            style.grip.c
        );

        if (weaponParts.scope) weaponParts.scope.visible = !!style.scope;
        if (weaponParts.pump) weaponParts.pump.visible = !!style.pump;
        if (weaponParts.drum) weaponParts.drum.visible = !!style.coil;
        if (muzzleFlash && style.muzzlePos) muzzleFlash.position.set(style.muzzlePos[0], style.muzzlePos[1], style.muzzlePos[2]);
        applyAvatarWeaponPose();

        return true;
    }

    function getWorldBounds() {
        if (window.GameWorld && window.GameWorld.getBounds) {
            return window.GameWorld.getBounds();
        }
        return { min: WORLD_MIN, max: WORLD_MAX };
    }

    function getDefaultSpawnPoint() {
        if (window.GameWorld && window.GameWorld.getSafeSpawn) {
            return window.GameWorld.getSafeSpawn({
                padding: (window.GameWorld.getSpawnPadding ? window.GameWorld.getSpawnPadding() : 8),
                tries: 120,
                feetY: 0,
                height: PLAYER_HEIGHT,
                radius: PLAYER_RADIUS
            });
        }

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

    function intersectsXZ(x, z, radius, box) {
        var closestX = Math.max(box.min.x, Math.min(x, box.max.x));
        var closestZ = Math.max(box.min.z, Math.min(z, box.max.z));
        var dx = x - closestX;
        var dz = z - closestZ;
        return ((dx * dx + dz * dz) < (radius * radius));
    }

    function isBlockedAt(nextX, nextZ, feetY) {
        if (window.GameWorld && window.GameWorld.isPointBlocked) {
            return !!window.GameWorld.isPointBlocked(nextX, nextZ, {
                feetY: feetY,
                height: PLAYER_HEIGHT,
                radius: PLAYER_RADIUS
            });
        }

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

    function recoverFromOverlap(maxIterations) {
        if (!window.GameWorld || !window.GameWorld.resolveCapsulePenetration) return null;

        var result = window.GameWorld.resolveCapsulePenetration({
            x: playerX,
            z: playerZ,
            feetY: feetY,
            height: PLAYER_HEIGHT,
            radius: PLAYER_RADIUS
        }, {
            maxIterations: maxIterations || 10
        });

        if (!result) return null;
        if (typeof result.x === 'number') playerX = result.x;
        if (typeof result.z === 'number') playerZ = result.z;
        return result;
    }

    function enforceValidSpawnInvariant() {
        if (!window.GameWorld || !window.GameWorld.validateSpawn) return;

        var check = window.GameWorld.validateSpawn({
            x: playerX,
            z: playerZ,
            feetY: feetY,
            height: PLAYER_HEIGHT,
            radius: PLAYER_RADIUS
        });
        if (check && check.valid) return;

        if (window.GameWorld.getSafeSpawn) {
            var safe = window.GameWorld.getSafeSpawn({
                padding: (window.GameWorld.getSpawnPadding ? window.GameWorld.getSpawnPadding() : 8),
                tries: 120,
                feetY: feetY,
                height: PLAYER_HEIGHT,
                radius: PLAYER_RADIUS
            });
            playerX = safe.x;
            playerZ = safe.z;
            recoverFromOverlap(16);
        }
    }

    function findLandingSurfaceY(x, z, currentFeetY, nextFeetY) {
        var boxes = getCollisionBoxes();
        if (boxes.length === 0) return 0;

        var best = null;
        for (var i = 0; i < boxes.length; i++) {
            var box = boxes[i];
            var top = box.max.y;
            if (!intersectsXZ(x, z, PLAYER_RADIUS * 0.9, box)) continue;
            if (top <= currentFeetY + EPSILON && top >= nextFeetY - EPSILON) {
                if (best === null || top > best) best = top;
            }
        }
        return (best === null || best < 0) ? 0 : best;
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
        avatarGroup.position.set(playerX, feetY, playerZ);
        avatarGroup.rotation.y = yaw + Math.PI;
        if (collisionDebugGroup) {
            collisionDebugGroup.visible = !!collisionDebugVisible;
            collisionDebugFeet.position.set(playerX, feetY + 0.04, playerZ);
            collisionDebugHead.position.set(playerX, feetY + PLAYER_HEIGHT, playerZ);
        }
    }

    function updateCameraFromPlayer(dt) {
        if (!camera) return;
        var eyeY = feetY + EYE_HEIGHT;

        var cosPitch = Math.cos(pitch);
        var forwardX = -Math.sin(yaw) * cosPitch;
        var forwardY = Math.sin(pitch);
        var forwardZ = -Math.cos(yaw) * cosPitch;
        var rightX = Math.cos(yaw);
        var rightZ = -Math.sin(yaw);

        if (perspectiveMode === 'first') {
            if (weaponGroup) weaponGroup.visible = true;
            if (avatarGroup) avatarGroup.visible = false;
            camera.position.set(playerX, eyeY, playerZ);
            camera.rotation.order = 'YXZ';
            camera.rotation.y = yaw;
            camera.rotation.x = pitch;
            thirdCameraInitialized = false;
            return;
        }

        if (weaponGroup) weaponGroup.visible = false;
        if (avatarGroup) avatarGroup.visible = true;
        updateAvatarPose();

        viewOrigin.set(playerX, eyeY + 0.3, playerZ);
        viewTarget.set(playerX + forwardX * 20, eyeY + forwardY * 20, playerZ + forwardZ * 20);
        viewDesired.set(
            playerX + (rightX * THIRD_SHOULDER) - (forwardX * THIRD_DIST),
            eyeY + THIRD_HEIGHT,
            playerZ + (rightZ * THIRD_SHOULDER) - (forwardZ * THIRD_DIST)
        );

        // Pull camera forward when wall is between player and desired camera point.
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
            if (shouldIgnoreKeyboardEvent(e)) return;
            if (!canAcceptGameplayInput()) return;
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

        window.addEventListener('blur', function () {
            clearMovementKeys();
        });

        document.addEventListener('pointerlockchange', function () {
            if (!hasInputCapture()) {
                clearMovementKeys();
            }
        });
    }

    function resetVerticalState(nextFeetY) {
        velocityY = 0;
        feetY = (typeof nextFeetY === 'number') ? nextFeetY : 0;
        isGrounded = true;
        jumpHoldTimer = 0;
    }

    function setSpawnPosition(x, z, spawnFeetY) {
        if (!camera) return false;
        spawnFeetY = (typeof spawnFeetY === 'number') ? spawnFeetY : 0;
        playerX = x;
        playerZ = z;
        resetVerticalState(spawnFeetY);
        recoverFromOverlap(14);
        enforceValidSpawnInvariant();
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
        feetY = 0;
        recoverFromOverlap(16);
        enforceValidSpawnInvariant();

        weaponGroup = new THREE.Group();
        weaponParts = {};

        var darkMat = new THREE.MeshLambertMaterial({ color: 0x444444 });
        var darkerMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
        var woodMat = new THREE.MeshLambertMaterial({ color: 0x8B5A2B });
        var metalMat = new THREE.MeshLambertMaterial({ color: 0x666666 });

        weaponParts.body = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.5), darkMat);
        weaponParts.barrel = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.3), darkerMat);
        weaponParts.stock = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.15), woodMat);
        weaponParts.grip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.06), woodMat);
        weaponParts.scope = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.2), metalMat);
        weaponParts.scope.position.set(0, 0.08, -0.22);
        weaponParts.scope.visible = false;
        weaponParts.pump = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.12), woodMat);
        weaponParts.pump.position.set(0, -0.03, -0.36);
        weaponParts.pump.visible = false;
        weaponParts.drum = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.08), metalMat);
        weaponParts.drum.position.set(0, -0.11, -0.11);
        weaponParts.drum.visible = false;

        muzzleFlash = new THREE.Mesh(
            new THREE.SphereGeometry(0.06, 4, 4),
            new THREE.MeshBasicMaterial({ color: 0xffffcc, transparent: true, opacity: 1 })
        );
        muzzleFlash.visible = false;

        muzzleLight = new THREE.PointLight(0xffcc66, 0, 4);
        muzzleLight.position.copy(muzzleFlash.position);
        weaponGroup.add(muzzleLight);

        tmpMuzzleWorldPos = new THREE.Vector3();

        weaponGroup.add(weaponParts.body);
        weaponGroup.add(weaponParts.barrel);
        weaponGroup.add(weaponParts.stock);
        weaponGroup.add(weaponParts.grip);
        weaponGroup.add(weaponParts.scope);
        weaponGroup.add(weaponParts.pump);
        weaponGroup.add(weaponParts.drum);
        weaponGroup.add(muzzleFlash);

        var armMat = new THREE.MeshLambertMaterial({ color: 0xD2A77D });
        var rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.28), armMat);
        rightArm.position.set(0.0, -0.12, -0.05);
        weaponGroup.add(rightArm);

        var leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.22), armMat);
        leftArm.position.set(-0.06, -0.06, -0.22);
        leftArm.rotation.y = 0.2;
        weaponGroup.add(leftArm);

        weaponGroup.position.set(0.25, -0.2, -0.4);
        camera.add(weaponGroup);

        var avatarModel = createAvatarModel();
        avatarGroup = avatarModel.model;
        avatarRigApi = avatarModel.rigApi || null;
        scene.add(avatarGroup);

        collisionDebugGroup = new THREE.Group();
        collisionDebugFeet = new THREE.Mesh(
            new THREE.SphereGeometry(0.09, 8, 8),
            new THREE.MeshBasicMaterial({ color: 0x7cf9ff, transparent: true, opacity: 0.85, depthTest: false })
        );
        collisionDebugFeet.renderOrder = 50;
        collisionDebugHead = new THREE.Mesh(
            new THREE.SphereGeometry(0.09, 8, 8),
            new THREE.MeshBasicMaterial({ color: 0xffaa66, transparent: true, opacity: 0.85, depthTest: false })
        );
        collisionDebugHead.renderOrder = 50;
        collisionDebugGroup.add(collisionDebugFeet);
        collisionDebugGroup.add(collisionDebugHead);
        scene.add(collisionDebugGroup);

        applyWeaponStyle('rifle');
        setupInput();
        updateAvatarPose();
        updateCameraFromPlayer(1);

        return camera;
    };

    GamePlayer.update = function (dt) {
        if (!camera) return;
        if (!canAcceptGameplayInput()) {
            clearMovementKeys();
            jumpPressedLastFrame = false;
            lastMoveSpeedNorm = 0;
            isMoving = false;
            sprinting = false;
            updateAvatarPose();
            updateAvatarAnimation(dt, 0);
            updateCameraFromPlayer(dt);
            return;
        }

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
        var currentFeetY = feetY;
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

        if (nextFeetY < 0) {
            nextFeetY = 0;
            velocityY = 0;
            isGrounded = true;
            jumpHoldTimer = 0;
        }

        feetY = nextFeetY;
        var depenetration = recoverFromOverlap(6);
        if (depenetration && depenetration.hadOverlap && depenetration.resolved) {
            isGrounded = true;
        }
        updateAvatarPose();
        updateAvatarAnimation(dt, horizontalSpeed);
        updateCameraFromPlayer(dt);

        if (weaponGroup && weaponGroup.visible) {
            if (isMoving && isGrounded) {
                bobTimer += dt * 10;
                weaponGroup.position.y = -0.2 + Math.sin(bobTimer) * 0.015;
                weaponGroup.position.x = 0.25 + Math.cos(bobTimer * 0.5) * 0.008;
            } else {
                weaponGroup.position.y += (-0.2 - weaponGroup.position.y) * dt * 5;
                weaponGroup.position.x += (0.25 - weaponGroup.position.x) * dt * 5;
            }
        }

        // Decay muzzle point light
        if (muzzleLight && muzzleLightTimer > 0) {
            muzzleLightTimer -= dt;
            if (muzzleLightTimer <= 0) {
                muzzleLightTimer = 0;
                muzzleLight.intensity = 0;
            } else {
                muzzleLight.intensity = 2.5 * (muzzleLightTimer / 0.06);
            }
        }
    };

    GamePlayer.fireAnimation = function () {
        if (!weaponGroup) return;
        if (avatarRigApi && avatarRigApi.setActionState) {
            avatarRigApi.setActionState({ firing: true, aiming: true });
        }
        var recoilByWeapon = {
            pistol: { z: -0.355, x: -0.06, returnMs: 120 },
            rifle: { z: -0.35, x: -0.08, returnMs: 150 },
            machinegun: { z: -0.365, x: -0.06, returnMs: 95 },
            shotgun: { z: -0.33, x: -0.12, returnMs: 230 },
            sniper: { z: -0.31, x: -0.13, returnMs: 280 },
            plasma: { z: -0.36, x: -0.03, returnMs: 80 }
        };
        var recoil = recoilByWeapon[currentWeaponId] || recoilByWeapon.rifle;
        var defaultZ = -0.4;

        weaponGroup.position.z = recoil.z;
        weaponGroup.rotation.x = recoil.x;

        if (muzzleFlash) {
            muzzleFlash.visible = true;
            muzzleFlash.scale.set(1, 1, 1);
            muzzleFlash.material.opacity = 1;

            // Point light burst
            if (muzzleLight) {
                muzzleLight.intensity = 2.5;
                muzzleLight.position.copy(muzzleFlash.position);
                muzzleLightTimer = 0.06;
            }

            // Spawn muzzle spark particles
            if (window.GameParticles && window.GameParticles.spawn) {
                muzzleFlash.getWorldPosition(tmpMuzzleWorldPos);
                var sparkCount = currentWeaponId === 'shotgun' ? 6 : 4;
                var sparkColors = [0xffdd44, 0xffaa22, 0xffcc66, 0xffffff];
                window.GameParticles.burst(tmpMuzzleWorldPos, sparkCount, {
                    color: sparkColors,
                    speedRange: [3, 8],
                    scaleRange: [0.02, 0.05],
                    lifeRange: [0.05, 0.12],
                    gravity: 0.3,
                    drag: 0.2
                });
            }

            var flashDur = currentWeaponId === 'sniper' ? 90 : 60;
            var flashStart = performance.now();
            function flashFade() {
                var elapsed = performance.now() - flashStart;
                var t = Math.min(1, elapsed / flashDur);
                muzzleFlash.scale.setScalar(1 + t * 1.5);
                muzzleFlash.material.opacity = 1 - t;
                if (t < 1) {
                    requestAnimationFrame(flashFade);
                } else {
                    muzzleFlash.visible = false;
                    muzzleFlash.scale.set(1, 1, 1);
                    muzzleFlash.material.opacity = 1;
                }
            }
            requestAnimationFrame(flashFade);
        }

        var startTime = performance.now();
        function recoilReturn() {
            var elapsed = performance.now() - startTime;
            var t = Math.min(1, elapsed / recoil.returnMs);
            weaponGroup.position.z = recoil.z + (defaultZ - recoil.z) * t;
            weaponGroup.rotation.x = recoil.x * (1 - t);
            if (t < 1) requestAnimationFrame(recoilReturn);
        }
        requestAnimationFrame(recoilReturn);
    };

    GamePlayer.togglePerspective = function () {
        perspectiveMode = (perspectiveMode === 'first') ? 'third' : 'first';
        thirdCameraInitialized = false;
        updateCameraFromPlayer(1);
        return perspectiveMode;
    };

    GamePlayer.setPerspective = function (mode) {
        if (mode !== 'first' && mode !== 'third') return perspectiveMode;
        perspectiveMode = mode;
        thirdCameraInitialized = false;
        updateCameraFromPlayer(1);
        return perspectiveMode;
    };

    GamePlayer.getPerspective = function () {
        return perspectiveMode;
    };

    GamePlayer.setWeaponModel = function (weaponId) {
        return applyWeaponStyle(weaponId);
    };

    GamePlayer.getCamera = function () {
        return camera;
    };

    GamePlayer.getPosition = function () {
        return GamePlayer.getEyePosition();
    };

    GamePlayer.getFeetPosition = function () {
        return new THREE.Vector3(playerX, feetY, playerZ);
    };

    GamePlayer.getEyePosition = function () {
        return new THREE.Vector3(playerX, feetY + EYE_HEIGHT, playerZ);
    };

    GamePlayer.getRotation = function () {
        return { yaw: yaw, pitch: pitch };
    };

    GamePlayer.getMuzzleWorldPos = function () {
        if (!muzzleFlash) return null;
        if (!tmpMuzzleWorldPos) tmpMuzzleWorldPos = new THREE.Vector3();
        muzzleFlash.getWorldPosition(tmpMuzzleWorldPos);
        return tmpMuzzleWorldPos;
    };

    GamePlayer.getMuzzleWorldPosition = function () {
        if (perspectiveMode === 'third' && avatarRigApi && avatarRigApi.getMuzzleWorldPosition) {
            return avatarRigApi.getMuzzleWorldPosition();
        }
        if (!camera) return null;
        camera.getWorldDirection(plasmaForwardDir);
        return camera.position.clone().addScaledVector(plasmaForwardDir, 0.65);
    };

    GamePlayer.getEquippedWeaponId = function () {
        return currentWeaponId;
    };

    GamePlayer.getAnimNetState = function () {
        var rigAnim = (avatarRigApi && avatarRigApi.getAnimState) ? avatarRigApi.getAnimState() : null;
        return {
            moveSpeedNorm: lastMoveSpeedNorm,
            sprinting: !!sprinting,
            aimPitch: pitch,
            equippedWeaponId: currentWeaponId,
            animState: rigAnim ? rigAnim.animState : (isMoving ? (sprinting ? 'sprint' : 'run') : 'idle'),
            animPhase: rigAnim ? rigAnim.animPhase : 0,
            gripMode: rigAnim ? rigAnim.gripMode : (currentWeaponId === 'pistol' ? 'one_hand' : 'two_hand')
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
        if (window.GameWorld && window.GameWorld.getSafeSpawn) {
            var safe = window.GameWorld.getSafeSpawn({
                padding: (window.GameWorld.getSpawnPadding ? window.GameWorld.getSpawnPadding() : 8),
                tries: 120,
                feetY: 0,
                height: PLAYER_HEIGHT,
                radius: PLAYER_RADIUS
            });
            return setSpawnPosition(
                (typeof x === 'number') ? x : safe.x,
                (typeof z === 'number') ? z : safe.z,
                0
            );
        }
        return setSpawnPosition(x, z, 0);
    };

    GamePlayer.respawnRandom = function () {
        if (!camera) {
            var defaultSpawn = getDefaultSpawnPoint();
            return new THREE.Vector2(defaultSpawn.x, defaultSpawn.z);
        }
        var ok = GamePlayer.respawn();
        if (!ok) {
            var fallback = getDefaultSpawnPoint();
            setSpawnPosition(fallback.x, fallback.z, 0);
            return new THREE.Vector2(fallback.x, fallback.z);
        }
        return new THREE.Vector2(playerX, playerZ);
    };

    GamePlayer.spawnSafe = function () {
        if (!camera) return null;
        var spawn = window.GameWorld && window.GameWorld.getSafeSpawn
            ? window.GameWorld.getSafeSpawn({
                padding: (window.GameWorld.getSpawnPadding ? window.GameWorld.getSpawnPadding() : 8),
                tries: 120,
                feetY: 0,
                height: PLAYER_HEIGHT,
                radius: PLAYER_RADIUS
            })
            : getDefaultSpawnPoint();
        setSpawnPosition(spawn.x, spawn.z, 0);
        return new THREE.Vector2(spawn.x, spawn.z);
    };

    GamePlayer.recoverFromOverlap = function () {
        var out = recoverFromOverlap(16);
        updateAvatarPose();
        updateCameraFromPlayer(1);
        return out;
    };

    GamePlayer.getInputStateDebug = function () {
        return {
            capture: hasInputCapture(),
            canAcceptGameplayInput: canAcceptGameplayInput(),
            keys: {
                forward: !!keys.forward,
                backward: !!keys.backward,
                left: !!keys.left,
                right: !!keys.right,
                jump: !!keys.jump,
                sprint: !!keys.sprint
            }
        };
    };

    GamePlayer.applyServerReconcile = function (state) {
        if (!state || typeof state !== 'object') return;
        if (!camera) return;

        var sx = (typeof state.x === 'number') ? state.x : playerX;
        var sy = (typeof state.feetY === 'number') ? state.feetY : feetY;
        var sz = (typeof state.z === 'number') ? state.z : playerZ;
        var dx = sx - playerX;
        var dz = sz - playerZ;
        var horizontalError = Math.sqrt((dx * dx) + (dz * dz));

        if (horizontalError > RECONCILE_SNAP_DIST) {
            playerX = sx;
            playerZ = sz;
            feetY = sy;
        } else {
            var blend = 0.55;
            playerX += dx * blend;
            playerZ += dz * blend;
            feetY += (sy - feetY) * blend;
        }

        if (typeof state.velY === 'number') velocityY = state.velY;
        if (typeof state.grounded === 'boolean') isGrounded = state.grounded;
        if (typeof state.yaw === 'number') yaw = state.yaw;
        if (typeof state.pitch === 'number') pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, state.pitch));

        recoverFromOverlap(4);
        updateAvatarPose();
        updateCameraFromPlayer(0.016);
    };

    GamePlayer.setCollisionDebugVisible = function (visible) {
        collisionDebugVisible = !!visible;
        if (collisionDebugGroup) collisionDebugGroup.visible = collisionDebugVisible;
    };

    window.GamePlayer = GamePlayer;
})();
