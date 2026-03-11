/**
 * lobby-friends-view.js - Friends rendering and UI state.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameLobbyFriendsView
 */
(function () {
    'use strict';

    var GameLobbyFriendsView = {};

    GameLobbyFriendsView.create = function (ctx) {
        var activeFilter = 'joinable';

        function normalizedFilter() {
            if (activeFilter === 'all') return 'all';
            if (activeFilter === 'online') return 'online';
            return 'joinable';
        }

        function setActiveFilter(nextFilter) {
            activeFilter = String(nextFilter || '').toLowerCase();
            if (activeFilter !== 'all' && activeFilter !== 'online') activeFilter = 'joinable';
            syncFilterButtons();
            applyFriendsState(ctx.getState());
        }

        function syncFilterButtons() {
            if (ctx.friendsFilterJoinableBtn) {
                var joinable = normalizedFilter() === 'joinable';
                ctx.friendsFilterJoinableBtn.classList.toggle('active', joinable);
                ctx.friendsFilterJoinableBtn.setAttribute('aria-pressed', joinable ? 'true' : 'false');
            }
            if (ctx.friendsFilterOnlineBtn) {
                var online = normalizedFilter() === 'online';
                ctx.friendsFilterOnlineBtn.classList.toggle('active', online);
                ctx.friendsFilterOnlineBtn.setAttribute('aria-pressed', online ? 'true' : 'false');
            }
            if (ctx.friendsFilterAllBtn) {
                var all = normalizedFilter() === 'all';
                ctx.friendsFilterAllBtn.classList.toggle('active', all);
                ctx.friendsFilterAllBtn.setAttribute('aria-pressed', all ? 'true' : 'false');
            }
        }

        function filteredFriends(friends) {
            var list = Array.isArray(friends) ? friends.slice() : [];
            var filter = normalizedFilter();
            if (filter === 'all') return list;
            if (filter === 'online') {
                return list.filter(function (friend) { return !!(friend && friend.online); });
            }
            return list.filter(function (friend) {
                return !!(friend && (friend.canJoin || friend.incomingInvite));
            });
        }

        function setFriendsPreviewEmpty(text) {
            if (!ctx.friendsPreview) return;
            ctx.friendsPreview.innerHTML = '';
            var empty = document.createElement('div');
            empty.className = 'party-preview-empty';
            empty.textContent = text || 'No friends saved.';
            ctx.friendsPreview.appendChild(empty);
        }

        function friendActivityCopy(friend) {
            if (!friend) return 'OFFLINE';
            if (friend.incomingInvite) return 'INVITE WAITING';
            if (!friend.online) return 'OFFLINE';
            if (friend.activityState === 'private_room_lobby') return friend.joinLocked ? 'PRIVATE ROOM :: LOCKED' : 'PRIVATE ROOM :: OPEN';
            if (friend.activityState === 'in_match') return friend.joinLocked ? 'IN MATCH :: LOCKED' : 'IN MATCH :: LIVE';
            if (friend.activityState === 'menu') return friend.joinLocked ? 'MENU :: LOCKED' : 'MENU :: OPEN';
            return 'OFFLINE';
        }

        function appendFriendBadges(targetEl, friend) {
            if (!targetEl || !friend) return;
            var badges = [];
            if (friend.isMutual) badges.push('MUTUAL');
            if (friend.incomingInvite) badges.push('INVITED');
            if (friend.outgoingInvite) badges.push('SENT');
            if (friend.joinLocked) badges.push('LOCKED');
            if (friend.sameParty) badges.push('IN PARTY');
            if (friend.online && !friend.joinLocked && !friend.sameParty) badges.push('LIVE');
            if (!badges.length) return;
            var wrap = document.createElement('div');
            wrap.className = 'friend-preview-badges';
            for (var i = 0; i < badges.length; i++) {
                var badge = document.createElement('span');
                badge.className = 'friend-preview-badge';
                badge.textContent = badges[i];
                wrap.appendChild(badge);
            }
            targetEl.appendChild(wrap);
        }

        function appendFriendActions(targetEl, friend) {
            if (!targetEl || !friend) return;
            var actions = document.createElement('div');
            actions.className = 'friend-preview-actions';
            var hasActions = false;
            if (friend.incomingInvite) {
                var acceptBtn = document.createElement('button');
                acceptBtn.type = 'button';
                acceptBtn.className = 'friend-preview-btn';
                acceptBtn.textContent = 'ACCEPT INVITE';
                acceptBtn.addEventListener('click', function () {
                    ctx.performFriendAction('accept_invite', friend.userId, 'Joining invited party...', 'Joined ' + String(friend.displayName || friend.username || 'FRIEND').toUpperCase() + '.');
                });
                actions.appendChild(acceptBtn);
                hasActions = true;

                var dismissBtn = document.createElement('button');
                dismissBtn.type = 'button';
                dismissBtn.className = 'friend-preview-btn secondary';
                dismissBtn.textContent = 'DISMISS';
                dismissBtn.addEventListener('click', function () {
                    ctx.performFriendAction('dismiss_invite', friend.userId, 'Clearing invite...', 'Invite dismissed.');
                });
                actions.appendChild(dismissBtn);
                hasActions = true;
            } else {
                if (friend.canJoin) {
                    var joinBtn = document.createElement('button');
                    joinBtn.type = 'button';
                    joinBtn.className = 'friend-preview-btn join';
                    joinBtn.textContent = 'JOIN PARTY';
                    joinBtn.addEventListener('click', function () {
                        ctx.performFriendAction('join', friend.userId, 'Joining friend party...', 'Joined ' + String(friend.displayName || friend.username || 'FRIEND').toUpperCase() + '.');
                    });
                    actions.appendChild(joinBtn);
                    hasActions = true;
                }
                if (friend.canInvite && !friend.sameParty) {
                    var inviteBtn = document.createElement('button');
                    inviteBtn.type = 'button';
                    inviteBtn.className = 'friend-preview-btn secondary';
                    inviteBtn.textContent = friend.outgoingInvite ? 'INVITED' : 'INVITE TO PARTY';
                    inviteBtn.disabled = !!friend.outgoingInvite;
                    inviteBtn.addEventListener('click', function () {
                        ctx.performFriendAction('invite', friend.userId, 'Sending invite...', 'Invite sent to ' + String(friend.displayName || friend.username || 'FRIEND').toUpperCase() + '.');
                    });
                    actions.appendChild(inviteBtn);
                    hasActions = true;
                }
            }
            if (hasActions) targetEl.appendChild(actions);
        }

        function renderFriendRow(friend, compact) {
            var line = document.createElement('div');
            line.className = compact ? 'friend-preview-line' : 'friend-modal-row';
            var row = document.createElement('div');
            row.className = 'friend-preview-row';
            var main = document.createElement('div');
            main.className = 'friend-preview-main';
            var name = document.createElement('div');
            name.className = 'friend-preview-name';
            name.textContent = String(friend.displayName || friend.username || friend.userId || 'FRIEND').toUpperCase();
            var meta = document.createElement('div');
            meta.className = 'friend-preview-meta';
            meta.textContent = '@' + String(friend.username || friend.userId || '').toUpperCase() + ' :: ' + friendActivityCopy(friend);
            main.appendChild(name);
            main.appendChild(meta);
            appendFriendBadges(main, friend);
            row.appendChild(main);
            appendFriendActions(row, friend);
            line.appendChild(row);
            return line;
        }

        function renderFriendsModal() {
            var friendsState = ctx.getState();
            if (!ctx.friendsModalContent) return;
            ctx.friendsModalContent.innerHTML = '';
            var visibleFriends = filteredFriends(friendsState && friendsState.friends);
            if (!friendsState || !Array.isArray(friendsState.friends) || !friendsState.friends.length) {
                ctx.friendsModalContent.textContent = ctx.isLoggedIn()
                    ? 'NO FRIENDS SAVED YET. ADD A PARTY MEMBER WITH + FRIEND.'
                    : 'LOG IN TO SAVE AND MANAGE FRIENDS.';
                return;
            }
            if (!visibleFriends.length) {
                ctx.friendsModalContent.textContent = 'NO FRIENDS MATCH THIS FILTER.';
                return;
            }
            for (var i = 0; i < visibleFriends.length; i++) {
                ctx.friendsModalContent.appendChild(renderFriendRow(visibleFriends[i], false));
            }
        }

        function applyFriendsState(nextState) {
            ctx.setState(nextState || { friends: [] });
            var friendsState = ctx.getState();
            if (!ctx.isLoggedIn()) {
                setFriendsPreviewEmpty('Log in to save friends.');
                renderFriendsModal();
                ctx.updateSocialSubtitle();
                return;
            }
            if (!friendsState.friends.length) {
                setFriendsPreviewEmpty('No friends saved. Add party members with + FRIEND.');
                renderFriendsModal();
                ctx.updateSocialSubtitle();
                return;
            }
            var visibleFriends = filteredFriends(friendsState.friends);
            if (ctx.friendsPreview) {
                ctx.friendsPreview.innerHTML = '';
                if (!visibleFriends.length) {
                    setFriendsPreviewEmpty('No friends match this filter.');
                }
                var previewCount = Math.min(4, visibleFriends.length);
                for (var i = 0; i < previewCount; i++) {
                    ctx.friendsPreview.appendChild(renderFriendRow(visibleFriends[i], true));
                }
                if (visibleFriends.length > previewCount) {
                    var more = document.createElement('div');
                    more.className = 'party-preview-empty';
                    more.textContent = '+' + String(visibleFriends.length - previewCount) + ' MORE FRIENDS';
                    ctx.friendsPreview.appendChild(more);
                }
            }
            renderFriendsModal();
            ctx.updateSocialSubtitle();
        }

        function setUnavailable(message) {
            if (!ctx.isLoggedIn()) {
                applyFriendsState(null);
                return;
            }
            if (ctx.getState() && Array.isArray(ctx.getState().friends) && ctx.getState().friends.length) {
                applyFriendsState(ctx.getState());
                return;
            }
            setFriendsPreviewEmpty(message || 'Friends service unavailable. Retrying...');
            if (ctx.friendsModalContent) {
                ctx.friendsModalContent.textContent = String(message || 'Friends service unavailable. Retrying...').toUpperCase();
            }
            ctx.updateSocialSubtitle();
        }

        return {
            applyState: applyFriendsState,
            setUnavailable: setUnavailable,
            renderModal: renderFriendsModal,
            setFilter: setActiveFilter,
            syncFilters: syncFilterButtons
        };
    };

    globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    globalThis.__MAYHEM_RUNTIME.GameLobbyFriendsView = GameLobbyFriendsView;
})();
