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
    var defaultAbilityLoadout = tuning.defaultAbilityLoadout || { slot1: 'choke', slot2: 'deadeye' };
    var throwableCategories = tuning.throwableCategories || {};
    var throwableDefs = tuning.throwables || {};
    var abilityCatalog = tuning.abilityCatalog || {};
    var weaponStats = tuning.weaponStats || {};

    var state = {
        weaponSlots: defaultWeaponLoadout.slice(0, 2),
        activeWeaponSlot: 0,
        selectedThrowableId: 'frag',
        activeThrowableCategory: 'grenade',
        abilityLoadout: {
            slot1: String(defaultAbilityLoadout.slot1 || ''),
            slot2: String(defaultAbilityLoadout.slot2 || '')
        },
        initialized: false
    };

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
        return {
            slot1: String(state.abilityLoadout.slot1 || ''),
            slot2: String(state.abilityLoadout.slot2 || '')
        };
    }

    function applyToGameplayRuntime(multiplayerMode) {
        compactWeaponSlots();
        var weaponSlots = state.weaponSlots.slice(0, 2).filter(Boolean);
        if (runtime.GameHitscan && runtime.GameHitscan.setWeaponOrder && weaponSlots.length) {
            runtime.GameHitscan.setWeaponOrder(weaponSlots);
        }
        if (runtime.GamePlayer && runtime.GamePlayer.setLoadout && weaponSlots.length) {
            runtime.GamePlayer.setLoadout({ slots: weaponSlots });
        }
        if (runtime.GameNet && runtime.GameNet.sendWeaponLoadout && multiplayerMode) {
            runtime.GameNet.sendWeaponLoadout(state.weaponSlots[0] || '', state.weaponSlots[1] || '');
        }
        if (runtime.GameThrowables && runtime.GameThrowables.setSelectedThrowable && state.selectedThrowableId) {
            runtime.GameThrowables.setSelectedThrowable(state.selectedThrowableId);
        }
        if (runtime.GameAbilities && runtime.GameAbilities.setLoadoutSlot) {
            runtime.GameAbilities.setLoadoutSlot(1, state.abilityLoadout.slot1 || '');
            runtime.GameAbilities.setLoadoutSlot(2, state.abilityLoadout.slot2 || '');
            if (runtime.GameUI && runtime.GameUI.updateAbilityInfo && runtime.GameAbilities.getHudState) {
                runtime.GameUI.updateAbilityInfo(runtime.GameAbilities.getHudState());
            }
        }
        if (runtime.GameNet && runtime.GameNet.sendAbilityLoadout && multiplayerMode) {
            runtime.GameNet.sendAbilityLoadout(state.abilityLoadout.slot1 || '', state.abilityLoadout.slot2 || '');
        }
    }

    function validateSelections() {
        compactWeaponSlots();
        var missingWeapons = [];
        var missingAbilities = [];
        if (!state.weaponSlots[0]) missingWeapons.push('weapon slot 1');
        if (!state.weaponSlots[1]) missingWeapons.push('weapon slot 2');
        if (!state.abilityLoadout.slot1) missingAbilities.push('ability slot R');
        if (!state.abilityLoadout.slot2) missingAbilities.push('ability slot F');
        if (!missingWeapons.length && !missingAbilities.length) return { ok: true, message: '' };
        var parts = [];
        if (missingWeapons.length) parts.push('Missing ' + missingWeapons.join(' and '));
        if (missingAbilities.length) parts.push('Missing ' + missingAbilities.join(' and '));
        return { ok: false, message: parts.join(' | ') };
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
                    applyToGameplayRuntime(!!(runtime.GameNet && runtime.GameNet.isActive && runtime.GameNet.isActive()));
                    render();
                });
                weaponChoiceGrid.appendChild(choice);
            }
        }

        primaryBtn.addEventListener('click', function () {
            state.activeWeaponSlot = 0;
            render();
        });
        secondaryBtn.addEventListener('click', function () {
            state.activeWeaponSlot = 1;
            render();
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
                    applyToGameplayRuntime(!!(runtime.GameNet && runtime.GameNet.isActive && runtime.GameNet.isActive()));
                    render();
                });
                choiceGrid.appendChild(choice);
            }
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
                    applyToGameplayRuntime(!!(runtime.GameNet && runtime.GameNet.isActive && runtime.GameNet.isActive()));
                    render();
                });
                gridEl.appendChild(btn);
            }
        }

        function render() {
            abilityGrid1.innerHTML = '';
            abilityGrid2.innerHTML = '';
            appendChoices(1, abilityGrid1, state.abilityLoadout.slot1, state.abilityLoadout.slot2);
            appendChoices(2, abilityGrid2, state.abilityLoadout.slot2, state.abilityLoadout.slot1);
        }

        render();
    }

    GameMenuLoadout.init = function () {
        if (state.initialized) return;
        state.initialized = true;
        bindWeaponUi();
        bindThrowableUi();
        bindAbilityUi();
        GameMenuLoadout.syncToRuntime(false);
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

    runtime.GameMenuLoadout = GameMenuLoadout;
})();
