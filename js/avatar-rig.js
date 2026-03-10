/**
 * avatar-rig.js - Shared blocky humanoid rig for player/enemy/remote visuals
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameAvatarRig
 */
(function () {
    'use strict';

    var GameAvatarRig = {};
    var DEG_TO_RAD = Math.PI / 180;
    // Local rig axes:
    //   +X = actor right
    //   -X = actor left
    //   +Y = up
    //   -Y = down
    //   -Z = forward / face / muzzle direction
    //   +Z = backward
    var ARM_SHORT_SIDE = 0.22;
    var HALF_ARM_SHORT_SIDE = ARM_SHORT_SIDE * 0.5;
    var GUN_MOUNT_SHIFT_X = -0.08;
    var GUN_MOUNT_LIFT_Y = 0.1 + HALF_ARM_SHORT_SIDE;
    var GUN_MOUNT_SHIFT_Z = -HALF_ARM_SHORT_SIDE;
    var FOOT_PLANE_OFFSET_Y = 0.3;
    var HEAD_EYE_Y = 0.06;
    var HEAD_EYE_Z = -0.282;
    var HEAD_EYE_X = 0.12;
    var SHOULDER_LEFT_DEFAULT = { x: -0.52, y: 0, z: 0 };
    var SHOULDER_RIGHT_DEFAULT = { x: 0.52, y: 0, z: 0 };
    var FP_SHOULDER_LEFT_DEFAULT = { x: -0.18, y: FOOT_PLANE_OFFSET_Y + 1.1, z: -0.12 };
    var FP_SHOULDER_RIGHT_DEFAULT = { x: 0.18, y: FOOT_PLANE_OFFSET_Y + 1.1, z: -0.12 };
    var LEFT_PALM_NEUTRAL = { x: -0.01, y: -0.84, z: -0.03 };
    var RIGHT_PALM_SOCKET = { x: 0.015, y: -0.98, z: -0.01 };
    var HANDLE_ANCHOR_NAME = 'weaponHandleAnchor';
    var BARREL_TIP_ANCHOR_NAME = 'weaponBarrelTipAnchor';
    var DEFAULT_GRIP_PROFILE = {
        supportMode: 'right',
        thirdLeftShoulder: [0.1, 0.02, -0.05],
        thirdRightShoulder: [-0.04, 0.01, -0.01],
        thirdLeftPalm: [-0.01, -0.9, -0.04],
        thirdRightPalm: [0.015, -0.98, -0.01],
        thirdLeftPalmRot: [0.08, -0.05, -0.18],
        thirdRightPalmRot: [0.02, 0.05, 0.18],
        rightArm: {
            baseX: 1.2,
            aimScale: 0.28,
            fireScale: 0.14,
            shoulderY: 0.02,
            shoulderZ: -0.14,
            sprintX: 0.92,
            sprintY: 0.12,
            sprintZ: 0.2,
            strafeLeftY: 0.12,
            strafeRightY: -0.08
        },
        leftArmTarget: {
            x: 0.28,
            y: -0.08,
            z: -0.22,
            fireZScale: 0.05,
            aimXScale: 0.12
        },
        torsoPitch: -0.03,
        torsoPitchSpeed: 0.02,
        torsoStrafe: 0.08,
        headPitchScale: -0.08,
        firstPerson: {
            leftShoulder: [0.05, 0.0, -0.05],
            rightShoulder: [-0.01, 0.0, 0.0],
            leftPalm: [-0.01, -0.9, -0.04],
            rightPalm: [0.015, -0.98, -0.01],
            leftPalmRot: [0.06, -0.05, -0.2],
            rightPalmRot: [0.02, 0.04, 0.16],
            rightArm: {
                baseX: 1.26,
                aimScale: 0.12,
                fireScale: 0.12,
                adsY: -0.04,
                hipY: 0.03,
                adsZ: -0.08,
                hipZ: -0.14
            },
            leftArmTarget: {
                x: 0.34,
                y: -0.26,
                z: -0.28,
                aimXScale: 0.1,
                fireZScale: 0.05
            },
            gunOffset: [0.08, 0.12, -0.18],
            adsOffset: [0.01, -0.02, -0.03],
            gunRot: [-0.18, 0, -0.04],
            adsGunRot: [0, 0.015, 0.02],
            swayX: 0.5,
            bobY: 1,
            bobZ: 0.32
        }
    };
    var WEAPON_GRIP_PROFILES = {
        pistol: {
            supportMode: 'right',
            thirdLeftShoulder: [0.14, 0.05, 0.02],
            thirdRightShoulder: [-0.06, 0.02, 0.0],
            thirdLeftPalm: [0.0, -0.82, 0.03],
            thirdLeftPalmRot: [0.16, 0.02, -0.26],
            leftArmTarget: {
                x: 0.38,
                y: 0.02,
                z: -0.08,
                fireZScale: 0.04,
                aimXScale: 0.08
            },
            firstPerson: {
                leftShoulder: [0.09, 0.03, 0.02],
                leftPalm: [0.0, -0.82, 0.03],
                leftPalmRot: [0.14, 0.04, -0.24],
                gunOffset: [0.095, 0.135, -0.16],
                adsOffset: [0.008, -0.018, -0.02],
                gunRot: [-0.14, 0.01, -0.015],
                adsGunRot: [0, 0.01, 0.03]
            }
        },
        rifle: {
            supportMode: 'right'
        },
        machinegun: {
            supportMode: 'right',
            thirdLeftShoulder: [0.12, 0.03, -0.08],
            thirdRightShoulder: [-0.05, 0.02, -0.02],
            firstPerson: {
                gunOffset: [0.075, 0.115, -0.19],
                adsOffset: [0.0, -0.015, -0.03]
            }
        },
        shotgun: {
            supportMode: 'right',
            thirdLeftShoulder: [0.11, 0.03, -0.07],
            thirdRightShoulder: [-0.05, 0.02, -0.01],
            firstPerson: {
                gunOffset: [0.08, 0.115, -0.185],
                adsOffset: [0.005, -0.018, -0.022]
            }
        },
        sniper: {
            supportMode: 'both',
            thirdLeftShoulder: [0.1, 0.01, -0.09],
            thirdRightShoulder: [-0.04, 0.01, -0.02],
            torsoPitch: -0.05,
            firstPerson: {
                gunOffset: [0.075, 0.11, -0.205],
                adsOffset: [0.0, -0.022, -0.038],
                gunRot: [-0.2, 0, -0.03]
            }
        },
        seekergun: {
            supportMode: 'right',
            thirdLeftShoulder: [0.1, 0.03, -0.06],
            thirdRightShoulder: [-0.03, 0.02, -0.01]
        }
    };

    function ensureHex(value, fallback) {
        return (typeof value === 'number' && isFinite(value)) ? value : fallback;
    }

    function createNamedGroup(name) {
        var group = new THREE.Group();
        group.name = name;
        return group;
    }

    function createNamedMesh(name, geometry, material) {
        var mesh = new THREE.Mesh(geometry, material);
        mesh.name = name;
        return mesh;
    }

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function lerp(a, b, t) {
        return a + (b - a) * clamp(t, 0, 1);
    }

    function hasOwn(obj, key) {
        return !!obj && Object.prototype.hasOwnProperty.call(obj, key);
    }

    function cloneArray(arr, fallback) {
        if (!arr || !arr.length) return fallback.slice();
        return arr.slice();
    }

    function cloneGripProfile(base) {
        return {
            supportMode: base.supportMode || 'both',
            thirdLeftShoulder: cloneArray(base.thirdLeftShoulder, [0, 0, 0]),
            thirdRightShoulder: cloneArray(base.thirdRightShoulder, [0, 0, 0]),
            thirdLeftPalm: cloneArray(base.thirdLeftPalm, [LEFT_PALM_NEUTRAL.x, LEFT_PALM_NEUTRAL.y, LEFT_PALM_NEUTRAL.z]),
            thirdRightPalm: cloneArray(base.thirdRightPalm, [RIGHT_PALM_SOCKET.x, RIGHT_PALM_SOCKET.y, RIGHT_PALM_SOCKET.z]),
            thirdLeftPalmRot: cloneArray(base.thirdLeftPalmRot, [0, 0, 0]),
            thirdRightPalmRot: cloneArray(base.thirdRightPalmRot, [0, 0, 0]),
            rightArm: {
                baseX: base.rightArm && typeof base.rightArm.baseX === 'number' ? base.rightArm.baseX : DEFAULT_GRIP_PROFILE.rightArm.baseX,
                aimScale: base.rightArm && typeof base.rightArm.aimScale === 'number' ? base.rightArm.aimScale : DEFAULT_GRIP_PROFILE.rightArm.aimScale,
                fireScale: base.rightArm && typeof base.rightArm.fireScale === 'number' ? base.rightArm.fireScale : DEFAULT_GRIP_PROFILE.rightArm.fireScale,
                shoulderY: base.rightArm && typeof base.rightArm.shoulderY === 'number' ? base.rightArm.shoulderY : DEFAULT_GRIP_PROFILE.rightArm.shoulderY,
                shoulderZ: base.rightArm && typeof base.rightArm.shoulderZ === 'number' ? base.rightArm.shoulderZ : DEFAULT_GRIP_PROFILE.rightArm.shoulderZ,
                sprintX: base.rightArm && typeof base.rightArm.sprintX === 'number' ? base.rightArm.sprintX : DEFAULT_GRIP_PROFILE.rightArm.sprintX,
                sprintY: base.rightArm && typeof base.rightArm.sprintY === 'number' ? base.rightArm.sprintY : DEFAULT_GRIP_PROFILE.rightArm.sprintY,
                sprintZ: base.rightArm && typeof base.rightArm.sprintZ === 'number' ? base.rightArm.sprintZ : DEFAULT_GRIP_PROFILE.rightArm.sprintZ,
                strafeLeftY: base.rightArm && typeof base.rightArm.strafeLeftY === 'number' ? base.rightArm.strafeLeftY : DEFAULT_GRIP_PROFILE.rightArm.strafeLeftY,
                strafeRightY: base.rightArm && typeof base.rightArm.strafeRightY === 'number' ? base.rightArm.strafeRightY : DEFAULT_GRIP_PROFILE.rightArm.strafeRightY
            },
            leftArmTarget: {
                x: base.leftArmTarget && typeof base.leftArmTarget.x === 'number' ? base.leftArmTarget.x : DEFAULT_GRIP_PROFILE.leftArmTarget.x,
                y: base.leftArmTarget && typeof base.leftArmTarget.y === 'number' ? base.leftArmTarget.y : DEFAULT_GRIP_PROFILE.leftArmTarget.y,
                z: base.leftArmTarget && typeof base.leftArmTarget.z === 'number' ? base.leftArmTarget.z : DEFAULT_GRIP_PROFILE.leftArmTarget.z,
                fireZScale: base.leftArmTarget && typeof base.leftArmTarget.fireZScale === 'number' ? base.leftArmTarget.fireZScale : DEFAULT_GRIP_PROFILE.leftArmTarget.fireZScale,
                aimXScale: base.leftArmTarget && typeof base.leftArmTarget.aimXScale === 'number' ? base.leftArmTarget.aimXScale : DEFAULT_GRIP_PROFILE.leftArmTarget.aimXScale
            },
            torsoPitch: typeof base.torsoPitch === 'number' ? base.torsoPitch : DEFAULT_GRIP_PROFILE.torsoPitch,
            torsoPitchSpeed: typeof base.torsoPitchSpeed === 'number' ? base.torsoPitchSpeed : DEFAULT_GRIP_PROFILE.torsoPitchSpeed,
            torsoStrafe: typeof base.torsoStrafe === 'number' ? base.torsoStrafe : DEFAULT_GRIP_PROFILE.torsoStrafe,
            headPitchScale: typeof base.headPitchScale === 'number' ? base.headPitchScale : DEFAULT_GRIP_PROFILE.headPitchScale,
            firstPerson: {
                leftShoulder: cloneArray(base.firstPerson && base.firstPerson.leftShoulder, DEFAULT_GRIP_PROFILE.firstPerson.leftShoulder),
                rightShoulder: cloneArray(base.firstPerson && base.firstPerson.rightShoulder, DEFAULT_GRIP_PROFILE.firstPerson.rightShoulder),
                leftPalm: cloneArray(base.firstPerson && base.firstPerson.leftPalm, DEFAULT_GRIP_PROFILE.firstPerson.leftPalm),
                rightPalm: cloneArray(base.firstPerson && base.firstPerson.rightPalm, DEFAULT_GRIP_PROFILE.firstPerson.rightPalm),
                leftPalmRot: cloneArray(base.firstPerson && base.firstPerson.leftPalmRot, DEFAULT_GRIP_PROFILE.firstPerson.leftPalmRot),
                rightPalmRot: cloneArray(base.firstPerson && base.firstPerson.rightPalmRot, DEFAULT_GRIP_PROFILE.firstPerson.rightPalmRot),
                rightArm: {
                    baseX: base.firstPerson && base.firstPerson.rightArm && typeof base.firstPerson.rightArm.baseX === 'number' ? base.firstPerson.rightArm.baseX : DEFAULT_GRIP_PROFILE.firstPerson.rightArm.baseX,
                    aimScale: base.firstPerson && base.firstPerson.rightArm && typeof base.firstPerson.rightArm.aimScale === 'number' ? base.firstPerson.rightArm.aimScale : DEFAULT_GRIP_PROFILE.firstPerson.rightArm.aimScale,
                    fireScale: base.firstPerson && base.firstPerson.rightArm && typeof base.firstPerson.rightArm.fireScale === 'number' ? base.firstPerson.rightArm.fireScale : DEFAULT_GRIP_PROFILE.firstPerson.rightArm.fireScale,
                    adsY: base.firstPerson && base.firstPerson.rightArm && typeof base.firstPerson.rightArm.adsY === 'number' ? base.firstPerson.rightArm.adsY : DEFAULT_GRIP_PROFILE.firstPerson.rightArm.adsY,
                    hipY: base.firstPerson && base.firstPerson.rightArm && typeof base.firstPerson.rightArm.hipY === 'number' ? base.firstPerson.rightArm.hipY : DEFAULT_GRIP_PROFILE.firstPerson.rightArm.hipY,
                    adsZ: base.firstPerson && base.firstPerson.rightArm && typeof base.firstPerson.rightArm.adsZ === 'number' ? base.firstPerson.rightArm.adsZ : DEFAULT_GRIP_PROFILE.firstPerson.rightArm.adsZ,
                    hipZ: base.firstPerson && base.firstPerson.rightArm && typeof base.firstPerson.rightArm.hipZ === 'number' ? base.firstPerson.rightArm.hipZ : DEFAULT_GRIP_PROFILE.firstPerson.rightArm.hipZ
                },
                leftArmTarget: {
                    x: base.firstPerson && base.firstPerson.leftArmTarget && typeof base.firstPerson.leftArmTarget.x === 'number' ? base.firstPerson.leftArmTarget.x : DEFAULT_GRIP_PROFILE.firstPerson.leftArmTarget.x,
                    y: base.firstPerson && base.firstPerson.leftArmTarget && typeof base.firstPerson.leftArmTarget.y === 'number' ? base.firstPerson.leftArmTarget.y : DEFAULT_GRIP_PROFILE.firstPerson.leftArmTarget.y,
                    z: base.firstPerson && base.firstPerson.leftArmTarget && typeof base.firstPerson.leftArmTarget.z === 'number' ? base.firstPerson.leftArmTarget.z : DEFAULT_GRIP_PROFILE.firstPerson.leftArmTarget.z,
                    aimXScale: base.firstPerson && base.firstPerson.leftArmTarget && typeof base.firstPerson.leftArmTarget.aimXScale === 'number' ? base.firstPerson.leftArmTarget.aimXScale : DEFAULT_GRIP_PROFILE.firstPerson.leftArmTarget.aimXScale,
                    fireZScale: base.firstPerson && base.firstPerson.leftArmTarget && typeof base.firstPerson.leftArmTarget.fireZScale === 'number' ? base.firstPerson.leftArmTarget.fireZScale : DEFAULT_GRIP_PROFILE.firstPerson.leftArmTarget.fireZScale
                },
                gunOffset: cloneArray(base.firstPerson && base.firstPerson.gunOffset, DEFAULT_GRIP_PROFILE.firstPerson.gunOffset),
                adsOffset: cloneArray(base.firstPerson && base.firstPerson.adsOffset, DEFAULT_GRIP_PROFILE.firstPerson.adsOffset),
                gunRot: cloneArray(base.firstPerson && base.firstPerson.gunRot, DEFAULT_GRIP_PROFILE.firstPerson.gunRot),
                adsGunRot: cloneArray(base.firstPerson && base.firstPerson.adsGunRot, DEFAULT_GRIP_PROFILE.firstPerson.adsGunRot),
                swayX: base.firstPerson && typeof base.firstPerson.swayX === 'number' ? base.firstPerson.swayX : DEFAULT_GRIP_PROFILE.firstPerson.swayX,
                bobY: base.firstPerson && typeof base.firstPerson.bobY === 'number' ? base.firstPerson.bobY : DEFAULT_GRIP_PROFILE.firstPerson.bobY,
                bobZ: base.firstPerson && typeof base.firstPerson.bobZ === 'number' ? base.firstPerson.bobZ : DEFAULT_GRIP_PROFILE.firstPerson.bobZ
            }
        };
    }

    function weaponGripProfile(weaponId) {
        var profile = cloneGripProfile(DEFAULT_GRIP_PROFILE);
        var overrides = WEAPON_GRIP_PROFILES[weaponId] || null;
        if (!overrides) return profile;
        var key;
        for (key in overrides) {
            if (!hasOwn(overrides, key) || key === 'firstPerson' || key === 'rightArm' || key === 'leftArmTarget') continue;
            profile[key] = Array.isArray(overrides[key]) ? overrides[key].slice() : overrides[key];
        }
        if (overrides.rightArm) {
            for (key in overrides.rightArm) {
                if (hasOwn(overrides.rightArm, key)) profile.rightArm[key] = overrides.rightArm[key];
            }
        }
        if (overrides.leftArmTarget) {
            for (key in overrides.leftArmTarget) {
                if (hasOwn(overrides.leftArmTarget, key)) profile.leftArmTarget[key] = overrides.leftArmTarget[key];
            }
        }
        if (overrides.firstPerson) {
            if (overrides.firstPerson.leftShoulder) profile.firstPerson.leftShoulder = overrides.firstPerson.leftShoulder.slice();
            if (overrides.firstPerson.rightShoulder) profile.firstPerson.rightShoulder = overrides.firstPerson.rightShoulder.slice();
            if (overrides.firstPerson.leftPalm) profile.firstPerson.leftPalm = overrides.firstPerson.leftPalm.slice();
            if (overrides.firstPerson.rightPalm) profile.firstPerson.rightPalm = overrides.firstPerson.rightPalm.slice();
            if (overrides.firstPerson.leftPalmRot) profile.firstPerson.leftPalmRot = overrides.firstPerson.leftPalmRot.slice();
            if (overrides.firstPerson.rightPalmRot) profile.firstPerson.rightPalmRot = overrides.firstPerson.rightPalmRot.slice();
            if (overrides.firstPerson.gunOffset) profile.firstPerson.gunOffset = overrides.firstPerson.gunOffset.slice();
            if (overrides.firstPerson.adsOffset) profile.firstPerson.adsOffset = overrides.firstPerson.adsOffset.slice();
            if (overrides.firstPerson.gunRot) profile.firstPerson.gunRot = overrides.firstPerson.gunRot.slice();
            if (overrides.firstPerson.adsGunRot) profile.firstPerson.adsGunRot = overrides.firstPerson.adsGunRot.slice();
            if (typeof overrides.firstPerson.swayX === 'number') profile.firstPerson.swayX = overrides.firstPerson.swayX;
            if (typeof overrides.firstPerson.bobY === 'number') profile.firstPerson.bobY = overrides.firstPerson.bobY;
            if (typeof overrides.firstPerson.bobZ === 'number') profile.firstPerson.bobZ = overrides.firstPerson.bobZ;
            if (overrides.firstPerson.rightArm) {
                for (key in overrides.firstPerson.rightArm) {
                    if (hasOwn(overrides.firstPerson.rightArm, key)) profile.firstPerson.rightArm[key] = overrides.firstPerson.rightArm[key];
                }
            }
            if (overrides.firstPerson.leftArmTarget) {
                for (key in overrides.firstPerson.leftArmTarget) {
                    if (hasOwn(overrides.firstPerson.leftArmTarget, key)) profile.firstPerson.leftArmTarget[key] = overrides.firstPerson.leftArmTarget[key];
                }
            }
        }
        return profile;
    }

    function smoothstep(t) {
        t = clamp(t, 0, 1);
        return t * t * (3 - (2 * t));
    }

    function easeOutCubic(t) {
        t = clamp(t, 0, 1);
        var inv = 1 - t;
        return 1 - (inv * inv * inv);
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

    function weaponModelLoader() {
        return globalThis.__MAYHEM_RUNTIME.GameThreeModelLoader || null;
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

    function setObjectLayerRecursive(object, layer) {
        if (!object || !object.traverse) return;
        object.traverse(function (node) {
            if (node && node.layers) {
                node.layers.set(layer);
            }
        });
    }

    GameAvatarRig.create = function (kind, options) {
        options = options || {};

        var root = createNamedGroup('root');
        var thirdPerson = createNamedGroup('third-person');
        thirdPerson.position.y = FOOT_PLANE_OFFSET_Y;
        root.add(thirdPerson);

        var upper = createNamedGroup('upper');
        thirdPerson.add(upper);

        var lower = createNamedGroup('lower');
        thirdPerson.add(lower);

        var bodyMat = new THREE.MeshLambertMaterial({ color: ensureHex(options.bodyColor, 0x4a7fc1) });
        var skinMat = new THREE.MeshLambertMaterial({ color: ensureHex(options.skinColor, 0xd2a77d) });
        var legMat = new THREE.MeshLambertMaterial({ color: ensureHex(options.legColor, 0x2f2f2f) });
        var gunDark = new THREE.MeshLambertMaterial({ color: 0x2a2a2a });
        var gunDarker = new THREE.MeshLambertMaterial({ color: 0x161616 });
        var gunWood = new THREE.MeshLambertMaterial({ color: 0x8b5a2b });
        var gunMetal = new THREE.MeshLambertMaterial({ color: 0x666666 });
        var eyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });

        var torso = createNamedGroup('torso');
        torso.position.y = 1.0;
        upper.add(torso);

        var body = createNamedMesh('torso-geo', new THREE.BoxGeometry(0.8, 1.0, 0.5), bodyMat);
        torso.add(body);

        var torsoAnchor = createNamedGroup('torso-anchor');
        torso.add(torsoAnchor);

        var mountAnchor = createNamedGroup('mount-anchor');
        mountAnchor.position.set(0, -0.47, 0);
        torso.add(mountAnchor);

        var backAnchor = createNamedGroup('back-anchor');
        backAnchor.position.set(0, 0.0, 0.26);
        torso.add(backAnchor);

        var neck = createNamedGroup('neck');
        neck.position.y = 1.48;
        upper.add(neck);

        var head = createNamedGroup('head');
        head.position.y = 0.32;
        neck.add(head);

        var headGeo = createNamedMesh('head-geo', new THREE.BoxGeometry(0.55, 0.55, 0.55), skinMat);
        head.add(headGeo);
        var eyeLeft = addXEye(headGeo, -HEAD_EYE_X, eyeMat);
        var eyeRight = addXEye(headGeo, HEAD_EYE_X, eyeMat);

        var headAnchor = createNamedGroup('head-anchor');
        headAnchor.position.set(0, 0.24, 0);
        head.add(headAnchor);

        var eyesAnchor = createNamedGroup('eyes-anchor');
        eyesAnchor.position.set(0, HEAD_EYE_Y, HEAD_EYE_Z);
        head.add(eyesAnchor);

        var eyeAnchor = eyesAnchor;

        var cameraAnchor = createNamedGroup('camera-anchor');
        cameraAnchor.position.set(0, FOOT_PLANE_OFFSET_Y + 1.86, 0);
        root.add(cameraAnchor);

        var arms = createNamedGroup('arms');
        arms.position.set(0, 1.37, 0);
        upper.add(arms);

        var shoulderLeft = createNamedGroup('arm-left');
        shoulderLeft.position.set(SHOULDER_LEFT_DEFAULT.x, SHOULDER_LEFT_DEFAULT.y, SHOULDER_LEFT_DEFAULT.z);
        var armL = createNamedMesh('arm-left-geo', new THREE.BoxGeometry(0.22, 0.85, 0.22), skinMat);
        armL.position.y = -0.42;
        shoulderLeft.add(armL);
        var palmLeft = createNamedGroup('hand-left');
        palmLeft.position.set(LEFT_PALM_NEUTRAL.x, LEFT_PALM_NEUTRAL.y, LEFT_PALM_NEUTRAL.z);
        var handLeftAnchor = createNamedGroup('hand-left-anchor');
        palmLeft.add(handLeftAnchor);
        shoulderLeft.add(palmLeft);
        arms.add(shoulderLeft);

        var shoulderRight = createNamedGroup('arm-right');
        shoulderRight.position.set(SHOULDER_RIGHT_DEFAULT.x, SHOULDER_RIGHT_DEFAULT.y, SHOULDER_RIGHT_DEFAULT.z);
        var armR = createNamedMesh('arm-right-geo', new THREE.BoxGeometry(0.22, 0.85, 0.22), skinMat);
        armR.position.y = -0.42;
        shoulderRight.add(armR);

        var palmRight = createNamedGroup('hand-right');
        palmRight.position.set(RIGHT_PALM_SOCKET.x, RIGHT_PALM_SOCKET.y, RIGHT_PALM_SOCKET.z);
        var handRightAnchor = createNamedGroup('hand-right-anchor');
        palmRight.add(handRightAnchor);
        var weaponMountAnchor = createNamedGroup('weapon-mount-anchor');
        handRightAnchor.add(weaponMountAnchor);
        shoulderRight.add(palmRight);
        arms.add(shoulderRight);

        var hipLeft = createNamedGroup('leg-left');
        hipLeft.position.set(-0.18, 0.6, 0);
        var legL = createNamedMesh('leg-left-geo', new THREE.BoxGeometry(0.28, 0.9, 0.28), legMat);
        legL.position.y = -0.45;
        hipLeft.add(legL);
        lower.add(hipLeft);

        var hipRight = createNamedGroup('leg-right');
        hipRight.position.set(0.18, 0.6, 0);
        var legR = createNamedMesh('leg-right-geo', new THREE.BoxGeometry(0.28, 0.9, 0.28), legMat);
        legR.position.y = -0.45;
        hipRight.add(legR);
        lower.add(hipRight);

        var firstPerson = createNamedGroup('first-person');
        firstPerson.visible = false;
        root.add(firstPerson);

        var bobRoot = createNamedGroup('bob-root');
        firstPerson.add(bobRoot);

        var fpShoulderLeft = createNamedGroup('arm-left-fp');
        fpShoulderLeft.position.set(FP_SHOULDER_LEFT_DEFAULT.x, FP_SHOULDER_LEFT_DEFAULT.y, FP_SHOULDER_LEFT_DEFAULT.z);
        var fpArmL = createNamedMesh('arm-left-fp-geo', new THREE.BoxGeometry(0.22, 0.85, 0.22), skinMat);
        fpArmL.position.y = -0.42;
        fpShoulderLeft.add(fpArmL);
        var fpPalmLeft = createNamedGroup('hand-left-fp');
        fpPalmLeft.position.set(LEFT_PALM_NEUTRAL.x, LEFT_PALM_NEUTRAL.y, LEFT_PALM_NEUTRAL.z);
        var fpHandLeftAnchor = createNamedGroup('hand-left-anchor-fp');
        fpPalmLeft.add(fpHandLeftAnchor);
        fpShoulderLeft.add(fpPalmLeft);
        bobRoot.add(fpShoulderLeft);

        var fpShoulderRight = createNamedGroup('arm-right-fp');
        fpShoulderRight.position.set(FP_SHOULDER_RIGHT_DEFAULT.x, FP_SHOULDER_RIGHT_DEFAULT.y, FP_SHOULDER_RIGHT_DEFAULT.z);
        var fpArmR = createNamedMesh('arm-right-fp-geo', new THREE.BoxGeometry(0.22, 0.85, 0.22), skinMat);
        fpArmR.position.y = -0.42;
        fpShoulderRight.add(fpArmR);
        var fpPalmRight = createNamedGroup('hand-right-fp');
        fpPalmRight.position.set(RIGHT_PALM_SOCKET.x, RIGHT_PALM_SOCKET.y, RIGHT_PALM_SOCKET.z);
        var fpHandRightAnchor = createNamedGroup('hand-right-anchor-fp');
        fpPalmRight.add(fpHandRightAnchor);
        var fpWeaponMountAnchor = createNamedGroup('weapon-mount-anchor-fp');
        fpHandRightAnchor.add(fpWeaponMountAnchor);
        fpShoulderRight.add(fpPalmRight);
        bobRoot.add(fpShoulderRight);

        var gun = createNamedGroup('equipped-weapon');
        var weaponModelRoot = createNamedGroup('weapon-model-root');
        gun.add(weaponModelRoot);
        var gunBody = createNamedMesh('weapon-body', new THREE.BoxGeometry(0.14, 0.1, 0.55), gunDark);
        gunBody.position.z = -0.04;
        gun.add(gunBody);

        var gunBarrel = createNamedMesh('weapon-barrel', new THREE.BoxGeometry(0.08, 0.08, 0.26), gunDarker);
        gunBarrel.position.z = -0.42;
        gun.add(gunBarrel);

        var gunStock = createNamedMesh('weapon-stock', new THREE.BoxGeometry(0.12, 0.11, 0.16), gunWood);
        gunStock.position.set(0, -0.03, 0.13);
        gun.add(gunStock);

        var gunGrip = createNamedMesh('weapon-grip', new THREE.BoxGeometry(0.08, 0.14, 0.08), gunWood);
        gunGrip.position.set(0, -0.11, 0.03);
        gun.add(gunGrip);

        var scope = createNamedMesh('weapon-scope', new THREE.BoxGeometry(0.09, 0.08, 0.23), gunMetal);
        scope.position.set(0, 0.09, -0.21);
        scope.visible = false;
        gun.add(scope);

        var pump = createNamedMesh('weapon-pump', new THREE.BoxGeometry(0.12, 0.08, 0.12), gunWood);
        pump.position.set(0, -0.03, -0.33);
        pump.visible = false;
        gun.add(pump);

        var coil = createNamedMesh('weapon-coil', new THREE.BoxGeometry(0.11, 0.11, 0.11), gunMetal);
        coil.position.set(0, -0.1, -0.1);
        coil.visible = false;
        gun.add(coil);

        var muzzleMat = new THREE.MeshBasicMaterial({ color: ensureHex(options.muzzleColor, 0xffcc66) });
        var muzzle = createNamedMesh('weapon-muzzle-flash', new THREE.BoxGeometry(0.08, 0.08, 0.08), muzzleMat);
        muzzle.position.set(0, 0, -0.58);
        muzzle.visible = false;
        gun.add(muzzle);

        var handleAnchor = new THREE.Object3D();
        handleAnchor.name = HANDLE_ANCHOR_NAME;
        gun.add(handleAnchor);

        var barrelTipAnchor = new THREE.Object3D();
        barrelTipAnchor.name = BARREL_TIP_ANCHOR_NAME;
        gun.add(barrelTipAnchor);

        weaponMountAnchor.add(gun);

        var supportAnchor = new THREE.Object3D();
        supportAnchor.position.set(0, -0.01, -0.28);
        gun.add(supportAnchor);

        var coreAnchor = torsoAnchor;

        var throwableOriginAnchor = new THREE.Object3D();
        throwableOriginAnchor.position.set(0.01, -0.02, -0.12);
        handLeftAnchor.add(throwableOriginAnchor);

        var namedNodes = {
            root: root,
            'third-person': thirdPerson,
            'first-person': firstPerson,
            'first-person/bob-root': bobRoot,
            upper: upper,
            lower: lower,
            torso: torso,
            'torso-geo': body,
            'torso-anchor': torsoAnchor,
            'mount-anchor': mountAnchor,
            'back-anchor': backAnchor,
            neck: neck,
            head: head,
            'head-geo': headGeo,
            'head-anchor': headAnchor,
            'eyes-anchor': eyesAnchor,
            arms: arms,
            'arm-left': shoulderLeft,
            'arm-left-geo': armL,
            'hand-left': palmLeft,
            'hand-left-anchor': handLeftAnchor,
            'arm-right': shoulderRight,
            'arm-right-geo': armR,
            'hand-right': palmRight,
            'hand-right-anchor': handRightAnchor,
            'weapon-mount-anchor': weaponMountAnchor,
            'leg-left': hipLeft,
            'leg-left-geo': legL,
            'leg-right': hipRight,
            'leg-right-geo': legR,
            'camera-anchor': cameraAnchor,
            'first-person/arm-left': fpShoulderLeft,
            'first-person/arm-left-geo': fpArmL,
            'first-person/hand-left': fpPalmLeft,
            'first-person/hand-left-anchor': fpHandLeftAnchor,
            'first-person/arm-right': fpShoulderRight,
            'first-person/arm-right-geo': fpArmR,
            'first-person/hand-right': fpPalmRight,
            'first-person/hand-right-anchor': fpHandRightAnchor,
            'first-person/weapon-mount-anchor': fpWeaponMountAnchor
        };

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
            headMesh: headGeo,
            gun: gun,
            weaponModelRoot: weaponModelRoot,
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
            torso: torso,
            neck: neck,
            head: head,
            upper: upper,
            lower: lower,
            thirdPerson: thirdPerson,
            torsoAnchor: torsoAnchor,
            mountAnchor: mountAnchor,
            backAnchor: backAnchor,
            headAnchor: headAnchor,
            eyesAnchor: eyesAnchor,
            cameraAnchor: cameraAnchor,
            handLeftAnchor: handLeftAnchor,
            handRightAnchor: handRightAnchor,
            weaponMountAnchor: weaponMountAnchor,
            firstPerson: firstPerson,
            bobRoot: bobRoot,
            fpArmL: fpShoulderLeft,
            fpArmR: fpShoulderRight,
            fpArmLMesh: fpArmL,
            fpArmRMesh: fpArmR,
            fpPalmLeft: fpPalmLeft,
            fpPalmRight: fpPalmRight,
            fpHandLeftAnchor: fpHandLeftAnchor,
            fpHandRightAnchor: fpHandRightAnchor,
            fpWeaponMountAnchor: fpWeaponMountAnchor,
            namedNodes: namedNodes,
            weaponClass: 'gun',
            weaponId: 'rifle',
            gaitPhase: Math.random() * Math.PI * 2,
            aimPitch: 0,
            gunBasePos: new THREE.Vector3(),
            gunBaseRot: new THREE.Vector3(),
            supportBasePos: new THREE.Vector3(),
            gripProfile: weaponGripProfile(String(options.weaponId || 'rifle')),
            footPlaneOffsetY: FOOT_PLANE_OFFSET_Y,
            firstPersonActive: false,
            gunParentMode: 'third',
            currentUpperAnimation: 'idle-gun-both',
            currentLowerAnimation: 'idle-lower',
            currentFirstPersonAnimation: 'idle-base',
            upperTrack: null,
            lowerTrack: null,
            firstPersonTrack: null,
            firePoseTimer: 0,
            firePoseStrength: 0,
            lastMuzzleVisible: false
        };

        var weaponModelRequestToken = 0;

        function setProceduralWeaponVisible(visible, parts) {
            var show = !!visible;
            var partDefs = parts || {};
            rig.gunBody.visible = show && !!partDefs.body;
            rig.gunBarrel.visible = show && !!partDefs.barrel;
            rig.gunStock.visible = show && !!partDefs.stock;
            rig.gunGrip.visible = show && !!partDefs.grip;
            rig.scope.visible = show && !!partDefs.scope;
            rig.pump.visible = show && !!partDefs.pump;
            rig.coil.visible = show && !!partDefs.coil;
        }

        function clearWeaponModel() {
            while (weaponModelRoot.children.length) {
                weaponModelRoot.remove(weaponModelRoot.children[0]);
            }
        }

        function applyWeaponModelTransform(model, spec) {
            var transform = spec || {};
            var pos = Array.isArray(transform.position) ? transform.position : [0, 0, 0];
            var rot = Array.isArray(transform.rotation) ? transform.rotation : [0, 0, 0];
            var scale = Array.isArray(transform.scale) ? transform.scale : [1, 1, 1];
            model.position.set(pos[0], pos[1], pos[2]);
            model.rotation.set(rot[0], rot[1], rot[2]);
            model.scale.set(scale[0], scale[1], scale[2]);
        }

        function syncWeaponModel(modelSpec, parts) {
            weaponModelRequestToken += 1;
            var requestToken = weaponModelRequestToken;
            clearWeaponModel();
            setProceduralWeaponVisible(true, parts);
            if (!modelSpec || !modelSpec.url) return;
            var loader = weaponModelLoader();
            if (!loader || !loader.load) return;
            loader.load(modelSpec).then(function (model) {
                if (requestToken !== weaponModelRequestToken || !model) return;
                clearWeaponModel();
                applyWeaponModelTransform(model, modelSpec);
                setObjectLayerRecursive(model, rig.firstPersonActive ? 1 : 0);
                weaponModelRoot.add(model);
                setProceduralWeaponVisible(false, parts);
            }).catch(function (err) {
                console.warn('Failed to load weapon model:', err);
                if (requestToken !== weaponModelRequestToken) return;
                clearWeaponModel();
                setProceduralWeaponVisible(true, parts);
            });
        }

        function attachGunToMount(mode) {
            var nextMode = mode === 'first' ? 'first' : 'third';
            var targetMount = nextMode === 'first' ? rig.fpWeaponMountAnchor : rig.weaponMountAnchor;
            if (!targetMount) return;
            if (rig.gun.parent !== targetMount) {
                targetMount.attach(rig.gun);
            }
            rig.gunParentMode = nextMode;
        }

        function setFirstPersonActive(active) {
            rig.firstPersonActive = !!active;
            rig.thirdPerson.visible = !rig.firstPersonActive;
            rig.firstPerson.visible = rig.firstPersonActive;
            attachGunToMount(rig.firstPersonActive ? 'first' : 'third');
            setObjectLayerRecursive(rig.firstPerson, rig.firstPersonActive ? 1 : 0);
            setObjectLayerRecursive(rig.gun, rig.firstPersonActive ? 1 : 0);
        }

        function setWeapon(weaponId) {
            var resolved = resolveWeaponEntry(weaponId);
            var visual = resolved && resolved.visual ? resolved.visual : null;
            var mount = visual && visual.mount ? visual.mount : null;
            var model = visual && visual.model ? visual.model : null;
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
            rig.gripProfile = weaponGripProfile(rig.weaponId);

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

            rig.muzzle.position.set(muzzlePos[0], muzzlePos[1], muzzlePos[2]);
            rig.supportAnchor.position.set(rig.supportBasePos.x, rig.supportBasePos.y, rig.supportBasePos.z);
            setAnchorPosition(rig.gun, HANDLE_ANCHOR_NAME, handlePos);
            setAnchorPosition(rig.gun, BARREL_TIP_ANCHOR_NAME, barrelTipPos);
            attachGunToMount(rig.firstPersonActive ? 'first' : 'third');
            syncWeaponModel(model, parts);
        }

        function updateAimPitch(pitch) {
            rig.aimPitch = clamp(pitch || 0, -1.1, 1.1);
        }

        var thirdPersonAnimationNames = [
            'idle-upper', 'idle-lower', 'walk-upper', 'walk-lower', 'run-upper', 'run-lower',
            'sneak-upper', 'sneak-lower', 'sneak-idle-upper', 'sneak-idle-lower', 'climbing',
            'crawling', 'sleep', 'simple-interact', 'jump-pre', 'jump-loop', 'jump-post-light',
            'jump-post-heavy', 'carry-upper', 'idle-mounted-upper', 'idle-mounted-lower',
            'idle-gun-left', 'idle-gun-right', 'idle-gun-both', 'shoot-gun-left', 'shoot-gun-right',
            'shoot-gun-both', 'walk-strafe-left-upper', 'walk-strafe-left-lower',
            'walk-strafe-right-upper', 'walk-strafe-right-lower', 'run-strafe-left-upper',
            'run-strafe-left-lower', 'run-strafe-right-upper', 'run-strafe-right-lower',
            'walk-backwards-upper', 'walk-backwards-lower', 'run-backwards-upper',
            'run-backwards-lower', 'swim-forward', 'swim-idle', 'swim-backwards',
            'sword-attack-upper', 'sword-attack-tornado', 'dodge-roll', 'damage-hit-upper',
            'consume-upper', 'foraging-transition', 'foraging-loop', 'combat-idle',
            'sword-attack-1', 'sword-attack-2', 'sword-attack-3', 'sword-attack-4', 'sword-attack-5',
            'shield-block (WIP)', 'emote-griddy', 'emote-annoyed', 'emote-ratdance',
            'sneak2-walk', 'sneak2-idle', 'run-slide', 'axe-chop-loop', 'death-kneel',
            'death-front', 'death-back', 'bow-draw', 'bow-draw-loop', 'bow-draw-shoot',
            'mining-loop', 'crouch-walk', 'crouch-idle', 'sit', 'sit-chair'
        ];

        var firstPersonAnimationNames = [
            'glock-idle', 'glock-aim', 'glock-shoot', 'glock-reload', 'glock-walk-bob',
            'glock-run-bob', 'm4a4-idle', 'm4a4-aim', 'm4a4-shoot', 'm4a4-reload',
            'm4a4-walk-bob', 'm4a4-run-bob', 'mp7-idle', 'mp7-aim', 'mp7-reload', 'mp7-shoot',
            'mp7-walk-bob', 'sway', 'draw', 'melee-idle', 'melee-punch-left',
            'melee-punch-right', 'idle-base', 'glider-start', 'glider-loop', 'ledge-pull', 'mp7-run'
        ];

        var thirdPersonAnimationDefinitions = {
            'idle-upper': { family: 'idle_upper', breath: 0.022, head: 0.04, shoulder: 0.04 },
            'idle-lower': { family: 'idle_lower', knee: 0.02, sway: 0.012 },
            'walk-upper': { family: 'gun_upper', style: 'forward', intensity: 0.7, sprint: false, support: 'both', ads: false, sway: 0.015 },
            'walk-lower': { family: 'locomotion_lower', style: 'forward', intensity: 0.7, sprint: false },
            'run-upper': { family: 'gun_upper', style: 'forward', intensity: 1.0, sprint: true, support: 'both', ads: false, sway: 0.03 },
            'run-lower': { family: 'locomotion_lower', style: 'forward', intensity: 1.0, sprint: true },
            'sneak-upper': { family: 'crouch_upper', intensity: 0.55, moving: true },
            'sneak-lower': { family: 'crouch_lower', intensity: 0.48, moving: true, alt: false },
            'sneak-idle-upper': { family: 'crouch_upper', intensity: 0.28, moving: false },
            'sneak-idle-lower': { family: 'crouch_lower', intensity: 0.24, moving: false, alt: false },
            'climbing': { family: 'climb', amplitude: 1.0, rate: 1.0 },
            'crawling': { family: 'crawl', amplitude: 0.34, rate: 1.0 },
            'sleep': { family: 'sleep', tilt: 1.0 },
            'simple-interact': { family: 'interact', reach: 0.58, lift: 0.24 },
            'jump-pre': { family: 'jump_pre', crouch: 0.3, arm: 0.18 },
            'jump-loop': { family: 'jump_loop', spread: 0.12, left: 0.26, right: 1.0 },
            'jump-post-light': { family: 'jump_post', landing: 0.24, heavy: false },
            'jump-post-heavy': { family: 'jump_post', landing: 0.34, heavy: true },
            'carry-upper': { family: 'carry', lift: 0.78, tuck: 0.16 },
            'idle-mounted-upper': { family: 'mounted_upper', reins: 0.22 },
            'idle-mounted-lower': { family: 'mounted_lower', bend: 1.28 },
            'idle-gun-left': { family: 'gun_upper', style: 'forward', intensity: 0.2, sprint: false, support: 'left', ads: true, sway: 0.018 },
            'idle-gun-right': { family: 'gun_upper', style: 'forward', intensity: 0.2, sprint: false, support: 'right', ads: true, sway: 0.018 },
            'idle-gun-both': { family: 'gun_upper', style: 'forward', intensity: 0.2, sprint: false, support: 'both', ads: true, sway: 0.018 },
            'shoot-gun-left': { family: 'gun_upper', style: 'forward', intensity: 0.22, sprint: false, support: 'left', ads: true, fire: 0.75 },
            'shoot-gun-right': { family: 'gun_upper', style: 'forward', intensity: 0.22, sprint: false, support: 'right', ads: true, fire: 0.82 },
            'shoot-gun-both': { family: 'gun_upper', style: 'forward', intensity: 0.22, sprint: false, support: 'both', ads: true, fire: 1.0 },
            'walk-strafe-left-upper': { family: 'gun_upper', style: 'strafe-left', intensity: 0.7, sprint: false, support: 'both', ads: false, sway: 0.02 },
            'walk-strafe-left-lower': { family: 'locomotion_lower', style: 'strafe-left', intensity: 0.7, sprint: false },
            'walk-strafe-right-upper': { family: 'gun_upper', style: 'strafe-right', intensity: 0.7, sprint: false, support: 'both', ads: false, sway: 0.02 },
            'walk-strafe-right-lower': { family: 'locomotion_lower', style: 'strafe-right', intensity: 0.7, sprint: false },
            'run-strafe-left-upper': { family: 'gun_upper', style: 'strafe-left', intensity: 1.0, sprint: true, support: 'both', ads: false, sway: 0.034 },
            'run-strafe-left-lower': { family: 'locomotion_lower', style: 'strafe-left', intensity: 1.0, sprint: true },
            'run-strafe-right-upper': { family: 'gun_upper', style: 'strafe-right', intensity: 1.0, sprint: true, support: 'both', ads: false, sway: 0.034 },
            'run-strafe-right-lower': { family: 'locomotion_lower', style: 'strafe-right', intensity: 1.0, sprint: true },
            'walk-backwards-upper': { family: 'gun_upper', style: 'backward', intensity: 0.7, sprint: false, support: 'both', ads: false, sway: 0.014 },
            'walk-backwards-lower': { family: 'locomotion_lower', style: 'backward', intensity: 0.7, sprint: false },
            'run-backwards-upper': { family: 'gun_upper', style: 'backward', intensity: 1.0, sprint: true, support: 'both', ads: false, sway: 0.026 },
            'run-backwards-lower': { family: 'locomotion_lower', style: 'backward', intensity: 1.0, sprint: true },
            'swim-forward': { family: 'swim', style: 'forward', amplitude: 0.26, pitch: 0.34 },
            'swim-idle': { family: 'swim', style: 'idle', amplitude: 0.08, pitch: 0.24 },
            'swim-backwards': { family: 'swim', style: 'backward', amplitude: 0.22, pitch: 0.3 },
            'sword-attack-upper': { family: 'sword', power: 0.72, twist: 0.2, dir: 1 },
            'sword-attack-tornado': { family: 'sword', power: 1.0, twist: 0.58, dir: 1 },
            'dodge-roll': { family: 'roll', lean: -0.42, crouch: 0.46 },
            'damage-hit-upper': { family: 'hit', twist: -0.14, flinch: 0.14 },
            'consume-upper': { family: 'consume', lift: 0.68, sip: 0.14 },
            'foraging-transition': { family: 'forage_transition', dip: 0.22, reach: 0.32 },
            'foraging-loop': { family: 'forage_loop', chop: 0.52, dip: 0.14 },
            'combat-idle': { family: 'combat_idle', tension: 0.1, sway: 0.02 },
            'sword-attack-1': { family: 'sword', power: 0.82, twist: 0.18, dir: 1 },
            'sword-attack-2': { family: 'sword', power: 0.84, twist: 0.2, dir: -1 },
            'sword-attack-3': { family: 'sword', power: 0.88, twist: 0.24, dir: 1 },
            'sword-attack-4': { family: 'sword', power: 0.92, twist: 0.28, dir: -1 },
            'sword-attack-5': { family: 'sword', power: 0.96, twist: 0.32, dir: 1 },
            'shield-block (WIP)': { family: 'shield', brace: 1.18 },
            'emote-griddy': { family: 'emote_griddy', leg: 0.5, torso: 0.24 },
            'emote-annoyed': { family: 'emote_annoyed', head: 0.28, slump: 0.08 },
            'emote-ratdance': { family: 'emote_ratdance', leg: 0.22, arm: 0.6 },
            'sneak2-walk': { family: 'crouch_lower', intensity: 0.56, moving: true, alt: true },
            'sneak2-idle': { family: 'crouch_lower', intensity: 0.3, moving: false, alt: true },
            'run-slide': { family: 'slide', lean: -0.3, crouch: 0.5 },
            'axe-chop-loop': { family: 'axe_loop', chop: 0.58, dip: 0.16 },
            'death-kneel': { family: 'death_kneel', collapse: 0.42 },
            'death-front': { family: 'death_front', collapse: 1.0 },
            'death-back': { family: 'death_back', collapse: 1.0 },
            'bow-draw': { family: 'bow', pull: 0.4, release: 0 },
            'bow-draw-loop': { family: 'bow', pull: 0.6, release: 0 },
            'bow-draw-shoot': { family: 'bow', pull: 0.9, release: 0.2 },
            'mining-loop': { family: 'mining', chop: 0.56, dip: 0.14 },
            'crouch-walk': { family: 'crouch_lower', intensity: 0.52, moving: true, alt: false },
            'crouch-idle': { family: 'crouch_lower', intensity: 0.28, moving: false, alt: false },
            'sit': { family: 'sit', bend: 1.28, recline: 0.03 },
            'sit-chair': { family: 'sit', bend: 1.28, recline: -0.08 }
        };

        var firstPersonAnimationDefinitions = {
            'glock-idle': { family: 'fp_weapon', weapon: 'glock', mode: 'idle', speed: 0.16, bias: -0.03 },
            'glock-aim': { family: 'fp_weapon', weapon: 'glock', mode: 'aim', speed: 0.12, bias: -0.02 },
            'glock-shoot': { family: 'fp_weapon', weapon: 'glock', mode: 'shoot', speed: 0.2, bias: -0.03 },
            'glock-reload': { family: 'fp_weapon', weapon: 'glock', mode: 'reload', speed: 0.18, bias: -0.03 },
            'glock-walk-bob': { family: 'fp_weapon', weapon: 'glock', mode: 'walk', speed: 0.72, bias: -0.03 },
            'glock-run-bob': { family: 'fp_weapon', weapon: 'glock', mode: 'run', speed: 1.0, bias: -0.03 },
            'm4a4-idle': { family: 'fp_weapon', weapon: 'm4a4', mode: 'idle', speed: 0.16, bias: 0 },
            'm4a4-aim': { family: 'fp_weapon', weapon: 'm4a4', mode: 'aim', speed: 0.12, bias: 0 },
            'm4a4-shoot': { family: 'fp_weapon', weapon: 'm4a4', mode: 'shoot', speed: 0.2, bias: 0 },
            'm4a4-reload': { family: 'fp_weapon', weapon: 'm4a4', mode: 'reload', speed: 0.18, bias: 0 },
            'm4a4-walk-bob': { family: 'fp_weapon', weapon: 'm4a4', mode: 'walk', speed: 0.72, bias: 0 },
            'm4a4-run-bob': { family: 'fp_weapon', weapon: 'm4a4', mode: 'run', speed: 1.0, bias: 0 },
            'mp7-idle': { family: 'fp_weapon', weapon: 'mp7', mode: 'idle', speed: 0.16, bias: 0.05 },
            'mp7-aim': { family: 'fp_weapon', weapon: 'mp7', mode: 'aim', speed: 0.12, bias: 0.05 },
            'mp7-reload': { family: 'fp_weapon', weapon: 'mp7', mode: 'reload', speed: 0.2, bias: 0.05 },
            'mp7-shoot': { family: 'fp_weapon', weapon: 'mp7', mode: 'shoot', speed: 0.22, bias: 0.05 },
            'mp7-walk-bob': { family: 'fp_weapon', weapon: 'mp7', mode: 'walk', speed: 0.74, bias: 0.05 },
            'sway': { family: 'fp_sway', sway: 0.01, bob: 0.008 },
            'draw': { family: 'fp_draw', lift: 0.06 },
            'melee-idle': { family: 'fp_melee_idle', guard: 1.0 },
            'melee-punch-left': { family: 'fp_melee_punch', side: 'left', power: 0.9 },
            'melee-punch-right': { family: 'fp_melee_punch', side: 'right', power: 0.9 },
            'idle-base': { family: 'fp_sway', sway: 0.01, bob: 0.008 },
            'glider-start': { family: 'fp_glider', spread: 0.42, dip: -0.04 },
            'glider-loop': { family: 'fp_glider', spread: 0.42, dip: -0.02 },
            'ledge-pull': { family: 'fp_ledge', lift: 0.06, tug: 0.16 },
            'mp7-run': { family: 'fp_weapon', weapon: 'mp7', mode: 'run', speed: 1.0, bias: 0.05, aggressive: true }
        };

        var armDown = new THREE.Vector3(0, -1, 0);
        var shoulderWorld = new THREE.Vector3();
        var targetWorld = new THREE.Vector3();
        var parentLocalA = new THREE.Vector3();
        var parentLocalB = new THREE.Vector3();
        var aimDir = new THREE.Vector3();
        var aimQuat = new THREE.Quaternion();
        var aimEuler = new THREE.Euler();

        function createTrackState(initialName) {
            return {
                from: initialName,
                to: initialName,
                startedAt: 0,
                duration: 0.0001
            };
        }

        rig.upperTrack = createTrackState(rig.currentUpperAnimation);
        rig.lowerTrack = createTrackState(rig.currentLowerAnimation);
        rig.firstPersonTrack = createTrackState(rig.currentFirstPersonAnimation);

        function transitionDurationForName(name, layer) {
            if (!name) return 0.14;
            if (name.indexOf('shoot') >= 0 || name.indexOf('attack') >= 0 || name === 'damage-hit-upper') return 0.07;
            if (name.indexOf('jump-') === 0 || name.indexOf('death') === 0 || name === 'dodge-roll' || name === 'run-slide') return 0.1;
            if (layer === 'fp' && (name.indexOf('reload') >= 0 || name === 'draw' || name === 'ledge-pull')) return 0.12;
            return layer === 'lower' ? 0.16 : 0.14;
        }

        function setTrackTarget(track, nextName, layer, nowSeconds) {
            var next = nextName || track.to;
            if (!next || track.to === next) return;
            var now = typeof nowSeconds === 'number' ? nowSeconds : (Date.now() * 0.001);
            var current = resolveTrackName(track, now);
            track.from = current;
            track.to = next;
            track.startedAt = now;
            track.duration = transitionDurationForName(next, layer);
        }

        function resolveTrackName(track, nowSeconds) {
            var now = typeof nowSeconds === 'number' ? nowSeconds : (Date.now() * 0.001);
            var duration = Math.max(0.0001, track.duration || 0.0001);
            var alpha = clamp((now - (track.startedAt || 0)) / duration, 0, 1);
            return alpha >= 1 ? track.to : track.to;
        }

        function trackBlendAlpha(track, nowSeconds) {
            var now = typeof nowSeconds === 'number' ? nowSeconds : (Date.now() * 0.001);
            var duration = Math.max(0.0001, track.duration || 0.0001);
            return clamp((now - (track.startedAt || 0)) / duration, 0, 1);
        }

        function setAnimationState(upperName, lowerName, fpName, nowSeconds) {
            var now = typeof nowSeconds === 'number' ? nowSeconds : (Date.now() * 0.001);
            if (upperName) {
                setTrackTarget(rig.upperTrack, upperName, 'upper', now);
                rig.currentUpperAnimation = upperName;
            }
            if (lowerName) {
                setTrackTarget(rig.lowerTrack, lowerName, 'lower', now);
                rig.currentLowerAnimation = lowerName;
            }
            if (fpName) {
                setTrackTarget(rig.firstPersonTrack, fpName, 'fp', now);
                rig.currentFirstPersonAnimation = fpName;
            }
        }

        function resetPose() {
            rig.upper.position.set(0, 0, 0);
            rig.upper.rotation.set(0, 0, 0);
            rig.lower.position.set(0, 0, 0);
            rig.lower.rotation.set(0, 0, 0);
            rig.torso.position.y = 1.0;
            rig.torso.rotation.set(0, 0, 0);
            neck.position.set(0, 1.48, 0);
            neck.rotation.set(0, 0, 0);
            head.position.set(0, 0.32, 0);
            head.rotation.set(0, 0, 0);
            arms.position.set(0, 1.37, 0);
            arms.rotation.set(0, 0, 0);
            rig.armL.position.set(SHOULDER_LEFT_DEFAULT.x, SHOULDER_LEFT_DEFAULT.y, SHOULDER_LEFT_DEFAULT.z);
            rig.armR.position.set(SHOULDER_RIGHT_DEFAULT.x, SHOULDER_RIGHT_DEFAULT.y, SHOULDER_RIGHT_DEFAULT.z);
            rig.armL.rotation.set(0, 0, 0);
            rig.armR.rotation.set(0, 0, 0);
            rig.legL.rotation.set(0, 0, 0);
            rig.legR.rotation.set(0, 0, 0);
            rig.legL.position.set(-0.18, 0.6, 0);
            rig.legR.position.set(0.18, 0.6, 0);
            rig.palmLeft.position.set(LEFT_PALM_NEUTRAL.x, LEFT_PALM_NEUTRAL.y, LEFT_PALM_NEUTRAL.z);
            rig.palmLeft.rotation.set(0, 0, 0);
            rig.palmRight.position.set(RIGHT_PALM_SOCKET.x, RIGHT_PALM_SOCKET.y, RIGHT_PALM_SOCKET.z);
            rig.palmRight.rotation.set(0, 0, 0);
            rig.gun.position.set(rig.gunBasePos.x, rig.gunBasePos.y, rig.gunBasePos.z);
            rig.gun.rotation.set(rig.gunBaseRot.x, rig.gunBaseRot.y, rig.gunBaseRot.z);
            rig.firstPerson.position.set(0, 0, 0);
            rig.bobRoot.position.set(0, 0, 0);
            rig.fpArmL.position.set(FP_SHOULDER_LEFT_DEFAULT.x, FP_SHOULDER_LEFT_DEFAULT.y, FP_SHOULDER_LEFT_DEFAULT.z);
            rig.fpArmR.position.set(FP_SHOULDER_RIGHT_DEFAULT.x, FP_SHOULDER_RIGHT_DEFAULT.y, FP_SHOULDER_RIGHT_DEFAULT.z);
            rig.fpArmL.rotation.set(0, 0, 0);
            rig.fpArmR.rotation.set(0, 0, 0);
            rig.fpPalmLeft.rotation.set(0, 0, 0);
            rig.fpPalmRight.rotation.set(0, 0, 0);
            rig.fpPalmLeft.position.set(LEFT_PALM_NEUTRAL.x, LEFT_PALM_NEUTRAL.y, LEFT_PALM_NEUTRAL.z);
            rig.fpPalmRight.position.set(RIGHT_PALM_SOCKET.x, RIGHT_PALM_SOCKET.y, RIGHT_PALM_SOCKET.z);
        }

        function pointArmAtTarget(armGroup, targetVec, parentGroup, extraX, extraY, extraZ) {
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

        function applyLowerLocomotion(style, speedNorm, sprinting, phase) {
            var amp = 0.12 + (clamp(speedNorm || 0, 0, 1.4) * 0.55);
            if (amp > 0.72) amp = 0.72;
            var swing = Math.sin(phase) * amp;
            rig.legL.position.x = -0.18;
            rig.legR.position.x = 0.18;
            if (style === 'backward') {
                rig.legL.rotation.x = -swing * 0.9;
                rig.legR.rotation.x = swing * 0.9;
            } else {
                rig.legL.rotation.x = swing;
                rig.legR.rotation.x = -swing;
            }
            rig.legL.rotation.z = 0;
            rig.legR.rotation.z = 0;
        }

        function applyGunUpperPose(style, speedNorm, sprinting, adsActive, fireWeight, supportMode, swayAmount) {
            var gaitAmp = 0.12 + (clamp(speedNorm || 0, 0, 1.4) * 0.55);
            if (gaitAmp > 0.72) gaitAmp = 0.72;
            var gaitSwing = Math.sin(rig.gaitPhase) * gaitAmp;
            if (style === 'backward') gaitSwing = -gaitSwing;
            rig.armL.position.set(SHOULDER_LEFT_DEFAULT.x, SHOULDER_LEFT_DEFAULT.y, SHOULDER_LEFT_DEFAULT.z);
            rig.armR.position.set(SHOULDER_RIGHT_DEFAULT.x, SHOULDER_RIGHT_DEFAULT.y, SHOULDER_RIGHT_DEFAULT.z);
            rig.palmLeft.position.set(LEFT_PALM_NEUTRAL.x, LEFT_PALM_NEUTRAL.y, LEFT_PALM_NEUTRAL.z);
            rig.palmRight.position.set(RIGHT_PALM_SOCKET.x, RIGHT_PALM_SOCKET.y, RIGHT_PALM_SOCKET.z);
            rig.palmLeft.rotation.set(0, 0, 0);
            rig.palmRight.rotation.set(0, 0, 0);
            rig.torso.rotation.set(0, 0, 0);
            rig.head.rotation.x = 0;
            rig.head.rotation.y = 0;
            rig.gun.rotation.x = rig.gunBaseRot.x - (fireWeight * 0.09);
            rig.gun.rotation.z = rig.gunBaseRot.z;
            if (rig.weaponClass === 'melee' || sprinting) {
                rig.armR.rotation.x = -gaitSwing;
                rig.armR.rotation.y = 0;
                rig.armR.rotation.z = 0.18;
                rig.armL.rotation.x = gaitSwing;
                rig.armL.rotation.y = 0;
                rig.armL.rotation.z = -0.04;
            } else {
                rig.armR.rotation.x = (75 * DEG_TO_RAD) + (rig.aimPitch * 0.35) + (fireWeight * 0.1);
                rig.armR.rotation.y = 0;
                rig.armR.rotation.z = -0.08;
                rig.armL.rotation.x = gaitSwing * 0.65;
                rig.armL.rotation.y = 0;
                rig.armL.rotation.z = 0;
            }
        }

        function applyFirstPersonPose(speedNorm, sprinting, adsActive, fireWeight, weaponBias, aggressive) {
            var grip = rig.gripProfile || DEFAULT_GRIP_PROFILE;
            var fp = grip.firstPerson || DEFAULT_GRIP_PROFILE.firstPerson;
            var fpLeftTarget = fp.leftArmTarget || DEFAULT_GRIP_PROFILE.firstPerson.leftArmTarget;
            var fpRightArm = fp.rightArm || DEFAULT_GRIP_PROFILE.firstPerson.rightArm;
            var bobAmp = sprinting ? 0.03 : 0.018;
            rig.bobRoot.position.y = Math.abs(Math.sin(rig.gaitPhase * 0.5)) * bobAmp * fp.bobY * speedNorm;
            rig.bobRoot.position.x = Math.sin(rig.gaitPhase * 0.5) * bobAmp * fp.swayX * speedNorm;
            rig.bobRoot.position.z = Math.cos(rig.gaitPhase) * bobAmp * fp.bobZ * speedNorm;
            rig.fpArmL.position.set(
                FP_SHOULDER_LEFT_DEFAULT.x + fp.leftShoulder[0],
                FP_SHOULDER_LEFT_DEFAULT.y + fp.leftShoulder[1],
                FP_SHOULDER_LEFT_DEFAULT.z + fp.leftShoulder[2]
            );
            rig.fpArmR.position.set(
                FP_SHOULDER_RIGHT_DEFAULT.x + fp.rightShoulder[0],
                FP_SHOULDER_RIGHT_DEFAULT.y + fp.rightShoulder[1],
                FP_SHOULDER_RIGHT_DEFAULT.z + fp.rightShoulder[2]
            );
            rig.fpPalmLeft.position.set(fp.leftPalm[0], fp.leftPalm[1], fp.leftPalm[2]);
            rig.fpPalmRight.position.set(fp.rightPalm[0], fp.rightPalm[1], fp.rightPalm[2]);
            rig.fpPalmLeft.rotation.set(fp.leftPalmRot[0], fp.leftPalmRot[1], fp.leftPalmRot[2]);
            rig.fpPalmRight.rotation.set(fp.rightPalmRot[0], fp.rightPalmRot[1], fp.rightPalmRot[2]);
            rig.fpArmR.rotation.x = fpRightArm.baseX + (rig.aimPitch * fpRightArm.aimScale) + (fireWeight * fpRightArm.fireScale) + (weaponBias || 0);
            rig.fpArmR.rotation.y = adsActive ? fpRightArm.adsY : fpRightArm.hipY;
            rig.fpArmR.rotation.z = adsActive ? fpRightArm.adsZ : (fpRightArm.hipZ - ((aggressive ? 1 : 0) * 0.03));
            rig.supportAnchor.getWorldPosition(targetWorld);
            pointArmAtTarget(
                rig.fpArmL,
                targetWorld,
                rig.bobRoot,
                fpLeftTarget.x + (rig.aimPitch * fpLeftTarget.aimXScale) + ((weaponBias || 0) * 0.15),
                fpLeftTarget.y,
                fpLeftTarget.z - ((aggressive ? 1 : 0) * 0.03) - (fireWeight * fpLeftTarget.fireZScale)
            );
            rig.firstPerson.position.y = adsActive ? -0.02 : 0;
            rig.firstPerson.position.x = adsActive ? 0.01 : 0;
            rig.firstPerson.position.z = adsActive ? -0.035 : 0;
            if (rig.firstPersonActive) {
                rig.gun.position.x = rig.gunBasePos.x + fp.gunOffset[0] + (weaponBias || 0) + (adsActive ? fp.adsOffset[0] : 0);
                rig.gun.position.y = rig.gunBasePos.y + fp.gunOffset[1] + (adsActive ? fp.adsOffset[1] : 0);
                rig.gun.position.z = rig.gunBasePos.z + fp.gunOffset[2] + (adsActive ? fp.adsOffset[2] : 0);
                rig.gun.rotation.x = rig.gunBaseRot.x + fp.gunRot[0] + (adsActive ? fp.adsGunRot[0] : 0) - (fireWeight * 0.06);
                rig.gun.rotation.y = rig.gunBaseRot.y + fp.gunRot[1] + (adsActive ? fp.adsGunRot[1] : 0);
                rig.gun.rotation.z = rig.gunBaseRot.z + fp.gunRot[2] + (adsActive ? fp.adsGunRot[2] : 0);
            }
        }

        function applyRuntimeAimOverlay(sprinting, adsActive, fireWeight) {
            var grip = rig.gripProfile || DEFAULT_GRIP_PROFILE;
            var aim = rig.aimPitch || 0;
            if (rig.weaponClass !== 'melee') {
                var leftTarget = grip.leftArmTarget || DEFAULT_GRIP_PROFILE.leftArmTarget;
                rig.armR.rotation.x += aim * 0.35;
                rig.torso.rotation.x += aim * (adsActive ? 0.05 : 0.03);
                rig.head.rotation.x += aim * grip.headPitchScale;
                if (!sprinting) {
                    rig.supportAnchor.getWorldPosition(targetWorld);
                    pointArmAtTarget(
                        rig.armL,
                        targetWorld,
                        arms,
                        leftTarget.x + (aim * leftTarget.aimXScale),
                        leftTarget.y,
                        leftTarget.z - (fireWeight * leftTarget.fireZScale)
                    );
                }
            }
            if (rig.firstPersonActive) {
                var fp = grip.firstPerson || DEFAULT_GRIP_PROFILE.firstPerson;
                var fpLeftTarget = fp.leftArmTarget || DEFAULT_GRIP_PROFILE.firstPerson.leftArmTarget;
                var fpRightArm = fp.rightArm || DEFAULT_GRIP_PROFILE.firstPerson.rightArm;
                rig.fpArmR.rotation.x += aim * fpRightArm.aimScale;
                rig.supportAnchor.getWorldPosition(targetWorld);
                pointArmAtTarget(
                    rig.fpArmL,
                    targetWorld,
                    rig.bobRoot,
                    fpLeftTarget.x + (aim * fpLeftTarget.aimXScale),
                    fpLeftTarget.y,
                    fpLeftTarget.z - (fireWeight * fpLeftTarget.fireZScale)
                );
            }
        }

        function proceduralThirdPersonName(name, time, speedNorm) {
            var phase = time * 6;
            var def = thirdPersonAnimationDefinitions[name];
            if (!def) return;
            switch (def.family) {
            case 'idle_upper':
                rig.upper.position.y += Math.sin(phase * 0.5) * 0.01;
                rig.torso.rotation.x += Math.sin(phase * 0.5) * def.breath;
                rig.head.rotation.y += Math.sin(phase * 0.3) * def.head;
                rig.armL.rotation.x = def.shoulder;
                rig.armR.rotation.x = def.shoulder + 0.02;
                break;
            case 'idle_lower':
                rig.legL.rotation.x = def.knee + (Math.sin(phase * 0.35) * def.sway);
                rig.legR.rotation.x = def.knee - (Math.sin(phase * 0.35) * def.sway);
                break;
            case 'locomotion_lower':
                applyLowerLocomotion(def.style, def.intensity || speedNorm || 0.7, !!def.sprint, phase);
                break;
            case 'gun_upper':
                applyGunUpperPose(def.style, def.intensity || speedNorm || 0.2, !!def.sprint, !!def.ads, def.fire || 0, def.support || 'both', Math.sin(phase * 0.4) * (def.sway || 0));
                break;
            case 'crouch_upper':
                rig.torso.rotation.x = 0.18 + (def.intensity * 0.06);
                rig.head.rotation.x = -0.04;
                rig.armR.rotation.x = 0.84;
                rig.armR.rotation.z = -0.08;
                rig.armL.rotation.x = def.moving ? (Math.sin(phase) * def.intensity * 0.28) : (def.intensity * 0.2);
                break;
            case 'crouch_lower':
                rig.torso.rotation.x = def.alt ? 0.24 : 0.2;
                rig.legL.rotation.x = def.moving ? Math.sin(phase) * def.intensity * 0.4 : def.intensity * 0.24;
                rig.legR.rotation.x = def.moving ? Math.sin(phase + Math.PI) * def.intensity * 0.4 : def.intensity * 0.24;
                rig.legL.rotation.z = def.alt ? -0.03 : 0;
                rig.legR.rotation.z = def.alt ? 0.03 : 0;
                break;
            case 'climb':
                rig.armL.rotation.x = Math.sin(phase * def.rate) * 1.1 * def.amplitude;
                rig.armR.rotation.x = Math.sin((phase * def.rate) + Math.PI) * 1.1 * def.amplitude;
                rig.legL.rotation.x = Math.sin((phase * def.rate) + Math.PI) * 0.9 * def.amplitude;
                rig.legR.rotation.x = Math.sin(phase * def.rate) * 0.9 * def.amplitude;
                break;
            case 'crawl':
                rig.torso.rotation.x = Math.PI * 0.5;
                rig.torso.position.y = 0.58;
                rig.head.rotation.x = -0.22;
                rig.armL.rotation.x = -0.8 + Math.sin(phase) * def.amplitude;
                rig.armR.rotation.x = -0.8 + Math.sin(phase + Math.PI) * def.amplitude;
                rig.legL.rotation.x = Math.sin(phase + Math.PI) * def.amplitude;
                rig.legR.rotation.x = Math.sin(phase) * def.amplitude;
                break;
            case 'sleep':
                rig.torso.rotation.z = -Math.PI * 0.5 * def.tilt;
                rig.head.rotation.z = 0.18;
                rig.armL.rotation.z = -0.3;
                rig.armR.rotation.z = 0.2;
                break;
            case 'interact':
                rig.armL.rotation.x = -def.reach;
                rig.armL.rotation.y = -0.08;
                rig.armR.rotation.x = def.lift;
                break;
            case 'jump_pre':
                rig.legL.rotation.x = -def.crouch;
                rig.legR.rotation.x = -def.crouch;
                rig.armL.rotation.x = def.arm;
                rig.armR.rotation.x = def.arm;
                break;
            case 'jump_loop':
                rig.upper.position.y = 0.06;
                rig.legL.rotation.x = def.spread;
                rig.legR.rotation.x = -def.spread;
                break;
            case 'jump_post':
                rig.legL.rotation.x = def.landing;
                rig.legR.rotation.x = def.landing;
                rig.torso.rotation.x = def.heavy ? 0.2 : 0.14;
                break;
            case 'carry':
                rig.armL.rotation.x = -def.lift;
                rig.armR.rotation.x = -def.lift + 0.08;
                rig.armL.rotation.z = -def.tuck;
                rig.armR.rotation.z = def.tuck * 0.5;
                break;
            case 'mounted_upper':
                rig.armL.rotation.x = def.reins;
                rig.armR.rotation.x = def.reins;
                rig.armL.rotation.z = -0.14;
                rig.armR.rotation.z = 0.14;
                break;
            case 'mounted_lower':
                rig.legL.rotation.x = -def.bend;
                rig.legR.rotation.x = -def.bend;
                break;
            case 'swim':
                rig.torso.rotation.x = def.pitch;
                rig.armL.rotation.x = -1 + (Math.sin(phase) * def.amplitude);
                rig.armR.rotation.x = -1 + (Math.sin(phase + Math.PI) * def.amplitude);
                if (def.style === 'idle') {
                    rig.legL.rotation.x = Math.sin(phase * 0.45) * def.amplitude;
                    rig.legR.rotation.x = Math.sin((phase * 0.45) + Math.PI) * def.amplitude;
                } else {
                    rig.legL.rotation.x = Math.sin(phase + Math.PI) * def.amplitude;
                    rig.legR.rotation.x = Math.sin(phase) * def.amplitude;
                }
                break;
            case 'sword':
                rig.armR.rotation.x = -1.1 + (Math.sin(phase) * 0.45 * def.power);
                rig.armR.rotation.z = 0.26 + (def.power * 0.08);
                rig.armL.rotation.x = 0.22 + (def.power * 0.12);
                rig.torso.rotation.y = Math.sin(phase) * def.twist * def.dir;
                break;
            case 'roll':
                rig.torso.rotation.z = def.lean;
                rig.armL.rotation.x = -1.1;
                rig.armR.rotation.x = 0.9;
                rig.legL.rotation.x = def.crouch;
                rig.legR.rotation.x = -0.24;
                break;
            case 'hit':
                rig.torso.rotation.z = def.twist;
                rig.armL.rotation.x = -0.2 - (def.flinch * 0.15);
                rig.armR.rotation.x = 0.86 + (def.flinch * 0.15);
                rig.head.rotation.y = -0.12;
                break;
            case 'consume':
                rig.armL.rotation.x = -def.lift;
                rig.armL.rotation.y = -0.1;
                rig.head.rotation.x = def.sip;
                rig.armR.rotation.x = 0.18;
                break;
            case 'forage_transition':
                rig.torso.rotation.x = def.dip;
                rig.armR.rotation.x = -0.4;
                rig.armL.rotation.x = def.reach;
                break;
            case 'forage_loop':
            case 'axe_loop':
            case 'mining':
                rig.torso.rotation.x = def.dip;
                rig.armR.rotation.x = -0.8 + (Math.sin(phase) * def.chop);
                rig.armL.rotation.x = 0.22;
                break;
            case 'combat_idle':
                rig.upper.position.y += Math.sin(phase * 0.5) * 0.012;
                rig.torso.rotation.x = 0.03;
                rig.armR.rotation.x = 0.98;
                rig.armR.rotation.z = -0.08;
                rig.armL.rotation.x = 0.16 + (Math.sin(phase * 0.4) * def.tension);
                rig.head.rotation.y = Math.sin(phase * 0.24) * def.sway;
                break;
            case 'shield':
                rig.armL.rotation.x = -def.brace;
                rig.armL.rotation.z = -0.35;
                rig.armR.rotation.x = 0.6;
                break;
            case 'emote_griddy':
                rig.armL.rotation.x = -0.7 + (Math.sin(phase * 2) * 0.25);
                rig.armR.rotation.x = -0.7 + (Math.sin((phase * 2) + Math.PI) * 0.25);
                rig.legL.rotation.x = Math.sin(phase * 2) * def.leg;
                rig.legR.rotation.x = Math.sin((phase * 2) + Math.PI) * def.leg;
                rig.torso.rotation.y = Math.sin(phase) * def.torso;
                break;
            case 'emote_annoyed':
                rig.armL.rotation.x = -0.28;
                rig.armR.rotation.x = -0.28;
                rig.head.rotation.y = Math.sin(phase * 3) * def.head;
                rig.torso.rotation.x = def.slump;
                break;
            case 'emote_ratdance':
                rig.armL.rotation.z = -def.arm + (Math.sin(phase * 5) * 0.18);
                rig.armR.rotation.z = def.arm + (Math.sin((phase * 5) + Math.PI) * 0.18);
                rig.legL.rotation.x = Math.sin(phase * 5) * def.leg;
                rig.legR.rotation.x = Math.sin((phase * 5) + Math.PI) * def.leg;
                break;
            case 'slide':
                rig.torso.rotation.z = def.lean;
                rig.torso.rotation.x = 0.16;
                rig.armL.rotation.x = -0.6;
                rig.armR.rotation.x = 0.8;
                rig.legL.rotation.x = def.crouch;
                rig.legR.rotation.x = -0.18;
                break;
            case 'death_kneel':
                rig.torso.rotation.x = def.collapse;
                rig.legL.rotation.x = -1.05;
                rig.legR.rotation.x = -1.05;
                rig.armL.rotation.x = -0.28;
                rig.armR.rotation.x = 0.22;
                break;
            case 'death_front':
                rig.torso.rotation.x = Math.PI * 0.5 * def.collapse;
                rig.armL.rotation.x = -0.32;
                rig.armR.rotation.x = -0.32;
                break;
            case 'death_back':
                rig.torso.rotation.x = -Math.PI * 0.5 * def.collapse;
                rig.armL.rotation.x = 0.52;
                rig.armR.rotation.x = 0.52;
                break;
            case 'bow':
                rig.armL.rotation.x = -0.72 - (def.pull * 0.08);
                rig.armL.rotation.y = -0.18;
                rig.armR.rotation.x = 0.42 + (def.pull * 0.22) + def.release;
                rig.armR.rotation.z = -0.08;
                break;
            case 'sit':
                rig.legL.rotation.x = -def.bend;
                rig.legR.rotation.x = -def.bend;
                rig.torso.rotation.x = def.recline;
                rig.armL.rotation.x = 0.2;
                rig.armR.rotation.x = 0.2;
                break;
            default:
                break;
            }
        }

        function proceduralFirstPersonName(name, time, speedNorm) {
            var phase = time * 7;
            var def = firstPersonAnimationDefinitions[name];
            if (!def) return;
            switch (def.family) {
            case 'fp_weapon': {
                var aiming = def.mode === 'aim';
                var shooting = def.mode === 'shoot';
                var running = def.mode === 'run';
                var walking = def.mode === 'walk';
                var reloading = def.mode === 'reload';
                applyFirstPersonPose(def.speed || speedNorm, running, aiming, shooting ? 1 : 0, def.bias || 0, !!def.aggressive);
                rig.bobRoot.rotation.z = Math.sin(phase) * (running ? 0.04 : 0.018);
                if (walking) rig.bobRoot.position.x += Math.sin(phase) * 0.008;
                if (reloading) {
                    rig.fpArmL.rotation.x -= 0.4;
                    rig.fpArmL.rotation.z -= 0.18;
                    rig.fpArmR.rotation.y += 0.22;
                }
                break;
            }
            case 'fp_sway':
                rig.bobRoot.rotation.z = Math.sin(phase * 0.35) * 0.012;
                rig.bobRoot.position.x += Math.sin(phase * 0.3) * def.sway;
                rig.bobRoot.position.y += Math.cos(phase * 0.2) * def.bob;
                break;
            case 'fp_draw':
                rig.firstPerson.position.y = -def.lift + (Math.sin(Math.min(phase, Math.PI)) * def.lift);
                break;
            case 'fp_melee_idle':
                rig.fpArmR.rotation.x = 1.0;
                rig.fpArmR.rotation.z = 0.18;
                break;
            case 'fp_melee_punch':
                if (def.side === 'left') {
                    rig.fpArmL.rotation.x = 0.4 + (Math.sin(phase) * def.power);
                } else {
                    rig.fpArmR.rotation.x = 0.4 + (Math.sin(phase) * def.power);
                }
                break;
            case 'fp_glider':
                rig.fpArmL.rotation.x = 0.65;
                rig.fpArmR.rotation.x = 0.65;
                rig.fpArmL.rotation.z = -def.spread;
                rig.fpArmR.rotation.z = def.spread;
                rig.firstPerson.position.y = def.dip;
                break;
            case 'fp_ledge':
                rig.firstPerson.position.y = -def.lift + (Math.sin(Math.min(phase, Math.PI)) * def.lift);
                rig.fpArmL.rotation.x = 0.84 + (Math.sin(phase) * def.tug * 0.2);
                rig.fpArmR.rotation.x = 0.84 + (Math.sin(phase + 0.3) * def.tug * 0.2);
                break;
            default:
                break;
            }
        }

        var poseCaptureNodes = null;
        var defaultPoseSnapshot = null;
        var thirdPersonClips = null;
        var firstPersonClips = null;

        function getPoseCaptureNodes() {
            if (poseCaptureNodes) return poseCaptureNodes;
            poseCaptureNodes = {
                upper: rig.upper,
                lower: rig.lower,
                torso: rig.torso,
                neck: neck,
                head: head,
                arms: arms,
                armL: rig.armL,
                armR: rig.armR,
                legL: rig.legL,
                legR: rig.legR,
                palmLeft: rig.palmLeft,
                palmRight: rig.palmRight,
                gun: rig.gun,
                firstPerson: rig.firstPerson,
                bobRoot: rig.bobRoot,
                fpArmL: rig.fpArmL,
                fpArmR: rig.fpArmR,
                fpPalmLeft: rig.fpPalmLeft,
                fpPalmRight: rig.fpPalmRight
            };
            return poseCaptureNodes;
        }

        function capturePoseSnapshot() {
            var nodes = getPoseCaptureNodes();
            var snapshot = {};
            Object.keys(nodes).forEach(function (key) {
                var node = nodes[key];
                if (!node) return;
                snapshot[key] = {
                    position: [node.position.x, node.position.y, node.position.z],
                    rotation: [node.rotation.x, node.rotation.y, node.rotation.z]
                };
            });
            return snapshot;
        }

        function capturePoseDeltaSnapshot() {
            var current = capturePoseSnapshot();
            var delta = {};
            Object.keys(current).forEach(function (key) {
                var base = defaultPoseSnapshot && defaultPoseSnapshot[key] ? defaultPoseSnapshot[key] : null;
                var value = current[key];
                if (!base || !value) return;
                delta[key] = {
                    position: [
                        value.position[0] - base.position[0],
                        value.position[1] - base.position[1],
                        value.position[2] - base.position[2]
                    ],
                    rotation: [
                        value.rotation[0] - base.rotation[0],
                        value.rotation[1] - base.rotation[1],
                        value.rotation[2] - base.rotation[2]
                    ]
                };
            });
            return delta;
        }

        function applyPoseDeltaSnapshot(snapshot, weight, scale) {
            var nodes = getPoseCaptureNodes();
            var w = clamp(weight == null ? 1 : weight, 0, 1.5);
            var s = clamp(scale == null ? 1 : scale, 0, 2);
            Object.keys(snapshot || {}).forEach(function (key) {
                var node = nodes[key];
                var delta = snapshot[key];
                if (!node || !delta) return;
                if (delta.position) {
                    node.position.x += delta.position[0] * w * s;
                    node.position.y += delta.position[1] * w * s;
                    node.position.z += delta.position[2] * w * s;
                }
                if (delta.rotation) {
                    node.rotation.x += delta.rotation[0] * w * s;
                    node.rotation.y += delta.rotation[1] * w * s;
                    node.rotation.z += delta.rotation[2] * w * s;
                }
            });
        }

        function interpolatePoseSnapshots(a, b, t) {
            var mix = {};
            var alpha = clamp(t, 0, 1);
            var keys = {};
            Object.keys(a || {}).forEach(function (key) { keys[key] = true; });
            Object.keys(b || {}).forEach(function (key) { keys[key] = true; });
            Object.keys(keys).forEach(function (key) {
                var av = a && a[key] ? a[key] : null;
                var bv = b && b[key] ? b[key] : av;
                if (!av && !bv) return;
                if (!av) av = bv;
                if (!bv) bv = av;
                mix[key] = {
                    position: [
                        lerp(av.position[0], bv.position[0], alpha),
                        lerp(av.position[1], bv.position[1], alpha),
                        lerp(av.position[2], bv.position[2], alpha)
                    ],
                    rotation: [
                        lerp(av.rotation[0], bv.rotation[0], alpha),
                        lerp(av.rotation[1], bv.rotation[1], alpha),
                        lerp(av.rotation[2], bv.rotation[2], alpha)
                    ]
                };
            });
            return mix;
        }

        function clipDurationForName(name, kind) {
            if (kind === 'first') {
                if (name.indexOf('reload') >= 0) return 0.9;
                if (name.indexOf('shoot') >= 0) return 0.2;
                if (name.indexOf('walk-bob') >= 0) return 0.9;
                if (name.indexOf('run') >= 0) return 0.64;
                if (name === 'draw' || name === 'ledge-pull') return 0.55;
                if (name.indexOf('glider') >= 0) return 1.1;
                return 1.2;
            }
            if (name.indexOf('run-') === 0 || name === 'run-slide') return 0.64;
            if (name.indexOf('walk-') === 0 || name === 'crouch-walk' || name === 'sneak2-walk') return 0.9;
            if (name.indexOf('shoot-') === 0 || name.indexOf('attack') >= 0 || name.indexOf('bow-draw-shoot') >= 0) return 0.24;
            if (name.indexOf('jump-') === 0) return 0.35;
            if (name.indexOf('swim-') === 0) return 1.0;
            if (name.indexOf('death') === 0) return 1.0;
            if (name.indexOf('emote') === 0) return 1.4;
            if (name === 'climbing' || name === 'crawling') return 1.1;
            if (name === 'foraging-loop' || name === 'axe-chop-loop' || name === 'mining-loop') return 0.9;
            return 1.2;
        }

        function isLoopingClip(name, kind) {
            if (kind === 'first') {
                return !(name.indexOf('shoot') >= 0 || name.indexOf('reload') >= 0 || name === 'draw' || name === 'ledge-pull' || name === 'glider-start' || name.indexOf('punch') >= 0);
            }
            return !(
                name.indexOf('shoot-') === 0 ||
                name.indexOf('jump-pre') === 0 ||
                name.indexOf('jump-post') === 0 ||
                name.indexOf('death') === 0 ||
                name === 'simple-interact' ||
                name === 'consume-upper' ||
                name === 'foraging-transition' ||
                name.indexOf('attack') >= 0 ||
                name === 'dodge-roll' ||
                name === 'run-slide' ||
                name === 'bow-draw-shoot'
            );
        }

        function canonicalSpeedForClip(name, kind) {
            if (kind === 'first') {
                if (name.indexOf('run') >= 0) return 1.0;
                if (name.indexOf('walk-bob') >= 0) return 0.7;
                return 0.18;
            }
            if (name.indexOf('run') >= 0) return 1.0;
            if (name.indexOf('walk') >= 0) return 0.7;
            if (name.indexOf('swim') >= 0) return 0.55;
            return 0.3;
        }

        function sampleCountForClip(name, kind, duration, loop) {
            var base = loop ? 12 : 14;
            if (name.indexOf('emote') >= 0 || name.indexOf('swim') >= 0 || name === 'climbing' || name === 'crawling') base += 4;
            if (name.indexOf('shoot') >= 0 || name.indexOf('attack') >= 0 || name.indexOf('punch') >= 0) base += 6;
            if (kind === 'first' && (name.indexOf('reload') >= 0 || name === 'draw' || name === 'ledge-pull')) base += 6;
            if (duration > 1.2) base += 4;
            return Math.max(8, base);
        }

        function remapClipProgress(name, kind, u, loop) {
            var t = clamp(u, 0, 1);
            if (loop) return t;
            if (name.indexOf('shoot') >= 0 || name.indexOf('attack') >= 0 || name.indexOf('punch') >= 0) {
                if (t < 0.2) return lerp(0, 0.12, smoothstep(t / 0.2));
                if (t < 0.55) return lerp(0.12, 0.86, easeOutCubic((t - 0.2) / 0.35));
                return lerp(0.86, 1.0, smoothstep((t - 0.55) / 0.45));
            }
            if (name.indexOf('reload') >= 0) {
                if (t < 0.25) return lerp(0, 0.22, smoothstep(t / 0.25));
                if (t < 0.72) return lerp(0.22, 0.78, (t - 0.25) / 0.47);
                return lerp(0.78, 1.0, smoothstep((t - 0.72) / 0.28));
            }
            if (name === 'draw' || name === 'ledge-pull' || name === 'foraging-transition' || name.indexOf('jump-pre') === 0) {
                return easeOutCubic(t);
            }
            if (name.indexOf('jump-post') === 0 || name.indexOf('death') === 0 || name === 'dodge-roll' || name === 'run-slide') {
                return smoothstep(t);
            }
            if (name.indexOf('emote') >= 0) {
                return smoothstep(t);
            }
            return t;
        }

        function gaitPhaseForClip(name, kind, motionU, duration) {
            var loops = 1;
            if (kind === 'first') {
                if (name.indexOf('run') >= 0) loops = 1.4;
                else if (name.indexOf('walk') >= 0) loops = 1.1;
            } else {
                if (name.indexOf('run') >= 0 || name === 'run-slide') loops = 1.5;
                else if (name.indexOf('walk') >= 0 || name.indexOf('swim') >= 0 || name === 'climbing' || name === 'crawling') loops = 1.1;
                else if (name.indexOf('emote') >= 0) loops = 2.0;
            }
            return motionU * Math.PI * 2 * loops * Math.max(0.6, duration || 1);
        }

        function buildGeneratedClip(name, kind) {
            var duration = clipDurationForName(name, kind);
            var loop = isLoopingClip(name, kind);
            var speed = canonicalSpeedForClip(name, kind);
            var frames = [];
            var sampleCount = sampleCountForClip(name, kind, duration, loop);
            var prevFirstPerson = rig.firstPersonActive;
            var prevGaitPhase = rig.gaitPhase;
            var activateFirst = kind === 'first';
            setFirstPersonActive(activateFirst);
            for (var i = 0; i < sampleCount; i++) {
                var u = sampleCount <= 1 ? 0 : (i / (sampleCount - 1));
                var motionU = remapClipProgress(name, kind, u, loop);
                resetPose();
                rig.gaitPhase = gaitPhaseForClip(name, kind, motionU, duration);
                if (kind === 'first') {
                    proceduralFirstPersonName(name, motionU * duration, speed);
                } else {
                    proceduralThirdPersonName(name, motionU * duration, speed);
                }
                frames.push({
                    u: u,
                    pose: capturePoseDeltaSnapshot()
                });
            }
            rig.gaitPhase = prevGaitPhase;
            setFirstPersonActive(prevFirstPerson);
            return {
                name: name,
                kind: kind,
                duration: duration,
                loop: loop,
                frames: frames
            };
        }

        function ensureAnimationClips() {
            if (thirdPersonClips && firstPersonClips) return;
            resetPose();
            defaultPoseSnapshot = capturePoseSnapshot();
            thirdPersonClips = {};
            firstPersonClips = {};
            thirdPersonAnimationNames.forEach(function (name) {
                thirdPersonClips[name] = buildGeneratedClip(name, 'third');
            });
            firstPersonAnimationNames.forEach(function (name) {
                firstPersonClips[name] = buildGeneratedClip(name, 'first');
            });
        }

        function sampleGeneratedClip(clipMap, name, timeSeconds, weight, scale) {
            ensureAnimationClips();
            var clip = clipMap && name ? clipMap[name] : null;
            if (!clip) return false;
            var duration = Math.max(0.0001, clip.duration || 1);
            var t = clip.loop ? ((timeSeconds % duration) + duration) % duration : clamp(timeSeconds, 0, duration);
            var u = duration > 0 ? (t / duration) : 0;
            var frames = clip.frames || [];
            if (!frames.length) return false;
            var a = frames[0];
            var b = frames[frames.length - 1];
            for (var i = 0; i < frames.length - 1; i++) {
                if (u >= frames[i].u && u <= frames[i + 1].u) {
                    a = frames[i];
                    b = frames[i + 1];
                    break;
                }
            }
            var span = Math.max(0.0001, b.u - a.u);
            var localT = clamp((u - a.u) / span, 0, 1);
            applyPoseDeltaSnapshot(interpolatePoseSnapshots(a.pose, b.pose, localT), weight, scale);
            return true;
        }

        function sampleTrackBlend(clipMap, track, timeSeconds, baseWeight, scale) {
            if (!track || !track.to) return false;
            var alpha = smoothstep(trackBlendAlpha(track, timeSeconds));
            if (alpha >= 0.999 || !track.from || track.from === track.to) {
                return sampleGeneratedClip(clipMap, track.to, timeSeconds, baseWeight, scale);
            }
            var fromWeight = (baseWeight == null ? 1 : baseWeight) * (1 - alpha);
            var toWeight = (baseWeight == null ? 1 : baseWeight) * alpha;
            sampleGeneratedClip(clipMap, track.from, timeSeconds, fromWeight, scale);
            sampleGeneratedClip(clipMap, track.to, timeSeconds, toWeight, scale);
            return true;
        }

        function triggerFirePose(duration, strength) {
            rig.firePoseTimer = Math.max(rig.firePoseTimer, duration || 0.14);
            rig.firePoseStrength = Math.max(rig.firePoseStrength, strength || 1);
        }

        function updateLocomotion(speedNorm, sprinting, dt, airborne, poseState) {
            ensureAnimationClips();
            speedNorm = clamp(speedNorm || 0, 0, 1.4);
            airborne = !!airborne;
            poseState = poseState || {};
            if (speedNorm > 0.02) {
                rig.gaitPhase += dt * ((sprinting ? 13 : 9) * (0.35 + speedNorm));
            }

            if (rig.firePoseTimer > 0) {
                rig.firePoseTimer = Math.max(0, rig.firePoseTimer - dt);
                if (rig.firePoseTimer <= 0) rig.firePoseStrength = 0;
            }
            var fireWeight = rig.firePoseTimer > 0 ? clamp(rig.firePoseTimer * 7, 0, 1) * clamp(rig.firePoseStrength || 1, 0, 1.5) : 0;

            var moving = speedNorm > 0.04;
            var moveStyle = poseState.movingBackward ? 'backward' : (poseState.movingLeft ? 'strafe-left' : (poseState.movingRight ? 'strafe-right' : 'forward'));
            var adsActive = !!poseState.adsActive;
            var choked = !!poseState.choked;
            var hooked = !!poseState.hooked;
            var chokeStartedAt = choked ? Number(poseState.startedAt || 0) : 0;
            var time = Date.now() * 0.001;

            resetPose();

            if (hooked && !choked) {
                setAnimationState('damage-hit-upper', 'run-slide', 'idle-base', time);
                sampleTrackBlend(thirdPersonClips, rig.lowerTrack, time, 1, 1);
                sampleTrackBlend(thirdPersonClips, rig.upperTrack, time, 1, 1);
                sampleTrackBlend(firstPersonClips, rig.firstPersonTrack, time, rig.firstPersonActive ? 1 : 0, 1);
                return;
            }
            if (choked) {
                setAnimationState('damage-hit-upper', 'death-kneel', 'idle-base', time);
                sampleTrackBlend(thirdPersonClips, rig.lowerTrack, time + (chokeStartedAt * 0.001), 1, 1);
                sampleTrackBlend(thirdPersonClips, rig.upperTrack, time + (chokeStartedAt * 0.001), 1, 1);
                sampleTrackBlend(firstPersonClips, rig.firstPersonTrack, time, rig.firstPersonActive ? 1 : 0, 1);
                return;
            }
            if (airborne) {
                var airborneUpper = fireWeight > 0.18 ? 'shoot-gun-both' : 'idle-gun-both';
                setAnimationState(airborneUpper, 'jump-loop', weaponIdToFirstPersonAnimation(rig.weaponId, adsActive, fireWeight, speedNorm), time);
                sampleTrackBlend(thirdPersonClips, rig.lowerTrack, time, 1, 1);
                sampleTrackBlend(thirdPersonClips, rig.upperTrack, time, 1, 1);
                sampleTrackBlend(firstPersonClips, rig.firstPersonTrack, time, rig.firstPersonActive ? 1 : 0, 1);
                applyRuntimeAimOverlay(sprinting, adsActive, fireWeight);
                return;
            }

            if (!moving) {
                var idleUpper = fireWeight > 0.18 ? 'shoot-gun-both' : 'idle-gun-both';
                setAnimationState(idleUpper, 'idle-lower', weaponIdToFirstPersonAnimation(rig.weaponId, adsActive, fireWeight, speedNorm), time);
            } else {
                var upperName = sprinting ? 'run-upper' : 'walk-upper';
                var lowerName = sprinting ? 'run-lower' : 'walk-lower';
                if (moveStyle === 'backward') {
                    upperName = sprinting ? 'run-backwards-upper' : 'walk-backwards-upper';
                    lowerName = sprinting ? 'run-backwards-lower' : 'walk-backwards-lower';
                } else if (moveStyle === 'strafe-left') {
                    upperName = sprinting ? 'run-strafe-left-upper' : 'walk-strafe-left-upper';
                    lowerName = sprinting ? 'run-strafe-left-lower' : 'walk-strafe-left-lower';
                } else if (moveStyle === 'strafe-right') {
                    upperName = sprinting ? 'run-strafe-right-upper' : 'walk-strafe-right-upper';
                    lowerName = sprinting ? 'run-strafe-right-lower' : 'walk-strafe-right-lower';
                }
                if (fireWeight > 0.18) upperName = 'shoot-gun-both';
                setAnimationState(upperName, lowerName, weaponIdToFirstPersonAnimation(rig.weaponId, adsActive, fireWeight, speedNorm), time);
            }

            sampleTrackBlend(thirdPersonClips, rig.lowerTrack, time, 1, clamp(speedNorm / canonicalSpeedForClip(rig.currentLowerAnimation, 'third'), 0.6, 1.25));
            sampleTrackBlend(thirdPersonClips, rig.upperTrack, time, 1, 1);
            sampleTrackBlend(firstPersonClips, rig.firstPersonTrack, time, rig.firstPersonActive ? 1 : 0, 1);
            applyRuntimeAimOverlay(sprinting, adsActive, fireWeight);
        }

        function weaponIdToFirstPersonAnimation(weaponId, adsActive, fireWeight, speedNorm) {
            if (rig.weaponClass === 'melee') {
                if (fireWeight > 0.18) return 'melee-punch-right';
                return 'melee-idle';
            }
            var family = 'm4a4';
            if (weaponId === 'pistol') family = 'glock';
            else if (weaponId === 'machinegun') family = 'mp7';
            if (fireWeight > 0.18) return family + '-shoot';
            if (adsActive) return family + '-aim';
            if (speedNorm > 0.88) return family === 'mp7' ? 'mp7-run' : family + '-run-bob';
            if (speedNorm > 0.12) return family + '-walk-bob';
            return family + '-idle';
        }

        function sampleNamedAnimation(name, timeSeconds, speedNorm) {
            ensureAnimationClips();
            var when = (typeof timeSeconds === 'number' && isFinite(timeSeconds)) ? timeSeconds : (Date.now() * 0.001);
            var speed = clamp(speedNorm || 0.6, 0, 1.4);
            resetPose();
            if (thirdPersonAnimationNames.indexOf(name) >= 0) {
                setAnimationState(
                    name.indexOf('-lower') >= 0 ? rig.currentUpperAnimation : name,
                    name.indexOf('-lower') >= 0 ? name : rig.currentLowerAnimation,
                    rig.currentFirstPersonAnimation,
                    when
                );
                sampleTrackBlend(thirdPersonClips, rig.lowerTrack, when, 1, clamp(speed / canonicalSpeedForClip(rig.currentLowerAnimation, 'third'), 0.6, 1.3));
                sampleTrackBlend(thirdPersonClips, rig.upperTrack, when, 1, clamp(speed / canonicalSpeedForClip(rig.currentUpperAnimation, 'third'), 0.6, 1.3));
            }
            if (firstPersonAnimationNames.indexOf(name) >= 0) {
                setAnimationState(rig.currentUpperAnimation, rig.currentLowerAnimation, name, when);
                sampleTrackBlend(firstPersonClips, rig.firstPersonTrack, when, 1, clamp(speed / canonicalSpeedForClip(rig.currentFirstPersonAnimation, 'first'), 0.75, 1.25));
            }
            return {
                upper: rig.currentUpperAnimation,
                lower: rig.currentLowerAnimation,
                firstPerson: rig.currentFirstPersonAnimation
            };
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
            if (!!visible && !rig.lastMuzzleVisible) {
                triggerFirePose(0.14, rig.weaponId === 'shotgun' || rig.weaponId === 'sniper' ? 1.2 : 1);
            }
            rig.lastMuzzleVisible = !!visible;
            if (!muzzle) return;
            muzzle.visible = !!visible;
            if (!muzzle.material) return;
            if (visible) {
                if (rig.weaponId === 'seekergun') {
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
                if (rig.weaponId === 'seekergun') {
                    muzzle.material.color.setHex(0x56b8d1);
                } else {
                    muzzle.material.color.setHex(0xffcc66);
                }
            }
        }

        root.userData.bodyParts = [body, headGeo, armL, armR, legL, legR];
        root.userData.originalColor = ensureHex(options.bodyColor, 0x4a7fc1);
        root.userData.originalPartColors = [
            body.material.color.getHex(),
            headGeo.material.color.getHex(),
            armL.material.color.getHex(),
            armR.material.color.getHex(),
            legL.material.color.getHex(),
            legR.material.color.getHex()
        ];
        root.userData.weaponMuzzle = muzzle;
        root.userData.rig = rig;
        root.userData.namedNodes = namedNodes;
        root.userData.availableNodeNames = Object.keys(namedNodes);
        root.userData.availableAnimationNames = thirdPersonAnimationNames.concat(firstPersonAnimationNames);

        setWeapon(options.weaponId || 'rifle');
        setFirstPersonActive(false);
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
            setFirstPersonActive: setFirstPersonActive,
            updateLocomotion: updateLocomotion,
            updateAimPitch: updateAimPitch,
            getCoreWorldPosition: getCoreWorldPosition,
            getEyeWorldPosition: getEyeWorldPosition,
            getMuzzleWorldPosition: getMuzzleWorldPosition,
            getThrowableOriginWorldPosition: getThrowableOriginWorldPosition,
            setMuzzleVisible: setMuzzleVisible,
            triggerFirePose: triggerFirePose,
            applyThrowPose: applyThrowPose,
            triggerThrowPose: triggerThrowPose,
            applyChokeGripPose: applyChokeGripPose,
            triggerChokeGripPose: triggerChokeGripPose,
            getNode: function (name) { return name ? namedNodes[name] || root.getObjectByName(name) : null; },
            getNodeNames: function () { return Object.keys(namedNodes).slice(); },
            getAvailableAnimationNames: function () { return thirdPersonAnimationNames.concat(firstPersonAnimationNames); },
            sampleNamedAnimation: sampleNamedAnimation,
            getWeaponId: function () { return rig.weaponId; },
            _tmp: tmpVec
        };
    };

    globalThis.__MAYHEM_RUNTIME.GameAvatarRig = GameAvatarRig;
})();
