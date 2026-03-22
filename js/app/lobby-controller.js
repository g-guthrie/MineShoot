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

    function runtimeModeUi() {
        var deps = runtime.GameLobbyControllerDeps || null;
        return (deps && deps.runtimeModeUi) || runtime.GameRuntimeModeUi || null;
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
        var result = null;
        // Read from sessionStorage first, fall back to localStorage
        var stores = [sessionStore(), localStore()];
        for (var i = 0; i < stores.length; i++) {
            var store = stores[i];
            if (!store || typeof store.getItem !== 'function') continue;
            try {
                var raw = String(store.getItem(RETURN_STATE_KEY) || '').trim();
                if (raw && !result) {
                    var parsed = JSON.parse(raw);
                    if (parsed && typeof parsed === 'object') {
                        result = {
                            activeSurface: parsed.activeSurface === 'room' ? 'room' : 'main',
                            selectedMode: normalizeMode(parsed.selectedMode)
                        };
                    }
                }
                store.removeItem(RETURN_STATE_KEY);
            } catch (_err) {
                // no-op
            }
        }
        return result;
    }

    function writeReturnState(payload) {
        var value = JSON.stringify({
            activeSurface: payload && payload.activeSurface === 'room' ? 'room' : 'main',
            selectedMode: normalizeMode(payload && payload.selectedMode)
        });
        // Write to both sessionStorage and localStorage so state survives page refresh
        var stores = [sessionStore(), localStore()];
        for (var i = 0; i < stores.length; i++) {
            var store = stores[i];
            if (!store || typeof store.setItem !== 'function') continue;
            try {
                store.setItem(RETURN_STATE_KEY, value);
            } catch (_err) {
                // no-op
            }
        }
    }

    function normalizeMode(modeId) {
        var mode = String(modeId || '').trim().toLowerCase();
        if (mode === 'sandbox') return 'sandbox';
        if (mode === 'tdm' || mode === 'ffa') return mode;
        return '';
    }

    function sharedGameMode(modeId) {
        var shared = runtime.GameShared || {};
        if (shared.getGameMode) return shared.getGameMode(modeId);
        var normalized = normalizeMode(modeId);
        if (normalized === 'ffa') return { label: 'Free For All' };
        if (normalized === 'tdm') return { label: 'Team Death Match' };
        return null;
    }

    function modeLabel(modeId) {
        var mode = normalizeMode(modeId);
        var gameMode = sharedGameMode(mode);
        if (gameMode && gameMode.label) return String(gameMode.label || '');
        if (mode === 'sandbox') return 'Offline Sandbox';
        return '';
    }

    function modePillLabel(modeId) {
        return modeLabel(modeId);
    }

    function launchPillLabel(modeId) {
        var label = modePillLabel(modeId);
        return label ? ('Play ' + label) : 'Play';
    }

    function isRoomSeedMode(modeId) {
        var mode = normalizeMode(modeId);
        return mode === 'tdm';
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
            leaveRoomConfirmOpen: false,
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
            matchMenu: null,
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

    function normalizeMatchMenuModel(payload) {
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
        var deps = options.deps || runtime.GameLobbyControllerDeps || {};

        if (typeof options.prepareMenu === 'function') {
            options.prepareMenu();
        }

        var storeFactory = deps.storeFactory || runtime.GameMenuState;
        if (!storeFactory || !storeFactory.createStore) {
            throw new Error('GameMenuState is required before GameLobbyController.init.');
        }

        var lobbyApi = deps.lobbyApi || runtime.GameLobbyApi;
        var authApi = deps.authApi || runtime.GameNetAuth || null;
        var modalManager = deps.modalManager || runtime.GameModalManager || null;
        var sessionFactory = deps.sessionFactory || runtime.GameLobbySession || null;
        var loadoutApi = deps.loadoutApi || runtime.GameMenuLoadout || null;
        var privateRoomViewFactory = deps.privateRoomViewFactory || runtime.GameLobbyPrivateRoomView || null;

        var store = storeFactory.createStore(defaultState());
        runtime.GameMenuStore = store;

        var controllerBusy = false;
        var session = null;
        var privateRoomViewController = null;
        var actionFactory = deps.actionFactory || runtime.GameLobbyActions || null;
        var actionApi = null;
        var rendererFactory = deps.rendererFactory || runtime.GameLobbyRenderer || null;
        var rendererApi = null;

        function getSessionApi() {
            if (deps && typeof deps.getSessionApi === 'function') {
                return deps.getSessionApi();
            }
            return runtime.GameSession || null;
        }

        var elements = {
            overlay: document.getElementById('overlay'),
            menuHeader: document.getElementById('menu-header'),
            menuSurface: document.getElementById('menu-surface'),
            inlineToast: document.getElementById('menu-inline-toast'),
            menuFeedback: document.getElementById('menu-feedback'),
            menuPartyIdBtn: document.getElementById('menu-party-id-btn'),
            menuPartyIdLabel: document.getElementById('menu-party-id-label'),
            menuPartyIdValue: document.getElementById('menu-party-id-value'),
            activeHeaderStatus: document.getElementById('active-match-header-feedback'),
            activeInviteBanner: document.getElementById('active-match-primary-banner'),
            activeInviteCopy: document.getElementById('active-match-primary-banner-copy'),
            activeInviteActions: document.getElementById('active-match-primary-banner-actions'),
            activeInviteAcceptBtn: document.getElementById('active-match-primary-banner-accept-btn'),
            activeInviteDismissBtn: document.getElementById('active-match-primary-banner-dismiss-btn'),
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
            sandboxModeBtn: document.getElementById('sandbox-mode-btn'),
            loadoutStartBtn: document.getElementById('loadout-start-btn'),
            roomAccessStatus: document.getElementById('room-access-status'),
            roomActionBtn: document.getElementById('continue-loadout-btn'),
            menuSessionActions: document.getElementById('active-match-shell'),
            menuSessionStats: document.getElementById('active-match-pill-grid'),
            menuSessionStatus: document.getElementById('active-match-mode-pill'),
            menuSessionContext: document.getElementById('active-match-context-pill'),
            menuSessionKd: document.getElementById('active-match-primary-stat-pill'),
            menuSessionMeta: document.getElementById('active-match-secondary-stat-pill'),
            playBtn: document.getElementById('play-btn'),
            backBtn: document.getElementById('back-mode-btn'),
            menuBody: document.getElementById('menu-body'),
            leaveConfirmOverlay: document.getElementById('leave-confirm-overlay'),
            leaveConfirmCancelBtn: document.getElementById('leave-confirm-cancel-btn'),
            leaveConfirmAcceptBtn: document.getElementById('leave-confirm-accept-btn'),
            partyRoomSection: document.getElementById('party-room-section'),
            partyHeroLeaveBtn: document.getElementById('party-hero-leave-btn'),
            privateRoomStatus: document.getElementById('private-room-status'),
            roomSocialFeedback: document.getElementById('private-room-status'),
            roomSocialInviteBanner: document.getElementById('room-social-invite-banner'),
            roomSocialInviteCopy: document.getElementById('room-social-invite-copy'),
            roomSocialInviteActions: document.getElementById('room-social-invite-actions'),
            roomSocialInviteAcceptBtn: document.getElementById('room-social-invite-accept-btn'),
            roomSocialInviteDismissBtn: document.getElementById('room-social-invite-dismiss-btn'),
            roomSharePanel: document.getElementById('room-share-panel'),
            roomShareCode: document.getElementById('room-share-code'),
            copyRoomCodeBtn: document.getElementById('copy-room-code-btn'),
            privateRoomView: document.getElementById('private-room-view'),
            privateRoomModeFfaBtn: document.getElementById('private-room-mode-ffa-btn'),
            privateRoomModeTdmBtn: document.getElementById('private-room-mode-tdm-btn'),
            privateRoomTeamCountActions: document.getElementById('private-room-team-count-actions'),
            privateRoomTeams2Btn: document.getElementById('private-room-teams-2-btn'),
            privateRoomTeams3Btn: document.getElementById('private-room-teams-3-btn'),
            privateRoomTeams4Btn: document.getElementById('private-room-teams-4-btn'),
            privateRoomRandomizeBtn: document.getElementById('private-room-randomize-btn'),
            privateRoomStartBtn: document.getElementById('private-room-start-btn'),
            privateRoomEnterBtn: document.getElementById('private-room-enter-btn'),
            privateRoomInvitePartyBtn: document.getElementById('private-room-invite-party-btn'),
            privateRoomInviteLockBtn: document.getElementById('private-room-invite-lock-btn'),
            privateRoomUnassignedWrap: document.getElementById('private-room-unassigned-wrap'),
            privateRoomUnassigned: document.getElementById('private-room-unassigned'),
            privateRoomRosterGrid: document.getElementById('private-room-roster-grid'),
            privateRoomLeaveBtn: document.getElementById('private-room-leave-btn'),
            copyRoomCodeLabel: document.getElementById('copy-room-code-label'),
            leaveRoomConfirmOverlay: document.getElementById('leave-room-confirm-overlay'),
            leaveRoomConfirmCancelBtn: document.getElementById('leave-room-confirm-cancel-btn'),
            leaveRoomConfirmAcceptBtn: document.getElementById('leave-room-confirm-accept-btn')
        };

        if (!rendererFactory || !rendererFactory.create) {
            throw new Error('GameLobbyRenderer is required before GameLobbyController.init.');
        }
        if (!actionFactory || !actionFactory.create) {
            throw new Error('GameLobbyActions is required before GameLobbyController.init.');
        }
        rendererApi = rendererFactory.create({
            elements: elements,
            getState: getState,
            getSession: function () { return session; },
            isBusy: busy,
            getCapabilities: capabilities,
            patchState: patchState,
            render: render,
            appendFriendAction: appendFriendAction,
            savedFriendIds: savedFriendIds,
            setFriendTargetValue: setFriendTargetValue,
            localizeServiceStatusText: localizeServiceStatusText,
            isLocalEnvironment: isLocalEnvironment,
            roomCodeFromRoomId: roomCodeFromRoomId,
            currentPartyIdentity: currentPartyIdentity,
            launchPillLabel: launchPillLabel,
            modeLabel: modeLabel,
            normalizeMode: normalizeMode,
            normalizeMatchMenuModel: normalizeMatchMenuModel,
            getPrivateRoomViewController: function () { return privateRoomViewController; }
        });
        actionApi = actionFactory.create({
            elements: elements,
            lobbyApi: lobbyApi,
            launchModeById: options.launchModeById,
            getState: getState,
            getSession: function () { return session; },
            getSessionApi: getSessionApi,
            setBusy: function (value) { controllerBusy = !!value; },
            isBusy: busy,
            render: render,
            normalizeMode: normalizeMode,
            modeLabel: modeLabel,
            roomCodeFromRoomId: roomCodeFromRoomId,
            selectedModeForRoomSeed: selectedModeForRoomSeed,
            currentPartyIdentity: currentPartyIdentity,
            setLaunchState: setLaunchState,
            writeReturnState: writeReturnState,
            setActiveSurface: setActiveSurface,
            setModeListOpen: setModeListOpen,
            setPartyStatus: setPartyStatus,
            setRoomStatus: setRoomStatus,
            patchState: patchState,
            getFriendTargetId: currentFriendTargetId,
            setFriendTargetValue: setFriendTargetValue,
            syncLoadoutState: syncLoadoutState,
            openLeaveConfirm: openLeaveConfirm
        });

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
            patchState({
                launch: Object.assign({}, getState().launch || {}, patch || {})
            });
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
            if (actionApi && actionApi.launchAssignedMatch) {
                return actionApi.launchAssignedMatch(nextPartyState);
            }
        }

        function openUtility() {
            patchState({ utilityOpen: true });
        }

        function closeUtility() {
            patchState({ utilityOpen: false });
        }

        function openLeaveConfirm() {
            patchState({ confirmLeaveOpen: true });
            if (elements.leaveConfirmCancelBtn) setTimeout(function () { elements.leaveConfirmCancelBtn.focus(); }, 0);
        }

        function closeLeaveConfirm() {
            patchState({ confirmLeaveOpen: false });
        }

        function modalIsOpen() {
            return !!(modalManager && modalManager.isOpen && modalManager.isOpen());
        }

        function launchGame(modeId) {
            return actionApi && actionApi.launchGame
                ? actionApi.launchGame(modeId)
                : Promise.resolve(false);
        }

        function handleLaunchResult(result, fallbackMessage) {
            return actionApi && actionApi.handleLaunchResult
                ? actionApi.handleLaunchResult(result, fallbackMessage)
                : false;
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

        function setFriendTargetValue(nextValue, sourceEl) {
            var normalized = String(nextValue || '');
            if (sourceEl && sourceEl.value !== normalized) sourceEl.value = normalized;
            if (elements.partyIdInput && elements.partyIdInput !== sourceEl && elements.partyIdInput.value !== normalized) {
                elements.partyIdInput.value = normalized;
            }
        }

        function currentFriendTargetId() {
            return elements.partyIdInput ? String(elements.partyIdInput.value || '').trim() : '';
        }

        function handleInviteFriendAction() {
            if (actionApi && actionApi.handleInviteFriendAction) {
                actionApi.handleInviteFriendAction();
            }
        }

        function handleJoinFriendAction() {
            if (actionApi && actionApi.handleJoinFriendAction) {
                actionApi.handleJoinFriendAction();
            }
        }

        function renderPartyMembers(state) {
            if (rendererApi && rendererApi.renderPartyMembers) {
                rendererApi.renderPartyMembers(state);
            }
        }

        function renderFriends(state) {
            if (rendererApi && rendererApi.renderFriends) {
                rendererApi.renderFriends(state);
            }
        }

        function renderPrivateRoom(state) {
            if (rendererApi && rendererApi.renderPrivateRoom) {
                rendererApi.renderPrivateRoom(state);
            }
        }

        function renderFeedback(state) {
            if (rendererApi && rendererApi.renderFeedback) {
                rendererApi.renderFeedback(state);
            }
        }

        function renderSocialHeroStatus(state) {
            if (rendererApi && rendererApi.renderSocialHeroStatus) {
                rendererApi.renderSocialHeroStatus(state);
            }
        }

        function buildSocialActionFeedback(state) {
            return rendererApi && rendererApi.buildSocialActionFeedback
                ? rendererApi.buildSocialActionFeedback(state)
                : null;
        }

        function renderRoomSocialFeedback(state) {
            if (rendererApi && rendererApi.renderRoomSocialFeedback) {
                rendererApi.renderRoomSocialFeedback(state);
            }
        }

        function applyActiveHeaderFeedback(feedback, activeMatchShell) {
            if (rendererApi && rendererApi.applyActiveHeaderFeedback) {
                rendererApi.applyActiveHeaderFeedback(feedback, activeMatchShell);
            }
        }

        function buildActiveMatchViewModel(state) {
            return rendererApi && rendererApi.buildActiveMatchViewModel
                ? rendererApi.buildActiveMatchViewModel(state)
                : null;
        }

        function renderPrimaryBanner(model, state, activeMatchShell) {
            if (rendererApi && rendererApi.renderPrimaryBanner) {
                rendererApi.renderPrimaryBanner(model, state, activeMatchShell);
            }
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
            if (rendererApi && rendererApi.render) {
                rendererApi.render();
            }
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
                privateRoomUnassignedWrap: elements.privateRoomUnassignedWrap,
                privateRoomUnassigned: elements.privateRoomUnassigned,
                privateRoomRosterGrid: elements.privateRoomRosterGrid,
                privateRoomRandomizeBtn: elements.privateRoomRandomizeBtn,
                moveMember: function (memberId, nextTeamId) {
                    if (!session || !session.movePrivateRoomMember) return Promise.resolve(null);
                    return session.movePrivateRoomMember(memberId, nextTeamId);
                },
                selfPickTeam: function (teamId) {
                    if (!session || !session.selfPickTeam) return Promise.resolve(null);
                    return session.selfPickTeam(teamId);
                },
                getCapabilities: function () {
                    return capabilities();
                }
            });
        }

        session = sessionFactory && sessionFactory.create ? sessionFactory.create({
            lobbyApi: lobbyApi,
            authApi: authApi,
            getActivityState: function () {
                var sessionApi = getSessionApi();
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
                if (privateRoomViewController && privateRoomViewController.resetFailures) {
                    privateRoomViewController.resetFailures();
                }
                render();
                // Auto-launch when private room phase becomes active (WS fast path)
                if (nextState && nextState.room && String(nextState.room.roomPhase || '') === 'active') {
                    if (actionApi && actionApi.launchFromPrivateRoomState) {
                        actionApi.launchFromPrivateRoomState(nextState);
                    }
                }
            },
            onPrivateRoomUnavailable: function (message) {
                if (privateRoomViewController && privateRoomViewController.setUnavailable) {
                    privateRoomViewController.setUnavailable(message);
                }
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

        if (elements.partyIdInput) {
            elements.partyIdInput.addEventListener('input', function () {
                setFriendTargetValue(String(this.value || ''), this);
            });
        }
        bindClick(elements.inviteFriendBtn, handleInviteFriendAction);
        bindClick(elements.joinFriendBtn, handleJoinFriendAction);
        bindEnter(elements.partyIdInput, function () {
            if (elements.joinFriendBtn) elements.joinFriendBtn.click();
        });
        bindClick(elements.joinRoomBtn, function () {
            if (actionApi && actionApi.joinPrivateRoomByCode) {
                actionApi.joinPrivateRoomByCode(elements.roomCodeInput ? elements.roomCodeInput.value : '');
            }
        });
        bindEnter(elements.roomCodeInput, function () {
            if (elements.joinRoomBtn) elements.joinRoomBtn.click();
        });
        function acceptIncomingInvite() {
            return actionApi && actionApi.acceptIncomingInvite
                ? actionApi.acceptIncomingInvite()
                : false;
        }

        function dismissIncomingInvite() {
            return actionApi && actionApi.dismissIncomingInvite
                ? actionApi.dismissIncomingInvite()
                : false;
        }

        bindClick(elements.socialDirectInviteAcceptBtn, acceptIncomingInvite);
        bindClick(elements.activeInviteAcceptBtn, acceptIncomingInvite);
        bindClick(elements.roomSocialInviteAcceptBtn, acceptIncomingInvite);
        bindClick(elements.socialDirectInviteDismissBtn, dismissIncomingInvite);
        bindClick(elements.activeInviteDismissBtn, dismissIncomingInvite);
        bindClick(elements.roomSocialInviteDismissBtn, dismissIncomingInvite);

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
            patchState({ leaveRoomConfirmOpen: false });
            setActiveSurface('main');
            render();
        });
        function resumeGameplay(event) {
            if (actionApi && actionApi.resumeGameplay) {
                actionApi.resumeGameplay(event);
            }
        }
        bindClick(elements.settingsAccountBtn, function () {
            closeUtility();
            render();
            if (elements.accountToggleBtn) {
                elements.accountToggleBtn.click();
            }
        });

        function selectMode(modeId) {
            if (actionApi && actionApi.selectMode) {
                actionApi.selectMode(modeId);
            }
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
        bindClick(elements.sandboxModeBtn, function () { selectMode('sandbox'); });

        bindClick(elements.roomActionBtn, function () {
            if (actionApi && actionApi.handleRoomAction) {
                actionApi.handleRoomAction();
            }
        });

        function leaveParty() {
            if (actionApi && actionApi.leaveParty) {
                actionApi.leaveParty();
            }
        }

        bindClick(elements.partyHeroLeaveBtn, leaveParty);

        bindClick(elements.copyRoomCodeBtn, function () {
            var value = elements.roomShareCode ? elements.roomShareCode.textContent : '';
            copyText(
                value,
                function () {
                    if (elements.copyRoomCodeLabel) {
                        elements.copyRoomCodeLabel.textContent = 'Copied!';
                        setTimeout(function () {
                            if (elements.copyRoomCodeLabel) elements.copyRoomCodeLabel.textContent = 'Copy';
                        }, 2000);
                    }
                },
                function () { setRoomStatus('Copy failed.', true); render(); },
                function () { setRoomStatus('Copy unavailable.', false); render(); }
            );
        });
        bindClick(elements.privateRoomModeFfaBtn, function () {
            if (actionApi && actionApi.setPrivateRoomMode) actionApi.setPrivateRoomMode('ffa');
        });
        bindClick(elements.privateRoomModeTdmBtn, function () {
            if (actionApi && actionApi.setPrivateRoomMode) actionApi.setPrivateRoomMode('tdm');
        });
        bindClick(elements.privateRoomTeams2Btn, function () {
            if (actionApi && actionApi.setPrivateRoomTeamCount) actionApi.setPrivateRoomTeamCount(2);
        });
        bindClick(elements.privateRoomTeams3Btn, function () {
            if (actionApi && actionApi.setPrivateRoomTeamCount) actionApi.setPrivateRoomTeamCount(3);
        });
        bindClick(elements.privateRoomTeams4Btn, function () {
            if (actionApi && actionApi.setPrivateRoomTeamCount) actionApi.setPrivateRoomTeamCount(4);
        });
        bindClick(elements.privateRoomInvitePartyBtn, function () {
            if (actionApi && actionApi.invitePartyToPrivateRoom) actionApi.invitePartyToPrivateRoom();
        });
        bindClick(elements.privateRoomInviteLockBtn, function () {
            if (actionApi && actionApi.togglePrivateRoomInviteLock) actionApi.togglePrivateRoomInviteLock();
        });
        bindClick(elements.privateRoomRandomizeBtn, function () {
            if (actionApi && actionApi.randomizePrivateRoomTeams) actionApi.randomizePrivateRoomTeams();
        });
        bindClick(elements.privateRoomStartBtn, function () {
            if (actionApi && actionApi.startPrivateRoomMatch) actionApi.startPrivateRoomMatch();
        });
        bindClick(elements.privateRoomEnterBtn, function () {
            if (actionApi && actionApi.enterPrivateRoom) {
                actionApi.enterPrivateRoom();
            }
        });
        bindClick(elements.privateRoomLeaveBtn, function () {
            patchState({ leaveRoomConfirmOpen: true });
            render();
            if (elements.leaveRoomConfirmCancelBtn) setTimeout(function () { elements.leaveRoomConfirmCancelBtn.focus(); }, 0);
        });
        bindClick(elements.leaveRoomConfirmCancelBtn, function () {
            patchState({ leaveRoomConfirmOpen: false });
            render();
        });
        bindClick(elements.leaveRoomConfirmAcceptBtn, function () {
            patchState({ leaveRoomConfirmOpen: false });
            if (actionApi && actionApi.leavePrivateRoom) actionApi.leavePrivateRoom();
            render();
        });

        bindClick(elements.leaveConfirmCancelBtn, function () {
            closeLeaveConfirm();
            render();
        });
        bindClick(elements.leaveConfirmAcceptBtn, function () {
            closeLeaveConfirm();
            render();
            if (actionApi && actionApi.returnToMenu) actionApi.returnToMenu();
        });

        if (elements.overlay) {
            elements.overlay.addEventListener('click', function (event) {
                var state = getState();
                if (!state.paused || state.utilityOpen || state.confirmLeaveOpen) return;
                if (elements.menuSurface && isNodeWithin(event.target, elements.menuSurface)) return;
                resumeGameplay(event);
            });
        }
        if (elements.utilityOverlay) {
            document.addEventListener('click', function (event) {
                if (getState().utilityOpen && elements.utilityOverlay && !isNodeWithin(event.target, elements.utilityOverlay) && event.target !== elements.utilityToggleBtn) {
                    closeUtility();
                    render();
                }
            });
        }
        document.addEventListener('keydown', function (event) {
            // Focus trap for inline confirm dialogs
            if (event.key === 'Tab') {
                var trapTarget = null;
                if (getState().leaveRoomConfirmOpen && elements.leaveRoomConfirmOverlay) {
                    trapTarget = elements.leaveRoomConfirmOverlay;
                } else if (getState().confirmLeaveOpen && elements.leaveConfirmOverlay) {
                    trapTarget = elements.leaveConfirmOverlay;
                }
                if (trapTarget) {
                    var focusable = trapTarget.querySelectorAll(
                        'button:not([hidden]):not([disabled]), input:not([hidden]):not([disabled]), [tabindex]:not([tabindex="-1"]):not([hidden])'
                    );
                    if (focusable.length) {
                        var first = focusable[0];
                        var last = focusable[focusable.length - 1];
                        if (event.shiftKey) {
                            if (document.activeElement === first) { event.preventDefault(); last.focus(); }
                        } else {
                            if (document.activeElement === last) { event.preventDefault(); first.focus(); }
                        }
                    }
                    return;
                }
            }
            if (event.key !== 'Escape') return;
            if (getState().leaveRoomConfirmOpen) {
                event.preventDefault();
                event.stopPropagation();
                patchState({ leaveRoomConfirmOpen: false });
                render();
                return;
            }
            if (getState().confirmLeaveOpen) {
                event.preventDefault();
                event.stopPropagation();
                closeLeaveConfirm();
                render();
                return;
            }
            if (getState().utilityOpen) {
                event.preventDefault();
                event.stopPropagation();
                closeUtility();
                render();
                return;
            }
            if (getState().paused) {
                if (modalIsOpen()) return;
                event.preventDefault();
                if (event.stopImmediatePropagation) event.stopImmediatePropagation();
                else if (event.stopPropagation) event.stopPropagation();
                // Browsers block requestPointerLock() from Escape keydown,
                // so just focus the resume button — player taps Enter or clicks.
                if (elements.playBtn) {
                    elements.playBtn.focus();
                }
                return;
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
                if (actionApi && actionApi.launchDevMode) actionApi.launchDevMode(modeId);
            });
        }

        if (window && typeof window.addEventListener === 'function') {
            window.addEventListener('mayhem-session-state', function (event) {
                syncSessionState(event && event.detail ? event.detail : null);
            });
            window.addEventListener('mayhem-menu-match-model', function (event) {
                patchState({ matchMenu: normalizeMatchMenuModel(event && event.detail ? event.detail : null) });
                var state = getState();
                var activeMatchShell = !!(state && (state.paused || (state.launch && state.launch.phase === 'retryable')));
                if (activeMatchShell) render();
            });
            window.addEventListener('mayhem-auth-changed', function () {
                syncAccountState();
                render();
            });
            window.addEventListener('mayhem-leave-game-request', function (event) {
                var detail = event && event.detail ? event.detail : {};
                if (actionApi && actionApi.handleLeaveGameRequest) actionApi.handleLeaveGameRequest(detail);
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
