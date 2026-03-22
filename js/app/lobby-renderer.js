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

    function setStatusEl(target, status, okColor, errorColor) {
        if (!target) return;
        var text = status && status.text ? String(status.text) : '';
        target.textContent = text;
        target.style.color = status && status.error ? (errorColor || '#d14f45') : (okColor || '#2f6fed');
        target.hidden = !text;
    }

    GameLobbyRenderer.create = function (opts) {
        opts = opts || {};

        var elements = opts.elements || {};

        function busy() {
            return !!(opts.isBusy && opts.isBusy());
        }

        function capabilities() {
            return opts.getCapabilities ? opts.getCapabilities() : {};
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

        function normalizeMode(modeId) {
            return opts.normalizeMode ? opts.normalizeMode(modeId) : String(modeId || '');
        }

        function normalizeMatchMenuModel(payload) {
            return opts.normalizeMatchMenuModel ? opts.normalizeMatchMenuModel(payload) : (payload || null);
        }

        function currentPartyIdentity() {
            return opts.currentPartyIdentity ? opts.currentPartyIdentity() : null;
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

        function renderFriends(state) {
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
            if (elements.privateRoomRosterNote) {
                elements.privateRoomRosterNote.hidden = !hasRoom;
                elements.privateRoomRosterNote.textContent = caps.canEditPrivateRoom
                    ? 'Tap a player pill then pick a team, or drag players between lanes.'
                    : 'Tap a team lane to switch teams.';
            }

            var privateRoomController = privateRoomViewController();
            if (privateRoomController && privateRoomController.applyState) {
                privateRoomController.applyState(privateRoomState);
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

        function buildSocialActionFeedback(state) {
            var text = '';
            var error = false;
            if (state.friendsStatus.text) {
                text = String(state.friendsStatus.text || '');
                error = !!state.friendsStatus.error;
            } else if (state.partyStatus.text) {
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

            if (isLocalEnvironment() && /(?:service unavailable|endpoint offline|retrying)/i.test(text)) {
                text = '';
                error = false;
            }
            return text ? { text: text, error: error } : null;
        }

        function renderSocialHeroStatus(state) {
            if (!elements.socialHeroStatus) return;
            if (state.activeSurface !== 'main' || state.paused || (state.launch && state.launch.phase === 'retryable')) {
                elements.socialHeroStatus.hidden = true;
                elements.socialHeroStatus.textContent = '';
                elements.socialHeroStatus.classList.remove('error');
                return;
            }
            var feedback = buildSocialActionFeedback(state);
            elements.socialHeroStatus.textContent = feedback ? String(feedback.text || '') : '';
            elements.socialHeroStatus.hidden = !elements.socialHeroStatus.textContent;
            elements.socialHeroStatus.classList.toggle('error', !!(feedback && feedback.error));
        }

        function renderRoomSocialFeedback(state) {
            if (!elements.roomSocialFeedback) return;
            if (state.activeSurface !== 'room' || state.paused || (state.launch && state.launch.phase === 'retryable')) {
                elements.roomSocialFeedback.hidden = true;
                elements.roomSocialFeedback.textContent = '';
                elements.roomSocialFeedback.classList.remove('error');
                return;
            }
            var feedback = buildSocialActionFeedback(state);
            elements.roomSocialFeedback.textContent = feedback ? String(feedback.text || '') : '';
            elements.roomSocialFeedback.hidden = !elements.roomSocialFeedback.textContent;
            elements.roomSocialFeedback.classList.toggle('error', !!(feedback && feedback.error));
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

        function buildActiveMatchViewModel(state) {
            var matchMenu = normalizeMatchMenuModel(state.matchMenu);
            var incomingRoomInvite = state.party && state.party.roomInvite ? state.party.roomInvite.incoming : null;
            var incomingInvite = state.party && state.party.directInvite ? state.party.directInvite.incoming : null;
            var primaryBanner = null;

            if (matchMenu.banner && matchMenu.banner.kind === 'critical') {
                primaryBanner = {
                    kind: 'critical',
                    title: matchMenu.banner.title,
                    detail: matchMenu.banner.detail,
                    tone: matchMenu.banner.tone
                };
            } else if ((incomingRoomInvite && incomingRoomInvite.roomId) || (incomingInvite && incomingInvite.actorId)) {
                primaryBanner = {
                    kind: 'invite',
                    incomingRoomInvite: incomingRoomInvite,
                    incomingInvite: incomingInvite
                };
            }

            if (matchMenu.ready) {
                return {
                    primaryBanner: primaryBanner,
                    headerFeedback: buildSocialActionFeedback(state),
                    modePill: matchMenu.modePill,
                    contextPill: matchMenu.contextPill,
                    primaryPill: matchMenu.primaryPill,
                    secondaryPill: matchMenu.secondaryPill
                };
            }

            var selectedMode = normalizeMode(state.launch && state.launch.selectedMode) || 'ffa';
            return {
                primaryBanner: primaryBanner,
                headerFeedback: buildSocialActionFeedback(state),
                modePill: { label: 'MODE', value: String(selectedMode || 'ffa').toUpperCase() },
                contextPill: { label: 'STATE', value: state.launch && state.launch.phase === 'retryable' ? 'READY' : (state.launch && state.launch.phase === 'paused' ? 'PAUSED' : 'LIVE') },
                primaryPill: { label: state.launch && state.launch.phase === 'retryable' ? 'DETAIL' : 'LOADOUT', value: state.launch && state.launch.phase === 'retryable' ? String(state.launch.message || 'Ready to enter.') : 'Change loadout or return to the match.' },
                secondaryPill: null
            };
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

        function renderPrimaryBanner(model, state, activeMatchShell) {
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

            var primaryBanner = model && model.primaryBanner ? model.primaryBanner : null;

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

            var incomingRoomInvite = state.party && state.party.roomInvite ? state.party.roomInvite.incoming : null;
            var incomingInvite = state.party && state.party.directInvite ? state.party.directInvite.incoming : null;
            if ((!incomingRoomInvite || !incomingRoomInvite.roomId) && (!incomingInvite || !incomingInvite.actorId)) return;
            if (state.activeSurface === 'room' && elements.roomSocialInviteBanner) {
                showInviteSurface({
                    banner: elements.roomSocialInviteBanner,
                    copy: elements.roomSocialInviteCopy,
                    actions: elements.roomSocialInviteActions,
                    acceptBtn: elements.roomSocialInviteAcceptBtn,
                    dismissBtn: elements.roomSocialInviteDismissBtn
                }, incomingRoomInvite, incomingInvite);
                return;
            }
            if (state.activeSurface === 'main' && elements.socialDirectInviteBanner) {
                showInviteSurface({
                    banner: elements.socialDirectInviteBanner,
                    copy: elements.socialDirectInviteCopy,
                    actions: elements.socialDirectInviteActions,
                    acceptBtn: elements.socialDirectInviteAcceptBtn,
                    dismissBtn: elements.socialDirectInviteDismissBtn
                }, incomingRoomInvite, incomingInvite);
            }
        }

        function render() {
            var state = getState();
            var launch = state.launch;
            var paused = !!state.paused;
            var showSessionStrip = paused || launch.phase === 'retryable';
            var activeMatchShell = showSessionStrip;
            var room = state.privateRoom && state.privateRoom.room ? state.privateRoom.room : null;
            var hasRoom = !!room;
            var caps = capabilities();
            var isBusy = busy();
            var selectedMode = normalizeMode(launch.selectedMode);
            var identity = currentPartyIdentity();
            var loggedIn = !!state.utilities.isLoggedIn;
            var headerVariant = paused ? 'pause' : (state.activeSurface === 'room' ? 'room' : 'home');
            var activeMatchModel = activeMatchShell ? buildActiveMatchViewModel(state) : null;

            if (elements.menuHeader) elements.menuHeader.setAttribute('data-variant', headerVariant);
            if (elements.overlay) elements.overlay.setAttribute('data-menu-context', activeMatchShell ? 'active-match' : 'menu');
            if (elements.menuSurface) elements.menuSurface.setAttribute('data-menu-context', activeMatchShell ? 'active-match' : 'menu');

            if (elements.partyBackBtn) elements.partyBackBtn.hidden = state.activeSurface !== 'room' || activeMatchShell;
            if (elements.accountToggleBtn) elements.accountToggleBtn.hidden = headerVariant !== 'home' || loggedIn || showSessionStrip;
            if (elements.menuPartyIdBtn) elements.menuPartyIdBtn.hidden = activeMatchShell;
            if (elements.loadoutStartBtn) elements.loadoutStartBtn.hidden = true;
            if (elements.roomActionBtn) elements.roomActionBtn.hidden = headerVariant !== 'home' || showSessionStrip;
            if (elements.activeFriendBar) elements.activeFriendBar.hidden = !activeMatchShell;
            if (elements.utilityOverlay) elements.utilityOverlay.hidden = !state.utilityOpen;
            if (elements.leaveConfirmOverlay) elements.leaveConfirmOverlay.hidden = !state.confirmLeaveOpen;

            if (identity) {
                setText(elements.menuPartyIdLabel, identity.label || 'Player ID');
                setText(elements.menuPartyIdValue, String(identity.id || '------').toUpperCase());
            }
            if (elements.settingsAccountBtn) {
                elements.settingsAccountBtn.textContent = loggedIn ? 'Profile' : 'Login';
            }

            renderFeedback(state);
            renderSocialHeroStatus(state);
            renderRoomSocialFeedback(state);
            applyActiveHeaderFeedback(activeMatchModel ? activeMatchModel.headerFeedback : null, activeMatchShell);
            renderPrimaryBanner(activeMatchModel, state, activeMatchShell);
            renderPartyMembers(state);
            renderFriends(state);
            renderPrivateRoom(state);
            setFriendTargetValue(elements.activePartyIdInput && elements.activePartyIdInput.value
                ? elements.activePartyIdInput.value
                : (elements.partyIdInput ? elements.partyIdInput.value : ''));

            if (elements.primaryLaunchBtn) {
                elements.primaryLaunchBtn.textContent = launchPillLabel(selectedMode || 'ffa');
                elements.primaryLaunchBtn.disabled = isBusy || showSessionStrip;
            }
            if (elements.gameModesToggleBtn) {
                elements.gameModesToggleBtn.classList.toggle('active', !!state.modeListOpen);
                elements.gameModesToggleBtn.setAttribute('aria-expanded', state.modeListOpen ? 'true' : 'false');
                elements.gameModesToggleBtn.disabled = showSessionStrip;
            }
            if (elements.playModeOptions) {
                elements.playModeOptions.hidden = !state.modeListOpen || state.activeSurface !== 'main' || showSessionStrip;
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
                    ? ('ROOM #' + String(room.roomCode || roomCodeFromRoomId(room.roomId)).toUpperCase())
                    : 'Create Room';
                elements.roomActionBtn.classList.toggle('active', hasRoom);
                elements.roomActionBtn.disabled = isBusy || showSessionStrip;
            }
            if (elements.partyIdInput) elements.partyIdInput.disabled = isBusy;
            if (elements.inviteFriendBtn) elements.inviteFriendBtn.disabled = isBusy;
            if (elements.joinFriendBtn) elements.joinFriendBtn.disabled = isBusy;
            if (elements.activePartyIdInput) elements.activePartyIdInput.disabled = isBusy;
            if (elements.activeInviteFriendBtn) elements.activeInviteFriendBtn.disabled = isBusy;
            if (elements.activeJoinFriendBtn) elements.activeJoinFriendBtn.disabled = isBusy;
            if (elements.roomCodeInput) elements.roomCodeInput.disabled = isBusy;
            if (elements.joinRoomBtn) elements.joinRoomBtn.disabled = isBusy;
            if (elements.roomAccessStatus) {
                elements.roomAccessStatus.textContent = (state.activeSurface === 'main' && !showSessionStrip) ? String(launch.message || '') : '';
                elements.roomAccessStatus.classList.toggle('error', !!launch.error);
                elements.roomAccessStatus.hidden = !elements.roomAccessStatus.textContent;
            }

            var showMainHeroes = state.activeSurface === 'main' && !activeMatchShell;
            var showHomeHero = showMainHeroes;
            var partyMembers = state.party && state.party.party && Array.isArray(state.party.party.members)
                ? state.party.party.members
                : [];
            var showPartyHero = showMainHeroes && partyMembers.length > 1;
            var heroCount = 0;
            if (showHomeHero) heroCount += 1;
            if (showMainHeroes) heroCount += 1;
            if (showPartyHero) heroCount += 1;

            if (elements.menuBody) elements.menuBody.hidden = activeMatchShell;
            if (elements.screenMain) elements.screenMain.hidden = !showMainHeroes;
            if (elements.mainHeroes) {
                elements.mainHeroes.hidden = !showMainHeroes;
                elements.mainHeroes.setAttribute('data-columns', String(Math.max(1, heroCount || 1)));
            }
            if (elements.homeHero) elements.homeHero.hidden = !showHomeHero;
            if (elements.socialHero) elements.socialHero.hidden = !showMainHeroes;
            if (elements.partyHero) elements.partyHero.hidden = !showPartyHero;
            if (elements.screenRoom) elements.screenRoom.hidden = state.activeSurface !== 'room' || activeMatchShell;

            if (elements.menuSessionActions) {
                elements.menuSessionActions.hidden = !showSessionStrip;
                if (showSessionStrip) {
                    var sessionPhase = launch.phase === 'retryable'
                        ? 'enter'
                        : (launch.phase === 'paused' ? 'paused' : 'resume');
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
            renderPartyMembers: renderPartyMembers,
            renderFriends: renderFriends,
            renderPrivateRoom: renderPrivateRoom,
            renderFeedback: renderFeedback,
            renderSocialHeroStatus: renderSocialHeroStatus,
            renderRoomSocialFeedback: renderRoomSocialFeedback,
            buildSocialActionFeedback: buildSocialActionFeedback,
            applyActiveHeaderFeedback: applyActiveHeaderFeedback,
            buildActiveMatchViewModel: buildActiveMatchViewModel,
            renderPrimaryBanner: renderPrimaryBanner,
            render: render
        };
    };

    runtime.GameLobbyRenderer = GameLobbyRenderer;
})();
