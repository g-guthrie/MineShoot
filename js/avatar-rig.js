/**
 * avatar-rig.js - Shared blocky humanoid rig for player/enemy/remote visuals
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameAvatarRig
 */
(function () {
    'use strict';

    var GameAvatarRig = {};
    var entityConstants = (globalThis.__MAYHEM_RUNTIME && globalThis.__MAYHEM_RUNTIME.GameShared && globalThis.__MAYHEM_RUNTIME.GameShared.entityConstants) || {};
    var DEG_TO_RAD = Math.PI / 180;
    // Local rig axes:
    //   +X = actor right
    //   -X = actor left
    //   +Y = up
    //   -Y = down
    //   -Z = forward / face / muzzle direction
    //   +Z = backward
    function readVec3(value, fallback) {
        return {
            x: (value && typeof value.x === 'number') ? value.x : fallback.x,
            y: (value && typeof value.y === 'number') ? value.y : fallback.y,
            z: (value && typeof value.z === 'number') ? value.z : fallback.z
        };
    }

    var AVATAR_TORSO_SIZE = readVec3(entityConstants.AVATAR_TORSO_SIZE, { x: 0.8, y: 1.0, z: 0.5 });
    var AVATAR_TORSO_CENTER_OFFSET = readVec3(entityConstants.AVATAR_TORSO_CENTER_OFFSET, { x: 0, y: 1.3, z: 0 });
    var AVATAR_HEAD_SIZE = readVec3(entityConstants.AVATAR_HEAD_SIZE, { x: 0.55, y: 0.55, z: 0.55 });
    var AVATAR_HEAD_CENTER_OFFSET = readVec3(entityConstants.AVATAR_HEAD_CENTER_OFFSET, { x: 0, y: 2.1, z: 0 });
    var AVATAR_ARM_SIZE = readVec3(entityConstants.AVATAR_ARM_SIZE, { x: 0.22, y: 0.85, z: 0.22 });
    var AVATAR_ARM_LEFT_CENTER_OFFSET = readVec3(entityConstants.AVATAR_ARM_LEFT_CENTER_OFFSET, { x: -0.52, y: 1.25, z: 0 });
    var AVATAR_ARM_RIGHT_CENTER_OFFSET = readVec3(entityConstants.AVATAR_ARM_RIGHT_CENTER_OFFSET, { x: 0.52, y: 1.25, z: 0 });
    var AVATAR_LEG_SIZE = readVec3(entityConstants.AVATAR_LEG_SIZE, { x: 0.28, y: 0.9, z: 0.28 });
    var AVATAR_LEG_LEFT_CENTER_OFFSET = readVec3(entityConstants.AVATAR_LEG_LEFT_CENTER_OFFSET, { x: -0.18, y: 0.45, z: 0 });
    var AVATAR_LEG_RIGHT_CENTER_OFFSET = readVec3(entityConstants.AVATAR_LEG_RIGHT_CENTER_OFFSET, { x: 0.18, y: 0.45, z: 0 });
    var ARM_SHORT_SIDE = AVATAR_ARM_SIZE.x;
    var HALF_ARM_SHORT_SIDE = ARM_SHORT_SIDE * 0.5;
    var GUN_MOUNT_SHIFT_X = -0.08;
    var GUN_MOUNT_LIFT_Y = 0.1 + HALF_ARM_SHORT_SIDE;
    var GUN_MOUNT_SHIFT_Z = -HALF_ARM_SHORT_SIDE;
    var FOOT_PLANE_OFFSET_Y = (typeof entityConstants.AVATAR_FOOT_PLANE_OFFSET_Y === 'number') ? entityConstants.AVATAR_FOOT_PLANE_OFFSET_Y : 0.3;
    var HEAD_EYE_Y = 0.06;
    var HEAD_EYE_Z = -0.282;
    var HEAD_EYE_X = 0.12;
    var LEFT_PALM_NEUTRAL = { x: -0.01, y: -0.84, z: -0.03 };
    var RIGHT_PALM_SOCKET = { x: 0.015, y: -0.98, z: -0.01 };
    var HANDLE_ANCHOR_NAME = 'weaponHandleAnchor';
    var BARREL_TIP_ANCHOR_NAME = 'weaponBarrelTipAnchor';
    var INFERRED_JOG_SPEED = 8;
    var INFERRED_RUN_SPEED = 14;

    function clamp01(value) {
        return Math.max(0, Math.min(1, Number(value || 0)));
    }

    function resetSupportHandPose(rig) {
        if (!rig || !rig.palmLeft) return;
        if (rig.armLBasePos && rig.armL) {
            rig.armL.position.copy(rig.armLBasePos);
        }
        rig.palmLeft.position.set(LEFT_PALM_NEUTRAL.x, LEFT_PALM_NEUTRAL.y, LEFT_PALM_NEUTRAL.z);
        rig.palmLeft.rotation.set(0, 0, 0);
    }

    function resetGunMountPose(rig) {
        if (!rig || !rig.gun || !rig.gunBaseRot) return;
        rig.gun.rotation.set(rig.gunBaseRot.x, rig.gunBaseRot.y, rig.gunBaseRot.z);
    }

    function getSupportPoseForWeapon(weaponId, aimPitch, walkSwing, adsActive) {
        if (weaponId !== 'sniper') return null;

        var aim = Number(aimPitch || 0);
        var adsTighten = adsActive ? 1 : 0;

        return {
            shoulderX: 0.1,
            shoulderY: 0.01,
            shoulderZ: -0.09,
            palmX: -0.01,
            palmY: -0.9,
            palmZ: -0.04,
            palmRotX: 0.08,
            palmRotY: -0.05,
            palmRotZ: -0.18,
            targetX: 0.28 + (aim * 0.12) + (adsTighten * 0.02),
            targetY: -0.08,
            targetZ: -0.22 - (adsTighten * 0.02)
        };
    }

    function applyLeftArmPose(rig, pose) {
        if (!rig || !pose || !rig.armL) return;
        if (rig.armLBasePos) {
            rig.armL.position.copy(rig.armLBasePos);
            rig.armL.position.x += Number(pose.shoulderX || 0);
            rig.armL.position.y += Number(pose.shoulderY || 0);
            rig.armL.position.z += Number(pose.shoulderZ || 0);
        }
        if (rig.palmLeft) {
            rig.palmLeft.position.set(pose.palmX, pose.palmY, pose.palmZ);
            rig.palmLeft.rotation.set(
                Number(pose.palmRotX || 0),
                Number(pose.palmRotY || 0),
                Number(pose.palmRotZ || 0)
            );
        }
    }

    function getReloadPoseForWeapon(weaponId, reloadPct) {
        var t = clamp01(reloadPct);
        var reach = Math.sin(t * Math.PI);
        var wiggle = Math.sin(t * Math.PI * 5) * reach;
        var longGun = weaponId === 'rifle' || weaponId === 'machinegun' || weaponId === 'shotgun' || weaponId === 'sniper';
        var supportBias = longGun ? 1 : 0;

        return {
            armX: 0.9 + (reach * 0.42) + (wiggle * 0.08),
            armY: -0.14 - (reach * (0.18 + (supportBias * 0.06))),
            armZ: -0.28 - (reach * (0.22 + (supportBias * 0.1))) - (wiggle * 0.05),
            palmX: LEFT_PALM_NEUTRAL.x - 0.03 - (supportBias * 0.02),
            palmY: LEFT_PALM_NEUTRAL.y + (reach * 0.18),
            palmZ: LEFT_PALM_NEUTRAL.z - 0.14 - (supportBias * 0.05),
            gunYaw: wiggle * 0.012,
            gunRoll: wiggle * 0.02,
            rightArmX: reach * 0.05
        };
    }

    function applyReloadPose(rig, weaponId, reloadPct) {
        if (!rig || !rig.armL || !rig.gun) return;

        var pose = getReloadPoseForWeapon(weaponId, reloadPct);
        applyLeftArmPose(rig, pose);
        rig.gun.rotation.y += pose.gunYaw;
        rig.gun.rotation.z += pose.gunRoll;
        if (rig.armR) {
            rig.armR.rotation.x += pose.rightArmX;
        }
    }

    function ensureHex(value, fallback) {
        return (typeof value === 'number' && isFinite(value)) ? value : fallback;
    }

    function setPart(mesh, style) {
        if (!mesh || !style) return;
        if (style.p) mesh.position.set(style.p[0], style.p[1], style.p[2]);
        if (style.s) mesh.scale.set(style.s[0], style.s[1], style.s[2]);
        if (typeof style.c === 'number' && mesh.material && mesh.material.color) {
            mesh.material.color.setHex(style.c);
        }
    }

    function addXEye(head, xOffset, material) {
        if (!head) return null;
        var eye = new THREE.Group();
        eye.position.set(xOffset, HEAD_EYE_Y, HEAD_EYE_Z);

        var slashA = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.028, 0.02), material);
        slashA.rotation.z = 45 * DEG_TO_RAD;
        eye.add(slashA);

        var slashB = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.028, 0.02), material);
        slashB.rotation.z = -45 * DEG_TO_RAD;
        eye.add(slashB);

        head.add(eye);
        return eye;
    }

    function weaponRegistry() {
        return globalThis.__MAYHEM_RUNTIME.GameWeaponRegistry || null;
    }

    function resolveWeaponEntry(weaponId) {
        var registry = weaponRegistry();
        var entry = registry && registry.get ? registry.get(weaponId) : null;
        if (entry && entry.visual) {
            return {
                weaponId: weaponId,
                visual: entry.visual
            };
        }
        var fallback = registry && registry.get ? registry.get('rifle') : null;
        return fallback && fallback.visual ? {
            weaponId: 'rifle',
            visual: fallback.visual
        } : null;
    }

    function setAnchorPosition(group, name, coords) {
        var anchor = group.getObjectByName(name);
        if (!anchor) {
            anchor = new THREE.Object3D();
            anchor.name = name;
            group.add(anchor);
        }
        anchor.position.set(coords[0], coords[1], coords[2]);
        return anchor;
    }

    GameAvatarRig.create = function (kind, options) {
        options = options || {};

        var root = new THREE.Group();
        var modelRoot = new THREE.Group();
        modelRoot.position.y = FOOT_PLANE_OFFSET_Y;
        root.add(modelRoot);
        var bodyMat = new THREE.MeshLambertMaterial({ color: ensureHex(options.bodyColor, 0x4a7fc1) });
        var skinMat = new THREE.MeshLambertMaterial({ color: ensureHex(options.skinColor, 0xd2a77d) });
        var legMat = new THREE.MeshLambertMaterial({ color: ensureHex(options.legColor, 0x2f2f2f) });
        var gunDark = new THREE.MeshLambertMaterial({ color: 0x2a2a2a });
        var gunDarker = new THREE.MeshLambertMaterial({ color: 0x161616 });
        var gunWood = new THREE.MeshLambertMaterial({ color: 0x8b5a2b });
        var gunMetal = new THREE.MeshLambertMaterial({ color: 0x666666 });
        var eyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });

        var body = new THREE.Mesh(new THREE.BoxGeometry(AVATAR_TORSO_SIZE.x, AVATAR_TORSO_SIZE.y, AVATAR_TORSO_SIZE.z), bodyMat);
        body.position.set(AVATAR_TORSO_CENTER_OFFSET.x, AVATAR_TORSO_CENTER_OFFSET.y - FOOT_PLANE_OFFSET_Y, AVATAR_TORSO_CENTER_OFFSET.z);
        modelRoot.add(body);

        var head = new THREE.Mesh(new THREE.BoxGeometry(AVATAR_HEAD_SIZE.x, AVATAR_HEAD_SIZE.y, AVATAR_HEAD_SIZE.z), skinMat);
        head.position.set(AVATAR_HEAD_CENTER_OFFSET.x, AVATAR_HEAD_CENTER_OFFSET.y - FOOT_PLANE_OFFSET_Y, AVATAR_HEAD_CENTER_OFFSET.z);
        modelRoot.add(head);
        var eyeLeft = addXEye(head, -HEAD_EYE_X, eyeMat);
        var eyeRight = addXEye(head, HEAD_EYE_X, eyeMat);

        var eyeAnchor = new THREE.Object3D();
        eyeAnchor.position.set(0, 0.05, 0.18);
        head.add(eyeAnchor);

        var shoulderLeft = new THREE.Group();
        shoulderLeft.position.set(AVATAR_ARM_LEFT_CENTER_OFFSET.x, AVATAR_ARM_LEFT_CENTER_OFFSET.y - FOOT_PLANE_OFFSET_Y + (AVATAR_ARM_SIZE.y * 0.5), AVATAR_ARM_LEFT_CENTER_OFFSET.z);
        var armL = new THREE.Mesh(new THREE.BoxGeometry(AVATAR_ARM_SIZE.x, AVATAR_ARM_SIZE.y, AVATAR_ARM_SIZE.z), skinMat);
        armL.position.y = -(AVATAR_ARM_SIZE.y * 0.5);
        shoulderLeft.add(armL);
        var palmLeft = new THREE.Group();
        palmLeft.position.set(LEFT_PALM_NEUTRAL.x, LEFT_PALM_NEUTRAL.y, LEFT_PALM_NEUTRAL.z);
        shoulderLeft.add(palmLeft);
        modelRoot.add(shoulderLeft);

        var shoulderRight = new THREE.Group();
        shoulderRight.position.set(AVATAR_ARM_RIGHT_CENTER_OFFSET.x, AVATAR_ARM_RIGHT_CENTER_OFFSET.y - FOOT_PLANE_OFFSET_Y + (AVATAR_ARM_SIZE.y * 0.5), AVATAR_ARM_RIGHT_CENTER_OFFSET.z);
        var armR = new THREE.Mesh(new THREE.BoxGeometry(AVATAR_ARM_SIZE.x, AVATAR_ARM_SIZE.y, AVATAR_ARM_SIZE.z), skinMat);
        armR.position.y = -(AVATAR_ARM_SIZE.y * 0.5);
        shoulderRight.add(armR);

        var palmRight = new THREE.Group();
        palmRight.position.set(RIGHT_PALM_SOCKET.x, RIGHT_PALM_SOCKET.y, RIGHT_PALM_SOCKET.z);
        shoulderRight.add(palmRight);
        modelRoot.add(shoulderRight);

        var hipLeft = new THREE.Group();
        hipLeft.position.set(AVATAR_LEG_LEFT_CENTER_OFFSET.x, AVATAR_LEG_LEFT_CENTER_OFFSET.y - FOOT_PLANE_OFFSET_Y + (AVATAR_LEG_SIZE.y * 0.5), AVATAR_LEG_LEFT_CENTER_OFFSET.z);
        var legL = new THREE.Mesh(new THREE.BoxGeometry(AVATAR_LEG_SIZE.x, AVATAR_LEG_SIZE.y, AVATAR_LEG_SIZE.z), legMat);
        legL.position.y = -(AVATAR_LEG_SIZE.y * 0.5);
        hipLeft.add(legL);
        modelRoot.add(hipLeft);

        var hipRight = new THREE.Group();
        hipRight.position.set(AVATAR_LEG_RIGHT_CENTER_OFFSET.x, AVATAR_LEG_RIGHT_CENTER_OFFSET.y - FOOT_PLANE_OFFSET_Y + (AVATAR_LEG_SIZE.y * 0.5), AVATAR_LEG_RIGHT_CENTER_OFFSET.z);
        var legR = new THREE.Mesh(new THREE.BoxGeometry(AVATAR_LEG_SIZE.x, AVATAR_LEG_SIZE.y, AVATAR_LEG_SIZE.z), legMat);
        legR.position.y = -(AVATAR_LEG_SIZE.y * 0.5);
        hipRight.add(legR);
        modelRoot.add(hipRight);

        var gun = new THREE.Group();
        var gunBody = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.55), gunDark);
        gunBody.position.z = -0.04;
        gun.add(gunBody);

        var gunBarrel = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.26), gunDarker);
        gunBarrel.position.z = -0.42;
        gun.add(gunBarrel);

        var gunStock = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.11, 0.16), gunWood);
        gunStock.position.set(0, -0.03, 0.13);
        gun.add(gunStock);

        var gunGrip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.08), gunWood);
        gunGrip.position.set(0, -0.11, 0.03);
        gun.add(gunGrip);

        var scope = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.08, 0.23), gunMetal);
        scope.position.set(0, 0.09, -0.21);
        scope.visible = false;
        gun.add(scope);

        var pump = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.12), gunWood);
        pump.position.set(0, -0.03, -0.33);
        pump.visible = false;
        gun.add(pump);

        var coil = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.11, 0.11), gunMetal);
        coil.position.set(0, -0.1, -0.1);
        coil.visible = false;
        gun.add(coil);

        var muzzleMat = new THREE.MeshBasicMaterial({ color: ensureHex(options.muzzleColor, 0xffcc66) });
        var muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.08), muzzleMat);
        muzzle.position.set(0, 0, -0.58);
        muzzle.visible = false;
        gun.add(muzzle);

        var handleAnchor = new THREE.Object3D();
        handleAnchor.name = HANDLE_ANCHOR_NAME;
        gun.add(handleAnchor);

        var barrelTipAnchor = new THREE.Object3D();
        barrelTipAnchor.name = BARREL_TIP_ANCHOR_NAME;
        gun.add(barrelTipAnchor);

        palmRight.add(gun);

        var supportAnchor = new THREE.Object3D();
        supportAnchor.position.set(0, -0.01, -0.28);
        gun.add(supportAnchor);

        var coreAnchor = new THREE.Object3D();
        coreAnchor.position.set(AVATAR_TORSO_CENTER_OFFSET.x, AVATAR_TORSO_CENTER_OFFSET.y - FOOT_PLANE_OFFSET_Y, AVATAR_TORSO_CENTER_OFFSET.z);
        modelRoot.add(coreAnchor);

        var throwableOriginAnchor = new THREE.Object3D();
        throwableOriginAnchor.position.set(0.01, -0.02, -0.12);
        palmLeft.add(throwableOriginAnchor);

        var armDown = new THREE.Vector3(0, -1, 0);
        var shoulderWorld = new THREE.Vector3();
        var targetWorld = new THREE.Vector3();
        var parentLocalA = new THREE.Vector3();
        var parentLocalB = new THREE.Vector3();
        var aimDir = new THREE.Vector3();
        var aimQuat = new THREE.Quaternion();
        var aimEuler = new THREE.Euler();

        function pointArmAtTarget(armGroup, targetVec, parentGroup, extraX, extraY, extraZ) {
            if (!armGroup || !targetVec || !parentGroup) return;
            armGroup.getWorldPosition(shoulderWorld);
            parentLocalA.copy(shoulderWorld);
            parentLocalB.copy(targetVec);
            parentGroup.worldToLocal(parentLocalA);
            parentGroup.worldToLocal(parentLocalB);
            aimDir.copy(parentLocalB).sub(parentLocalA);
            if (aimDir.lengthSq() < 0.000001) return;
            aimDir.normalize();
            aimQuat.setFromUnitVectors(armDown, aimDir);
            aimEuler.setFromQuaternion(aimQuat, 'XYZ');
            armGroup.rotation.x = aimEuler.x + (extraX || 0);
            armGroup.rotation.y = aimEuler.y + (extraY || 0);
            armGroup.rotation.z = aimEuler.z + (extraZ || 0);
        }

        var rig = {
            armL: shoulderLeft,
            armR: shoulderRight,
            legL: hipLeft,
            legR: hipRight,
            armLMesh: armL,
            armRMesh: armR,
            legLMesh: legL,
            legRMesh: legR,
            bodyMesh: body,
            headMesh: head,
            gun: gun,
            gunBody: gunBody,
            gunBarrel: gunBarrel,
            gunStock: gunStock,
            gunGrip: gunGrip,
            scope: scope,
            pump: pump,
            coil: coil,
            muzzle: muzzle,
            supportAnchor: supportAnchor,
            coreAnchor: coreAnchor,
            throwableOriginAnchor: throwableOriginAnchor,
            eyeAnchor: eyeAnchor,
            eyeLeft: eyeLeft,
            eyeRight: eyeRight,
            palmLeft: palmLeft,
            palmRight: palmRight,
            weaponClass: 'gun',
            weaponId: 'rifle',
            gaitPhase: Math.random() * Math.PI * 2,
            aimPitch: 0,
            gunBasePos: new THREE.Vector3(),
            gunBaseRot: new THREE.Vector3(),
            supportBasePos: new THREE.Vector3(),
            armLBasePos: shoulderLeft.position.clone(),
            footPlaneOffsetY: FOOT_PLANE_OFFSET_Y
        };

        function setWeapon(weaponId) {
            var resolved = resolveWeaponEntry(weaponId);
            var visual = resolved && resolved.visual ? resolved.visual : null;
            var mount = visual && visual.mount ? visual.mount : null;
            var parts = visual && visual.parts ? visual.parts : {};
            var anchors = visual && visual.anchors ? visual.anchors : {};
            var effects = visual && visual.effects ? visual.effects : {};
            var handlePos = anchors.handle || [0, 0, 0];
            var barrelTipPos = anchors.barrelTip || [0, 0, -0.58];
            var supportPos = anchors.support || [0, -0.01, -0.28];
            var mountPos = mount && mount.position ? mount.position : [0, 0.02, 0.08];
            var mountRot = mount && mount.rotation ? mount.rotation : [0, 0, 0];
            var muzzlePos = effects.muzzleFlash && effects.muzzleFlash.position ? effects.muzzleFlash.position : barrelTipPos;

            rig.weaponId = resolved && resolved.weaponId ? resolved.weaponId : 'rifle';
            rig.weaponClass = visual && visual.classId ? visual.classId : 'gun';

            // Keep weapon body above the hand line so grip/stock read as hand-held.
            rig.gun.position.set(
                mountPos[0] + GUN_MOUNT_SHIFT_X,
                mountPos[1] + GUN_MOUNT_LIFT_Y,
                mountPos[2] + GUN_MOUNT_SHIFT_Z
            );
            rig.gun.rotation.set(mountRot[0], mountRot[1], mountRot[2]);
            // Keep a fixed wrist-style relationship: gun sits 75deg below the forearm.
            rig.gun.rotation.x = -75 * DEG_TO_RAD;

            var handleOffset = new THREE.Vector3(handlePos[0], handlePos[1], handlePos[2]);
            handleOffset.applyEuler(rig.gun.rotation);
            rig.gun.position.sub(handleOffset);

            rig.gunBasePos.copy(rig.gun.position);
            rig.gunBaseRot.copy(rig.gun.rotation);
            rig.supportBasePos.set(supportPos[0], supportPos[1], supportPos[2]);

            setPart(rig.gunBody, parts.body);
            setPart(rig.gunBarrel, parts.barrel);
            setPart(rig.gunStock, parts.stock);
            setPart(rig.gunGrip, parts.grip);

            rig.scope.visible = !!parts.scope;
            rig.pump.visible = !!parts.pump;
            rig.coil.visible = !!parts.coil;
            rig.muzzle.position.set(muzzlePos[0], muzzlePos[1], muzzlePos[2]);
            rig.supportAnchor.position.set(rig.supportBasePos.x, rig.supportBasePos.y, rig.supportBasePos.z);
            setAnchorPosition(rig.gun, HANDLE_ANCHOR_NAME, handlePos);
            setAnchorPosition(rig.gun, BARREL_TIP_ANCHOR_NAME, barrelTipPos);
        }

        function updateAimPitch(pitch) {
            rig.aimPitch = Math.max(-1.1, Math.min(1.1, pitch || 0));
        }

        function updateLocomotion(speedNorm, sprinting, dt, airborne, poseState) {
            speedNorm = Math.max(0, Math.min(1.4, speedNorm || 0));
            airborne = !!airborne;
            poseState = poseState || null;
            var choked = !!(poseState && poseState.choked);
            var chokeStartedAt = choked ? Number(poseState.startedAt || 0) : 0;
            var hooked = !!(poseState && poseState.hooked);
            var legAmp = 0.12 + speedNorm * 0.55;
            if (legAmp > 0.72) legAmp = 0.72;
            var worldSpeed = poseState && typeof poseState.worldSpeed === 'number'
                ? Math.max(0, Number(poseState.worldSpeed || 0))
                : (speedNorm * (sprinting ? INFERRED_RUN_SPEED : INFERRED_JOG_SPEED));
            if (worldSpeed > 0.02) {
                var strideLength = 1.6 + (legAmp * 3.2);
                rig.gaitPhase += ((worldSpeed * Math.max(0, dt || 0)) / Math.max(0.001, strideLength)) * Math.PI * 2;
            }
            var walkSwing = Math.sin(rig.gaitPhase) * legAmp;
            resetSupportHandPose(rig);
            resetGunMountPose(rig);
            if (hooked && !choked) {
                var hookPhase = Date.now() * 0.018;
                rig.legL.rotation.x = -0.32 + (Math.sin(hookPhase) * 0.12);
                rig.legR.rotation.x = -0.22 + (Math.sin(hookPhase + 1.5) * 0.12);
                rig.legL.rotation.z = 0.03;
                rig.legR.rotation.z = -0.03;
                rig.legL.position.x = AVATAR_LEG_LEFT_CENTER_OFFSET.x;
                rig.legR.position.x = AVATAR_LEG_RIGHT_CENTER_OFFSET.x;
                rig.armL.rotation.x = -0.42 + (Math.sin(hookPhase + 0.8) * 0.14);
                rig.armL.rotation.y = -0.08;
                rig.armL.rotation.z = -0.18;
                rig.armR.rotation.x = 0.86 + (Math.sin(hookPhase + 2.0) * 0.12);
                rig.armR.rotation.y = 0;
                rig.armR.rotation.z = 0.04;
                rig.palmRight.rotation.x = 0;
                return;
            }
            if (choked) {
                var stamp = Date.now();
                var phase = chokeStartedAt ? ((stamp - chokeStartedAt) * 0.02) : (stamp * 0.02);
                var legSquirmAmp = 0.34;
                var armSquirmAmp = 0.28;
                rig.legL.rotation.x = Math.sin(phase) * legSquirmAmp;
                rig.legR.rotation.x = Math.sin(phase + 1.6) * legSquirmAmp;
                rig.legL.rotation.z = Math.sin(phase + 0.9) * 0.08;
                rig.legR.rotation.z = Math.sin(phase + 2.3) * -0.08;
                rig.legL.position.x = AVATAR_LEG_LEFT_CENTER_OFFSET.x;
                rig.legR.position.x = AVATAR_LEG_RIGHT_CENTER_OFFSET.x;
                rig.armL.rotation.x = -0.18 + (Math.sin(phase + 0.8) * armSquirmAmp);
                rig.armL.rotation.y = -0.12 + (Math.sin(phase + 0.3) * 0.12);
                rig.armL.rotation.z = -0.24 + (Math.sin(phase + 1.2) * 0.12);
                rig.armR.rotation.x = 0.92 + (Math.sin(phase + 1.7) * 0.18);
                rig.armR.rotation.y = 0;
                rig.armR.rotation.z = 0.08 + (Math.sin(phase + 2.1) * 0.12);
                rig.palmRight.rotation.x = 0;
                return;
            }
            if (airborne) {
                rig.legL.rotation.x = 0;
                rig.legR.rotation.x = 0;
                rig.legL.rotation.z = 0;
                rig.legR.rotation.z = 0;
                rig.legL.position.x = AVATAR_LEG_LEFT_CENTER_OFFSET.x;
                rig.legR.position.x = AVATAR_LEG_RIGHT_CENTER_OFFSET.x;
                rig.armL.rotation.x = 0;
                rig.armL.rotation.y = 0;
                rig.armL.rotation.z = 0;
                rig.armR.rotation.x = 1.05 + (rig.aimPitch * 0.25);
                rig.armR.rotation.z = -0.08;
                rig.palmRight.rotation.x = 0;
            } else {
                rig.legL.rotation.x = walkSwing;
                rig.legR.rotation.x = -walkSwing;
                rig.legL.rotation.z = 0;
                rig.legR.rotation.z = 0;
                rig.legL.position.x = AVATAR_LEG_LEFT_CENTER_OFFSET.x;
                rig.legR.position.x = AVATAR_LEG_RIGHT_CENTER_OFFSET.x;

                if (rig.weaponClass === 'melee') {
                    rig.armR.rotation.x = -walkSwing;
                    rig.armR.rotation.z = 0.18;
                    rig.armL.rotation.x = walkSwing;
                    rig.armL.rotation.y = 0;
                    rig.armL.rotation.z = -0.04;
                    rig.palmRight.rotation.x = 0;
                } else if (sprinting) {
                    rig.armR.rotation.x = -walkSwing;
                    rig.armR.rotation.z = 0.18;
                    rig.armL.rotation.x = walkSwing;
                    rig.armL.rotation.y = 0;
                    rig.armL.rotation.z = -0.04;
                    rig.palmRight.rotation.x = 0;
                } else {
                    var shoulderAim = rig.aimPitch * 0.35;
                    var armBase = 75 * DEG_TO_RAD;
                    var supportPose = getSupportPoseForWeapon(rig.weaponId, rig.aimPitch, walkSwing, !!(poseState && poseState.adsActive));
                    rig.armR.rotation.x = armBase + shoulderAim;
                    rig.armR.rotation.z = -0.08;
                    if (supportPose) {
                        applyLeftArmPose(rig, supportPose);
                        rig.supportAnchor.getWorldPosition(targetWorld);
                        pointArmAtTarget(
                            rig.armL,
                            targetWorld,
                            modelRoot,
                            supportPose.targetX,
                            supportPose.targetY,
                            supportPose.targetZ
                        );
                    } else {
                        rig.armL.rotation.x = walkSwing * 0.65;
                        rig.armL.rotation.y = 0;
                        rig.armL.rotation.z = 0;
                    }
                    rig.palmRight.rotation.x = 0;
                }
            }

            if (poseState && poseState.reloading && rig.weaponClass !== 'melee') {
                applyReloadPose(rig, rig.weaponId, poseState.reloadPct);
            }
        }

        var tmpVec = new THREE.Vector3();
        function getCoreWorldPosition(outVec3) {
            var out = outVec3 || new THREE.Vector3();
            coreAnchor.getWorldPosition(out);
            return out;
        }

        function getMuzzleWorldPosition(outVec3) {
            var out = outVec3 || new THREE.Vector3();
            var barrelTip = rig.gun.getObjectByName(BARREL_TIP_ANCHOR_NAME);
            if (barrelTip) {
                barrelTip.getWorldPosition(out);
                return out;
            }
            muzzle.getWorldPosition(out);
            return out;
        }

        function getThrowableOriginWorldPosition(outVec3) {
            var out = outVec3 || new THREE.Vector3();
            throwableOriginAnchor.getWorldPosition(out);
            return out;
        }

        function getEyeWorldPosition(outVec3) {
            var out = outVec3 || new THREE.Vector3();
            eyeAnchor.getWorldPosition(out);
            return out;
        }

        function setMuzzleVisible(visible) {
            if (!muzzle) return;
            muzzle.visible = !!visible;
            if (!muzzle.material) return;
            if (visible) {
                if (rig.weaponId === 'missile' || rig.weaponId === 'plasma') {
                    muzzle.scale.set(0.95, 0.95, 1.4);
                    muzzle.material.color.setHex(0x8fe7ff);
                } else if (rig.weaponId === 'shotgun' || rig.weaponId === 'sniper') {
                    muzzle.scale.set(1.6, 1.6, 2.2);
                    muzzle.material.color.setHex(0xfff0c2);
                } else if (rig.weaponId === 'machinegun') {
                    muzzle.scale.set(1.05, 1.05, 1.5);
                    muzzle.material.color.setHex(0xffd67d);
                } else {
                    muzzle.scale.set(1.2, 1.2, 1.8);
                    muzzle.material.color.setHex(0xffd896);
                }
            } else {
                muzzle.scale.set(1, 1, 1);
                if (rig.weaponId === 'missile' || rig.weaponId === 'plasma') {
                    muzzle.material.color.setHex(0x56b8d1);
                } else {
                    muzzle.material.color.setHex(0xffcc66);
                }
            }
        }

        root.userData.bodyParts = [body, head, armL, armR, legL, legR];
        root.userData.originalColor = ensureHex(options.bodyColor, 0x4a7fc1);
        root.userData.originalPartColors = [
            body.material.color.getHex(),
            head.material.color.getHex(),
            armL.material.color.getHex(),
            armR.material.color.getHex(),
            legL.material.color.getHex(),
            legR.material.color.getHex()
        ];
        root.userData.weaponMuzzle = muzzle;
        root.userData.rig = rig;

        setWeapon(options.weaponId || 'rifle');
        updateAimPitch(0);
        updateLocomotion(0, false, 0);

        var throwPoseTimer = 0;
        function applyThrowPose(dt) {
            if (throwPoseTimer <= 0) return;
            throwPoseTimer -= dt;
            if (throwPoseTimer < 0) throwPoseTimer = 0;
            var t = Math.min(1, throwPoseTimer * 4);
            rig.armL.rotation.x = -1.4 * t;
            rig.armL.rotation.z = -0.3 * t;
        }

        function triggerThrowPose() {
            throwPoseTimer = 0.35;
        }

        var firePoseTimer = 0;
        var firePoseDuration = 0.12;
        var firePoseStrength = 1;
        function applyFirePose(dt) {
            if (firePoseTimer <= 0) return;
            firePoseTimer -= dt;
            if (firePoseTimer < 0) firePoseTimer = 0;
            var t = firePoseDuration > 0 ? (firePoseTimer / firePoseDuration) : 0;
            var amount = Math.max(0, Math.min(1, t)) * firePoseStrength;

            rig.armR.rotation.x += 0.11 * amount;
            rig.armR.rotation.z += 0.02 * amount;
            rig.armL.rotation.x += 0.06 * amount;
            rig.armL.rotation.z -= 0.03 * amount;
        }

        function triggerFirePose(duration, strength) {
            firePoseDuration = Math.max(0.06, Number(duration || 0.12));
            firePoseTimer = firePoseDuration;
            firePoseStrength = Math.max(0.4, Math.min(1.8, Number(strength || 1)));
        }

        var chokeGripTimer = 0;
        function applyChokeGripPose(dt) {
            if (chokeGripTimer <= 0) return;
            chokeGripTimer -= dt;
            if (chokeGripTimer < 0) chokeGripTimer = 0;
            rig.armL.rotation.x = 1.08;
            rig.armL.rotation.y = -0.08;
            rig.armL.rotation.z = -0.42;
        }

        function triggerChokeGripPose(duration) {
            chokeGripTimer = Math.max(0.1, duration || 1.5);
        }

        return {
            root: root,
            rig: rig,
            footPlaneOffsetY: FOOT_PLANE_OFFSET_Y,
            setWeapon: setWeapon,
            updateLocomotion: updateLocomotion,
            updateAimPitch: updateAimPitch,
            getCoreWorldPosition: getCoreWorldPosition,
            getEyeWorldPosition: getEyeWorldPosition,
            getMuzzleWorldPosition: getMuzzleWorldPosition,
            getThrowableOriginWorldPosition: getThrowableOriginWorldPosition,
            setMuzzleVisible: setMuzzleVisible,
            applyThrowPose: applyThrowPose,
            triggerThrowPose: triggerThrowPose,
            applyFirePose: applyFirePose,
            triggerFirePose: triggerFirePose,
            applyChokeGripPose: applyChokeGripPose,
            triggerChokeGripPose: triggerChokeGripPose,
            getWeaponId: function () { return rig.weaponId; },
            _tmp: tmpVec
        };
    };

    GameAvatarRig._test = {
        getSupportPoseForWeapon: getSupportPoseForWeapon,
        getReloadPoseForWeapon: getReloadPoseForWeapon
    };

    globalThis.__MAYHEM_RUNTIME.GameAvatarRig = GameAvatarRig;
})();
