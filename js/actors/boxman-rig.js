import * as THREE_NS from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { ensureThreeGlobal } from '../app/three-runtime.js';
import '../domain/weapons/visuals.js';
import {
    applyDirectionalLocomotionPose,
    createDirectionalLocomotionState,
    directionalLocomotionNeedsCustomStart,
    resolveMoveIntent,
    STOP_DIRECTIONAL_SETTLE_DURATION,
    TURN_SOFT_FULL_RATE,
    TURN_SOFT_START_RATE,
    updateDirectionalLocomotionState
} from './boxman-directional-locomotion.js';

/**
 * boxman-rig.js - Local-player Boxman avatar rig prototype.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameBoxmanRig
 */
(function () {
    'use strict';

    var THREE = THREE_NS;
    var runtime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    var GameBoxmanRig = {};
    var MODEL_URL = '/assets/models/boxman.glb';
    var MANUAL_ROLL_CLIP = 'drop_running_roll';
    var BACKWARD_ROLL_ALIGN_DURATION = 0.12;
    var BACKWARD_ROLL_ALIGN_EPSILON = 10 * (Math.PI / 180);
    var ROLL_LANDING_MIN_DROP_WU = 2.0;
    var ROLL_LANDING_MIN_HORIZONTAL_SPEED_WU = 2.0;
    var RUN_LANDING_MIN_HORIZONTAL_SPEED_WU = 2.8;
    var STOP_ANIM_MIN_SPEED_NORM = 0.75;
    var STOP_FORWARD_WEIGHT_MIN = 0.35;
    var STOP_RECENT_GRACE_SEC = 0.2;
    var STOP_STRAFE_INTERRUPT_PROGRESS = 0.45;
    var FAST_BACKPEDAL_PLAYBACK_SCALE = 1.25;
    var IDLE_AIM_PITCH_LIMIT = 45 * (Math.PI / 180);
    var IDLE_AIM_NEUTRAL_PITCH = 28 * (Math.PI / 180);
    var IDLE_AIM_RESPONSE_SCALE = 0.5;
    var IDLE_AIM_YAW_LIMIT = 90 * (Math.PI / 180);
    var IDLE_AIM_YAW_RESPONSE_SCALE = 1;
    var RUN_AIM_YAW_RESPONSE_WEIGHT = 0.88;
    var IDLE_AIM_UPPER_PITCH_SCALE = -1.9;
    var IDLE_AIM_LOWER_PITCH_SCALE = -0.65;
    var IDLE_AIM_UPPER_YAW_SCALE = 1;
    var IDLE_AIM_LOWER_YAW_SCALE = 0.35;
    var IDLE_AIM_BLEND_IN_SPEED = 12;
    var IDLE_AIM_BLEND_OUT_SPEED = 10;
    var OUTWARD_GUN_YAW_COMPENSATION_SCALE = -0.4;
    var STOP_SETTLE_RIGHT_ARM_RECOVERY_SCALE = 0.65;
    var WEAPON_MODEL_ROTATE_X = (Math.PI * 0.5) - (15 * (Math.PI / 180));
    var WEAPON_MODEL_ROTATE_Y = 0;
    var WEAPON_MODEL_ROTATE_Z = Math.PI;
    var TOON_ATTACHMENT_MOUNT_SCALE = 1;
    var torsoCarryPositionScratch = new THREE.Vector3();
    var RUN_RIGHT_ARM_SWING_UPPER = 6 * (Math.PI / 180);
    var RUN_RIGHT_ARM_SWING_LOWER = 2.4 * (Math.PI / 180);
    var JUMP_RIGHT_ARM_UPPER_PITCH_OFFSET = -5 * (Math.PI / 180);
    var IDLE_RIGHT_ARM_UPPER_BASE = {
        x: 21.02 * (Math.PI / 180),
        y: -7.92 * (Math.PI / 180),
        z: 11.86 * (Math.PI / 180)
    };
    var IDLE_RIGHT_ARM_LOWER_BASE = {
        x: -33.6 * (Math.PI / 180),
        y: 0,
        z: 0
    };
    var IDLE_RIGHT_ARM_OUT_UPPER_X = IDLE_RIGHT_ARM_UPPER_BASE.x + (IDLE_AIM_NEUTRAL_PITCH * IDLE_AIM_UPPER_PITCH_SCALE);
    var IDLE_RIGHT_ARM_OUT_LOWER_X = IDLE_RIGHT_ARM_LOWER_BASE.x + (IDLE_AIM_NEUTRAL_PITCH * IDLE_AIM_LOWER_PITCH_SCALE);

    var templateAsset = null;
    var templatePromise = null;
    var weaponAssetPromiseMap = Object.create(null);
    var weaponAssetMap = Object.create(null);
    var weaponTexturePromiseMap = Object.create(null);
    var weaponTextureMap = Object.create(null);
    var weaponGltfLoader = null;
    var weaponTextureLoader = null;
    var weaponAssetMuzzleScratch = new THREE.Vector3();
    var weaponAssetRotScratch = new THREE.Euler();

    function sharedApi() {
        return runtime.GameShared || {};
    }

    function entityConstants() {
        return sharedApi().entityConstants || {};
    }

    function isBrowserRuntime() {
        return typeof window !== 'undefined' && typeof document !== 'undefined';
    }

    function desiredAvatarHeight() {
        var constants = entityConstants();
        var headCenter = constants.AVATAR_HEAD_CENTER_OFFSET || { y: 2.1 };
        var headSize = constants.AVATAR_HEAD_SIZE || { y: 0.55 };
        var legLeftCenter = constants.AVATAR_LEG_LEFT_CENTER_OFFSET || { y: 0.45 };
        var legRightCenter = constants.AVATAR_LEG_RIGHT_CENTER_OFFSET || { y: 0.45 };
        var legSize = constants.AVATAR_LEG_SIZE || { y: 0.9 };
        var legBottom = Math.min(
            Number(legLeftCenter.y || 0.45) - (Number(legSize.y || 0.9) * 0.5),
            Number(legRightCenter.y || 0.45) - (Number(legSize.y || 0.9) * 0.5)
        );
        var headTop = Number(headCenter.y || 2.1) + (Number(headSize.y || 0.55) * 0.5);
        return (headTop - legBottom) * 0.325;
    }

    function chooseTintColor(options) {
        return (typeof options.tintColor === 'number') ? options.tintColor : 0xffffff;
    }

    function collectMaterials(root) {
        var mats = [];
        if (!root || !root.traverse) return mats;
        root.traverse(function (node) {
            if (!node || !node.material) return;
            var nodeMaterials = Array.isArray(node.material) ? node.material : [node.material];
            for (var i = 0; i < nodeMaterials.length; i++) {
                if (nodeMaterials[i]) mats.push(nodeMaterials[i]);
            }
        });
        return mats;
    }

    function disposeUniqueMaterials(root) {
        var mats = collectMaterials(root);
        var seen = [];
        for (var i = 0; i < mats.length; i++) {
            var material = mats[i];
            if (!material || typeof material.dispose !== 'function' || seen.indexOf(material) !== -1) continue;
            seen.push(material);
            material.dispose();
        }
    }

    function cloneSceneMaterials(root) {
        if (!root || !root.traverse) return;
        root.traverse(function (node) {
            if (!node || !node.isMesh || !node.material) return;
            if (Array.isArray(node.material)) {
                node.material = node.material.map(function (material) {
                    return material && material.clone ? material.clone() : material;
                });
            } else if (node.material.clone) {
                node.material = node.material.clone();
            }
        });
    }

    function cloneVec3(list, fallback) {
        var source = Array.isArray(list) ? list : fallback;
        return [
            Number(source && source[0] || 0),
            Number(source && source[1] || 0),
            Number(source && source[2] || 0)
        ];
    }

    function weaponAssetSpecForPlatform(platform) {
        if (!platform || !platform.asset || !platform.asset.url) return null;
        var type = String(platform.asset.type || '');
        if (type !== 'glb' && type !== 'gltf') return null;
        return platform.asset;
    }

    function setWeaponProceduralPartsVisible(rig, visible) {
        if (!rig) return;
        var parts = rig.weaponProceduralParts || [];
        for (var i = 0; i < parts.length; i++) {
            if (parts[i]) parts[i].visible = !!visible;
        }
    }

    function configureTexture(texture) {
        if (!texture) return texture;
        if (THREE.SRGBColorSpace !== undefined) {
            texture.colorSpace = THREE.SRGBColorSpace;
        } else if (THREE.sRGBEncoding !== undefined) {
            texture.encoding = THREE.sRGBEncoding;
        }
        texture.flipY = false;
        texture.needsUpdate = true;
        return texture;
    }

    function getWeaponGltfLoader() {
        if (!weaponGltfLoader) weaponGltfLoader = new GLTFLoader();
        return weaponGltfLoader;
    }

    function getWeaponTextureLoader() {
        if (!weaponTextureLoader) weaponTextureLoader = new THREE.TextureLoader();
        return weaponTextureLoader;
    }

    function loadWeaponTexture(url) {
        var textureUrl = String(url || '');
        if (!textureUrl || !isBrowserRuntime()) return Promise.resolve(null);
        if (weaponTextureMap[textureUrl]) return Promise.resolve(weaponTextureMap[textureUrl]);
        if (weaponTexturePromiseMap[textureUrl]) return weaponTexturePromiseMap[textureUrl];
        weaponTexturePromiseMap[textureUrl] = ensureThreeGlobal()
            .then(function () {
                return new Promise(function (resolve, reject) {
                    getWeaponTextureLoader().load(
                        textureUrl,
                        function (texture) {
                            weaponTextureMap[textureUrl] = configureTexture(texture);
                            resolve(weaponTextureMap[textureUrl]);
                        },
                        undefined,
                        reject
                    );
                });
            })
            .catch(function (err) {
                delete weaponTexturePromiseMap[textureUrl];
                throw err;
            });
        return weaponTexturePromiseMap[textureUrl];
    }

    function ensureLoadedWeaponMaterial(node) {
        if (!node || !node.isMesh) return [];
        if (!node.material) {
            node.material = new THREE.MeshStandardMaterial({
                color: 0xffffff,
                roughness: 0.76,
                metalness: 0.12,
                side: THREE.DoubleSide
            });
        }
        return Array.isArray(node.material) ? node.material : [node.material];
    }

    function applyLoadedWeaponMaterial(root, texture) {
        if (!root || !root.traverse) return;
        root.visible = true;
        root.traverse(function (node) {
            if (!node || !node.isMesh) return;
            node.visible = true;
            node.frustumCulled = false;
            node.castShadow = true;
            node.receiveShadow = true;
            var materials = ensureLoadedWeaponMaterial(node);
            for (var i = 0; i < materials.length; i++) {
                var material = materials[i];
                if (!material) continue;
                if (texture) material.map = texture;
                if (texture && material.color && material.color.setHex) material.color.setHex(0xffffff);
                if (typeof material.roughness === 'number') material.roughness = 0.76;
                if (typeof material.metalness === 'number') material.metalness = 0.12;
                if (typeof material.opacity === 'number') material.opacity = 1;
                material.transparent = false;
                material.side = THREE.DoubleSide;
                material.needsUpdate = true;
            }
        });
    }

    function loadWeaponAsset(asset) {
        if (!asset || !asset.url || !isBrowserRuntime()) return Promise.resolve(null);
        var url = String(asset.url || '');
        if (weaponAssetMap[url]) return Promise.resolve(weaponAssetMap[url]);
        if (weaponAssetPromiseMap[url]) return weaponAssetPromiseMap[url];
        weaponAssetPromiseMap[url] = ensureThreeGlobal()
            .then(function () {
                return Promise.all([
                    new Promise(function (resolve, reject) {
                        getWeaponGltfLoader().load(url, resolve, undefined, reject);
                    }),
                    loadWeaponTexture(asset.textureUrl)
                ]);
            })
            .then(function (results) {
                var gltf = results[0] || null;
                var object = gltf && gltf.scene ? gltf.scene : null;
                var texture = results[1] || null;
                applyLoadedWeaponMaterial(object, texture);
                weaponAssetMap[url] = object;
                return object;
            })
            .catch(function (err) {
                delete weaponAssetPromiseMap[url];
                throw err;
            });
        return weaponAssetPromiseMap[url];
    }

    function preloadWeaponPackAssets() {
        if (!isBrowserRuntime()) return Promise.resolve(null);
        var visuals = runtime.GameWeaponVisuals || null;
        if (!visuals || !visuals.get) return Promise.resolve(null);
        var weaponIds = ['rifle', 'pistol', 'machinegun', 'shotgun', 'sniper'];
        var loads = [];
        for (var i = 0; i < weaponIds.length; i++) {
            var entry = visuals.get(weaponIds[i]);
            var asset = entry && entry.platform ? weaponAssetSpecForPlatform(entry.platform) : null;
            if (asset) loads.push(loadWeaponAsset(asset).catch(function () { return null; }));
        }
        return Promise.all(loads);
    }

    function cloneWithDetachedRootUserData(root, cloneFn) {
        if (!root || typeof cloneFn !== 'function') return null;
        var originalUserData = root.userData;
        root.userData = {};
        try {
            return cloneFn(root);
        } finally {
            root.userData = originalUserData;
        }
    }

    function buildRevealCloneFactory(root) {
        return function cloneVisualForRevealGhost() {
            if (!root) return null;
            var clone = cloneWithDetachedRootUserData(root, function (target) {
                return cloneSkeleton(target);
            });
            if (!clone) return null;
            clone.userData = {};
            clone.traverse(function (node) {
                if (!node) return;
                if (node !== clone && node.userData) {
                    node.userData = {};
                }
                if (!node.isMesh) return;
                if (node.geometry && node.geometry.clone) {
                    node.geometry = node.geometry.clone();
                }
            });
            return clone;
        };
    }

    function normalizeModelToFeet(sceneRoot) {
        var bounds = new THREE.Box3();
        var size = new THREE.Vector3();
        var center = new THREE.Vector3();
        bounds.setFromObject(sceneRoot);
        bounds.getSize(size);
        var height = Math.max(0.001, Number(size.y || 0));
        var scale = desiredAvatarHeight() / height;

        sceneRoot.scale.setScalar(scale);
        sceneRoot.updateMatrixWorld(true);
        bounds.setFromObject(sceneRoot);
        bounds.getCenter(center);
        sceneRoot.position.x -= center.x;
        sceneRoot.position.z -= center.z;
        sceneRoot.position.y -= bounds.min.y;
        sceneRoot.updateMatrixWorld(true);
    }

    function createActionMap(mixer, animations) {
        var map = {};
        for (var i = 0; i < animations.length; i++) {
            var clip = animations[i];
            if (!clip || !clip.name) continue;
            var action = mixer.clipAction(clip);
            action.enabled = true;
            action.clampWhenFinished = true;
            if (
                clip.name === 'jump_idle' ||
                clip.name === 'jump_running' ||
                clip.name === 'stop' ||
                clip.name === 'start_forward' ||
                clip.name === 'start_left' ||
                clip.name === 'start_right' ||
                clip.name === 'drop_idle' ||
                clip.name === 'drop_running' ||
                clip.name === 'drop_running_roll'
            ) {
                action.setLoop(THREE.LoopOnce, 1);
            } else {
                action.setLoop(THREE.LoopRepeat, Infinity);
            }
            map[clip.name] = action;
        }
        return map;
    }

    function clipStartFraction(clipName) {
        var name = String(clipName || '');
        if (name === 'jump_idle' || name === 'jump_running') return 0.24;
        return 0;
    }

    function clamp01(value) {
        return Math.max(0, Math.min(1, Number(value || 0)));
    }

    function normalizeAngle(angle) {
        var out = Number(angle || 0);
        while (out > Math.PI) out -= Math.PI * 2;
        while (out < -Math.PI) out += Math.PI * 2;
        return out;
    }

    function lerpAngle(start, target, t) {
        return normalizeAngle(Number(start || 0) + (normalizeAngle(Number(target || 0) - Number(start || 0)) * clamp01(t)));
    }

    function createFireRecoilState() {
        return {
            weaponKick: 0,
            shoulderPitch: 0,
            shoulderYaw: 0,
            shoulderRoll: 0,
            lowerArmPitch: 0,
            side: 1,
            recoverPitchScale: 1,
            recoverYawScale: 1,
            recoverRollScale: 1
        };
    }

    function applyFireRecoilPose(rig, recoilState) {
        if (!rig || !recoilState) return false;
        var weaponNode = rig.weaponRoot || rig.gun || rig.weaponCube || null;
        var weaponBasePos = rig.weaponRootBasePos || rig.gunBasePos || null;
        if (weaponNode && weaponBasePos && weaponNode.position && weaponNode.position.copy) {
            weaponNode.position.copy(weaponBasePos);
            weaponNode.position.x += Number(recoilState.side || 0) * Math.abs(Number(recoilState.weaponKick || 0)) * 0.18;
            weaponNode.position.z += Number(recoilState.weaponKick || 0);
        }
        if (rig.armLowerR && rig.armLowerR.rotation) {
            rig.armLowerR.rotation.x += Number(recoilState.lowerArmPitch || 0) * 0.2;
        }
        return true;
    }

    function decayFireRecoilState(recoilState, dt) {
        if (!recoilState) return false;
        var step = Math.max(0, Number(dt || 0));
        var pitchBlend = Math.min(1, step * 24 * Math.max(0.2, Number(recoilState.recoverPitchScale || 1)));
        var yawBlend = Math.min(1, step * 28 * Math.max(0.2, Number(recoilState.recoverYawScale || 1)));
        var rollBlend = Math.min(1, step * 26 * Math.max(0.2, Number(recoilState.recoverRollScale || 1)));
        var lowerArmBlend = Math.min(1, step * 30 * Math.max(0.2, Number(recoilState.recoverPitchScale || 1)));
        var weaponBlend = Math.min(
            1,
            step * 18 * Math.max(0.2, (Number(recoilState.recoverPitchScale || 1) + Number(recoilState.recoverRollScale || 1)) * 0.5)
        );
        recoilState.weaponKick += (0 - recoilState.weaponKick) * weaponBlend;
        recoilState.shoulderPitch += (0 - recoilState.shoulderPitch) * pitchBlend;
        recoilState.shoulderYaw += (0 - recoilState.shoulderYaw) * yawBlend;
        recoilState.shoulderRoll += (0 - recoilState.shoulderRoll) * rollBlend;
        recoilState.lowerArmPitch += (0 - recoilState.lowerArmPitch) * lowerArmBlend;
        return true;
    }

    function triggerFireRecoil(recoilState, options) {
        if (!recoilState) return false;
        var opts = options || {};
        var strength = Math.max(0, Number(opts.strength == null ? 1 : opts.strength));
        var side = Number(opts.side);
        if (!isFinite(side) || side === 0) {
            recoilState.side = recoilState.side > 0 ? -1 : 1;
            side = recoilState.side;
        } else {
            side = side > 0 ? 1 : -1;
            recoilState.side = side;
        }
        var shoulderPitch = Number.isFinite(Number(opts.shoulderPitch))
            ? Number(opts.shoulderPitch)
            : (0.024 * strength);
        var shoulderYaw = Number.isFinite(Number(opts.shoulderYaw))
            ? Number(opts.shoulderYaw)
            : (0.012 * strength);
        var shoulderRoll = Number.isFinite(Number(opts.shoulderRoll))
            ? Number(opts.shoulderRoll)
            : (side * 0.008 * strength);
        var lowerArmPitch = Number.isFinite(Number(opts.lowerArmPitch))
            ? Number(opts.lowerArmPitch)
            : (0.165 * strength);
        var weaponKick = Number.isFinite(Number(opts.weaponKick))
            ? Number(opts.weaponKick)
            : (-0.04 * strength);
        recoilState.weaponKick = Math.max(-0.22, Math.min(0.05, Number(recoilState.weaponKick || 0) + weaponKick));
        recoilState.shoulderPitch = Math.max(-0.5, Math.min(0.24, Number(recoilState.shoulderPitch || 0) + shoulderPitch));
        recoilState.shoulderYaw = Math.max(-0.18, Math.min(0.18, Number(recoilState.shoulderYaw || 0) + shoulderYaw));
        recoilState.shoulderRoll = Math.max(-0.12, Math.min(0.12, Number(recoilState.shoulderRoll || 0) + shoulderRoll));
        recoilState.lowerArmPitch = Math.max(-0.8, Math.min(2.5, Number(recoilState.lowerArmPitch || 0) + lowerArmPitch));
        recoilState.recoverPitchScale = Math.max(0.2, Number(opts.recoverPitchScale || recoilState.recoverPitchScale || 1));
        recoilState.recoverYawScale = Math.max(0.2, Number(opts.recoverYawScale || recoilState.recoverYawScale || 1));
        recoilState.recoverRollScale = Math.max(0.2, Number(opts.recoverRollScale || recoilState.recoverRollScale || 1));
        return true;
    }

    function resolveClipPlayback(animState, clipName) {
        var name = String(clipName || '');
        var reverse = false;
        var timeScale = 1;
        if (
            (name === 'run' || name === 'sprint') &&
            animState &&
            animState.movingBackward &&
            !animState.movingForward
        ) {
            reverse = true;
        }
        if (name === 'run' && animState && animState.fastBackpedal) {
            timeScale = FAST_BACKPEDAL_PLAYBACK_SCALE;
        }
        if (name === MANUAL_ROLL_CLIP && animState && animState.manualRollReverse) {
            reverse = true;
        }
        if (name === 'rotate_left' || name === 'rotate_right') {
            var turnAbs = Math.abs(Number(animState && animState.turnRate || 0));
            var turnBlend = clamp01((turnAbs - TURN_SOFT_START_RATE) / Math.max(0.0001, (TURN_SOFT_FULL_RATE - TURN_SOFT_START_RATE)));
            timeScale = 0.8 + (turnBlend * 0.5);
        }
        return {
            reverse: reverse,
            timeScale: reverse ? -timeScale : timeScale,
            startFraction: clipStartFraction(name)
        };
    }

    function applyPlaybackSettings(action, playback, resetTime) {
        if (!action) return;
        var settings = playback || { timeScale: 1, reverse: false };
        var rate = Number(settings.timeScale || 1);
        var clip = action.getClip ? action.getClip() : null;
        var duration = clip ? Math.max(0, Number(clip.duration || 0)) : 0;
        action.enabled = true;
        action.paused = false;
        action.timeScale = rate;
        if (!resetTime || !(duration > 0)) return;
        var startFraction = Math.max(0, Math.min(1, Number(settings.startFraction || 0)));
        if (rate < 0) {
            action.time = Math.max(0.0001, (duration * (1 - startFraction)) - 0.0001);
        } else {
            action.time = duration * startFraction;
        }
    }

    function keepPlaybackLooping(action, playback) {
        if (!action) return;
        var settings = playback || { timeScale: 1, reverse: false };
        var rate = Number(settings.timeScale || 1);
        var clip = action.getClip ? action.getClip() : null;
        var duration = clip ? Math.max(0, Number(clip.duration || 0)) : 0;
        if (!(duration > 0)) return;
        if (rate < 0 && action.time <= 0.0001) {
            action.time = Math.max(0.0001, duration - 0.0001);
        } else if (rate > 0 && action.time >= (duration - 0.0001)) {
            action.time = 0;
        }
    }

    function playAction(actions, currentState, nextName, fade, playback) {
        var next = actions[nextName] || null;
        if (!next) return;

        if (currentState.clipName === nextName) {
            var nextRate = Number(playback && playback.timeScale || 1);
            if (currentState.playbackRate !== nextRate) {
                applyPlaybackSettings(next, playback, false);
                currentState.playbackRate = nextRate;
            }
            return;
        }

        if (currentState.action) {
            currentState.action.fadeOut(fade);
        }

        next.reset();
        applyPlaybackSettings(next, playback, true);
        next.fadeIn(fade).play();
        currentState.action = next;
        currentState.clipName = nextName;
        currentState.playbackRate = Number(playback && playback.timeScale || 1);
    }

    function isDirectionalMove(animState) {
        if (!animState) return false;
        return !!(animState.movingForward || animState.movingBackward || animState.movingLeft || animState.movingRight);
    }

    function movementStartClip(animState) {
        if (!animState) return 'start_forward';
        return directionalLocomotionNeedsCustomStart(animState) ? '' : 'start_forward';
    }

    function idleAimAllowed(animState, activeClipName) {
        if (!animState) return false;
        if (clipUsesLockedRightArmAimBasePose(activeClipName)) return true;
        if (animState.sprinting) return false;
        if (activeClipName === 'sprint' || activeClipName === MANUAL_ROLL_CLIP) return false;
        return true;
    }

    function idleAimNeutralWeight(activeClipName) {
        return 1;
    }

    function idleAimResponseWeight(activeClipName) {
        return 1;
    }

    function idleAimTargetPitch(animState, activeClipName) {
        if (!animState) return 0;
        var aimPitch = Number(animState.aimPitch || 0);
        if (!isFinite(aimPitch)) return 0;
        var effectiveAimPitch = (
            IDLE_AIM_NEUTRAL_PITCH * idleAimNeutralWeight(activeClipName)
        ) + (
            aimPitch * IDLE_AIM_RESPONSE_SCALE * idleAimResponseWeight(activeClipName)
        );
        return Math.max(-IDLE_AIM_PITCH_LIMIT, Math.min(IDLE_AIM_PITCH_LIMIT, effectiveAimPitch));
    }

    function idleAimYawResponseWeight(activeClipName) {
        if (activeClipName === 'run') return RUN_AIM_YAW_RESPONSE_WEIGHT;
        return 1;
    }

    function idleAimTargetYaw(directionalState, activeClipName) {
        var facingYaw = Number(directionalState && directionalState.facingYaw || 0);
        if (!isFinite(facingYaw)) return 0;
        var effectiveAimYaw = facingYaw * IDLE_AIM_YAW_RESPONSE_SCALE * idleAimYawResponseWeight(activeClipName);
        return Math.max(-IDLE_AIM_YAW_LIMIT, Math.min(IDLE_AIM_YAW_LIMIT, effectiveAimYaw));
    }

    function resolveIdleAimYawState(motionState, stopSettleWeight) {
        var settleWeight = clamp01(stopSettleWeight);
        if (settleWeight > 0 && motionState && motionState.stopDirectionalSnapshot) {
            return {
                facingYaw: Number(motionState.stopDirectionalSnapshot.facingYaw || 0) * settleWeight
            };
        }
        var directional = motionState && motionState.directional ? motionState.directional : null;
        return {
            facingYaw: Number(directional && directional.facingYaw || 0)
        };
    }

    function idleAimPoseWeight(activeClipName) {
        return 1;
    }

    function applyIdleAimPose(rig, aimPoseState) {
        if (!rig || !aimPoseState) return false;
        var clampedAimPitch = Number(aimPoseState.currentPitch || 0);
        var clampedAimYaw = Number(aimPoseState.currentYaw || 0);
        if (Math.abs(clampedAimPitch) < 0.0001 && Math.abs(clampedAimYaw) < 0.0001) return false;
        var poseWeight = Math.max(0, Math.min(1, Number(aimPoseState.weight == null ? 1 : aimPoseState.weight)));
        if (!(poseWeight > 0)) return false;
        if (rig.armUpperR && rig.armUpperR.rotation) {
            rig.armUpperR.rotation.x += clampedAimPitch * IDLE_AIM_UPPER_PITCH_SCALE * poseWeight;
            rig.armUpperR.rotation.y += clampedAimYaw * IDLE_AIM_UPPER_YAW_SCALE * poseWeight;
        }
        if (rig.armLowerR && rig.armLowerR.rotation) {
            rig.armLowerR.rotation.x += clampedAimPitch * IDLE_AIM_LOWER_PITCH_SCALE * poseWeight;
            rig.armLowerR.rotation.y += clampedAimYaw * IDLE_AIM_LOWER_YAW_SCALE * poseWeight;
        }
        return true;
    }

    function applyWeaponOrientationCompensation(rig, aimPoseState) {
        if (!rig || !rig.weaponRoot || !rig.weaponRootBaseRot || !rig.weaponRoot.rotation) return false;
        var currentYaw = Number(aimPoseState && aimPoseState.currentYaw || 0);
        rig.weaponRoot.rotation.set(
            rig.weaponRootBaseRot.x,
            rig.weaponRootBaseRot.y,
            rig.weaponRootBaseRot.z
        );
        if (!(currentYaw > 0.0001)) return false;
        rig.weaponRoot.rotation.y += currentYaw * OUTWARD_GUN_YAW_COMPENSATION_SCALE;
        return true;
    }

    function applyTorsoCarryPose(rig, directionalState) {
        if (!rig || !directionalState) return false;
        var upperYaw = Number(directionalState.bodyUpperAimYaw || 0);
        void rig;
        return Math.abs(upperYaw) >= 0.0001;
    }

    function lockedRightArmUpperPitchOffset(activeClipName) {
        var clipName = String(activeClipName || '');
        if (clipName === 'jump_idle' || clipName === 'jump_running') {
            return JUMP_RIGHT_ARM_UPPER_PITCH_OFFSET;
        }
        return 0;
    }

    function applyLockedRightArmAimBasePose(rig, activeClipName) {
        if (!rig) return false;
        var upperPitchOffset = lockedRightArmUpperPitchOffset(activeClipName);
        if (rig.armUpperR && rig.armUpperR.rotation) {
            rig.armUpperR.rotation.x = IDLE_RIGHT_ARM_OUT_UPPER_X + upperPitchOffset;
            rig.armUpperR.rotation.y = IDLE_RIGHT_ARM_UPPER_BASE.y;
            rig.armUpperR.rotation.z = IDLE_RIGHT_ARM_UPPER_BASE.z;
        }
        if (rig.armLowerR && rig.armLowerR.rotation) {
            rig.armLowerR.rotation.x = IDLE_RIGHT_ARM_OUT_LOWER_X;
            rig.armLowerR.rotation.y = IDLE_RIGHT_ARM_LOWER_BASE.y;
            rig.armLowerR.rotation.z = IDLE_RIGHT_ARM_LOWER_BASE.z;
        }
        return !!(
            (rig.armUpperR && rig.armUpperR.rotation) ||
            (rig.armLowerR && rig.armLowerR.rotation)
        );
    }

    function clipUsesLockedRightArmAimBasePose(activeClipName) {
        var clipName = String(activeClipName || '');
        return (
            clipName === 'rotate_left' ||
            clipName === 'rotate_right' ||
            clipName === 'start_left' ||
            clipName === 'start_right' ||
            clipName === 'jump_idle' ||
            clipName === 'jump_running' ||
            clipName === 'falling' ||
            clipName === 'drop_idle' ||
            clipName === 'drop_running'
        );
    }

    function applyStopSettleRightArmRecoveryPose(rig, stopSettleWeight) {
        if (!rig) return false;
        var weight = clamp01(stopSettleWeight) * STOP_SETTLE_RIGHT_ARM_RECOVERY_SCALE;
        if (!(weight > 0)) return false;
        if (rig.armUpperR && rig.armUpperR.rotation) {
            rig.armUpperR.rotation.x += (IDLE_RIGHT_ARM_OUT_UPPER_X - Number(rig.armUpperR.rotation.x || 0)) * weight;
            rig.armUpperR.rotation.y += (IDLE_RIGHT_ARM_UPPER_BASE.y - Number(rig.armUpperR.rotation.y || 0)) * weight;
            rig.armUpperR.rotation.z += (IDLE_RIGHT_ARM_UPPER_BASE.z - Number(rig.armUpperR.rotation.z || 0)) * weight;
        }
        if (rig.armLowerR && rig.armLowerR.rotation) {
            rig.armLowerR.rotation.x += (IDLE_RIGHT_ARM_OUT_LOWER_X - Number(rig.armLowerR.rotation.x || 0)) * weight;
            rig.armLowerR.rotation.y += (IDLE_RIGHT_ARM_LOWER_BASE.y - Number(rig.armLowerR.rotation.y || 0)) * weight;
            rig.armLowerR.rotation.z += (IDLE_RIGHT_ARM_LOWER_BASE.z - Number(rig.armLowerR.rotation.z || 0)) * weight;
        }
        return true;
    }

    function applyRunRightArmIdleBasePose(rig, activeClipName, activeAction) {
        if (!rig || activeClipName !== 'run') return false;
        if (!applyLockedRightArmAimBasePose(rig)) return false;
        var runRightArmPitchOffset = -25 * (Math.PI / 180);
        var phase = 0;
        if (activeAction && activeAction.getClip) {
            var clip = activeAction.getClip();
            var duration = clip ? Math.max(0.0001, Number(clip.duration || 0)) : 0.0001;
            phase = ((Number(activeAction.time || 0) / duration) % 1) * Math.PI * 2;
        }
        var suppressRunSwing = !!(rig.fireRecoilState && (
            Math.abs(Number(rig.fireRecoilState.shoulderPitch || 0)) > 0.0001 ||
            Math.abs(Number(rig.fireRecoilState.lowerArmPitch || 0)) > 0.0001 ||
            Math.abs(Number(rig.fireRecoilState.weaponKick || 0)) > 0.0001
        ));
        var upperSwing = 0;
        var lowerSwing = 0;
        if (rig.armUpperR && rig.armUpperR.rotation) {
            rig.armUpperR.rotation.x += runRightArmPitchOffset + upperSwing;
        }
        if (rig.armLowerR && rig.armLowerR.rotation) {
            rig.armLowerR.rotation.x += lowerSwing;
        }
        return true;
    }

    function resolveHorizontalSpeed(animState) {
        if (!animState) return 0;
        if (typeof animState.horizontalSpeed === 'number' && isFinite(animState.horizontalSpeed)) {
            return Math.max(0, Number(animState.horizontalSpeed));
        }
        if (typeof animState.worldSpeed === 'number' && isFinite(animState.worldSpeed)) {
            return Math.max(0, Number(animState.worldSpeed));
        }
        return 0;
    }

    function landingClip(motionState, animState) {
        if (!animState) return 'drop_idle';
        if (
            Number(motionState.lastLandingHorizontalSpeed || 0) >= ROLL_LANDING_MIN_HORIZONTAL_SPEED_WU &&
            Number(motionState.lastLandingDropDistance || 0) >= ROLL_LANDING_MIN_DROP_WU
        ) {
            return 'drop_running_roll';
        }
        if (
            Number(motionState.lastLandingHorizontalSpeed || 0) >= RUN_LANDING_MIN_HORIZONTAL_SPEED_WU ||
            isDirectionalMove(animState)
        ) {
            return 'drop_running';
        }
        return 'drop_idle';
    }

    function clipDuration(actions, clipName, fallback) {
        var action = actions[clipName] || null;
        if (!action || !action.getClip) return Number(fallback || 0);
        return Number(action.getClip().duration || fallback || 0);
    }

    function resolveRollFacingYaw(animState) {
        var intent = resolveMoveIntent(animState);
        if (!intent.moving) return 0;
        return -Number(intent.angle || 0);
    }

    function isBackwardRollIntent(animState) {
        return !!(animState && animState.movingBackward && !animState.movingForward);
    }

    function resolveManualRollFacingYaw(animState, currentFacingYaw) {
        return isBackwardRollIntent(animState)
            ? normalizeAngle(Number(currentFacingYaw || 0))
            : resolveRollFacingYaw(animState);
    }

    function needsBackwardRollAlign(currentFacingYaw) {
        return Math.abs(normalizeAngle(currentFacingYaw)) > BACKWARD_ROLL_ALIGN_EPSILON;
    }

    function resolveIdleTurnClip(motionState) {
        var directional = motionState && motionState.directional ? motionState.directional : null;
        if (!directional || !directional.useTurnLoopClip) return '';
        return directional.turnClipDirection > 0 ? 'rotate_left' : 'rotate_right';
    }

    function cloneDirectionalSnapshot(state) {
        if (!state) return null;
        return {
            intent: state.intent ? {
                moving: !!state.intent.moving,
                forwardAxis: Number(state.intent.forwardAxis || 0),
                rightAxis: Number(state.intent.rightAxis || 0),
                magnitude: Number(state.intent.magnitude || 0),
                angle: Number(state.intent.angle || 0),
                absAngle: Number(state.intent.absAngle || 0),
                sideSign: Number(state.intent.sideSign || 0),
                pureForward: !!state.intent.pureForward,
                pureBackpedal: !!state.intent.pureBackpedal,
                pureStrafe: !!state.intent.pureStrafe,
                diagonal: !!state.intent.diagonal
            } : resolveMoveIntent(null),
            profile: state.profile ? {
                facingYaw: Number(state.profile.facingYaw || 0),
                retreatLean: Number(state.profile.retreatLean || 0),
                fromLabel: String(state.profile.fromLabel || ''),
                toLabel: String(state.profile.toLabel || ''),
                blend: Number(state.profile.blend || 0),
                label: String(state.profile.label || '')
            } : null,
            startRemaining: Number(state.startRemaining || 0),
            facingYaw: Number(state.facingYaw || 0),
            bodyLowerAimYaw: Number(state.bodyLowerAimYaw || 0),
            bodyUpperAimYaw: Number(state.bodyUpperAimYaw || 0),
            headAimYaw: Number(state.headAimYaw || 0),
            idleTurnPoseWeight: 0,
            idleTurnDirection: 0,
            useTurnEntryClip: false,
            useTurnLoopClip: false,
            turnLoopPoseWeight: 0,
            turnClipDirection: 0,
            poseName: String(state.poseName || '')
        };
    }

    function resolveForwardStopWeight(intent) {
        if (!intent || !intent.moving) return 0;
        var magnitude = Math.max(0.0001, Number(intent.magnitude || 0));
        return Math.max(0, Number(intent.forwardAxis || 0)) / magnitude;
    }

    function refreshRecentForwardStopWindow(motionState, animState, directional, delta) {
        motionState.recentForwardStopRemaining = Math.max(0, Number(motionState.recentForwardStopRemaining || 0) - delta);
        if (!(animState && !animState.airborne && directional && directional.intent && directional.intent.moving)) return;
        var forwardStopWeight = resolveForwardStopWeight(directional.intent);
        if (
            Number(animState.speedNorm || 0) >= STOP_ANIM_MIN_SPEED_NORM &&
            forwardStopWeight >= STOP_FORWARD_WEIGHT_MIN
        ) {
            motionState.recentForwardStopRemaining = STOP_RECENT_GRACE_SEC;
            motionState.recentForwardStopWeight = forwardStopWeight;
        }
    }

    function beginStopDirectionalSettle(motionState, durationSec) {
        motionState.stopDirectionalSnapshot = motionState.lastMoveDirectionalSnapshot
            ? cloneDirectionalSnapshot(motionState.lastMoveDirectionalSnapshot)
            : null;
        var requestedDuration = Math.max(0.08, Number(durationSec || STOP_DIRECTIONAL_SETTLE_DURATION));
        var poseName = String(
            motionState.stopDirectionalSnapshot && motionState.stopDirectionalSnapshot.poseName || ''
        );
        if (poseName === 'strafe_left' || poseName === 'strafe_right') {
            requestedDuration *= 0.55;
        } else if (poseName === 'forward_left' || poseName === 'forward_right') {
            requestedDuration *= 0.75;
        }
        motionState.stopSettleDuration = requestedDuration;
        motionState.stopSettleRemaining = motionState.stopSettleDuration;
    }

    function stopDirectionalSettleWeight(motionState) {
        if (!(motionState && Number(motionState.stopSettleRemaining || 0) > 0 && Number(motionState.stopSettleDuration || 0) > 0)) {
            return 0;
        }
        var ratio = clamp01(Number(motionState.stopSettleRemaining || 0) / Math.max(0.0001, Number(motionState.stopSettleDuration || 0)));
        return ratio * ratio * (3 - (2 * ratio));
    }

    function stopInterruptCategory(intent) {
        if (!intent || !intent.moving) return '';
        var forwardAxis = Number(intent.forwardAxis || 0);
        if (forwardAxis > 0.15) return 'forward';
        if (forwardAxis < -0.15) return 'backward';
        return 'strafe';
    }

    function canInterruptStopLock(motionState, intent) {
        var category = stopInterruptCategory(intent);
        if (category === 'forward') return true;
        if (category === 'backward') return false;
        if (category !== 'strafe') return false;
        var duration = Math.max(0.0001, Number(motionState && motionState.stopLockDuration || 0));
        var remaining = Math.max(0, Number(motionState && motionState.lockRemaining || 0));
        var progress = 1 - (remaining / duration);
        return progress >= STOP_STRAFE_INTERRUPT_PROGRESS;
    }

    function selectClip(animState, motionState, actions) {
        var moving = isDirectionalMove(animState);
        var grounded = !!(animState && !animState.airborne);
        var directional = motionState && motionState.directional ? motionState.directional : createDirectionalLocomotionState();

        if (motionState.lockName === 'stop' && motionState.lockRemaining > 0 && moving) {
            if (canInterruptStopLock(motionState, directional && directional.intent)) {
                motionState.lockName = '';
                motionState.lockRemaining = 0;
                motionState.stopSettleRemaining = 0;
                motionState.stopLockDuration = 0;
            } else {
                return motionState.lockName;
            }
        }

        if (motionState.lockName && motionState.lockRemaining > 0) {
            return motionState.lockName;
        }

        if (grounded && !motionState.wasGrounded) {
            motionState.lockName = landingClip(motionState, animState);
            motionState.lockRemaining = Math.max(0.12, clipDuration(actions, motionState.lockName, 0.2) * 0.8);
            return motionState.lockName;
        }

        if (motionState.jumpTriggered && animState && animState.airborne) {
            motionState.lockName = moving ? 'jump_running' : 'jump_idle';
            motionState.lockRemaining = Math.max(0.12, clipDuration(actions, motionState.lockName, 0.24) * 0.55);
            motionState.jumpTriggered = false;
            return motionState.lockName;
        }

        if (grounded && moving && !motionState.wasMoving) {
            if (directionalLocomotionNeedsCustomStart(animState)) {
                return (animState && animState.sprinting && Number(animState.speedNorm || 0) > 0.4) ? 'sprint' : 'run';
            }
            motionState.lockName = movementStartClip(animState);
            if (motionState.lockName) {
                motionState.lockRemaining = Math.max(0.12, clipDuration(actions, motionState.lockName, 0.22) * 0.65);
                return motionState.lockName;
            }
        }

        if (grounded && !moving && motionState.wasMoving) {
            var lastIntent = motionState.lastMoveIntent || resolveMoveIntent(null);
            var forwardStopWeight = resolveForwardStopWeight(lastIntent);
            var currentForwardStopEligible = (
                Number(motionState.lastGroundedSpeed || 0) >= STOP_ANIM_MIN_SPEED_NORM &&
                forwardStopWeight >= STOP_FORWARD_WEIGHT_MIN
            );
            var recentForwardStopEligible = (
                Number(motionState.recentForwardStopRemaining || 0) > 0 &&
                Number(motionState.recentForwardStopWeight || 0) >= STOP_FORWARD_WEIGHT_MIN
            );
            beginStopDirectionalSettle(motionState, STOP_DIRECTIONAL_SETTLE_DURATION);
            if (!(currentForwardStopEligible || recentForwardStopEligible)) {
                motionState.lockName = '';
                motionState.lockRemaining = 0;
                return 'idle';
            }
            motionState.lockName = 'stop';
            motionState.lockRemaining = Math.max(0.1, clipDuration(actions, 'stop', 0.18) * 0.7);
            motionState.stopLockDuration = motionState.lockRemaining;
            return motionState.lockName;
        }

        if (animState && animState.airborne) {
            return 'falling';
        }

        if (grounded && !moving) {
            if (directional.useTurnEntryClip && motionState.turnEntryDirection !== directional.turnClipDirection) {
                motionState.turnEntryDirection = directional.turnClipDirection;
                motionState.lockName = directional.turnClipDirection > 0 ? 'start_left' : 'start_right';
                motionState.lockRemaining = Math.max(0.08, clipDuration(actions, motionState.lockName, 0.18) * 0.55);
                return motionState.lockName;
            }
            if (!directional.useTurnLoopClip) {
                motionState.turnEntryDirection = 0;
            }
            var turnClip = resolveIdleTurnClip(motionState);
            if (turnClip) return turnClip;
        }

        if (animState && animState.sprinting && Number(animState.speedNorm || 0) > 0.4) {
            return 'sprint';
        }

        if (moving || (animState && Number(animState.worldSpeed || 0) > 0.2)) {
            return 'run';
        }

        return 'idle';
    }

    function loadTemplate() {
        if (templateAsset) return Promise.resolve(templateAsset);
        if (!isBrowserRuntime()) return Promise.resolve(null);
        if (!templatePromise) {
            templatePromise = ensureThreeGlobal()
                .then(function () {
                    return new Promise(function (resolve, reject) {
                        var loader = new GLTFLoader();
                        loader.load(MODEL_URL, resolve, undefined, reject);
                    });
                })
                .then(function (gltf) {
                    templateAsset = {
                        scene: gltf.scene,
                        animations: Array.isArray(gltf.animations) ? gltf.animations.slice() : []
                    };
                    return templateAsset;
                })
                .catch(function (err) {
                    templatePromise = null;
                    throw err;
                });
        }
        return templatePromise;
    }

    function loadReadyTemplate() {
        if (!templateAsset) {
            throw new Error('GameBoxmanRig.create requires GameBoxmanRig.preload to complete first.');
        }
        return templateAsset;
    }

    function createAnchor(parent, x, y, z) {
        var anchor = new THREE.Object3D();
        anchor.position.set(Number(x || 0), Number(y || 0), Number(z || 0));
        if (parent) parent.add(anchor);
        return anchor;
    }

    function resolveAnimatedBone(modelRoot, skinnedMesh, preferredNames, fallback) {
        var names = Array.isArray(preferredNames) ? preferredNames : [preferredNames];
        var skeleton = skinnedMesh && skinnedMesh.skeleton ? skinnedMesh.skeleton : null;
        var bones = skeleton && Array.isArray(skeleton.bones) ? skeleton.bones : [];
        for (var i = 0; i < names.length; i++) {
            var targetName = String(names[i] || '');
            if (!targetName) continue;
            for (var j = 0; j < bones.length; j++) {
                var bone = bones[j];
                if (bone && bone.name === targetName) return bone;
            }
        }
        for (var n = 0; n < names.length; n++) {
            var nodeName = String(names[n] || '');
            if (!nodeName || !modelRoot || !modelRoot.getObjectByName) continue;
            var found = modelRoot.getObjectByName(nodeName);
            if (found) return found;
        }
        return fallback || modelRoot || null;
    }

    function pistolMountConfig() {
        return {
            stickerPos: { x: 0, y: 0.18, z: 0 },
            stickerRot: { x: -Math.PI * 0.5, y: 0, z: 0 },
            rootPos: { x: -0.04, y: 0.65, z: -0.06 },
            rootRot: { x: 0.08 - (10 * (Math.PI / 180)), y: 0.22, z: 0 },
            muzzlePos: { x: 0, y: 0, z: -0.09 }
        };
    }

    function throwableMountConfig() {
        var handMount = pistolMountConfig();
        return {
            rootPos: {
                x: handMount.rootPos.x,
                y: handMount.rootPos.y,
                z: handMount.rootPos.z
            },
            rootRot: {
                x: handMount.rootRot.x,
                y: handMount.rootRot.y,
                z: handMount.rootRot.z
            },
            originPos: { x: 0, y: 0, z: 0 }
        };
    }

    function resolveWeaponVisualEntry(weaponId) {
        var visuals = runtime.GameWeaponVisuals || null;
        if (!visuals || !visuals.get) return null;
        return visuals.get(weaponId);
    }

    function resolveToonAttachmentMountOffset(platform) {
        var attachment = platform && platform.toonAttachment ? platform.toonAttachment : null;
        if (!attachment || attachment.useMountOffset !== true || !Array.isArray(attachment.translation)) {
            return [0, 0, 0];
        }
        var baselineEntry = resolveWeaponVisualEntry('rifle');
        var baseline = baselineEntry && baselineEntry.platform && baselineEntry.platform.toonAttachment
            ? baselineEntry.platform.toonAttachment
            : null;
        if (!baseline || !Array.isArray(baseline.translation)) return [0, 0, 0];
        if (attachment.sourceUrl !== baseline.sourceUrl || attachment.parentNode !== baseline.parentNode) {
            return [0, 0, 0];
        }

        var dx = Number(attachment.translation[0] || 0) - Number(baseline.translation[0] || 0);
        var dy = Number(attachment.translation[1] || 0) - Number(baseline.translation[1] || 0);
        var dz = Number(attachment.translation[2] || 0) - Number(baseline.translation[2] || 0);

        // Boxman has no Index1.R bone, so keep scout as calibration and use only authored translation deltas.
        return [
            dx * TOON_ATTACHMENT_MOUNT_SCALE,
            -dy * TOON_ATTACHMENT_MOUNT_SCALE,
            -dz * TOON_ATTACHMENT_MOUNT_SCALE
        ];
    }

    function composeToonAttachmentMatrix(attachment) {
        if (!attachment || !Array.isArray(attachment.translation) || !Array.isArray(attachment.rotation)) return null;
        return new THREE.Matrix4().compose(
            new THREE.Vector3(
                Number(attachment.translation[0] || 0),
                Number(attachment.translation[1] || 0),
                Number(attachment.translation[2] || 0)
            ),
            new THREE.Quaternion(
                Number(attachment.rotation[0] || 0),
                Number(attachment.rotation[1] || 0),
                Number(attachment.rotation[2] || 0),
                Number(attachment.rotation[3] != null ? attachment.rotation[3] : 1)
            ),
            new THREE.Vector3(
                Number(attachment.scale && attachment.scale[0] != null ? attachment.scale[0] : 1),
                Number(attachment.scale && attachment.scale[1] != null ? attachment.scale[1] : 1),
                Number(attachment.scale && attachment.scale[2] != null ? attachment.scale[2] : 1)
            )
        );
    }

    function composeWeaponAssetPlacementMatrix(platform) {
        var asset = weaponAssetSpecForPlatform(platform);
        if (!asset) return null;
        var zones = platform && platform.zones ? platform.zones : {};
        var scale = Math.max(0.001, Number(asset.scale || 1));
        var rotationDeg = cloneVec3(asset.rotationDeg, [0, 0, 0]);
        var sourceMuzzle = cloneVec3(asset.sourceMuzzle, [0, 0, 0]);
        var muzzle = cloneVec3(zones.muzzle, [0, 0.02, -0.56]);
        var rotation = new THREE.Euler(
            Number(rotationDeg[0] || 0) * (Math.PI / 180),
            Number(rotationDeg[1] || 0) * (Math.PI / 180),
            Number(rotationDeg[2] || 0) * (Math.PI / 180)
        );
        var source = new THREE.Vector3(sourceMuzzle[0], sourceMuzzle[1], sourceMuzzle[2]);
        source.applyEuler(rotation).multiplyScalar(scale);
        return new THREE.Matrix4().compose(
            new THREE.Vector3(
                Number(muzzle[0] || 0) - source.x,
                Number(muzzle[1] || 0) - source.y,
                Number(muzzle[2] || 0) - source.z
            ),
            new THREE.Quaternion().setFromEuler(rotation),
            new THREE.Vector3(scale, scale, scale)
        );
    }

    function composeLegacyWeaponModelMatrix(platform) {
        if (!platform) return null;
        var mount = platform.mount || {};
        var zones = platform.zones || {};
        var handleBack = Array.isArray(zones.handleBack) ? zones.handleBack : [0, -0.12, 0.12];
        var mountPos = Array.isArray(mount.position) ? mount.position : [0, 0, 0];
        var mountRotDeg = Array.isArray(mount.rotationDeg) ? mount.rotationDeg : [0, 0, 0];
        return new THREE.Matrix4().compose(
            new THREE.Vector3(
                Number(mountPos[0] || 0) - Number(handleBack[0] || 0),
                Number(mountPos[1] || 0) - Number(handleBack[1] || 0),
                (Number(mountPos[2] || 0) - Number(handleBack[2] || 0)) - 0.175
            ),
            new THREE.Quaternion().setFromEuler(new THREE.Euler(
                (Number(mountRotDeg[0] || 0) * (Math.PI / 180)) + WEAPON_MODEL_ROTATE_X,
                (Number(mountRotDeg[1] || 0) * (Math.PI / 180)) + WEAPON_MODEL_ROTATE_Y,
                (Number(mountRotDeg[2] || 0) * (Math.PI / 180)) + WEAPON_MODEL_ROTATE_Z
            )),
            new THREE.Vector3(1, 1, 1)
        );
    }

    function resolveToonAttachmentModelTransform(platform) {
        var attachment = platform && platform.toonAttachment ? platform.toonAttachment : null;
        if (!attachment || attachment.useMountOffset !== true) return null;
        var baselineEntry = resolveWeaponVisualEntry('rifle');
        var baselinePlatform = baselineEntry && baselineEntry.platform ? baselineEntry.platform : null;
        var baseline = baselinePlatform && baselinePlatform.toonAttachment ? baselinePlatform.toonAttachment : null;
        if (!baseline || attachment.sourceUrl !== baseline.sourceUrl || attachment.parentNode !== baseline.parentNode) {
            return null;
        }

        var baselineModel = composeLegacyWeaponModelMatrix(baselinePlatform);
        var baselineAsset = composeWeaponAssetPlacementMatrix(baselinePlatform);
        var baselineAttachment = composeToonAttachmentMatrix(baseline);
        var weaponAsset = composeWeaponAssetPlacementMatrix(platform);
        var weaponAttachment = composeToonAttachmentMatrix(attachment);
        if (!baselineModel || !baselineAsset || !baselineAttachment || !weaponAsset || !weaponAttachment) return null;

        var matrix = baselineModel
            .clone()
            .multiply(baselineAsset)
            .multiply(baselineAttachment.clone().invert())
            .multiply(weaponAttachment)
            .multiply(weaponAsset.clone().invert());
        var position = new THREE.Vector3();
        var rotation = new THREE.Quaternion();
        var scale = new THREE.Vector3();
        matrix.decompose(position, rotation, scale);
        return {
            position: position,
            rotation: new THREE.Euler().setFromQuaternion(rotation, 'XYZ')
        };
    }

    function defaultWeaponMaterialTuning(partName) {
        var name = String(partName || '');
        if (name === 'grip' || name === 'stock' || name === 'underbarrel') {
            return { roughness: 0.84, metalness: 0.04 };
        }
        if (name === 'optic' || name === 'opticRail' || name === 'feed' || name === 'muzzleDevice') {
            return { roughness: 0.68, metalness: 0.22 };
        }
        return { roughness: 0.72, metalness: 0.14 };
    }

    function createWeaponPartMesh(partName) {
        var tuning = defaultWeaponMaterialTuning(partName);
        return new THREE.Mesh(
            new THREE.BoxGeometry(1, 1, 1),
            new THREE.MeshStandardMaterial({
                color: 0x111111,
                roughness: tuning.roughness,
                metalness: tuning.metalness
            })
        );
    }

    function createMuzzleFlashMesh() {
        var group = new THREE.Group();
        group.visible = false;
        group.position.z = -0.035;
        var material = new THREE.MeshBasicMaterial({
            color: 0xffd27a,
            transparent: true,
            opacity: 0.85,
            depthWrite: false,
            side: THREE.DoubleSide
        });
        var planeA = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.08), material);
        var planeB = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.06), material.clone());
        planeB.rotation.x = Math.PI * 0.5;
        group.add(planeA);
        group.add(planeB);
        return group;
    }

    function applyWeaponPartMesh(mesh, part, partName) {
        if (!mesh) return false;
        var visible = !!(part && part.visible !== false);
        mesh.visible = visible;
        if (!visible) return false;
        var position = Array.isArray(part.position) ? part.position : [0, 0, 0];
        var size = Array.isArray(part.size) ? part.size : [0.01, 0.01, 0.01];
        var tuning = defaultWeaponMaterialTuning(partName);
        mesh.position.set(
            Number(position[0] || 0),
            Number(position[1] || 0),
            Number(position[2] || 0)
        );
        mesh.scale.set(
            Math.max(0.001, Number(size[0] || 0.01)),
            Math.max(0.001, Number(size[1] || 0.01)),
            Math.max(0.001, Number(size[2] || 0.01))
        );
        if (mesh.material) {
            if (mesh.material.color && typeof part.color === 'number') {
                mesh.material.color.setHex(part.color);
            }
            if (typeof mesh.material.roughness === 'number') {
                mesh.material.roughness = tuning.roughness;
            }
            if (typeof mesh.material.metalness === 'number') {
                mesh.material.metalness = tuning.metalness;
            }
        }
        return true;
    }

    function clearLoadedWeaponAsset(rig) {
        if (!rig) return;
        if (rig.weaponLoadedAssetRoot && rig.weaponLoadedAssetRoot.parent) {
            rig.weaponLoadedAssetRoot.parent.remove(rig.weaponLoadedAssetRoot);
        }
        rig.weaponLoadedAssetRoot = null;
        rig.weaponLoadedAssetUrl = '';
        setWeaponProceduralPartsVisible(rig, true);
    }

    function attachLoadedWeaponAsset(rig, platform, sourceRoot, token) {
        if (!rig || !platform || !sourceRoot || rig.weaponAssetToken !== token) return false;
        var asset = weaponAssetSpecForPlatform(platform);
        if (!asset || !rig.weaponModel) return false;

        clearLoadedWeaponAsset(rig);
        var clone = sourceRoot.clone(true);
        var scale = Math.max(0.001, Number(asset.scale || 1));
        var rotationDeg = cloneVec3(asset.rotationDeg, [0, 0, 0]);
        var zones = platform.zones || {};
        var muzzle = cloneVec3(zones.muzzle, [0, 0.02, -0.56]);
        var sourceMuzzle = cloneVec3(asset.sourceMuzzle, [0, 0, 0]);

        weaponAssetRotScratch.set(
            Number(rotationDeg[0] || 0) * (Math.PI / 180),
            Number(rotationDeg[1] || 0) * (Math.PI / 180),
            Number(rotationDeg[2] || 0) * (Math.PI / 180)
        );
        weaponAssetMuzzleScratch.set(sourceMuzzle[0], sourceMuzzle[1], sourceMuzzle[2]);
        weaponAssetMuzzleScratch.applyEuler(weaponAssetRotScratch).multiplyScalar(scale);

        clone.scale.setScalar(scale);
        clone.rotation.copy(weaponAssetRotScratch);
        clone.position.set(
            Number(muzzle[0] || 0) - weaponAssetMuzzleScratch.x,
            Number(muzzle[1] || 0) - weaponAssetMuzzleScratch.y,
            Number(muzzle[2] || 0) - weaponAssetMuzzleScratch.z
        );
        clone.userData = clone.userData || {};
        clone.userData.weaponAssetUrl = String(asset.url || '');
        rig.weaponModel.add(clone);
        rig.weaponLoadedAssetRoot = clone;
        rig.weaponLoadedAssetUrl = String(asset.url || '');
        setWeaponProceduralPartsVisible(rig, false);
        return true;
    }

    function syncLoadedWeaponAsset(rig, platform) {
        if (!rig) return;
        var asset = weaponAssetSpecForPlatform(platform);
        rig.weaponAssetToken = (Number(rig.weaponAssetToken || 0) + 1);
        var token = rig.weaponAssetToken;
        if (!asset || !isBrowserRuntime()) {
            clearLoadedWeaponAsset(rig);
            return;
        }
        if (rig.weaponLoadedAssetUrl === String(asset.url || '') && rig.weaponLoadedAssetRoot) {
            setWeaponProceduralPartsVisible(rig, false);
            return;
        }
        setWeaponProceduralPartsVisible(rig, true);
        loadWeaponAsset(asset).then(function (sourceRoot) {
            attachLoadedWeaponAsset(rig, platform, sourceRoot, token);
        }).catch(function () {
            if (rig.weaponAssetToken === token) setWeaponProceduralPartsVisible(rig, true);
        });
    }

    function applyWeaponVisualState(rig, weaponId) {
        if (!rig || !rig.weaponRoot || !rig.weaponModel) return false;
        var resolvedEntry = resolveWeaponVisualEntry(weaponId) || resolveWeaponVisualEntry('rifle');
        var platform = resolvedEntry && resolvedEntry.platform ? resolvedEntry.platform : null;
        var mount = platform && platform.mount ? platform.mount : {};
        var zones = platform && platform.zones ? platform.zones : {};
        var parts = platform && platform.parts ? platform.parts : {};
        var handleBack = Array.isArray(zones.handleBack) ? zones.handleBack : [0, -0.12, 0.12];
        var mountPos = Array.isArray(mount.position) ? mount.position : [0, 0, 0];
        var mountRotDeg = Array.isArray(mount.rotationDeg) ? mount.rotationDeg : [0, 0, 0];
        var muzzlePos = Array.isArray(zones.muzzle) ? zones.muzzle : [0, 0.02, -0.56];
        var authoredMountOffset = resolveToonAttachmentMountOffset(platform);
        var effectiveMountPos = [
            Number(mountPos[0] || 0) + authoredMountOffset[0],
            Number(mountPos[1] || 0) + authoredMountOffset[1],
            Number(mountPos[2] || 0) + authoredMountOffset[2]
        ];
        var toonAttachmentTransform = resolveToonAttachmentModelTransform(platform);

        if (toonAttachmentTransform) {
            rig.weaponModel.position.set(
                toonAttachmentTransform.position.x,
                toonAttachmentTransform.position.y,
                toonAttachmentTransform.position.z
            );
            rig.weaponModel.rotation.set(
                toonAttachmentTransform.rotation.x,
                toonAttachmentTransform.rotation.y,
                toonAttachmentTransform.rotation.z
            );
        } else {
            rig.weaponModel.position.set(
                effectiveMountPos[0] - Number(handleBack[0] || 0),
                effectiveMountPos[1] - Number(handleBack[1] || 0),
                (effectiveMountPos[2] - Number(handleBack[2] || 0)) - 0.175
            );
            rig.weaponModel.rotation.set(
                (Number(mountRotDeg[0] || 0) * (Math.PI / 180)) + WEAPON_MODEL_ROTATE_X,
                (Number(mountRotDeg[1] || 0) * (Math.PI / 180)) + WEAPON_MODEL_ROTATE_Y,
                (Number(mountRotDeg[2] || 0) * (Math.PI / 180)) + WEAPON_MODEL_ROTATE_Z
            );
        }
        rig.muzzleAnchor.position.set(
            Number(muzzlePos[0] || 0),
            Number(muzzlePos[1] || 0),
            Number(muzzlePos[2] || 0)
        );
        applyWeaponPartMesh(rig.weaponBody, parts.receiver, 'receiver');
        applyWeaponPartMesh(rig.weaponGrip, parts.grip, 'grip');
        applyWeaponPartMesh(rig.weaponBarrel, parts.barrel, 'barrel');
        applyWeaponPartMesh(rig.weaponStock, parts.stock, 'stock');
        applyWeaponPartMesh(rig.weaponOpticRail, parts.opticRail, 'opticRail');
        applyWeaponPartMesh(rig.weaponOptic, parts.optic, 'optic');
        applyWeaponPartMesh(rig.weaponMuzzleDevice, parts.muzzleDevice, 'muzzleDevice');
        applyWeaponPartMesh(rig.weaponFeed, parts.feed, 'feed');
        applyWeaponPartMesh(rig.weaponUnderbarrel, parts.underbarrel, 'underbarrel');
        applyWeaponPartMesh(rig.weaponAccentA, parts.accentA, 'accentA');
        applyWeaponPartMesh(rig.weaponAccentB, parts.accentB, 'accentB');
        rig.weaponId = resolvedEntry && resolvedEntry.weaponId ? resolvedEntry.weaponId : String(weaponId || 'rifle');
        rig.weaponDefinition = platform;
        syncLoadedWeaponAsset(rig, platform);
        return true;
    }

    function computeBoneDominantAxis(points) {
        if (!points || !points.length) return 'y';
        var minX = Infinity, minY = Infinity, minZ = Infinity;
        var maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
        for (var i = 0; i < points.length; i++) {
            var p = points[i];
            if (!p) continue;
            if (p.x < minX) minX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.z < minZ) minZ = p.z;
            if (p.x > maxX) maxX = p.x;
            if (p.y > maxY) maxY = p.y;
            if (p.z > maxZ) maxZ = p.z;
        }
        var spanX = maxX - minX;
        var spanY = maxY - minY;
        var spanZ = maxZ - minZ;
        if (spanX >= spanY && spanX >= spanZ) return 'x';
        if (spanZ >= spanX && spanZ >= spanY) return 'z';
        return 'y';
    }

    function resolveDistalFaceCenter(points, extension) {
        if (!points || !points.length) return {
            center: new THREE.Vector3(0, 0.18, 0),
            axis: 'y',
            sign: 1
        };
        var axis = computeBoneDominantAxis(points);
        var maxAbs = 0;
        var sign = 1;
        for (var i = 0; i < points.length; i++) {
            var value = Number(points[i][axis] || 0);
            var abs = Math.abs(value);
            if (abs > maxAbs) {
                maxAbs = abs;
                sign = value >= 0 ? 1 : -1;
            }
        }
        var threshold = maxAbs - Math.max(0.001, maxAbs * 0.18);
        var center = new THREE.Vector3();
        var count = 0;
        for (var n = 0; n < points.length; n++) {
            var point = points[n];
            var coord = Number(point[axis] || 0);
            if ((coord * sign) < threshold) continue;
            center.add(point);
            count += 1;
        }
        if (count > 0) {
            center.divideScalar(count);
        } else {
            center.copy(points[0]);
        }
        center[axis] += sign * Math.max(0, Number(extension || 0));
        return {
            center: center,
            axis: axis,
            sign: sign
        };
    }

    function resolveBoneStickerLocal(skinnedMesh, bone) {
        var fallback = {
            center: new THREE.Vector3(0, 0.18, 0),
            axis: 'y',
            sign: 1
        };
        if (!skinnedMesh || !bone || !skinnedMesh.geometry || !skinnedMesh.skeleton) return fallback;
        var skeleton = skinnedMesh.skeleton;
        var boneIndex = skeleton.bones ? skeleton.bones.indexOf(bone) : -1;
        if (boneIndex < 0) return fallback;
        var geometry = skinnedMesh.geometry;
        var positionAttr = geometry.getAttribute ? geometry.getAttribute('position') : null;
        var skinIndexAttr = geometry.getAttribute ? geometry.getAttribute('skinIndex') : null;
        var skinWeightAttr = geometry.getAttribute ? geometry.getAttribute('skinWeight') : null;
        if (!positionAttr || !skinIndexAttr || !skinWeightAttr) return fallback;

        var candidates = [];
        var localVertex = new THREE.Vector3();
        var worldVertex = new THREE.Vector3();
        var boneLocal = new THREE.Vector3();
        for (var i = 0; i < positionAttr.count; i++) {
            var strongestBone = -1;
            var strongestWeight = -1;
            for (var j = 0; j < 4; j++) {
                var weight = Number(skinWeightAttr.getX && j === 0 ? skinWeightAttr.getX(i)
                    : skinWeightAttr.getY && j === 1 ? skinWeightAttr.getY(i)
                    : skinWeightAttr.getZ && j === 2 ? skinWeightAttr.getZ(i)
                    : skinWeightAttr.getW ? skinWeightAttr.getW(i) : 0);
                var skinIndex = Number(skinIndexAttr.getX && j === 0 ? skinIndexAttr.getX(i)
                    : skinIndexAttr.getY && j === 1 ? skinIndexAttr.getY(i)
                    : skinIndexAttr.getZ && j === 2 ? skinIndexAttr.getZ(i)
                    : skinIndexAttr.getW ? skinIndexAttr.getW(i) : -1);
                if (weight > strongestWeight) {
                    strongestWeight = weight;
                    strongestBone = skinIndex;
                }
            }
            if (strongestBone !== boneIndex || strongestWeight < 0.35) continue;
            localVertex.fromBufferAttribute(positionAttr, i);
            worldVertex.copy(localVertex);
            skinnedMesh.localToWorld(worldVertex);
            boneLocal.copy(worldVertex);
            bone.worldToLocal(boneLocal);
            candidates.push(boneLocal.clone());
        }
        if (!candidates.length) return fallback;
        return resolveDistalFaceCenter(candidates, 0.015);
    }

    function createRig(options) {
        var template = loadReadyTemplate();
        var root = new THREE.Group();
        var modelRoot = cloneSkeleton(template.scene);
        var mixer = new THREE.AnimationMixer(modelRoot);
        var actions = createActionMap(mixer, template.animations);
        var actionState = {
            clipName: '',
            action: null,
            playbackRate: 1
        };
        var motionState = {
            wasGrounded: true,
            wasMoving: false,
            lastSprinting: false,
            lastMoveForward: false,
            lastMoveBackward: false,
            lastMoveLeft: false,
            lastMoveRight: false,
            lastMoveIntent: resolveMoveIntent(null),
            lastMoveDirectionalSnapshot: null,
            recentForwardStopRemaining: 0,
            recentForwardStopWeight: 0,
            stopSettleRemaining: 0,
            stopSettleDuration: STOP_DIRECTIONAL_SETTLE_DURATION,
            stopDirectionalSnapshot: null,
            stopLockDuration: 0,
            lastYaw: null,
            lockName: '',
            lockRemaining: 0,
            jumpTriggered: false,
            lastGroundedSpeed: 0,
            airborneStartFootY: null,
            lastLandingDropDistance: 0,
            lastLandingHorizontalSpeed: 0,
            directional: createDirectionalLocomotionState(),
            turnEntryDirection: 0,
            idleAimCurrentPitch: 0,
            idleAimCurrentYaw: 0,
            manualRollActive: false,
            manualRollReverse: false,
            manualRollFacingYaw: 0,
            manualRollPending: false,
            manualRollAlignElapsed: 0,
            manualRollAlignDuration: 0,
            manualRollAlignStartYaw: 0,
            manualRollAlignTargetYaw: 0
        };
        var fireRecoilState = createFireRecoilState();
        var currentWeaponId = String(options.weaponId || 'rifle');
        var disposed = false;

        cloneSceneMaterials(modelRoot);
        normalizeModelToFeet(modelRoot);
        modelRoot.rotation.y = Math.PI;
        modelRoot.updateMatrixWorld(true);
        root.add(modelRoot);

        modelRoot.traverse(function (node) {
            if (!node || !node.isMesh) return;
            node.castShadow = true;
            node.receiveShadow = true;
        });

        var skinnedMesh = null;
        modelRoot.traverse(function (node) {
            if (!skinnedMesh && node && node.isSkinnedMesh) skinnedMesh = node;
        });

        var bodyUpper = resolveAnimatedBone(modelRoot, skinnedMesh, ['body_upper'], modelRoot);
        var bodyLower = resolveAnimatedBone(modelRoot, skinnedMesh, ['body_lower'], modelRoot);
        var head = resolveAnimatedBone(modelRoot, skinnedMesh, ['head'], modelRoot);
        var armUpperL = resolveAnimatedBone(modelRoot, skinnedMesh, ['arm_upperL', 'arm_upper.L'], null);
        var armUpperR = resolveAnimatedBone(modelRoot, skinnedMesh, ['arm_upperR', 'arm_upper.R'], null);
        var armLowerL = resolveAnimatedBone(modelRoot, skinnedMesh, ['arm_lowerL', 'arm_lower.L'], modelRoot);
        var armLowerR = resolveAnimatedBone(modelRoot, skinnedMesh, ['arm_lowerR', 'arm_lower.R'], modelRoot);
        var legUpperL = resolveAnimatedBone(modelRoot, skinnedMesh, ['leg_upperL', 'leg_upper.L'], null);
        var legUpperR = resolveAnimatedBone(modelRoot, skinnedMesh, ['leg_upperR', 'leg_upper.R'], null);
        var legLowerL = resolveAnimatedBone(modelRoot, skinnedMesh, ['leg_lowerL', 'leg_lower.L'], null);
        var legLowerR = resolveAnimatedBone(modelRoot, skinnedMesh, ['leg_lowerR', 'leg_lower.R'], null);

        var coreAnchor = createAnchor(bodyLower, 0, 0.24, 0);
        var eyeAnchor = createAnchor(head, 0, 0.16, 0.02);
        var pistolConfig = pistolMountConfig();
        var throwConfig = throwableMountConfig();
        var throwableRoot = new THREE.Group();
        throwableRoot.position.set(throwConfig.rootPos.x, throwConfig.rootPos.y, throwConfig.rootPos.z);
        throwableRoot.rotation.set(throwConfig.rootRot.x, throwConfig.rootRot.y, throwConfig.rootRot.z);
        armLowerL.add(throwableRoot);
        var throwableOriginAnchor = createAnchor(
            throwableRoot,
            throwConfig.originPos.x,
            throwConfig.originPos.y,
            throwConfig.originPos.z
        );
        var weaponRoot = new THREE.Group();
        weaponRoot.position.set(pistolConfig.rootPos.x, pistolConfig.rootPos.y, pistolConfig.rootPos.z);
        weaponRoot.rotation.set(pistolConfig.rootRot.x, pistolConfig.rootRot.y, pistolConfig.rootRot.z);
        armLowerR.add(weaponRoot);
        var weaponHandAnchor = new THREE.Group();
        weaponHandAnchor.name = 'Index1.R';
        weaponRoot.add(weaponHandAnchor);
        var weaponModel = new THREE.Group();
        weaponHandAnchor.add(weaponModel);
        var weaponBody = createWeaponPartMesh('receiver');
        var weaponGrip = createWeaponPartMesh('grip');
        var weaponBarrel = createWeaponPartMesh('barrel');
        var weaponStock = createWeaponPartMesh('stock');
        var weaponOpticRail = createWeaponPartMesh('opticRail');
        var weaponOptic = createWeaponPartMesh('optic');
        var weaponMuzzleDevice = createWeaponPartMesh('muzzleDevice');
        var weaponFeed = createWeaponPartMesh('feed');
        var weaponUnderbarrel = createWeaponPartMesh('underbarrel');
        var weaponAccentA = createWeaponPartMesh('accentA');
        var weaponAccentB = createWeaponPartMesh('accentB');
        weaponModel.add(weaponBody);
        weaponModel.add(weaponGrip);
        weaponModel.add(weaponBarrel);
        weaponModel.add(weaponStock);
        weaponModel.add(weaponOpticRail);
        weaponModel.add(weaponOptic);
        weaponModel.add(weaponMuzzleDevice);
        weaponModel.add(weaponFeed);
        weaponModel.add(weaponUnderbarrel);
        weaponModel.add(weaponAccentA);
        weaponModel.add(weaponAccentB);
        var muzzleAnchor = createAnchor(weaponModel, pistolConfig.muzzlePos.x, pistolConfig.muzzlePos.y, pistolConfig.muzzlePos.z);
        var muzzleFlash = createMuzzleFlashMesh();
        muzzleAnchor.add(muzzleFlash);

        var rig = {
            root: root,
            modelRoot: modelRoot,
            modelBaseYaw: Math.PI,
            bodyMesh: skinnedMesh,
            headMesh: skinnedMesh,
            armLMesh: skinnedMesh,
            armRMesh: skinnedMesh,
            legLMesh: skinnedMesh,
            legRMesh: skinnedMesh,
            coreAnchor: coreAnchor,
            eyeAnchor: eyeAnchor,
            throwableRoot: throwableRoot,
            throwableOriginAnchor: throwableOriginAnchor,
            weaponRoot: weaponRoot,
            weaponHandAnchor: weaponHandAnchor,
            weaponModel: weaponModel,
            weaponCube: weaponBody,
            weaponBody: weaponBody,
            weaponGrip: weaponGrip,
            weaponBarrel: weaponBarrel,
            weaponStock: weaponStock,
            weaponOpticRail: weaponOpticRail,
            weaponOptic: weaponOptic,
            weaponMuzzleDevice: weaponMuzzleDevice,
            weaponFeed: weaponFeed,
            weaponUnderbarrel: weaponUnderbarrel,
            weaponAccentA: weaponAccentA,
            weaponAccentB: weaponAccentB,
            weaponProceduralParts: [
                weaponBody,
                weaponGrip,
                weaponBarrel,
                weaponStock,
                weaponOpticRail,
                weaponOptic,
                weaponMuzzleDevice,
                weaponFeed,
                weaponUnderbarrel,
                weaponAccentA,
                weaponAccentB
            ],
            muzzleAnchor: muzzleAnchor,
            muzzleFlash: muzzleFlash,
            weaponRootBaseRot: weaponRoot.rotation.clone(),
            upperBodyPivot: bodyUpper,
            activeClipName: 'idle',
            bodyUpper: bodyUpper,
            bodyLower: bodyLower,
            headBone: head,
            armUpperL: armUpperL,
            armUpperR: armUpperR,
            armUpperRBasePos: armUpperR && armUpperR.position && armUpperR.position.clone ? armUpperR.position.clone() : null,
            armLowerL: armLowerL,
            armLowerR: armLowerR,
            armL: armUpperL,
            armR: armUpperR,
            legUpperL: legUpperL,
            legUpperR: legUpperR,
            legLowerL: legLowerL,
            legLowerR: legLowerR,
            gun: weaponModel,
            gunBasePos: weaponRoot.position.clone(),
            weaponRootBasePos: weaponRoot.position.clone(),
            weaponId: currentWeaponId,
            weaponDefinition: null,
            weaponAssetToken: 0,
            weaponLoadedAssetRoot: null,
            weaponLoadedAssetUrl: '',
            fireRecoilState: fireRecoilState,
            activePoseName: ''
        };

        root.userData.bodyParts = skinnedMesh ? [skinnedMesh] : [];
        root.userData.originalPartColors = skinnedMesh && skinnedMesh.material && skinnedMesh.material.color
            ? [skinnedMesh.material.color.getHex()]
            : [];
        root.userData.rig = rig;
        root.userData.cloneVisualForRevealGhost = buildRevealCloneFactory(root);
        applyWeaponVisualState(rig, currentWeaponId);

        function clearManualRollState() {
            motionState.manualRollActive = false;
            motionState.manualRollReverse = false;
            motionState.manualRollFacingYaw = 0;
            motionState.manualRollPending = false;
            motionState.manualRollAlignElapsed = 0;
            motionState.manualRollAlignDuration = 0;
            motionState.manualRollAlignStartYaw = 0;
            motionState.manualRollAlignTargetYaw = 0;
        }

        function startManualRoll(targetFacingYaw, reverse) {
            motionState.manualRollPending = false;
            motionState.manualRollActive = true;
            motionState.manualRollReverse = !!reverse;
            motionState.manualRollFacingYaw = normalizeAngle(targetFacingYaw);
            motionState.lockName = MANUAL_ROLL_CLIP;
            motionState.lockRemaining = Math.max(0.2, clipDuration(actions, MANUAL_ROLL_CLIP, 0.36) * 0.92);
        }

        function updatePendingBackwardRoll(dt) {
            if (!motionState.manualRollPending) return;
            motionState.manualRollAlignElapsed += Math.max(0, Number(dt || 0));
            var duration = Math.max(0.0001, Number(motionState.manualRollAlignDuration || BACKWARD_ROLL_ALIGN_DURATION));
            var progress = clamp01(motionState.manualRollAlignElapsed / duration);
            motionState.manualRollFacingYaw = lerpAngle(
                motionState.manualRollAlignStartYaw,
                motionState.manualRollAlignTargetYaw,
                progress
            );
            if (
                progress >= 1 ||
                !needsBackwardRollAlign(normalizeAngle(motionState.manualRollFacingYaw - motionState.manualRollAlignTargetYaw))
            ) {
                startManualRoll(motionState.manualRollAlignTargetYaw, true);
            }
        }

        function applyTintColor() {
            var tint = chooseTintColor(options);
            modelRoot.traverse(function (node) {
                if (!node || !node.isMesh || !node.material) return;
                var nodeMaterials = Array.isArray(node.material) ? node.material : [node.material];
                for (var i = 0; i < nodeMaterials.length; i++) {
                    if (nodeMaterials[i] && nodeMaterials[i].color) {
                        nodeMaterials[i].color.setHex(tint);
                    }
                }
            });
        }

        function updateAnimation(dt, animState) {
            dt = Math.max(0, Number(dt || 0));
            animState = animState || {};
            var grounded = !!(animState && !animState.airborne);
            var footY = (typeof animState.footY === 'number' && isFinite(animState.footY))
                ? Number(animState.footY)
                : null;

            if (!grounded) {
                if (motionState.wasGrounded && footY != null) {
                    motionState.airborneStartFootY = footY;
                } else if (motionState.airborneStartFootY == null && footY != null) {
                    motionState.airborneStartFootY = footY;
                }
            } else if (!motionState.wasGrounded) {
                motionState.lastLandingDropDistance = (
                    footY != null &&
                    motionState.airborneStartFootY != null &&
                    isFinite(motionState.airborneStartFootY)
                )
                    ? Math.max(0, Number(motionState.airborneStartFootY) - footY)
                    : 0;
                motionState.lastLandingHorizontalSpeed = resolveHorizontalSpeed(animState);
                motionState.airborneStartFootY = null;
            }

            if (motionState.lockRemaining > 0) {
                motionState.lockRemaining = Math.max(0, motionState.lockRemaining - dt);
                if (motionState.lockRemaining === 0) {
                    motionState.lockName = '';
                    motionState.stopLockDuration = 0;
                    if (motionState.manualRollActive) {
                        clearManualRollState();
                    }
                }
            }
            if (motionState.stopSettleRemaining > 0) {
                motionState.stopSettleRemaining = Math.max(0, motionState.stopSettleRemaining - dt);
                if (motionState.stopSettleRemaining === 0) {
                    motionState.stopDirectionalSnapshot = null;
                }
            }

            motionState.directional = updateDirectionalLocomotionState(motionState.directional, dt, animState);
            refreshRecentForwardStopWindow(motionState, animState, motionState.directional, dt);
            updatePendingBackwardRoll(dt);
            var clipName = selectClip(animState, motionState, actions);
            var playbackState = animState;
            if (motionState.manualRollActive && clipName === MANUAL_ROLL_CLIP) {
                playbackState = Object.assign({}, animState, {
                    manualRollReverse: !!motionState.manualRollReverse
                });
            }
            var playback = resolveClipPlayback(playbackState, clipName);
            playAction(actions, actionState, clipName, 0.1, playback);
            keepPlaybackLooping(actionState.action, playback);
            mixer.update(dt);
            if (rig.modelRoot) {
                rig.modelRoot.rotation.y = Number(rig.modelBaseYaw || 0);
            }
            rig.activeClipName = actionState.clipName || clipName;
            rig.activePlaybackRate = Number(playback.timeScale || 1);
            rig.activePoseName = '';

            var stopSettleWeight = stopDirectionalSettleWeight(motionState);
            var idleAimActive = idleAimAllowed(animState, rig.activeClipName);
            var pitchRecoilTarget = Number(fireRecoilState.shoulderPitch || 0) + (Number(fireRecoilState.lowerArmPitch || 0) * 0.35);
            var idleAimTarget = idleAimActive ? (idleAimTargetPitch(animState, rig.activeClipName) + pitchRecoilTarget) : 0;
            var idleAimTargetYawValue = idleAimActive
                ? idleAimTargetYaw(resolveIdleAimYawState(motionState, stopSettleWeight), rig.activeClipName)
                : 0;
            var idleAimBlendSpeed = idleAimActive ? IDLE_AIM_BLEND_IN_SPEED : IDLE_AIM_BLEND_OUT_SPEED;
            var idleAimBlend = Math.min(1, dt * idleAimBlendSpeed);
            var idleAimYawBlend = Number(stopSettleWeight || 0) > 0 ? 1 : idleAimBlend;
            motionState.idleAimCurrentPitch += (idleAimTarget - Number(motionState.idleAimCurrentPitch || 0)) * idleAimBlend;
            if (Math.abs(idleAimTarget - motionState.idleAimCurrentPitch) < 0.0001) {
                motionState.idleAimCurrentPitch = idleAimTarget;
            }
            motionState.idleAimCurrentYaw += (idleAimTargetYawValue - Number(motionState.idleAimCurrentYaw || 0)) * idleAimYawBlend;
            if (Math.abs(idleAimTargetYawValue - motionState.idleAimCurrentYaw) < 0.0001) {
                motionState.idleAimCurrentYaw = idleAimTargetYawValue;
            }

            if (motionState.manualRollPending || (motionState.manualRollActive && rig.activeClipName === MANUAL_ROLL_CLIP)) {
                if (rig.modelRoot) {
                    rig.modelRoot.rotation.y = Number(rig.modelBaseYaw || 0) + Number(motionState.manualRollFacingYaw || 0);
                }
                rig.activePoseName = motionState.manualRollPending
                    ? 'roll_align'
                    : (motionState.manualRollReverse ? 'roll_back' : 'roll');
            } else if (rig.activeClipName === MANUAL_ROLL_CLIP && isDirectionalMove(animState)) {
                if (rig.modelRoot) {
                    rig.modelRoot.rotation.y = Number(rig.modelBaseYaw || 0) + resolveRollFacingYaw(animState);
                }
                rig.activePoseName = 'roll';
            } else if (applyDirectionalLocomotionPose(rig, motionState.directional, animState)) {
                rig.activePoseName = motionState.directional.poseName || '';
            }
            if (stopSettleWeight > 0 && motionState.stopDirectionalSnapshot) {
                applyDirectionalLocomotionPose(rig, motionState.stopDirectionalSnapshot, animState, stopSettleWeight);
                if (!rig.activePoseName && motionState.stopDirectionalSnapshot.poseName) {
                    rig.activePoseName = motionState.stopDirectionalSnapshot.poseName;
                }
            }
            if (rig.activeClipName === 'run') {
                applyRunRightArmIdleBasePose(rig, rig.activeClipName, actionState.action);
            } else if (clipUsesLockedRightArmAimBasePose(rig.activeClipName)) {
                applyLockedRightArmAimBasePose(rig, rig.activeClipName);
            } else if (stopSettleWeight > 0 && motionState.stopDirectionalSnapshot) {
                applyStopSettleRightArmRecoveryPose(rig, stopSettleWeight);
            }
            applyTorsoCarryPose(rig, motionState.directional);
            applyIdleAimPose(rig, {
                currentPitch: motionState.idleAimCurrentPitch,
                currentYaw: motionState.idleAimCurrentYaw,
                weight: idleAimPoseWeight(rig.activeClipName)
            });
            applyWeaponOrientationCompensation(rig, {
                currentYaw: motionState.idleAimCurrentYaw
            });
            applyFireRecoilPose(rig, fireRecoilState);
            decayFireRecoilState(fireRecoilState, dt);

            motionState.wasGrounded = !animState.airborne;
            motionState.wasMoving = isDirectionalMove(animState);
            motionState.lastSprinting = !!animState.sprinting;
            motionState.lastMoveForward = !!animState.movingForward;
            motionState.lastMoveBackward = !!animState.movingBackward;
            motionState.lastMoveLeft = !!animState.movingLeft;
            motionState.lastMoveRight = !!animState.movingRight;
            if (motionState.directional && motionState.directional.intent && motionState.directional.intent.moving) {
                motionState.lastMoveIntent = {
                    moving: !!motionState.directional.intent.moving,
                    forwardAxis: Number(motionState.directional.intent.forwardAxis || 0),
                    rightAxis: Number(motionState.directional.intent.rightAxis || 0),
                    magnitude: Number(motionState.directional.intent.magnitude || 0),
                    angle: Number(motionState.directional.intent.angle || 0),
                    absAngle: Number(motionState.directional.intent.absAngle || 0),
                    sideSign: Number(motionState.directional.intent.sideSign || 0),
                    pureForward: !!motionState.directional.intent.pureForward,
                    pureBackpedal: !!motionState.directional.intent.pureBackpedal,
                    pureStrafe: !!motionState.directional.intent.pureStrafe,
                    diagonal: !!motionState.directional.intent.diagonal
                };
                motionState.lastMoveDirectionalSnapshot = cloneDirectionalSnapshot(motionState.directional);
            }
            motionState.lastYaw = (typeof animState.yaw === 'number') ? animState.yaw : motionState.lastYaw;
            motionState.lastGroundedSpeed = (!animState.airborne)
                ? Math.max(0, Number(animState.speedNorm || 0))
                : motionState.lastGroundedSpeed;
        }

        function triggerAction(action, options) {
            var kind = String(action || '').toLowerCase();
            if (kind === 'fire') {
                return triggerFireRecoil(fireRecoilState, options);
            }
            if (kind === 'jump') {
                motionState.jumpTriggered = true;
                return true;
            }
            if (kind === 'roll') {
                if (!isDirectionalMove(options)) return false;
                if (
                    motionState.manualRollPending ||
                    motionState.manualRollActive ||
                    (motionState.lockName === MANUAL_ROLL_CLIP && motionState.lockRemaining > 0.05)
                ) {
                    return false;
                }
                var currentFacingYaw = normalizeAngle(
                    motionState.directional && typeof motionState.directional.facingYaw === 'number'
                        ? motionState.directional.facingYaw
                        : 0
                );
                var targetFacingYaw = resolveManualRollFacingYaw(options, currentFacingYaw);
                if (isBackwardRollIntent(options) && needsBackwardRollAlign(motionState.directional && motionState.directional.facingYaw)) {
                    motionState.manualRollPending = true;
                    motionState.manualRollActive = false;
                    motionState.manualRollReverse = true;
                    motionState.manualRollAlignElapsed = 0;
                    motionState.manualRollAlignDuration = BACKWARD_ROLL_ALIGN_DURATION;
                    motionState.manualRollAlignStartYaw = currentFacingYaw;
                    motionState.manualRollAlignTargetYaw = targetFacingYaw;
                    motionState.manualRollFacingYaw = motionState.manualRollAlignStartYaw;
                    return true;
                }
                startManualRoll(targetFacingYaw, isBackwardRollIntent(options));
                return true;
            }
            return true;
        }

        function getCoreWorldPosition(outVec3) {
            var out = outVec3 || new THREE.Vector3();
            coreAnchor.getWorldPosition(out);
            return out;
        }

        function getEyeWorldPosition(outVec3) {
            var out = outVec3 || new THREE.Vector3();
            eyeAnchor.getWorldPosition(out);
            return out;
        }

        function getThrowableOriginWorldPosition(outVec3) {
            var out = outVec3 || new THREE.Vector3();
            throwableOriginAnchor.getWorldPosition(out);
            return out;
        }

        function getMuzzleWorldPosition(outVec3) {
            var out = outVec3 || new THREE.Vector3();
            muzzleAnchor.getWorldPosition(out);
            return out;
        }

        function setWeapon() {
            currentWeaponId = String(arguments[0] || currentWeaponId || 'rifle');
            return applyWeaponVisualState(rig, currentWeaponId);
        }

        function setMuzzleVisible(visible) {
            if (!muzzleFlash) return false;
            muzzleFlash.visible = !!visible;
            return true;
        }

        function getWeaponId() {
            return currentWeaponId;
        }

        function getCameraProfile() {
            return {
                thirdHeight: 1.02,
                cameraShoulder: 2.35,
                adsHeight: 0.72
            };
        }

        function isMovementAnimationLocked() {
            return motionState.lockName === 'stop' && motionState.lockRemaining > 0;
        }

        function dispose() {
            if (disposed) return;
            disposed = true;
            clearLoadedWeaponAsset(rig);
            disposeUniqueMaterials(modelRoot);
        }

        applyTintColor();
        playAction(actions, actionState, 'idle', 0, resolveClipPlayback(null, 'idle'));
        mixer.update(0);

        return {
            root: root,
            rig: rig,
            setWeapon: setWeapon,
            updateAnimation: updateAnimation,
            triggerAction: triggerAction,
            getCoreWorldPosition: getCoreWorldPosition,
            getEyeWorldPosition: getEyeWorldPosition,
            getThrowableOriginWorldPosition: getThrowableOriginWorldPosition,
            getMuzzleWorldPosition: getMuzzleWorldPosition,
            setMuzzleVisible: setMuzzleVisible,
            getWeaponId: getWeaponId,
            getCameraProfile: getCameraProfile,
            isMovementAnimationLocked: isMovementAnimationLocked,
            dispose: dispose
        };
    }

    GameBoxmanRig.preload = function () {
        return Promise.all([
            loadTemplate(),
            preloadWeaponPackAssets()
        ]).then(function (results) {
            return results[0];
        });
    };

    GameBoxmanRig.isSupported = function () {
        return isBrowserRuntime();
    };

    GameBoxmanRig.isReady = function () {
        return !!templateAsset;
    };

    GameBoxmanRig.create = function (options) {
        if (!templateAsset) return null;
        return createRig(options || {});
    };

    GameBoxmanRig._test = {
        resolveClipPlayback: resolveClipPlayback,
        selectClip: selectClip,
        movementStartClip: movementStartClip,
        resolveMoveIntent: resolveMoveIntent,
        resolveRollFacingYaw: resolveRollFacingYaw,
        resolveManualRollFacingYaw: resolveManualRollFacingYaw,
        isBackwardRollIntent: isBackwardRollIntent,
        needsBackwardRollAlign: needsBackwardRollAlign,
        clipStartFraction: clipStartFraction,
        landingClip: landingClip,
        resolveHorizontalSpeed: resolveHorizontalSpeed,
        stopDirectionalSettleWeight: stopDirectionalSettleWeight,
        resolveDistalFaceCenter: resolveDistalFaceCenter,
        resolveAnimatedBone: resolveAnimatedBone,
        createFireRecoilState: createFireRecoilState,
        applyFireRecoilPose: applyFireRecoilPose,
        decayFireRecoilState: decayFireRecoilState,
        triggerFireRecoil: triggerFireRecoil,
        idleAimAllowed: idleAimAllowed,
        idleAimNeutralWeight: idleAimNeutralWeight,
        idleAimResponseWeight: idleAimResponseWeight,
        idleAimYawResponseWeight: idleAimYawResponseWeight,
        idleAimTargetPitch: idleAimTargetPitch,
        idleAimTargetYaw: idleAimTargetYaw,
        resolveIdleAimYawState: resolveIdleAimYawState,
        idleAimPoseWeight: idleAimPoseWeight,
        resolveWeaponVisualEntry: resolveWeaponVisualEntry,
        resolveToonAttachmentMountOffset: resolveToonAttachmentMountOffset,
        resolveToonAttachmentModelTransform: resolveToonAttachmentModelTransform,
        applyWeaponPartMesh: applyWeaponPartMesh,
        applyLoadedWeaponMaterial: applyLoadedWeaponMaterial,
        clearLoadedWeaponAsset: clearLoadedWeaponAsset,
        applyWeaponVisualState: applyWeaponVisualState,
        lockedRightArmUpperPitchOffset: lockedRightArmUpperPitchOffset,
        applyLockedRightArmAimBasePose: applyLockedRightArmAimBasePose,
        applyStopSettleRightArmRecoveryPose: applyStopSettleRightArmRecoveryPose,
        clipUsesLockedRightArmAimBasePose: clipUsesLockedRightArmAimBasePose,
        applyRunRightArmIdleBasePose: applyRunRightArmIdleBasePose,
        applyTorsoCarryPose: applyTorsoCarryPose,
        applyIdleAimPose: applyIdleAimPose,
        applyWeaponOrientationCompensation: applyWeaponOrientationCompensation,
        cloneWithDetachedRootUserData: cloneWithDetachedRootUserData,
        weaponMount: function () {
            return {
                rootPos: { x: -0.04, y: 0.65, z: -0.06 },
                rootRot: { x: 0.08 - (10 * (Math.PI / 180)), y: 0.22, z: 0 },
                handleBack: { x: 0, y: -0.1, z: 0.08 },
                receiverSize: { x: 0.2352, y: 0.1792, z: 0.55 },
                barrelPos: { x: 0, y: 0.02, z: -0.36 },
                barrelSize: { x: 0.1456, y: 0.1456, z: 0.26 },
                muzzlePos: { x: 0, y: 0, z: -0.09 }
            };
        },
        throwableMount: function () {
            return {
                rootPos: { x: -0.04, y: 0.65, z: -0.06 },
                rootRot: { x: 0.08 - (10 * (Math.PI / 180)), y: 0.22, z: 0 },
                originPos: { x: 0, y: 0, z: 0 }
            };
        }
    };

    runtime.GameBoxmanRig = GameBoxmanRig;
})();
