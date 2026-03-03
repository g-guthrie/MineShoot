/**
 * avatar-rig.js - Shared blocky humanoid rig for player/enemy/remote visuals
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameAvatarRig
 */
(function () {
    'use strict';

    var GameAvatarRig = {};
    var DEG_TO_RAD = Math.PI / 180;

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

    function styleMap() {
        return {
            rifle: {
                weaponClass: 'gun',
                gunPos: [0.0, 0.02, 0.08],
                gunRot: [0, 0, 0],
                body:   { p: [0, 0.0, -0.06], s: [1.0, 1.0, 1.0], c: 0x333333 },
                barrel: { p: [0, 0.02, -0.36], s: [1.0, 1.0, 1.0], c: 0x222222 },
                stock:  { p: [0, -0.04, 0.14], s: [1.0, 1.0, 1.0], c: 0x7a512d },
                grip:   { p: [0, -0.1, 0.02], s: [1.0, 1.0, 1.0], c: 0x7a512d },
                scope: false,
                pump: false,
                coil: false,
                muzzlePos: [0, 0.02, -0.56]
            },
            pistol: {
                weaponClass: 'gun',
                gunPos: [0.0, 0.03, 0.06],
                gunRot: [0.12, 0.05, 0],
                body:   { p: [0, -0.02, -0.06], s: [0.75, 0.85, 0.7], c: 0x3a3a3a },
                barrel: { p: [0, 0.0, -0.24], s: [0.68, 0.68, 0.65], c: 0x2c2c2c },
                stock:  { p: [0, -0.05, 0.09], s: [0.52, 0.85, 0.72], c: 0x6f4d32 },
                grip:   { p: [0, -0.14, -0.01], s: [0.9, 1.1, 1.25], c: 0x6f4d32 },
                scope: false,
                pump: false,
                coil: false,
                muzzlePos: [0, 0.0, -0.33]
            },
            machinegun: {
                weaponClass: 'gun',
                gunPos: [0.0, 0.02, 0.08],
                gunRot: [0, 0, 0],
                body:   { p: [0, 0.0, -0.09], s: [1.16, 1.0, 1.14], c: 0x2b2b2b },
                barrel: { p: [0, 0.03, -0.45], s: [1.1, 1.0, 1.3], c: 0x191919 },
                stock:  { p: [0, -0.03, 0.16], s: [1.1, 1.0, 1.0], c: 0x5b5b5b },
                grip:   { p: [0, -0.11, 0.01], s: [1.0, 1.0, 1.0], c: 0x5b5b5b },
                scope: false,
                pump: false,
                coil: true,
                muzzlePos: [0, 0.03, -0.7]
            },
            shotgun: {
                weaponClass: 'gun',
                gunPos: [0.0, 0.02, 0.06],
                gunRot: [0, 0, 0],
                body:   { p: [0, 0.0, -0.1], s: [1.18, 1.02, 1.1], c: 0x6b4220 },
                barrel: { p: [0, 0.02, -0.43], s: [1.7, 1.12, 1.35], c: 0x222222 },
                stock:  { p: [0, -0.03, 0.17], s: [1.12, 1.02, 1.02], c: 0x8a5a2d },
                grip:   { p: [0, -0.1, 0.02], s: [1.0, 1.0, 1.0], c: 0x8a5a2d },
                scope: false,
                pump: true,
                coil: false,
                muzzlePos: [0, 0.02, -0.71]
            },
            sniper: {
                weaponClass: 'gun',
                gunPos: [0.0, 0.02, 0.04],
                gunRot: [0, 0, 0],
                body:   { p: [0, -0.01, -0.14], s: [1.22, 0.9, 1.58], c: 0x2f3f2f },
                barrel: { p: [0, 0.02, -0.56], s: [0.82, 0.82, 2.15], c: 0x1c1c1c },
                stock:  { p: [0, -0.02, 0.17], s: [1.1, 1.0, 1.15], c: 0x5d3c1f },
                grip:   { p: [0, -0.11, 0.01], s: [1.0, 1.0, 1.0], c: 0x5d3c1f },
                scope: true,
                pump: false,
                coil: false,
                muzzlePos: [0, 0.02, -1.03]
            },
            plasma: {
                weaponClass: 'gun',
                gunPos: [0.0, 0.03, 0.06],
                gunRot: [0.02, 0.02, 0],
                body:   { p: [0, 0.0, -0.09], s: [1.18, 1.08, 1.25], c: 0x1d4f57 },
                barrel: { p: [0, 0.03, -0.5], s: [0.92, 0.92, 1.3], c: 0x4bd6f3 },
                stock:  { p: [0, -0.03, 0.16], s: [1.08, 1.0, 1.0], c: 0x314f5d },
                grip:   { p: [0, -0.11, 0.01], s: [1.0, 1.0, 1.0], c: 0x314f5d },
                scope: true,
                pump: false,
                coil: true,
                muzzlePos: [0, 0.04, -0.78]
            }
        };
    }

    GameAvatarRig.create = function (kind, options) {
        options = options || {};

        var root = new THREE.Group();
        var modelRoot = new THREE.Group();
        root.add(modelRoot);
        var bodyMat = new THREE.MeshLambertMaterial({ color: ensureHex(options.bodyColor, 0x4a7fc1) });
        var skinMat = new THREE.MeshLambertMaterial({ color: ensureHex(options.skinColor, 0xd2a77d) });
        var legMat = new THREE.MeshLambertMaterial({ color: ensureHex(options.legColor, 0x2f2f2f) });
        var gunDark = new THREE.MeshLambertMaterial({ color: 0x2a2a2a });
        var gunDarker = new THREE.MeshLambertMaterial({ color: 0x161616 });
        var gunWood = new THREE.MeshLambertMaterial({ color: 0x8b5a2b });
        var gunMetal = new THREE.MeshLambertMaterial({ color: 0x666666 });

        var body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.0, 0.5), bodyMat);
        body.position.y = 1.0;
        modelRoot.add(body);

        var head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.55), skinMat);
        head.position.y = 1.8;
        modelRoot.add(head);

        var eyeAnchor = new THREE.Object3D();
        eyeAnchor.position.set(0, 0.05, 0.18);
        head.add(eyeAnchor);

        var shoulderLeft = new THREE.Group();
        shoulderLeft.position.set(-0.52, 1.37, 0);
        var armL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.85, 0.22), skinMat);
        armL.position.y = -0.42;
        shoulderLeft.add(armL);
        var palmLeft = new THREE.Group();
        palmLeft.position.set(-0.11, -0.85, 0);
        shoulderLeft.add(palmLeft);
        modelRoot.add(shoulderLeft);

        var shoulderRight = new THREE.Group();
        shoulderRight.position.set(0.52, 1.37, 0);
        var armR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.85, 0.22), skinMat);
        armR.position.y = -0.42;
        shoulderRight.add(armR);

        var palmRight = new THREE.Group();
        palmRight.position.set(0.18, -0.85, 0);
        shoulderRight.add(palmRight);
        modelRoot.add(shoulderRight);

        var hipLeft = new THREE.Group();
        hipLeft.position.set(-0.18, 0.6, 0);
        var legL = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.9, 0.28), legMat);
        legL.position.y = -0.45;
        hipLeft.add(legL);
        modelRoot.add(hipLeft);

        var hipRight = new THREE.Group();
        hipRight.position.set(0.18, 0.6, 0);
        var legR = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.9, 0.28), legMat);
        legR.position.y = -0.45;
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

        palmRight.add(gun);

        var coreAnchor = new THREE.Object3D();
        coreAnchor.position.set(0, 1.0, 0);
        modelRoot.add(coreAnchor);

        var throwableOriginAnchor = new THREE.Object3D();
        throwableOriginAnchor.position.set(0.01, -0.02, -0.12);
        palmLeft.add(throwableOriginAnchor);

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
            coreAnchor: coreAnchor,
            throwableOriginAnchor: throwableOriginAnchor,
            eyeAnchor: eyeAnchor,
            palmLeft: palmLeft,
            palmRight: palmRight,
            weaponClass: 'gun',
            weaponId: 'rifle',
            gaitPhase: Math.random() * Math.PI * 2,
            aimPitch: 0,
            gunBasePos: new THREE.Vector3(),
            gunBaseRot: new THREE.Vector3()
        };

        var styles = styleMap();

        function setWeapon(weaponId) {
            var style = styles[weaponId] || styles.rifle;
            rig.weaponId = (styles[weaponId] ? weaponId : 'rifle');
            rig.weaponClass = style.weaponClass || 'gun';

            rig.gun.position.set(style.gunPos[0], style.gunPos[1], style.gunPos[2]);
            rig.gun.rotation.set(style.gunRot[0], style.gunRot[1], style.gunRot[2]);
            // Keep a fixed wrist-style relationship: gun sits 75deg below the forearm.
            rig.gun.rotation.x = -75 * DEG_TO_RAD;
            rig.gunBasePos.copy(rig.gun.position);
            rig.gunBaseRot.copy(rig.gun.rotation);

            setPart(rig.gunBody, style.body);
            setPart(rig.gunBarrel, style.barrel);
            setPart(rig.gunStock, style.stock);
            setPart(rig.gunGrip, style.grip);

            rig.scope.visible = !!style.scope;
            rig.pump.visible = !!style.pump;
            rig.coil.visible = !!style.coil;
            rig.muzzle.position.set(style.muzzlePos[0], style.muzzlePos[1], style.muzzlePos[2]);
        }

        function updateAimPitch(pitch) {
            rig.aimPitch = Math.max(-1.1, Math.min(1.1, pitch || 0));
        }

        function updateLocomotion(speedNorm, sprinting, dt) {
            speedNorm = Math.max(0, Math.min(1.4, speedNorm || 0));
            if (speedNorm > 0.02) {
                rig.gaitPhase += dt * ((sprinting ? 13 : 9) * (0.35 + speedNorm));
            }

            var legAmp = 0.12 + speedNorm * 0.55;
            if (legAmp > 0.72) legAmp = 0.72;
            var walkSwing = Math.sin(rig.gaitPhase) * legAmp;
            var sideSwing = -walkSwing * 0.75;

            rig.legL.rotation.x = walkSwing;
            rig.legR.rotation.x = -walkSwing;

            var aimBias = rig.aimPitch * 0.2;
            if (rig.weaponClass === 'melee') {
                rig.armR.rotation.x = -walkSwing;
                rig.armR.rotation.z = 0.18;
                rig.armL.rotation.x = walkSwing;
                rig.armL.rotation.z = -0.04;
                rig.palmRight.rotation.x = 0;
                rig.gun.rotation.x = rig.gunBaseRot.x;
            } else {
                var shoulderAim = rig.aimPitch * 0.35;
                var armBase = 75 * DEG_TO_RAD;
                rig.armR.rotation.x = armBase + shoulderAim;
                rig.armR.rotation.z = -0.08;
                rig.armL.rotation.x = -sideSwing;
                rig.armL.rotation.z = -0.04;
                rig.palmRight.rotation.x = 0;
                rig.gun.rotation.x = rig.gunBaseRot.x;
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
            if (rig.weaponId === 'plasma' && muzzle.material && muzzle.material.color) {
                muzzle.material.color.setHex(visible ? 0x66ddff : 0x44aacc);
            }
        }

        root.userData.bodyParts = [body, head, armL, armR, legL, legR];
        root.userData.originalColor = ensureHex(options.bodyColor, 0x4a7fc1);
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

        var chokeGripTimer = 0;
        function applyChokeGripPose(dt) {
            if (chokeGripTimer <= 0) return;
            chokeGripTimer -= dt;
            if (chokeGripTimer < 0) chokeGripTimer = 0;
            rig.armR.rotation.x = 1.2;
            rig.armR.rotation.z = 0.15;
        }

        function triggerChokeGripPose(duration) {
            chokeGripTimer = Math.max(0.1, duration || 1.5);
        }

        return {
            root: root,
            rig: rig,
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
            applyChokeGripPose: applyChokeGripPose,
            triggerChokeGripPose: triggerChokeGripPose,
            getWeaponId: function () { return rig.weaponId; },
            _tmp: tmpVec
        };
    };

    globalThis.__MAYHEM_RUNTIME.GameAvatarRig = GameAvatarRig;
})();
