/**
 * lobby-clickables.js - Menu click binding by surface.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameLobbyClickables
 */
(function () {
    'use strict';

    var GameLobbyClickables = {};

    function bindClick(button, handler) {
        if (!button) return;
        button.addEventListener('click', handler);
    }

    function bindEnter(input, handler) {
        if (!input) return;
        input.addEventListener('keydown', function (event) {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            handler(event);
        });
    }

    function copyText(text, onSuccess, onFailure, onUnavailable) {
        if (!text) return;
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text)
                .then(function () {
                    if (typeof onSuccess === 'function') onSuccess(text);
                })
                .catch(function () {
                    if (typeof onFailure === 'function') onFailure(text);
                });
            return;
        }
        if (typeof onUnavailable === 'function') {
            onUnavailable(text);
            return;
        }
        if (typeof onFailure === 'function') onFailure(text);
    }

    GameLobbyClickables.bindLaunchSurface = function (ctx) {
        bindClick(ctx.altModeToggle, function () {
            ctx.setControlsOpen(false);
            ctx.setAltModesOpen(!ctx.isAltModesOpen());
        });

        bindClick(ctx.controlsToggle, function () {
            ctx.setAltModesOpen(false);
            ctx.setControlsOpen(!ctx.isControlsOpen());
        });

        bindClick(ctx.primaryPlayBtn, function () {
            ctx.beginRoomAction('quick', { gameMode: 'ffa' }, 'Finding an FFA room...');
        });

        bindClick(ctx.tdmPlayBtn, function () {
            ctx.beginRoomAction('quick', { gameMode: 'tdm' }, 'Finding a TDM room...');
        });

        bindClick(ctx.lmsPlayBtn, function () {
            ctx.beginRoomAction('quick', { gameMode: 'lms' }, 'Finding an LMS room...');
        });

        bindClick(ctx.sandboxPlayBtn, function (event) {
            ctx.launchSelectedSandbox(event);
        });

        bindClick(ctx.sandboxModeCycleBtn, function () {
            if (ctx.sandboxRulesetPanel) ctx.sandboxRulesetPanel.hidden = !ctx.sandboxRulesetPanel.hidden;
            if (ctx.sandboxRulesetPanel && !ctx.sandboxRulesetPanel.hidden) {
                ctx.setRoomAccessStatus('Preparing sandbox runtime...', false);
                ctx.warmSandboxRuntime()
                    .then(function () {
                        ctx.setRoomAccessStatus('Sandbox ready.', false);
                    })
                    .catch(function (err) {
                        ctx.setRoomAccessStatus((err && err.message) ? err.message : 'Sandbox failed to load.', true);
                    });
            }
        });

        bindClick(ctx.sandboxFfaBtn, function () {
            ctx.setSelectedSandboxMode('ffa');
            if (ctx.sandboxRulesetPanel) ctx.sandboxRulesetPanel.hidden = true;
        });

        bindClick(ctx.sandboxLmsBtn, function () {
            ctx.setSelectedSandboxMode('lms');
            if (ctx.sandboxRulesetPanel) ctx.sandboxRulesetPanel.hidden = true;
        });

        bindClick(ctx.createRoomBtn, function () {
            ctx.beginPrivateRoomCreate();
        });

        bindClick(ctx.joinPrivateRoomBtn, function () {
            var roomCode = ctx.privateRoomInput ? ctx.privateRoomInput.value.trim() : '';
            if (!roomCode) {
                ctx.setRoomAccessStatus('Enter a private room code.', true);
                return;
            }
            ctx.beginPrivateRoomJoin(roomCode);
        });

        bindEnter(ctx.privateRoomInput, function () {
            if (ctx.joinPrivateRoomBtn) ctx.joinPrivateRoomBtn.click();
        });

        bindClick(ctx.copyRoomCodeBtn, function () {
            var text = ctx.roomShareCode ? ctx.roomShareCode.textContent : '';
            copyText(
                text,
                function (value) {
                    ctx.setRoomAccessStatus('Copied room code ' + value + '.', false);
                },
                function (value) {
                    ctx.setRoomAccessStatus('Copy failed. Room code: ' + value + '.', true);
                },
                function (value) {
                    ctx.setRoomAccessStatus('Room code: ' + value + '.', false);
                }
            );
        });

        if (Array.isArray(ctx.modeButtons)) {
            for (var i = 0; i < ctx.modeButtons.length; i++) {
                bindClick(ctx.modeButtons[i], function () {
                    ctx.launchMode(String(this.dataset.modeId || ''));
                });
            }
        }
    };

    GameLobbyClickables.bindSocialSurface = function (ctx) {
        bindClick(ctx.menuPartyIdBtn, function () {
            var text = ctx.menuPartyIdValue ? ctx.menuPartyIdValue.textContent : '';
            copyText(
                text,
                function (value) {
                    ctx.setPartyStatus('Copied ID ' + value + '.', false);
                },
                function (value) {
                    ctx.setPartyStatus('Copy failed. ID: ' + value + '.', true);
                },
                function (value) {
                    ctx.setPartyStatus('ID: ' + value + '.', false);
                }
            );
        });

        bindClick(ctx.joinPartyBtn, function () {
            var targetId = ctx.partyIdInput ? ctx.partyIdInput.value.trim() : '';
            if (!targetId) {
                ctx.setPartyStatus('Enter a friend ID.', true);
                return;
            }
            ctx.runPartyAction('join', { targetId: targetId }, 'Joining party...');
        });

        bindClick(ctx.addFriendBtn, function () {
            var targetUserId = ctx.friendIdInput ? ctx.friendIdInput.value.trim() : '';
            if (!targetUserId) {
                ctx.setFriendsStatus('Enter a friend user ID.', true);
                return;
            }
            ctx.performFriendAction('add', targetUserId, 'Saving friend...', 'Friend saved.');
        });

        bindClick(ctx.socialTabPartyBtn, function () {
            ctx.setSocialView('party');
        });

        bindClick(ctx.socialTabFriendsBtn, function () {
            ctx.setSocialView('friends');
            if (ctx.isLoggedIn()) ctx.refreshFriendsState(true);
        });

        bindClick(ctx.socialTabRoomBtn, function () {
            if (!ctx.hasPrivateRoom()) return;
            ctx.setSocialView('room');
        });

        bindEnter(ctx.partyIdInput, function () {
            if (ctx.joinPartyBtn) ctx.joinPartyBtn.click();
        });

        bindClick(ctx.partyJoinLockBtn, function () {
            var partyState = ctx.getPartyState();
            if (!partyState || !partyState.party || !partyState.party.isLeader) return;
            ctx.runPartyAction(
                'lock',
                { locked: !partyState.party.joinLocked },
                partyState.party.joinLocked ? 'Unlocking party...' : 'Locking party...'
            );
        });

        bindClick(ctx.leavePartyBtn, function () {
            ctx.runPartyAction('leave', {}, 'Leaving party...');
        });

        bindClick(ctx.viewPartyBtn, function () {
            ctx.renderPartyRosterModal();
            if (ctx.modalManager) ctx.modalManager.open('party-roster', ctx.viewPartyBtn);
            else if (ctx.partyRosterOverlay) ctx.partyRosterOverlay.hidden = false;
        });

        bindClick(ctx.viewFriendsBtn, function () {
            ctx.renderFriendsModal();
            if (ctx.modalManager) ctx.modalManager.open('friends', ctx.viewFriendsBtn);
            else if (ctx.friendsOverlay) ctx.friendsOverlay.hidden = false;
        });

        bindClick(ctx.refreshFriendsBtn, function () {
            ctx.refreshFriendsState(false);
        });

        bindClick(ctx.friendsFilterJoinableBtn, function () {
            if (ctx.setFriendsFilter) ctx.setFriendsFilter('joinable');
        });

        bindClick(ctx.friendsFilterOnlineBtn, function () {
            if (ctx.setFriendsFilter) ctx.setFriendsFilter('online');
        });

        bindClick(ctx.friendsFilterAllBtn, function () {
            if (ctx.setFriendsFilter) ctx.setFriendsFilter('all');
        });

        bindClick(ctx.partyRosterCloseBtn, function () {
            if (ctx.modalManager) ctx.modalManager.close('party-roster');
            else if (ctx.partyRosterOverlay) ctx.partyRosterOverlay.hidden = true;
        });

        bindClick(ctx.friendsCloseBtn, function () {
            if (ctx.modalManager) ctx.modalManager.close('friends');
            else if (ctx.friendsOverlay) ctx.friendsOverlay.hidden = true;
        });

        bindEnter(ctx.friendIdInput, function () {
            if (ctx.addFriendBtn) ctx.addFriendBtn.click();
        });
    };

    GameLobbyClickables.bindPrivateRoomSurface = function (ctx) {
        bindClick(ctx.privateRoomModeFfaBtn, function () {
            if (ctx.setPrivateRoomMode) ctx.setPrivateRoomMode('ffa');
        });

        bindClick(ctx.privateRoomModeTdmBtn, function () {
            if (ctx.setPrivateRoomMode) ctx.setPrivateRoomMode('tdm');
        });

        bindClick(ctx.privateRoomModeLmsBtn, function () {
            if (ctx.setPrivateRoomMode) ctx.setPrivateRoomMode('lms');
        });

        bindClick(ctx.privateRoomRandomizeBtn, function () {
            if (ctx.randomizePrivateRoomTeams) ctx.randomizePrivateRoomTeams();
        });

        bindClick(ctx.privateRoomStartBtn, function () {
            if (ctx.startPrivateRoomMatch) ctx.startPrivateRoomMatch();
        });
    };

    globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    globalThis.__MAYHEM_RUNTIME.GameLobbyClickables = GameLobbyClickables;
})();
