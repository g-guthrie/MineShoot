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

    function friendCount(state) {
        var friends = state && state.friends && Array.isArray(state.friends.friends)
            ? state.friends.friends
            : [];
        return friends.length;
    }

    function statusValue(status) {
        var text = status && status.text ? String(status.text || '') : '';
        if (!text) return null;
        return { text: text, error: !!(status && status.error) };
    }

    function serviceStatus(value) {
        return /(?:service unavailable|endpoint offline|retrying)/i.test(String(value || ''));
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

    function modeLabelWith(options, modeId) {
        if (options && typeof options.modeLabel === 'function') {
            return String(options.modeLabel(modeId) || '');
        }
        if (modeId === 'sandbox') return 'Offline Sandbox';
        if (modeId === 'tdm') return 'Team Deathmatch';
        if (modeId === 'ffa') return 'Free For All';
        return '';
    }

    function normalizeMatchMenuPill(pill) {
        if (!pill || typeof pill !== 'object') return null;
        var label = String(pill.label || '').trim();
        var value = String(pill.value || '').trim();
        if (!label && !value) return null;
        return {
            label: label,
            value: value,
            tone: String(pill.tone || 'default')
        };
    }

    function fallbackMatchMenuModel(payload) {
        var model = payload && typeof payload === 'object' ? payload : {};
        var banner = model.banner && typeof model.banner === 'object'
            ? {
                kind: String(model.banner.kind || ''),
                tone: String(model.banner.tone || 'default'),
                title: String(model.banner.title || ''),
                detail: String(model.banner.detail || '')
            }
            : null;
        if (banner && !banner.kind && !banner.title && !banner.detail) banner = null;
        return {
            ready: !!model.ready,
            banner: banner,
            modePill: normalizeMatchMenuPill(model.modePill),
            contextPill: normalizeMatchMenuPill(model.contextPill),
            primaryPill: normalizeMatchMenuPill(model.primaryPill),
            secondaryPill: normalizeMatchMenuPill(model.secondaryPill)
        };
    }

    function normalizeMatchMenuModelWith(options, payload) {
        if (options && typeof options.normalizeMatchMenuModel === 'function') {
            return options.normalizeMatchMenuModel(payload) || fallbackMatchMenuModel(null);
        }
        return fallbackMatchMenuModel(payload);
    }

    function localEnvironment(options) {
        if (!options) return false;
        if (typeof options.isLocalEnvironment === 'function') return !!options.isLocalEnvironment();
        return !!options.isLocalEnvironment;
    }

    function incomingInviteModel(state) {
        var party = state && state.party ? state.party : null;
        var incomingRoomInvite = party && party.roomInvite ? party.roomInvite.incoming : null;
        var incomingInvite = party && party.directInvite ? party.directInvite.incoming : null;
        if ((!incomingRoomInvite || !incomingRoomInvite.roomId) && (!incomingInvite || !incomingInvite.actorId)) return null;
        return {
            kind: 'invite',
            incomingRoomInvite: incomingRoomInvite || null,
            incomingInvite: incomingInvite || null
        };
    }

    function buildMenuFeedback(state, activeSurface) {
        if (activeSurface === 'room') {
            return statusValue(state.roomStatus) ||
                statusValue(state.partyStatus) ||
                statusValue(state.friendsStatus) ||
                null;
        }
        var homeStatuses = [state.partyStatus, state.friendsStatus, state.roomStatus];
        for (var i = 0; i < homeStatuses.length; i++) {
            var status = statusValue(homeStatuses[i]);
            if (!status || !status.error || !serviceStatus(status.text)) continue;
            return status;
        }
        return null;
    }

    function buildRoomAccessStatus(state, showSessionStrip) {
        if (normalizeSurface(state.activeSurface) !== 'main' || showSessionStrip) return null;
        var launch = state.launch || {};
        var launchMessage = String(launch.message || '');
        if (launchMessage) return { text: launchMessage, error: !!launch.error };
        return statusValue(state.roomStatus);
    }

    function buildSocialActionFeedback(state, isLocal) {
        var text = '';
        var error = false;
        if (state.friendsStatus && state.friendsStatus.text) {
            text = String(state.friendsStatus.text || '');
            error = !!state.friendsStatus.error;
        } else if (state.partyStatus && state.partyStatus.text) {
            text = String(state.partyStatus.text || '');
            error = !!state.partyStatus.error;
            if (/^party service unavailable\./i.test(text)) {
                text = 'SOCIAL SERVICE UNAVAILABLE. RETRYING...';
            } else if (/^party joined\./i.test(text)) {
                text = 'Joined friend.';
            }
        } else {
            var outgoingInvite = state.party && state.party.directInvite ? state.party.directInvite.outgoing : null;
            if (outgoingInvite && outgoingInvite.displayName) {
                text = 'Invite pending for ' + String(outgoingInvite.displayName || 'PLAYER') + '.';
            }
        }

        if (isLocal && serviceStatus(text)) {
            return null;
        }
        return text ? { text: text, error: error } : null;
    }

    function buildPrimaryBanner(matchMenu, invite, activeMatchShell) {
        if (activeMatchShell && matchMenu && matchMenu.banner && matchMenu.banner.kind === 'critical') {
            return {
                kind: 'critical',
                title: matchMenu.banner.title,
                detail: matchMenu.banner.detail,
                tone: matchMenu.banner.tone
            };
        }
        return invite;
    }

    function buildActiveMatchModel(state, options, selectedMode, launchPhase, socialFeedback, primaryBanner, matchMenu) {
        var launch = state.launch || {};
        if (matchMenu.ready) {
            return {
                primaryBanner: primaryBanner,
                headerFeedback: socialFeedback,
                modePill: matchMenu.modePill,
                contextPill: matchMenu.contextPill,
                primaryPill: matchMenu.primaryPill,
                secondaryPill: matchMenu.secondaryPill
            };
        }

        return {
            primaryBanner: primaryBanner,
            headerFeedback: socialFeedback,
            modePill: { label: 'Mode', value: modeLabelWith(options, selectedMode || 'ffa') || 'Match' },
            contextPill: { label: 'State', value: launchPhase === 'retryable' ? 'Ready' : (launchPhase === 'paused' ? 'Paused' : 'Live') },
            primaryPill: {
                label: launchPhase === 'retryable' ? 'Detail' : 'Loadout',
                value: launchPhase === 'retryable'
                    ? String(launch.message || 'Ready to enter.')
                    : 'Change loadout or return to the match.'
            },
            secondaryPill: null
        };
    }

    GameLobbyViewModel.build = function (state, options) {
        state = state || {};
        options = options || {};

        var launch = state.launch || {};
        var activeSurface = normalizeSurface(state.activeSurface);
        var paused = !!state.paused;
        var launchPhase = String(launch.phase || '');
        var activeMatchShell = paused || launchPhase === 'retryable';
        var settingsVisible = !!state.utilityOpen && !activeMatchShell;
        var headerVariant = paused ? 'pause' : (settingsVisible ? 'settings' : (activeSurface === 'room' ? 'room' : 'home'));
        var hasRoom = !!(state.privateRoom && state.privateRoom.room);
        var loggedIn = !!(state.utilities && state.utilities.isLoggedIn);
        var socialMustShow = hasIncomingInvite(state);
        var showSocialTools = !!state.socialToolsOpen || socialMustShow || hasRoom;
        var mainVisible = activeSurface === 'main' && !activeMatchShell && !settingsVisible;
        var partyCount = partyMemberCount(state);
        var selectedMode = normalizeModeWith(options, launch.selectedMode);
        var homeHeroVisible = mainVisible;
        var socialHeroVisible = mainVisible && showSocialTools;
        var partyHeroVisible = mainVisible && partyCount > 1;
        var socialFeedback = buildSocialActionFeedback(state, localEnvironment(options));
        var matchMenu = normalizeMatchMenuModelWith(options, state.matchMenu);
        var invite = incomingInviteModel(state);
        var primaryBanner = buildPrimaryBanner(matchMenu, invite, activeMatchShell);
        var heroCount = 0;

        if (homeHeroVisible) heroCount += 1;
        if (socialHeroVisible) heroCount += 1;
        if (partyHeroVisible) heroCount += 1;

        return {
            activeSurface: activeSurface,
            selectedMode: selectedMode,
            paused: paused,
            launchPhase: launchPhase,
            activeMatchShell: activeMatchShell,
            showSessionStrip: activeMatchShell,
            headerVariant: headerVariant,
            menuContext: activeMatchShell ? 'active-match' : (settingsVisible ? 'settings' : 'menu'),
            hasRoom: hasRoom,
            loggedIn: loggedIn,
            socialMustShow: socialMustShow,
            showSocialTools: showSocialTools,
            phoneLandscapeRequired: activeSurface === 'room' ||
                activeMatchShell ||
                String(launch.activityState || '') === 'private_room_lobby',
            header: {
                partyBackVisible: (activeSurface === 'room' || settingsVisible) && !activeMatchShell,
                accountToggleVisible: headerVariant === 'home' && !loggedIn && !activeMatchShell,
                partyIdVisible: !activeMatchShell,
                roomActionVisible: headerVariant === 'home' && !activeMatchShell
            },
            controls: {
                primaryLaunchDisabled: activeMatchShell,
                gameModesDisabled: activeMatchShell,
                socialToolsVisible: activeSurface === 'main' && !activeMatchShell && !settingsVisible && !hasRoom && !socialMustShow,
                socialToolsDisabled: activeMatchShell,
                playModeOptionsVisible: !!state.modeListOpen && activeSurface === 'main' && !activeMatchShell && !settingsVisible
            },
            feedback: {
                menu: buildMenuFeedback(state, activeSurface),
                social: socialFeedback,
                roomAccess: buildRoomAccessStatus(state, activeMatchShell)
            },
            social: {
                friendsPaneVisible: showSocialTools && loggedIn && friendCount(state) > 0,
                layout: showSocialTools && loggedIn && friendCount(state) > 0 ? 'split' : 'stack'
            },
            surfaces: {
                menuBodyVisible: !activeMatchShell,
                loadoutBandVisible: activeMatchShell,
                mainScreenVisible: mainVisible,
                roomScreenVisible: activeSurface === 'room' && !activeMatchShell && !settingsVisible,
                settingsScreenVisible: settingsVisible
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
            primaryBanner: primaryBanner,
            activeMatch: activeMatchShell
                ? buildActiveMatchModel(state, options, selectedMode, launchPhase, socialFeedback, primaryBanner, matchMenu)
                : null,
            overlays: {
                utilityVisible: settingsVisible,
                leaveConfirmVisible: !!state.confirmLeaveOpen
            }
        };
    };

    runtime.GameLobbyViewModel = GameLobbyViewModel;
})();
