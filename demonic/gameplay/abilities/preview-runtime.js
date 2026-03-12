(function () {
    'use strict';

    var demonicRuntime = globalThis.__DEMONIC_RUNTIME = globalThis.__DEMONIC_RUNTIME || {};

    function widenedChokeWidth(lockBoxPx) {
        return Math.max(24, Number(lockBoxPx || 180) * 1.2);
    }

    function viewportWidth() {
        return Math.max(1, (typeof window !== 'undefined' && Number(window.innerWidth)) || 1280);
    }

    function viewportHeight() {
        return Math.max(1, (typeof window !== 'undefined' && Number(window.innerHeight)) || 720);
    }

    function aspectFromCamera(camera) {
        return Math.max(0.0001, Number(camera && camera.aspect || (viewportWidth() / viewportHeight())));
    }

    function deadeyeRectSize(camera, minDot) {
        var clampedDot = Math.max(-1, Math.min(1, Number(minDot || 0.22)));
        var halfAngleRad = Math.acos(clampedDot);
        var vFovRad = Number(camera && camera.fov || 60) * Math.PI / 180;
        var tanHalf = Math.tan(halfAngleRad);
        var tanV = Math.tan(vFovRad * 0.5);
        if (!isFinite(tanHalf) || !isFinite(tanV) || tanV <= 0.000001) {
            return { width: 220, height: 160 };
        }
        var aspect = aspectFromCamera(camera);
        var xNdc = tanHalf / (tanV * aspect);
        var yNdc = tanHalf / tanV;
        return {
            width: Math.max(60, Math.min(viewportWidth() * 0.86, xNdc * viewportWidth())),
            height: Math.max(60, Math.min(viewportHeight() * 0.86, yNdc * viewportHeight()))
        };
    }

    function chokeRectSize(camera, active) {
        var meta = active && active.meta ? active.meta : {};
        var deadeyeMinDot = Number(meta.deadeyeMinDot || 0.22);
        var rect = deadeyeRectSize(camera, deadeyeMinDot);
        return {
            width: widenedChokeWidth(meta.lockBoxPx || 180),
            height: rect.height
        };
    }

    function hookCircleSize(active) {
        var meta = active && active.meta ? active.meta : {};
        var radiusPx = Math.max(26, Number(meta.reticleRadiusPx || 52));
        return {
            width: radiusPx * 2,
            height: radiusPx * 2
        };
    }

    function create() {
        return {
            resolve: function (active, camera) {
                if (!active) return null;
                var id = String(active.abilityId || '');
                if (id === 'deadeye') {
                    var deadeyeRect = deadeyeRectSize(camera, active.meta && active.meta.minDot);
                    return {
                        type: 'deadeye_rect',
                        width: deadeyeRect.width,
                        height: deadeyeRect.height,
                        label: 'DEADEYE ' + Number(active.meta && active.meta.lockCount || 0) + '/' + Number(active.meta && active.meta.maxLocks || 0)
                    };
                }
                if (id === 'choke') {
                    var chokeRect = chokeRectSize(camera, active);
                    return {
                        type: 'choke_rect',
                        width: chokeRect.width,
                        height: chokeRect.height,
                        label: 'FORCE CHOKE'
                    };
                }
                if (id === 'hook') {
                    var hookRect = hookCircleSize(active);
                    return {
                        type: 'hook_circle',
                        width: hookRect.width,
                        height: hookRect.height,
                        label: String(active.meta && active.meta.phase || 'HOOK').toUpperCase()
                    };
                }
                return null;
            }
        };
    }

    demonicRuntime.GameAbilityPreviewRuntime = {
        create: create
    };
})();
