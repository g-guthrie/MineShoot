/**
 * docs.js - In-game Fallout-style ASCII field manual
 * Loaded as global: window.GameDocs
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
        selectedClassId: '',
        selectedWeaponId: '',
        selectedThrowableId: ''
    };

    var PAGES = [
        { id: 'home', label: 'HOME' },
        { id: 'controls', label: 'CONTROLS' },
        { id: 'classes', label: 'CLASSES' },
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
        plasma: [
            '        .-====================-.',
            '  _____/  _  _  _  _  _  _    /=====>',
            ' |____/__/ \\/ \\/ \\/ \\/ \\/___/',
            '        ||  PLASMA CORE  ||',
            '        ||=====[##]======||',
            '            \\\\____//'
        ].join('\n')
    };

    var CLASS_ROLE = {
        ninja: 'Mobility burst. High precision knife pressure.',
        jedi: 'Close control. Durable front-liner with crowd disruption.',
        magician: 'Area denial and spell burst from medium distance.',
        sharpshooter: 'High precision pick class with lock potential.',
        brawler: 'Sustained brawl with high armor and pressure uptime.'
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
        return {
            classes: safeCatalog(window.GameClasses && window.GameClasses.getCatalog),
            weapons: safeCatalog(window.GameHitscan && window.GameHitscan.getWeaponCatalog),
            throwables: safeCatalog(window.GameThrowables && window.GameThrowables.getCatalog)
        };
    }

    function ensureSelections(data) {
        if (!findById(data.classes, state.selectedClassId)) {
            state.selectedClassId = data.classes.length ? data.classes[0].id : '';
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
        if (weapon.id === 'shotgun') return '12 deterministic hitscan pellets with hard spread box';
        if (weapon.id === 'sniper') return 'Highest burst per trigger, long cooldown';
        if (weapon.id === 'machinegun') return 'Automatic suppression, strongest sustained DPS';
        if (weapon.id === 'plasma') return 'Short-range lock beam, sustained DPS, overheat-limited';
        if (weapon.id === 'pistol') return 'Fast swap sidearm, reliable fallback';
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
        lines.push('  Classes    : ' + data.classes.length);
        lines.push('  Weapons    : ' + data.weapons.length);
        lines.push('  Throwables : ' + data.throwables.length);
        lines.push('');
        lines.push('Navigation:');
        lines.push('  1. Choose top tab (Controls / Classes / Weapons / etc).');
        lines.push('  2. For Classes/Weapons, choose a subpage from left list.');
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
            '  Shift: Sprint',
            '  Space: Variable jump (hold for full height)',
            '',
            'Combat',
            '  LMB: Fire',
            '  1-5 / Wheel: Weapon swap',
            '  G Frag | V Seeker | B Molotov | Q Knife',
            '  E: Class ability   R: Class ultimate',
            '',
            'Utility',
            '  C: Toggle first/third person',
            '  H: Toggle dev ring + hitboxes',
            '  I: Toggle field manual',
            '  ESC: Release pointer lock'
        ].join('\n');
    }

    function classKeyLabel(classId) {
        var keyMap = {
            ninja: '6',
            jedi: '7',
            magician: '8',
            sharpshooter: '9',
            brawler: '0'
        };
        return keyMap[classId] || '--';
    }

    function buildClassPage(data) {
        var c = findById(data.classes, state.selectedClassId);
        if (!c) {
            return [
                '+----------------------------------------------------------+',
                '| FIELD MANUAL / CLASS PROFILE                            |',
                '+----------------------------------------------------------+',
                'DATA UNAVAILABLE'
            ].join('\n');
        }

        var lines = [];
        lines.push('+----------------------------------------------------------+');
        lines.push('| FIELD MANUAL / CLASS PROFILE                            |');
        lines.push('+----------------------------------------------------------+');
        lines.push('CLASS       : ' + String(c.name || '').toUpperCase());
        lines.push('KEY         : ' + classKeyLabel(c.id));
        lines.push('LOADOUT     : ' + String(c.loadoutWeapon || '--').toUpperCase());
        lines.push('ARMOR MAX   : ' + fNum(c.armorMax));
        lines.push('WALLHACK R  : ' + fNum(c.wallhackRadius));
        lines.push('ROLE        : ' + (CLASS_ROLE[c.id] || 'Generalist combat package.'));
        lines.push('');
        lines.push('PRIMARY (E) : ' + (c.abilityName || '--'));
        lines.push('COOLDOWN    : ' + fSec(c.abilityCooldown));
        lines.push('');
        lines.push('ULTIMATE (R): ' + (c.ultimateName || '--'));
        lines.push('COOLDOWN    : ' + fSec(c.ultimateCooldown));
        lines.push('');
        lines.push('NOTES       : Queue class swap any time; applies on respawn.');
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
        lines.push('MAX RANGE   : ' + fNum(w.maxRange));
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
            'ARMOR REGEN START      = 6.0s after last damage taken',
            'ARMOR REGEN RATE       = 12 armor per second',
            'CLASS SWAP APPLICATION = queued now, applied at respawn',
            '',
            'Distance/range values are normalized in world units',
            'through js/combat-tuning.js (single tuning source).',
            'Weapon, enemy, radar, class, and throwable range values',
            'should be adjusted there before per-module fine tuning.'
        ].join('\n');
    }

    function buildContent(pageId, data) {
        switch (pageId) {
            case 'controls': return buildControlsPage();
            case 'classes': return buildClassPage(data);
            case 'weapons': return buildWeaponPage(data);
            case 'throwables': return buildThrowablesPage(data);
            case 'formulas': return buildFormulasPage();
            default: return buildHomePage(data);
        }
    }

    function getSubItems(pageId, data) {
        var out = [];
        var i;

        if (pageId === 'classes') {
            for (i = 0; i < data.classes.length; i++) {
                out.push({ id: data.classes[i].id, label: String(data.classes[i].name || data.classes[i].id || '').toUpperCase() });
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
        if (pageId === 'classes') return state.selectedClassId;
        if (pageId === 'weapons') return state.selectedWeaponId;
        if (pageId === 'throwables') return state.selectedThrowableId;
        return '';
    }

    function setSelectedSubId(pageId, id) {
        if (pageId === 'classes') state.selectedClassId = id;
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

        if (state.activePage === 'classes' || state.activePage === 'weapons' || state.activePage === 'throwables') {
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

    function openPanel() {
        if (!panelEl) return;
        panelEl.style.display = 'flex';
        panelEl.setAttribute('aria-hidden', 'false');
        if (document.pointerLockElement && document.exitPointerLock) {
            document.exitPointerLock();
        }
        GameDocs.refresh();
    }

    function closePanel() {
        if (!panelEl) return;
        panelEl.style.display = 'none';
        panelEl.setAttribute('aria-hidden', 'true');
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

        if (pauseOpenBtnEl) {
            pauseOpenBtnEl.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                GameDocs.toggle();
            });
        }

        if (hudOpenBtnEl) {
            hudOpenBtnEl.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                GameDocs.toggle();
            });
        }

        panelEl.addEventListener('click', function (e) {
            e.stopPropagation();
        });

        panelEl.style.display = 'none';
        panelEl.setAttribute('aria-hidden', 'true');

        isInited = true;
        render();
    };

    GameDocs.refresh = function () {
        if (!isInited) return;
        render();
    };

    GameDocs.open = function () {
        if (!isInited) return;
        openPanel();
    };

    GameDocs.close = function () {
        if (!isInited) return;
        closePanel();
    };

    GameDocs.toggle = function () {
        if (!isInited) return;
        if (panelEl && panelEl.style.display !== 'none') {
            closePanel();
        } else {
            openPanel();
        }
    };

    GameDocs.isOpen = function () {
        return !!panelEl && panelEl.style.display !== 'none';
    };

    window.GameDocs = GameDocs;
})();
