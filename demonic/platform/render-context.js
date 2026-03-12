(function () {
    'use strict';

    var demonicRuntime = globalThis.__DEMONIC_RUNTIME = globalThis.__DEMONIC_RUNTIME || {};

    function cappedPixelRatio() {
        return Math.min(1.75, Math.max(1, Number(window.devicePixelRatio) || 1));
    }

    function create(options) {
        options = options || {};
        var host = options.host || null;
        if (!host) throw new Error('Demonic render context requires a host element.');
        if (!globalThis.THREE) throw new Error('Demonic render context requires global THREE.');

        var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
        renderer.setPixelRatio(cappedPixelRatio());
        renderer.setSize(Math.max(1, host.clientWidth || 640), Math.max(1, host.clientHeight || 320));
        host.innerHTML = '';
        host.appendChild(renderer.domElement);

        var scene = new THREE.Scene();
        var camera = new THREE.PerspectiveCamera(60, Math.max(1, host.clientWidth || 640) / Math.max(1, host.clientHeight || 320), 0.1, 100);
        camera.position.set(2.2, 2.1, 4.4);

        var ambient = new THREE.AmbientLight(0xffffff, 1.35);
        scene.add(ambient);
        var key = new THREE.DirectionalLight(0xffffff, 1.4);
        key.position.set(4, 7, 5);
        scene.add(key);

        function resize() {
            if (!host || !renderer || !camera) return;
            var width = Math.max(1, host.clientWidth || host.offsetWidth || 640);
            var height = Math.max(1, host.clientHeight || host.offsetHeight || 320);
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            renderer.setPixelRatio(cappedPixelRatio());
            renderer.setSize(width, height);
        }

        window.addEventListener('resize', resize);
        resize();

        return {
            renderer: renderer,
            scene: scene,
            camera: camera,
            resize: resize,
            destroy: function () {
                window.removeEventListener('resize', resize);
                if (renderer && renderer.dispose) renderer.dispose();
                if (renderer && renderer.domElement && renderer.domElement.parentNode) {
                    renderer.domElement.parentNode.removeChild(renderer.domElement);
                }
            }
        };
    }

    demonicRuntime.GameRenderContext = {
        create: create
    };
})();
