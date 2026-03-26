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
        selectedAbilityId: '',
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
        { id: 'abilities', label: 'ABILITIES' },
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
            niche: 'Full-auto generalist. High fire rate, large magazine, reliable at mid range.',
            mechanics: 'Automatic hitscan. Forgiving magazine size with moderate spread in the default third-person view.',
            tips: [
                'Lead with this to strip armor, then weapon-swap to finish.',
                'Best at mid range. Spread widens at distance.'
            ]
        },
        shotgun: {
            niche: 'Close-range burst. Devastating up close, drops off fast with distance.',
            mechanics: 'Fires multiple pellets per shot. All pellets can connect, so positioning is everything.',
            tips: [
                'Close the gap before firing. Use movement abilities or corners to get in range.',
                'Strong for punishing pushes and finishing cracked targets.'
            ]
        },
        rifle: {
            niche: 'Precision semi-auto. Rewards accuracy with high headshot damage.',
            mechanics: 'Single-shot hitscan. Clean, stable precision in the standard third-person view.',
            tips: [
                'Take deliberate shots. Spam-firing wastes the precision advantage.',
                'Headshot multiplier is high. Use it for measured lane control and punish shots.'
            ]
        },
        pistol: {
            niche: 'Quick-draw hand cannon. Fast swap speed with chunky one-shot damage.',
            mechanics: 'Single-shot hitscan. Uses the same spread-driven one-ray shot model as the other standard guns.',
            tips: [
                'Swap to this after landing damage with your primary.',
                'It hits hard, but the wide spread means you still need to respect distance.'
            ]
        },
        sniper: {
            niche: 'Long-range precision punish. Auto-scopes when you equip it.',
            mechanics: 'Single-shot hitscan. Equipping sniper starts a fast scope-in and the weapon cannot fire until that scope-in finishes.',
            tips: [
                'Hold angles and take your shot. Reposition after firing.',
                'Keep sniper in slot 2 so your match start always opens on a normal third-person gun.'
            ]
        }
    };

    var ABILITY_BRIEFINGS = {
        choke: {
            useCase: 'Locks down a single target. Lifts and stuns them in place.',
            mechanics: 'Targets an enemy on screen, then suspends them mid-air. They cannot move or shoot while held.',
            tips: [
                'Use on enemies committed to a push or holding a doorway.',
                'Follow up with a shotgun or rifle for a free kill while they are stunned.'
            ]
        },
        hook: {
            useCase: 'Pulls an enemy to close range on demand.',
            mechanics: 'Fires a hook at your crosshair. If it connects, the target is yanked to point-blank distance.',
            tips: [
                'Hook into shotgun or machinegun follow-up for a fast kill.',
                'Punishes players who rely on keeping distance.'
            ]
        },
        missile: {
            useCase: 'Tracking rocket. Curves toward nearby enemies.',
            mechanics: 'Fires a small guided projectile that bends toward hostile targets.',
            tips: [
                'Fire when the target is already moving or low health for the best tracking value.',
                'Short cooldown. Use it as part of your regular damage rotation.'
            ]
        },
        deadeye: {
            useCase: 'Multi-target burst. Locks onto visible enemies and deals damage to all of them.',
            mechanics: 'Scans a wide area, stores target locks, then cashes them out as burst damage.',
            tips: [
                'Position to see multiple targets before activating.',
                'Save it for multi-locks. Single target locks waste the ability.'
            ]
        }
    };

    var THROWABLE_BRIEFINGS = {
        frag: {
            useCase: 'Standard frag grenade. Area damage with bounce physics.',
            mechanics: 'Hold to preview the trajectory arc, release to throw. Bounces off surfaces before detonating.',
            tips: [
                'Aim where the enemy will be, not where they are.',
                'Bounce off walls to reach targets behind cover.'
            ]
        },
        plasma: {
            useCase: 'Tracking grenade. Locks onto nearby targets and sticks before detonating.',
            mechanics: 'Hold to aim, release to throw. Acquires enemies in a cone and sticks on contact.',
            tips: [
                'Effective against enemies holding a single piece of cover.',
                'Slower travel speed. Throw early and let the tracking work.'
            ]
        },
        molotov: {
            useCase: 'Area denial. Creates a damage zone on the ground.',
            mechanics: 'Lands and creates a burning area. Enemies inside take damage over time.',
            tips: [
                'Block doorways, chokepoints, and retreat paths.',
                'Forces enemies to reposition or take sustained damage.'
            ]
        },
        knife: {
            useCase: 'Instant throw. No arc preview, fast travel, headshot refill.',
            mechanics: 'Fires instantly on press. Direct damage on hit. Headshot kills refill throwable charges.',
            tips: [
                'Use as a fast finisher on low-health targets.',
                'Headshot refill rewards accuracy and keeps your throwables cycling.'
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

    var ABILITY_TUNABLE_HELP = {
        range: 'Maximum reach in world units.',
        cooldownMs: 'Cooldown before the same slot can be fired again.',
        duration: 'How long the effect or lock window lasts.',
        lockBoxPx: 'On-screen lock box width used for box-based acquisition.',
        targetTolerance: 'Target leniency during choke validation.',
        liftHeight: 'Vertical lift applied during choke.',
        tickRate: 'DOT or repeated effect cadence.',
        dotPerTick: 'Damage per DOT tick when present.',
        reticleRadiusPx: 'On-screen radius used by the hook targeting helper.',
        catchRadius: 'World-space radius used to catch or latch a target.',
        travelSpeed: 'Travel speed for the hook or projectile-like effect.',
        pullSpeed: 'How quickly a hooked target is reeled toward the user.',
        pullDistance: 'How close hook leaves the pulled target.',
        castDamage: 'Immediate impact damage on cast.',
        stunDuration: 'How long the victim stays disrupted after the hit.',
        damage: 'Direct damage of the cast.',
        radius: 'Explosion or hit radius.',
        acquireRange: 'Homing seek range after launch.',
        lockHalfAngleDeg: 'Half-angle of the seek cone in degrees.',
        homingBoost: 'How aggressively the projectile gains steering force.',
        homingLerp: 'How quickly the projectile direction bends toward the lock.',
        minDot: 'Forward alignment requirement for lock-based abilities.',
        maxTargets: 'Maximum simultaneous deadeye locks.'
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
                { actionIds: ['move_forward', 'move_left', 'move_backward', 'move_right'], fallbackKeys: ['W', 'A', 'S', 'D'], title: 'Move', note: 'Strafe constantly. Standing still is how every weapon starts feeling overpowered.' },
                { actionId: 'sprint', fallbackKey: 'Shift', title: 'Sprint', note: 'Use sprint to break line of sight and reposition between fights.' },
                { actionId: 'jump', fallbackKey: 'Space', title: 'Variable Jump', note: 'Tap for a short hop, hold for the full jump arc.' },
                { actionId: 'roll', fallbackKey: 'E', title: 'Roll', note: 'Triggers the running roll in your current movement direction.' }
            ]
        },
        {
            title: 'Combat',
            rows: [
                { actionId: 'reload', fallbackKey: 'R', title: 'Reload', note: 'Manual reload starts immediately. Empty magazines still auto-reload.' },
                { actionIds: ['weapon_slot_1', 'weapon_slot_2'], fallbackKeys: ['1', '2'], title: 'Weapon Slots', note: 'These map to your two menu loadout slots.' },
                { actionId: 'throwable', fallbackKey: 'Q', title: 'Throwable', note: 'Grenades preview on hold and throw on release. Knife fires immediately.' },
                { actionId: 'ability_1', fallbackKey: 'G', title: 'Ability', note: 'Fires your equipped ability from the loadout menu.' }
            ]
        },
        {
            title: 'Session',
            rows: [
                { key: 'Menu', title: 'Capture Cursor', note: 'Use ENTER MATCH or RESUME MATCH from the menu flow to start aiming again.' },
                { actionId: 'open_manual', fallbackKey: 'I', title: 'Field Manual', note: 'Opens and closes this manual from both menu and gameplay.' },
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

    function buildAbilityData(abilityId, shared) {
        var def = shared.abilityCatalog && shared.abilityCatalog[abilityId];
        if (!def) return null;
        var out = { id: abilityId };
        for (var key in def) {
            if (hasOwn(def, key)) out[key] = def[key];
        }
        return out;
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
            var objective = 'Outlast the room. Start with three lives and earn up to two more by dealing damage.';
            var note = 'Stay active, build your next-life meter, and be the last player not eliminated.';
            if (mode.id === 'tdm') {
                objective = 'First team to ' + formatNumber(matchRules.tdmTargetProgress || 10, 0) + ' kills.';
                note = 'Trade space for crossfires. Individual peeks matter less than team timing.';
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
            ability: '',
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
        var abilityLoadout = menuLoadout && menuLoadout.selectedAbilityId
            ? { abilityId: menuLoadout.selectedAbilityId }
            : (runtime.GameAbilities && runtime.GameAbilities.getLoadout
                ? runtime.GameAbilities.getLoadout()
                : {});
        var throwableId = menuLoadout && menuLoadout.selectedThrowableId
            ? menuLoadout.selectedThrowableId
            : (runtime.GameThrowables && runtime.GameThrowables.getSelectedThrowable
                ? runtime.GameThrowables.getSelectedThrowable()
                : '');
        var weapon1 = findById(data.weapons, String(weaponSlots[0] || ''));
        var weapon2 = findById(data.weapons, String(weaponSlots[1] || ''));
        var ability = findById(data.abilities, String(abilityLoadout && abilityLoadout.abilityId || ''));
        var throwable = findById(data.throwables, String(throwableId || ''));
        summary.slot1Weapon = weapon1 ? weapon1.name : 'Unassigned';
        summary.slot2Weapon = weapon2 ? weapon2.name : 'Unassigned';
        summary.ability = ability ? ability.name : 'Unassigned';
        summary.throwable = throwable ? (throwable.label || throwable.name || throwable.id) : 'Unassigned';
        return summary;
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

        var abilities = [];
        var abilityCatalog = shared.abilityCatalog || {};
        for (var abilityId in abilityCatalog) {
            if (!hasOwn(abilityCatalog, abilityId)) continue;
            var ability = buildAbilityData(abilityId, shared);
            if (ability) abilities.push(ability);
        }

        var throwables = [];
        var throwableOrder = safeArray(shared.throwables && shared.throwables.order);
        for (var t = 0; t < throwableOrder.length; t++) {
            var throwable = buildThrowableData(String(throwableOrder[t] || ''), shared);
            if (throwable) throwables.push(throwable);
        }

        var data = {
            weapons: weapons,
            abilities: abilities,
            throwables: throwables,
            modes: buildModeSummaries()
        };
        data.loadout = loadoutSummary(data);
        return data;
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
        if (weapon.primitiveType === 'hitscan_multi') return 'Multi-pellet spread';
        return 'Single-ray hitscan';
    }

    function weaponReticleLabel(weapon) {
        if (!weapon) return '--';
        if (weapon.id === 'shotgun') return 'Circle reticle';
        return 'Crosshair + bloom';
    }

    function weaponAdsSummary(weapon) {
        if (!weapon) return '--';
        if (weapon.id === 'sniper') return 'Auto-scopes on equip and becomes ready when the short scope-in finishes';
        return 'No manual ADS. This weapon stays in the standard third-person firing view';
    }

    function falloffProfileText(profile) {
        if (!profile || typeof profile !== 'object') return 'No explicit falloff';
        return 'Full to ' + formatNumber(profile.start, 0) +
            ' wu :: floor ' + formatPercentScale(profile.minScalar) +
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

    function abilityRoleLabel(ability) {
        if (!ability) return '--';
        if (ability.slot === 'ability') return 'Pressure tool';
        return 'Flex tool';
    }

    function formatAbilityValue(key, ability) {
        if (!ability) return '--';
        var value = ability[key];
        if (key === 'cooldownMs') return formatMs(value);
        if (key === 'duration' || key === 'tickRate') return formatSeconds(value);
        if (key === 'range' || key === 'pullDistance' || key === 'radius' || key === 'acquireRange' || key === 'catchRadius' || key === 'liftHeight') {
            return formatRange(value);
        }
        if (key === 'lockHalfAngleDeg') return formatNumber(value, 0) + ' deg';
        return formatNumber(value, 2);
    }

    function buildAbilityRows(ability) {
        if (!ability) return [];
        var params = Array.isArray(ability.tunableParams) ? ability.tunableParams : [];
        var rows = [];
        for (var i = 0; i < params.length; i++) {
            var key = String(params[i] || '');
            rows.push({
                label: key,
                value: formatAbilityValue(key, ability),
                note: ABILITY_TUNABLE_HELP[key] || 'Ability-specific tuning value.'
            });
        }
        if (!params.length && ability.cooldownMs != null) {
            rows.push({
                label: 'cooldownMs',
                value: formatMs(ability.cooldownMs),
                note: ABILITY_TUNABLE_HELP.cooldownMs
            });
        }
        return rows;
    }

    function abilityStats(ability) {
        if (!ability) return [];
        var stats = [
            { label: 'Role', value: abilityRoleLabel(ability), note: 'Design intent, not a hard menu lock.' },
            { label: 'Cooldown', value: formatMs(ability.cooldownMs), note: 'Per equipped slot.' }
        ];
        if (ability.range != null) stats.push({ label: 'Range', value: formatRange(ability.range), note: 'Effective cast reach.' });
        if (ability.duration != null) stats.push({ label: 'Duration', value: formatSeconds(ability.duration), note: 'Active effect window.' });
        if (ability.damage != null) stats.push({ label: 'Damage', value: formatNumber(ability.damage, 0), note: 'Direct impact damage.' });
        if (ability.maxTargets != null) stats.push({ label: 'Targets', value: formatNumber(ability.maxTargets, 0), note: 'Maximum stored locks.' });
        return stats;
    }

    function throwablePreviewLabel(throwable) {
        if (!throwable) return '--';
        if (throwable.id === 'knife') return 'Instant throw';
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
        var loadout = data.loadout || {};
        return [
            '<div class="docs-page">',
            '<section class="docs-hero">',
            '<div class="docs-eyebrow">Open Field Manual</div>',
            '<h2>Get Into The Match Fast</h2>',
            '<p>Pick a two-weapon kit, lock the cursor, stay moving, and treat abilities and throwables as extensions of your gunfight instead of separate mini-games.</p>',
            renderTagRow([
                data.weapons.length + ' weapons',
                data.abilities.length + ' abilities',
                data.throwables.length + ' throwables',
                inputLabels.getBindingLabel('reload', 'R') + ' reload'
            ]),
            '</section>',
            '<div class="docs-grid">',
            '<section class="docs-card">',
            '<h3>Quick Start</h3>',
            renderList([
                'Choose a mode, then use ENTER MATCH or RESUME MATCH to capture pointer lock.',
                'Move with ' + bindingCombo(['move_forward', 'move_left', 'move_backward', 'move_right'], ['W', 'A', 'S', 'D']) + ', sprint with ' + inputLabels.getBindingLabel('sprint', 'Shift') + ', jump with ' + inputLabels.getBindingLabel('jump', 'Space') + ', and swap weapons with the wheel or your slot keys.',
                'Fire on LMB, reload on ' + inputLabels.getBindingLabel('reload', 'R') + ', and swap weapons on ' + bindingCombo(['weapon_slot_1', 'weapon_slot_2'], ['1', '2']) + ' or the mouse wheel.',
                'Use ' + inputLabels.getBindingLabel('throwable', 'Q') + ' for the current throwable, ' + inputLabels.getBindingLabel('roll', 'E') + ' to roll in your movement direction, and ' + inputLabels.getBindingLabel('ability_1', 'G') + ' for your equipped ability.',
                'Break line of sight during long cooldowns instead of forcing low-odds trades.'
            ]),
            '</section>',
            '<section class="docs-card">',
            '<h3>Current Kit</h3>',
            renderStatGrid([
                { label: 'Slot 1', value: loadout.slot1Weapon || 'Unassigned', note: 'Swap with key ' + inputLabels.getBindingLabel('weapon_slot_1', '1') + '.' },
                { label: 'Slot 2', value: loadout.slot2Weapon || 'Unassigned', note: 'Swap with key ' + inputLabels.getBindingLabel('weapon_slot_2', '2') + '.' },
                { label: inputLabels.getBindingLabel('throwable', 'Q') + ' Throwable', value: loadout.throwable || 'Unassigned', note: 'Hold ' + inputLabels.getBindingLabel('throwable', 'Q') + ' for preview if supported.' },
                { label: inputLabels.getBindingLabel('ability_1', 'G') + ' Ability', value: loadout.ability || 'Unassigned', note: 'Your equipped ability.' }
            ]),
            '</section>',
            '</div>',
            '<section class="docs-section">',
            '<h3>How Fights Actually Work</h3>',
            '<div class="docs-callout">Open with a weapon that owns the current distance, then chain your utility into the follow-up. Machine gun or rifle starts, shotgun or pistol confirms, missile or choke seals the mistake.</div>',
            '</section>',
            '<section class="docs-section">',
            '<h3>Mode Objectives</h3>',
            renderModeCards(data.modes),
            '</section>',
            '</div>'
        ].join('');
    }

    function buildControlsPage() {
        return [
            '<div class="docs-page">',
            '<section class="docs-hero">',
            '<div class="docs-eyebrow">Controls</div>',
            '<h2>Movement, Weapons, Abilities, Session Flow</h2>',
            '<p>The game only really feels correct once pointer lock is active. Enter the match, capture the cursor, and keep your inputs layered instead of playing one system at a time.</p>',
            renderTagRow([
                bindingCombo(['move_forward', 'move_left', 'move_backward', 'move_right'], ['W', 'A', 'S', 'D']),
                inputLabels.getBindingLabel('reload', 'R') + ' reload',
                bindingCombo(['weapon_slot_1', 'weapon_slot_2'], ['1', '2']) + ' or wheel',
                inputLabels.getBindingLabel('throwable', 'Q') + ' / ' + inputLabels.getBindingLabel('roll', 'E') + ' / ' + inputLabels.getBindingLabel('ability_1', 'G')
            ]),
            '</section>',
            renderControls(CONTROL_GROUPS),
            renderControls([{ title: 'Fixed Controls', rows: fixedControlRows() }]),
            '<section class="docs-section">',
            '<h3>Important Notes</h3>',
            renderList([
                'Sniper auto-scopes when you equip it and cannot fire until the quick scope-in finishes.',
                inputLabels.getBindingLabel('throwable', 'Q') + ' previews grenades on hold, but knife throws immediately on press.',
                inputLabels.getBindingLabel('reload', 'R') + ' forces a reload early, and empty magazines still auto-reload if you forget.',
                'Keep sniper in slot 2 so match start and respawn always open on your normal third-person primary.',
                'The field manual is available in menu and in live gameplay on ' + inputLabels.getBindingLabel('open_manual', 'I') + '.'
            ]),
            '</section>',
            '</div>'
        ].join('');
    }

    function buildWeaponPage(data) {
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
                weaponReticleLabel(weapon),
                formatRate(weapon.cooldownMs)
            ]),
            '</section>',
            '<div class="docs-weapon-layout">',
            '<section class="docs-section">',
            '<h3>How It Works</h3>',
            renderList([
                weaponMechanicsText(weapon),
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
            '<h3>Live Combat Values</h3>',
            renderStatGrid([
                { label: 'Body / Head', value: formatNumber(weapon.bodyDamage, 0) + ' / ' + formatNumber(weapon.headDamage, 0), note: 'Base damage before falloff.' },
                { label: 'Magazine', value: formatNumber(weapon.magazineSize, 0), note: 'Rounds before you need to reload.' },
                { label: 'Reload', value: formatMs(weapon.reloadMs), note: 'Forced downtime once a reload begins.' },
                { label: 'Cadence', value: formatRate(weapon.cooldownMs), note: formatMs(weapon.cooldownMs) + ' between shots.' },
                { label: 'Pellets', value: formatNumber(weapon.pellets, 0), note: weapon.pellets > 1 ? 'All pellets may connect.' : 'One spread-driven hitscan ray per shot.' },
                { label: 'Spread H / S', value: formatSpread(weapon.hipfireSpread) + ' / ' + formatSpread(weapon.adsSpread), note: 'Stored hipfire versus scoped tuning values.' },
                { label: 'Range H / S', value: formatRange(weapon.maxRange) + ' / ' + formatRange(weapon.adsMaxRange), note: 'Stored hipfire versus scoped range caps.' },
                { label: 'Scoped FOV', value: formatNumber(weapon.adsFovDeg, 0) + ' deg', note: 'Lower is more zoom when a weapon enters scoped view.' }
            ]),
            '</section>',
            '<section class="docs-section">',
            '<h3>Combat Tunables</h3>',
            renderInfoTable(buildWeaponCombatRows(weapon)),
            '</section>',
            '<section class="docs-section">',
            '<h3>Feel Tunables</h3>',
            renderInfoTable(buildWeaponFeelRows(weapon)),
            '</section>',
            '</div>'
        ].join('');
    }

    function buildAbilityPage(data) {
        var ability = findById(data.abilities, state.selectedAbilityId);
        if (!ability) {
            return '<div class="docs-page"><section class="docs-hero"><h2>Ability data unavailable</h2></section></div>';
        }
        var briefing = ABILITY_BRIEFINGS[ability.id] || { useCase: '', mechanics: '', tips: [] };
        return [
            '<div class="docs-page">',
            '<section class="docs-hero">',
            '<div class="docs-eyebrow">Ability Profile</div>',
            '<h2>' + escapeHtml(ability.name || ability.id) + '</h2>',
            '<p>' + escapeHtml(briefing.useCase || ability.description || 'Ability profile.') + '</p>',
            renderTagRow([abilityRoleLabel(ability), formatMs(ability.cooldownMs), ability.slot || 'flex']),
            '</section>',
            '<div class="docs-grid">',
            '<section class="docs-card">',
            '<h3>Mechanics</h3>',
            renderList([
                briefing.mechanics || ability.description || 'No mechanics note.',
                'Menu binding: fire this ability on ' + inputLabels.getBindingLabel('ability_1', 'G') + '.',
                ability.debugSummary || 'No extra debug summary.'
            ].concat(briefing.tips || [])),
            '</section>',
            '<section class="docs-card">',
            '<h3>Live Ability Values</h3>',
            renderStatGrid(abilityStats(ability)),
            '</section>',
            '</div>',
            '<section class="docs-section">',
            '<h3>Tunables</h3>',
            renderInfoTable(buildAbilityRows(ability)),
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
            renderTagRow([throwable.category || 'utility', throwablePreviewLabel(throwable)]),
            '</section>',
            '<div class="docs-grid">',
            '<section class="docs-card">',
            '<h3>Mechanics</h3>',
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
        var summaryRows = [];
        for (var i = 0; i < data.weapons.length; i++) {
            var weapon = data.weapons[i];
            summaryRows.push([
                '<strong>' + escapeHtml(weapon.name) + '</strong>',
                escapeHtml(weaponFireModelLabel(weapon)),
                escapeHtml(formatMs(weapon.cooldownMs) + ' | mag ' + formatNumber(weapon.magazineSize, 0)),
                escapeHtml(formatSpread(weapon.hipfireSpread) + ' / ' + formatSpread(weapon.adsSpread)),
                escapeHtml(formatRange(weapon.maxRange) + ' / ' + formatRange(weapon.adsMaxRange)),
                escapeHtml(weapon.pellets > 1 ? 'all pellets count' : 'single ray')
            ]);
        }

        return [
            '<div class="docs-page">',
            '<section class="docs-hero">',
            '<div class="docs-eyebrow">Tunables</div>',
            '<h2>What The Weapon Numbers Actually Mean</h2>',
            '<p>The important split is combat tuning versus feel tuning. Combat tuning decides damage, reach, spread, cadence, and solver behavior. Feel tuning decides how readable the weapon is to your hands and eyes.</p>',
            renderTagRow(['combat tuning', 'feel tuning', 'shared gameplay source']),
            '</section>',
            '<div class="docs-grid">',
            '<section class="docs-card">',
            '<h3>' + escapeHtml(TUNABLE_GROUPS[0].title) + '</h3>',
            '<div class="docs-callout">Pistol now uses the same single-ray hitscan path as the other standard guns. Shotgun remains the dedicated multi-pellet edge case.</div>',
            renderList([
                'Single-ray weapons: rifle, machine gun, pistol, sniper.',
                'True multi-pellet weapon: shotgun.'
            ]),
            '</section>',
            '<section class="docs-card">',
            '<h3>' + escapeHtml(TUNABLE_GROUPS[1].title) + '</h3>',
            renderList([
                'Higher fire rate is lower `cooldownMs`.',
                'Magazine and reload decide how greedy you can be before a forced disengage.',
                'Automatic reload on empty means low mag weapons feel sharper than the raw damage numbers suggest.'
            ]),
            '</section>',
            '<section class="docs-card">',
            '<h3>' + escapeHtml(TUNABLE_GROUPS[2].title) + '</h3>',
            renderList([
                'Spread is solver input, not cosmetic bloom.',
                'Scoped tuning values still exist in the data, but only sniper uses a live scope transition right now.',
                'Pistol now uses the same spread-driven ray logic as the other standard guns.',
                'Falloff bands scale final damage by distance instead of hard dropping to zero.'
            ]),
            '</section>',
            '<section class="docs-card">',
            '<h3>' + escapeHtml(TUNABLE_GROUPS[3].title) + '</h3>',
            renderList([
                'Tracer and recoil values shape feedback and readability.',
                'These do not directly change damage output, but they absolutely change how controllable a gun feels.',
                'Audio playback variation keeps repeated fire from sounding flat and repetitive.'
            ]),
            '</section>',
            '</div>',
            '<section class="docs-section">',
            '<h3>Live Cross-Weapon Snapshot</h3>',
            renderSummaryTable(
                ['Weapon', 'Fire Model', 'Cadence / Mag', 'Spread H / A', 'Range H / A', 'Special'],
                summaryRows
            ),
            '</section>',
            '<section class="docs-section">',
            '<h3>Reference</h3>',
            renderInfoTable([
                { label: 'primitiveType', value: 'single or multi', note: WEAPON_TUNABLE_HELP.primitiveType },
                { label: 'cooldownMs', value: 'shot cadence', note: WEAPON_TUNABLE_HELP.cooldownMs },
                { label: 'reloadMs', value: 'downtime', note: WEAPON_TUNABLE_HELP.reloadMs },
                { label: 'hipfireSpread / adsSpread', value: 'legacy angular compatibility', note: WEAPON_TUNABLE_HELP.hipfireSpread + ' ' + WEAPON_TUNABLE_HELP.adsSpread },
                { label: 'maxRange / adsMaxRange', value: 'distance caps', note: WEAPON_TUNABLE_HELP.maxRange + ' ' + WEAPON_TUNABLE_HELP.adsMaxRange },
                { label: 'tracer.* / recoil.*', value: 'feel layer', note: 'These are shared feel knobs layered on top of combat behavior.' }
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
            case 'abilities':
                return buildAbilityPage(data);
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
        else if (pageId === 'abilities') list = data.abilities;
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
        if (state.activePage === 'weapons' || state.activePage === 'abilities' || state.activePage === 'throwables') {
            hintEl.textContent = 'Left rail picks a profile. Values and descriptions are pulled from current shared tuning.';
            return;
        }
        if (state.activePage === 'tunables') {
            hintEl.textContent = 'Use this page as the glossary, then drill into a specific weapon profile for live values and role notes.';
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
            if (patch.selectedAbilityId) state.selectedAbilityId = String(patch.selectedAbilityId);
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
