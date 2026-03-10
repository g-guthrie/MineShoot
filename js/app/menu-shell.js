/**
 * menu-shell.js - Menu-only bootstrap and lazy runtime bridge.
 */
(function () {
    'use strict';

    var runtime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    var menuBootReleased = false;

    function releaseMenuBoot() {
        if (menuBootReleased) return;
        menuBootReleased = true;
        if (document.body) {
            document.body.classList.remove('menu-booting');
        }
    }

    function scheduleMenuBootRelease() {
        function releaseAfterPaint() {
            if (typeof window.requestAnimationFrame === 'function') {
                window.requestAnimationFrame(function () {
                    window.requestAnimationFrame(releaseMenuBoot);
                });
                return;
            }
            releaseMenuBoot();
        }

        var fallbackTimer = window.setTimeout(releaseAfterPaint, 700);
        if (!document.fonts || !document.fonts.ready || typeof document.fonts.ready.then !== 'function') {
            return;
        }
        document.fonts.ready
            .then(function () {
                window.clearTimeout(fallbackTimer);
                releaseAfterPaint();
            })
            .catch(function () {
                window.clearTimeout(fallbackTimer);
                releaseAfterPaint();
            });
    }

    function applyBrandingOverrides() {
        document.title = 'Mayhem';
        var overlayTitle = document.querySelector('#overlay h1');
        if (overlayTitle) overlayTitle.textContent = 'MAYHEM';
        var docsTitle = document.getElementById('docs-title');
        if (docsTitle && /minecraft fps/i.test(docsTitle.textContent || '')) {
            docsTitle.textContent = String(docsTitle.textContent).replace(/minecraft fps/ig, 'MAYHEM');
        }
    }

    function roomCodeFromRoomId(roomId) {
        var helper = runtime.GameShared && runtime.GameShared.privateRoomCodes;
        if (helper && helper.privateRoomCodeFromId) {
            return helper.privateRoomCodeFromId(roomId);
        }
        return String(roomId || '').toUpperCase();
    }

    function isShareCodeRoomId(roomId) {
        return String(roomId || '').toLowerCase().indexOf('private-') === 0;
    }

    function runtimeRoomLabel(mode) {
        if (!mode || !mode.roomId) return '';
        var prefix = mode.gameMode ? String(mode.gameMode).toUpperCase() + ' ' : '';
        if (mode.id === 'single_cloudflare' && isShareCodeRoomId(mode.roomId)) {
            return prefix + 'CODE ' + roomCodeFromRoomId(mode.roomId);
        }
        return prefix + 'ROOM ' + String(mode.roomId).toUpperCase();
    }

    function setRuntimeIndicator(mode) {
        var el = document.getElementById('runtime-indicator');
        if (!el) return;
        if (!mode) {
            el.textContent = 'PROFILE :: STANDBY';
            return;
        }
        var parts = [
            String(mode.label || '').toUpperCase(),
            String(mode.backendLabel || '').toUpperCase()
        ];
        if (mode.roomId) {
            parts.push(runtimeRoomLabel(mode));
        }
        el.textContent = 'PROFILE :: ' + parts.join(' :: ');
    }

    function currentGameplayActivityState() {
        if (runtime.GameMain && runtime.GameMain.getActivityState) {
            return runtime.GameMain.getActivityState();
        }
        return 'menu';
    }

    function bindDocsControls() {
        var pauseOpenBtnEl = document.getElementById('open-manual-btn');
        var hudOpenBtnEl = document.getElementById('hud-manual-btn');

        function editableTarget(target) {
            var node = target || null;
            var tagName = node && node.tagName ? String(node.tagName).toUpperCase() : '';
            if (node && node.isContentEditable) return true;
            return tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT';
        }

        function openDocs(event) {
            if (event) {
                event.preventDefault();
                event.stopPropagation();
            }
            if (!runtime.GameRuntimeLoader || !runtime.GameRuntimeLoader.toggleDocs) return;
            runtime.GameRuntimeLoader.toggleDocs(event && event.currentTarget ? event.currentTarget : null);
        }

        if (pauseOpenBtnEl && !pauseOpenBtnEl.__docsBound) {
            pauseOpenBtnEl.__docsBound = true;
            pauseOpenBtnEl.addEventListener('click', openDocs);
        }

        if (hudOpenBtnEl && !hudOpenBtnEl.__docsBound) {
            hudOpenBtnEl.__docsBound = true;
            hudOpenBtnEl.addEventListener('click', openDocs);
        }

        if (!window.__mayhemDocsKeyBound) {
            window.__mayhemDocsKeyBound = true;
            document.addEventListener('keydown', function (event) {
                if (event.code !== 'KeyI') return;
                if (editableTarget(event.target)) return;
                openDocs(event);
            });
        }
    }

    function prepareMenuUi() {
        applyBrandingOverrides();
        setRuntimeIndicator(null);
        if (runtime.GameMenuLoadout && runtime.GameMenuLoadout.init) {
            runtime.GameMenuLoadout.init();
        }
        if (runtime.GameNetAuth && runtime.GameNetAuth.initMenuAuth) {
            runtime.GameNetAuth.initMenuAuth();
        }
        bindDocsControls();
    }

    function launchModeById(modeId, options) {
        options = options || {};
        if (runtime.GameMain && runtime.GameMain.launchModeById) {
            return runtime.GameMain.launchModeById(modeId, options);
        }
        if (!runtime.GameRuntimeLoader || !runtime.GameRuntimeLoader.loadGameplayRuntime) {
            return Promise.resolve({ ok: false, error: 'Gameplay runtime loader unavailable.' });
        }
        return runtime.GameRuntimeLoader.loadGameplayRuntime().then(function (gameMain) {
            if (!gameMain || !gameMain.launchModeById) {
                return { ok: false, error: 'Gameplay launcher unavailable.' };
            }
            return gameMain.launchModeById(modeId, options);
        }).catch(function (err) {
            return {
                ok: false,
                error: (err && err.message) ? err.message : 'Gameplay runtime failed to load.'
            };
        });
    }

    function boot() {
        scheduleMenuBootRelease();

        if (runtime.GameLobbyController && runtime.GameLobbyController.init) {
            runtime.GameLobbyController.init({
                prepareMenu: prepareMenuUi,
                setRuntimeIndicator: setRuntimeIndicator,
                launchModeById: launchModeById,
                getActivityState: currentGameplayActivityState
            });
            return;
        }

        prepareMenuUi();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
