/**
 * lobby-private-room-view.js - Private room rendering and UI state.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameLobbyPrivateRoomView
 */
(function () {
    'use strict';

    var GameLobbyPrivateRoomView = {};
    var TEAM_LABELS = {
        alpha: 'Team Alpha',
        bravo: 'Team Bravo',
        charlie: 'Team Charlie',
        delta: 'Team Delta'
    };

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

        function bindTeamDropTarget(targetEl, teamId) {
            if (!targetEl || targetEl.__teamDropBound) return;
            targetEl.__teamDropBound = true;
            targetEl.addEventListener('dragover', function (event) {
                if (!ctx.moveMember) return;
                event.preventDefault();
            });
            targetEl.addEventListener('drop', function (event) {
                if (!ctx.moveMember) return;
                event.preventDefault();
                var memberId = event.dataTransfer ? event.dataTransfer.getData('text/plain') : '';
                if (!memberId) return;
                ctx.moveMember(memberId, teamId);
            });
        }

        function teamLabel(teamId) {
            return TEAM_LABELS[String(teamId || '').toLowerCase()] || TEAM_LABELS.alpha;
        }

        function setPrivateRoomTeamList(targetEl, members, canEdit, currentTeamId, activeTeamIds) {
            if (!targetEl) return;
            targetEl.innerHTML = '';
            bindTeamDropTarget(targetEl, currentTeamId);
            if (!members || members.length === 0) {
                var empty = document.createElement('div');
                empty.className = 'private-room-empty';
                empty.textContent = 'No players assigned.';
                targetEl.appendChild(empty);
                return;
            }
            for (var i = 0; i < members.length; i++) {
                var member = members[i];
                var card = document.createElement('div');
                card.className = 'private-room-member' + (member.isHost ? ' host' : '');
                if (canEdit) {
                    card.draggable = true;
                    card.addEventListener('dragstart', (function (memberId) {
                        return function (event) {
                            if (!event.dataTransfer) return;
                            event.dataTransfer.effectAllowed = 'move';
                            event.dataTransfer.setData('text/plain', memberId);
                        };
                    })(String(member.id || '')));
                }
                var head = document.createElement('div');
                head.className = 'private-room-member-head';
                var name = document.createElement('span');
                name.textContent = (member.isHost ? 'Host  ' : '') + String(member.displayName || member.id || 'Player');
                var tag = document.createElement('span');
                tag.textContent = teamLabel(member.teamId);
                head.appendChild(name);
                head.appendChild(tag);
                card.appendChild(head);

                var idLine = document.createElement('div');
                idLine.className = 'private-room-member-id';
                idLine.textContent = String(member.id || '');
                card.appendChild(idLine);

                if (canEdit) {
                    var direction = document.createElement('div');
                    direction.className = 'private-room-member-direction';
                    direction.textContent = 'Move to another team.';
                    card.appendChild(direction);
                    for (var j = 0; j < activeTeamIds.length; j++) {
                        var nextTeamId = String(activeTeamIds[j] || '');
                        if (!nextTeamId || nextTeamId === currentTeamId) continue;
                        var moveBtn = document.createElement('button');
                        moveBtn.type = 'button';
                        moveBtn.className = 'private-room-member-move';
                        moveBtn.textContent = 'Move to ' + teamLabel(nextTeamId).replace('Team ', '');
                        moveBtn.addEventListener('click', (function (memberId, destinationTeamId) {
                            return function () {
                                ctx.moveMember(memberId, destinationTeamId);
                            };
                        })(String(member.id || ''), nextTeamId));
                        card.appendChild(moveBtn);
                    }
                }
                targetEl.appendChild(card);
            }
        }

        function applyState(nextState) {
            ctx.setState(nextState || null);
            var privateRoomState = currentState();

            if (!privateRoomState || !privateRoomState.room) {
                if (ctx.privateRoomSummaryEl) ctx.privateRoomSummaryEl.textContent = '';
                if (ctx.privateRoomTeamAlpha) ctx.privateRoomTeamAlpha.innerHTML = '';
                if (ctx.privateRoomTeamBravo) ctx.privateRoomTeamBravo.innerHTML = '';
                if (ctx.privateRoomUnassigned) ctx.privateRoomUnassigned.innerHTML = '';
                return;
            }

            var room = privateRoomState.room;
            var isHost = currentRoomHost();

            if (ctx.privateRoomSummaryEl) {
                ctx.privateRoomSummaryEl.textContent =
                    String(room.roomCode || '').toUpperCase() +
                    ' • ' + (String(room.roomPhase || '') === 'active' ? 'LIVE' : 'LOBBY') +
                    ' • ' + String(room.memberCount || 0) + '/16' +
                    ' • ' + String(room.teamCount || 2) + ' TEAMS';
            }

            if (ctx.privateRoomRandomizeBtn) {
                ctx.privateRoomRandomizeBtn.textContent = String(room.roomMode || '') === 'tdm'
                    ? 'Balance Teams'
                    : 'Randomize';
            }

            var activeTeamIds = Array.isArray(room.teamIds) && room.teamIds.length ? room.teamIds.slice() : ['alpha', 'bravo'];
            setPrivateRoomTeamList(ctx.privateRoomTeamAlpha, room.teams ? room.teams.alpha : [], isHost && String(room.roomPhase || '') === 'lobby', 'alpha', activeTeamIds);
            setPrivateRoomTeamList(ctx.privateRoomTeamBravo, room.teams ? room.teams.bravo : [], isHost && String(room.roomPhase || '') === 'lobby', 'bravo', activeTeamIds);
            setPrivateRoomTeamList(ctx.privateRoomTeamCharlie, room.teams ? room.teams.charlie : [], isHost && String(room.roomPhase || '') === 'lobby', 'charlie', activeTeamIds);
            setPrivateRoomTeamList(ctx.privateRoomTeamDelta, room.teams ? room.teams.delta : [], isHost && String(room.roomPhase || '') === 'lobby', 'delta', activeTeamIds);
            if (ctx.privateRoomUnassigned) {
                var members = Array.isArray(room.members) ? room.members : [];
                var unassigned = members.filter(function (member) {
                    return member && activeTeamIds.indexOf(String(member.teamId || '')) < 0;
                });
                ctx.privateRoomUnassigned.innerHTML = '';
                if (!unassigned.length) {
                    var empty = document.createElement('div');
                    empty.className = 'private-room-empty';
                    empty.textContent = 'Everyone assigned.';
                    ctx.privateRoomUnassigned.appendChild(empty);
                } else {
                    setPrivateRoomTeamList(ctx.privateRoomUnassigned, unassigned, false, '', activeTeamIds);
                }
            }
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
