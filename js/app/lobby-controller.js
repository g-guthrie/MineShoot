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
                activeSurface: parsed.activeSurface === 'party' ? 'party' : 'main',
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
                activeSurface: payload && payload.activeSurface === 'party' ? 'party' : 'main',
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

    function readRecentJoinTargets() {
        var store = localStore();
        if (!store || typeof store.getItem !== 'function') return [];
        try {
            var parsed = JSON.parse(String(store.getItem(RECENT_JOIN_KEY) || '[]'));
            if (!Array.isArray(parsed)) return [];
            return parsed.map(function (value) { return String(value || '').trim(); }).filter(Boolean).slice(0, 5);
        } catch (_err) {
            return [];
        }
    }

    function writeRecentJoinTarget(targetId) {
        var nextId = String(targetId || '').trim();
        if (!nextId) return readRecentJoinTargets();
        var recent = readRecentJoinTargets().filter(function (entry) {
            return entry !== nextId;
        });
        recent.unshift(nextId);
        recent = recent.slice(0, 5);
        var store = localStore();
        if (store && typeof store.setItem === 'function') {
            try {
                store.setItem(RECENT_JOIN_KEY, JSON.stringify(recent));
            } catch (_err) {
                // no-op
            }
        }
        return recent;
    }

    function defaultState() {
        var returnState = readReturnState();
        return {
            activeSurface: returnState ? returnState.activeSurface : 'main',
            paused: false,
            utilityOpen: false,
            joinPopoverOpen: false,
            joinRecent: readRecentJoinTargets(),
            confirmLeaveOpen: false,
            modeListOpen: false,
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
            menuFeedback: document.getElementById('menu-feedback'),
            menuReturnBtn: document.getElementById('menu-return-btn'),
            menuPartyIdBtn: document.getElementById('menu-party-id-btn'),
            menuPartyIdLabel: document.getElementById('menu-party-id-label'),
            menuPartyIdValue: document.getElementById('menu-party-id-value'),
            joinPartyTriggerBtn: document.getElementById('join-party-trigger-btn'),
            joinPartyPopover: document.getElementById('join-party-popover'),
            joinPartyRecent: document.getElementById('join-party-recent'),
            partyIdInput: document.getElementById('party-id-input'),
            joinPartyBtn: document.getElementById('join-party-btn'),
            openPartyBtn: document.getElementById('open-party-btn'),
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
            screenParty: document.getElementById('menu-screen-party'),
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
            partyCurrentSection: document.getElementById('party-current-section'),
            partyRoomSection: document.getElementById('party-room-section'),
            partyFriendsSection: document.getElementById('party-friends-section'),
            partyStatus: document.getElementById('party-status'),
            partyJoinLockBtn: document.getElementById('party-join-lock-btn'),
            partyJoinLockIcon: document.getElementById('party-join-lock-icon'),
            partyJoinLockNote: document.getElementById('party-join-lock-note'),
            leavePartyBtn: document.getElementById('leave-party-btn'),
            socialPartyMembers: document.getElementById('social-party-members'),
            privateRoomStatus: document.getElementById('private-room-status'),
            createRoomBtn: document.getElementById('create-private-room-btn'),
            privateRoomInput: document.getElementById('private-room-input'),
            joinPrivateRoomBtn: document.getElementById('join-private-room-btn'),
            roomSharePanel: document.getElementById('room-share-panel'),
            roomShareCode: document.getElementById('room-share-code'),
            copyRoomCodeBtn: document.getElementById('copy-room-code-btn'),
            privateRoomView: document.getElementById('private-room-view'),
            privateRoomSummary: document.getElementById('private-room-summary'),
            privateRoomModeFfaBtn: document.getElementById('private-room-mode-ffa-btn'),
            privateRoomModeTdmBtn: document.getElementById('private-room-mode-tdm-btn'),
            privateRoomModeLmsBtn: document.getElementById('private-room-mode-lms-btn'),
            privateRoomRandomizeBtn: document.getElementById('private-room-randomize-btn'),
            privateRoomStartBtn: document.getElementById('private-room-start-btn'),
            privateRoomEnterBtn: document.getElementById('private-room-enter-btn'),
            privateRoomUnassigned: document.getElementById('private-room-unassigned'),
            privateRoomTeamAlpha: document.getElementById('private-room-team-alpha'),
            privateRoomTeamBravo: document.getElementById('private-room-team-bravo'),
            friendIdInput: document.getElementById('friend-id-input'),
            addFriendBtn: document.getElementById('add-friend-btn'),
            friendsStatus: document.getElementById('friends-status'),
            friendsFilterJoinableBtn: document.getElementById('friends-filter-joinable-btn'),
            friendsFilterOnlineBtn: document.getElementById('friends-filter-online-btn'),
            friendsFilterAllBtn: document.getElementById('friends-filter-all-btn'),
            friendsPreview: document.getElementById('friends-preview'),
            refreshFriendsBtn: document.getElementById('refresh-friends-btn')
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
            patchState({ activeSurface: surfaceId === 'party' ? 'party' : 'main' });
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

        function openUtility() {
            patchState({ utilityOpen: true });
        }

        function closeUtility() {
            patchState({ utilityOpen: false });
        }

        function openJoinPopover() {
            patchState({ joinPopoverOpen: true, joinRecent: readRecentJoinTargets() });
        }

        function closeJoinPopover() {
            patchState({ joinPopoverOpen: false });
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

            return lobbyApi.requestJson(lobbyApi.matchmakingPath(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'quick',
                    gameMode: mode
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

        function renderPartyMembers(state) {
            if (!elements.socialPartyMembers) return;
            elements.socialPartyMembers.innerHTML = '';
            var partyState = state.party;
            if (!partyState || !partyState.party || !Array.isArray(partyState.party.members) || !partyState.party.members.length) {
                var empty = document.createElement('div');
                empty.className = 'party-preview-empty';
                empty.textContent = 'No one is in your party yet.';
                elements.socialPartyMembers.appendChild(empty);
                return;
            }

            for (var i = 0; i < partyState.party.members.length; i++) {
                var member = partyState.party.members[i];
                var row = document.createElement('div');
                row.className = 'party-modal-row' + (member.isLeader ? ' leader' : '');

                var main = document.createElement('div');
                main.className = 'party-modal-main';
                var name = document.createElement('div');
                name.className = 'party-modal-name';
                name.textContent = String(member.displayName || member.id || 'Player');
                main.appendChild(name);

                var meta = document.createElement('div');
                meta.className = 'party-modal-meta';
                meta.textContent = member.isLeader ? 'Host' : String(member.id || '');
                main.appendChild(meta);
                row.appendChild(main);

                elements.socialPartyMembers.appendChild(row);
            }
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

        function renderFriends(state) {
            if (!elements.friendsPreview) return;
            elements.friendsPreview.innerHTML = '';

            if (!state.utilities.isLoggedIn) {
                var loginPrompt = document.createElement('div');
                loginPrompt.className = 'party-preview-empty';
                loginPrompt.textContent = 'Log in to save friends.';
                elements.friendsPreview.appendChild(loginPrompt);
                return;
            }

            var friendsState = state.friends || { friends: [] };
            if (!Array.isArray(friendsState.friends) || !friendsState.friends.length) {
                var empty = document.createElement('div');
                empty.className = 'party-preview-empty';
                empty.textContent = 'No saved friends yet.';
                elements.friendsPreview.appendChild(empty);
                return;
            }

            var friends = filteredFriends(friendsState.friends, state.friendsFilter);
            if (!friends.length) {
                var noMatch = document.createElement('div');
                noMatch.className = 'party-preview-empty';
                noMatch.textContent = 'No friends match this filter.';
                elements.friendsPreview.appendChild(noMatch);
                return;
            }

            for (var i = 0; i < friends.length; i++) {
                var friend = friends[i];
                var line = document.createElement('div');
                line.className = 'friend-modal-row';
                var row = document.createElement('div');
                row.className = 'friend-preview-row';

                var main = document.createElement('div');
                main.className = 'friend-preview-main';
                var name = document.createElement('div');
                name.className = 'friend-preview-name';
                name.textContent = String(friend.displayName || friend.username || friend.userId || 'Friend');
                main.appendChild(name);
                var meta = document.createElement('div');
                meta.className = 'friend-preview-meta';
                meta.textContent = friendActivityCopy(friend);
                main.appendChild(meta);
                row.appendChild(main);

                var actions = document.createElement('div');
                actions.className = 'friend-preview-actions';
                if (friend.incomingInvite) {
                    appendFriendAction(actions, 'Accept Invite', 'friend-preview-btn', busy(), (function (targetUserId) {
                        return function () {
                            if (!session || !session.performFriendAction) return;
                            session.performFriendAction('accept_invite', targetUserId, 'Joining invited party...', 'Joined party.');
                        };
                    })(String(friend.userId || '')));
                } else {
                    if (friend.canJoin) {
                        appendFriendAction(actions, 'Join', 'friend-preview-btn join', busy(), (function (targetUserId) {
                            return function () {
                                if (!session || !session.performFriendAction) return;
                                session.performFriendAction('join', targetUserId, 'Joining friend...', 'Joined friend.');
                            };
                        })(String(friend.userId || '')));
                    }
                    if (friend.canInvite && !friend.sameParty) {
                        appendFriendAction(actions, friend.outgoingInvite ? 'Invited' : 'Invite', 'friend-preview-btn secondary', busy() || !!friend.outgoingInvite, (function (targetUserId) {
                            return function () {
                                if (!session || !session.performFriendAction) return;
                                session.performFriendAction('invite', targetUserId, 'Sending invite...', 'Invite sent.');
                            };
                        })(String(friend.userId || '')));
                    }
                }

                row.appendChild(actions);
                line.appendChild(row);
                elements.friendsPreview.appendChild(line);
            }
        }

        function renderJoinRecent(state) {
            if (!elements.joinPartyRecent) return;
            elements.joinPartyRecent.innerHTML = '';
            var recent = Array.isArray(state.joinRecent) ? state.joinRecent : [];
            if (!recent.length) return;
            for (var i = 0; i < recent.length; i++) {
                var btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'join-recent-btn';
                btn.textContent = recent[i];
                btn.addEventListener('click', (function (targetId) {
                    return function () {
                        if (elements.partyIdInput) elements.partyIdInput.value = targetId;
                    };
                })(recent[i]));
                elements.joinPartyRecent.appendChild(btn);
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
            if (elements.createRoomBtn) elements.createRoomBtn.hidden = hasRoom;
            if (elements.privateRoomInput) elements.privateRoomInput.hidden = hasRoom;
            if (elements.joinPrivateRoomBtn) elements.joinPrivateRoomBtn.hidden = hasRoom;
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
            if (elements.privateRoomRandomizeBtn) elements.privateRoomRandomizeBtn.disabled = busy() || !caps.canRandomizeTeams;

            if (privateRoomViewController && privateRoomViewController.applyState) {
                privateRoomViewController.applyState(privateRoomState);
            }
        }

        function renderFeedback(state) {
            var text = '';
            var error = false;
            if (state.activeSurface === 'party') {
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
                text = state.launch.message || '';
                error = !!state.launch.error;
            }
            if (!elements.menuFeedback) return;
            elements.menuFeedback.textContent = text;
            elements.menuFeedback.hidden = !text;
            elements.menuFeedback.classList.toggle('error', !!error);
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
            var headerVariant = paused ? 'pause' : (state.activeSurface === 'party' ? 'party' : 'home');

            if (elements.menuHeader) elements.menuHeader.setAttribute('data-variant', headerVariant);

            if (elements.menuReturnBtn) elements.menuReturnBtn.hidden = headerVariant !== 'pause' || showSessionStrip;
            if (elements.partyBackBtn) elements.partyBackBtn.hidden = headerVariant !== 'party';
            if (elements.accountToggleBtn) elements.accountToggleBtn.hidden = headerVariant !== 'home' || loggedIn;
            if (elements.menuPartyIdBtn) elements.menuPartyIdBtn.hidden = false;
            if (elements.joinPartyTriggerBtn) elements.joinPartyTriggerBtn.hidden = headerVariant !== 'home';
            if (elements.roomActionBtn) elements.roomActionBtn.hidden = headerVariant !== 'home';
            if (elements.openPartyBtn) elements.openPartyBtn.hidden = !(headerVariant === 'home' || headerVariant === 'pause');
            if (elements.joinPartyPopover) elements.joinPartyPopover.hidden = !state.joinPopoverOpen || headerVariant !== 'home';
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

            renderJoinRecent(state);
            renderFeedback(state);
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
                elements.roomActionBtn.textContent = hasRoom ? 'Open Room' : 'Create Room';
                elements.roomActionBtn.disabled = isBusy || paused;
            }
            if (elements.roomAccessStatus) {
                elements.roomAccessStatus.textContent = (state.activeSurface === 'main' && !paused) ? String(launch.message || '') : '';
                elements.roomAccessStatus.classList.toggle('error', !!launch.error);
                elements.roomAccessStatus.hidden = !elements.roomAccessStatus.textContent;
            }

            if (elements.screenMain) elements.screenMain.hidden = state.activeSurface !== 'main' || paused;
            if (elements.screenParty) elements.screenParty.hidden = state.activeSurface !== 'party';

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

            setStatusEl(elements.partyStatus, state.partyStatus, '#2f6fed', '#d14f45');
            setStatusEl(elements.privateRoomStatus, state.roomStatus, '#2f6fed', '#d14f45');
            setStatusEl(elements.friendsStatus, state.friendsStatus, '#2f6fed', '#d14f45');

            if (elements.partyJoinLockBtn) {
                elements.partyJoinLockBtn.disabled = isBusy || !caps.canTogglePartyJoinLock;
                elements.partyJoinLockBtn.classList.toggle('locked', !!caps.partyJoinLocked);
                elements.partyJoinLockBtn.setAttribute('aria-pressed', caps.partyJoinLocked ? 'true' : 'false');
            }
            setText(elements.partyJoinLockIcon, caps.partyJoinLocked ? '[#]' : '[ ]');
            setText(elements.partyJoinLockNote, caps.partyJoinLockNote || 'Party Open');
            if (elements.leavePartyBtn) elements.leavePartyBtn.disabled = isBusy || !caps.canLeaveParty;

            if (elements.friendIdInput) elements.friendIdInput.disabled = isBusy || !state.utilities.isLoggedIn;
            if (elements.addFriendBtn) elements.addFriendBtn.disabled = isBusy || !state.utilities.isLoggedIn;
            if (elements.refreshFriendsBtn) elements.refreshFriendsBtn.disabled = isBusy || !state.utilities.isLoggedIn;
            if (elements.friendsFilterJoinableBtn) elements.friendsFilterJoinableBtn.classList.toggle('active', state.friendsFilter === 'joinable');
            if (elements.friendsFilterOnlineBtn) elements.friendsFilterOnlineBtn.classList.toggle('active', state.friendsFilter === 'online');
            if (elements.friendsFilterAllBtn) elements.friendsFilterAllBtn.classList.toggle('active', state.friendsFilter === 'all');
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

        function maybeWarnUnevenTeams() {
            var room = getState().privateRoom && getState().privateRoom.room;
            if (!room || String(room.roomMode || '') !== 'tdm') return;
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
            }
        }) : null;

        bindClick(elements.menuPartyIdBtn, function () {
            var value = elements.menuPartyIdValue ? elements.menuPartyIdValue.textContent : '';
            copyText(
                value,
                function () {
                    setPartyStatus('ID copied.', false);
                    render();
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

        bindClick(elements.joinPartyTriggerBtn, function () {
            if (getState().joinPopoverOpen) closeJoinPopover();
            else openJoinPopover();
            render();
            if (elements.partyIdInput && getState().joinPopoverOpen) elements.partyIdInput.focus();
        });
        bindClick(elements.joinPartyBtn, function () {
            var targetId = elements.partyIdInput ? String(elements.partyIdInput.value || '').trim() : '';
            if (!targetId) {
                setPartyStatus('Enter a friend ID.', true);
                render();
                return;
            }
            if (!session || !session.runPartyAction) return;
            session.runPartyAction('join', { targetId: targetId }, 'Joining friend...');
            patchState({ joinRecent: writeRecentJoinTarget(targetId), joinPopoverOpen: false });
            render();
        });
        bindEnter(elements.partyIdInput, function () {
            if (elements.joinPartyBtn) elements.joinPartyBtn.click();
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

        bindClick(elements.openPartyBtn, function () {
            if (getState().paused) {
                setActiveSurface(getState().activeSurface === 'party' ? 'main' : 'party');
            } else {
                setActiveSurface('party');
            }
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
                setActiveSurface('party');
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
                    setActiveSurface('party');
                    render();
                });
        });

        bindClick(elements.partyJoinLockBtn, function () {
            var partyState = getState().party;
            if (!partyState || !partyState.party || !partyState.party.isLeader || !session || !session.runPartyAction) return;
            session.runPartyAction('lock', { locked: !partyState.party.joinLocked }, 'Updating party...');
        });
        bindClick(elements.leavePartyBtn, function () {
            if (!session || !session.runPartyAction) return;
            session.runPartyAction('leave', {}, 'Leaving party...');
        });

        bindClick(elements.createRoomBtn, function () {
            if (!session || !session.createPrivateRoom || busy()) return;
            session.createPrivateRoom().then(function () {
                var seedMode = selectedModeForRoomSeed(getState().launch.selectedMode);
                if (seedMode && session && session.setPrivateRoomMode) {
                    return session.setPrivateRoomMode(seedMode);
                }
                return null;
            });
        });
        bindClick(elements.joinPrivateRoomBtn, function () {
            var roomCode = elements.privateRoomInput ? String(elements.privateRoomInput.value || '').trim() : '';
            if (!roomCode) {
                setRoomStatus('Enter a room code.', true);
                render();
                return;
            }
            if (!session || !session.joinPrivateRoom || busy()) return;
            session.joinPrivateRoom(roomCode).then(function () {
                setActiveSurface('party');
                render();
            });
        });
        bindEnter(elements.privateRoomInput, function () {
            if (elements.joinPrivateRoomBtn) elements.joinPrivateRoomBtn.click();
        });

        bindClick(elements.copyRoomCodeBtn, function () {
            var value = elements.roomShareCode ? elements.roomShareCode.textContent : '';
            copyText(
                value,
                function () { setRoomStatus('Room code copied.', false); render(); },
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
            writeReturnState({ activeSurface: 'party', selectedMode: room.roomMode || getState().launch.selectedMode });
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

        bindClick(elements.addFriendBtn, function () {
            var targetUserId = elements.friendIdInput ? String(elements.friendIdInput.value || '').trim() : '';
            if (!targetUserId) {
                setFriendsStatus('Enter a friend user ID.', true);
                render();
                return;
            }
            if (!session || !session.performFriendAction) return;
            session.performFriendAction('add', targetUserId, 'Saving friend...', 'Friend saved.');
        });
        bindEnter(elements.friendIdInput, function () {
            if (elements.addFriendBtn) elements.addFriendBtn.click();
        });
        bindClick(elements.refreshFriendsBtn, function () {
            if (session && session.refreshFriendsState) session.refreshFriendsState(false);
        });
        bindClick(elements.friendsFilterJoinableBtn, function () {
            patchState({ friendsFilter: 'joinable' });
            render();
        });
        bindClick(elements.friendsFilterOnlineBtn, function () {
            patchState({ friendsFilter: 'online' });
            render();
        });
        bindClick(elements.friendsFilterAllBtn, function () {
            patchState({ friendsFilter: 'all' });
            render();
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
                if (getState().joinPopoverOpen && elements.joinPartyPopover && !isNodeWithin(event.target, elements.joinPartyPopover) && event.target !== elements.joinPartyTriggerBtn) {
                    closeJoinPopover();
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
            if (getState().joinPopoverOpen) {
                closeJoinPopover();
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
