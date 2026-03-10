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

        var lobbyApi = globalThis.__MAYHEM_RUNTIME.GameLobbyApi;
        var authApi = globalThis.__MAYHEM_RUNTIME.GameNetAuth || null;
        var modalManager = globalThis.__MAYHEM_RUNTIME.GameModalManager || null;
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
        var roomActionInFlight = false;
        var startPending = false;
        var partyState = null;
        var friendsState = null;
        var privateRoomState = null;
        var partyStateAvailability = 'idle';
        var socialView = 'party';
        var sandboxWarmPromise = null;
        var sandboxRuntimeReady = !(
            globalThis.__MAYHEM_RUNTIME.GameRuntimeLoader &&
            globalThis.__MAYHEM_RUNTIME.GameRuntimeLoader.loadGameplayRuntime
        );

        if (typeof options.prepareMenu === 'function') {
            options.prepareMenu();
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

        function setRoomAccessStatus(text, isErr) {
            if (!roomAccessStatus) return;
            roomAccessStatus.textContent = text || '';
            roomAccessStatus.style.color = isErr ? '#ff9797' : '#98f5b6';
        }

        function setSandboxButtonsEnabled(enabled) {
            if (sandboxFfaBtn) sandboxFfaBtn.disabled = !enabled;
            if (sandboxLmsBtn) sandboxLmsBtn.disabled = !enabled;
        }

        function warmSandboxRuntime() {
            var loader = globalThis.__MAYHEM_RUNTIME.GameRuntimeLoader;
            if (!loader || !loader.loadGameplayRuntime) {
                sandboxRuntimeReady = true;
                setSandboxButtonsEnabled(true);
                return Promise.resolve(null);
            }
            if (loader.isGameplayRuntimeReady && loader.isGameplayRuntimeReady()) {
                sandboxRuntimeReady = true;
                setSandboxButtonsEnabled(true);
                return Promise.resolve(globalThis.__MAYHEM_RUNTIME.GameMain || null);
            }
            if (sandboxWarmPromise) return sandboxWarmPromise;

            sandboxRuntimeReady = false;
            setSandboxButtonsEnabled(false);
            sandboxWarmPromise = loader.loadGameplayRuntime()
                .then(function (gameMain) {
                    sandboxRuntimeReady = !!(gameMain && gameMain.launchModeById);
                    setSandboxButtonsEnabled(sandboxRuntimeReady);
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

        function currentPartyIdentity() {
            if (authApi && authApi.getPartyIdentity) return authApi.getPartyIdentity();
            return null;
        }

        function currentPartyActivityState() {
            if (typeof options.getActivityState === 'function') return options.getActivityState();
            return 'menu';
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

        function syncFailureMessage(scope, err) {
            var prefix = String(scope || 'Service').toUpperCase();
            if (err && Number(err.status) === 401) {
                return prefix + ' REQUIRES LOGIN.';
            }
            if (err && Number(err.status) === 404) {
                return prefix + ' ENDPOINT OFFLINE. RETRYING...';
            }
            return prefix + ' SERVICE UNAVAILABLE. RETRYING...';
        }

        function logSyncError(scope, err) {
            if (!console || typeof console.warn !== 'function') return;
            console.warn('[menu-sync]', scope, {
                message: err && err.message ? err.message : '',
                status: err && err.status ? err.status : 0,
                url: err && err.url ? err.url : ''
            });
        }

        function friendEntryByUserId(userId) {
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

        function currentAssignedPrivateRoom() {
            return partyState && partyState.self ? partyState.self.privateRoom || null : null;
        }

        function currentPrivateRoomSummary() {
            if (privateRoomState && privateRoomState.room) {
                return {
                    hasPrivateRoom: true,
                    room: privateRoomState.room,
                    self: privateRoomState.self || null
                };
            }
            var assignedPrivateRoom = currentAssignedPrivateRoom();
            return {
                hasPrivateRoom: !!assignedPrivateRoom,
                room: assignedPrivateRoom,
                self: assignedPrivateRoom || null
            };
        }

        function hasPrivateRoomState() {
            return currentPrivateRoomSummary().hasPrivateRoom;
        }

        function activeSocialView() {
            if (socialView === 'room' && !hasPrivateRoomState()) {
                return 'party';
            }
            return socialView;
        }

        function currentMenuControlState() {
            var hasParty = !!(partyState && partyState.party);
            var partyMembers = hasParty && Array.isArray(partyState.party.members) ? partyState.party.members : [];
            var canTogglePartyJoinLock = !!(hasParty && partyState.party.isLeader);
            var partyJoinLocked = !!(hasParty && partyState.party.joinLocked);
            var privateRoomSummary = currentPrivateRoomSummary();
            var hasPrivateRoom = privateRoomSummary.hasPrivateRoom;
            var privateRoom = privateRoomSummary.room;
            var privateRoomSelf = privateRoomSummary.self;
            var privateRoomPhase = String(privateRoom && privateRoom.roomPhase || '');
            var privateRoomMode = String(privateRoom && privateRoom.roomMode || '');
            var isPrivateRoomHost = !!(privateRoomSelf && privateRoomSelf.isHost);
            var partyJoinLockTitle = 'Party join lock unavailable.';
            var partyJoinLockNote = 'JOINS OPEN';
            if (partyStateAvailability === 'unavailable') {
                partyJoinLockTitle = 'Party service unavailable.';
                partyJoinLockNote = 'SERVICE OFFLINE';
            } else if (hasParty) {
                partyJoinLockTitle = canTogglePartyJoinLock
                    ? (partyJoinLocked ? 'Unlock party joins.' : 'Lock party joins.')
                    : 'Only the party lead can change join lock.';
                partyJoinLockNote = canTogglePartyJoinLock
                    ? (partyJoinLocked ? 'JOINS LOCKED' : 'JOINS OPEN')
                    : 'LEAD ONLY';
            }
            return {
                hasParty: hasParty,
                partyMemberCount: partyMembers.length,
                canTogglePartyJoinLock: canTogglePartyJoinLock,
                partyJoinLocked: partyJoinLocked,
                partyJoinLockTitle: partyJoinLockTitle,
                partyJoinLockNote: partyJoinLockNote,
                canViewPartyRoster: !!(hasParty && partyMembers.length > 1),
                canLeaveParty: !!(hasParty && partyMembers.length > 1),
                hasPrivateRoom: hasPrivateRoom,
                socialView: activeSocialView(),
                privateRoomPhase: privateRoomPhase,
                privateRoomMode: privateRoomMode,
                canEditPrivateRoom: !!(hasPrivateRoom && isPrivateRoomHost),
                canRandomizeTeams: !!(hasPrivateRoom && isPrivateRoomHost && privateRoomMode !== 'lms'),
                canStartPrivateRoom: !!(hasPrivateRoom && isPrivateRoomHost && privateRoomPhase === 'lobby')
            };
        }

        function syncMenuControlState() {
            var controlState = currentMenuControlState();
            var nextSocialView = controlState.socialView;
            if (partySocialView) partySocialView.hidden = nextSocialView !== 'party';
            if (friendsSocialView) friendsSocialView.hidden = nextSocialView !== 'friends';
            if (privateRoomView) privateRoomView.hidden = !controlState.hasPrivateRoom || nextSocialView !== 'room';
            if (socialTabPartyBtn) {
                socialTabPartyBtn.classList.toggle('active', nextSocialView === 'party');
                socialTabPartyBtn.setAttribute('aria-pressed', nextSocialView === 'party' ? 'true' : 'false');
                socialTabPartyBtn.disabled = !!roomActionInFlight;
            }
            if (socialTabFriendsBtn) {
                socialTabFriendsBtn.classList.toggle('active', nextSocialView === 'friends');
                socialTabFriendsBtn.setAttribute('aria-pressed', nextSocialView === 'friends' ? 'true' : 'false');
                socialTabFriendsBtn.disabled = !!roomActionInFlight;
            }
            if (socialTabRoomBtn) {
                socialTabRoomBtn.hidden = !controlState.hasPrivateRoom;
                socialTabRoomBtn.classList.toggle('active', nextSocialView === 'room');
                socialTabRoomBtn.setAttribute('aria-pressed', nextSocialView === 'room' ? 'true' : 'false');
                socialTabRoomBtn.disabled = !!roomActionInFlight || !controlState.hasPrivateRoom;
            }
            if (viewPartyBtn) viewPartyBtn.disabled = !!roomActionInFlight || !controlState.canViewPartyRoster;
            if (leavePartyBtn) leavePartyBtn.disabled = !!roomActionInFlight || !controlState.canLeaveParty;
            if (partyJoinLockBtn) {
                partyJoinLockBtn.disabled = !!roomActionInFlight || !controlState.canTogglePartyJoinLock;
                partyJoinLockBtn.classList.toggle('locked', controlState.partyJoinLocked);
                partyJoinLockBtn.setAttribute('aria-pressed', controlState.partyJoinLocked ? 'true' : 'false');
                partyJoinLockBtn.title = controlState.partyJoinLockTitle;
            }
            if (partyJoinLockIcon) partyJoinLockIcon.textContent = controlState.partyJoinLocked ? '[###]' : '[_/]';
            if (partyJoinLockNote) partyJoinLockNote.textContent = controlState.partyJoinLockNote;
            if (viewFriendsBtn) viewFriendsBtn.disabled = !!roomActionInFlight || !isLoggedIn();
            if (refreshFriendsBtn) refreshFriendsBtn.disabled = !!roomActionInFlight || !isLoggedIn();
            if (privateRoomModeFfaBtn) {
                privateRoomModeFfaBtn.classList.toggle('active', controlState.privateRoomMode === 'ffa');
                privateRoomModeFfaBtn.disabled = !!roomActionInFlight || !controlState.canEditPrivateRoom;
            }
            if (privateRoomModeTdmBtn) {
                privateRoomModeTdmBtn.classList.toggle('active', controlState.privateRoomMode === 'tdm');
                privateRoomModeTdmBtn.disabled = !!roomActionInFlight || !controlState.canEditPrivateRoom;
            }
            if (privateRoomModeLmsBtn) {
                privateRoomModeLmsBtn.classList.toggle('active', controlState.privateRoomMode === 'lms');
                privateRoomModeLmsBtn.disabled = !!roomActionInFlight || !controlState.canEditPrivateRoom;
            }
            if (privateRoomRandomizeBtn) privateRoomRandomizeBtn.disabled = !!roomActionInFlight || !controlState.canRandomizeTeams;
            if (privateRoomStartBtn) {
                privateRoomStartBtn.style.display = controlState.hasPrivateRoom && controlState.privateRoomPhase === 'lobby' ? '' : 'none';
                privateRoomStartBtn.disabled = !!roomActionInFlight || !controlState.canStartPrivateRoom;
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

        function updatePartyIdentityDisplay() {
            var identity = currentPartyIdentity();
            if (!menuPartyIdBtn || !menuPartyIdLabel || !menuPartyIdValue || !identity) return;
            menuPartyIdLabel.textContent = String(identity.label || 'PLAYER ID');
            menuPartyIdValue.textContent = String(identity.id || '------').toUpperCase();
            menuPartyIdBtn.title = 'Copy ' + String(identity.label || 'ID');
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

        function syncDynamicActionDisabled() {
            var buttons = document.querySelectorAll('.party-preview-add, .friend-preview-btn, .party-modal-action');
            for (var i = 0; i < buttons.length; i++) {
                buttons[i].disabled = !!roomActionInFlight;
            }
        }

        var partyViewFactory = globalThis.__MAYHEM_RUNTIME.GameLobbyPartyView;
        var friendsViewFactory = globalThis.__MAYHEM_RUNTIME.GameLobbyFriendsView;
        var clickablesApi = globalThis.__MAYHEM_RUNTIME.GameLobbyClickables;
        var syncRuntimeFactory = globalThis.__MAYHEM_RUNTIME.GameLobbySyncRuntime;
        var partyView = partyViewFactory && partyViewFactory.create ? partyViewFactory.create({
            getState: function () { return partyState; },
            setState: function (nextState) { partyState = nextState || null; },
            partyRosterPreviewShell: partyRosterPreviewShell,
            partyRosterPreview: partyRosterPreview,
            partyRosterModalContent: partyRosterModalContent,
            memberCanBeFriended: memberCanBeFriended,
            onAddFriend: function (targetUserId, targetLabel) {
                performFriendAction('add', targetUserId, 'Saving friend...', 'Added ' + String(targetLabel || '').toUpperCase() + ' to friends.');
            },
            isRoomActionInFlight: function () { return roomActionInFlight; }
        }) : null;
        var friendsView = friendsViewFactory && friendsViewFactory.create ? friendsViewFactory.create({
            getState: function () { return friendsState; },
            setState: function (nextState) { friendsState = nextState || null; },
            friendsPreview: friendsPreview,
            friendsModalContent: friendsModalContent,
            isLoggedIn: isLoggedIn,
            updateSocialSubtitle: updateSocialSubtitle,
            performFriendAction: performFriendAction
        }) : null;
        var privateRoomViewFactory = globalThis.__MAYHEM_RUNTIME.GameLobbyPrivateRoomView;
        var privateRoomViewController = privateRoomViewFactory && privateRoomViewFactory.create ? privateRoomViewFactory.create({
            getState: function () { return privateRoomState; },
            setState: function (nextState) { privateRoomState = nextState || null; },
            getPartyState: function () { return partyState; },
            privateRoomStatusEl: privateRoomStatusEl,
            privateRoomSummaryEl: privateRoomSummaryEl,
            privateRoomTeamAlpha: privateRoomTeamAlpha,
            privateRoomTeamBravo: privateRoomTeamBravo,
            moveMember: movePrivateRoomMember
        }) : null;

        function renderPartyRosterModal() {
            if (partyView) partyView.renderModal();
        }

        function applyPartyState(nextState) {
            partyState = nextState || null;
            partyStateAvailability = 'ready';
            if (partyView) partyView.applyState(partyState);
            syncMenuControlState();
        }

        function setPartyUnavailable(err, options) {
            options = options || {};
            partyStateAvailability = 'unavailable';
            var message = syncFailureMessage('Party', err);
            if (partyView) partyView.setUnavailable(message);
            setPartyStatus(message, true);
            syncMenuControlState();
            logSyncError(options.scope || 'party', err);
        }

        function renderFriendsModal() {
            if (friendsView) friendsView.renderModal();
        }

        function applyFriendsState(nextState) {
            friendsState = nextState || null;
            if (friendsView) friendsView.applyState(friendsState);
            syncMenuControlState();
        }

        function setFriendsUnavailable(err, options) {
            options = options || {};
            var message = syncFailureMessage('Friends', err);
            if (friendsView) friendsView.setUnavailable(message);
            setFriendsStatus(message, true);
            syncMenuControlState();
            logSyncError(options.scope || 'friends', err);
        }

        function setPrivateRoomStatus(text, isErr) {
            if (privateRoomViewController) {
                privateRoomViewController.setStatus(text, isErr);
            }
        }

        function applyPrivateRoomState(nextState) {
            var hadLoadedPrivateRoom = !!(privateRoomState && privateRoomState.room);
            privateRoomState = nextState || null;
            var hasLoadedPrivateRoom = !!(privateRoomState && privateRoomState.room);
            var hasPrivateRoom = hasPrivateRoomState();
            if (!hasPrivateRoom && socialView === 'room') {
                socialView = 'party';
            } else if (!hadLoadedPrivateRoom && hasLoadedPrivateRoom) {
                socialView = 'room';
            }
            if (privateRoomViewController) {
                privateRoomViewController.applyState(privateRoomState);
            }
            syncMenuControlState();
        }

        function setPrivateRoomUnavailable(err, options) {
            options = options || {};
            var message = syncFailureMessage('Private room', err);
            if (hasPrivateRoomState()) {
                socialView = 'room';
            }
            if (privateRoomViewController) {
                privateRoomViewController.setUnavailable(message);
            }
            setPrivateRoomStatus(message, true);
            syncMenuControlState();
            logSyncError(options.scope || 'private-room', err);
        }

        function partyRequest(method, payload) {
            var identity = currentPartyIdentity();
            if (!identity || !identity.id) {
                return Promise.reject(new Error('Party identity unavailable.'));
            }
            if (method === 'GET') {
                var partyUrl = new URL(lobbyApi.resolveApiUrl(lobbyApi.partyPath()), window.location.origin);
                partyUrl.searchParams.set('actorId', String(identity.id));
                partyUrl.searchParams.set('displayName', String(identity.username || identity.id));
                partyUrl.searchParams.set('activityState', currentPartyActivityState());
                return lobbyApi.requestJson(partyUrl.toString(), { method: 'GET' }).then(function (body) {
                    return body.state || null;
                });
            }
            return lobbyApi.requestJson(lobbyApi.partyPath(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(Object.assign({
                    actorId: String(identity.id),
                    displayName: String(identity.username || identity.id),
                    activityState: currentPartyActivityState()
                }, payload || {}))
            }).then(function (body) {
                return body.state || null;
            });
        }

        function reconcilePartyState(fallbackState, options) {
            options = options || {};
            var swallowError = options.swallowError !== false;
            var shouldRefreshPrivateRoom = options.refreshPrivateRoom !== false;
            var shouldAutoJoin = options.autoJoin !== false;
            return partyRequest('GET')
                .then(function (state) {
                    var nextState = state || fallbackState || null;
                    applyPartyState(nextState);
                    updatePartyIdentityDisplay();
                    if (shouldRefreshPrivateRoom) refreshPrivateRoomState(true);
                    if (shouldAutoJoin) maybeAutoJoinAssignedPrivateRoom(nextState);
                    return nextState;
                })
                .catch(function (err) {
                    if (!swallowError) throw err;
                    var nextState = fallbackState || partyState || null;
                    if (fallbackState) {
                        applyPartyState(fallbackState);
                    } else {
                        setPartyUnavailable(err, { scope: 'party-reconcile' });
                    }
                    updatePartyIdentityDisplay();
                    if (shouldRefreshPrivateRoom) refreshPrivateRoomState(true);
                    if (shouldAutoJoin) maybeAutoJoinAssignedPrivateRoom(nextState);
                    return nextState;
                });
        }

        function refreshPartyState(silent) {
            var identity = currentPartyIdentity();
            if (!identity || !identity.id || !lobbyApi || !lobbyApi.requestJson) {
                applyPartyState(null);
                setPartyStatus('', false);
                return Promise.resolve(null);
            }

            return reconcilePartyState(partyState, { swallowError: !!silent })
                .then(function (state) {
                    if (partyStateAvailability === 'ready') {
                        setPartyStatus('', false);
                    }
                    return state;
                })
                .catch(function (err) {
                    setPartyUnavailable(err, { scope: silent ? 'party' : 'party-refresh' });
                    return null;
                });
        }

        function runPartyAction(action, payload, pendingText) {
            if (roomActionInFlight) {
                return Promise.resolve(null);
            }

            setRoomActionBusy(true, pendingText || 'Working...');
            if (pendingText) setPartyStatus(pendingText, false);
            return partyRequest('POST', Object.assign({ action: action }, payload || {}))
                .then(function (state) {
                    return reconcilePartyState(state).then(function (resolvedState) {
                        var nextState = resolvedState || state || null;
                        if (action === 'leave') {
                            setPartyStatus('Left party.', false);
                        } else if (action === 'join') {
                            setPartyStatus('Party joined.', false);
                        } else if (action === 'lock') {
                            var locked = !!(nextState && nextState.party && nextState.party.joinLocked);
                            setPartyStatus(locked ? 'Party locked.' : 'Party unlocked.', false);
                        } else {
                            setPartyStatus('', false);
                        }
                        setRoomActionBusy(false, '');
                        return nextState;
                    });
                })
                .catch(function (err) {
                    setPartyStatus((err && err.message) ? err.message : 'Party action failed.', true);
                    setRoomActionBusy(false, '');
                    return null;
                });
        }

        function fetchPrivateRoomState() {
            var assigned = currentAssignedPrivateRoom();
            if (!assigned) {
                return Promise.resolve(null);
            }
            var url = new URL(lobbyApi.resolveApiUrl(lobbyApi.privateRoomPath()), window.location.origin);
            var identity = currentPartyIdentity();
            url.searchParams.set('actorId', String(identity && identity.id || ''));
            url.searchParams.set('displayName', String(identity && identity.username || identity && identity.id || ''));
            return lobbyApi.requestJson(url.toString(), { method: 'GET' }).then(function (body) {
                return body.state || null;
            });
        }

        function reconcilePrivateRoomState(fallbackState) {
            return fetchPrivateRoomState()
                .then(function (state) {
                    var nextState = state || fallbackState || null;
                    applyPrivateRoomState(nextState);
                    return nextState;
                })
                .catch(function (err) {
                    var nextState = fallbackState || privateRoomState || null;
                    if (fallbackState) {
                        applyPrivateRoomState(fallbackState);
                    } else {
                        setPrivateRoomUnavailable(err, { scope: 'private-room-reconcile' });
                    }
                    return nextState;
                });
        }

        function reconcilePartyAndPrivateRoom() {
            return reconcilePartyState(partyState, {
                refreshPrivateRoom: false,
                autoJoin: false
            }).then(function () {
                return reconcilePrivateRoomState(privateRoomState);
            });
        }

        function refreshPrivateRoomState(silent) {
            var assigned = currentAssignedPrivateRoom();
            if (!assigned) {
                applyPrivateRoomState(null);
                setPrivateRoomStatus('', false);
                return Promise.resolve(null);
            }
            return fetchPrivateRoomState()
                .then(function (state) {
                    applyPrivateRoomState(state);
                    setPrivateRoomStatus('', false);
                    return state;
                })
                .catch(function (err) {
                    setPrivateRoomUnavailable(err, { scope: silent ? 'private-room' : 'private-room-refresh' });
                    return privateRoomState;
                });
        }

        function privateRoomRequest(action, payload, pendingText) {
            if (pendingText) setPrivateRoomStatus(pendingText, false);
            return lobbyApi.requestJson(lobbyApi.privateRoomPath(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(currentRoomActorPayload(Object.assign({ action: action }, payload || {})))
            }).then(function (body) {
                body = body || {};
                var fallbackState = body && body.state !== undefined ? body.state : null;
                if (fallbackState !== null) {
                    applyPrivateRoomState(fallbackState);
                }
                if (action === 'create' || action === 'join') {
                    return reconcilePartyAndPrivateRoom().then(function (state) {
                        body.state = state || fallbackState || null;
                        return body;
                    });
                }
                return reconcilePrivateRoomState(fallbackState).then(function (state) {
                    body.state = state || fallbackState || null;
                    return body;
                });
            });
        }

        function friendRequest(action, payload) {
            if (!isLoggedIn() || !lobbyApi || !lobbyApi.requestJson || !lobbyApi.friendsPath) {
                return Promise.reject(new Error('Log in to use friend actions.'));
            }
            return lobbyApi.requestJson(lobbyApi.friendsPath(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(Object.assign({ action: action }, payload || {}))
            });
        }

        function refreshFriendsState(silent) {
            if (!isLoggedIn() || !lobbyApi || !lobbyApi.requestJson || !lobbyApi.friendsPath) {
                applyFriendsState(null);
                setFriendsStatus('', false);
                return Promise.resolve(null);
            }
            return lobbyApi.requestJson(lobbyApi.friendsPath(), { method: 'GET' })
                .then(function (body) {
                    applyFriendsState(body && body.friends ? body.friends : null);
                    setFriendsStatus('', false);
                    return friendsState;
                })
                .catch(function (err) {
                    setFriendsUnavailable(err, { scope: silent ? 'friends' : 'friends-refresh' });
                    return friendsState;
                });
        }

        function refreshBackgroundState(includePrivateRoom) {
            refreshPartyState(true);
            refreshFriendsState(true);
            if (includePrivateRoom !== false) {
                refreshPrivateRoomState(true);
            }
        }

        function performFriendAction(action, targetUserId, pendingText, successText) {
            if (roomActionInFlight) {
                return Promise.resolve(null);
            }
            setRoomActionBusy(true, pendingText || 'Working...');
            setFriendsStatus(pendingText || 'Working...', false);
            return friendRequest(action, { targetUserId: targetUserId })
                .then(function (body) {
                    if (body && body.friends) applyFriendsState(body.friends);
                    if (body && body.state) {
                        applyPartyState(body.state);
                        setSocialView('party');
                    } else {
                        refreshPartyState(true);
                    }
                    setFriendsStatus(successText || 'Updated.', false);
                    setRoomActionBusy(false, '');
                    return body;
                })
                .catch(function (err) {
                    setFriendsStatus((err && err.message) ? err.message : 'Friend action failed.', true);
                    setRoomActionBusy(false, '');
                    return null;
                });
        }

        function currentRoomActorPayload(extra) {
            var identity = currentPartyIdentity();
            return Object.assign({
                actorId: identity && identity.id ? String(identity.id) : '',
                displayName: identity && identity.username ? String(identity.username) : '',
                activityState: currentPartyActivityState()
            }, extra || {});
        }

        function buildGuestLeavePayload(identity) {
            return {
                action: 'leave',
                actorId: String(identity && identity.id || ''),
                displayName: String(identity && identity.username || identity && identity.id || ''),
                activityState: 'menu'
            };
        }

        function resolvePartyUrl() {
            return lobbyApi.resolveApiUrl(lobbyApi.partyPath());
        }

        function resolvePrivateRoomUrl() {
            return lobbyApi.resolveApiUrl(lobbyApi.privateRoomPath());
        }

        function runPrivateRoomHostAction(action, payload, pendingText, successText, failureText, requiredFlag) {
            var controlState = currentMenuControlState();
            if (roomActionInFlight) return Promise.resolve(null);
            if (requiredFlag && !controlState[requiredFlag]) return Promise.resolve(null);
            setRoomActionBusy(true, pendingText || 'Working...');
            return privateRoomRequest(action, payload, pendingText)
                .then(function (result) {
                    setPrivateRoomStatus(successText || '', false);
                    setRoomActionBusy(false, '');
                    return result;
                })
                .catch(function (err) {
                    setPrivateRoomStatus((err && err.message) ? err.message : failureText, true);
                    setRoomActionBusy(false, '');
                    return null;
                });
        }

        function setPrivateRoomMode(roomMode) {
            return runPrivateRoomHostAction(
                'set_mode',
                { roomMode: roomMode },
                'Switching room to ' + String(roomMode || 'ffa').toUpperCase() + '...',
                'Room mode set to ' + String(roomMode || 'ffa').toUpperCase() + '.',
                'Mode change failed.',
                'canEditPrivateRoom'
            );
        }

        function randomizePrivateRoomTeams() {
            return runPrivateRoomHostAction(
                'randomize',
                {},
                'Randomizing teams...',
                'Teams randomized.',
                'Randomize failed.',
                'canRandomizeTeams'
            );
        }

        function startPrivateRoomMatch() {
            return runPrivateRoomHostAction(
                'start',
                {},
                'Starting match...',
                'Private match live.',
                'Start failed.',
                'canStartPrivateRoom'
            );
        }

        function movePrivateRoomMember(memberId, nextTeamId) {
            return runPrivateRoomHostAction(
                'move_member',
                { targetId: memberId, teamId: nextTeamId },
                'Updating teams...',
                'Team layout updated.',
                'Team update failed.',
                'canEditPrivateRoom'
            );
        }


        function maybeAutoJoinAssignedPrivateRoom(state) {
            if (started || !state || !state.self || !state.self.privateRoom) return;
            launchMode('single_cloudflare', {
                roomId: state.self.privateRoom.roomId,
                gameMode: state.self.privateRoom.roomMode || 'ffa'
            });
        }

        function setRoomActionBusy(busy, message) {
            roomActionInFlight = !!busy;
            if (primaryPlayBtn) primaryPlayBtn.disabled = roomActionInFlight;
            if (tdmPlayBtn) tdmPlayBtn.disabled = roomActionInFlight;
            if (lmsPlayBtn) lmsPlayBtn.disabled = roomActionInFlight;
            if (sandboxPlayBtn) sandboxPlayBtn.disabled = roomActionInFlight;
            setSandboxButtonsEnabled(!roomActionInFlight && sandboxRuntimeReady);
            if (createRoomBtn) createRoomBtn.disabled = roomActionInFlight;
            if (joinPrivateRoomBtn) joinPrivateRoomBtn.disabled = roomActionInFlight;
            if (privateRoomInput) privateRoomInput.disabled = roomActionInFlight;
            if (joinPartyBtn) joinPartyBtn.disabled = roomActionInFlight;
            if (partyIdInput) partyIdInput.disabled = roomActionInFlight;
            if (busy) setRoomAccessStatus(message || 'Working...', false);
            syncMenuControlState();
        }

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
            if (sandboxRulesetPanel) {
                sandboxRulesetPanel.hidden = true;
            }
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
            if (
                globalThis.__MAYHEM_RUNTIME.GameSession &&
                globalThis.__MAYHEM_RUNTIME.GameSession.showGameplayPrompt
            ) {
                globalThis.__MAYHEM_RUNTIME.GameSession.showGameplayPrompt();
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
            if (roomActionInFlight || started) return;
            setRoomActionBusy(true, pendingText);
            requestMatchmaking(action, extra)
                .then(function (payload) {
                    setRoomActionBusy(false, '');
                    startAllocatedRoom(payload);
                })
                .catch(function (err) {
                    setRoomActionBusy(false, '');
                    setRoomAccessStatus((err && err.message) ? err.message : 'Room request failed.', true);
                });
        }

        function handlePrivateRoomResult(result, successText) {
            if (!result || !result.state || !result.state.room) {
                throw new Error('Private room response missing room state.');
            }
            var room = result.state.room;
            applyPrivateRoomState(result.state);
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
            if (roomActionInFlight || started) return;
            setRoomActionBusy(true, 'Creating room...');
            privateRoomRequest('create', {}, 'Creating room...')
                .then(function (result) {
                    setRoomActionBusy(false, '');
                    handlePrivateRoomResult(result, 'Room ' + String(result.state.room.roomCode || '').toUpperCase() + ' ready.');
                })
                .catch(function (err) {
                    setRoomActionBusy(false, '');
                    setRoomAccessStatus((err && err.message) ? err.message : 'Private room creation failed.', true);
                });
        }

        function beginPrivateRoomJoin(roomCode) {
            if (roomActionInFlight || started) return;
            setRoomActionBusy(true, 'Joining private room...');
            privateRoomRequest('join', { roomCode: roomCode }, 'Joining private room...')
                .then(function (result) {
                    setRoomActionBusy(false, '');
                    var moved = Number(result.movedCount || 0);
                    var skipped = Number(result.skippedCount || 0);
                    var message = 'Joined room ' + String(result.state.room.roomCode || '').toUpperCase() + '.';
                    if (moved > 1) message += ' Pulled ' + String(moved - 1) + ' party member' + (moved === 2 ? '' : 's') + '.';
                    if (skipped > 0) message += ' ' + String(skipped) + ' member' + (skipped === 1 ? '' : 's') + ' stayed behind.';
                    handlePrivateRoomResult(result, message);
                })
                .catch(function (err) {
                    setRoomActionBusy(false, '');
                    setRoomAccessStatus((err && err.message) ? err.message : 'Private room join failed.', true);
                });
        }

        var syncRuntime = syncRuntimeFactory && syncRuntimeFactory.create ? syncRuntimeFactory.create({
            refreshPartyState: refreshPartyState,
            refreshFriendsState: refreshFriendsState,
            refreshPrivateRoomState: refreshPrivateRoomState,
            updateSocialSubtitle: updateSocialSubtitle,
            getPartyIdentity: currentPartyIdentity,
            buildGuestLeavePayload: buildGuestLeavePayload,
            resolvePartyUrl: resolvePartyUrl,
            resolvePrivateRoomUrl: resolvePrivateRoomUrl
        }) : null;

        syncModeButtonVisibility();
        setAltModesOpen(false);
        setControlsOpen(false);
        setSandboxButtonsEnabled(sandboxRuntimeReady);
        setSocialView('party');
        setPrivateRoomShare('');
        updatePartyIdentityDisplay();
        updateSocialSubtitle();
        applyPartyState(null);
        applyFriendsState(null);
        applyPrivateRoomState(null);
        refreshBackgroundState(false);
        if (syncRuntime) syncRuntime.start();

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
                        if (globalThis.__MAYHEM_RUNTIME.GameSession && globalThis.__MAYHEM_RUNTIME.GameSession.startGameplayFromMenu) {
                            globalThis.__MAYHEM_RUNTIME.GameSession.startGameplayFromMenu(event);
                        }
                    })
                    .catch(function (err) {
                        startPending = false;
                        setRoomAccessStatus((err && err.message) ? err.message : 'Mode launch failed.', true);
                    });
                return;
            }

            if (!handleLaunchResult(result)) return;
            if (globalThis.__MAYHEM_RUNTIME.GameSession && globalThis.__MAYHEM_RUNTIME.GameSession.startGameplayFromMenu) {
                globalThis.__MAYHEM_RUNTIME.GameSession.startGameplayFromMenu(event);
            }
        }

        clickablesApi.bindPrivateRoomSurface({
            privateRoomModeFfaBtn: privateRoomModeFfaBtn,
            privateRoomModeTdmBtn: privateRoomModeTdmBtn,
            privateRoomModeLmsBtn: privateRoomModeLmsBtn,
            privateRoomRandomizeBtn: privateRoomRandomizeBtn,
            privateRoomStartBtn: privateRoomStartBtn,
            setPrivateRoomMode: setPrivateRoomMode,
            randomizePrivateRoomTeams: randomizePrivateRoomTeams,
            startPrivateRoomMatch: startPrivateRoomMatch
        });

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
            runPartyAction: runPartyAction,
            setSocialView: setSocialView,
            isLoggedIn: isLoggedIn,
            refreshFriendsState: refreshFriendsState,
            hasPrivateRoom: hasPrivateRoomState,
            getPartyState: function () { return partyState; },
            renderPartyRosterModal: renderPartyRosterModal,
            renderFriendsModal: renderFriendsModal
        });

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
