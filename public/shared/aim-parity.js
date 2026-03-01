/**
 * aim-parity.js - Shared reticle/camera projection parity helpers
 * Loaded as global: window.__GAME_AIM_PARITY__
 */
(function (global) {
    'use strict';

    if (global.__GAME_AIM_PARITY__) return;

    var PRIM = global.__GAME_PRIMITIVES__ || {};
    var COORDS = PRIM.coords || {};
    var CAMERA_PRIM = PRIM.camera || {};
    var THIRD_PRIM = CAMERA_PRIM.third_person || {};
    var COORD_SYSTEM = global.__GAME_COORD_SYSTEM__ || {};

    var constants = {
        camera: {
            fovDeg: 75,
            aspect: 16 / 9,
            eyeOffsetY: toNumber(COORDS.eye_offset_y, 1.6),
            thirdDistance: toNumber(THIRD_PRIM.distance, 4.4),
            thirdHeight: toNumber(THIRD_PRIM.height, 0.7),
            thirdShoulder: toNumber(THIRD_PRIM.shoulder_offset, 1.35),
            defaultShoulder: (THIRD_PRIM.default_shoulder === 'left') ? 'left' : 'right'
        },
        viewport: {
            width: 1920,
            height: 1080
        },
        shotgun: {
            reticle: {
                basePx: 300,
                refDistance: 14,
                thirdMinScale: 0.62,
                thirdMaxScale: 0.96
            },
            pattern: [
                [-0.90, -0.90], [0.00, -0.90], [0.90, -0.90],
                [-0.90, 0.00], [-0.35, -0.35], [0.35, 0.35], [0.90, 0.00],
                [-0.90, 0.90], [0.00, 0.90], [0.90, 0.90],
                [-0.45, 0.45], [0.45, -0.45]
            ]
        },
        plasma: {
            reticle: {
                basePx: 220,
                refDistance: 14,
                thirdMinScale: 0.6,
                thirdMaxScale: 0.98
            }
        }
    };

    function toNumber(value, fallback) {
        var n = Number(value);
        return isFinite(n) ? n : fallback;
    }

    function isFiniteNumber(value) {
        return (typeof value === 'number' && isFinite(value));
    }

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function vec3(x, y, z) {
        return { x: x, y: y, z: z };
    }

    function addVec3(a, b) {
        return vec3(a.x + b.x, a.y + b.y, a.z + b.z);
    }

    function subVec3(a, b) {
        return vec3(a.x - b.x, a.y - b.y, a.z - b.z);
    }

    function scaleVec3(v, s) {
        return vec3(v.x * s, v.y * s, v.z * s);
    }

    function dotVec3(a, b) {
        return a.x * b.x + a.y * b.y + a.z * b.z;
    }

    function crossVec3(a, b) {
        return vec3(
            a.y * b.z - a.z * b.y,
            a.z * b.x - a.x * b.z,
            a.x * b.y - a.y * b.x
        );
    }

    function lengthVec3(v) {
        return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    }

    function normalizeVec3(v) {
        var len = lengthVec3(v);
        if (len <= 1e-8) return vec3(0, 0, -1);
        return vec3(v.x / len, v.y / len, v.z / len);
    }

    function directionFromYawPitch(yaw, pitch) {
        if (COORD_SYSTEM && typeof COORD_SYSTEM.forwardFromYawPitch === 'function') {
            return COORD_SYSTEM.forwardFromYawPitch(yaw || 0, pitch || 0);
        }
        var cy = Math.cos(yaw || 0);
        var sy = Math.sin(yaw || 0);
        var cp = Math.cos(pitch || 0);
        return normalizeVec3(vec3(-sy * cp, Math.sin(pitch || 0), -cy * cp));
    }

    function createBasisFromYawPitch(yaw, pitch) {
        if (COORD_SYSTEM && typeof COORD_SYSTEM.basisFromYawPitch === 'function') {
            return COORD_SYSTEM.basisFromYawPitch(yaw || 0, pitch || 0);
        }

        var forward = directionFromYawPitch(yaw, pitch);
        var right = crossVec3(forward, vec3(0, 1, 0));
        var rightLen = lengthVec3(right);
        if (rightLen <= 1e-8) {
            right = vec3(Math.cos(yaw || 0), 0, -Math.sin(yaw || 0));
        } else {
            right = scaleVec3(right, 1 / rightLen);
        }
        var up = normalizeVec3(crossVec3(right, forward));

        return {
            forward: forward,
            right: right,
            up: up
        };
    }

    function getReticleSizePx(kind, cameraMode, cameraDistance) {
        var cfg = constants[(kind === 'plasma') ? 'plasma' : 'shotgun'].reticle;
        if ((cameraMode === 'third') !== true) return cfg.basePx;

        var dist = isFiniteNumber(cameraDistance) ? Math.max(0, cameraDistance) : 0;
        var scale = cfg.refDistance / (cfg.refDistance + dist);
        scale = clamp(scale, cfg.thirdMinScale, cfg.thirdMaxScale);
        return cfg.basePx * scale;
    }

    function getCameraState(options) {
        options = (options && typeof options === 'object') ? options : {};

        var mode = (options.cameraMode === 'third') ? 'third' : 'first';
        var x = isFiniteNumber(options.x) ? options.x : 0;
        var z = isFiniteNumber(options.z) ? options.z : 0;
        var feetY = isFiniteNumber(options.feetY) ? options.feetY : 0;
        var yaw = isFiniteNumber(options.yaw) ? options.yaw : 0;
        var pitch = isFiniteNumber(options.pitch) ? options.pitch : 0;
        if (COORD_SYSTEM && typeof COORD_SYSTEM.clampPitch === 'function') {
            pitch = COORD_SYSTEM.clampPitch(pitch);
        }

        var fovDeg = isFiniteNumber(options.fovDeg) ? options.fovDeg : constants.camera.fovDeg;
        var aspect = isFiniteNumber(options.aspect) ? options.aspect : constants.camera.aspect;
        var eyeOffset = isFiniteNumber(options.eyeOffsetY) ? options.eyeOffsetY : constants.camera.eyeOffsetY;
        var thirdDistance = isFiniteNumber(options.thirdDistance) ? options.thirdDistance : constants.camera.thirdDistance;
        var thirdHeight = isFiniteNumber(options.thirdHeight) ? options.thirdHeight : constants.camera.thirdHeight;
        var thirdShoulder = isFiniteNumber(options.thirdShoulder) ? options.thirdShoulder : constants.camera.thirdShoulder;
        var shoulderSide = (options.shoulderSide === 'left') ? 'left' :
            (options.shoulderSide === 'right') ? 'right' : constants.camera.defaultShoulder;
        var shoulderSign = (shoulderSide === 'left') ? -1 : 1;

        var basis = createBasisFromYawPitch(yaw, pitch);
        var eyePosition = vec3(x, feetY + eyeOffset, z);
        var position = eyePosition;

        if (mode === 'third') {
            var flatForward = directionFromYawPitch(yaw, 0);
            var right = (COORD_SYSTEM && typeof COORD_SYSTEM.rightFromYaw === 'function')
                ? COORD_SYSTEM.rightFromYaw(yaw)
                : vec3(Math.cos(yaw), 0, -Math.sin(yaw));
            position = vec3(
                x + right.x * thirdShoulder * shoulderSign - flatForward.x * thirdDistance,
                eyePosition.y + thirdHeight,
                z + right.z * thirdShoulder * shoulderSign - flatForward.z * thirdDistance
            );
        }

        return {
            mode: mode,
            shoulderSide: shoulderSide,
            yaw: yaw,
            pitch: pitch,
            fovDeg: fovDeg,
            aspect: aspect,
            position: position,
            eyePosition: eyePosition,
            cameraDistance: lengthVec3(subVec3(position, eyePosition)),
            basis: basis
        };
    }

    function getShotgunPelletOffsetsNdc(cameraMode, cameraDistance, viewportWidth, viewportHeight) {
        var width = Math.max(1, isFiniteNumber(viewportWidth) ? viewportWidth : constants.viewport.width);
        var height = Math.max(1, isFiniteNumber(viewportHeight) ? viewportHeight : constants.viewport.height);
        var halfSize = getReticleSizePx('shotgun', cameraMode, cameraDistance) * 0.5;

        var pattern = constants.shotgun.pattern;
        var out = [];
        for (var i = 0; i < pattern.length; i++) {
            var p = pattern[i];
            out.push({
                x: (p[0] * halfSize) / (width * 0.5),
                y: -(p[1] * halfSize) / (height * 0.5)
            });
        }
        return out;
    }

    function buildReticleRectNdc(sizePx, viewportWidth, viewportHeight) {
        var halfNdcX = (0.5 * sizePx) / (Math.max(1, isFiniteNumber(viewportWidth) ? viewportWidth : constants.viewport.width) * 0.5);
        var halfNdcY = (0.5 * sizePx) / (Math.max(1, isFiniteNumber(viewportHeight) ? viewportHeight : constants.viewport.height) * 0.5);
        return {
            minX: -halfNdcX,
            maxX: halfNdcX,
            minY: -halfNdcY,
            maxY: halfNdcY
        };
    }

    function rectOverlapArea(a, b) {
        var x0 = Math.max(a.minX, b.minX);
        var x1 = Math.min(a.maxX, b.maxX);
        var y0 = Math.max(a.minY, b.minY);
        var y1 = Math.min(a.maxY, b.maxY);
        if (x1 <= x0 || y1 <= y0) return 0;
        return (x1 - x0) * (y1 - y0);
    }

    function projectPointToNdc(cameraState, point) {
        if (!cameraState || !cameraState.basis || !point) return null;

        var fovDeg = isFiniteNumber(cameraState.fovDeg) ? cameraState.fovDeg : constants.camera.fovDeg;
        var aspect = isFiniteNumber(cameraState.aspect) ? cameraState.aspect : constants.camera.aspect;
        var tanHalf = Math.tan((fovDeg * Math.PI / 180) * 0.5);
        if (!isFiniteNumber(tanHalf) || tanHalf <= 1e-8) return null;

        var rel = subVec3(point, cameraState.position);
        var z = dotVec3(rel, cameraState.basis.forward);
        if (z <= 1e-5) return null;

        return {
            x: dotVec3(rel, cameraState.basis.right) / (z * tanHalf * aspect),
            y: dotVec3(rel, cameraState.basis.up) / (z * tanHalf),
            z: z
        };
    }

    function projectAabbToNdcRect(cameraState, aabb) {
        if (!aabb || !aabb.min || !aabb.max) return null;

        var corners = [
            vec3(aabb.min.x, aabb.min.y, aabb.min.z),
            vec3(aabb.min.x, aabb.min.y, aabb.max.z),
            vec3(aabb.min.x, aabb.max.y, aabb.min.z),
            vec3(aabb.min.x, aabb.max.y, aabb.max.z),
            vec3(aabb.max.x, aabb.min.y, aabb.min.z),
            vec3(aabb.max.x, aabb.min.y, aabb.max.z),
            vec3(aabb.max.x, aabb.max.y, aabb.min.z),
            vec3(aabb.max.x, aabb.max.y, aabb.max.z)
        ];

        var minX = Infinity;
        var minY = Infinity;
        var maxX = -Infinity;
        var maxY = -Infinity;
        var visible = false;

        for (var i = 0; i < corners.length; i++) {
            var p = projectPointToNdc(cameraState, corners[i]);
            if (!p) continue;
            visible = true;
            if (p.x < minX) minX = p.x;
            if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.y > maxY) maxY = p.y;
        }

        if (!visible || minX === Infinity || minY === Infinity) return null;
        return {
            minX: minX,
            maxX: maxX,
            minY: minY,
            maxY: maxY
        };
    }

    function ndcOffsetToWorldDir(cameraState, ndcX, ndcY) {
        if (!cameraState || !cameraState.basis) return vec3(0, 0, -1);

        var fovDeg = isFiniteNumber(cameraState.fovDeg) ? cameraState.fovDeg : constants.camera.fovDeg;
        var aspect = isFiniteNumber(cameraState.aspect) ? cameraState.aspect : constants.camera.aspect;
        var tanHalf = Math.tan((fovDeg * Math.PI / 180) * 0.5);
        var sx = (isFiniteNumber(ndcX) ? ndcX : 0) * tanHalf * aspect;
        var sy = (isFiniteNumber(ndcY) ? ndcY : 0) * tanHalf;

        var dir = addVec3(
            cameraState.basis.forward,
            addVec3(
                scaleVec3(cameraState.basis.right, sx),
                scaleVec3(cameraState.basis.up, sy)
            )
        );

        return normalizeVec3(dir);
    }

    function getCanonicalViewport() {
        return {
            width: constants.viewport.width,
            height: constants.viewport.height
        };
    }

    global.__GAME_AIM_PARITY__ = {
        constants: constants,
        clamp: clamp,
        directionFromYawPitch: directionFromYawPitch,
        createBasisFromYawPitch: createBasisFromYawPitch,
        getCameraState: getCameraState,
        getReticleSizePx: getReticleSizePx,
        getShotgunPelletOffsetsNdc: getShotgunPelletOffsetsNdc,
        buildReticleRectNdc: buildReticleRectNdc,
        rectOverlapArea: rectOverlapArea,
        projectPointToNdc: projectPointToNdc,
        projectAabbToNdcRect: projectAabbToNdcRect,
        ndcOffsetToWorldDir: ndcOffsetToWorldDir,
        getCanonicalViewport: getCanonicalViewport
    };
})((typeof globalThis !== 'undefined') ? globalThis : this);
