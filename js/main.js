/**
 * main.js - Game orchestration for single-player and Cloudflare multiplayer modes
 */
(function () {
    'use strict';

    var renderer, scene, clock, camera;
    var overlay;

    var isPlaying = false;
    var triggerHeld = false;

    var playerHP = 500;
    var playerMaxHP = 500;
    var playerArmor = 90;
    var playerArmorMax = 90;
    var armorRegenDelay = 0;

    var respawnInvulnTimer = 0;
    var debugTimer = null;

    var wallhackRing = null;
    var wallhackRingRadius = 0;
    var wallhackRingVisible = true;

    var DEFAULT_ENEMY_COUNT = 5;
    var DEFAULT_ARMOR_REGEN_DELAY = 6.0;
    var ARMOR_REGEN_PER_SEC = 12;
    var MAX_PIXEL_RATIO = 1.75;

    var currentAimTargetId = '';
    var multiplayerMode = false;
    var forceGuestNetMode = false;
    var forcedRoomId = 'global';
    var startupDebugNotice = '';
    var autoStartNoLock = false;
    var armedThrowableType = '';
    var lastPlasmaActive = false;
    var netShotCounter = 0;
    var awarenessTuning = (globalThis.__MAYHEM_RUNTIME.GameCombatTuning && globalThis.__MAYHEM_RUNTIME.GameCombatTuning.getAwarenessTuning)
        ? globalThis.__MAYHEM_RUNTIME.GameCombatTuning.getAwarenessTuning()
        : {
            segments: 8,
            radarRange: 35,
            coreRange: 10,
            beaconMinRange: 35,
            beaconMaxCount: 2
        };
    var AWARENESS_SEGMENTS = awarenessTuning.segments;
    var AWARENESS_RADAR_RANGE = awarenessTuning.radarRange;
    var AWARENESS_CORE_RANGE = awarenessTuning.coreRange;
    var AWARENESS_BEACON_MIN_RANGE = awarenessTuning.beaconMinRange;
    var AWARENESS_BEACON_MAX_COUNT = awarenessTuning.beaconMaxCount;

    function depGet(name) {
        return globalThis.__MAYHEM_RUNTIME[name];
    }

    function depRequire(name) {
        return globalThis.__MAYHEM_RUNTIME[name];
    }

    function cappedPixelRatio() {
        return Math.min(MAX_PIXEL_RATIO, Math.max(1, Number(window.devicePixelRatio) || 1));
    }

    function normalizeSectorIndex(idx, segCount) {
        return ((idx % segCount) + segCount) % segCount;
    }

    function collectAwarenessTargets() {
        var out = [];
        var seen = {};
        function appendTargets(list) {
            if (!list || !list.length) return;
            for (var i = 0; i < list.length; i++) {
                var t = list[i];
                if (!t || t.alive === false || !t.worldPos) continue;
                var key = (t.targetId || '') + '|' + Number(t.worldPos.x).toFixed(2) + '|' + Number(t.worldPos.z).toFixed(2);
                if (seen[key]) continue;
                seen[key] = true;
                out.push({
                    targetId: t.targetId || '',
                    worldPos: t.worldPos.clone ? t.worldPos.clone() : t.worldPos
                });
            }
        }
        if (globalThis.__MAYHEM_RUNTIME.GameEnemy && globalThis.__MAYHEM_RUNTIME.GameEnemy.getLockTargets) {
            appendTargets(globalThis.__MAYHEM_RUNTIME.GameEnemy.getLockTargets() || []);
        }
        if (globalThis.__MAYHEM_RUNTIME.GameNet && globalThis.__MAYHEM_RUNTIME.GameNet.getLockTargets) {
            appendTargets(globalThis.__MAYHEM_RUNTIME.GameNet.getLockTargets() || []);
        }
        return out;
    }

    function buildAwarenessState(playerPos, playerYaw) {
        var segments = new Array(AWARENESS_SEGMENTS);
        for (var i = 0; i < AWARENESS_SEGMENTS; i++) segments[i] = 0;
        var coreIntensity = 0;
        var targets = collectAwarenessTargets();
        var buckets = {};
        var sectorStep = (Math.PI * 2) / AWARENESS_SEGMENTS;
        var forwardX = -Math.sin(playerYaw || 0);
        var forwardZ = -Math.cos(playerYaw || 0);
        var rightX = Math.cos(playerYaw || 0);
        var rightZ = -Math.sin(playerYaw || 0);

        for (var n = 0; n < targets.length; n++) {
            var p = targets[n].worldPos;
            var dx = p.x - playerPos.x;
            var dz = p.z - playerPos.z;
            var dist = Math.sqrt(dx * dx + dz * dz);
            if (dist <= 0.001) continue;
            var nx = dx / dist;
            var nz = dz / dist;
            var frontDot = nx * forwardX + nz * forwardZ;
            var rightDot = nx * rightX + nz * rightZ;
            var angle = Math.atan2(rightDot, frontDot);
            var sector = normalizeSectorIndex(Math.round(angle / sectorStep), AWARENESS_SEGMENTS);
            var nearIntensity = Math.max(0, 1 - (dist / AWARENESS_RADAR_RANGE));
            segments[sector] = Math.max(segments[sector], nearIntensity);
            if (dist <= AWARENESS_CORE_RANGE) {
                coreIntensity = Math.max(coreIntensity, Math.max(0, 1 - (dist / AWARENESS_CORE_RANGE)));
            }

            if (dist > AWARENESS_BEACON_MIN_RANGE) {
                var key = String(sector);
                if (!buckets[key]) {
                    buckets[key] = {
                        sector: sector,
                        angleRad: sector * sectorStep,
                        count: 0,
                        minDist: Infinity
                    };
                }
                buckets[key].count++;
                if (dist < buckets[key].minDist) buckets[key].minDist = dist;
            }
        }

        var beacons = [];
        for (var k in buckets) {
            if (!Object.prototype.hasOwnProperty.call(buckets, k)) continue;
            var b = buckets[k];
            var score = b.count * 2 + (1 / (1 + b.minDist * 0.04));
            beacons.push({
                angleRad: b.angleRad,
                intensity: Math.max(0.3, Math.min(1, 0.35 + b.count * 0.18)),
                score: score
            });
        }
        beacons.sort(function (a, b) { return b.score - a.score; });
        if (beacons.length > AWARENESS_BEACON_MAX_COUNT) {
            beacons = beacons.slice(0, AWARENESS_BEACON_MAX_COUNT);
        }

        return {
            segments: segments,
            coreIntensity: coreIntensity,
            beacons: beacons
        };
    }

    function applyBrandingOverrides() {
        document.title = 'Mayhem';
        var overlayTitle = document.querySelector('#overlay h1');
        if (overlayTitle) overlayTitle.textContent = 'MAYHEM';
        var docsTitle = document.getElementById('docs-title');
        if (docsTitle && /minecraft fps/i.test(docsTitle.textContent || '')) {
            docsTitle.textContent = String(docsTitle.textContent).replace(/minecraft fps/ig, 'MAYHEM');
        }
    }

    function setTransientDebug(text, ms) {
        globalThis.__MAYHEM_RUNTIME.GameUI.setDebugInfo(text || '');
        if (debugTimer) clearTimeout(debugTimer);
        if (!text) {
            debugTimer = null;
            return;
        }
        debugTimer = setTimeout(function () {
            globalThis.__MAYHEM_RUNTIME.GameUI.setDebugInfo('');
            debugTimer = null;
        }, ms || 1000);
    }

    function hasInputCapture() {
        return !!renderer && document.pointerLockElement === renderer.domElement;
    }

    function getCurrentWallhackRadius() {
        if (multiplayerMode && globalThis.__MAYHEM_RUNTIME.GameNet && globalThis.__MAYHEM_RUNTIME.GameNet.getSelfState) {
            var selfState = globalThis.__MAYHEM_RUNTIME.GameNet.getSelfState();
            if (selfState && typeof selfState.wallhackRadius === 'number') {
                return selfState.wallhackRadius;
            }
        }

        if (globalThis.__MAYHEM_RUNTIME.GameAbilities && globalThis.__MAYHEM_RUNTIME.GameAbilities.getWallhackRadius) {
            return globalThis.__MAYHEM_RUNTIME.GameAbilities.getWallhackRadius();
        }

        if (globalThis.__MAYHEM_RUNTIME.GameEnemy && globalThis.__MAYHEM_RUNTIME.GameEnemy.getWallhackRadius) {
            return globalThis.__MAYHEM_RUNTIME.GameEnemy.getWallhackRadius();
        }

        if (globalThis.__MAYHEM_RUNTIME.GameCombatTuning && globalThis.__MAYHEM_RUNTIME.GameCombatTuning.getEnemyTuning) {
            return globalThis.__MAYHEM_RUNTIME.GameCombatTuning.getEnemyTuning().defaultWallhackRadius;
        }
        return 90;
    }

    function rebuildWallhackRing(radius) {
        if (!scene) return;

        if (wallhackRing && wallhackRing.parent) {
            wallhackRing.parent.remove(wallhackRing);
        }

        wallhackRingRadius = radius;
        var points = [];
        var segments = 96;

        for (var i = 0; i < segments; i++) {
            var a = (i / segments) * Math.PI * 2;
            points.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
        }

        var geo = new THREE.BufferGeometry().setFromPoints(points);
        var mat = new THREE.LineBasicMaterial({
            color: 0x65d8ff,
            transparent: true,
            opacity: 0.7,
            depthTest: false
        });

        wallhackRing = new THREE.LineLoop(geo, mat);
        wallhackRing.renderOrder = 30;
        wallhackRing.visible = wallhackRingVisible;
        scene.add(wallhackRing);
    }

    function syncWallhackRingRadius() {
        var radius = getCurrentWallhackRadius();
        if (!wallhackRing || Math.abs(radius - wallhackRingRadius) > 0.01) {
            rebuildWallhackRing(radius);
        }
    }

    function applyDebugVisuals(visible) {
        wallhackRingVisible = !!visible;
        if (wallhackRing) wallhackRing.visible = wallhackRingVisible;

        if (globalThis.__MAYHEM_RUNTIME.GameEnemy) {
            if (globalThis.__MAYHEM_RUNTIME.GameEnemy.setHitboxVisibility) {
                globalThis.__MAYHEM_RUNTIME.GameEnemy.setHitboxVisibility(!!visible);
            } else if (globalThis.__MAYHEM_RUNTIME.GameEnemy.isHitboxVisible && globalThis.__MAYHEM_RUNTIME.GameEnemy.toggleHitboxVisibility) {
                if (globalThis.__MAYHEM_RUNTIME.GameEnemy.isHitboxVisible() !== !!visible) {
                    globalThis.__MAYHEM_RUNTIME.GameEnemy.toggleHitboxVisibility();
                }
            }
        }

        if (globalThis.__MAYHEM_RUNTIME.GameNet && globalThis.__MAYHEM_RUNTIME.GameNet.setHitboxVisibility) {
            globalThis.__MAYHEM_RUNTIME.GameNet.setHitboxVisibility(!!visible);
        }

        if (globalThis.__MAYHEM_RUNTIME.GameAbilities && globalThis.__MAYHEM_RUNTIME.GameAbilities.setDebugMode) {
            globalThis.__MAYHEM_RUNTIME.GameAbilities.setDebugMode(!!visible);
        }
        if (globalThis.__MAYHEM_RUNTIME.GameThrowables && globalThis.__MAYHEM_RUNTIME.GameThrowables.setDebugMode) {
            globalThis.__MAYHEM_RUNTIME.GameThrowables.setDebugMode(!!visible);
        }
    }

    function syncReticleWithWeapon(weapon) {
        if (!weapon) return;
        globalThis.__MAYHEM_RUNTIME.GameUI.updateReticle(weapon, globalThis.__MAYHEM_RUNTIME.GameHitscan.getReticleSpec(weapon.id));
    }

    function applyArmorProfile(armorMax) {
        armorMax = Math.max(1, armorMax || 100);
        playerArmorMax = armorMax;
        if (playerArmor > playerArmorMax) playerArmor = playerArmorMax;
        if (playerArmor < 0) playerArmor = 0;
        globalThis.__MAYHEM_RUNTIME.GameUI.updateArmor(playerArmor, playerArmorMax);
    }

    function applyWeapon(weapon) {
        if (!weapon) return;
        globalThis.__MAYHEM_RUNTIME.GameUI.updateWeaponInfo(weapon);
        globalThis.__MAYHEM_RUNTIME.GamePlayer.setWeaponModel(weapon.id);
        syncReticleWithWeapon(weapon);
        if (multiplayerMode && globalThis.__MAYHEM_RUNTIME.GameNet && globalThis.__MAYHEM_RUNTIME.GameNet.sendEquipWeapon) {
            globalThis.__MAYHEM_RUNTIME.GameNet.sendEquipWeapon(weapon.id);
        }
        if (globalThis.__MAYHEM_RUNTIME.GameDocs && globalThis.__MAYHEM_RUNTIME.GameDocs.refresh) {
            globalThis.__MAYHEM_RUNTIME.GameDocs.refresh();
        }
        setTransientDebug('Weapon: ' + weapon.name, 950);
    }

    function applyAbilityProfile(profileId) {
        if (!globalThis.__MAYHEM_RUNTIME.GameAbilities) return null;
        var selected = globalThis.__MAYHEM_RUNTIME.GameAbilities.setClass(profileId);
        if (!selected) return null;

        if (selected.loadoutWeapon) {
            applyWeapon(globalThis.__MAYHEM_RUNTIME.GameHitscan.setWeapon(selected.loadoutWeapon));
        }

        applyArmorProfile(selected.armorMax || playerArmorMax);
        globalThis.__MAYHEM_RUNTIME.GameUI.updateAbilityInfo(globalThis.__MAYHEM_RUNTIME.GameAbilities.getHudState());
        syncWallhackRingRadius();
        if (globalThis.__MAYHEM_RUNTIME.GameDocs && globalThis.__MAYHEM_RUNTIME.GameDocs.refresh) {
            globalThis.__MAYHEM_RUNTIME.GameDocs.refresh();
        }

        return selected;
    }

    function handleEnemyHit(hitPoint, damage, hitType, result) {
        if (!result) return;
        if (globalThis.__MAYHEM_RUNTIME.GameAudio && globalThis.__MAYHEM_RUNTIME.GameAudio.play) {
            globalThis.__MAYHEM_RUNTIME.GameAudio.play('enemyHit', { killed: !!result.killed });
        }
        if (result.killed) {
            globalThis.__MAYHEM_RUNTIME.GameUI.showKillMarker();
            globalThis.__MAYHEM_RUNTIME.GameUI.addKill();
            globalThis.__MAYHEM_RUNTIME.GameUI.showDamageNumber(hitPoint, damage, true, camera, hitType);
        } else {
            globalThis.__MAYHEM_RUNTIME.GameUI.showHitMarker();
            globalThis.__MAYHEM_RUNTIME.GameUI.showDamageNumber(hitPoint, damage, false, camera, hitType);
        }
    }

    function handleNetworkDamageFeedback(feedback) {
        if (!feedback) return;

        if (globalThis.__MAYHEM_RUNTIME.GameAudio && globalThis.__MAYHEM_RUNTIME.GameAudio.play) {
            globalThis.__MAYHEM_RUNTIME.GameAudio.play('enemyHit', { killed: !!feedback.killed });
        }
        if (feedback.killed) {
            globalThis.__MAYHEM_RUNTIME.GameUI.showKillMarker();
            globalThis.__MAYHEM_RUNTIME.GameUI.addKill();
        } else {
            globalThis.__MAYHEM_RUNTIME.GameUI.showHitMarker();
        }

        if (feedback.worldPos && typeof feedback.damage === 'number' && feedback.damage > 0) {
            var wp = feedback.worldPos;
            globalThis.__MAYHEM_RUNTIME.GameUI.showDamageNumber(
                new THREE.Vector3(wp.x, wp.y, wp.z),
                feedback.damage,
                !!feedback.killed,
                camera,
                feedback.hitType || 'body'
            );
        }
    }

    function consumePlayerDamage(rawDamage, hitType, attackerEnemy) {
        if (respawnInvulnTimer > 0 || !isPlaying) return;

        var damage = Math.max(1, Math.round(rawDamage));
        if (globalThis.__MAYHEM_RUNTIME.GameAbilities && globalThis.__MAYHEM_RUNTIME.GameAbilities.modifyIncomingDamage) {
            damage = globalThis.__MAYHEM_RUNTIME.GameAbilities.modifyIncomingDamage(damage, hitType);
        }

        armorRegenDelay = DEFAULT_ARMOR_REGEN_DELAY;

        if (playerArmor > 0) {
            var absorbed = Math.min(playerArmor, damage);
            playerArmor -= absorbed;
            damage -= absorbed;
        }

        if (damage > 0) {
            playerHP -= damage;
            if (globalThis.__MAYHEM_RUNTIME.GameAudio && globalThis.__MAYHEM_RUNTIME.GameAudio.play) {
                globalThis.__MAYHEM_RUNTIME.GameAudio.play('playerHit');
            }
        }

        if (attackerEnemy && attackerEnemy.group && attackerEnemy.group.position) {
            var playerPos = globalThis.__MAYHEM_RUNTIME.GamePlayer.getPosition();
            var rot = globalThis.__MAYHEM_RUNTIME.GamePlayer.getRotation();
            globalThis.__MAYHEM_RUNTIME.GameUI.showDirectionalDamage(
                attackerEnemy.group.position,
                playerPos,
                rot && typeof rot.yaw === 'number' ? rot.yaw : 0,
                rawDamage
            );
        }

        if (playerHP <= 0) {
            respawnPlayer();
            return;
        }

        globalThis.__MAYHEM_RUNTIME.GameUI.updateHealth(playerHP, playerMaxHP);
        globalThis.__MAYHEM_RUNTIME.GameUI.updateArmor(playerArmor, playerArmorMax);
    }

    function respawnPlayer() {
        playerHP = playerMaxHP;
        if (!multiplayerMode) {
            playerArmor = playerArmorMax;
        }
        armorRegenDelay = 0;

        globalThis.__MAYHEM_RUNTIME.GameUI.updateHealth(playerHP, playerMaxHP);
        globalThis.__MAYHEM_RUNTIME.GameUI.updateArmor(playerArmor, playerArmorMax);

        if (!multiplayerMode) {
            globalThis.__MAYHEM_RUNTIME.GamePlayer.respawnRandom();
            respawnInvulnTimer = 1.0;
        }

        globalThis.__MAYHEM_RUNTIME.GameUI.updateDamageEffects(5);
        globalThis.__MAYHEM_RUNTIME.GameUI.updateAbilityInfo(globalThis.__MAYHEM_RUNTIME.GameAbilities.getHudState());
        syncWallhackRingRadius();
    }

    function tryPlayerFire() {
        var shotToken = '';
        if (multiplayerMode) {
            netShotCounter = (netShotCounter + 1) % 1000000;
            shotToken = 's' + Date.now().toString(36) + '-' + netShotCounter.toString(36);
        }
        var fired = globalThis.__MAYHEM_RUNTIME.GameHitscan.fire(
            camera,
            function (hitboxMesh, hitPoint, distance, hitType, damage, weapon) {
                if (globalThis.__MAYHEM_RUNTIME.GameAbilities && globalThis.__MAYHEM_RUNTIME.GameAbilities.modifyOutgoingDamage) {
                    damage = globalThis.__MAYHEM_RUNTIME.GameAbilities.modifyOutgoingDamage(damage, hitType, weapon ? weapon.id : '');
                }

                if (multiplayerMode && hitboxMesh && hitboxMesh.userData && hitboxMesh.userData.ownerType === 'net') {
                    if (globalThis.__MAYHEM_RUNTIME.GameNet && globalThis.__MAYHEM_RUNTIME.GameNet.sendFire) {
                        globalThis.__MAYHEM_RUNTIME.GameNet.sendFire(hitboxMesh, weapon ? weapon.id : 'rifle', hitType, shotToken);
                        globalThis.__MAYHEM_RUNTIME.GameUI.showHitMarker();
                    }
                    return;
                }

                if (!globalThis.__MAYHEM_RUNTIME.GameEnemy || !globalThis.__MAYHEM_RUNTIME.GameEnemy.damage) return;
                var result = globalThis.__MAYHEM_RUNTIME.GameEnemy.damage(hitboxMesh, damage);
                handleEnemyHit(hitPoint, damage, hitType, result);
            },
            function () {}
        );

        if (fired) {
            var activeWeapon = globalThis.__MAYHEM_RUNTIME.GameHitscan.getCurrentWeapon ? globalThis.__MAYHEM_RUNTIME.GameHitscan.getCurrentWeapon() : null;
            if (
                multiplayerMode &&
                activeWeapon &&
                (activeWeapon.id === 'seekergun' || activeWeapon.id === 'plasma') &&
                globalThis.__MAYHEM_RUNTIME.GameNet &&
                globalThis.__MAYHEM_RUNTIME.GameNet.sendSeekerShot
            ) {
                var seekerShotMeta = (globalThis.__MAYHEM_RUNTIME.GameThrowables && globalThis.__MAYHEM_RUNTIME.GameThrowables.consumeLastSeekerShotMeta)
                    ? globalThis.__MAYHEM_RUNTIME.GameThrowables.consumeLastSeekerShotMeta()
                    : null;
                if (seekerShotMeta) {
                    var netLockTargetId = '';
                    var seekerIntent = null;
                    var clientShotId = '';
                    if (seekerShotMeta.lockTargetId && String(seekerShotMeta.lockTargetId).indexOf('net:') === 0) {
                        netLockTargetId = String(seekerShotMeta.lockTargetId).slice(4);
                    }
                    seekerIntent = seekerShotMeta.throwIntent || null;
                    clientShotId = String(seekerShotMeta.clientShotId || '');
                    var seekerWeaponId = String(seekerShotMeta.weaponId || activeWeapon.id || 'seekergun');
                    globalThis.__MAYHEM_RUNTIME.GameNet.sendSeekerShot(netLockTargetId, seekerIntent, clientShotId, seekerWeaponId);
                }
            }

            globalThis.__MAYHEM_RUNTIME.GamePlayer.fireAnimation();
            if (globalThis.__MAYHEM_RUNTIME.GameAudio && globalThis.__MAYHEM_RUNTIME.GameAudio.play) {
                var w = globalThis.__MAYHEM_RUNTIME.GameHitscan.getCurrentWeapon();
                if (document.hasFocus()) {
                    globalThis.__MAYHEM_RUNTIME.GameAudio.play('fire', { weapon: w && w.id ? w.id : 'rifle' });
                }
            }
        }
    }

    function setupPointerLock() {
        overlay = document.getElementById('overlay');
        var playBtn = document.getElementById('play-btn');
        var modeButtonsWrap = document.getElementById('mode-buttons');
        var lastStartRequest = 0;

        function showResumeControl(show) {
            if (!playBtn) return;
            playBtn.style.display = show ? 'inline-block' : 'none';
        }

        function requestPlayStart(e) {
            var now = performance.now();
            if (now - lastStartRequest < 140) return;
            lastStartRequest = now;
            if (e) {
                if (typeof e.button === 'number' && e.button !== 0) return;
                e.preventDefault();
                e.stopPropagation();
            }
            if (globalThis.__MAYHEM_RUNTIME.GameAudio && globalThis.__MAYHEM_RUNTIME.GameAudio.unlock) {
                globalThis.__MAYHEM_RUNTIME.GameAudio.unlock();
            }
            if (globalThis.__MAYHEM_RUNTIME.GameDocs && globalThis.__MAYHEM_RUNTIME.GameDocs.isOpen && globalThis.__MAYHEM_RUNTIME.GameDocs.isOpen()) {
                globalThis.__MAYHEM_RUNTIME.GameDocs.close();
            }

            var target = renderer && renderer.domElement;
            if (!target) {
                if (overlay) overlay.style.display = 'flex';
                isPlaying = false;
                showResumeControl(true);
                return;
            }
            var requestLock = target.requestPointerLock || target.webkitRequestPointerLock || target.mozRequestPointerLock;
            if (typeof requestLock !== 'function') {
                if (overlay) overlay.style.display = 'flex';
                isPlaying = false;
                showResumeControl(true);
                setTransientDebug('Pointer lock is required for gameplay.', 2200);
                return;
            }
            try {
                var maybePromise = requestLock.call(target);
                if (maybePromise && typeof maybePromise.then === 'function' && typeof maybePromise.catch === 'function') {
                    maybePromise.catch(function () {
                        if (!document.pointerLockElement) {
                            if (overlay) overlay.style.display = 'flex';
                            isPlaying = false;
                            showResumeControl(true);
                            setTransientDebug('Pointer lock denied. Click PLAY to retry.', 2200);
                        }
                    });
                }
            } catch (err) {
                if (overlay) overlay.style.display = 'flex';
                isPlaying = false;
                showResumeControl(true);
                setTransientDebug('Pointer lock failed. Click PLAY to retry.', 2200);
            }
        }

        if (playBtn) {
            playBtn.addEventListener('click', requestPlayStart);
            playBtn.addEventListener('pointerup', requestPlayStart);
            playBtn.addEventListener('mousedown', requestPlayStart);
            playBtn.addEventListener('touchend', requestPlayStart, { passive: false });
        }

        document.addEventListener('pointerlockchange', function () {
            if (document.pointerLockElement === renderer.domElement) {
                if (globalThis.__MAYHEM_RUNTIME.GameDocs && globalThis.__MAYHEM_RUNTIME.GameDocs.close) {
                    globalThis.__MAYHEM_RUNTIME.GameDocs.close();
                }
                if (overlay) overlay.style.display = 'none';
                isPlaying = true;
                showResumeControl(false);
            } else {
                triggerHeld = false;
                if (armedThrowableType) {
                    armedThrowableType = '';
                    if (globalThis.__MAYHEM_RUNTIME.GameThrowables && globalThis.__MAYHEM_RUNTIME.GameThrowables.clearTrajectoryPreview) {
                        globalThis.__MAYHEM_RUNTIME.GameThrowables.clearTrajectoryPreview();
                    }
                }
                if (overlay) overlay.style.display = 'flex';
                isPlaying = false;
                showResumeControl(true);
            }
        });

        document.addEventListener('pointerlockerror', function () {
            if (!document.pointerLockElement) {
                triggerHeld = false;
                if (overlay) overlay.style.display = 'flex';
                isPlaying = false;
                showResumeControl(true);
                setTransientDebug('Pointer lock error. Click PLAY to retry.', 2200);
            }
        });

        if (modeButtonsWrap && modeButtonsWrap.style.display !== 'none') {
            showResumeControl(false);
        }

        if (autoStartNoLock) {
            autoStartNoLock = false;
            requestPlayStart();
        }
    }

    function setupDocsControls() {
        document.addEventListener('keydown', function (e) {
            if (e.code === 'KeyI') {
                if (globalThis.__MAYHEM_RUNTIME.GameDocs && globalThis.__MAYHEM_RUNTIME.GameDocs.toggle) {
                    e.preventDefault();
                    globalThis.__MAYHEM_RUNTIME.GameDocs.toggle();
                }
                return;
            }

            if (e.code === 'Escape' && globalThis.__MAYHEM_RUNTIME.GameDocs && globalThis.__MAYHEM_RUNTIME.GameDocs.isOpen && globalThis.__MAYHEM_RUNTIME.GameDocs.isOpen()) {
                globalThis.__MAYHEM_RUNTIME.GameDocs.close();
            }
        });
    }

    function setupShooting() {
        document.addEventListener('mousedown', function (e) {
            if (e.button !== 0) return;
            if (!hasInputCapture()) return;
            triggerHeld = true;
            tryPlayerFire();
        });

        document.addEventListener('mouseup', function (e) {
            if (e.button !== 0) return;
            triggerHeld = false;
        });

        window.addEventListener('blur', function () {
            triggerHeld = false;
        });
    }

    function setupWeaponControls() {
        document.addEventListener('keydown', function (e) {
            if (e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'Digit3' || e.code === 'Digit4' || e.code === 'Digit5') {
                var weaponOrder = globalThis.__MAYHEM_RUNTIME.GameHitscan.getWeaponOrder();
                var idx = parseInt(e.code.replace('Digit', ''), 10) - 1;
                if (idx >= 0 && idx < weaponOrder.length) {
                    applyWeapon(globalThis.__MAYHEM_RUNTIME.GameHitscan.setWeapon(weaponOrder[idx]));
                }
                return;
            }

            if (e.code === 'KeyT') {
                var loadoutOrder = globalThis.__MAYHEM_RUNTIME.GameHitscan.getWeaponOrder();
                if (loadoutOrder.length > 5) {
                    applyWeapon(globalThis.__MAYHEM_RUNTIME.GameHitscan.setWeapon(loadoutOrder[5]));
                }
            }
        });

        document.addEventListener('wheel', function (e) {
            if (!hasInputCapture()) return;
            e.preventDefault();
            applyWeapon(globalThis.__MAYHEM_RUNTIME.GameHitscan.cycleWeapon(e.deltaY > 0 ? 1 : -1));
        }, { passive: false });
    }

    function setupSoundToggleControl() {
        var soundToggleBtn = document.getElementById('sound-toggle-btn');
        if (!soundToggleBtn || !globalThis.__MAYHEM_RUNTIME.GameAudio) return;
        if (!globalThis.__MAYHEM_RUNTIME.GameAudio.setMuted || !globalThis.__MAYHEM_RUNTIME.GameAudio.isMuted) return;

        function refreshLabel() {
            soundToggleBtn.textContent = globalThis.__MAYHEM_RUNTIME.GameAudio.isMuted() ? 'SOUND: OFF' : 'SOUND: ON';
        }

        soundToggleBtn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            var muted = globalThis.__MAYHEM_RUNTIME.GameAudio.setMuted(!globalThis.__MAYHEM_RUNTIME.GameAudio.isMuted());
            refreshLabel();
            setTransientDebug(muted ? 'Sound muted' : 'Sound unmuted', 900);
        });

        refreshLabel();
    }

    function clearArmedThrowablePreview() {
        armedThrowableType = '';
        if (globalThis.__MAYHEM_RUNTIME.GameThrowables && globalThis.__MAYHEM_RUNTIME.GameThrowables.clearTrajectoryPreview) {
            globalThis.__MAYHEM_RUNTIME.GameThrowables.clearTrajectoryPreview();
        }
    }

    function updateArmedThrowablePreview() {
        if (!armedThrowableType) {
            if (globalThis.__MAYHEM_RUNTIME.GameThrowables && globalThis.__MAYHEM_RUNTIME.GameThrowables.clearTrajectoryPreview) {
                globalThis.__MAYHEM_RUNTIME.GameThrowables.clearTrajectoryPreview();
            }
            return;
        }
        if (!hasInputCapture()) {
            if (globalThis.__MAYHEM_RUNTIME.GameThrowables && globalThis.__MAYHEM_RUNTIME.GameThrowables.clearTrajectoryPreview) {
                globalThis.__MAYHEM_RUNTIME.GameThrowables.clearTrajectoryPreview();
            }
            return;
        }
        if (globalThis.__MAYHEM_RUNTIME.GameThrowables && globalThis.__MAYHEM_RUNTIME.GameThrowables.updateTrajectoryPreview) {
            globalThis.__MAYHEM_RUNTIME.GameThrowables.updateTrajectoryPreview(armedThrowableType, camera);
        }
    }

    function tryThrow(type, throwIntentOverride) {
        if (!hasInputCapture()) return null;
        var throwIntent = throwIntentOverride || ((globalThis.__MAYHEM_RUNTIME.GameThrowables && globalThis.__MAYHEM_RUNTIME.GameThrowables.buildThrowIntent)
            ? globalThis.__MAYHEM_RUNTIME.GameThrowables.buildThrowIntent(camera)
            : null);

        if (multiplayerMode && globalThis.__MAYHEM_RUNTIME.GameNet && globalThis.__MAYHEM_RUNTIME.GameNet.sendThrow) {
            var clientThrowId = (globalThis.__MAYHEM_RUNTIME.GameThrowables && globalThis.__MAYHEM_RUNTIME.GameThrowables.buildClientThrowId)
                ? globalThis.__MAYHEM_RUNTIME.GameThrowables.buildClientThrowId()
                : ('cthrow-' + Date.now().toString(36));
            if (globalThis.__MAYHEM_RUNTIME.GameThrowables && globalThis.__MAYHEM_RUNTIME.GameThrowables.throwPredicted) {
                globalThis.__MAYHEM_RUNTIME.GameThrowables.throwPredicted(type, camera, clientThrowId, throwIntent);
            }
            globalThis.__MAYHEM_RUNTIME.GameNet.sendThrow(type, clientThrowId, throwIntent);
            setTransientDebug('Throw sent: ' + type, 650);
            return { ok: true, sent: true };
        }

        var outcome = globalThis.__MAYHEM_RUNTIME.GameThrowables.throw(type, camera, throwIntent);
        globalThis.__MAYHEM_RUNTIME.GameUI.updateThrowableInfo(outcome.state);
        if (outcome.ok && globalThis.__MAYHEM_RUNTIME.GameAudio && globalThis.__MAYHEM_RUNTIME.GameAudio.play) {
            globalThis.__MAYHEM_RUNTIME.GameAudio.play('throw');
        }
        if (!outcome.ok && outcome.reason === 'cooldown') {
            setTransientDebug(type + ' is recharging.', 600);
        }
        return outcome;
    }

    function setupThrowableControls() {
        document.addEventListener('keydown', function (e) {
            if (e.repeat) return;
            switch (e.code) {
                case 'KeyG':
                    if (!hasInputCapture()) return;
                    if (armedThrowableType === 'frag') {
                        var confirmIntent = (globalThis.__MAYHEM_RUNTIME.GameThrowables && globalThis.__MAYHEM_RUNTIME.GameThrowables.buildThrowIntent)
                            ? globalThis.__MAYHEM_RUNTIME.GameThrowables.buildThrowIntent(camera)
                            : null;
                        tryThrow('frag', confirmIntent);
                        clearArmedThrowablePreview();
                    } else {
                        armedThrowableType = 'frag';
                        setTransientDebug('Frag trajectory ready. Press G again to throw.', 900);
                    }
                    break;
                case 'KeyV':
                    clearArmedThrowablePreview();
                    tryThrow('seeker');
                    break;
                case 'KeyB':
                    clearArmedThrowablePreview();
                    tryThrow('molotov');
                    break;
                case 'KeyQ':
                    clearArmedThrowablePreview();
                    tryThrow('knife');
                    break;
            }
        });
    }

    function setupAbilityControls() {
        function triggerAbility(slot) {
            if (!hasInputCapture()) return;

            if (multiplayerMode && globalThis.__MAYHEM_RUNTIME.GameNet &&
                (globalThis.__MAYHEM_RUNTIME.GameNet.sendAbilityCast || globalThis.__MAYHEM_RUNTIME.GameNet.sendClassCast)) {
                var castData = null;
                if (slot === 1 && globalThis.__MAYHEM_RUNTIME.GameHitscan && globalThis.__MAYHEM_RUNTIME.GameHitscan.selectLockTargetByBox) {
                    var classTuning = (globalThis.__MAYHEM_RUNTIME.GameCombatTuning && globalThis.__MAYHEM_RUNTIME.GameCombatTuning.getClassAbilityTuning)
                        ? globalThis.__MAYHEM_RUNTIME.GameCombatTuning.getClassAbilityTuning()
                        : {};
                    var chokeBoxPx = Number(classTuning.jediChokeLockBoxPx || 190);
                    var chokeRange = Number(classTuning.jediChokeRange || 24);
                    var chokeTarget = globalThis.__MAYHEM_RUNTIME.GameHitscan.selectLockTargetByBox(camera, chokeRange, chokeBoxPx, {
                        ownerType: 'net'
                    });
                    if (!chokeTarget || !chokeTarget.targetId || String(chokeTarget.targetId).indexOf('net:') !== 0) {
                        setTransientDebug('No target for Force Choke.', 700);
                        return;
                    }

                    castData = {
                        lockTargetId: String(chokeTarget.targetId).slice(4),
                        aimPoint: chokeTarget.worldPos ? {
                            x: chokeTarget.worldPos.x,
                            y: chokeTarget.worldPos.y,
                            z: chokeTarget.worldPos.z
                        } : null
                    };
                } else if (globalThis.__MAYHEM_RUNTIME.GameHitscan && globalThis.__MAYHEM_RUNTIME.GameHitscan.peekCenterTarget) {
                    var aim = globalThis.__MAYHEM_RUNTIME.GameHitscan.peekCenterTarget(camera, 90);
                    if (aim && aim.point) {
                        castData = {
                            aimPoint: {
                                x: aim.point.x,
                                y: aim.point.y,
                                z: aim.point.z
                            }
                        };
                    }
                }
                if (globalThis.__MAYHEM_RUNTIME.GameNet.sendAbilityCast) {
                    globalThis.__MAYHEM_RUNTIME.GameNet.sendAbilityCast(slot, castData);
                } else {
                    globalThis.__MAYHEM_RUNTIME.GameNet.sendClassCast(slot, castData);
                }
                return;
            }

            var playerPos = globalThis.__MAYHEM_RUNTIME.GamePlayer.getPosition();
            var rot = globalThis.__MAYHEM_RUNTIME.GamePlayer.getRotation();
            var outcome = globalThis.__MAYHEM_RUNTIME.GameAbilities.triggerAbility(
                slot,
                camera,
                playerPos,
                rot,
                function (hitData) {
                    if (!hitData || !hitData.result) return;
                    handleEnemyHit(hitData.hitPoint, hitData.damage, hitData.hitType, hitData.result);
                },
                setTransientDebug
            );
            globalThis.__MAYHEM_RUNTIME.GameUI.updateAbilityInfo(globalThis.__MAYHEM_RUNTIME.GameAbilities.getHudState());
            if (outcome && !outcome.ok && outcome.message) {
                setTransientDebug(outcome.message, 700);
            }
        }

        document.addEventListener('keydown', function (e) {
            if (e.code === 'KeyE') {
                triggerAbility(1);
                return;
            }
            if (e.code === 'KeyR') {
                triggerAbility(2);
            }
        });
    }

    function setupDebugKeys() {
        document.addEventListener('keydown', function (e) {
            if (e.code === 'KeyH') {
                applyDebugVisuals(!wallhackRingVisible);
                setTransientDebug(wallhackRingVisible ? 'Dev visuals: ON' : 'Dev visuals: OFF', 1100);
                return;
            }
        });
    }

    function initGame() {
        applyBrandingOverrides();
        var bootstrap = depGet('GameBootstrap');
        if (bootstrap && bootstrap.createRenderContext) {
            var renderCtx = bootstrap.createRenderContext();
            renderer = renderCtx.renderer;
            scene = renderCtx.scene;
            clock = renderCtx.clock;
        } else {
            renderer = new THREE.WebGLRenderer({ antialias: true });
            renderer.setSize(window.innerWidth, window.innerHeight);
            renderer.setPixelRatio(cappedPixelRatio());
            document.body.appendChild(renderer.domElement);
            scene = new THREE.Scene();
            clock = new THREE.Clock();
        }

        multiplayerMode = forceGuestNetMode;

        function finalizeWorldBootstrap(worldMeta) {
            var worldOptions = (worldMeta && worldMeta.worldSeed) ? { worldMeta: worldMeta } : undefined;
            depRequire('GameWorld').create(scene, worldOptions);

            depRequire('GameUI').init();
            if (depGet('GameDocs') && depGet('GameDocs').init) {
                depGet('GameDocs').init();
            }
            depRequire('GameOverhead').init();

            if (startupDebugNotice) {
                setTransientDebug(startupDebugNotice, 2100);
                startupDebugNotice = '';
            }

            camera = depRequire('GamePlayer').init(scene);
            depRequire('GameThrowables').init(scene);

            if (multiplayerMode) {
                if (!depRequire('GameNet').isActive || !depRequire('GameNet').isActive()) {
                    depRequire('GameNet').init(scene);
                }
            } else {
                var enemyCount = depRequire('GameWorld').getRecommendedEnemyCount ? depRequire('GameWorld').getRecommendedEnemyCount() : DEFAULT_ENEMY_COUNT;
                depRequire('GameEnemy').init(scene, enemyCount);
                depRequire('GameUI').updateThrowableInfo(depRequire('GameThrowables').getState());
            }

            depRequire('GameAbilities').init(scene);

            var initialAbilityProfile = globalThis.__MAYHEM_RUNTIME.GameAbilities.getCurrentClass();
            applyAbilityProfile(initialAbilityProfile && initialAbilityProfile.id ? initialAbilityProfile.id : 'abilities');

            playerHP = playerMaxHP;
            playerArmor = globalThis.__MAYHEM_RUNTIME.GameAbilities.getArmorMax ? globalThis.__MAYHEM_RUNTIME.GameAbilities.getArmorMax() : 90;
            applyArmorProfile(playerArmor);
            globalThis.__MAYHEM_RUNTIME.GameUI.updateHealth(playerHP, playerMaxHP);
            globalThis.__MAYHEM_RUNTIME.GameUI.updateAbilityInfo(globalThis.__MAYHEM_RUNTIME.GameAbilities.getHudState());

            rebuildWallhackRing(getCurrentWallhackRadius());
            applyDebugVisuals(true);

            applyWeapon(globalThis.__MAYHEM_RUNTIME.GameHitscan.getCurrentWeapon());

            setupPointerLock();
            setupShooting();
            setupWeaponControls();
            setupThrowableControls();
            setupAbilityControls();
            setupSoundToggleControl();
            setupDocsControls();
            setupDebugKeys();

            var bootstrapApi = depGet('GameBootstrap');
            if (bootstrapApi && bootstrapApi.installResizeHandler) {
                bootstrapApi.installResizeHandler(renderer);
            } else {
                window.addEventListener('resize', function () {
                    renderer.setPixelRatio(cappedPixelRatio());
                    renderer.setSize(window.innerWidth, window.innerHeight);
                });
            }

            animate();
        }

        if (multiplayerMode) {
            var netApi = depRequire('GameNet');
            netApi.init(scene);

            var metaWaitStartedAt = performance.now();
            var metaTimeoutMs = 1400;

            (function waitForWorldMeta() {
                var receivedMeta = netApi.getWorldMeta ? netApi.getWorldMeta() : null;
                if (receivedMeta && receivedMeta.worldSeed) {
                    finalizeWorldBootstrap(receivedMeta);
                    return;
                }

                if ((performance.now() - metaWaitStartedAt) >= metaTimeoutMs) {
                    var fallbackMeta = netApi.getExpectedWorldMeta ? netApi.getExpectedWorldMeta() : null;
                    if (fallbackMeta && fallbackMeta.worldSeed) {
                        startupDebugNotice = (startupDebugNotice ? startupDebugNotice + ' ' : '') + 'World metadata timeout; using expected room profile.';
                    }
                    finalizeWorldBootstrap(fallbackMeta);
                    return;
                }

                setTimeout(waitForWorldMeta, 40);
            })();
            return;
        }

        finalizeWorldBootstrap(null);
    }

    function animate() {
        var loopApi = depGet('GameLoop');
        if (loopApi && loopApi.requestFrame) {
            loopApi.requestFrame(animate);
        } else {
            requestAnimationFrame(animate);
        }

        var dt = clock.getDelta();
        if (dt > 0.1) dt = 0.1;

        if (globalThis.__MAYHEM_RUNTIME.GameWorld && globalThis.__MAYHEM_RUNTIME.GameWorld.update) {
            globalThis.__MAYHEM_RUNTIME.GameWorld.update(dt);
        }

        globalThis.__MAYHEM_RUNTIME.GamePlayer.update(dt);

        var currentWeapon = globalThis.__MAYHEM_RUNTIME.GameHitscan.getCurrentWeapon();
        if (currentWeapon && (currentWeapon.id === 'shotgun' || currentWeapon.id === 'plasma')) {
            syncReticleWithWeapon(currentWeapon);
        }

        if (triggerHeld && hasInputCapture() && currentWeapon && currentWeapon.automatic) {
            tryPlayerFire();
        }

        var plasmaState = globalThis.__MAYHEM_RUNTIME.GameHitscan.tick
            ? globalThis.__MAYHEM_RUNTIME.GameHitscan.tick(dt)
            : globalThis.__MAYHEM_RUNTIME.GameHitscan.updatePlasmaBeam(dt, camera);
        if (globalThis.__MAYHEM_RUNTIME.GameHitscan.updateTracers) {
            globalThis.__MAYHEM_RUNTIME.GameHitscan.updateTracers(dt);
        }
        if (plasmaState.active && !lastPlasmaActive && globalThis.__MAYHEM_RUNTIME.GameAudio && globalThis.__MAYHEM_RUNTIME.GameAudio.play) {
            globalThis.__MAYHEM_RUNTIME.GameAudio.play('plasma');
        }
        lastPlasmaActive = !!plasmaState.active;
        globalThis.__MAYHEM_RUNTIME.GameUI.updatePlasmaState(plasmaState);

        if (respawnInvulnTimer > 0) {
            respawnInvulnTimer -= dt;
            if (respawnInvulnTimer < 0) respawnInvulnTimer = 0;
        }

        if (!multiplayerMode) {
            if (armorRegenDelay > 0) {
                armorRegenDelay -= dt;
                if (armorRegenDelay < 0) armorRegenDelay = 0;
            } else if (playerArmor < playerArmorMax) {
                playerArmor += ARMOR_REGEN_PER_SEC * dt;
                if (playerArmor > playerArmorMax) playerArmor = playerArmorMax;
            }
        }

        var playerPos = globalThis.__MAYHEM_RUNTIME.GamePlayer.getPosition();
        var playerRot = globalThis.__MAYHEM_RUNTIME.GamePlayer.getRotation();
        if (wallhackRing) {
            wallhackRing.position.set(playerPos.x, 0.06, playerPos.z);
        }

        updateArmedThrowablePreview();

        if (multiplayerMode) {
            globalThis.__MAYHEM_RUNTIME.GameNet.update(dt, playerPos, playerRot);
            var selfState = globalThis.__MAYHEM_RUNTIME.GameNet.getSelfState();
            if (selfState) {
                if (globalThis.__MAYHEM_RUNTIME.GameAbilities.clearQueuedClass) {
                    globalThis.__MAYHEM_RUNTIME.GameAbilities.clearQueuedClass();
                }

                playerHP = selfState.hp;
                playerMaxHP = selfState.hpMax;
                playerArmor = selfState.armor;
                playerArmorMax = selfState.armorMax;
                globalThis.__MAYHEM_RUNTIME.GameUI.updateHealth(playerHP, playerMaxHP);
                globalThis.__MAYHEM_RUNTIME.GameUI.updateArmor(playerArmor, playerArmorMax);
                syncWallhackRingRadius();
                if (globalThis.__MAYHEM_RUNTIME.GameHitscan && globalThis.__MAYHEM_RUNTIME.GameHitscan.syncPlasmaStateFromNet) {
                    globalThis.__MAYHEM_RUNTIME.GameHitscan.syncPlasmaStateFromNet(selfState);
                }
                if (globalThis.__MAYHEM_RUNTIME.GameThrowables && globalThis.__MAYHEM_RUNTIME.GameThrowables.setNetworkInventoryState) {
                    globalThis.__MAYHEM_RUNTIME.GameThrowables.setNetworkInventoryState(selfState.throwables || null);
                    globalThis.__MAYHEM_RUNTIME.GameUI.updateThrowableInfo(globalThis.__MAYHEM_RUNTIME.GameThrowables.getState());
                }
            }

            if (globalThis.__MAYHEM_RUNTIME.GameNet.consumeClassCastResult) {
                var castResult = null;
                do {
                    castResult = globalThis.__MAYHEM_RUNTIME.GameNet.consumeClassCastResult();
                    if (castResult) {
                        if (castResult.t === 'class_cast_ok') {
                            setTransientDebug((castResult.kind || 'Ability') + ' cast!', 800);
                        } else if (castResult.t === 'class_cast_reject') {
                            setTransientDebug('Ability failed: ' + (castResult.reason || 'rejected'), 700);
                        }
                    }
                } while (castResult);
            }

            if (globalThis.__MAYHEM_RUNTIME.GameNet.consumeDamageFeedback) {
                var damageFeedback = null;
                do {
                    damageFeedback = globalThis.__MAYHEM_RUNTIME.GameNet.consumeDamageFeedback();
                    if (damageFeedback) {
                        handleNetworkDamageFeedback(damageFeedback);
                    }
                } while (damageFeedback);
            }

            if (globalThis.__MAYHEM_RUNTIME.GameNet.consumeSeekerReject) {
                var seekerReject = null;
                do {
                    seekerReject = globalThis.__MAYHEM_RUNTIME.GameNet.consumeSeekerReject();
                    if (!seekerReject) continue;
                    if (globalThis.__MAYHEM_RUNTIME.GameHitscan && globalThis.__MAYHEM_RUNTIME.GameHitscan.applySeekerReject) {
                        globalThis.__MAYHEM_RUNTIME.GameHitscan.applySeekerReject(seekerReject);
                    }
                    if (seekerReject.reason === 'overheated') {
                        setTransientDebug('Plasma overheated.', 650);
                    }
                } while (seekerReject);
            }

            if (globalThis.__MAYHEM_RUNTIME.GameNet.getSelfAbilityState) {
                var abilityState = globalThis.__MAYHEM_RUNTIME.GameNet.getSelfAbilityState();
                if (abilityState) {
                    var hudState = globalThis.__MAYHEM_RUNTIME.GameAbilities.getHudState();
                    hudState.abilityCooldown = abilityState.abilityCooldownRemaining || 0;
                    hudState.ultimateCooldown = abilityState.ultimateCooldownRemaining || 0;
                    hudState.extra = '';
                    if (abilityState.shadowDashUntil && abilityState.shadowDashUntil > Date.now()) {
                        hudState.extra = 'SHADOW DASH';
                    } else if (abilityState.rageUntil && abilityState.rageUntil > Date.now()) {
                        hudState.extra = 'RAGE ' + Math.max(0, (abilityState.rageUntil - Date.now()) / 1000).toFixed(1) + 's';
                    } else if (abilityState.deadeyeState && abilityState.deadeyeState.maxLocks > 0) {
                        hudState.extra = 'DEADEYE ' + abilityState.deadeyeState.lockCount + '/' + abilityState.deadeyeState.maxLocks;
                    } else if (abilityState.focusShots && abilityState.focusUntil && abilityState.focusUntil > Date.now()) {
                        hudState.extra = 'FOCUS READY';
                    }
                    globalThis.__MAYHEM_RUNTIME.GameUI.updateAbilityInfo(hudState);
                }
            }

            var notice = globalThis.__MAYHEM_RUNTIME.GameNet.consumeNotice();
            if (notice) setTransientDebug(notice, 900);

            if (globalThis.__MAYHEM_RUNTIME.GameNet.consumeThrowAck && globalThis.__MAYHEM_RUNTIME.GameThrowables && globalThis.__MAYHEM_RUNTIME.GameThrowables.confirmPredictedThrow) {
                var throwAck = null;
                do {
                    throwAck = globalThis.__MAYHEM_RUNTIME.GameNet.consumeThrowAck();
                    if (throwAck && throwAck.clientThrowId) {
                        globalThis.__MAYHEM_RUNTIME.GameThrowables.confirmPredictedThrow(throwAck.clientThrowId);
                    }
                } while (throwAck);
            }

            if (globalThis.__MAYHEM_RUNTIME.GameNet.consumeThrowReject && globalThis.__MAYHEM_RUNTIME.GameThrowables && globalThis.__MAYHEM_RUNTIME.GameThrowables.rejectPredictedThrow) {
                var throwReject = null;
                do {
                    throwReject = globalThis.__MAYHEM_RUNTIME.GameNet.consumeThrowReject();
                    if (throwReject && throwReject.clientThrowId) {
                        globalThis.__MAYHEM_RUNTIME.GameThrowables.rejectPredictedThrow(throwReject.clientThrowId);
                    }
                } while (throwReject);
            }

            if (globalThis.__MAYHEM_RUNTIME.GameNet.getAuthoritativeThrowableState && globalThis.__MAYHEM_RUNTIME.GameThrowables && globalThis.__MAYHEM_RUNTIME.GameThrowables.syncAuthoritativeState) {
                globalThis.__MAYHEM_RUNTIME.GameThrowables.syncAuthoritativeState(
                    globalThis.__MAYHEM_RUNTIME.GameNet.getAuthoritativeThrowableState(),
                    selfState ? selfState.id : ''
                );
            }

            if (globalThis.__MAYHEM_RUNTIME.GameNet.consumeThrowableEvent && globalThis.__MAYHEM_RUNTIME.GameThrowables && globalThis.__MAYHEM_RUNTIME.GameThrowables.applyNetworkEvent) {
                var throwEvent = null;
                do {
                    throwEvent = globalThis.__MAYHEM_RUNTIME.GameNet.consumeThrowableEvent();
                    if (throwEvent) globalThis.__MAYHEM_RUNTIME.GameThrowables.applyNetworkEvent(throwEvent);
                } while (throwEvent);
            }

            globalThis.__MAYHEM_RUNTIME.GameThrowables.update(dt, function () {});
        } else {
            globalThis.__MAYHEM_RUNTIME.GameAbilities.update(
                dt,
                camera,
                playerPos,
                playerRot,
                function (hitData) {
                    if (!hitData || !hitData.result) return;
                    handleEnemyHit(hitData.hitPoint, hitData.damage, hitData.hitType, hitData.result);
                },
                setTransientDebug
            );

            globalThis.__MAYHEM_RUNTIME.GameEnemy.update(dt, playerPos, camera, function (damage, hitType, attackerEnemy) {
                consumePlayerDamage(damage, hitType, attackerEnemy);
            });

            globalThis.__MAYHEM_RUNTIME.GameThrowables.update(dt, function (hitData) {
                if (!hitData || !hitData.result) return;
                handleEnemyHit(hitData.hitPoint, hitData.damage, hitData.hitType, hitData.result);
            });

            globalThis.__MAYHEM_RUNTIME.GameUI.updateThrowableInfo(globalThis.__MAYHEM_RUNTIME.GameThrowables.getState());
            globalThis.__MAYHEM_RUNTIME.GameUI.updateHealth(playerHP, playerMaxHP);
            globalThis.__MAYHEM_RUNTIME.GameUI.updateArmor(playerArmor, playerArmorMax);
        }

        currentAimTargetId = '';
        var centerTarget = globalThis.__MAYHEM_RUNTIME.GameHitscan.peekCenterTarget(camera, 220);
        if (centerTarget && centerTarget.targetId) {
            currentAimTargetId = centerTarget.targetId;
        }

        globalThis.__MAYHEM_RUNTIME.GameOverhead.update(camera, playerPos, currentAimTargetId);
        if (globalThis.__MAYHEM_RUNTIME.GameUI.updateCombatRadar || globalThis.__MAYHEM_RUNTIME.GameUI.updateCombatBeacons) {
            var awarenessState = buildAwarenessState(playerPos, playerRot ? playerRot.yaw : 0);
            if (globalThis.__MAYHEM_RUNTIME.GameUI.updateCombatRadar) {
                globalThis.__MAYHEM_RUNTIME.GameUI.updateCombatRadar(awarenessState);
            }
            if (globalThis.__MAYHEM_RUNTIME.GameUI.updateCombatBeacons) {
                globalThis.__MAYHEM_RUNTIME.GameUI.updateCombatBeacons(awarenessState.beacons);
            }
        }

        var cdRemaining = globalThis.__MAYHEM_RUNTIME.GameHitscan.cooldownRemaining();
        var cdTotal = globalThis.__MAYHEM_RUNTIME.GameHitscan.getCooldown();
        var cdReady = cdRemaining <= 0;
        var cdPct = cdReady ? 1 : (1 - cdRemaining / cdTotal);

        globalThis.__MAYHEM_RUNTIME.GameUI.updateCooldown(cdReady, cdPct);
        globalThis.__MAYHEM_RUNTIME.GameUI.updateDamageEffects(dt);
        if (!multiplayerMode) {
            globalThis.__MAYHEM_RUNTIME.GameUI.updateAbilityInfo(globalThis.__MAYHEM_RUNTIME.GameAbilities.getHudState());
        }

        if (globalThis.__MAYHEM_RUNTIME.GameUI.updateChokeReticle) {
            var classAbilityTuning = (globalThis.__MAYHEM_RUNTIME.GameCombatTuning && globalThis.__MAYHEM_RUNTIME.GameCombatTuning.getClassAbilityTuning)
                ? globalThis.__MAYHEM_RUNTIME.GameCombatTuning.getClassAbilityTuning()
                : {};
            globalThis.__MAYHEM_RUNTIME.GameUI.updateChokeReticle(
                false,
                Number(classAbilityTuning.jediChokeLockBoxPx || 190)
            );
        }
        if (globalThis.__MAYHEM_RUNTIME.GameUI.updateDeadeyeReticle) {
            var deadeyeStateForUi = null;
            if (multiplayerMode && globalThis.__MAYHEM_RUNTIME.GameNet && globalThis.__MAYHEM_RUNTIME.GameNet.getSelfAbilityState) {
                var abilState = globalThis.__MAYHEM_RUNTIME.GameNet.getSelfAbilityState();
                if (abilState && abilState.deadeyeState && abilState.deadeyeState.maxLocks > 0) {
                    var netDeadeye = abilState.deadeyeState;
                    var targetIds = Array.isArray(netDeadeye.targetIds) ? netDeadeye.targetIds : [];
                    var lockCount = Math.max(0, Math.min(targetIds.length, Number(netDeadeye.lockCount || 0)));
                    var lockEveryMs = Math.max(0, Number(netDeadeye.lockEveryMs || 0));
                    var nextLockAt = Number(netDeadeye.nextLockAt || 0);
                    var lockProgress = 0;
                    if (lockEveryMs > 0 && nextLockAt > 0) {
                        lockProgress = 1 - Math.max(0, nextLockAt - Date.now()) / lockEveryMs;
                    }
                    lockProgress = Math.max(0, Math.min(1, lockProgress));

                    var markers = [];
                    for (var m = 0; m < targetIds.length; m++) {
                        var targetId = targetIds[m];
                        var locked = m < lockCount;
                        var markerProgress = locked ? 1 : (m === lockCount ? lockProgress : 0);
                        var markerPos = (globalThis.__MAYHEM_RUNTIME.GameNet.getEntityMarkerWorldPos)
                            ? globalThis.__MAYHEM_RUNTIME.GameNet.getEntityMarkerWorldPos(targetId)
                            : null;

                        if (markerPos) {
                            markers.push({
                                worldPos: markerPos,
                                progress: markerProgress,
                                locked: locked
                            });
                        }
                    }

                    if (markers.length > 0) {
                        deadeyeStateForUi = { targets: markers };
                    } else {
                        deadeyeStateForUi = {
                            targets: [{
                                screenCenter: true,
                                progress: netDeadeye.maxLocks > 0 ? (lockCount / netDeadeye.maxLocks) : lockProgress,
                                locked: false
                            }]
                        };
                    }
                }
            } else if (globalThis.__MAYHEM_RUNTIME.GameAbilities && globalThis.__MAYHEM_RUNTIME.GameAbilities.getDeadeyeState) {
                var localDeadeye = globalThis.__MAYHEM_RUNTIME.GameAbilities.getDeadeyeState();
                if (localDeadeye) {
                    deadeyeStateForUi = localDeadeye;
                }
            }
            globalThis.__MAYHEM_RUNTIME.GameUI.updateDeadeyeReticle(camera, deadeyeStateForUi);
        }
        if (globalThis.__MAYHEM_RUNTIME.GameUI.updateSeekerDebugInfo) {
            var showSeekerDebug = !!wallhackRingVisible && currentWeapon && currentWeapon.id === 'seekergun';
            var seekerTelemetry = null;
            var seekerTuning = null;
            if (showSeekerDebug && globalThis.__MAYHEM_RUNTIME.GameHitscan.getSeekergunDebugInfo) {
                seekerTelemetry = globalThis.__MAYHEM_RUNTIME.GameHitscan.getSeekergunDebugInfo(camera);
            }
            if (showSeekerDebug && globalThis.__MAYHEM_RUNTIME.GameThrowables && globalThis.__MAYHEM_RUNTIME.GameThrowables.getSeekerShotTuning) {
                seekerTuning = globalThis.__MAYHEM_RUNTIME.GameThrowables.getSeekerShotTuning();
            }
            globalThis.__MAYHEM_RUNTIME.GameUI.updateSeekerDebugInfo(showSeekerDebug, seekerTelemetry, seekerTuning, {
                fov: camera && camera.fov ? camera.fov : 60,
                aspect: camera && camera.aspect ? camera.aspect : (window.innerWidth / Math.max(1, window.innerHeight))
            });
        }

        renderer.render(scene, camera);
    }

    function isLocalDevMode() {
        var modeFlow = depGet('GameModeFlow');
        if (modeFlow && modeFlow.isLocalDevMode) return modeFlow.isLocalDevMode();
        var host = (window.location.hostname || '').toLowerCase();
        if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '::1') return true;
        try {
            var params = new URLSearchParams(window.location.search || '');
            if (params.get('local') === '1' || params.get('offline') === '1') return true;
            if (params.get('net') === '1') return false;
        } catch (err) {
            // URL parsing failed; continue with protocol fallback.
        }
        return window.location.protocol === 'file:';
    }

    function wantsGuestNetMode() {
        var modeFlow = depGet('GameModeFlow');
        if (modeFlow && modeFlow.wantsGuestNetMode) return modeFlow.wantsGuestNetMode();
        try {
            var params = new URLSearchParams(window.location.search || '');
            return params.get('net') === '1';
        } catch (err) {
            return false;
        }
    }

    function requestedRoomId() {
        var modeFlow = depGet('GameModeFlow');
        if (modeFlow && modeFlow.requestedRoomId) return modeFlow.requestedRoomId();
        var protocol = (globalThis.__MAYHEM_RUNTIME.GameShared && globalThis.__MAYHEM_RUNTIME.GameShared.protocol)
            ? globalThis.__MAYHEM_RUNTIME.GameShared.protocol
            : null;

        function sanitizeRoomId(raw) {
            if (protocol && typeof protocol.sanitizeRoomId === 'function') {
                return protocol.sanitizeRoomId(raw);
            }
            var id = String(raw || '').toLowerCase().trim();
            id = id.replace(/[^a-z0-9-]/g, '');
            if (!id) return 'global';
            if (id.length > 32) id = id.slice(0, 32);
            return id;
        }

        try {
            var params = new URLSearchParams(window.location.search || '');
            var requested = params.get('room');
            if (requested === null || requested === undefined) return '';
            if (!String(requested).trim()) return '';
            return sanitizeRoomId(requested);
        } catch (err) {
            return '';
        }
    }

    function boot() {
        function safeInit() {
            try {
                initGame();
            } catch (err) {
                var msg = (err && err.message) ? err.message : String(err || 'Unknown startup error');
                var overlayEl = document.getElementById('overlay');
                if (overlayEl) overlayEl.style.display = 'flex';
                var dbg = document.getElementById('debug-info');
                if (dbg) dbg.textContent = 'Startup error: ' + msg;
                console.error('Startup error:', err);
            }
        }

        var modeButtonsWrap = document.getElementById('mode-buttons');
        var multiplayerBtn = document.getElementById('mode-multiplayer-btn');
        var singleplayerServerBtn = document.getElementById('mode-singleplayer-server-btn');
        var singleplayerLocalBtn = document.getElementById('mode-singleplayer-local-btn');
        var modeSubtitle = document.getElementById('mode-subtitle');
        var playBtn = document.getElementById('play-btn');
        var started = false;

        function startWithMode(mode) {
            if (started) return;
            started = true;
            var requestedRoom = requestedRoomId() || 'global';
            var selectedRoom = (mode === 'singleplayer_server')
                ? 'dev-local'
                : requestedRoom;

            if (modeButtonsWrap) modeButtonsWrap.style.display = 'none';
            if (playBtn) playBtn.style.display = 'none';
            if (multiplayerBtn) multiplayerBtn.disabled = true;
            if (singleplayerServerBtn) singleplayerServerBtn.disabled = true;
            if (singleplayerLocalBtn) singleplayerLocalBtn.disabled = true;
            if (modeSubtitle) {
                if (mode === 'multiplayer') {
                    modeSubtitle.textContent = 'Connecting to multiplayer room: ' + selectedRoom + '...';
                } else if (mode === 'singleplayer_server') {
                    modeSubtitle.textContent = 'Connecting to shared dev-server room: ' + selectedRoom + '...';
                } else {
                    modeSubtitle.textContent = 'Starting offline local simulation...';
                }
            }

            autoStartNoLock = true;

            if (mode === 'multiplayer' || mode === 'singleplayer_server') {
                forceGuestNetMode = true;
                forcedRoomId = selectedRoom;
                if (globalThis.__MAYHEM_RUNTIME.GameNet && globalThis.__MAYHEM_RUNTIME.GameNet.enableGuestMode) {
                    globalThis.__MAYHEM_RUNTIME.GameNet.enableGuestMode();
                }
                if (globalThis.__MAYHEM_RUNTIME.GameNet && globalThis.__MAYHEM_RUNTIME.GameNet.setRoomId) {
                    globalThis.__MAYHEM_RUNTIME.GameNet.setRoomId(forcedRoomId);
                }
                startupDebugNotice = mode === 'singleplayer_server'
                    ? ('Single-player dev server: shared room ' + selectedRoom + '.')
                    : ('Guest multiplayer mode: shared room ' + selectedRoom + '.');
            } else {
                forceGuestNetMode = false;
                forcedRoomId = 'global';
                if (globalThis.__MAYHEM_RUNTIME.GameNet && globalThis.__MAYHEM_RUNTIME.GameNet.setRoomId) {
                    globalThis.__MAYHEM_RUNTIME.GameNet.setRoomId('global');
                }
                startupDebugNotice = 'Single-player dev local: local bots only.';
            }

            safeInit();
        }

        if (multiplayerBtn) {
            multiplayerBtn.addEventListener('click', function () {
                startWithMode('multiplayer');
            });
        }
        if (singleplayerServerBtn) {
            singleplayerServerBtn.addEventListener('click', function () {
                startWithMode('singleplayer_server');
            });
        }
        if (singleplayerLocalBtn) {
            singleplayerLocalBtn.addEventListener('click', function () {
                startWithMode('singleplayer_local');
            });
        }

        if (wantsGuestNetMode()) {
            var roomFromQuery = requestedRoomId();
            if (roomFromQuery && globalThis.__MAYHEM_RUNTIME.GameNet && globalThis.__MAYHEM_RUNTIME.GameNet.setRoomId) {
                globalThis.__MAYHEM_RUNTIME.GameNet.setRoomId(roomFromQuery);
            }
            startWithMode('multiplayer');
            return;
        }

        if (!multiplayerBtn || !singleplayerServerBtn || !singleplayerLocalBtn) {
            startWithMode(isLocalDevMode() ? 'singleplayer_local' : 'multiplayer');
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
