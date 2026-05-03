/**
 * throwables-fire-zones.js - Molotov fire-zone visuals and lingering burn logic.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameThrowablesFireZones
 */
(function () {
    'use strict';

    function create(opts) {
        opts = opts || {};

        var fireZones = [];
        var burningEnemyStates = new Map();
        var fireAudioPulseTimer = 0;

        function defs() {
            return opts.getDefs ? opts.getDefs() : {};
        }

        function scene() {
            return opts.getScene ? opts.getScene() : null;
        }

        function reportHit(onEnemyHit, hitPoint, damage, hitType, result, source, special) {
            if (opts.reportHit) {
                opts.reportHit(onEnemyHit, hitPoint, damage, hitType, result, source, special);
                return;
            }
            if (!onEnemyHit || !result) return;
            var targetId = '';
            if (result.enemy && Number.isFinite(Number(result.enemy.index))) {
                targetId = 'enemy:' + String(result.enemy.index);
            }
            onEnemyHit({
                hitPoint: hitPoint.clone(),
                damage: damage,
                hitType: hitType,
                result: result,
                targetId: targetId,
                source: source,
                special: special || null
            });
        }

        function molotovInnerRadius(def) {
            var radius = Math.max(0.2, Number(def && def.fireRadius || 0));
            var inner = Number(def && def.fireInnerRadius);
            if (!isFinite(inner) || inner <= 0) inner = radius * 0.55;
            return Math.max(0.2, Math.min(radius, inner));
        }

        function molotovOuterDamageScale(def) {
            var scale = Number(def && def.fireOuterDamageScale);
            if (!isFinite(scale)) scale = 0.38;
            return Math.max(0.1, Math.min(1, scale));
        }

        function molotovMaxHeightDelta(def) {
            var value = Number(def && def.fireMaxHeightDelta);
            if (!isFinite(value)) value = 1.5;
            return Math.max(0.1, value);
        }

        function molotovDamageScale(def, dist, radius) {
            var maxRadius = Math.max(0.2, Number(radius || (def && def.fireRadius) || 0));
            var innerRadius = molotovInnerRadius(def);
            var edgeScale = molotovOuterDamageScale(def);
            var distance = Math.max(0, Number(dist || 0));
            if (distance <= innerRadius) return 1;
            var outerSpan = Math.max(0.001, maxRadius - innerRadius);
            var t = Math.max(0, Math.min(1, (distance - innerRadius) / outerSpan));
            return 1 - ((1 - edgeScale) * t);
        }

        function molotovLingerDurationSec(def) {
            var value = Number(def && def.fireLingerDuration);
            if (!isFinite(value)) value = 0.9;
            return Math.max(0, value);
        }

        function molotovLingerTickDamage(def) {
            var value = Number(def && def.fireLingerTickDamage);
            if (!isFinite(value)) value = Math.max(1, Math.round(Number(def && def.fireTickDamage || 18) * 0.45));
            return Math.max(1, Math.round(value));
        }

        function molotovLingerTickRateSec(def) {
            var value = Number(def && def.fireLingerTickRate);
            if (!isFinite(value)) value = 0.4;
            return Math.max(0.1, value);
        }

        function buildFireZoneMesh(radius) {
            var root = new THREE.Group();
            var scorch = new THREE.Mesh(
                new THREE.CylinderGeometry(radius * 1.02, radius * 1.02, 0.025, 28),
                new THREE.MeshBasicMaterial({
                    color: 0x201812,
                    transparent: true,
                    opacity: 0.32,
                    depthWrite: false
                })
            );
            scorch.position.y = -0.02;
            root.add(scorch);

            var disk = new THREE.Mesh(
                new THREE.CylinderGeometry(radius, radius, 0.08, 16),
                new THREE.MeshBasicMaterial({
                    color: 0xff7733,
                    transparent: true,
                    opacity: 0.36,
                    depthWrite: false
                })
            );
            root.add(disk);
            var innerDisk = new THREE.Mesh(
                new THREE.CylinderGeometry(Math.max(0.35, radius * 0.58), Math.max(0.35, radius * 0.58), 0.06, 14),
                new THREE.MeshBasicMaterial({
                    color: 0xffb347,
                    transparent: true,
                    opacity: 0.28,
                    depthWrite: false
                })
            );
            innerDisk.position.y = 0.03;
            root.add(innerDisk);
            var ring = new THREE.Mesh(
                new THREE.TorusGeometry(Math.max(0.24, radius * 0.72), 0.03, 6, 28),
                new THREE.MeshBasicMaterial({
                    color: 0xffaa55,
                    transparent: true,
                    opacity: 0.24,
                    depthWrite: false
                })
            );
            ring.rotation.x = Math.PI * 0.5;
            ring.position.y = 0.06;
            root.add(ring);
            var ringOuter = new THREE.Mesh(
                new THREE.TorusGeometry(Math.max(0.38, radius * 0.92), 0.02, 5, 30),
                new THREE.MeshBasicMaterial({
                    color: 0xff6d2d,
                    transparent: true,
                    opacity: 0.12,
                    depthWrite: false
                })
            );
            ringOuter.rotation.x = Math.PI * 0.5;
            ringOuter.position.y = 0.04;
            root.add(ringOuter);

            var flameJets = [];
            var jetHot = new THREE.MeshBasicMaterial({
                color: 0xffc45d,
                transparent: true,
                opacity: 0.72,
                depthWrite: false
            });
            var jetWarm = new THREE.MeshBasicMaterial({
                color: 0xff6d2d,
                transparent: true,
                opacity: 0.62,
                depthWrite: false
            });
            for (var jetIndex = 0; jetIndex < 8; jetIndex++) {
                var angle = (jetIndex / 8) * Math.PI * 2;
                var jetRadius = radius * (0.22 + ((jetIndex % 3) * 0.16));
                var jet = new THREE.Mesh(
                    new THREE.ConeGeometry(0.11 + ((jetIndex % 2) * 0.04), 0.55 + ((jetIndex % 3) * 0.12), 6),
                    (jetIndex % 2) ? jetWarm.clone() : jetHot.clone()
                );
                jet.position.set(Math.cos(angle) * jetRadius, 0.28, Math.sin(angle) * jetRadius);
                jet.rotation.z = (Math.sin(angle) * 0.18);
                jet.rotation.x = (Math.cos(angle) * -0.18);
                jet.userData.baseAngle = angle;
                jet.userData.baseRadius = jetRadius;
                jet.userData.baseHeight = 0.55 + ((jetIndex % 3) * 0.12);
                root.add(jet);
                flameJets.push(jet);
            }

            var assetFactory = globalThis.__MAYHEM_RUNTIME.GameAssetFactory || null;
            var flame = null;
            var flameA = null;
            var flameB = null;
            var smoke = null;
            if (assetFactory && assetFactory.createParticleAsset) {
                flame = assetFactory.createParticleAsset('fire', { color: 0xff8833 });
                if (flame) {
                    flame.position.y = 0.18;
                    flame.scale.set(Math.max(0.85, radius * 0.26), Math.max(0.85, radius * 0.34), Math.max(0.85, radius * 0.26));
                    root.add(flame);
                }
                flameA = assetFactory.createParticleAsset('fire', { color: 0xff6d2d });
                if (flameA) {
                    flameA.position.set(radius * 0.24, 0.12, -radius * 0.18);
                    flameA.scale.set(Math.max(0.5, radius * 0.16), Math.max(0.65, radius * 0.2), Math.max(0.5, radius * 0.16));
                    root.add(flameA);
                }
                flameB = assetFactory.createParticleAsset('fire', { color: 0xffc45d });
                if (flameB) {
                    flameB.position.set(-radius * 0.2, 0.1, radius * 0.2);
                    flameB.scale.set(Math.max(0.42, radius * 0.14), Math.max(0.56, radius * 0.18), Math.max(0.42, radius * 0.14));
                    root.add(flameB);
                }
                smoke = assetFactory.createParticleAsset('smoke', { color: 0x3a3a3a });
                if (smoke) {
                    smoke.position.y = 0.65;
                    smoke.scale.set(Math.max(0.72, radius * 0.22), Math.max(0.92, radius * 0.28), Math.max(0.72, radius * 0.22));
                    root.add(smoke);
                }
            }

            root.userData.zoneParts = {
                scorch: scorch,
                disk: disk,
                innerDisk: innerDisk,
                ring: ring,
                ringOuter: ringOuter,
                flameJets: flameJets,
                flame: flame,
                flameA: flameA,
                flameB: flameB,
                smoke: smoke
            };
            return root;
        }

        function createFireZone(position) {
            var sceneRef = scene();
            if (!sceneRef || !position) return;
            var def = defs().molotov || {};

            var fireMesh = buildFireZoneMesh(def.fireRadius);
            var groundY = Number(position.y || 0);
            fireMesh.position.set(position.x, groundY + 0.04, position.z);
            sceneRef.add(fireMesh);

            fireZones.push({
                mesh: fireMesh,
                center: new THREE.Vector3(position.x, groundY, position.z),
                radius: def.fireRadius,
                innerRadius: molotovInnerRadius(def),
                life: def.fireDuration,
                maxLife: def.fireDuration,
                tickTimer: 0
            });

            if (globalThis.__MAYHEM_RUNTIME.GameAudio && globalThis.__MAYHEM_RUNTIME.GameAudio.play) {
                globalThis.__MAYHEM_RUNTIME.GameAudio.play('molotov_ignite', {
                    throwable: 'molotov',
                    projectileType: 'molotov'
                });
                globalThis.__MAYHEM_RUNTIME.GameAudio.play('fireBurning');
            }
            fireAudioPulseTimer = 0.9;
            if (opts.spawnExplosionBurst) {
                opts.spawnExplosionBurst(
                    position,
                    opts.effectPaletteForProjectileType ? opts.effectPaletteForProjectileType('molotov').explosion : 0xff6622,
                    def.fireRadius || 3.2
                );
            }
        }

        function disposeZoneMesh(mesh) {
            if (!mesh) return;
            if (mesh.parent) mesh.parent.remove(mesh);
            if (typeof mesh.traverse !== 'function') return;
            mesh.traverse(function (node) {
                if (node && node.geometry && typeof node.geometry.dispose === 'function') {
                    node.geometry.dispose();
                }
                var materials = node && node.material
                    ? (Array.isArray(node.material) ? node.material : [node.material])
                    : [];
                for (var i = 0; i < materials.length; i++) {
                    if (materials[i] && typeof materials[i].dispose === 'function') {
                        materials[i].dispose();
                    }
                }
            });
        }

        function updateFireZoneVisual(zone, now, lifeRatio) {
            if (!zone || !zone.mesh || !zone.mesh.userData || !zone.mesh.userData.zoneParts) return;
            var parts = zone.mesh.userData.zoneParts;
            var stamp = Number(now || 0);
            var pulse = 0.88 + (Math.sin((stamp * 0.008) + zone.radius) * 0.12);
            var lifeBlend = Math.max(0.25, Math.min(1, Number(lifeRatio || 1)));
            if (parts.disk && parts.disk.material) {
                parts.disk.material.opacity = 0.14 + (lifeBlend * 0.2);
                parts.disk.scale.set(0.96 + (pulse * 0.06), 1, 0.96 + (pulse * 0.06));
            }
            if (parts.scorch && parts.scorch.material) {
                parts.scorch.material.opacity = 0.18 + (lifeBlend * 0.18);
                parts.scorch.scale.set(0.98 + (pulse * 0.04), 1, 0.98 + (pulse * 0.04));
            }
            if (parts.innerDisk && parts.innerDisk.material) {
                parts.innerDisk.material.opacity = 0.16 + (lifeBlend * 0.18);
                parts.innerDisk.scale.set(0.94 + (pulse * 0.08), 1, 0.94 + (pulse * 0.08));
            }
            if (parts.ring && parts.ring.material) {
                parts.ring.material.opacity = 0.1 + (lifeBlend * 0.2);
                parts.ring.scale.set(0.9 + (pulse * 0.16), 0.9 + (pulse * 0.16), 1);
                parts.ring.rotation.z = Math.sin(stamp * 0.0018) * 0.18;
            }
            if (parts.ringOuter && parts.ringOuter.material) {
                parts.ringOuter.material.opacity = 0.06 + (lifeBlend * 0.1);
                parts.ringOuter.scale.set(0.94 + (pulse * 0.22), 0.94 + (pulse * 0.22), 1);
                parts.ringOuter.rotation.z = Math.cos(stamp * 0.0013) * -0.22;
            }
            if (parts.flameJets && parts.flameJets.length) {
                for (var i = 0; i < parts.flameJets.length; i++) {
                    var jet = parts.flameJets[i];
                    if (!jet) continue;
                    var jetPulse = 0.82 + (Math.sin((stamp * 0.007) + i) * 0.22);
                    var angle = Number(jet.userData.baseAngle || 0) + (Math.sin((stamp * 0.0014) + i) * 0.08);
                    var baseRadius = Number(jet.userData.baseRadius || zone.radius * 0.3);
                    jet.position.set(
                        Math.cos(angle) * baseRadius,
                        0.22 + (jetPulse * 0.08),
                        Math.sin(angle) * baseRadius
                    );
                    jet.scale.set(0.82 + (jetPulse * 0.16), Math.max(0.36, lifeBlend) * (0.9 + jetPulse * 0.28), 0.82 + (jetPulse * 0.16));
                    jet.rotation.y = angle;
                    if (jet.material) jet.material.opacity = (0.36 + (lifeBlend * 0.36)) * jetPulse;
                }
            }
            if (parts.flame) {
                parts.flame.scale.set(
                    Math.max(0.9, zone.radius * (0.24 + (pulse * 0.05))),
                    Math.max(1.0, zone.radius * (0.34 + (pulse * 0.1))),
                    Math.max(0.9, zone.radius * (0.24 + (pulse * 0.05)))
                );
            }
            if (parts.flameA) {
                parts.flameA.position.set(
                    zone.radius * (0.2 + Math.sin(stamp * 0.0022) * 0.05),
                    0.12 + (Math.sin(stamp * 0.006) * 0.03),
                    -zone.radius * (0.16 + Math.cos(stamp * 0.0018) * 0.04)
                );
                parts.flameA.scale.set(
                    Math.max(0.45, zone.radius * (0.15 + pulse * 0.03)),
                    Math.max(0.56, zone.radius * (0.19 + pulse * 0.04)),
                    Math.max(0.45, zone.radius * (0.15 + pulse * 0.03))
                );
            }
            if (parts.flameB) {
                parts.flameB.position.set(
                    -zone.radius * (0.18 + Math.cos(stamp * 0.0024) * 0.05),
                    0.11 + (Math.cos(stamp * 0.0052) * 0.025),
                    zone.radius * (0.18 + Math.sin(stamp * 0.0019) * 0.04)
                );
                parts.flameB.scale.set(
                    Math.max(0.4, zone.radius * (0.13 + pulse * 0.025)),
                    Math.max(0.5, zone.radius * (0.16 + pulse * 0.035)),
                    Math.max(0.4, zone.radius * (0.13 + pulse * 0.025))
                );
            }
            if (parts.smoke) {
                parts.smoke.position.y = 0.62 + (Math.sin(stamp * 0.0024) * 0.06);
                parts.smoke.scale.set(
                    Math.max(0.7, zone.radius * (0.2 + pulse * 0.03)),
                    Math.max(0.92, zone.radius * (0.28 + pulse * 0.04)),
                    Math.max(0.7, zone.radius * (0.2 + pulse * 0.03))
                );
            }
        }

        function refreshBurningEnemy(enemy, now, def) {
            if (!enemy) return;
            var state = burningEnemyStates.get(enemy) || {
                until: 0,
                nextTickAt: 0
            };
            state.until = Math.max(state.until || 0, now + Math.round(molotovLingerDurationSec(def) * 1000));
            if (!state.nextTickAt || state.nextTickAt < now) {
                state.nextTickAt = now + Math.round(molotovLingerTickRateSec(def) * 1000);
            }
            burningEnemyStates.set(enemy, state);
        }

        function tickLingeringBurns(now, heatedEnemies, onEnemyHit) {
            var def = defs().molotov || {};
            var lingerRateMs = Math.max(100, Math.round(molotovLingerTickRateSec(def) * 1000));
            var lingerDamage = molotovLingerTickDamage(def);
            burningEnemyStates.forEach(function (state, enemy) {
                if (!enemy || !enemy.alive || !state) {
                    burningEnemyStates.delete(enemy);
                    return;
                }
                if ((state.until || 0) <= now) {
                    burningEnemyStates.delete(enemy);
                    return;
                }
                if (heatedEnemies.has(enemy)) return;
                if ((state.nextTickAt || 0) > now) return;
                state.nextTickAt = now + lingerRateMs;
                var hitbox = enemy.bodyHitbox || null;
                if (!hitbox) return;
                var runtime = globalThis.__MAYHEM_RUNTIME || {};
                var enemyApi = runtime.GameEnemy || null;
                var result = enemyApi && enemyApi.damage ? enemyApi.damage(hitbox, lingerDamage) : null;
                reportHit(
                    onEnemyHit,
                    hitbox.position,
                    lingerDamage,
                    'body',
                    result,
                    'molotov',
                    { burnLinger: true }
                );
            });
        }

        function update(dt, onEnemyHit) {
            var now = Date.now();
            var def = defs().molotov || {};
            var runtime = globalThis.__MAYHEM_RUNTIME || {};
            var enemyApi = runtime.GameEnemy || null;
            var enemies = enemyApi && enemyApi.getEnemies ? enemyApi.getEnemies() : [];
            var heatedEnemies = new Set();

            for (var i = fireZones.length - 1; i >= 0; i--) {
                var z = fireZones[i];
                z.life -= dt;
                z.tickTimer -= dt;
                updateFireZoneVisual(z, now, z.maxLife > 0 ? (z.life / z.maxLife) : 1);

                for (var scan = 0; scan < enemies.length; scan++) {
                    var scanEnemy = enemies[scan];
                    if (!scanEnemy || !scanEnemy.alive || !scanEnemy.group || !scanEnemy.bodyHitbox) continue;
                    var heightDelta = Math.abs(Number(scanEnemy.bodyHitbox.position.y || 0) - Number(z.center.y || 0));
                    if (heightDelta > molotovMaxHeightDelta(def)) continue;
                    var scanDx = scanEnemy.group.position.x - z.center.x;
                    var scanDz = scanEnemy.group.position.z - z.center.z;
                    var scanDist = Math.sqrt((scanDx * scanDx) + (scanDz * scanDz));
                    if (scanDist > z.radius) continue;
                    heatedEnemies.add(scanEnemy);
                }

                if (z.tickTimer <= 0) {
                    z.tickTimer += Math.max(0.1, Number(def.fireTickRate || 0.35));
                    for (var j = 0; j < enemies.length; j++) {
                        var enemy = enemies[j];
                        if (!enemy || !enemy.alive || !enemy.group || !enemy.bodyHitbox) continue;

                        var dx = enemy.group.position.x - z.center.x;
                        var dz = enemy.group.position.z - z.center.z;
                        var d = Math.sqrt((dx * dx) + (dz * dz));
                        if (d > z.radius) continue;
                        var verticalDelta = Math.abs(Number(enemy.bodyHitbox.position.y || 0) - Number(z.center.y || 0));
                        if (verticalDelta > molotovMaxHeightDelta(def)) continue;

                        var dmg = Math.max(2, Math.round(Number(def.fireTickDamage || 18) * molotovDamageScale(def, d, z.radius)));
                        var result = enemyApi && enemyApi.damage ? enemyApi.damage(enemy.bodyHitbox, dmg) : null;
                        reportHit(
                            onEnemyHit,
                            enemy.bodyHitbox.position,
                            dmg,
                            'body',
                            result,
                            'molotov'
                        );
                        refreshBurningEnemy(enemy, now, def);
                    }
                }

                if (z.life <= 0) {
                    disposeZoneMesh(z.mesh);
                    fireZones.splice(i, 1);
                }
            }

            tickLingeringBurns(now, heatedEnemies, onEnemyHit);

            if (fireZones.length > 0) {
                fireAudioPulseTimer -= dt;
                if (fireAudioPulseTimer <= 0 && globalThis.__MAYHEM_RUNTIME.GameAudio && globalThis.__MAYHEM_RUNTIME.GameAudio.play) {
                    globalThis.__MAYHEM_RUNTIME.GameAudio.play('fireBurning');
                    fireAudioPulseTimer = 1.1;
                }
            } else {
                fireAudioPulseTimer = 0;
            }
        }

        function reset() {
            for (var i = fireZones.length - 1; i >= 0; i--) {
                var zone = fireZones[i];
                disposeZoneMesh(zone && zone.mesh);
            }
            fireZones = [];
            burningEnemyStates = new Map();
            fireAudioPulseTimer = 0;
        }

        return {
            buildFireZoneMesh: buildFireZoneMesh,
            createFireZone: createFireZone,
            updateFireZoneVisual: updateFireZoneVisual,
            update: update,
            reset: reset
        };
    }

    globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    globalThis.__MAYHEM_RUNTIME.GameThrowablesFireZones = {
        create: create
    };
})();
