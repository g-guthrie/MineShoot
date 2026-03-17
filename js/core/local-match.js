(function () {
    'use strict';

    var RT = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    var sharedLms = RT.GameShared && RT.GameShared.lmsMode ? RT.GameShared.lmsMode : null;
    var sharedMatchRules = RT.GameShared && RT.GameShared.matchRules ? RT.GameShared.matchRules : null;
    var MATCH_TEAM_ALPHA = sharedMatchRules && sharedMatchRules.teamAlpha ? sharedMatchRules.teamAlpha : 'alpha';
    var MATCH_TEAM_BRAVO = sharedMatchRules && sharedMatchRules.teamBravo ? sharedMatchRules.teamBravo : 'bravo';
    var lmsRules = sharedLms && sharedLms.rules ? sharedLms.rules : {
        startingLives: 4,
        maxLives: 4,
        chargePerElimination: 1,
        chargePerExtraLife: 2,
        respawnDelayMs: 2500,
        beaconRotateMs: 60000,
        beaconWarmupMs: 20000,
        beaconBankRadius: 4.5,
        beaconChannelMs: 4000,
        finalBankingCutoffRemaining: 4
    };
    var matchResetDelayMs = sharedMatchRules && Number(sharedMatchRules.matchResetDelayMs || 0) > 0
        ? Number(sharedMatchRules.matchResetDelayMs)
        : 5000;

    function targetProgressForMode(mode) {
        if (sharedMatchRules && sharedMatchRules.targetProgressForGameMode) {
            return Number(sharedMatchRules.targetProgressForGameMode(mode) || 0);
        }
        if (String(mode || '') === 'tdm') return 10;
        return String(mode || '') === 'ffa' ? 10 : 0;
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
    var beaconAnchors = [];
    var activeBeaconIndex = 0;
    var nextBeaconRotateAt = 0;
    var pendingBankById = {};

    function nowMs() {
        return Date.now();
    }

    function copy(obj) {
        return obj ? JSON.parse(JSON.stringify(obj)) : null;
    }

    function emptyMatchState() {
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
                lms: modeId === 'lms' ? {
                    startingLives: lmsRules.startingLives,
                    maxLives: lmsRules.maxLives,
                    chargePerExtraLife: lmsRules.chargePerExtraLife,
                    remainingPlayers: 0,
                    finalBankingCutoffRemaining: lmsRules.finalBankingCutoffRemaining,
                    warmupEndsAt: 0,
                    nextRotateAt: 0,
                    bankingEnabled: false,
                    activeBeacon: null
                } : null,
                teamProgress: { alpha: 0, bravo: 0 },
                teamBaselineSize: { alpha: 0, bravo: 0 }
            };
        match.started = true;
        match.startedAt = nowMs();
        if (modeId === 'lms' && match.lms) {
            match.lms.warmupEndsAt = nowMs() + lmsRules.beaconWarmupMs;
            match.lms.nextRotateAt = nowMs() + lmsRules.beaconRotateMs;
        }
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
            progressScore: 0,
            lmsLives: modeId === 'lms' ? lmsRules.startingLives : 0,
            lmsCharge: 0,
            lmsBankState: null
        };
    }

    function participantsList() {
        return Array.from(participants.values());
    }

    function remainingLmsPlayers() {
        var list = participantsList();
        var remaining = 0;
        for (var i = 0; i < list.length; i++) {
            if (Number(list[i].lmsLives || 0) > 0) remaining++;
        }
        return remaining;
    }

    function currentBeacon() {
        if (!beaconAnchors.length) return null;
        return beaconAnchors[Math.max(0, Math.min(beaconAnchors.length - 1, activeBeaconIndex))] || null;
    }

    function syncLmsState() {
        if (!matchState || !matchState.lms) return;
        var beacon = currentBeacon();
        matchState.lms.activeBeacon = beacon ? {
            id: beacon.id,
            label: beacon.label,
            x: beacon.x,
            z: beacon.z
        } : null;
        matchState.lms.nextRotateAt = nextBeaconRotateAt;
        matchState.lms.remainingPlayers = remainingLmsPlayers();
        matchState.lms.bankingEnabled =
            nowMs() >= Number(matchState.lms.warmupEndsAt || 0) &&
            matchState.lms.remainingPlayers > Number(matchState.lms.finalBankingCutoffRemaining || lmsRules.finalBankingCutoffRemaining);
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
        if (modeId === 'lms') {
            syncLmsState();
            var lmsLeader = '';
            var lmsBest = -1;
            participants.forEach(function (entry) {
                var progress = Number(entry.lmsLives || 0) + (Number(entry.lmsCharge || 0) * 0.01);
                entry.progressScore = Number(entry.lmsLives || 0);
                if (progress >= lmsBest) {
                    lmsBest = progress;
                    lmsLeader = entry.id;
                }
            });
            matchState.leaderId = lmsLeader;
            matchState.leaderProgress = Number(Math.max(0, lmsBest).toFixed(2));
            return;
        }
        if (modeId === 'tdm') {
            var alphaProgress = Number((matchState.teamProgress && matchState.teamProgress[MATCH_TEAM_ALPHA]) || 0);
            var bravoProgress = Number((matchState.teamProgress && matchState.teamProgress[MATCH_TEAM_BRAVO]) || 0);
            matchState.leaderId = '';
            matchState.leaderProgress = Number(Math.max(alphaProgress, bravoProgress).toFixed(3));
        }
    }

    function rotateBeacon() {
        if (!beaconAnchors.length) return;
        activeBeaconIndex = (activeBeaconIndex + 1) % beaconAnchors.length;
        nextBeaconRotateAt = nowMs() + lmsRules.beaconRotateMs;
        pendingBankById = {};
        participants.forEach(function (entry) {
            entry.lmsBankState = null;
        });
        syncLmsState();
    }

    function finishMatch(winnerId, winnerTeam) {
        if (!matchState || matchState.ended) return;
        matchState.ended = true;
        matchState.endedAt = nowMs();
        matchState.resetAt = matchState.endedAt + matchResetDelayMs;
        matchState.winnerId = String(winnerId || '');
        matchState.winnerTeam = String(winnerTeam || '');
        resetAt = matchState.resetAt;
    }

    function resetRound() {
        if (!active) return;
        pendingSelfRespawnAt = 0;
        pendingBankById = {};
        matchState = emptyMatchState();
        resetAt = 0;
        activeBeaconIndex = 0;
        nextBeaconRotateAt = nowMs() + lmsRules.beaconRotateMs;
        participants.forEach(function (entry) {
            entry.alive = true;
            entry.teamId = modeId === 'tdm'
                ? (entry.id === SELF_ID ? MATCH_TEAM_ALPHA : (entry.teamId || MATCH_TEAM_BRAVO))
                : '';
            entry.kills = 0;
            entry.deaths = 0;
            entry.progressScore = 0;
            entry.lmsLives = modeId === 'lms' ? lmsRules.startingLives : 0;
            entry.lmsCharge = 0;
            entry.lmsBankState = null;
        });
        if (modeId === 'tdm') {
            recomputeTdmState();
        }
        if (RT.GamePlayer) {
            if (RT.GamePlayer.setAliveVisual) RT.GamePlayer.setAliveVisual(true);
            if (RT.GamePlayer.setStatusState) RT.GamePlayer.setStatusState({ stunUntil: 0, spawnShieldUntil: nowMs() + 1000 });
            if (RT.GamePlayer.setActionRestrictions) RT.GamePlayer.setActionRestrictions({ weaponUntil: 0, throwableUntil: 0, abilityUntil: 0 });
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

    function teamProgress(teamId) {
        return Number(matchState && matchState.teamProgress && matchState.teamProgress[teamId] || 0);
    }

    function recomputeTdmState() {
        if (!matchState || modeId !== 'tdm') return;
        var alphaSize = 0;
        var bravoSize = 0;
        participants.forEach(function (entry) {
            if (!entry) return;
            if (entry.teamId === MATCH_TEAM_ALPHA) alphaSize++;
            else if (entry.teamId === MATCH_TEAM_BRAVO) bravoSize++;
        });
        matchState.teamBaselineSize[MATCH_TEAM_ALPHA] = Math.max(1, alphaSize);
        matchState.teamBaselineSize[MATCH_TEAM_BRAVO] = Math.max(1, bravoSize);
        matchState.teamProgress[MATCH_TEAM_ALPHA] = 0;
        matchState.teamProgress[MATCH_TEAM_BRAVO] = 0;
        participants.forEach(function (entry) {
            if (!entry) return;
            entry.progressScore = entry.teamId === MATCH_TEAM_ALPHA
                ? teamProgress(MATCH_TEAM_ALPHA)
                : teamProgress(MATCH_TEAM_BRAVO);
        });
    }

    function ensureSelf() {
        if (!selfState) {
            selfState = baseParticipant(SELF_ID, 'PLAYER');
            selfState.teamId = modeId === 'tdm' ? MATCH_TEAM_ALPHA : '';
            participants.set(selfState.id, selfState);
        }
    }

    function buildBeaconAnchors() {
        var world = RT.GameWorld || null;
        var bounds = world && world.getBounds ? world.getBounds() : { min: 2, max: 110 };
        var min = typeof bounds.min === 'number' ? bounds.min : 2;
        var max = typeof bounds.max === 'number' ? bounds.max : 110;
        if (sharedLms && sharedLms.buildBeaconAnchors) {
            return sharedLms.buildBeaconAnchors({ boundsMin: min, boundsMax: max });
        }
        return [];
    }

    GameLocalMatch.init = function (options) {
        options = options || {};
        var requestedMode = String(options.gameMode || 'ffa').toLowerCase();
        modeId = requestedMode === 'lms' ? 'lms' : (requestedMode === 'tdm' ? 'tdm' : 'ffa');
        active = true;
        participants = new Map();
        enemyById = new Map();
        ensureSelf();
        beaconAnchors = modeId === 'lms' ? buildBeaconAnchors() : [];
        activeBeaconIndex = 0;
        nextBeaconRotateAt = nowMs() + lmsRules.beaconRotateMs;
        matchState = emptyMatchState();
        matchState.matchBaselinePlayerCount = 1;
        pendingSelfRespawnAt = 0;
        resetAt = 0;
        pendingBankById = {};
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
        beaconAnchors = [];
        pendingBankById = {};
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
        var id = String(enemy.localMatchId || ('guest-bot-' + String((enemy.index || 0) + 1)));
        enemy.localMatchId = id;
        var entry = baseParticipant(id, enemy.displayName || ('BOT_' + String((enemy.index || 0) + 1)));
        if (modeId === 'tdm') {
            entry.teamId = (Math.max(0, Number(enemy.index || 0)) % 2 === 0) ? MATCH_TEAM_BRAVO : MATCH_TEAM_ALPHA;
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

        if (modeId === 'lms') {
            target.lmsLives = Math.max(0, Number(target.lmsLives || lmsRules.startingLives) - 1);
            target.lmsCharge = 0;
            target.lmsBankState = null;
            target.alive = target.lmsLives > 0;
            selfState.lmsCharge = Math.min(lmsRules.chargePerExtraLife, Number(selfState.lmsCharge || 0) + lmsRules.chargePerElimination);
            updateLeader();
            if (remainingLmsPlayers() <= 1) {
                finishMatch(selfState.id);
                return { respawnDelaySec: null };
            }
            return { respawnDelaySec: target.alive ? (lmsRules.respawnDelayMs / 1000) : null };
        }
        if (modeId === 'tdm') {
            var selfTeam = String(selfState.teamId || MATCH_TEAM_ALPHA);
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

        if (modeId === 'lms') {
            selfState.lmsLives = Math.max(0, Number(selfState.lmsLives || lmsRules.startingLives) - 1);
            selfState.lmsCharge = 0;
            selfState.lmsBankState = null;
            selfState.alive = selfState.lmsLives > 0;
            if (attacker) attacker.progressScore = attacker.kills;
            updateLeader();
            if (remainingLmsPlayers() <= 1) {
                finishMatch(attacker ? attacker.id : '');
                return { suppressDefaultRespawn: true };
            }
            if (!selfState.alive) {
                return { suppressDefaultRespawn: true };
            }
            pendingSelfRespawnAt = nowMs() + lmsRules.respawnDelayMs;
            if (RT.GamePlayer && RT.GamePlayer.setAliveVisual) RT.GamePlayer.setAliveVisual(false);
            if (RT.GamePlayer && RT.GamePlayer.setStatusState) RT.GamePlayer.setStatusState({ stunUntil: pendingSelfRespawnAt });
            if (RT.GamePlayer && RT.GamePlayer.setActionRestrictions) {
                RT.GamePlayer.setActionRestrictions({
                    weaponUntil: pendingSelfRespawnAt,
                    throwableUntil: pendingSelfRespawnAt,
                    abilityUntil: pendingSelfRespawnAt
                });
            }
            return { useManagedRespawn: true };
        }
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

    GameLocalMatch.tick = function (dt) {
        if (!active || !matchState) return;
        if (matchState.ended) {
            if (resetAt && nowMs() >= resetAt) resetRound();
            return;
        }
        if (modeId === 'lms') {
            if (nowMs() >= nextBeaconRotateAt) rotateBeacon();
            syncLmsState();
            if (matchState.lms && matchState.lms.bankingEnabled) {
                var beacon = currentBeacon();
                if (beacon) {
                    var banked = false;
                    participants.forEach(function (entry) {
                        if (banked) return;
                        var pos = null;
                        if (entry.id === SELF_ID && selfState && selfState.alive && RT.GamePlayer && RT.GamePlayer.getPosition) {
                            pos = RT.GamePlayer.getPosition();
                        } else if (enemyById.has(entry.id)) {
                            var enemy = enemyById.get(entry.id);
                            pos = enemy && enemy.group ? enemy.group.position : null;
                        }
                        if (!pos || !entry.alive || entry.lmsLives >= lmsRules.startingLives || entry.lmsCharge < lmsRules.chargePerExtraLife) {
                            entry.lmsBankState = null;
                            return;
                        }
                        var dx = Number(pos.x || 0) - beacon.x;
                        var dz = Number(pos.z || 0) - beacon.z;
                        var inRange = Math.sqrt((dx * dx) + (dz * dz)) <= lmsRules.beaconBankRadius;
                        if (!inRange) {
                            entry.lmsBankState = null;
                            return;
                        }
                        if (!entry.lmsBankState || entry.lmsBankState.beaconId !== beacon.id) {
                            entry.lmsBankState = { beaconId: beacon.id, startedAt: nowMs(), endsAt: nowMs() + lmsRules.beaconChannelMs };
                            return;
                        }
                        if (nowMs() >= Number(entry.lmsBankState.endsAt || 0)) {
                            entry.lmsCharge = Math.max(0, entry.lmsCharge - lmsRules.chargePerExtraLife);
                            entry.lmsLives = Math.min(
                                Math.max(1, Number(matchState && matchState.lms && matchState.lms.maxLives || lmsRules.maxLives || lmsRules.startingLives || 1)),
                                entry.lmsLives + 1
                            );
                            entry.lmsBankState = null;
                            rotateBeacon();
                            banked = true;
                        }
                    });
                }
            }
            updateLeader();
        }
        if (pendingSelfRespawnAt && nowMs() >= pendingSelfRespawnAt) {
            pendingSelfRespawnAt = 0;
            selfState.alive = true;
            if (RT.GamePlayer && RT.GamePlayer.setAliveVisual) RT.GamePlayer.setAliveVisual(true);
            if (RT.GamePlayer && RT.GamePlayer.setStatusState) RT.GamePlayer.setStatusState({ stunUntil: 0, spawnShieldUntil: nowMs() + 1000 });
            if (RT.GamePlayer && RT.GamePlayer.setActionRestrictions) RT.GamePlayer.setActionRestrictions({ weaponUntil: 0, throwableUntil: 0, abilityUntil: 0 });
            if (RT.GamePlayerCombat && RT.GamePlayerCombat.respawn) RT.GamePlayerCombat.respawn();
        }
    };

    RT.GameLocalMatch = GameLocalMatch;
})();
