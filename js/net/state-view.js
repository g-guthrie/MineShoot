/**
 * state-view.js - Read-only selectors and queue consumers for GameNet.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameNetStateView
 */
(function () {
    'use strict';

    function shiftQueue(queue) {
        if (!queue || !queue.length) return null;
        return queue.shift();
    }

    function create(opts) {
        opts = opts || {};

        function getExpectedWorldMeta() {
            var expected = opts.buildExpectedWorldMeta(opts.getRoomId());
            return {
                roomId: expected.roomId,
                worldSeed: expected.worldSeed,
                worldProfileVersion: expected.worldProfileVersion,
                worldFlags: opts.cloneWorldFlags(expected.worldFlags)
            };
        }

        function getWorldMeta() {
            var worldMeta = opts.getWorldMeta();
            if (!worldMeta) return null;
            return {
                roomId: worldMeta.roomId,
                worldSeed: worldMeta.worldSeed,
                worldProfileVersion: worldMeta.worldProfileVersion,
                worldFlags: opts.cloneWorldFlags(worldMeta.worldFlags)
            };
        }

        function getEntityStateList() {
            var out = [];
            opts.getRenderMap().forEach(function (r) {
                out.push({
                    id: r.id,
                    kind: r.kind,
                    username: r.username,
                    classId: r.classId,
                    hp: r.hp,
                    hpMax: r.hpMax,
                    armor: r.armor,
                    armorMax: r.armorMax,
                    alive: r.alive,
                    worldPos: r.group.position,
                    headY: 2.45,
                    targetId: 'net:' + r.id,
                    healState: r.healState || null
                });
            });
            return out;
        }

        function getSelfState() {
            var selfState = opts.getSelfState();
            if (selfState) return selfState;
            var user = opts.getCurrentUser();
            if (!user) return null;
            var defaults = opts.classStats(user.classId || 'abilities');
            return {
                id: user.id,
                hp: 500,
                hpMax: 500,
                armor: defaults.armorMax,
                armorMax: defaults.armorMax,
                classId: user.classId || 'abilities',
                wallhackRadius: defaults.wallhackRadius,
                lmsLives: 0,
                lmsCharge: 0,
                outOfRound: false,
                throwables: null,
                kills: 0,
                deaths: 0,
                progressScore: 0,
                teamId: '',
                alive: true
            };
        }

        function getAuthoritativeThrowableState() {
            var selfState = opts.getSelfState();
            return {
                projectiles: opts.getRemoteProjectileState().slice(),
                fireZones: opts.getRemoteFireZoneState().slice(),
                selfThrowables: (selfState && selfState.throwables) ? selfState.throwables : null
            };
        }

        function getSelfAbilityState() {
            var selfState = opts.getSelfState();
            if (!selfState) return null;
            var abilityFxView = globalThis.__MAYHEM_RUNTIME.GameAbilityFx;
            var snapshotAbilityState = abilityFxView && abilityFxView.buildSnapshotAbilityState
                ? abilityFxView.buildSnapshotAbilityState(selfState)
                : {
                    chokeState: null,
                    hookState: null,
                    healState: null
                };
            return {
                slot1CooldownRemaining: selfState.slot1CooldownRemaining || 0,
                slot2CooldownRemaining: selfState.slot2CooldownRemaining || 0,
                abilityCooldownRemaining: selfState.abilityCooldownRemaining || 0,
                ultimateCooldownRemaining: selfState.ultimateCooldownRemaining || 0,
                weaponLoadout: selfState.weaponLoadout || null,
                abilityLoadout: selfState.abilityLoadout || null,
                chokeState: snapshotAbilityState.chokeState,
                hookState: snapshotAbilityState.hookState,
                healState: snapshotAbilityState.healState,
                deadeyeState: selfState.deadeyeState || null
            };
        }

        function getMatchState() {
            var matchState = opts.getMatchState();
            return matchState ? JSON.parse(JSON.stringify(matchState)) : null;
        }

        function getInputSyncState() {
            var inputSeqHistory = opts.getInputSeqHistory();
            var latestPending = inputSeqHistory.length > 0 ? inputSeqHistory[inputSeqHistory.length - 1] : null;
            return {
                lastSentSeq: opts.getLastInputSeqSent(),
                lastAckedSeq: opts.getLastInputSeqAcked(),
                pendingInputCount: inputSeqHistory.length,
                latestPendingAgeMs: latestPending ? Math.max(0, Date.now() - Number(latestPending.at || 0)) : 0
            };
        }

        function getPendingInputSamples() {
            var inputSeqHistory = opts.getInputSeqHistory();
            if (!inputSeqHistory.length) return [];
            var out = [];
            for (var i = 0; i < inputSeqHistory.length; i++) {
                var entry = inputSeqHistory[i];
                if (!entry) continue;
                out.push({
                    seq: Number(entry.seq || 0),
                    at: Number(entry.at || 0),
                    dtMs: Math.max(1, Number(entry.dtMs || Math.round(opts.getInputSendInterval() * 1000))),
                    yaw: Number(entry.yaw || 0),
                    pitch: Number(entry.pitch || 0),
                    inputState: entry.inputState ? {
                        forward: !!entry.inputState.forward,
                        backward: !!entry.inputState.backward,
                        left: !!entry.inputState.left,
                        right: !!entry.inputState.right,
                        jump: !!entry.inputState.jump,
                        sprint: !!entry.inputState.sprint,
                        adsActive: !!entry.inputState.adsActive
                    } : null
                });
            }
            return out;
        }

        function getRespawnState() {
            var pendingRespawnInfo = opts.getPendingRespawnInfo();
            if (!pendingRespawnInfo || !pendingRespawnInfo.active) return null;
            return {
                active: true,
                respawnAt: Number(pendingRespawnInfo.respawnAt || 0),
                remainingMs: Math.max(0, Number(pendingRespawnInfo.respawnAt || 0) - Date.now())
            };
        }

        function getEntityName(entityId) {
            var id = String(entityId || '');
            var selfState = opts.getSelfState();
            if (!id) return '';
            if (selfState && id === opts.getSelfId()) return String(selfState.username || selfState.id || '');
            var snapshotEntity = opts.getSnapshotMap().get(id);
            if (snapshotEntity) return String(snapshotEntity.username || snapshotEntity.id || '');
            var render = opts.getRenderMap().get(id);
            return render ? String(render.username || render.id || '') : '';
        }

        function getLockTargets() {
            var out = [];
            opts.getRenderMap().forEach(function (r) {
                if (!r || !r.alive) return;
                var worldPos = opts.getRenderCoreWorldPosition(r, new THREE.Vector3());
                if (!worldPos) return;
                out.push({
                    targetId: 'net:' + r.id,
                    ownerType: 'net',
                    worldPos: worldPos,
                    hitbox: r.bodyHitbox || null,
                    bodyHitbox: r.bodyHitbox || null,
                    headHitbox: r.headHitbox || null,
                    alive: true,
                    netEntityId: r.id
                });
            });
            return out;
        }

        return {
            getExpectedWorldMeta: getExpectedWorldMeta,
            getWorldMeta: getWorldMeta,
            getEntityStateList: getEntityStateList,
            getSelfState: getSelfState,
            getAuthoritativeThrowableState: getAuthoritativeThrowableState,
            getSelfAbilityState: getSelfAbilityState,
            getMatchState: getMatchState,
            getInputSyncState: getInputSyncState,
            getPendingInputSamples: getPendingInputSamples,
            getRespawnState: getRespawnState,
            getGameMode: function () { return opts.getGameMode() || ''; },
            getPrivateRoomPhase: function () { return opts.getPrivateRoomPhase() || ''; },
            getEntityName: getEntityName,
            getLockTargets: getLockTargets,
            getEntityMarkerWorldPos: function (entityId) { return opts.markerPointForEntityId(entityId); },
            getChokeVictimStateForEntity: function (entityId) { return opts.getChokeVictimStateForEntity(entityId); },
            consumeNotice: function () { return opts.consumeNotice(); },
            consumeThrowAck: function () { return shiftQueue(opts.throwAckQueue); },
            consumeThrowReject: function () { return shiftQueue(opts.throwRejectQueue); },
            consumeThrowableEvent: function () { return shiftQueue(opts.throwableEventQueue); },
            consumeAbilityEvent: function () { return shiftQueue(opts.abilityEventQueue); },
            consumeClassCastResult: function () { return shiftQueue(opts.classCastResultQueue); },
            consumeDamageFeedback: function () { return shiftQueue(opts.damageFeedbackQueue); },
            consumeIncomingDamageFeedback: function () { return shiftQueue(opts.incomingDamageFeedbackQueue); }
        };
    }

    globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    globalThis.__MAYHEM_RUNTIME.GameNetStateView = {
        create: create
    };
})();
