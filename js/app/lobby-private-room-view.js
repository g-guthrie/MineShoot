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
        var selectedMemberId = '';
        var movePending = false;

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
            ctx.privateRoomStatusEl.hidden = !text;
            ctx.privateRoomStatusEl.classList.toggle('error', !!isErr);
        }

        function teamLabel(teamId) {
            return TEAM_LABELS[String(teamId || '').toLowerCase()] || TEAM_LABELS.alpha;
        }

        function activeTeamIds(room) {
            return Array.isArray(room && room.teamIds) && room.teamIds.length
                ? room.teamIds.slice()
                : ['alpha', 'bravo'];
        }

        function allowEditing(room) {
            return currentRoomHost() && String(room && room.roomPhase || '') === 'lobby';
        }

        function canSelfPick(room) {
            var caps = ctx.getCapabilities ? ctx.getCapabilities() : {};
            return !!caps.canSelfPickTeam && !!ctx.selfPickTeam;
        }

        function findMemberIds(room) {
            var seen = {};
            var members = Array.isArray(room && room.members) ? room.members : [];
            for (var i = 0; i < members.length; i++) {
                var memberId = String(members[i] && members[i].id || '');
                if (memberId) seen[memberId] = true;
            }
            return seen;
        }

        function syncSelection(room) {
            if (!selectedMemberId) return;
            if (findMemberIds(room)[selectedMemberId]) return;
            selectedMemberId = '';
        }

        function walkNodeTree(root, visitor) {
            if (!root) return;
            visitor(root);
            var children = root.childNodes;
            if (!children || !children.length) return;
            for (var i = 0; i < children.length; i++) {
                walkNodeTree(children[i], visitor);
            }
        }

        function removeAllChildren(el) {
            if (!el) return;
            while (el.firstChild) el.removeChild(el.firstChild);
        }

        function clearDropHighlights() {
            walkNodeTree(ctx.privateRoomRosterGrid, function (node) {
                if (node && node.classList && node.classList.remove) node.classList.remove('drag-over');
            });
            walkNodeTree(ctx.privateRoomUnassigned, function (node) {
                if (node && node.classList && node.classList.remove) node.classList.remove('drag-over');
            });
        }

        function moveMember(memberId, nextTeamId) {
            if (movePending || !ctx.moveMember) return Promise.resolve(null);
            movePending = true;
            selectedMemberId = '';
            clearDropHighlights();
            setStatus('Updating teams...', false);
            applyState(currentState());
            return Promise.resolve(ctx.moveMember(memberId, nextTeamId))
                .then(function (result) {
                    movePending = false;
                    clearDropHighlights();
                    setStatus(result ? 'Team layout updated.' : 'Team update failed.', !result);
                    applyState(currentState());
                    return result;
                })
                .catch(function () {
                    movePending = false;
                    clearDropHighlights();
                    setStatus('Team update failed.', true);
                    applyState(currentState());
                    return null;
                });
        }

        function bindDropTarget(targetEl, teamId, enabled) {
            if (!targetEl) return;
            if (targetEl.__dropBound) {
                targetEl.__dropEnabled = enabled;
                targetEl.__dropTeamId = teamId;
                return;
            }
            targetEl.__dropBound = true;
            targetEl.__dropEnabled = enabled;
            targetEl.__dropTeamId = teamId;
            targetEl.addEventListener('dragover', function (event) {
                if (!targetEl.__dropEnabled || movePending || !ctx.moveMember) return;
                event.preventDefault();
                targetEl.classList.add('drag-over');
            });
            targetEl.addEventListener('dragleave', function () {
                targetEl.classList.remove('drag-over');
            });
            targetEl.addEventListener('drop', function (event) {
                if (!targetEl.__dropEnabled || movePending || !ctx.moveMember) return;
                event.preventDefault();
                targetEl.classList.remove('drag-over');
                var memberId = event.dataTransfer ? event.dataTransfer.getData('text/plain') : '';
                if (!memberId) return;
                moveMember(memberId, targetEl.__dropTeamId);
            });
        }

        function buildMoveRail(memberId, currentTeamId, teamIds) {
            var rail = document.createElement('div');
            rail.className = 'private-room-destination-rail';
            for (var i = 0; i < teamIds.length; i++) {
                var nextTeamId = String(teamIds[i] || '');
                if (!nextTeamId || nextTeamId === currentTeamId) continue;
                var moveBtn = document.createElement('button');
                moveBtn.type = 'button';
                moveBtn.className = 'private-room-destination-pill';
                moveBtn.setAttribute('data-team-id', nextTeamId);
                moveBtn.textContent = teamLabel(nextTeamId);
                moveBtn.disabled = movePending;
                moveBtn.addEventListener('click', (function (targetId, destinationTeamId) {
                    return function (event) {
                        if (movePending) return;
                        event.preventDefault();
                        event.stopPropagation();
                        moveMember(targetId, destinationTeamId);
                    };
                })(memberId, nextTeamId));
                rail.appendChild(moveBtn);
            }
            return rail;
        }

        function buildMemberPill(member, canEditRoom, currentTeamId, teamIds) {
            var memberId = String(member && member.id || '');
            var pill = document.createElement('div');
            pill.className = 'private-room-member-pill' + (member && member.isHost ? ' host' : '') + (selectedMemberId === memberId ? ' selected' : '');
            pill.setAttribute('data-member-id', memberId);
            pill.setAttribute('data-team-id', String(currentTeamId || ''));
            pill.setAttribute('data-rounded-role', 'container');
            if (movePending) pill.className += ' pending';

            if (canEditRoom) {
                pill.draggable = !movePending;
                pill.tabIndex = 0;
                pill.setAttribute('role', 'button');
                pill.addEventListener('dragstart', function (event) {
                    if (movePending) return;
                    if (!event.dataTransfer) return;
                    event.dataTransfer.effectAllowed = 'move';
                    event.dataTransfer.setData('text/plain', memberId);
                });
                pill.addEventListener('dragend', function () {
                    clearDropHighlights();
                });
                pill.addEventListener('click', function () {
                    if (movePending) return;
                    selectedMemberId = selectedMemberId === memberId ? '' : memberId;
                    applyState(currentState());
                });
                pill.addEventListener('keydown', function (event) {
                    if (movePending) return;
                    if (event.key !== 'Enter' && event.key !== ' ') return;
                    event.preventDefault();
                    selectedMemberId = selectedMemberId === memberId ? '' : memberId;
                    applyState(currentState());
                });
            }

            var top = document.createElement('div');
            top.className = 'private-room-member-topline';

            var name = document.createElement('div');
            name.className = 'private-room-member-name';
            name.textContent = String(member && member.displayName || memberId || 'Player');
            top.appendChild(name);

            if (member && member.isHost) {
                var badge = document.createElement('span');
                badge.className = 'private-room-host-badge';
                badge.textContent = 'Host';
                top.appendChild(badge);
            }

            pill.appendChild(top);

            var meta = document.createElement('div');
            meta.className = 'private-room-member-meta';
            meta.textContent = memberId.toUpperCase();
            pill.appendChild(meta);

            if (canEditRoom && selectedMemberId === memberId) {
                pill.appendChild(buildMoveRail(memberId, currentTeamId, teamIds));
            }
            return pill;
        }

        function renderMemberTray(targetEl, members, canEditRoom, currentTeamId, teamIds, emptyCopy) {
            if (!targetEl) return;
            removeAllChildren(targetEl);
            bindDropTarget(targetEl, currentTeamId, canEditRoom && !!currentTeamId);
            if (!members || members.length === 0) {
                var empty = document.createElement('div');
                empty.className = 'private-room-empty';
                empty.textContent = String(emptyCopy || 'No players assigned.');
                targetEl.appendChild(empty);
                return;
            }
            for (var i = 0; i < members.length; i++) {
                targetEl.appendChild(buildMemberPill(members[i], canEditRoom, currentTeamId, teamIds));
            }
        }

        function buildTeamLane(teamId, members, canEditRoom, teamIds, selfPickEnabled) {
            var lane = document.createElement('section');
            lane.className = 'private-room-team-lane';
            lane.setAttribute('data-team-id', teamId);

            if (selfPickEnabled && !movePending) {
                lane.setAttribute('role', 'button');
                lane.tabIndex = 0;
                lane.addEventListener('click', function () {
                    if (movePending) return;
                    ctx.selfPickTeam(teamId);
                });
                lane.addEventListener('keydown', function (event) {
                    if (movePending) return;
                    if (event.key !== 'Enter' && event.key !== ' ') return;
                    event.preventDefault();
                    ctx.selfPickTeam(teamId);
                });
            }

            var header = document.createElement('div');
            header.className = 'private-room-team-header';

            var copy = document.createElement('div');
            copy.className = 'private-room-team-copy';

            var title = document.createElement('div');
            title.className = 'private-room-team-name';
            title.textContent = teamLabel(teamId);
            copy.appendChild(title);

            var subtitle = document.createElement('div');
            subtitle.className = 'private-room-team-subtitle';
            subtitle.textContent = String(members.length || 0) + ' ' + (members.length === 1 ? 'player ready' : 'players ready');
            copy.appendChild(subtitle);
            header.appendChild(copy);

            var count = document.createElement('div');
            count.className = 'private-room-team-count';
            count.textContent = String(members.length || 0);
            header.appendChild(count);
            lane.appendChild(header);

            var tray = document.createElement('div');
            tray.className = 'private-room-team-tray';
            tray.setAttribute('data-team-id', teamId);
            tray.setAttribute('data-rounded-role', 'container');
            lane.appendChild(tray);

            renderMemberTray(tray, members, canEditRoom, teamId, teamIds, 'Drop players here.');
            return lane;
        }

        function renderUnassignedTray(room, canEditRoom) {
            if (!ctx.privateRoomUnassigned) return;
            var teamIds = activeTeamIds(room);
            var members = Array.isArray(room.members) ? room.members : [];
            var unassigned = members.filter(function (member) {
                return member && teamIds.indexOf(String(member.teamId || '')) < 0;
            });

            if (ctx.privateRoomUnassignedWrap) {
                ctx.privateRoomUnassignedWrap.hidden = !canEditRoom && unassigned.length === 0;
            }

            renderMemberTray(
                ctx.privateRoomUnassigned,
                unassigned,
                false,
                '',
                teamIds,
                canEditRoom ? 'Fresh players land here until they are slotted.' : 'Everyone is assigned.'
            );
        }

        function renderTeamBoard(room, canEditRoom) {
            if (!ctx.privateRoomRosterGrid) return;
            removeAllChildren(ctx.privateRoomRosterGrid);
            var teamIds = activeTeamIds(room);
            var selfPick = canSelfPick(room);
            for (var i = 0; i < teamIds.length; i++) {
                var teamId = String(teamIds[i] || '');
                var members = room.teams && room.teams[teamId] ? room.teams[teamId] : [];
                ctx.privateRoomRosterGrid.appendChild(buildTeamLane(teamId, members, canEditRoom, teamIds, selfPick));
            }
        }

        function applyState(nextState) {
            ctx.setState(nextState || null);
            var privateRoomState = currentState();

            if (!privateRoomState || !privateRoomState.room) {
                if (ctx.privateRoomSummaryEl) ctx.privateRoomSummaryEl.textContent = '';
                removeAllChildren(ctx.privateRoomUnassigned);
                removeAllChildren(ctx.privateRoomRosterGrid);
                return;
            }

            var room = privateRoomState.room;
            var canEditRoom = allowEditing(room);
            syncSelection(room);

            if (ctx.privateRoomSummaryEl) {
                ctx.privateRoomSummaryEl.textContent =
                    String(room.roomCode || '').toUpperCase() +
                    ' • ' + (String(room.roomPhase || '') === 'active' ? 'LIVE' : 'LOBBY') +
                    ' • ' + String(room.memberCount || 0) + '/16' +
                    ' • ' + String(room.teamCount || 2) + ' TEAMS';
            }

            if (ctx.privateRoomRandomizeBtn) {
                ctx.privateRoomRandomizeBtn.textContent = String(room.roomMode || '') === 'tdm'
                    ? 'Auto Assign'
                    : 'Shuffle';
            }

            renderUnassignedTray(room, canEditRoom);
            renderTeamBoard(room, canEditRoom);
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
