/**
 * lobby-controller.js - Unified menu shell controller.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameLobbyController
 */
(function () {
    'use strict';

    var runtime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    var GameLobbyController = {};
    var initialized = false;
    var RETURN_STATE_KEY = 'mayhem.menu.returnShell.v2';
    var RECENT_JOIN_KEY = 'mayhem.menu.recentJoinIds.v1';

    function runtimeModeUi() {
        return runtime.GameRuntimeModeUi || null;
    }

    function readStoredLaunchError() {
        try {
            var store = window.sessionStorage || null;
            if (!store) return '';
            var msg = String(store.getItem('mayhem.launchError') || '').trim();
            if (msg) store.removeItem('mayhem.launchError');
            return msg;
        } catch (_err) {
            return '';
        }
    }

    function sessionStore() {
        try {
            return window.sessionStorage || null;
        } catch (_err) {
            return null;
        }
    }

    function localStore() {
        try {
            return window.localStorage || null;
        } catch (_err) {
            return null;
        }
    }

    function roomCodeFromRoomId(roomId) {
        var modeUi = runtimeModeUi();
        if (modeUi && modeUi.roomCodeFromRoomId) {
            return modeUi.roomCodeFromRoomId(roomId);
        }
        return String(roomId || '').toUpperCase();
    }

    function readReturnState() {
        var store = sessionStore();
        if (!store || typeof store.getItem !== 'function') return null;
        try {
            var raw = String(store.getItem(RETURN_STATE_KEY) || '').trim();
            if (!raw) return null;
            store.removeItem(RETURN_STATE_KEY);
            var parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object') return null;
            return {
                activeSurface: parsed.activeSurface === 'room' ? 'room' : 'main',
                selectedMode: normalizeMode(parsed.selectedMode)
            };
        } catch (_err) {
            return null;
        }
    }

    function writeReturnState(payload) {
        var store = sessionStore();
        if (!store || typeof store.setItem !== 'function') return;
        try {
            store.setItem(RETURN_STATE_KEY, JSON.stringify({
                activeSurface: payload && payload.activeSurface === 'room' ? 'room' : 'main',
                selectedMode: normalizeMode(payload && payload.selectedMode)
            }));
        } catch (_err) {
            // no-op
        }
    }

    function normalizeMode(modeId) {
        var mode = String(modeId || '').trim().toLowerCase();
        if (mode === 'tdm' || mode === 'lms' || mode === 'practice' || mode === 'ffa') return mode;
        return '';
    }

    function modeLabel(modeId) {
        var mode = normalizeMode(modeId);
        if (mode === 'tdm') return 'Team Deathmatch';
        if (mode === 'lms') return 'Last Man Standing';
        if (mode === 'practice') return 'Offline Practice';
        if (mode === 'ffa') return 'Free For All';
        return '';
    }

    function modePillLabel(modeId) {
        var mode = normalizeMode(modeId);
        if (mode === 'tdm') return 'TDM';
        if (mode === 'lms') return 'LMS';
        if (mode === 'practice') return 'Practice';
        return 'FFA';
    }

    function launchPillLabel(modeId) {
        return 'Play ' + modePillLabel(modeId);
    }

    function isRoomSeedMode(modeId) {
        var mode = normalizeMode(modeId);
        return mode === 'tdm' || mode === 'lms';
    }

    function copyText(text, onSuccess, onFailure, onUnavailable) {
        if (!text) return;
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text)
                .then(function () {
                    if (typeof onSuccess === 'function') onSuccess(text);
                })
                .catch(function () {
                    if (typeof onFailure === 'function') onFailure(text);
                });
            return;
        }
        if (typeof onUnavailable === 'function') {
            onUnavailable(text);
            return;
        }
        if (typeof onFailure === 'function') onFailure(text);
    }

    function defaultState() {
        var returnState = readReturnState();
        return {
            activeSurface: returnState ? returnState.activeSurface : 'main',
            paused: false,
            utilityOpen: false,
            confirmLeaveOpen: false,
            modeListOpen: false,
            expandedPartyMemberId: '',
            expandedFriendId: '',
            launch: {
                selectedMode: returnState && returnState.selectedMode ? returnState.selectedMode : 'ffa',
                phase: 'idle',
                message: '',
                roomCode: '',
                hasRuntime: false,
                canResume: false,
                activityState: 'menu',
                error: false
            },
            party: null,
            privateRoom: null,
            friends: { friends: [] },
            friendsFilter: 'joinable',
            partyStatus: { text: '', error: false },
            roomStatus: { text: '', error: false },
            friendsStatus: { text: '', error: false },
            loadout: {
                snapshot: null,
                validation: { ok: true, message: '' }
            },
            utilities: {
                accountUser: null,
                isLoggedIn: false
            }
        };
    }

    function setText(target, value) {
        if (!target) return;
        target.textContent = String(value || '');
    }

    function setStatusEl(target, status, okColor, errorColor) {
        if (!target) return;
        var text = status && status.text ? String(status.text) : '';
        target.textContent = text;
        target.style.color = status && status.error ? (errorColor || '#d14f45') : (okColor || '#2f6fed');
        target.hidden = !text;
    }

    function filteredFriends(friends, filterId) {
        var list = Array.isArray(friends) ? friends.slice() : [];
        var filter = String(filterId || 'joinable').toLowerCase();
        if (filter === 'all') return list;
        if (filter === 'online') {
            return list.filter(function (friend) { return !!(friend && friend.online); });
        }
        return list.filter(function (friend) {
            return !!(friend && (friend.canJoin || friend.incomingInvite));
        });
    }

    function friendActivityCopy(friend) {
        if (!friend) return 'Offline';
        if (friend.incomingInvite) return 'Invite waiting';
        if (!friend.online) return 'Offline';
        if (friend.activityState === 'private_room_lobby') return friend.joinLocked ? 'Room locked' : 'Room open';
        if (friend.activityState === 'in_match') return friend.joinLocked ? 'Match locked' : 'Match live';
        if (friend.activityState === 'menu') return friend.joinLocked ? 'Menu locked' : 'Menu open';
        return 'Offline';
    }

    function isNodeWithin(node, target) {
        var current = node || null;
        while (current) {
            if (current === target) return true;
            current = current.parentNode || null;
        }
        return false;
    }

    function selectedModeForRoomSeed(modeId) {
        return isRoomSeedMode(modeId) ? normalizeMode(modeId) : '';
    }

    GameLobbyController.init = function (options) {
        if (initialized) return;
        initialized = true;
        options = options || {};

        if (typeof options.prepareMenu === 'function') {
            options.prepareMenu();
        }

        var storeFactory = runtime.GameMenuState;
        if (!storeFactory || !storeFactory.createStore) {
            throw new Error('GameMenuState is required before GameLobbyController.init.');
        }

        var lobbyApi = runtime.GameLobbyApi;
        var authApi = runtime.GameNetAuth || null;
        var modalManager = runtime.GameModalManager || null;
        var sessionFactory = runtime.GameLobbySession || null;
        var loadoutApi = runtime.GameMenuLoadout || null;
        var privateRoomViewFactory = runtime.GameLobbyPrivateRoomView || null;

        var store = storeFactory.createStore(defaultState());
        runtime.GameMenuStore = store;

        var controllerBusy = false;
        var session = null;
        var privateRoomViewController = null;

        var elements = {
            menuHeader: document.getElementById('menu-header'),
            inlineToast: document.getElementById('menu-inline-toast'),
            menuFeedback: document.getElementById('menu-feedback'),
            menuReturnBtn: document.getElementById('menu-return-btn'),
            menuPartyIdBtn: document.getElementById('menu-party-id-btn'),
            menuPartyIdLabel: document.getElementById('menu-party-id-label'),
            menuPartyIdValue: document.getElementById('menu-party-id-value'),
            partyIdInput: document.getElementById('party-id-input'),
            inviteFriendBtn: document.getElementById('invite-friend-btn'),
            joinFriendBtn: document.getElementById('join-friend-btn'),
            socialHeroStatus: document.getElementById('social-hero-status'),
            socialDirectInviteBanner: document.getElementById('social-direct-invite-banner'),
            socialDirectInviteCopy: document.getElementById('social-direct-invite-copy'),
            socialDirectInviteAcceptBtn: document.getElementById('social-direct-invite-accept-btn'),
            socialDirectInviteDismissBtn: document.getElementById('social-direct-invite-dismiss-btn'),
            socialLayout: document.getElementById('menu-social-layout'),
            socialFriendsPane: document.getElementById('menu-social-friends-pane'),
            socialFriendsList: document.getElementById('social-friends-list'),
            roomCodeInput: document.getElementById('room-code-input'),
            joinRoomBtn: document.getElementById('join-room-btn'),
            partyBackBtn: document.getElementById('party-back-btn'),
            accountToggleBtn: document.getElementById('account-toggle-btn'),
            utilityToggleBtn: document.getElementById('utility-toggle-btn'),
            utilityOverlay: document.getElementById('utility-overlay'),
            utilityCloseBtn: document.getElementById('utility-close-btn'),
            utilityModal: document.getElementById('utility-modal'),
            settingsAccountBtn: document.getElementById('settings-account-btn'),
            openManualBtn: document.getElementById('open-manual-btn'),
            controlsToggle: document.getElementById('controls-toggle'),
            soundToggleBtn: document.getElementById('sound-toggle-btn'),
            altModeToggle: document.getElementById('alt-mode-toggle'),
            devOverlay: document.getElementById('dev-overlay'),
            devCloseBtn: document.getElementById('dev-close-btn'),
            devModeButtons: Array.prototype.slice.call(document.querySelectorAll('#mode-buttons .mode-btn[data-mode-id]')),
            screenMain: document.getElementById('menu-screen-mode'),
            screenRoom: document.getElementById('menu-screen-room'),
            mainHeroes: document.getElementById('menu-main-heroes'),
            homeHero: document.getElementById('menu-home-hero'),
            socialHero: document.getElementById('menu-social-hero'),
            partyHero: document.getElementById('menu-party-hero'),
            partyHeroMembers: document.getElementById('party-hero-members'),
            modeTitle: document.getElementById('mode-screen-title'),
            primaryLaunchBtn: document.getElementById('primary-launch-btn'),
            gameModesToggleBtn: document.getElementById('game-modes-toggle-btn'),
            playModeOptions: document.getElementById('play-mode-options'),
            playModeFfaBtn: document.getElementById('play-mode-ffa-btn'),
            playModeTdmBtn: document.getElementById('play-mode-tdm-btn'),
            playModeLmsBtn: document.getElementById('play-mode-lms-btn'),
            practiceModeBtn: document.getElementById('practice-mode-btn'),
            roomAccessStatus: document.getElementById('room-access-status'),
            loadoutStartBtn: document.getElementById('loadout-start-btn'),
            roomActionBtn: document.getElementById('continue-loadout-btn'),
            menuSessionActions: document.getElementById('menu-session-actions'),
            menuSessionStats: document.getElementById('menu-session-stats'),
            menuSessionStatus: document.getElementById('menu-session-status'),
            menuSessionKd: document.getElementById('menu-session-kd'),
            playBtn: document.getElementById('play-btn'),
            backBtn: document.getElementById('back-mode-btn'),
            leaveConfirmOverlay: document.getElementById('leave-confirm-overlay'),
            leaveConfirmCancelBtn: document.getElementById('leave-confirm-cancel-btn'),
            leaveConfirmAcceptBtn: document.getElementById('leave-confirm-accept-btn'),
            partyRoomSection: document.getElementById('party-room-section'),
            partyStatus: document.getElementById('party-status'),
            partyHeroLeaveBtn: document.getElementById('party-hero-leave-btn'),
            privateRoomStatus: document.getElementById('private-room-status'),
            roomSharePanel: document.getElementById('room-share-panel'),
            roomShareCode: document.getElementById('room-share-code'),
            copyRoomCodeBtn: document.getElementById('copy-room-code-btn'),
            privateRoomView: document.getElementById('private-room-view'),
            privateRoomSummary: document.getElementById('private-room-summary'),
            privateRoomModeFfaBtn: document.getElementById('private-room-mode-ffa-btn'),
            privateRoomModeTdmBtn: document.getElementById('private-room-mode-tdm-btn'),
            privateRoomModeLmsBtn: document.getElementById('private-room-mode-lms-btn'),
            privateRoomTeams2Btn: document.getElementById('private-room-teams-2-btn'),
            privateRoomTeams3Btn: document.getElementById('private-room-teams-3-btn'),
            privateRoomTeams4Btn: document.getElementById('private-room-teams-4-btn'),
            privateRoomRandomizeBtn: document.getElementById('private-room-randomize-btn'),
            privateRoomStartBtn: document.getElementById('private-room-start-btn'),
            privateRoomEnterBtn: document.getElementById('private-room-enter-btn'),
            privateRoomInvitePartyBtn: document.getElementById('private-room-invite-party-btn'),
            privateRoomInviteLockBtn: document.getElementById('private-room-invite-lock-btn'),
            privateRoomUnassigned: document.getElementById('private-room-unassigned'),
            privateRoomTeamAlpha: document.getElementById('private-room-team-alpha'),
            privateRoomTeamBravo: document.getElementById('private-room-team-bravo'),
            privateRoomTeamCharlieWrap: document.getElementById('private-room-team-charlie-wrap'),
            privateRoomTeamDeltaWrap: document.getElementById('private-room-team-delta-wrap'),
            privateRoomTeamCharlie: document.getElementById('private-room-team-charlie'),
            privateRoomTeamDelta: document.getElementById('private-room-team-delta')
        };

        function currentPartyIdentity() {
            return authApi && authApi.getPartyIdentity ? authApi.getPartyIdentity() : null;
        }

        function currentAccountUser() {
            if (authApi && authApi.isLoggedIn && authApi.isLoggedIn() && authApi.getUser) {
                return authApi.getUser();
            }
            return null;
        }

        function isLocalEnvironment() {
            var runtimeProfile = runtime.GameRuntimeProfile || null;
            return !!(runtimeProfile && runtimeProfile.isLocalEnvironment && runtimeProfile.isLocalEnvironment());
        }

        function localizeServiceStatusText(text) {
            var value = String(text || '');
            if (!isLocalEnvironment()) return value;
            if (!/(service unavailable|endpoint offline|retrying)/i.test(value)) return value;
            return 'Local social backend offline. Start the worker/API server.';
        }

        function isLoggedIn() {
            return !!currentAccountUser();
        }

        function busy() {
            return !!(controllerBusy || (session && session.isBusy && session.isBusy()));
        }

        function capabilities() {
            return session && session.getCapabilities ? session.getCapabilities() : {
                canTogglePartyJoinLock: false,
                partyJoinLocked: false,
                partyJoinLockTitle: 'Party join lock unavailable.',
                partyJoinLockNote: 'Party Open',
                canLeaveParty: false,
                hasPrivateRoom: false,
                privateRoomPhase: '',
                privateRoomMode: '',
                privateRoomInviteLocked: true,
                canTogglePrivateRoomInviteLock: false,
                canInvitePartyToPrivateRoom: false,
                canEditPrivateRoom: false,
                canRandomizeTeams: false,
                canStartPrivateRoom: false
            };
        }

        function getState() {
            return store.getState();
        }

        function patchState(patch) {
            store.patchState(patch || {});
        }

        function setActiveSurface(surfaceId) {
            patchState({ activeSurface: surfaceId === 'room' ? 'room' : 'main' });
        }

        function setPaused(paused) {
            patchState({ paused: !!paused });
        }

        function setLaunchState(patch) {
            patchState({ launch: patch || {} });
        }

        function setModeListOpen(open) {
            patchState({ modeListOpen: !!open });
        }

        function syncAccountState() {
            patchState({
                utilities: {
                    accountUser: currentAccountUser(),
                    isLoggedIn: isLoggedIn()
                }
            });
        }

        function syncLoadoutState() {
            var snapshot = loadoutApi && loadoutApi.getRuntimeSnapshot ? loadoutApi.getRuntimeSnapshot() : null;
            var validation = loadoutApi && loadoutApi.validateSelections
                ? loadoutApi.validateSelections()
                : { ok: true, message: '' };
            patchState({
                loadout: {
                    snapshot: snapshot,
                    validation: validation
                }
            });
        }

        function setPartyStatus(text, isErr) {
            patchState({ partyStatus: { text: text || '', error: !!isErr } });
        }

        function setRoomStatus(text, isErr) {
            patchState({ roomStatus: { text: text || '', error: !!isErr } });
        }

        function setFriendsStatus(text, isErr) {
            patchState({ friendsStatus: { text: text || '', error: !!isErr } });
        }

        function launchAssignedMatch(nextPartyState) {
            if (controllerBusy || !nextPartyState || !nextPartyState.self) return;
            var launchState = getState().launch || {};
            if (launchState.hasRuntime || launchState.phase === 'matching' || launchState.phase === 'joining' || launchState.phase === 'entering' || launchState.phase === 'in_match') {
                return;
            }
            var self = nextPartyState.self;
            var modeId = '';
            var roomId = '';
            var gameMode = '';
            var message = '';
            var nextSurface = 'main';
            if (self.publicMatch && self.publicMatch.roomId) {
                modeId = 'cloud_multiplayer';
                roomId = String(self.publicMatch.roomId || '');
                gameMode = String(self.publicMatch.gameMode || 'ffa');
                message = 'Joining room ' + roomId.toUpperCase() + '...';
            } else if (self.privateRoom && self.privateRoom.roomId) {
                modeId = 'single_cloudflare';
                roomId = String(self.privateRoom.roomId || '');
                gameMode = String(self.privateRoom.roomMode || 'ffa');
                message = 'Joining room ' + String(runtime.GameRuntimeModeUi && runtime.GameRuntimeModeUi.roomCodeFromRoomId
                    ? runtime.GameRuntimeModeUi.roomCodeFromRoomId(roomId)
                    : roomId).toUpperCase() + '...';
                nextSurface = 'room';
            } else {
                return;
            }
            controllerBusy = true;
            writeReturnState({ activeSurface: nextSurface, selectedMode: normalizeMode(gameMode) || getState().launch.selectedMode });
            setLaunchState({
                selectedMode: normalizeMode(gameMode) || getState().launch.selectedMode,
                phase: 'joining',
                message: message,
                error: false
            });
            render();
            Promise.resolve(options.launchModeById ? options.launchModeById(modeId, {
                roomId: roomId,
                gameMode: gameMode || 'ffa'
            }) : { ok: false, error: 'Launch unavailable.' })
                .then(function (result) {
                    controllerBusy = false;
                    return handleLaunchResult(result, modeId === 'single_cloudflare' ? 'Room ready.' : 'Match ready.');
                })
                .catch(function (err) {
                    controllerBusy = false;
                    setLaunchState({
                        phase: 'error',
                        message: (err && err.message) ? err.message : 'Launch failed.',
                        error: true
                    });
                    render();
                });
        }

        function openUtility() {
            patchState({ utilityOpen: true });
        }

        function closeUtility() {
            patchState({ utilityOpen: false });
        }

        function openLeaveConfirm() {
            patchState({ confirmLeaveOpen: true });
        }

        function closeLeaveConfirm() {
            patchState({ confirmLeaveOpen: false });
        }

        function validationError() {
            syncLoadoutState();
            var validation = getState().loadout.validation;
            if (validation && validation.ok) return '';
            return validation && validation.message ? String(validation.message) : 'Loadout incomplete.';
        }

        function launchGame(modeId) {
            var mode = normalizeMode(modeId || getState().launch.selectedMode);
            var invalid = validationError();
            if (invalid) {
                setLaunchState({ phase: 'error', message: invalid, error: true });
                render();
                return Promise.resolve(false);
            }
            if (!mode) return Promise.resolve(false);

            controllerBusy = true;
            writeReturnState({ activeSurface: 'main', selectedMode: mode });
            setLaunchState({
                selectedMode: mode,
                phase: mode === 'practice' ? 'joining' : 'matching',
                message: mode === 'practice' ? 'Preparing practice...' : ('Finding ' + modeLabel(mode) + '...'),
                error: false
            });
            render();

            if (mode === 'practice') {
                return Promise.resolve(options.launchModeById ? options.launchModeById('single_full_sandbox', { gameMode: 'ffa' }) : { ok: false, error: 'Launch unavailable.' })
                    .then(function (result) {
                        controllerBusy = false;
                        return handleLaunchResult(result, 'Practice ready.');
                    })
                    .catch(function (err) {
                        controllerBusy = false;
                        setLaunchState({
                            phase: 'error',
                            message: (err && err.message) ? err.message : 'Launch failed.',
                            error: true
                        });
                        render();
                        return false;
                    });
            }

            var actor = currentPartyIdentity();
            return lobbyApi.requestJson(lobbyApi.matchmakingPath(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'quick',
                    gameMode: mode,
                    actorId: actor && actor.id ? String(actor.id) : '',
                    displayName: actor && actor.username ? String(actor.username) : ''
                })
            }).then(function (payload) {
                if (!payload || !payload.roomId) {
                    controllerBusy = false;
                    setLaunchState({ phase: 'error', message: 'Room request failed.', error: true });
                    render();
                    return false;
                }
                setLaunchState({
                    phase: 'joining',
                    message: 'Joining room ' + String(payload.roomId || '').toUpperCase() + '...',
                    roomCode: roomCodeFromRoomId(payload.roomId)
                });
                return Promise.resolve(options.launchModeById ? options.launchModeById(payload.modeId || 'cloud_multiplayer', {
                    roomId: payload.roomId,
                    gameMode: payload.gameMode || mode
                }) : { ok: false, error: 'Launch unavailable.' }).then(function (result) {
                    controllerBusy = false;
                    return handleLaunchResult(result, 'Match ready.');
                });
            }).catch(function (err) {
                controllerBusy = false;
                setLaunchState({
                    phase: 'error',
                    message: (err && err.message) ? err.message : 'Room request failed.',
                    error: true
                });
                render();
                return false;
            });
        }

        function handleLaunchResult(result, fallbackMessage) {
            if (!result || !result.ok) {
                setLaunchState({
                    phase: 'error',
                    message: (result && result.error) ? result.error : 'Launch failed.',
                    error: true
                });
                render();
                return false;
            }

            var mode = result.mode || null;
            var sessionApi = runtime.GameSession || null;
            if (sessionApi && sessionApi.prepareLaunch) {
                sessionApi.prepareLaunch(mode || {});
            }
            setLaunchState({
                phase: 'entering',
                roomCode: mode && mode.roomId ? roomCodeFromRoomId(mode.roomId) : '',
                hasRuntime: true,
                message: fallbackMessage || 'Ready.',
                error: false
            });
            render();

            if (!sessionApi || !sessionApi.startGameplayFromMenu) {
                setLaunchState({ phase: 'retryable', message: fallbackMessage || 'Ready.', error: false });
                render();
                return false;
            }

            return Promise.resolve(sessionApi.startGameplayFromMenu()).then(function (entryResult) {
                if (entryResult && entryResult.entered) {
                    setLaunchState({ phase: 'in_match', message: 'Match live.', error: false });
                } else {
                    setLaunchState({
                        phase: 'retryable',
                        message: (entryResult && entryResult.error) ? entryResult.error : (fallbackMessage || 'Enter match.'),
                        error: false
                    });
                }
                render();
                return !!(entryResult && entryResult.entered);
            });
        }

        function appendFriendAction(target, label, className, disabled, handler) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = className;
            btn.textContent = label;
            btn.disabled = !!disabled;
            btn.addEventListener('click', handler);
            target.appendChild(btn);
        }

        function savedFriendIds(state) {
            var friendsState = state && state.friends ? state.friends : { friends: [] };
            var ids = new Set();
            var friends = Array.isArray(friendsState.friends) ? friendsState.friends : [];
            for (var i = 0; i < friends.length; i++) {
                ids.add(String(friends[i] && friends[i].userId || ''));
            }
            return ids;
        }

        function renderPartyMembers(state) {
            if (!elements.partyHeroMembers) return;
            elements.partyHeroMembers.innerHTML = '';
            var partyState = state.party;
            if (!partyState || !partyState.party || !Array.isArray(partyState.party.members) || partyState.party.memberCount <= 1) return;
            var memberIds = savedFriendIds(state);
            for (var i = 0; i < partyState.party.members.length; i++) {
                var member = partyState.party.members[i];
                var actorId = String(member.id || '');
                var wrapper = document.createElement('div');
                wrapper.className = 'menu-member-card';

                var btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'menu-member-pill' + (member.isLeader ? ' leader' : '') + (state.expandedPartyMemberId === actorId ? ' active' : '');
                btn.textContent = String(member.displayName || member.id || 'Player');
                btn.disabled = member.isLeader && actorId === String(partyState.self && partyState.self.id || '');
                btn.addEventListener('click', (function (targetId, isSelf) {
                    return function () {
                        if (isSelf) return;
                        patchState({ expandedPartyMemberId: getState().expandedPartyMemberId === targetId ? '' : targetId });
                        render();
                    };
                })(actorId, actorId === String(partyState.self && partyState.self.id || '')));
                wrapper.appendChild(btn);

                if (state.expandedPartyMemberId === actorId && actorId !== String(partyState.self && partyState.self.id || '')) {
                    var actions = document.createElement('div');
                    actions.className = 'menu-member-subpills';
                    if (state.utilities.isLoggedIn && member.isAccount && member.accountUserId && !memberIds.has(String(member.accountUserId || ''))) {
                        appendFriendAction(actions, 'Add Friend', 'friend-preview-btn secondary', busy(), (function (targetUserId) {
                            return function () {
                                if (!session || !session.performFriendAction) return;
                                session.performFriendAction('add', targetUserId, 'Saving friend...', 'Friend saved.');
                            };
                        })(String(member.accountUserId || '')));
                    }
                    if (partyState.party.isLeader) {
                        appendFriendAction(actions, 'Kick from Party', 'friend-preview-btn secondary', busy(), (function (targetId) {
                            return function () {
                                if (!session || !session.runPartyAction) return;
                                session.runPartyAction('kick', { targetId: targetId }, 'Removing player...');
                                patchState({ expandedPartyMemberId: '' });
                                render();
                            };
                        })(actorId));
                    }
                    if (actions.childNodes.length) wrapper.appendChild(actions);
                }

                elements.partyHeroMembers.appendChild(wrapper);
            }
        }

        function renderFriends(state) {
            if (!elements.socialFriendsPane || !elements.socialFriendsList || !elements.socialLayout) return;
            elements.socialFriendsList.innerHTML = '';

            var loggedIn = !!state.utilities.isLoggedIn;
            var friendsState = state.friends || { friends: [] };
            var friends = loggedIn && Array.isArray(friendsState.friends) ? friendsState.friends.slice() : [];
            friends.sort(function (a, b) {
                var aOnline = !!(a && a.online);
                var bOnline = !!(b && b.online);
                if (aOnline !== bOnline) return aOnline ? -1 : 1;
                return String(a && a.displayName || a && a.username || a && a.userId || '').localeCompare(
                    String(b && b.displayName || b && b.username || b && b.userId || '')
                );
            });

            var showPane = loggedIn && friends.length > 0;
            elements.socialFriendsPane.hidden = !showPane;
            elements.socialLayout.setAttribute('data-layout', showPane ? 'split' : 'stack');
            if (!showPane) return;

            for (var i = 0; i < friends.length; i++) {
                var friend = friends[i];
                var friendId = String(friend.userId || '');
                var wrapper = document.createElement('div');
                wrapper.className = 'menu-friend-card';
                var pill = document.createElement('button');
                pill.type = 'button';
                pill.className = 'menu-friend-pill' + (getState().expandedFriendId === friendId ? ' active' : '');
                pill.addEventListener('click', (function (targetId) {
                    return function () {
                        patchState({ expandedFriendId: getState().expandedFriendId === targetId ? '' : targetId });
                        render();
                    };
                })(friendId));

                var nameRow = document.createElement('div');
                nameRow.className = 'menu-friend-pill-name';
                if (friend.online) {
                    var orb = document.createElement('span');
                    orb.className = 'menu-online-orb';
                    nameRow.appendChild(orb);
                }
                var label = document.createElement('span');
                label.textContent = String(friend.displayName || friend.username || friend.userId || 'Friend');
                nameRow.appendChild(label);
                pill.appendChild(nameRow);
                wrapper.appendChild(pill);

                if (getState().expandedFriendId === friendId) {
                    var actions = document.createElement('div');
                    actions.className = 'menu-member-subpills';
                    appendFriendAction(actions, 'Remove Friend', 'friend-preview-btn secondary', busy(), (function (targetUserId) {
                        return function () {
                            if (!session || !session.performFriendAction) return;
                            session.performFriendAction('remove', targetUserId, 'Removing friend...', 'Friend removed.');
                            patchState({ expandedFriendId: '' });
                            render();
                        };
                    })(friendId));
                    if (friend.canJoin) {
                        appendFriendAction(actions, 'Join Friend', 'friend-preview-btn join', busy(), (function (targetUserId) {
                            return function () {
                                if (!session || !session.performFriendAction) return;
                                session.performFriendAction('join', targetUserId, 'Joining friend...', 'Joined friend.');
                            };
                        })(friendId));
                    }
                    if (friend.canInvite && !friend.sameParty) {
                        appendFriendAction(actions, friend.outgoingInvite ? 'Invited' : 'Invite Friend', 'friend-preview-btn secondary', busy() || !!friend.outgoingInvite, (function (targetUserId) {
                            return function () {
                                if (!session || !session.performFriendAction) return;
                                session.performFriendAction('invite', targetUserId, 'Sending invite...', 'Invite sent.');
                            };
                        })(friendId));
                    }
                    wrapper.appendChild(actions);
                }

                elements.socialFriendsList.appendChild(wrapper);
            }
        }

        function renderPrivateRoom(state) {
            var privateRoomState = state.privateRoom;
            var room = privateRoomState && privateRoomState.room ? privateRoomState.room : null;
            var caps = capabilities();
            var hasRoom = !!room;

            if (elements.roomSharePanel) elements.roomSharePanel.hidden = !hasRoom;
            if (elements.roomShareCode) setText(elements.roomShareCode, hasRoom ? String(room.roomCode || roomCodeFromRoomId(room.roomId)).toUpperCase() : '------');
            if (elements.privateRoomView) elements.privateRoomView.hidden = !hasRoom;
            if (elements.privateRoomEnterBtn) {
                var active = !!(hasRoom && String(room.roomPhase || '') === 'active');
                elements.privateRoomEnterBtn.hidden = !active;
                elements.privateRoomEnterBtn.disabled = busy();
            }
            if (elements.privateRoomStartBtn) {
                elements.privateRoomStartBtn.hidden = !(hasRoom && String(room.roomPhase || '') === 'lobby');
                elements.privateRoomStartBtn.disabled = busy() || !caps.canStartPrivateRoom;
            }

            if (elements.privateRoomModeFfaBtn) {
                elements.privateRoomModeFfaBtn.classList.toggle('active', hasRoom && String(room.roomMode || '') === 'ffa');
                elements.privateRoomModeFfaBtn.disabled = busy() || !caps.canEditPrivateRoom;
            }
            if (elements.privateRoomModeTdmBtn) {
                elements.privateRoomModeTdmBtn.classList.toggle('active', hasRoom && String(room.roomMode || '') === 'tdm');
                elements.privateRoomModeTdmBtn.disabled = busy() || !caps.canEditPrivateRoom;
            }
            if (elements.privateRoomModeLmsBtn) {
                elements.privateRoomModeLmsBtn.classList.toggle('active', hasRoom && String(room.roomMode || '') === 'lms');
                elements.privateRoomModeLmsBtn.disabled = busy() || !caps.canEditPrivateRoom;
            }
            if (elements.privateRoomTeams2Btn) {
                elements.privateRoomTeams2Btn.classList.toggle('active', hasRoom && Number(room.teamCount || 2) === 2);
                elements.privateRoomTeams2Btn.disabled = busy() || !caps.canEditPrivateRoom;
            }
            if (elements.privateRoomTeams3Btn) {
                elements.privateRoomTeams3Btn.classList.toggle('active', hasRoom && Number(room.teamCount || 2) === 3);
                elements.privateRoomTeams3Btn.disabled = busy() || !caps.canEditPrivateRoom;
            }
            if (elements.privateRoomTeams4Btn) {
                elements.privateRoomTeams4Btn.classList.toggle('active', hasRoom && Number(room.teamCount || 2) === 4);
                elements.privateRoomTeams4Btn.disabled = busy() || !caps.canEditPrivateRoom;
            }
            if (elements.privateRoomInvitePartyBtn) {
                elements.privateRoomInvitePartyBtn.hidden = !hasRoom;
                elements.privateRoomInvitePartyBtn.disabled = busy() || !caps.canInvitePartyToPrivateRoom;
            }
            if (elements.privateRoomInviteLockBtn) {
                elements.privateRoomInviteLockBtn.hidden = !hasRoom;
                elements.privateRoomInviteLockBtn.disabled = busy() || !caps.canTogglePrivateRoomInviteLock;
                elements.privateRoomInviteLockBtn.textContent = caps.privateRoomInviteLocked ? 'Room Invites Locked' : 'Room Invites Open';
                elements.privateRoomInviteLockBtn.classList.toggle('locked', !!caps.privateRoomInviteLocked);
            }
            if (elements.privateRoomRandomizeBtn) elements.privateRoomRandomizeBtn.disabled = busy() || !caps.canRandomizeTeams;
            if (elements.privateRoomTeamCharlieWrap) elements.privateRoomTeamCharlieWrap.hidden = !(hasRoom && Number(room.teamCount || 2) >= 3);
            if (elements.privateRoomTeamDeltaWrap) elements.privateRoomTeamDeltaWrap.hidden = !(hasRoom && Number(room.teamCount || 2) >= 4);

            if (privateRoomViewController && privateRoomViewController.applyState) {
                privateRoomViewController.applyState(privateRoomState);
            }
        }

        function renderFeedback(state) {
            var text = '';
            var error = false;
            if (state.activeSurface === 'room') {
                if (state.roomStatus.text) {
                    text = state.roomStatus.text;
                    error = state.roomStatus.error;
                } else if (state.partyStatus.text) {
                    text = state.partyStatus.text;
                    error = state.partyStatus.error;
                } else if (state.friendsStatus.text) {
                    text = state.friendsStatus.text;
                    error = state.friendsStatus.error;
                }
            } else {
                var homeStatuses = [state.partyStatus, state.friendsStatus, state.roomStatus];
                for (var i = 0; i < homeStatuses.length; i++) {
                    var status = homeStatuses[i];
                    var candidate = status && status.text ? String(status.text || '') : '';
                    if (!candidate || !status || !status.error) continue;
                    if (!/(service unavailable|endpoint offline|retrying)/i.test(candidate)) continue;
                    text = candidate;
                    error = true;
                    break;
                }
            }
            if (!elements.menuFeedback) return;
            elements.menuFeedback.textContent = localizeServiceStatusText(text);
            elements.menuFeedback.hidden = !text;
            elements.menuFeedback.classList.toggle('error', !!error);
        }

        function renderSocialHeroStatus(state) {
            if (!elements.socialHeroStatus) return;
            if (state.activeSurface !== 'main') {
                elements.socialHeroStatus.hidden = true;
                elements.socialHeroStatus.textContent = '';
                elements.socialHeroStatus.classList.remove('error');
                return;
            }

            var text = '';
            var error = false;
            var hasPartyHero = !!(state.party && state.party.party && state.party.party.memberCount > 1);
            if (state.friendsStatus.text) {
                text = String(state.friendsStatus.text || '');
                error = !!state.friendsStatus.error;
            } else if (!hasPartyHero && state.partyStatus.text) {
                text = String(state.partyStatus.text || '');
                error = !!state.partyStatus.error;
                if (/^party service unavailable\./i.test(text)) {
                    text = 'SOCIAL SERVICE UNAVAILABLE. RETRYING...';
                } else if (/^party joined\./i.test(text)) {
                    text = 'Joined friend.';
                }
            } else {
                var outgoingRoomInvite = state.party && state.party.roomInvite ? state.party.roomInvite.outgoing : null;
                if (outgoingRoomInvite && outgoingRoomInvite.roomCode) {
                    text = 'Room invite sent for ' + String(outgoingRoomInvite.roomCode || '').toUpperCase() + '.';
                }
                var outgoingInvite = state.party && state.party.directInvite ? state.party.directInvite.outgoing : null;
                if (!text && outgoingInvite && outgoingInvite.displayName) {
                    text = 'Invite pending for ' + String(outgoingInvite.displayName || 'PLAYER') + '.';
                }
            }

            if (isLocalEnvironment() && /(?:service unavailable|endpoint offline|retrying)/i.test(text)) {
                text = '';
                error = false;
            }

            elements.socialHeroStatus.textContent = text;
            elements.socialHeroStatus.hidden = !text;
            elements.socialHeroStatus.classList.toggle('error', !!error);
        }

        function renderDirectInviteBanner(state) {
            if (!elements.socialDirectInviteBanner) return;
            if (state.activeSurface !== 'main') {
                elements.socialDirectInviteBanner.hidden = true;
                return;
            }
            var incomingRoomInvite = state.party && state.party.roomInvite ? state.party.roomInvite.incoming : null;
            var incomingInvite = state.party && state.party.directInvite ? state.party.directInvite.incoming : null;
            if ((!incomingRoomInvite || !incomingRoomInvite.roomId) && (!incomingInvite || !incomingInvite.actorId)) {
                elements.socialDirectInviteBanner.hidden = true;
                return;
            }
            if (elements.socialDirectInviteCopy) {
                if (incomingRoomInvite && incomingRoomInvite.roomId) {
                    elements.socialDirectInviteCopy.textContent =
                        String(incomingRoomInvite.inviterDisplayName || incomingRoomInvite.inviterActorId || 'PLAYER') +
                        ' invited you to room ' +
                        String(incomingRoomInvite.roomCode || '').toUpperCase() +
                        '.';
                } else {
                    elements.socialDirectInviteCopy.textContent = String(incomingInvite.displayName || incomingInvite.actorId || 'PLAYER') + ' invited you to join.';
                }
            }
            if (elements.socialDirectInviteAcceptBtn) {
                elements.socialDirectInviteAcceptBtn.textContent = incomingRoomInvite && incomingRoomInvite.roomId ? 'Join Room' : 'Accept Invite';
            }
            if (elements.socialDirectInviteDismissBtn) {
                elements.socialDirectInviteDismissBtn.textContent = 'Dismiss';
            }
            if (elements.socialDirectInviteAcceptBtn) elements.socialDirectInviteAcceptBtn.disabled = busy();
            if (elements.socialDirectInviteDismissBtn) elements.socialDirectInviteDismissBtn.disabled = busy();
            elements.socialDirectInviteBanner.hidden = false;
        }

        function syncSessionState(detail) {
            detail = detail || {};
            var paused = !!(
                detail.runtimeReady &&
                !detail.inMatch &&
                !detail.awaitingInputCapture &&
                detail.canResume &&
                String(detail.activityState || '') !== 'private_room_lobby'
            );
            var pausePhase = paused && String(detail.activityState || '') === 'paused'
                ? 'paused'
                : (paused ? 'resume' : '');
            setPaused(paused);
            setLaunchState({
                hasRuntime: !!detail.runtimeReady,
                canResume: !!detail.canResume,
                activityState: String(detail.activityState || 'menu'),
                phase: detail.awaitingInputCapture ? 'retryable' : (pausePhase || (detail.inMatch ? 'in_match' : getState().launch.phase))
            });
            render();
        }

        function render() {
            var state = getState();
            var launch = state.launch;
            var paused = !!state.paused;
            var showSessionStrip = paused || launch.phase === 'retryable';
            var hasRoom = !!(state.privateRoom && state.privateRoom.room);
            var caps = capabilities();
            var isBusy = busy();
            var selectedMode = normalizeMode(launch.selectedMode);
            var identity = currentPartyIdentity();
            var loggedIn = !!state.utilities.isLoggedIn;
            var headerVariant = paused ? 'pause' : (state.activeSurface === 'room' ? 'room' : 'home');

            if (elements.menuHeader) elements.menuHeader.setAttribute('data-variant', headerVariant);

            if (elements.menuReturnBtn) elements.menuReturnBtn.hidden = headerVariant !== 'pause' || showSessionStrip;
            if (elements.partyBackBtn) elements.partyBackBtn.hidden = state.activeSurface !== 'room';
            if (elements.accountToggleBtn) elements.accountToggleBtn.hidden = headerVariant !== 'home' || loggedIn;
            if (elements.menuPartyIdBtn) elements.menuPartyIdBtn.hidden = false;
            if (elements.roomActionBtn) elements.roomActionBtn.hidden = headerVariant !== 'home';
            if (elements.utilityOverlay) elements.utilityOverlay.hidden = !state.utilityOpen;
            if (elements.leaveConfirmOverlay) elements.leaveConfirmOverlay.hidden = !state.confirmLeaveOpen;

            if (identity) {
                setText(elements.menuPartyIdLabel, identity.label || 'Player ID');
                setText(elements.menuPartyIdValue, String(identity.id || '------').toUpperCase());
            }
            if (!loggedIn && elements.menuPartyIdLabel) {
                elements.menuPartyIdLabel.textContent = 'Guest ID';
            }
            if (elements.settingsAccountBtn) {
                elements.settingsAccountBtn.textContent = loggedIn ? 'Profile' : 'Login';
            }

            renderFeedback(state);
            renderSocialHeroStatus(state);
            renderDirectInviteBanner(state);
            renderPartyMembers(state);
            renderFriends(state);
            renderPrivateRoom(state);

            if (elements.primaryLaunchBtn) {
                elements.primaryLaunchBtn.textContent = launchPillLabel(selectedMode || 'ffa');
                elements.primaryLaunchBtn.disabled = isBusy || paused;
            }
            if (elements.gameModesToggleBtn) {
                elements.gameModesToggleBtn.classList.toggle('active', !!state.modeListOpen);
                elements.gameModesToggleBtn.setAttribute('aria-expanded', state.modeListOpen ? 'true' : 'false');
                elements.gameModesToggleBtn.disabled = paused;
            }
            if (elements.playModeOptions) {
                elements.playModeOptions.hidden = !state.modeListOpen || state.activeSurface !== 'main' || paused;
            }

            if (elements.playModeFfaBtn) {
                elements.playModeFfaBtn.classList.toggle('active', selectedMode === 'ffa');
                elements.playModeFfaBtn.setAttribute('aria-pressed', selectedMode === 'ffa' ? 'true' : 'false');
            }
            if (elements.playModeTdmBtn) {
                elements.playModeTdmBtn.classList.toggle('active', selectedMode === 'tdm');
                elements.playModeTdmBtn.setAttribute('aria-pressed', selectedMode === 'tdm' ? 'true' : 'false');
            }
            if (elements.playModeLmsBtn) {
                elements.playModeLmsBtn.classList.toggle('active', selectedMode === 'lms');
                elements.playModeLmsBtn.setAttribute('aria-pressed', selectedMode === 'lms' ? 'true' : 'false');
            }
            if (elements.practiceModeBtn) {
                elements.practiceModeBtn.classList.toggle('active', selectedMode === 'practice');
                elements.practiceModeBtn.setAttribute('aria-pressed', selectedMode === 'practice' ? 'true' : 'false');
            }

            if (elements.loadoutStartBtn) {
                elements.loadoutStartBtn.hidden = true;
                elements.loadoutStartBtn.disabled = isBusy;
            }
            if (elements.roomActionBtn) {
                elements.roomActionBtn.textContent = hasRoom
                    ? ('ROOM #' + String(state.privateRoom.room.roomCode || roomCodeFromRoomId(state.privateRoom.room.roomId)).toUpperCase())
                    : 'Create Room';
                elements.roomActionBtn.classList.toggle('active', hasRoom);
                elements.roomActionBtn.disabled = isBusy || paused;
            }
            if (elements.partyIdInput) elements.partyIdInput.disabled = isBusy;
            if (elements.inviteFriendBtn) elements.inviteFriendBtn.disabled = isBusy;
            if (elements.joinFriendBtn) elements.joinFriendBtn.disabled = isBusy;
            if (elements.roomCodeInput) elements.roomCodeInput.disabled = isBusy;
            if (elements.joinRoomBtn) elements.joinRoomBtn.disabled = isBusy;
            if (elements.roomAccessStatus) {
                elements.roomAccessStatus.textContent = (state.activeSurface === 'main' && !paused) ? String(launch.message || '') : '';
                elements.roomAccessStatus.classList.toggle('error', !!launch.error);
                elements.roomAccessStatus.hidden = !elements.roomAccessStatus.textContent;
            }

            var showMainHeroes = state.activeSurface === 'main';
            var showHomeHero = showMainHeroes && !paused;
            var showPartyHero = showMainHeroes && caps.partyMemberCount > 1;
            var heroCount = 0;
            if (showHomeHero) heroCount += 1;
            if (showMainHeroes) heroCount += 1;
            if (showPartyHero) heroCount += 1;

            if (elements.screenMain) elements.screenMain.hidden = !showMainHeroes;
            if (elements.mainHeroes) {
                elements.mainHeroes.hidden = !showMainHeroes;
                elements.mainHeroes.setAttribute('data-columns', String(Math.max(1, heroCount || 1)));
            }
            if (elements.homeHero) elements.homeHero.hidden = !showHomeHero;
            if (elements.socialHero) elements.socialHero.hidden = !showMainHeroes;
            if (elements.partyHero) elements.partyHero.hidden = !showPartyHero;
            if (elements.screenRoom) elements.screenRoom.hidden = state.activeSurface !== 'room';

            if (elements.menuSessionActions) {
                elements.menuSessionActions.hidden = !showSessionStrip;
                if (showSessionStrip) {
                    if (elements.menuSessionStats) elements.menuSessionStats.hidden = false;
                    if (elements.menuSessionStatus) {
                        elements.menuSessionStatus.textContent = launch.phase === 'retryable'
                            ? 'Enter Match'
                            : (launch.phase === 'paused' ? 'Paused' : 'Resume Match');
                    }
                    if (elements.menuSessionKd) {
                        elements.menuSessionKd.textContent = launch.phase === 'retryable'
                            ? String(launch.message || 'Ready to enter.')
                            : 'Change loadout or return to the match.';
                    }
                } else {
                    if (elements.menuSessionStatus) elements.menuSessionStatus.textContent = '';
                    if (elements.menuSessionKd) {
                        elements.menuSessionKd.textContent = paused
                            ? 'Change loadout or return to the match.'
                            : String(launch.message || 'Ready to enter.');
                    }
                }
            }

            setStatusEl(elements.privateRoomStatus, state.roomStatus, '#2f6fed', '#d14f45');
            if (elements.partyHeroLeaveBtn) elements.partyHeroLeaveBtn.disabled = isBusy || !caps.canLeaveParty;
        }

        function bindClick(button, handler) {
            if (!button) return;
            button.addEventListener('click', handler);
        }

        function bindEnter(input, handler) {
            if (!input) return;
            input.addEventListener('keydown', function (event) {
                if (event.key !== 'Enter') return;
                event.preventDefault();
                handler(event);
            });
        }

        var inlineToastHandle = 0;

        function showInlineToast(target, message) {
            if (!elements.inlineToast) return;
            elements.inlineToast.textContent = String(message || 'Copied');
            elements.inlineToast.hidden = false;
            if (target && typeof target.getBoundingClientRect === 'function' && elements.menuHeader && typeof elements.menuHeader.getBoundingClientRect === 'function') {
                var targetRect = target.getBoundingClientRect();
                var headerRect = elements.menuHeader.getBoundingClientRect();
                elements.inlineToast.style.left = Math.max(8, targetRect.left - headerRect.left) + 'px';
                elements.inlineToast.style.top = Math.max(0, targetRect.bottom - headerRect.top + 6) + 'px';
            } else {
                elements.inlineToast.style.left = '12px';
                elements.inlineToast.style.top = '48px';
            }
            if (typeof window.clearTimeout === 'function' && inlineToastHandle) window.clearTimeout(inlineToastHandle);
            if (typeof window.setTimeout === 'function') {
                inlineToastHandle = window.setTimeout(function () {
                    if (!elements.inlineToast) return;
                    elements.inlineToast.hidden = true;
                }, 1400);
            }
        }

        function maybeWarnUnevenTeams() {
            var room = getState().privateRoom && getState().privateRoom.room;
            if (!room || String(room.roomMode || '') !== 'tdm') return;
            if (Number(room.teamCount || 2) !== 2) return;
            var alphaCount = room.teams && room.teams.alpha ? room.teams.alpha.length : 0;
            var bravoCount = room.teams && room.teams.bravo ? room.teams.bravo.length : 0;
            if (alphaCount !== bravoCount) {
                setRoomStatus('Teams are uneven. Starting anyway.', false);
            }
        }

        if (privateRoomViewFactory && privateRoomViewFactory.create) {
            privateRoomViewController = privateRoomViewFactory.create({
                getState: function () {
                    return getState().privateRoom;
                },
                setState: function () {},
                getPartyState: function () {
                    return getState().party;
                },
                privateRoomStatusEl: elements.privateRoomStatus,
                privateRoomSummaryEl: elements.privateRoomSummary,
                privateRoomUnassigned: elements.privateRoomUnassigned,
                privateRoomTeamAlpha: elements.privateRoomTeamAlpha,
                privateRoomTeamBravo: elements.privateRoomTeamBravo,
                privateRoomTeamCharlie: elements.privateRoomTeamCharlie,
                privateRoomTeamDelta: elements.privateRoomTeamDelta,
                privateRoomRandomizeBtn: elements.privateRoomRandomizeBtn,
                moveMember: function (memberId, nextTeamId) {
                    if (!session || !session.movePrivateRoomMember) return Promise.resolve(null);
                    return session.movePrivateRoomMember(memberId, nextTeamId);
                }
            });
        }

        session = sessionFactory && sessionFactory.create ? sessionFactory.create({
            lobbyApi: lobbyApi,
            authApi: authApi,
            getActivityState: function () {
                var sessionApi = runtime.GameSession || null;
                if (sessionApi && sessionApi.getActivityState) return sessionApi.getActivityState();
                if (typeof options.getActivityState === 'function') return options.getActivityState();
                return 'menu';
            },
            setPartyStatus: setPartyStatus,
            setFriendsStatus: setFriendsStatus,
            setPrivateRoomStatus: setRoomStatus,
            onBusyChange: function () {
                render();
            },
            onPartyIdentityChange: function () {
                render();
            },
            onSocialUpdate: function () {
                syncAccountState();
                render();
            },
            onPartyStateChanged: function (nextState) {
                patchState({ party: nextState || null });
                render();
            },
            onPartyUnavailable: function (message) {
                setPartyStatus(message, true);
                render();
            },
            onFriendsStateChanged: function (nextState) {
                patchState({ friends: nextState || { friends: [] } });
                render();
            },
            onFriendsUnavailable: function (message) {
                setFriendsStatus(message, true);
                render();
            },
            onPrivateRoomStateChanged: function (nextState) {
                patchState({ privateRoom: nextState || null });
                render();
            },
            onPrivateRoomUnavailable: function (message) {
                setRoomStatus(message, true);
                render();
            },
            launchAssignedMatch: launchAssignedMatch
        }) : null;

        bindClick(elements.menuPartyIdBtn, function () {
            var value = elements.menuPartyIdValue ? elements.menuPartyIdValue.textContent : '';
            copyText(
                value,
                function () {
                    showInlineToast(elements.menuPartyIdBtn, 'ID copied');
                },
                function () {
                    setPartyStatus('Copy failed.', true);
                    render();
                },
                function () {
                    setPartyStatus('Copy unavailable.', false);
                    render();
                }
            );
        });

        bindClick(elements.inviteFriendBtn, function () {
            var targetId = elements.partyIdInput ? String(elements.partyIdInput.value || '').trim() : '';
            if (!targetId) {
                setPartyStatus('Enter a friend ID.', true);
                render();
                return;
            }
            if (!session || !session.runPartyAction) return;
            session.runPartyAction('invite', { targetId: targetId }, 'Sending invite...');
            render();
        });
        bindClick(elements.joinFriendBtn, function () {
            var targetId = elements.partyIdInput ? String(elements.partyIdInput.value || '').trim() : '';
            if (!targetId) {
                setPartyStatus('Enter a friend ID.', true);
                render();
                return;
            }
            if (!session || !session.runPartyAction) return;
            session.runPartyAction('join', { targetId: targetId }, 'Joining friend...');
            render();
        });
        bindEnter(elements.partyIdInput, function () {
            if (elements.joinFriendBtn) elements.joinFriendBtn.click();
        });
        bindClick(elements.joinRoomBtn, function () {
            var roomCode = elements.roomCodeInput ? String(elements.roomCodeInput.value || '').trim() : '';
            if (!roomCode) {
                setRoomStatus('Enter a room number.', true);
                render();
                return;
            }
            if (!session || !session.joinPrivateRoom || busy()) return;
            session.joinPrivateRoom(roomCode).then(function () {
                setActiveSurface('room');
                render();
            });
        });
        bindEnter(elements.roomCodeInput, function () {
            if (elements.joinRoomBtn) elements.joinRoomBtn.click();
        });
        bindClick(elements.socialDirectInviteAcceptBtn, function () {
            var roomInvite = getState().party && getState().party.roomInvite ? getState().party.roomInvite.incoming : null;
            if (roomInvite && roomInvite.roomId && session && session.runPartyAction) {
                session.runPartyAction('accept_room_invite', {}, 'Joining room invite...');
                render();
                return;
            }
            var invite = getState().party && getState().party.directInvite ? getState().party.directInvite.incoming : null;
            if (!invite || !invite.actorId || !session || !session.runPartyAction) return;
            session.runPartyAction('accept_invite', { targetId: invite.actorId }, 'Joining invite...');
            render();
        });
        bindClick(elements.socialDirectInviteDismissBtn, function () {
            var roomInvite = getState().party && getState().party.roomInvite ? getState().party.roomInvite.incoming : null;
            if (roomInvite && roomInvite.roomId && session && session.runPartyAction) {
                session.runPartyAction('dismiss_room_invite', {}, 'Dismissing room invite...');
                render();
                return;
            }
            var invite = getState().party && getState().party.directInvite ? getState().party.directInvite.incoming : null;
            if (!invite || !invite.actorId || !session || !session.runPartyAction) return;
            session.runPartyAction('dismiss_invite', { targetId: invite.actorId }, 'Dismissing invite...');
            render();
        });

        bindClick(elements.utilityToggleBtn, function () {
            if (getState().utilityOpen) closeUtility();
            else openUtility();
            render();
        });
        bindClick(elements.utilityCloseBtn, function () {
            closeUtility();
            render();
        });

        bindClick(elements.partyBackBtn, function () {
            setActiveSurface('main');
            render();
        });
        bindClick(elements.menuReturnBtn, function (event) {
            if (event) {
                event.preventDefault();
                event.stopPropagation();
            }
            var sessionApi = runtime.GameSession || null;
            if (sessionApi && sessionApi.resumeGameplay) {
                sessionApi.resumeGameplay(event || null);
            }
        });
        bindClick(elements.settingsAccountBtn, function () {
            closeUtility();
            render();
            if (elements.accountToggleBtn) {
                elements.accountToggleBtn.click();
            }
        });

        function selectMode(modeId) {
            setLaunchState({
                selectedMode: normalizeMode(modeId),
                phase: 'idle',
                message: '',
                error: false
            });
            setModeListOpen(false);
            render();
        }

        bindClick(elements.primaryLaunchBtn, function () {
            launchGame(getState().launch.selectedMode || 'ffa');
        });
        bindClick(elements.gameModesToggleBtn, function () {
            setModeListOpen(!getState().modeListOpen);
            render();
        });
        bindClick(elements.playModeFfaBtn, function () { selectMode('ffa'); });
        bindClick(elements.playModeTdmBtn, function () { selectMode('tdm'); });
        bindClick(elements.playModeLmsBtn, function () { selectMode('lms'); });
        bindClick(elements.practiceModeBtn, function () { selectMode('practice'); });

        bindClick(elements.loadoutStartBtn, function () {
            launchGame(getState().launch.selectedMode);
        });

        bindClick(elements.roomActionBtn, function () {
            var state = getState();
            if (state.privateRoom && state.privateRoom.room) {
                setActiveSurface('room');
                render();
                return;
            }
            if (!session || !session.createPrivateRoom || busy()) return;
            controllerBusy = true;
            setRoomStatus('Creating room...', false);
            render();
            session.createPrivateRoom()
                .then(function () {
                    var seedMode = selectedModeForRoomSeed(getState().launch.selectedMode);
                    if (seedMode && session && session.setPrivateRoomMode) {
                        return session.setPrivateRoomMode(seedMode);
                    }
                    return null;
                })
                .finally(function () {
                    controllerBusy = false;
                    setActiveSurface('room');
                    render();
                });
        });

        function leaveParty() {
            if (!session || !session.runPartyAction) return;
            session.runPartyAction('leave', {}, 'Leaving party...');
            patchState({ expandedPartyMemberId: '' });
            render();
        }

        bindClick(elements.partyHeroLeaveBtn, leaveParty);

        bindClick(elements.copyRoomCodeBtn, function () {
            var value = elements.roomShareCode ? elements.roomShareCode.textContent : '';
            copyText(
                value,
                function () { showInlineToast(elements.copyRoomCodeBtn, 'Room copied'); },
                function () { setRoomStatus('Copy failed.', true); render(); },
                function () { setRoomStatus('Copy unavailable.', false); render(); }
            );
        });
        bindClick(elements.privateRoomModeFfaBtn, function () {
            if (session && session.setPrivateRoomMode) session.setPrivateRoomMode('ffa');
        });
        bindClick(elements.privateRoomModeTdmBtn, function () {
            if (session && session.setPrivateRoomMode) session.setPrivateRoomMode('tdm');
        });
        bindClick(elements.privateRoomModeLmsBtn, function () {
            if (session && session.setPrivateRoomMode) session.setPrivateRoomMode('lms');
        });
        bindClick(elements.privateRoomTeams2Btn, function () {
            if (session && session.setPrivateRoomTeamCount) session.setPrivateRoomTeamCount(2);
        });
        bindClick(elements.privateRoomTeams3Btn, function () {
            if (session && session.setPrivateRoomTeamCount) session.setPrivateRoomTeamCount(3);
        });
        bindClick(elements.privateRoomTeams4Btn, function () {
            if (session && session.setPrivateRoomTeamCount) session.setPrivateRoomTeamCount(4);
        });
        bindClick(elements.privateRoomInvitePartyBtn, function () {
            if (session && session.invitePartyToPrivateRoom) session.invitePartyToPrivateRoom();
        });
        bindClick(elements.privateRoomInviteLockBtn, function () {
            var room = getState().privateRoom && getState().privateRoom.room;
            if (!room || !session || !session.setPrivateRoomInviteLock) return;
            session.setPrivateRoomInviteLock(!room.inviteLocked);
        });
        bindClick(elements.privateRoomRandomizeBtn, function () {
            if (session && session.randomizePrivateRoomTeams) session.randomizePrivateRoomTeams();
        });
        bindClick(elements.privateRoomStartBtn, function () {
            maybeWarnUnevenTeams();
            if (session && session.startPrivateRoomMatch) session.startPrivateRoomMatch();
        });
        bindClick(elements.privateRoomEnterBtn, function () {
            var room = getState().privateRoom && getState().privateRoom.room;
            if (!room) return;
            controllerBusy = true;
            writeReturnState({ activeSurface: 'room', selectedMode: room.roomMode || getState().launch.selectedMode });
            setLaunchState({
                selectedMode: normalizeMode(room.roomMode || getState().launch.selectedMode),
                phase: 'joining',
                message: 'Joining room ' + String(room.roomCode || '').toUpperCase() + '...',
                error: false
            });
            render();
            Promise.resolve(options.launchModeById ? options.launchModeById('single_cloudflare', {
                roomId: room.roomId,
                gameMode: room.roomMode || 'ffa'
            }) : { ok: false, error: 'Launch unavailable.' })
                .then(function (result) {
                    controllerBusy = false;
                    return handleLaunchResult(result, 'Room ready.');
                })
                .catch(function (err) {
                    controllerBusy = false;
                    setLaunchState({
                        phase: 'error',
                        message: (err && err.message) ? err.message : 'Room entry failed.',
                        error: true
                    });
                    render();
                    });
        });

        bindClick(elements.leaveConfirmCancelBtn, function () {
            closeLeaveConfirm();
            render();
        });
        bindClick(elements.leaveConfirmAcceptBtn, function () {
            closeLeaveConfirm();
            render();
            var sessionApi = runtime.GameSession || null;
            if (sessionApi && sessionApi.returnToMenu) {
                sessionApi.returnToMenu();
            }
        });

        if (elements.utilityOverlay) {
            document.addEventListener('click', function (event) {
                if (getState().utilityOpen && elements.utilityOverlay && !isNodeWithin(event.target, elements.utilityOverlay) && event.target !== elements.utilityToggleBtn) {
                    closeUtility();
                    render();
                }
            });
        }
        document.addEventListener('keydown', function (event) {
            if (event.key !== 'Escape') return;
            if (getState().confirmLeaveOpen) {
                event.preventDefault();
                closeLeaveConfirm();
                render();
                return;
            }
            if (getState().utilityOpen) {
                closeUtility();
                render();
                return;
            }
            if (getState().paused) {
                event.preventDefault();
                event.stopPropagation();
                if (elements.playBtn && typeof elements.playBtn.focus === 'function') {
                    elements.playBtn.focus();
                }
            }
        });

        if (modalManager && elements.devOverlay) {
            modalManager.register('dev', {
                element: elements.devOverlay,
                initialFocus: elements.devModeButtons[0] || elements.devCloseBtn || elements.devOverlay,
                restoreFocus: elements.utilityToggleBtn || null
            });
        }
        bindClick(elements.devCloseBtn, function () {
            if (modalManager && modalManager.close) modalManager.close('dev');
        });
        for (var i = 0; i < elements.devModeButtons.length; i++) {
            bindClick(elements.devModeButtons[i], function () {
                var modeId = String(this.dataset.modeId || '');
                if (!modeId || !options.launchModeById) return;
                controllerBusy = true;
                render();
                Promise.resolve(options.launchModeById(modeId, {
                    gameMode: normalizeMode(getState().launch.selectedMode) || 'ffa'
                }))
                    .then(function (result) {
                        controllerBusy = false;
                        return handleLaunchResult(result, 'Local multiplayer ready.');
                    })
                    .catch(function (err) {
                        controllerBusy = false;
                        setLaunchState({ phase: 'error', message: (err && err.message) ? err.message : 'Launch failed.', error: true });
                        render();
                    });
            });
        }

        if (window && typeof window.addEventListener === 'function') {
            window.addEventListener('mayhem-session-state', function (event) {
                syncSessionState(event && event.detail ? event.detail : null);
            });
            window.addEventListener('mayhem-auth-changed', function () {
                syncAccountState();
                render();
            });
            window.addEventListener('mayhem-leave-game-request', function (event) {
                var detail = event && event.detail ? event.detail : {};
                if (detail && detail.requiresConfirm) {
                    openLeaveConfirm();
                    render();
                    return;
                }
                var sessionApi = runtime.GameSession || null;
                if (sessionApi && sessionApi.returnToMenu) {
                    sessionApi.returnToMenu();
                }
            });
        }

        if (loadoutApi && loadoutApi.subscribe) {
            loadoutApi.subscribe(function () {
                syncLoadoutState();
                render();
            });
        }

        syncLoadoutState();
        syncAccountState();

        var storedLaunchError = readStoredLaunchError();
        if (storedLaunchError) {
            setLaunchState({
                phase: 'error',
                message: storedLaunchError,
                error: true
            });
        }

        if (session && session.start) session.start();
        render();
    };

    runtime.GameLobbyController = GameLobbyController;
})();
