(function () {
    'use strict';

    var runtime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    var demonicRuntime = globalThis.__DEMONIC_RUNTIME = globalThis.__DEMONIC_RUNTIME || {};
    var shellState = {
        runtimeModeId: '',
        gameModeId: ''
    };

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function buttonMarkup(kind, item, activeId) {
        var isActive = String(item && item.id || '') === String(activeId || '');
        return '' +
            '<button class="demonic-select-btn' + (isActive ? ' active' : '') + '" type="button" ' +
                'data-role="' + kind + '" data-id="' + escapeHtml(item && item.id) + '">' +
                '<span class="demonic-select-kicker">' + escapeHtml(item && (item.shortLabel || item.id || 'MODE')) + '</span>' +
                '<strong>' + escapeHtml(item && (item.label || item.menuButtonLabel || item.id)) + '</strong>' +
            '</button>';
    }

    function workstreamMarkup(item) {
        return '' +
            '<article class="demonic-work-card">' +
                '<div class="demonic-work-id">' + escapeHtml(item.id) + '</div>' +
                '<h3>' + escapeHtml(item.title) + '</h3>' +
                '<p>' + escapeHtml(item.summary) + '</p>' +
            '</article>';
    }

    function subsystemMarkup(title, ascii, copy) {
        return '' +
            '<article class="demonic-subsystem-card">' +
                '<h3>' + escapeHtml(title) + '</h3>' +
                '<pre>' + escapeHtml(ascii) + '</pre>' +
                '<p>' + escapeHtml(copy) + '</p>' +
            '</article>';
    }

    function buildModel() {
        var menuModel = demonicRuntime.MenuModel || null;
        var built = menuModel && typeof menuModel.build === 'function'
            ? menuModel.build({
                runtimeProfile: runtime.GameRuntimeProfile || null,
                shared: runtime.GameShared || {},
                modeRegistry: demonicRuntime.ModeRegistry || null,
                workstreams: demonicRuntime.Workstreams && Array.isArray(demonicRuntime.Workstreams.items)
                    ? demonicRuntime.Workstreams.items
                    : [],
                selectedRuntimeModeId: shellState.runtimeModeId,
                selectedGameModeId: shellState.gameModeId
            })
            : null;

        if (built) {
            shellState.runtimeModeId = built.selectedRuntimeModeId;
            shellState.gameModeId = built.selectedGameModeId;
        }

        return built || {
            runtimeModes: [],
            gameModes: [],
            sandboxModes: [],
            workstreams: [],
            selectedRuntimeModeId: '',
            selectedGameModeId: '',
            selectedRuntimeMode: null,
            selectedGameMode: null,
            supportsSandbox: false,
            launchSummary: {
                runtimeLabel: 'No runtime mode',
                gameLabel: 'No game mode',
                authorityLabel: 'unknown',
                backendLabel: 'unknown',
                note: 'Demonic menu model unavailable.'
            }
        };
    }

    function render() {
        document.body.classList.add('app-demonic');

        var root = document.getElementById('demonic-root');
        if (!root) return;
        root.hidden = false;

        var model = buildModel();
        root.innerHTML = '' +
            '<main class="demonic-shell">' +
                '<section class="demonic-hero">' +
                    '<div class="demonic-kicker">PARALLEL REBUILD :: DEMONIC</div>' +
                    '<div class="demonic-hero-grid">' +
                        '<div class="demonic-hero-copy">' +
                            '<pre class="demonic-logo"> ____  _____ __  __  ___  _   _ ___ ____\n|  _ \\| ____|  \\/  |/ _ \\| \\ | |_ _/ ___|\n| | | |  _| | |\\/| | | | |  \\| || | |    \n| |_| | |___| |  | | |_| | |\\  || | |___ \n|____/|_____|_|  |_|\\___/|_| \\_|___\\____|</pre>' +
                            '<p class="demonic-tagline">Demonic is now a real sibling menu path, driven by the same shared registries Mayhem uses for modes and rulesets.</p>' +
                            '<div class="demonic-action-row">' +
                                '<a class="demonic-action demonic-action-primary" href="/">RETURN TO MAYHEM</a>' +
                                '<a class="demonic-action" href="/docs/demonic-master-plan.md">OPEN MASTER PLAN</a>' +
                            '</div>' +
                        '</div>' +
                        '<aside class="demonic-status-panel">' +
                            '<div class="demonic-status-title">Build State</div>' +
                            '<div class="demonic-status-item"><span>Shell</span><strong>ONLINE</strong></div>' +
                            '<div class="demonic-status-item"><span>Menu</span><strong>ACTIVE</strong></div>' +
                            '<div class="demonic-status-item"><span>Gameplay Runtime</span><strong>PENDING</strong></div>' +
                            '<div class="demonic-status-item"><span>Parity Harness</span><strong>QUEUED</strong></div>' +
                        '</aside>' +
                    '</div>' +
                '</section>' +
                '<section class="demonic-section">' +
                    '<div class="demonic-section-head">' +
                        '<h2>Launch Matrix</h2>' +
                        '<p>These selections are registry-driven. As shared mode catalogs grow, Demonic will inherit the surface automatically.</p>' +
                    '</div>' +
                    '<div class="demonic-launch-grid">' +
                        '<article class="demonic-panel">' +
                            '<h3>Runtime Mode</h3>' +
                            '<div class="demonic-select-grid">' + model.runtimeModes.map(function (mode) {
                                return buttonMarkup('runtime-mode', mode, model.selectedRuntimeModeId);
                            }).join('') + '</div>' +
                        '</article>' +
                        '<article class="demonic-panel">' +
                            '<h3>Game Mode</h3>' +
                            '<div class="demonic-select-grid">' + model.gameModes.map(function (mode) {
                                return buttonMarkup('game-mode', mode, model.selectedGameModeId);
                            }).join('') + '</div>' +
                            '<div class="demonic-sandbox-note">' +
                                (model.supportsSandbox
                                    ? 'Sandbox-ready ruleset: ' + escapeHtml(model.selectedGameMode && model.selectedGameMode.shortLabel || '')
                                    : 'Selected ruleset is not sandbox-capable.') +
                            '</div>' +
                        '</article>' +
                        '<article class="demonic-panel demonic-summary-panel">' +
                            '<h3>Launch Summary</h3>' +
                            '<pre>runtime -> ruleset -> match runtime\n   ' +
                                escapeHtml(model.launchSummary.runtimeLabel) + ' -> ' +
                                escapeHtml(model.launchSummary.gameLabel) + '\n\nauthority :: ' +
                                escapeHtml(model.launchSummary.authorityLabel) + '\nbackend   :: ' +
                                escapeHtml(model.launchSummary.backendLabel) + '</pre>' +
                            '<p>' + escapeHtml(model.launchSummary.note) + '</p>' +
                            '<button class="demonic-action demonic-action-disabled" type="button" disabled>DEMONIC GAMEPLAY RUNTIME PENDING</button>' +
                        '</article>' +
                    '</div>' +
                '</section>' +
                '<section class="demonic-section">' +
                    '<div class="demonic-section-head">' +
                        '<h2>Subsystem Map</h2>' +
                        '<p>The shell is now focused on launch structure, while the rebuild itself stays split into explicit subsystem lanes.</p>' +
                    '</div>' +
                    '<div class="demonic-subsystem-grid">' +
                        subsystemMarkup('App Shell', '+boot+ -> +menu+ -> +runtime+', 'Parallel entrypoint, app routing, and Demonic-specific navigation.') +
                        subsystemMarkup('Gameplay Core', 'input -> player -> combat -> abilities', 'Parity-safe ownership for movement, weapons, ammo, and ability rules.') +
                        subsystemMarkup('Presentation', 'actor -> rig -> weapon builder -> fx', 'Weapon-first firearm presentation and premium-ready modular weapon assembly.') +
                        subsystemMarkup('World + Net', 'biomes -> colliders -> sync -> remote view', 'World assembly and multiplayer sync remain isolated from menu and presentation.') +
                    '</div>' +
                '</section>' +
                '<section class="demonic-section">' +
                    '<div class="demonic-section-head">' +
                        '<h2>12-Agent Split</h2>' +
                        '<p>These lanes are ready for parallel assignment once the Demonic menu and runtime skeleton are fully in place.</p>' +
                    '</div>' +
                    '<div class="demonic-work-grid">' + model.workstreams.map(workstreamMarkup).join('') + '</div>' +
                '</section>' +
            '</main>';

        if (!root.__demonicBound) {
            root.__demonicBound = true;
            root.addEventListener('click', function (event) {
                var target = event.target;
                while (target && target !== root) {
                    if (target.dataset && target.dataset.role === 'runtime-mode') {
                        shellState.runtimeModeId = String(target.dataset.id || '');
                        render();
                        return;
                    }
                    if (target.dataset && target.dataset.role === 'game-mode') {
                        shellState.gameModeId = String(target.dataset.id || '');
                        render();
                        return;
                    }
                    target = target.parentNode;
                }
            });
        }
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
