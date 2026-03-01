/**
 * avatar-rig.js - Shared blocky humanoid rig for player/enemy/remote visuals
 * Loaded as global: window.GameAvatarRig
 */
(function () {
    'use strict';

    var GameAvatarRig = {};
    var PRIM = globalThis.__GAME_PRIMITIVES__ || {};
    var RIG_PRIM = PRIM.rig || {};

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
                twoHanded: true,
                gunPos: [0.12, 1.0, 0.28],
                gunRot: [0, 0, 0],
                primaryGripPos: [0.08, -0.1, 0.02],
                supportGripPos: [-0.16, -0.03, -0.2],
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
                twoHanded: false,
                gunPos: [0.32, 1.02, 0.24],
                gunRot: [0.12, 0.05, 0],
                primaryGripPos: [0.07, -0.12, -0.01],
                supportGripPos: [-0.08, -0.04, -0.06],
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
                twoHanded: true,
                gunPos: [0.14, 1.0, 0.28],
                gunRot: [0, 0, 0],
                primaryGripPos: [0.09, -0.1, 0.02],
                supportGripPos: [-0.18, -0.03, -0.24],
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
                twoHanded: true,
                gunPos: [0.12, 1.0, 0.3],
                gunRot: [0, 0, 0],
                primaryGripPos: [0.09, -0.1, 0.03],
                supportGripPos: [-0.22, -0.03, -0.33],
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
                twoHanded: true,
                gunPos: [0.12, 1.0, 0.32],
                gunRot: [0, 0, 0],
                primaryGripPos: [0.09, -0.11, 0.02],
                supportGripPos: [-0.2, -0.03, -0.37],
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
                twoHanded: true,
                gunPos: [0.14, 1.02, 0.3],
                gunRot: [0.02, 0.02, 0],
                primaryGripPos: [0.1, -0.1, 0.02],
                supportGripPos: [-0.18, -0.03, -0.26],
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

    function cloneStyle(style) {
        return JSON.parse(JSON.stringify(style || {}));
    }

    var WEAPON_STYLES = styleMap();

    GameAvatarRig.getWeaponStyle = function (weaponId) {
        return cloneStyle(WEAPON_STYLES[weaponId] || WEAPON_STYLES.rifle);
    };

    GameAvatarRig.getWeaponStyleCatalog = function () {
        var out = {};
        for (var key in WEAPON_STYLES) {
            if (!Object.prototype.hasOwnProperty.call(WEAPON_STYLES, key)) continue;
            out[key] = cloneStyle(WEAPON_STYLES[key]);
        }
        return out;
    };

    GameAvatarRig.create = function (kind, options) {
        options = options || {};

        var root = new THREE.Group();
        var bodyMat = new THREE.MeshLambertMaterial({ color: ensureHex(options.bodyColor, 0x4a7fc1) });
        var skinMat = new THREE.MeshLambertMaterial({ color: ensureHex(options.skinColor, 0xd2a77d) });
        var legMat = new THREE.MeshLambertMaterial({ color: ensureHex(options.legColor, 0x2f2f2f) });
        var gunDark = new THREE.MeshLambertMaterial({ color: 0x2a2a2a });
        var gunDarker = new THREE.MeshLambertMaterial({ color: 0x161616 });
        var gunWood = new THREE.MeshLambertMaterial({ color: 0x8b5a2b });
        var gunMetal = new THREE.MeshLambertMaterial({ color: 0x666666 });

        var bodySize = (RIG_PRIM.body && RIG_PRIM.body.size) || [0.8, 1.0, 0.5];
        var bodyOffset = (RIG_PRIM.body && RIG_PRIM.body.offset) || [0, 1.0, 0];
        var headSize = (RIG_PRIM.head && RIG_PRIM.head.size) || [0.55, 0.55, 0.55];
        var headOffset = (RIG_PRIM.head && RIG_PRIM.head.offset) || [0, 1.8, 0];
        var armSize = (RIG_PRIM.arm && RIG_PRIM.arm.size) || [0.22, 0.85, 0.22];
        var legSize = (RIG_PRIM.leg && RIG_PRIM.leg.size) || [0.28, 0.9, 0.28];
        var shoulderLeftOffset = (RIG_PRIM.arm && RIG_PRIM.arm.shoulder_left_offset) || [-0.43, 1.37, 0];
        var shoulderRightOffset = (RIG_PRIM.arm && RIG_PRIM.arm.shoulder_right_offset) || [0.43, 1.37, 0];
        var armMeshOffset = (RIG_PRIM.arm && RIG_PRIM.arm.mesh_offset) || [0, -0.42, 0];
        var hipLeftOffset = (RIG_PRIM.leg && RIG_PRIM.leg.hip_left_offset) || [-0.18, 0.6, 0];
        var hipRightOffset = (RIG_PRIM.leg && RIG_PRIM.leg.hip_right_offset) || [0.18, 0.6, 0];
        var legMeshOffset = (RIG_PRIM.leg && RIG_PRIM.leg.mesh_offset) || [0, -0.45, 0];
        var coreOffset = (RIG_PRIM.anchors && RIG_PRIM.anchors.core) || [0, 1.0, 0];

        var body = new THREE.Mesh(new THREE.BoxGeometry(bodySize[0], bodySize[1], bodySize[2]), bodyMat);
        body.position.set(bodyOffset[0], bodyOffset[1], bodyOffset[2]);
        root.add(body);

        var head = new THREE.Mesh(new THREE.BoxGeometry(headSize[0], headSize[1], headSize[2]), skinMat);
        head.position.set(headOffset[0], headOffset[1], headOffset[2]);
        root.add(head);

        var shoulderLeft = new THREE.Group();
        shoulderLeft.position.set(shoulderLeftOffset[0], shoulderLeftOffset[1], shoulderLeftOffset[2]);
        var armL = new THREE.Mesh(new THREE.BoxGeometry(armSize[0], armSize[1], armSize[2]), skinMat);
        armL.position.set(armMeshOffset[0], armMeshOffset[1], armMeshOffset[2]);
        shoulderLeft.add(armL);
        root.add(shoulderLeft);

        var shoulderRight = new THREE.Group();
        shoulderRight.position.set(shoulderRightOffset[0], shoulderRightOffset[1], shoulderRightOffset[2]);
        var armR = new THREE.Mesh(new THREE.BoxGeometry(armSize[0], armSize[1], armSize[2]), skinMat);
        armR.position.set(armMeshOffset[0], armMeshOffset[1], armMeshOffset[2]);
        shoulderRight.add(armR);
        root.add(shoulderRight);

        var hipLeft = new THREE.Group();
        hipLeft.position.set(hipLeftOffset[0], hipLeftOffset[1], hipLeftOffset[2]);
        var legL = new THREE.Mesh(new THREE.BoxGeometry(legSize[0], legSize[1], legSize[2]), legMat);
        legL.position.set(legMeshOffset[0], legMeshOffset[1], legMeshOffset[2]);
        hipLeft.add(legL);
        root.add(hipLeft);

        var hipRight = new THREE.Group();
        hipRight.position.set(hipRightOffset[0], hipRightOffset[1], hipRightOffset[2]);
        var legR = new THREE.Mesh(new THREE.BoxGeometry(legSize[0], legSize[1], legSize[2]), legMat);
        legR.position.set(legMeshOffset[0], legMeshOffset[1], legMeshOffset[2]);
        hipRight.add(legR);
        root.add(hipRight);

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

        var supportHand = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.13, 0.13), skinMat);
        supportHand.position.set(-0.12, -0.03, -0.2);
        gun.add(supportHand);

        var primaryGrip = new THREE.Object3D();
        primaryGrip.position.set(0.08, -0.1, 0.02);
        gun.add(primaryGrip);

        var supportGrip = new THREE.Object3D();
        supportGrip.position.set(-0.16, -0.03, -0.2);
        gun.add(supportGrip);

        var muzzleMat = new THREE.MeshBasicMaterial({ color: ensureHex(options.muzzleColor, 0xffcc66) });
        var muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.08), muzzleMat);
        muzzle.position.set(0, 0, -0.58);
        muzzle.visible = false;
        gun.add(muzzle);

        root.add(gun);

        var coreAnchor = new THREE.Object3D();
        coreAnchor.position.set(coreOffset[0], coreOffset[1], coreOffset[2]);
        root.add(coreAnchor);

        var rig = {
            armL: shoulderLeft,
            armR: shoulderRight,
            legL: hipLeft,
            legR: hipRight,
            armLMesh: armL,
            armRMesh: armR,
            legLMesh: legL,
            legRMesh: legR,
            supportHand: supportHand,
            primaryGrip: primaryGrip,
            supportGrip: supportGrip,
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
            twoHanded: true,
            weaponId: 'rifle',
            gaitPhase: Math.random() * Math.PI * 2,
            aimPitch: 0,
            gripMode: 'two_hand',
            motion: {
                speedNorm: 0,
                sprinting: false,
                grounded: true,
                strafing: false,
                animState: 'idle'
            },
            action: {
                aiming: true,
                firing: false,
                recoil: 0
            },
            baseGunRotX: 0
        };

        var styles = WEAPON_STYLES;

        function setWeapon(weaponId) {
            var style = styles[weaponId] || styles.rifle;
            rig.weaponId = (styles[weaponId] ? weaponId : 'rifle');
            rig.twoHanded = !!style.twoHanded;
            rig.gripMode = rig.twoHanded ? 'two_hand' : 'one_hand';

            rig.gun.position.set(style.gunPos[0], style.gunPos[1], style.gunPos[2]);
            rig.gun.rotation.set(style.gunRot[0], style.gunRot[1], style.gunRot[2]);
            rig.baseGunRotX = style.gunRot[0] || 0;

            setPart(rig.gunBody, style.body);
            setPart(rig.gunBarrel, style.barrel);
            setPart(rig.gunStock, style.stock);
            setPart(rig.gunGrip, style.grip);

            rig.scope.visible = !!style.scope;
            rig.pump.visible = !!style.pump;
            rig.coil.visible = !!style.coil;
            rig.supportHand.visible = !!style.twoHanded;
            if (style.primaryGripPos) {
                rig.primaryGrip.position.set(style.primaryGripPos[0], style.primaryGripPos[1], style.primaryGripPos[2]);
            }
            if (style.supportGripPos) {
                rig.supportGrip.position.set(style.supportGripPos[0], style.supportGripPos[1], style.supportGripPos[2]);
            }
            rig.muzzle.position.set(style.muzzlePos[0], style.muzzlePos[1], style.muzzlePos[2]);
        }

        function updateAimPitch(pitch) {
            rig.aimPitch = Math.max(-1.1, Math.min(1.1, pitch || 0));
        }

        function setMotionState(state) {
            state = state || {};
            var m = rig.motion;
            m.speedNorm = Math.max(0, Math.min(1.4, Number(state.speedNorm || 0)));
            m.sprinting = !!state.sprinting;
            m.grounded = (typeof state.grounded === 'boolean') ? state.grounded : true;
            m.strafing = !!state.strafing;
            var requested = String(state.animState || '');
            var useRequested = requested === 'idle' || requested === 'walk' || requested === 'run' ||
                requested === 'sprint' || requested === 'airborne' || requested === 'strafe';

            if (useRequested) m.animState = requested;
            else if (!m.grounded) m.animState = 'airborne';
            else if (m.speedNorm < 0.05) m.animState = 'idle';
            else if (m.strafing) m.animState = 'strafe';
            else if (m.sprinting || m.speedNorm >= 0.95) m.animState = 'sprint';
            else if (m.speedNorm >= 0.48) m.animState = 'run';
            else m.animState = 'walk';
        }

        function setActionState(state) {
            state = state || {};
            var a = rig.action;
            if (typeof state.aiming === 'boolean') a.aiming = state.aiming;
            if (state.firing) {
                a.firing = true;
                a.recoil = Math.max(a.recoil, 0.16);
            } else {
                a.firing = false;
            }
        }

        var WORLD_DOWN = new THREE.Vector3(0, -1, 0);
        var shoulderWorld = new THREE.Vector3();
        var gripWorld = new THREE.Vector3();
        var armDir = new THREE.Vector3();
        var parentWorldQuat = new THREE.Quaternion();
        var parentInvQuat = new THREE.Quaternion();
        var armWorldQuat = new THREE.Quaternion();
        var armLocalQuat = new THREE.Quaternion();

        function solveArmToGrip(arm, grip, tweak) {
            if (!arm || !grip || !arm.parent) return false;

            arm.getWorldPosition(shoulderWorld);
            grip.getWorldPosition(gripWorld);
            armDir.copy(gripWorld).sub(shoulderWorld);
            var lenSq = armDir.lengthSq();
            if (lenSq < 1e-8) return false;
            armDir.multiplyScalar(1 / Math.sqrt(lenSq));

            armWorldQuat.setFromUnitVectors(WORLD_DOWN, armDir);
            arm.parent.getWorldQuaternion(parentWorldQuat);
            parentInvQuat.copy(parentWorldQuat).invert();
            armLocalQuat.copy(parentInvQuat).multiply(armWorldQuat);
            arm.quaternion.copy(armLocalQuat);

            if (tweak) {
                if (typeof tweak.x === 'number') arm.rotateX(tweak.x);
                if (typeof tweak.y === 'number') arm.rotateY(tweak.y);
                if (typeof tweak.z === 'number') arm.rotateZ(tweak.z);
            }
            return true;
        }

        function updatePose(dt, forcedPhase) {
            dt = Math.max(0, dt || 0);
            var m = rig.motion;
            var a = rig.action;

            var speedNorm = m.speedNorm;
            if (typeof forcedPhase === 'number' && isFinite(forcedPhase)) {
                rig.gaitPhase = forcedPhase;
            } else if (speedNorm > 0.02) {
                var freq = (m.animState === 'sprint') ? 14 : (m.animState === 'run' ? 11 : 8.2);
                if (m.animState === 'strafe') freq = 10;
                rig.gaitPhase += dt * (freq * (0.32 + speedNorm));
            }

            a.recoil -= dt * 1.25;
            if (a.recoil < 0) a.recoil = 0;
            var recoilKick = a.recoil * 0.22;

            var legAmp = 0.08 + speedNorm * 0.38;
            if (m.animState === 'sprint') legAmp += 0.14;
            if (m.animState === 'airborne') legAmp = 0.04;
            if (legAmp > 0.66) legAmp = 0.66;

            var legSwing = Math.sin(rig.gaitPhase) * legAmp;
            var strafeSwing = Math.cos(rig.gaitPhase) * legAmp * 0.65;
            if (m.animState === 'strafe') {
                rig.legL.rotation.x = strafeSwing;
                rig.legR.rotation.x = -strafeSwing;
                rig.legL.rotation.z = -0.08;
                rig.legR.rotation.z = 0.08;
            } else {
                rig.legL.rotation.x = legSwing;
                rig.legR.rotation.x = -legSwing;
                rig.legL.rotation.z = 0;
                rig.legR.rotation.z = 0;
            }

            var aimBias = rig.aimPitch * 0.24;
            var bob = Math.sin(rig.gaitPhase * 2.0) * Math.min(0.03, speedNorm * 0.04);
            rig.gun.rotation.x = rig.baseGunRotX + bob - (recoilKick * 0.4);

            // Solve both shoulder poses against weapon grip anchors for stable gun hold.
            root.updateMatrixWorld(true);

            if (rig.twoHanded) {
                var handNoise = Math.sin(rig.gaitPhase * 2.1) * Math.min(0.045, speedNorm * 0.032);
                solveArmToGrip(rig.armR, rig.primaryGrip, {
                    x: -0.08 - (aimBias * 0.26) - (recoilKick * 0.42) + handNoise,
                    y: 0.04,
                    z: 0.04
                });
                solveArmToGrip(rig.armL, rig.supportGrip, {
                    x: 0.05 - (aimBias * 0.18) - (recoilKick * 0.24) - handNoise,
                    y: -0.08,
                    z: -0.05
                });
            } else {
                solveArmToGrip(rig.armR, rig.primaryGrip, {
                    x: -0.07 - (aimBias * 0.22) - (recoilKick * 0.48),
                    y: 0.05,
                    z: 0.04
                });

                var offSwing = Math.sin(rig.gaitPhase + Math.PI) * (0.08 + speedNorm * 0.24);
                if (offSwing > 0.38) offSwing = 0.38;
                if (offSwing < -0.38) offSwing = -0.38;
                rig.armL.rotation.x = offSwing * 0.92;
                rig.armL.rotation.y = -0.02;
                rig.armL.rotation.z = -0.08;
            }
        }

        function updateLocomotion(speedNorm, sprinting, dt) {
            setMotionState({
                speedNorm: speedNorm,
                sprinting: sprinting,
                grounded: true,
                strafing: false
            });
            updatePose(dt);
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
        setMotionState({ speedNorm: 0, sprinting: false, grounded: true, strafing: false });
        setActionState({ aiming: true, firing: false });
        updatePose(0);

        return {
            root: root,
            rig: rig,
            setWeapon: setWeapon,
            setMotionState: setMotionState,
            setActionState: setActionState,
            updatePose: updatePose,
            updateLocomotion: updateLocomotion,
            updateAimPitch: updateAimPitch,
            getCoreWorldPosition: getCoreWorldPosition,
            getMuzzleWorldPosition: getMuzzleWorldPosition,
            setMuzzleVisible: setMuzzleVisible,
            getWeaponId: function () { return rig.weaponId; },
            getAnimState: function () {
                return {
                    animState: rig.motion.animState,
                    animPhase: rig.gaitPhase,
                    gripMode: rig.gripMode,
                    aimPitch: rig.aimPitch
                };
            },
            _tmp: tmpVec
        };
    };

    window.GameAvatarRig = GameAvatarRig;
})();
