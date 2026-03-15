/**
 * remote-entities.js - Remote player/bot visual & hitbox management
 * Extracted from network.js. Loaded as: globalThis.__MAYHEM_RUNTIME.GameNetEntities
 */
(function () {
    'use strict';

    var GameNetEntities = {};

    var sceneRef = null;
    var renderMap = new Map();
    var hitboxArray = [];
    var hitboxVisible = true;
    var entityConstants = (globalThis.__MAYHEM_RUNTIME.GameShared && globalThis.__MAYHEM_RUNTIME.GameShared.entityConstants) || {};
    var REMOTE_EYE_HEIGHT = Number(entityConstants.EYE_HEIGHT || 1.6);
    var DEFAULT_SNAPSHOT_INTERVAL_MS = 1000 / 60;
    var DEFAULT_INTERPOLATION_DELAY_MS = 78;
    var MAX_SNAPSHOT_HISTORY = 20;

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function remoteInterpolationTuning() {
        var shared = globalThis.__MAYHEM_RUNTIME.GameShared || {};
        var network = shared.gameplayTuning && shared.gameplayTuning.network
            ? shared.gameplayTuning.network
            : null;
        return network && network.remoteInterpolation ? network.remoteInterpolation : {};
    }

    function snapshotFootY(entity) {
        return ((typeof entity.y === 'number' ? entity.y : REMOTE_EYE_HEIGHT) - REMOTE_EYE_HEIGHT);
    }

    function appendSnapshotHistory(render, entity, snapshotMeta) {
        if (!render || !entity) return;
        var receivedAt = Math.max(0, Number(snapshotMeta && snapshotMeta.receivedAt || Date.now()));
        var serverTime = Number(snapshotMeta && snapshotMeta.serverTime);
        if (!isFinite(serverTime) || serverTime <= 0) serverTime = receivedAt;

        var sample = {
            serverTime: serverTime,
            receivedAt: receivedAt,
            x: Number(entity.x || 0),
            footY: snapshotFootY(entity),
            z: Number(entity.z || 0),
            yaw: Number(entity.yaw || 0),
            pitch: Number(entity.pitch || 0)
        };
        var interpolationTuning = remoteInterpolationTuning();
        var maxSnapshotHistory = Math.max(8, Math.round(Number(interpolationTuning.historySize || MAX_SNAPSHOT_HISTORY)));
        var history = Array.isArray(render.snapshotHistory) ? render.snapshotHistory.slice() : [];
        var previous = history.length > 0 ? history[history.length - 1] : null;
        if (previous && Math.abs(Number(previous.serverTime || 0) - serverTime) < 0.001) {
            history[history.length - 1] = sample;
        } else {
            history.push(sample);
            if (history.length > maxSnapshotHistory) history.shift();
        }
        render.snapshotHistory = history;
        var measuredOffsetMs = receivedAt - serverTime;
        var offsetSnapDeltaMs = Math.max(60, Number(interpolationTuning.serverOffsetSnapDeltaMs || 150));
        var offsetLerpAlpha = clamp(Number(interpolationTuning.offsetLerpAlpha || 0.08), 0.01, 1);
        if (!isFinite(Number(render.serverTimeOffsetMs))) {
            render.serverTimeOffsetMs = measuredOffsetMs;
        } else if (Math.abs(measuredOffsetMs - Number(render.serverTimeOffsetMs || 0)) > offsetSnapDeltaMs) {
            render.serverTimeOffsetMs = measuredOffsetMs;
        } else {
            render.serverTimeOffsetMs += (measuredOffsetMs - render.serverTimeOffsetMs) * offsetLerpAlpha;
        }

        if (previous && serverTime > Number(previous.serverTime || 0)) {
            var nextIntervalMs = clamp(serverTime - Number(previous.serverTime || 0), 16, 140);
            var priorIntervalMs = clamp(Number(render.snapshotIntervalMs || DEFAULT_SNAPSHOT_INTERVAL_MS), 16, 140);
            var priorStepMs = clamp(Number(render.lastSnapshotStepMs || priorIntervalMs), 16, 140);
            render.lastSnapshotStepMs = nextIntervalMs;
            render.snapshotIntervalMs = (priorIntervalMs * 0.7) + (nextIntervalMs * 0.3);
            var jitterSampleMs = Math.abs(nextIntervalMs - priorStepMs);
            var priorJitterMs = clamp(Number(render.snapshotJitterMs || 0), 0, 120);
            render.snapshotJitterMs = (priorJitterMs * 0.65) + (clamp(jitterSampleMs, 0, 120) * 0.35);
        } else if (!render.snapshotIntervalMs) {
            render.snapshotIntervalMs = DEFAULT_SNAPSHOT_INTERVAL_MS;
            render.lastSnapshotStepMs = DEFAULT_SNAPSHOT_INTERVAL_MS;
            render.snapshotJitterMs = 0;
        }

        var intervalMs = clamp(Number(render.snapshotIntervalMs || DEFAULT_SNAPSHOT_INTERVAL_MS), 16, 140);
        var jitterMs = clamp(Number(render.snapshotJitterMs || 0), 0, 120);
        var minDelayMs = Math.max(32, Number(interpolationTuning.minDelayMs || 95));
        var maxDelayMs = Math.max(minDelayMs, Number(interpolationTuning.maxDelayMs || 260));
        var targetDelayMs = clamp(
            (intervalMs * Number(interpolationTuning.intervalDelayScale || 2.6)) +
            (jitterMs * Number(interpolationTuning.jitterDelayScale || 2.1)),
            minDelayMs,
            maxDelayMs
        );
        var priorDelayMs = clamp(
            Number(render.interpolationDelayMs || targetDelayMs),
            minDelayMs,
            maxDelayMs
        );
        render.interpolationDelayMs = (priorDelayMs * 0.6) + (targetDelayMs * 0.4);
        render.maxExtrapolationMs = clamp(
            (intervalMs * Number(interpolationTuning.maxExtrapolationIntervalScale || 0.45)) +
            (jitterMs * Number(interpolationTuning.maxExtrapolationJitterScale || 0.65)),
            Math.max(1, Number(interpolationTuning.maxExtrapolationMinMs || 20)),
            Math.max(1, Number(interpolationTuning.maxExtrapolationMaxMs || 72))
        );
        render.freezeGapMs = clamp(
            (intervalMs * Number(interpolationTuning.freezeGapIntervalScale || 1.85)) +
            (jitterMs * Number(interpolationTuning.freezeGapJitterScale || 2.5)),
            Math.max(1, Number(interpolationTuning.freezeGapMinMs || 90)),
            Math.max(1, Number(interpolationTuning.freezeGapMaxMs || 240))
        );
        if (!render.interpolationDelayMs) {
            render.interpolationDelayMs = Math.max(
                1,
                Number(interpolationTuning.defaultDelayMs || DEFAULT_INTERPOLATION_DELAY_MS)
            );
        }
    }

    function classWallhackRadiusFor(classId) {
        if (globalThis.__MAYHEM_RUNTIME.GameCombatTuning && globalThis.__MAYHEM_RUNTIME.GameCombatTuning.getClassWallhackRadius) {
            return globalThis.__MAYHEM_RUNTIME.GameCombatTuning.getClassWallhackRadius(classId);
        }
        return 90;
    }

    function sharedClassPreset(classId) {
        var shared = (globalThis.__MAYHEM_RUNTIME.GameShared && globalThis.__MAYHEM_RUNTIME.GameShared.gameplayTuning) || {};
        var presets = shared.classPresets || {};
        return presets[classId] || presets.abilities || null;
    }

    function classStats(classId) {
        var preset = sharedClassPreset(classId);
        return {
            armorMax: preset && Number(preset.armorMax || 0) > 0 ? Number(preset.armorMax) : 90,
            wallhackRadius: preset && Number(preset.wallhackRadius || 0) > 0
                ? Number(preset.wallhackRadius)
                : classWallhackRadiusFor(classId)
        };
    }

    function createRemoteVisual(entity, snapshotMeta) {
        var color = entity.kind === 'bot' ? 0x8f5a2d : 0x3772c4;
        var actorFactory = globalThis.__MAYHEM_RUNTIME.GameActorVisualFactory || null;
        if (!actorFactory || !actorFactory.create) {
            throw new Error('GameNetEntities requires GameActorVisualFactory.create.');
        }
        var actorVisual = actorFactory.create({
            ownerType: 'net',
            bodyColor: color,
            skinColor: 0xd2a77d,
            legColor: entity.kind === 'bot' ? 0x4a3420 : 0x2d2d2d,
            weaponId: entity.weaponId || 'rifle',
            targetId: 'net:' + entity.id,
            netEntityId: entity.id,
            hitboxOpacity: hitboxVisible ? 0.3 : 0,
            includeRevealGhost: true
        });
        var group = actorVisual.root || actorVisual.visual;
        var rigApi = actorVisual.rigApi;
        var bodyHitbox = actorVisual.bodyHitbox;
        var headHitbox = actorVisual.headHitbox;
        if (bodyHitbox && bodyHitbox.userData) bodyHitbox.userData.netEntityId = entity.id;
        if (headHitbox && headHitbox.userData) headHitbox.userData.netEntityId = entity.id;
        if (bodyHitbox) sceneRef.add(bodyHitbox);
        if (headHitbox) sceneRef.add(headHitbox);
        if (actorVisual.setWorldTransform) {
            actorVisual.setWorldTransform({
                x: entity.x,
                y: snapshotFootY(entity),
                z: entity.z
            }, (entity.yaw || 0));
        } else {
            group.position.set(
                entity.x,
                snapshotFootY(entity),
                entity.z
            );
            group.rotation.y = (entity.yaw || 0);
        }

        sceneRef.add(group);
        if (bodyHitbox) hitboxArray.push(bodyHitbox);
        if (headHitbox) hitboxArray.push(headHitbox);
        var abilityFxView = globalThis.__MAYHEM_RUNTIME.GameAbilityFx;
        var snapshotAbilityState = abilityFxView && abilityFxView.buildSnapshotAbilityState
            ? abilityFxView.buildSnapshotAbilityState(entity)
            : {
                chokeVictimState: null,
                hookedStartedAt: 0,
                hookedUntil: 0,
                hookState: null,
                chokeState: null,
                healState: null
            };

        var render = {
            id: entity.id,
            kind: entity.kind,
            group: group,
            bodyHitbox: bodyHitbox,
            headHitbox: headHitbox,
            actorVisual: actorVisual,
            rigApi: rigApi,
            targetX: entity.x,
            targetY: entity.y || 1.6,
            targetFootY: snapshotFootY(entity),
            targetZ: entity.z,
            targetYaw: (entity.yaw || 0),
            targetPitch: entity.pitch || 0,
            snapshotHistory: [],
            snapshotIntervalMs: DEFAULT_SNAPSHOT_INTERVAL_MS,
            lastSnapshotStepMs: DEFAULT_SNAPSHOT_INTERVAL_MS,
            snapshotJitterMs: 0,
            interpolationDelayMs: DEFAULT_INTERPOLATION_DELAY_MS,
            maxExtrapolationMs: 32,
            freezeGapMs: 96,
            serverTimeOffsetMs: NaN,
            hp: entity.hp,
            hpMax: entity.hpMax,
            armor: entity.armor,
            armorMax: entity.armorMax,
            classId: entity.classId,
            username: entity.username,
            alive: entity.alive,
            spawnShieldUntil: entity.spawnShieldUntil || 0,
            wallhackRadius: entity.wallhackRadius || classStats(entity.classId).wallhackRadius,
            moveSpeedNorm: entity.moveSpeedNorm || 0,
            sprinting: !!entity.sprinting,
            movingForward: !!entity.movingForward,
            movingBackward: !!entity.movingBackward,
            isGrounded: entity.isGrounded !== false,
            velocityY: Number(entity.velocityY || 0),
            _prevIsGrounded: entity.isGrounded !== false,
            weaponId: entity.weaponId || 'rifle',
            _appliedWeaponId: entity.weaponId || 'rifle',
            muzzleFlashUntil: entity.muzzleFlashUntil || 0,
            chokeVictimState: snapshotAbilityState.chokeVictimState,
            deadeyeMark: null,
            hookedStartedAt: snapshotAbilityState.hookedStartedAt,
            hookedUntil: snapshotAbilityState.hookedUntil,
            streamHeat: entity.streamHeat || 0,
            streamOverheatedUntil: entity.streamOverheatedUntil || 0,
            hookState: snapshotAbilityState.hookState,
            chokeState: snapshotAbilityState.chokeState,
            healState: snapshotAbilityState.healState
        };
        appendSnapshotHistory(render, entity, snapshotMeta);
        return render;
    }

    GameNetEntities.init = function (scene) {
        sceneRef = scene;
    };

    GameNetEntities.ensureRemote = function (entity, snapshotMeta) {
        if (!renderMap.has(entity.id)) {
            renderMap.set(entity.id, createRemoteVisual(entity, snapshotMeta));
        }
        return renderMap.get(entity.id);
    };

    GameNetEntities.removeRemoteVisual = function (id) {
        var r = renderMap.get(id);
        if (!r) return;

        if (r.actorVisual && r.actorVisual.destroy) {
            r.actorVisual.destroy();
        } else if (r.group && r.group.parent) {
            r.group.parent.remove(r.group);
        }

        var next = [];
        for (var i = 0; i < hitboxArray.length; i++) {
            var hb = hitboxArray[i];
            if (hb !== r.bodyHitbox && hb !== r.headHitbox) next.push(hb);
        }
        hitboxArray = next;

        renderMap.delete(id);
    };

    GameNetEntities.updateFromSnapshot = function (entity, snapshotMeta) {
        if (!sceneRef) return;
        var r = GameNetEntities.ensureRemote(entity, snapshotMeta);
        if (!r || !r.group) return;
        r.targetX = entity.x;
        r.targetY = entity.y || 1.6;
        r.targetFootY = snapshotFootY(entity);
        r.targetZ = entity.z;
        r.targetYaw = (entity.yaw || 0);
        r.targetPitch = entity.pitch || 0;
        appendSnapshotHistory(r, entity, snapshotMeta);
        r.hp = entity.hp;
        r.hpMax = entity.hpMax;
        r.armor = entity.armor;
        r.armorMax = entity.armorMax;
        r.classId = entity.classId;
        r.username = entity.username;
        r.alive = entity.alive;
        r.spawnShieldUntil = entity.spawnShieldUntil || 0;
        r.wallhackRadius = entity.wallhackRadius || classStats(entity.classId).wallhackRadius;
        r.moveSpeedNorm = entity.moveSpeedNorm || 0;
        r.sprinting = !!entity.sprinting;
        r.movingForward = !!entity.movingForward;
        r.movingBackward = !!entity.movingBackward;
        r.isGrounded = entity.isGrounded !== false;
        r.velocityY = Number(entity.velocityY || 0);
        r.weaponId = entity.weaponId || 'rifle';
        r.streamHeat = entity.streamHeat || 0;
        r.streamOverheatedUntil = entity.streamOverheatedUntil || 0;
        r.muzzleFlashUntil = entity.muzzleFlashUntil || 0;
        var abilityFxView = globalThis.__MAYHEM_RUNTIME.GameAbilityFx;
        var snapshotAbilityState = abilityFxView && abilityFxView.buildSnapshotAbilityState
            ? abilityFxView.buildSnapshotAbilityState(entity)
            : {
                chokeVictimState: null,
                hookedStartedAt: 0,
                hookedUntil: 0,
                hookState: null,
                chokeState: null,
                healState: null
            };
        r.chokeState = snapshotAbilityState.chokeState;
        r.chokeVictimState = snapshotAbilityState.chokeVictimState;
        r.hookedStartedAt = snapshotAbilityState.hookedStartedAt;
        r.hookedUntil = snapshotAbilityState.hookedUntil;
        r.hookState = snapshotAbilityState.hookState;
        r.healState = snapshotAbilityState.healState;
        r.abilityLoadout = entity.abilityLoadout || null;

        r.group.visible = !!entity.alive;
        if (r.actorVisual && r.actorVisual.setAlive) {
            r.actorVisual.setAlive(entity.alive);
            r.actorVisual.setHitboxVisibility(hitboxVisible);
        }
    };

    GameNetEntities.getHitboxArray = function () {
        return hitboxArray;
    };

    GameNetEntities.toggleHitboxVisibility = function () {
        hitboxVisible = !hitboxVisible;
        renderMap.forEach(function (r) {
            if (r.actorVisual && r.actorVisual.setHitboxVisibility) r.actorVisual.setHitboxVisibility(hitboxVisible);
        });
        return hitboxVisible;
    };

    GameNetEntities.setHitboxVisibility = function (visible) {
        hitboxVisible = !!visible;
        renderMap.forEach(function (r) {
            if (r.actorVisual && r.actorVisual.setHitboxVisibility) r.actorVisual.setHitboxVisibility(hitboxVisible);
        });
    };

    GameNetEntities.getRenderMap = function () {
        return renderMap;
    };

    GameNetEntities.getCoreWorldPosition = function (entityId, outVec3) {
        var render = renderMap.get(entityId);
        if (!render || !render.actorVisual || !render.actorVisual.getCoreWorldPosition) return null;
        return render.actorVisual.getCoreWorldPosition(outVec3);
    };

    GameNetEntities.getHookOriginWorldPosition = function (entityId, outVec3) {
        var render = renderMap.get(entityId);
        if (!render || !render.actorVisual) return null;
        if (render.actorVisual.getThrowableOriginWorldPosition) {
            var throwableOrigin = render.actorVisual.getThrowableOriginWorldPosition(outVec3);
            if (throwableOrigin) return throwableOrigin;
        }
        if (render.actorVisual.getCoreWorldPosition) {
            return render.actorVisual.getCoreWorldPosition(outVec3);
        }
        return null;
    };

    GameNetEntities.setDeadeyeHighlights = function (markMap) {
        var marks = markMap || {};
        renderMap.forEach(function (render, entityId) {
            if (!render) return;
            render.deadeyeMark = marks[entityId] || null;
        });
    };

    GameNetEntities.classStats = classStats;

    GameNetEntities.cleanup = function () {
        var ids = [];
        renderMap.forEach(function (_v, id) { ids.push(id); });
        for (var i = 0; i < ids.length; i++) {
            GameNetEntities.removeRemoteVisual(ids[i]);
        }
        renderMap.clear();
        hitboxArray = [];
    };

    globalThis.__MAYHEM_RUNTIME.GameNetEntities = GameNetEntities;
})();
