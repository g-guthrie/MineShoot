/**
 * player.js - WASD movement, first/third-person camera, variable jump, weapon model
 * Loaded as global: window.GamePlayer
 */
(function () {
    'use strict';

    var GamePlayer = {};

    var PRIM = window.__GAME_PRIMITIVES__ || {};
    var COORDS_PRIM = PRIM.coords || {};
    var CAMERA_PRIM = PRIM.camera || {};
    var THIRD_PRIM = CAMERA_PRIM.third_person || {};
    var COORD = window.__GAME_COORD_SYSTEM__ || {};

    var camera = null;
    var yaw = 0;
    var pitch = 0;

    var EYE_HEIGHT = (typeof COORDS_PRIM.eye_offset_y === 'number' && isFinite(COORDS_PRIM.eye_offset_y))
        ? COORDS_PRIM.eye_offset_y
        : 1.6;
    var JOG_SPEED = 8;
    var RUN_SPEED = 11;
    var JUMP_VELOCITY = 8.8;
    var JUMP_HOLD_ACCEL = 16;
    var MAX_JUMP_HOLD = 0.2;
    var JUMP_RELEASE_MULT = 0.42;
    var GRAVITY = 18;
    var MOUSE_SENSITIVITY = 0.002;
    var PITCH_LIMIT = (typeof COORD.DEFAULT_PITCH_LIMIT_RAD === 'number' && isFinite(COORD.DEFAULT_PITCH_LIMIT_RAD))
        ? COORD.DEFAULT_PITCH_LIMIT_RAD
        : (89 * (Math.PI / 180));

    var WORLD_MIN = 1;
    var WORLD_MAX = 49;
    var PLAYER_RADIUS = 0.35;
    var PLAYER_HEIGHT = 1.7;
    var EPSILON = 0.001;

    var THIRD_DIST = (typeof THIRD_PRIM.distance === 'number' && isFinite(THIRD_PRIM.distance)) ? THIRD_PRIM.distance : 4.4;
    var THIRD_HEIGHT = (typeof THIRD_PRIM.height === 'number' && isFinite(THIRD_PRIM.height)) ? THIRD_PRIM.height : 0.7;
    var THIRD_SHOULDER = (typeof THIRD_PRIM.shoulder_offset === 'number' && isFinite(THIRD_PRIM.shoulder_offset)) ? THIRD_PRIM.shoulder_offset : 1.35;
    var THIRD_SMOOTH = (typeof THIRD_PRIM.smooth === 'number' && isFinite(THIRD_PRIM.smooth)) ? THIRD_PRIM.smooth : 12;

    // Logical player state (camera derives from this)
    var playerX = 25;
    var playerZ = 45;
    var velocityY = 0;
    var posY = EYE_HEIGHT; // head height in world-space
    var isGrounded = true;
    var jumpHoldTimer = 0;
    var jumpPressedLastFrame = false;

    var perspectiveMode = 'first'; // 'first' | 'third'
    var shoulderSide = (THIRD_PRIM.default_shoulder === 'left') ? 'left' : 'right';
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
    var currentWeaponId = 'rifle';

    var avatarGroup = null;
    var avatarRig = null;
    var avatarRigApi = null;

    var bobTimer = 0;
    var isMoving = false;
    var sprinting = false;
    var lastMoveSpeedNorm = 0;
    var gaitPhase = 0;
    var stepSoundTimer = 0;
    var loadoutSlots = ['rifle', 'pistol', 'machinegun', 'shotgun', 'sniper', 'plasma'];

    function hasInputCapture() {
        return !!document.pointerLockElement || !!window.__gameNoLockInput;
    }

    function wrapYaw(rad) {
        if (COORD && typeof COORD.wrapRad === 'function') return COORD.wrapRad(rad || 0);
        var out = Number(rad || 0);
        while (out > Math.PI) out -= Math.PI * 2;
        while (out < -Math.PI) out += Math.PI * 2;
        return out;
    }

    function clampPitchRad(rad) {
        if (COORD && typeof COORD.clampPitch === 'function') return COORD.clampPitch(rad || 0, PITCH_LIMIT);
        return Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, Number(rad || 0)));
    }

    function forwardFromYawPitch(yawRad, pitchRad) {
        if (COORD && typeof COORD.forwardFromYawPitch === 'function') {
            return COORD.forwardFromYawPitch(yawRad || 0, pitchRad || 0);
        }
        var cp = Math.cos(pitchRad || 0);
        return {
            x: -Math.sin(yawRad || 0) * cp,
            y: Math.sin(pitchRad || 0),
            z: -Math.cos(yawRad || 0) * cp
        };
    }

    function rightFromYaw(yawRad) {
        if (COORD && typeof COORD.rightFromYaw === 'function') {
            return COORD.rightFromYaw(yawRad || 0);
        }
        return {
            x: Math.cos(yawRad || 0),
            y: 0,
            z: -Math.sin(yawRad || 0)
        };
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

        var group = new THREE.Group();
        var bodyMat = new THREE.MeshLambertMaterial({ color: 0x4a7fc1 });
        var skinMat = new THREE.MeshLambertMaterial({ color: 0xd2a77d });
        var darkMat = new THREE.MeshLambertMaterial({ color: 0x2f2f2f });

        var body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.0, 0.5), bodyMat);
        body.position.y = 1.0;
        group.add(body);

        var head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.55), skinMat);
        head.position.y = 1.8;
        group.add(head);

        var shoulderLeft = new THREE.Group();
        shoulderLeft.position.set(-0.43, 1.37, 0);
        var armL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.85, 0.22), skinMat);
        armL.position.y = -0.42;
        shoulderLeft.add(armL);
        group.add(shoulderLeft);

        var shoulderRight = new THREE.Group();
        shoulderRight.position.set(0.43, 1.37, 0);
        var armR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.85, 0.22), skinMat);
        armR.position.y = -0.42;
        shoulderRight.add(armR);
        group.add(shoulderRight);

        var hipLeft = new THREE.Group();
        hipLeft.position.set(-0.18, 0.6, 0);
        var legL = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.9, 0.28), darkMat);
        legL.position.y = -0.45;
        hipLeft.add(legL);
        group.add(hipLeft);

        var hipRight = new THREE.Group();
        hipRight.position.set(0.18, 0.6, 0);
        var legR = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.9, 0.28), darkMat);
        legR.position.y = -0.45;
        hipRight.add(legR);
        group.add(hipRight);

        var avatarGun = new THREE.Group();
        var avatarGunBody = new THREE.Mesh(
            new THREE.BoxGeometry(0.1, 0.1, 0.42),
            new THREE.MeshLambertMaterial({ color: 0x2a2a2a })
        );
        avatarGunBody.position.z = -0.04;
        avatarGun.add(avatarGunBody);

        var avatarGunBarrel = new THREE.Mesh(
            new THREE.BoxGeometry(0.06, 0.06, 0.26),
            new THREE.MeshLambertMaterial({ color: 0x161616 })
        );
        avatarGunBarrel.position.z = -0.36;
        avatarGun.add(avatarGunBarrel);

        avatarGun.position.set(0.12, 1.02, -0.34);
        group.add(avatarGun);

        var backGun = new THREE.Mesh(
            new THREE.BoxGeometry(0.08, 0.08, 0.45),
            new THREE.MeshLambertMaterial({ color: 0x222222 })
        );
        backGun.position.set(0.24, 1.2, -0.24);
        backGun.rotation.x = 0.45;
        group.add(backGun);

        group.userData.rig = {
            armL: shoulderLeft,
            armR: shoulderRight,
            legL: hipLeft,
            legR: hipRight,
            armLMesh: armL,
            armRMesh: armR,
            legLMesh: legL,
            legRMesh: legR,
            gun: avatarGun,
            gunBody: avatarGunBody,
            gunBarrel: avatarGunBarrel,
            backGun: backGun,
            twoHanded: true
        };

        return {
            model: group,
            rigApi: null
        };
    }

    function applyAvatarWeaponPose() {
        if (avatarRigApi && avatarRigApi.setWeapon) {
            avatarRigApi.setWeapon(currentWeaponId);
            avatarRig = avatarRigApi.rig || avatarRig;
            return;
        }
        if (!avatarRig) return;

        var isPistol = currentWeaponId === 'pistol';
        avatarRig.twoHanded = !isPistol;

        if (isPistol) {
            avatarRig.gun.position.set(0.34, 1.02, 0.24);
            avatarRig.gun.rotation.set(0.12, 0.05, 0);
            avatarRig.gunBody.scale.set(0.8, 0.9, 0.7);
            avatarRig.gunBarrel.scale.set(0.7, 0.7, 0.65);
            avatarRig.backGun.visible = true;
        } else {
            avatarRig.gun.position.set(0.12, 1.02, 0.34);
            avatarRig.gun.rotation.set(0, 0, 0);
            avatarRig.backGun.visible = false;
            if (currentWeaponId === 'shotgun') {
                avatarRig.gunBody.scale.set(1.24, 1.02, 1.14);
                avatarRig.gunBarrel.scale.set(1.65, 1.05, 1.16);
            } else if (currentWeaponId === 'sniper') {
                avatarRig.gunBody.scale.set(1.05, 0.9, 1.38);
                avatarRig.gunBarrel.scale.set(1.1, 0.9, 1.85);
            } else if (currentWeaponId === 'machinegun') {
                avatarRig.gunBody.scale.set(1.22, 1.0, 1.08);
                avatarRig.gunBarrel.scale.set(1.18, 1.0, 1.32);
            } else {
                avatarRig.gunBody.scale.set(1.0, 1.0, 1.0);
                avatarRig.gunBarrel.scale.set(1.0, 1.0, 1.0);
            }
        }
    }

    function updateAvatarAnimation(dt, speed) {
        if (avatarRigApi && avatarRigApi.updatePose) {
            var speedNorm = Math.max(0, Math.min(1.4, speed / RUN_SPEED));
            avatarRigApi.updatePose({
                moveSpeedNorm: speedNorm,
                sprinting: sprinting,
                aimPitch: pitch,
                equippedWeaponId: currentWeaponId
            }, dt);
            return;
        }
        if (avatarRigApi && avatarRigApi.updateLocomotion) {
            var compatNorm = Math.max(0, Math.min(1.4, speed / RUN_SPEED));
            avatarRigApi.updateAimPitch(pitch);
            avatarRigApi.updateLocomotion(compatNorm, sprinting, dt);
            return;
        }
        if (!avatarRig) return;

        var stride = Math.max(0, speed / RUN_SPEED);
        if (stride > 0.02) {
            gaitPhase += dt * (sprinting ? 13 : 9);
        }

        var legAmp = 0.15 + stride * 0.55;
        if (legAmp > 0.72) legAmp = 0.72;
        var walkSwing = Math.sin(gaitPhase) * legAmp;
        var sideSwing = -walkSwing * 0.75;

        avatarRig.legL.rotation.x = walkSwing;
        avatarRig.legR.rotation.x = -walkSwing;

        if (avatarRig.twoHanded) {
            avatarRig.armR.rotation.x = -0.36 + Math.sin(gaitPhase * 2.1) * 0.03;
            avatarRig.armR.rotation.z = 0.12;
            avatarRig.armL.rotation.x = -0.32 + Math.cos(gaitPhase * 2.0) * 0.03;
            avatarRig.armL.rotation.z = -0.12;
        } else {
            avatarRig.armR.rotation.x = -0.42;
            avatarRig.armR.rotation.z = 0.14;
            avatarRig.armL.rotation.x = sideSwing;
            avatarRig.armL.rotation.z = -0.04;
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

        var styleMap = {
            rifle: {
                body:  { p: [0, 0.0, -0.16],  s: [1.0, 1.0, 1.0], c: 0x444444 },
                barrel:{ p: [0, 0.02, -0.46], s: [1.0, 1.0, 1.0], c: 0x333333 },
                stock: { p: [0, -0.02, 0.15], s: [1.0, 1.0, 1.0], c: 0x8B5A2B },
                grip:  { p: [0, -0.1, 0.05],  s: [1.0, 1.0, 1.0], c: 0x8B5A2B },
                scopeVisible: false,
                pumpVisible: false,
                drumVisible: false,
                muzzle: [0, 0.02, -0.62]
            },
            pistol: {
                body:  { p: [0, -0.02, -0.1], s: [0.82, 0.88, 0.68], c: 0x3b3b3b },
                barrel:{ p: [0, 0.0, -0.3],  s: [0.7, 0.7, 0.45], c: 0x2d2d2d },
                stock: { p: [0, -0.05, 0.07], s: [0.55, 0.8, 0.65], c: 0x6c4a2b },
                grip:  { p: [0, -0.13, -0.01], s: [0.9, 1.1, 1.2], c: 0x6c4a2b },
                scopeVisible: false,
                pumpVisible: false,
                drumVisible: false,
                muzzle: [0, 0.0, -0.39]
            },
            machinegun: {
                body:  { p: [0, 0.0, -0.17], s: [1.15, 0.95, 1.2], c: 0x2e2e2e },
                barrel:{ p: [0, 0.03, -0.5], s: [0.95, 0.95, 1.28], c: 0x1f1f1f },
                stock: { p: [0, -0.03, 0.16], s: [1.1, 1.0, 1.0], c: 0x5a5a5a },
                grip:  { p: [0, -0.11, 0.02], s: [1.0, 1.0, 1.0], c: 0x5a5a5a },
                scopeVisible: false,
                pumpVisible: false,
                drumVisible: true,
                muzzle: [0, 0.03, -0.73]
            },
            shotgun: {
                body:  { p: [0, 0.0, -0.17], s: [1.2, 1.0, 1.1], c: 0x6a3f1f },
                barrel:{ p: [0, 0.02, -0.47], s: [1.8, 1.2, 1.35], c: 0x2a2a2a },
                stock: { p: [0, -0.03, 0.16], s: [1.15, 1.0, 1.05], c: 0x8b5a2b },
                grip:  { p: [0, -0.1, 0.02], s: [1.0, 1.0, 1.0], c: 0x8b5a2b },
                scopeVisible: false,
                pumpVisible: true,
                drumVisible: false,
                muzzle: [0, 0.02, -0.71]
            },
            sniper: {
                body:  { p: [0, -0.01, -0.2], s: [1.22, 0.85, 1.58], c: 0x2f3f2f },
                barrel:{ p: [0, 0.02, -0.56], s: [0.82, 0.82, 2.15], c: 0x1c1c1c },
                stock: { p: [0, -0.02, 0.17], s: [1.1, 1.0, 1.15], c: 0x5d3c1f },
                grip:  { p: [0, -0.11, 0.01], s: [1.0, 1.0, 1.0], c: 0x5d3c1f },
                scopeVisible: true,
                pumpVisible: false,
                drumVisible: false,
                muzzle: [0, 0.02, -1.03]
            },
            plasma: {
                body:  { p: [0, 0.0, -0.12], s: [1.2, 1.1, 1.32], c: 0x1d4f57 },
                barrel:{ p: [0, 0.03, -0.5], s: [0.92, 0.92, 1.35], c: 0x4bd6f3 },
                stock: { p: [0, -0.02, 0.15], s: [1.08, 1.0, 1.0], c: 0x2d4b58 },
                grip:  { p: [0, -0.1, 0.02], s: [1.0, 1.0, 1.0], c: 0x2d4b58 },
                scopeVisible: true,
                pumpVisible: false,
                drumVisible: true,
                muzzle: [0, 0.04, -0.79]
            }
        };

        var style = styleMap[weaponId] || styleMap.rifle;
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

        if (weaponParts.scope) weaponParts.scope.visible = !!style.scopeVisible;
        if (weaponParts.pump) weaponParts.pump.visible = !!style.pumpVisible;
        if (weaponParts.drum) weaponParts.drum.visible = !!style.drumVisible;
        if (muzzleFlash) muzzleFlash.position.set(style.muzzle[0], style.muzzle[1], style.muzzle[2]);
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
        avatarGroup.position.set(playerX, posY - EYE_HEIGHT, playerZ);
        avatarGroup.rotation.y = yaw + Math.PI;
    }

    function updateCameraFromPlayer(dt) {
        if (!camera) return;

        var forward = forwardFromYawPitch(yaw, pitch);
        var flatForward = forwardFromYawPitch(yaw, 0);
        var right = rightFromYaw(yaw);

        if (perspectiveMode === 'first') {
            if (weaponGroup) weaponGroup.visible = true;
            if (avatarGroup) avatarGroup.visible = false;
            camera.position.set(playerX, posY, playerZ);
            camera.rotation.order = 'YXZ';
            camera.rotation.y = yaw;
            camera.rotation.x = pitch;
            thirdCameraInitialized = false;
            return;
        }

        if (weaponGroup) weaponGroup.visible = false;
        if (avatarGroup) avatarGroup.visible = true;
        updateAvatarPose();

        var shoulderSign = (shoulderSide === 'left') ? -1 : 1;
        viewOrigin.set(playerX, posY + 0.3, playerZ);
        viewTarget.set(playerX + forward.x * 20, posY + forward.y * 20, playerZ + forward.z * 20);
        viewDesired.set(
            playerX + (right.x * THIRD_SHOULDER * shoulderSign) - (flatForward.x * THIRD_DIST),
            posY + THIRD_HEIGHT,
            playerZ + (right.z * THIRD_SHOULDER * shoulderSign) - (flatForward.z * THIRD_DIST)
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
            yaw = wrapYaw(yaw - (e.movementX || 0) * MOUSE_SENSITIVITY);
            pitch = clampPitchRad(pitch - (e.movementY || 0) * MOUSE_SENSITIVITY);
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
            new THREE.BoxGeometry(0.06, 0.06, 0.06),
            new THREE.MeshBasicMaterial({ color: 0xFFFF88 })
        );
        muzzleFlash.visible = false;

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
        avatarRig = avatarGroup.userData.rig || null;
        avatarRigApi = avatarModel.rigApi || null;
        scene.add(avatarGroup);

        applyWeaponStyle('rifle');
        setupInput();
        updateAvatarPose();
        updateCameraFromPlayer(1);

        return camera;
    };

    GamePlayer.update = function (dt) {
        if (!camera) return;
        if (!hasInputCapture()) return;

        var wasGrounded = isGrounded;
        var landingImpact = 0;
        var jumpJustPressed = keys.jump && !jumpPressedLastFrame;
        var jumpJustReleased = !keys.jump && jumpPressedLastFrame;
        jumpPressedLastFrame = keys.jump;

        var forward = forwardFromYawPitch(yaw, 0);
        var right = rightFromYaw(yaw);
        var speedCap = keys.sprint ? RUN_SPEED : JOG_SPEED;

        var moveX = 0;
        var moveZ = 0;
        if (keys.forward)  { moveX += forward.x; moveZ += forward.z; }
        if (keys.backward) { moveX -= forward.x; moveZ -= forward.z; }
        if (keys.left)     { moveX -= right.x;   moveZ -= right.z; }
        if (keys.right)    { moveX += right.x;   moveZ += right.z; }

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
            if (window.GameAudio && window.GameAudio.playJump) {
                window.GameAudio.playJump();
            }
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
            var downSpeed = Math.abs(velocityY);
            var landingY = findLandingSurfaceY(playerX, playerZ, currentFeetY, nextFeetY);
            if (nextFeetY <= landingY + EPSILON) {
                nextFeetY = landingY;
                velocityY = 0;
                isGrounded = true;
                jumpHoldTimer = 0;
                landingImpact = downSpeed;
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
            landingImpact = Math.max(landingImpact, 0.8);
        }

        if (!wasGrounded && isGrounded && window.GameAudio && window.GameAudio.playLand) {
            window.GameAudio.playLand(landingImpact / Math.max(0.001, JUMP_VELOCITY));
        }

        posY = nextFeetY + EYE_HEIGHT;
        updateAvatarPose();
        updateAvatarAnimation(dt, horizontalSpeed);
        updateCameraFromPlayer(dt);

        if (weaponGroup && weaponGroup.visible) {
            if (isMoving && isGrounded) {
                bobTimer += dt * 10;
                weaponGroup.position.y = -0.2 + Math.sin(bobTimer) * 0.015;
                weaponGroup.position.x = 0.25 + Math.cos(bobTimer * 0.5) * 0.008;

                stepSoundTimer += dt * (sprinting ? 3.2 : 2.3);
                if (stepSoundTimer >= 1) {
                    stepSoundTimer -= 1;
                    if (window.GameAudio && window.GameAudio.playFootstep) {
                        window.GameAudio.playFootstep(lastMoveSpeedNorm, sprinting);
                    }
                }
            } else {
                weaponGroup.position.y += (-0.2 - weaponGroup.position.y) * dt * 5;
                weaponGroup.position.x += (0.25 - weaponGroup.position.x) * dt * 5;
                stepSoundTimer = 0;
            }
        }
    };

    GamePlayer.fireAnimation = function () {
        if (!weaponGroup) return;
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
            setTimeout(function () {
                muzzleFlash.visible = false;
            }, currentWeaponId === 'sniper' ? 90 : 60);
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

    GamePlayer.swapShoulder = function () {
        shoulderSide = (shoulderSide === 'right') ? 'left' : 'right';
        if (perspectiveMode === 'third') {
            thirdCameraInitialized = false;
            updateCameraFromPlayer(1);
        }
        return shoulderSide;
    };

    GamePlayer.getShoulderSide = function () {
        return shoulderSide;
    };

    GamePlayer.setShoulderSide = function (side) {
        if (side !== 'left' && side !== 'right') return shoulderSide;
        shoulderSide = side;
        if (perspectiveMode === 'third') {
            thirdCameraInitialized = false;
            updateCameraFromPlayer(1);
        }
        return shoulderSide;
    };

    GamePlayer.setWeaponModel = function (weaponId) {
        return applyWeaponStyle(weaponId);
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
        if (perspectiveMode === 'third' && avatarRigApi) {
            if (avatarRigApi.getSocketWorldPosition) {
                var socketPos = avatarRigApi.getSocketWorldPosition('muzzle_socket', new THREE.Vector3());
                if (socketPos) return socketPos;
            }
            if (avatarRigApi.getMuzzleWorldPosition) {
                return avatarRigApi.getMuzzleWorldPosition();
            }
        }
        if (!camera) return null;
        camera.getWorldDirection(plasmaForwardDir);
        return camera.position.clone().addScaledVector(plasmaForwardDir, 0.65);
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

    GamePlayer.getNetInputState = function () {
        var moveX = 0;
        var moveZ = 0;

        if (keys.left) moveX -= 1;
        if (keys.right) moveX += 1;
        if (keys.forward) moveZ += 1;
        if (keys.backward) moveZ -= 1;

        var len = Math.sqrt(moveX * moveX + moveZ * moveZ);
        if (len > 0) {
            moveX /= len;
            moveZ /= len;
        }

        return {
            moveX: moveX,
            moveZ: moveZ,
            jumpHeld: !!keys.jump,
            sprint: !!keys.sprint,
            cameraMode: perspectiveMode,
            shoulderSide: shoulderSide
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
