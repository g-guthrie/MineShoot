/**
 * coord-system.js - Canonical FPS coordinate helpers
 * Loaded as global: window.__GAME_COORD_SYSTEM__
 */
(function (global) {
    'use strict';

    if (global.__GAME_COORD_SYSTEM__) return;

    var DEFAULT_PITCH_LIMIT_RAD = 89 * (Math.PI / 180);

    function isFiniteNumber(value) {
        return (typeof value === 'number' && isFinite(value));
    }

    function wrapRad(rad) {
        var out = Number(rad || 0);
        while (out > Math.PI) out -= Math.PI * 2;
        while (out < -Math.PI) out += Math.PI * 2;
        return out;
    }

    function clampPitch(pitchRad, limitRad) {
        var lim = isFiniteNumber(limitRad) ? Math.abs(limitRad) : DEFAULT_PITCH_LIMIT_RAD;
        var p = Number(pitchRad || 0);
        if (p > lim) return lim;
        if (p < -lim) return -lim;
        return p;
    }

    function normalize(v) {
        var len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z) || 1;
        return { x: v.x / len, y: v.y / len, z: v.z / len };
    }

    // Canonical FPS semantics for this project:
    // yaw=0 faces -Z, positive yaw turns left.
    function forwardFromYawPitch(yawRad, pitchRad) {
        var yaw = Number(yawRad || 0);
        var pitch = Number(pitchRad || 0);
        var cp = Math.cos(pitch);
        return normalize({
            x: -Math.sin(yaw) * cp,
            y: Math.sin(pitch),
            z: -Math.cos(yaw) * cp
        });
    }

    function rightFromYaw(yawRad) {
        var yaw = Number(yawRad || 0);
        return normalize({
            x: Math.cos(yaw),
            y: 0,
            z: -Math.sin(yaw)
        });
    }

    function cross(a, b) {
        return {
            x: a.y * b.z - a.z * b.y,
            y: a.z * b.x - a.x * b.z,
            z: a.x * b.y - a.y * b.x
        };
    }

    function upVector() {
        return { x: 0, y: 1, z: 0 };
    }

    function basisFromYawPitch(yawRad, pitchRad) {
        var fwd = forwardFromYawPitch(yawRad, pitchRad);
        var right = rightFromYaw(yawRad);
        var up = normalize(cross(right, fwd));
        return {
            forward: fwd,
            right: right,
            up: up
        };
    }

    global.__GAME_COORD_SYSTEM__ = Object.freeze({
        DEFAULT_PITCH_LIMIT_RAD: DEFAULT_PITCH_LIMIT_RAD,
        wrapRad: wrapRad,
        clampPitch: clampPitch,
        forwardFromYawPitch: forwardFromYawPitch,
        rightFromYaw: rightFromYaw,
        upVector: upVector,
        basisFromYawPitch: basisFromYawPitch
    });
})((typeof globalThis !== 'undefined') ? globalThis : this);

