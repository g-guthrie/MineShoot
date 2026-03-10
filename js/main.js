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

    var debugVisualsOn = false;

    var DEFAULT_ENEMY_COUNT = 5;
    var MAX_PIXEL_RATIO = 1.75;

    var currentAimTargetId = '';
    var multiplayerMode = false;
    var forcedRoomId = 'global';
    var activeRuntimeMode = null;
    var startupDebugNotice = '';
    var autoStartNoLock = false;
    var armedThrowableType = '';
    var netShotCounter = 0;
    var MENU_LOADOUT_DEFAULT = (function () {
        var shared = globalThis.__MAYHEM_RUNTIME.GameShared || {};
        return shared.getDefaultWeaponLoadout ? shared.getDefaultWeaponLoadout() : [];
    })();
    var menuWeaponSlots = MENU_LOADOUT_DEFAULT.slice();
    var runtimeInitialized = false;
    var selfHookVisual = null;
    var remoteHookVisuals = new Map();
    var hookTmpStart = new THREE.Vector3();
    var hookTmpEnd = new THREE.Vector3();
    var hookTmpA = new THREE.Vector3();
    var hookTmpB = new THREE.Vector3();
    var lastHandledMatchEndAt = 0;

    function depGet(name) {
        return globalThis.__MAYHEM_RUNTIME[name];
    }

    function menuLoadoutApi() {
        return depGet('GameMenuLoadout');
    }

    function cappedPixelRatio() {
        return Math.min(MAX_PIXEL_RATIO, Math.max(1, Number(window.devicePixelRatio) || 1));
    }

    function createHookVisual() {
        var chainSegments = [];
        for (var i = 0; i < 9; i++) {
            var seg = new THREE.Mesh(
                new THREE.BoxGeometry(0.08, 0.08, 0.56),
                new THREE.MeshLambertMaterial({ color: 0xb7bcc4 })
            );
            seg.renderOrder = 55;
            seg.visible = false;
            scene.add(seg);
            chainSegments.push(seg);
        }

        var head = new THREE.Mesh(
            new THREE.BoxGeometry(0.4, 0.28, 0.62),
            new THREE.MeshLambertMaterial({ color: 0x8a8f96 })
        );
        head.renderOrder = 56;
        head.visible = false;
        scene.add(head);

        return {
            chainSegments: chainSegments,
            head: head,
            currentStart: new THREE.Vector3(),
            currentEnd: new THREE.Vector3(),
            seeded: false
        };
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
        if (visual.chainSegments) {
            for (var i = 0; i < visual.chainSegments.length; i++) {
                visual.chainSegments[i].visible = false;
            }
        }
        if (visual.head) visual.head.visible = false;
        visual.seeded = false;
    }

    function setHookVisual(visual, start, end) {
        if (!visual || !start || !end) {
            hideHookVisual(visual);
            return;
        }
        if (!visual.seeded) {
            visual.currentStart.copy(start);
            visual.currentEnd.copy(end);
            visual.seeded = true;
        } else {
            visual.currentStart.lerp(start, 0.38);
            visual.currentEnd.lerp(end, 0.32);
        }
        hookTmpA.copy(visual.currentEnd).sub(visual.currentStart);
        var len = hookTmpA.length();
        if (len <= 0.00001) {
            hideHookVisual(visual);
            return;
        }
        hookTmpA.normalize();
        var segmentCount = visual.chainSegments ? visual.chainSegments.length : 0;
        for (var i = 0; i < segmentCount; i++) {
            var seg = visual.chainSegments[i];
            var t = (i + 0.5) / segmentCount;
            hookTmpStart.copy(visual.currentStart).lerp(visual.currentEnd, t);
            seg.position.copy(hookTmpStart);
            seg.lookAt(hookTmpB.copy(hookTmpStart).add(hookTmpA));
            seg.visible = true;
        }
        visual.head.visible = true;
        visual.head.position.copy(visual.currentEnd);
        visual.head.lookAt(hookTmpB.copy(visual.currentEnd).add(hookTmpA));
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

    function currentAbilityLoadoutState() {
        if (multiplayerMode && globalThis.__MAYHEM_RUNTIME.GameNet && globalThis.__MAYHEM_RUNTIME.GameNet.getSelfAbilityState) {
            var netState = globalThis.__MAYHEM_RUNTIME.GameNet.getSelfAbilityState();
            return netState && netState.abilityLoadout ? netState.abilityLoadout : null;
        }
        if (globalThis.__MAYHEM_RUNTIME.GameAbilities && globalThis.__MAYHEM_RUNTIME.GameAbilities.getLoadout) {
            return globalThis.__MAYHEM_RUNTIME.GameAbilities.getLoadout();
        }
        return null;
    }

    function currentAbilityCatalogMap() {
        var shared = globalThis.__MAYHEM_RUNTIME.GameShared && globalThis.__MAYHEM_RUNTIME.GameShared.gameplayTuning;
        return shared && shared.abilityCatalog ? shared.abilityCatalog : {};
    }

    function buildAbilityDebugText(loadout, _tuning) {
        if (!loadout) return '';
        var catalog = currentAbilityCatalogMap();
        var lines = [];
        function addSlot(label, abilityId) {
            if (!abilityId) return;
            var def = catalog[abilityId] || null;
            lines.push(label + ' ' + String((def && def.name) || abilityId).toUpperCase());
            lines.push(String((def && def.debugSummary) || 'No dev overlay summary.'));
            if (def && Array.isArray(def.tunableParams) && def.tunableParams.length) {
                lines.push('tune: ' + def.tunableParams.join(', '));
            }
            lines.push('');
        }
        addSlot('R', loadout.slot1);
        addSlot('F', loadout.slot2);
        return lines.join('\n').trim();
    }

    function deadeyeDebugRectSizePx(camera, minDot) {
        if (!camera || !isFinite(minDot)) return null;
        var clampedDot = Math.max(-1, Math.min(1, Number(minDot)));
        var halfAngleRad = Math.acos(clampedDot);
        var vFovRad = Number(camera.fov || 60) * Math.PI / 180;
        var tanHalf = Math.tan(halfAngleRad);
        var tanV = Math.tan(vFovRad * 0.5);
        if (!isFinite(tanHalf) || !isFinite(tanV) || tanV <= 0.000001) return null;
        var aspect = Math.max(0.0001, Number(camera.aspect || (window.innerWidth / Math.max(1, window.innerHeight))));
        var xNdc = tanHalf / (tanV * aspect);
        var yNdc = tanHalf / tanV;
        return {
            width: Math.max(60, Math.min(window.innerWidth * 0.86, xNdc * window.innerWidth)),
            height: Math.max(60, Math.min(window.innerHeight * 0.86, yNdc * window.innerHeight))
        };
    }

    function chokeRectSizePx(camera) {
        var GA = globalThis.__MAYHEM_RUNTIME.GameAbilities;
        if (GA && GA.getChokeRectSize) {
            return GA.getChokeRectSize(camera);
        }
        var deadeyeMinDot = Number(((currentAbilityCatalogMap().deadeye || {}).minDot) || 0.22);
        var rect = deadeyeDebugRectSizePx(camera, deadeyeMinDot);
        return {
            width: Math.max(24, Number(((currentAbilityCatalogMap().choke || {}).lockBoxPx) || 180) * 1.2),
            height: rect ? rect.height : 180
        };
    }

    function localEnemyCoreByTargetId(targetId) {
        if (!targetId || !globalThis.__MAYHEM_RUNTIME.GameEnemy || !globalThis.__MAYHEM_RUNTIME.GameEnemy.getLockTargets) return null;
        var targets = globalThis.__MAYHEM_RUNTIME.GameEnemy.getLockTargets() || [];
        for (var i = 0; i < targets.length; i++) {
            var t = targets[i];
            if (t && t.targetId === targetId && t.worldPos) return t.worldPos;
        }
        return null;
    }

    function netEntityCoreById(targetId) {
        if (!targetId || !globalThis.__MAYHEM_RUNTIME.GameNet || !globalThis.__MAYHEM_RUNTIME.GameNet.getEntityMarkerWorldPos) return null;
        return globalThis.__MAYHEM_RUNTIME.GameNet.getEntityMarkerWorldPos(targetId);
    }

    function hookVisualEndWorldPosition(state, resolveTargetPosition) {
        var abilityFxView = globalThis.__MAYHEM_RUNTIME.GameAbilityFx || null;
        var resolved = abilityFxView && abilityFxView.resolveHookVisualEnd
            ? abilityFxView.resolveHookVisualEnd(state, resolveTargetPosition)
            : null;
        if (!resolved) return null;
        return new THREE.Vector3(Number(resolved.x || 0), Number(resolved.y || 0), Number(resolved.z || 0));
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
            var selfEnd = hookVisualEndWorldPosition(
                selfState,
                multiplayerMode ? netEntityCoreById : localEnemyCoreByTargetId
            );
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
                var start = globalThis.__MAYHEM_RUNTIME.GameNetEntities.getHookOriginWorldPosition
                    ? globalThis.__MAYHEM_RUNTIME.GameNetEntities.getHookOriginWorldPosition(entityId, new THREE.Vector3())
                    : new THREE.Vector3(render.group.position.x, render.group.position.y + 1.0, render.group.position.z);
                var end = hookVisualEndWorldPosition(hookState, netEntityCoreById);
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

    function ensureMenuSessionEls() {
        return {
            stats: document.getElementById('menu-session-stats'),
            status: document.getElementById('menu-session-status'),
            kd: document.getElementById('menu-session-kd'),
            playBtn: document.getElementById('play-btn'),
            backBtn: document.getElementById('back-mode-btn')
        };
    }

    function canResumeGameplay() {
        if (!runtimeInitialized) return false;
        if (!multiplayerMode || !globalThis.__MAYHEM_RUNTIME.GameNet || !globalThis.__MAYHEM_RUNTIME.GameNet.getMatchState) {
            return true;
        }
        if (globalThis.__MAYHEM_RUNTIME.GameNet.getPrivateRoomPhase && globalThis.__MAYHEM_RUNTIME.GameNet.getPrivateRoomPhase() === 'lobby') {
            return false;
        }
        var matchState = globalThis.__MAYHEM_RUNTIME.GameNet.getMatchState();
        return !(matchState && matchState.ended);
    }

    function setResumeButtonsVisible(show) {
        var els = ensureMenuSessionEls();
        if (els.playBtn) els.playBtn.style.display = show ? 'inline-block' : 'none';
        if (els.backBtn) els.backBtn.style.display = show ? 'inline-block' : 'none';
    }

    function showGameplayPrompt() {
        if (overlay) overlay.style.display = 'flex';
        isPlaying = false;
        setResumeButtonsVisible(canResumeGameplay());
    }

    function sharedMatchRules() {
        return globalThis.__MAYHEM_RUNTIME &&
            globalThis.__MAYHEM_RUNTIME.GameShared &&
            globalThis.__MAYHEM_RUNTIME.GameShared.matchRules
            ? globalThis.__MAYHEM_RUNTIME.GameShared.matchRules
            : null;
    }

    function resolveMatchEntityName(entityId) {
        if (!entityId) return '';
        if (!multiplayerMode && globalThis.__MAYHEM_RUNTIME.GameLocalMatch && globalThis.__MAYHEM_RUNTIME.GameLocalMatch.getEntityName) {
            var localWinnerName = globalThis.__MAYHEM_RUNTIME.GameLocalMatch.getEntityName(entityId);
            if (localWinnerName) return String(localWinnerName);
        }
        if (globalThis.__MAYHEM_RUNTIME.GameNet && globalThis.__MAYHEM_RUNTIME.GameNet.getEntityName) {
            var winnerName = globalThis.__MAYHEM_RUNTIME.GameNet.getEntityName(entityId);
            if (winnerName) return String(winnerName);
        }
        return '';
    }

    function formatSecondsRemaining(ms) {
        var matchRules = sharedMatchRules();
        if (matchRules && matchRules.formatSecondsRemaining) {
            return matchRules.formatSecondsRemaining(ms);
        }
        return (Math.max(0, Number(ms || 0)) / 1000).toFixed(1) + 's';
    }

    function winnerLabel(matchState, selfState) {
        var matchRules = sharedMatchRules();
        if (matchRules && matchRules.formatWinnerLabel) {
            return matchRules.formatWinnerLabel(matchState, selfState, {
                resolveEntityName: resolveMatchEntityName
            });
        }
        return '';
    }

    function updateMenuSessionPanel(matchState, selfState) {
        var els = ensureMenuSessionEls();
        if (!els.stats || !els.status || !els.kd) return;

        if (!runtimeInitialized || !multiplayerMode) {
            els.stats.hidden = true;
            setResumeButtonsVisible(!isPlaying && runtimeInitialized);
            return;
        }

        var kills = Math.max(0, Number(selfState && selfState.kills || 0));
        var deaths = Math.max(0, Number(selfState && selfState.deaths || 0));
        var lives = Math.max(0, Number(selfState && selfState.lmsLives || 0));
        var charge = Math.max(0, Number(selfState && selfState.lmsCharge || 0));
        var respawnState = (globalThis.__MAYHEM_RUNTIME.GameNet && globalThis.__MAYHEM_RUNTIME.GameNet.getRespawnState)
            ? globalThis.__MAYHEM_RUNTIME.GameNet.getRespawnState()
            : null;
        var matchRules = sharedMatchRules();

        els.stats.hidden = false;
        els.kd.textContent = matchRules && matchRules.formatMenuMatchStats
            ? matchRules.formatMenuMatchStats(matchState, selfState)
            : (String(matchState && matchState.gameMode || '') === 'lms'
                ? ('LIVES ' + lives + ' | CHARGE ' + charge)
                : ('KILLS ' + kills + ' | DEATHS ' + deaths));

        if (matchRules && matchRules.formatMenuMatchStatus) {
            els.status.textContent = matchRules.formatMenuMatchStatus(matchState, selfState, {
                nowMs: Date.now,
                privateRoomPhase: globalThis.__MAYHEM_RUNTIME.GameNet && globalThis.__MAYHEM_RUNTIME.GameNet.getPrivateRoomPhase
                    ? globalThis.__MAYHEM_RUNTIME.GameNet.getPrivateRoomPhase()
                    : '',
                respawnState: respawnState,
                resolveEntityName: resolveMatchEntityName
            });
        } else {
            if (!matchState || !matchState.started) {
                els.status.textContent = 'WAITING FOR MATCH START';
            } else if (matchState.ended) {
                els.status.textContent = winnerLabel(matchState, selfState) + ' WON | RESET ' + formatSecondsRemaining(Number(matchState.resetAt || 0) - Date.now());
            } else {
                els.status.textContent = 'FFA ' + kills + ' / ' + Number(matchState.targetProgress || 0).toFixed(0) + ' | LEAD ' + Number(matchState.leaderProgress || 0).toFixed(0);
            }
        }

        setResumeButtonsVisible(!isPlaying && canResumeGameplay());
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

    function isLocalActionLocked() {
        return !!(globalThis.__MAYHEM_RUNTIME.GamePlayer &&
            globalThis.__MAYHEM_RUNTIME.GamePlayer.isActionLocked &&
            globalThis.__MAYHEM_RUNTIME.GamePlayer.isActionLocked());
    }

    function canUseLocalAction(actionType) {
        var player = globalThis.__MAYHEM_RUNTIME.GamePlayer;
        if (!player) return !isLocalActionLocked();
        if (actionType === 'weapon' && player.canUseWeapon) return !!player.canUseWeapon();
        if (actionType === 'throwable' && player.canUseThrowable) return !!player.canUseThrowable();
        if (actionType === 'ability' && player.canUseAbility) return !!player.canUseAbility();
        return !isLocalActionLocked();
    }

    function hasInputCapture() {
        return !!renderer && document.pointerLockElement === renderer.domElement;
    }

    function applyDebugVisuals(visible) {
        debugVisualsOn = !!visible;
        setRuntimeIndicator(activeRuntimeMode);

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
        var shared = globalThis.__MAYHEM_RUNTIME.GameShared || {};
        var selectableIds = shared.getSelectableWeaponIds ? shared.getSelectableWeaponIds() : MENU_LOADOUT_DEFAULT.slice();
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

        for (var i = 0; i < selectableIds.length; i++) {
            var allowedId = selectableIds[i];
            if (available[allowedId] || !hasDiscoveredCatalog) {
                ids.push(allowedId);
            }
        }

        if (ids.length === 0) {
            ids = MENU_LOADOUT_DEFAULT.slice();
        }

        return ids;
    }

    function compactMenuWeaponSlots() {
        var menuLoadout = menuLoadoutApi();
        if (menuLoadout && menuLoadout.getWeaponSlots) {
            menuWeaponSlots = menuLoadout.getWeaponSlots().slice(0, 2);
            return;
        }
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
    }

    function syncMenuWeaponSlotsToRuntime() {
        var menuLoadout = menuLoadoutApi();
        if (menuLoadout && menuLoadout.syncToRuntime) {
            menuWeaponSlots = menuLoadout.getWeaponSlots().slice(0, 2);
            menuLoadout.syncToRuntime(multiplayerMode);
            return menuWeaponSlots.slice();
        }
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
        if (multiplayerMode && globalThis.__MAYHEM_RUNTIME.GameNet && globalThis.__MAYHEM_RUNTIME.GameNet.sendWeaponLoadout) {
            globalThis.__MAYHEM_RUNTIME.GameNet.sendWeaponLoadout(menuWeaponSlots[0] || '', menuWeaponSlots[1] || '');
        }
        return menuWeaponSlots.slice();
    }

    function currentAbilityMenuLoadout() {
        var menuLoadout = menuLoadoutApi();
        if (menuLoadout && menuLoadout.getAbilityLoadout) {
            return menuLoadout.getAbilityLoadout();
        }
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
        var menuLoadout = menuLoadoutApi();
        if (menuLoadout && menuLoadout.validateSelections) {
            return menuLoadout.validateSelections();
        }
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

    function applyAbilityProfile(profileId) {
        if (!globalThis.__MAYHEM_RUNTIME.GameAbilities) return null;
        var selected = globalThis.__MAYHEM_RUNTIME.GameAbilities.setClass(profileId);
        if (!selected) return null;

        var currentMenuWeapons = menuLoadoutApi() && menuLoadoutApi().getWeaponSlots
            ? menuLoadoutApi().getWeaponSlots()
            : menuWeaponSlots;
        if (selected.loadoutWeapon || (currentMenuWeapons && currentMenuWeapons.length > 0)) {
            var preferredWeapon = (currentMenuWeapons && currentMenuWeapons.length > 0)
                ? currentMenuWeapons[0]
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
            globalThis.__MAYHEM_RUNTIME.GameAudio.play('bulletImpact', {
                killed: !!result.killed,
                hitType: hitType,
                weapon: currentWeapon && currentWeapon.id ? currentWeapon.id : ''
            });
        }
        if (result.killed) {
            globalThis.__MAYHEM_RUNTIME.GameUI.showKillMarker();
            globalThis.__MAYHEM_RUNTIME.GameUI.showDamageNumber(hitPoint, damage, true, camera, hitType, damageNumberSpread);
        } else {
            globalThis.__MAYHEM_RUNTIME.GameUI.showHitMarker();
            globalThis.__MAYHEM_RUNTIME.GameUI.showDamageNumber(hitPoint, damage, false, camera, hitType, damageNumberSpread);
        }
    }

    function tryPlayerFire() {
        if (!canUseLocalAction('weapon')) return;
        if (multiplayerMode && globalThis.__MAYHEM_RUNTIME.GameNet) {
            var selfState = globalThis.__MAYHEM_RUNTIME.GameNet.getSelfState ? globalThis.__MAYHEM_RUNTIME.GameNet.getSelfState() : null;
            var respawnState = globalThis.__MAYHEM_RUNTIME.GameNet.getRespawnState ? globalThis.__MAYHEM_RUNTIME.GameNet.getRespawnState() : null;
            if ((selfState && selfState.alive === false) || (respawnState && respawnState.active)) return;
        }
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
                if (multiplayerMode && hitboxMesh && hitboxMesh.userData && hitboxMesh.userData.ownerType === 'net') {
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
                globalThis.__MAYHEM_RUNTIME.GameNet &&
                globalThis.__MAYHEM_RUNTIME.GameNet.sendFire
            ) {
                globalThis.__MAYHEM_RUNTIME.GameNet.sendFire(activeWeapon.id, shotToken);
            }

            globalThis.__MAYHEM_RUNTIME.GamePlayer.triggerAction('fire');
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
            setResumeButtonsVisible(!!show && canResumeGameplay());
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
            if (!canResumeGameplay()) return;
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

        globalThis.__MAYHEM_RUNTIME.GameSession = globalThis.__MAYHEM_RUNTIME.GameSession || {};
        globalThis.__MAYHEM_RUNTIME.GameSession.startGameplayFromMenu = function (event) {
            return requestPlayStart(event);
        };
        globalThis.__MAYHEM_RUNTIME.GameSession.showGameplayPrompt = function () {
            showGameplayPrompt();
        };

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
                setResumeButtonsVisible(false);
            } else {
                triggerHeld = false;
                if (armedThrowableType || throwableHeldType) {
                    clearArmedThrowablePreview();
                }
                if (overlay) overlay.style.display = 'flex';
                isPlaying = false;
                setResumeButtonsVisible(canResumeGameplay());
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
        function editableTarget(target) {
            var node = target || null;
            var tagName = node && node.tagName ? String(node.tagName).toUpperCase() : '';
            if (node && node.isContentEditable) return true;
            return tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT';
        }

        document.addEventListener('keydown', function (e) {
            if (editableTarget(e.target)) return;
            if (e.code === 'KeyI') {
                e.preventDefault();
                if (depGet('GameRuntimeLoader') && depGet('GameRuntimeLoader').toggleDocs) {
                    depGet('GameRuntimeLoader').toggleDocs();
                } else if (globalThis.__MAYHEM_RUNTIME.GameDocs && globalThis.__MAYHEM_RUNTIME.GameDocs.toggle) {
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
        var _WHEEL_COOLDOWN_MS = 500;
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
        if (globalThis.__MAYHEM_RUNTIME.GameUI && globalThis.__MAYHEM_RUNTIME.GameUI.updateTrackingReticle) {
            globalThis.__MAYHEM_RUNTIME.GameUI.updateTrackingReticle(false, false);
        }
    }

    function updateArmedThrowablePreview() {
        if (!armedThrowableType) {
            var GT = globalThis.__MAYHEM_RUNTIME.GameThrowables;
            if (GT) {
                if (GT.clearTrajectoryPreview) GT.clearTrajectoryPreview();
            }
            if (globalThis.__MAYHEM_RUNTIME.GameUI && globalThis.__MAYHEM_RUNTIME.GameUI.updateTrackingReticle) {
                globalThis.__MAYHEM_RUNTIME.GameUI.updateTrackingReticle(false, false);
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
            if (GT2.checkPlasmaLockInCone) {
                hasTarget = GT2.checkPlasmaLockInCone(camera);
            }
            if (globalThis.__MAYHEM_RUNTIME.GameUI && globalThis.__MAYHEM_RUNTIME.GameUI.updateTrackingReticle) {
                var def = GT2.getThrowableDef ? GT2.getThrowableDef(armedThrowableType) : null;
                var halfAngleDeg = (def && def.acquireHalfAngleDeg) ? def.acquireHalfAngleDeg : 35;
                globalThis.__MAYHEM_RUNTIME.GameUI.updateTrackingReticle(true, hasTarget, halfAngleDeg, {
                    fov: camera && camera.fov ? camera.fov : 60,
                    aspect: camera && camera.aspect ? camera.aspect : (window.innerWidth / Math.max(1, window.innerHeight))
                });
            }
        }
    }

    function tryThrow(type, throwIntentOverride) {
        if (!canUseLocalAction('throwable')) return null;
        if (!hasInputCapture()) return null;
        var throwIntent = throwIntentOverride || ((globalThis.__MAYHEM_RUNTIME.GameThrowables && globalThis.__MAYHEM_RUNTIME.GameThrowables.buildThrowIntent)
            ? globalThis.__MAYHEM_RUNTIME.GameThrowables.buildThrowIntent(camera)
            : null);
        var playerApi = globalThis.__MAYHEM_RUNTIME.GamePlayer || null;
        var audioApi = globalThis.__MAYHEM_RUNTIME.GameAudio || null;

        function triggerLocalThrowFeedback() {
            if (playerApi && playerApi.triggerAction) {
                playerApi.triggerAction('throw');
            }
            if (audioApi && audioApi.play) {
                audioApi.play('throw');
            }
        }

        if (multiplayerMode && globalThis.__MAYHEM_RUNTIME.GameNet && globalThis.__MAYHEM_RUNTIME.GameNet.sendThrow) {
            var clientThrowId = (globalThis.__MAYHEM_RUNTIME.GameThrowables && globalThis.__MAYHEM_RUNTIME.GameThrowables.buildClientThrowId)
                ? globalThis.__MAYHEM_RUNTIME.GameThrowables.buildClientThrowId()
                : ('cthrow-' + Date.now().toString(36));
            if (globalThis.__MAYHEM_RUNTIME.GameThrowables && globalThis.__MAYHEM_RUNTIME.GameThrowables.throwPredicted) {
                globalThis.__MAYHEM_RUNTIME.GameThrowables.throwPredicted(type, camera, clientThrowId, throwIntent);
            }
            globalThis.__MAYHEM_RUNTIME.GameNet.sendThrow(type, clientThrowId, throwIntent);
            triggerLocalThrowFeedback();
            setTransientDebug('Throw sent: ' + type, 650);
            return { ok: true, sent: true };
        }

        var outcome = globalThis.__MAYHEM_RUNTIME.GameThrowables.throw(type, camera, throwIntent);
        globalThis.__MAYHEM_RUNTIME.GameUI.updateThrowableInfo(outcome.state);
        if (outcome.ok) {
            triggerLocalThrowFeedback();
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
            if (!canUseLocalAction('throwable')) return;

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
            if (!canUseLocalAction('throwable')) {
                clearArmedThrowablePreview();
                return;
            }

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
            if (!canUseLocalAction('ability')) return;

            if (multiplayerMode && globalThis.__MAYHEM_RUNTIME.GameNet &&
                (globalThis.__MAYHEM_RUNTIME.GameNet.sendAbilityCast || globalThis.__MAYHEM_RUNTIME.GameNet.sendClassCast)) {
                var preparedCast = globalThis.__MAYHEM_RUNTIME.GameAbilities.prepareNetCast
                    ? globalThis.__MAYHEM_RUNTIME.GameAbilities.prepareNetCast(slotIndex, camera)
                    : { ok: true, slot: Number(slotIndex) === 2 ? 2 : 1, castData: null, commit: null };
                if (!preparedCast || preparedCast.ok === false) {
                    if (preparedCast && preparedCast.message) {
                        setTransientDebug(preparedCast.message, 700);
                    }
                    return;
                }
                var sendFn = globalThis.__MAYHEM_RUNTIME.GameNet.sendAbilityCast || globalThis.__MAYHEM_RUNTIME.GameNet.sendClassCast;
                sendFn(preparedCast.slot, preparedCast.castData);
                if (preparedCast.commit) {
                    preparedCast.commit();
                }
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
            depGet('GameWorld').create(scene, worldOptions);

            depGet('GameUI').init();
            if (depGet('GameDocs') && depGet('GameDocs').init) {
                depGet('GameDocs').init();
            }
            depGet('GameOverhead').init();

            if (startupDebugNotice) {
                setTransientDebug(startupDebugNotice, 2100);
                startupDebugNotice = '';
            }

            camera = depGet('GamePlayer').init(scene);
            depGet('GameThrowables').init(scene);

            if (multiplayerMode) {
                if (!depGet('GameNet').isActive || !depGet('GameNet').isActive()) {
                    depGet('GameNet').init(scene);
                }
            } else {
                var enemyCount = depGet('GameWorld').getRecommendedEnemyCount ? depGet('GameWorld').getRecommendedEnemyCount() : DEFAULT_ENEMY_COUNT;
                if (depGet('GameLocalMatch') && depGet('GameLocalMatch').init) {
                    depGet('GameLocalMatch').init({
                        gameMode: (activeRuntimeMode && activeRuntimeMode.gameMode) ? activeRuntimeMode.gameMode : 'ffa'
                    });
                }
                depGet('GameEnemy').init(scene, enemyCount);
                depGet('GameUI').updateThrowableInfo(depGet('GameThrowables').getState());
            }

            depGet('GameAbilities').init(scene);

            applyAbilityProfile('abilities');

            if (menuLoadoutApi() && menuLoadoutApi().syncToRuntime) {
                menuLoadoutApi().syncToRuntime(multiplayerMode);
            }

            globalThis.__MAYHEM_RUNTIME.GamePlayerCombat.init({
                isPlaying: function () { return isPlaying; },
                isMultiplayer: function () { return multiplayerMode; }
            });
            var _initArmor = globalThis.__MAYHEM_RUNTIME.GameAbilities.getArmorMax ? globalThis.__MAYHEM_RUNTIME.GameAbilities.getArmorMax() : 90;
            globalThis.__MAYHEM_RUNTIME.GamePlayerCombat.applyArmorProfile(_initArmor);
            globalThis.__MAYHEM_RUNTIME.GameUI.updateHealth(globalThis.__MAYHEM_RUNTIME.GamePlayerCombat.getHP(), globalThis.__MAYHEM_RUNTIME.GamePlayerCombat.getMaxHP());
            globalThis.__MAYHEM_RUNTIME.GameUI.updateAbilityInfo(globalThis.__MAYHEM_RUNTIME.GameAbilities.getHudState());

            applyDebugVisuals(false);

            syncMenuWeaponSlotsToRuntime();
            var syncedWeapons = menuLoadoutApi() && menuLoadoutApi().getWeaponSlots
                ? menuLoadoutApi().getWeaponSlots()
                : menuWeaponSlots;
            if (syncedWeapons && syncedWeapons[0]) {
                applyWeapon(globalThis.__MAYHEM_RUNTIME.GameHitscan.setWeapon(syncedWeapons[0]));
            } else {
                applyWeapon(globalThis.__MAYHEM_RUNTIME.GameHitscan.getCurrentWeapon());
            }

            runtimeInitialized = true;
            setupPointerLock();
            showGameplayPrompt();
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
            var netApi = depGet('GameNet');
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
            if (globalThis.__MAYHEM_RUNTIME.GameUI && globalThis.__MAYHEM_RUNTIME.GameUI.updateWeaponInfo) {
                globalThis.__MAYHEM_RUNTIME.GameUI.updateWeaponInfo(currentWeapon);
            }
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
            var activeMatchState = globalThis.__MAYHEM_RUNTIME.GameNet.getMatchState
                ? globalThis.__MAYHEM_RUNTIME.GameNet.getMatchState()
                : null;
            if (selfState) {
                if (globalThis.__MAYHEM_RUNTIME.GameNetSelfSync && globalThis.__MAYHEM_RUNTIME.GameNetSelfSync.syncPlayerState) {
                    globalThis.__MAYHEM_RUNTIME.GameNetSelfSync.syncPlayerState(selfState, dt);
                }
            }

            if (globalThis.__MAYHEM_RUNTIME.GameNet.getSelfAbilityState) {
                var abilityState = globalThis.__MAYHEM_RUNTIME.GameNet.getSelfAbilityState();
                if (abilityState) {
                    var hudState = globalThis.__MAYHEM_RUNTIME.GameAbilities.getHudState();
                    hudState.slot1Cooldown = Number(
                        abilityState.slot1CooldownRemaining != null
                            ? abilityState.slot1CooldownRemaining
                            : abilityState.abilityCooldownRemaining || 0
                    );
                    hudState.slot2Cooldown = Number(
                        abilityState.slot2CooldownRemaining != null
                            ? abilityState.slot2CooldownRemaining
                            : abilityState.ultimateCooldownRemaining || 0
                    );
                    hudState.extra = '';
                    if (abilityState.deadeyeState && abilityState.deadeyeState.maxLocks > 0) {
                        hudState.extra = 'DEADEYE ' + abilityState.deadeyeState.lockCount + '/' + abilityState.deadeyeState.maxLocks;
                    }
                    globalThis.__MAYHEM_RUNTIME.GameUI.updateAbilityInfo(hudState);
                }
            }

            if (activeMatchState && activeMatchState.ended && Number(activeMatchState.endedAt || 0) > 0) {
                if (lastHandledMatchEndAt !== Number(activeMatchState.endedAt || 0)) {
                    lastHandledMatchEndAt = Number(activeMatchState.endedAt || 0);
                    if (document.pointerLockElement && document.exitPointerLock) {
                        document.exitPointerLock();
                    }
                    setTransientDebug(winnerLabel(activeMatchState, selfState) + ' won the round.', 1800);
                }
            } else {
                lastHandledMatchEndAt = 0;
            }

            var notice = globalThis.__MAYHEM_RUNTIME.GameNet.consumeNotice();
            if (notice) setTransientDebug(notice, 900);

            if (globalThis.__MAYHEM_RUNTIME.GameNetFeedbackSync && globalThis.__MAYHEM_RUNTIME.GameNetFeedbackSync.syncGameplayFeedback) {
                globalThis.__MAYHEM_RUNTIME.GameNetFeedbackSync.syncGameplayFeedback({
                    dt: dt,
                    selfState: selfState,
                    camera: camera,
                    setTransientDebug: setTransientDebug
                });
            }
            if (globalThis.__MAYHEM_RUNTIME.GameUI && globalThis.__MAYHEM_RUNTIME.GameUI.updateMatchStatus && globalThis.__MAYHEM_RUNTIME.GameNet && globalThis.__MAYHEM_RUNTIME.GameNet.getMatchState) {
                globalThis.__MAYHEM_RUNTIME.GameUI.updateMatchStatus(activeMatchState, selfState || globalThis.__MAYHEM_RUNTIME.GameNet.getSelfState());
            }
            updateMenuSessionPanel(activeMatchState, selfState || globalThis.__MAYHEM_RUNTIME.GameNet.getSelfState());
        } else {
            if (globalThis.__MAYHEM_RUNTIME.GameLocalMatch && globalThis.__MAYHEM_RUNTIME.GameLocalMatch.tick) {
                globalThis.__MAYHEM_RUNTIME.GameLocalMatch.tick(dt);
            }
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
            var localMatchState = globalThis.__MAYHEM_RUNTIME.GameLocalMatch && globalThis.__MAYHEM_RUNTIME.GameLocalMatch.getMatchState
                ? globalThis.__MAYHEM_RUNTIME.GameLocalMatch.getMatchState()
                : null;
            var localSelfState = globalThis.__MAYHEM_RUNTIME.GameLocalMatch && globalThis.__MAYHEM_RUNTIME.GameLocalMatch.getSelfState
                ? globalThis.__MAYHEM_RUNTIME.GameLocalMatch.getSelfState()
                : null;
            if (localMatchState && localMatchState.ended && Number(localMatchState.endedAt || 0) > 0) {
                if (lastHandledMatchEndAt !== Number(localMatchState.endedAt || 0)) {
                    lastHandledMatchEndAt = Number(localMatchState.endedAt || 0);
                    if (document.pointerLockElement && document.exitPointerLock) {
                        document.exitPointerLock();
                    }
                    setTransientDebug(winnerLabel(localMatchState, localSelfState) + ' won the round.', 1800);
                }
            } else {
                lastHandledMatchEndAt = 0;
            }
            globalThis.__MAYHEM_RUNTIME.GameUI.updateMatchStatus(localMatchState, localSelfState);
            updateMenuSessionPanel(localMatchState, localSelfState);
        }

        if (!armedThrowableType && globalThis.__MAYHEM_RUNTIME.GameUI && globalThis.__MAYHEM_RUNTIME.GameUI.updateTrackingReticle) {
            globalThis.__MAYHEM_RUNTIME.GameUI.updateTrackingReticle(false, false);
        }

        currentAimTargetId = '';
        var centerTarget = globalThis.__MAYHEM_RUNTIME.GameHitscan.peekCenterTarget(camera);
        if (centerTarget && centerTarget.targetId) {
            currentAimTargetId = centerTarget.targetId;
        }
        if (globalThis.__MAYHEM_RUNTIME.GameUI && globalThis.__MAYHEM_RUNTIME.GameUI.setHitscanTargetState) {
            globalThis.__MAYHEM_RUNTIME.GameUI.setHitscanTargetState(!!(currentWeapon && currentWeapon.id !== 'shotgun' && centerTarget && centerTarget.hitbox));
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

        var weaponHudState = globalThis.__MAYHEM_RUNTIME.GameHitscan.getHudState
            ? globalThis.__MAYHEM_RUNTIME.GameHitscan.getHudState()
            : {
                status: globalThis.__MAYHEM_RUNTIME.GameHitscan.cooldownRemaining() <= 0 ? 'ready' : 'cooldown',
                pct: (function () {
                    var total = globalThis.__MAYHEM_RUNTIME.GameHitscan.getCooldown();
                    var remaining = globalThis.__MAYHEM_RUNTIME.GameHitscan.cooldownRemaining();
                    if (remaining <= 0 || total <= 0) return 1;
                    return 1 - (remaining / total);
                })()
            };

        globalThis.__MAYHEM_RUNTIME.GameUI.updateCooldown(weaponHudState);
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
        if (!multiplayerMode && globalThis.__MAYHEM_RUNTIME.GamePlayer && globalThis.__MAYHEM_RUNTIME.GamePlayer.setStatusState) {
            globalThis.__MAYHEM_RUNTIME.GamePlayer.setStatusState({
                stunUntil: 0,
                hookPullUntil: 0,
                chokeStartedAt: 0,
                chokeUntil: 0,
                chokeLift: 0,
                spawnShieldUntil: (globalThis.__MAYHEM_RUNTIME.GamePlayerCombat && globalThis.__MAYHEM_RUNTIME.GamePlayerCombat.isInvulnerable && globalThis.__MAYHEM_RUNTIME.GamePlayerCombat.isInvulnerable())
                    ? (Date.now() + 120)
                    : 0
            });
        }

        var abilityLoadoutState = currentAbilityLoadoutState();
        var abilityTuningState = (globalThis.__MAYHEM_RUNTIME.GameCombatTuning && globalThis.__MAYHEM_RUNTIME.GameCombatTuning.getClassAbilityTuning)
            ? globalThis.__MAYHEM_RUNTIME.GameCombatTuning.getClassAbilityTuning() || {}
            : {};
        var slot1Ability = abilityLoadoutState ? String(abilityLoadoutState.slot1 || '') : '';
        var slot2Ability = abilityLoadoutState ? String(abilityLoadoutState.slot2 || '') : '';

        if (globalThis.__MAYHEM_RUNTIME.GameUI.updateChokeReticle) {
            var chokeVisible = !!debugVisualsOn && (slot1Ability === 'choke' || slot2Ability === 'choke');
            var chokeRectSize = chokeRectSizePx(camera);
            globalThis.__MAYHEM_RUNTIME.GameUI.updateChokeReticle(chokeVisible, chokeRectSize.width, chokeRectSize.height);
        }
        if (globalThis.__MAYHEM_RUNTIME.GameUI.updateHookReticle) {
            var hookVisible = !!debugVisualsOn && (slot1Ability === 'hook' || slot2Ability === 'hook');
            var hookReticleSize = Number(abilityTuningState.hookReticleRadiusPx || 52) * 2;
            globalThis.__MAYHEM_RUNTIME.GameUI.updateHookReticle(hookVisible, hookReticleSize);
        }
        if (globalThis.__MAYHEM_RUNTIME.GameUI.updateDeadeyeDebugRect) {
            var deadeyeVisible = !!debugVisualsOn && (slot1Ability === 'deadeye' || slot2Ability === 'deadeye');
            var deadeyeMinDot = Number(((currentAbilityCatalogMap().deadeye || {}).minDot) || 0.18);
            var deadeyeRect = deadeyeDebugRectSizePx(camera, deadeyeMinDot);
            globalThis.__MAYHEM_RUNTIME.GameUI.updateDeadeyeDebugRect(
                deadeyeVisible,
                deadeyeRect ? deadeyeRect.width : 220,
                deadeyeRect ? deadeyeRect.height : 160
            );
        }
        if (globalThis.__MAYHEM_RUNTIME.GameUI.updateAbilityDebugPanel) {
            globalThis.__MAYHEM_RUNTIME.GameUI.updateAbilityDebugPanel(
                !!debugVisualsOn && !!abilityLoadoutState,
                buildAbilityDebugText(abilityLoadoutState, abilityTuningState)
            );
        }
        if (globalThis.__MAYHEM_RUNTIME.GameUI.updateDeadeyeReticle) {
            var deadeyeStateForUi = null;
            var abilityBoundary = globalThis.__MAYHEM_RUNTIME.GameAbilityBoundary || null;
            if (multiplayerMode && globalThis.__MAYHEM_RUNTIME.GameNet && globalThis.__MAYHEM_RUNTIME.GameNet.getSelfAbilityState) {
                var abilState = globalThis.__MAYHEM_RUNTIME.GameNet.getSelfAbilityState();
                if (abilState && abilState.deadeyeState && abilState.deadeyeState.maxLocks > 0) {
                    deadeyeStateForUi = abilityBoundary && abilityBoundary.buildNetworkDeadeyeUiState
                        ? abilityBoundary.buildNetworkDeadeyeUiState(
                            abilState.deadeyeState,
                            function (targetId) {
                                return globalThis.__MAYHEM_RUNTIME.GameNet.getEntityMarkerWorldPos
                                    ? globalThis.__MAYHEM_RUNTIME.GameNet.getEntityMarkerWorldPos(targetId)
                                    : null;
                            },
                            Date.now()
                        )
                        : null;
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
        camera.layers.set(0);
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

    function partyPath() {
        var protocol = (globalThis.__MAYHEM_RUNTIME.GameShared && globalThis.__MAYHEM_RUNTIME.GameShared.protocol)
            ? globalThis.__MAYHEM_RUNTIME.GameShared.protocol
            : null;
        return (protocol && protocol.partyPath) ? protocol.partyPath : '/api/party';
    }

    function privateRoomPath() {
        var protocol = (globalThis.__MAYHEM_RUNTIME.GameShared && globalThis.__MAYHEM_RUNTIME.GameShared.protocol)
            ? globalThis.__MAYHEM_RUNTIME.GameShared.protocol
            : null;
        return (protocol && protocol.privateRoomPath) ? protocol.privateRoomPath : '/api/private-room';
    }

    function roomCodeFromRoomId(roomId) {
        var shared = globalThis.__MAYHEM_RUNTIME.GameShared || {};
        var helper = shared.privateRoomCodes;
        if (helper && helper.privateRoomCodeFromId) {
            return helper.privateRoomCodeFromId(roomId);
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
        el.classList.toggle('debug-active', !!debugVisualsOn);
        if (!mode) {
            el.textContent = debugVisualsOn ? 'DEBUG MODE :: PRESS H TO SWITCH' : 'PROFILE :: STANDBY';
            return;
        }

        if (debugVisualsOn) {
            el.textContent = 'DEBUG MODE :: PRESS H TO SWITCH';
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
            if (String(mode.gameMode || 'ffa').toLowerCase() === 'lms') {
                return 'Connecting to Last Man Standing: ' + mode.roomId + '...';
            }
            return 'Connecting to Free For All: ' + mode.roomId + '...';
        }
        if (mode.id === 'single_cloudflare') {
            return 'Connecting to Solo Cloudflare room: ' + mode.roomId + '...';
        }
        if (mode.id === 'single_dev_server') {
            return 'Connecting to Local Dev Room: ' + mode.roomId + '...';
        }
        return String(mode.gameMode || 'ffa').toLowerCase() === 'lms'
            ? 'Starting Offline Sandbox: LMS...'
            : 'Starting Offline Sandbox: FFA...';
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
            if (String(mode.gameMode || 'ffa').toLowerCase() === 'lms') {
                return 'Last Man Standing joined room ' + mode.roomId + '.';
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
        return String(mode.gameMode || 'ffa').toLowerCase() === 'lms'
            ? 'Offline Sandbox LMS: local simulated players.'
            : 'Offline Sandbox FFA: local simulated players.';
    }

    function launchModeById(modeId, options) {
        options = options || {};
        var runtime = runtimeProfile();
        var authApi = globalThis.__MAYHEM_RUNTIME.GameNetAuth || null;
        var selectedMode = runtime && runtime.selectMode ? runtime.selectMode(modeId) : activeModeById(modeId);
        if (!selectedMode) {
            return { ok: false, error: 'Unknown runtime mode.' };
        }

        if (options.roomId) {
            selectedMode.roomId = String(options.roomId);
        }
        if (options.gameMode) {
            selectedMode.gameMode = String(options.gameMode);
        }

        activeRuntimeMode = selectedMode;

        if (selectedMode.authorityMode === 'networked') {
            forcedRoomId = selectedMode.roomId || 'global';
            if (authApi && authApi.setAuthVisible) {
                authApi.setAuthVisible(false);
            }
            if (globalThis.__MAYHEM_RUNTIME.GameNet && globalThis.__MAYHEM_RUNTIME.GameNet.setRoomId) {
                globalThis.__MAYHEM_RUNTIME.GameNet.setRoomId(forcedRoomId);
            }
            startupDebugNotice = options.notice || startupNoticeForMode(selectedMode);
        } else {
            forcedRoomId = 'global';
            if (globalThis.__MAYHEM_RUNTIME.GameNet && globalThis.__MAYHEM_RUNTIME.GameNet.setRoomId) {
                globalThis.__MAYHEM_RUNTIME.GameNet.setRoomId('global');
            }
            startupDebugNotice = options.notice || startupNoticeForMode(selectedMode);
        }

        syncMenuWeaponSlotsToRuntime();

        try {
            initGame();
        } catch (err) {
            var msg = (err && err.message) ? err.message : String(err || 'Unknown startup error');
            var overlayEl = document.getElementById('overlay');
            if (overlayEl) overlayEl.style.display = 'flex';
            var dbg = document.getElementById('debug-info');
            if (dbg) dbg.textContent = 'Startup error: ' + msg;
            console.error('Startup error:', err);
            activeRuntimeMode = null;
            autoStartNoLock = false;
            startupDebugNotice = '';
            forcedRoomId = 'global';
            if (runtime && runtime.clearSelectedMode) {
                runtime.clearSelectedMode();
            }
            return { ok: false, error: msg };
        }

        return {
            ok: true,
            mode: selectedMode
        };
    }

    function getActivityState() {
        if (!activeRuntimeMode || !runtimeInitialized) return 'menu';
        if (
            multiplayerMode &&
            globalThis.__MAYHEM_RUNTIME.GameNet &&
            globalThis.__MAYHEM_RUNTIME.GameNet.getPrivateRoomPhase &&
            globalThis.__MAYHEM_RUNTIME.GameNet.getPrivateRoomPhase() === 'lobby'
        ) {
            return 'private_room_lobby';
        }
        return 'in_match';
    }

    globalThis.__MAYHEM_RUNTIME.GameMain = {
        launchModeById: launchModeById,
        getActivityState: getActivityState
    };
})();
