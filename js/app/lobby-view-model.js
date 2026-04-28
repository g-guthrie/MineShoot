/**
 * lobby-view-model.js - Pure menu flow state.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameLobbyViewModel
 */
(function () {
    'use strict';

    var runtime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    var GameLobbyViewModel = {};

    function hasIncomingInvite(state) {
        var party = state && state.party ? state.party : null;
        var incomingRoomInvite = party && party.roomInvite ? party.roomInvite.incoming : null;
        var incomingInvite = party && party.directInvite ? party.directInvite.incoming : null;
        return !!(
            (incomingRoomInvite && incomingRoomInvite.roomId) ||
            (incomingInvite && incomingInvite.actorId)
        );
    }

    function partyMemberCount(state) {
        var party = state && state.party && state.party.party ? state.party.party : null;
        return party && Array.isArray(party.members) ? party.members.length : 0;
    }

    function normalizeSurface(surfaceId) {
        return surfaceId === 'room' ? 'room' : 'main';
    }

    function normalizeModeWith(options, modeId) {
        if (options && typeof options.normalizeMode === 'function') {
            return String(options.normalizeMode(modeId) || '');
        }
        return String(modeId || '');
    }

    GameLobbyViewModel.build = function (state, options) {
        state = state || {};
        options = options || {};

        var launch = state.launch || {};
        var activeSurface = normalizeSurface(state.activeSurface);
        var paused = !!state.paused;
        var launchPhase = String(launch.phase || '');
        var activeMatchShell = paused || launchPhase === 'retryable';
        var headerVariant = paused ? 'pause' : (activeSurface === 'room' ? 'room' : 'home');
        var hasRoom = !!(state.privateRoom && state.privateRoom.room);
        var loggedIn = !!(state.utilities && state.utilities.isLoggedIn);
        var socialMustShow = hasIncomingInvite(state);
        var showSocialTools = !!state.socialToolsOpen || socialMustShow || hasRoom;
        var mainVisible = activeSurface === 'main' && !activeMatchShell;
        var partyCount = partyMemberCount(state);
        var homeHeroVisible = mainVisible;
        var socialHeroVisible = mainVisible && showSocialTools;
        var partyHeroVisible = mainVisible && partyCount > 1;
        var heroCount = 0;

        if (homeHeroVisible) heroCount += 1;
        if (socialHeroVisible) heroCount += 1;
        if (partyHeroVisible) heroCount += 1;

        return {
            activeSurface: activeSurface,
            selectedMode: normalizeModeWith(options, launch.selectedMode),
            paused: paused,
            launchPhase: launchPhase,
            activeMatchShell: activeMatchShell,
            showSessionStrip: activeMatchShell,
            headerVariant: headerVariant,
            menuContext: activeMatchShell ? 'active-match' : 'menu',
            hasRoom: hasRoom,
            loggedIn: loggedIn,
            socialMustShow: socialMustShow,
            showSocialTools: showSocialTools,
            phoneLandscapeRequired: activeSurface === 'room' ||
                activeMatchShell ||
                String(launch.activityState || '') === 'private_room_lobby',
            header: {
                partyBackVisible: activeSurface === 'room' && !activeMatchShell,
                accountToggleVisible: headerVariant === 'home' && !loggedIn && !activeMatchShell,
                partyIdVisible: !activeMatchShell,
                roomActionVisible: headerVariant === 'home' && !activeMatchShell
            },
            controls: {
                primaryLaunchDisabled: activeMatchShell,
                gameModesDisabled: activeMatchShell,
                socialToolsVisible: activeSurface === 'main' && !activeMatchShell && !hasRoom && !socialMustShow,
                socialToolsDisabled: activeMatchShell,
                playModeOptionsVisible: !!state.modeListOpen && activeSurface === 'main' && !activeMatchShell
            },
            surfaces: {
                menuBodyVisible: !activeMatchShell,
                loadoutBandVisible: activeMatchShell,
                mainScreenVisible: mainVisible,
                roomScreenVisible: activeSurface === 'room' && !activeMatchShell
            },
            heroes: {
                homeVisible: homeHeroVisible,
                socialVisible: socialHeroVisible,
                partyVisible: partyHeroVisible,
                count: Math.max(1, heroCount || 1)
            },
            session: {
                visible: activeMatchShell,
                phase: activeMatchShell
                    ? (launchPhase === 'retryable' ? 'enter' : (launchPhase === 'paused' ? 'paused' : 'resume'))
                    : ''
            },
            overlays: {
                utilityVisible: !!state.utilityOpen,
                leaveConfirmVisible: !!state.confirmLeaveOpen
            }
        };
    };

    runtime.GameLobbyViewModel = GameLobbyViewModel;
})();
