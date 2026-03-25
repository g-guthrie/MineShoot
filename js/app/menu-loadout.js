/**
 * menu-loadout.js - Menu UI adapter over the shared loadout state.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameMenuLoadout
 */
(function () {
    'use strict';

    var GameMenuLoadout = {};
    var runtime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    var renderCallbacks = [];
    var uiState = {
        initialized: false
    };

    function inputLabelsApi() {
        return runtime.GameInputLabels || null;
    }

    function loadoutStateApi() {
        return runtime.GameLoadoutState || null;
    }

    function loadoutRuntimeApi() {
        return runtime.GameLoadoutRuntimeSync || null;
    }

    function sharedApi() {
        return runtime.GameShared || {};
    }

    function tuningApi() {
        return sharedApi().gameplayTuning || {};
    }

    function weaponStats() {
        return tuningApi().weaponStats || {};
    }

    function throwableDefs() {
        return tuningApi().throwables || {};
    }

    function selectableWeaponIds() {
        var shared = sharedApi();
        var ids = shared.getSelectableWeaponIds ? shared.getSelectableWeaponIds() : null;
        return Array.isArray(ids) && ids.length ? ids : ['machinegun', 'shotgun', 'rifle', 'pistol', 'sniper'];
    }

    function defaultWeaponLoadout() {
        var shared = sharedApi();
        var defaults = shared.getDefaultWeaponLoadout ? shared.getDefaultWeaponLoadout() : null;
        if (Array.isArray(defaults) && defaults.length) return defaults.slice(0, 2);
        return selectableWeaponIds().slice(0, 2);
    }

    function selectableThrowableIds() {
        var defs = throwableDefs();
        return Array.isArray(defs.order) ? defs.order : Object.keys(defs).filter(function (key) { return key !== 'order'; });
    }

    function defaultThrowableId() {
        var shared = sharedApi();
        if (shared.getDefaultThrowableId) {
            return String(shared.getDefaultThrowableId() || '');
        }
        var ids = selectableThrowableIds();
        return ids[0] ? String(ids[0]) : '';
    }

    function committedLoadout() {
        var loadoutState = loadoutStateApi();
        if (loadoutState && loadoutState.getCommittedLoadout) {
            return loadoutState.getCommittedLoadout();
        }
        var defaultWeapons = defaultWeaponLoadout();
        return {
            weaponSlots: [defaultWeapons[0] || '', defaultWeapons[1] || ''],
            selectedThrowableId: defaultThrowableId()
        };
    }

    function weaponDraft() {
        var loadoutState = loadoutStateApi();
        if (loadoutState && loadoutState.getWeaponDraft) {
            return loadoutState.getWeaponDraft();
        }
        return {
            weaponSlots: ['', ''],
            awaitingSecondPick: false
        };
    }

    function applyCommittedToRuntime(multiplayerMode) {
        var loadoutRuntime = loadoutRuntimeApi();
        if (loadoutRuntime && loadoutRuntime.applyCommittedLoadout) {
            return loadoutRuntime.applyCommittedLoadout(!!multiplayerMode);
        }
        return committedLoadout();
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

    function pairOwnerIndex(pair, selectedId) {
        var target = String(selectedId || '');
        if (!target) return -1;
        if (String(pair && pair[0] || '') === target) return 0;
        if (String(pair && pair[1] || '') === target) return 1;
        return -1;
    }

    function sectionChrome() {
        return {
            root: document.getElementById('menu-loadout-band'),
            weaponsPanel: document.getElementById('weapon-slot-panel'),
            throwablePanel: document.getElementById('throwable-slot-panel')
        };
    }

    function refreshBindingCopy() {
        var weaponTitle = document.getElementById('weapon-slot-title');
        var throwableTitle = document.getElementById('throwable-slot-title');

        if (weaponTitle) {
            var flag = document.getElementById('weapon-pick-flag');
            if (flag && flag.parentNode === weaponTitle) {
                weaponTitle.childNodes[0].textContent = 'Weapons ';
            } else {
                weaponTitle.textContent = 'Weapons';
            }
        }
        if (throwableTitle) throwableTitle.textContent = 'Throwables';
    }

    function runRenderCallbacks() {
        for (var i = 0; i < renderCallbacks.length; i++) {
            renderCallbacks[i]();
        }
    }

    function bindWeaponUi() {
        var weaponChoiceGrid = document.getElementById('weapon-choice-grid');
        var pickFlag = document.getElementById('weapon-pick-flag');
        if (!weaponChoiceGrid || weaponChoiceGrid.__menuLoadoutBound) return;
        weaponChoiceGrid.__menuLoadoutBound = true;

        function render() {
            var names = weaponNameLookup();
            var committed = committedLoadout();
            var draft = weaponDraft();
            var awaiting = !!draft.awaitingSecondPick;
            var displayPair = awaiting ? [draft.weaponSlots[0] || '', ''] : (committed.weaponSlots || ['', '']);

            weaponChoiceGrid.innerHTML = '';
            var weaponIds = selectableWeaponIds();
            for (var i = 0; i < weaponIds.length; i++) {
                var weaponId = String(weaponIds[i] || '');
                var choice = document.createElement('button');
                choice.type = 'button';
                choice.classList.add('weapon-choice-btn');
                choice.dataset.weaponId = weaponId;
                choice.textContent = String(names[weaponId] || weaponId).toUpperCase();
                var ownerIndex = pairOwnerIndex(displayPair, weaponId);
                if (ownerIndex === 0) {
                    choice.classList.add('weapon-primary', 'active');
                } else if (ownerIndex === 1) {
                    choice.classList.add('weapon-secondary', 'active');
                }
                choice.addEventListener('click', function (e) {
                    e.stopPropagation();
                    var selectedId = String(this.dataset.weaponId || '');
                    var loadoutState = loadoutStateApi();
                    if (!loadoutState) return;
                    var currentDraft = weaponDraft();
                    var awaitingNow = !!currentDraft.awaitingSecondPick;

                    if (awaitingNow) {
                        if (String(currentDraft.weaponSlots[0] || '') === selectedId) {
                            loadoutState.cancelWeaponDraft();
                        } else {
                            loadoutState.commitWeaponDraft(selectedId);
                            applyCommittedToRuntime(true);
                        }
                    } else {
                        loadoutState.beginWeaponDraft(selectedId);
                    }
                });
                weaponChoiceGrid.appendChild(choice);
            }

            if (pickFlag) {
                pickFlag.classList.toggle('hidden', !awaiting);
            }
        }

        renderCallbacks.push(render);
    }

    function bindThrowableUi() {
        var choiceGrid = document.getElementById('throwable-choice-grid');
        if (!choiceGrid || choiceGrid.__throwableMenuBound) return;
        choiceGrid.__throwableMenuBound = true;

        function render() {
            var committed = committedLoadout();
            var defs = throwableDefs();
            choiceGrid.innerHTML = '';
            var throwableIds = selectableThrowableIds();
            for (var i = 0; i < throwableIds.length; i++) {
                var throwableId = String(throwableIds[i] || '');
                var def = defs[throwableId] || {};
                var choice = document.createElement('button');
                choice.type = 'button';
                choice.className = 'btn throwable-choice-btn';
                choice.dataset.throwableId = throwableId;
                choice.textContent = String(def.label || throwableId || '').toUpperCase();
                if (committed.selectedThrowableId === throwableId) choice.classList.add('active');
                choice.addEventListener('click', function (e) {
                    e.stopPropagation();
                    var id = String(this.dataset.throwableId || '');
                    var loadoutState = loadoutStateApi();
                    if (!loadoutState) return;
                    loadoutState.setSelectedThrowable(id);
                    applyCommittedToRuntime(true);
                });
                choiceGrid.appendChild(choice);
            }
        }

        renderCallbacks.push(render);
    }

    GameMenuLoadout.init = function () {
        if (uiState.initialized) return;
        var loadoutState = loadoutStateApi();
        if (loadoutState && loadoutState.init) {
            loadoutState.init();
        }
        uiState.initialized = true;
        bindWeaponUi();
        bindThrowableUi();
        refreshBindingCopy();
        if (runtime.GameInputBindings && runtime.GameInputBindings.subscribe) {
            runtime.GameInputBindings.subscribe(refreshBindingCopy);
        }
        if (loadoutState && loadoutState.subscribe) {
            loadoutState.subscribe(runRenderCallbacks);
        }
        GameMenuLoadout.syncToRuntime(false);
        runRenderCallbacks();
    };

    GameMenuLoadout.getWeaponSlots = function () {
        return committedLoadout().weaponSlots.slice(0, 2);
    };

    GameMenuLoadout.getDraftWeaponSlots = function () {
        var draft = weaponDraft();
        return draft.awaitingSecondPick
            ? draft.weaponSlots.slice(0, 2)
            : committedLoadout().weaponSlots.slice(0, 2);
    };

    GameMenuLoadout.getSelectedAbilityId = function () {
        return String(normalizeAbilityState() || '');
    };

    GameMenuLoadout.getAbilityLoadout = function () {
        return {
            abilityId: GameMenuLoadout.getSelectedAbilityId()
        };
    };

    GameMenuLoadout.getSelectedThrowable = function () {
        return String(committedLoadout().selectedThrowableId || '');
    };

    GameMenuLoadout.validateSelections = function () {
        var loadoutState = loadoutStateApi();
        return loadoutState && loadoutState.validateSelections
            ? loadoutState.validateSelections()
            : { ok: false, message: 'Loadout state unavailable.' };
    };

    GameMenuLoadout.setExpandedSection = function () {};
    GameMenuLoadout.getExpandedSection = function () { return 'all'; };

    GameMenuLoadout.syncToRuntime = function (multiplayerMode) {
        var committed = applyCommittedToRuntime(!!multiplayerMode);
        return committed && committed.weaponSlots ? committed.weaponSlots.slice(0, 2) : [];
    };

    GameMenuLoadout.getRuntimeSnapshot = function () {
        var committed = committedLoadout();
        return {
            weaponSlots: committed.weaponSlots.slice(0, 2),
            selectedThrowableId: String(committed.selectedThrowableId || '')
        };
    };

    GameMenuLoadout.subscribe = function (listener) {
        var loadoutState = loadoutStateApi();
        if (loadoutState && loadoutState.subscribe) {
            return loadoutState.subscribe(function () {
                listener(GameMenuLoadout.getRuntimeSnapshot());
            });
        }
        return function () {};
    };

    runtime.GameMenuLoadout = GameMenuLoadout;
})();
