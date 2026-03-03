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
    var plasmaBeamLine = null;

    var DEFAULT_ENEMY_COUNT = 5;
    var DEFAULT_ARMOR_REGEN_DELAY = 6.0;
    var ARMOR_REGEN_PER_SEC = 12;

    var currentAimTargetId = '';
    var multiplayerMode = false;
    var forceGuestNetMode = false;
    var startupDebugNotice = '';
    var autoStartNoLock = false;
    var armedThrowableType = '';
    var lastPlasmaActive = false;
    var netShotCounter = 0;
    var awarenessTuning = (window.GameCombatTuning && window.GameCombatTuning.getAwarenessTuning)
        ? window.GameCombatTuning.getAwarenessTuning()
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
        if (window.GameEnemy && window.GameEnemy.getLockTargets) {
            appendTargets(window.GameEnemy.getLockTargets() || []);
        }
        if (window.GameNet && window.GameNet.getLockTargets) {
            appendTargets(window.GameNet.getLockTargets() || []);
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
        window.GameUI.setDebugInfo(text || '');
        if (debugTimer) clearTimeout(debugTimer);
        if (!text) {
            debugTimer = null;
            return;
        }
        debugTimer = setTimeout(function () {
            window.GameUI.setDebugInfo('');
            debugTimer = null;
        }, ms || 1000);
    }

    function hasInputCapture() {
        return !!renderer && document.pointerLockElement === renderer.domElement;
    }

    function getCurrentWallhackRadius() {
        if (multiplayerMode && window.GameNet && window.GameNet.getSelfState) {
            var selfState = window.GameNet.getSelfState();
            if (selfState && typeof selfState.wallhackRadius === 'number') {
                return selfState.wallhackRadius;
            }
        }

        if (window.GameClasses && window.GameClasses.getWallhackRadius) {
            return window.GameClasses.getWallhackRadius();
        }

        if (window.GameEnemy && window.GameEnemy.getWallhackRadius) {
            return window.GameEnemy.getWallhackRadius();
        }

        if (window.GameCombatTuning && window.GameCombatTuning.getEnemyTuning) {
            return window.GameCombatTuning.getEnemyTuning().defaultWallhackRadius;
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

    function setBeamLinePoints(line, start, end) {
        if (!line || !line.geometry || !line.geometry.attributes || !line.geometry.attributes.position) return;
        var arr = line.geometry.attributes.position.array;
        arr[0] = start.x; arr[1] = start.y; arr[2] = start.z;
        arr[3] = end.x; arr[4] = end.y; arr[5] = end.z;
        line.geometry.attributes.position.needsUpdate = true;
        line.geometry.computeBoundingSphere();
    }

    function applyDebugVisuals(visible) {
        wallhackRingVisible = !!visible;
        if (wallhackRing) wallhackRing.visible = wallhackRingVisible;

        if (window.GameEnemy) {
            if (window.GameEnemy.setHitboxVisibility) {
                window.GameEnemy.setHitboxVisibility(!!visible);
            } else if (window.GameEnemy.isHitboxVisible && window.GameEnemy.toggleHitboxVisibility) {
                if (window.GameEnemy.isHitboxVisible() !== !!visible) {
                    window.GameEnemy.toggleHitboxVisibility();
                }
            }
        }

        if (window.GameNet && window.GameNet.setHitboxVisibility) {
            window.GameNet.setHitboxVisibility(!!visible);
        }

        if (window.GameClasses && window.GameClasses.setDebugMode) {
            window.GameClasses.setDebugMode(!!visible);
        }
        if (window.GameThrowables && window.GameThrowables.setDebugMode) {
            window.GameThrowables.setDebugMode(!!visible);
        }
    }

    function syncReticleWithWeapon(weapon) {
        if (!weapon) return;
        window.GameUI.updateReticle(weapon, window.GameHitscan.getReticleSpec(weapon.id));
    }

    function applyArmorProfile(armorMax) {
        armorMax = Math.max(1, armorMax || 100);
        playerArmorMax = armorMax;
        if (playerArmor > playerArmorMax) playerArmor = playerArmorMax;
        if (playerArmor < 0) playerArmor = 0;
        window.GameUI.updateArmor(playerArmor, playerArmorMax);
    }

    function applyWeapon(weapon) {
        if (!weapon) return;
        window.GameUI.updateWeaponInfo(weapon);
        window.GamePlayer.setWeaponModel(weapon.id);
        syncReticleWithWeapon(weapon);
        if (multiplayerMode && window.GameNet && window.GameNet.sendEquipWeapon) {
            window.GameNet.sendEquipWeapon(weapon.id);
        }
        if (window.GameDocs && window.GameDocs.refresh) {
            window.GameDocs.refresh();
        }
        setTransientDebug('Weapon: ' + weapon.name, 950);
    }

    function applyClassImmediate(classId) {
        if (!window.GameClasses) return null;
        var selected = window.GameClasses.setClass(classId);
        if (!selected) return null;

        if (selected.loadoutWeapon) {
            applyWeapon(window.GameHitscan.setWeapon(selected.loadoutWeapon));
        }

        applyArmorProfile(selected.armorMax || playerArmorMax);
        window.GameUI.updateClassInfo(window.GameClasses.getHudState());
        syncWallhackRingRadius();
        if (window.GameDocs && window.GameDocs.refresh) {
            window.GameDocs.refresh();
        }

        return selected;
    }

    function queueClassChange(classId) {
        var queued = window.GameClasses.queueClass(classId);
        if (!queued) return;

        if (multiplayerMode && window.GameNet && window.GameNet.queueClassChange) {
            window.GameNet.queueClassChange(classId);
        }

        window.GameUI.updateClassInfo(window.GameClasses.getHudState());
        if (window.GameDocs && window.GameDocs.refresh) {
            window.GameDocs.refresh();
        }
        setTransientDebug('Queued class: ' + queued.name + ' (applies on death)', 1300);
    }

    function handleEnemyHit(hitPoint, damage, hitType, result) {
        if (!result) return;
        if (window.GameAudio && window.GameAudio.play) {
            window.GameAudio.play('enemyHit', { killed: !!result.killed });
        }
        if (result.killed) {
            window.GameUI.showKillMarker();
            window.GameUI.addKill();
            window.GameUI.showDamageNumber(hitPoint, damage, true, camera, hitType);
        } else {
            window.GameUI.showHitMarker();
            window.GameUI.showDamageNumber(hitPoint, damage, false, camera, hitType);
        }
    }

    function handleNetworkDamageFeedback(feedback) {
        if (!feedback) return;

        if (window.GameAudio && window.GameAudio.play) {
            window.GameAudio.play('enemyHit', { killed: !!feedback.killed });
        }
        if (feedback.killed) {
            window.GameUI.showKillMarker();
            window.GameUI.addKill();
        } else {
            window.GameUI.showHitMarker();
        }

        if (feedback.worldPos && typeof feedback.damage === 'number' && feedback.damage > 0) {
            var wp = feedback.worldPos;
            window.GameUI.showDamageNumber(
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
        if (window.GameClasses && window.GameClasses.modifyIncomingDamage) {
            damage = window.GameClasses.modifyIncomingDamage(damage, hitType);
        }

        armorRegenDelay = DEFAULT_ARMOR_REGEN_DELAY;

        if (playerArmor > 0) {
            var absorbed = Math.min(playerArmor, damage);
            playerArmor -= absorbed;
            damage -= absorbed;
        }

        if (damage > 0) {
            playerHP -= damage;
            if (window.GameAudio && window.GameAudio.play) {
                window.GameAudio.play('playerHit');
            }
        }

        if (attackerEnemy && attackerEnemy.group && attackerEnemy.group.position) {
            var playerPos = window.GamePlayer.getPosition();
            var rot = window.GamePlayer.getRotation();
            window.GameUI.showDirectionalDamage(
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

        window.GameUI.updateHealth(playerHP, playerMaxHP);
        window.GameUI.updateArmor(playerArmor, playerArmorMax);
    }

    function respawnPlayer() {
        if (!multiplayerMode) {
            var applied = window.GameClasses.applyQueuedClass();
            if (applied) {
                if (applied.loadoutWeapon) {
                    applyWeapon(window.GameHitscan.setWeapon(applied.loadoutWeapon));
                }
                applyArmorProfile(applied.armorMax || playerArmorMax);
            }
        }

        playerHP = playerMaxHP;
        if (!multiplayerMode) {
            playerArmor = playerArmorMax;
        }
        armorRegenDelay = 0;

        window.GameUI.updateHealth(playerHP, playerMaxHP);
        window.GameUI.updateArmor(playerArmor, playerArmorMax);

        if (!multiplayerMode) {
            window.GamePlayer.respawnRandom();
            respawnInvulnTimer = 1.0;
        }

        window.GameUI.updateDamageEffects(5);
        window.GameUI.updateClassInfo(window.GameClasses.getHudState());
        syncWallhackRingRadius();
    }

    function tryPlayerFire() {
        var shotToken = '';
        if (multiplayerMode) {
            netShotCounter = (netShotCounter + 1) % 1000000;
            shotToken = 's' + Date.now().toString(36) + '-' + netShotCounter.toString(36);
        }
        var fired = window.GameHitscan.fire(
            camera,
            function (hitboxMesh, hitPoint, distance, hitType, damage, weapon) {
                if (window.GameClasses && window.GameClasses.modifyOutgoingDamage) {
                    damage = window.GameClasses.modifyOutgoingDamage(damage, hitType, weapon ? weapon.id : '');
                }

                if (multiplayerMode && hitboxMesh && hitboxMesh.userData && hitboxMesh.userData.ownerType === 'net') {
                    if (window.GameNet && window.GameNet.sendFire) {
                        window.GameNet.sendFire(hitboxMesh, weapon ? weapon.id : 'rifle', hitType, shotToken);
                        window.GameUI.showHitMarker();
                    }
                    return;
                }

                if (!window.GameEnemy || !window.GameEnemy.damage) return;
                var result = window.GameEnemy.damage(hitboxMesh, damage);
                handleEnemyHit(hitPoint, damage, hitType, result);
            },
            function () {}
        );

        if (fired) {
            window.GamePlayer.fireAnimation();
            if (window.GameAudio && window.GameAudio.play) {
                var w = window.GameHitscan.getCurrentWeapon();
                if (document.hasFocus()) {
                    window.GameAudio.play('fire', { weapon: w && w.id ? w.id : 'rifle' });
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
            if (window.GameAudio && window.GameAudio.unlock) {
                window.GameAudio.unlock();
            }
            if (window.GameDocs && window.GameDocs.isOpen && window.GameDocs.isOpen()) {
                window.GameDocs.close();
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
                if (window.GameDocs && window.GameDocs.close) {
                    window.GameDocs.close();
                }
                if (overlay) overlay.style.display = 'none';
                isPlaying = true;
                showResumeControl(false);
            } else {
                triggerHeld = false;
                if (armedThrowableType) {
                    armedThrowableType = '';
                    if (window.GameThrowables && window.GameThrowables.clearTrajectoryPreview) {
                        window.GameThrowables.clearTrajectoryPreview();
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
                if (window.GameDocs && window.GameDocs.toggle) {
                    e.preventDefault();
                    window.GameDocs.toggle();
                }
                return;
            }

            if (e.code === 'Escape' && window.GameDocs && window.GameDocs.isOpen && window.GameDocs.isOpen()) {
                window.GameDocs.close();
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
                var weaponOrder = window.GameHitscan.getWeaponOrder();
                var idx = parseInt(e.code.replace('Digit', ''), 10) - 1;
                if (idx >= 0 && idx < weaponOrder.length) {
                    applyWeapon(window.GameHitscan.setWeapon(weaponOrder[idx]));
                }
                return;
            }

            if (e.code === 'KeyT') {
                var loadoutOrder = window.GameHitscan.getWeaponOrder();
                if (loadoutOrder.length > 5) {
                    applyWeapon(window.GameHitscan.setWeapon(loadoutOrder[5]));
                }
            }
        });

        document.addEventListener('wheel', function (e) {
            if (!hasInputCapture()) return;
            e.preventDefault();
            applyWeapon(window.GameHitscan.cycleWeapon(e.deltaY > 0 ? 1 : -1));
        }, { passive: false });
    }

    function setupLoadoutControls() {
        var slotsWrap = document.getElementById('loadout-slots');
        var applyBtn = document.getElementById('loadout-apply');
        var plasmaToggleBtn = document.getElementById('loadout-plasma-toggle');
        if (!slotsWrap || !applyBtn || !plasmaToggleBtn) return;

        function getCatalogMap() {
            var catalog = window.GameHitscan.getWeaponCatalog ? window.GameHitscan.getWeaponCatalog() : [];
            var map = {};
            for (var i = 0; i < catalog.length; i++) {
                map[catalog[i].id] = catalog[i];
            }
            return map;
        }

        var catalogMap = getCatalogMap();
        var includePlasma = true;
        var currentLoadout = (window.GamePlayer.getLoadout && window.GamePlayer.getLoadout().slots) || window.GameHitscan.getWeaponOrder();
        if (currentLoadout.indexOf('plasma') === -1) includePlasma = false;

        function getWeaponOptions() {
            var all = window.GameHitscan.getAllWeaponIds ? window.GameHitscan.getAllWeaponIds() : window.GameHitscan.getWeaponOrder();
            var out = [];
            for (var i = 0; i < all.length; i++) {
                var id = all[i];
                if (!includePlasma && id === 'plasma') continue;
                out.push(id);
            }
            return out;
        }

        function normalizeLoadout(list) {
            var seen = {};
            var out = [];
            for (var i = 0; i < list.length; i++) {
                var id = String(list[i] || '');
                if (!id || seen[id]) continue;
                if (!includePlasma && id === 'plasma') continue;
                if (!catalogMap[id]) continue;
                seen[id] = true;
                out.push(id);
            }
            if (out.length === 0) out.push('rifle');
            return out;
        }

        function renderSlots() {
            currentLoadout = normalizeLoadout(currentLoadout);
            plasmaToggleBtn.textContent = includePlasma ? 'PLASMA: ENABLED' : 'PLASMA: DISABLED';

            slotsWrap.innerHTML = '';
            var options = getWeaponOptions();
            var slotCount = Math.min(6, Math.max(3, currentLoadout.length));

            for (var i = 0; i < slotCount; i++) {
                var row = document.createElement('div');
                row.className = 'loadout-slot-row';

                var label = document.createElement('label');
                label.textContent = 'Slot ' + (i + 1);
                row.appendChild(label);

                var select = document.createElement('select');
                select.dataset.slotIndex = String(i);

                for (var j = 0; j < options.length; j++) {
                    var id = options[j];
                    var option = document.createElement('option');
                    option.value = id;
                    option.textContent = catalogMap[id] ? catalogMap[id].name : id;
                    select.appendChild(option);
                }

                select.value = currentLoadout[i] || options[0];
                row.appendChild(select);
                slotsWrap.appendChild(row);
            }
        }

        plasmaToggleBtn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            includePlasma = !includePlasma;
            currentLoadout = normalizeLoadout(currentLoadout);
            renderSlots();
        });

        applyBtn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();

            var selects = slotsWrap.querySelectorAll('select');
            var next = [];
            for (var i = 0; i < selects.length; i++) {
                next.push(selects[i].value);
            }
            next = normalizeLoadout(next);
            currentLoadout = next.slice();

            var applied = window.GamePlayer.setLoadout({ slots: next });
            var finalSlots = (applied && applied.slots) ? applied.slots.slice() : next.slice();
            finalSlots = normalizeLoadout(finalSlots);

            window.GameHitscan.setWeaponOrder(finalSlots);

            var currentWeapon = window.GameHitscan.getCurrentWeapon();
            if (finalSlots.indexOf(currentWeapon.id) === -1) {
                currentWeapon = window.GameHitscan.setWeapon(finalSlots[0]);
            }
            applyWeapon(currentWeapon);
            renderSlots();
            setTransientDebug('Loadout applied: ' + finalSlots.join(', '), 1300);
        });

        renderSlots();
    }

    function setupSoundToggleControl() {
        var soundToggleBtn = document.getElementById('sound-toggle-btn');
        if (!soundToggleBtn || !window.GameAudio) return;
        if (!window.GameAudio.setMuted || !window.GameAudio.isMuted) return;

        function refreshLabel() {
            soundToggleBtn.textContent = window.GameAudio.isMuted() ? 'SOUND: OFF' : 'SOUND: ON';
        }

        soundToggleBtn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            var muted = window.GameAudio.setMuted(!window.GameAudio.isMuted());
            refreshLabel();
            setTransientDebug(muted ? 'Sound muted' : 'Sound unmuted', 900);
        });

        refreshLabel();
    }

    function clearArmedThrowablePreview() {
        armedThrowableType = '';
        if (window.GameThrowables && window.GameThrowables.clearTrajectoryPreview) {
            window.GameThrowables.clearTrajectoryPreview();
        }
    }

    function updateArmedThrowablePreview() {
        if (!armedThrowableType) {
            if (window.GameThrowables && window.GameThrowables.clearTrajectoryPreview) {
                window.GameThrowables.clearTrajectoryPreview();
            }
            return;
        }
        if (!hasInputCapture()) {
            if (window.GameThrowables && window.GameThrowables.clearTrajectoryPreview) {
                window.GameThrowables.clearTrajectoryPreview();
            }
            return;
        }
        if (window.GameThrowables && window.GameThrowables.updateTrajectoryPreview) {
            window.GameThrowables.updateTrajectoryPreview(armedThrowableType, camera);
        }
    }

    function tryThrow(type, throwIntentOverride) {
        if (!hasInputCapture()) return null;
        var throwIntent = throwIntentOverride || ((window.GameThrowables && window.GameThrowables.buildThrowIntent)
            ? window.GameThrowables.buildThrowIntent(camera)
            : null);

        if (multiplayerMode && window.GameNet && window.GameNet.sendThrow) {
            var clientThrowId = (window.GameThrowables && window.GameThrowables.buildClientThrowId)
                ? window.GameThrowables.buildClientThrowId()
                : ('cthrow-' + Date.now().toString(36));
            if (window.GameThrowables && window.GameThrowables.throwPredicted) {
                window.GameThrowables.throwPredicted(type, camera, clientThrowId, throwIntent);
            }
            window.GameNet.sendThrow(type, clientThrowId, throwIntent);
            setTransientDebug('Throw sent: ' + type, 650);
            return { ok: true, sent: true };
        }

        var outcome = window.GameThrowables.throw(type, camera, throwIntent);
        window.GameUI.updateThrowableInfo(outcome.state);
        if (outcome.ok && window.GameAudio && window.GameAudio.play) {
            window.GameAudio.play('throw');
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
                        var confirmIntent = (window.GameThrowables && window.GameThrowables.buildThrowIntent)
                            ? window.GameThrowables.buildThrowIntent(camera)
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

    function setupClassControls() {
        var classOrder = window.GameClasses.getOrder();
        var keyToClass = {
            Digit6: classOrder[0],
            Digit7: classOrder[1],
            Digit8: classOrder[2],
            Digit9: classOrder[3],
            Digit0: classOrder[4]
        };

        function triggerClassAbility(slot) {
            if (!hasInputCapture()) return;

            if (multiplayerMode && window.GameNet && window.GameNet.sendClassCast) {
                var castData = null;
                if (window.GameHitscan && window.GameHitscan.peekCenterTarget) {
                    var aim = window.GameHitscan.peekCenterTarget(camera, 90);
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
                window.GameNet.sendClassCast(slot, castData);
                return;
            }

            var playerPos = window.GamePlayer.getPosition();
            var rot = window.GamePlayer.getRotation();
            var outcome = window.GameClasses.triggerAbility(
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
            window.GameUI.updateClassInfo(window.GameClasses.getHudState());
            if (outcome && !outcome.ok && outcome.message) {
                setTransientDebug(outcome.message, 700);
            }
        }

        document.addEventListener('keydown', function (e) {
            if (keyToClass[e.code]) {
                queueClassChange(keyToClass[e.code]);
                return;
            }
            if (e.code === 'KeyE') {
                triggerClassAbility(1);
                return;
            }
            if (e.code === 'KeyR') {
                triggerClassAbility(2);
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
        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        document.body.appendChild(renderer.domElement);

        scene = new THREE.Scene();
        clock = new THREE.Clock();

        window.GameWorld.create(scene);
        window.GameUI.init();
        if (window.GameDocs && window.GameDocs.init) {
            window.GameDocs.init();
        }
        window.GameOverhead.init();

        var plasmaBeamGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(),
            new THREE.Vector3()
        ]);
        var plasmaBeamMaterial = new THREE.LineBasicMaterial({
            color: 0x66ddff,
            transparent: true,
            opacity: 0.9,
            depthTest: false
        });
        plasmaBeamLine = new THREE.Line(plasmaBeamGeometry, plasmaBeamMaterial);
        plasmaBeamLine.visible = false;
        plasmaBeamLine.renderOrder = 24;
        scene.add(plasmaBeamLine);

        if (startupDebugNotice) {
            setTransientDebug(startupDebugNotice, 1800);
            startupDebugNotice = '';
        }

        camera = window.GamePlayer.init(scene);

        multiplayerMode = forceGuestNetMode || !!(window.GameNet && window.GameNet.getCurrentUser && window.GameNet.getCurrentUser());
        window.GameThrowables.init(scene);

        if (multiplayerMode) {
            window.GameNet.init(scene);
        } else {
            var enemyCount = window.GameWorld.getRecommendedEnemyCount ? window.GameWorld.getRecommendedEnemyCount() : DEFAULT_ENEMY_COUNT;
            window.GameEnemy.init(scene, enemyCount);
            window.GameUI.updateThrowableInfo(window.GameThrowables.getState());
        }

        window.GameClasses.init(scene);

        var initialClass = window.GameClasses.getCurrentClass();
        if (multiplayerMode && window.GameNet && window.GameNet.getCurrentUser) {
            var netUser = window.GameNet.getCurrentUser();
            if (netUser && netUser.classId) {
                initialClass = { id: netUser.classId };
            }
        }
        applyClassImmediate(initialClass.id);

        playerHP = playerMaxHP;
        playerArmor = window.GameClasses.getArmorMax ? window.GameClasses.getArmorMax() : 90;
        applyArmorProfile(playerArmor);
        window.GameUI.updateHealth(playerHP, playerMaxHP);
        window.GameUI.updateClassInfo(window.GameClasses.getHudState());

        rebuildWallhackRing(getCurrentWallhackRadius());
        applyDebugVisuals(true);

        applyWeapon(window.GameHitscan.getCurrentWeapon());

        setupPointerLock();
        setupShooting();
        setupWeaponControls();
        setupThrowableControls();
        setupClassControls();
        setupLoadoutControls();
        setupSoundToggleControl();
        setupDocsControls();
        setupDebugKeys();

        window.addEventListener('resize', function () {
            renderer.setSize(window.innerWidth, window.innerHeight);
        });

        animate();
    }

    function animate() {
        requestAnimationFrame(animate);

        var dt = clock.getDelta();
        if (dt > 0.1) dt = 0.1;

        window.GamePlayer.update(dt);

        var currentWeapon = window.GameHitscan.getCurrentWeapon();
        if (currentWeapon && (currentWeapon.id === 'shotgun' || currentWeapon.id === 'plasma')) {
            syncReticleWithWeapon(currentWeapon);
        }

        if (triggerHeld && hasInputCapture() && currentWeapon && currentWeapon.automatic && currentWeapon.id !== 'plasma') {
            tryPlayerFire();
        }

        var plasmaState = window.GameHitscan.updatePlasmaBeam(dt, camera, {
            triggerHeld: triggerHeld && hasInputCapture(),
            onLocalTick: function (target, damage) {
                if (multiplayerMode) return;
                if (!target || target.ownerType !== 'enemy' || !target.hitbox) return;
                if (!window.GameEnemy || !window.GameEnemy.damage) return;
                var result = window.GameEnemy.damage(target.hitbox, damage);
                if (!result) return;
                var hitPoint = target.worldPos ? target.worldPos.clone() : target.hitbox.position.clone();
                handleEnemyHit(hitPoint, damage, 'body', result);
            },
            onNetTick: function (targetId) {
                if (!multiplayerMode || !window.GameNet || !window.GameNet.sendPlasmaTick) return;
                if (typeof targetId !== 'string' || targetId.indexOf('net:') !== 0) return;
                window.GameNet.sendPlasmaTick(targetId.slice(4));
            }
        });
        if (window.GameHitscan.updateTracers) {
            window.GameHitscan.updateTracers(dt);
        }
        if (plasmaState.active && !lastPlasmaActive && window.GameAudio && window.GameAudio.play) {
            window.GameAudio.play('plasma');
        }
        lastPlasmaActive = !!plasmaState.active;
        window.GameUI.updatePlasmaState(plasmaState);
        if (plasmaBeamLine) {
            if (plasmaState && plasmaState.active) {
                setBeamLinePoints(plasmaBeamLine, plasmaState.beamStart, plasmaState.beamEnd);
                plasmaBeamLine.visible = true;
                plasmaBeamLine.material.opacity = plasmaState.overheated ? 0.2 : 0.9;
            } else {
                plasmaBeamLine.visible = false;
            }
        }

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

        var playerPos = window.GamePlayer.getPosition();
        var playerRot = window.GamePlayer.getRotation();
        if (wallhackRing) {
            wallhackRing.position.set(playerPos.x, 0.06, playerPos.z);
        }

        updateArmedThrowablePreview();

        if (multiplayerMode) {
            window.GameNet.update(dt, playerPos, playerRot);
            var selfState = window.GameNet.getSelfState();
            if (selfState) {
                var currentClass = window.GameClasses.getCurrentClass();
                if (selfState.classId && (!currentClass || currentClass.id !== selfState.classId)) {
                    applyClassImmediate(selfState.classId);
                }
                if (selfState.queuedClassId) {
                    window.GameClasses.queueClass(selfState.queuedClassId);
                } else if (window.GameClasses.clearQueuedClass) {
                    window.GameClasses.clearQueuedClass();
                }

                playerHP = selfState.hp;
                playerMaxHP = selfState.hpMax;
                playerArmor = selfState.armor;
                playerArmorMax = selfState.armorMax;
                window.GameUI.updateHealth(playerHP, playerMaxHP);
                window.GameUI.updateArmor(playerArmor, playerArmorMax);
                syncWallhackRingRadius();
                if (window.GameThrowables && window.GameThrowables.setNetworkInventoryState) {
                    window.GameThrowables.setNetworkInventoryState(selfState.throwables || null);
                    window.GameUI.updateThrowableInfo(window.GameThrowables.getState());
                }
            }

            if (window.GameNet.consumeClassCastResult) {
                var castResult = null;
                do {
                    castResult = window.GameNet.consumeClassCastResult();
                    if (castResult) {
                        if (castResult.t === 'class_cast_ok') {
                            setTransientDebug((castResult.kind || 'Ability') + ' cast!', 800);
                        } else if (castResult.t === 'class_cast_reject') {
                            setTransientDebug('Ability failed: ' + (castResult.reason || 'rejected'), 700);
                        }
                    }
                } while (castResult);
            }

            if (window.GameNet.consumeDamageFeedback) {
                var damageFeedback = null;
                do {
                    damageFeedback = window.GameNet.consumeDamageFeedback();
                    if (damageFeedback) {
                        handleNetworkDamageFeedback(damageFeedback);
                    }
                } while (damageFeedback);
            }

            if (window.GameNet.getSelfAbilityState) {
                var abilityState = window.GameNet.getSelfAbilityState();
                if (abilityState) {
                    var hudState = window.GameClasses.getHudState();
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
                    window.GameUI.updateClassInfo(hudState);
                }
            }

            var notice = window.GameNet.consumeNotice();
            if (notice) setTransientDebug(notice, 900);

            if (window.GameNet.consumeThrowAck && window.GameThrowables && window.GameThrowables.confirmPredictedThrow) {
                var throwAck = null;
                do {
                    throwAck = window.GameNet.consumeThrowAck();
                    if (throwAck && throwAck.clientThrowId) {
                        window.GameThrowables.confirmPredictedThrow(throwAck.clientThrowId);
                    }
                } while (throwAck);
            }

            if (window.GameNet.consumeThrowReject && window.GameThrowables && window.GameThrowables.rejectPredictedThrow) {
                var throwReject = null;
                do {
                    throwReject = window.GameNet.consumeThrowReject();
                    if (throwReject && throwReject.clientThrowId) {
                        window.GameThrowables.rejectPredictedThrow(throwReject.clientThrowId);
                    }
                } while (throwReject);
            }

            if (window.GameNet.getAuthoritativeThrowableState && window.GameThrowables && window.GameThrowables.syncAuthoritativeState) {
                window.GameThrowables.syncAuthoritativeState(
                    window.GameNet.getAuthoritativeThrowableState(),
                    selfState ? selfState.id : ''
                );
            }

            if (window.GameNet.consumeThrowableEvent && window.GameThrowables && window.GameThrowables.applyNetworkEvent) {
                var throwEvent = null;
                do {
                    throwEvent = window.GameNet.consumeThrowableEvent();
                    if (throwEvent) window.GameThrowables.applyNetworkEvent(throwEvent);
                } while (throwEvent);
            }

            window.GameThrowables.update(dt, function () {});
        } else {
            window.GameClasses.update(
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

            window.GameEnemy.update(dt, playerPos, camera, function (damage, hitType, attackerEnemy) {
                consumePlayerDamage(damage, hitType, attackerEnemy);
            });

            window.GameThrowables.update(dt, function (hitData) {
                if (!hitData || !hitData.result) return;
                handleEnemyHit(hitData.hitPoint, hitData.damage, hitData.hitType, hitData.result);
            });

            window.GameUI.updateThrowableInfo(window.GameThrowables.getState());
            window.GameUI.updateHealth(playerHP, playerMaxHP);
            window.GameUI.updateArmor(playerArmor, playerArmorMax);
        }

        currentAimTargetId = '';
        var centerTarget = window.GameHitscan.peekCenterTarget(camera, 220);
        if (centerTarget && centerTarget.targetId) {
            currentAimTargetId = centerTarget.targetId;
        }

        window.GameOverhead.update(camera, playerPos, currentAimTargetId);
        if (window.GameUI.updateCombatRadar || window.GameUI.updateCombatBeacons) {
            var awarenessState = buildAwarenessState(playerPos, playerRot ? playerRot.yaw : 0);
            if (window.GameUI.updateCombatRadar) {
                window.GameUI.updateCombatRadar(awarenessState);
            }
            if (window.GameUI.updateCombatBeacons) {
                window.GameUI.updateCombatBeacons(awarenessState.beacons);
            }
        }

        var cdRemaining = window.GameHitscan.cooldownRemaining();
        var cdTotal = window.GameHitscan.getCooldown();
        var cdReady = cdRemaining <= 0;
        var cdPct = cdReady ? 1 : (1 - cdRemaining / cdTotal);

        window.GameUI.updateCooldown(cdReady, cdPct);
        window.GameUI.updateDamageEffects(dt);
        if (!multiplayerMode) {
            window.GameUI.updateClassInfo(window.GameClasses.getHudState());
        }

        var currentClassForReticle = window.GameClasses.getCurrentClass();
        if (window.GameUI.updateChokeReticle) {
            window.GameUI.updateChokeReticle(
                currentClassForReticle && currentClassForReticle.id === 'jedi',
                190
            );
        }
        if (window.GameUI.updateDeadeyeReticle) {
            var deadeyeStateForUi = null;
            if (multiplayerMode && window.GameNet && window.GameNet.getSelfAbilityState) {
                var abilState = window.GameNet.getSelfAbilityState();
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
                        var markerPos = (window.GameNet.getEntityMarkerWorldPos)
                            ? window.GameNet.getEntityMarkerWorldPos(targetId)
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
            } else if (window.GameClasses && window.GameClasses.getDeadeyeState) {
                var localDeadeye = window.GameClasses.getDeadeyeState();
                if (localDeadeye) {
                    deadeyeStateForUi = localDeadeye;
                }
            }
            window.GameUI.updateDeadeyeReticle(camera, deadeyeStateForUi);
        }
        if (window.GameUI.updateSeekerDebugInfo) {
            var showSeekerDebug = !!wallhackRingVisible && currentWeapon && currentWeapon.id === 'seekergun';
            var seekerTelemetry = null;
            var seekerTuning = null;
            if (showSeekerDebug && window.GameHitscan.getSeekergunDebugInfo) {
                seekerTelemetry = window.GameHitscan.getSeekergunDebugInfo(camera);
            }
            if (showSeekerDebug && window.GameThrowables && window.GameThrowables.getSeekerShotTuning) {
                seekerTuning = window.GameThrowables.getSeekerShotTuning();
            }
            window.GameUI.updateSeekerDebugInfo(showSeekerDebug, seekerTelemetry, seekerTuning, {
                fov: camera && camera.fov ? camera.fov : 60,
                aspect: camera && camera.aspect ? camera.aspect : (window.innerWidth / Math.max(1, window.innerHeight))
            });
        }

        renderer.render(scene, camera);
    }

    function isLocalDevMode() {
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
        try {
            var params = new URLSearchParams(window.location.search || '');
            return params.get('net') === '1';
        } catch (err) {
            return false;
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
        var singleplayerBtn = document.getElementById('mode-singleplayer-btn');
        var modeSubtitle = document.getElementById('mode-subtitle');
        var playBtn = document.getElementById('play-btn');
        var started = false;

        function startWithMode(mode) {
            if (started) return;
            started = true;

            if (modeButtonsWrap) modeButtonsWrap.style.display = 'none';
            if (playBtn) playBtn.style.display = 'none';
            if (multiplayerBtn) multiplayerBtn.disabled = true;
            if (singleplayerBtn) singleplayerBtn.disabled = true;
            if (modeSubtitle) {
                modeSubtitle.textContent = mode === 'multiplayer'
                    ? 'Starting shared multiplayer room...'
                    : 'Starting singleplayer...';
            }

            autoStartNoLock = true;

            if (mode === 'multiplayer') {
                forceGuestNetMode = true;
                if (window.GameNet && window.GameNet.enableGuestMode) {
                    window.GameNet.enableGuestMode();
                }
                startupDebugNotice = 'Guest multiplayer mode: shared global room.';
            } else {
                forceGuestNetMode = false;
                startupDebugNotice = 'Single-player mode: local bots only.';
            }

            safeInit();
        }

        if (multiplayerBtn) {
            multiplayerBtn.addEventListener('click', function () {
                startWithMode('multiplayer');
            });
        }
        if (singleplayerBtn) {
            singleplayerBtn.addEventListener('click', function () {
                startWithMode('singleplayer');
            });
        }

        if (wantsGuestNetMode()) {
            startWithMode('multiplayer');
            return;
        }

        if (!multiplayerBtn || !singleplayerBtn) {
            startWithMode(isLocalDevMode() ? 'singleplayer' : 'multiplayer');
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
