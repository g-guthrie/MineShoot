/**
 * lobby-party-view.js - Party rendering and UI state.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameLobbyPartyView
 */
(function () {
    'use strict';

    var GameLobbyPartyView = {};

    GameLobbyPartyView.create = function (ctx) {
        function currentState() {
            return ctx.getState();
        }

        function setPartyPreviewVisible(visible) {
            if (ctx.partyRosterPreviewShell) {
                ctx.partyRosterPreviewShell.hidden = !visible;
            }
        }

        function setPartyPreviewEmpty(text) {
            if (!ctx.partyRosterPreview) return;
            ctx.partyRosterPreview.innerHTML = '';
            var empty = document.createElement('div');
            empty.className = 'party-preview-empty';
            empty.textContent = text || 'No party data.';
            ctx.partyRosterPreview.appendChild(empty);
        }

        function renderPartyRosterModal() {
            var partyState = currentState();
            if (!ctx.partyRosterModalContent) return;
            if (!partyState || !partyState.party || !Array.isArray(partyState.party.members)) {
                ctx.partyRosterModalContent.textContent = 'NO PARTY DATA';
                return;
            }
            ctx.partyRosterModalContent.innerHTML = '';
            var summary = document.createElement('div');
            summary.className = 'party-modal-summary';
            summary.textContent =
                'PARTY ' + String(partyState.party.id || '').toUpperCase() +
                ' :: LEAD ' + String(partyState.party.leaderId || '').toUpperCase() +
                ' :: LOCK ' + (partyState.party.joinLocked ? 'ENGAGED' : 'OPEN') +
                ' :: ' + String(partyState.party.memberCount || 0) + '/16';
            ctx.partyRosterModalContent.appendChild(summary);
            for (var i = 0; i < partyState.party.members.length; i++) {
                var member = partyState.party.members[i];
                var row = document.createElement('div');
                row.className = 'party-modal-row' + (member.isLeader ? ' leader' : '');
                var metaWrap = document.createElement('div');
                metaWrap.className = 'party-modal-main';
                var name = document.createElement('div');
                name.className = 'party-modal-name';
                name.textContent = (member.isLeader ? '[LEAD] ' : '[MEMB] ') + String(member.displayName || member.id || 'PLAYER').toUpperCase();
                var meta = document.createElement('div');
                meta.className = 'party-modal-meta';
                meta.textContent = member.isAccount && member.username
                    ? '@' + String(member.username || '').toUpperCase()
                    : String(member.id || '').toUpperCase();
                metaWrap.appendChild(name);
                metaWrap.appendChild(meta);
                row.appendChild(metaWrap);
                if (ctx.memberCanBeFriended(member)) {
                    var action = document.createElement('button');
                    action.type = 'button';
                    action.className = 'party-modal-action';
                    action.textContent = '+ FRIEND';
                    action.disabled = !!ctx.isRoomActionInFlight();
                    action.addEventListener('click', (function (targetUserId, targetLabel) {
                        return function () {
                            ctx.onAddFriend(targetUserId, targetLabel);
                        };
                    })(String(member.accountUserId || ''), String(member.displayName || member.username || member.id || 'PLAYER')));
                    row.appendChild(action);
                }
                ctx.partyRosterModalContent.appendChild(row);
            }
        }

        function applyPartyState(nextState) {
            ctx.setState(nextState || null);
            var partyState = currentState();
            if (!partyState || !partyState.party) {
                setPartyPreviewVisible(false);
                setPartyPreviewEmpty('Party link standby.');
                return;
            }

            var members = Array.isArray(partyState.party.members) ? partyState.party.members : [];
            var shouldShowPreview = true;
            setPartyPreviewVisible(shouldShowPreview);
            if (ctx.partyRosterPreview && shouldShowPreview) {
                ctx.partyRosterPreview.innerHTML = '';
                if (!members.length) {
                    setPartyPreviewEmpty('No party members.');
                } else {
                    var previewCount = Math.min(4, members.length);
                    for (var i = 0; i < previewCount; i++) {
                        var member = members[i];
                        var line = document.createElement('div');
                        line.className = 'party-preview-line' +
                            (member.isLeader ? ' leader' : '') +
                            (ctx.memberCanBeFriended(member) ? ' friendable' : '');
                        var row = document.createElement('div');
                        row.className = 'party-preview-row';
                        var main = document.createElement('div');
                        main.className = 'party-preview-main';
                        var text = document.createElement('div');
                        text.className = 'party-preview-text';
                        text.textContent = (member.isLeader ? '[LEAD] ' : '[MEMB] ') + String(member.displayName || member.id || 'PLAYER').toUpperCase();
                        var meta = document.createElement('div');
                        meta.className = 'party-preview-meta';
                        meta.textContent = member.isAccount && member.username
                            ? '@' + String(member.username || '').toUpperCase()
                            : String(member.id || '').toUpperCase();
                        main.appendChild(text);
                        main.appendChild(meta);
                        row.appendChild(main);
                        if (ctx.memberCanBeFriended(member)) {
                            var actions = document.createElement('div');
                            actions.className = 'party-preview-actions';
                            var addBtn = document.createElement('button');
                            addBtn.type = 'button';
                            addBtn.className = 'party-preview-add';
                            addBtn.textContent = '+ FRIEND';
                            addBtn.addEventListener('click', (function (targetUserId, targetLabel) {
                                return function () {
                                    ctx.onAddFriend(targetUserId, targetLabel);
                                };
                            })(String(member.accountUserId || ''), String(member.displayName || member.username || member.id || 'PLAYER')));
                            actions.appendChild(addBtn);
                            row.appendChild(actions);
                        }
                        line.appendChild(row);
                        ctx.partyRosterPreview.appendChild(line);
                    }
                    if (members.length > previewCount) {
                        var more = document.createElement('div');
                        more.className = 'party-preview-empty';
                        more.textContent = '+' + String(members.length - previewCount) + ' MORE MEMBERS';
                        ctx.partyRosterPreview.appendChild(more);
                    }
                }
            } else if (ctx.partyRosterPreview) {
                ctx.partyRosterPreview.innerHTML = '';
            }

            renderPartyRosterModal();
        }

        function setUnavailable(message) {
            var partyState = currentState();
            if (partyState && partyState.party) {
                applyPartyState(partyState);
                return;
            }
            setPartyPreviewVisible(true);
            setPartyPreviewEmpty(message || 'Party service unavailable. Retrying...');
            if (ctx.partyRosterModalContent) {
                ctx.partyRosterModalContent.textContent = String(message || 'Party service unavailable. Retrying...').toUpperCase();
            }
        }

        return {
            applyState: applyPartyState,
            setUnavailable: setUnavailable,
            renderModal: renderPartyRosterModal
        };
    };

    globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    globalThis.__MAYHEM_RUNTIME.GameLobbyPartyView = GameLobbyPartyView;
})();
