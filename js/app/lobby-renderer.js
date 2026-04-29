/**
 * lobby-renderer.js - Menu shell rendering owner.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameLobbyRenderer
 */
(function () {
    'use strict';

    var runtime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    var GameLobbyRenderer = {};

    function setText(target, value) {
        if (!target) return;
        target.textContent = String(value || '');
    }

    function applyStatusEl(target, status, localize) {
        if (!target) return;
        var text = status && status.text ? String(status.text) : '';
        target.textContent = localize ? localize(text) : text;
        target.hidden = !text;
        target.classList.toggle('error', !!(status && status.error));
    }

    GameLobbyRenderer.create = function (opts) {
        opts = opts || {};

        var elements = opts.elements || {};
        var viewModelApi = opts.viewModel || runtime.GameLobbyViewModel || null;

        if (!viewModelApi || !viewModelApi.build) {
            throw new Error('GameLobbyViewModel is required before GameLobbyRenderer initialization.');
        }

        function busy() {
            return !!(opts.isBusy && opts.isBusy());
        }

        function capabilities() {
            return opts.getCapabilities ? opts.getCapabilities() : {};
        }

        function menuRefreshPending() {
            return !!(opts.isMenuRefreshPending && opts.isMenuRefreshPending());
        }

        function getState() {
            return opts.getState ? opts.getState() : {};
        }

        function getSession() {
            return opts.getSession ? opts.getSession() : null;
        }

        function patchState(patch) {
            if (opts.patchState) opts.patchState(patch || {});
        }

        function rerender() {
            if (opts.render) opts.render();
        }

        function roomCodeFromRoomId(roomId) {
            return opts.roomCodeFromRoomId ? opts.roomCodeFromRoomId(roomId) : String(roomId || '').toUpperCase();
        }

        function isLocalEnvironment() {
            return !!(opts.isLocalEnvironment && opts.isLocalEnvironment());
        }

        function localizeServiceStatusText(text) {
            return opts.localizeServiceStatusText ? opts.localizeServiceStatusText(text) : String(text || '');
        }

        function launchPillLabel(modeId) {
            return opts.launchPillLabel ? opts.launchPillLabel(modeId) : String(modeId || '');
        }

        function modeLabel(modeId) {
            return opts.modeLabel ? opts.modeLabel(modeId) : String(modeId || '');
        }

        function normalizeMode(modeId) {
            return opts.normalizeMode ? opts.normalizeMode(modeId) : String(modeId || '');
        }

        function normalizeMatchMenuModel(payload) {
            return opts.normalizeMatchMenuModel ? opts.normalizeMatchMenuModel(payload) : (payload || null);
        }

        function buildMenuViewModel(state) {
            return viewModelApi.build(state || {}, {
                normalizeMode: normalizeMode,
                modeLabel: modeLabel,
                normalizeMatchMenuModel: normalizeMatchMenuModel,
                isLocalEnvironment: isLocalEnvironment
            });
        }

        function currentPartyIdentity() {
            return opts.currentPartyIdentity ? opts.currentPartyIdentity() : null;
        }

        function setPhoneLandscapeRequirement(required) {
            if (typeof window === 'undefined') return;
            var setter = window.__MAYHEM_SET_PHONE_LANDSCAPE_REQUIREMENT;
            if (typeof setter !== 'function') return;
            setter(required ? 'required' : 'optional');
        }

        function savedFriendIds(state) {
            return opts.savedFriendIds ? opts.savedFriendIds(state) : new Set();
        }

        function appendFriendAction(target, label, className, disabled, handler) {
            if (opts.appendFriendAction) {
                opts.appendFriendAction(target, label, className, disabled, handler);
            }
        }

        function setFriendTargetValue(nextValue, sourceEl) {
            if (opts.setFriendTargetValue) {
                opts.setFriendTargetValue(nextValue, sourceEl);
            }
        }

        function privateRoomViewController() {
            return opts.getPrivateRoomViewController ? opts.getPrivateRoomViewController() : null;
        }

        function renderPartyMembers(state) {
            if (!elements.partyHeroMembers) return;
            var savedScroll = elements.partyHeroMembers.scrollTop || 0;
            elements.partyHeroMembers.innerHTML = '';
            var partyState = state.party;
            if (!partyState || !partyState.party || !Array.isArray(partyState.party.members) || partyState.party.members.length <= 1) return;
            var memberIds = savedFriendIds(state);
            for (var i = 0; i < partyState.party.members.length; i++) {
                var member = partyState.party.members[i];
                var actorId = String(member.id || '');
                var wrapper = document.createElement('div');
                wrapper.className = 'menu-member-card';

                var btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'btn' + (member.isLeader ? ' leader' : '') + (state.expandedPartyMemberId === actorId ? ' active' : '');
                btn.textContent = String(member.displayName || member.id || 'Player');
                btn.disabled = member.isLeader && actorId === String(partyState.self && partyState.self.id || '');
                btn.addEventListener('click', (function (targetId, isSelf) {
                    return function () {
                        if (isSelf) return;
                        patchState({ expandedPartyMemberId: getState().expandedPartyMemberId === targetId ? '' : targetId });
                        rerender();
                    };
                })(actorId, actorId === String(partyState.self && partyState.self.id || '')));
                wrapper.appendChild(btn);

                if (state.expandedPartyMemberId === actorId && actorId !== String(partyState.self && partyState.self.id || '')) {
                    var actions = document.createElement('div');
                    actions.className = 'flow';
                    if (state.utilities.isLoggedIn && member.isAccount && member.accountUserId && !memberIds.has(String(member.accountUserId || ''))) {
                        appendFriendAction(actions, 'Add Friend', 'btn btn-sm btn-danger', busy(), (function (targetUserId) {
                            return function () {
                                var session = getSession();
                                if (!session || !session.performFriendAction) return;
                                session.performFriendAction('add', targetUserId, 'Saving friend...', 'Friend saved.');
                            };
                        })(String(member.accountUserId || '')));
                    }
                    if (partyState.party.isLeader) {
                        appendFriendAction(actions, 'Kick from Party', 'btn btn-sm btn-danger', busy(), (function (targetId) {
                            return function () {
                                var session = getSession();
                                if (!session || !session.runPartyAction) return;
                                session.runPartyAction('kick', { targetId: targetId }, 'Removing player...');
                                patchState({ expandedPartyMemberId: '' });
                                rerender();
                            };
                        })(actorId));
                    }
                    if (actions.childNodes.length) wrapper.appendChild(actions);
                }

                elements.partyHeroMembers.appendChild(wrapper);
            }
            if (savedScroll > 0) {
                elements.partyHeroMembers.scrollTop = savedScroll;
            }
        }

        function renderFriends(state, view) {
            if (!elements.socialFriendsPane || !elements.socialFriendsList || !elements.socialLayout) return;

            // Preserve scroll position across full rebuild
            var savedScroll = elements.socialFriendsList.scrollTop || 0;
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

            var showPane = !!(view && view.social && view.social.friendsPaneVisible);
            elements.socialFriendsPane.hidden = !showPane;
            elements.socialLayout.setAttribute('data-layout', view && view.social ? view.social.layout : (showPane ? 'split' : 'stack'));
            if (!showPane) return;

            for (var i = 0; i < friends.length; i++) {
                var friend = friends[i];
                var friendId = String(friend.userId || '');
                var wrapper = document.createElement('div');
                wrapper.className = 'menu-friend-card';
                var pill = document.createElement('button');
                pill.type = 'button';
                pill.className = 'btn' + (getState().expandedFriendId === friendId ? ' active' : '');
                pill.addEventListener('click', (function (targetId) {
                    return function () {
                        patchState({ expandedFriendId: getState().expandedFriendId === targetId ? '' : targetId });
                        rerender();
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
                    actions.className = 'flow';
                    appendFriendAction(actions, 'Remove Friend', 'btn btn-sm btn-danger', busy(), (function (targetUserId) {
                        return function () {
                            var session = getSession();
                            if (!session || !session.performFriendAction) return;
                            session.performFriendAction('remove', targetUserId, 'Removing friend...', 'Friend removed.');
                            patchState({ expandedFriendId: '' });
                            rerender();
                        };
                    })(friendId));
                    if (friend.canJoin) {
                        appendFriendAction(actions, 'Join Friend', 'btn btn-sm btn-confirm', busy(), (function (targetUserId) {
                            return function () {
                                var session = getSession();
                                if (!session || !session.performFriendAction) return;
                                session.performFriendAction('join', targetUserId, 'Joining friend...', 'Joined friend.');
                            };
                        })(friendId));
                    }
                    if (friend.canInvite && !friend.sameParty) {
                        appendFriendAction(actions, friend.outgoingInvite ? 'Invited' : 'Invite Friend', 'btn btn-sm btn-danger', busy() || !!friend.outgoingInvite, (function (targetUserId) {
                            return function () {
                                var session = getSession();
                                if (!session || !session.performFriendAction) return;
                                session.performFriendAction('invite', targetUserId, 'Sending invite...', 'Invite sent.');
                            };
                        })(friendId));
                    }
                    wrapper.appendChild(actions);
                }

                elements.socialFriendsList.appendChild(wrapper);
            }

            // Restore scroll position after rebuild
            if (savedScroll > 0) {
                elements.socialFriendsList.scrollTop = savedScroll;
            }
        }

        function renderPrivateRoom(state) {
            var privateRoomState = state.privateRoom;
            var room = privateRoomState && privateRoomState.room ? privateRoomState.room : null;
            var caps = capabilities();
            var hasRoom = !!room;
            var isBusy = busy();
            var roomPhase = hasRoom ? String(room.roomPhase || '') : '';
            var roomMode = hasRoom ? String(room.roomMode || '') : '';
            var teamCount = hasRoom ? Number(room.teamCount || 2) : 2;

            if (elements.roomSharePanel) elements.roomSharePanel.hidden = !hasRoom;
            if (elements.roomShareCode) setText(elements.roomShareCode, hasRoom ? String(room.roomCode || roomCodeFromRoomId(room.roomId)).toUpperCase() : '------');
            if (elements.privateRoomView) elements.privateRoomView.hidden = !hasRoom;
            if (elements.privateRoomEnterBtn) {
                var active = hasRoom && roomPhase === 'active';
                elements.privateRoomEnterBtn.hidden = !active;
                elements.privateRoomEnterBtn.disabled = isBusy;
            }
            if (elements.privateRoomStartBtn) {
                elements.privateRoomStartBtn.hidden = !(hasRoom && roomPhase === 'lobby');
                elements.privateRoomStartBtn.disabled = isBusy || !caps.canStartPrivateRoom;
            }

            if (elements.privateRoomModeFfaBtn) {
                var ffaActive = hasRoom && roomMode === 'ffa';
                elements.privateRoomModeFfaBtn.classList.toggle('active', ffaActive);
                elements.privateRoomModeFfaBtn.setAttribute('aria-checked', String(ffaActive));
                elements.privateRoomModeFfaBtn.disabled = isBusy || !caps.canEditPrivateRoom;
            }
            if (elements.privateRoomModeTdmBtn) {
                var tdmActive = hasRoom && roomMode === 'tdm';
                elements.privateRoomModeTdmBtn.classList.toggle('active', tdmActive);
                elements.privateRoomModeTdmBtn.setAttribute('aria-checked', String(tdmActive));
                elements.privateRoomModeTdmBtn.disabled = isBusy || !caps.canEditPrivateRoom;
            }
            var isTdm = hasRoom && roomMode === 'tdm';
            if (elements.privateRoomTeamCountActions) {
                elements.privateRoomTeamCountActions.hidden = !isTdm;
            }
            if (elements.privateRoomTeams2Btn) {
                var t2Active = hasRoom && teamCount === 2;
                elements.privateRoomTeams2Btn.classList.toggle('active', t2Active);
                elements.privateRoomTeams2Btn.setAttribute('aria-checked', String(t2Active));
                elements.privateRoomTeams2Btn.disabled = isBusy || !caps.canEditPrivateRoom;
            }
            if (elements.privateRoomTeams3Btn) {
                var t3Active = hasRoom && teamCount === 3;
                elements.privateRoomTeams3Btn.classList.toggle('active', t3Active);
                elements.privateRoomTeams3Btn.setAttribute('aria-checked', String(t3Active));
                elements.privateRoomTeams3Btn.disabled = isBusy || !caps.canEditPrivateRoom;
            }
            if (elements.privateRoomTeams4Btn) {
                var t4Active = hasRoom && teamCount === 4;
                elements.privateRoomTeams4Btn.classList.toggle('active', t4Active);
                elements.privateRoomTeams4Btn.setAttribute('aria-checked', String(t4Active));
                elements.privateRoomTeams4Btn.disabled = isBusy || !caps.canEditPrivateRoom;
            }
            if (elements.privateRoomInvitePartyBtn) {
                elements.privateRoomInvitePartyBtn.hidden = !hasRoom;
                elements.privateRoomInvitePartyBtn.disabled = isBusy || !caps.canInvitePartyToPrivateRoom;
            }
            if (elements.privateRoomInviteLockBtn) {
                elements.privateRoomInviteLockBtn.hidden = !hasRoom;
                elements.privateRoomInviteLockBtn.disabled = isBusy || !caps.canTogglePrivateRoomInviteLock;
                elements.privateRoomInviteLockBtn.textContent = caps.privateRoomInviteLocked ? 'Room Invites Locked' : 'Room Invites Open';
                elements.privateRoomInviteLockBtn.classList.toggle('locked', !!caps.privateRoomInviteLocked);
            }
            if (elements.privateRoomRandomizeBtn) {
                elements.privateRoomRandomizeBtn.hidden = !isTdm;
                elements.privateRoomRandomizeBtn.disabled = isBusy || !caps.canRandomizeTeams;
            }
            if (elements.privateRoomLeaveBtn) {
                elements.privateRoomLeaveBtn.hidden = !hasRoom;
                elements.privateRoomLeaveBtn.disabled = isBusy;
            }
            if (elements.leaveRoomConfirmOverlay) {
                elements.leaveRoomConfirmOverlay.hidden = !state.leaveRoomConfirmOpen;
            }
            var privateRoomController = privateRoomViewController();
            if (privateRoomController && privateRoomController.applyState) {
                privateRoomController.applyState(privateRoomState);
            }
        }

        function renderFeedback(view) {
            applyStatusEl(elements.menuFeedback, view && view.feedback ? view.feedback.menu : null, localizeServiceStatusText);
        }

        function renderSocialHeroStatus(view) {
            if (!elements.socialHeroStatus) return;
            if (!view || view.activeSurface !== 'main' || view.activeMatchShell) {
                elements.socialHeroStatus.hidden = true;
                elements.socialHeroStatus.textContent = '';
                elements.socialHeroStatus.classList.remove('error');
                return;
            }
            applyStatusEl(elements.socialHeroStatus, view.feedback ? view.feedback.social : null);
        }

        function renderRoomSocialFeedback(view) {
            if (!elements.roomSocialFeedback) return;
            if (!view || view.activeSurface !== 'room' || view.activeMatchShell) {
                elements.roomSocialFeedback.hidden = true;
                elements.roomSocialFeedback.textContent = '';
                elements.roomSocialFeedback.classList.remove('error');
                return;
            }
            applyStatusEl(elements.roomSocialFeedback, view.feedback ? view.feedback.social : null);
        }

        function applyActiveHeaderFeedback(feedback, activeMatchShell) {
            if (!elements.activeHeaderStatus) return;
            if (!activeMatchShell || !feedback) {
                elements.activeHeaderStatus.hidden = true;
                elements.activeHeaderStatus.textContent = '';
                elements.activeHeaderStatus.classList.remove('error');
                return;
            }
            elements.activeHeaderStatus.textContent = String(feedback.text || '');
            elements.activeHeaderStatus.hidden = !elements.activeHeaderStatus.textContent;
            elements.activeHeaderStatus.classList.toggle('error', !!feedback.error);
        }

        function applyMatchPill(target, pill) {
            if (!target) return;
            if (!pill || !pill.value) {
                target.hidden = true;
                target.textContent = '';
                target.removeAttribute('data-session-label');
                return;
            }
            target.hidden = false;
            target.textContent = String(pill.value || '');
            if (pill.label) target.setAttribute('data-session-label', String(pill.label || ''));
            else target.removeAttribute('data-session-label');
        }

        function hasVisibleMatchPills(pills) {
            if (!Array.isArray(pills)) return false;
            return pills.some(function (pill) {
                return !!(pill && !pill.hidden && String(pill.textContent || '').trim());
            });
        }

        function populateInviteBanner(copyEl, acceptBtn, dismissBtn, incomingRoomInvite, incomingInvite) {
            if (copyEl) {
                if (incomingRoomInvite && incomingRoomInvite.roomId) {
                    copyEl.textContent =
                        String(incomingRoomInvite.inviterDisplayName || incomingRoomInvite.inviterActorId || 'PLAYER') +
                        ' invited you to room ' +
                        String(incomingRoomInvite.roomCode || '').toUpperCase() +
                        '.';
                } else {
                    copyEl.textContent = String(incomingInvite.displayName || incomingInvite.actorId || 'PLAYER') + ' invited you to join.';
                }
            }
            if (acceptBtn) {
                acceptBtn.textContent = incomingRoomInvite && incomingRoomInvite.roomId ? 'Join Room' : 'Accept Invite';
                acceptBtn.disabled = busy();
            }
            if (dismissBtn) {
                dismissBtn.textContent = 'Dismiss';
                dismissBtn.disabled = busy();
            }
        }

        function hideInviteSurface(surface) {
            if (!surface || !surface.banner) return;
            surface.banner.hidden = true;
            if (surface.actions) surface.actions.hidden = true;
            if (surface.acceptBtn) surface.acceptBtn.hidden = true;
            if (surface.dismissBtn) surface.dismissBtn.hidden = true;
            if (surface.banner.classList && surface.banner.classList.remove) surface.banner.classList.remove('critical');
            if (surface.copy) surface.copy.textContent = '';
        }

        function showInviteSurface(surface, incomingRoomInvite, incomingInvite) {
            if (!surface || !surface.banner) return;
            populateInviteBanner(surface.copy, surface.acceptBtn, surface.dismissBtn, incomingRoomInvite, incomingInvite);
            if (surface.actions) surface.actions.hidden = false;
            if (surface.acceptBtn) surface.acceptBtn.hidden = false;
            if (surface.dismissBtn) surface.dismissBtn.hidden = false;
            if (surface.banner.classList && surface.banner.classList.remove) surface.banner.classList.remove('critical');
            surface.banner.hidden = false;
        }

        function renderPrimaryBanner(view) {
            hideInviteSurface({
                banner: elements.socialDirectInviteBanner,
                copy: elements.socialDirectInviteCopy,
                actions: elements.socialDirectInviteActions,
                acceptBtn: elements.socialDirectInviteAcceptBtn,
                dismissBtn: elements.socialDirectInviteDismissBtn
            });
            hideInviteSurface({
                banner: elements.activeInviteBanner,
                copy: elements.activeInviteCopy,
                actions: elements.activeInviteActions,
                acceptBtn: elements.activeInviteAcceptBtn,
                dismissBtn: elements.activeInviteDismissBtn
            });
            hideInviteSurface({
                banner: elements.roomSocialInviteBanner,
                copy: elements.roomSocialInviteCopy,
                actions: elements.roomSocialInviteActions,
                acceptBtn: elements.roomSocialInviteAcceptBtn,
                dismissBtn: elements.roomSocialInviteDismissBtn
            });

            var activeMatchShell = !!(view && view.activeMatchShell);
            var primaryBanner = view && view.primaryBanner ? view.primaryBanner : null;

            if (activeMatchShell && elements.activeInviteBanner && primaryBanner) {
                if (primaryBanner.kind === 'invite') {
                    showInviteSurface({
                        banner: elements.activeInviteBanner,
                        copy: elements.activeInviteCopy,
                        actions: elements.activeInviteActions,
                        acceptBtn: elements.activeInviteAcceptBtn,
                        dismissBtn: elements.activeInviteDismissBtn
                    }, primaryBanner.incomingRoomInvite, primaryBanner.incomingInvite);
                } else {
                    if (elements.activeInviteCopy) {
                        elements.activeInviteCopy.textContent = [primaryBanner.title, primaryBanner.detail].filter(Boolean).join(' :: ');
                    }
                    elements.activeInviteBanner.classList.add('critical');
                }
                elements.activeInviteBanner.hidden = false;
                return;
            }

            if (!primaryBanner || primaryBanner.kind !== 'invite') return;
            if (view.activeSurface === 'room' && elements.roomSocialInviteBanner) {
                showInviteSurface({
                    banner: elements.roomSocialInviteBanner,
                    copy: elements.roomSocialInviteCopy,
                    actions: elements.roomSocialInviteActions,
                    acceptBtn: elements.roomSocialInviteAcceptBtn,
                    dismissBtn: elements.roomSocialInviteDismissBtn
                }, primaryBanner.incomingRoomInvite, primaryBanner.incomingInvite);
                return;
            }
            if (view.activeSurface === 'main' && elements.socialDirectInviteBanner) {
                showInviteSurface({
                    banner: elements.socialDirectInviteBanner,
                    copy: elements.socialDirectInviteCopy,
                    actions: elements.socialDirectInviteActions,
                    acceptBtn: elements.socialDirectInviteAcceptBtn,
                    dismissBtn: elements.socialDirectInviteDismissBtn
                }, primaryBanner.incomingRoomInvite, primaryBanner.incomingInvite);
            }
        }

        function render() {
            var state = getState();
            var view = buildMenuViewModel(state);
            var showSessionStrip = view.showSessionStrip;
            var activeMatchShell = view.activeMatchShell;
            var room = state.privateRoom && state.privateRoom.room ? state.privateRoom.room : null;
            var hasRoom = view.hasRoom;
            var caps = capabilities();
            var isBusy = busy();
            var selectedMode = view.selectedMode;
            var identity = currentPartyIdentity();
            var loggedIn = view.loggedIn;
            var headerVariant = view.headerVariant;
            var activeMatchModel = view.activeMatch;

            if (elements.menuHeader) elements.menuHeader.setAttribute('data-variant', headerVariant);
            if (elements.overlay) elements.overlay.setAttribute('data-menu-context', view.menuContext);
            if (elements.menuSurface) elements.menuSurface.setAttribute('data-menu-context', view.menuContext);
            setPhoneLandscapeRequirement(view.phoneLandscapeRequired);

            if (elements.partyBackBtn) elements.partyBackBtn.hidden = !view.header.partyBackVisible;
            if (elements.accountToggleBtn) elements.accountToggleBtn.hidden = !view.header.accountToggleVisible;
            if (elements.menuPartyIdBtn) elements.menuPartyIdBtn.hidden = !view.header.partyIdVisible;
            if (elements.refreshBtn) {
                elements.refreshBtn.hidden = true;
                elements.refreshBtn.disabled = isBusy || menuRefreshPending();
                elements.refreshBtn.textContent = menuRefreshPending() ? 'Refreshing...' : 'Refresh';
            }
            if (elements.utilityRefreshBtn) {
                elements.utilityRefreshBtn.disabled = isBusy || menuRefreshPending();
                elements.utilityRefreshBtn.textContent = menuRefreshPending() ? 'Refreshing...' : 'Refresh';
            }
            if (elements.loadoutStartBtn) elements.loadoutStartBtn.hidden = true;
            if (elements.roomActionBtn) elements.roomActionBtn.hidden = !view.header.roomActionVisible;
            if (elements.utilityOverlay) elements.utilityOverlay.hidden = !view.overlays.utilityVisible;
            if (elements.leaveConfirmOverlay) elements.leaveConfirmOverlay.hidden = !view.overlays.leaveConfirmVisible;

            if (identity) {
                setText(elements.menuPartyIdLabel, identity.label || 'Player ID');
                setText(elements.menuPartyIdValue, String(identity.id || '------').toUpperCase());
            }
            if (elements.settingsAccountBtn) {
                elements.settingsAccountBtn.textContent = loggedIn ? 'Profile' : 'Login';
            }

            renderFeedback(view);
            renderSocialHeroStatus(view);
            renderRoomSocialFeedback(view);
            applyActiveHeaderFeedback(activeMatchModel ? activeMatchModel.headerFeedback : null, activeMatchShell);
            renderPrimaryBanner(view);
            renderPartyMembers(state);
            renderFriends(state, view);
            renderPrivateRoom(state);
            setFriendTargetValue(elements.partyIdInput ? elements.partyIdInput.value : '');

            if (elements.primaryLaunchBtn) {
                elements.primaryLaunchBtn.textContent = launchPillLabel(selectedMode || 'ffa');
                elements.primaryLaunchBtn.disabled = isBusy || view.controls.primaryLaunchDisabled;
            }
            if (elements.gameModesToggleBtn) {
                elements.gameModesToggleBtn.classList.toggle('active', !!state.modeListOpen);
                elements.gameModesToggleBtn.setAttribute('aria-expanded', state.modeListOpen ? 'true' : 'false');
                elements.gameModesToggleBtn.disabled = view.controls.gameModesDisabled;
            }
            if (elements.socialToolsToggleBtn) {
                elements.socialToolsToggleBtn.hidden = !view.controls.socialToolsVisible;
                elements.socialToolsToggleBtn.classList.toggle('active', !!state.socialToolsOpen);
                elements.socialToolsToggleBtn.setAttribute('aria-expanded', state.socialToolsOpen ? 'true' : 'false');
                elements.socialToolsToggleBtn.textContent = 'Friends & Rooms';
                elements.socialToolsToggleBtn.disabled = view.controls.socialToolsDisabled;
            }
            if (elements.utilityToggleBtn) {
                elements.utilityToggleBtn.hidden = !!view.surfaces.settingsScreenVisible;
                elements.utilityToggleBtn.classList.toggle('active', !!view.surfaces.settingsScreenVisible);
                elements.utilityToggleBtn.setAttribute('aria-expanded', view.surfaces.settingsScreenVisible ? 'true' : 'false');
                elements.utilityToggleBtn.disabled = activeMatchShell;
            }
            if (elements.playModeOptions) {
                elements.playModeOptions.hidden = !view.controls.playModeOptionsVisible;
            }

            if (elements.playModeFfaBtn) {
                elements.playModeFfaBtn.classList.toggle('active', selectedMode === 'ffa');
                elements.playModeFfaBtn.setAttribute('aria-pressed', selectedMode === 'ffa' ? 'true' : 'false');
            }
            if (elements.playModeTdmBtn) {
                elements.playModeTdmBtn.classList.toggle('active', selectedMode === 'tdm');
                elements.playModeTdmBtn.setAttribute('aria-pressed', selectedMode === 'tdm' ? 'true' : 'false');
            }
            if (elements.sandboxModeBtn) {
                elements.sandboxModeBtn.classList.toggle('active', selectedMode === 'sandbox');
                elements.sandboxModeBtn.setAttribute('aria-pressed', selectedMode === 'sandbox' ? 'true' : 'false');
            }

            if (elements.roomActionBtn) {
                elements.roomActionBtn.textContent = hasRoom
                    ? ('Room #' + String(room.roomCode || roomCodeFromRoomId(room.roomId)).toUpperCase())
                    : 'Create';
                elements.roomActionBtn.classList.toggle('active', hasRoom);
                elements.roomActionBtn.disabled = isBusy || showSessionStrip;
            }
            if (elements.partyIdInput) elements.partyIdInput.disabled = isBusy;
            if (elements.inviteFriendBtn) elements.inviteFriendBtn.disabled = isBusy;
            if (elements.joinFriendBtn) elements.joinFriendBtn.disabled = isBusy;
            if (elements.roomCodeInput) elements.roomCodeInput.disabled = isBusy;
            if (elements.joinRoomBtn) elements.joinRoomBtn.disabled = isBusy;
            if (elements.roomAccessStatus) {
                applyStatusEl(elements.roomAccessStatus, view.feedback ? view.feedback.roomAccess : null);
            }

            if (elements.menuBody) elements.menuBody.hidden = !view.surfaces.menuBodyVisible;
            if (elements.menuLoadoutBand) elements.menuLoadoutBand.hidden = !view.surfaces.loadoutBandVisible;
            if (elements.screenMain) elements.screenMain.hidden = !view.surfaces.mainScreenVisible;
            if (elements.mainHeroes) {
                elements.mainHeroes.hidden = !view.surfaces.mainScreenVisible;
                elements.mainHeroes.setAttribute('data-columns', String(view.heroes.count));
            }
            if (elements.homeHero) elements.homeHero.hidden = !view.heroes.homeVisible;
            if (elements.socialHero) elements.socialHero.hidden = !view.heroes.socialVisible;
            if (elements.partyHero) elements.partyHero.hidden = !view.heroes.partyVisible;
            if (elements.screenRoom) elements.screenRoom.hidden = !view.surfaces.roomScreenVisible;

            if (elements.menuSessionActions) {
                elements.menuSessionActions.hidden = !view.session.visible;
                if (view.session.visible) {
                    var sessionPhase = view.session.phase;
                    elements.menuSessionActions.setAttribute('data-session-phase', sessionPhase);
                    applyMatchPill(elements.menuSessionStatus, activeMatchModel ? activeMatchModel.modePill : null);
                    applyMatchPill(elements.menuSessionContext, activeMatchModel ? activeMatchModel.contextPill : null);
                    applyMatchPill(elements.menuSessionKd, activeMatchModel ? activeMatchModel.primaryPill : null);
                    applyMatchPill(elements.menuSessionMeta, activeMatchModel ? activeMatchModel.secondaryPill : null);
                    if (elements.menuSessionStats) {
                        var showSessionStats = hasVisibleMatchPills([
                            elements.menuSessionStatus,
                            elements.menuSessionContext,
                            elements.menuSessionKd,
                            elements.menuSessionMeta
                        ]);
                        elements.menuSessionStats.hidden = !showSessionStats;
                        if (showSessionStats) elements.menuSessionStats.setAttribute('data-session-phase', sessionPhase);
                        else elements.menuSessionStats.removeAttribute('data-session-phase');
                    }
                } else {
                    elements.menuSessionActions.removeAttribute('data-session-phase');
                    applyMatchPill(elements.menuSessionStatus, null);
                    applyMatchPill(elements.menuSessionContext, null);
                    applyMatchPill(elements.menuSessionKd, null);
                    applyMatchPill(elements.menuSessionMeta, null);
                    if (elements.menuSessionStats) {
                        elements.menuSessionStats.hidden = true;
                        elements.menuSessionStats.removeAttribute('data-session-phase');
                    }
                }
            }

            if (elements.privateRoomStatus) {
                var roomStatusText = state.roomStatus && state.roomStatus.text ? String(state.roomStatus.text) : '';
                elements.privateRoomStatus.textContent = roomStatusText;
                elements.privateRoomStatus.hidden = !roomStatusText;
                elements.privateRoomStatus.classList.toggle('error', !!(state.roomStatus && state.roomStatus.error));
            }
            if (elements.partyHeroLeaveBtn) elements.partyHeroLeaveBtn.disabled = isBusy || !caps.canLeaveParty;
        }

        return {
            render: render
        };
    };

    runtime.GameLobbyRenderer = GameLobbyRenderer;
})();
