/**
 * throwables-trajectory.js - Throw intent and trajectory preview logic.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameThrowablesTrajectory
 */
(function () {
    'use strict';

    function create(opts) {
        opts = opts || {};

        var raycaster = new THREE.Raycaster();
        var centerPoint = new THREE.Vector2(0, 0);
        var tmpForward = new THREE.Vector3();
        var tmpRight = new THREE.Vector3();
        var tmpUp = new THREE.Vector3();
        var trajPos = new THREE.Vector3();
        var trajVel = new THREE.Vector3();
        var trajStart = new THREE.Vector3();
        var trajEnd = new THREE.Vector3();
        var trajectoryPreview = {
            dotsNear: null,
            dotsFar: null,
            impact: null,
            areaSphere: null,
            areaDisk: null,
            activeType: ''
        };
        var trajectoryPreviewTuning = {
            stepSec: 1 / 60,
            maxPoints: 120,
            maxPreviewTime: 4.0,
            hiddenStartDistance: 3.75,
            pointStrideNear: 4,
            pointStrideFar: 6,
            aimPitchBoost: 1.5
        };
        var debugPreviewVolumesEnabled = false;

        function defs() {
            return opts.getDefs ? opts.getDefs() : {};
        }

        function scene() {
            return opts.getScene ? opts.getScene() : null;
        }

        function mechanicsTuning() {
            return opts.getMechanicsTuning ? opts.getMechanicsTuning() : {};
        }

        function distanceTuning() {
            return opts.getDistanceTuning ? opts.getDistanceTuning() : {};
        }

        function getWorldTargets() {
            if (!opts.getWorldTargets) {
                return {
                    worldMeshes: [],
                    hitboxes: []
                };
            }
            var targets = opts.getWorldTargets() || {};
            return {
                worldMeshes: Array.isArray(targets.worldMeshes) ? targets.worldMeshes : [],
                hitboxes: Array.isArray(targets.hitboxes) ? targets.hitboxes : []
            };
        }

        function segmentCollision(start, end) {
            return opts.segmentCollision ? opts.segmentCollision(start, end) : null;
        }

        function plasmaMaxLife(def) {
            if (opts.plasmaMaxLife) return opts.plasmaMaxLife(def);
            var maxLife = Number(def && def.maxLife);
            if (isFinite(maxLife) && maxLife > 0) return maxLife;
            return Math.max(0.2, Number(def && def.fuse || 2.2));
        }

        function recordIntent(intent) {
            if (!opts.onIntentBuilt || !intent) return;
            opts.onIntentBuilt(intent);
        }

        function getDefaultThrowOrigin(camera, forward, right, up) {
            var hand = null;
            if (globalThis.__MAYHEM_RUNTIME.GamePlayer && globalThis.__MAYHEM_RUNTIME.GamePlayer.getThrowableOriginWorldPosition) {
                hand = globalThis.__MAYHEM_RUNTIME.GamePlayer.getThrowableOriginWorldPosition();
            }
            if (hand && typeof hand.x === 'number' && typeof hand.y === 'number' && typeof hand.z === 'number') {
                return hand.clone();
            }
            return camera.position.clone()
                .addScaledVector(forward, 0.75)
                .addScaledVector(right, 0.2)
                .addScaledVector(up, -0.15);
        }

        function buildThrowIntent(camera, options) {
            if (!camera) return null;
            options = options || {};

            camera.getWorldDirection(tmpForward);
            tmpRight.set(1, 0, 0).applyQuaternion(camera.quaternion);
            tmpUp.set(0, 1, 0).applyQuaternion(camera.quaternion);

            var origin = options.origin
                ? options.origin.clone()
                : getDefaultThrowOrigin(camera, tmpForward, tmpRight, tmpUp);

            var direction = null;
            var aimPoint = null;
            var tuning = mechanicsTuning();
            var rayRange = Math.max(1, Number(tuning.aimRayRange || 100));

            if (options.direction) {
                direction = options.direction.clone().normalize();
                aimPoint = origin.clone().addScaledVector(direction, rayRange);
            } else {
                var targets = getWorldTargets();
                var allTargets = targets.hitboxes.concat(targets.worldMeshes);
                if (allTargets.length > 0) {
                    raycaster.setFromCamera(centerPoint, camera);
                    raycaster.far = rayRange;
                    var hits = raycaster.intersectObjects(allTargets, false);
                    if (hits.length > 0) {
                        aimPoint = hits[0].point.clone();
                    }
                }
                if (!aimPoint) {
                    aimPoint = camera.position.clone().addScaledVector(tmpForward, rayRange);
                }
                direction = aimPoint.clone().sub(origin).normalize();
            }

            if (!direction || !isFinite(direction.x) || !isFinite(direction.y) || !isFinite(direction.z) || direction.lengthSq() < 0.00001) {
                direction = tmpForward.clone();
            }

            var intent = {
                origin: origin,
                direction: direction.normalize(),
                aimPoint: aimPoint ? aimPoint.clone() : origin.clone().addScaledVector(direction, rayRange),
                rayRange: rayRange
            };
            recordIntent(intent);
            return intent;
        }

        function buildThrowVelocity(def, intent, useExplicitDirection) {
            if (!def || !intent || !intent.direction) return null;

            var baseDir = intent.direction.clone().normalize();
            var aimPitchBoost = Math.max(0, Number(trajectoryPreviewTuning.aimPitchBoost || 1));
            if (baseDir.y > 0 && aimPitchBoost !== 1) {
                baseDir.y *= aimPitchBoost;
                baseDir.normalize();
            }

            var speed = Math.max(0, Number(def.speed || 0));
            var upward = Math.max(0, Number(def.upward || 0));
            var vel = baseDir.multiplyScalar(speed);
            vel.y += useExplicitDirection ? (upward * 0.15) : upward;
            return vel;
        }

        function clearTrajectoryPreview() {
            trajectoryPreview.activeType = '';
            if (trajectoryPreview.dotsNear) trajectoryPreview.dotsNear.visible = false;
            if (trajectoryPreview.dotsFar) trajectoryPreview.dotsFar.visible = false;
            if (trajectoryPreview.impact) trajectoryPreview.impact.visible = false;
            if (trajectoryPreview.areaSphere) trajectoryPreview.areaSphere.visible = false;
            if (trajectoryPreview.areaDisk) trajectoryPreview.areaDisk.visible = false;
        }

        function ensureTrajectoryPreviewMeshes() {
            var sceneRef = scene();
            if (!sceneRef) return false;

            if (!trajectoryPreview.dotsNear) {
                var nearGeo = new THREE.BufferGeometry().setFromPoints([
                    new THREE.Vector3(0, 0, 0),
                    new THREE.Vector3(0, 0, 0)
                ]);
                var nearMat = new THREE.PointsMaterial({
                    color: 0xffffff,
                    transparent: true,
                    opacity: 0.34,
                    size: 0.18,
                    sizeAttenuation: true,
                    depthTest: false,
                    depthWrite: false
                });
                trajectoryPreview.dotsNear = new THREE.Points(nearGeo, nearMat);
                trajectoryPreview.dotsNear.visible = false;
                trajectoryPreview.dotsNear.renderOrder = 60;
                trajectoryPreview.dotsNear.frustumCulled = false;
                trajectoryPreview.dotsNear.layers.set(0);
                sceneRef.add(trajectoryPreview.dotsNear);
            }

            if (!trajectoryPreview.dotsFar) {
                var farGeo = new THREE.BufferGeometry().setFromPoints([
                    new THREE.Vector3(0, 0, 0),
                    new THREE.Vector3(0, 0, 0)
                ]);
                var farMat = new THREE.PointsMaterial({
                    color: 0xffffff,
                    transparent: true,
                    opacity: 0.86,
                    size: 0.12,
                    sizeAttenuation: true,
                    depthTest: false,
                    depthWrite: false
                });
                trajectoryPreview.dotsFar = new THREE.Points(farGeo, farMat);
                trajectoryPreview.dotsFar.visible = false;
                trajectoryPreview.dotsFar.renderOrder = 60;
                trajectoryPreview.dotsFar.frustumCulled = false;
                trajectoryPreview.dotsFar.layers.set(0);
                sceneRef.add(trajectoryPreview.dotsFar);
            }

            if (!trajectoryPreview.impact) {
                trajectoryPreview.impact = new THREE.Mesh(
                    new THREE.SphereGeometry(0.12, 10, 10),
                    new THREE.MeshBasicMaterial({
                        color: 0xffffff,
                        transparent: true,
                        opacity: 0.95,
                        depthTest: false,
                        depthWrite: false
                    })
                );
                trajectoryPreview.impact.visible = false;
                trajectoryPreview.impact.renderOrder = 61;
                trajectoryPreview.impact.layers.set(0);
                sceneRef.add(trajectoryPreview.impact);
            }

            if (!trajectoryPreview.areaSphere) {
                trajectoryPreview.areaSphere = new THREE.Mesh(
                    new THREE.SphereGeometry(1, 18, 14),
                    new THREE.MeshBasicMaterial({
                        color: 0xffd480,
                        transparent: true,
                        opacity: 0.12,
                        wireframe: true,
                        depthTest: true,
                        depthWrite: false
                    })
                );
                trajectoryPreview.areaSphere.visible = false;
                trajectoryPreview.areaSphere.renderOrder = 59;
                trajectoryPreview.areaSphere.layers.set(0);
                sceneRef.add(trajectoryPreview.areaSphere);
            }

            if (!trajectoryPreview.areaDisk) {
                trajectoryPreview.areaDisk = new THREE.Mesh(
                    new THREE.CylinderGeometry(1, 1, 0.05, 28),
                    new THREE.MeshBasicMaterial({
                        color: 0xff7a33,
                        transparent: true,
                        opacity: 0.2,
                        wireframe: true,
                        depthTest: true,
                        depthWrite: false
                    })
                );
                trajectoryPreview.areaDisk.visible = false;
                trajectoryPreview.areaDisk.renderOrder = 59;
                trajectoryPreview.areaDisk.layers.set(0);
                sceneRef.add(trajectoryPreview.areaDisk);
            }

            return true;
        }

        function previewColorsForType(type) {
            if (type === 'plasma') {
                return { lineNear: 0x66ddff, lineFar: 0xd6f8ff, impact: 0x66ddff };
            }
            if (type === 'molotov') {
                return { lineNear: 0xb77730, lineFar: 0xffffff, impact: 0xff8a3d };
            }
            return { lineNear: 0x98a4b8, lineFar: 0xffffff, impact: 0xffffff };
        }

        function updateTrajectoryAreaPreview(type, sim, previewColors) {
            if (!trajectoryPreview.areaSphere || !trajectoryPreview.areaDisk) return;
            trajectoryPreview.areaSphere.visible = false;
            trajectoryPreview.areaDisk.visible = false;
            if (!debugPreviewVolumesEnabled || !sim || !sim.impactPoint) return;

            var currentDefs = defs();
            var tuning = distanceTuning();
            if (type === 'frag') {
                var fragRadius = Math.max(0.2, Number(currentDefs.frag && currentDefs.frag.radius || 0));
                if (trajectoryPreview.areaSphere.material && trajectoryPreview.areaSphere.material.color) {
                    trajectoryPreview.areaSphere.material.color.setHex(previewColors.impact);
                }
                trajectoryPreview.areaSphere.position.copy(sim.impactPoint);
                trajectoryPreview.areaSphere.scale.set(fragRadius, fragRadius, fragRadius);
                trajectoryPreview.areaSphere.visible = true;
                return;
            }

            if (type === 'plasma') {
                var catchRadius = Math.max(0.2, Number(currentDefs.plasma && currentDefs.plasma.catchRadius || tuning.plasmaCatchRadius || 0));
                if (trajectoryPreview.areaSphere.material && trajectoryPreview.areaSphere.material.color) {
                    trajectoryPreview.areaSphere.material.color.setHex(previewColors.impact);
                }
                trajectoryPreview.areaSphere.position.copy(sim.impactPoint);
                trajectoryPreview.areaSphere.scale.set(catchRadius, catchRadius, catchRadius);
                trajectoryPreview.areaSphere.visible = true;
                return;
            }

            if (type === 'molotov') {
                var fireRadius = Math.max(0.2, Number(currentDefs.molotov && currentDefs.molotov.fireRadius || 0));
                if (trajectoryPreview.areaDisk.material && trajectoryPreview.areaDisk.material.color) {
                    trajectoryPreview.areaDisk.material.color.setHex(previewColors.impact);
                }
                trajectoryPreview.areaDisk.position.set(sim.impactPoint.x, sim.impactPoint.y + 0.03, sim.impactPoint.z);
                trajectoryPreview.areaDisk.scale.set(fireRadius, 1, fireRadius);
                trajectoryPreview.areaDisk.visible = true;
            }
        }

        function splitPreviewPoints(points) {
            if (!Array.isArray(points) || points.length < 2) {
                return { near: [], far: [] };
            }
            var splitIndex = Math.max(2, Math.min(points.length - 1, Math.floor(points.length * 0.38)));
            return {
                near: points.slice(0, splitIndex),
                far: points.slice(splitIndex - 1)
            };
        }

        function sparsePreviewPoints(points, stride) {
            if (!Array.isArray(points) || points.length < 2) return [];
            var step = Math.max(1, Math.round(Number(stride || 1)));
            if (step <= 1) return points.slice();
            var out = [points[0]];
            for (var i = step; i < points.length - 1; i += step) {
                out.push(points[i]);
            }
            out.push(points[points.length - 1]);
            return out;
        }

        function previewLifetimeForType(type, def) {
            if (!def) return 2.2;
            if (type === 'knife') return Math.max(0.2, Number(def.life || 1.8));
            if (type === 'plasma') return plasmaMaxLife(def);
            if (typeof def.fuse === 'number') return Math.max(0.2, Number(def.fuse));
            if (typeof def.life === 'number') return Math.max(0.2, Number(def.life));
            return 2.2;
        }

        function simulateTrajectory(type, intent) {
            var currentDefs = defs();
            var def = currentDefs[type];
            if (!def || !intent || !intent.origin || !intent.direction) {
                return { points: [], impactPoint: null };
            }

            var tuning = mechanicsTuning();
            var dt = Math.max(1 / 120, Number(trajectoryPreviewTuning.stepSec || (1 / 60)));
            var maxPoints = Math.max(8, Math.round(Number(trajectoryPreviewTuning.maxPoints || 120)));
            var maxTime = Math.min(
                Math.max(0.5, Number(trajectoryPreviewTuning.maxPreviewTime || 4)),
                previewLifetimeForType(type, def) + 0.9
            );

            trajPos.copy(intent.origin);
            var previewVelocity = buildThrowVelocity(def, intent, false);
            if (!previewVelocity) {
                return { points: [], impactPoint: null };
            }
            trajVel.copy(previewVelocity);

            var points = [trajPos.clone()];
            var age = 0;
            var bounces = 0;

            while (age < maxTime && points.length < maxPoints) {
                trajStart.copy(trajPos);
                trajVel.y -= Number(def.gravity || 0) * dt;
                trajEnd.copy(trajPos).addScaledVector(trajVel, dt);

                var hit = segmentCollision(trajStart, trajEnd);
                if (hit) {
                    points.push(hit.point.clone());

                    if (type === 'frag' && hit.kind === 'world') {
                        trajPos.copy(hit.point);
                        trajVel.multiplyScalar(tuning.fragBounceVelocityDamping || 0.4);
                        trajVel.y = Math.abs(trajVel.y) * (tuning.fragBounceVerticalDamping || 0.42);
                        bounces++;
                        if (bounces > (tuning.fragBounceMaxCount || 2) ||
                            trajVel.lengthSq() < (tuning.fragBounceStopSpeedSq || 2.5)) {
                            trajVel.set(0, 0, 0);
                        }
                        age += dt;
                        if (age >= previewLifetimeForType(type, def)) {
                            return { points: points, impactPoint: trajPos.clone() };
                        }
                        continue;
                    }

                    return { points: points, impactPoint: hit.point.clone() };
                }

                trajPos.copy(trajEnd);
                points.push(trajPos.clone());
                age += dt;

                if (age >= previewLifetimeForType(type, def)) {
                    return { points: points, impactPoint: trajPos.clone() };
                }
            }

            return {
                points: points,
                impactPoint: points.length ? points[points.length - 1].clone() : null
            };
        }

        function trimPreviewStart(points, hiddenDistance) {
            var distToHide = Math.max(0, Number(hiddenDistance || 0));
            if (!Array.isArray(points) || points.length < 2 || distToHide <= 0.0001) {
                return Array.isArray(points) ? points.slice() : [];
            }

            var remaining = distToHide;
            var out = null;

            for (var i = 1; i < points.length; i++) {
                var prev = points[i - 1];
                var curr = points[i];
                var segLen = prev.distanceTo(curr);
                if (segLen <= 0.0001) continue;
                if (remaining >= segLen) {
                    remaining -= segLen;
                    continue;
                }
                var t = remaining > 0 ? (remaining / segLen) : 0;
                var start = prev.clone().lerp(curr, t);
                out = [start];
                for (var j = i; j < points.length; j++) {
                    out.push(points[j].clone());
                }
                break;
            }

            if (!out || out.length < 2) {
                return points.slice(-2);
            }
            return out;
        }

        function updateTrajectoryPreview(type, intent) {
            var currentDefs = defs();
            if (!currentDefs[type] || !intent) {
                clearTrajectoryPreview();
                return null;
            }
            if (!ensureTrajectoryPreviewMeshes()) return null;

            var sim = simulateTrajectory(type, intent);
            if (!sim || !sim.points || sim.points.length < 2) {
                clearTrajectoryPreview();
                return null;
            }

            var visiblePoints = trimPreviewStart(sim.points, trajectoryPreviewTuning.hiddenStartDistance || 0);
            if (!visiblePoints || visiblePoints.length < 2) {
                clearTrajectoryPreview();
                return null;
            }

            var splitPoints = splitPreviewPoints(visiblePoints);
            var nearPoints = sparsePreviewPoints(splitPoints.near, trajectoryPreviewTuning.pointStrideNear || 4);
            var farPoints = sparsePreviewPoints(splitPoints.far, trajectoryPreviewTuning.pointStrideFar || 6);
            var previewColors = previewColorsForType(type);
            if (trajectoryPreview.dotsNear.material && trajectoryPreview.dotsNear.material.color) {
                trajectoryPreview.dotsNear.material.color.setHex(previewColors.lineNear);
            }
            if (trajectoryPreview.dotsFar.material && trajectoryPreview.dotsFar.material.color) {
                trajectoryPreview.dotsFar.material.color.setHex(previewColors.lineFar);
            }
            trajectoryPreview.dotsNear.geometry.setFromPoints(nearPoints.length >= 2 ? nearPoints : visiblePoints.slice(0, 2));
            trajectoryPreview.dotsNear.geometry.computeBoundingSphere();
            trajectoryPreview.dotsNear.visible = true;
            trajectoryPreview.dotsFar.geometry.setFromPoints(farPoints.length >= 2 ? farPoints : visiblePoints.slice(-2));
            trajectoryPreview.dotsFar.geometry.computeBoundingSphere();
            trajectoryPreview.dotsFar.visible = true;
            trajectoryPreview.activeType = type;

            if (sim.impactPoint) {
                if (trajectoryPreview.impact.material && trajectoryPreview.impact.material.color) {
                    trajectoryPreview.impact.material.color.setHex(previewColors.impact);
                }
                trajectoryPreview.impact.position.copy(sim.impactPoint);
                trajectoryPreview.impact.visible = true;
            } else {
                trajectoryPreview.impact.visible = false;
            }
            updateTrajectoryAreaPreview(type, sim, previewColors);

            return {
                type: type,
                points: sim.points.length,
                impactPoint: sim.impactPoint ? {
                    x: sim.impactPoint.x,
                    y: sim.impactPoint.y,
                    z: sim.impactPoint.z
                } : null
            };
        }

        function getPlasmaDebugState(camera) {
            var currentDefs = defs();
            var def = currentDefs.plasma;
            var tuning = distanceTuning();
            if (!camera || !def) return null;
            var intent = buildThrowIntent(camera);
            if (!intent) return null;
            var sim = simulateTrajectory('plasma', intent);
            var referencePoint = sim && sim.impactPoint
                ? sim.impactPoint
                : (intent.aimPoint || null);
            return {
                catchRadius: Math.max(0, Number(def.catchRadius || tuning.plasmaCatchRadius || 0)),
                stickDelaySec: Math.max(0.2, Number(def.stickExplodeDelay != null ? def.stickExplodeDelay : def.fuse || 0)),
                maxLifeSec: Math.max(0.2, Number(plasmaMaxLife(def) || 0)),
                blastRadius: Math.max(0, Number(def.radius || tuning.plasmaRadius || 0)),
                referenceDistance: referencePoint
                    ? Math.max(0.1, referencePoint.distanceTo(camera.position))
                    : Math.max(0.1, Number(tuning.plasmaAcquireRange || 18))
            };
        }

        function getTrajectoryPreviewTuning() {
            return {
                stepSec: trajectoryPreviewTuning.stepSec,
                maxPoints: trajectoryPreviewTuning.maxPoints,
                maxPreviewTime: trajectoryPreviewTuning.maxPreviewTime
            };
        }

        function setDebugPreviewVolumesEnabled(enabled) {
            debugPreviewVolumesEnabled = !!enabled;
            if (!debugPreviewVolumesEnabled) clearTrajectoryPreview();
        }

        function reset() {
            if (trajectoryPreview.dotsNear && trajectoryPreview.dotsNear.parent) {
                trajectoryPreview.dotsNear.parent.remove(trajectoryPreview.dotsNear);
            }
            if (trajectoryPreview.dotsFar && trajectoryPreview.dotsFar.parent) {
                trajectoryPreview.dotsFar.parent.remove(trajectoryPreview.dotsFar);
            }
            if (trajectoryPreview.impact && trajectoryPreview.impact.parent) {
                trajectoryPreview.impact.parent.remove(trajectoryPreview.impact);
            }
            if (trajectoryPreview.areaSphere && trajectoryPreview.areaSphere.parent) {
                trajectoryPreview.areaSphere.parent.remove(trajectoryPreview.areaSphere);
            }
            if (trajectoryPreview.areaDisk && trajectoryPreview.areaDisk.parent) {
                trajectoryPreview.areaDisk.parent.remove(trajectoryPreview.areaDisk);
            }
            trajectoryPreview.dotsNear = null;
            trajectoryPreview.dotsFar = null;
            trajectoryPreview.impact = null;
            trajectoryPreview.areaSphere = null;
            trajectoryPreview.areaDisk = null;
            trajectoryPreview.activeType = '';
        }

        return {
            buildThrowIntent: buildThrowIntent,
            buildThrowVelocity: buildThrowVelocity,
            clearTrajectoryPreview: clearTrajectoryPreview,
            getPlasmaDebugState: getPlasmaDebugState,
            getTrajectoryPreviewTuning: getTrajectoryPreviewTuning,
            reset: reset,
            setDebugPreviewVolumesEnabled: setDebugPreviewVolumesEnabled,
            updateTrajectoryPreview: updateTrajectoryPreview
        };
    }

    globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    globalThis.__MAYHEM_RUNTIME.GameThrowablesTrajectory = {
        create: create
    };
})();
