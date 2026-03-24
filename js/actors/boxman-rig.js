import * as THREE_NS from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { ensureThreeGlobal } from '../app/three-runtime.js';
import {
    applyDirectionalLocomotionPose,
    createDirectionalLocomotionState,
    directionalLocomotionNeedsCustomStart,
    resolveMoveIntent,
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

    var templateAsset = null;
    var templatePromise = null;

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

    function buildRevealCloneFactory(root) {
        return function cloneVisualForRevealGhost() {
            var clone = cloneSkeleton(root);
            clone.userData = {};
            clone.traverse(function (node) {
                if (!node || !node.isMesh) return;
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
                clip.name === 'start_back_left' ||
                clip.name === 'start_back_right' ||
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

    function resolveClipPlayback(animState, clipName) {
        var name = String(clipName || '');
        var reverse = false;
        if (
            (name === 'run' || name === 'sprint') &&
            animState &&
            animState.movingBackward &&
            !animState.movingForward
        ) {
            reverse = true;
        }
        return {
            reverse: reverse,
            timeScale: reverse ? -1 : 1,
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

    function landingClip(motionState, animState) {
        if (!animState) return 'drop_idle';
        if (motionState.lastGroundedSpeed > 0.95) return 'drop_running_roll';
        if (motionState.lastGroundedSpeed > 0.2 || isDirectionalMove(animState)) return 'drop_running';
        return 'drop_idle';
    }

    function clipDuration(actions, clipName, fallback) {
        var action = actions[clipName] || null;
        if (!action || !action.getClip) return Number(fallback || 0);
        return Number(action.getClip().duration || fallback || 0);
    }

    function resolveIdleTurnClip(motionState) {
        var directional = motionState && motionState.directional ? motionState.directional : null;
        if (!directional || !directional.useTurnLoopClip) return '';
        return directional.turnClipDirection > 0 ? 'rotate_left' : 'rotate_right';
    }

    function selectClip(animState, motionState, actions) {
        var moving = isDirectionalMove(animState);
        var grounded = !!(animState && !animState.airborne);
        var directional = motionState && motionState.directional ? motionState.directional : createDirectionalLocomotionState();

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
            motionState.lockName = 'stop';
            motionState.lockRemaining = Math.max(0.1, clipDuration(actions, 'stop', 0.18) * 0.7);
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
            lastYaw: null,
            lockName: '',
            lockRemaining: 0,
            jumpTriggered: false,
            lastGroundedSpeed: 0,
            directional: createDirectionalLocomotionState(),
            turnEntryDirection: 0
        };
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

        var bodyUpper = modelRoot.getObjectByName('body_upper') || modelRoot;
        var bodyLower = modelRoot.getObjectByName('body_lower') || modelRoot;
        var head = modelRoot.getObjectByName('head') || modelRoot;
        var armUpperL = modelRoot.getObjectByName('arm_upper.L') || null;
        var armUpperR = modelRoot.getObjectByName('arm_upper.R') || null;
        var armLowerL = modelRoot.getObjectByName('arm_lower.L') || modelRoot;
        var legUpperL = modelRoot.getObjectByName('leg_upper.L') || null;
        var legUpperR = modelRoot.getObjectByName('leg_upper.R') || null;
        var legLowerL = modelRoot.getObjectByName('leg_lower.L') || null;
        var legLowerR = modelRoot.getObjectByName('leg_lower.R') || null;

        var coreAnchor = createAnchor(bodyLower, 0, 0.24, 0);
        var eyeAnchor = createAnchor(head, 0, 0.16, 0.02);
        var throwableOriginAnchor = createAnchor(armLowerL, 0.02, 0.32, -0.02);

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
            throwableOriginAnchor: throwableOriginAnchor,
            upperBodyPivot: bodyUpper,
            activeClipName: 'idle',
            bodyUpper: bodyUpper,
            bodyLower: bodyLower,
            headBone: head,
            armUpperL: armUpperL,
            armUpperR: armUpperR,
            legUpperL: legUpperL,
            legUpperR: legUpperR,
            legLowerL: legLowerL,
            legLowerR: legLowerR,
            activePoseName: ''
        };

        root.userData.bodyParts = skinnedMesh ? [skinnedMesh] : [];
        root.userData.originalPartColors = skinnedMesh && skinnedMesh.material && skinnedMesh.material.color
            ? [skinnedMesh.material.color.getHex()]
            : [];
        root.userData.rig = rig;
        root.userData.cloneVisualForRevealGhost = buildRevealCloneFactory(root);

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

            if (motionState.lockRemaining > 0) {
                motionState.lockRemaining = Math.max(0, motionState.lockRemaining - dt);
                if (motionState.lockRemaining === 0) {
                    motionState.lockName = '';
                }
            }

            motionState.directional = updateDirectionalLocomotionState(motionState.directional, dt, animState);
            var clipName = selectClip(animState, motionState, actions);
            var playback = resolveClipPlayback(animState, clipName);
            playAction(actions, actionState, clipName, 0.1, playback);
            keepPlaybackLooping(actionState.action, playback);
            mixer.update(dt);
            rig.activeClipName = actionState.clipName || clipName;
            rig.activePlaybackRate = Number(playback.timeScale || 1);
            rig.activePoseName = '';

            if (applyDirectionalLocomotionPose(rig, motionState.directional, animState)) {
                rig.activePoseName = motionState.directional.poseName || '';
            }

            motionState.wasGrounded = !animState.airborne;
            motionState.wasMoving = isDirectionalMove(animState);
            motionState.lastYaw = (typeof animState.yaw === 'number') ? animState.yaw : motionState.lastYaw;
            motionState.lastGroundedSpeed = (!animState.airborne)
                ? Math.max(0, Number(animState.speedNorm || 0))
                : motionState.lastGroundedSpeed;
        }

        function triggerAction(action) {
            if (String(action || '').toLowerCase() === 'jump') {
                motionState.jumpTriggered = true;
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
            return getEyeWorldPosition(outVec3);
        }

        function setWeapon() {
            currentWeaponId = String(arguments[0] || currentWeaponId || 'rifle');
            return true;
        }

        function setMuzzleVisible() {
            return false;
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

        function dispose() {
            if (disposed) return;
            disposed = true;
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
            dispose: dispose
        };
    }

    GameBoxmanRig.preload = function () {
        return loadTemplate();
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
        clipStartFraction: clipStartFraction
    };

    runtime.GameBoxmanRig = GameBoxmanRig;
})();
