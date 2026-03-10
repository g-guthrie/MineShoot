/**
 * lobby-private-room-view.js - Private room rendering and UI state.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameLobbyPrivateRoomView
 */
(function () {
    'use strict';

    var GameLobbyPrivateRoomView = {};

    GameLobbyPrivateRoomView.create = function (ctx) {
        function setStatus(text, isErr) {
            if (!ctx.privateRoomStatusEl) return;
            ctx.privateRoomStatusEl.textContent = text || '';
            ctx.privateRoomStatusEl.style.color = isErr ? '#ffb3a6' : '#ffd7af';
        }

        function setPrivateRoomViewVisible(visible) {
            if (ctx.partyLinkView) ctx.partyLinkView.hidden = false;
            if (ctx.socialTabRoomBtn) ctx.socialTabRoomBtn.hidden = !visible;
            if (!visible && ctx.getSocialView() === 'room') {
                ctx.setSocialView('party');
                return;
            }
            if (ctx.privateRoomView) ctx.privateRoomView.hidden = !visible || ctx.getSocialView() !== 'room';
        }

        function setPrivateRoomTeamList(targetEl, members, canEdit, destinationTeamId) {
            if (!targetEl) return;
            targetEl.innerHTML = '';
            if (!members || members.length === 0) {
                var empty = document.createElement('div');
                empty.className = 'private-room-empty';
                empty.textContent = 'NO PLAYERS ASSIGNED';
                targetEl.appendChild(empty);
                return;
            }
            for (var i = 0; i < members.length; i++) {
                var member = members[i];
                var card = document.createElement('div');
                card.className = 'private-room-member' + (member.isHost ? ' host' : '');
                var head = document.createElement('div');
                head.className = 'private-room-member-head';
                var name = document.createElement('span');
                name.textContent = (member.isHost ? '[HOST] ' : '') + String(member.displayName || member.id || 'PLAYER').toUpperCase();
                var tag = document.createElement('span');
                tag.textContent = member.teamId === 'bravo' ? 'T2' : 'T1';
                head.appendChild(name);
                head.appendChild(tag);
                card.appendChild(head);

                var idLine = document.createElement('div');
                idLine.className = 'private-room-member-id';
                idLine.textContent = String(member.id || '').toUpperCase();
                card.appendChild(idLine);

                if (canEdit) {
                    var moveBtn = document.createElement('button');
                    moveBtn.type = 'button';
                    moveBtn.className = 'private-room-member-move';
                    moveBtn.textContent = destinationTeamId === 'bravo' ? 'MOVE -> TEAM 2' : 'MOVE -> TEAM 1';
                    moveBtn.addEventListener('click', (function (memberId, nextTeamId) {
                        return function () {
                            ctx.moveMember(memberId, nextTeamId);
                        };
                    })(String(member.id || ''), destinationTeamId));
                    card.appendChild(moveBtn);
                }
                targetEl.appendChild(card);
            }
        }

        function applyState(nextState) {
            var previous = ctx.getState();
            var hadPrivateRoom = !!(previous && previous.room);
            ctx.setState(nextState || null);
            var privateRoomState = ctx.getState();

            if (!privateRoomState || !privateRoomState.room) {
                setPrivateRoomViewVisible(false);
                return;
            }

            var room = privateRoomState.room;
            var isHost = !!(privateRoomState.self && privateRoomState.self.isHost);
            if (!hadPrivateRoom) {
                ctx.setSocialView('room');
            }
            setPrivateRoomViewVisible(true);

            if (ctx.privateRoomSummaryEl) {
                ctx.privateRoomSummaryEl.textContent =
                    'ROOM ' + String(room.roomCode || '').toUpperCase() +
                    ' :: HOST ' + String(room.hostActorId || '').toUpperCase() +
                    ' :: MODE ' + String(room.roomMode || 'ffa').toUpperCase() +
                    ' :: ' + String(room.memberCount || 0) + '/16' +
                    ' :: ' + (String(room.roomPhase || '') === 'active' ? 'LIVE' : 'LOBBY');
            }

            if (ctx.privateRoomModeFfaBtn) {
                ctx.privateRoomModeFfaBtn.classList.toggle('active', String(room.roomMode || '') === 'ffa');
                ctx.privateRoomModeFfaBtn.disabled = !isHost;
            }
            if (ctx.privateRoomModeTdmBtn) {
                ctx.privateRoomModeTdmBtn.classList.toggle('active', String(room.roomMode || '') === 'tdm');
                ctx.privateRoomModeTdmBtn.disabled = !isHost;
            }
            if (ctx.privateRoomModeLmsBtn) {
                ctx.privateRoomModeLmsBtn.classList.toggle('active', String(room.roomMode || '') === 'lms');
                ctx.privateRoomModeLmsBtn.disabled = !isHost;
            }
            if (ctx.privateRoomRandomizeBtn) {
                ctx.privateRoomRandomizeBtn.disabled = !isHost || String(room.roomMode || '') === 'lms';
            }
            if (ctx.privateRoomStartBtn) {
                ctx.privateRoomStartBtn.style.display = String(room.roomPhase || '') === 'lobby' ? '' : 'none';
                ctx.privateRoomStartBtn.disabled = !isHost || String(room.roomPhase || '') !== 'lobby';
            }

            setPrivateRoomTeamList(ctx.privateRoomTeamAlpha, room.teams ? room.teams.alpha : [], isHost && String(room.roomPhase || '') === 'lobby', 'bravo');
            setPrivateRoomTeamList(ctx.privateRoomTeamBravo, room.teams ? room.teams.bravo : [], isHost && String(room.roomPhase || '') === 'lobby', 'alpha');
        }

        function setUnavailable(message, err) {
            setStatus(message, true);
            if (ctx.privateRoomSummaryEl && ctx.getPartyState() && ctx.getPartyState().self && ctx.getPartyState().self.privateRoom) {
                ctx.privateRoomSummaryEl.textContent = 'PRIVATE ROOM SERVICE UNAVAILABLE. RETRYING...';
            }
            ctx.logSyncError('private-room', err);
        }

        return {
            applyState: applyState,
            setUnavailable: setUnavailable,
            setStatus: setStatus
        };
    };

    globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    globalThis.__MAYHEM_RUNTIME.GameLobbyPrivateRoomView = GameLobbyPrivateRoomView;
})();
