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

    function detachCanvas(node) {
        if (!node || !node.parentNode || !node.parentNode.removeChild) return;
        node.parentNode.removeChild(node);
    }

    function createRenderer(options) {
        var renderer = new THREE.WebGLRenderer(options);
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(cappedPixelRatio());
        document.body.appendChild(renderer.domElement);
        return renderer;
    }

    GameBootstrap.createRenderContext = function () {
        var attempts = [
            { antialias: true, powerPreference: 'high-performance' },
            { antialias: false, powerPreference: 'high-performance' },
            { antialias: false, powerPreference: 'default' }
        ];
        var renderer = null;
        var lastErr = null;

        for (var i = 0; i < attempts.length; i++) {
            try {
                renderer = createRenderer(attempts[i]);
                break;
            } catch (err) {
                lastErr = err;
                if (renderer && renderer.dispose) renderer.dispose();
                if (renderer && renderer.domElement) detachCanvas(renderer.domElement);
                renderer = null;
            }
        }
        if (!renderer) {
            throw lastErr || new Error('Unable to create a WebGL renderer.');
        }

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
