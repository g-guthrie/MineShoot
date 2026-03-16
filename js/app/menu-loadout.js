/**
 * menu-loadout.js - Menu-only loadout state and UI.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameMenuLoadout
 */
(function () {
    'use strict';

    var GameMenuLoadout = {};
    var runtime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
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
        selectedThrowableId: 'frag',
        activeThrowableCategory: 'grenade',
        expandedSection: '',
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

    function inputBindingsApi() {
        return runtime.GameInputBindings || null;
    }

    function bindingLabel(actionId, fallbackLabel) {
        var bindingsApi = inputBindingsApi();
        if (bindingsApi && bindingsApi.getDisplayLabel) {
            return bindingsApi.getDisplayLabel(actionId);
        }
        return String(fallbackLabel || '--');
    }

    function refreshBindingCopy() {
        var throwableTitle = document.getElementById('throwable-slot-title');
        var throwableNote = document.getElementById('throwable-slot-note');
        var abilityTitle = document.getElementById('ability-slot-title');
        var abilitySlot1Label = document.getElementById('ability-slot1-label');
        var abilitySlot2Label = document.getElementById('ability-slot2-label');
        var abilityNote = document.getElementById('ability-slot-note');

        var throwableKey = bindingLabel('throwable', 'Q');
        var ability1Key = bindingLabel('ability_1', 'E');
        var ability2Key = bindingLabel('ability_2', 'F');

        if (throwableTitle) throwableTitle.textContent = '> Throwable [' + throwableKey + ']_';
        if (throwableNote) throwableNote.textContent = 'Hold ' + throwableKey + ' for preview, release to throw.';
        if (abilityTitle) abilityTitle.textContent = '> Abilities [' + ability1Key + '/' + ability2Key + ']_';
        if (abilitySlot1Label) abilitySlot1Label.textContent = 'SLOT 1 [' + ability1Key + ']';
        if (abilitySlot2Label) abilitySlot2Label.textContent = 'SLOT 2 [' + ability2Key + ']';
        if (abilityNote) abilityNote.textContent = 'Pick slot 1 for ' + ability1Key + ' and slot 2 for ' + ability2Key + '. Switch anytime from this menu.';
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
        if (!state.abilityLoadout.slot1) missingAbilities.push('ability slot ' + bindingLabel('ability_1', 'E'));
        if (!state.abilityLoadout.slot2) missingAbilities.push('ability slot ' + bindingLabel('ability_2', 'F'));
        if (!missingWeapons.length && !missingAbilities.length) return { ok: true, message: '' };
        var parts = [];
        if (missingWeapons.length) parts.push('Missing ' + missingWeapons.join(' and '));
        if (missingAbilities.length) parts.push('Missing ' + missingAbilities.join(' and '));
        return { ok: false, message: parts.join(' | ') };
    }

    function isNodeWithin(node, target) {
        var current = node || null;
        while (current) {
            if (current === target) return true;
            current = current.parentNode || null;
        }
        return false;
    }

    function sectionChrome() {
        return {
            root: document.getElementById('menu-loadout-band'),
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

        if (chrome.weaponsSummary) chrome.weaponsSummary.textContent = 'Weapons  ' + weaponCopy;
        if (chrome.throwableSummary) chrome.throwableSummary.textContent = 'Throwable  ' + throwableCopy;
        if (chrome.abilitySummary) chrome.abilitySummary.textContent = 'Abilities  ' + abilityCopy;
    }

    function renderSectionChrome() {
        var chrome = sectionChrome();
        var next = String(state.expandedSection || '');
        if (chrome.weaponsSummary) chrome.weaponsSummary.setAttribute('aria-expanded', next === 'weapons' ? 'true' : 'false');
        if (chrome.throwableSummary) chrome.throwableSummary.setAttribute('aria-expanded', next === 'throwable' ? 'true' : 'false');
        if (chrome.abilitySummary) chrome.abilitySummary.setAttribute('aria-expanded', next === 'abilities' ? 'true' : 'false');
        if (chrome.weaponsPanel) chrome.weaponsPanel.hidden = next !== 'weapons';
        if (chrome.throwablePanel) chrome.throwablePanel.hidden = next !== 'throwable';
        if (chrome.abilityPanel) chrome.abilityPanel.hidden = next !== 'abilities';
    }

    function setExpandedSection(sectionId) {
        var next = String(sectionId || '');
        if (next !== 'weapons' && next !== 'throwable' && next !== 'abilities') {
            next = '';
        }
        state.expandedSection = next;
        renderSectionChrome();
        notifySubscribers();
    }

    function bindSectionChrome() {
        var chrome = sectionChrome();
        if (!chrome.root || chrome.root.__loadoutSummaryBound) return;
        chrome.root.__loadoutSummaryBound = true;

        function toggle(sectionId) {
            return function () {
                setExpandedSection(state.expandedSection === sectionId ? '' : sectionId);
            };
        }

        if (chrome.weaponsSummary) chrome.weaponsSummary.addEventListener('click', toggle('weapons'));
        if (chrome.throwableSummary) chrome.throwableSummary.addEventListener('click', toggle('throwable'));
        if (chrome.abilitySummary) chrome.abilitySummary.addEventListener('click', toggle('abilities'));

        document.addEventListener('click', function (event) {
            if (!state.expandedSection) return;
            if (isNodeWithin(event.target, chrome.root)) return;
            setExpandedSection('');
        });
        document.addEventListener('focusin', function (event) {
            if (!state.expandedSection) return;
            if (isNodeWithin(event.target, chrome.root)) return;
            setExpandedSection('');
        });

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
            var selectedId = String(weaponId || '');
            var active = activeSlot === 1 ? 1 : 0;
            var other = active === 0 ? 1 : 0;
            if (!selectedId) return false;
            if (state.weaponSlots[active] === selectedId) return false;
            if (state.weaponSlots[other] === selectedId) {
                state.weaponSlots[other] = '';
            }
            state.weaponSlots[active] = selectedId;
            return true;
        }

        function render() {
            compactWeaponSlots();
            var slots = state.weaponSlots.slice(0, 2);
            var names = weaponNameLookup();

            for (var i = 0; i < slotBtns.length; i++) {
                var btn = slotBtns[i];
                var slotId = slots[i] || '';
                btn.textContent = 'SLOT ' + (i + 1) + ' :: ' + (slotId ? String(names[slotId] || slotId).toUpperCase() : 'UNEQUIPPED');
                btn.classList.toggle('active', i === state.activeWeaponSlot);
            }

            weaponChoiceGrid.innerHTML = '';
            for (var n = 0; n < selectableWeaponIds.length; n++) {
                var weaponId = selectableWeaponIds[n];
                var choice = document.createElement('button');
                choice.type = 'button';
                choice.className = 'weapon-choice-btn';
                choice.dataset.weaponId = weaponId;
                choice.textContent = String(names[weaponId] || weaponId).toUpperCase();
                if (slots[state.activeWeaponSlot] === weaponId) {
                    choice.classList.add('active');
                }
                var otherSlot = state.activeWeaponSlot === 0 ? 1 : 0;
                if (slots[otherSlot] === weaponId) {
                    choice.classList.add('owned-other');
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
            if (!activeCat) return;
            for (var i = 0; i < activeCat.items.length; i++) {
                var item = activeCat.items[i];
                var choice = document.createElement('button');
                choice.type = 'button';
                choice.className = 'throwable-choice-btn';
                choice.dataset.throwableId = item.id;
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
        var abilityGrid1 = document.getElementById('ability-slot1-grid');
        var abilityGrid2 = document.getElementById('ability-slot2-grid');
        if (!abilityGrid1 || !abilityGrid2) return;
        if (abilityGrid1.__abilityMenuBound) return;
        abilityGrid1.__abilityMenuBound = true;

        var catalog = abilityList();

        function assignAbilityToSlot(slotIndex, abilityId) {
            var ownKey = slotIndex === 2 ? 'slot2' : 'slot1';
            if (String(state.abilityLoadout[ownKey] || '') === String(abilityId || '')) return false;
            state.abilityLoadout[ownKey] = String(abilityId || '');
            normalizeAbilityState();
            return true;
        }

        function appendChoices(slotIndex, gridEl, selectedId, blockedId) {
            for (var i = 0; i < catalog.length; i++) {
                var def = catalog[i];
                if (!def || !def.id) continue;
                var btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'ability-choice-btn';
                btn.dataset.abilityId = def.id;
                btn.textContent = String(def.name || def.id).toUpperCase();
                if (def.id === selectedId) btn.classList.add('active');
                if (def.id === blockedId) btn.classList.add('owned-other');
                btn.addEventListener('click', function () {
                    var id = this.dataset.abilityId;
                    if (!assignAbilityToSlot(slotIndex, id)) return;
                    applyToGameplayRuntime(true);
                    render();
                    saveState();
                    notifySubscribers();
                });
                gridEl.appendChild(btn);
            }
        }

        function render() {
            normalizeAbilityState();
            abilityGrid1.innerHTML = '';
            abilityGrid2.innerHTML = '';
            appendChoices(1, abilityGrid1, state.abilityLoadout.slot1, state.abilityLoadout.slot2);
            appendChoices(2, abilityGrid2, state.abilityLoadout.slot2, state.abilityLoadout.slot1);
            renderSummaries();
        }

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
        if (inputBindingsApi() && inputBindingsApi().subscribe) {
            inputBindingsApi().subscribe(refreshBindingCopy);
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
        return String(state.expandedSection || '');
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
