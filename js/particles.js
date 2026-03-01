/**
 * particles.js - Lightweight InstancedMesh particle pool
 * Global: window.GameParticles
 *
 * Single draw call for all particles via THREE.InstancedMesh.
 * Pre-allocates a fixed pool to avoid GC pressure during gameplay.
 */
(function () {
    'use strict';

    var MAX_PARTICLES = 300;
    var GameParticles = {};

    var sceneRef = null;
    var instancedMesh = null;
    var particles = [];    // active particle descriptors
    var pool = [];         // free indices
    var dummy = null;      // reusable Object3D for matrix composition
    var hiddenMatrix = null;

    // Temp vectors to avoid per-frame allocation
    var tmpVec = null;
    var tmpColor = null;

    function detachMesh() {
        if (instancedMesh && sceneRef) {
            sceneRef.remove(instancedMesh);
            if (instancedMesh.geometry) instancedMesh.geometry.dispose();
            if (instancedMesh.material) instancedMesh.material.dispose();
        }
    }

    GameParticles.init = function (scene) {
        detachMesh();
        sceneRef = scene;
        particles = [];
        pool = [];
        dummy = new THREE.Object3D();
        tmpVec = new THREE.Vector3();
        tmpColor = new THREE.Color();
        hiddenMatrix = new THREE.Matrix4().makeScale(0, 0, 0);

        var geo = new THREE.BoxGeometry(1, 1, 1);
        var mat = new THREE.MeshBasicMaterial({
            vertexColors: true,
            transparent: true,
            opacity: 1,
            depthWrite: false,
            side: THREE.DoubleSide
        });

        instancedMesh = new THREE.InstancedMesh(geo, mat, MAX_PARTICLES);
        instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        instancedMesh.frustumCulled = false;
        instancedMesh.renderOrder = 50;

        // Instance colors
        instancedMesh.instanceColor = new THREE.InstancedBufferAttribute(
            new Float32Array(MAX_PARTICLES * 3), 3
        );
        instancedMesh.instanceColor.setUsage(THREE.DynamicDrawUsage);

        // Hide all instances off-screen initially
        for (var i = 0; i < MAX_PARTICLES; i++) {
            instancedMesh.setMatrixAt(i, hiddenMatrix);
            pool.push(i);
        }
        instancedMesh.instanceMatrix.needsUpdate = true;
        instancedMesh.count = MAX_PARTICLES;

        scene.add(instancedMesh);
    };

    /**
     * Spawn a particle.
     * @param {THREE.Vector3} pos - world position
     * @param {THREE.Vector3} vel - velocity (units/sec)
     * @param {number} colorHex - color as hex (e.g. 0xff6600)
     * @param {number} scale - initial size
     * @param {number} life - lifetime in seconds
     * @param {object} [opts] - optional overrides
     * @param {number} [opts.gravity] - gravity multiplier (default 1)
     * @param {number} [opts.scaleEnd] - end scale (default 0)
     * @param {number} [opts.drag] - velocity damping per sec (0-1, default 0)
     */
    GameParticles.spawn = function (pos, vel, colorHex, scale, life, opts) {
        if (!instancedMesh || !sceneRef || !dummy || !tmpVec || !tmpColor) return -1;
        if (pool.length === 0) return -1;
        opts = opts || {};

        var idx = pool.pop();
        var p = {
            idx: idx,
            px: pos.x, py: pos.y, pz: pos.z,
            vx: vel.x, vy: vel.y, vz: vel.z,
            color: colorHex,
            scale0: scale,
            scaleEnd: opts.scaleEnd !== undefined ? opts.scaleEnd : 0,
            life: life,
            maxLife: life,
            gravity: opts.gravity !== undefined ? opts.gravity : 1,
            drag: opts.drag || 0
        };
        particles.push(p);
        return idx;
    };

    /**
     * Spawn a burst of particles.
     * @param {THREE.Vector3} center - burst origin
     * @param {number} count - number of particles
     * @param {object} cfg - configuration
     * @param {number|Array} cfg.color - hex color or array of hex colors (picks random)
     * @param {number[]} cfg.speedRange - [min, max] speed
     * @param {number[]} cfg.scaleRange - [min, max] scale
     * @param {number[]} cfg.lifeRange - [min, max] lifetime
     * @param {number} [cfg.gravity] - gravity (default 1)
     * @param {number} [cfg.upBias] - upward velocity bias (default 0)
     * @param {number} [cfg.drag] - drag (default 0)
     * @param {number} [cfg.scaleEnd] - end scale
     */
    GameParticles.burst = function (center, count, cfg) {
        var colors = Array.isArray(cfg.color) ? cfg.color : [cfg.color];
        for (var i = 0; i < count; i++) {
            if (pool.length === 0) break;
            var speed = lerp(cfg.speedRange[0], cfg.speedRange[1], Math.random());
            var scale = lerp(cfg.scaleRange[0], cfg.scaleRange[1], Math.random());
            var life = lerp(cfg.lifeRange[0], cfg.lifeRange[1], Math.random());
            var col = colors[Math.floor(Math.random() * colors.length)];

            // Random direction on unit sphere
            var theta = Math.random() * Math.PI * 2;
            var phi = Math.acos(2 * Math.random() - 1);
            var sx = Math.sin(phi) * Math.cos(theta);
            var sy = Math.sin(phi) * Math.sin(theta);
            var sz = Math.cos(phi);

            tmpVec.set(sx * speed, sy * speed + (cfg.upBias || 0), sz * speed);

            GameParticles.spawn(center, tmpVec, col, scale, life, {
                gravity: cfg.gravity !== undefined ? cfg.gravity : 1,
                drag: cfg.drag || 0,
                scaleEnd: cfg.scaleEnd !== undefined ? cfg.scaleEnd : 0
            });
        }
    };

    GameParticles.update = function (dt) {
        if (!instancedMesh || particles.length === 0) return;
        if (!hiddenMatrix) hiddenMatrix = new THREE.Matrix4().makeScale(0, 0, 0);

        for (var i = particles.length - 1; i >= 0; i--) {
            var p = particles[i];
            p.life -= dt;

            if (p.life <= 0) {
                // Return to pool — hide by zeroing scale
                instancedMesh.setMatrixAt(p.idx, hiddenMatrix);
                pool.push(p.idx);
                particles.splice(i, 1);
                continue;
            }

            // Physics
            var drag = 1 - p.drag * dt;
            if (drag < 0) drag = 0;
            p.vx *= drag;
            p.vy *= drag;
            p.vz *= drag;
            p.vy -= 9.8 * p.gravity * dt;

            p.px += p.vx * dt;
            p.py += p.vy * dt;
            p.pz += p.vz * dt;

            // Interpolate scale
            var t = 1 - (p.life / p.maxLife);
            var s = p.scale0 + (p.scaleEnd - p.scale0) * t;
            if (s < 0.001) s = 0.001;

            // Set transform
            dummy.position.set(p.px, p.py, p.pz);
            dummy.scale.set(s, s, s);
            dummy.rotation.set(0, 0, 0);
            dummy.updateMatrix();
            instancedMesh.setMatrixAt(p.idx, dummy.matrix);

            // Set color with opacity fade baked into brightness
            var opacity = p.life / p.maxLife;
            tmpColor.setHex(p.color);
            tmpColor.r *= opacity;
            tmpColor.g *= opacity;
            tmpColor.b *= opacity;
            instancedMesh.instanceColor.setXYZ(p.idx, tmpColor.r, tmpColor.g, tmpColor.b);
        }

        instancedMesh.instanceMatrix.needsUpdate = true;
        instancedMesh.instanceColor.needsUpdate = true;
    };

    GameParticles.getActiveCount = function () {
        return particles.length;
    };

    GameParticles.dispose = function () {
        detachMesh();
        particles = [];
        pool = [];
        instancedMesh = null;
        sceneRef = null;
        dummy = null;
        hiddenMatrix = null;
        tmpVec = null;
        tmpColor = null;
    };

    function lerp(a, b, t) {
        return a + (b - a) * t;
    }

    window.GameParticles = GameParticles;
})();
