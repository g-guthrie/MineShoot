/**
 * docs.js - In-game field manual with live tuning data.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameDocs
 */
(function () {
    'use strict';

    var runtime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    var inputLabels = runtime.GameInputLabels || null;
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
        selectedWeaponId: '',
        selectedThrowableId: ''
    };

    function inputBindingsApi() {
        return runtime.GameInputBindings || null;
    }

    function bindingCombo(actionIds, fallbackLabels) {
        var ids = Array.isArray(actionIds) ? actionIds : [];
        var fallbacks = Array.isArray(fallbackLabels) ? fallbackLabels : [];
        var labels = [];
        for (var i = 0; i < ids.length; i++) {
            labels.push(inputLabels.getBindingLabel(ids[i], fallbacks[i] || '--'));
        }
        return labels.join(' / ');
    }

    function fixedControlRows() {
        var bindingsApi = inputBindingsApi();
        if (bindingsApi && bindingsApi.getFixedControls) {
            var rows = bindingsApi.getFixedControls();
            return rows.map(function (row) {
                return {
                    key: row.label,
                    title: row.title,
                    note: row.note
                };
            });
        }
        return [
            { key: 'Mouse', title: 'Look', note: 'Pointer lock activates on match entry. Escape releases it.' },
            { key: 'LMB', title: 'Fire', note: 'Primary fire. Hold for automatic weapons.' },
            { key: 'Wheel', title: 'Swap Weapon', note: 'Toggles between your two loadout weapons.' },
            { key: 'Esc', title: 'Pause / Menu', note: 'Releases pointer lock and opens the pause menu.' }
        ];
    }

    var PAGES = [
        { id: 'home', label: 'BRIEFING' },
        { id: 'controls', label: 'CONTROLS' },
        { id: 'weapons', label: 'WEAPONS' },
        { id: 'throwables', label: 'THROWABLES' },
        { id: 'tunables', label: 'TUNABLES' }
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
        ].join('\n')
    };

    var WEAPON_BRIEFINGS = {
        machinegun: {
            niche: 'Your most forgiving all-round gun. Best when you stay in motion and keep steady pressure on mid-range lanes.',
            mechanics: 'Fully automatic single-ray hitscan. Big 32-round magazine, moderate spread, and the best sustained pressure of the standard guns.',
            tips: [
                'Open fights with it to strip armor, then weapon-swap to finish.',
                'It keeps more move speed than the other long guns, so strafe and re-peek with it.'
            ]
        },
        shotgun: {
            niche: 'Hard close-range cash-out. Weak from neutral, brutal once you are already in someone’s face.',
            mechanics: 'One trigger pull fires 12 hitscan pellets. Each pellet deals damage separately, and the gun falls off to zero very quickly once you leave true brawl range.',
            tips: [
                'Treat the circle reticle as your commit zone. If the target is outside it, close first.',
                'Rolls, corners, and already-cracked armor are what make this gun shine.'
            ]
        },
        rifle: {
            niche: 'Lane control and measured punish shots.',
            mechanics: 'Semi-auto single-ray hitscan with the tightest standard spread and strong headshot payoff.',
            tips: [
                'Peek, shoot, reset. It wins by consistency, not spam.',
                'Body shots soften people up; headshots end fights much faster.'
            ]
        },
        pistol: {
            niche: 'Fast-moving finisher and close-mid punish gun.',
            mechanics: 'Semi-auto single-ray hitscan with heavy per-shot damage, very wide spread, and a short falloff window.',
            tips: [
                'Swap to it after armor is already stripped.',
                'At longer range the spread and falloff get ugly fast, so do not overtrust it.'
            ]
        },
        sniper: {
            niche: 'Long-lane punish gun for specific sightlines.',
            mechanics: 'Single-ray hitscan. It auto-scopes on equip, only fires once the quick scope-in is ready, and keeps full damage at all practical ranges.',
            tips: [
                'Keep it in slot 2 and pull it out for a specific angle, not for general roaming.',
                'If you miss, break sight and reset instead of standing still for the follow-up.'
            ]
        }
    };

    var THROWABLE_BRIEFINGS = {
        frag: {
            useCase: 'Standard explosive for corners and stacked enemies.',
            mechanics: 'Hold to preview the arc, release to throw. It can bounce before detonating, and the blast is large enough to force movement even on partial damage.',
            tips: [
                'Bank it around cover and into landings.',
                'Use it to force movement before you swing with a gun.'
            ]
        },
        plasma: {
            useCase: 'Sticky explosive that punishes near-misses.',
            mechanics: 'No arc preview. Throw it fast; if the projectile passes close enough to an enemy it snaps the last short distance, sticks, and explodes shortly after.',
            tips: [
                'Throw it into tight cover or during a chase when the target has limited escape paths.',
                'It is not a long-range homing rocket, so do not lob it from too far away.'
            ]
        },
        molotov: {
            useCase: 'Area denial. Creates a damage zone on the ground.',
            mechanics: 'On impact it creates a fire patch that deals damage over time, and targets keep a short burn after leaving the flames.',
            tips: [
                'Seal doors, retreat lanes, and the ground under trapped targets.',
                'Even a partial touch matters because the burn keeps ticking after they step out.'
            ]
        },
        knife: {
            useCase: 'Fast direct-hit finisher.',
            mechanics: 'Instant press throw with no preview. It flies fast, hits hard on direct contact, and disappears on world impact.',
            tips: [
                'Use it when somebody is one tap from dead and you do not want to reload or swap back.',
                'It rewards confident aim, but you only get one charge and the recharge is longer than a missed gunshot.'
            ]
        }
    };

    var WEAPON_TUNABLE_HELP = {
        primitiveType: 'Base shot solver. `hitscan_single` is one ray, `hitscan_multi` samples spread multiple times.',
        automatic: 'If true, holding LMB keeps firing as long as cadence and ammo allow.',
        cooldownMs: 'Minimum delay between one shot and the next.',
        reloadMs: 'How long the weapon stays unavailable once a reload begins.',
        magazineSize: 'Rounds loaded before a manual or automatic reload starts.',
        bodyDamage: 'Damage dealt on a non-head hit before falloff scaling.',
        headDamage: 'Damage dealt on a head hit before falloff scaling.',
        pellets: 'Number of spread samples or pellets fired per trigger pull.',
        hipfireSpread: 'Hipfire spread radius feeding the shot solver.',
        adsSpread: 'Stored scoped spread radius. Sniper still uses this path; other guns now stay in the standard third-person view.',
        maxRange: 'Hipfire distance cap before the shot stops checking for hits.',
        adsMaxRange: 'Stored scoped distance cap. Sniper still uses this path when the scope-in finishes.',
        adsFovDeg: 'Zoom level used when a weapon enters scoped view.',
        hipfireBloomScale: 'Legacy HUD multiplier retained in tuning data. Active/dev circles now size from the true spread area.',
        adsBloomScale: 'Legacy scoped HUD multiplier retained in tuning data. Active/dev circles now size from the true spread area.',
        'tracer.life': 'How long the visual tracer stays alive.',
        'tracer.speed': 'How quickly the tracer travels toward the hit point.',
        'tracer.segmentLength': 'Visible tracer streak length.',
        'recoil.z': 'Backward positional kick.',
        'recoil.x': 'Side positional kick.',
        'recoil.pitch': 'Vertical camera/weapon snap.',
        'recoil.yaw': 'Horizontal kick per shot.',
        'recoil.roll': 'Weapon roll during the recoil impulse.',
        'recoil.armR': 'Right arm animation contribution.',
        'recoil.armL': 'Left arm animation contribution.',
        'recoil.muzzleMs': 'How long muzzle flash feedback stays visible.',
        'audioSample.gain': 'Playback volume multiplier for the shot sample.',
        'audioSample.playbackRate': 'Playback rate range used to keep repeated shots from sounding identical.'
    };

    var THROWABLE_TUNABLE_HELP = {
        speed: 'Initial forward speed.',
        upward: 'Vertical launch boost applied at throw time.',
        gravity: 'Gravity scale during flight.',
        fuse: 'Delay before detonation if nothing triggers earlier.',
        radius: 'Blast radius.',
        damage: 'Peak blast damage.',
        minBlastDamage: 'Minimum damage floor after radial falloff.',
        regen: 'Recharge time before the charge returns.',
        bounce: 'Whether the throwable is allowed to bounce.',
        bounceVelocityDamping: 'Horizontal energy preserved after a bounce.',
        bounceVerticalDamping: 'Vertical energy preserved after a bounce.',
        bounceMaxCount: 'Maximum allowed bounce count.',
        bounceStopSpeedSq: 'Threshold below which bouncing stops.',
        homingBoost: 'How hard the projectile can steer toward a target.',
        homingLerp: 'How quickly it blends toward that steering direction.',
        acquireRange: 'Seek acquisition range.',
        acquireHalfAngleDeg: 'Seek acquisition cone half-angle.',
        maxLife: 'Maximum lifetime before a projectile times out even if it has not detonated.',
        trackDuration: 'How long post-acquire steering stays active.',
        trackLerp: 'How quickly the tracked projectile bends toward the target.',
        stickExplodeDelay: 'Delay between a successful stick and detonation.',
        fireRadius: 'Persistent fire zone radius.',
        fireDuration: 'How long the fire patch lasts.',
        fireTickDamage: 'Damage applied per fire tick.',
        fireTickRate: 'Time between fire damage ticks.',
        fireInnerRadius: 'Inner zone that takes full burn damage before outer falloff starts.',
        fireOuterDamageScale: 'Damage multiplier at the outer edge of the fire zone.',
        fireLingerDuration: 'How long a target keeps burning after leaving the zone.',
        fireLingerTickDamage: 'Damage applied by the lingering burn state.',
        fireLingerTickRate: 'Tick rate for lingering burn damage.',
        fireMaxHeightDelta: 'Maximum vertical separation where the fire zone can still damage a target.',
        life: 'Lifetime before the projectile despawns.',
        hitRadius: 'Direct-hit collision radius.',
        bodyDamage: 'Direct body hit damage.',
        headDamage: 'Direct head hit damage.'
    };

    var CONTROL_GROUPS = [
        {
            title: 'Movement & Camera',
            rows: [
                { actionIds: ['move_forward', 'move_left', 'move_backward', 'move_right'], fallbackKeys: ['W', 'A', 'S', 'D'], title: 'Move', note: 'Constant strafing matters. Standing still is how every gun starts feeling too strong.' },
                { actionId: 'sprint', fallbackKey: 'Shift', title: 'Sprint', note: 'Use it to break sight, rotate, and widen the distance before your next peek.' },
                { actionId: 'jump', fallbackKey: 'Space', title: 'Variable Jump', note: 'Tap for a short hop, hold briefly for the full jump.' },
                { actionId: 'roll', fallbackKey: 'E', title: 'Roll', note: 'Rolls only start while grounded and moving. Your opening direction is locked in for the whole action.' }
            ]
        },
        {
            title: 'Combat',
            rows: [
                { actionIds: ['weapon_slot_1', 'weapon_slot_2'], fallbackKeys: ['1', '2'], title: 'Weapon Slots', note: 'These map to your two menu loadout slots. The wheel is a straight toggle between them.' },
                { actionId: 'throwable', fallbackKey: 'Q', title: 'Throwable', note: 'Frag and molotov preview on hold; plasma and knife throw on press/release with no arc preview.' }
            ]
        },
        {
            title: 'Session',
            rows: [
                { key: 'Menu', title: 'Capture Cursor', note: 'Use ENTER MATCH or RESUME MATCH from the menu flow to lock the mouse again.' },
                { actionId: 'open_manual', fallbackKey: 'I', title: 'Field Manual', note: 'Open or close this manual from both menu and live gameplay.' },
                { actionId: 'toggle_auto_fire', fallbackKey: 'G', title: 'Auto Fire', note: 'Desktop only. Toggles red-reticle auto fire on or off.' },
                { actionId: 'toggle_debug', fallbackKey: 'H', title: 'Debug Visuals', note: 'Shows lock boxes, reticles, and extra dev combat helpers.' }
            ]
        }
    ];

    var TUNABLE_GROUPS = [
        {
            title: 'Shot Model',
            items: [
                '<code>primitiveType</code> chooses the solver: one ray or a spread bundle.',
                '<code>pellets</code> sets how many spread samples fire on each trigger pull.',
                'Pistol is back on the normal single-ray path instead of its old special-case solver.'
            ]
        },
        {
            title: 'Cadence & Ammo',
            items: [
                '<code>automatic</code> flips between tap fire and hold fire behavior.',
                '<code>cooldownMs</code>, <code>magazineSize</code>, and <code>reloadMs</code> define pace and punishment windows.',
                'Because reload is automatic on empty, these numbers directly shape when you can safely overcommit.'
            ]
        },
        {
            title: 'Accuracy & Range',
            items: [
                '<code>hipfireSpread</code> and <code>adsSpread</code> drive the actual shot cone.',
                '<code>maxRange</code> and <code>adsMaxRange</code> cap hit checks, while <code>falloff.start</code>, <code>falloff.end</code>, and <code>falloff.minScalar</code> define the damage drop curve.',
                '<code>adsFovDeg</code> changes zoom, while bloom scales change how readable the HUD reticle feels.'
            ]
        },
        {
            title: 'Presentation Feel',
            items: [
                '<code>tracer.*</code> shapes how visible the shot path feels.',
                '<code>recoil.*</code> shapes kick, pose, and muzzle timing rather than raw damage output.',
                '<code>audioSample.*</code> helps repeated firing stay readable without making every weapon identical.'
            ]
        }
    ];

    function hasOwn(source, key) {
        return !!source && Object.prototype.hasOwnProperty.call(source, key);
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function asFiniteNumber(value) {
        var num = Number(value);
        return isFinite(num) ? num : null;
    }

    function formatNumber(value, decimals) {
        var num = asFiniteNumber(value);
        if (num === null) return '--';
        if (!isFinite(num)) return 'INF';
        if (Math.abs(num - Math.round(num)) < 0.0005) return String(Math.round(num));
        return num.toFixed(typeof decimals === 'number' ? decimals : 2);
    }

    function formatMs(value) {
        var num = asFiniteNumber(value);
        if (num === null) return '--';
        return formatNumber(num, 0) + ' ms';
    }

    function formatSeconds(value) {
        var num = asFiniteNumber(value);
        if (num === null) return '--';
        return formatNumber(num, num >= 10 ? 0 : 2) + ' s';
    }

    function formatSecondsFromMs(value) {
        var num = asFiniteNumber(value);
        if (num === null) return '--';
        return formatSeconds(num / 1000);
    }

    function formatRate(valueMs) {
        var num = asFiniteNumber(valueMs);
        if (num === null || num <= 0) return '--';
        return formatNumber(1000 / num, 2) + '/s';
    }

    function formatRange(value) {
        if (value === Infinity || Number(value) >= 99999) return 'INF';
        var num = asFiniteNumber(value);
        if (num === null) return '--';
        return formatNumber(num, 0) + ' wu';
    }

    function formatSpread(value) {
        var num = asFiniteNumber(value);
        if (num === null) return '--';
        return formatNumber(num, 3);
    }

    function formatPercentScale(scale) {
        var num = asFiniteNumber(scale);
        if (num === null) return '--';
        return formatNumber(num * 100, 0) + '%';
    }

    function formatBool(value) {
        return value ? 'Yes' : 'No';
    }

    function sharedApi() {
        return runtime.GameShared || {};
    }

    function sharedDataCatalog() {
        return sharedApi().gameplayTuning || {};
    }

    function findById(list, id) {
        if (!Array.isArray(list) || !id) return null;
        for (var i = 0; i < list.length; i++) {
            if (list[i] && list[i].id === id) return list[i];
        }
        return null;
    }

    function getPageLabel(pageId) {
        for (var i = 0; i < PAGES.length; i++) {
            if (PAGES[i].id === pageId) return PAGES[i].label;
        }
        return 'BRIEFING';
    }

    function safeArray(value) {
        return Array.isArray(value) ? value.slice() : [];
    }

    function buildWeaponData(weaponId, shared, api) {
        var stats = shared.weaponStats && shared.weaponStats[weaponId];
        if (!stats) return null;
        var hipAim = api.resolveWeaponAimProfile
            ? api.resolveWeaponAimProfile(stats, false)
            : { spread: stats.hipfireSpread, maxRange: stats.maxRange };
        var adsAim = api.resolveWeaponAimProfile
            ? api.resolveWeaponAimProfile(stats, true)
            : {
                spread: stats.adsSpread != null ? stats.adsSpread : stats.hipfireSpread,
                maxRange: stats.adsMaxRange != null ? stats.adsMaxRange : stats.maxRange
            };
        var presentation = api.getWeaponPresentation
            ? api.getWeaponPresentation(weaponId)
            : (stats.presentation || {});
        var falloff = api.getWeaponFalloffProfile
            ? api.getWeaponFalloffProfile(weaponId)
            : ((shared.weaponFalloff && shared.weaponFalloff[weaponId]) || null);
        return {
            id: weaponId,
            name: String(stats.name || weaponId),
            primitiveType: String(stats.primitiveType || 'hitscan_single'),
            automatic: !!stats.automatic,
            cooldownMs: Number(stats.cooldownMs || 0),
            reloadMs: Number(stats.reloadMs || 0),
            magazineSize: Number(stats.magazineSize || 0),
            bodyDamage: Number(stats.bodyDamage || 0),
            headDamage: Number(stats.headDamage || 0),
            pellets: Math.max(1, Number(stats.pellets || 1)),
            hipfireSpread: Number(hipAim && hipAim.spread || 0),
            adsSpread: Number(adsAim && adsAim.spread || 0),
            maxRange: hipAim && hipAim.maxRange === Infinity ? Infinity : Number(hipAim && hipAim.maxRange || 0),
            adsMaxRange: adsAim && adsAim.maxRange === Infinity ? Infinity : Number(adsAim && adsAim.maxRange || 0),
            adsFovDeg: Number(stats.adsFovDeg || 0),
            hipfireCylinderRadiusWu: Number(stats.hipfireCylinderRadiusWu || 0),
            adsCylinderRadiusWu: Number(stats.adsCylinderRadiusWu || 0),
            hipfireBloomScale: Number(stats.hipfireBloomScale != null ? stats.hipfireBloomScale : 1),
            adsBloomScale: Number(stats.adsBloomScale != null ? stats.adsBloomScale : 1),
            singleHitFromPellets: !!stats.singleHitFromPellets,
            presentation: presentation || {},
            falloff: falloff
        };
    }

    function buildThrowableData(throwableId, shared) {
        var def = shared.throwables && shared.throwables[throwableId];
        if (!def) return null;
        var out = { id: throwableId };
        for (var key in def) {
            if (hasOwn(def, key)) out[key] = def[key];
        }
        return out;
    }

    function buildModeSummaries() {
        var api = sharedApi();
        var modes = api.getGameModeCatalog ? api.getGameModeCatalog() : [
            { id: 'ffa', label: 'Free For All' },
            { id: 'tdm', label: 'Team Death Match' }
        ];
        var matchRules = api.matchRules || {};
        var out = [];
        for (var i = 0; i < modes.length; i++) {
            var mode = modes[i];
            if (!mode || !mode.id) continue;
            var objective = 'Be the last player still holding lives.';
            var note = 'Free For All starts with 3 lives, can grow to 5, and only ends when one player remains.';
            if (mode.id === 'tdm') {
                objective = 'First team to ' + formatNumber(matchRules.tdmTargetProgress || 10, 0) + ' team score.';
                note = 'Team score is normalized by starting team size, so bigger teams need more raw kills. Trade space for crossfires.';
            }
            out.push({
                id: String(mode.id),
                label: String(mode.label || mode.id),
                objective: objective,
                note: note
            });
        }
        return out;
    }

    function loadoutSummary(data) {
        var summary = {
            slot1Weapon: '',
            slot2Weapon: '',
            throwable: ''
        };
        var menuLoadout = runtime.GameMenuLoadout && runtime.GameMenuLoadout.getRuntimeSnapshot
            ? runtime.GameMenuLoadout.getRuntimeSnapshot()
            : null;
        var weaponSlots = menuLoadout && Array.isArray(menuLoadout.weaponSlots)
            ? menuLoadout.weaponSlots.slice(0, 2)
            : (runtime.GameHitscan && runtime.GameHitscan.getWeaponOrder
                ? runtime.GameHitscan.getWeaponOrder().slice(0, 2)
                : []);
        var throwableId = menuLoadout && menuLoadout.selectedThrowableId
            ? menuLoadout.selectedThrowableId
            : (runtime.GameThrowables && runtime.GameThrowables.getSelectedThrowable
                ? runtime.GameThrowables.getSelectedThrowable()
                : '');
        var weapon1 = findById(data.weapons, String(weaponSlots[0] || ''));
        var weapon2 = findById(data.weapons, String(weaponSlots[1] || ''));
        var throwable = findById(data.throwables, String(throwableId || ''));
        summary.slot1Weapon = weapon1 ? weapon1.name : 'Unassigned';
        summary.slot2Weapon = weapon2 ? weapon2.name : 'Unassigned';
        summary.throwable = throwable ? (throwable.label || throwable.name || throwable.id) : 'Unassigned';
        return summary;
    }

    function systemsSnapshot() {
        var shared = sharedDataCatalog();
        var api = sharedApi();
        return {
            survivability: api.getSurvivabilityTuning
                ? (api.getSurvivabilityTuning() || {})
                : (shared.survivability || {}),
            movement: api.getMovementTuning
                ? (api.getMovementTuning() || {})
                : (shared.movement || {}),
            combatTimings: api.getCombatTimings
                ? (api.getCombatTimings() || {})
                : (api.combatTimings || shared.combatTimings || {
                    PLAYER_SPAWN_SHIELD_MS: 1000,
                    RESPAWN_DELAY_MS: 2200
                }),
            matchRules: api.matchRules || {}
        };
    }

    function totalDurabilityValue(snapshot) {
        var survivability = snapshot && snapshot.survivability ? snapshot.survivability : {};
        return Math.max(0, Number(survivability.hpMax || 0)) + Math.max(0, Number(survivability.armorMax || 0));
    }

    function formatWuPerSecond(value) {
        return formatNumber(value, 2) + ' wu/s';
    }

    function weaponDamagePerTrigger(weapon, hitType) {
        if (!weapon) return 0;
        var perProjectile = hitType === 'head'
            ? Number(weapon.headDamage || 0)
            : Number(weapon.bodyDamage || 0);
        var pellets = Math.max(1, Number(weapon.pellets || 1));
        return Math.max(0, perProjectile * pellets);
    }

    function weaponFreshDownShots(weapon, totalDurability, hitType) {
        var damagePerTrigger = weaponDamagePerTrigger(weapon, hitType);
        if (!weapon || !(damagePerTrigger > 0) || !(totalDurability > 0)) return null;
        return Math.ceil(totalDurability / damagePerTrigger);
    }

    function weaponDamageValue(weapon) {
        if (!weapon) return '--';
        if (Number(weapon.pellets || 1) > 1) {
            return formatNumber(weapon.bodyDamage, 0) + ' x ' + formatNumber(weapon.pellets, 0) +
                ' / ' + formatNumber(weapon.headDamage, 0) + ' x ' + formatNumber(weapon.pellets, 0);
        }
        return formatNumber(weapon.bodyDamage, 0) + ' / ' + formatNumber(weapon.headDamage, 0);
    }

    function weaponDamageNote(weapon) {
        if (!weapon) return '';
        if (Number(weapon.pellets || 1) > 1) {
            return 'Per pellet. Perfect burst = ' +
                formatNumber(weaponDamagePerTrigger(weapon, 'body'), 0) + ' / ' +
                formatNumber(weaponDamagePerTrigger(weapon, 'head'), 0) + '.';
        }
        return 'Base body / head damage before falloff.';
    }

    function weaponFreshDownValue(weapon, totalDurability) {
        if (!weapon) return '--';
        return formatNumber(weaponFreshDownShots(weapon, totalDurability, 'body'), 0) +
            ' / ' + formatNumber(weaponFreshDownShots(weapon, totalDurability, 'head'), 0);
    }

    function weaponBestRangeLabel(weapon) {
        if (!weapon) return '--';
        if (weapon.id === 'shotgun') return 'Close only';
        if (weapon.id === 'pistol') return 'Close to mid';
        if (weapon.id === 'machinegun') return 'Mid';
        if (weapon.id === 'rifle') return 'Mid to long';
        if (weapon.id === 'sniper') return 'Long sightlines';
        return 'General purpose';
    }

    function weaponViewLabel(weapon) {
        if (!weapon) return '--';
        return weapon.id === 'sniper'
            ? 'Auto-scope on equip'
            : 'Over-shoulder crosshair view';
    }

    function weaponQuickStats(weapon, totalDurability) {
        if (!weapon) return [];
        return [
            { label: 'Damage', value: weaponDamageValue(weapon), note: weaponDamageNote(weapon) },
            { label: 'Fresh Down', value: weaponFreshDownValue(weapon, totalDurability), note: 'Approx point-blank trigger pulls on a fresh ' + formatNumber(totalDurability, 0) + '-durability target.' },
            { label: 'Fire Rate', value: formatRate(weapon.cooldownMs), note: formatMs(weapon.cooldownMs) + ' between shots.' },
            { label: 'Magazine / Reload', value: formatNumber(weapon.magazineSize, 0) + ' / ' + formatSecondsFromMs(weapon.reloadMs), note: 'How long you can stay committed before downtime.' },
            { label: 'Spread', value: formatSpread(weapon.hipfireSpread) + ' / ' + formatSpread(weapon.adsSpread), note: 'Hipfire / stored scoped spread. Only sniper uses a live scoped view.' },
            { label: 'Falloff', value: falloffProfileText(weapon.falloff), note: 'Damage stays full to the first number, then drops toward the floor.' },
            { label: 'Move Speed', value: formatPercentScale(weaponStatsMoveSpeedMultiplier(weapon)), note: 'Relative to the base jog and sprint.' },
            { label: 'View', value: weaponViewLabel(weapon), note: 'How the gun behaves on screen.' }
        ];
    }

    function weaponStatsMoveSpeedMultiplier(weapon) {
        return weapon && Number.isFinite(Number(weapon.moveSpeedMultiplier))
            ? Number(weapon.moveSpeedMultiplier)
            : Number((sharedDataCatalog().weaponStats && sharedDataCatalog().weaponStats[weapon.id] && sharedDataCatalog().weaponStats[weapon.id].moveSpeedMultiplier) || 1);
    }

    function getData() {
        var shared = sharedDataCatalog();
        var api = sharedApi();
        var selectableWeaponIds = api.getSelectableWeaponIds
            ? api.getSelectableWeaponIds()
            : Object.keys(shared.weaponStats || {});
        var weapons = [];
        for (var i = 0; i < selectableWeaponIds.length; i++) {
            var weapon = buildWeaponData(String(selectableWeaponIds[i] || ''), shared, api);
            if (weapon) weapons.push(weapon);
        }

        var throwables = [];
        var throwableOrder = safeArray(shared.throwables && shared.throwables.order);
        for (var t = 0; t < throwableOrder.length; t++) {
            var throwable = buildThrowableData(String(throwableOrder[t] || ''), shared);
            if (throwable) throwables.push(throwable);
        }

        var data = {
            weapons: weapons,
            throwables: throwables,
            modes: buildModeSummaries()
        };
        data.loadout = loadoutSummary(data);
        return data;
    }

    function ensureSelections(data) {
        if (!findById(data.weapons, state.selectedWeaponId)) {
            state.selectedWeaponId = data.weapons.length ? data.weapons[0].id : '';
        }
        if (!findById(data.throwables, state.selectedThrowableId)) {
            state.selectedThrowableId = data.throwables.length ? data.throwables[0].id : '';
        }
    }

    function renderTagRow(tags) {
        if (!Array.isArray(tags) || !tags.length) return '';
        var out = ['<div class="docs-tag-row">'];
        for (var i = 0; i < tags.length; i++) {
            if (!tags[i]) continue;
            out.push('<span class="docs-tag">' + escapeHtml(tags[i]) + '</span>');
        }
        out.push('</div>');
        return out.join('');
    }

    function renderStatGrid(items) {
        if (!Array.isArray(items) || !items.length) return '';
        var out = ['<div class="docs-stat-grid">'];
        for (var i = 0; i < items.length; i++) {
            var item = items[i] || {};
            out.push('<div class="docs-stat">');
            out.push('<span class="docs-stat-label">' + escapeHtml(item.label || '--') + '</span>');
            out.push('<span class="docs-stat-value">' + escapeHtml(item.value || '--') + '</span>');
            if (item.note) {
                out.push('<span class="docs-stat-note">' + escapeHtml(item.note) + '</span>');
            }
            out.push('</div>');
        }
        out.push('</div>');
        return out.join('');
    }

    function renderList(items) {
        if (!Array.isArray(items) || !items.length) return '';
        var out = ['<ul class="docs-list">'];
        for (var i = 0; i < items.length; i++) {
            if (!items[i]) continue;
            out.push('<li>' + escapeHtml(items[i]) + '</li>');
        }
        out.push('</ul>');
        return out.join('');
    }

    function renderInfoTable(rows) {
        if (!Array.isArray(rows) || !rows.length) return '';
        var out = [
            '<table class="docs-table">',
            '<thead><tr><th>Tunable</th><th>Value</th><th>What It Changes</th></tr></thead>',
            '<tbody>'
        ];
        for (var i = 0; i < rows.length; i++) {
            var row = rows[i] || {};
            out.push('<tr>');
            out.push('<th scope="row"><code>' + escapeHtml(row.label || '--') + '</code></th>');
            out.push('<td>' + escapeHtml(row.value || '--') + '</td>');
            out.push('<td>' + escapeHtml(row.note || '') + '</td>');
            out.push('</tr>');
        }
        out.push('</tbody></table>');
        return out.join('');
    }

    function renderSummaryTable(headers, rows) {
        if (!Array.isArray(headers) || !headers.length || !Array.isArray(rows) || !rows.length) return '';
        var out = ['<table class="docs-table"><thead><tr>'];
        for (var h = 0; h < headers.length; h++) {
            out.push('<th>' + escapeHtml(headers[h]) + '</th>');
        }
        out.push('</tr></thead><tbody>');
        for (var i = 0; i < rows.length; i++) {
            var row = rows[i] || [];
            out.push('<tr>');
            for (var j = 0; j < row.length; j++) {
                out.push('<td>' + row[j] + '</td>');
            }
            out.push('</tr>');
        }
        out.push('</tbody></table>');
        return out.join('');
    }

    function renderControls(groups) {
        var out = [];
        for (var i = 0; i < groups.length; i++) {
            var group = groups[i] || {};
            out.push('<section class="docs-section">');
            out.push('<h3>' + escapeHtml(group.title || '') + '</h3>');
            out.push('<div class="docs-controls-grid">');
            var rows = Array.isArray(group.rows) ? group.rows : [];
            for (var r = 0; r < rows.length; r++) {
                var row = rows[r] || {};
                var keyLabel = String(row.key || '');
                if (!keyLabel && Array.isArray(row.actionIds)) {
                    keyLabel = bindingCombo(row.actionIds, row.fallbackKeys || []);
                } else if (!keyLabel && row.actionId) {
                    keyLabel = inputLabels.getBindingLabel(row.actionId, row.fallbackKey || '--');
                }
                if (row.fixedPrefix) {
                    keyLabel = String(row.fixedPrefix || '') + keyLabel;
                }
                out.push('<div class="docs-control-row">');
                out.push('<span class="docs-kbd">' + escapeHtml(keyLabel || '--') + '</span>');
                out.push('<div class="docs-control-copy">');
                out.push('<span class="docs-control-title">' + escapeHtml(row.title || '') + '</span>');
                out.push('<span class="docs-control-note">' + escapeHtml(row.note || '') + '</span>');
                out.push('</div>');
                out.push('</div>');
            }
            out.push('</div>');
            out.push('</section>');
        }
        return out.join('');
    }

    function renderModeCards(modes) {
        if (!Array.isArray(modes) || !modes.length) return '';
        var out = ['<div class="docs-mode-grid">'];
        for (var i = 0; i < modes.length; i++) {
            var mode = modes[i] || {};
            out.push('<div class="docs-mode-card">');
            out.push('<strong>' + escapeHtml(mode.label || mode.id || '--') + '</strong>');
            out.push('<span>' + escapeHtml(mode.objective || '') + '</span>');
            out.push('<span>' + escapeHtml(mode.note || '') + '</span>');
            out.push('</div>');
        }
        out.push('</div>');
        return out.join('');
    }

    function renderPills(items) {
        if (!Array.isArray(items) || !items.length) return '';
        var out = ['<div class="docs-pill-list">'];
        for (var i = 0; i < items.length; i++) {
            if (!items[i]) continue;
            out.push('<span class="docs-pill">' + escapeHtml(items[i]) + '</span>');
        }
        out.push('</div>');
        return out.join('');
    }

    function weaponFireModelLabel(weapon) {
        if (!weapon) return '--';
        if (weapon.primitiveType === 'hitscan_multi') return formatNumber(weapon.pellets, 0) + '-pellet hitscan burst';
        return 'Single-ray hitscan';
    }

    function weaponReticleLabel(weapon) {
        if (!weapon) return '--';
        if (weapon.id === 'shotgun') return 'Circle reticle';
        return 'Crosshair + bloom';
    }

    function weaponAdsSummary(weapon) {
        if (!weapon) return '--';
        if (weapon.id === 'sniper') return 'Auto-scopes on equip and only fires once the short scope-in finishes';
        return 'Stored scoped numbers still exist in tuning, but live combat stays in the standard over-shoulder view';
    }

    function falloffProfileText(profile) {
        if (!profile || typeof profile !== 'object') return 'No explicit falloff';
        return 'Full damage to ' + formatNumber(profile.start, 0) +
            ' wu, then ' + formatPercentScale(profile.minScalar) +
            ' by ' + (Number(profile.end || 0) >= 9999 ? 'INF' : formatNumber(profile.end, 0) + ' wu');
    }

    function weaponFalloffPills(weapon) {
        if (!weapon || !weapon.falloff || typeof weapon.falloff !== 'object') {
            return renderPills(['No explicit falloff profile']);
        }
        return renderPills([falloffProfileText(weapon.falloff)]);
    }

    function weaponRoleText(weapon) {
        var briefing = weapon && WEAPON_BRIEFINGS[weapon.id] ? WEAPON_BRIEFINGS[weapon.id] : null;
        return briefing ? briefing.niche : 'Balanced fallback weapon.';
    }

    function weaponMechanicsText(weapon) {
        var briefing = weapon && WEAPON_BRIEFINGS[weapon.id] ? WEAPON_BRIEFINGS[weapon.id] : null;
        return briefing ? briefing.mechanics : 'Standard hitscan weapon.';
    }

    function weaponTips(weapon) {
        var briefing = weapon && WEAPON_BRIEFINGS[weapon.id] ? WEAPON_BRIEFINGS[weapon.id] : null;
        return briefing && briefing.tips ? briefing.tips : [];
    }

    function buildWeaponCombatRows(weapon) {
        if (!weapon) return [];
        var rows = [
            {
                label: 'primitiveType',
                value: weapon.primitiveType,
                note: WEAPON_TUNABLE_HELP.primitiveType
            },
            { label: 'automatic', value: formatBool(weapon.automatic), note: WEAPON_TUNABLE_HELP.automatic },
            { label: 'cooldownMs', value: formatMs(weapon.cooldownMs), note: WEAPON_TUNABLE_HELP.cooldownMs },
            { label: 'reloadMs', value: formatMs(weapon.reloadMs), note: WEAPON_TUNABLE_HELP.reloadMs },
            { label: 'magazineSize', value: formatNumber(weapon.magazineSize, 0), note: WEAPON_TUNABLE_HELP.magazineSize },
            { label: 'bodyDamage', value: formatNumber(weapon.bodyDamage, 0), note: WEAPON_TUNABLE_HELP.bodyDamage },
            { label: 'headDamage', value: formatNumber(weapon.headDamage, 0), note: WEAPON_TUNABLE_HELP.headDamage },
            { label: 'pellets', value: formatNumber(weapon.pellets, 0), note: WEAPON_TUNABLE_HELP.pellets },
            { label: 'hipfireSpread', value: formatSpread(weapon.hipfireSpread), note: WEAPON_TUNABLE_HELP.hipfireSpread },
            { label: 'adsSpread', value: formatSpread(weapon.adsSpread), note: WEAPON_TUNABLE_HELP.adsSpread },
            { label: 'maxRange', value: formatRange(weapon.maxRange), note: WEAPON_TUNABLE_HELP.maxRange },
            { label: 'adsMaxRange', value: formatRange(weapon.adsMaxRange), note: WEAPON_TUNABLE_HELP.adsMaxRange },
            { label: 'adsFovDeg', value: formatNumber(weapon.adsFovDeg, 0) + ' deg', note: WEAPON_TUNABLE_HELP.adsFovDeg },
            { label: 'hipfireBloomScale', value: formatNumber(weapon.hipfireBloomScale, 2), note: WEAPON_TUNABLE_HELP.hipfireBloomScale },
            { label: 'adsBloomScale', value: formatNumber(weapon.adsBloomScale, 2), note: WEAPON_TUNABLE_HELP.adsBloomScale }
        ];
        return rows;
    }

    function buildWeaponFeelRows(weapon) {
        if (!weapon) return [];
        var tracer = weapon.presentation && weapon.presentation.tracer ? weapon.presentation.tracer : {};
        var recoil = weapon.presentation && weapon.presentation.recoil ? weapon.presentation.recoil : {};
        var audio = weapon.presentation && weapon.presentation.audioSample ? weapon.presentation.audioSample : null;
        var rows = [
            { label: 'tracer.life', value: formatSeconds(tracer.life), note: WEAPON_TUNABLE_HELP['tracer.life'] },
            { label: 'tracer.speed', value: formatNumber(tracer.speed, 0), note: WEAPON_TUNABLE_HELP['tracer.speed'] },
            { label: 'tracer.segmentLength', value: formatNumber(tracer.segmentLength, 2), note: WEAPON_TUNABLE_HELP['tracer.segmentLength'] },
            { label: 'recoil.z', value: formatNumber(recoil.z, 3), note: WEAPON_TUNABLE_HELP['recoil.z'] },
            { label: 'recoil.x', value: formatNumber(recoil.x, 3), note: WEAPON_TUNABLE_HELP['recoil.x'] },
            { label: 'recoil.pitch', value: formatNumber(recoil.pitch, 3), note: WEAPON_TUNABLE_HELP['recoil.pitch'] },
            { label: 'recoil.yaw', value: formatNumber(recoil.yaw, 3), note: WEAPON_TUNABLE_HELP['recoil.yaw'] },
            { label: 'recoil.roll', value: formatNumber(recoil.roll, 3), note: WEAPON_TUNABLE_HELP['recoil.roll'] },
            { label: 'recoil.armR', value: formatNumber(recoil.armR, 3), note: WEAPON_TUNABLE_HELP['recoil.armR'] },
            { label: 'recoil.armL', value: formatNumber(recoil.armL, 3), note: WEAPON_TUNABLE_HELP['recoil.armL'] },
            { label: 'recoil.muzzleMs', value: formatMs(recoil.muzzleMs), note: WEAPON_TUNABLE_HELP['recoil.muzzleMs'] }
        ];
        if (audio) {
            rows.push({
                label: 'audioSample.gain',
                value: formatNumber(audio.gain, 2),
                note: WEAPON_TUNABLE_HELP['audioSample.gain']
            });
            rows.push({
                label: 'audioSample.playbackRate',
                value: formatNumber(audio.playbackRateMin, 2) + ' -> ' + formatNumber(audio.playbackRateMax, 2),
                note: WEAPON_TUNABLE_HELP['audioSample.playbackRate']
            });
        }
        return rows;
    }

    function throwablePreviewLabel(throwable) {
        if (!throwable) return '--';
        if (throwable.previewType === 'trajectory') return 'Hold ' + inputLabels.getBindingLabel('throwable', 'Q') + ' for arc preview';
        if (throwable.id === 'knife') return 'Instant throw';
        if (throwable.previewType === 'none') return 'Press and release to throw';
        return 'Hold ' + inputLabels.getBindingLabel('throwable', 'Q') + ' for trajectory preview';
    }

    function formatThrowableValue(key, throwable) {
        if (!throwable) return '--';
        var value = throwable[key];
        if (
            key === 'regen' ||
            key === 'fuse' ||
            key === 'maxLife' ||
            key === 'trackDuration' ||
            key === 'fireDuration' ||
            key === 'fireTickRate' ||
            key === 'fireLingerDuration' ||
            key === 'fireLingerTickRate' ||
            key === 'life' ||
            key === 'stickExplodeDelay'
        ) {
            return formatSeconds(value);
        }
        if (key === 'acquireHalfAngleDeg') return formatNumber(value, 0) + ' deg';
        if (
            key === 'speed' || key === 'upward' || key === 'gravity' || key === 'radius' || key === 'fireRadius' ||
            key === 'acquireRange' || key === 'hitRadius' || key === 'catchRadius' || key === 'fireInnerRadius' ||
            key === 'fireMaxHeightDelta'
        ) {
            return formatNumber(value, 2);
        }
        if (typeof value === 'boolean') return formatBool(value);
        return formatNumber(value, 2);
    }

    function buildThrowableRows(throwable) {
        if (!throwable) return [];
        var keys = [];
        for (var key in throwable) {
            if (!hasOwn(throwable, key)) continue;
            if (key === 'id' || key === 'label' || key === 'category') continue;
            keys.push(key);
        }
        var preferredOrder = [
            'speed', 'upward', 'gravity', 'fuse', 'radius', 'damage', 'regen',
            'minBlastDamage',
            'bounce', 'bounceVelocityDamping', 'bounceVerticalDamping', 'bounceMaxCount', 'bounceStopSpeedSq',
            'homingBoost', 'homingLerp', 'acquireRange', 'acquireHalfAngleDeg', 'catchRadius', 'trackDuration', 'trackLerp', 'maxLife', 'stickExplodeDelay',
            'fireRadius', 'fireInnerRadius', 'fireOuterDamageScale', 'fireDuration', 'fireTickDamage', 'fireTickRate',
            'fireLingerDuration', 'fireLingerTickDamage', 'fireLingerTickRate', 'fireMaxHeightDelta',
            'life', 'hitRadius', 'bodyDamage', 'headDamage'
        ];
        var seen = {};
        var rows = [];
        function pushKey(nextKey) {
            if (!nextKey || seen[nextKey] || !hasOwn(throwable, nextKey)) return;
            seen[nextKey] = true;
            rows.push({
                label: nextKey,
                value: formatThrowableValue(nextKey, throwable),
                note: THROWABLE_TUNABLE_HELP[nextKey] || 'Throwable-specific tuning value.'
            });
        }
        for (var i = 0; i < preferredOrder.length; i++) pushKey(preferredOrder[i]);
        for (var n = 0; n < keys.length; n++) pushKey(keys[n]);
        return rows;
    }

    function throwableStats(throwable) {
        if (!throwable) return [];
        var stats = [
            { label: 'Preview', value: throwablePreviewLabel(throwable), note: 'Hold/release behavior on ' + inputLabels.getBindingLabel('throwable', 'Q') + '.' },
            { label: 'Speed', value: formatNumber(throwable.speed, 2), note: 'Initial launch speed.' }
        ];
        if (throwable.fuse != null) stats.push({ label: 'Fuse', value: formatSeconds(throwable.fuse), note: 'Time before detonation.' });
        if (throwable.damage != null) stats.push({ label: 'Damage', value: formatNumber(throwable.damage, 0), note: 'Peak blast damage.' });
        if (throwable.minBlastDamage != null) stats.push({ label: 'Min Blast', value: formatNumber(throwable.minBlastDamage, 0), note: 'Damage floor after radial falloff.' });
        if (throwable.radius != null) stats.push({ label: 'Radius', value: formatNumber(throwable.radius, 2), note: 'Explosion radius.' });
        if (throwable.maxLife != null) stats.push({ label: 'Max Life', value: formatSeconds(throwable.maxLife), note: 'Hard lifetime cap for the projectile.' });
        if (throwable.catchRadius != null) stats.push({ label: 'Catch Radius', value: formatNumber(throwable.catchRadius, 2), note: 'World-space latch/catch distance.' });
        if (throwable.trackDuration != null) stats.push({ label: 'Track Window', value: formatSeconds(throwable.trackDuration), note: 'How long steering stays active after acquire.' });
        if (throwable.fireRadius != null) stats.push({ label: 'Fire Radius', value: formatNumber(throwable.fireRadius, 2), note: 'Area denial radius.' });
        if (throwable.fireDuration != null) stats.push({ label: 'Fire Duration', value: formatSeconds(throwable.fireDuration), note: 'Lifetime of the denial patch.' });
        if (throwable.fireLingerDuration != null) stats.push({ label: 'Linger', value: formatSeconds(throwable.fireLingerDuration), note: 'How long the burn persists after exiting.' });
        if (throwable.bodyDamage != null) stats.push({ label: 'Body Damage', value: formatNumber(throwable.bodyDamage, 0), note: 'Direct hit body damage.' });
        if (throwable.headDamage != null) stats.push({ label: 'Head Damage', value: formatNumber(throwable.headDamage, 0), note: 'Direct hit head damage.' });
        if (throwable.regen != null) stats.push({ label: 'Recharge', value: formatSeconds(throwable.regen), note: 'Time for a spent charge to return.' });
        return stats;
    }

    function buildHomePage(data) {
        var systems = systemsSnapshot();
        var survivability = systems.survivability || {};
        var combatTimings = systems.combatTimings || {};
        var totalDurability = totalDurabilityValue(systems);
        var loadout = data.loadout || {};
        return [
            '<div class="docs-page">',
            '<section class="docs-hero">',
            '<div class="docs-eyebrow">Open Field Manual</div>',
            '<h2>How The Current Build Actually Plays</h2>',
            '<p>This build is built around movement, weapon swaps, throwables, and picking the right distance before you commit. Standard guns stay in the over-shoulder view, sniper auto-scopes, and most kills come from good positioning and clean follow-up timing.</p>',
            renderTagRow([
                formatNumber(totalDurability, 0) + ' total durability',
                formatSecondsFromMs(combatTimings.PLAYER_SPAWN_SHIELD_MS || 0) + ' spawn shield',
                formatSecondsFromMs(combatTimings.RESPAWN_DELAY_MS || 0) + ' respawn',
                data.weapons.length + ' weapons'
            ]),
            '</section>',
            '<div class="docs-grid">',
            '<section class="docs-card">',
            '<h3>Quick Start</h3>',
            renderList([
                'Choose a mode, then use ENTER MATCH or RESUME MATCH to capture the mouse.',
                'Move with ' + bindingCombo(['move_forward', 'move_left', 'move_backward', 'move_right'], ['W', 'A', 'S', 'D']) + ', sprint with ' + inputLabels.getBindingLabel('sprint', 'Shift') + ', jump with ' + inputLabels.getBindingLabel('jump', 'Space') + ', and swap weapons with the wheel or your slot keys.',
                'Fire on LMB, reload on ' + inputLabels.getBindingLabel('reload', 'R') + ', and swap weapons on ' + bindingCombo(['weapon_slot_1', 'weapon_slot_2'], ['1', '2']) + ' or the mouse wheel.',
                'Use ' + inputLabels.getBindingLabel('throwable', 'Q') + ' for the current throwable and ' + inputLabels.getBindingLabel('roll', 'E') + ' to roll in your movement direction.',
                'Desktop auto fire on a red reticle can be toggled with ' + inputLabels.getBindingLabel('toggle_auto_fire', 'G') + '.',
                'Standard guns do not manually scope in the current build. Sniper auto-scopes when you equip it, and weapons now refill automatically when you stop firing long enough.'
            ]),
            '</section>',
            '<section class="docs-card">',
            '<h3>Core Match Rules</h3>',
            renderStatGrid([
                { label: 'Health / Armor', value: formatNumber(survivability.hpMax, 0) + ' / ' + formatNumber(survivability.armorMax, 0), note: 'Fresh fighters start at ' + formatNumber(totalDurability, 0) + ' combined durability.' },
                { label: 'Armor Regen', value: formatSeconds(survivability.armorRegenDelaySec) + ' delay', note: formatNumber(survivability.armorRegenPerSec, 0) + ' armor per second once the timer expires.' },
                { label: 'FFA Lives', value: '3 start / 5 max', note: 'You can earn up to 2 bonus lives by dealing damage.' },
                { label: 'Bonus Life Meter', value: '400 damage = 1 life', note: 'Every 40 damage gives 1% of the next extra life.' },
                { label: 'Spawn Shield', value: formatSecondsFromMs(combatTimings.PLAYER_SPAWN_SHIELD_MS || 0), note: 'Fresh spawns ignore damage during this window.' },
                { label: 'Respawn', value: formatSecondsFromMs(combatTimings.RESPAWN_DELAY_MS || 0), note: 'You come back only if you still have lives left.' }
            ]),
            '</section>',
            '</div>',
            '<div class="docs-grid">',
            '<section class="docs-card">',
            '<h3>Current Kit</h3>',
            renderStatGrid([
                { label: 'Slot 1', value: loadout.slot1Weapon || 'Unassigned', note: 'Swap with key ' + inputLabels.getBindingLabel('weapon_slot_1', '1') + '.' },
                { label: 'Slot 2', value: loadout.slot2Weapon || 'Unassigned', note: 'Swap with key ' + inputLabels.getBindingLabel('weapon_slot_2', '2') + '.' },
                { label: inputLabels.getBindingLabel('throwable', 'Q') + ' Throwable', value: loadout.throwable || 'Unassigned', note: 'Hold ' + inputLabels.getBindingLabel('throwable', 'Q') + ' for preview if supported.' }
            ]),
            '</section>',
            '<section class="docs-card">',
            '<h3>Fight Flow</h3>',
            renderList([
                'Open with the gun that owns the current distance. Machine gun and rifle usually start the conversation; shotgun and pistol usually finish it.',
                'Rolls are strongest for breaking a peek, dodging a punish, or stealing the last few steps into shotgun range.',
                'Throwables are at their best when they force movement or cash in on damage you already landed.',
                'Break line of sight during long cooldowns instead of taking low-odds re-peeks.'
            ]),
            '</section>',
            '</div>',
            '<section class="docs-section">',
            '<h3>Mode Objectives</h3>',
            renderModeCards(data.modes),
            '</section>',
            '</div>'
        ].join('');
    }

    function buildControlsPage() {
        var systems = systemsSnapshot();
        var movement = systems.movement || {};
        var survivability = systems.survivability || {};
        var combatTimings = systems.combatTimings || {};
        return [
            '<div class="docs-page">',
            '<section class="docs-hero">',
            '<div class="docs-eyebrow">Controls</div>',
            '<h2>Movement, Weapons, Throwables, Session Flow</h2>',
            '<p>This page is about what your buttons really do in the current build. The game expects pointer lock, layered inputs, and fast transitions between moving, shooting, and repositioning instead of one system at a time.</p>',
            renderTagRow([
                bindingCombo(['move_forward', 'move_left', 'move_backward', 'move_right'], ['W', 'A', 'S', 'D']),
                bindingCombo(['weapon_slot_1', 'weapon_slot_2'], ['1', '2']) + ' or wheel',
                inputLabels.getBindingLabel('throwable', 'Q') + ' / ' + inputLabels.getBindingLabel('roll', 'E'),
                inputLabels.getBindingLabel('toggle_auto_fire', 'G') + ' auto fire'
            ]),
            '</section>',
            renderControls(CONTROL_GROUPS),
            renderControls([{ title: 'Fixed Controls', rows: fixedControlRows() }]),
            '<section class="docs-section">',
            '<h3>Movement Rules</h3>',
            renderStatGrid([
                { label: 'Jog / Sprint', value: formatWuPerSecond(movement.jogSpeed) + ' / ' + formatWuPerSecond(movement.runSpeed), note: 'Base speed before weapon modifiers.' },
                { label: 'Jump Hold', value: formatSeconds(movement.maxJumpHold), note: 'Tap for a short hop, hold up to this long for full height.' },
                { label: 'Roll Timing', value: '0.36 s / 0.52 s', note: 'Forward or side roll / backward-only roll.' },
                { label: 'Roll Profile', value: 'Lower + smaller', note: 'The head hitbox disappears and the body/collision profile shrinks during the roll.' },
                { label: 'Armor Reset', value: formatSeconds(survivability.armorRegenDelaySec), note: 'After this delay, armor comes back at ' + formatNumber(survivability.armorRegenPerSec, 0) + ' per second.' },
                { label: 'Spawn Shield', value: formatSecondsFromMs(combatTimings.PLAYER_SPAWN_SHIELD_MS || 0), note: 'Fresh spawns are protected for this long.' }
            ]),
            '</section>',
            '<section class="docs-section">',
            '<h3>Important Notes</h3>',
            renderList([
                'Roll only starts when you are grounded and already holding a direction. No standing roll, no air roll.',
                'The roll keeps its opening direction until it ends, ignores new movement and jump presses until you release them, and you do not fire during it.',
                'Sniper auto-scopes when you equip it, cannot fire until the quick scope-in finishes, and is forced into slot 2 by the loadout rules.',
                'The bindings menu still shows ADS inputs, but in the current build only sniper uses a live scoped view.',
                'Desktop red-reticle auto fire defaults off and can be toggled with ' + inputLabels.getBindingLabel('toggle_auto_fire', 'G') + '.',
                inputLabels.getBindingLabel('throwable', 'Q') + ' previews frag and molotov on hold, while plasma and knife are immediate no-preview throws.',
                'Phone uses auto reload only. Desktop can still press ' + inputLabels.getBindingLabel('reload', 'R') + ' to start reloading early before the automatic refill delay ends.',
                'The field manual is available in menu and in live gameplay on ' + inputLabels.getBindingLabel('open_manual', 'I') + '.'
            ]),
            '</section>',
            '</div>'
        ].join('');
    }

    function buildWeaponPage(data) {
        var totalDurability = totalDurabilityValue(systemsSnapshot());
        var weapon = findById(data.weapons, state.selectedWeaponId);
        if (!weapon) {
            return '<div class="docs-page"><section class="docs-hero"><h2>Weapon data unavailable</h2></section></div>';
        }
        return [
            '<div class="docs-page">',
            '<section class="docs-hero">',
            '<div class="docs-eyebrow">Weapon Profile</div>',
            '<h2>' + escapeHtml(weapon.name) + '</h2>',
            '<p>' + escapeHtml(weaponRoleText(weapon)) + '</p>',
            renderTagRow([
                weaponFireModelLabel(weapon),
                weapon.automatic ? 'automatic' : 'semi-auto',
                weaponBestRangeLabel(weapon),
                formatPercentScale(weaponStatsMoveSpeedMultiplier(weapon)) + ' move speed'
            ]),
            '</section>',
            '<div class="docs-weapon-layout">',
            '<section class="docs-section">',
            '<h3>How To Use It</h3>',
            renderList([
                weaponMechanicsText(weapon),
                'Best range: ' + weaponBestRangeLabel(weapon) + '.',
                'Reticle style: ' + weaponReticleLabel(weapon) + '.',
                'View behavior: ' + weaponAdsSummary(weapon) + '.',
                'Fire cadence: ' + formatMs(weapon.cooldownMs) + ' per shot (' + formatRate(weapon.cooldownMs) + ').'
            ].concat(weaponTips(weapon))),
            '<div class="docs-divider"></div>',
            '<h3>Falloff Profile</h3>',
            weaponFalloffPills(weapon),
            '</section>',
            '<pre class="docs-weapon-art">' + escapeHtml(WEAPON_ART[weapon.id] || '[No ASCII profile]') + '</pre>',
            '</div>',
            '<section class="docs-section">',
            '<h3>Live Quick Stats</h3>',
            renderStatGrid(weaponQuickStats(weapon, totalDurability)),
            '</section>',
            '<section class="docs-section">',
            '<h3>Raw Numbers</h3>',
            renderInfoTable(buildWeaponCombatRows(weapon)),
            '</section>',
            '</div>'
        ].join('');
    }

    function buildThrowablesPage(data) {
        var throwable = findById(data.throwables, state.selectedThrowableId);
        if (!throwable) {
            return '<div class="docs-page"><section class="docs-hero"><h2>Throwable data unavailable</h2></section></div>';
        }
        var briefing = THROWABLE_BRIEFINGS[throwable.id] || { useCase: '', mechanics: '', tips: [] };
        return [
            '<div class="docs-page">',
            '<section class="docs-hero">',
            '<div class="docs-eyebrow">Throwable Profile</div>',
            '<h2>' + escapeHtml(throwable.label || throwable.id) + '</h2>',
            '<p>' + escapeHtml(briefing.useCase || 'Throwable profile.') + '</p>',
            renderTagRow([
                throwable.category || 'utility',
                throwablePreviewLabel(throwable),
                throwable.regen != null ? ('recharge ' + formatSeconds(throwable.regen)) : ''
            ]),
            '</section>',
            '<div class="docs-grid">',
            '<section class="docs-card">',
            '<h3>How It Works</h3>',
            renderList([
                briefing.mechanics || 'Throwable profile.',
                'Throw input is on ' + inputLabels.getBindingLabel('throwable', 'Q') + '. Preview behavior depends on the selected item.'
            ].concat(briefing.tips || [])),
            '</section>',
            '<section class="docs-card">',
            '<h3>Live Throwable Values</h3>',
            renderStatGrid(throwableStats(throwable)),
            '</section>',
            '</div>',
            '<section class="docs-section">',
            '<h3>Tunables</h3>',
            renderInfoTable(buildThrowableRows(throwable)),
            '</section>',
            '</div>'
        ].join('');
    }

    function buildTunablesPage(data) {
        var systems = systemsSnapshot();
        var totalDurability = totalDurabilityValue(systems);
        var summaryRows = [];
        for (var i = 0; i < data.weapons.length; i++) {
            var weapon = data.weapons[i];
            summaryRows.push([
                '<strong>' + escapeHtml(weapon.name) + '</strong>',
                escapeHtml(weaponRoleText(weapon)),
                escapeHtml(weaponDamageValue(weapon)),
                escapeHtml(weaponFreshDownValue(weapon, totalDurability)),
                escapeHtml(formatRate(weapon.cooldownMs) + ' | ' + formatNumber(weapon.magazineSize, 0) + ' / ' + formatSecondsFromMs(weapon.reloadMs)),
                escapeHtml(formatSpread(weapon.hipfireSpread) + ' / ' + formatSpread(weapon.adsSpread)),
                escapeHtml(falloffProfileText(weapon.falloff))
            ]);
        }

        return [
            '<div class="docs-page">',
            '<section class="docs-hero">',
            '<div class="docs-eyebrow">Combat Math</div>',
            '<h2>Damage, Spread, Range, Survivability</h2>',
            '<p>This page compares the live numbers side by side. Treat them as current-build reference, not as promises of perfect time-to-kill in a real fight.</p>',
            renderTagRow(['live tuning', formatNumber(totalDurability, 0) + ' durability baseline', 'current build reference']),
            '</section>',
            '<div class="docs-grid">',
            '<section class="docs-card">',
            '<h3>How To Read The Numbers</h3>',
            renderList([
                'Damage numbers are base values before distance falloff.',
                'Fresh Down counts assume a fresh ' + formatNumber(totalDurability, 0) + '-durability target and good point-blank hits.',
                'Spread is the real shot cone, not just cosmetic bloom.',
                'Only sniper uses a live scoped view right now. Other guns keep their over-shoulder crosshair even though scoped numbers still exist in tuning.',
                'World units (wu) are the game’s distance scale. The falloff line tells you where damage starts dropping and where it bottoms out.'
            ]),
            '</section>',
            '<section class="docs-card">',
            '<h3>Baseline Systems</h3>',
            renderStatGrid([
                { label: 'Durability', value: formatNumber(totalDurability, 0), note: '400 health + 100 armor on a fresh spawn.' },
                { label: 'Armor Regen', value: formatSeconds(systems.survivability.armorRegenDelaySec) + ' delay', note: formatNumber(systems.survivability.armorRegenPerSec, 0) + ' armor per second after the delay.' },
                { label: 'FFA Lives', value: '3 start / 5 max', note: 'Up to 2 bonus lives from damage dealt.' },
                { label: 'Spawn Shield', value: formatSecondsFromMs(systems.combatTimings.PLAYER_SPAWN_SHIELD_MS || 0), note: 'New spawns ignore damage during this window.' }
            ]),
            '</section>',
            '</div>',
            '<section class="docs-section">',
            '<h3>Live Cross-Weapon Snapshot</h3>',
            renderSummaryTable(
                ['Weapon', 'Role', 'Damage', 'Fresh Down', 'Rate | Mag / Reload', 'Spread H / S', 'Falloff'],
                summaryRows
            ),
            '</section>',
            '<section class="docs-section">',
            '<h3>Plain-English Reference</h3>',
            renderInfoTable([
                { label: 'Damage', value: 'base hit value', note: 'The number before falloff starts lowering it.' },
                { label: 'Fresh Down', value: 'approx trigger pulls', note: 'Point-blank estimate against a fresh ' + formatNumber(totalDurability, 0) + '-durability target.' },
                { label: 'Spread', value: 'shot cone width', note: 'Lower numbers are tighter and more reliable at range.' },
                { label: 'Falloff', value: 'damage band', note: 'Full damage to the first distance, then reduced damage by the second.' },
                { label: 'Magazine / Reload', value: 'commit window', note: 'How much damage you can push before a forced disengage.' },
                { label: 'Move Speed', value: 'weapon mobility', note: 'Relative speed modifier applied to the base jog and sprint.' }
            ]),
            '</section>',
            '</div>'
        ].join('');
    }

    function buildContent(pageId, data) {
        switch (pageId) {
            case 'controls':
                return buildControlsPage();
            case 'weapons':
                return buildWeaponPage(data);
            case 'throwables':
                return buildThrowablesPage(data);
            case 'tunables':
                return buildTunablesPage(data);
            default:
                return buildHomePage(data);
        }
    }

    function getSubItems(pageId, data) {
        var out = [];
        var list = [];
        if (pageId === 'weapons') list = data.weapons;
        else if (pageId === 'throwables') list = data.throwables;
        for (var i = 0; i < list.length; i++) {
            if (!list[i] || !list[i].id) continue;
            out.push({
                id: list[i].id,
                label: String(list[i].name || list[i].label || list[i].id || '').toUpperCase()
            });
        }
        return out;
    }

    function getSelectedSubId(pageId) {
        if (pageId === 'weapons') return state.selectedWeaponId;
        if (pageId === 'throwables') return state.selectedThrowableId;
        return '';
    }

    function setSelectedSubId(pageId, id) {
        if (pageId === 'weapons') state.selectedWeaponId = id;
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
        if (state.activePage === 'weapons' || state.activePage === 'throwables') {
            hintEl.textContent = 'Left rail picks a profile. Descriptions and values are pulled from the current live build data.';
            return;
        }
        if (state.activePage === 'tunables') {
            hintEl.textContent = 'Use this page to compare the current live numbers side by side, then drill into a specific profile.';
            return;
        }
        hintEl.textContent = 'Press ' + inputLabels.getBindingLabel('open_manual', 'I') + ' to open or close the field manual at any time.';
    }

    function render() {
        if (!contentEl) return;
        var data = getData();
        ensureSelections(data);
        renderNav();
        renderSubnav(data);
        renderHint();
        if (titleEl) {
            titleEl.textContent = 'PvP :: FIELD MANUAL :: ' + getPageLabel(state.activePage);
        }
        contentEl.innerHTML = buildContent(state.activePage, data);
    }

    function openPanel(triggerEl) {
        if (!panelEl) return;
        if (document.pointerLockElement && document.exitPointerLock) {
            document.exitPointerLock();
        }
        if (runtime.GameModalManager && runtime.GameModalManager.open) {
            runtime.GameModalManager.open('docs', triggerEl || pauseOpenBtnEl || hudOpenBtnEl || document.activeElement || null);
        } else {
            panelEl.hidden = false;
            panelEl.setAttribute('aria-hidden', 'false');
        }
        GameDocs.refresh();
    }

    function closePanel() {
        if (!panelEl) return;
        if (runtime.GameModalManager && runtime.GameModalManager.close) {
            runtime.GameModalManager.close('docs');
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

        if (runtime.GameModalManager && runtime.GameModalManager.register) {
            var utilityToggleBtn = document.getElementById('utility-toggle-btn');
            runtime.GameModalManager.register('docs', {
                element: panelEl,
                initialFocus: closeBtnEl || panelEl,
                restoreFocus: utilityToggleBtn || pauseOpenBtnEl || hudOpenBtnEl || null
            });
        }
        if (!panelEl.__docsBindingsSubscribed && runtime.GameInputBindings && runtime.GameInputBindings.subscribe) {
            panelEl.__docsBindingsSubscribed = true;
            runtime.GameInputBindings.subscribe(function () {
                GameDocs.refresh();
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
        if (GameDocs.isOpen()) closePanel();
        else openPanel();
    };

    GameDocs.isOpen = function () {
        if (runtime.GameModalManager && runtime.GameModalManager.isOpen) {
            return runtime.GameModalManager.isOpen('docs');
        }
        return !!panelEl && !panelEl.hidden;
    };

    GameDocs._test = {
        getData: getData,
        setState: function (patch) {
            patch = patch || {};
            if (patch.activePage) state.activePage = String(patch.activePage);
            if (patch.selectedWeaponId) state.selectedWeaponId = String(patch.selectedWeaponId);
            if (patch.selectedThrowableId) state.selectedThrowableId = String(patch.selectedThrowableId);
        },
        buildContent: function (pageId) {
            var data = getData();
            ensureSelections(data);
            state.activePage = String(pageId || state.activePage || 'home');
            return buildContent(state.activePage, data);
        },
        weaponFireModelLabel: weaponFireModelLabel,
        buildWeaponCombatRows: buildWeaponCombatRows,
        buildWeaponFeelRows: buildWeaponFeelRows
    };

    runtime.GameDocs = GameDocs;
})();
