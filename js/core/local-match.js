(function () {
    'use strict';

    var RT = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};

    function sharedMatchRulesApi() {
        return RT.GameShared && RT.GameShared.matchRules ? RT.GameShared.matchRules : null;
    }

    function matchTeamAlpha() {
        var rules = sharedMatchRulesApi();
        return rules && rules.teamAlpha ? rules.teamAlpha : 'alpha';
    }

    function matchTeamBravo() {
        var rules = sharedMatchRulesApi();
        return rules && rules.teamBravo ? rules.teamBravo : 'bravo';
    }

    function matchResetDelayMs() {
        var rules = sharedMatchRulesApi();
        return rules && Number(rules.matchResetDelayMs || 0) > 0
            ? Number(rules.matchResetDelayMs)
            : 5000;
    }

    function targetProgressForMode(mode) {
        var sharedMatchRules = sharedMatchRulesApi();
        if (sharedMatchRules && sharedMatchRules.targetProgressForGameMode) {
            return Number(sharedMatchRules.targetProgressForGameMode(mode) || 0);
        }
        return String(mode || '') === 'tdm' ? 10 : 10;
    }

    var GameLocalMatch = {};
    var SELF_ID = 'guest-self';
    var active = false;
    var modeId = 'ffa';
    var selfState = null;
    var participants = new Map();
    var enemyById = new Map();
    var matchState = null;
    var pendingSelfRespawnAt = 0;
    var resetAt = 0;

    function nowMs() {
        return Date.now();
    }

    function copy(obj) {
        return obj ? JSON.parse(JSON.stringify(obj)) : null;
    }

    function emptyMatchState() {
        var sharedMatchRules = sharedMatchRulesApi();
        var match = (sharedMatchRules && sharedMatchRules.createMatchState)
            ? sharedMatchRules.createMatchState(modeId)
            : {
                gameMode: modeId,
                started: false,
                ended: false,
                startedAt: 0,
                endedAt: 0,
                resetAt: 0,
                matchBaselinePlayerCount: 0,
                targetProgress: targetProgressForMode(modeId),
                leaderProgress: 0,
                leaderId: '',
                winnerId: '',
                winnerTeam: '',
                teamProgress: { alpha: 0, bravo: 0 },
                teamBaselineSize: { alpha: 0, bravo: 0 }
            };
        match.started = true;
        match.startedAt = nowMs();
        return match;
    }

    function baseParticipant(id, username) {
        return {
            id: String(id || ''),
            username: String(username || id || 'PLAYER'),
            alive: true,
            teamId: '',
            kills: 0,
            deaths: 0,
            progressScore: 0
        };
    }

    function teamProgress(teamId) {
        return Number(matchState && matchState.teamProgress && matchState.teamProgress[teamId] || 0);
    }

    function recomputeTdmState() {
        if (!matchState || modeId !== 'tdm') return;
        var alphaSize = 0;
        var bravoSize = 0;
        participants.forEach(function (entry) {
            if (!entry) return;
            if (entry.teamId === matchTeamAlpha()) alphaSize++;
            else if (entry.teamId === matchTeamBravo()) bravoSize++;
        });
        matchState.teamBaselineSize[matchTeamAlpha()] = Math.max(1, alphaSize);
        matchState.teamBaselineSize[matchTeamBravo()] = Math.max(1, bravoSize);
        matchState.teamProgress[matchTeamAlpha()] = 0;
        matchState.teamProgress[matchTeamBravo()] = 0;
        participants.forEach(function (entry) {
            if (!entry) return;
            entry.progressScore = entry.teamId === matchTeamAlpha()
                ? teamProgress(matchTeamAlpha())
                : teamProgress(matchTeamBravo());
        });
    }

    function updateLeader() {
        if (!matchState) return;
        if (modeId === 'ffa') {
            var leader = '';
            var best = 0;
            participants.forEach(function (entry) {
                var progress = Math.max(0, Number(entry.kills || 0));
                entry.progressScore = progress;
                if (progress >= best) {
                    best = progress;
                    leader = entry.id;
                }
            });
            matchState.leaderId = leader;
            matchState.leaderProgress = best;
            return;
        }
        if (modeId === 'tdm') {
            var alphaProgress = Number((matchState.teamProgress && matchState.teamProgress[matchTeamAlpha()]) || 0);
            var bravoProgress = Number((matchState.teamProgress && matchState.teamProgress[matchTeamBravo()]) || 0);
            matchState.leaderId = '';
            matchState.leaderProgress = Number(Math.max(alphaProgress, bravoProgress).toFixed(3));
        }
    }

    function finishMatch(winnerId, winnerTeam) {
        if (!matchState || matchState.ended) return;
        matchState.ended = true;
        matchState.endedAt = nowMs();
        matchState.resetAt = matchState.endedAt + matchResetDelayMs();
        matchState.winnerId = String(winnerId || '');
        matchState.winnerTeam = String(winnerTeam || '');
        resetAt = matchState.resetAt;
    }

    function resetRound() {
        if (!active) return;
        pendingSelfRespawnAt = 0;
        matchState = emptyMatchState();
        resetAt = 0;
        participants.forEach(function (entry) {
            entry.alive = true;
            entry.teamId = modeId === 'tdm'
                ? (entry.id === SELF_ID ? matchTeamAlpha() : (entry.teamId || matchTeamBravo()))
                : '';
            entry.kills = 0;
            entry.deaths = 0;
            entry.progressScore = 0;
        });
        if (modeId === 'tdm') {
            recomputeTdmState();
        }
        if (RT.GamePlayer) {
            if (RT.GamePlayer.setAliveVisual) RT.GamePlayer.setAliveVisual(true);
            if (RT.GamePlayer.setStatusState) RT.GamePlayer.setStatusState({ stunUntil: 0, spawnShieldUntil: nowMs() + 1000 });
            if (RT.GamePlayer.setActionRestrictions) RT.GamePlayer.setActionRestrictions({ weaponUntil: 0, throwableUntil: 0 });
        }
        if (RT.GamePlayerCombat && RT.GamePlayerCombat.respawn) {
            RT.GamePlayerCombat.respawn();
        }
        if (RT.GameEnemy && RT.GameEnemy.getEnemies && RT.GameEnemy.respawn) {
            var enemies = RT.GameEnemy.getEnemies();
            for (var i = 0; i < enemies.length; i++) {
                RT.GameEnemy.respawn(enemies[i]);
            }
        }
        updateLeader();
    }

    function participantForEnemy(enemy) {
        if (!enemy) return null;
        return participants.get(String(enemy.localMatchId || '')) || null;
    }

    function ensureSelf() {
        if (!selfState) {
            selfState = baseParticipant(SELF_ID, 'PLAYER');
            selfState.teamId = modeId === 'tdm' ? matchTeamAlpha() : '';
            participants.set(selfState.id, selfState);
        }
    }

    GameLocalMatch.init = function (options) {
        options = options || {};
        var requestedMode = String(options.gameMode || 'ffa').toLowerCase();
        modeId = requestedMode === 'tdm' ? 'tdm' : 'ffa';
        active = true;
        participants = new Map();
        enemyById = new Map();
        selfState = null;
        ensureSelf();
        matchState = emptyMatchState();
        matchState.matchBaselinePlayerCount = 1;
        pendingSelfRespawnAt = 0;
        resetAt = 0;
        if (modeId === 'tdm') {
            recomputeTdmState();
        }
        updateLeader();
    };

    GameLocalMatch.shutdown = function () {
        active = false;
        selfState = null;
        participants = new Map();
        enemyById = new Map();
        matchState = null;
        pendingSelfRespawnAt = 0;
        resetAt = 0;
    };

    GameLocalMatch.isActive = function () {
        return !!active;
    };

    GameLocalMatch.getMode = function () {
        return modeId;
    };

    GameLocalMatch.registerEnemy = function (enemy) {
        if (!active || !enemy) return null;
        ensureSelf();
        var id = String(enemy.localMatchId || ('guest-opponent-' + String((enemy.index || 0) + 1)));
        enemy.localMatchId = id;
        var entry = baseParticipant(id, enemy.displayName || ('OPPONENT_' + String((enemy.index || 0) + 1)));
        if (modeId === 'tdm') {
            entry.teamId = (Math.max(0, Number(enemy.index || 0)) % 2 === 0) ? matchTeamBravo() : matchTeamAlpha();
        }
        participants.set(id, entry);
        enemyById.set(id, enemy);
        matchState.matchBaselinePlayerCount = participants.size;
        if (modeId === 'tdm') {
            recomputeTdmState();
        }
        updateLeader();
        return entry;
    };

    GameLocalMatch.onEnemyKilled = function (enemy) {
        if (!active || !enemy || !selfState || !matchState || matchState.ended) return null;
        var target = participantForEnemy(enemy);
        if (!target || !target.alive) return null;

        selfState.kills += 1;
        target.deaths += 1;

        if (modeId === 'tdm') {
            var selfTeam = String(selfState.teamId || matchTeamAlpha());
            var baseline = Math.max(1, Number((matchState.teamBaselineSize && matchState.teamBaselineSize[selfTeam]) || 1));
            matchState.teamProgress[selfTeam] = Number((teamProgress(selfTeam) + (1 / baseline)).toFixed(3));
            participants.forEach(function (entry) {
                if (!entry || entry.teamId !== selfTeam) return;
                entry.progressScore = matchState.teamProgress[selfTeam];
            });
            updateLeader();
            if (matchState.teamProgress[selfTeam] >= Number(matchState.targetProgress || targetProgressForMode(modeId) || 10)) {
                finishMatch('', selfTeam);
            }
            return { respawnDelaySec: 5.0 };
        }

        selfState.progressScore = selfState.kills;
        updateLeader();
        if (selfState.kills >= Number(matchState.targetProgress || targetProgressForMode(modeId) || 10)) {
            finishMatch(selfState.id);
        }
        return { respawnDelaySec: 5.0 };
    };

    GameLocalMatch.onEnemyRespawn = function (enemy) {
        var target = participantForEnemy(enemy);
        if (!target) return;
        target.alive = true;
    };

    GameLocalMatch.onSelfKilled = function (attackerEnemy) {
        if (!active || !selfState || !matchState || matchState.ended) return null;
        selfState.deaths += 1;
        var attacker = participantForEnemy(attackerEnemy);
        if (attacker) attacker.kills += 1;

        if (modeId === 'tdm') {
            if (attacker && attacker.teamId) {
                var attackerTeam = String(attacker.teamId);
                var attackerBaseline = Math.max(1, Number((matchState.teamBaselineSize && matchState.teamBaselineSize[attackerTeam]) || 1));
                matchState.teamProgress[attackerTeam] = Number((teamProgress(attackerTeam) + (1 / attackerBaseline)).toFixed(3));
                participants.forEach(function (entry) {
                    if (!entry || entry.teamId !== attackerTeam) return;
                    entry.progressScore = matchState.teamProgress[attackerTeam];
                });
                if (matchState.teamProgress[attackerTeam] >= Number(matchState.targetProgress || targetProgressForMode(modeId) || 10)) {
                    finishMatch('', attackerTeam);
                }
            }
            updateLeader();
            return { useManagedRespawn: false };
        }

        if (attacker) attacker.progressScore = attacker.kills;
        updateLeader();
        if (attacker && attacker.kills >= Number(matchState.targetProgress || targetProgressForMode(modeId) || 10)) {
            finishMatch(attacker.id);
        }
        return { useManagedRespawn: false };
    };

    GameLocalMatch.getMatchState = function () {
        return active ? copy(matchState) : null;
    };

    GameLocalMatch.getSelfState = function () {
        return active && selfState ? copy(selfState) : null;
    };

    GameLocalMatch.getEntityName = function (entityId) {
        if (!active) return '';
        var entry = participants.get(String(entityId || ''));
        return entry ? String(entry.username || entry.id || '') : '';
    };

    GameLocalMatch.tick = function () {
        if (!active || !matchState) return;
        if (matchState.ended) {
            if (resetAt && nowMs() >= resetAt) resetRound();
            return;
        }
        if (pendingSelfRespawnAt && nowMs() >= pendingSelfRespawnAt) {
            pendingSelfRespawnAt = 0;
            selfState.alive = true;
            if (RT.GamePlayer && RT.GamePlayer.setAliveVisual) RT.GamePlayer.setAliveVisual(true);
            if (RT.GamePlayer && RT.GamePlayer.setStatusState) RT.GamePlayer.setStatusState({ stunUntil: 0, spawnShieldUntil: nowMs() + 1000 });
            if (RT.GamePlayer && RT.GamePlayer.setActionRestrictions) RT.GamePlayer.setActionRestrictions({ weaponUntil: 0, throwableUntil: 0 });
            if (RT.GamePlayerCombat && RT.GamePlayerCombat.respawn) RT.GamePlayerCombat.respawn();
        }
    };

    RT.GameLocalMatch = GameLocalMatch;
})();
