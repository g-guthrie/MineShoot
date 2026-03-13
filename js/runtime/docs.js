/**
 * docs.js - In-game Fallout-style ASCII field manual
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameDocs
 */
(function () {
    'use strict';

    var GameDocs = {};

    var panelEl = null;
    var titleEl = null;
    var navEl = null;
    var mainEl = null;
    var subnavEl = null;
    var contentEl = null;
    var hintEl = null;
    var closeBtnEl = null;
    var pauseOpenBtnEl = null;
    var hudOpenBtnEl = null;
    var isInited = false;

    var state = {
        activePage: 'home',
        selectedAbilityId: '',
        selectedWeaponId: '',
        selectedThrowableId: ''
    };

    var PAGES = [
        { id: 'home', label: 'HOME' },
        { id: 'controls', label: 'CONTROLS' },
        { id: 'abilities', label: 'ABILITIES' },
        { id: 'weapons', label: 'WEAPONS' },
        { id: 'throwables', label: 'THROWABLES' },
        { id: 'formulas', label: 'FORMULAS' }
    ];

    var WEAPON_ART = {
        rifle: [
            '                __',
            '   ____________/ /____',
            '  |  [] [] []  _/ ___/====>',
            '  |____________|_/',
            '      ||    ||',
            '      ||____||'
        ].join('\n'),
        pistol: [
            '      _________',
            ' ____/  ____  /====>',
            '|___   /___/ /',
            '    |  ___  |',
            '    | |   | |',
            '    |_|   |_|'
        ].join('\n'),
        machinegun: [
            ' __  __  __  __  __',
            '|  \\/  \\/  \\/  \\/  |=====>',
            '|___/\\__/\\__/\\__/\\__|',
            '      |  [] []  |',
            '      |_________|',
            '         ||||'
        ].join('\n'),
        shotgun: [
            '  ___________________________',
            ' /  _  _  _  _  _  _  _  _  /====>',
            '|__|_|_|_|_|_|_|_|_|_|_|_|_|',
            '      ||              ||',
            '      ||______________||',
            '          |______|'
        ].join('\n'),
        sniper: [
            '                 _____________',
            '   _____________/  _______  /=====>',
            '  /____________/__/______/ /',
            '      O==========O',
            '           ||',
            '         __||__'
        ].join('\n'),
    };

    function fNum(value, fallback) {
        if (typeof value !== 'number' || !isFinite(value)) return fallback || '--';
        return String(value);
    }

    function fSec(value) {
        if (typeof value !== 'number' || !isFinite(value)) return '--';
        return value.toFixed(1) + 's';
    }

    function fRateMs(ms) {
        if (typeof ms !== 'number' || !isFinite(ms) || ms <= 0) return '--';
        return (1000 / ms).toFixed(2) + '/s';
    }

    function safeCatalog(getter) {
        try {
            var data = getter && getter();
            if (!data || !data.length) return [];
            return data;
        } catch (err) {
            return [];
        }
    }

    function sharedDataCatalog() {
        var shared = globalThis.__MAYHEM_RUNTIME.GameShared && globalThis.__MAYHEM_RUNTIME.GameShared.gameplayTuning;
        return shared || {};
    }

    function findById(list, id) {
        if (!list || !list.length || !id) return null;
        for (var i = 0; i < list.length; i++) {
            if (list[i] && list[i].id === id) return list[i];
        }
        return null;
    }

    function getPageLabel(pageId) {
        for (var i = 0; i < PAGES.length; i++) {
            if (PAGES[i].id === pageId) return PAGES[i].label;
        }
        return 'HOME';
    }

    function getData() {
        var shared = sharedDataCatalog();
        var sharedWeapons = [];
        var sharedAbilities = [];
        var sharedThrowables = [];
        var weaponStats = shared.weaponStats || {};
        var abilityDefs = shared.abilityCatalog || {};
        var throwableDefs = shared.throwables || {};

        for (var weaponId in weaponStats) {
            if (!Object.prototype.hasOwnProperty.call(weaponStats, weaponId)) continue;
            sharedWeapons.push(Object.assign({ id: weaponId }, weaponStats[weaponId]));
        }
        for (var abilityId in abilityDefs) {
            if (!Object.prototype.hasOwnProperty.call(abilityDefs, abilityId)) continue;
            sharedAbilities.push(Object.assign({ id: abilityId }, abilityDefs[abilityId]));
        }
        var throwableOrder = (throwableDefs.order && throwableDefs.order.slice()) || [];
        for (var i = 0; i < throwableOrder.length; i++) {
            var throwableId = throwableOrder[i];
            if (!throwableDefs[throwableId]) continue;
            sharedThrowables.push(Object.assign({ id: throwableId }, throwableDefs[throwableId]));
        }

        return {
            abilities: safeCatalog(globalThis.__MAYHEM_RUNTIME.GameAbilities && globalThis.__MAYHEM_RUNTIME.GameAbilities.getCatalog).length
                ? safeCatalog(globalThis.__MAYHEM_RUNTIME.GameAbilities && globalThis.__MAYHEM_RUNTIME.GameAbilities.getCatalog)
                : sharedAbilities,
            weapons: safeCatalog(globalThis.__MAYHEM_RUNTIME.GameHitscan && globalThis.__MAYHEM_RUNTIME.GameHitscan.getWeaponCatalog).length
                ? safeCatalog(globalThis.__MAYHEM_RUNTIME.GameHitscan && globalThis.__MAYHEM_RUNTIME.GameHitscan.getWeaponCatalog)
                : sharedWeapons,
            throwables: safeCatalog(globalThis.__MAYHEM_RUNTIME.GameThrowables && globalThis.__MAYHEM_RUNTIME.GameThrowables.getCatalog).length
                ? safeCatalog(globalThis.__MAYHEM_RUNTIME.GameThrowables && globalThis.__MAYHEM_RUNTIME.GameThrowables.getCatalog)
                : sharedThrowables
        };
    }

    function ensureSelections(data) {
        if (!findById(data.abilities, state.selectedAbilityId)) {
            state.selectedAbilityId = data.abilities.length ? data.abilities[0].id : '';
        }

        if (!findById(data.weapons, state.selectedWeaponId)) {
            state.selectedWeaponId = data.weapons.length ? data.weapons[0].id : '';
        }

        if (!findById(data.throwables, state.selectedThrowableId)) {
            state.selectedThrowableId = data.throwables.length ? data.throwables[0].id : '';
        }
    }

    function weaponSpecial(weapon) {
        if (!weapon) return '--';
        if (weapon.id === 'shotgun') return 'Point-blank burst monster; huge chunks up close without a full-health one-shot';
        if (weapon.id === 'sniper') return 'Highest burst per trigger, long cooldown';
        if (weapon.id === 'machinegun') return 'Automatic lane holder; ADS now trades mobility for real mid-range stability';
        if (weapon.id === 'rifle') return 'Scout-style precision rifle with stronger headshot reward';
        if (weapon.id === 'pistol') return 'Hand cannon sidearm built for mid-range headshots';
        return 'Balanced baseline weapon';
    }

    function buildHomePage(data) {
        var lines = [];
        lines.push('+----------------------------------------------------------+');
        lines.push('| FIELD MANUAL / HOME                                     |');
        lines.push('+----------------------------------------------------------+');
        lines.push('This manual is now split into clean Pip-Boy style pages.');
        lines.push('');
        lines.push('Catalog counts (live):');
        lines.push('  Abilities  : ' + data.abilities.length);
        lines.push('  Weapons    : ' + data.weapons.length);
        lines.push('  Throwables : ' + data.throwables.length);
        lines.push('');
        lines.push('Mode cards:');
        lines.push('  MULTIPLAYER CLOUDFLARE -> shared deployed room (?room=<id>, default global)');
        lines.push('  SINGLE CLOUDFLARE      -> deployed private room (per tab by default)');
        lines.push('  SINGLE DEV SERVER      -> shared local-worker room for authoritative multiplayer testing');
        lines.push('');
        lines.push('Environment v2 highlights:');
        lines.push('  Grid hidden by default (debug only via ?debugGrid=1)');
        lines.push('  Deterministic biome blend + landmark generation');
        lines.push('  Desert mesas, arctic mountain, and animated waterfall');
        lines.push('  Multiplayer rooms use server-auth world metadata');
        lines.push('');
        lines.push('Navigation:');
        lines.push('  1. Choose top tab (Controls / Abilities / Weapons / etc).');
        lines.push('  2. For Abilities/Weapons, choose a subpage from left list.');
        lines.push('  3. Values are hydrated from gameplay modules.');
        lines.push('');
        lines.push('Status: live data linked to current game configs.');
        return lines.join('\n');
    }

    function buildControlsPage() {
        return [
            '+----------------------------------------------------------+',
            '| FIELD MANUAL / CONTROLS                                 |',
            '+----------------------------------------------------------+',
            'Movement',
            '  WASD: Move',
            '  E: Sprint',
            '  RMB / Shift: Toggle ADS',
            '  Space: Variable jump (hold for full height)',
            '',
            'Menu / Session',
            '  Choose mode card on start screen',
            '  RESUME MATCH to re-enter pointer lock',
            '',
            'Combat',
            '  LMB: Fire',
            '  ADS disables sprint and first jump press only exits ADS',
            '  1-2 / Wheel: Weapon swap',
            '  F: Throwable (hold for preview, release to throw)',
            '  Y: Choke   R: Deadeye',
            '',
            'Utility',
            '  H: Toggle dev ring + hitboxes',
            '  I: Toggle field manual',
            '  ESC: Release pointer lock'
        ].join('\n');
    }

    function buildAbilityPage(data) {
        var c = findById(data.abilities, state.selectedAbilityId);
        if (!c) {
            return [
                '+----------------------------------------------------------+',
                '| FIELD MANUAL / ABILITY PROFILE                          |',
                '+----------------------------------------------------------+',
                'DATA UNAVAILABLE'
            ].join('\n');
        }

        var lines = [];
        lines.push('+----------------------------------------------------------+');
        lines.push('| FIELD MANUAL / ABILITY PROFILE                          |');
        lines.push('+----------------------------------------------------------+');
        lines.push('ABILITY     : ' + String(c.name || c.id || '').toUpperCase());
        lines.push('ID          : ' + String(c.id || '--'));
        lines.push('');
        lines.push('DESCRIPTION : ' + String(c.description || 'No description.'));
        lines.push('KEYMAP      : ' + (c.id === 'choke' ? 'E' : (c.id === 'deadeye' ? 'R' : '--')));
        return lines.join('\n');
    }

    function buildWeaponPage(data) {
        var w = findById(data.weapons, state.selectedWeaponId);
        if (!w) {
            return [
                '+----------------------------------------------------------+',
                '| FIELD MANUAL / WEAPON PROFILE                           |',
                '+----------------------------------------------------------+',
                'DATA UNAVAILABLE'
            ].join('\n');
        }

        var lines = [];
        lines.push('+----------------------------------------------------------+');
        lines.push('| FIELD MANUAL / WEAPON PROFILE                           |');
        lines.push('+----------------------------------------------------------+');
        lines.push('WEAPON      : ' + String(w.name || '').toUpperCase());
        lines.push('MODE        : ' + (w.automatic ? 'AUTO' : 'SEMI-AUTO'));
        lines.push('DAMAGE B/H  : ' + fNum(w.bodyDamage) + ' / ' + fNum(w.headDamage));
        lines.push('COOLDOWN    : ' + fNum(w.cooldown) + 'ms');
        lines.push('ROF         : ' + fRateMs(w.cooldown));
        lines.push('RANGE H/A   : ' + fNum(w.maxRange) + ' / ' + fNum(w.adsMaxRange != null ? w.adsMaxRange : w.maxRange));
        lines.push('SPREAD      : ' + fNum(w.hipfireSpread));
        lines.push('ADS FOV     : ' + fNum(w.adsFovDeg != null ? w.adsFovDeg : (w.id === 'sniper' ? 24 : 56)));
        lines.push('PELLETS     : ' + fNum(w.pellets));
        lines.push('SPECIAL     : ' + weaponSpecial(w));
        lines.push('');
        lines.push('ASCII MODEL');
        lines.push(WEAPON_ART[w.id] || '[NO ASCII ART FOR THIS WEAPON]');
        return lines.join('\n');
    }

    function buildThrowablesPage(data) {
        var t = findById(data.throwables, state.selectedThrowableId);
        if (!t) {
            return [
                '+----------------------------------------------------------+',
                '| FIELD MANUAL / THROWABLE PROFILE                        |',
                '+----------------------------------------------------------+',
                'DATA UNAVAILABLE'
            ].join('\n');
        }

        var lines = [];
        lines.push('+----------------------------------------------------------+');
        lines.push('| FIELD MANUAL / THROWABLE PROFILE                        |');
        lines.push('+----------------------------------------------------------+');
        lines.push('ITEM        : ' + String(t.label || t.id || '').toUpperCase());
        lines.push('SPEED       : ' + fNum(t.speed));
        lines.push('UPWARD      : ' + fNum(t.upward));
        lines.push('GRAVITY     : ' + fNum(t.gravity));
        lines.push('REGEN       : ' + fSec(t.regen));
        lines.push('');

        if (t.id === 'knife') {
            lines.push('DAMAGE B/H  : ' + fNum(t.bodyDamage) + ' / ' + fNum(t.headDamage));
            lines.push('LIFETIME    : ' + fSec(t.life));
            lines.push('ON HEADSHOT : instantly refills explosive throwables');
        } else if (t.id === 'molotov') {
            lines.push('FUSE        : ' + fSec(t.fuse));
            lines.push('FIRE RADIUS : ' + fNum(t.fireRadius));
            lines.push('FIRE TICK   : ' + fNum(t.fireTickDamage) + ' every ' + fSec(t.fireTickRate));
            lines.push('FIRE LIFE   : ' + fSec(t.fireDuration));
        } else {
            lines.push('FUSE        : ' + fSec(t.fuse));
            lines.push('BLAST RADIUS: ' + fNum(t.radius));
            lines.push('MAX DAMAGE  : ' + fNum(t.damage));
        }

        return lines.join('\n');
    }

    function buildFormulasPage() {
        return [
            '+----------------------------------------------------------+',
            '| FIELD MANUAL / CORE FORMULAS                            |',
            '+----------------------------------------------------------+',
            'BASE HP                = 500 for players and AI',
            'DAMAGE ORDER           = armor first, then health',
            'WEAPON FALLOFF         = tier bands (close/mid/long/extreme)',
            'ARMOR REGEN START      = 6.0s after last damage taken',
            'ARMOR REGEN RATE       = 12 armor per second',
            'ABILITY LOADOUT        = shared by all players',
            '',
            'Distance/range values are normalized in world units',
            'through shared/gameplay-tuning.js (single gameplay source).',
            'Compatibility readers like js/combat/combat-tuning.js should mirror',
            'shared values instead of redefining weapon numbers.'
        ].join('\n');
    }

    function buildContent(pageId, data) {
        switch (pageId) {
            case 'controls': return buildControlsPage();
            case 'abilities': return buildAbilityPage(data);
            case 'weapons': return buildWeaponPage(data);
            case 'throwables': return buildThrowablesPage(data);
            case 'formulas': return buildFormulasPage();
            default: return buildHomePage(data);
        }
    }

    function getSubItems(pageId, data) {
        var out = [];
        var i;

        if (pageId === 'abilities') {
            for (i = 0; i < data.abilities.length; i++) {
                out.push({ id: data.abilities[i].id, label: String(data.abilities[i].name || data.abilities[i].id || '').toUpperCase() });
            }
            return out;
        }

        if (pageId === 'weapons') {
            for (i = 0; i < data.weapons.length; i++) {
                out.push({ id: data.weapons[i].id, label: String(data.weapons[i].name || data.weapons[i].id || '').toUpperCase() });
            }
            return out;
        }

        if (pageId === 'throwables') {
            for (i = 0; i < data.throwables.length; i++) {
                out.push({ id: data.throwables[i].id, label: String(data.throwables[i].label || data.throwables[i].id || '').toUpperCase() });
            }
            return out;
        }

        return out;
    }

    function getSelectedSubId(pageId) {
        if (pageId === 'abilities') return state.selectedAbilityId;
        if (pageId === 'weapons') return state.selectedWeaponId;
        if (pageId === 'throwables') return state.selectedThrowableId;
        return '';
    }

    function setSelectedSubId(pageId, id) {
        if (pageId === 'abilities') state.selectedAbilityId = id;
        else if (pageId === 'weapons') state.selectedWeaponId = id;
        else if (pageId === 'throwables') state.selectedThrowableId = id;
    }

    function renderNav() {
        if (!navEl) return;
        navEl.innerHTML = '';

        for (var i = 0; i < PAGES.length; i++) {
            var page = PAGES[i];
            var btn = document.createElement('button');
            btn.className = 'docs-tab' + (state.activePage === page.id ? ' active' : '');
            btn.type = 'button';
            btn.textContent = page.label;
            btn.addEventListener('click', (function (pageId) {
                return function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    state.activePage = pageId;
                    render();
                };
            })(page.id));
            navEl.appendChild(btn);
        }
    }

    function renderSubnav(data) {
        if (!subnavEl || !mainEl) return;

        var items = getSubItems(state.activePage, data);
        if (!items.length) {
            subnavEl.innerHTML = '';
            subnavEl.style.display = 'none';
            mainEl.classList.add('no-subnav');
            return;
        }

        subnavEl.style.display = 'flex';
        mainEl.classList.remove('no-subnav');
        subnavEl.innerHTML = '';

        var selected = getSelectedSubId(state.activePage);
        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            var btn = document.createElement('button');
            btn.className = 'docs-subitem' + (item.id === selected ? ' active' : '');
            btn.type = 'button';
            btn.textContent = item.label;
            btn.addEventListener('click', (function (itemId) {
                return function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    setSelectedSubId(state.activePage, itemId);
                    render();
                };
            })(item.id));
            subnavEl.appendChild(btn);
        }
    }

    function renderHint() {
        if (!hintEl) return;

        if (state.activePage === 'abilities' || state.activePage === 'weapons' || state.activePage === 'throwables') {
            hintEl.textContent = 'Select a profile from the left list. Data is live from current gameplay configs.';
            return;
        }

        hintEl.textContent = 'Use top tabs to navigate manual pages. Press I to close/open quickly.';
    }

    function render() {
        if (!contentEl) return;

        var data = getData();
        ensureSelections(data);

        renderNav();
        renderSubnav(data);
        renderHint();

        if (titleEl) {
            titleEl.textContent = 'MAYHEM :: FIELD MANUAL :: ' + getPageLabel(state.activePage);
        }

        contentEl.textContent = buildContent(state.activePage, data);
    }

    function openPanel(triggerEl) {
        if (!panelEl) return;
        if (document.pointerLockElement && document.exitPointerLock) {
            document.exitPointerLock();
        }
        if (globalThis.__MAYHEM_RUNTIME.GameModalManager && globalThis.__MAYHEM_RUNTIME.GameModalManager.open) {
            globalThis.__MAYHEM_RUNTIME.GameModalManager.open('docs', triggerEl || pauseOpenBtnEl || hudOpenBtnEl || document.activeElement || null);
        } else {
            panelEl.hidden = false;
            panelEl.setAttribute('aria-hidden', 'false');
        }
        GameDocs.refresh();
    }

    function closePanel() {
        if (!panelEl) return;
        if (globalThis.__MAYHEM_RUNTIME.GameModalManager && globalThis.__MAYHEM_RUNTIME.GameModalManager.close) {
            globalThis.__MAYHEM_RUNTIME.GameModalManager.close('docs');
        } else {
            panelEl.hidden = true;
            panelEl.setAttribute('aria-hidden', 'true');
        }
    }

    GameDocs.init = function () {
        panelEl = document.getElementById('docs-panel');
        titleEl = document.getElementById('docs-title');
        navEl = document.getElementById('docs-nav');
        mainEl = document.getElementById('docs-main');
        subnavEl = document.getElementById('docs-subnav');
        contentEl = document.getElementById('docs-content');
        hintEl = document.getElementById('docs-hint');

        closeBtnEl = document.getElementById('docs-close-btn');
        pauseOpenBtnEl = document.getElementById('open-manual-btn');
        hudOpenBtnEl = document.getElementById('hud-manual-btn');

        if (!panelEl || !contentEl || !navEl || !subnavEl || !mainEl) return;

        if (closeBtnEl) {
            closeBtnEl.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                closePanel();
            });
        }

        panelEl.addEventListener('click', function (e) {
            e.stopPropagation();
        });

        if (globalThis.__MAYHEM_RUNTIME.GameModalManager && globalThis.__MAYHEM_RUNTIME.GameModalManager.register) {
            globalThis.__MAYHEM_RUNTIME.GameModalManager.register('docs', {
                element: panelEl,
                initialFocus: closeBtnEl || panelEl,
                restoreFocus: pauseOpenBtnEl || hudOpenBtnEl || null
            });
        }

        panelEl.hidden = true;
        panelEl.setAttribute('aria-hidden', 'true');

        isInited = true;
        render();
    };

    GameDocs.refresh = function () {
        if (!isInited) return;
        render();
    };

    GameDocs.open = function (triggerEl) {
        if (!isInited) return;
        openPanel(triggerEl);
    };

    GameDocs.close = function () {
        if (!isInited) return;
        closePanel();
    };

    GameDocs.toggle = function () {
        if (!isInited) return;
        if (GameDocs.isOpen()) {
            closePanel();
        } else {
            openPanel();
        }
    };

    GameDocs.isOpen = function () {
        if (globalThis.__MAYHEM_RUNTIME.GameModalManager && globalThis.__MAYHEM_RUNTIME.GameModalManager.isOpen) {
            return globalThis.__MAYHEM_RUNTIME.GameModalManager.isOpen('docs');
        }
        return !!panelEl && !panelEl.hidden;
    };

    globalThis.__MAYHEM_RUNTIME.GameDocs = GameDocs;
})();
