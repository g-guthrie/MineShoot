/**
 * lobby-actions.js - Menu shell behavior owner.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameLobbyActions
 */
(function () {
    'use strict';

    var runtime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    var GameLobbyActions = {};

    GameLobbyActions.create = function (opts) {
        opts = opts || {};

        function getState() {
            return opts.getState ? opts.getState() : {};
        }

        function getSession() {
            return opts.getSession ? opts.getSession() : null;
        }

        function getSessionApi() {
            return opts.getSessionApi ? opts.getSessionApi() : null;
        }

        function setBusy(value) {
            if (opts.setBusy) opts.setBusy(!!value);
        }

        function render() {
            if (opts.render) opts.render();
        }

        function normalizeMode(modeId) {
            return opts.normalizeMode ? opts.normalizeMode(modeId) : String(modeId || '');
        }

        function modeLabel(modeId) {
            return opts.modeLabel ? opts.modeLabel(modeId) : String(modeId || '');
        }

        function roomCodeFromRoomId(roomId) {
            return opts.roomCodeFromRoomId ? opts.roomCodeFromRoomId(roomId) : String(roomId || '').toUpperCase();
        }

        function selectedModeForRoomSeed(modeId) {
            return opts.selectedModeForRoomSeed ? opts.selectedModeForRoomSeed(modeId) : '';
        }

        function currentPartyIdentity() {
            return opts.currentPartyIdentity ? opts.currentPartyIdentity() : null;
        }

        function setLaunchState(patch) {
            if (opts.setLaunchState) opts.setLaunchState(patch || {});
        }

        function writeReturnState(payload) {
            if (opts.writeReturnState) opts.writeReturnState(payload || {});
        }

        function setActiveSurface(surfaceId) {
            if (opts.setActiveSurface) opts.setActiveSurface(surfaceId);
        }

        function setModeListOpen(open) {
            if (opts.setModeListOpen) opts.setModeListOpen(!!open);
        }

        function setPartyStatus(text, isErr) {
            if (opts.setPartyStatus) opts.setPartyStatus(text, isErr);
        }

        function setRoomStatus(text, isErr) {
            if (opts.setRoomStatus) opts.setRoomStatus(text, isErr);
        }

        function patchState(patch) {
            if (opts.patchState) opts.patchState(patch || {});
        }

        function getFriendTargetId() {
            return opts.getFriendTargetId ? String(opts.getFriendTargetId() || '') : '';
        }

        function setFriendTargetValue(nextValue, sourceEl) {
            if (opts.setFriendTargetValue) opts.setFriendTargetValue(nextValue, sourceEl);
        }

        function syncLoadoutState() {
            if (opts.syncLoadoutState) opts.syncLoadoutState();
        }

        function busy() {
            return !!(opts.isBusy && opts.isBusy());
        }

        function launchModeById(modeId, options) {
            return opts.launchModeById ? opts.launchModeById(modeId, options || {}) : { ok: false, error: 'Launch unavailable.' };
        }

        function validationError() {
            syncLoadoutState();
            var validation = getState().loadout && getState().loadout.validation ? getState().loadout.validation : null;
            if (validation && validation.ok) return '';
            return validation && validation.message ? String(validation.message) : 'Loadout incomplete.';
        }

        function setLaunchError(message) {
            setLaunchState({
                phase: 'error',
                message: String(message || 'Launch failed.'),
                error: true
            });
            render();
            return false;
        }

        function rejectLaunch(message) {
            return Promise.resolve(setLaunchError(message));
        }

        function completeLaunch(modeId, launchOptions, fallbackMessage) {
            return Promise.resolve(launchModeById(modeId, launchOptions))
                .then(function (result) {
                    setBusy(false);
                    return handleLaunchResult(result, fallbackMessage);
                })
                .catch(function (err) {
                    setBusy(false);
                    return setLaunchError((err && err.message) ? err.message : 'Launch failed.');
                });
        }

        function handleLaunchResult(result, fallbackMessage) {
            if (!result || !result.ok) {
                return setLaunchError((result && result.error) ? result.error : 'Launch failed.');
            }

            var mode = result.mode || null;
            var sessionApi = getSessionApi();
            if (sessionApi && sessionApi.prepareLaunch) {
                sessionApi.prepareLaunch(mode || {});
            }
            setLaunchState({
                phase: 'entering',
                roomCode: mode && mode.roomId ? roomCodeFromRoomId(mode.roomId) : '',
                hasRuntime: true,
                message: fallbackMessage || 'Ready.',
                error: false
            });
            render();

            if (!sessionApi || !sessionApi.startGameplayFromMenu) {
                setLaunchState({ phase: 'retryable', message: fallbackMessage || 'Ready.', error: false });
                render();
                return false;
            }

            return Promise.resolve(sessionApi.startGameplayFromMenu()).then(function (entryResult) {
                if (entryResult && entryResult.entered) {
                    setLaunchState({ phase: 'in_match', message: 'Match live.', error: false });
                } else {
                    setLaunchState({
                        phase: 'retryable',
                        message: (entryResult && entryResult.error) ? entryResult.error : (fallbackMessage || 'Enter match.'),
                        error: false
                    });
                }
                render();
                return !!(entryResult && entryResult.entered);
            });
        }

        function isLaunchBlocked() {
            var launchState = getState().launch || {};
            return !!(launchState.hasRuntime || launchState.phase === 'matching' || launchState.phase === 'joining' || launchState.phase === 'entering' || launchState.phase === 'in_match');
        }

        function launchAssignedMatch(nextPartyState) {
            if (!nextPartyState || !nextPartyState.self) return;
            if (isLaunchBlocked()) return;
            var launchState = getState().launch || {};
            var self = nextPartyState.self;
            var modeId = '';
            var roomId = '';
            var gameMode = '';
            var message = '';
            var nextSurface = 'main';
            if (self.publicMatch && self.publicMatch.roomId) {
                modeId = 'cloud_multiplayer';
                roomId = String(self.publicMatch.roomId || '');
                gameMode = String(self.publicMatch.gameMode || 'ffa');
                message = 'Joining room ' + roomId.toUpperCase() + '...';
            } else if (self.privateRoom && self.privateRoom.roomId && String(self.privateRoom.roomPhase || '') === 'active') {
                modeId = 'single_cloudflare';
                roomId = String(self.privateRoom.roomId || '');
                gameMode = String(self.privateRoom.roomMode || 'ffa');
                message = 'Joining room ' + roomCodeFromRoomId(roomId).toUpperCase() + '...';
                nextSurface = 'room';
            } else {
                return;
            }
            setBusy(true);
            writeReturnState({ activeSurface: nextSurface, selectedMode: normalizeMode(gameMode) || launchState.selectedMode });
            setLaunchState({
                selectedMode: normalizeMode(gameMode) || launchState.selectedMode,
                phase: 'joining',
                message: message,
                error: false
            });
            render();
            completeLaunch(modeId, {
                roomId: roomId,
                gameMode: gameMode || 'ffa'
            }, modeId === 'single_cloudflare' ? 'Room ready.' : 'Match ready.');
        }

        /**
         * Launch directly from private room state (used by WS push path).
         * This bypasses the party state check that launchAssignedMatch uses,
         * so non-hosts can auto-launch as soon as the WS delivers roomPhase: 'active'.
         */
        function launchFromPrivateRoomState(privateRoomState) {
            if (!privateRoomState || !privateRoomState.room) return;
            if (isLaunchBlocked()) return;
            var room = privateRoomState.room;
            if (String(room.roomPhase || '') !== 'active') return;
            var roomId = String(room.roomId || '');
            if (!roomId) return;
            var gameMode = String(room.roomMode || 'ffa');
            setBusy(true);
            writeReturnState({ activeSurface: 'room', selectedMode: normalizeMode(gameMode) });
            setLaunchState({
                selectedMode: normalizeMode(gameMode),
                phase: 'joining',
                message: 'Joining room ' + roomCodeFromRoomId(roomId).toUpperCase() + '...',
                error: false
            });
            render();
            completeLaunch('single_cloudflare', {
                roomId: roomId,
                gameMode: gameMode || 'ffa'
            }, 'Room ready.');
        }

        function launchGame(modeId) {
            var state = getState();
            var mode = normalizeMode(modeId || (state.launch && state.launch.selectedMode));
            var invalid = validationError();
            if (invalid) {
                return rejectLaunch(invalid);
            }
            if (!mode) return Promise.resolve(false);

            setBusy(true);
            writeReturnState({ activeSurface: 'main', selectedMode: mode });
            setLaunchState({
                selectedMode: mode,
                phase: mode === 'sandbox' ? 'joining' : 'matching',
                message: mode === 'sandbox' ? 'Preparing Offline Sandbox...' : ('Finding ' + modeLabel(mode) + '...'),
                error: false
            });
            render();

            if (mode === 'sandbox') {
                return completeLaunch('single_full_sandbox', { gameMode: 'ffa' }, 'Offline Sandbox ready.');
            }

            var actor = currentPartyIdentity();
            var lobbyApi = opts.lobbyApi || null;
            if (!lobbyApi || !lobbyApi.requestJson || !lobbyApi.matchmakingPath) {
                setBusy(false);
                return rejectLaunch('Matchmaking unavailable.');
            }
            return lobbyApi.requestJson(lobbyApi.matchmakingPath(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'quick',
                    gameMode: mode,
                    actorId: actor && actor.id ? String(actor.id) : '',
                    displayName: actor && actor.username ? String(actor.username) : ''
                })
            }).then(function (payload) {
                if (!payload || !payload.roomId) {
                    setBusy(false);
                    return setLaunchError('Room request failed.');
                }
                setLaunchState({
                    phase: 'joining',
                    message: 'Joining room ' + String(payload.roomId || '').toUpperCase() + '...',
                    roomCode: roomCodeFromRoomId(payload.roomId),
                    error: false
                });
                return completeLaunch(payload.modeId || 'cloud_multiplayer', {
                    roomId: payload.roomId,
                    gameMode: payload.gameMode || mode
                }, 'Match ready.');
            }).catch(function (err) {
                setBusy(false);
                return setLaunchError((err && err.message) ? err.message : 'Room request failed.');
            });
        }

        function handleInviteFriendAction() {
            var targetId = getFriendTargetId();
            if (!targetId) {
                setPartyStatus('Enter a friend ID.', true);
                render();
                return;
            }
            setFriendTargetValue(targetId);
            var session = getSession();
            if (!session || !session.runPartyAction) return;
            session.runPartyAction('invite', { targetId: targetId }, 'Sending invite...');
            render();
        }

        function handleJoinFriendAction() {
            var targetId = getFriendTargetId();
            if (!targetId) {
                setPartyStatus('Enter a friend ID.', true);
                render();
                return;
            }
            setFriendTargetValue(targetId);
            var session = getSession();
            if (!session || !session.runPartyAction) return;
            session.runPartyAction('join', { targetId: targetId }, 'Joining friend...');
            render();
        }

        function joinPrivateRoomByCode(roomCode) {
            var value = String(roomCode || '').trim();
            if (!value) {
                setRoomStatus('Enter a room number.', true);
                render();
                return Promise.resolve(false);
            }
            var session = getSession();
            if (!session || !session.joinPrivateRoom || busy()) return Promise.resolve(false);
            return session.joinPrivateRoom(value).then(function () {
                setActiveSurface('room');
                render();
                return true;
            });
        }

        function acceptIncomingInvite() {
            var party = getState().party || null;
            var roomInvite = party && party.roomInvite ? party.roomInvite.incoming : null;
            var session = getSession();
            if (roomInvite && roomInvite.roomId && session && session.runPartyAction) {
                session.runPartyAction('accept_room_invite', {}, 'Joining room invite...');
                render();
                return true;
            }
            var invite = party && party.directInvite ? party.directInvite.incoming : null;
            if (!invite || !invite.actorId || !session || !session.runPartyAction) return false;
            session.runPartyAction('accept_invite', { targetId: invite.actorId }, 'Joining invite...');
            render();
            return true;
        }

        function dismissIncomingInvite() {
            var party = getState().party || null;
            var roomInvite = party && party.roomInvite ? party.roomInvite.incoming : null;
            var session = getSession();
            if (roomInvite && roomInvite.roomId && session && session.runPartyAction) {
                session.runPartyAction('dismiss_room_invite', {}, 'Dismissing room invite...');
                render();
                return true;
            }
            var invite = party && party.directInvite ? party.directInvite.incoming : null;
            if (!invite || !invite.actorId || !session || !session.runPartyAction) return false;
            session.runPartyAction('dismiss_invite', { targetId: invite.actorId }, 'Dismissing invite...');
            render();
            return true;
        }

        function resumeGameplay(event) {
            if (event) {
                event.preventDefault();
                event.stopPropagation();
            }
            var sessionApi = getSessionApi();
            if (sessionApi && sessionApi.resumeGameplay) {
                sessionApi.resumeGameplay(event || null);
            }
        }

        function selectMode(modeId) {
            setLaunchState({
                selectedMode: normalizeMode(modeId),
                phase: 'idle',
                message: '',
                error: false
            });
            setModeListOpen(false);
            render();
        }

        function handleRoomAction() {
            var state = getState();
            if (state.privateRoom && state.privateRoom.room) {
                setActiveSurface('room');
                render();
                return Promise.resolve(true);
            }
            var session = getSession();
            if (!session || !session.createPrivateRoom || busy()) return Promise.resolve(false);
            setBusy(true);
            setRoomStatus('Creating room...', false);
            render();
            return session.createPrivateRoom()
                .then(function () {
                    var seedMode = selectedModeForRoomSeed((getState().launch && getState().launch.selectedMode) || '');
                    if (seedMode && session && session.setPrivateRoomMode) {
                        return session.setPrivateRoomMode(seedMode);
                    }
                    return null;
                })
                .then(function () {
                    setBusy(false);
                    setActiveSurface('room');
                    render();
                    return true;
                })
                .catch(function (err) {
                    setBusy(false);
                    setRoomStatus((err && err.message) ? err.message : 'Room creation failed.', true);
                    render();
                    return false;
                });
        }

        function leaveParty() {
            var session = getSession();
            if (!session || !session.runPartyAction) return;
            session.runPartyAction('leave', {}, 'Leaving party...');
            patchState({ expandedPartyMemberId: '' });
            render();
        }

        function setPrivateRoomMode(modeId) {
            var session = getSession();
            if (session && session.setPrivateRoomMode) session.setPrivateRoomMode(modeId);
        }

        function setPrivateRoomTeamCount(count) {
            var session = getSession();
            if (session && session.setPrivateRoomTeamCount) session.setPrivateRoomTeamCount(count);
        }

        function invitePartyToPrivateRoom() {
            var session = getSession();
            if (session && session.invitePartyToPrivateRoom) session.invitePartyToPrivateRoom();
        }

        function togglePrivateRoomInviteLock() {
            var room = getState().privateRoom && getState().privateRoom.room;
            var session = getSession();
            if (!room || !session || !session.setPrivateRoomInviteLock) return;
            session.setPrivateRoomInviteLock(!room.inviteLocked);
        }

        function randomizePrivateRoomTeams() {
            var session = getSession();
            if (session && session.randomizePrivateRoomTeams) session.randomizePrivateRoomTeams();
        }

        function maybeWarnUnevenTeams() {
            var room = getState().privateRoom && getState().privateRoom.room;
            if (!room || String(room.roomMode || '') !== 'tdm') return;
            if (Number(room.teamCount || 2) !== 2) return;
            var alphaCount = room.teams && room.teams.alpha ? room.teams.alpha.length : 0;
            var bravoCount = room.teams && room.teams.bravo ? room.teams.bravo.length : 0;
            if (alphaCount !== bravoCount) {
                setRoomStatus('Teams are uneven. Starting anyway.', false);
            }
        }

        function startPrivateRoomMatch() {
            maybeWarnUnevenTeams();
            var session = getSession();
            if (session && session.startPrivateRoomMatch) session.startPrivateRoomMatch();
        }

        function leavePrivateRoom() {
            var session = getSession();
            if (!session || !session.leavePrivateRoom || busy()) return Promise.resolve(false);
            setBusy(true);
            setRoomStatus('Leaving room...', false);
            render();
            return session.leavePrivateRoom()
                .then(function (left) {
                    if (!left) {
                        setBusy(false);
                        setRoomStatus('Leave failed.', true);
                        render();
                        return false;
                    }
                    setBusy(false);
                    setActiveSurface('main');
                    render();
                    return true;
                })
                .catch(function () {
                    setBusy(false);
                    setRoomStatus('Leave failed.', true);
                    render();
                    return false;
                });
        }

        function selfPickTeam(teamId) {
            var session = getSession();
            if (!session || !session.selfPickTeam) return;
            session.selfPickTeam(teamId);
        }

        function enterPrivateRoom() {
            var state = getState();
            var room = state.privateRoom && state.privateRoom.room;
            if (!room) return Promise.resolve(false);
            setBusy(true);
            writeReturnState({ activeSurface: 'room', selectedMode: room.roomMode || (state.launch && state.launch.selectedMode) });
            setLaunchState({
                selectedMode: normalizeMode(room.roomMode || (state.launch && state.launch.selectedMode)),
                phase: 'joining',
                message: 'Joining room ' + String(room.roomCode || '').toUpperCase() + '...',
                error: false
            });
            render();
            return completeLaunch('single_cloudflare', {
                roomId: room.roomId,
                gameMode: room.roomMode || 'ffa'
            }, 'Room ready.');
        }

        function launchDevMode(modeId) {
            var nextModeId = String(modeId || '');
            if (!nextModeId || !opts.launchModeById) return Promise.resolve(false);
            setBusy(true);
            render();
            return completeLaunch(nextModeId, {
                gameMode: normalizeMode(getState().launch && getState().launch.selectedMode) || 'ffa'
            }, 'Local multiplayer ready.');
        }

        function returnToMenu() {
            var sessionApi = getSessionApi();
            if (sessionApi && sessionApi.returnToMenu) {
                sessionApi.returnToMenu();
            }
        }

        function handleLeaveGameRequest(detail) {
            var nextDetail = detail || {};
            if (nextDetail.requiresConfirm) {
                if (opts.openLeaveConfirm) opts.openLeaveConfirm();
                render();
                return false;
            }
            returnToMenu();
            return true;
        }

        return {
            handleLaunchResult: handleLaunchResult,
            launchAssignedMatch: launchAssignedMatch,
            launchFromPrivateRoomState: launchFromPrivateRoomState,
            launchGame: launchGame,
            handleInviteFriendAction: handleInviteFriendAction,
            handleJoinFriendAction: handleJoinFriendAction,
            joinPrivateRoomByCode: joinPrivateRoomByCode,
            acceptIncomingInvite: acceptIncomingInvite,
            dismissIncomingInvite: dismissIncomingInvite,
            resumeGameplay: resumeGameplay,
            selectMode: selectMode,
            handleRoomAction: handleRoomAction,
            leaveParty: leaveParty,
            setPrivateRoomMode: setPrivateRoomMode,
            setPrivateRoomTeamCount: setPrivateRoomTeamCount,
            invitePartyToPrivateRoom: invitePartyToPrivateRoom,
            togglePrivateRoomInviteLock: togglePrivateRoomInviteLock,
            randomizePrivateRoomTeams: randomizePrivateRoomTeams,
            startPrivateRoomMatch: startPrivateRoomMatch,
            enterPrivateRoom: enterPrivateRoom,
            leavePrivateRoom: leavePrivateRoom,
            selfPickTeam: selfPickTeam,
            launchDevMode: launchDevMode,
            returnToMenu: returnToMenu,
            handleLeaveGameRequest: handleLeaveGameRequest
        };
    };

    runtime.GameLobbyActions = GameLobbyActions;
})();
