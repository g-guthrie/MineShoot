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
        var lastSnapshotKey = '';
        var statusDismissTimer = 0;
        var touchDragMemberId = '';
        var touchDragGhost = null;
        var touchStartX = 0;
        var touchStartY = 0;
        var consecutiveFailures = 0;
        var MAX_CONSECUTIVE_FAILURES = 8;
        var optimisticMove = null; // { memberId, fromTeamId, toTeamId }
        var hasReceivedFirstState = false;
        var touchCancelHandler = null;

        function currentState() {
            return ctx.getState();
        }

        function currentRoomHost() {
            var privateRoomState = currentState();
            return !!(privateRoomState && privateRoomState.self && privateRoomState.self.isHost);
        }

        function setStatus(text, isErr) {
            if (!ctx.privateRoomStatusEl) return;
            if (statusDismissTimer) {
                clearTimeout(statusDismissTimer);
                statusDismissTimer = 0;
            }
            ctx.privateRoomStatusEl.textContent = text || '';
            ctx.privateRoomStatusEl.hidden = !text;
            ctx.privateRoomStatusEl.classList.toggle('error', !!isErr);
            // Auto-dismiss non-error statuses after 3 seconds
            if (text && !isErr) {
                statusDismissTimer = setTimeout(function () {
                    if (ctx.privateRoomStatusEl) {
                        ctx.privateRoomStatusEl.hidden = true;
                        ctx.privateRoomStatusEl.textContent = '';
                    }
                    statusDismissTimer = 0;
                }, 3000);
            }
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

        /**
         * Build a snapshot key from room state so we can skip DOM rebuilds
         * when nothing meaningful changed.
         */
        function buildSnapshotKey(room) {
            if (!room) return '';
            var parts = [
                String(room.roomMode || ''),
                String(room.roomPhase || ''),
                String(room.teamCount || 2),
                String(room.memberCount || 0),
                selectedMemberId,
                movePending ? '1' : '0'
            ];
            var teamIds = activeTeamIds(room);
            for (var i = 0; i < teamIds.length; i++) {
                var teamId = teamIds[i];
                var members = room.teams && room.teams[teamId] ? room.teams[teamId] : [];
                for (var j = 0; j < members.length; j++) {
                    parts.push(String(members[j].id || '') + ':' + String(members[j].teamId || ''));
                }
            }
            // Include unassigned members
            var allMembers = Array.isArray(room.members) ? room.members : [];
            for (var k = 0; k < allMembers.length; k++) {
                if (teamIds.indexOf(String(allMembers[k].teamId || '')) < 0) {
                    parts.push('u:' + String(allMembers[k].id || ''));
                }
            }
            return parts.join('|');
        }

        function removeAllChildren(el) {
            if (!el) return;
            if (typeof el.replaceChildren === 'function') {
                el.replaceChildren();
                return;
            }
            if (Array.isArray(el.children)) {
                el.children.length = 0;
                el.childNodes = el.children;
            }
            el.textContent = '';
            el.innerHTML = '';
        }

        function childElements(root) {
            return root && Array.isArray(root.children) ? root.children : [];
        }

        function hasClass(node, className) {
            if (!node || !className) return false;
            if (node.classList && node.classList.contains && node.classList.contains(className)) return true;
            var raw = String(node.className || '').trim();
            if (!raw) return false;
            var parts = raw.split(/\s+/);
            for (var i = 0; i < parts.length; i++) {
                if (parts[i] === className) return true;
            }
            return false;
        }

        function elementContains(root, target) {
            var node = target || null;
            while (node) {
                if (node === root) return true;
                node = node.parentNode || null;
            }
            return false;
        }

        function collectTeamTrays() {
            var out = [];
            var stack = childElements(ctx.privateRoomRosterGrid).slice();
            while (stack.length) {
                var node = stack.shift();
                if (!node) continue;
                if (hasClass(node, 'private-room-team-tray')) out.push(node);
                var children = childElements(node);
                for (var i = 0; i < children.length; i++) stack.push(children[i]);
            }
            return out;
        }

        function findMemberPill(root, memberId) {
            var targetId = String(memberId || '');
            var stack = childElements(root).slice();
            while (stack.length) {
                var node = stack.shift();
                if (!node) continue;
                if (node.dataset && String(node.dataset.memberId || '') === targetId) return node;
                var children = childElements(node);
                for (var i = 0; i < children.length; i++) stack.push(children[i]);
            }
            return null;
        }

        // ── Skeleton loading UI ──────────────────────────────────────
        function buildSkeletonPill() {
            var pill = document.createElement('div');
            pill.className = 'private-room-member-pill skeleton';
            var top = document.createElement('div');
            top.className = 'private-room-member-topline';
            var bar = document.createElement('div');
            bar.className = 'skeleton-bar skeleton-bar-name';
            top.appendChild(bar);
            pill.appendChild(top);
            var meta = document.createElement('div');
            meta.className = 'skeleton-bar skeleton-bar-meta';
            pill.appendChild(meta);
            return pill;
        }

        function buildSkeletonLane(teamId) {
            var lane = document.createElement('section');
            lane.className = 'private-room-team-lane skeleton-lane';
            lane.setAttribute('data-team-id', teamId);
            var header = document.createElement('div');
            header.className = 'private-room-team-header';
            var copy = document.createElement('div');
            copy.className = 'private-room-team-copy';
            var title = document.createElement('div');
            title.className = 'skeleton-bar skeleton-bar-title';
            copy.appendChild(title);
            var subtitle = document.createElement('div');
            subtitle.className = 'skeleton-bar skeleton-bar-subtitle';
            copy.appendChild(subtitle);
            header.appendChild(copy);
            lane.appendChild(header);
            var tray = document.createElement('div');
            tray.className = 'private-room-team-tray';
            tray.appendChild(buildSkeletonPill());
            lane.appendChild(tray);
            return lane;
        }

        function renderSkeleton() {
            if (!ctx.privateRoomRosterGrid) return;
            removeAllChildren(ctx.privateRoomRosterGrid);
            ctx.privateRoomRosterGrid.appendChild(buildSkeletonLane('alpha'));
            ctx.privateRoomRosterGrid.appendChild(buildSkeletonLane('bravo'));
        }

        function createSkeletonBar(className) {
            var bar = document.createElement('div');
            bar.className = 'skeleton-bar ' + (className || '');
            return bar;
        }

        // ── Empty state (solo player) ────────────────────────────────
        function buildEmptyState(room) {
            var wrap = document.createElement('div');
            wrap.className = 'private-room-empty-state';
            var icon = document.createElement('div');
            icon.className = 'private-room-empty-icon';
            icon.textContent = '\uD83C\uDFAE'; // 🎮
            wrap.appendChild(icon);
            var heading = document.createElement('div');
            heading.className = 'private-room-empty-heading';
            heading.textContent = 'Waiting for players';
            wrap.appendChild(heading);
            var detail = document.createElement('div');
            detail.className = 'private-room-empty-detail';
            detail.textContent = 'Share the room code or invite your party to get started.';
            wrap.appendChild(detail);
            return wrap;
        }

        // ── Optimistic move ──────────────────────────────────────────
        function applyOptimisticMove(room) {
            if (!optimisticMove) return room;
            var move = optimisticMove;
            // Deep-clone teams
            var teams = {};
            var teamIds = activeTeamIds(room);
            for (var i = 0; i < teamIds.length; i++) {
                var tid = teamIds[i];
                teams[tid] = room.teams && room.teams[tid] ? room.teams[tid].slice() : [];
            }
            // Find and move member
            var member = null;
            for (var t = 0; t < teamIds.length; t++) {
                var arr = teams[teamIds[t]];
                for (var m = arr.length - 1; m >= 0; m--) {
                    if (String(arr[m].id || '') === move.memberId) {
                        member = arr[m];
                        arr.splice(m, 1);
                        break;
                    }
                }
                if (member) break;
            }
            // Also check unassigned
            var members = Array.isArray(room.members) ? room.members.slice() : [];
            if (!member) {
                for (var u = 0; u < members.length; u++) {
                    if (String(members[u].id || '') === move.memberId) {
                        member = members[u];
                        break;
                    }
                }
            }
            if (member && teams[move.toTeamId]) {
                var moved = { id: member.id, displayName: member.displayName, teamId: move.toTeamId, isHost: member.isHost };
                teams[move.toTeamId].push(moved);
                // Update in members array too
                for (var k = 0; k < members.length; k++) {
                    if (String(members[k].id || '') === move.memberId) {
                        members[k] = moved;
                        break;
                    }
                }
            }
            // Return patched room
            var patched = {};
            for (var key in room) {
                if (Object.prototype.hasOwnProperty.call(room, key)) patched[key] = room[key];
            }
            patched.teams = teams;
            patched.members = members;
            return patched;
        }

        function clearDropHighlights() {
            var trays = collectTeamTrays();
            for (var i = 0; i < trays.length; i++) trays[i].classList.remove('drag-over');
            if (ctx.privateRoomUnassigned) ctx.privateRoomUnassigned.classList.remove('drag-over');
        }

        function moveMember(memberId, nextTeamId) {
            if (movePending || !ctx.moveMember) return Promise.resolve(null);
            movePending = true;
            selectedMemberId = '';
            clearDropHighlights();
            // Apply optimistic move immediately
            optimisticMove = { memberId: memberId, toTeamId: nextTeamId };
            lastSnapshotKey = ''; // Force re-render
            applyState(currentState());
            return Promise.resolve(ctx.moveMember(memberId, nextTeamId))
                .then(function (result) {
                    movePending = false;
                    optimisticMove = null;
                    clearDropHighlights();
                    if (result) {
                        consecutiveFailures = 0;
                        setStatus('Team layout updated.', false);
                    } else {
                        consecutiveFailures++;
                        setStatus('Team update failed.', true);
                    }
                    lastSnapshotKey = ''; // Force re-render to reconcile with server state
                    applyState(currentState());
                    return result;
                })
                .catch(function () {
                    movePending = false;
                    optimisticMove = null;
                    consecutiveFailures++;
                    clearDropHighlights();
                    setStatus('Team update failed.', true);
                    lastSnapshotKey = '';
                    applyState(currentState());
                    return null;
                });
        }

        // ── Touch drag-and-drop ──────────────────────────────────────
        function createTouchGhost(memberEl) {
            var ghost = memberEl.cloneNode(true);
            ghost.className = 'private-room-member-pill touch-ghost';
            ghost.style.position = 'fixed';
            ghost.style.zIndex = '9999';
            ghost.style.pointerEvents = 'none';
            ghost.style.opacity = '0.88';
            ghost.style.transform = 'scale(1.05)';
            ghost.style.width = memberEl.offsetWidth + 'px';
            ghost.style.transition = 'none';
            document.body.appendChild(ghost);
            return ghost;
        }

        function removeTouchGhost() {
            if (touchDragGhost && touchDragGhost.parentNode) {
                touchDragGhost.parentNode.removeChild(touchDragGhost);
            }
            touchDragGhost = null;
            touchDragMemberId = '';
        }

        function findDropTarget(x, y) {
            var trays = collectTeamTrays();
            for (var i = 0; i < trays.length; i++) {
                var rect = trays[i].getBoundingClientRect();
                if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
                    return trays[i];
                }
            }
            if (ctx.privateRoomUnassigned) {
                var uRect = ctx.privateRoomUnassigned.getBoundingClientRect();
                if (x >= uRect.left && x <= uRect.right && y >= uRect.top && y <= uRect.bottom) {
                    return ctx.privateRoomUnassigned;
                }
            }
            return null;
        }

        function handleTouchStart(event, memberId, pillEl) {
            if (movePending) return;
            var touch = event.touches[0];
            touchStartX = touch.clientX;
            touchStartY = touch.clientY;
            touchDragMemberId = memberId;
            // Don't create ghost yet — wait for touchmove to confirm drag intent
        }

        function handleTouchMove(event) {
            if (!touchDragMemberId) return;
            var touch = event.touches[0];
            var dx = touch.clientX - touchStartX;
            var dy = touch.clientY - touchStartY;
            // Require 10px movement to start drag
            if (!touchDragGhost && Math.abs(dx) + Math.abs(dy) < 10) return;
            event.preventDefault();

            if (!touchDragGhost) {
                var pillEl = ctx.privateRoomRosterGrid ? findMemberPill(ctx.privateRoomRosterGrid, touchDragMemberId) : null;
                if (!pillEl) pillEl = ctx.privateRoomUnassigned ? findMemberPill(ctx.privateRoomUnassigned, touchDragMemberId) : null;
                if (pillEl) {
                    touchDragGhost = createTouchGhost(pillEl);
                    pillEl.classList.add('pending');
                }
            }

            if (touchDragGhost) {
                touchDragGhost.style.left = (touch.clientX - 40) + 'px';
                touchDragGhost.style.top = (touch.clientY - 20) + 'px';
            }

            // Highlight drop target
            clearDropHighlights();
            var target = findDropTarget(touch.clientX, touch.clientY);
            if (target && target.__dropEnabled) {
                target.classList.add('drag-over');
            }
        }

        function handleTouchEnd(event) {
            if (!touchDragMemberId) return;
            var touch = event.changedTouches[0];
            var target = findDropTarget(touch.clientX, touch.clientY);
            clearDropHighlights();

            if (touchDragGhost && target && target.__dropEnabled && target.__dropTeamId !== undefined) {
                moveMember(touchDragMemberId, target.__dropTeamId);
            }
            removeTouchGhost();
        }

        // ── Desktop drag-and-drop ────────────────────────────────────
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
            targetEl.addEventListener('dragleave', function (ev) {
                // Only remove highlight when actually leaving the target
                var related = ev.relatedTarget;
                if (related && elementContains(targetEl, related)) return;
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

        // ── UI builders ──────────────────────────────────────────────
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
            pill.className = 'private-room-member-pill'
                + (member && member.isHost ? ' host' : '')
                + (selectedMemberId === memberId ? ' selected' : '');
            pill.setAttribute('data-member-id', memberId);
            pill.setAttribute('data-team-id', String(currentTeamId || ''));
            pill.setAttribute('data-rounded-role', 'container');
            if (movePending) pill.className += ' pending';

            if (canEditRoom) {
                pill.draggable = !movePending;
                pill.tabIndex = 0;
                pill.setAttribute('role', 'button');
                pill.setAttribute('aria-label', 'Move ' + String(member && member.displayName || 'Player') + ' to another team');
                pill.addEventListener('dragstart', function (event) {
                    if (movePending) return;
                    if (!event.dataTransfer) return;
                    event.dataTransfer.effectAllowed = 'move';
                    event.dataTransfer.setData('text/plain', memberId);
                });
                pill.addEventListener('dragend', function () {
                    clearDropHighlights();
                });
                // Touch drag support
                pill.addEventListener('touchstart', function (event) {
                    handleTouchStart(event, memberId, pill);
                }, { passive: true });
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

            var displayName = String(member && member.displayName || '');
            if (displayName && displayName !== memberId) {
                var meta = document.createElement('div');
                meta.className = 'private-room-member-meta';
                meta.textContent = memberId.toUpperCase();
                pill.appendChild(meta);
            }

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

        function buildTeamLane(teamId, members, canEditRoom, teamIds, selfPickEnabled, isFirstRender) {
            var lane = document.createElement('section');
            lane.className = 'private-room-team-lane' + (isFirstRender ? ' bloom' : '');
            lane.setAttribute('data-team-id', teamId);
            lane.setAttribute('aria-label', teamLabel(teamId) + ', ' + members.length + ' players');

            if (selfPickEnabled && !movePending) {
                lane.setAttribute('role', 'button');
                lane.tabIndex = 0;
                lane.setAttribute('aria-label', 'Switch to ' + teamLabel(teamId));
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

            var title = document.createElement('div');
            title.className = 'private-room-team-name';
            title.textContent = teamLabel(teamId);
            header.appendChild(title);

            var subtitle = document.createElement('div');
            subtitle.className = 'private-room-team-subtitle';
            subtitle.textContent = String(members.length || 0) + ' ' + (members.length === 1 ? 'player' : 'players');
            header.appendChild(subtitle);

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

            // Only show when there are actual unassigned players
            if (ctx.privateRoomUnassignedWrap) {
                ctx.privateRoomUnassignedWrap.hidden = unassigned.length === 0;
            }

            if (unassigned.length > 0) {
                renderMemberTray(
                    ctx.privateRoomUnassigned,
                    unassigned,
                    canEditRoom,
                    '',
                    teamIds,
                    ''
                );
            } else {
                removeAllChildren(ctx.privateRoomUnassigned);
            }
        }

        function renderTeamBoard(room, canEditRoom) {
            if (!ctx.privateRoomRosterGrid) return;
            removeAllChildren(ctx.privateRoomRosterGrid);
            var teamIds = activeTeamIds(room);
            var selfPick = canSelfPick(room);
            var isFirstRender = !lastSnapshotKey;
            for (var i = 0; i < teamIds.length; i++) {
                var teamId = String(teamIds[i] || '');
                var members = room.teams && room.teams[teamId] ? room.teams[teamId] : [];
                ctx.privateRoomRosterGrid.appendChild(buildTeamLane(teamId, members, canEditRoom, teamIds, selfPick, isFirstRender));
            }
        }

        function applyState(nextState) {
            ctx.setState(nextState || null);
            var privateRoomState = currentState();

            if (!privateRoomState || !privateRoomState.room) {
                // Show skeleton if we know we're in a room but haven't loaded state yet
                if (!hasReceivedFirstState && ctx.getPartyState && ctx.getPartyState() &&
                    ctx.getPartyState().self && ctx.getPartyState().self.privateRoom) {
                    renderSkeleton();
                    return;
                }
                removeAllChildren(ctx.privateRoomUnassigned);
                removeAllChildren(ctx.privateRoomRosterGrid);
                lastSnapshotKey = '';
                hasReceivedFirstState = false;
                return;
            }

            hasReceivedFirstState = true;
            var room = privateRoomState.room;

            // Apply optimistic move if pending
            if (optimisticMove) {
                room = applyOptimisticMove(room);
            }

            var canEditRoom = allowEditing(room);
            syncSelection(room);

            if (ctx.privateRoomRandomizeBtn) {
                ctx.privateRoomRandomizeBtn.textContent = String(room.roomMode || '') === 'tdm'
                    ? 'Auto Assign'
                    : 'Shuffle';
            }

            // Skip full DOM rebuild if nothing changed (prevents poll flashing)
            var nextKey = buildSnapshotKey(room);
            if (nextKey === lastSnapshotKey && !movePending) return;
            lastSnapshotKey = nextKey;

            renderUnassignedTray(room, canEditRoom);
            renderTeamBoard(room, canEditRoom);
        }

        function setUnavailable(message) {
            consecutiveFailures++;
            if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
                setStatus('Connection lost. Retrying\u2026', true);
            } else if (ctx.getPartyState && ctx.getPartyState() &&
                ctx.getPartyState().self && ctx.getPartyState().self.privateRoom) {
                setStatus(String(message || 'Private room service unavailable. Retrying...'), true);
            }
        }

        function resetFailures() {
            consecutiveFailures = 0;
        }

        // Global touch listeners for drag (tracked for cleanup)
        touchCancelHandler = function () {
            clearDropHighlights();
            removeTouchGhost();
        };
        if (typeof document !== 'undefined' && document) {
            document.addEventListener('touchmove', handleTouchMove, { passive: false });
            document.addEventListener('touchend', handleTouchEnd, { passive: true });
            document.addEventListener('touchcancel', touchCancelHandler, { passive: true });
        }

        function destroy() {
            if (typeof document !== 'undefined' && document) {
                document.removeEventListener('touchmove', handleTouchMove);
                document.removeEventListener('touchend', handleTouchEnd);
                if (touchCancelHandler) document.removeEventListener('touchcancel', touchCancelHandler);
            }
            if (statusDismissTimer) clearTimeout(statusDismissTimer);
            removeTouchGhost();
        }

        return {
            applyState: applyState,
            setUnavailable: setUnavailable,
            setStatus: setStatus,
            resetFailures: resetFailures,
            destroy: destroy
        };
    };

    globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    globalThis.__MAYHEM_RUNTIME.GameLobbyPrivateRoomView = GameLobbyPrivateRoomView;
})();
