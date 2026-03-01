/**
 * main.js - Game orchestration for single-player and Cloudflare multiplayer modes
 */
(function () {
    'use strict';

    var renderer, scene, clock, camera;
    var overlay;

    var isPlaying = false;
    var triggerHeld = false;
    var PRIM = globalThis.__GAME_PRIMITIVES__ || {};
    var COMBAT_PRIM = PRIM.combat || {};
    var CLASS_PRESETS = COMBAT_PRIM.class_presets || {};
    var BASE_MAX_HP = Number(COMBAT_PRIM.max_hp || 500);
    var ARMOR_REGEN_DELAY_SEC = Number(COMBAT_PRIM.armor_regen_delay_sec || 6);
    var ARMOR_REGEN_PER_SEC = Number(COMBAT_PRIM.armor_regen_per_sec || 12);

    var playerHP = BASE_MAX_HP;
    var playerMaxHP = BASE_MAX_HP;
    var playerArmor = (CLASS_PRESETS.sharpshooter && CLASS_PRESETS.sharpshooter.armorMax) || 90;
    var playerArmorMax = playerArmor;
    var armorRegenDelay = 0;

    var respawnInvulnTimer = 0;
    var debugTimer = null;

    var wallhackRing = null;
    var wallhackRingRadius = 0;
    var wallhackRingVisible = true;
    var plasmaBeamLine = null;

    var DEFAULT_ENEMY_COUNT = 5;
    var DEFAULT_ARMOR_REGEN_DELAY = ARMOR_REGEN_DELAY_SEC;

    var currentAimTargetId = '';
    var multiplayerMode = false;
    var startupDebugNotice = '';
    var bootWorldManifest = null;

    function cameraModeLabel(mode) {
        return mode === 'third' ? 'CAM: THIRD' : 'CAM: FIRST';
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
        if (window.GameUIShell && window.GameUIShell.canAcceptGameplayInput) {
            return window.GameUIShell.canAcceptGameplayInput();
        }
        return !!document.pointerLockElement || !!window.__gameNoLockInput;
    }

    function shouldIgnoreKeyboardEvent(e) {
        if (!e) return false;
        var target = e.target;
        if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/i.test(target.tagName || ''))) {
            return true;
        }
        if (window.GameUIShell && window.GameUIShell.isTextInputFocused && window.GameUIShell.isTextInputFocused()) {
            return true;
        }
        return false;
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

        if (window.GamePlayer && window.GamePlayer.setCollisionDebugVisible) {
            window.GamePlayer.setCollisionDebugVisible(!!visible);
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

        if (window.GameRules && window.GameClasses && window.GameClasses.getCurrentClass && window.GameRules.canEquip) {
            var cls = window.GameClasses.getCurrentClass();
            var classId = cls && cls.id ? cls.id : 'sharpshooter';
            var gate = window.GameRules.canEquip(classId, weapon.id);
            if (!gate.ok) {
                setTransientDebug(gate.reason || ('Cannot equip ' + weapon.name + ' for class ' + classId), 1100);
                return;
            }
            if (gate.warn && gate.reason) {
                setTransientDebug('Soft policy: ' + gate.reason, 1200);
            }
        }

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

        var defaultWeapon = selected.loadoutWeapon;
        if (window.GameRules && window.GameRules.getClassDefaultWeapon) {
            defaultWeapon = window.GameRules.getClassDefaultWeapon(selected.id || classId);
        }

        if (defaultWeapon) {
            var equipped = null;
            if (window.GameLoadout && window.GameLoadout.equipWeapon) {
                equipped = window.GameLoadout.equipWeapon(defaultWeapon);
            }
            if (!equipped && window.GameHitscan && window.GameHitscan.setWeapon) {
                equipped = window.GameHitscan.setWeapon(defaultWeapon);
            }
            applyWeapon(equipped);
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

    function setupPerspectiveControls() {
        var btn = document.getElementById('camera-toggle');

        function syncButton() {
            if (!btn) return;
            btn.textContent = cameraModeLabel(window.GamePlayer.getPerspective());
        }

        function togglePerspective() {
            var mode = window.GamePlayer.togglePerspective();
            syncButton();
            syncReticleWithWeapon(window.GameHitscan.getCurrentWeapon());
            setTransientDebug(mode === 'third' ? 'Third-person camera' : 'First-person camera', 800);
        }

        if (btn) {
            btn.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                togglePerspective();
            });
        }

        document.addEventListener('keydown', function (e) {
            if (shouldIgnoreKeyboardEvent(e)) return;
            if (e.code === 'KeyC') togglePerspective();
        });

        syncButton();
    }

    function handleEnemyHit(hitPoint, damage, hitType, result) {
        if (!result) return;

        if (result.killed) {
            window.GameUI.showKillMarker();
            window.GameUI.addKill();
            window.GameUI.showDamageNumber(hitPoint, damage, true, camera, hitType);
        } else {
            window.GameUI.showHitMarker();
            window.GameUI.showDamageNumber(hitPoint, damage, false, camera, hitType);
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
                var queuedDefaultWeapon = applied.loadoutWeapon;
                if (window.GameRules && window.GameRules.getClassDefaultWeapon) {
                    queuedDefaultWeapon = window.GameRules.getClassDefaultWeapon(applied.id);
                }
                if (queuedDefaultWeapon) {
                    var queuedEquipped = null;
                    if (window.GameLoadout && window.GameLoadout.equipWeapon) {
                        queuedEquipped = window.GameLoadout.equipWeapon(queuedDefaultWeapon);
                    }
                    if (!queuedEquipped) {
                        queuedEquipped = window.GameHitscan.setWeapon(queuedDefaultWeapon);
                    }
                    applyWeapon(queuedEquipped);
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
        var fired = window.GameHitscan.fire(
            camera,
            function (hitboxMesh, hitPoint, distance, hitType, damage, weapon) {
                if (window.GameClasses && window.GameClasses.modifyOutgoingDamage) {
                    damage = window.GameClasses.modifyOutgoingDamage(damage, hitType, weapon ? weapon.id : '');
                }

                if (multiplayerMode && hitboxMesh && hitboxMesh.userData && hitboxMesh.userData.ownerType === 'net') {
                    if (window.GameNet && window.GameNet.sendFire) {
                        window.GameNet.sendFire(hitboxMesh, weapon ? weapon.id : 'rifle', hitType);
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
        }
    }

    function setupPointerLock() {
        overlay = document.getElementById('overlay');
        var playBtn = document.getElementById('play-btn');
        var lastStartRequest = 0;
        window.__gameNoLockInput = false;

        function applyPendingWeaponIfAny() {
            if (!window.GameLoadout || !window.GameLoadout.applyPendingWeaponOnResume) return;
            var pendingWeapon = window.GameLoadout.applyPendingWeaponOnResume();
            if (pendingWeapon) {
                applyWeapon(pendingWeapon);
                setTransientDebug('Equipped on resume: ' + pendingWeapon.name, 900);
            }
        }

        function enterFallbackStart(debugText) {
            window.__gameNoLockInput = true;
            if (window.GameUIShell && window.GameUIShell.hideOverlay) window.GameUIShell.hideOverlay();
            else if (overlay) overlay.style.display = 'none';
            applyPendingWeaponIfAny();
            isPlaying = true;
            if (debugText) {
                setTransientDebug(debugText, 2200);
            }
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
            if (window.GameUIShell && window.GameUIShell.isManualOpen && window.GameUIShell.isManualOpen()) {
                window.GameUIShell.closeManual();
            } else if (window.GameDocs && window.GameDocs.isOpen && window.GameDocs.isOpen()) {
                window.GameDocs.close();
            }

            // Enter gameplay immediately; pointer lock is best-effort.
            enterFallbackStart();

            var target = renderer && renderer.domElement;
            if (!target) {
                return;
            }
            var requestLock = target.requestPointerLock || target.webkitRequestPointerLock || target.mozRequestPointerLock;
            if (typeof requestLock !== 'function') {
                setTransientDebug('Pointer lock API unavailable. Using fallback input mode.', 2200);
                return;
            }
            try {
                var maybePromise = requestLock.call(target);
                if (maybePromise && typeof maybePromise.then === 'function' && typeof maybePromise.catch === 'function') {
                    maybePromise.catch(function () {
                        if (!document.pointerLockElement) {
                            setTransientDebug('Pointer lock denied. Using fallback input mode.', 2200);
                        }
                    });
                }
            } catch (err) {
                setTransientDebug('Pointer lock failed. Using fallback input mode.', 2200);
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
                window.__gameNoLockInput = false;
                if (window.GameUIShell && window.GameUIShell.closeManual) window.GameUIShell.closeManual();
                else if (window.GameDocs && window.GameDocs.close) window.GameDocs.close();
                if (window.GameUIShell && window.GameUIShell.hideOverlay) window.GameUIShell.hideOverlay();
                else if (overlay) overlay.style.display = 'none';
                applyPendingWeaponIfAny();
                isPlaying = true;
            } else {
                if (!window.__gameNoLockInput) {
                    if (window.GameUIShell && window.GameUIShell.showOverlay) window.GameUIShell.showOverlay();
                    else if (overlay) overlay.style.display = 'flex';
                    isPlaying = false;
                }
            }
        });

        document.addEventListener('pointerlockerror', function () {
            if (!document.pointerLockElement) {
                enterFallbackStart('Pointer lock error. Using fallback input mode.');
            }
        });

        document.addEventListener('keydown', function (e) {
            if (shouldIgnoreKeyboardEvent(e)) return;
            if (e.code === 'Escape' && window.__gameNoLockInput) {
                window.__gameNoLockInput = false;
                if (window.GameUIShell && window.GameUIShell.showOverlay) window.GameUIShell.showOverlay();
                else if (overlay) overlay.style.display = 'flex';
                isPlaying = false;
            }
        });
    }

    function setupDocsControls() {
        document.addEventListener('keydown', function (e) {
            if (shouldIgnoreKeyboardEvent(e)) return;
            if (e.code === 'KeyI') {
                if (window.GameUIShell && window.GameUIShell.toggleManual) {
                    e.preventDefault();
                    window.GameUIShell.toggleManual();
                } else if (window.GameDocs && window.GameDocs.toggle) {
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
            if (shouldIgnoreKeyboardEvent(e)) return;
            if (e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'Digit3' || e.code === 'Digit4' || e.code === 'Digit5') {
                var idx = parseInt(e.code.replace('Digit', ''), 10) - 1;
                var equipped = null;
                if (window.GameLoadout && window.GameLoadout.equipSlot) {
                    equipped = window.GameLoadout.equipSlot(idx);
                } else if (window.GameHitscan && window.GameHitscan.equipSlot) {
                    equipped = window.GameHitscan.equipSlot(idx);
                }
                if (equipped) applyWeapon(equipped);
                return;
            }

            if (e.code === 'KeyT') {
                var tEquipped = null;
                if (window.GameLoadout && window.GameLoadout.equipSlot) tEquipped = window.GameLoadout.equipSlot(5);
                else if (window.GameHitscan && window.GameHitscan.equipSlot) tEquipped = window.GameHitscan.equipSlot(5);
                if (tEquipped) applyWeapon(tEquipped);
            }
        });

        document.addEventListener('wheel', function (e) {
            if (!hasInputCapture()) return;
            e.preventDefault();
            var nextWeapon = null;
            if (window.GameLoadout && window.GameLoadout.cycle) {
                nextWeapon = window.GameLoadout.cycle(e.deltaY > 0 ? 1 : -1);
            } else if (window.GameHitscan && window.GameHitscan.cycleWeapon) {
                nextWeapon = window.GameHitscan.cycleWeapon(e.deltaY > 0 ? 1 : -1);
            }
            applyWeapon(nextWeapon);
        }, { passive: false });
    }

    function setupLoadoutControls() {
        var weaponWrap = document.getElementById('loadout-weapon-buttons');
        var classWrap = document.getElementById('loadout-class-buttons');
        var applyBtn = document.getElementById('loadout-apply');
        var plasmaToggleBtn = document.getElementById('loadout-plasma-toggle');
        if (!weaponWrap || !classWrap || !applyBtn || !plasmaToggleBtn) return;

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
        var currentLoadout = (window.GameLoadout && window.GameLoadout.getSlots)
            ? window.GameLoadout.getSlots()
            : window.GameHitscan.getWeaponOrder();
        var pendingWeapon = (window.GameLoadout && window.GameLoadout.getPendingWeapon)
            ? window.GameLoadout.getPendingWeapon()
            : '';
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

        function filteredLoadout() {
            return normalizeLoadout(currentLoadout);
        }

        function renderWeaponButtons() {
            currentLoadout = normalizeLoadout(currentLoadout);
            plasmaToggleBtn.textContent = includePlasma ? 'PLASMA: ENABLED' : 'PLASMA: DISABLED';

            weaponWrap.innerHTML = '';
            var selected = window.GameHitscan.getCurrentWeapon ? window.GameHitscan.getCurrentWeapon() : null;
            var selectedId = selected ? selected.id : '';
            var list = filteredLoadout();

            for (var i = 0; i < list.length; i++) {
                var id = list[i];
                var btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'loadout-choice-btn';
                if (id === selectedId) btn.classList.add('active');
                if (id === pendingWeapon) btn.classList.add('pending');
                btn.dataset.weaponId = id;
                btn.textContent = 'SLOT ' + (i + 1) + ': ' + ((catalogMap[id] && catalogMap[id].name) ? catalogMap[id].name : id);
                btn.addEventListener('click', function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    var wid = this.dataset.weaponId;
                    pendingWeapon = wid;
                    if (window.GameLoadout && window.GameLoadout.setPendingWeapon) {
                        var set = window.GameLoadout.setPendingWeapon(wid);
                        if (!set.ok) {
                            setTransientDebug(set.reason || ('Cannot queue weapon ' + wid), 900);
                            return;
                        }
                    }
                    setTransientDebug('Pending weapon for resume: ' + wid, 900);
                    renderWeaponButtons();
                });
                weaponWrap.appendChild(btn);
            }
        }

        function renderClassButtons() {
            classWrap.innerHTML = '';
            var classes = window.GameClasses && window.GameClasses.getCatalog ? window.GameClasses.getCatalog() : [];
            var hud = window.GameClasses && window.GameClasses.getHudState ? window.GameClasses.getHudState() : null;
            var queued = hud && hud.queuedClassId ? hud.queuedClassId : '';
            var classKeys = ['6', '7', '8', '9', '0'];
            for (var i = 0; i < classes.length; i++) {
                var c = classes[i];
                var btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'loadout-choice-btn';
                if (queued && c.id === queued) btn.classList.add('active');
                btn.dataset.classId = c.id;
                btn.textContent = c.name + ' (KEY ' + (classKeys[i] || '-') + ')';
                btn.addEventListener('click', function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    var classId = this.dataset.classId;
                    queueClassChange(classId);
                    renderClassButtons();
                });
                classWrap.appendChild(btn);
            }
        }

        plasmaToggleBtn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            includePlasma = !includePlasma;
            currentLoadout = normalizeLoadout(currentLoadout);
            renderWeaponButtons();
        });

        applyBtn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();

            var next = normalizeLoadout(filteredLoadout());
            currentLoadout = next.slice();

            var applied = window.GameLoadout && window.GameLoadout.setSlots
                ? window.GameLoadout.setSlots(next)
                : window.GamePlayer.setLoadout({ slots: next });
            var finalSlots = (applied && applied.slots) ? applied.slots.slice() : next.slice();
            finalSlots = normalizeLoadout(finalSlots);

            var currentWeapon = window.GameHitscan.getCurrentWeapon();
            if (finalSlots.indexOf(currentWeapon.id) === -1) {
                if (window.GameLoadout && window.GameLoadout.equipSlot) {
                    currentWeapon = window.GameLoadout.equipSlot(0);
                } else {
                    currentWeapon = window.GameHitscan.setWeapon(finalSlots[0]);
                }
            }
            applyWeapon(currentWeapon);
            renderWeaponButtons();
            setTransientDebug('Loadout applied: ' + finalSlots.join(', '), 1300);
        });

        renderWeaponButtons();
        renderClassButtons();
    }

    function tryThrow(type) {
        if (!hasInputCapture()) return;

        if (multiplayerMode && window.GameNet && window.GameNet.sendThrow) {
            window.GameNet.sendThrow(type);
            setTransientDebug('Throw sent: ' + type, 650);
            return;
        }

        var outcome = window.GameThrowables.throw(type, camera);
        window.GameUI.updateThrowableInfo(outcome.state);
        if (!outcome.ok && outcome.reason === 'cooldown') {
            setTransientDebug(type + ' is recharging.', 600);
        }
    }

    function setupThrowableControls() {
        document.addEventListener('keydown', function (e) {
            if (shouldIgnoreKeyboardEvent(e)) return;
            switch (e.code) {
                case 'KeyG': tryThrow('frag'); break;
                case 'KeyV': tryThrow('seeker'); break;
                case 'KeyB': tryThrow('molotov'); break;
                case 'KeyQ': tryThrow('knife'); break;
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
            if (multiplayerMode) {
                setTransientDebug('Abilities are local-only right now in net mode.', 900);
                return;
            }

            if (!hasInputCapture()) return;

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
            if (shouldIgnoreKeyboardEvent(e)) return;
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
            if (shouldIgnoreKeyboardEvent(e)) return;
            if (e.code !== 'KeyH') return;
            applyDebugVisuals(!wallhackRingVisible);
            setTransientDebug(wallhackRingVisible ? 'Dev visuals: ON' : 'Dev visuals: OFF', 1100);
        });
    }

    function initGame() {
        if (window.GameUIShell && window.GameUIShell.init) {
            window.GameUIShell.init();
        }

        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        document.body.appendChild(renderer.domElement);

        scene = new THREE.Scene();
        clock = new THREE.Clock();

        var worldManifest = bootWorldManifest;
        if (!worldManifest && window.GameNet && window.GameNet.getWorldManifest) {
            worldManifest = window.GameNet.getWorldManifest();
        }
        window.GameWorld.create(scene, worldManifest || null);
        window.GameUI.init();
        if (window.GameDocs && window.GameDocs.init) {
            window.GameDocs.init();
        }
        window.GameOverhead.init();
        if (window.GameWallhack && window.GameWallhack.init) {
            window.GameWallhack.init(scene);
            window.GameWallhack.setEnabled(true);
        }

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

        multiplayerMode = !!(window.GameNet && window.GameNet.getCurrentUser && window.GameNet.getCurrentUser());

        if (multiplayerMode) {
            window.GameNet.init(scene);
        } else {
            var enemyCount = window.GameWorld.getRecommendedEnemyCount ? window.GameWorld.getRecommendedEnemyCount() : DEFAULT_ENEMY_COUNT;
            window.GameEnemy.init(scene, enemyCount);
            window.GameThrowables.init(scene);
            window.GameUI.updateThrowableInfo(window.GameThrowables.getState());
        }

        window.GameClasses.init(scene);
        if (window.GameLoadout && window.GameLoadout.init) {
            window.GameLoadout.init();
        }

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
        setupPerspectiveControls();
        setupLoadoutControls();
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

        var playerEyePos = window.GamePlayer.getEyePosition
            ? window.GamePlayer.getEyePosition()
            : window.GamePlayer.getPosition();
        var playerFeetPos = window.GamePlayer.getFeetPosition
            ? window.GamePlayer.getFeetPosition()
            : playerEyePos;
        if (wallhackRing) {
            wallhackRing.position.set(playerFeetPos.x, 0.06, playerFeetPos.z);
        }

        if (window.GameWallhack && window.GameWallhack.syncEntities && window.GameWallhack.update) {
            var wallhackDescriptors = [];
            if (window.GameEnemy && window.GameEnemy.getWallhackDescriptors) {
                wallhackDescriptors = wallhackDescriptors.concat(window.GameEnemy.getWallhackDescriptors());
            }
            if (window.GameNet && window.GameNet.getWallhackDescriptors) {
                wallhackDescriptors = wallhackDescriptors.concat(window.GameNet.getWallhackDescriptors());
            }
            window.GameWallhack.syncEntities(wallhackDescriptors);
            window.GameWallhack.update(camera, playerFeetPos, getCurrentWallhackRadius());
        }

        if (multiplayerMode) {
            window.GameNet.update(dt, playerFeetPos, window.GamePlayer.getRotation());
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
            }

            var notice = window.GameNet.consumeNotice();
            if (notice) setTransientDebug(notice, 900);
        } else {
            window.GameClasses.update(
                dt,
                camera,
                playerEyePos,
                window.GamePlayer.getRotation(),
                function (hitData) {
                    if (!hitData || !hitData.result) return;
                    handleEnemyHit(hitData.hitPoint, hitData.damage, hitData.hitType, hitData.result);
                },
                setTransientDebug
            );

            window.GameEnemy.update(dt, playerEyePos, camera, function (damage, hitType, attackerEnemy) {
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

        window.GameOverhead.update(camera, playerFeetPos, currentAimTargetId);

        var cdRemaining = window.GameHitscan.cooldownRemaining();
        var cdTotal = window.GameHitscan.getCooldown();
        var cdReady = cdRemaining <= 0;
        var cdPct = cdReady ? 1 : (1 - cdRemaining / cdTotal);

        window.GameUI.updateCooldown(cdReady, cdPct);
        window.GameUI.updateDamageEffects(dt);
        window.GameUI.updateClassInfo(window.GameClasses.getHudState());

        renderer.render(scene, camera);
    }

    function isLocalDevMode() {
        try {
            var params = new URLSearchParams(window.location.search || '');
            if (params.get('local') === '1' || params.get('offline') === '1') return true;
            if (params.get('net') === '1') return false;
        } catch (err) {
            // URL parsing failed; continue with protocol fallback.
        }
        return window.location.protocol === 'file:';
    }

    function boot() {
        function safeInit() {
            try {
                initGame();
            } catch (err) {
                var msg = (err && err.message) ? err.message : String(err || 'Unknown startup error');
                var overlayEl = document.getElementById('overlay');
                if (window.GameUIShell && window.GameUIShell.showOverlay) window.GameUIShell.showOverlay();
                else if (overlayEl) overlayEl.style.display = 'flex';
                var dbg = document.getElementById('debug-info');
                if (dbg) dbg.textContent = 'Startup error: ' + msg;
                console.error('Startup error:', err);
            }
        }

        if (!isLocalDevMode() && window.GameNet && window.GameNet.requireAuth) {
            window.GameNet.requireAuth(function (authedUser) {
                if (authedUser && window.GameNet.fetchWorldManifest) {
                    window.GameNet.fetchWorldManifest()
                        .then(function (manifest) {
                            bootWorldManifest = manifest || null;
                        })
                        .catch(function (err) {
                            bootWorldManifest = null;
                            var msg = (err && err.message) ? err.message : 'unknown';
                            startupDebugNotice = 'World manifest unavailable; using local fallback (' + msg + ').';
                        })
                        .finally(function () {
                            safeInit();
                        });
                    return;
                }
                bootWorldManifest = null;
                safeInit();
            });
            return;
        }
        bootWorldManifest = null;
        startupDebugNotice = 'Local dev mode: backend auth/multiplayer disabled.';
        safeInit();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
