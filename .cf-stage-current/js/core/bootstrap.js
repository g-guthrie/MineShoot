/**
 * bootstrap.js - Shared app bootstrap primitives.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameBootstrap
 */
(function () {
    'use strict';

    var GameBootstrap = {};
    var MAX_PIXEL_RATIO = 1.75;

    function cappedPixelRatio() {
        return Math.min(MAX_PIXEL_RATIO, Math.max(1, Number(window.devicePixelRatio) || 1));
    }

    GameBootstrap.createRenderContext = function () {
        var renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(cappedPixelRatio());
        document.body.appendChild(renderer.domElement);

        var scene = new THREE.Scene();
        var clock = new THREE.Clock();

        return {
            renderer: renderer,
            scene: scene,
            clock: clock
        };
    };

    GameBootstrap.installResizeHandler = function (renderer) {
        window.addEventListener('resize', function () {
            if (!renderer) return;
            renderer.setPixelRatio(cappedPixelRatio());
            renderer.setSize(window.innerWidth, window.innerHeight);
        });
    };

    globalThis.__MAYHEM_RUNTIME.GameBootstrap = GameBootstrap;
})();
