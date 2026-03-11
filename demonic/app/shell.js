(function () {
    'use strict';

    var runtime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    var demonicRuntime = globalThis.__DEMONIC_RUNTIME = globalThis.__DEMONIC_RUNTIME || {};

    function modeMarkup(mode) {
        var badges = [];
        badges.push(mode.authorityMode === 'offline' ? 'OFFLINE' : 'NETWORKED');
        badges.push(mode.backendLabel || mode.backendKind || 'UNKNOWN');
        if (mode.supportsSandbox) badges.push('SANDBOX');

        return '' +
            '<article class="demonic-mode-card">' +
                '<div class="demonic-mode-head">' +
                    '<span class="demonic-mode-id">' + mode.id + '</span>' +
                    '<span class="demonic-mode-room">' + mode.roomStrategy.toUpperCase() + '</span>' +
                '</div>' +
                '<h3>' + mode.label + '</h3>' +
                '<div class="demonic-mode-badges">' + badges.map(function (badge) {
                    return '<span>' + badge + '</span>';
                }).join('') + '</div>' +
            '</article>';
    }

    function workstreamMarkup(item) {
        return '' +
            '<article class="demonic-work-card">' +
                '<div class="demonic-work-id">' + item.id + '</div>' +
                '<h3>' + item.title + '</h3>' +
                '<p>' + item.summary + '</p>' +
            '</article>';
    }

    function subsystemMarkup(title, ascii, copy) {
        return '' +
            '<article class="demonic-subsystem-card">' +
                '<h3>' + title + '</h3>' +
                '<pre>' + ascii + '</pre>' +
                '<p>' + copy + '</p>' +
            '</article>';
    }

    function buildShellModel() {
        var modeApi = demonicRuntime.ModeRegistry || null;
        var modes = modeApi && modeApi.getRuntimeModes
            ? modeApi.getRuntimeModes(runtime.GameRuntimeProfile || null)
            : [];
        var workstreams = demonicRuntime.Workstreams && Array.isArray(demonicRuntime.Workstreams.items)
            ? demonicRuntime.Workstreams.items
            : [];

        return {
            modes: modes,
            workstreams: workstreams,
            subsystems: [
                {
                    title: 'App Shell',
                    ascii: '+boot+ -> +menu+ -> +runtime+',
                    copy: 'Parallel Demonic entrypoint, brand shell, and runtime routing live here.'
                },
                {
                    title: 'Gameplay Core',
                    ascii: 'input -> player -> combat -> abilities',
                    copy: 'Movement, hitscan, ammo, ability logic, and parity-safe rule ownership.'
                },
                {
                    title: 'Presentation',
                    ascii: 'actor -> rig -> weapon builder -> fx',
                    copy: 'Weapon-first firearm presentation and premium-ready modular weapon assembly.'
                },
                {
                    title: 'World + Net',
                    ascii: 'biomes -> colliders -> sync -> remote view',
                    copy: 'World assembly, network sync, and remote actor presentation stay independent.'
                }
            ]
        };
    }

    function render() {
        document.body.classList.add('app-demonic');

        var root = document.getElementById('demonic-root');
        if (!root) return;
        root.hidden = false;

        var model = buildShellModel();
        root.innerHTML = '' +
            '<main class="demonic-shell">' +
                '<section class="demonic-hero">' +
                    '<div class="demonic-kicker">PARALLEL REBUILD :: DEMONIC</div>' +
                    '<div class="demonic-hero-grid">' +
                        '<div class="demonic-hero-copy">' +
                            '<pre class="demonic-logo"> ____  _____ __  __  ___  _   _ ___ ____\n|  _ \\| ____|  \\/  |/ _ \\| \\ | |_ _/ ___|\n| | | |  _| | |\\/| | | | |  \\| || | |    \n| |_| | |___| |  | | |_| | |\\  || | |___ \n|____/|_____|_|  |_|\\___/|_| \\_|___\\____|</pre>' +
                            '<p class="demonic-tagline">Copy the current game, keep the feel, rebuild the internals, and leave Mayhem untouched.</p>' +
                            '<div class="demonic-action-row">' +
                                '<a class="demonic-action demonic-action-primary" href="/">RETURN TO MAYHEM</a>' +
                                '<a class="demonic-action" href="/docs/demonic-master-plan.md">OPEN MASTER PLAN</a>' +
                            '</div>' +
                        '</div>' +
                        '<aside class="demonic-status-panel">' +
                            '<div class="demonic-status-title">Build State</div>' +
                            '<div class="demonic-status-item"><span>Shell</span><strong>ONLINE</strong></div>' +
                            '<div class="demonic-status-item"><span>Menu</span><strong>SCAFFOLDED</strong></div>' +
                            '<div class="demonic-status-item"><span>Gameplay</span><strong>Pending</strong></div>' +
                            '<div class="demonic-status-item"><span>Parity Harness</span><strong>Queued</strong></div>' +
                        '</aside>' +
                    '</div>' +
                '</section>' +
                '<section class="demonic-section">' +
                    '<div class="demonic-section-head">' +
                        '<h2>Runtime Modes</h2>' +
                        '<p>Demonic inherits the current runtime surface first so sandbox and dev flows remain available.</p>' +
                    '</div>' +
                    '<div class="demonic-mode-grid">' + model.modes.map(modeMarkup).join('') + '</div>' +
                '</section>' +
                '<section class="demonic-section">' +
                    '<div class="demonic-section-head">' +
                        '<h2>Subsystem Map</h2>' +
                        '<p>Each major system gets its own boundary so the rewrite can be split safely across parallel workstreams.</p>' +
                    '</div>' +
                    '<div class="demonic-subsystem-grid">' + model.subsystems.map(function (item) {
                        return subsystemMarkup(item.title, item.ascii, item.copy);
                    }).join('') + '</div>' +
                '</section>' +
                '<section class="demonic-section">' +
                    '<div class="demonic-section-head">' +
                        '<h2>12-Agent Split</h2>' +
                        '<p>Workstreams are defined up front so parallel implementation stays coherent instead of branching into separate games.</p>' +
                    '</div>' +
                    '<div class="demonic-work-grid">' + model.workstreams.map(workstreamMarkup).join('') + '</div>' +
                '</section>' +
            '</main>';
    }

    demonicRuntime.DemonicShell = {
        render: render
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', render);
    } else {
        render();
    }
})();
