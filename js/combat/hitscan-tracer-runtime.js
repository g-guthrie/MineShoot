/**
 * hitscan-tracer-runtime.js - Internal tracer runtime for hitscan weapons.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameHitscanTracerRuntime
 */
(function () {
    'use strict';

    function create() {
        var tracerMaxCount = 96;
        var tracerPool = [];
        var tracerCursor = 0;
        var tracerScene = null;
        var tracerInstancedMesh = null;
        var tracerPoolReady = false;
        var tracerTmpMatrix = new THREE.Matrix4();
        var tracerTmpPos = new THREE.Vector3();
        var tracerTmpQuat = new THREE.Quaternion();
        var tracerTmpScale = new THREE.Vector3();
        var tracerStart = new THREE.Vector3();
        var tracerHead = new THREE.Vector3();
        var tracerTail = new THREE.Vector3();
        var tracerMeshMid = new THREE.Vector3();
        var tracerMeshUp = new THREE.Vector3(0, 1, 0);
        var tracerZeroMatrix = new THREE.Matrix4().makeScale(0, 0, 0);

        function ensureTracerScene(camera) {
            if (tracerScene) return tracerScene;
            if (camera && camera.parent) {
                tracerScene = camera.parent;
                return tracerScene;
            }
            return null;
        }

        function initTracerPool(camera) {
            if (tracerPoolReady) return true;
            if (!ensureTracerScene(camera)) return false;

            var geo = new THREE.CylinderGeometry(0.03, 0.03, 0.75, 8);
            var mat = new THREE.MeshBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 1.0,
                depthWrite: false,
                depthTest: false
            });
            tracerInstancedMesh = new THREE.InstancedMesh(geo, mat, tracerMaxCount);
            tracerInstancedMesh.frustumCulled = false;
            tracerInstancedMesh.renderOrder = 40;

            for (var i = 0; i < tracerMaxCount; i++) {
                tracerInstancedMesh.setMatrixAt(i, tracerZeroMatrix);
                tracerPool.push({
                    origin: new THREE.Vector3(),
                    dir: new THREE.Vector3(),
                    head: new THREE.Vector3(),
                    tail: new THREE.Vector3(),
                    speed: 0,
                    segmentLength: 0,
                    traveled: 0,
                    maxDistance: 0,
                    life: 0,
                    maxLife: 0.12,
                    framesAlive: 0
                });
            }
            tracerInstancedMesh.instanceMatrix.needsUpdate = true;
            tracerScene.add(tracerInstancedMesh);
            tracerPoolReady = true;
            return true;
        }

        function allocTracer(camera) {
            if (!initTracerPool(camera)) return null;
            tracerCursor = (tracerCursor + 1) % tracerMaxCount;
            return tracerCursor;
        }

        function tracerLifeForWeapon(weapon) {
            return Math.max(0.01, Number(weapon && weapon.tracerLife || 0.11));
        }

        function tracerSpeedForWeapon(weapon) {
            return Math.max(1, Number(weapon && weapon.tracerSpeed || 280));
        }

        function tracerSegmentLengthForWeapon(weapon) {
            return Math.max(0.05, Number(weapon && weapon.tracerSegmentLength || 2.1));
        }

        function spawnTracer(camera, weapon, endPoint, originPoint) {
            if (!camera || !endPoint || !originPoint) return;
            var idx = allocTracer(camera);
            if (idx === null) return;
            var tracer = tracerPool[idx];

            tracerStart.set(
                Number(originPoint.x || 0),
                Number(originPoint.y || 0),
                Number(originPoint.z || 0)
            );
            tracer.origin.copy(tracerStart);
            tracer.dir.copy(endPoint).sub(tracerStart);
            var len = tracer.dir.length();
            if (len <= 0.001) return;
            tracer.dir.divideScalar(len);
            tracer.head.copy(tracer.origin);
            tracer.tail.copy(tracer.origin);
            tracer.traveled = 0;
            tracer.maxDistance = len;
            tracer.segmentLength = tracerSegmentLengthForWeapon(weapon);
            tracer.speed = tracerSpeedForWeapon(weapon);
            tracer.framesAlive = 0;
            tracer.maxLife = tracerLifeForWeapon(weapon);
            tracer.life = tracer.maxLife;
        }

        function updateTracers(dt) {
            if (!dt || !tracerPoolReady || tracerPool.length === 0) return;
            var simDt = Math.min(dt, 1 / 15);
            var matrixDirty = false;
            for (var i = 0; i < tracerPool.length; i++) {
                var tracer = tracerPool[i];
                if (!tracer || tracer.life <= 0) continue;
                tracer.life -= simDt;
                tracer.framesAlive += 1;

                var step = tracer.speed * simDt;
                tracer.traveled += step;
                if (tracer.traveled > tracer.maxDistance) tracer.traveled = tracer.maxDistance;
                tracer.head.copy(tracer.origin).addScaledVector(tracer.dir, tracer.traveled);
                var tailTravel = Math.max(0, tracer.traveled - tracer.segmentLength);
                tracer.tail.copy(tracer.origin).addScaledVector(tracer.dir, tailTravel);
                tracerMeshMid.copy(tracer.tail).add(tracer.head).multiplyScalar(0.5);

                var dead = false;
                if (tracer.life <= 0) {
                    tracer.life = 0;
                    dead = true;
                } else if (tracer.traveled >= tracer.maxDistance && tracer.framesAlive > 1) {
                    tracer.life = 0;
                    dead = true;
                }

                if (dead) {
                    tracerInstancedMesh.setMatrixAt(i, tracerZeroMatrix);
                    matrixDirty = true;
                    continue;
                }

                tracerHead.copy(tracer.head);
                tracerTail.copy(tracer.tail);
                var visibleLength = tracerHead.distanceTo(tracerTail);
                tracerTmpPos.copy(tracerMeshMid);
                tracerTmpQuat.setFromUnitVectors(tracerMeshUp, tracer.dir);
                tracerTmpScale.set(1, Math.max(0.05, visibleLength * 0.82), 1);
                tracerTmpMatrix.compose(tracerTmpPos, tracerTmpQuat, tracerTmpScale);
                tracerInstancedMesh.setMatrixAt(i, tracerTmpMatrix);
                matrixDirty = true;
            }
            if (matrixDirty) tracerInstancedMesh.instanceMatrix.needsUpdate = true;
        }

        function dispose() {
            if (tracerInstancedMesh && tracerInstancedMesh.parent) {
                tracerInstancedMesh.parent.remove(tracerInstancedMesh);
            }
            if (tracerInstancedMesh) {
                if (tracerInstancedMesh.geometry && typeof tracerInstancedMesh.geometry.dispose === 'function') {
                    tracerInstancedMesh.geometry.dispose();
                }
                var material = tracerInstancedMesh.material;
                if (Array.isArray(material)) {
                    for (var i = 0; i < material.length; i++) {
                        if (material[i] && typeof material[i].dispose === 'function') {
                            material[i].dispose();
                        }
                    }
                } else if (material && typeof material.dispose === 'function') {
                    material.dispose();
                }
            }
            tracerPool = [];
            tracerCursor = 0;
            tracerScene = null;
            tracerInstancedMesh = null;
            tracerPoolReady = false;
        }

        return {
            spawnTracer: spawnTracer,
            updateTracers: updateTracers,
            dispose: dispose
        };
    }

    globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    globalThis.__MAYHEM_RUNTIME.GameHitscanTracerRuntime = {
        create: create
    };
})();
