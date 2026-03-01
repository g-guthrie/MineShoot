/**
 * avatar-rig.js - Shared blocky humanoid rig for player/enemy/remote visuals
 * Loaded as global: window.GameAvatarRig
 */
(function () {
    'use strict';

    var GameAvatarRig = {};

    var PRIM = window.__GAME_PRIMITIVES__ || {};
    var RIG_PRIM = PRIM.rig || {};
    var COORD = window.__GAME_COORD_SYSTEM__ || {};

    function ensureHex(value, fallback) {
        return (typeof value === 'number' && isFinite(value)) ? value : fallback;
    }

    function toVec3(raw, fallback) {
        var src = Array.isArray(raw) ? raw : fallback;
        return {
            x: Number(src && src[0]) || 0,
            y: Number(src && src[1]) || 0,
            z: Number(src && src[2]) || 0
        };
    }

    function applyVec3(target, vec) {
        target.set(vec.x, vec.y, vec.z);
    }

    function setPart(mesh, style) {
        if (!mesh || !style) return;
        if (style.p) mesh.position.set(style.p[0], style.p[1], style.p[2]);
        if (style.s) mesh.scale.set(style.s[0], style.s[1], style.s[2]);
        if (typeof style.c === 'number' && mesh.material && mesh.material.color) {
            mesh.material.color.setHex(style.c);
        }
    }

    function makeMesh(size, material) {
        return new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), material);
    }

    function makePivot(parent, id, posVec) {
        var node = new THREE.Group();
        if (id) node.name = id;
        if (posVec) applyVec3(node.position, posVec);
        if (parent) parent.add(node);
        return node;
    }

    function getWeaponProfiles() {
        var src = (RIG_PRIM.weapon_profiles && typeof RIG_PRIM.weapon_profiles === 'object')
            ? RIG_PRIM.weapon_profiles
            : {};

        var fallback = {
            rifle: {
                twoHanded: true,
                gunPos: [0.12, 1.0, 0.28],
                gunRot: [0, 0, 0],
                primaryGripPos: [0.08, -0.1, 0.02],
                supportGripPos: [-0.16, -0.03, -0.2],
                body: { p: [0, 0.0, -0.06], s: [1.0, 1.0, 1.0], c: 0x333333 },
                barrel: { p: [0, 0.02, -0.36], s: [1.0, 1.0, 1.0], c: 0x222222 },
                stock: { p: [0, -0.04, 0.14], s: [1.0, 1.0, 1.0], c: 0x7a512d },
                grip: { p: [0, -0.1, 0.02], s: [1.0, 1.0, 1.0], c: 0x7a512d },
                scope: false,
                pump: false,
                coil: false,
                muzzlePos: [0, 0.02, -0.56]
            }
        };

        if (!src.rifle) src.rifle = fallback.rifle;
        return src;
    }

    GameAvatarRig.create = function (_kind, options) {
        options = options || {};

        var coordsPrim = PRIM.coords || {};
        var anchorsPrim = RIG_PRIM.anchors || {};
        var animPrim = RIG_PRIM.animation || {};
        var profiles = getWeaponProfiles();

        var bodySize = toVec3(RIG_PRIM.body && RIG_PRIM.body.size, [0.8, 1.0, 0.5]);
        var bodyOffset = toVec3(RIG_PRIM.body && RIG_PRIM.body.offset, [0, 1.0, 0]);
        var headSize = toVec3(RIG_PRIM.head && RIG_PRIM.head.size, [0.55, 0.55, 0.55]);
        var headOffset = toVec3(RIG_PRIM.head && RIG_PRIM.head.offset, [0, 1.8, 0]);

        var armSize = toVec3(RIG_PRIM.arm && RIG_PRIM.arm.size, [0.22, 0.85, 0.22]);
        var armMeshOffset = toVec3(RIG_PRIM.arm && RIG_PRIM.arm.mesh_offset, [0, -0.42, 0]);
        var shoulderLeftOffset = toVec3(RIG_PRIM.arm && RIG_PRIM.arm.shoulder_left_offset, [-0.43, 1.37, 0]);
        var shoulderRightOffset = toVec3(RIG_PRIM.arm && RIG_PRIM.arm.shoulder_right_offset, [0.43, 1.37, 0]);

        var legSize = toVec3(RIG_PRIM.leg && RIG_PRIM.leg.size, [0.28, 0.9, 0.28]);
        var legMeshOffset = toVec3(RIG_PRIM.leg && RIG_PRIM.leg.mesh_offset, [0, -0.45, 0]);
        var hipLeftOffset = toVec3(RIG_PRIM.leg && RIG_PRIM.leg.hip_left_offset, [-0.18, 0.6, 0]);
        var hipRightOffset = toVec3(RIG_PRIM.leg && RIG_PRIM.leg.hip_right_offset, [0.18, 0.6, 0]);

        var root = makePivot(null, 'root');

        var bodyMat = new THREE.MeshLambertMaterial({ color: ensureHex(options.bodyColor, 0x4a7fc1) });
        var skinMat = new THREE.MeshLambertMaterial({ color: ensureHex(options.skinColor, 0xd2a77d) });
        var legMat = new THREE.MeshLambertMaterial({ color: ensureHex(options.legColor, 0x2f2f2f) });

        var gunDark = new THREE.MeshLambertMaterial({ color: 0x2a2a2a });
        var gunDarker = new THREE.MeshLambertMaterial({ color: 0x161616 });
        var gunWood = new THREE.MeshLambertMaterial({ color: 0x8b5a2b });
        var gunMetal = new THREE.MeshLambertMaterial({ color: 0x666666 });

        var nodes = {
            root: root,
            body: makePivot(root, 'body', bodyOffset),
            head: makePivot(root, 'head', headOffset),
            shoulder_l: makePivot(root, 'shoulder_l', shoulderLeftOffset),
            arm_l: null,
            shoulder_r: makePivot(root, 'shoulder_r', shoulderRightOffset),
            arm_r: null,
            hip_l: makePivot(root, 'hip_l', hipLeftOffset),
            leg_l: null,
            hip_r: makePivot(root, 'hip_r', hipRightOffset),
            leg_r: null,
            aim_pivot: null,
            weapon_mount: null,
            core_anchor: makePivot(root, 'core_anchor', toVec3(anchorsPrim.core, [0, Number(coordsPrim.core_anchor_offset_y || 1), 0])),
            overhead_anchor: makePivot(root, 'overhead_anchor', toVec3(anchorsPrim.overhead, [0, Number(coordsPrim.overhead_bar_offset_y || 2.9), 0])),
            muzzle_socket: null
        };

        var bodyMesh = makeMesh(bodySize, bodyMat);
        nodes.body.add(bodyMesh);

        var headMesh = makeMesh(headSize, skinMat);
        nodes.head.add(headMesh);

        nodes.arm_l = makePivot(nodes.shoulder_l, 'arm_l', toVec3([0, 0, 0], [0, 0, 0]));
        var armLMesh = makeMesh(armSize, skinMat);
        applyVec3(armLMesh.position, armMeshOffset);
        nodes.arm_l.add(armLMesh);

        nodes.arm_r = makePivot(nodes.shoulder_r, 'arm_r', toVec3([0, 0, 0], [0, 0, 0]));
        var armRMesh = makeMesh(armSize, skinMat);
        applyVec3(armRMesh.position, armMeshOffset);
        nodes.arm_r.add(armRMesh);

        nodes.leg_l = makePivot(nodes.hip_l, 'leg_l', toVec3([0, 0, 0], [0, 0, 0]));
        var legLMesh = makeMesh(legSize, legMat);
        applyVec3(legLMesh.position, legMeshOffset);
        nodes.leg_l.add(legLMesh);

        nodes.leg_r = makePivot(nodes.hip_r, 'leg_r', toVec3([0, 0, 0], [0, 0, 0]));
        var legRMesh = makeMesh(legSize, legMat);
        applyVec3(legRMesh.position, legMeshOffset);
        nodes.leg_r.add(legRMesh);

        nodes.aim_pivot = makePivot(root, 'aim_pivot', toVec3([0, Number(coordsPrim.core_anchor_offset_y || 1), 0], [0, 1, 0]));
        nodes.weapon_mount = makePivot(nodes.aim_pivot, 'weapon_mount', toVec3([0.12, 1, 0.28], [0.12, 1, 0.28]));

        var gun = makePivot(nodes.weapon_mount, 'weapon');
        var gunBody = makeMesh(toVec3([0.14, 0.1, 0.55], [0.14, 0.1, 0.55]), gunDark);
        gunBody.position.z = -0.04;
        gun.add(gunBody);

        var gunBarrel = makeMesh(toVec3([0.08, 0.08, 0.26], [0.08, 0.08, 0.26]), gunDarker);
        gunBarrel.position.z = -0.42;
        gun.add(gunBarrel);

        var gunStock = makeMesh(toVec3([0.12, 0.11, 0.16], [0.12, 0.11, 0.16]), gunWood);
        gunStock.position.set(0, -0.03, 0.13);
        gun.add(gunStock);

        var gunGrip = makeMesh(toVec3([0.08, 0.14, 0.08], [0.08, 0.14, 0.08]), gunWood);
        gunGrip.position.set(0, -0.11, 0.03);
        gun.add(gunGrip);

        var scope = makeMesh(toVec3([0.09, 0.08, 0.23], [0.09, 0.08, 0.23]), gunMetal);
        scope.position.set(0, 0.09, -0.21);
        scope.visible = false;
        gun.add(scope);

        var pump = makeMesh(toVec3([0.12, 0.08, 0.12], [0.12, 0.08, 0.12]), gunWood);
        pump.position.set(0, -0.03, -0.33);
        pump.visible = false;
        gun.add(pump);

        var coil = makeMesh(toVec3([0.11, 0.11, 0.11], [0.11, 0.11, 0.11]), gunMetal);
        coil.position.set(0, -0.1, -0.1);
        coil.visible = false;
        gun.add(coil);

        var supportHand = makeMesh(toVec3([0.13, 0.13, 0.13], [0.13, 0.13, 0.13]), skinMat);
        supportHand.position.set(-0.12, -0.03, -0.2);
        gun.add(supportHand);

        nodes.muzzle_socket = makePivot(gun, 'muzzle_socket', toVec3([0, 0.02, -0.56], [0, 0.02, -0.56]));

        var muzzleMat = new THREE.MeshBasicMaterial({ color: ensureHex(options.muzzleColor, 0xffcc66) });
        var muzzleVisual = makeMesh(toVec3([0.08, 0.08, 0.08], [0.08, 0.08, 0.08]), muzzleMat);
        muzzleVisual.visible = false;
        nodes.muzzle_socket.add(muzzleVisual);

        var rig = {
            armL: nodes.shoulder_l,
            armR: nodes.shoulder_r,
            legL: nodes.hip_l,
            legR: nodes.hip_r,
            armLMesh: armLMesh,
            armRMesh: armRMesh,
            legLMesh: legLMesh,
            legRMesh: legRMesh,
            supportHand: supportHand,
            gun: gun,
            gunBody: gunBody,
            gunBarrel: gunBarrel,
            gunStock: gunStock,
            gunGrip: gunGrip,
            scope: scope,
            pump: pump,
            coil: coil,
            muzzle: muzzleVisual,
            muzzleSocket: nodes.muzzle_socket,
            coreAnchor: nodes.core_anchor,
            overheadAnchor: nodes.overhead_anchor,
            weaponMount: nodes.weapon_mount,
            aimPivot: nodes.aim_pivot,
            nodes: nodes,
            twoHanded: true,
            weaponId: 'rifle',
            gaitPhase: Math.random() * Math.PI * 2,
            aimPitch: 0
        };

        var tmpVec = new THREE.Vector3();

        function getProfile(weaponId) {
            var id = (typeof weaponId === 'string' && profiles[weaponId]) ? weaponId : 'rifle';
            return {
                id: id,
                cfg: profiles[id] || profiles.rifle
            };
        }

        function setWeapon(weaponId) {
            var profile = getProfile(weaponId);
            var style = profile.cfg;

            rig.weaponId = profile.id;
            rig.twoHanded = !!style.twoHanded;

            if (style.gunPos) {
                nodes.weapon_mount.position.set(style.gunPos[0], style.gunPos[1], style.gunPos[2]);
            }
            if (style.gunRot) {
                nodes.weapon_mount.rotation.set(style.gunRot[0], style.gunRot[1], style.gunRot[2]);
            } else {
                nodes.weapon_mount.rotation.set(0, 0, 0);
            }

            setPart(gunBody, style.body);
            setPart(gunBarrel, style.barrel);
            setPart(gunStock, style.stock);
            setPart(gunGrip, style.grip);

            supportHand.visible = !!style.twoHanded;
            if (style.supportGripPos) {
                supportHand.position.set(style.supportGripPos[0], style.supportGripPos[1], style.supportGripPos[2]);
            }

            scope.visible = !!style.scope;
            pump.visible = !!style.pump;
            coil.visible = !!style.coil;

            if (style.muzzlePos) {
                nodes.muzzle_socket.position.set(style.muzzlePos[0], style.muzzlePos[1], style.muzzlePos[2]);
            }
        }

        function updateAimPitch(pitch) {
            var p = Number(pitch || 0);
            if (COORD && typeof COORD.clampPitch === 'function') {
                p = COORD.clampPitch(p);
            } else {
                p = Math.max(-1.5533430342749532, Math.min(1.5533430342749532, p));
            }
            rig.aimPitch = p;
        }

        function updateLocomotion(speedNorm, sprinting, dt) {
            var speed = Math.max(0, Math.min(1.4, Number(speedNorm || 0)));
            var isSprinting = !!sprinting;
            var delta = Math.max(0, Number(dt || 0));

            if (speed > 0.02) {
                var walkFreq = Number(animPrim.walk_freq || 8.2);
                var runFreq = Number(animPrim.run_freq || 11);
                var sprintFreq = Number(animPrim.sprint_freq || 14);
                var freq = isSprinting ? sprintFreq : (speed > 0.45 ? runFreq : walkFreq);
                var gaitBase = Number(animPrim.gait_speed_scale_base || 0.32);
                var gaitRange = Number(animPrim.gait_speed_scale_range || 1.0);
                rig.gaitPhase += delta * (freq * (gaitBase + speed * gaitRange));
            }

            var legAmp = Number(animPrim.leg_amp_idle || 0.08) + speed * Number(animPrim.leg_amp_scale || 0.38);
            if (isSprinting) legAmp += Number(animPrim.leg_amp_sprint_boost || 0.14);
            var legAmpMax = Number(animPrim.leg_amp_max || 0.66);
            if (legAmp > legAmpMax) legAmp = legAmpMax;

            var walkSwing = Math.sin(rig.gaitPhase) * legAmp;
            var sideSwing = -walkSwing * 0.75;
            rig.legL.rotation.x = walkSwing;
            rig.legR.rotation.x = -walkSwing;

            var aimBias = rig.aimPitch * 0.2;
            if (rig.twoHanded) {
                rig.armR.rotation.x = -0.36 - aimBias + Math.sin(rig.gaitPhase * 2.1) * 0.03;
                rig.armR.rotation.z = 0.12;
                rig.armL.rotation.x = -0.32 - aimBias + Math.cos(rig.gaitPhase * 2.0) * 0.03;
                rig.armL.rotation.z = -0.12;
            } else {
                rig.armR.rotation.x = -0.42 - aimBias;
                rig.armR.rotation.z = 0.14;
                rig.armL.rotation.x = sideSwing;
                rig.armL.rotation.z = -0.04;
            }

            nodes.head.rotation.x = rig.aimPitch * 0.12;
            nodes.aim_pivot.rotation.x = -rig.aimPitch * 0.18;
        }

        function updatePose(state, dt) {
            state = (state && typeof state === 'object') ? state : {};
            if (state.equippedWeaponId || state.weaponId) {
                setWeapon(state.equippedWeaponId || state.weaponId);
            }
            if (typeof state.aimPitch === 'number' && isFinite(state.aimPitch)) {
                updateAimPitch(state.aimPitch);
            }
            updateLocomotion(state.moveSpeedNorm || 0, !!state.sprinting, dt);
        }

        function getSocketWorldPosition(socketId, outVec3) {
            var out = outVec3 || new THREE.Vector3();
            var key = String(socketId || '');
            if (key === 'core') key = 'core_anchor';
            if (key === 'muzzle') key = 'muzzle_socket';
            if (key === 'overhead') key = 'overhead_anchor';
            var socket = nodes[key];
            if (!socket || !socket.getWorldPosition) return null;
            socket.getWorldPosition(out);
            return out;
        }

        function getCoreWorldPosition(outVec3) {
            return getSocketWorldPosition('core_anchor', outVec3 || tmpVec) || (outVec3 || tmpVec);
        }

        function getMuzzleWorldPosition(outVec3) {
            return getSocketWorldPosition('muzzle_socket', outVec3 || tmpVec) || (outVec3 || tmpVec);
        }

        function setMuzzleVisible(visible) {
            if (!muzzleVisual) return;
            var show = !!visible;
            muzzleVisual.visible = show;
            if (rig.weaponId === 'plasma' && muzzleVisual.material && muzzleVisual.material.color) {
                muzzleVisual.material.color.setHex(show ? 0x66ddff : 0x44aacc);
            }
        }

        root.userData.bodyParts = [bodyMesh, headMesh, armLMesh, armRMesh, legLMesh, legRMesh];
        root.userData.originalColor = ensureHex(options.bodyColor, 0x4a7fc1);
        root.userData.weaponMuzzle = muzzleVisual;
        root.userData.rig = rig;
        root.userData.rigNodes = nodes;

        setWeapon(options.weaponId || 'rifle');
        updateAimPitch(0);
        updateLocomotion(0, false, 0);

        return {
            root: root,
            rig: rig,
            nodes: nodes,
            setWeapon: setWeapon,
            updateLocomotion: updateLocomotion,
            updateAimPitch: updateAimPitch,
            updatePose: updatePose,
            getSocketWorldPosition: getSocketWorldPosition,
            getCoreWorldPosition: getCoreWorldPosition,
            getMuzzleWorldPosition: getMuzzleWorldPosition,
            setMuzzleVisible: setMuzzleVisible,
            getWeaponId: function () { return rig.weaponId; },
            _tmp: tmpVec
        };
    };

    window.GameAvatarRig = GameAvatarRig;
})();
