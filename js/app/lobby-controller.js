/**
 * lobby-controller.js - Menu, party, and private-room orchestration.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameLobbyController
 */
(function () {
    'use strict';

    var GameLobbyController = {};
    var initialized = false;

    function runtimeProfile() {
        return globalThis.__MAYHEM_RUNTIME.GameRuntimeProfile || null;
    }

    function availableModes() {
        var runtime = runtimeProfile();
        if (!runtime || !runtime.getAvailableModes) return [];
        return runtime.getAvailableModes() || [];
    }

    function requestedModeId() {
        var runtime = runtimeProfile();
        if (runtime && runtime.getRequestedModeId) return runtime.getRequestedModeId();
        return '';
    }

    function runtimeModeUi() {
        return globalThis.__MAYHEM_RUNTIME.GameRuntimeModeUi || null;
    }

    function roomCodeFromRoomId(roomId) {
        var modeUi = runtimeModeUi();
        if (modeUi && modeUi.roomCodeFromRoomId) {
            return modeUi.roomCodeFromRoomId(roomId);
        }
        return String(roomId || '').toUpperCase();
    }

    GameLobbyController.init = function (options) {
        if (initialized) return;
        initialized = true;
        options = options || {};

        var runtime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
        var lobbyApi = runtime.GameLobbyApi;
        var authApi = runtime.GameNetAuth || null;
        var modalManager = runtime.GameModalManager || null;
        var sessionFactory = runtime.GameLobbySession || null;
        var clickablesApi = runtime.GameLobbyClickables || null;

        var modeButtonsWrap = document.getElementById('mode-buttons');
        var altModeToggle = document.getElementById('alt-mode-toggle');
        var controlsMenu = document.getElementById('controls-menu');
        var controlsToggle = document.getElementById('controls-toggle');
        var primaryPlayBtn = document.getElementById('primary-play-btn');
        var tdmPlayBtn = document.getElementById('tdm-play-btn');
        var lmsPlayBtn = document.getElementById('lms-play-btn');
        var sandboxPlayBtn = document.getElementById('sandbox-play-btn');
        var sandboxModeCycleBtn = document.getElementById('sandbox-mode-cycle-btn');
        var sandboxRulesetPanel = document.getElementById('sandbox-ruleset-panel');
        var sandboxFfaBtn = document.getElementById('sandbox-ffa-btn');
        var sandboxLmsBtn = document.getElementById('sandbox-lms-btn');
        var createRoomBtn = document.getElementById('create-private-room-btn');
        var privateRoomInput = document.getElementById('private-room-input');
        var joinPrivateRoomBtn = document.getElementById('join-private-room-btn');
        var roomAccessStatus = document.getElementById('room-access-status');
        var roomSharePanel = document.getElementById('room-share-panel');
        var roomShareCode = document.getElementById('room-share-code');
        var copyRoomCodeBtn = document.getElementById('copy-room-code-btn');
        var roomCodeBadge = document.getElementById('room-code-badge');
        var roomCodeBadgeValue = document.getElementById('room-code-badge-value');
        var modeButtons = Array.prototype.slice.call(document.querySelectorAll('#mode-buttons .mode-btn[data-mode-id]'));
        var modeSubtitle = document.getElementById('mode-subtitle');
        var menuPartyIdBtn = document.getElementById('menu-party-id-btn');
        var menuPartyIdLabel = document.getElementById('menu-party-id-label');
        var menuPartyIdValue = document.getElementById('menu-party-id-value');
        var partyJoinLockBtn = document.getElementById('party-join-lock-btn');
        var partyJoinLockIcon = document.getElementById('party-join-lock-icon');
        var partyJoinLockNote = document.getElementById('party-join-lock-note');
        var socialTabPartyBtn = document.getElementById('social-tab-party-btn');
        var socialTabFriendsBtn = document.getElementById('social-tab-friends-btn');
        var socialTabRoomBtn = document.getElementById('social-tab-room-btn');
        var partyPanelSubtitle = document.getElementById('party-panel-subtitle');
        var partyIdInput = document.getElementById('party-id-input');
        var joinPartyBtn = document.getElementById('join-party-btn');
        var partyStatusEl = document.getElementById('party-status');
        var partyRosterPreviewShell = document.getElementById('party-roster-preview-shell');
        var partyRosterPreview = document.getElementById('party-roster-preview');
        var viewPartyBtn = document.getElementById('view-party-btn');
        var leavePartyBtn = document.getElementById('leave-party-btn');
        var partySocialView = document.getElementById('party-social-view');
        var friendsSocialView = document.getElementById('friends-social-view');
        var friendsStatusEl = document.getElementById('friends-status');
        var friendIdInput = document.getElementById('friend-id-input');
        var addFriendBtn = document.getElementById('add-friend-btn');
        var friendsFilterJoinableBtn = document.getElementById('friends-filter-joinable-btn');
        var friendsFilterOnlineBtn = document.getElementById('friends-filter-online-btn');
        var friendsFilterAllBtn = document.getElementById('friends-filter-all-btn');
        var friendsPreview = document.getElementById('friends-preview');
        var viewFriendsBtn = document.getElementById('view-friends-btn');
        var refreshFriendsBtn = document.getElementById('refresh-friends-btn');
        var friendsOverlay = document.getElementById('friends-overlay');
        var friendsCloseBtn = document.getElementById('friends-close-btn');
        var friendsModalContent = document.getElementById('friends-modal-content');
        var partyRosterOverlay = document.getElementById('party-roster-overlay');
        var partyRosterModalContent = document.getElementById('party-roster-modal-content');
        var partyRosterCloseBtn = document.getElementById('party-roster-close-btn');
        var privateRoomView = document.getElementById('private-room-view');
        var privateRoomStatusEl = document.getElementById('private-room-status');
        var privateRoomSummaryEl = document.getElementById('private-room-summary');
        var privateRoomModeFfaBtn = document.getElementById('private-room-mode-ffa-btn');
        var privateRoomModeTdmBtn = document.getElementById('private-room-mode-tdm-btn');
        var privateRoomModeLmsBtn = document.getElementById('private-room-mode-lms-btn');
        var privateRoomRandomizeBtn = document.getElementById('private-room-randomize-btn');
        var privateRoomStartBtn = document.getElementById('private-room-start-btn');
        var privateRoomTeamAlpha = document.getElementById('private-room-team-alpha');
        var privateRoomTeamBravo = document.getElementById('private-room-team-bravo');

        var started = false;
        var startPending = false;
        var sandboxWarmPromise = null;
        var sandboxRuntimeReady = !(runtime.GameRuntimeLoader && runtime.GameRuntimeLoader.loadGameplayRuntime);
        var selectedSandboxMode = 'ffa';
        var partyView = null;
        var friendsView = null;
        var privateRoomViewController = null;
        var session = null;

        if (typeof options.prepareMenu === 'function') {
            options.prepareMenu();
        }

        function noop() {}

        function currentPartyIdentity() {
            if (authApi && authApi.getPartyIdentity) return authApi.getPartyIdentity();
            return null;
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

        function currentAccountUserId() {
            var user = currentAccountUser();
            return user && user.id ? String(user.id) : '';
        }

        function currentAccountHandle() {
            var user = currentAccountUser();
            if (!user) return '';
            return String(user.displayName || user.username || user.id || '');
        }

        function setRoomAccessStatus(text, isErr) {
            if (!roomAccessStatus) return;
            roomAccessStatus.textContent = text || '';
            roomAccessStatus.style.color = isErr ? '#ff9797' : '#98f5b6';
        }

        function setPartyStatus(text, isErr) {
            if (!partyStatusEl) return;
            partyStatusEl.textContent = text || '';
            partyStatusEl.style.color = isErr ? '#ff9f9f' : '#ffcfb4';
        }

        function setFriendsStatus(text, isErr) {
            if (!friendsStatusEl) return;
            friendsStatusEl.textContent = text || '';
            friendsStatusEl.style.color = isErr ? '#ffb0b0' : '#ffd1d1';
        }

        function setPrivateRoomStatus(text, isErr) {
            if (privateRoomViewController && privateRoomViewController.setStatus) {
                privateRoomViewController.setStatus(text, isErr);
                return;
            }
            if (!privateRoomStatusEl) return;
            privateRoomStatusEl.textContent = text || '';
            privateRoomStatusEl.style.color = isErr ? '#ffb3a6' : '#ffd7af';
        }

        var lobbyUiFactory = runtime.GameLobbyControllerUi;
        if (!lobbyUiFactory || !lobbyUiFactory.create) {
            throw new Error('GameLobbyControllerUi is required before GameLobbyController.init.');
        }
        var lobbyUi = lobbyUiFactory.create({
            elements: {
                modeButtonsWrap: modeButtonsWrap,
                altModeToggle: altModeToggle,
                controlsMenu: controlsMenu,
                controlsToggle: controlsToggle,
                primaryPlayBtn: primaryPlayBtn,
                tdmPlayBtn: tdmPlayBtn,
                lmsPlayBtn: lmsPlayBtn,
                sandboxPlayBtn: sandboxPlayBtn,
                sandboxRulesetPanel: sandboxRulesetPanel,
                sandboxFfaBtn: sandboxFfaBtn,
                sandboxLmsBtn: sandboxLmsBtn,
                createRoomBtn: createRoomBtn,
                joinPrivateRoomBtn: joinPrivateRoomBtn,
                privateRoomInput: privateRoomInput,
                joinPartyBtn: joinPartyBtn,
                partyIdInput: partyIdInput,
                socialTabPartyBtn: socialTabPartyBtn,
                socialTabFriendsBtn: socialTabFriendsBtn,
                socialTabRoomBtn: socialTabRoomBtn,
                partySocialView: partySocialView,
                friendsSocialView: friendsSocialView,
                privateRoomView: privateRoomView,
                viewPartyBtn: viewPartyBtn,
                leavePartyBtn: leavePartyBtn,
                partyJoinLockBtn: partyJoinLockBtn,
                partyJoinLockIcon: partyJoinLockIcon,
                partyJoinLockNote: partyJoinLockNote,
                viewFriendsBtn: viewFriendsBtn,
                refreshFriendsBtn: refreshFriendsBtn,
                addFriendBtn: addFriendBtn,
                friendIdInput: friendIdInput,
                friendsFilterJoinableBtn: friendsFilterJoinableBtn,
                friendsFilterOnlineBtn: friendsFilterOnlineBtn,
                friendsFilterAllBtn: friendsFilterAllBtn,
                privateRoomModeFfaBtn: privateRoomModeFfaBtn,
                privateRoomModeTdmBtn: privateRoomModeTdmBtn,
                privateRoomModeLmsBtn: privateRoomModeLmsBtn,
                privateRoomRandomizeBtn: privateRoomRandomizeBtn,
                privateRoomStartBtn: privateRoomStartBtn,
                modeButtons: modeButtons
            },
            isSessionBusy: function () {
                return !!(session && session.isBusy && session.isBusy());
            },
            getCapabilities: function () {
                return session && session.getCapabilities ? session.getCapabilities() : {
                    hasParty: false,
                    partyMemberCount: 0,
                    canTogglePartyJoinLock: false,
                    partyJoinLocked: false,
                    partyJoinLockTitle: 'Party join lock unavailable.',
                    partyJoinLockNote: 'JOINS OPEN',
                    canViewPartyRoster: false,
                    canLeaveParty: false,
                    hasPrivateRoom: false,
                    privateRoomPhase: '',
                    privateRoomMode: '',
                    canEditPrivateRoom: false,
                    canRandomizeTeams: false,
                    canStartPrivateRoom: false
                };
            },
            hasPrivateRoom: function () {
                return !!(session && session.hasPrivateRoomState && session.hasPrivateRoomState());
            },
            isLoggedIn: isLoggedIn,
            isSandboxRuntimeReady: function () {
                return sandboxRuntimeReady;
            },
            getAvailableModes: availableModes,
            setRoomAccessStatus: setRoomAccessStatus,
            setFriendsStatus: setFriendsStatus
        });

        function isUiBusy() {
            return lobbyUi.isUiBusy();
        }

        function warmSandboxRuntime() {
            var loader = runtime.GameRuntimeLoader;
            if (!loader || !loader.loadGameplayRuntime) {
                sandboxRuntimeReady = true;
                lobbyUi.syncMenuControlState();
                return Promise.resolve(null);
            }
            if (loader.isGameplayRuntimeReady && loader.isGameplayRuntimeReady()) {
                sandboxRuntimeReady = true;
                lobbyUi.syncMenuControlState();
                return Promise.resolve(runtime.GameMain || null);
            }
            if (sandboxWarmPromise) return sandboxWarmPromise;

            sandboxRuntimeReady = false;
            lobbyUi.syncMenuControlState();
            sandboxWarmPromise = loader.loadGameplayRuntime()
                .then(function (gameMain) {
                    sandboxRuntimeReady = !!(gameMain && gameMain.launchModeById);
                    lobbyUi.syncMenuControlState();
                    return gameMain || null;
                })
                .catch(function (err) {
                    sandboxRuntimeReady = false;
                    lobbyUi.syncMenuControlState();
                    throw err;
                })
                .finally(function () {
                    sandboxWarmPromise = null;
                });
            return sandboxWarmPromise;
        }

        function normalizeSandboxMode(mode) {
            return String(mode || '').toLowerCase() === 'lms' ? 'lms' : 'ffa';
        }

        function syncSandboxSelectionUi() {
            var mode = normalizeSandboxMode(selectedSandboxMode);
            if (sandboxPlayBtn) {
                sandboxPlayBtn.textContent = mode === 'lms' ? 'OFFLINE SANDBOX :: LMS' : 'OFFLINE SANDBOX :: FFA';
            }
            if (sandboxModeCycleBtn) {
                sandboxModeCycleBtn.title = mode === 'lms'
                    ? 'Sandbox selector. Current ruleset: LMS.'
                    : 'Sandbox selector. Current ruleset: FFA.';
            }
            if (sandboxFfaBtn) sandboxFfaBtn.classList.toggle('active', mode === 'ffa');
            if (sandboxLmsBtn) sandboxLmsBtn.classList.toggle('active', mode === 'lms');
        }

        function setSelectedSandboxMode(mode, silent) {
            selectedSandboxMode = normalizeSandboxMode(mode);
            syncSandboxSelectionUi();
            if (!silent) {
                setRoomAccessStatus(
                    selectedSandboxMode === 'lms' ? 'Sandbox ruleset set to LMS.' : 'Sandbox ruleset set to FFA.',
                    false
                );
            }
        }

        function setPrivateRoomShare(roomId) {
            if (!roomSharePanel || !roomShareCode) return;
            if (!roomId) {
                roomSharePanel.hidden = true;
                roomShareCode.textContent = '------';
                if (roomCodeBadge && roomCodeBadgeValue) {
                    roomCodeBadge.hidden = true;
                    roomCodeBadgeValue.textContent = '------';
                }
                return;
            }
            var roomCode = roomCodeFromRoomId(roomId);
            roomShareCode.textContent = roomCode;
            roomSharePanel.hidden = false;
            if (roomCodeBadge && roomCodeBadgeValue) {
                roomCodeBadgeValue.textContent = roomCode;
                roomCodeBadge.hidden = false;
            }
        }

        function updateSocialSubtitle() {
            if (!partyPanelSubtitle) return;
            var user = currentAccountUser();
            if (!user) {
                partyPanelSubtitle.textContent = 'Log in to save friends, invite them later, or quick-join mutuals.';
                return;
            }
            var label = currentAccountHandle() || String(user.username || user.id || 'PLAYER');
            partyPanelSubtitle.textContent = 'Signed in as ' + String(label).toUpperCase() + '. Friends persist with this profile.';
        }

        function updatePartyIdentityDisplay() {
            var identity = currentPartyIdentity();
            if (!menuPartyIdBtn || !menuPartyIdLabel || !menuPartyIdValue || !identity) return;
            menuPartyIdLabel.textContent = String(identity.label || 'PLAYER ID');
            menuPartyIdValue.textContent = String(identity.id || '------').toUpperCase();
            menuPartyIdBtn.title = 'Copy ' + String(identity.label || 'ID');
        }

        function friendEntryByUserId(userId) {
            var friendsState = session && session.getFriendsState ? session.getFriendsState() : null;
            if (!friendsState || !Array.isArray(friendsState.friends)) return null;
            for (var i = 0; i < friendsState.friends.length; i++) {
                if (String(friendsState.friends[i].userId || '') === String(userId || '')) return friendsState.friends[i];
            }
            return null;
        }

        function memberCanBeFriended(member) {
            if (!isLoggedIn()) return false;
            if (!member || !member.isAccount || !member.accountUserId) return false;
            if (String(member.accountUserId || '') === currentAccountUserId()) return false;
            return !friendEntryByUserId(member.accountUserId);
        }

        function renderPartyRosterModal() {
            if (partyView && partyView.renderModal) partyView.renderModal();
        }

        function renderFriendsModal() {
            if (friendsView && friendsView.renderModal) friendsView.renderModal();
        }

        if (modalManager && partyRosterOverlay) {
            modalManager.register('party-roster', {
                element: partyRosterOverlay,
                initialFocus: partyRosterCloseBtn || partyRosterOverlay,
                restoreFocus: viewPartyBtn || null
            });
        }

        if (modalManager && friendsOverlay) {
            modalManager.register('friends', {
                element: friendsOverlay,
                initialFocus: friendsCloseBtn || friendsOverlay,
                restoreFocus: viewFriendsBtn || null
            });
        }

        session = sessionFactory && sessionFactory.create ? sessionFactory.create({
            lobbyApi: lobbyApi,
            authApi: authApi,
            getActivityState: function () {
                if (typeof options.getActivityState === 'function') return options.getActivityState();
                return 'menu';
            },
            setPartyStatus: setPartyStatus,
            setFriendsStatus: setFriendsStatus,
            setPrivateRoomStatus: setPrivateRoomStatus,
            onBusyChange: function (busy, message) {
                if (busy) setRoomAccessStatus(message || 'Working...', false);
                lobbyUi.syncMenuControlState();
            },
            onPartyIdentityChange: updatePartyIdentityDisplay,
            onSocialUpdate: updateSocialSubtitle,
            onPartyStateChanged: function (nextState) {
                if (partyView && partyView.applyState) partyView.applyState(nextState);
                updatePartyIdentityDisplay();
                lobbyUi.syncMenuControlState();
            },
            onPartyUnavailable: function (message) {
                if (partyView && partyView.setUnavailable) partyView.setUnavailable(message);
                lobbyUi.syncMenuControlState();
            },
            onFriendsStateChanged: function (nextState) {
                if (friendsView && friendsView.applyState) friendsView.applyState(nextState);
                lobbyUi.syncMenuControlState();
            },
            onFriendsUnavailable: function (message) {
                if (friendsView && friendsView.setUnavailable) friendsView.setUnavailable(message);
                lobbyUi.syncMenuControlState();
            },
            onPrivateRoomStateChanged: function (nextState, meta) {
                var previousState = meta && meta.previousState ? meta.previousState : null;
                var hadLoadedPrivateRoom = !!(previousState && previousState.room);
                var hasLoadedPrivateRoom = !!(nextState && nextState.room);
                var hasPrivateRoom = session && session.hasPrivateRoomState && session.hasPrivateRoomState();

                if (!hasPrivateRoom && lobbyUi.getSocialView() === 'room') {
                    lobbyUi.setSocialView('party');
                } else if (!hadLoadedPrivateRoom && hasLoadedPrivateRoom) {
                    lobbyUi.setSocialView('room');
                }

                if (privateRoomViewController && privateRoomViewController.applyState) {
                    privateRoomViewController.applyState(nextState);
                }
                lobbyUi.syncMenuControlState();
            },
            onPrivateRoomUnavailable: function (message) {
                if (session && session.hasPrivateRoomState && session.hasPrivateRoomState()) {
                    lobbyUi.setSocialView('room');
                }
                if (privateRoomViewController && privateRoomViewController.setUnavailable) {
                    privateRoomViewController.setUnavailable(message);
                }
                lobbyUi.syncMenuControlState();
            },
            launchAssignedPrivateRoom: function (state) {
                if (started || !state || !state.self || !state.self.privateRoom) return;
                launchMode('single_cloudflare', {
                    roomId: state.self.privateRoom.roomId,
                    gameMode: state.self.privateRoom.roomMode || 'ffa'
                });
            }
        }) : null;

        var partyViewFactory = runtime.GameLobbyPartyView;
        var friendsViewFactory = runtime.GameLobbyFriendsView;
        var privateRoomViewFactory = runtime.GameLobbyPrivateRoomView;

        partyView = partyViewFactory && partyViewFactory.create ? partyViewFactory.create({
            getState: function () { return session && session.getPartyState ? session.getPartyState() : null; },
            setState: noop,
            partyRosterPreviewShell: partyRosterPreviewShell,
            partyRosterPreview: partyRosterPreview,
            partyRosterModalContent: partyRosterModalContent,
            memberCanBeFriended: memberCanBeFriended,
            onAddFriend: function (targetUserId, targetLabel) {
                if (!session || !session.performFriendAction) return Promise.resolve(null);
                return session.performFriendAction(
                    'add',
                    targetUserId,
                    'Saving friend...',
                    'Added ' + String(targetLabel || '').toUpperCase() + ' to friends.'
                );
            },
            isRoomActionInFlight: function () { return isUiBusy(); }
        }) : null;

        friendsView = friendsViewFactory && friendsViewFactory.create ? friendsViewFactory.create({
            getState: function () { return session && session.getFriendsState ? session.getFriendsState() : { friends: [] }; },
            setState: noop,
            friendsPreview: friendsPreview,
            friendsModalContent: friendsModalContent,
            friendsFilterJoinableBtn: friendsFilterJoinableBtn,
            friendsFilterOnlineBtn: friendsFilterOnlineBtn,
            friendsFilterAllBtn: friendsFilterAllBtn,
            isLoggedIn: isLoggedIn,
            updateSocialSubtitle: updateSocialSubtitle,
            performFriendAction: function (action, targetUserId, pendingText, successText) {
                if (!session || !session.performFriendAction) return Promise.resolve(null);
                return session.performFriendAction(action, targetUserId, pendingText, successText).then(function (body) {
                    if (body && body.state) lobbyUi.setSocialView('party');
                    return body;
                });
            }
        }) : null;
        if (friendsView && friendsView.syncFilters) friendsView.syncFilters();

        privateRoomViewController = privateRoomViewFactory && privateRoomViewFactory.create ? privateRoomViewFactory.create({
            getState: function () { return session && session.getPrivateRoomState ? session.getPrivateRoomState() : null; },
            setState: noop,
            getPartyState: function () { return session && session.getPartyState ? session.getPartyState() : null; },
            privateRoomStatusEl: privateRoomStatusEl,
            privateRoomSummaryEl: privateRoomSummaryEl,
            privateRoomTeamAlpha: privateRoomTeamAlpha,
            privateRoomTeamBravo: privateRoomTeamBravo,
            moveMember: function (memberId, nextTeamId) {
                if (!session || !session.movePrivateRoomMember) return Promise.resolve(null);
                return session.movePrivateRoomMember(memberId, nextTeamId);
            }
        }) : null;

        function handleLaunchResult(result) {
            startPending = false;
            if (!result || !result.ok) {
                setRoomAccessStatus((result && result.error) ? result.error : 'Mode launch failed.', true);
                lobbyUi.restoreStartUi();
                return false;
            }
            started = true;
            lobbyUi.hideStartUi();
            if (modeSubtitle) {
                var modeUi = runtimeModeUi();
                modeSubtitle.textContent = modeUi && modeUi.startupSubtitleForMode
                    ? modeUi.startupSubtitleForMode(result.mode)
                    : '';
            }
            if (typeof options.setRuntimeIndicator === 'function') {
                options.setRuntimeIndicator(result.mode);
            }
            if (runtime.GameSession && runtime.GameSession.showGameplayPrompt) {
                runtime.GameSession.showGameplayPrompt();
            }
            return true;
        }

        function launchMode(modeId, launchOptions, triggerEvent) {
            if (started || startPending) return Promise.resolve(false);
            startPending = true;
            var result = options.launchModeById ? options.launchModeById(modeId, launchOptions || {}) : { ok: false, error: 'Launch unavailable.' };
            if (result && typeof result.then === 'function') {
                return result
                    .then(function (payload) {
                        if (!handleLaunchResult(payload)) return false;
                        if (triggerEvent && runtime.GameSession && runtime.GameSession.startGameplayFromMenu) {
                            runtime.GameSession.startGameplayFromMenu(triggerEvent);
                        }
                        return true;
                    })
                    .catch(function (err) {
                        startPending = false;
                        setRoomAccessStatus((err && err.message) ? err.message : 'Mode launch failed.', true);
                        lobbyUi.restoreStartUi();
                        return false;
                    });
            }
            if (!handleLaunchResult(result)) return Promise.resolve(false);
            if (triggerEvent && runtime.GameSession && runtime.GameSession.startGameplayFromMenu) {
                runtime.GameSession.startGameplayFromMenu(triggerEvent);
            }
            return Promise.resolve(true);
        }

        function requestMatchmaking(action, extra) {
            var payload = extra || {};
            payload.action = action;
            return lobbyApi.requestJson(lobbyApi.matchmakingPath(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        }

        function startAllocatedRoom(payload, triggerEvent) {
            if (!payload || !payload.roomId) {
                setRoomAccessStatus('Room request failed.', true);
                return;
            }
            if (payload.privacy === 'private') {
                setPrivateRoomShare(payload.roomId);
                setRoomAccessStatus('Private room ready. Share code ' + roomCodeFromRoomId(payload.roomId) + '.', false);
            } else {
                setPrivateRoomShare('');
                setRoomAccessStatus('Joined ' + String((payload.gameMode || 'ffa')).toUpperCase() + ' room ' + String(payload.roomId).toUpperCase() + '.', false);
            }
            launchMode(payload.modeId || 'cloud_multiplayer', {
                roomId: payload.roomId,
                gameMode: payload.gameMode || 'ffa'
            }, triggerEvent);
        }

        function beginRoomAction(action, extra, pendingText, triggerEvent) {
            if (isUiBusy() || started) return;
            lobbyUi.setControllerBusy(true, pendingText);
            requestMatchmaking(action, extra)
                .then(function (payload) {
                    lobbyUi.setControllerBusy(false, '');
                    startAllocatedRoom(payload, triggerEvent);
                })
                .catch(function (err) {
                    lobbyUi.setControllerBusy(false, '');
                    setRoomAccessStatus((err && err.message) ? err.message : 'Room request failed.', true);
                });
        }

        function handlePrivateRoomResult(result, successText, triggerEvent) {
            if (!result || !result.state || !result.state.room) {
                throw new Error('Private room response missing room state.');
            }
            var room = result.state.room;
            setPrivateRoomShare(room.roomId);
            setRoomAccessStatus(successText || ('Room ' + String(room.roomCode || '').toUpperCase() + ' ready.'), false);
            if (!started) {
                launchMode('single_cloudflare', {
                    roomId: room.roomId,
                    gameMode: room.roomMode || 'ffa'
                }, triggerEvent);
            }
        }

        function beginPrivateRoomCreate(triggerEvent) {
            if (isUiBusy() || started || !session || !session.createPrivateRoom) return;
            setRoomAccessStatus('Creating room...', false);
            session.createPrivateRoom()
                .then(function (result) {
                    handlePrivateRoomResult(result, 'Room ' + String(result.state.room.roomCode || '').toUpperCase() + ' ready.', triggerEvent);
                })
                .catch(function (err) {
                    setRoomAccessStatus((err && err.message) ? err.message : 'Private room creation failed.', true);
                });
        }

        function beginPrivateRoomJoin(roomCode, triggerEvent) {
            if (isUiBusy() || started || !session || !session.joinPrivateRoom) return;
            setRoomAccessStatus('Joining private room...', false);
            session.joinPrivateRoom(roomCode)
                .then(function (result) {
                    var moved = Number(result.movedCount || 0);
                    var skipped = Number(result.skippedCount || 0);
                    var message = 'Joined room ' + String(result.state.room.roomCode || '').toUpperCase() + '.';
                    if (moved > 1) message += ' Pulled ' + String(moved - 1) + ' party member' + (moved === 2 ? '' : 's') + '.';
                    if (skipped > 0) message += ' ' + String(skipped) + ' member' + (skipped === 1 ? '' : 's') + ' stayed behind.';
                    handlePrivateRoomResult(result, message, triggerEvent);
                })
                .catch(function (err) {
                    setRoomAccessStatus((err && err.message) ? err.message : 'Private room join failed.', true);
                });
        }

        function launchSandboxRuleset(gameMode, event) {
            gameMode = normalizeSandboxMode(gameMode);
            if (started || startPending) return;
            if (!sandboxRuntimeReady) {
                setRoomAccessStatus('Preparing sandbox runtime...', false);
                warmSandboxRuntime()
                    .then(function () {
                        launchSandboxRuleset(gameMode, event);
                    })
                    .catch(function (err) {
                        setRoomAccessStatus((err && err.message) ? err.message : 'Sandbox failed to load.', true);
                    });
                return;
            }

            startPending = true;
            var result = options.launchModeById
                ? options.launchModeById('single_full_sandbox', { gameMode: gameMode })
                : { ok: false, error: 'Launch unavailable.' };

            if (result && typeof result.then === 'function') {
                result
                    .then(function (payload) {
                        if (!handleLaunchResult(payload)) return;
                        if (runtime.GameSession && runtime.GameSession.startGameplayFromMenu) {
                            runtime.GameSession.startGameplayFromMenu(event);
                        }
                    })
                    .catch(function (err) {
                        startPending = false;
                        setRoomAccessStatus((err && err.message) ? err.message : 'Mode launch failed.', true);
                        lobbyUi.restoreStartUi();
                    });
                return;
            }

            if (!handleLaunchResult(result)) return;
            if (runtime.GameSession && runtime.GameSession.startGameplayFromMenu) {
                runtime.GameSession.startGameplayFromMenu(event);
            }
        }

        function launchSelectedSandbox(event) {
            launchSandboxRuleset(selectedSandboxMode, event);
        }

        lobbyUi.syncModeButtonVisibility();
        lobbyUi.setAltModesOpen(false);
        lobbyUi.setControlsOpen(false);
        lobbyUi.syncMenuControlState();
        lobbyUi.setSocialView('party');
        syncSandboxSelectionUi();
        setPrivateRoomShare('');
        updatePartyIdentityDisplay();
        updateSocialSubtitle();
        if (partyView && partyView.applyState) partyView.applyState(null);
        if (friendsView && friendsView.applyState) friendsView.applyState({ friends: [] });
        if (privateRoomViewController && privateRoomViewController.applyState) privateRoomViewController.applyState(null);
        if (session && session.refreshBackgroundState) session.refreshBackgroundState(false);
        if (session && session.start) session.start();

        if (clickablesApi && clickablesApi.bindPrivateRoomSurface) {
            clickablesApi.bindPrivateRoomSurface({
                privateRoomModeFfaBtn: privateRoomModeFfaBtn,
                privateRoomModeTdmBtn: privateRoomModeTdmBtn,
                privateRoomModeLmsBtn: privateRoomModeLmsBtn,
                privateRoomRandomizeBtn: privateRoomRandomizeBtn,
                privateRoomStartBtn: privateRoomStartBtn,
                setPrivateRoomMode: function (roomMode) {
                    if (!session || !session.setPrivateRoomMode) return Promise.resolve(null);
                    return session.setPrivateRoomMode(roomMode);
                },
                randomizePrivateRoomTeams: function () {
                    if (!session || !session.randomizePrivateRoomTeams) return Promise.resolve(null);
                    return session.randomizePrivateRoomTeams();
                },
                startPrivateRoomMatch: function () {
                    if (!session || !session.startPrivateRoomMatch) return Promise.resolve(null);
                    return session.startPrivateRoomMatch();
                }
            });
        }

        if (clickablesApi && clickablesApi.bindLaunchSurface) {
            clickablesApi.bindLaunchSurface({
                altModeToggle: altModeToggle,
                controlsToggle: controlsToggle,
                primaryPlayBtn: primaryPlayBtn,
                tdmPlayBtn: tdmPlayBtn,
                lmsPlayBtn: lmsPlayBtn,
                sandboxPlayBtn: sandboxPlayBtn,
                sandboxModeCycleBtn: sandboxModeCycleBtn,
                sandboxRulesetPanel: sandboxRulesetPanel,
                sandboxFfaBtn: sandboxFfaBtn,
                sandboxLmsBtn: sandboxLmsBtn,
                createRoomBtn: createRoomBtn,
                privateRoomInput: privateRoomInput,
                joinPrivateRoomBtn: joinPrivateRoomBtn,
                copyRoomCodeBtn: copyRoomCodeBtn,
                roomShareCode: roomShareCode,
                modeButtons: modeButtons,
                isAltModesOpen: lobbyUi.isAltModesOpen,
                setAltModesOpen: lobbyUi.setAltModesOpen,
                isControlsOpen: lobbyUi.isControlsOpen,
                setControlsOpen: lobbyUi.setControlsOpen,
                beginRoomAction: beginRoomAction,
                warmSandboxRuntime: warmSandboxRuntime,
                setRoomAccessStatus: setRoomAccessStatus,
                launchSelectedSandbox: launchSelectedSandbox,
                launchSandboxRuleset: launchSandboxRuleset,
                setSelectedSandboxMode: setSelectedSandboxMode,
                beginPrivateRoomCreate: beginPrivateRoomCreate,
                beginPrivateRoomJoin: beginPrivateRoomJoin,
                launchMode: launchMode
            });
        }

        if (clickablesApi && clickablesApi.bindSocialSurface) {
            clickablesApi.bindSocialSurface({
                menuPartyIdBtn: menuPartyIdBtn,
                menuPartyIdValue: menuPartyIdValue,
                partyIdInput: partyIdInput,
                joinPartyBtn: joinPartyBtn,
                addFriendBtn: addFriendBtn,
                friendIdInput: friendIdInput,
                socialTabPartyBtn: socialTabPartyBtn,
                socialTabFriendsBtn: socialTabFriendsBtn,
                socialTabRoomBtn: socialTabRoomBtn,
                partyJoinLockBtn: partyJoinLockBtn,
                friendsFilterJoinableBtn: friendsFilterJoinableBtn,
                friendsFilterOnlineBtn: friendsFilterOnlineBtn,
                friendsFilterAllBtn: friendsFilterAllBtn,
                leavePartyBtn: leavePartyBtn,
                viewPartyBtn: viewPartyBtn,
                viewFriendsBtn: viewFriendsBtn,
                refreshFriendsBtn: refreshFriendsBtn,
                partyRosterCloseBtn: partyRosterCloseBtn,
                friendsCloseBtn: friendsCloseBtn,
                partyRosterOverlay: partyRosterOverlay,
                friendsOverlay: friendsOverlay,
                modalManager: modalManager,
                setPartyStatus: setPartyStatus,
                setFriendsStatus: setFriendsStatus,
                runPartyAction: function (action, payload, pendingText) {
                    if (!session || !session.runPartyAction) return Promise.resolve(null);
                    return session.runPartyAction(action, payload, pendingText);
                },
                performFriendAction: function (action, targetUserId, pendingText, successText) {
                    if (!session || !session.performFriendAction) return Promise.resolve(null);
                    return session.performFriendAction(action, targetUserId, pendingText, successText);
                },
                setSocialView: lobbyUi.setSocialView,
                isLoggedIn: isLoggedIn,
                refreshFriendsState: function (silent) {
                    if (!session || !session.refreshFriendsState) return Promise.resolve(null);
                    return session.refreshFriendsState(silent);
                },
                setFriendsFilter: function (nextFilter) {
                    if (friendsView && friendsView.setFilter) friendsView.setFilter(nextFilter);
                },
                hasPrivateRoom: function () {
                    return !!(session && session.hasPrivateRoomState && session.hasPrivateRoomState());
                },
                getPartyState: function () {
                    return session && session.getPartyState ? session.getPartyState() : null;
                },
                renderPartyRosterModal: renderPartyRosterModal,
                renderFriendsModal: renderFriendsModal
            });
        }

        if (requestedModeId()) {
            launchMode(requestedModeId());
            return;
        }

        if (modeButtons.length === 0) {
            launchMode('cloud_multiplayer');
        }
    };

    globalThis.__MAYHEM_RUNTIME.GameLobbyController = GameLobbyController;
})();
