/**
 * menu-loadout.js - Menu-only loadout state and UI.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameMenuLoadout
 */
(function () {
    'use strict';

    var GameMenuLoadout = {};
    var runtime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    var inputLabels = runtime.GameInputLabels || null;
    var shared = runtime.GameShared || {};
    var tuning = shared.gameplayTuning || {};

    var selectableWeaponIds = (shared.getSelectableWeaponIds ? shared.getSelectableWeaponIds() : ['machinegun', 'shotgun', 'rifle', 'pistol', 'sniper']);
    var defaultWeaponLoadout = shared.getDefaultWeaponLoadout ? shared.getDefaultWeaponLoadout() : ['machinegun', 'shotgun'];
    var defaultAbilityLoadout = shared.getDefaultAbilityLoadout ? shared.getDefaultAbilityLoadout() : (tuning.defaultAbilityLoadout || { slot1: 'choke', slot2: 'missile' });
    var throwableCategories = tuning.throwableCategories || {};
    var throwableDefs = tuning.throwables || {};
    var abilityCatalog = tuning.abilityCatalog || {};
    var weaponStats = tuning.weaponStats || {};
    var STORAGE_KEY = 'mayhem.menu.loadout.v1';

    var state = {
        weaponSlots: defaultWeaponLoadout.slice(0, 2),
        activeWeaponSlot: 0,
        activeAbilitySlot: 0,
        selectedThrowableId: 'frag',
        activeThrowableCategory: 'grenade',
        loadoutExpanded: true,
        abilityLoadout: {
            slot1: String(defaultAbilityLoadout.slot1 || ''),
            slot2: String(defaultAbilityLoadout.slot2 || '')
        },
        initialized: false
    };
    var subscribers = [];

    function localStore() {
        try {
            return window.localStorage || null;
        } catch (_err) {
            return null;
        }
    }

    function refreshBindingCopy() {
        var weaponTitle = document.getElementById('weapon-slot-title');
        var throwableTitle = document.getElementById('throwable-slot-title');
        var abilityTitle = document.getElementById('ability-slot-title');

        var throwableKey = inputLabels.getBindingLabel('throwable', 'Q');

        if (weaponTitle) weaponTitle.textContent = 'Weapon Slots';
        if (throwableTitle) throwableTitle.textContent = 'Throwables [' + throwableKey + ']';
        if (abilityTitle) abilityTitle.textContent = 'Abilities';
    }

    function weaponNameLookup() {
        var out = {};
        for (var weaponId in weaponStats) {
            if (!Object.prototype.hasOwnProperty.call(weaponStats, weaponId)) continue;
            out[weaponId] = String((weaponStats[weaponId] && weaponStats[weaponId].name) || weaponId);
        }
        return out;
    }

    function throwableCatalogByCategory() {
        var out = {};
        for (var catId in throwableCategories) {
            if (!Object.prototype.hasOwnProperty.call(throwableCategories, catId)) continue;
            var cat = throwableCategories[catId];
            out[catId] = {
                label: String(cat.label || catId),
                items: (cat.items || []).map(function (id) {
                    var def = throwableDefs[id] || {};
                    return {
                        id: String(id || ''),
                        label: String(def.label || id || '')
                    };
                })
            };
        }
        return out;
    }

    function throwableName(throwableId) {
        var def = throwableDefs[String(throwableId || '')] || {};
        return String(def.label || throwableId || '');
    }

    function abilityName(abilityId) {
        var def = abilityCatalog[String(abilityId || '')] || {};
        return String(def.name || abilityId || '');
    }

    function findThrowableCategory(throwableId) {
        var targetId = String(throwableId || '');
        for (var catId in throwableCategories) {
            if (!Object.prototype.hasOwnProperty.call(throwableCategories, catId)) continue;
            var cat = throwableCategories[catId];
            var items = Array.isArray(cat.items) ? cat.items : [];
            for (var i = 0; i < items.length; i++) {
                if (String(items[i] || '') === targetId) return catId;
            }
        }
        return '';
    }

    function abilityList() {
        var out = [];
        for (var abilityId in abilityCatalog) {
            if (!Object.prototype.hasOwnProperty.call(abilityCatalog, abilityId)) continue;
            var def = abilityCatalog[abilityId];
            out.push({
                id: String(def.id || abilityId),
                name: String(def.name || abilityId)
            });
        }
        return out;
    }

    function compactWeaponSlots() {
        var allowed = {};
        for (var i = 0; i < selectableWeaponIds.length; i++) {
            allowed[String(selectableWeaponIds[i] || '')] = true;
        }
        var next = ['', ''];
        for (var n = 0; n < 2; n++) {
            var id = String(state.weaponSlots[n] || '');
            next[n] = allowed[id] ? id : '';
        }
        state.weaponSlots = next;
        if (state.activeWeaponSlot < 0 || state.activeWeaponSlot > 1) state.activeWeaponSlot = 0;
        if (state.activeAbilitySlot < 0 || state.activeAbilitySlot > 1) state.activeAbilitySlot = 0;
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

    function currentRuntimeAbilityLoadout() {
        normalizeAbilityState();
        return {
            slot1: String(state.abilityLoadout.slot1 || ''),
            slot2: String(state.abilityLoadout.slot2 || '')
        };
    }

    function normalizeAbilityState() {
        if (!shared.normalizeAbilityLoadout) {
            return {
                slot1: String(state.abilityLoadout && state.abilityLoadout.slot1 || ''),
                slot2: String(state.abilityLoadout && state.abilityLoadout.slot2 || '')
            };
        }
        state.abilityLoadout = shared.normalizeAbilityLoadout(
            state.abilityLoadout && state.abilityLoadout.slot1,
            state.abilityLoadout && state.abilityLoadout.slot2
        );
        return {
            slot1: String(state.abilityLoadout.slot1 || ''),
            slot2: String(state.abilityLoadout.slot2 || '')
        };
    }

    function applyToGameplayRuntime(multiplayerMode) {
        compactWeaponSlots();
        var net = runtime.GameNet || null;
        var netCommands = net && net.commands ? net.commands : net;
        var weaponSlots = state.weaponSlots.slice(0, 2).filter(Boolean);
        if (runtime.GameHitscan && runtime.GameHitscan.setWeaponOrder && weaponSlots.length) {
            runtime.GameHitscan.setWeaponOrder(weaponSlots);
        }
        if (runtime.GamePlayer && runtime.GamePlayer.setLoadout && weaponSlots.length) {
            runtime.GamePlayer.setLoadout({ slots: weaponSlots });
        }
        if (netCommands && netCommands.sendWeaponLoadout && multiplayerMode) {
            netCommands.sendWeaponLoadout(state.weaponSlots[0] || '', state.weaponSlots[1] || '');
        }
        if (runtime.GameThrowables && runtime.GameThrowables.setSelectedThrowable && state.selectedThrowableId) {
            runtime.GameThrowables.setSelectedThrowable(state.selectedThrowableId);
        }
        normalizeAbilityState();
        if (runtime.GameAbilities && runtime.GameAbilities.setLoadoutSlot) {
            runtime.GameAbilities.setLoadoutSlot(1, state.abilityLoadout.slot1 || '');
            runtime.GameAbilities.setLoadoutSlot(2, state.abilityLoadout.slot2 || '');
            if (runtime.GameUI && runtime.GameUI.updateAbilityInfo && runtime.GameAbilities.getHudState) {
                runtime.GameUI.updateAbilityInfo(runtime.GameAbilities.getHudState());
            }
        }
        if (netCommands && netCommands.sendAbilityLoadout && multiplayerMode) {
            netCommands.sendAbilityLoadout(state.abilityLoadout.slot1 || '', state.abilityLoadout.slot2 || '');
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
            if (parsed.abilityLoadout && typeof parsed.abilityLoadout === 'object') {
                state.abilityLoadout = {
                    slot1: String(parsed.abilityLoadout.slot1 || ''),
                    slot2: String(parsed.abilityLoadout.slot2 || '')
                };
            }
            if (parsed.selectedThrowableId) {
                state.selectedThrowableId = String(parsed.selectedThrowableId || '');
                var categoryId = findThrowableCategory(state.selectedThrowableId);
                if (categoryId) state.activeThrowableCategory = categoryId;
            }
            compactWeaponSlots();
            normalizeAbilityState();
        } catch (_err) {
            // no-op
        }
    }

    function validateSelections() {
        compactWeaponSlots();
        var missingWeapons = [];
        var missingAbilities = [];
        if (!state.weaponSlots[0]) missingWeapons.push('weapon slot 1');
        if (!state.weaponSlots[1]) missingWeapons.push('weapon slot 2');
        normalizeAbilityState();
        if (!state.abilityLoadout.slot1) missingAbilities.push('ability slot ' + inputLabels.getBindingLabel('ability_1', 'E'));
        if (!state.abilityLoadout.slot2) missingAbilities.push('ability slot ' + inputLabels.getBindingLabel('ability_2', 'F'));
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
        var abilityCopy = [
            abilityName(state.abilityLoadout.slot1) || 'Empty',
            abilityName(state.abilityLoadout.slot2) || 'Empty'
        ].join(' / ');

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
        var primaryBtn = document.getElementById('weapon-slot-primary');
        var secondaryBtn = document.getElementById('weapon-slot-secondary');
        var weaponChoiceGrid = document.getElementById('weapon-choice-grid');
        if (!primaryBtn || !secondaryBtn || !weaponChoiceGrid) return;
        if (weaponChoiceGrid.__menuLoadoutBound) return;
        weaponChoiceGrid.__menuLoadoutBound = true;

        var slotBtns = [primaryBtn, secondaryBtn];

        function assignWeaponToSlot(activeSlot, weaponId) {
            compactWeaponSlots();
            var next = assignSharedSlotSelection(state.weaponSlots.slice(0, 2), activeSlot, weaponId);
            if (!next) return false;
            state.weaponSlots = next;
            return true;
        }

        function render() {
            compactWeaponSlots();
            var slots = state.weaponSlots.slice(0, 2);
            var names = weaponNameLookup();

            for (var i = 0; i < slotBtns.length; i++) {
                var btn = slotBtns[i];
                var slotId = slots[i] || '';
                btn.classList.add(slotClassName(i));
                btn.textContent = 'SLOT ' + (i + 1) + ' :: ' + (slotId ? String(names[slotId] || slotId).toUpperCase() : 'UNEQUIPPED');
                btn.classList.toggle('active', i === state.activeWeaponSlot);
            }

            weaponChoiceGrid.innerHTML = '';
            for (var n = 0; n < selectableWeaponIds.length; n++) {
                var weaponId = selectableWeaponIds[n];
                var choice = document.createElement('button');
                choice.type = 'button';
                choice.classList.add('weapon-choice-btn');
                choice.dataset.weaponId = weaponId;
                choice.textContent = String(names[weaponId] || weaponId).toUpperCase();
                var ownerIndex = pairOwnerIndex(slots, weaponId);
                if (ownerIndex !== -1) {
                    choice.classList.add(slotClassName(ownerIndex));
                }
                if (ownerIndex === state.activeWeaponSlot) {
                    choice.classList.add('active');
                }
                choice.addEventListener('click', function () {
                    var selectedId = String(this.dataset.weaponId || '');
                    if (!assignWeaponToSlot(state.activeWeaponSlot, selectedId)) return;
                    applyToGameplayRuntime(true);
                    render();
                    saveState();
                    notifySubscribers();
                });
                weaponChoiceGrid.appendChild(choice);
            }
            renderSummaries();
        }

        primaryBtn.addEventListener('click', function () {
            state.activeWeaponSlot = 0;
            render();
            notifySubscribers();
        });
        secondaryBtn.addEventListener('click', function () {
            state.activeWeaponSlot = 1;
            render();
            notifySubscribers();
        });

        render();
    }

    function bindThrowableUi() {
        var catTabs = document.getElementById('throwable-category-tabs');
        var choiceGrid = document.getElementById('throwable-choice-grid');
        if (!catTabs || !choiceGrid) return;
        if (choiceGrid.__throwableMenuBound) return;
        choiceGrid.__throwableMenuBound = true;

        var categories = throwableCatalogByCategory();
        if (!categories[state.activeThrowableCategory]) {
            var keys = Object.keys(categories);
            state.activeThrowableCategory = keys.length ? keys[0] : '';
        }

        function render() {
            catTabs.innerHTML = '';
            for (var catId in categories) {
                if (!Object.prototype.hasOwnProperty.call(categories, catId)) continue;
                var cat = categories[catId];
                var btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'throwable-cat-btn';
                btn.dataset.catId = catId;
                btn.textContent = String(cat.label || catId).toUpperCase();
                if (catId === state.activeThrowableCategory) btn.classList.add('active');
                btn.addEventListener('click', function () {
                    state.activeThrowableCategory = this.dataset.catId;
                    render();
                    saveState();
                    notifySubscribers();
                });
                catTabs.appendChild(btn);
            }

            choiceGrid.innerHTML = '';
            var activeCat = categories[state.activeThrowableCategory];
            if (state.activeThrowableCategory) {
                choiceGrid.setAttribute('data-category-id', state.activeThrowableCategory);
            } else {
                choiceGrid.removeAttribute('data-category-id');
            }
            if (!activeCat) return;
            for (var i = 0; i < activeCat.items.length; i++) {
                var item = activeCat.items[i];
                var choice = document.createElement('button');
                choice.type = 'button';
                choice.className = 'throwable-choice-btn';
                choice.dataset.throwableId = item.id;
                choice.dataset.categoryId = state.activeThrowableCategory;
                choice.textContent = String(item.label || item.id || '').toUpperCase();
                if (state.selectedThrowableId === item.id) choice.classList.add('active');
                choice.addEventListener('click', function () {
                    state.selectedThrowableId = String(this.dataset.throwableId || '');
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
        var primaryBtn = document.getElementById('ability-slot-primary');
        var secondaryBtn = document.getElementById('ability-slot-secondary');
        var choiceGrid = document.getElementById('ability-choice-grid');
        if (!primaryBtn || !secondaryBtn || !choiceGrid) return;
        if (choiceGrid.__abilityMenuBound) return;
        choiceGrid.__abilityMenuBound = true;

        var catalog = abilityList();
        var slotBtns = [primaryBtn, secondaryBtn];

        function assignAbilityToSlot(slotIndex, abilityId) {
            normalizeAbilityState();
            var next = assignSharedSlotSelection(
                [state.abilityLoadout.slot1, state.abilityLoadout.slot2],
                slotIndex,
                abilityId
            );
            if (!next) return false;
            state.abilityLoadout = {
                slot1: next[0],
                slot2: next[1]
            };
            normalizeAbilityState();
            return true;
        }

        function render() {
            normalizeAbilityState();
            var slots = [
                String(state.abilityLoadout.slot1 || ''),
                String(state.abilityLoadout.slot2 || '')
            ];

            for (var i = 0; i < slotBtns.length; i++) {
                var btn = slotBtns[i];
                var abilityId = slots[i] || '';
                btn.classList.add(slotClassName(i));
                btn.textContent = 'ABILITY ' + (i + 1) + ' :: ' + (abilityId ? abilityName(abilityId).toUpperCase() : 'UNEQUIPPED');
                btn.classList.toggle('active', i === state.activeAbilitySlot);
            }

            choiceGrid.innerHTML = '';
            for (var i = 0; i < catalog.length; i++) {
                var def = catalog[i];
                if (!def || !def.id) continue;
                var btn = document.createElement('button');
                btn.type = 'button';
                btn.classList.add('ability-choice-btn');
                btn.dataset.abilityId = def.id;
                btn.textContent = String(def.name || def.id).toUpperCase();
                var ownerIndex = pairOwnerIndex(slots, def.id);
                if (ownerIndex !== -1) {
                    btn.classList.add(slotClassName(ownerIndex));
                }
                if (ownerIndex === state.activeAbilitySlot) btn.classList.add('active');
                btn.addEventListener('click', function () {
                    var id = this.dataset.abilityId;
                    if (!assignAbilityToSlot(state.activeAbilitySlot, id)) return;
                    applyToGameplayRuntime(true);
                    render();
                    saveState();
                    notifySubscribers();
                });
                choiceGrid.appendChild(btn);
            }
            renderSummaries();
        }

        primaryBtn.addEventListener('click', function () {
            state.activeAbilitySlot = 0;
            render();
            notifySubscribers();
        });
        secondaryBtn.addEventListener('click', function () {
            state.activeAbilitySlot = 1;
            render();
            notifySubscribers();
        });

        render();
    }

    GameMenuLoadout.init = function () {
        if (state.initialized) return;
        loadStoredState();
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

    GameMenuLoadout.getAbilityLoadout = function () {
        return currentRuntimeAbilityLoadout();
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
            abilityLoadout: GameMenuLoadout.getAbilityLoadout(),
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
