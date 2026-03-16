/**
 * runtime-mode-ui.js - Shared runtime mode labels and indicator text.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameRuntimeModeUi
 */
(function () {
    'use strict';

    var runtime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    var GameRuntimeModeUi = {};

    function roomCodeFromRoomId(roomId) {
        var shared = runtime.GameShared || {};
        var helper = shared.privateRoomCodes;
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

    function runtimeIndicatorText(mode, debugActive) {
        if (!mode) {
            return debugActive ? 'DEBUG MODE :: PRESS H TO SWITCH' : 'PROFILE :: STANDBY';
        }
        if (debugActive) return 'DEBUG MODE :: PRESS H TO SWITCH';
        var parts = [
            String(mode.label || '').toUpperCase(),
            String(mode.backendLabel || '').toUpperCase()
        ];
        if (mode.roomId) {
            parts.push(runtimeRoomLabel(mode));
        }
        return 'PROFILE :: ' + parts.join(' :: ');
    }

    function setRuntimeIndicator(mode, options) {
        var el = document.getElementById('runtime-indicator');
        if (!el) return;
        options = options || {};
        el.classList.toggle('debug-active', !!options.debugActive);
        el.textContent = runtimeIndicatorText(mode, !!options.debugActive);
    }

    function startupSubtitleForMode(mode) {
        if (!mode) return 'Select runtime mode';
        if (mode.id === 'cloud_multiplayer') {
            if (mode.roomId === 'global') return 'Connecting to Public Lobby: ' + mode.roomId + '...';
            if (String(mode.gameMode || 'ffa').toLowerCase() === 'tdm') {
                return 'Connecting to Team Deathmatch: ' + mode.roomId + '...';
            }
            if (String(mode.gameMode || 'ffa').toLowerCase() === 'lms') {
                return 'Connecting to Last Man Standing: ' + mode.roomId + '...';
            }
            return 'Connecting to Free For All: ' + mode.roomId + '...';
        }
        if (mode.id === 'single_cloudflare') {
            return 'Connecting to Private Cloudflare room: ' + mode.roomId + '...';
        }
        if (mode.id === 'single_dev_server') {
            return 'Connecting to Local Multiplayer: ' + mode.roomId + '...';
        }
        return String(mode.gameMode || 'ffa').toLowerCase() === 'lms'
            ? 'Starting Offline Sandbox: LMS...'
            : 'Starting Offline Sandbox: FFA...';
    }

    function startupNoticeForMode(mode) {
        if (!mode) return '';
        if (mode.id === 'cloud_multiplayer') {
            if (mode.roomId === 'global') {
                return 'Public Lobby: shared room ' + mode.roomId + '.';
            }
            if (String(mode.gameMode || 'ffa').toLowerCase() === 'tdm') {
                return 'Team Deathmatch joined room ' + mode.roomId + '.';
            }
            if (String(mode.gameMode || 'ffa').toLowerCase() === 'lms') {
                return 'Last Man Standing joined room ' + mode.roomId + '.';
            }
            return 'Free For All joined room ' + mode.roomId + '.';
        }
        if (mode.id === 'single_cloudflare') {
            if (isShareCodeRoomId(mode.roomId)) {
                return 'Private room code ' + roomCodeFromRoomId(mode.roomId) + '.';
            }
            return 'Private Cloudflare room ' + mode.roomId + '.';
        }
        if (mode.id === 'single_dev_server') {
            return 'Local Multiplayer: shared local-worker room ' + mode.roomId + '.';
        }
        return String(mode.gameMode || 'ffa').toLowerCase() === 'lms'
            ? 'Offline Sandbox LMS: local simulated players.'
            : 'Offline Sandbox FFA: local simulated players.';
    }

    GameRuntimeModeUi.roomCodeFromRoomId = roomCodeFromRoomId;
    GameRuntimeModeUi.isShareCodeRoomId = isShareCodeRoomId;
    GameRuntimeModeUi.runtimeRoomLabel = runtimeRoomLabel;
    GameRuntimeModeUi.runtimeIndicatorText = runtimeIndicatorText;
    GameRuntimeModeUi.setRuntimeIndicator = setRuntimeIndicator;
    GameRuntimeModeUi.startupSubtitleForMode = startupSubtitleForMode;
    GameRuntimeModeUi.startupNoticeForMode = startupNoticeForMode;

    runtime.GameRuntimeModeUi = GameRuntimeModeUi;
})();
