/**
 * main.js - Game orchestration for single-player and Cloudflare multiplayer modes
 */
(function () {
    'use strict';

    var renderer, scene, clock, camera;
    var overlay;

    var isPlaying = false;
    var triggerHeld = false;

    var debugTimer = null;

    var debugVisualsOn = true;

    var DEFAULT_ENEMY_COUNT = 5;
    var MAX_PIXEL_RATIO = 1.75;

    var currentAimTargetId = '';
    var multiplayerMode = false;
    var forceGuestNetMode = false;
    var forcedRoomId = 'global';
    var activeRuntimeMode = null;
    var startupDebugNotice = '';
    var autoStartNoLock = false;
    var armedThrowableType = '';
    var lastPlasmaActive = false;
    var netShotCounter = 0;
    var MENU_LOADOUT_DEFAULT = ['machinegun', 'shotgun'];
    var MENU_LOADOUT_ALLOWED = ['machinegun', 'shotgun', 'rifle', 'pistol', 'seekergun'];
    var menuWeaponSlots = MENU_LOADOUT_DEFAULT.slice();
    var menuActiveSlot = 0;
    var runtimeInitialized = false;

    function depGet(name) {
        return globalThis.__MAYHEM_RUNTIME[name];
    }

    function depRequire(name) {
        return globalThis.__MAYHEM_RUNTIME[name];
    }

    function cappedPixelRatio() {
        return Math.min(MAX_PIXEL_RATIO, Math.max(1, Number(window.devicePixelRatio) || 1));
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

    function applyDebugVisuals(visible) {
        debugVisualsOn = !!visible;

        if (globalThis.__MAYHEM_RUNTIME.GameUI && globalThis.__MAYHEM_RUNTIME.GameUI.setDebugVisuals) {
            globalThis.__MAYHEM_RUNTIME.GameUI.setDebugVisuals(!!visible);
        }

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

    function availableMenuWeaponIds() {
        var ids = [];
        var available = {};
        if (globalThis.__MAYHEM_RUNTIME.GameHitscan && globalThis.__MAYHEM_RUNTIME.GameHitscan.getAllWeaponIds) {
            var all = globalThis.__MAYHEM_RUNTIME.GameHitscan.getAllWeaponIds() || [];
            for (var n = 0; n < all.length; n++) {
                var id = String(all[n] || '');
                if (!id) continue;
                available[id] = true;
            }
        }
        var hasDiscoveredCatalog = false;
        for (var key in available) {
            if (Object.prototype.hasOwnProperty.call(available, key)) {
                hasDiscoveredCatalog = true;
                break;
            }
        }

        for (var i = 0; i < MENU_LOADOUT_ALLOWED.length; i++) {
            var allowedId = MENU_LOADOUT_ALLOWED[i];
            if (available[allowedId] || !hasDiscoveredCatalog) {
                ids.push(allowedId);
            }
        }

        if (ids.length === 0) {
            ids = MENU_LOADOUT_DEFAULT.slice();
        }

        return ids;
    }

    function weaponNameLookup() {
        var out = {
            rifle: 'Rifle',
            pistol: 'Pistol',
            machinegun: 'Machine Gun',
            shotgun: 'Shotgun',
            seekergun: 'Needler'
        };
        if (globalThis.__MAYHEM_RUNTIME.GameHitscan && globalThis.__MAYHEM_RUNTIME.GameHitscan.getWeaponCatalog) {
            var catalog = globalThis.__MAYHEM_RUNTIME.GameHitscan.getWeaponCatalog() || [];
            for (var i = 0; i < catalog.length; i++) {
                var item = catalog[i];
                if (!item || !item.id || !item.name) continue;
                out[item.id] = item.name;
            }
        }
        return out;
    }

    function normalizeMenuWeaponSlots() {
        var available = availableMenuWeaponIds();
        var availableMap = {};
        for (var i = 0; i < available.length; i++) {
            availableMap[available[i]] = true;
        }

        var next = [];
        var seen = {};
        for (var n = 0; n < menuWeaponSlots.length; n++) {
            var id = String(menuWeaponSlots[n] || '');
            if (!availableMap[id] || seen[id]) continue;
            seen[id] = true;
            next.push(id);
            if (next.length >= 2) break;
        }

        for (var m = 0; m < MENU_LOADOUT_DEFAULT.length && next.length < 2; m++) {
            var fallback = MENU_LOADOUT_DEFAULT[m];
            if (!availableMap[fallback] || seen[fallback]) continue;
            seen[fallback] = true;
            next.push(fallback);
        }

        for (var p = 0; p < available.length && next.length < 2; p++) {
            var candidate = available[p];
            if (seen[candidate]) continue;
            seen[candidate] = true;
            next.push(candidate);
        }

        if (next.length === 1) {
            next.push(next[0]);
        }
        if (next.length === 0) {
            next = MENU_LOADOUT_DEFAULT.slice();
        }

        menuWeaponSlots = next.slice(0, 2);
        if (menuActiveSlot < 0 || menuActiveSlot > 1) menuActiveSlot = 0;
    }

    function syncMenuWeaponSlotsToRuntime() {
        normalizeMenuWeaponSlots();
        if (globalThis.__MAYHEM_RUNTIME.GameHitscan && globalThis.__MAYHEM_RUNTIME.GameHitscan.setWeaponOrder) {
            globalThis.__MAYHEM_RUNTIME.GameHitscan.setWeaponOrder(menuWeaponSlots.slice());
        }
        if (globalThis.__MAYHEM_RUNTIME.GamePlayer && globalThis.__MAYHEM_RUNTIME.GamePlayer.setLoadout) {
            globalThis.__MAYHEM_RUNTIME.GamePlayer.setLoadout({ slots: menuWeaponSlots.slice() });
        }
        return menuWeaponSlots.slice();
    }

    function setupMenuWeaponLoadout() {
        var primaryBtn = document.getElementById('weapon-slot-primary');
        var secondaryBtn = document.getElementById('weapon-slot-secondary');
        var weaponChoiceGrid = document.getElementById('weapon-choice-grid');
        if (!primaryBtn || !secondaryBtn || !weaponChoiceGrid) return;

        var slotBtns = [primaryBtn, secondaryBtn];
        if (weaponChoiceGrid.__menuLoadoutBound) {
            syncMenuWeaponSlotsToRuntime();
            return;
        }
        weaponChoiceGrid.__menuLoadoutBound = true;

        function render() {
            var slots = syncMenuWeaponSlotsToRuntime();
            var names = weaponNameLookup();
            var available = availableMenuWeaponIds();

            for (var i = 0; i < slotBtns.length; i++) {
                var btn = slotBtns[i];
                var slotId = slots[i] || slots[0] || 'machinegun';
                var title = 'SLOT ' + (i + 1) + ' :: ' + String(names[slotId] || slotId).toUpperCase();
                btn.textContent = title;
                btn.classList.toggle('active', i === menuActiveSlot);
            }

            weaponChoiceGrid.innerHTML = '';
            for (var n = 0; n < available.length; n++) {
                var weaponId = available[n];
                var choice = document.createElement('button');
                choice.type = 'button';
                choice.className = 'weapon-choice-btn';
                choice.dataset.weaponId = weaponId;
                choice.textContent = String(names[weaponId] || weaponId).toUpperCase();
                if (slots[menuActiveSlot] === weaponId) {
                    choice.classList.add('active');
                }
                choice.addEventListener('click', function () {
                    var selectedId = String(this.dataset.weaponId || '');
                    if (!selectedId) return;
                    var active = menuActiveSlot;
                    var other = active === 0 ? 1 : 0;
                    if (slots[other] === selectedId) {
                        slots[other] = slots[active];
                    }
                    slots[active] = selectedId;
                    menuWeaponSlots = slots.slice(0, 2);
                    syncMenuWeaponSlotsToRuntime();
                    if (runtimeInitialized && globalThis.__MAYHEM_RUNTIME.GameHitscan) {
                        applyWeapon(globalThis.__MAYHEM_RUNTIME.GameHitscan.setWeapon(selectedId));
                    }
                    render();
                });
                weaponChoiceGrid.appendChild(choice);
            }
        }

        primaryBtn.addEventListener('click', function () {
            menuActiveSlot = 0;
            render();
        });
        secondaryBtn.addEventListener('click', function () {
            menuActiveSlot = 1;
            render();
        });

        render();
    }

    var menuActiveThrowableCategory = 'grenade';

    function setupMenuThrowableLoadout() {
        var catTabs = document.getElementById('throwable-category-tabs');
        var choiceGrid = document.getElementById('throwable-choice-grid');
        if (!catTabs || !choiceGrid) return;
        if (choiceGrid.__throwableMenuBound) return;
        choiceGrid.__throwableMenuBound = true;

        var GT = globalThis.__MAYHEM_RUNTIME.GameThrowables;
        if (!GT || !GT.getCategories) return;

        function render() {
            var categories = GT.getCategories();
            var selected = GT.getSelectedThrowable ? GT.getSelectedThrowable() : 'frag';

            catTabs.innerHTML = '';
            for (var catId in categories) {
                if (!Object.prototype.hasOwnProperty.call(categories, catId)) continue;
                var cat = categories[catId];
                var btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'throwable-cat-btn';
                btn.dataset.catId = catId;
                btn.textContent = cat.label.toUpperCase();
                if (catId === menuActiveThrowableCategory) btn.classList.add('active');
                btn.addEventListener('click', function () {
                    menuActiveThrowableCategory = this.dataset.catId;
                    render();
                });
                catTabs.appendChild(btn);
            }

            choiceGrid.innerHTML = '';
            var activeCat = categories[menuActiveThrowableCategory];
            if (!activeCat) return;
            for (var i = 0; i < activeCat.items.length; i++) {
                var item = activeCat.items[i];
                var choice = document.createElement('button');
                choice.type = 'button';
                choice.className = 'throwable-choice-btn';
                choice.dataset.throwableId = item.id;
                choice.textContent = item.label.toUpperCase();
                if (selected === item.id) choice.classList.add('active');
                choice.addEventListener('click', function () {
                    var id = this.dataset.throwableId;
                    if (GT.setSelectedThrowable) GT.setSelectedThrowable(id);
                    render();
                });
                choiceGrid.appendChild(choice);
            }
        }

        render();
    }

    function setupMenuAbilityLoadout() {
        var abilityGrid = document.getElementById('ability-slot1-grid');
        if (!abilityGrid) return;
        if (abilityGrid.__abilityMenuBound) return;
        abilityGrid.__abilityMenuBound = true;

        var GA = globalThis.__MAYHEM_RUNTIME.GameAbilities;
        if (!GA || !GA.getCatalog || !GA.getLoadout || !GA.setLoadout) return;

        function render() {
            var catalog = GA.getCatalog();
            var loadout = GA.getLoadout();

            abilityGrid.innerHTML = '';

            for (var i = 0; i < catalog.length; i++) {
                var def = catalog[i];

                var btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'ability-choice-btn';
                btn.dataset.abilityId = def.id;
                btn.dataset.slot = def.slot || 'ability';
                btn.textContent = def.name.toUpperCase();
                if (def.id === loadout.activeAbility) btn.classList.add('active');

                btn.addEventListener('click', function () {
                    var id = this.dataset.abilityId;
                    var slot = this.dataset.slot || 'ability';
                    GA.setLoadout(id);
                    if (multiplayerMode && globalThis.__MAYHEM_RUNTIME.GameNet && globalThis.__MAYHEM_RUNTIME.GameNet.sendAbilityLoadout) {
                        var updated = GA.getLoadout();
                        globalThis.__MAYHEM_RUNTIME.GameNet.sendAbilityLoadout(
                            slot === 'ultimate' ? null : updated.slot1,
                            slot === 'ultimate' ? updated.slot2 : null
                        );
                    }
                    globalThis.__MAYHEM_RUNTIME.GameUI.updateAbilityInfo(GA.getHudState());
                    render();
                });
                abilityGrid.appendChild(btn);
            }
        }

        render();
    }

    function applyAbilityProfile(profileId) {
        if (!globalThis.__MAYHEM_RUNTIME.GameAbilities) return null;
        var selected = globalThis.__MAYHEM_RUNTIME.GameAbilities.setClass(profileId);
        if (!selected) return null;

        if (selected.loadoutWeapon || (menuWeaponSlots && menuWeaponSlots.length > 0)) {
            var preferredWeapon = (menuWeaponSlots && menuWeaponSlots.length > 0)
                ? menuWeaponSlots[0]
                : selected.loadoutWeapon;
            applyWeapon(globalThis.__MAYHEM_RUNTIME.GameHitscan.setWeapon(preferredWeapon));
        }

        globalThis.__MAYHEM_RUNTIME.GamePlayerCombat.applyArmorProfile(selected.armorMax || globalThis.__MAYHEM_RUNTIME.GamePlayerCombat.getArmorMax());
        globalThis.__MAYHEM_RUNTIME.GameUI.updateAbilityInfo(globalThis.__MAYHEM_RUNTIME.GameAbilities.getHudState());
        if (globalThis.__MAYHEM_RUNTIME.GameDocs && globalThis.__MAYHEM_RUNTIME.GameDocs.refresh) {
            globalThis.__MAYHEM_RUNTIME.GameDocs.refresh();
        }

        return selected;
    }

    function handleEnemyHit(hitPoint, damage, hitType, result) {
        if (!result) return;
        var currentWeapon = globalThis.__MAYHEM_RUNTIME.GameHitscan && globalThis.__MAYHEM_RUNTIME.GameHitscan.getCurrentWeapon
            ? globalThis.__MAYHEM_RUNTIME.GameHitscan.getCurrentWeapon()
            : null;
        var isShotgun = !!(currentWeapon && currentWeapon.id === 'shotgun');
        var damageNumberSpread = isShotgun ? { spreadX: 96, spreadY: 38 } : undefined;
        if (globalThis.__MAYHEM_RUNTIME.GameAudio && globalThis.__MAYHEM_RUNTIME.GameAudio.play) {
            globalThis.__MAYHEM_RUNTIME.GameAudio.play('enemyHit', { killed: !!result.killed });
        }
        if (result.killed) {
            globalThis.__MAYHEM_RUNTIME.GameUI.showKillMarker();
            globalThis.__MAYHEM_RUNTIME.GameUI.addKill();
            globalThis.__MAYHEM_RUNTIME.GameUI.showDamageNumber(hitPoint, damage, true, camera, hitType, damageNumberSpread);
        } else {
            globalThis.__MAYHEM_RUNTIME.GameUI.showHitMarker();
            globalThis.__MAYHEM_RUNTIME.GameUI.showDamageNumber(hitPoint, damage, false, camera, hitType, damageNumberSpread);
        }
    }

    function handleNetworkDamageFeedback(feedback) {
        if (!feedback) return;
        var isShotgun = feedback.weaponId === 'shotgun';
        var damageNumberSpread = isShotgun ? { spreadX: 96, spreadY: 38 } : undefined;

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
                feedback.hitType || 'body',
                damageNumberSpread
            );
        }
    }

    function tryPlayerFire() {
        if (globalThis.__MAYHEM_RUNTIME.GamePlayer.isSprinting()) return;
        if (globalThis.__MAYHEM_RUNTIME.GameAbilities && globalThis.__MAYHEM_RUNTIME.GameAbilities.isDeadeyeActive()) return;
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
                if (armedThrowableType || throwableHeldType) {
                    clearArmedThrowablePreview();
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
            if (e.code === 'Digit1' || e.code === 'Digit2') {
                var weaponOrder = globalThis.__MAYHEM_RUNTIME.GameHitscan.getWeaponOrder();
                var idx = parseInt(e.code.replace('Digit', ''), 10) - 1;
                if (idx >= 0 && idx < weaponOrder.length) {
                    applyWeapon(globalThis.__MAYHEM_RUNTIME.GameHitscan.setWeapon(weaponOrder[idx]));
                }
                return;
            }
        });

        var _wheelCooldownUntil = 0;
        var _wheelScrollAccum = 0;
        var _WHEEL_SCROLL_THRESHOLD = 3;
        var _WHEEL_COOLDOWN_MS = 45;
        var _wheelGestureLatched = false;
        var _wheelLatchedDirection = 0;
        var _WHEEL_RELEASE_EPSILON = 1.1;
        document.addEventListener('wheel', function (e) {
            if (!hasInputCapture()) return;
            e.preventDefault();
            var now = performance.now();
            var primaryDelta = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
            var direction = primaryDelta === 0 ? 0 : (primaryDelta > 0 ? 1 : -1);
            var dominantMagnitude = Math.max(Math.abs(e.deltaX), Math.abs(e.deltaY));

            if (dominantMagnitude <= _WHEEL_RELEASE_EPSILON) {
                _wheelGestureLatched = false;
                _wheelLatchedDirection = 0;
                _wheelScrollAccum = 0;
            }

            if (_wheelGestureLatched && direction !== 0 && direction === _wheelLatchedDirection) {
                _wheelScrollAccum = 0;
                return;
            }

            if (now < _wheelCooldownUntil) return;

            if (direction !== 0 && _wheelLatchedDirection !== 0 && direction !== _wheelLatchedDirection) {
                _wheelScrollAccum = 0;
                _wheelGestureLatched = false;
                _wheelLatchedDirection = 0;
            }

            _wheelScrollAccum += dominantMagnitude;
            if (_wheelScrollAccum < _WHEEL_SCROLL_THRESHOLD) return;

            // Consume the current swipe and wait for the trackpad to settle before allowing another switch.
            _wheelScrollAccum = 0;
            _wheelCooldownUntil = now + _WHEEL_COOLDOWN_MS;
            _wheelGestureLatched = true;
            _wheelLatchedDirection = direction;
            applyWeapon(globalThis.__MAYHEM_RUNTIME.GameHitscan.cycleWeapon(1));
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

    var throwableHeldType = '';

    function clearArmedThrowablePreview() {
        armedThrowableType = '';
        throwableHeldType = '';
        var GT = globalThis.__MAYHEM_RUNTIME.GameThrowables;
        if (GT) {
            if (GT.clearTrajectoryPreview) GT.clearTrajectoryPreview();
        }
        if (globalThis.__MAYHEM_RUNTIME.GameUI && globalThis.__MAYHEM_RUNTIME.GameUI.updateSeekerReticle) {
            globalThis.__MAYHEM_RUNTIME.GameUI.updateSeekerReticle(false, false);
        }
    }

    function updateArmedThrowablePreview() {
        if (!armedThrowableType) {
            var GT = globalThis.__MAYHEM_RUNTIME.GameThrowables;
            if (GT) {
                if (GT.clearTrajectoryPreview) GT.clearTrajectoryPreview();
            }
            if (globalThis.__MAYHEM_RUNTIME.GameUI && globalThis.__MAYHEM_RUNTIME.GameUI.updateSeekerReticle) {
                globalThis.__MAYHEM_RUNTIME.GameUI.updateSeekerReticle(false, false);
            }
            return;
        }
        if (!hasInputCapture()) {
            clearArmedThrowablePreview();
            return;
        }
        var GT2 = globalThis.__MAYHEM_RUNTIME.GameThrowables;
        if (!GT2) return;
        var previewType = GT2.getPreviewType ? GT2.getPreviewType(armedThrowableType) : 'none';
        if (previewType === 'trajectory' && GT2.updateTrajectoryPreview) {
            GT2.updateTrajectoryPreview(armedThrowableType, camera);
        } else if (previewType === 'cone') {
            var hasTarget = false;
            if (GT2.checkSeekerLockInCone) {
                hasTarget = GT2.checkSeekerLockInCone(camera);
            }
            if (globalThis.__MAYHEM_RUNTIME.GameUI && globalThis.__MAYHEM_RUNTIME.GameUI.updateSeekerReticle) {
                var def = GT2.getThrowableDef ? GT2.getThrowableDef(armedThrowableType) : null;
                var halfAngleDeg = (def && def.acquireHalfAngleDeg) ? def.acquireHalfAngleDeg : 35;
                globalThis.__MAYHEM_RUNTIME.GameUI.updateSeekerReticle(true, hasTarget, halfAngleDeg, {
                    fov: camera && camera.fov ? camera.fov : 60,
                    aspect: camera && camera.aspect ? camera.aspect : (window.innerWidth / Math.max(1, window.innerHeight))
                });
            }
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
            if (e.code !== 'KeyQ') return;
            if (!hasInputCapture()) return;

            var GT = globalThis.__MAYHEM_RUNTIME.GameThrowables;
            if (!GT || !GT.getSelectedThrowable) return;

            var selectedType = GT.getSelectedThrowable();
            if (!selectedType) return;

            var previewType = GT.getPreviewType ? GT.getPreviewType(selectedType) : 'none';

            if (previewType === 'none') {
                tryThrow(selectedType);
                return;
            }

            armedThrowableType = selectedType;
            throwableHeldType = selectedType;
        });

        document.addEventListener('keyup', function (e) {
            if (e.code !== 'KeyQ') return;
            if (!throwableHeldType) return;

            var type = throwableHeldType;
            var intent = (globalThis.__MAYHEM_RUNTIME.GameThrowables && globalThis.__MAYHEM_RUNTIME.GameThrowables.buildThrowIntent)
                ? globalThis.__MAYHEM_RUNTIME.GameThrowables.buildThrowIntent(camera)
                : null;
            tryThrow(type, intent);
            clearArmedThrowablePreview();
        });
    }

    function setupAbilityControls() {
        function triggerAbility() {
            if (!hasInputCapture()) return;

            if (multiplayerMode && globalThis.__MAYHEM_RUNTIME.GameNet &&
                (globalThis.__MAYHEM_RUNTIME.GameNet.sendAbilityCast || globalThis.__MAYHEM_RUNTIME.GameNet.sendClassCast)) {
                var castData = null;
                var loadout = globalThis.__MAYHEM_RUNTIME.GameAbilities.getLoadout
                    ? globalThis.__MAYHEM_RUNTIME.GameAbilities.getLoadout() : {};
                var slotAbilityId = loadout.activeAbility || loadout.slot1 || '';
                var castSlot = slotAbilityId === loadout.slot2 ? 2 : 1;

                if (slotAbilityId === 'choke' && globalThis.__MAYHEM_RUNTIME.GameHitscan && globalThis.__MAYHEM_RUNTIME.GameHitscan.selectLockTargetByBox) {
                    var classTuning = (globalThis.__MAYHEM_RUNTIME.GameCombatTuning && globalThis.__MAYHEM_RUNTIME.GameCombatTuning.getClassAbilityTuning)
                        ? globalThis.__MAYHEM_RUNTIME.GameCombatTuning.getClassAbilityTuning()
                        : {};
                    var chokeBoxPx = Number(classTuning.chokeLockBoxPx || 190);
                    var chokeRange = Number(classTuning.chokeRange || 24);
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
                var sendFn = globalThis.__MAYHEM_RUNTIME.GameNet.sendAbilityCast || globalThis.__MAYHEM_RUNTIME.GameNet.sendClassCast;
                sendFn(castSlot, castData);
                return;
            }

            var playerPos = globalThis.__MAYHEM_RUNTIME.GamePlayer.getPosition();
            var rot = globalThis.__MAYHEM_RUNTIME.GamePlayer.getRotation();
            var outcome = globalThis.__MAYHEM_RUNTIME.GameAbilities.triggerAbility(
                1,
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
            if (e.repeat) return;
            if (e.code === 'KeyR') {
                triggerAbility();
            }
        });
    }

    function setupDebugKeys() {
        document.addEventListener('keydown', function (e) {
            if (e.code === 'KeyH') {
                applyDebugVisuals(!debugVisualsOn);
                setTransientDebug(debugVisualsOn ? 'Dev visuals: ON' : 'Dev visuals: OFF', 1100);
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

        multiplayerMode = !!(activeRuntimeMode && activeRuntimeMode.authorityMode === 'networked');

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

            applyAbilityProfile('abilities');

            globalThis.__MAYHEM_RUNTIME.GamePlayerCombat.init({
                isPlaying: function () { return isPlaying; },
                isMultiplayer: function () { return multiplayerMode; }
            });
            var _initArmor = globalThis.__MAYHEM_RUNTIME.GameAbilities.getArmorMax ? globalThis.__MAYHEM_RUNTIME.GameAbilities.getArmorMax() : 90;
            globalThis.__MAYHEM_RUNTIME.GamePlayerCombat.applyArmorProfile(_initArmor);
            globalThis.__MAYHEM_RUNTIME.GameUI.updateHealth(globalThis.__MAYHEM_RUNTIME.GamePlayerCombat.getHP(), globalThis.__MAYHEM_RUNTIME.GamePlayerCombat.getMaxHP());
            globalThis.__MAYHEM_RUNTIME.GameUI.updateAbilityInfo(globalThis.__MAYHEM_RUNTIME.GameAbilities.getHudState());

            applyDebugVisuals(!multiplayerMode);

            syncMenuWeaponSlotsToRuntime();
            applyWeapon(globalThis.__MAYHEM_RUNTIME.GameHitscan.getCurrentWeapon());

            setupPointerLock();
            setupShooting();
            setupWeaponControls();
            setupThrowableControls();
            setupAbilityControls();
            setupSoundToggleControl();
            setupDocsControls();
            setupDebugKeys();
            runtimeInitialized = true;

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

        if (triggerHeld && hasInputCapture() && currentWeapon && currentWeapon.automatic && !globalThis.__MAYHEM_RUNTIME.GamePlayer.isSprinting()) {
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

        globalThis.__MAYHEM_RUNTIME.GamePlayerCombat.tickInvulnTimer(dt);
        globalThis.__MAYHEM_RUNTIME.GamePlayerCombat.tickArmorRegen(dt);

        var playerPos = globalThis.__MAYHEM_RUNTIME.GamePlayer.getPosition();
        var playerRot = globalThis.__MAYHEM_RUNTIME.GamePlayer.getRotation();
        updateArmedThrowablePreview();

        if (multiplayerMode) {
            globalThis.__MAYHEM_RUNTIME.GameNet.update(dt, playerPos, playerRot);
            var selfState = globalThis.__MAYHEM_RUNTIME.GameNet.getSelfState();
            if (selfState) {
                if (globalThis.__MAYHEM_RUNTIME.GameAbilities.clearQueuedClass) {
                    globalThis.__MAYHEM_RUNTIME.GameAbilities.clearQueuedClass();
                }

                globalThis.__MAYHEM_RUNTIME.GamePlayerCombat.syncFromNetwork(selfState);
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
                    var activeSlot = Number(hudState.activeSlot || 1);
                    hudState.abilityCooldown = activeSlot === 2
                        ? (abilityState.ultimateCooldownRemaining || 0)
                        : (abilityState.abilityCooldownRemaining || 0);
                    hudState.extra = '';
                    if (abilityState.deadeyeState && abilityState.deadeyeState.maxLocks > 0) {
                        hudState.extra = 'DEADEYE ' + abilityState.deadeyeState.lockCount + '/' + abilityState.deadeyeState.maxLocks;
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
                globalThis.__MAYHEM_RUNTIME.GamePlayerCombat.consumeDamage(damage, hitType, attackerEnemy);
            });

            globalThis.__MAYHEM_RUNTIME.GameThrowables.update(dt, function (hitData) {
                if (!hitData || !hitData.result) return;
                handleEnemyHit(hitData.hitPoint, hitData.damage, hitData.hitType, hitData.result);
            });

            globalThis.__MAYHEM_RUNTIME.GameUI.updateThrowableInfo(globalThis.__MAYHEM_RUNTIME.GameThrowables.getState());
            globalThis.__MAYHEM_RUNTIME.GameUI.updateHealth(globalThis.__MAYHEM_RUNTIME.GamePlayerCombat.getHP(), globalThis.__MAYHEM_RUNTIME.GamePlayerCombat.getMaxHP());
            globalThis.__MAYHEM_RUNTIME.GameUI.updateArmor(globalThis.__MAYHEM_RUNTIME.GamePlayerCombat.getArmor(), globalThis.__MAYHEM_RUNTIME.GamePlayerCombat.getArmorMax());
        }

        currentAimTargetId = '';
        var centerTarget = globalThis.__MAYHEM_RUNTIME.GameHitscan.peekCenterTarget(camera, 220);
        if (centerTarget && centerTarget.targetId) {
            currentAimTargetId = centerTarget.targetId;
        }

        globalThis.__MAYHEM_RUNTIME.GameOverhead.update(camera, playerPos, currentAimTargetId);
        if (globalThis.__MAYHEM_RUNTIME.GameUI.updateCombatRadar || globalThis.__MAYHEM_RUNTIME.GameUI.updateCombatBeacons) {
            var awarenessState = globalThis.__MAYHEM_RUNTIME.GameAwareness.buildState(playerPos, playerRot ? playerRot.yaw : 0);
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
            globalThis.__MAYHEM_RUNTIME.GameUI.updateChokeReticle(false, 190);
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
        renderer.render(scene, camera);
    }

    function runtimeProfile() {
        return depGet('GameRuntimeProfile');
    }

    function requestedModeId() {
        var runtime = runtimeProfile();
        if (runtime && runtime.getRequestedModeId) return runtime.getRequestedModeId();
        return '';
    }

    function requestedRoomId() {
        var runtime = runtimeProfile();
        if (runtime && runtime.requestedRoomId) return runtime.requestedRoomId();
        return '';
    }

    function activeModeById(modeId) {
        var runtime = runtimeProfile();
        if (!runtime || !runtime.getMode) return null;
        return runtime.getMode(modeId);
    }

    function availableModes() {
        var runtime = runtimeProfile();
        if (!runtime || !runtime.getAvailableModes) return [];
        return runtime.getAvailableModes() || [];
    }

    function setRuntimeIndicator(mode) {
        var el = document.getElementById('runtime-indicator');
        if (!el) return;
        if (!mode) {
            el.textContent = 'PROFILE :: STANDBY';
            return;
        }

        var parts = [
            String(mode.label || '').toUpperCase(),
            String(mode.backendLabel || '').toUpperCase()
        ];
        if (mode.roomId) {
            parts.push('ROOM ' + String(mode.roomId).toUpperCase());
        }
        el.textContent = 'PROFILE :: ' + parts.join(' :: ');
    }

    function startupSubtitleForMode(mode) {
        if (!mode) return 'Select runtime mode';
        if (mode.id === 'cloud_multiplayer') {
            return 'Connecting to Cloudflare global room: ' + mode.roomId + '...';
        }
        if (mode.id === 'single_cloudflare') {
            return 'Connecting to Cloudflare private room: ' + mode.roomId + '...';
        }
        if (mode.id === 'single_dev_server') {
            return 'Connecting to shared local dev-server room: ' + mode.roomId + '...';
        }
        return 'Starting offline experimental sandbox...';
    }

    function startupNoticeForMode(mode) {
        if (!mode) return '';
        if (mode.id === 'cloud_multiplayer') {
            return 'Cloud multiplayer: shared room ' + mode.roomId + '.';
        }
        if (mode.id === 'single_cloudflare') {
            return 'Single Cloudflare: private room ' + mode.roomId + '.';
        }
        if (mode.id === 'single_dev_server') {
            return 'Single Dev Server: shared local-worker room ' + mode.roomId + '.';
        }
        return 'Single Full Sandbox: offline local simulation only.';
    }

    function boot() {
        function safeInit() {
            try {
                initGame();
                return true;
            } catch (err) {
                var msg = (err && err.message) ? err.message : String(err || 'Unknown startup error');
                var overlayEl = document.getElementById('overlay');
                if (overlayEl) overlayEl.style.display = 'flex';
                var dbg = document.getElementById('debug-info');
                if (dbg) dbg.textContent = 'Startup error: ' + msg;
                console.error('Startup error:', err);
                return false;
            }
        }

        var runtime = runtimeProfile();
        var modeButtonsWrap = document.getElementById('mode-buttons');
        var altModePanel = document.getElementById('alt-mode-panel');
        var altModeToggle = document.getElementById('alt-mode-toggle');
        var primaryPlayBtn = document.getElementById('primary-play-btn');
        var modeButtons = Array.prototype.slice.call(document.querySelectorAll('#mode-buttons .mode-btn[data-mode-id]'));
        var modeSubtitle = document.getElementById('mode-subtitle');
        var playBtn = document.getElementById('play-btn');
        var started = false;
        var altModesOpen = false;
        setRuntimeIndicator(null);
        setupMenuWeaponLoadout();
        setupMenuThrowableLoadout();
        setupMenuAbilityLoadout();

        function setAltModesOpen(open) {
            altModesOpen = !!open;
            if (modeButtonsWrap) modeButtonsWrap.hidden = !altModesOpen;
            if (altModeToggle) altModeToggle.setAttribute('aria-expanded', altModesOpen ? 'true' : 'false');
        }

        function syncModeButtonVisibility() {
            var visible = {};
            var modes = availableModes();
            for (var i = 0; i < modes.length; i++) {
                visible[modes[i].id] = true;
            }
            var visibleCount = 0;
            for (var n = 0; n < modeButtons.length; n++) {
                var btn = modeButtons[n];
                var modeId = String(btn.dataset.modeId || '');
                var show = !!visible[modeId];
                btn.style.display = show ? '' : 'none';
                btn.disabled = false;
                if (show) visibleCount += 1;
            }
            if (altModePanel) altModePanel.style.display = visibleCount > 0 ? '' : 'none';
            if (visibleCount <= 0) setAltModesOpen(false);
        }

        function disableModeButtons() {
            for (var i = 0; i < modeButtons.length; i++) {
                modeButtons[i].disabled = true;
            }
            if (altModeToggle) altModeToggle.disabled = true;
            if (primaryPlayBtn) primaryPlayBtn.disabled = true;
        }

        function startWithMode(modeId) {
            if (started) return;
            var selectedMode = runtime && runtime.selectMode ? runtime.selectMode(modeId) : activeModeById(modeId);
            if (!selectedMode) return;

            started = true;
            activeRuntimeMode = selectedMode;

            if (modeButtonsWrap) modeButtonsWrap.hidden = true;
            if (altModePanel) altModePanel.style.display = 'none';
            if (primaryPlayBtn) primaryPlayBtn.style.display = 'none';
            if (playBtn) playBtn.style.display = 'none';
            disableModeButtons();
            if (modeSubtitle) {
                modeSubtitle.textContent = startupSubtitleForMode(selectedMode);
            }
            setRuntimeIndicator(selectedMode);

            autoStartNoLock = true;

            if (selectedMode.authorityMode === 'networked') {
                forceGuestNetMode = true;
                forcedRoomId = selectedMode.roomId || 'global';
                if (globalThis.__MAYHEM_RUNTIME.GameNet && globalThis.__MAYHEM_RUNTIME.GameNet.enableGuestMode) {
                    globalThis.__MAYHEM_RUNTIME.GameNet.enableGuestMode();
                }
                if (globalThis.__MAYHEM_RUNTIME.GameNet && globalThis.__MAYHEM_RUNTIME.GameNet.setRoomId) {
                    globalThis.__MAYHEM_RUNTIME.GameNet.setRoomId(forcedRoomId);
                }
                startupDebugNotice = startupNoticeForMode(selectedMode);
            } else {
                forceGuestNetMode = false;
                forcedRoomId = 'global';
                if (globalThis.__MAYHEM_RUNTIME.GameNet && globalThis.__MAYHEM_RUNTIME.GameNet.setRoomId) {
                    globalThis.__MAYHEM_RUNTIME.GameNet.setRoomId('global');
                }
                startupDebugNotice = startupNoticeForMode(selectedMode);
            }

            syncMenuWeaponSlotsToRuntime();
            if (!safeInit()) {
                started = false;
                activeRuntimeMode = null;
                autoStartNoLock = false;
                startupDebugNotice = '';
                forceGuestNetMode = false;
                forcedRoomId = 'global';
                if (runtime && runtime.clearSelectedMode) {
                    runtime.clearSelectedMode();
                }
                if (primaryPlayBtn) {
                    primaryPlayBtn.disabled = false;
                    primaryPlayBtn.style.display = '';
                }
                if (altModeToggle) altModeToggle.disabled = false;
                if (modeButtonsWrap) modeButtonsWrap.hidden = !altModesOpen;
                if (altModePanel) altModePanel.style.display = '';
                if (playBtn) playBtn.style.display = 'none';
                if (modeSubtitle) modeSubtitle.textContent = 'Play drops you into the shared Cloudflare room. Alternate runtimes are below.';
                setRuntimeIndicator(null);
                syncModeButtonVisibility();
            }
        }

        syncModeButtonVisibility();
        setAltModesOpen(false);

        if (altModeToggle) {
            altModeToggle.addEventListener('click', function () {
                setAltModesOpen(!altModesOpen);
            });
        }

        if (primaryPlayBtn) {
            primaryPlayBtn.addEventListener('click', function () {
                startWithMode('cloud_multiplayer');
            });
        }

        for (var i = 0; i < modeButtons.length; i++) {
            modeButtons[i].addEventListener('click', function () {
                startWithMode(String(this.dataset.modeId || ''));
            });
        }

        if (requestedModeId()) {
            startWithMode(requestedModeId());
            return;
        }

        if (modeButtons.length === 0) {
            startWithMode('cloud_multiplayer');
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
