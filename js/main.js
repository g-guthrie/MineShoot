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
    var netShotCounter = 0;
    var MENU_LOADOUT_DEFAULT = ['machinegun', 'shotgun'];
    var MENU_LOADOUT_ALLOWED = ['machinegun', 'shotgun', 'rifle', 'pistol', 'sniper', 'seekergun'];
    var menuWeaponSlots = MENU_LOADOUT_DEFAULT.slice();
    var menuActiveSlot = 0;
    var runtimeInitialized = false;
    var selfHookVisual = null;
    var remoteHookVisuals = new Map();
    var hookTmpStart = new THREE.Vector3();
    var hookTmpEnd = new THREE.Vector3();
    var hookTmpA = new THREE.Vector3();
    var hookTmpB = new THREE.Vector3();

    function depGet(name) {
        return globalThis.__MAYHEM_RUNTIME[name];
    }

    function depRequire(name) {
        return globalThis.__MAYHEM_RUNTIME[name];
    }

    function cappedPixelRatio() {
        return Math.min(MAX_PIXEL_RATIO, Math.max(1, Number(window.devicePixelRatio) || 1));
    }

    function createHookVisual() {
        var geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3));
        var line = new THREE.Line(
            geometry,
            new THREE.LineBasicMaterial({ color: 0xb7bcc4, transparent: true, opacity: 0.95 })
        );
        line.renderOrder = 55;
        line.visible = false;
        scene.add(line);

        var head = new THREE.Mesh(
            new THREE.BoxGeometry(0.16, 0.16, 0.24),
            new THREE.MeshLambertMaterial({ color: 0x8a8f96 })
        );
        head.renderOrder = 56;
        head.visible = false;
        scene.add(head);

        return { line: line, head: head };
    }

    function ensureSelfHookVisual() {
        if (selfHookVisual) return selfHookVisual;
        selfHookVisual = createHookVisual();
        return selfHookVisual;
    }

    function ensureRemoteHookVisual(entityId) {
        var existing = remoteHookVisuals.get(entityId);
        if (existing) return existing;
        existing = createHookVisual();
        remoteHookVisuals.set(entityId, existing);
        return existing;
    }

    function hideHookVisual(visual) {
        if (!visual) return;
        if (visual.line) visual.line.visible = false;
        if (visual.head) visual.head.visible = false;
    }

    function setHookVisual(visual, start, end) {
        if (!visual || !start || !end) {
            hideHookVisual(visual);
            return;
        }
        var pos = visual.line.geometry.getAttribute('position');
        pos.setXYZ(0, start.x, start.y, start.z);
        pos.setXYZ(1, end.x, end.y, end.z);
        pos.needsUpdate = true;
        visual.line.visible = true;
        visual.head.visible = true;
        visual.head.position.copy(end);
        hookTmpA.copy(end).sub(start);
        if (hookTmpA.lengthSq() > 0.00001) {
            visual.head.lookAt(hookTmpB.copy(end).add(hookTmpA));
        }
    }

    function playerCoreWorldPosition() {
        if (globalThis.__MAYHEM_RUNTIME.GamePlayer && globalThis.__MAYHEM_RUNTIME.GamePlayer.getCoreWorldPosition) {
            return globalThis.__MAYHEM_RUNTIME.GamePlayer.getCoreWorldPosition();
        }
        if (!camera) return null;
        return camera.position.clone();
    }

    function playerHookOriginWorldPosition() {
        if (globalThis.__MAYHEM_RUNTIME.GamePlayer && globalThis.__MAYHEM_RUNTIME.GamePlayer.getThrowableOriginWorldPosition) {
            return globalThis.__MAYHEM_RUNTIME.GamePlayer.getThrowableOriginWorldPosition();
        }
        return playerCoreWorldPosition();
    }

    function localEnemyCoreByTargetId(targetId) {
        if (!targetId || !globalThis.__MAYHEM_RUNTIME.GameEnemy || !globalThis.__MAYHEM_RUNTIME.GameEnemy.getLockTargets) return null;
        var targets = globalThis.__MAYHEM_RUNTIME.GameEnemy.getLockTargets() || [];
        for (var i = 0; i < targets.length; i++) {
            var t = targets[i];
            if (t && t.targetId === targetId && t.worldPos) return t.worldPos.clone ? t.worldPos.clone() : new THREE.Vector3(t.worldPos.x, t.worldPos.y, t.worldPos.z);
        }
        return null;
    }

    function netEntityCoreById(targetId) {
        if (!targetId || !globalThis.__MAYHEM_RUNTIME.GameNet || !globalThis.__MAYHEM_RUNTIME.GameNet.getEntityMarkerWorldPos) return null;
        var p = globalThis.__MAYHEM_RUNTIME.GameNet.getEntityMarkerWorldPos(targetId);
        return p ? new THREE.Vector3(Number(p.x || 0), Number(p.y || 0), Number(p.z || 0)) : null;
    }

    function resolveHookEnd(state, netMode) {
        if (!state) return null;
        if (state.phase === 'latched' && state.targetId) {
            return netMode ? netEntityCoreById(state.targetId) : localEnemyCoreByTargetId(state.targetId);
        }
        if (state.headPos) return state.headPos.clone ? state.headPos.clone() : new THREE.Vector3(state.headPos.x, state.headPos.y, state.headPos.z);
        return null;
    }

    function renderHookEffects() {
        var selfState = null;
        if (multiplayerMode && globalThis.__MAYHEM_RUNTIME.GameNet && globalThis.__MAYHEM_RUNTIME.GameNet.getSelfAbilityState) {
            var netAbility = globalThis.__MAYHEM_RUNTIME.GameNet.getSelfAbilityState();
            selfState = netAbility ? netAbility.hookState : null;
        } else if (globalThis.__MAYHEM_RUNTIME.GameAbilities && globalThis.__MAYHEM_RUNTIME.GameAbilities.getHookState) {
            selfState = globalThis.__MAYHEM_RUNTIME.GameAbilities.getHookState();
        }

        var selfVisual = ensureSelfHookVisual();
        if (selfState) {
            var selfStart = playerHookOriginWorldPosition();
            var selfEnd = resolveHookEnd(selfState, multiplayerMode);
            setHookVisual(selfVisual, selfStart, selfEnd);
        } else {
            hideHookVisual(selfVisual);
        }

        var activeRemote = {};
        if (multiplayerMode && globalThis.__MAYHEM_RUNTIME.GameNetEntities && globalThis.__MAYHEM_RUNTIME.GameNetEntities.getRenderMap) {
            var renderMap = globalThis.__MAYHEM_RUNTIME.GameNetEntities.getRenderMap();
            renderMap.forEach(function (render, entityId) {
                var hookState = render && render.hookState ? render.hookState : null;
                if (!hookState) return;
                var start = render.rigApi && render.rigApi.getThrowableOriginWorldPosition
                    ? render.rigApi.getThrowableOriginWorldPosition(new THREE.Vector3())
                    : (render.rigApi && render.rigApi.getCoreWorldPosition
                        ? render.rigApi.getCoreWorldPosition(new THREE.Vector3())
                        : new THREE.Vector3(render.group.position.x, render.group.position.y + 1.0, render.group.position.z));
                var end = resolveHookEnd(hookState, true);
                var visual = ensureRemoteHookVisual(entityId);
                setHookVisual(visual, start, end);
                activeRemote[entityId] = true;
            });
        }
        remoteHookVisuals.forEach(function (visual, entityId) {
            if (!activeRemote[entityId]) hideHookVisual(visual);
        });
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

        if (globalThis.__MAYHEM_RUNTIME.GamePlayer && globalThis.__MAYHEM_RUNTIME.GamePlayer.setHitboxVisibility) {
            globalThis.__MAYHEM_RUNTIME.GamePlayer.setHitboxVisibility(!!visible);
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
            sniper: 'Sniper',
            seekergun: 'Seeker'
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

    function compactMenuWeaponSlots() {
        var available = availableMenuWeaponIds();
        var availableMap = {};
        for (var i = 0; i < available.length; i++) {
            availableMap[available[i]] = true;
        }

        var next = ['', ''];
        for (var n = 0; n < 2; n++) {
            var id = String(menuWeaponSlots[n] || '');
            next[n] = availableMap[id] ? id : '';
        }
        menuWeaponSlots = next;
        if (menuActiveSlot < 0 || menuActiveSlot > 1) menuActiveSlot = 0;
    }

    function syncMenuWeaponSlotsToRuntime() {
        compactMenuWeaponSlots();
        var equipped = [];
        for (var i = 0; i < menuWeaponSlots.length; i++) {
            if (menuWeaponSlots[i]) equipped.push(menuWeaponSlots[i]);
        }
        if (globalThis.__MAYHEM_RUNTIME.GameHitscan && globalThis.__MAYHEM_RUNTIME.GameHitscan.setWeaponOrder && equipped.length > 0) {
            globalThis.__MAYHEM_RUNTIME.GameHitscan.setWeaponOrder(equipped);
        }
        if (globalThis.__MAYHEM_RUNTIME.GamePlayer && globalThis.__MAYHEM_RUNTIME.GamePlayer.setLoadout) {
            globalThis.__MAYHEM_RUNTIME.GamePlayer.setLoadout({ slots: equipped });
        }
        return menuWeaponSlots.slice();
    }

    function currentAbilityMenuLoadout() {
        if (!globalThis.__MAYHEM_RUNTIME.GameAbilities || !globalThis.__MAYHEM_RUNTIME.GameAbilities.getLoadout) {
            return { slot1: '', slot2: '' };
        }
        var loadout = globalThis.__MAYHEM_RUNTIME.GameAbilities.getLoadout() || {};
        return {
            slot1: String(loadout.slot1 || ''),
            slot2: String(loadout.slot2 || '')
        };
    }

    function validateMenuSelections() {
        compactMenuWeaponSlots();
        var abilities = currentAbilityMenuLoadout();
        var missingWeapons = [];
        var missingAbilities = [];
        if (!menuWeaponSlots[0]) missingWeapons.push('weapon slot 1');
        if (!menuWeaponSlots[1]) missingWeapons.push('weapon slot 2');
        if (!abilities.slot1) missingAbilities.push('ability slot R');
        if (!abilities.slot2) missingAbilities.push('ability slot F');
        if (!missingWeapons.length && !missingAbilities.length) return { ok: true, message: '' };

        var parts = [];
        if (missingWeapons.length) parts.push('Missing ' + missingWeapons.join(' and '));
        if (missingAbilities.length) parts.push('Missing ' + missingAbilities.join(' and '));
        return { ok: false, message: parts.join(' | ') };
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
                var slotId = slots[i] || '';
                var title = 'SLOT ' + (i + 1) + ' :: ' + (slotId ? String(names[slotId] || slotId).toUpperCase() : 'UNEQUIPPED');
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
                var otherSlot = menuActiveSlot === 0 ? 1 : 0;
                if (slots[otherSlot] === weaponId) {
                    choice.classList.add('owned-other');
                }
                choice.addEventListener('click', function () {
                    var selectedId = String(this.dataset.weaponId || '');
                    if (!selectedId) return;
                    var active = menuActiveSlot;
                    var other = active === 0 ? 1 : 0;
                    if (slots[other] === selectedId) {
                        slots[other] = '';
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
        var abilityGrid1 = document.getElementById('ability-slot1-grid');
        var abilityGrid2 = document.getElementById('ability-slot2-grid');
        if (!abilityGrid1 || !abilityGrid2) return;
        if (abilityGrid1.__abilityMenuBound) return;
        abilityGrid1.__abilityMenuBound = true;

        var GA = globalThis.__MAYHEM_RUNTIME.GameAbilities;
        if (!GA || !GA.getCatalog || !GA.getLoadout || !GA.setLoadoutSlot) return;

        function render() {
            var catalog = GA.getCatalog();
            var loadout = GA.getLoadout();
            abilityGrid1.innerHTML = '';
            abilityGrid2.innerHTML = '';

            function appendChoices(slotIndex, gridEl, selectedId, blockedId) {
                for (var i = 0; i < catalog.length; i++) {
                    var def = catalog[i];
                    if (!def || !def.id) continue;
                    var btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'ability-choice-btn';
                    btn.dataset.abilityId = def.id;
                    btn.textContent = def.name.toUpperCase();
                    if (def.id === selectedId) btn.classList.add('active');
                    if (def.id === blockedId) btn.classList.add('owned-other');
                    btn.addEventListener('click', function () {
                        var id = this.dataset.abilityId;
                        GA.setLoadoutSlot(slotIndex, id);
                        if (multiplayerMode && globalThis.__MAYHEM_RUNTIME.GameNet && globalThis.__MAYHEM_RUNTIME.GameNet.sendAbilityLoadout) {
                            var updated = GA.getLoadout();
                            globalThis.__MAYHEM_RUNTIME.GameNet.sendAbilityLoadout(updated.slot1, updated.slot2);
                        }
                        globalThis.__MAYHEM_RUNTIME.GameUI.updateAbilityInfo(GA.getHudState());
                        render();
                    });
                    gridEl.appendChild(btn);
                }
            }

            appendChoices(1, abilityGrid1, loadout.slot1, loadout.slot2);
            appendChoices(2, abilityGrid2, loadout.slot2, loadout.slot1);
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
        var damageNumberSpread = isShotgun ? { spreadX: 152, spreadY: 72 } : undefined;
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
        var damageNumberSpread = isShotgun ? { spreadX: 152, spreadY: 72 } : undefined;

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
                activeWeapon.id === 'seekergun' &&
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
                    var seekerWeaponId = 'seekergun';
                    var adsActive = !!(globalThis.__MAYHEM_RUNTIME.GamePlayer && globalThis.__MAYHEM_RUNTIME.GamePlayer.getAdsState && globalThis.__MAYHEM_RUNTIME.GamePlayer.getAdsState().active);
                    globalThis.__MAYHEM_RUNTIME.GameNet.sendSeekerShot(netLockTargetId, seekerIntent, clientShotId, seekerWeaponId, adsActive);
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
        var backModeBtn = document.getElementById('back-mode-btn');
        var modeButtonsWrap = document.getElementById('mode-buttons');
        var lastStartRequest = 0;

        function showResumeControl(show) {
            if (!playBtn) return;
            playBtn.style.display = show ? 'inline-block' : 'none';
            if (backModeBtn) backModeBtn.style.display = show ? 'inline-block' : 'none';
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
            var validation = validateMenuSelections();
            if (!validation.ok) {
                setTransientDebug(validation.message, 1800);
                return;
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

        if (backModeBtn) {
            backModeBtn.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                if (globalThis.__MAYHEM_RUNTIME.GameRuntimeProfile && globalThis.__MAYHEM_RUNTIME.GameRuntimeProfile.clearSelectedMode) {
                    globalThis.__MAYHEM_RUNTIME.GameRuntimeProfile.clearSelectedMode();
                }
                window.location.href = window.location.pathname;
            });
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
        function triggerAbility(slotIndex) {
            if (!hasInputCapture()) return;

            if (multiplayerMode && globalThis.__MAYHEM_RUNTIME.GameNet &&
                (globalThis.__MAYHEM_RUNTIME.GameNet.sendAbilityCast || globalThis.__MAYHEM_RUNTIME.GameNet.sendClassCast)) {
                var castData = null;
                var loadout = globalThis.__MAYHEM_RUNTIME.GameAbilities.getLoadout
                    ? globalThis.__MAYHEM_RUNTIME.GameAbilities.getLoadout() : {};
                var castSlot = Number(slotIndex) === 2 ? 2 : 1;
                var slotAbilityId = castSlot === 2 ? loadout.slot2 : loadout.slot1;

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
                slotIndex,
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
                triggerAbility(1);
            } else if (e.code === 'KeyF') {
                triggerAbility(2);
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
        if (currentWeapon) {
            syncReticleWithWeapon(currentWeapon);
        }
        if (globalThis.__MAYHEM_RUNTIME.GameUI && globalThis.__MAYHEM_RUNTIME.GameUI.updateSniperScope && globalThis.__MAYHEM_RUNTIME.GamePlayer && globalThis.__MAYHEM_RUNTIME.GamePlayer.getScopeState) {
            globalThis.__MAYHEM_RUNTIME.GameUI.updateSniperScope(globalThis.__MAYHEM_RUNTIME.GamePlayer.getScopeState());
        }

        if (triggerHeld && hasInputCapture() && currentWeapon && currentWeapon.automatic && !globalThis.__MAYHEM_RUNTIME.GamePlayer.isSprinting()) {
            tryPlayerFire();
        }

        if (globalThis.__MAYHEM_RUNTIME.GameHitscan.tick) {
            globalThis.__MAYHEM_RUNTIME.GameHitscan.tick(dt);
        }
        if (globalThis.__MAYHEM_RUNTIME.GameHitscan.updateTracers) {
            globalThis.__MAYHEM_RUNTIME.GameHitscan.updateTracers(dt);
        }
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
            if (globalThis.__MAYHEM_RUNTIME.GameUI && globalThis.__MAYHEM_RUNTIME.GameUI.updateMatchStatus && globalThis.__MAYHEM_RUNTIME.GameNet && globalThis.__MAYHEM_RUNTIME.GameNet.getMatchState) {
                globalThis.__MAYHEM_RUNTIME.GameUI.updateMatchStatus(globalThis.__MAYHEM_RUNTIME.GameNet.getMatchState(), selfState || globalThis.__MAYHEM_RUNTIME.GameNet.getSelfState());
            }
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
            globalThis.__MAYHEM_RUNTIME.GameUI.updateMatchStatus(null, null);
        }

        if (currentWeapon && currentWeapon.id === 'seekergun' && !armedThrowableType && globalThis.__MAYHEM_RUNTIME.GameHitscan && globalThis.__MAYHEM_RUNTIME.GameHitscan.getSeekergunDebugInfo && globalThis.__MAYHEM_RUNTIME.GameUI && globalThis.__MAYHEM_RUNTIME.GameUI.updateSeekerReticle) {
            var seekerInfo = globalThis.__MAYHEM_RUNTIME.GameHitscan.getSeekergunDebugInfo(camera);
            globalThis.__MAYHEM_RUNTIME.GameUI.updateSeekerReticle(
                !!seekerInfo,
                !!(seekerInfo && seekerInfo.hasLock),
                seekerInfo ? seekerInfo.coneHalfAngleDeg : 20,
                {
                    fov: camera && camera.fov ? camera.fov : 60,
                    aspect: camera && camera.aspect ? camera.aspect : (window.innerWidth / Math.max(1, window.innerHeight))
                }
            );
        } else if (!armedThrowableType && globalThis.__MAYHEM_RUNTIME.GameUI && globalThis.__MAYHEM_RUNTIME.GameUI.updateSeekerReticle) {
            globalThis.__MAYHEM_RUNTIME.GameUI.updateSeekerReticle(false, false);
        }

        currentAimTargetId = '';
        var centerTargetRange = (currentWeapon && typeof currentWeapon.maxRange === 'number')
            ? currentWeapon.maxRange
            : 220;
        var centerTarget = globalThis.__MAYHEM_RUNTIME.GameHitscan.peekCenterTarget(camera, centerTargetRange);
        if (centerTarget && centerTarget.targetId) {
            currentAimTargetId = centerTarget.targetId;
        }
        if (globalThis.__MAYHEM_RUNTIME.GameUI && globalThis.__MAYHEM_RUNTIME.GameUI.setHitscanTargetState) {
            globalThis.__MAYHEM_RUNTIME.GameUI.setHitscanTargetState(!!(currentWeapon && currentWeapon.id !== 'shotgun' && currentWeapon.id !== 'seekergun' && centerTarget && centerTarget.hitbox));
        }
        if (globalThis.__MAYHEM_RUNTIME.GameUI && globalThis.__MAYHEM_RUNTIME.GameUI.setShotgunTargetState) {
            globalThis.__MAYHEM_RUNTIME.GameUI.setShotgunTargetState(!!(currentWeapon && currentWeapon.id === 'shotgun' && centerTarget && centerTarget.hitbox));
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
        if (globalThis.__MAYHEM_RUNTIME.GamePlayer && globalThis.__MAYHEM_RUNTIME.GamePlayer.setHealFlash) {
            var selfHealState = null;
            if (multiplayerMode && globalThis.__MAYHEM_RUNTIME.GameNet && globalThis.__MAYHEM_RUNTIME.GameNet.getSelfAbilityState) {
                var netSelfAbility = globalThis.__MAYHEM_RUNTIME.GameNet.getSelfAbilityState();
                selfHealState = netSelfAbility ? netSelfAbility.healState : null;
            } else if (globalThis.__MAYHEM_RUNTIME.GameAbilities && globalThis.__MAYHEM_RUNTIME.GameAbilities.getHealState) {
                selfHealState = globalThis.__MAYHEM_RUNTIME.GameAbilities.getHealState();
            }
            globalThis.__MAYHEM_RUNTIME.GamePlayer.setHealFlash(!!(selfHealState && selfHealState.endsAt > Date.now()));
        }

        if (globalThis.__MAYHEM_RUNTIME.GameUI.updateChokeReticle) {
            var hookVisible = false;
            var hookReticleSize = 170;
            if (multiplayerMode && globalThis.__MAYHEM_RUNTIME.GameNet && globalThis.__MAYHEM_RUNTIME.GameNet.getSelfAbilityState) {
                var selfAbilityState = globalThis.__MAYHEM_RUNTIME.GameNet.getSelfAbilityState();
                var netLoadout = selfAbilityState && selfAbilityState.abilityLoadout ? selfAbilityState.abilityLoadout : null;
                hookVisible = !!(netLoadout && (netLoadout.slot1 === 'hook' || netLoadout.slot2 === 'hook'));
            } else if (globalThis.__MAYHEM_RUNTIME.GameAbilities && globalThis.__MAYHEM_RUNTIME.GameAbilities.getLoadout) {
                var localLoadout = globalThis.__MAYHEM_RUNTIME.GameAbilities.getLoadout();
                hookVisible = !!(localLoadout && (localLoadout.slot1 === 'hook' || localLoadout.slot2 === 'hook'));
            }
            if (hookVisible && globalThis.__MAYHEM_RUNTIME.GameCombatTuning && globalThis.__MAYHEM_RUNTIME.GameCombatTuning.getClassAbilityTuning) {
                var abilityTuning = globalThis.__MAYHEM_RUNTIME.GameCombatTuning.getClassAbilityTuning() || {};
                hookReticleSize = Number(abilityTuning.hookLockBoxPx || 170);
            }
            globalThis.__MAYHEM_RUNTIME.GameUI.updateChokeReticle(hookVisible, hookReticleSize);
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
        renderHookEffects();
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

    function resolveApiUrl(path) {
        var runtime = runtimeProfile();
        if (runtime && runtime.resolveApiUrl) return runtime.resolveApiUrl(path);
        return path;
    }

    function matchmakingPath() {
        var protocol = (globalThis.__MAYHEM_RUNTIME.GameShared && globalThis.__MAYHEM_RUNTIME.GameShared.protocol)
            ? globalThis.__MAYHEM_RUNTIME.GameShared.protocol
            : null;
        return (protocol && protocol.matchmakingPath) ? protocol.matchmakingPath : '/api/matchmaking';
    }

    function roomCodeFromRoomId(roomId) {
        var normalized = String(roomId || '').toLowerCase();
        if (normalized.indexOf('private-') === 0) {
            return normalized.slice(8).toUpperCase();
        }
        return String(roomId || '').toUpperCase();
    }

    function isShareCodeRoomId(roomId) {
        return String(roomId || '').toLowerCase().indexOf('private-') === 0;
    }

    function runtimeRoomLabel(mode) {
        if (!mode || !mode.roomId) return '';
        var prefix = mode.gameMode ? String(mode.gameMode).toUpperCase() + ' ' : '';
        if (mode.id === 'single_cloudflare' && isShareCodeRoomId(mode.roomId)) {
            return prefix + 'CODE ' + roomCodeFromRoomId(mode.roomId);
        }
        return prefix + 'ROOM ' + String(mode.roomId).toUpperCase();
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
            parts.push(runtimeRoomLabel(mode));
        }
        el.textContent = 'PROFILE :: ' + parts.join(' :: ');
    }

    function startupSubtitleForMode(mode) {
        if (!mode) return 'Select runtime mode';
        if (mode.id === 'cloud_multiplayer') {
            if (mode.roomId === 'global') {
                return 'Connecting to Public Lobby: ' + mode.roomId + '...';
            }
            if (String(mode.gameMode || 'ffa').toLowerCase() === 'tdm') {
                return 'Connecting to Team Deathmatch: ' + mode.roomId + '...';
            }
            return 'Connecting to Free For All: ' + mode.roomId + '...';
        }
        if (mode.id === 'single_cloudflare') {
            return 'Connecting to Solo Cloudflare room: ' + mode.roomId + '...';
        }
        if (mode.id === 'single_dev_server') {
            return 'Connecting to Local Dev Room: ' + mode.roomId + '...';
        }
        return 'Starting Offline Sandbox...';
    }

    function startupNoticeForMode(mode) {
        if (!mode) return '';
        if (mode.id === 'cloud_multiplayer') {
            if (mode.roomId === 'global') {
                return 'Public Lobby: shared room ' + mode.roomId + '.';
            }
            if (String(mode.gameMode || 'ffa').toLowerCase() === 'tdm') {
                return 'Team Deathmatch joined room ' + mode.roomId + '.';
            }
            return 'Free For All joined room ' + mode.roomId + '.';
        }
        if (mode.id === 'single_cloudflare') {
            if (isShareCodeRoomId(mode.roomId)) {
                return 'Private room code ' + roomCodeFromRoomId(mode.roomId) + '.';
            }
            return 'Solo Cloudflare (Bots): room ' + mode.roomId + '.';
        }
        if (mode.id === 'single_dev_server') {
            return 'Local Dev Room (Bots): shared local-worker room ' + mode.roomId + '.';
        }
        return 'Offline Sandbox: local simulation only.';
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
        var altModeToggle = document.getElementById('alt-mode-toggle');
        var controlsMenu = document.getElementById('controls-menu');
        var controlsToggle = document.getElementById('controls-toggle');
        var primaryPlayBtn = document.getElementById('primary-play-btn');
        var tdmPlayBtn = document.getElementById('tdm-play-btn');
        var sandboxPlayBtn = document.getElementById('sandbox-play-btn');
        var createPrivateRoomBtn = document.getElementById('create-private-room-btn');
        var privateRoomInput = document.getElementById('private-room-input');
        var joinPrivateRoomBtn = document.getElementById('join-private-room-btn');
        var roomAccessStatus = document.getElementById('room-access-status');
        var roomSharePanel = document.getElementById('room-share-panel');
        var roomShareCode = document.getElementById('room-share-code');
        var copyRoomCodeBtn = document.getElementById('copy-room-code-btn');
        var roomCodeBadge = document.getElementById('room-code-badge');
        var roomCodeBadgeValue = document.getElementById('room-code-badge-value');
        var modeButtons = Array.prototype.slice.call(document.querySelectorAll('#mode-buttons .mode-btn[data-mode-id]'));
        var modeSubtitle = document.getElementById('mode-subtitle');
        var playBtn = document.getElementById('play-btn');
        var backModeBtn = document.getElementById('back-mode-btn');
        var started = false;
        var altModesOpen = false;
        var controlsOpen = false;
        var roomActionInFlight = false;
        setRuntimeIndicator(null);
        setupMenuWeaponLoadout();
        setupMenuThrowableLoadout();
        setupMenuAbilityLoadout();

        function setRoomAccessStatus(text, isErr) {
            if (!roomAccessStatus) return;
            roomAccessStatus.textContent = text || '';
            roomAccessStatus.style.color = isErr ? '#ff9797' : '#98f5b6';
        }

        function setPrivateRoomShare(roomId) {
            if (!roomSharePanel || !roomShareCode) return;
            if (!roomId) {
                roomSharePanel.hidden = true;
                roomShareCode.textContent = '------';
                if (roomCodeBadge && roomCodeBadgeValue) {
                    roomCodeBadge.hidden = true;
                    roomCodeBadgeValue.textContent = '------';
                }
                return;
            }
            var roomCode = roomCodeFromRoomId(roomId);
            roomShareCode.textContent = roomCode;
            roomSharePanel.hidden = false;
            if (roomCodeBadge && roomCodeBadgeValue) {
                roomCodeBadgeValue.textContent = roomCode;
                roomCodeBadge.hidden = false;
            }
        }

        function setRoomActionBusy(busy, message) {
            roomActionInFlight = !!busy;
            if (primaryPlayBtn) primaryPlayBtn.disabled = roomActionInFlight;
            if (tdmPlayBtn) tdmPlayBtn.disabled = roomActionInFlight;
            if (sandboxPlayBtn) sandboxPlayBtn.disabled = roomActionInFlight;
            if (createPrivateRoomBtn) createPrivateRoomBtn.disabled = roomActionInFlight;
            if (joinPrivateRoomBtn) joinPrivateRoomBtn.disabled = roomActionInFlight;
            if (privateRoomInput) privateRoomInput.disabled = roomActionInFlight;
            if (busy) {
                setRoomAccessStatus(message || 'Working...', false);
            }
        }

        function setAltModesOpen(open) {
            altModesOpen = !!open;
            if (modeButtonsWrap) modeButtonsWrap.hidden = !altModesOpen;
            if (altModeToggle) altModeToggle.setAttribute('aria-expanded', altModesOpen ? 'true' : 'false');
        }

        function setControlsOpen(open) {
            controlsOpen = !!open;
            if (controlsMenu) controlsMenu.hidden = !controlsOpen;
            if (controlsToggle) controlsToggle.setAttribute('aria-expanded', controlsOpen ? 'true' : 'false');
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
            if (visibleCount <= 0) setAltModesOpen(false);
        }

        function disableModeButtons() {
            for (var i = 0; i < modeButtons.length; i++) {
                modeButtons[i].disabled = true;
            }
            if (altModeToggle) altModeToggle.disabled = true;
            if (controlsToggle) controlsToggle.disabled = true;
            if (primaryPlayBtn) primaryPlayBtn.disabled = true;
            if (tdmPlayBtn) tdmPlayBtn.disabled = true;
            if (sandboxPlayBtn) sandboxPlayBtn.disabled = true;
            if (createPrivateRoomBtn) createPrivateRoomBtn.disabled = true;
            if (joinPrivateRoomBtn) joinPrivateRoomBtn.disabled = true;
            if (privateRoomInput) privateRoomInput.disabled = true;
        }

        function startWithMode(modeId, options) {
            options = options || {};
            if (started) return;
            var selectedMode = runtime && runtime.selectMode ? runtime.selectMode(modeId) : activeModeById(modeId);
            if (!selectedMode) return;
            if (options.roomId) {
                selectedMode.roomId = String(options.roomId);
            }
            if (options.gameMode) {
                selectedMode.gameMode = String(options.gameMode);
            }
            if (selectedMode.id === 'single_cloudflare' && isShareCodeRoomId(selectedMode.roomId)) {
                setPrivateRoomShare(selectedMode.roomId);
            } else {
                setPrivateRoomShare('');
            }

            started = true;
            activeRuntimeMode = selectedMode;

            if (modeButtonsWrap) modeButtonsWrap.hidden = true;
            if (controlsMenu) controlsMenu.hidden = true;
            if (primaryPlayBtn) primaryPlayBtn.style.display = 'none';
            if (tdmPlayBtn) tdmPlayBtn.style.display = 'none';
            if (sandboxPlayBtn) sandboxPlayBtn.style.display = 'none';
            if (createPrivateRoomBtn) createPrivateRoomBtn.style.display = 'none';
            if (joinPrivateRoomBtn) joinPrivateRoomBtn.style.display = 'none';
            if (privateRoomInput) privateRoomInput.style.display = 'none';
            if (playBtn) playBtn.style.display = 'none';
            if (backModeBtn) backModeBtn.style.display = 'none';
            disableModeButtons();
            if (modeSubtitle) {
                modeSubtitle.textContent = options.subtitle || startupSubtitleForMode(selectedMode);
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
                startupDebugNotice = options.notice || startupNoticeForMode(selectedMode);
            } else {
                forceGuestNetMode = false;
                forcedRoomId = 'global';
                if (globalThis.__MAYHEM_RUNTIME.GameNet && globalThis.__MAYHEM_RUNTIME.GameNet.setRoomId) {
                    globalThis.__MAYHEM_RUNTIME.GameNet.setRoomId('global');
                }
                startupDebugNotice = options.notice || startupNoticeForMode(selectedMode);
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
                if (tdmPlayBtn) {
                    tdmPlayBtn.disabled = false;
                    tdmPlayBtn.style.display = '';
                }
                if (sandboxPlayBtn) {
                    sandboxPlayBtn.disabled = false;
                    sandboxPlayBtn.style.display = '';
                }
                if (createPrivateRoomBtn) {
                    createPrivateRoomBtn.disabled = false;
                    createPrivateRoomBtn.style.display = '';
                }
                if (joinPrivateRoomBtn) {
                    joinPrivateRoomBtn.disabled = false;
                    joinPrivateRoomBtn.style.display = '';
                }
                if (privateRoomInput) {
                    privateRoomInput.disabled = false;
                    privateRoomInput.style.display = '';
                }
                if (altModeToggle) altModeToggle.disabled = false;
                if (controlsToggle) controlsToggle.disabled = false;
                if (modeButtonsWrap) modeButtonsWrap.hidden = !altModesOpen;
                if (controlsMenu) controlsMenu.hidden = !controlsOpen;
                if (playBtn) playBtn.style.display = 'none';
                if (backModeBtn) backModeBtn.style.display = 'none';
                if (modeSubtitle) modeSubtitle.textContent = '';
                setRuntimeIndicator(null);
                setPrivateRoomShare('');
                syncModeButtonVisibility();
            }
        }

        function requestMatchmaking(action, extra) {
            var payload = extra || {};
            payload.action = action;
            return fetch(resolveApiUrl(matchmakingPath()), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(payload)
            })
                .then(function (response) {
                    return response.json().catch(function () { return null; }).then(function (body) {
                        return { ok: response.ok, body: body };
                    });
                })
                .then(function (result) {
                    if (!result.body || !result.body.ok) {
                        throw new Error((result.body && result.body.error) || 'Room request failed.');
                    }
                    return result.body;
                });
        }

        function startAllocatedRoom(payload) {
            if (!payload || !payload.roomId) {
                setRoomAccessStatus('Room request failed.', true);
                return;
            }

            if (payload.privacy === 'private') {
                setPrivateRoomShare(payload.roomId);
                setRoomAccessStatus('Private room ready. Share code ' + roomCodeFromRoomId(payload.roomId) + '.', false);
            } else {
                setPrivateRoomShare('');
                setRoomAccessStatus('Joined ' + String((payload.gameMode || 'ffa')).toUpperCase() + ' room ' + String(payload.roomId).toUpperCase() + '.', false);
            }

            startWithMode(payload.modeId || 'cloud_multiplayer', {
                roomId: payload.roomId,
                gameMode: payload.gameMode || 'ffa'
            });
        }

        function beginRoomAction(action, extra, pendingText) {
            if (roomActionInFlight || started) return;
            setRoomActionBusy(true, pendingText);
            requestMatchmaking(action, extra)
                .then(function (payload) {
                    setRoomActionBusy(false, '');
                    startAllocatedRoom(payload);
                })
                .catch(function (err) {
                    setRoomActionBusy(false, '');
                    setRoomAccessStatus((err && err.message) ? err.message : 'Room request failed.', true);
                });
        }

        syncModeButtonVisibility();
        setAltModesOpen(false);
        setControlsOpen(false);
        setPrivateRoomShare('');

        if (altModeToggle) {
            altModeToggle.addEventListener('click', function () {
                setControlsOpen(false);
                setAltModesOpen(!altModesOpen);
            });
        }

        if (controlsToggle) {
            controlsToggle.addEventListener('click', function () {
                setAltModesOpen(false);
                setControlsOpen(!controlsOpen);
            });
        }

        if (primaryPlayBtn) {
            primaryPlayBtn.addEventListener('click', function () {
                beginRoomAction('quick', { gameMode: 'ffa' }, 'Finding an FFA room...');
            });
        }

        if (tdmPlayBtn) {
            tdmPlayBtn.addEventListener('click', function () {
                beginRoomAction('quick', { gameMode: 'tdm' }, 'Finding a TDM room...');
            });
        }

        if (sandboxPlayBtn) {
            sandboxPlayBtn.addEventListener('click', function () {
                startWithMode('single_full_sandbox');
            });
        }

        if (createPrivateRoomBtn) {
            createPrivateRoomBtn.addEventListener('click', function () {
                beginRoomAction('private', {}, 'Creating private room...');
            });
        }

        if (joinPrivateRoomBtn) {
            joinPrivateRoomBtn.addEventListener('click', function () {
                var roomCode = privateRoomInput ? privateRoomInput.value.trim() : '';
                if (!roomCode) {
                    setRoomAccessStatus('Enter a private room code.', true);
                    return;
                }
                beginRoomAction('join', { roomCode: roomCode }, 'Joining private room...');
            });
        }

        if (privateRoomInput) {
            privateRoomInput.addEventListener('keydown', function (event) {
                if (event.key !== 'Enter') return;
                event.preventDefault();
                if (joinPrivateRoomBtn) joinPrivateRoomBtn.click();
            });
        }

        if (copyRoomCodeBtn) {
            copyRoomCodeBtn.addEventListener('click', function () {
                if (!roomShareCode || !roomShareCode.textContent) return;
                var text = roomShareCode.textContent;
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(text)
                        .then(function () {
                            setRoomAccessStatus('Copied room code ' + text + '.', false);
                        })
                        .catch(function () {
                            setRoomAccessStatus('Copy failed. Room code: ' + text + '.', true);
                        });
                    return;
                }
                setRoomAccessStatus('Room code: ' + text + '.', false);
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
