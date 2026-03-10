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

    function roomCodeFromRoomId(roomId) {
        var shared = globalThis.__MAYHEM_RUNTIME.GameShared || {};
        var helper = shared.privateRoomCodes;
        if (helper && helper.privateRoomCodeFromId) {
            return helper.privateRoomCodeFromId(roomId);
        }
        return String(roomId || '').toUpperCase();
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
            return 'Connecting to Solo Cloudflare room: ' + mode.roomId + '...';
        }
        if (mode.id === 'single_dev_server') {
            return 'Connecting to Local Dev Room: ' + mode.roomId + '...';
        }
        return String(mode.gameMode || 'ffa').toLowerCase() === 'lms'
            ? 'Starting Offline Sandbox: LMS...'
            : 'Starting Offline Sandbox: FFA...';
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
        var altModesOpen = false;
        var controlsOpen = false;
        var controllerBusy = false;
        var startPending = false;
        var socialView = 'party';
        var sandboxWarmPromise = null;
        var sandboxRuntimeReady = !(runtime.GameRuntimeLoader && runtime.GameRuntimeLoader.loadGameplayRuntime);
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

        function setSandboxButtonsEnabled(enabled) {
            if (sandboxFfaBtn) sandboxFfaBtn.disabled = !enabled;
            if (sandboxLmsBtn) sandboxLmsBtn.disabled = !enabled;
        }

        function isUiBusy() {
            return !!(controllerBusy || (session && session.isBusy && session.isBusy()));
        }

        function warmSandboxRuntime() {
            var loader = runtime.GameRuntimeLoader;
            if (!loader || !loader.loadGameplayRuntime) {
                sandboxRuntimeReady = true;
                setSandboxButtonsEnabled(!isUiBusy());
                return Promise.resolve(null);
            }
            if (loader.isGameplayRuntimeReady && loader.isGameplayRuntimeReady()) {
                sandboxRuntimeReady = true;
                setSandboxButtonsEnabled(!isUiBusy());
                return Promise.resolve(runtime.GameMain || null);
            }
            if (sandboxWarmPromise) return sandboxWarmPromise;

            sandboxRuntimeReady = false;
            setSandboxButtonsEnabled(false);
            sandboxWarmPromise = loader.loadGameplayRuntime()
                .then(function (gameMain) {
                    sandboxRuntimeReady = !!(gameMain && gameMain.launchModeById);
                    setSandboxButtonsEnabled(!isUiBusy() && sandboxRuntimeReady);
                    return gameMain || null;
                })
                .catch(function (err) {
                    sandboxRuntimeReady = false;
                    setSandboxButtonsEnabled(false);
                    throw err;
                })
                .finally(function () {
                    sandboxWarmPromise = null;
                });
            return sandboxWarmPromise;
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

        function activeSocialView() {
            if (socialView === 'room' && session && session.hasPrivateRoomState && !session.hasPrivateRoomState()) {
                return 'party';
            }
            return socialView;
        }

        function currentMenuControlState() {
            var capabilities = session && session.getCapabilities ? session.getCapabilities() : {
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

            return Object.assign({}, capabilities, {
                socialView: activeSocialView()
            });
        }

        function syncDynamicActionDisabled() {
            var buttons = document.querySelectorAll('.party-preview-add, .friend-preview-btn, .party-modal-action');
            var disabled = isUiBusy();
            for (var i = 0; i < buttons.length; i++) {
                buttons[i].disabled = disabled;
            }
        }

        function syncMenuControlState() {
            var controlState = currentMenuControlState();
            var busy = isUiBusy();
            var nextSocialView = controlState.socialView;

            if (partySocialView) partySocialView.hidden = nextSocialView !== 'party';
            if (friendsSocialView) friendsSocialView.hidden = nextSocialView !== 'friends';
            if (privateRoomView) privateRoomView.hidden = !controlState.hasPrivateRoom || nextSocialView !== 'room';

            if (primaryPlayBtn) primaryPlayBtn.disabled = busy;
            if (tdmPlayBtn) tdmPlayBtn.disabled = busy;
            if (lmsPlayBtn) lmsPlayBtn.disabled = busy;
            if (sandboxPlayBtn) sandboxPlayBtn.disabled = busy;
            if (createRoomBtn) createRoomBtn.disabled = busy;
            if (joinPrivateRoomBtn) joinPrivateRoomBtn.disabled = busy;
            if (privateRoomInput) privateRoomInput.disabled = busy;
            if (joinPartyBtn) joinPartyBtn.disabled = busy;
            if (partyIdInput) partyIdInput.disabled = busy;
            setSandboxButtonsEnabled(!busy && sandboxRuntimeReady);

            if (socialTabPartyBtn) {
                socialTabPartyBtn.classList.toggle('active', nextSocialView === 'party');
                socialTabPartyBtn.setAttribute('aria-pressed', nextSocialView === 'party' ? 'true' : 'false');
                socialTabPartyBtn.disabled = busy;
            }
            if (socialTabFriendsBtn) {
                socialTabFriendsBtn.classList.toggle('active', nextSocialView === 'friends');
                socialTabFriendsBtn.setAttribute('aria-pressed', nextSocialView === 'friends' ? 'true' : 'false');
                socialTabFriendsBtn.disabled = busy;
            }
            if (socialTabRoomBtn) {
                socialTabRoomBtn.hidden = !controlState.hasPrivateRoom;
                socialTabRoomBtn.classList.toggle('active', nextSocialView === 'room');
                socialTabRoomBtn.setAttribute('aria-pressed', nextSocialView === 'room' ? 'true' : 'false');
                socialTabRoomBtn.disabled = busy || !controlState.hasPrivateRoom;
            }
            if (viewPartyBtn) viewPartyBtn.disabled = busy || !controlState.canViewPartyRoster;
            if (leavePartyBtn) leavePartyBtn.disabled = busy || !controlState.canLeaveParty;
            if (partyJoinLockBtn) {
                partyJoinLockBtn.disabled = busy || !controlState.canTogglePartyJoinLock;
                partyJoinLockBtn.classList.toggle('locked', controlState.partyJoinLocked);
                partyJoinLockBtn.setAttribute('aria-pressed', controlState.partyJoinLocked ? 'true' : 'false');
                partyJoinLockBtn.title = controlState.partyJoinLockTitle;
            }
            if (partyJoinLockIcon) partyJoinLockIcon.textContent = controlState.partyJoinLocked ? '[###]' : '[_/]';
            if (partyJoinLockNote) partyJoinLockNote.textContent = controlState.partyJoinLockNote;
            if (viewFriendsBtn) viewFriendsBtn.disabled = busy || !isLoggedIn();
            if (refreshFriendsBtn) refreshFriendsBtn.disabled = busy || !isLoggedIn();
            if (privateRoomModeFfaBtn) {
                privateRoomModeFfaBtn.classList.toggle('active', controlState.privateRoomMode === 'ffa');
                privateRoomModeFfaBtn.disabled = busy || !controlState.canEditPrivateRoom;
            }
            if (privateRoomModeTdmBtn) {
                privateRoomModeTdmBtn.classList.toggle('active', controlState.privateRoomMode === 'tdm');
                privateRoomModeTdmBtn.disabled = busy || !controlState.canEditPrivateRoom;
            }
            if (privateRoomModeLmsBtn) {
                privateRoomModeLmsBtn.classList.toggle('active', controlState.privateRoomMode === 'lms');
                privateRoomModeLmsBtn.disabled = busy || !controlState.canEditPrivateRoom;
            }
            if (privateRoomRandomizeBtn) privateRoomRandomizeBtn.disabled = busy || !controlState.canRandomizeTeams;
            if (privateRoomStartBtn) {
                privateRoomStartBtn.style.display = controlState.hasPrivateRoom && controlState.privateRoomPhase === 'lobby' ? '' : 'none';
                privateRoomStartBtn.disabled = busy || !controlState.canStartPrivateRoom;
            }
            syncDynamicActionDisabled();
        }

        function setSocialView(nextView) {
            if (nextView === 'friends') socialView = 'friends';
            else if (nextView === 'room') socialView = 'room';
            else socialView = 'party';
            syncMenuControlState();
            if (activeSocialView() === 'friends' && !isLoggedIn()) {
                setFriendsStatus('Log in to sync your friend list.', true);
            }
        }

        function setControllerBusy(nextBusy, message) {
            controllerBusy = !!nextBusy;
            if (controllerBusy) {
                setRoomAccessStatus(message || 'Working...', false);
            }
            syncMenuControlState();
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
                syncMenuControlState();
            },
            onPartyIdentityChange: updatePartyIdentityDisplay,
            onSocialUpdate: updateSocialSubtitle,
            onPartyStateChanged: function (nextState) {
                if (partyView && partyView.applyState) partyView.applyState(nextState);
                updatePartyIdentityDisplay();
                syncMenuControlState();
            },
            onPartyUnavailable: function (message) {
                if (partyView && partyView.setUnavailable) partyView.setUnavailable(message);
                syncMenuControlState();
            },
            onFriendsStateChanged: function (nextState) {
                if (friendsView && friendsView.applyState) friendsView.applyState(nextState);
                syncMenuControlState();
            },
            onFriendsUnavailable: function (message) {
                if (friendsView && friendsView.setUnavailable) friendsView.setUnavailable(message);
                syncMenuControlState();
            },
            onPrivateRoomStateChanged: function (nextState, meta) {
                var previousState = meta && meta.previousState ? meta.previousState : null;
                var hadLoadedPrivateRoom = !!(previousState && previousState.room);
                var hasLoadedPrivateRoom = !!(nextState && nextState.room);
                var hasPrivateRoom = session && session.hasPrivateRoomState && session.hasPrivateRoomState();

                if (!hasPrivateRoom && socialView === 'room') {
                    socialView = 'party';
                } else if (!hadLoadedPrivateRoom && hasLoadedPrivateRoom) {
                    socialView = 'room';
                }

                if (privateRoomViewController && privateRoomViewController.applyState) {
                    privateRoomViewController.applyState(nextState);
                }
                syncMenuControlState();
            },
            onPrivateRoomUnavailable: function (message) {
                if (session && session.hasPrivateRoomState && session.hasPrivateRoomState()) {
                    socialView = 'room';
                }
                if (privateRoomViewController && privateRoomViewController.setUnavailable) {
                    privateRoomViewController.setUnavailable(message);
                }
                syncMenuControlState();
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
            isLoggedIn: isLoggedIn,
            updateSocialSubtitle: updateSocialSubtitle,
            performFriendAction: function (action, targetUserId, pendingText, successText) {
                if (!session || !session.performFriendAction) return Promise.resolve(null);
                return session.performFriendAction(action, targetUserId, pendingText, successText).then(function (body) {
                    if (body && body.state) setSocialView('party');
                    return body;
                });
            }
        }) : null;

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

        function setAltModesOpen(open) {
            altModesOpen = !!open;
            if (modeButtonsWrap) modeButtonsWrap.hidden = !altModesOpen;
            if (altModeToggle) altModeToggle.setAttribute('aria-expanded', altModesOpen ? 'true' : 'false');
        }

        function setControlsOpen(open) {
            controlsOpen = !!open;
            if (controlsMenu) controlsMenu.hidden = !controlsOpen;
            if (controlsToggle) controlsToggle.setAttribute('aria-expanded', controlsOpen ? 'true' : 'false');
        }

        function syncModeButtonVisibility() {
            var visible = {};
            var modes = availableModes();
            for (var i = 0; i < modes.length; i++) visible[modes[i].id] = true;
            var visibleCount = 0;
            for (var n = 0; n < modeButtons.length; n++) {
                var btn = modeButtons[n];
                var modeId = String(btn.dataset.modeId || '');
                var show = !!visible[modeId];
                btn.style.display = show ? '' : 'none';
                btn.disabled = false;
                if (show) visibleCount += 1;
            }
            if (visibleCount <= 0) setAltModesOpen(false);
        }

        function hideStartUi() {
            if (modeButtonsWrap) modeButtonsWrap.hidden = true;
            if (controlsMenu) controlsMenu.hidden = true;
            if (primaryPlayBtn) primaryPlayBtn.style.display = 'none';
            if (tdmPlayBtn) tdmPlayBtn.style.display = 'none';
            if (lmsPlayBtn) lmsPlayBtn.style.display = 'none';
            if (sandboxPlayBtn) sandboxPlayBtn.style.display = 'none';
            if (sandboxRulesetPanel) sandboxRulesetPanel.hidden = true;
            if (createRoomBtn) createRoomBtn.style.display = 'none';
            if (joinPrivateRoomBtn) joinPrivateRoomBtn.style.display = 'none';
            if (privateRoomInput) privateRoomInput.style.display = 'none';
        }

        function restoreStartUi() {
            if (primaryPlayBtn) {
                primaryPlayBtn.disabled = false;
                primaryPlayBtn.style.display = '';
            }
            if (tdmPlayBtn) {
                tdmPlayBtn.disabled = false;
                tdmPlayBtn.style.display = '';
            }
            if (lmsPlayBtn) {
                lmsPlayBtn.disabled = false;
                lmsPlayBtn.style.display = '';
            }
            if (sandboxPlayBtn) {
                sandboxPlayBtn.disabled = false;
                sandboxPlayBtn.style.display = '';
            }
            if (sandboxRulesetPanel) sandboxRulesetPanel.hidden = true;
            if (createRoomBtn) {
                createRoomBtn.disabled = false;
                createRoomBtn.style.display = '';
            }
            if (joinPrivateRoomBtn) {
                joinPrivateRoomBtn.disabled = false;
                joinPrivateRoomBtn.style.display = '';
            }
            if (privateRoomInput) {
                privateRoomInput.disabled = false;
                privateRoomInput.style.display = '';
            }
            if (altModeToggle) altModeToggle.disabled = false;
            if (controlsToggle) controlsToggle.disabled = false;
            if (modeButtonsWrap) modeButtonsWrap.hidden = !altModesOpen;
            if (controlsMenu) controlsMenu.hidden = !controlsOpen;
        }

        function handleLaunchResult(result) {
            startPending = false;
            if (!result || !result.ok) {
                setRoomAccessStatus((result && result.error) ? result.error : 'Mode launch failed.', true);
                restoreStartUi();
                return false;
            }
            started = true;
            hideStartUi();
            if (modeSubtitle) {
                modeSubtitle.textContent = startupSubtitleForMode(result.mode);
            }
            if (typeof options.setRuntimeIndicator === 'function') {
                options.setRuntimeIndicator(result.mode);
            }
            if (runtime.GameSession && runtime.GameSession.showGameplayPrompt) {
                runtime.GameSession.showGameplayPrompt();
            }
            return true;
        }

        function launchMode(modeId, launchOptions) {
            if (started || startPending) return Promise.resolve(false);
            startPending = true;
            var result = options.launchModeById ? options.launchModeById(modeId, launchOptions || {}) : { ok: false, error: 'Launch unavailable.' };
            if (result && typeof result.then === 'function') {
                return result
                    .then(handleLaunchResult)
                    .catch(function (err) {
                        startPending = false;
                        setRoomAccessStatus((err && err.message) ? err.message : 'Mode launch failed.', true);
                        restoreStartUi();
                        return false;
                    });
            }
            return Promise.resolve(handleLaunchResult(result));
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

        function startAllocatedRoom(payload) {
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
            });
        }

        function beginRoomAction(action, extra, pendingText) {
            if (isUiBusy() || started) return;
            setControllerBusy(true, pendingText);
            requestMatchmaking(action, extra)
                .then(function (payload) {
                    setControllerBusy(false, '');
                    startAllocatedRoom(payload);
                })
                .catch(function (err) {
                    setControllerBusy(false, '');
                    setRoomAccessStatus((err && err.message) ? err.message : 'Room request failed.', true);
                });
        }

        function handlePrivateRoomResult(result, successText) {
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
                });
            }
        }

        function beginPrivateRoomCreate() {
            if (isUiBusy() || started || !session || !session.createPrivateRoom) return;
            setRoomAccessStatus('Creating room...', false);
            session.createPrivateRoom()
                .then(function (result) {
                    handlePrivateRoomResult(result, 'Room ' + String(result.state.room.roomCode || '').toUpperCase() + ' ready.');
                })
                .catch(function (err) {
                    setRoomAccessStatus((err && err.message) ? err.message : 'Private room creation failed.', true);
                });
        }

        function beginPrivateRoomJoin(roomCode) {
            if (isUiBusy() || started || !session || !session.joinPrivateRoom) return;
            setRoomAccessStatus('Joining private room...', false);
            session.joinPrivateRoom(roomCode)
                .then(function (result) {
                    var moved = Number(result.movedCount || 0);
                    var skipped = Number(result.skippedCount || 0);
                    var message = 'Joined room ' + String(result.state.room.roomCode || '').toUpperCase() + '.';
                    if (moved > 1) message += ' Pulled ' + String(moved - 1) + ' party member' + (moved === 2 ? '' : 's') + '.';
                    if (skipped > 0) message += ' ' + String(skipped) + ' member' + (skipped === 1 ? '' : 's') + ' stayed behind.';
                    handlePrivateRoomResult(result, message);
                })
                .catch(function (err) {
                    setRoomAccessStatus((err && err.message) ? err.message : 'Private room join failed.', true);
                });
        }

        function launchSandboxRuleset(gameMode, event) {
            if (started || startPending) return;
            if (!sandboxRuntimeReady) {
                setRoomAccessStatus('Preparing sandbox runtime...', false);
                warmSandboxRuntime()
                    .then(function () {
                        setRoomAccessStatus('Sandbox ready. Select a ruleset again to enter.', false);
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
                        restoreStartUi();
                    });
                return;
            }

            if (!handleLaunchResult(result)) return;
            if (runtime.GameSession && runtime.GameSession.startGameplayFromMenu) {
                runtime.GameSession.startGameplayFromMenu(event);
            }
        }

        syncModeButtonVisibility();
        setAltModesOpen(false);
        setControlsOpen(false);
        setSandboxButtonsEnabled(sandboxRuntimeReady);
        setSocialView('party');
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
                sandboxRulesetPanel: sandboxRulesetPanel,
                sandboxFfaBtn: sandboxFfaBtn,
                sandboxLmsBtn: sandboxLmsBtn,
                createRoomBtn: createRoomBtn,
                privateRoomInput: privateRoomInput,
                joinPrivateRoomBtn: joinPrivateRoomBtn,
                copyRoomCodeBtn: copyRoomCodeBtn,
                roomShareCode: roomShareCode,
                modeButtons: modeButtons,
                isAltModesOpen: function () { return altModesOpen; },
                setAltModesOpen: setAltModesOpen,
                isControlsOpen: function () { return controlsOpen; },
                setControlsOpen: setControlsOpen,
                beginRoomAction: beginRoomAction,
                warmSandboxRuntime: warmSandboxRuntime,
                setRoomAccessStatus: setRoomAccessStatus,
                launchSandboxRuleset: launchSandboxRuleset,
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
                socialTabPartyBtn: socialTabPartyBtn,
                socialTabFriendsBtn: socialTabFriendsBtn,
                socialTabRoomBtn: socialTabRoomBtn,
                partyJoinLockBtn: partyJoinLockBtn,
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
                runPartyAction: function (action, payload, pendingText) {
                    if (!session || !session.runPartyAction) return Promise.resolve(null);
                    return session.runPartyAction(action, payload, pendingText);
                },
                setSocialView: setSocialView,
                isLoggedIn: isLoggedIn,
                refreshFriendsState: function (silent) {
                    if (!session || !session.refreshFriendsState) return Promise.resolve(null);
                    return session.refreshFriendsState(silent);
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
