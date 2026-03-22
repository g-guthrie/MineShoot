/**
 * menu-loadout.js - Menu-only loadout state and UI.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameMenuLoadout
 */
(function () {
    'use strict';

    var GameMenuLoadout = {};
    var runtime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};

    function inputLabelsApi() {
        return runtime.GameInputLabels || null;
    }

    function sharedApi() {
        return runtime.GameShared || {};
    }

    function tuningApi() {
        return sharedApi().gameplayTuning || {};
    }

    function selectableWeaponIds() {
        var shared = sharedApi();
        var ids = shared.getSelectableWeaponIds ? shared.getSelectableWeaponIds() : null;
        return Array.isArray(ids) && ids.length ? ids : ['machinegun', 'shotgun', 'rifle', 'pistol', 'sniper'];
    }

    function defaultWeaponLoadout() {
        var shared = sharedApi();
        var defaults = shared.getDefaultWeaponLoadout ? shared.getDefaultWeaponLoadout() : null;
        return Array.isArray(defaults) && defaults.length ? defaults : ['rifle', 'shotgun'];
    }

    function resolvedDefaultWeaponLoadout() {
        var defaults = Array.isArray(defaultWeaponLoadout()) ? defaultWeaponLoadout() : [];
        var selectableIds = selectableWeaponIds();
        var allowed = {};
        var next = [];

        function pushWeapon(weaponId) {
            var normalized = String(weaponId || '');
            if (!normalized || !allowed[normalized]) return;
            if (next.indexOf(normalized) !== -1) return;
            next.push(normalized);
        }

        for (var i = 0; i < selectableIds.length; i++) {
            var selectableId = String(selectableIds[i] || '');
            if (!selectableId) continue;
            allowed[selectableId] = true;
        }
        for (var n = 0; n < defaults.length; n++) {
            pushWeapon(defaults[n]);
        }
        for (var x = 0; x < selectableIds.length; x++) {
            pushWeapon(selectableIds[x]);
        }
        while (next.length < 2) {
            next.push('');
        }
        return next.slice(0, 2);
    }

    function defaultAbilityId() {
        var shared = sharedApi();
        var tuning = tuningApi();
        var defaultId = shared.getDefaultAbilityId ? shared.getDefaultAbilityId() : '';
        if (!defaultId && shared.getDefaultAbilityLoadout) {
            var legacyLoadout = shared.getDefaultAbilityLoadout() || null;
            defaultId = legacyLoadout && legacyLoadout.slot1 ? legacyLoadout.slot1 : '';
        }
        return String(defaultId || tuning.defaultAbilityId || 'deadeye');
    }

    function throwableDefs() {
        return tuningApi().throwables || {};
    }

    function selectableThrowableIds() {
        var defs = throwableDefs();
        return Array.isArray(defs.order) ? defs.order : Object.keys(defs).filter(function (k) { return k !== 'order'; });
    }

    function abilityCatalog() {
        return tuningApi().abilityCatalog || {};
    }

    function weaponStats() {
        return tuningApi().weaponStats || {};
    }

    var STORAGE_KEY = 'mayhem.menu.loadout.v1';

    var state = {
        weaponSlots: ['rifle', 'shotgun'],
        activeWeaponSlot: 0,
        selectedAbilityId: 'deadeye',
        selectedThrowableId: 'frag',
        loadoutExpanded: true,
        initialized: false
    };
    var subscribers = [];

    function applySharedDefaults() {
        var weaponDefaults = resolvedDefaultWeaponLoadout();
        var abilityDefault = defaultAbilityId();
        if (!Array.isArray(state.weaponSlots)) {
            state.weaponSlots = [];
        }
        compactWeaponSlots();
        if (!state.weaponSlots.length) {
            state.weaponSlots = ['', ''];
        }
        if (!state.weaponSlots[0] && weaponDefaults[0]) state.weaponSlots[0] = String(weaponDefaults[0] || '');
        if (!state.weaponSlots[1] && weaponDefaults[1] && weaponDefaults[1] !== state.weaponSlots[0]) {
            state.weaponSlots[1] = String(weaponDefaults[1] || '');
        }
        compactWeaponSlots();
        if (!state.selectedAbilityId) state.selectedAbilityId = String(abilityDefault || '');
        var throwableIds = selectableThrowableIds();
        if (!state.selectedThrowableId || throwableIds.indexOf(state.selectedThrowableId) === -1) {
            state.selectedThrowableId = throwableIds.length ? String(throwableIds[0]) : 'frag';
        }
    }

    function localStore() {
        try {
            return window.localStorage || null;
        } catch (_err) {
            return null;
        }
    }

    function refreshBindingCopy() {
        var inputLabels = inputLabelsApi();
        var weaponTitle = document.getElementById('weapon-slot-title');
        var throwableTitle = document.getElementById('throwable-slot-title');
        var abilityTitle = document.getElementById('ability-slot-title');

        var throwableKey = inputLabels && inputLabels.getBindingLabel
            ? inputLabels.getBindingLabel('throwable', 'Q')
            : 'Q';

        if (weaponTitle) {
            var flag = document.getElementById('weapon-pick-flag');
            if (flag && flag.parentNode === weaponTitle) {
                weaponTitle.childNodes[0].textContent = 'Weapons ';
            } else {
                weaponTitle.textContent = 'Weapons';
            }
        }
        if (throwableTitle) throwableTitle.textContent = 'Throwables';
        if (abilityTitle) abilityTitle.textContent = 'Abilities';
    }

    function weaponNameLookup() {
        var stats = weaponStats();
        var out = {};
        for (var weaponId in stats) {
            if (!Object.prototype.hasOwnProperty.call(stats, weaponId)) continue;
            out[weaponId] = String((stats[weaponId] && stats[weaponId].name) || weaponId);
        }
        return out;
    }

    function throwableName(throwableId) {
        var def = throwableDefs()[String(throwableId || '')] || {};
        return String(def.label || throwableId || '');
    }

    function abilityName(abilityId) {
        var def = abilityCatalog()[String(abilityId || '')] || {};
        return String(def.name || abilityId || '');
    }

    function abilityList() {
        var catalog = abilityCatalog();
        var out = [];
        for (var abilityId in catalog) {
            if (!Object.prototype.hasOwnProperty.call(catalog, abilityId)) continue;
            var def = catalog[abilityId];
            out.push({
                id: String(def.id || abilityId),
                name: String(def.name || abilityId)
            });
        }
        return out;
    }

    function compactWeaponSlots() {
        var allowed = {};
        var used = {};
        var weaponIds = selectableWeaponIds();
        for (var i = 0; i < weaponIds.length; i++) {
            allowed[String(weaponIds[i] || '')] = true;
        }
        var next = ['', ''];
        for (var n = 0; n < 2; n++) {
            var id = String(state.weaponSlots[n] || '');
            if (allowed[id] && !used[id]) {
                next[n] = id;
                used[id] = true;
            } else {
                next[n] = '';
            }
        }
        state.weaponSlots = next;
        if (state.activeWeaponSlot < 0 || state.activeWeaponSlot > 1) state.activeWeaponSlot = 0;
    }

    function slotClassName(slotIndex) {
        return slotIndex === 1 ? 'slot-2' : 'slot-1';
    }

    function pairOwnerIndex(pair, selectedId) {
        var target = String(selectedId || '');
        if (!target) return -1;
        if (String(pair[0] || '') === target) return 0;
        if (String(pair[1] || '') === target) return 1;
        return -1;
    }

    function assignSharedSlotSelection(pair, activeSlot, selectedId) {
        var selected = String(selectedId || '');
        var active = activeSlot === 1 ? 1 : 0;
        var other = active === 0 ? 1 : 0;
        var next = [
            String(pair && pair[0] || ''),
            String(pair && pair[1] || '')
        ];
        if (!selected || next[active] === selected) return null;
        if (next[other] === selected) {
            next[other] = next[active];
        }
        next[active] = selected;
        return next;
    }

    function currentSelectedAbilityId() {
        normalizeAbilityState();
        return String(state.selectedAbilityId || '');
    }

    function normalizeAbilityState() {
        var shared = sharedApi();
        var legacyAbilityId = '';
        if (!state.selectedAbilityId && state.abilityLoadout && typeof state.abilityLoadout === 'object') {
            legacyAbilityId = String(state.abilityLoadout.slot1 || '');
        }
        if (shared.normalizeAbilityId) {
            state.selectedAbilityId = shared.normalizeAbilityId(state.selectedAbilityId || legacyAbilityId);
        } else if (shared.normalizeAbilityLoadout) {
            var normalizedLegacy = shared.normalizeAbilityLoadout(state.selectedAbilityId || legacyAbilityId, '');
            state.selectedAbilityId = String(normalizedLegacy && normalizedLegacy.slot1 || '');
        } else {
            state.selectedAbilityId = String(state.selectedAbilityId || legacyAbilityId || defaultAbilityId());
        }
        return String(state.selectedAbilityId || '');
    }

    function applyToGameplayRuntime(multiplayerMode) {
        compactWeaponSlots();
        // If loadout is incomplete (mid-pick), fill from defaults so the game always gets two weapons
        if (!state.weaponSlots[0] || !state.weaponSlots[1]) {
            var defaults = resolvedDefaultWeaponLoadout();
            if (!state.weaponSlots[0]) state.weaponSlots[0] = defaults[0] || '';
            if (!state.weaponSlots[1]) {
                state.weaponSlots[1] = (defaults[1] && defaults[1] !== state.weaponSlots[0])
                    ? defaults[1] : '';
            }
        }
        var net = runtime.GameNet || null;
        var netCommands = net && net.commands ? net.commands : net;
        var weaponSlots = state.weaponSlots.slice(0, 2).filter(Boolean);
        var hasCompleteWeaponLoadout = !!(state.weaponSlots[0] && state.weaponSlots[1]);
        if (runtime.GameHitscan && runtime.GameHitscan.setWeaponOrder && hasCompleteWeaponLoadout) {
            runtime.GameHitscan.setWeaponOrder(weaponSlots);
        }
        if (runtime.GamePlayer && runtime.GamePlayer.setLoadout && hasCompleteWeaponLoadout) {
            runtime.GamePlayer.setLoadout({ slots: weaponSlots });
        }
        if (netCommands && netCommands.sendWeaponLoadout && multiplayerMode && hasCompleteWeaponLoadout) {
            netCommands.sendWeaponLoadout(state.weaponSlots[0] || '', state.weaponSlots[1] || '');
        }
        if (runtime.GameThrowables && runtime.GameThrowables.setSelectedThrowable && state.selectedThrowableId) {
            runtime.GameThrowables.setSelectedThrowable(state.selectedThrowableId);
        }
        normalizeAbilityState();
        if (runtime.GameAbilities && runtime.GameAbilities.setLoadout) {
            runtime.GameAbilities.setLoadout(state.selectedAbilityId || '');
            if (runtime.GameUI && runtime.GameUI.updateAbilityInfo && runtime.GameAbilities.getHudState) {
                runtime.GameUI.updateAbilityInfo(runtime.GameAbilities.getHudState());
            }
        }
        if (netCommands && netCommands.sendAbilityLoadout && multiplayerMode) {
            netCommands.sendAbilityLoadout(state.selectedAbilityId || '');
        }
    }

    function notifySubscribers() {
        var snapshot = GameMenuLoadout.getRuntimeSnapshot();
        for (var i = 0; i < subscribers.length; i++) {
            try {
                subscribers[i](snapshot);
            } catch (_err) {
                // no-op
            }
        }
    }

    function saveState() {
        var store = localStore();
        if (!store || typeof store.setItem !== 'function') return false;
        try {
            store.setItem(STORAGE_KEY, JSON.stringify(GameMenuLoadout.getRuntimeSnapshot()));
            return true;
        } catch (_err) {
            return false;
        }
    }

    function loadStoredState() {
        var store = localStore();
        if (!store || typeof store.getItem !== 'function') return;
        try {
            var raw = String(store.getItem(STORAGE_KEY) || '').trim();
            if (!raw) return;
            var parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object') return;

            if (Array.isArray(parsed.weaponSlots)) {
                state.weaponSlots = parsed.weaponSlots.slice(0, 2).map(function (weaponId) {
                    return String(weaponId || '');
                });
            }
            if (parsed.selectedAbilityId) state.selectedAbilityId = String(parsed.selectedAbilityId || '');
            if (!state.selectedAbilityId && parsed.abilityId) state.selectedAbilityId = String(parsed.abilityId || '');
            if (!state.selectedAbilityId && parsed.abilityLoadout && typeof parsed.abilityLoadout === 'object') {
                state.selectedAbilityId = String(parsed.abilityLoadout.slot1 || '');
            }
            if (parsed.selectedThrowableId) {
                state.selectedThrowableId = String(parsed.selectedThrowableId || '');
            }
            compactWeaponSlots();
            normalizeAbilityState();
        } catch (_err) {
            // no-op
        }
    }

    function validateSelections() {
        compactWeaponSlots();
        var inputLabels = inputLabelsApi();
        var missingWeapons = [];
        var missingAbilities = [];
        if (!state.weaponSlots[0]) missingWeapons.push('weapon slot 1');
        if (!state.weaponSlots[1]) missingWeapons.push('weapon slot 2');
        normalizeAbilityState();
        if (!state.selectedAbilityId) missingAbilities.push('ability ' + (inputLabels && inputLabels.getBindingLabel ? inputLabels.getBindingLabel('ability_1', 'E') : 'E'));
        if (!missingWeapons.length && !missingAbilities.length) return { ok: true, message: '' };
        var parts = [];
        if (missingWeapons.length) parts.push('Missing ' + missingWeapons.join(' and '));
        if (missingAbilities.length) parts.push('Missing ' + missingAbilities.join(' and '));
        return { ok: false, message: parts.join(' | ') };
    }

    function sectionChrome() {
        return {
            root: document.getElementById('menu-loadout-band'),
            expandedShell: document.getElementById('loadout-expanded-shell'),
            collapsedRow: document.getElementById('loadout-collapsed-row'),
            collapseBtn: document.getElementById('loadout-collapse-btn'),
            weaponsSummary: document.getElementById('weapon-slot-summary'),
            weaponsPanel: document.getElementById('weapon-slot-panel'),
            throwableSummary: document.getElementById('throwable-slot-summary'),
            throwablePanel: document.getElementById('throwable-slot-panel'),
            abilitySummary: document.getElementById('ability-slot-summary'),
            abilityPanel: document.getElementById('ability-slot-panel')
        };
    }

    function renderSummaries() {
        compactWeaponSlots();
        normalizeAbilityState();
        var chrome = sectionChrome();
        var names = weaponNameLookup();
        var weaponCopy = [
            state.weaponSlots[0] ? String(names[state.weaponSlots[0]] || state.weaponSlots[0]) : 'Empty',
            state.weaponSlots[1] ? String(names[state.weaponSlots[1]] || state.weaponSlots[1]) : 'Empty'
        ].join(' / ');
        var throwableCopy = throwableName(state.selectedThrowableId) || 'Empty';
        var abilityCopy = abilityName(state.selectedAbilityId) || 'Empty';

        if (chrome.weaponsSummary) chrome.weaponsSummary.textContent = 'Weapons: ' + weaponCopy;
        if (chrome.throwableSummary) chrome.throwableSummary.textContent = 'Throwable: ' + throwableCopy;
        if (chrome.abilitySummary) chrome.abilitySummary.textContent = 'Abilities: ' + abilityCopy;
    }

    function renderSectionChrome() {
        var chrome = sectionChrome();
        if (chrome.root) chrome.root.setAttribute('data-state', state.loadoutExpanded ? 'expanded' : 'collapsed');
        if (chrome.expandedShell) chrome.expandedShell.hidden = !state.loadoutExpanded;
        if (chrome.collapsedRow) chrome.collapsedRow.hidden = state.loadoutExpanded;
        if (chrome.collapseBtn) {
            chrome.collapseBtn.textContent = state.loadoutExpanded ? 'Collapse' : 'open loadout';
            chrome.collapseBtn.setAttribute('aria-expanded', state.loadoutExpanded ? 'true' : 'false');
        }
        if (chrome.weaponsSummary) chrome.weaponsSummary.setAttribute('aria-expanded', state.loadoutExpanded ? 'true' : 'false');
        if (chrome.throwableSummary) chrome.throwableSummary.setAttribute('aria-expanded', state.loadoutExpanded ? 'true' : 'false');
        if (chrome.abilitySummary) chrome.abilitySummary.setAttribute('aria-expanded', state.loadoutExpanded ? 'true' : 'false');
        if (chrome.weaponsPanel) chrome.weaponsPanel.hidden = false;
        if (chrome.throwablePanel) chrome.throwablePanel.hidden = false;
        if (chrome.abilityPanel) chrome.abilityPanel.hidden = false;
    }

    function setLoadoutExpanded(expanded) {
        var next = !!expanded;
        if (state.loadoutExpanded === next) return false;
        state.loadoutExpanded = next;
        renderSummaries();
        renderSectionChrome();
        return true;
    }

    function setExpandedSection(sectionId) {
        var normalized = String(sectionId || '').trim();
        if (normalized) {
            setLoadoutExpanded(true);
            return;
        }
        setLoadoutExpanded(false);
    }

    function bindSectionChrome() {
        var chrome = sectionChrome();
        if (!chrome.root || chrome.root.__loadoutSummaryBound) return;
        chrome.root.__loadoutSummaryBound = true;

        function expandAll() {
            setLoadoutExpanded(true);
        }

        if (chrome.collapseBtn) {
            chrome.collapseBtn.addEventListener('click', function () {
                setLoadoutExpanded(!state.loadoutExpanded);
            });
        }
        if (chrome.weaponsSummary) chrome.weaponsSummary.addEventListener('click', expandAll);
        if (chrome.throwableSummary) chrome.throwableSummary.addEventListener('click', expandAll);
        if (chrome.abilitySummary) chrome.abilitySummary.addEventListener('click', expandAll);

        renderSummaries();
        renderSectionChrome();
    }

    function bindWeaponUi() {
        var weaponChoiceGrid = document.getElementById('weapon-choice-grid');
        var pickFlag = document.getElementById('weapon-pick-flag');
        if (!weaponChoiceGrid) return;
        if (weaponChoiceGrid.__menuLoadoutBound) return;
        weaponChoiceGrid.__menuLoadoutBound = true;

        function needsSecondPick() {
            return !!(state.weaponSlots[0] && !state.weaponSlots[1]);
        }

        function render() {
            compactWeaponSlots();
            var slots = state.weaponSlots.slice(0, 2);
            var names = weaponNameLookup();

            weaponChoiceGrid.innerHTML = '';
            var weaponIds = selectableWeaponIds();
            for (var n = 0; n < weaponIds.length; n++) {
                var weaponId = weaponIds[n];
                var choice = document.createElement('button');
                choice.type = 'button';
                choice.classList.add('weapon-choice-btn');
                choice.dataset.weaponId = weaponId;
                choice.textContent = String(names[weaponId] || weaponId).toUpperCase();
                var ownerIndex = pairOwnerIndex(slots, weaponId);
                if (ownerIndex === 0) {
                    choice.classList.add('weapon-primary', 'active');
                } else if (ownerIndex === 1) {
                    choice.classList.add('weapon-secondary', 'active');
                }
                choice.addEventListener('click', function (e) {
                    e.stopPropagation();
                    var selectedId = String(this.dataset.weaponId || '');
                    var currentOwner = pairOwnerIndex(state.weaponSlots, selectedId);
                    if (currentOwner !== -1) return; // already selected, ignore

                    if (needsSecondPick()) {
                        state.weaponSlots[1] = selectedId;
                    } else {
                        state.weaponSlots = [selectedId, ''];
                    }
                    if (state.weaponSlots[0] && state.weaponSlots[1]) {
                        applyToGameplayRuntime(true);
                    }
                    render();
                    saveState();
                    notifySubscribers();
                });
                weaponChoiceGrid.appendChild(choice);
            }

            if (pickFlag) {
                pickFlag.classList.toggle('hidden', !needsSecondPick());
            }
            renderSummaries();
        }

        render();
    }

    function bindThrowableUi() {
        var choiceGrid = document.getElementById('throwable-choice-grid');
        if (!choiceGrid) return;
        if (choiceGrid.__throwableMenuBound) return;
        choiceGrid.__throwableMenuBound = true;

        function render() {
            choiceGrid.innerHTML = '';
            var throwableIds = selectableThrowableIds();
            var defs = throwableDefs();
            for (var i = 0; i < throwableIds.length; i++) {
                var throwableId = throwableIds[i];
                var def = defs[throwableId] || {};
                var choice = document.createElement('button');
                choice.type = 'button';
                choice.className = 'btn throwable-choice-btn';
                choice.dataset.throwableId = throwableId;
                choice.textContent = String(def.label || throwableId || '').toUpperCase();
                if (state.selectedThrowableId === throwableId) choice.classList.add('active');
                choice.addEventListener('click', function (e) {
                    e.stopPropagation();
                    var id = String(this.dataset.throwableId || '');
                    if (state.selectedThrowableId === id) return;
                    state.selectedThrowableId = id;
                    applyToGameplayRuntime(true);
                    render();
                    saveState();
                    notifySubscribers();
                });
                choiceGrid.appendChild(choice);
            }
            renderSummaries();
        }

        render();
    }

    function bindAbilityUi() {
        var choiceGrid = document.getElementById('ability-choice-grid');
        if (!choiceGrid) return;
        if (choiceGrid.__abilityMenuBound) return;
        choiceGrid.__abilityMenuBound = true;

        var catalog = abilityList();

        function render() {
            var selectedAbilityId = normalizeAbilityState();
            choiceGrid.innerHTML = '';
            for (var i = 0; i < catalog.length; i++) {
                var def = catalog[i];
                if (!def || !def.id) continue;
                var btn = document.createElement('button');
                btn.type = 'button';
                btn.classList.add('btn');
                btn.dataset.abilityId = def.id;
                btn.textContent = String(def.name || def.id).toUpperCase();
                btn.classList.add('ability-choice-btn');
                if (selectedAbilityId === def.id) btn.classList.add('active');
                btn.addEventListener('click', function (e) {
                    e.stopPropagation();
                    var id = String(this.dataset.abilityId || '');
                    normalizeAbilityState();
                    if (!id || state.selectedAbilityId === id) return;
                    state.selectedAbilityId = id;
                    normalizeAbilityState();
                    applyToGameplayRuntime(true);
                    render();
                    saveState();
                    notifySubscribers();
                });
                choiceGrid.appendChild(btn);
            }
            renderSummaries();
        }

        render();
    }

    GameMenuLoadout.init = function () {
        if (state.initialized) return;
        applySharedDefaults();
        loadStoredState();
        applySharedDefaults();
        state.initialized = true;
        bindSectionChrome();
        bindWeaponUi();
        bindThrowableUi();
        bindAbilityUi();
        refreshBindingCopy();
        if (runtime.GameInputBindings && runtime.GameInputBindings.subscribe) {
            runtime.GameInputBindings.subscribe(refreshBindingCopy);
        }
        GameMenuLoadout.syncToRuntime(false);
        saveState();
        notifySubscribers();
    };

    GameMenuLoadout.getWeaponSlots = function () {
        compactWeaponSlots();
        return state.weaponSlots.slice(0, 2);
    };

    GameMenuLoadout.getSelectedAbilityId = function () {
        return currentSelectedAbilityId();
    };

    GameMenuLoadout.getAbilityLoadout = function () {
        return {
            abilityId: currentSelectedAbilityId()
        };
    };

    GameMenuLoadout.getSelectedThrowable = function () {
        return String(state.selectedThrowableId || '');
    };

    GameMenuLoadout.validateSelections = function () {
        return validateSelections();
    };

    GameMenuLoadout.setExpandedSection = function (sectionId) {
        setExpandedSection(sectionId);
    };

    GameMenuLoadout.getExpandedSection = function () {
        return state.loadoutExpanded ? 'all' : '';
    };

    GameMenuLoadout.syncToRuntime = function (multiplayerMode) {
        applyToGameplayRuntime(!!multiplayerMode);
    };

    GameMenuLoadout.getRuntimeSnapshot = function () {
        return {
            weaponSlots: GameMenuLoadout.getWeaponSlots(),
            selectedAbilityId: GameMenuLoadout.getSelectedAbilityId(),
            selectedThrowableId: GameMenuLoadout.getSelectedThrowable()
        };
    };

    GameMenuLoadout.subscribe = function (listener) {
        if (typeof listener !== 'function') {
            return function () {};
        }
        subscribers.push(listener);
        return function unsubscribe() {
            subscribers = subscribers.filter(function (entry) {
                return entry !== listener;
            });
        };
    };

    runtime.GameMenuLoadout = GameMenuLoadout;
})();
