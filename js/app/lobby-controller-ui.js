/**
 * lobby-controller-ui.js - Menu control-state and surface visibility helper.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameLobbyControllerUi
 */
(function () {
    'use strict';

    var DEFAULT_CAPABILITIES = {
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

    function create(opts) {
        opts = opts || {};
        var elements = opts.elements || {};
        var controllerBusy = false;
        var socialView = 'party';
        var altModesOpen = false;
        var controlsOpen = false;

        function currentLaunchState() {
            var launchState = opts.getLaunchState ? opts.getLaunchState() : null;
            if (!launchState) {
                return {
                    phase: 'menu_idle',
                    hasRuntime: false,
                    busy: false,
                    inPrivateRoomLobby: false
                };
            }
            return launchState;
        }

        function setDisabled(items, disabled) {
            if (!Array.isArray(items)) return;
            for (var i = 0; i < items.length; i++) {
                if (items[i]) items[i].disabled = !!disabled;
            }
        }

        function setDisplay(items, value) {
            if (!Array.isArray(items)) return;
            for (var i = 0; i < items.length; i++) {
                if (items[i] && items[i].style) items[i].style.display = value;
            }
        }

        function isUiBusy() {
            var launchState = currentLaunchState();
            return !!(controllerBusy || launchState.busy || (opts.isSessionBusy && opts.isSessionBusy()));
        }

        function activeSocialView() {
            if (socialView === 'room' && opts.hasPrivateRoom && !opts.hasPrivateRoom()) {
                return 'party';
            }
            return socialView;
        }

        function currentMenuControlState() {
            var capabilities = opts.getCapabilities ? opts.getCapabilities() : null;
            if (!capabilities) capabilities = DEFAULT_CAPABILITIES;
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
            var launchState = currentLaunchState();
            var busy = isUiBusy();
            var nextSocialView = controlState.socialView;

            if (elements.menuSessionActions) {
                elements.menuSessionActions.hidden = !launchState.hasRuntime;
            }

            if (launchState.phase === 'menu_idle' || launchState.phase === 'launch_error') {
                restoreStartUi();
            } else {
                hideStartUi();
            }

            if (elements.partySocialView) elements.partySocialView.hidden = nextSocialView !== 'party';
            if (elements.friendsSocialView) elements.friendsSocialView.hidden = nextSocialView !== 'friends';
            if (elements.privateRoomView) elements.privateRoomView.hidden = !controlState.hasPrivateRoom || nextSocialView !== 'room';

            if (elements.primaryPlayBtn) elements.primaryPlayBtn.disabled = busy;
            if (elements.tdmPlayBtn) elements.tdmPlayBtn.disabled = busy;
            if (elements.lmsPlayBtn) elements.lmsPlayBtn.disabled = busy;
            setDisabled(elements.quickMatchButtons, busy);
            if (elements.createRoomBtn) elements.createRoomBtn.disabled = busy;
            if (elements.joinPrivateRoomBtn) elements.joinPrivateRoomBtn.disabled = busy;
            if (elements.privateRoomInput) elements.privateRoomInput.disabled = busy;
            if (elements.joinPartyBtn) elements.joinPartyBtn.disabled = busy;
            if (elements.partyIdInput) elements.partyIdInput.disabled = busy;
            if (elements.addFriendBtn) elements.addFriendBtn.disabled = busy || !(opts.isLoggedIn && opts.isLoggedIn());
            if (elements.friendIdInput) elements.friendIdInput.disabled = busy || !(opts.isLoggedIn && opts.isLoggedIn());

            if (elements.socialTabPartyBtn) {
                elements.socialTabPartyBtn.classList.toggle('active', nextSocialView === 'party');
                elements.socialTabPartyBtn.setAttribute('aria-pressed', nextSocialView === 'party' ? 'true' : 'false');
                elements.socialTabPartyBtn.disabled = busy;
            }
            if (elements.socialTabFriendsBtn) {
                elements.socialTabFriendsBtn.classList.toggle('active', nextSocialView === 'friends');
                elements.socialTabFriendsBtn.setAttribute('aria-pressed', nextSocialView === 'friends' ? 'true' : 'false');
                elements.socialTabFriendsBtn.disabled = busy;
            }
            if (elements.socialTabRoomBtn) {
                elements.socialTabRoomBtn.hidden = !controlState.hasPrivateRoom;
                elements.socialTabRoomBtn.classList.toggle('active', nextSocialView === 'room');
                elements.socialTabRoomBtn.setAttribute('aria-pressed', nextSocialView === 'room' ? 'true' : 'false');
                elements.socialTabRoomBtn.disabled = busy || !controlState.hasPrivateRoom;
            }
            if (elements.viewPartyBtn) elements.viewPartyBtn.disabled = busy || !controlState.canViewPartyRoster;
            if (elements.leavePartyBtn) elements.leavePartyBtn.disabled = busy || !controlState.canLeaveParty;
            if (elements.partyJoinLockBtn) {
                elements.partyJoinLockBtn.disabled = busy || !controlState.canTogglePartyJoinLock;
                elements.partyJoinLockBtn.classList.toggle('locked', controlState.partyJoinLocked);
                elements.partyJoinLockBtn.setAttribute('aria-pressed', controlState.partyJoinLocked ? 'true' : 'false');
                elements.partyJoinLockBtn.title = controlState.partyJoinLockTitle;
            }
            if (elements.partyJoinLockIcon) elements.partyJoinLockIcon.textContent = controlState.partyJoinLocked ? '[###]' : '[_/]';
            if (elements.partyJoinLockNote) elements.partyJoinLockNote.textContent = controlState.partyJoinLockNote;
            if (elements.viewFriendsBtn) elements.viewFriendsBtn.disabled = busy || !(opts.isLoggedIn && opts.isLoggedIn());
            if (elements.refreshFriendsBtn) elements.refreshFriendsBtn.disabled = busy || !(opts.isLoggedIn && opts.isLoggedIn());
            if (elements.friendsFilterJoinableBtn) elements.friendsFilterJoinableBtn.disabled = busy || !(opts.isLoggedIn && opts.isLoggedIn());
            if (elements.friendsFilterOnlineBtn) elements.friendsFilterOnlineBtn.disabled = busy || !(opts.isLoggedIn && opts.isLoggedIn());
            if (elements.friendsFilterAllBtn) elements.friendsFilterAllBtn.disabled = busy || !(opts.isLoggedIn && opts.isLoggedIn());
            if (elements.privateRoomModeFfaBtn) {
                elements.privateRoomModeFfaBtn.classList.toggle('active', controlState.privateRoomMode === 'ffa');
                elements.privateRoomModeFfaBtn.disabled = busy || !controlState.canEditPrivateRoom;
            }
            if (elements.privateRoomModeTdmBtn) {
                elements.privateRoomModeTdmBtn.classList.toggle('active', controlState.privateRoomMode === 'tdm');
                elements.privateRoomModeTdmBtn.disabled = busy || !controlState.canEditPrivateRoom;
            }
            if (elements.privateRoomModeLmsBtn) {
                elements.privateRoomModeLmsBtn.classList.toggle('active', controlState.privateRoomMode === 'lms');
                elements.privateRoomModeLmsBtn.disabled = busy || !controlState.canEditPrivateRoom;
            }
            if (elements.privateRoomRandomizeBtn) elements.privateRoomRandomizeBtn.disabled = busy || !controlState.canRandomizeTeams;
            if (elements.privateRoomStartBtn) {
                elements.privateRoomStartBtn.style.display = controlState.hasPrivateRoom && controlState.privateRoomPhase === 'lobby' ? '' : 'none';
                elements.privateRoomStartBtn.disabled = busy || !controlState.canStartPrivateRoom;
            }

            syncDynamicActionDisabled();
        }

        function setSocialView(nextView) {
            if (nextView === 'friends') socialView = 'friends';
            else if (nextView === 'room') socialView = 'room';
            else socialView = 'party';
            syncMenuControlState();
            if (activeSocialView() === 'friends' && opts.isLoggedIn && !opts.isLoggedIn() && opts.setFriendsStatus) {
                opts.setFriendsStatus('Log in to sync your friend list.', true);
            }
        }

        function setControllerBusy(nextBusy, message) {
            controllerBusy = !!nextBusy;
            if (controllerBusy && opts.setRoomAccessStatus) {
                opts.setRoomAccessStatus(message || 'Working...', false);
            }
            syncMenuControlState();
        }

        function setAltModesOpen(open) {
            altModesOpen = !!open;
            if (elements.modeButtonsWrap) elements.modeButtonsWrap.hidden = !altModesOpen;
            if (elements.altModeToggle) elements.altModeToggle.setAttribute('aria-expanded', altModesOpen ? 'true' : 'false');
        }

        function setControlsOpen(open) {
            controlsOpen = !!open;
            if (elements.controlsMenu) elements.controlsMenu.hidden = !controlsOpen;
            if (elements.controlsToggle) elements.controlsToggle.setAttribute('aria-expanded', controlsOpen ? 'true' : 'false');
        }

        function syncModeButtonVisibility() {
            var visible = {};
            var modes = opts.getAvailableModes ? opts.getAvailableModes() : [];
            for (var i = 0; i < modes.length; i++) visible[modes[i].id] = true;
            var visibleCount = 0;
            for (var n = 0; n < elements.modeButtons.length; n++) {
                var btn = elements.modeButtons[n];
                var modeId = String(btn.dataset.modeId || '');
                var show = !!visible[modeId];
                btn.style.display = show ? '' : 'none';
                btn.disabled = false;
                if (show) visibleCount += 1;
            }
            if (visibleCount <= 0) setAltModesOpen(false);
        }

        function hideStartUi() {
            if (elements.modeButtonsWrap) elements.modeButtonsWrap.hidden = true;
            if (elements.controlsMenu) elements.controlsMenu.hidden = true;
            if (elements.primaryPlayBtn) elements.primaryPlayBtn.style.display = 'none';
            if (elements.tdmPlayBtn) elements.tdmPlayBtn.style.display = 'none';
            if (elements.lmsPlayBtn) elements.lmsPlayBtn.style.display = 'none';
            setDisplay(elements.quickMatchButtons, 'none');
            if (elements.createRoomBtn) elements.createRoomBtn.style.display = 'none';
            if (elements.joinPrivateRoomBtn) elements.joinPrivateRoomBtn.style.display = 'none';
            if (elements.privateRoomInput) elements.privateRoomInput.style.display = 'none';
        }

        function restoreStartUi() {
            if (elements.primaryPlayBtn) {
                elements.primaryPlayBtn.disabled = false;
                elements.primaryPlayBtn.style.display = '';
            }
            if (elements.tdmPlayBtn) {
                elements.tdmPlayBtn.disabled = false;
                elements.tdmPlayBtn.style.display = '';
            }
            if (elements.lmsPlayBtn) {
                elements.lmsPlayBtn.disabled = false;
                elements.lmsPlayBtn.style.display = '';
            }
            setDisplay(elements.quickMatchButtons, '');
            setDisabled(elements.quickMatchButtons, false);
            if (elements.createRoomBtn) {
                elements.createRoomBtn.disabled = false;
                elements.createRoomBtn.style.display = '';
            }
            if (elements.joinPrivateRoomBtn) {
                elements.joinPrivateRoomBtn.disabled = false;
                elements.joinPrivateRoomBtn.style.display = '';
            }
            if (elements.privateRoomInput) {
                elements.privateRoomInput.disabled = false;
                elements.privateRoomInput.style.display = '';
            }
            if (elements.altModeToggle) elements.altModeToggle.disabled = false;
            if (elements.controlsToggle) elements.controlsToggle.disabled = false;
            if (elements.modeButtonsWrap) elements.modeButtonsWrap.hidden = !altModesOpen;
            if (elements.controlsMenu) elements.controlsMenu.hidden = !controlsOpen;
        }

        return {
            isUiBusy: isUiBusy,
            getSocialView: activeSocialView,
            setSocialView: setSocialView,
            setControllerBusy: setControllerBusy,
            syncMenuControlState: syncMenuControlState,
            setAltModesOpen: setAltModesOpen,
            setControlsOpen: setControlsOpen,
            isAltModesOpen: function () { return !!altModesOpen; },
            isControlsOpen: function () { return !!controlsOpen; },
            syncModeButtonVisibility: syncModeButtonVisibility,
            getLaunchState: currentLaunchState,
            hideStartUi: hideStartUi,
            restoreStartUi: restoreStartUi
        };
    }

    globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    globalThis.__MAYHEM_RUNTIME.GameLobbyControllerUi = {
        create: create
    };
})();
