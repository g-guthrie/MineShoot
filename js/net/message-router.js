/**
 * message-router.js - Applies inbound websocket messages to GameNet state.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameNetMessageRouter
 */
(function () {
    'use strict';

    function defaultMsgTypes() {
        return {
            WELCOME: 'welcome',
            SNAPSHOT: 'snapshot',
            THROW_SPAWN: 'throw_spawn',
            THROW_REJECT: 'throw_reject',
            THROW_IMPACT: 'throw_impact',
            THROW_EXPLODE: 'throw_explode',
            AOE_END: 'aoe_end',
            DAMAGE_EVENT: 'damage_event',
            DEATH_RESPAWN: 'death_respawn',
            ABILITY_EVENT: 'ability_event',
            CLASS_CAST_OK: 'class_cast_ok',
            CLASS_CAST_REJECT: 'class_cast_reject',
            CLASS_CHANGED: 'class_changed',
            ERROR: 'error',
            PONG: 'pong'
        };
    }

    function pushBounded(queue, item, max) {
        queue.push(item);
        if (queue.length > max) queue.shift();
    }

    function handleWelcome(msg, opts) {
        opts.setConnected(true);
        opts.setSelfId(msg.selfId || opts.getSelfId());
        opts.setRoomId(opts.sanitizeRoomId(msg.roomId || opts.getRoomId() || 'global'));
        opts.setGameMode(String(msg.gameMode || opts.getGameMode() || '').toLowerCase());
        opts.setPrivateRoomPhase(String(msg.privateRoomPhase || opts.getPrivateRoomPhase() || '').toLowerCase());
        opts.setMatchState((msg.matchState && typeof msg.matchState === 'object') ? msg.matchState : null);
        opts.setPendingRespawnInfo(null);
        if (opts.setInputSendInterval) {
            var tickRate = Math.round(Number(msg.tickRate || 0));
            if (isFinite(tickRate) && tickRate >= 10 && tickRate <= 120) {
                opts.setInputSendInterval(1 / tickRate);
            }
        }

        var expectedMeta = opts.buildExpectedWorldMeta(opts.getRoomId());
        var nextMeta = {
            roomId: opts.getRoomId(),
            worldSeed: (typeof msg.worldSeed === 'string' && msg.worldSeed.trim()) ? msg.worldSeed.trim() : expectedMeta.worldSeed,
            worldProfileVersion: Math.max(1, Math.round(Number(msg.worldProfileVersion) || expectedMeta.worldProfileVersion)),
            worldFlags: opts.cloneWorldFlags((msg.worldFlags && typeof msg.worldFlags === 'object') ? msg.worldFlags : expectedMeta.worldFlags)
        };
        opts.setWorldMeta(nextMeta);

        if (!msg.worldSeed) {
            opts.pushNotice('Server world metadata missing; using local fallback profile.');
        } else if (
            expectedMeta.worldSeed !== nextMeta.worldSeed ||
            expectedMeta.worldProfileVersion !== nextMeta.worldProfileVersion ||
            expectedMeta.worldFlags.envV2 !== nextMeta.worldFlags.envV2 ||
            expectedMeta.worldFlags.terrainPhysicsV2 !== nextMeta.worldFlags.terrainPhysicsV2
        ) {
            opts.pushNotice('Server world profile differs from local defaults.');
        }

        if (!opts.getWorldMismatchNotified() && opts.getActiveWorldMeta) {
            var activeWorldMeta = opts.getActiveWorldMeta();
            if (
                activeWorldMeta &&
                activeWorldMeta.worldSeed &&
                (
                    String(activeWorldMeta.worldSeed) !== nextMeta.worldSeed ||
                    Number(activeWorldMeta.worldProfileVersion || 0) !== nextMeta.worldProfileVersion
                )
            ) {
                opts.setWorldMismatchNotified(true);
                opts.pushNotice('World metadata mismatch with active scene. Rejoin room to resync.');
            }
        }

        opts.pushNotice('Joined room ' + opts.getRoomId());
        opts.flushPendingWeaponLoadout();
        if (opts.resolveJoinOnWelcome) {
            opts.resolveJoinOnWelcome({
                roomId: opts.getRoomId(),
                selfId: opts.getSelfId()
            });
        }
    }

    function handleDamageEvent(msg, opts) {
        var selfState = opts.getSelfState();
        var selfId = opts.getSelfId();
        if (selfState && msg.targetId === selfId) {
            if (typeof msg.health === 'number') selfState.hp = msg.health;
            if (typeof msg.armor === 'number') selfState.armor = msg.armor;
            if (msg.killed) selfState.alive = false;
            pushBounded(opts.incomingDamageFeedbackQueue, {
                sourcePos: opts.damagePointForEntityId(msg.sourceId || ''),
                damage: Math.max(0, Number(msg.damage || 0)),
                hitType: msg.hitType === 'head' ? 'head' : 'body'
            }, 32);
        }

        if (msg.targetId && msg.targetId !== selfId) {
            var targetRender = opts.getRenderMap().get(msg.targetId);
            if (targetRender) {
                if (typeof msg.health === 'number') targetRender.hp = msg.health;
                if (typeof msg.armor === 'number') targetRender.armor = msg.armor;
                if (msg.killed) targetRender.alive = false;
            }
        }

        if (msg.sourceId === selfId) {
            pushBounded(opts.damageFeedbackQueue, {
                targetId: msg.targetId || '',
                damage: Math.max(0, Number(msg.damage || 0)),
                hitType: msg.hitType === 'head' ? 'head' : 'body',
                weaponId: msg.weaponId || '',
                shotToken: msg.shotToken || '',
                pelletIndex: Number.isFinite(Number(msg.pelletIndex)) ? Math.max(0, Math.floor(Number(msg.pelletIndex))) : null,
                killed: !!msg.killed,
                worldPos: opts.damagePointForEntityId(msg.targetId || '')
            }, 48);
        }
    }

    function handleDeathRespawn(msg, opts) {
        if (msg.entityId !== opts.getSelfId()) return;
        var respawnAt = Math.max(Date.now(), Number(msg.respawnAt || 0));
        opts.setPendingRespawnInfo({
            active: true,
            respawnAt: respawnAt
        });
        if (typeof msg.x === 'number' && typeof msg.z === 'number') {
            opts.setPendingSpawnSync({
                x: Number(msg.x || 0),
                z: Number(msg.z || 0),
                executeAt: respawnAt,
                kind: 'respawn'
            });
        } else {
            opts.setPendingSpawnSync(null);
        }
        var selfState = opts.getSelfState();
        if (selfState) selfState.alive = false;
    }

    function handleClassChanged(msg, opts) {
        opts.pushNotice('Ability loadout synced.');
        var selfState = opts.getSelfState();
        if (selfState) {
            selfState.classId = msg.classId || selfState.classId;
            if (msg.abilityLoadout) {
                selfState.abilityLoadout = {
                    slot1: String(msg.abilityLoadout.slot1 || ''),
                    slot2: String(msg.abilityLoadout.slot2 || '')
                };
            }
            selfState.slot1CooldownRemaining = 0;
            selfState.slot2CooldownRemaining = 0;
            selfState.abilityCooldownRemaining = 0;
            selfState.ultimateCooldownRemaining = 0;
        }
        if (msg.abilityLoadout && opts.runtime && opts.runtime.GameAbilities && opts.runtime.GameAbilities.setLoadout) {
            opts.runtime.GameAbilities.setLoadout(msg.abilityLoadout.slot1, msg.abilityLoadout.slot2);
        }
    }

    function create(opts) {
        opts = opts || {};
        var msgTypes = opts.msgTypes || defaultMsgTypes();

        function handleMessage(raw) {
            var msg = null;
            try {
                msg = JSON.parse(raw);
            } catch (_err) {
                return;
            }
            if (!msg || !msg.t) return;

            if (msg.t === (msgTypes.WELCOME || 'welcome')) {
                handleWelcome(msg, opts);
                return;
            }

            if (msg.t === (msgTypes.SNAPSHOT || 'snapshot')) {
                opts.setGameMode(String(msg.gameMode || opts.getGameMode() || '').toLowerCase());
                opts.setPrivateRoomPhase(String(msg.privateRoomPhase || opts.getPrivateRoomPhase() || '').toLowerCase());
                opts.setMatchState((msg.matchState && typeof msg.matchState === 'object') ? msg.matchState : opts.getMatchState());
                var hasProjectiles = Object.prototype.hasOwnProperty.call(msg, 'projectiles');
                var hasFireZones = Object.prototype.hasOwnProperty.call(msg, 'fireZones');
                opts.applySnapshot(msg.entities || [], hasProjectiles ? (msg.projectiles || []) : undefined, hasFireZones ? (msg.fireZones || []) : undefined, {
                    delta: !!msg.delta,
                    removedEntityIds: msg.removedEntityIds || [],
                    serverTime: Number(msg.serverTime || 0),
                    receivedAt: Date.now()
                });
                return;
            }

            if (msg.t === (msgTypes.THROW_SPAWN || 'throw_spawn')) {
                pushBounded(opts.throwAckQueue, {
                    projectileId: msg.projectileId || '',
                    ownerId: msg.ownerId || '',
                    clientThrowId: msg.clientThrowId || '',
                    throwableId: msg.throwableId || ''
                }, 32);
                return;
            }

            if (msg.t === (msgTypes.THROW_REJECT || 'throw_reject')) {
                pushBounded(opts.throwRejectQueue, {
                    throwableId: msg.throwableId || '',
                    clientThrowId: msg.clientThrowId || '',
                    reason: msg.reason || 'rejected'
                }, 32);
                return;
            }

            if (
                msg.t === (msgTypes.THROW_IMPACT || 'throw_impact') ||
                msg.t === (msgTypes.THROW_EXPLODE || 'throw_explode') ||
                msg.t === (msgTypes.AOE_END || 'aoe_end')
            ) {
                pushBounded(opts.throwableEventQueue, msg, 64);
                return;
            }

            if (msg.t === (msgTypes.DAMAGE_EVENT || 'damage_event')) {
                handleDamageEvent(msg, opts);
                return;
            }

            if (msg.t === (msgTypes.DEATH_RESPAWN || 'death_respawn')) {
                handleDeathRespawn(msg, opts);
                return;
            }

            if (msg.t === (msgTypes.ABILITY_EVENT || 'ability_event')) {
                pushBounded(opts.abilityEventQueue, msg, 32);
                return;
            }

            if (
                msg.t === (msgTypes.CLASS_CAST_OK || 'class_cast_ok') ||
                msg.t === (msgTypes.CLASS_CAST_REJECT || 'class_cast_reject')
            ) {
                pushBounded(opts.classCastResultQueue, msg, 16);
                return;
            }

            if (msg.t === (msgTypes.CLASS_CHANGED || 'class_changed')) {
                handleClassChanged(msg, opts);
                return;
            }

            if (msg.t === (msgTypes.ERROR || 'error')) {
                opts.pushNotice(msg.message || 'Server error');
                return;
            }

            if (msg.t === (msgTypes.PONG || 'pong')) {
                if (opts.handlePong) {
                    opts.handlePong(msg, Date.now());
                }
            }
        }

        return {
            handleMessage: handleMessage
        };
    }

    globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    globalThis.__MAYHEM_RUNTIME.GameNetMessageRouter = {
        create: create
    };
})();
