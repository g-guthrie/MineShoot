/**
 * lobby-private-room-view.js - Private room rendering and UI state.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameLobbyPrivateRoomView
 */
(function () {
    'use strict';

    var GameLobbyPrivateRoomView = {};

    GameLobbyPrivateRoomView.create = function (ctx) {
        function currentState() {
            return ctx.getState();
        }

        function currentRoomHost() {
            var privateRoomState = currentState();
            return !!(privateRoomState && privateRoomState.self && privateRoomState.self.isHost);
        }

        function setStatus(text, isErr) {
            if (!ctx.privateRoomStatusEl) return;
            ctx.privateRoomStatusEl.textContent = text || '';
            ctx.privateRoomStatusEl.style.color = isErr ? '#ffb3a6' : '#ffd7af';
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
            ctx.setState(nextState || null);
            var privateRoomState = currentState();

            if (!privateRoomState || !privateRoomState.room) {
                return;
            }

            var room = privateRoomState.room;
            var isHost = currentRoomHost();

            if (ctx.privateRoomSummaryEl) {
                ctx.privateRoomSummaryEl.textContent =
                    'ROOM ' + String(room.roomCode || '').toUpperCase() +
                    ' :: HOST ' + String(room.hostActorId || '').toUpperCase() +
                    ' :: MODE ' + String(room.roomMode || 'ffa').toUpperCase() +
                    ' :: ' + String(room.memberCount || 0) + '/16' +
                    ' :: ' + (String(room.roomPhase || '') === 'active' ? 'LIVE' : 'LOBBY');
            }

            setPrivateRoomTeamList(ctx.privateRoomTeamAlpha, room.teams ? room.teams.alpha : [], isHost && String(room.roomPhase || '') === 'lobby', 'bravo');
            setPrivateRoomTeamList(ctx.privateRoomTeamBravo, room.teams ? room.teams.bravo : [], isHost && String(room.roomPhase || '') === 'lobby', 'alpha');
        }

        function setUnavailable(message) {
            if (ctx.privateRoomSummaryEl && ctx.getPartyState() && ctx.getPartyState().self && ctx.getPartyState().self.privateRoom) {
                ctx.privateRoomSummaryEl.textContent = String(message || 'Private room service unavailable. Retrying...').toUpperCase();
            }
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
