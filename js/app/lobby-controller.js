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

    function sharedApi() {
        return globalThis.__MAYHEM_RUNTIME.GameShared || {};
    }

    function quickPlayGameModes() {
        var shared = sharedApi();
        if (shared.getQuickPlayGameModes) return shared.getQuickPlayGameModes() || [];
        return [];
    }

    function sandboxGameModes() {
        var shared = sharedApi();
        if (shared.getSandboxGameModes) return shared.getSandboxGameModes() || [];
        return [];
    }

    function gameModeDef(modeId) {
        var shared = sharedApi();
        if (shared.getGameMode) return shared.getGameMode(modeId);
        return null;
    }

    function defaultGameModeId() {
        var shared = sharedApi();
        if (shared.getDefaultGameMode) return String(shared.getDefaultGameMode() || 'ffa');
        return 'ffa';
    }

    function defaultSandboxGameModeId() {
        var shared = sharedApi();
        if (shared.getDefaultSandboxGameMode) return String(shared.getDefaultSandboxGameMode() || defaultGameModeId());
        return defaultGameModeId();
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
        var extraModeButtonsWrap = document.getElementById('extra-mode-buttons');
        var sandboxPlayBtn = document.getElementById('sandbox-play-btn');
        var sandboxModeCycleBtn = document.getElementById('sandbox-mode-cycle-btn');
        var sandboxRulesetPanel = document.getElementById('sandbox-ruleset-panel');
        var sandboxFfaBtn = document.getElementById('sandbox-ffa-btn');
        var sandboxLmsBtn = document.getElementById('sandbox-lms-btn');
        var extraSandboxModeButtonsWrap = document.getElementById('extra-sandbox-mode-buttons');
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
        var menuSessionActions = document.getElementById('menu-session-actions');

        var sandboxWarmPromise = null;
        var sandboxRuntimeReady = !(runtime.GameRuntimeLoader && runtime.GameRuntimeLoader.loadGameplayRuntime);
        var quickMatchButtons = [primaryPlayBtn, tdmPlayBtn, lmsPlayBtn];
        var sandboxModeButtons = [sandboxFfaBtn, sandboxLmsBtn];
        var selectedSandboxMode = defaultSandboxGameModeId();
        var partyView = null;
        var friendsView = null;
        var privateRoomViewController = null;
        var session = null;
        var launchOrchestrator = null;
        var launchStateSnapshot = {
            phase: 'menu_idle',
            hasRuntime: false,
            busy: false,
            inPrivateRoomLobby: false,
            context: {
                launchKind: '',
                gameMode: '',
                roomId: '',
                roomCode: '',
                roomPhase: '',
                modeId: '',
                requiresNetwork: false,
                canResume: false,
                error: ''
            }
        };

        if (typeof options.prepareMenu === 'function') {
            options.prepareMenu();
        }

        function clearElementChildren(element) {
            if (!element) return;
            if (typeof element.innerHTML === 'string') {
                element.innerHTML = '';
                return;
            }
            while (element.firstChild) {
                if (element.removeChild) element.removeChild(element.firstChild);
                else break;
            }
        }

        function createModeButton(mode, kind) {
            if (!mode || !document || !document.createElement) return null;
            var button = document.createElement('button');
            button.type = 'button';
            button.dataset.gameMode = String(mode.id || '');
            if (kind === 'sandbox') {
                button.className = 'sandbox-mode-btn generated-sandbox-mode-btn';
                button.textContent = String(mode.sandboxButtonLabel || mode.menuButtonLabel || mode.label || mode.id || '').toUpperCase();
            } else {
                button.className = 'quick-mode-btn generated-quick-mode-btn';
                button.textContent = String(mode.menuButtonLabel || mode.label || mode.id || '').toUpperCase();
            }
            return button;
        }

        function syncKnownModeLabels() {
            var primaryMode = gameModeDef(defaultGameModeId()) || { primaryButtonLabel: 'QUICK MATCH (FFA)' };
            var tdmMode = gameModeDef('tdm') || { menuButtonLabel: 'TEAM DEATHMATCH', sandboxButtonLabel: 'SANDBOX TDM' };
            var lmsMode = gameModeDef('lms') || { menuButtonLabel: 'LAST MAN STANDING', sandboxButtonLabel: 'SANDBOX LMS' };
            var ffaMode = gameModeDef('ffa') || { sandboxButtonLabel: 'SANDBOX FFA' };

            if (primaryPlayBtn) primaryPlayBtn.textContent = String(primaryMode.primaryButtonLabel || primaryMode.menuButtonLabel || 'QUICK MATCH').toUpperCase();
            if (primaryPlayBtn) primaryPlayBtn.dataset.gameMode = String(primaryMode.id || defaultGameModeId());
            if (tdmPlayBtn) tdmPlayBtn.textContent = String(tdmMode.menuButtonLabel || 'TEAM DEATHMATCH').toUpperCase();
            if (tdmPlayBtn) tdmPlayBtn.dataset.gameMode = 'tdm';
            if (lmsPlayBtn) lmsPlayBtn.textContent = String(lmsMode.menuButtonLabel || 'LAST MAN STANDING').toUpperCase();
            if (lmsPlayBtn) lmsPlayBtn.dataset.gameMode = 'lms';
            if (sandboxFfaBtn) sandboxFfaBtn.textContent = String(ffaMode.sandboxButtonLabel || 'SANDBOX FFA').toUpperCase();
            if (sandboxFfaBtn) sandboxFfaBtn.dataset.gameMode = 'ffa';
            if (sandboxLmsBtn) sandboxLmsBtn.textContent = String(lmsMode.sandboxButtonLabel || 'SANDBOX LMS').toUpperCase();
            if (sandboxLmsBtn) sandboxLmsBtn.dataset.gameMode = 'lms';
        }

        function rebuildModeButtons() {
            quickMatchButtons.length = 0;
            sandboxModeButtons.length = 0;
            if (primaryPlayBtn) quickMatchButtons.push(primaryPlayBtn);
            if (tdmPlayBtn) quickMatchButtons.push(tdmPlayBtn);
            if (lmsPlayBtn) quickMatchButtons.push(lmsPlayBtn);
            if (sandboxFfaBtn) sandboxModeButtons.push(sandboxFfaBtn);
            if (sandboxLmsBtn) sandboxModeButtons.push(sandboxLmsBtn);
        }

        function renderDerivedGameModeButtons() {
            syncKnownModeLabels();
            rebuildModeButtons();
            clearElementChildren(extraModeButtonsWrap);
            clearElementChildren(extraSandboxModeButtonsWrap);

            var quickModes = quickPlayGameModes();
            for (var i = 0; i < quickModes.length; i++) {
                var quickMode = quickModes[i];
                var quickId = String(quickMode && quickMode.id || '');
                if (!quickId || quickId === defaultGameModeId() || quickId === 'tdm' || quickId === 'lms') continue;
                var quickBtn = createModeButton(quickMode, 'quick');
                if (quickBtn && extraModeButtonsWrap && extraModeButtonsWrap.appendChild) {
                    extraModeButtonsWrap.appendChild(quickBtn);
                    quickMatchButtons.push(quickBtn);
                }
            }

            var sandboxModes = sandboxGameModes();
            for (var n = 0; n < sandboxModes.length; n++) {
                var sandboxMode = sandboxModes[n];
                var sandboxId = String(sandboxMode && sandboxMode.id || '');
                if (!sandboxId || sandboxId === 'ffa' || sandboxId === 'lms') continue;
                var sandboxBtn = createModeButton(sandboxMode, 'sandbox');
                if (sandboxBtn && extraSandboxModeButtonsWrap && extraSandboxModeButtonsWrap.appendChild) {
                    extraSandboxModeButtonsWrap.appendChild(sandboxBtn);
                    sandboxModeButtons.push(sandboxBtn);
                }
            }
        }

        renderDerivedGameModeButtons();

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

        function launchSessionApi() {
            return runtime.GameSession || null;
        }

        function syncLaunchStatus(state) {
            state = state || launchStateSnapshot;
            var context = state.context || {};
            if (state.phase === 'menu_idle') return;
            if (state.phase === 'quick_match_matchmaking') {
                setRoomAccessStatus('Finding a ' + String(context.gameMode || 'ffa').toUpperCase() + ' room...', false);
                return;
            }
            if (state.phase === 'private_room_creating') {
                setRoomAccessStatus('Creating room...', false);
                return;
            }
            if (state.phase === 'private_room_joining') {
                setRoomAccessStatus('Joining private room...', false);
                return;
            }
            if (state.phase === 'runtime_loading') {
                if (context.launchKind === 'sandbox') {
                    setRoomAccessStatus('Loading sandbox...', false);
                    return;
                }
                if (context.roomId) {
                    setRoomAccessStatus('Entering room ' + String(context.roomId).toUpperCase() + '...', false);
                    return;
                }
                setRoomAccessStatus('Loading gameplay runtime...', false);
                return;
            }
            if (state.phase === 'awaiting_input_capture') {
                setRoomAccessStatus('Match ready. Click ENTER MATCH.', false);
                return;
            }
            if (state.phase === 'private_room_lobby') {
                setRoomAccessStatus('Private room ready. Configure teams or start the match.', false);
                return;
            }
            if (state.phase === 'in_match') {
                if (context.roomId) {
                    setRoomAccessStatus('Entered room ' + String(context.roomId).toUpperCase() + '.', false);
                }
                return;
            }
            if (state.phase === 'launch_error') {
                setRoomAccessStatus(String(context.error || 'Launch failed.'), true);
            }
        }

        function applyLaunchState(nextState) {
            launchStateSnapshot = nextState || launchStateSnapshot;
            syncLaunchStatus(launchStateSnapshot);
            lobbyUi.syncMenuControlState();
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
                quickMatchButtons: quickMatchButtons,
                sandboxModeButtons: sandboxModeButtons,
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
                menuSessionActions: menuSessionActions,
                modeButtons: modeButtons
            },
            isSessionBusy: function () {
                return !!(session && session.isBusy && session.isBusy());
            },
            getLaunchState: function () {
                return launchStateSnapshot;
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
            var shared = sharedApi();
            if (shared.normalizeGameMode) {
                return String(shared.normalizeGameMode(mode, { allowSandboxOnly: true }) || defaultSandboxGameModeId());
            }
            return defaultSandboxGameModeId();
        }

        function syncSandboxSelectionUi() {
            var mode = normalizeSandboxMode(selectedSandboxMode);
            var modeDef = gameModeDef(mode) || { shortLabel: String(mode || '').toUpperCase() };
            if (sandboxPlayBtn) {
                sandboxPlayBtn.textContent = 'OFFLINE SANDBOX :: ' + String(modeDef.shortLabel || mode || 'MODE').toUpperCase();
            }
            if (sandboxModeCycleBtn) {
                sandboxModeCycleBtn.title = 'Sandbox selector. Current ruleset: ' + String(modeDef.shortLabel || mode || 'MODE').toUpperCase() + '.';
            }
            for (var i = 0; i < sandboxModeButtons.length; i++) {
                var button = sandboxModeButtons[i];
                if (!button || !button.classList) continue;
                button.classList.toggle('active', String(button.dataset && button.dataset.gameMode || '') === mode);
            }
        }

        function setSelectedSandboxMode(mode, silent) {
            selectedSandboxMode = normalizeSandboxMode(mode);
            syncSandboxSelectionUi();
            if (!silent) {
                var modeDef = gameModeDef(selectedSandboxMode) || { shortLabel: selectedSandboxMode };
                setRoomAccessStatus(
                    'Sandbox ruleset set to ' + String(modeDef.shortLabel || selectedSandboxMode || 'MODE').toUpperCase() + '.',
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
                if (launchOrchestrator && launchOrchestrator.dispatch) {
                    launchOrchestrator.dispatch({
                        type: 'PRIVATE_ROOM_STATE_CHANGED',
                        state: nextState,
                        meta: meta || {}
                    });
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

        function launchMode(modeId, launchOptions) {
            var result = options.launchModeById ? options.launchModeById(modeId, launchOptions || {}) : { ok: false, error: 'Launch unavailable.' };
            return Promise.resolve(result)
                .then(function (payload) {
                    if (!payload || !payload.ok) return payload || { ok: false, error: 'Mode launch failed.' };
                    if (modeSubtitle) {
                        var modeUi = runtimeModeUi();
                        modeSubtitle.textContent = modeUi && modeUi.startupSubtitleForMode
                            ? modeUi.startupSubtitleForMode(payload.mode)
                            : '';
                    }
                    if (typeof options.setRuntimeIndicator === 'function') {
                        options.setRuntimeIndicator(payload.mode);
                    }
                    return payload;
                })
                .catch(function (err) {
                    return {
                        ok: false,
                        error: (err && err.message) ? err.message : 'Mode launch failed.'
                    };
                });
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

        function bindSessionStateEvents() {
            if (window.__mayhemLaunchStateBound) return;
            window.__mayhemLaunchStateBound = true;
            window.addEventListener('mayhem-session-state', function (event) {
                if (!launchOrchestrator || !launchOrchestrator.syncSessionState) return;
                launchOrchestrator.syncSessionState(event && event.detail ? event.detail : {});
            });
        }

        bindSessionStateEvents();

        var launchOrchestratorFactory = runtime.GameMenuLaunchOrchestrator;
        if (!launchOrchestratorFactory || !launchOrchestratorFactory.create) {
            throw new Error('GameMenuLaunchOrchestrator is required before GameLobbyController.init.');
        }
        launchOrchestrator = launchOrchestratorFactory.create({
            onStateChange: applyLaunchState,
            requestMatchmaking: requestMatchmaking,
            launchMode: launchMode,
            prepareLaunch: function (context) {
                if (context && context.launchKind === 'private_room' && context.roomId) {
                    setPrivateRoomShare(context.roomId);
                }
                var gameSession = launchSessionApi();
                if (gameSession && gameSession.prepareLaunch) {
                    gameSession.prepareLaunch(context);
                }
            },
            createPrivateRoom: function () {
                if (!session || !session.createPrivateRoom) return Promise.reject(new Error('Private room creation unavailable.'));
                return session.createPrivateRoom().then(function (result) {
                    var room = result && result.state ? result.state.room : null;
                    if (room && room.roomId) setPrivateRoomShare(room.roomId);
                    return result;
                });
            },
            joinPrivateRoom: function (roomCode) {
                if (!session || !session.joinPrivateRoom) return Promise.reject(new Error('Private room join unavailable.'));
                return session.joinPrivateRoom(roomCode).then(function (result) {
                    var room = result && result.state ? result.state.room : null;
                    if (room && room.roomId) setPrivateRoomShare(room.roomId);
                    return result;
                });
            },
            enterGameplay: function (triggerEvent, context) {
                var gameSession = launchSessionApi();
                if (gameSession && gameSession.enterGameplay) {
                    return gameSession.enterGameplay(triggerEvent, context);
                }
                return { entered: false };
            },
            showInputCapturePrompt: function (context) {
                var gameSession = launchSessionApi();
                if (gameSession && gameSession.showInputCapturePrompt) {
                    gameSession.showInputCapturePrompt(context);
                }
            },
            hideInputCapturePrompt: function () {
                var gameSession = launchSessionApi();
                if (gameSession && gameSession.hideInputCapturePrompt) {
                    gameSession.hideInputCapturePrompt();
                }
            }
        });

        lobbyUi.syncModeButtonVisibility();
        lobbyUi.setAltModesOpen(false);
        lobbyUi.setControlsOpen(false);
        lobbyUi.syncMenuControlState();
        if (launchOrchestrator && launchOrchestrator.syncSessionState) {
            launchOrchestrator.syncSessionState({
                runtimeReady: false,
                inMatch: false,
                awaitingInputCapture: false,
                canResume: false,
                activityState: 'menu'
            });
        }
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
                startPrivateRoomMatch: function (event) {
                    if (!session || !session.startPrivateRoomMatch) return Promise.resolve(null);
                    return session.startPrivateRoomMatch().then(function (result) {
                        if (launchOrchestrator && launchOrchestrator.dispatch && result && result.state && result.state.room && String(result.state.room.roomPhase || '') !== 'lobby') {
                            return launchOrchestrator.dispatch({
                                type: 'START_PRIVATE_ROOM_MATCH',
                                event: event
                            }).then(function () {
                                return result;
                            });
                        }
                        return result;
                    });
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
                quickMatchButtons: quickMatchButtons,
                sandboxPlayBtn: sandboxPlayBtn,
                sandboxModeCycleBtn: sandboxModeCycleBtn,
                sandboxRulesetPanel: sandboxRulesetPanel,
                sandboxFfaBtn: sandboxFfaBtn,
                sandboxLmsBtn: sandboxLmsBtn,
                sandboxModeButtons: sandboxModeButtons,
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
                dispatchAction: function (action) {
                    if (!launchOrchestrator || !launchOrchestrator.dispatch) return Promise.resolve(false);
                    var nextAction = action || {};
                    if (String(nextAction.type || '').toUpperCase() === 'START_SANDBOX' && !sandboxRuntimeReady) {
                        setRoomAccessStatus('Preparing sandbox runtime...', false);
                        return warmSandboxRuntime()
                            .then(function () {
                                return launchOrchestrator.dispatch({
                                    type: 'START_SANDBOX',
                                    gameMode: normalizeSandboxMode(nextAction.gameMode || selectedSandboxMode),
                                    event: nextAction.event
                                });
                            })
                            .catch(function (err) {
                                setRoomAccessStatus((err && err.message) ? err.message : 'Sandbox failed to load.', true);
                                return false;
                            });
                    }
                    if (String(nextAction.type || '').toUpperCase() === 'START_SANDBOX') {
                        nextAction.gameMode = normalizeSandboxMode(nextAction.gameMode || selectedSandboxMode);
                    }
                    return launchOrchestrator.dispatch(nextAction);
                },
                warmSandboxRuntime: warmSandboxRuntime,
                setRoomAccessStatus: setRoomAccessStatus,
                getSelectedSandboxMode: function () {
                    return selectedSandboxMode;
                },
                setSelectedSandboxMode: setSelectedSandboxMode,
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
            launchOrchestrator.dispatch({
                type: 'START_DIRECT_MODE',
                modeId: requestedModeId()
            });
            return;
        }

        if (modeButtons.length === 0) {
            launchOrchestrator.dispatch({
                type: 'START_DIRECT_MODE',
                modeId: 'cloud_multiplayer'
            });
        }
    };

    globalThis.__MAYHEM_RUNTIME.GameLobbyController = GameLobbyController;
})();
