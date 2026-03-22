/**
 * lobby-session.js - Lobby state, actions, and lifecycle polling.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameLobbySession
 */
(function () {
    'use strict';

    var runtime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};

    function gameModeLabel(modeId) {
        var shared = runtime.GameShared || {};
        if (shared.getGameModeLabel) return shared.getGameModeLabel(modeId, 'Free For All');
        var normalized = String(modeId || '').trim().toLowerCase();
        if (normalized === 'tdm') return 'Team Death Match';
        return 'Free For All';
    }
    var GameLobbySession = {};
    var POLL_OWNER_KEY = 'mayhem.menuPollOwner';
    var POLL_OWNER_LEASE_MS = 8000;
    // Keep cross-client social and room changes visible within a few seconds.
    var PARTY_POLL_INTERVAL_MS = 3000;
    var FRIENDS_POLL_INTERVAL_MS = 15000;
    var PRIVATE_ROOM_POLL_INTERVAL_MS = 3000;
    var PRIVATE_ROOM_POLL_FALLBACK_MS = 30000;
    var LOBBY_WS_RECONNECT_MS = 3000;
    var LOBBY_REQUEST_TIMEOUT_MS = 8000;

    function noop() {}

    function runtimeUtils() {
        return runtime.GameRuntimeUtils || null;
    }

    function randomToken(prefix) {
        var utils = runtimeUtils();
        if (utils && utils.randomToken) {
            return utils.randomToken(prefix);
        }
        return String(prefix || '') + Math.random().toString(36).slice(2) + Date.now().toString(36);
    }

    GameLobbySession.create = function (ctx) {
        ctx = ctx || {};

        var lobbyApi = ctx.lobbyApi || null;
        var authApi = ctx.authApi || null;
        var partyState = null;
        var friendsState = { friends: [] };
        var privateRoomState = null;
        var partyStateAvailability = 'idle';
        var busy = false;
        var partyPollHandle = 0;
        var friendsPollHandle = 0;
        var privateRoomPollHandle = 0;
        var lifecycleStarted = false;
        var pollOwnerToken = randomToken('menu_');
        var lastObservedPartyPresenceState = '';
        var lobbyWs = null;
        var lobbyWsReconnectHandle = 0;
        var lobbyWsConnected = false;
        var lobbyWsRoomId = '';
        var requestGeneration = 1;
        var trackedRequests = {
            party: { id: 0, controller: null },
            friends: { id: 0, controller: null },
            privateRoom: { id: 0, controller: null }
        };

        function setPartyStatus(text, isErr) {
            if (ctx.setPartyStatus) ctx.setPartyStatus(text, isErr);
        }

        function setFriendsStatus(text, isErr) {
            if (ctx.setFriendsStatus) ctx.setFriendsStatus(text, isErr);
        }

        function setPrivateRoomStatus(text, isErr) {
            if (ctx.setPrivateRoomStatus) ctx.setPrivateRoomStatus(text, isErr);
        }

        function onBusyChange(message) {
            if (ctx.onBusyChange) ctx.onBusyChange(!!busy, String(message || ''));
        }

        function onPartyIdentityChange() {
            if (ctx.onPartyIdentityChange) ctx.onPartyIdentityChange();
        }

        function onSocialUpdate() {
            if (ctx.onSocialUpdate) ctx.onSocialUpdate();
        }

        function currentPartyIdentity() {
            if (authApi && authApi.getPartyIdentity) return authApi.getPartyIdentity();
            return null;
        }

        function currentPartyActivityState() {
            if (typeof ctx.getActivityState === 'function') return ctx.getActivityState();
            return 'menu';
        }

        function normalizePartyPresenceState(activityState) {
            var next = String(activityState || '').trim().toLowerCase();
            if (next === 'menu') return 'menu';
            if (next === 'private_room_lobby') return 'private_room_lobby';
            return 'in_match';
        }

        function currentPartyPresenceState() {
            return normalizePartyPresenceState(currentPartyActivityState());
        }

        function currentAccountUser() {
            if (authApi && authApi.isLoggedIn && authApi.isLoggedIn() && authApi.getUser) {
                return authApi.getUser();
            }
            return null;
        }

        function localStore() {
            try {
                return window.localStorage || null;
            } catch (_err) {
                return null;
            }
        }

        function currentTimeMs() {
            return Date.now();
        }

        function isDocumentVisible() {
            if (typeof document === 'undefined' || !document) return true;
            if (typeof document.hidden === 'boolean') return !document.hidden;
            if (typeof document.visibilityState === 'string') return document.visibilityState !== 'hidden';
            return true;
        }

        function readPollOwnerLease() {
            var store = localStore();
            if (!store || typeof store.getItem !== 'function') return null;
            try {
                var raw = String(store.getItem(POLL_OWNER_KEY) || '').trim();
                if (!raw) return null;
                var parsed = JSON.parse(raw);
                if (!parsed || typeof parsed !== 'object') return null;
                return {
                    token: String(parsed.token || ''),
                    expiresAt: Math.max(0, Number(parsed.expiresAt || 0))
                };
            } catch (_err) {
                return null;
            }
        }

        function writePollOwnerLease(expiresAt) {
            var store = localStore();
            if (!store || typeof store.setItem !== 'function') return true;
            try {
                store.setItem(POLL_OWNER_KEY, JSON.stringify({
                    token: pollOwnerToken,
                    expiresAt: Math.max(0, Number(expiresAt || 0))
                }));
                return true;
            } catch (_err) {
                return false;
            }
        }

        function releasePollOwnerLease() {
            var store = localStore();
            if (!store || typeof store.removeItem !== 'function') return;
            var currentLease = readPollOwnerLease();
            if (!currentLease || currentLease.token !== pollOwnerToken) return;
            try {
                store.removeItem(POLL_OWNER_KEY);
            } catch (_err) {
                // no-op
            }
        }

        function createAbortController() {
            return (typeof AbortController === 'function') ? new AbortController() : null;
        }

        function trackedRequestState(channel) {
            if (!trackedRequests[channel]) {
                trackedRequests[channel] = { id: 0, controller: null };
            }
            return trackedRequests[channel];
        }

        function clearTrackedRequestController(channel) {
            var state = trackedRequestState(channel);
            if (!state.controller || typeof state.controller.abort !== 'function') {
                state.controller = null;
                return;
            }
            try {
                state.controller.abort();
            } catch (_err) {
                // no-op
            }
            state.controller = null;
        }

        function invalidateTrackedRequest(channel) {
            var state = trackedRequestState(channel);
            state.id += 1;
            clearTrackedRequestController(channel);
        }

        function invalidateTrackedRequests() {
            requestGeneration += 1;
            invalidateTrackedRequest('party');
            invalidateTrackedRequest('friends');
            invalidateTrackedRequest('privateRoom');
        }

        function beginTrackedRequest(channel) {
            var state = trackedRequestState(channel);
            clearTrackedRequestController(channel);
            state.id += 1;
            var controller = createAbortController();
            state.controller = controller;
            return {
                channel: channel,
                id: state.id,
                generation: requestGeneration,
                signal: controller ? controller.signal : null,
                timeoutMs: LOBBY_REQUEST_TIMEOUT_MS
            };
        }

        function finishTrackedRequest(token) {
            if (!token || !token.channel) return;
            var state = trackedRequestState(token.channel);
            if (state.id === token.id && requestGeneration === token.generation) {
                state.controller = null;
            }
        }

        function isTrackedRequestCurrent(token) {
            if (!token || !token.channel) return true;
            var state = trackedRequestState(token.channel);
            return state.id === token.id && requestGeneration === token.generation;
        }

        function isTrackedAbortError(err) {
            return !!(err && err.aborted);
        }

        function hasPollingLease() {
            var store = localStore();
            if (!store) return true;
            var now = currentTimeMs();
            var currentLease = readPollOwnerLease();
            if (!currentLease || !currentLease.token || currentLease.expiresAt <= now) {
                writePollOwnerLease(now + POLL_OWNER_LEASE_MS);
                return true;
            }
            if (currentLease.token !== pollOwnerToken) return false;
            if ((currentLease.expiresAt - now) <= Math.round(POLL_OWNER_LEASE_MS * 0.5)) {
                writePollOwnerLease(now + POLL_OWNER_LEASE_MS);
            }
            return true;
        }

        function shouldRunBackgroundSync() {
            var activityState = String(currentPartyActivityState() || 'menu');
            if (!(activityState === 'menu' || activityState === 'private_room_lobby')) {
                releasePollOwnerLease();
                return false;
            }
            if (!isDocumentVisible()) {
                releasePollOwnerLease();
                return false;
            }
            return hasPollingLease();
        }

        function isLoggedIn() {
            return !!currentAccountUser();
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

        function shouldSurfaceSyncError(options) {
            return !(options && options.silent);
        }

        function currentAssignedPrivateRoom() {
            return partyState && partyState.self ? partyState.self.privateRoom || null : null;
        }

        function currentAssignedPublicMatch() {
            return partyState && partyState.self ? partyState.self.publicMatch || null : null;
        }

        function currentPrivateRoomSummary() {
            if (privateRoomState && privateRoomState.room) {
                return {
                    hasPrivateRoom: true,
                    room: privateRoomState.room,
                    self: privateRoomState.self || null,
                    loaded: true
                };
            }
            var assignedPrivateRoom = currentAssignedPrivateRoom();
            return {
                hasPrivateRoom: !!assignedPrivateRoom,
                room: assignedPrivateRoom,
                self: assignedPrivateRoom || null,
                loaded: false
            };
        }

        function hasPrivateRoomState() {
            return currentPrivateRoomSummary().hasPrivateRoom;
        }

        function getCapabilities() {
            var hasParty = !!(partyState && partyState.party);
            var partyMembers = hasParty && Array.isArray(partyState.party.members) ? partyState.party.members : [];
            var canTogglePartyJoinLock = !!(hasParty && partyState.party.isLeader);
            var partyJoinLocked = !!(hasParty && partyState.party.joinLocked);
            var publicMatch = currentAssignedPublicMatch();
            var privateRoomSummary = currentPrivateRoomSummary();
            var hasPrivateRoom = privateRoomSummary.hasPrivateRoom;
            var privateRoom = privateRoomSummary.room;
            var privateRoomSelf = privateRoomSummary.self;
            var privateRoomPhase = String(privateRoom && privateRoom.roomPhase || '');
            var privateRoomMode = String(privateRoom && privateRoom.roomMode || '');
            var isPrivateRoomHost = !!(privateRoomSelf && privateRoomSelf.isHost);
            var privateRoomInviteLocked = !!(privateRoom && privateRoom.inviteLocked);
            var canTogglePrivateRoomInviteLock = !!(privateRoom && privateRoom.canToggleInviteLock);
            var canInvitePartyToPrivateRoom = !!(privateRoom && privateRoom.canInviteParty);
            var partyJoinLockTitle = 'Party join lock unavailable.';
            var partyJoinLockNote = 'PARTY OPEN';

            if (partyStateAvailability === 'unavailable') {
                partyJoinLockTitle = 'Party service unavailable.';
                partyJoinLockNote = 'SERVICE OFFLINE';
            } else if (hasParty) {
                partyJoinLockTitle = canTogglePartyJoinLock
                    ? (partyJoinLocked ? 'Open party joins for your group.' : 'Close party joins to your group.')
                    : 'Only the party lead can change party privacy.';
                partyJoinLockNote = canTogglePartyJoinLock
                    ? (partyJoinLocked ? 'PARTY CLOSED' : 'PARTY OPEN')
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
                hasPublicMatch: !!publicMatch,
                hasPrivateRoom: hasPrivateRoom,
                privateRoomLoaded: privateRoomSummary.loaded,
                privateRoomPhase: privateRoomPhase,
                privateRoomMode: privateRoomMode,
                privateRoomInviteLocked: privateRoomInviteLocked,
                canTogglePrivateRoomInviteLock: canTogglePrivateRoomInviteLock,
                canInvitePartyToPrivateRoom: canInvitePartyToPrivateRoom,
                canEditPrivateRoom: !!(hasPrivateRoom && isPrivateRoomHost),
                canRandomizeTeams: !!(hasPrivateRoom && isPrivateRoomHost),
                canStartPrivateRoom: !!(hasPrivateRoom && isPrivateRoomHost && privateRoomPhase === 'lobby'),
                canLeavePrivateRoom: !!(hasPrivateRoom),
                canSelfPickTeam: !!(hasPrivateRoom && !isPrivateRoomHost && privateRoomPhase === 'lobby')
            };
        }

        function setBusy(nextBusy, message) {
            busy = !!nextBusy;
            onBusyChange(message);
        }

        function normalizeFriend(friend) {
            var raw = (friend && typeof friend === 'object') ? friend : {};
            return {
                userId: String(raw.userId || raw.id || ''),
                username: String(raw.username || ''),
                displayName: String(raw.displayName || raw.username || raw.userId || raw.id || 'FRIEND'),
                online: !!raw.online,
                incomingInvite: !!raw.incomingInvite,
                outgoingInvite: !!raw.outgoingInvite,
                joinLocked: !!raw.joinLocked,
                sameParty: !!raw.sameParty,
                canJoin: !!raw.canJoin,
                canInvite: !!raw.canInvite,
                isMutual: !!raw.isMutual,
                activityState: String(raw.activityState || '')
            };
        }

        function normalizeFriendsState(nextState) {
            if (Array.isArray(nextState)) {
                return { friends: nextState.map(normalizeFriend) };
            }
            if (!nextState || typeof nextState !== 'object') {
                return { friends: [] };
            }
            var rawFriends = Array.isArray(nextState.friends) ? nextState.friends : [];
            var normalizedFriends = [];
            for (var i = 0; i < rawFriends.length; i++) {
                normalizedFriends.push(normalizeFriend(rawFriends[i]));
            }
            return Object.assign({}, nextState, { friends: normalizedFriends });
        }

        function applyPartyState(nextState) {
            var previousState = partyState;
            partyState = nextState || null;
            partyStateAvailability = 'ready';
            if (ctx.onPartyStateChanged) {
                ctx.onPartyStateChanged(partyState, { previousState: previousState });
            }
        }

        function applyFriendsState(nextState) {
            var previousState = friendsState;
            friendsState = normalizeFriendsState(nextState);
            if (ctx.onFriendsStateChanged) {
                ctx.onFriendsStateChanged(friendsState, { previousState: previousState });
            }
        }

        function applyPrivateRoomState(nextState) {
            var previousState = privateRoomState;
            privateRoomState = nextState || null;
            // Disconnect lobby WS when leaving a private room
            if (!privateRoomState && lobbyWsConnected) {
                disconnectLobbyWs();
            }
            if (ctx.onPrivateRoomStateChanged) {
                ctx.onPrivateRoomStateChanged(privateRoomState, { previousState: previousState });
            }
        }

        function setPartyUnavailable(err, options) {
            options = options || {};
            partyStateAvailability = 'unavailable';
            var message = syncFailureMessage('Party', err);
            if (ctx.onPartyUnavailable) {
                ctx.onPartyUnavailable(message, err, options);
            }
            if (shouldSurfaceSyncError(options)) {
                setPartyStatus(message, true);
                logSyncError(options.scope || 'party', err);
            }
        }

        function setFriendsUnavailable(err, options) {
            options = options || {};
            var message = syncFailureMessage('Friends', err);
            if (ctx.onFriendsUnavailable) {
                ctx.onFriendsUnavailable(message, err, options);
            }
            if (shouldSurfaceSyncError(options)) {
                setFriendsStatus(message, true);
                logSyncError(options.scope || 'friends', err);
            }
        }

        function setPrivateRoomUnavailable(err, options) {
            options = options || {};
            var message = syncFailureMessage('Private room', err);
            if (ctx.onPrivateRoomUnavailable) {
                ctx.onPrivateRoomUnavailable(message, err, options);
            }
            if (shouldSurfaceSyncError(options)) {
                setPrivateRoomStatus(message, true);
                logSyncError(options.scope || 'private-room', err);
            }
        }

        function maybeAutoJoinAssignedMatch(state) {
            if (!ctx.launchAssignedMatch) return;
            ctx.launchAssignedMatch(state || null);
        }

        function sessionStateListener(event) {
            var detail = event && event.detail ? event.detail : null;
            var nextPresenceState = normalizePartyPresenceState(
                detail && detail.activityState !== undefined
                    ? detail.activityState
                    : currentPartyActivityState()
            );
            if (nextPresenceState === lastObservedPartyPresenceState) return;
            lastObservedPartyPresenceState = nextPresenceState;
            invalidateTrackedRequests();
            // Disconnect lobby WS when transitioning to gameplay
            if (nextPresenceState === 'in_match' && lobbyWsConnected) {
                disconnectLobbyWs();
            }
            refreshPartyStateInternal(true, true, nextPresenceState);
        }

        function partyRequest(method, payload, presenceStateOverride, requestToken) {
            var identity = currentPartyIdentity();
            var activityState = presenceStateOverride != null
                ? normalizePartyPresenceState(presenceStateOverride)
                : currentPartyPresenceState();
            if (!identity || !identity.id) {
                return Promise.reject(new Error('Party identity unavailable.'));
            }
            if (method === 'GET') {
                var partyUrl = new URL(lobbyApi.resolveApiUrl(lobbyApi.partyPath()), window.location.origin);
                partyUrl.searchParams.set('actorId', String(identity.id));
                partyUrl.searchParams.set('displayName', String(identity.username || identity.id));
                partyUrl.searchParams.set('activityState', activityState);
                return lobbyApi.requestJson(partyUrl.toString(), {
                    method: 'GET',
                    signal: requestToken && requestToken.signal ? requestToken.signal : undefined,
                    timeoutMs: requestToken && Number(requestToken.timeoutMs || 0) > 0 ? requestToken.timeoutMs : undefined
                }).then(function (body) {
                    return body.state || null;
                });
            }
            return lobbyApi.requestJson(lobbyApi.partyPath(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(Object.assign({
                    actorId: String(identity.id),
                    displayName: String(identity.username || identity.id),
                    activityState: activityState
                }, payload || {}))
            }).then(function (body) {
                return body.state || null;
            });
        }

        function fetchPrivateRoomState(requestToken) {
            var assigned = currentAssignedPrivateRoom();
            if (!assigned) {
                return Promise.resolve(null);
            }
            var url = new URL(lobbyApi.resolveApiUrl(lobbyApi.privateRoomPath()), window.location.origin);
            var identity = currentPartyIdentity();
            url.searchParams.set('actorId', String(identity && identity.id || ''));
            url.searchParams.set('displayName', String(identity && identity.username || identity && identity.id || ''));
            return lobbyApi.requestJson(url.toString(), {
                method: 'GET',
                signal: requestToken && requestToken.signal ? requestToken.signal : undefined,
                timeoutMs: requestToken && Number(requestToken.timeoutMs || 0) > 0 ? requestToken.timeoutMs : undefined
            }).then(function (body) {
                return body.state || null;
            });
        }

        function reconcilePartyState(fallbackState, options) {
            options = options || {};
            var swallowError = options.swallowError !== false;
            var shouldRefreshPrivateRoom = options.refreshPrivateRoom !== false;
            var shouldAutoJoin = options.autoJoin !== false;
            var requestToken = beginTrackedRequest('party');
            return partyRequest('GET', null, options.partyPresenceState, requestToken)
                .then(function (state) {
                    finishTrackedRequest(requestToken);
                    if (!isTrackedRequestCurrent(requestToken)) return partyState;
                    var nextState = state || fallbackState || null;
                    applyPartyState(nextState);
                    onPartyIdentityChange();
                    if (shouldRefreshPrivateRoom) refreshPrivateRoomState(true);
                    if (shouldAutoJoin) maybeAutoJoinAssignedMatch(nextState);
                    return nextState;
                })
                .catch(function (err) {
                    finishTrackedRequest(requestToken);
                    if (!isTrackedRequestCurrent(requestToken) || isTrackedAbortError(err)) return partyState;
                    if (!swallowError) throw err;
                    var nextState = fallbackState || partyState || null;
                    if (fallbackState) {
                        applyPartyState(fallbackState);
                    } else {
                        setPartyUnavailable(err, { scope: 'party-reconcile', silent: !!options.silent });
                    }
                    onPartyIdentityChange();
                    if (shouldRefreshPrivateRoom) refreshPrivateRoomState(true);
                    if (shouldAutoJoin) maybeAutoJoinAssignedMatch(nextState);
                    return nextState;
                });
        }

        function reconcilePrivateRoomState(fallbackState) {
            var requestToken = beginTrackedRequest('privateRoom');
            return fetchPrivateRoomState(requestToken)
                .then(function (state) {
                    finishTrackedRequest(requestToken);
                    if (!isTrackedRequestCurrent(requestToken)) return privateRoomState;
                    var nextState = state || fallbackState || null;
                    applyPrivateRoomState(nextState);
                    return nextState;
                })
                .catch(function (err) {
                    finishTrackedRequest(requestToken);
                    if (!isTrackedRequestCurrent(requestToken) || isTrackedAbortError(err)) return privateRoomState;
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

        function refreshPartyStateInternal(silent, refreshPrivateRoom, partyPresenceState) {
            var identity = currentPartyIdentity();
            if (!identity || !identity.id || !lobbyApi || !lobbyApi.requestJson) {
                invalidateTrackedRequest('party');
                applyPartyState(null);
                setPartyStatus('', false);
                return Promise.resolve(null);
            }

            return reconcilePartyState(partyState, {
                swallowError: !!silent,
                refreshPrivateRoom: refreshPrivateRoom !== false,
                partyPresenceState: partyPresenceState,
                silent: !!silent
            })
                .then(function (state) {
                    if (partyStateAvailability === 'ready') {
                        setPartyStatus('', false);
                    }
                    return state;
                })
                .catch(function (err) {
                    setPartyUnavailable(err, { scope: silent ? 'party' : 'party-refresh', silent: !!silent });
                    return null;
                });
        }

        function refreshPartyState(silent) {
            return refreshPartyStateInternal(silent, true);
        }

        function currentRoomActorPayload(extra) {
            var identity = currentPartyIdentity();
            return Object.assign({
                actorId: identity && identity.id ? String(identity.id) : '',
                displayName: identity && identity.username ? String(identity.username) : '',
                activityState: currentPartyActivityState()
            }, extra || {});
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

        function buildLobbyWsUrl(roomId) {
            if (!lobbyApi || !lobbyApi.resolveWsUrl || !lobbyApi.wsLobbyPath) return '';
            var basePath = lobbyApi.wsLobbyPath();
            var wsUrl = lobbyApi.resolveWsUrl(basePath);
            var identity = currentPartyIdentity();
            var url = new URL(wsUrl, window.location.origin);
            // Ensure ws:// or wss://
            if (url.protocol === 'http:') url.protocol = 'ws:';
            if (url.protocol === 'https:') url.protocol = 'wss:';
            url.searchParams.set('room', String(roomId || ''));
            url.searchParams.set('actorId', String(identity && identity.id || ''));
            return url.toString();
        }

        function reconstructSelf(roomPayload) {
            var identity = currentPartyIdentity();
            var selfId = String(identity && identity.id || '');
            var members = Array.isArray(roomPayload && roomPayload.members) ? roomPayload.members : [];
            for (var i = 0; i < members.length; i++) {
                if (String(members[i].id || '') === selfId) {
                    return {
                        actorId: selfId,
                        displayName: String(members[i].displayName || identity && identity.username || selfId || 'PLAYER'),
                        isHost: !!members[i].isHost
                    };
                }
            }
            return {
                actorId: selfId,
                displayName: String(identity && identity.username || selfId || 'PLAYER'),
                isHost: false
            };
        }

        function handleLobbyWsMessage(event) {
            var data;
            try {
                data = JSON.parse(event.data);
            } catch (_err) {
                return;
            }
            if (!data || String(data.t || '') !== 'lobby_state') return;
            var room = data.room || null;
            if (!room) return;
            // Reconstruct the self field from our identity
            var state = {
                self: reconstructSelf(room),
                room: room
            };
            // Add computed fields the renderer expects
            if (room.roomId) {
                var code = String(room.roomCode || room.roomId || '').replace(/^private-/i, '').toUpperCase();
                room.roomCode = code;
            }
            if (room.canToggleInviteLock === undefined) {
                room.canToggleInviteLock = state.self.isHost;
            }
            if (room.canInviteParty === undefined) {
                room.canInviteParty = state.self.isHost || !room.inviteLocked;
            }
            applyPrivateRoomState(state);
        }

        function detachLobbyWsListeners(socket) {
            if (!socket) return;
            var listeners = socket.__mayhemLobbySessionListeners || null;
            socket.__mayhemLobbySessionListeners = null;
            if (!listeners || typeof socket.removeEventListener !== 'function') return;
            if (listeners.open) socket.removeEventListener('open', listeners.open);
            if (listeners.message) socket.removeEventListener('message', listeners.message);
            if (listeners.close) socket.removeEventListener('close', listeners.close);
            if (listeners.error) socket.removeEventListener('error', listeners.error);
        }

        function scheduleLobbyWsReconnect() {
            if (lobbyWsReconnectHandle) clearTimeout(lobbyWsReconnectHandle);
            lobbyWsReconnectHandle = setTimeout(function () {
                lobbyWsReconnectHandle = 0;
                if (!lifecycleStarted) return;
                var assigned = currentAssignedPrivateRoom();
                if (assigned && assigned.roomId) {
                    connectLobbyWs(assigned.roomId);
                }
            }, LOBBY_WS_RECONNECT_MS);
        }

        function connectLobbyWs(roomId) {
            if (lobbyWsConnected && lobbyWsRoomId === roomId && lobbyWs) return;
            disconnectLobbyWs();
            var url = buildLobbyWsUrl(roomId);
            if (!url) return;
            var socket = null;
            try {
                socket = new WebSocket(url);
            } catch (_err) {
                return;
            }
            lobbyWs = socket;
            lobbyWsRoomId = roomId;
            var listeners = {
                open: function () {
                    if (lobbyWs !== socket) return;
                    lobbyWsConnected = true;
                },
                message: function (event) {
                    if (lobbyWs !== socket) return;
                    handleLobbyWsMessage(event);
                },
                close: function () {
                    if (lobbyWs !== socket) return;
                    lobbyWs = null;
                    lobbyWsConnected = false;
                    lobbyWsRoomId = '';
                    scheduleLobbyWsReconnect();
                },
                error: function () {
                    if (lobbyWs !== socket) return;
                    // Error triggers close, which handles reconnect
                }
            };
            socket.__mayhemLobbySessionListeners = listeners;
            socket.addEventListener('open', listeners.open);
            socket.addEventListener('message', listeners.message);
            socket.addEventListener('close', listeners.close);
            socket.addEventListener('error', listeners.error);
        }

        function disconnectLobbyWs() {
            if (lobbyWsReconnectHandle) {
                clearTimeout(lobbyWsReconnectHandle);
                lobbyWsReconnectHandle = 0;
            }
            var socket = lobbyWs;
            lobbyWs = null;
            lobbyWsConnected = false;
            lobbyWsRoomId = '';
            if (socket) {
                detachLobbyWsListeners(socket);
                try { socket.close(); } catch (_err) {}
            }
        }

        function refreshPrivateRoomState(silent) {
            var assigned = currentAssignedPrivateRoom();
            if (!assigned) {
                invalidateTrackedRequest('privateRoom');
                applyPrivateRoomState(null);
                disconnectLobbyWs();
                setPrivateRoomStatus('', false);
                return Promise.resolve(null);
            }
            // Attempt to connect lobby WebSocket if not already connected
            if (!lobbyWsConnected && assigned.roomId) {
                connectLobbyWs(assigned.roomId);
            }
            return fetchPrivateRoomState()
                .then(function (state) {
                    applyPrivateRoomState(state);
                    setPrivateRoomStatus('', false);
                    return state;
                })
                .catch(function (err) {
                    setPrivateRoomUnavailable(err, { scope: silent ? 'private-room' : 'private-room-refresh', silent: !!silent });
                    return privateRoomState;
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
                invalidateTrackedRequest('friends');
                applyFriendsState(null);
                setFriendsStatus('', false);
                onSocialUpdate();
                return Promise.resolve(null);
            }
            var requestToken = beginTrackedRequest('friends');
            return lobbyApi.requestJson(lobbyApi.friendsPath(), {
                method: 'GET',
                signal: requestToken.signal || undefined,
                timeoutMs: requestToken.timeoutMs
            })
                .then(function (body) {
                    finishTrackedRequest(requestToken);
                    if (!isTrackedRequestCurrent(requestToken)) return friendsState;
                    applyFriendsState(body && body.friends ? body.friends : null);
                    setFriendsStatus('', false);
                    onSocialUpdate();
                    return friendsState;
                })
                .catch(function (err) {
                    finishTrackedRequest(requestToken);
                    if (!isTrackedRequestCurrent(requestToken) || isTrackedAbortError(err)) return friendsState;
                    setFriendsUnavailable(err, { scope: silent ? 'friends' : 'friends-refresh', silent: !!silent });
                    onSocialUpdate();
                    return friendsState;
                });
        }

        function refreshBackgroundState(includePrivateRoom) {
            if (!shouldRunBackgroundSync()) return;
            refreshPartyState(true);
            refreshFriendsState(true);
            if (includePrivateRoom !== false) {
                refreshPrivateRoomState(true);
            }
        }

        function runPartyAction(action, payload, pendingText) {
            if (busy) {
                return Promise.resolve(null);
            }

            setBusy(true, pendingText || 'Working...');
            if (pendingText) setPartyStatus(pendingText, false);
            return partyRequest('POST', Object.assign({ action: action }, payload || {}))
                .then(function (state) {
                    return reconcilePartyState(state).then(function (resolvedState) {
                        var nextState = resolvedState || state || null;
                        if (action === 'leave') {
                            setPartyStatus('Left party.', false);
                        } else if (action === 'join') {
                            setPartyStatus('Party joined.', false);
                        } else if (action === 'invite') {
                            setPartyStatus('Invite sent.', false);
                        } else if (action === 'accept_invite') {
                            setPartyStatus('Invite accepted.', false);
                        } else if (action === 'dismiss_invite') {
                            setPartyStatus('Invite dismissed.', false);
                        } else if (action === 'accept_room_invite') {
                            setPartyStatus('Room invite accepted.', false);
                        } else if (action === 'dismiss_room_invite') {
                            setPartyStatus('Room invite dismissed.', false);
                        } else if (action === 'kick') {
                            setPartyStatus('Player removed from party.', false);
                        } else if (action === 'lock') {
                            var locked = !!(nextState && nextState.party && nextState.party.joinLocked);
                            setPartyStatus(locked ? 'Party locked.' : 'Party unlocked.', false);
                        } else {
                            setPartyStatus('', false);
                        }
                        setBusy(false, '');
                        return nextState;
                    });
                })
                .catch(function (err) {
                    setPartyStatus((err && err.message) ? err.message : 'Party action failed.', true);
                    setBusy(false, '');
                    return null;
                });
        }

        function performFriendAction(action, targetUserId, pendingText, successText) {
            if (busy) {
                return Promise.resolve(null);
            }
            setBusy(true, pendingText || 'Working...');
            setFriendsStatus(pendingText || 'Working...', false);
            return friendRequest(action, { targetUserId: targetUserId })
                .then(function (body) {
                    if (body && body.friends) applyFriendsState(body.friends);
                    if (body && body.state) {
                        applyPartyState(body.state);
                    } else {
                        refreshPartyState(true);
                    }
                    setFriendsStatus(successText || 'Updated.', false);
                    setBusy(false, '');
                    return body;
                })
                .catch(function (err) {
                    setFriendsStatus((err && err.message) ? err.message : 'Friend action failed.', true);
                    setBusy(false, '');
                    return null;
                });
        }

        function runPrivateRoomHostAction(action, payload, pendingText, successText, failureText, requiredFlag) {
            var controlState = getCapabilities();
            if (busy) return Promise.resolve(null);
            if (requiredFlag && !controlState[requiredFlag]) return Promise.resolve(null);
            setBusy(true, pendingText || 'Working...');
            return privateRoomRequest(action, payload, pendingText)
                .then(function (result) {
                    setPrivateRoomStatus(successText || '', false);
                    setBusy(false, '');
                    return result;
                })
                .catch(function (err) {
                    setPrivateRoomStatus((err && err.message) ? err.message : failureText, true);
                    setBusy(false, '');
                    return null;
                });
        }

        function setPrivateRoomMode(roomMode) {
            var label = gameModeLabel(roomMode);
            return runPrivateRoomHostAction(
                'set_mode',
                { roomMode: roomMode },
                'Switching room to ' + label + '...',
                'Room mode set to ' + label + '.',
                'Mode change failed.',
                'canEditPrivateRoom'
            );
        }

        function setPrivateRoomTeamCount(teamCount) {
            return runPrivateRoomHostAction(
                'set_team_count',
                { teamCount: teamCount },
                'Updating team count...',
                'Team count updated.',
                'Team count change failed.',
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

        function createPrivateRoom() {
            if (busy) return Promise.resolve(null);
            setBusy(true, 'Creating room...');
            return privateRoomRequest('create', {}, 'Creating room...')
                .then(function (result) {
                    setBusy(false, '');
                    return result;
                })
                .catch(function (err) {
                    setBusy(false, '');
                    throw err;
                });
        }

        function joinPrivateRoom(roomCode) {
            if (busy) return Promise.resolve(null);
            setBusy(true, 'Joining private room...');
            return privateRoomRequest('join', { roomCode: roomCode }, 'Joining private room...')
                .then(function (result) {
                    setBusy(false, '');
                    return result;
                })
                .catch(function (err) {
                    setBusy(false, '');
                    throw err;
                });
        }

        function leavePrivateRoom() {
            if (busy) return Promise.resolve(null);
            setBusy(true, 'Leaving room...');
            setPrivateRoomStatus('Leaving room...', false);
            return privateRoomRequest('leave', {}, 'Leaving room...')
                .then(function () {
                    applyPrivateRoomState(null);
                    setPrivateRoomStatus('', false);
                    setBusy(false, '');
                    return true;
                })
                .catch(function (err) {
                    setPrivateRoomStatus((err && err.message) || 'Leave failed.', true);
                    setBusy(false, '');
                    return null;
                });
        }

        function selfPickTeam(teamId) {
            if (busy) return Promise.resolve(null);
            setBusy(true, 'Switching team...');
            return privateRoomRequest('self_pick_team', { teamId: teamId }, 'Switching team...')
                .then(function (result) {
                    setPrivateRoomStatus('Team updated.', false);
                    setBusy(false, '');
                    return result;
                })
                .catch(function (err) {
                    setPrivateRoomStatus((err && err.message) || 'Team switch failed.', true);
                    setBusy(false, '');
                    return null;
                });
        }

        function setPrivateRoomInviteLock(locked) {
            return runPrivateRoomHostAction(
                'set_invite_lock',
                { locked: !!locked },
                'Updating room invite access...',
                !!locked ? 'Room invites locked.' : 'Room invites unlocked.',
                'Room invite access update failed.',
                'canTogglePrivateRoomInviteLock'
            );
        }

        function invitePartyToPrivateRoom() {
            return runPrivateRoomHostAction(
                'invite_party',
                {},
                'Inviting party...',
                'Party invite sent.',
                'Party invite failed.',
                'canInvitePartyToPrivateRoom'
            );
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

        function refreshAll(silent) {
            if (!shouldRunBackgroundSync()) return;
            refreshPartyStateInternal(silent, false);
            refreshFriendsState(silent);
            refreshPrivateRoomState(silent);
        }

        function focusListener() {
            refreshAll(true);
        }

        function visibilityListener() {
            if (!isDocumentVisible()) {
                invalidateTrackedRequests();
                releasePollOwnerLease();
                return;
            }
            refreshAll(true);
        }

        function authChangedListener() {
            invalidateTrackedRequests();
            refreshAll(true);
            onSocialUpdate();
        }

        function pagehideListener() {
            invalidateTrackedRequests();
            releasePollOwnerLease();
            var identity = currentPartyIdentity();
            if (!identity || identity.kind !== 'guest' || !navigator.sendBeacon) return;
            try {
                var payload = buildGuestLeavePayload(identity);
                navigator.sendBeacon(resolvePartyUrl(), new Blob([JSON.stringify(payload)], { type: 'application/json' }));
                navigator.sendBeacon(resolvePrivateRoomUrl(), new Blob([JSON.stringify(payload)], { type: 'application/json' }));
            } catch (_err) {
                // no-op
            }
        }

        function start() {
            if (lifecycleStarted) return;
            lifecycleStarted = true;
            lastObservedPartyPresenceState = currentPartyPresenceState();

            if (partyPollHandle) window.clearInterval(partyPollHandle);
            partyPollHandle = window.setInterval(function () {
                if (!shouldRunBackgroundSync()) return;
                refreshPartyState(true);
            }, PARTY_POLL_INTERVAL_MS);

            if (friendsPollHandle) window.clearInterval(friendsPollHandle);
            friendsPollHandle = window.setInterval(function () {
                if (!shouldRunBackgroundSync()) return;
                refreshFriendsState(true);
            }, FRIENDS_POLL_INTERVAL_MS);

            if (privateRoomPollHandle) window.clearInterval(privateRoomPollHandle);
            privateRoomPollHandle = window.setInterval(function () {
                if (!shouldRunBackgroundSync()) return;
                // Skip HTTP poll when lobby WebSocket is active (fallback only)
                if (lobbyWsConnected) return;
                refreshPrivateRoomState(true);
            }, PRIVATE_ROOM_POLL_INTERVAL_MS);

            window.addEventListener('focus', focusListener);
            if (typeof document !== 'undefined' && document && typeof document.addEventListener === 'function') {
                document.addEventListener('visibilitychange', visibilityListener);
            }
            window.addEventListener('mayhem-session-state', sessionStateListener);
            window.addEventListener('mayhem-auth-changed', authChangedListener);
            window.addEventListener('pagehide', pagehideListener);
        }

        function stop() {
            if (!lifecycleStarted) return;
            lifecycleStarted = false;
            invalidateTrackedRequests();

            if (partyPollHandle) {
                window.clearInterval(partyPollHandle);
                partyPollHandle = 0;
            }
            if (friendsPollHandle) {
                window.clearInterval(friendsPollHandle);
                friendsPollHandle = 0;
            }
            if (privateRoomPollHandle) {
                window.clearInterval(privateRoomPollHandle);
                privateRoomPollHandle = 0;
            }

            disconnectLobbyWs();

            if (typeof window.removeEventListener === 'function') {
                window.removeEventListener('focus', focusListener);
                window.removeEventListener('mayhem-session-state', sessionStateListener);
                window.removeEventListener('mayhem-auth-changed', authChangedListener);
                window.removeEventListener('pagehide', pagehideListener);
            }
            if (typeof document !== 'undefined' && document && typeof document.removeEventListener === 'function') {
                document.removeEventListener('visibilitychange', visibilityListener);
            }
            lastObservedPartyPresenceState = '';
            releasePollOwnerLease();
        }

        return {
            getPartyState: function () { return partyState; },
            getFriendsState: function () { return friendsState; },
            getPrivateRoomState: function () { return privateRoomState; },
            getPartyStateAvailability: function () { return partyStateAvailability; },
            getPrivateRoomSummary: currentPrivateRoomSummary,
            getCapabilities: getCapabilities,
            getPartyIdentity: currentPartyIdentity,
            isBusy: function () { return !!busy; },
            hasPrivateRoomState: hasPrivateRoomState,
            refreshPartyState: refreshPartyState,
            refreshFriendsState: refreshFriendsState,
            refreshPrivateRoomState: refreshPrivateRoomState,
            refreshBackgroundState: refreshBackgroundState,
            runPartyAction: runPartyAction,
            performFriendAction: performFriendAction,
            setPrivateRoomMode: setPrivateRoomMode,
            setPrivateRoomTeamCount: setPrivateRoomTeamCount,
            randomizePrivateRoomTeams: randomizePrivateRoomTeams,
            startPrivateRoomMatch: startPrivateRoomMatch,
            movePrivateRoomMember: movePrivateRoomMember,
            setPrivateRoomInviteLock: setPrivateRoomInviteLock,
            invitePartyToPrivateRoom: invitePartyToPrivateRoom,
            createPrivateRoom: createPrivateRoom,
            joinPrivateRoom: joinPrivateRoom,
            leavePrivateRoom: leavePrivateRoom,
            selfPickTeam: selfPickTeam,
            start: start,
            stop: stop,
            focusListener: focusListener,
            visibilityListener: visibilityListener,
            authChangedListener: authChangedListener,
            pagehideListener: pagehideListener
        };
    };

    runtime.GameLobbySession = GameLobbySession;
})();
