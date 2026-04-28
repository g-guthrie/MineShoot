/**
 * remote-entities.js - Remote player visual & hitbox management
 * Extracted from network.js. Loaded as: globalThis.__MAYHEM_RUNTIME.GameNetEntities
 */
(function () {
    'use strict';

    var GameNetEntities = {};

    var sceneRef = null;
    var renderMap = new Map();
    var hitboxArray = [];
    var hitboxVisible = false;
    var deps = {};

    function sharedApi() {
        return deps.getSharedApi ? (deps.getSharedApi() || {}) : ((globalThis.__MAYHEM_RUNTIME.GameShared && globalThis.__MAYHEM_RUNTIME.GameShared) || {});
    }

    function actorVisualFactory() {
        return deps.getActorVisualFactory ? (deps.getActorVisualFactory() || null) : (globalThis.__MAYHEM_RUNTIME.GameActorVisualFactory || null);
    }

    var entityConstants = sharedApi().entityConstants || {};
    var REMOTE_EYE_HEIGHT = Number(entityConstants.EYE_HEIGHT || 1.6);
    var DEFAULT_SNAPSHOT_INTERVAL_MS = 1000 / 60;
    var MAX_SNAPSHOT_HISTORY = 20;
    var DEFAULT_TELEPORT_RESET_DISTANCE_WU = 8;

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function remoteInterpolationTuning() {
        var shared = sharedApi();
        var network = shared.getNetworkTuning ? shared.getNetworkTuning() : null;
        return network && network.remoteInterpolation ? network.remoteInterpolation : {};
    }

    function interpolationApi() {
        return (globalThis.__MAYHEM_RUNTIME || {}).GameNetInterpolation || {};
    }

    function defaultInterpolationDelayMs() {
        var interpolationTuning = remoteInterpolationTuning();
        return Math.max(1, Number(interpolationTuning.defaultDelayMs || 1));
    }

    function movementTuning() {
        var shared = sharedApi();
        return shared && shared.getMovementTuning ? (shared.getMovementTuning() || {}) : {};
    }

    function snapshotFootY(entity) {
        return ((typeof entity.y === 'number' ? entity.y : REMOTE_EYE_HEIGHT) - REMOTE_EYE_HEIGHT);
    }

    function snapshotServerTimeMs(snapshotMeta) {
        var receivedAt = Math.max(0, Number(snapshotMeta && snapshotMeta.receivedAt || Date.now()));
        var serverTime = Number(snapshotMeta && snapshotMeta.serverTime);
        return (isFinite(serverTime) && serverTime > 0) ? serverTime : receivedAt;
    }

    function cloneWeaponAmmoStateMap(stateMap) {
        if (!stateMap || typeof stateMap !== 'object') return {};
        var out = {};
        for (var weaponId in stateMap) {
            if (!Object.prototype.hasOwnProperty.call(stateMap, weaponId)) continue;
            var entry = stateMap[weaponId];
            if (!entry) continue;
            out[weaponId] = {
                ammoInMag: Math.max(0, Number(entry.ammoInMag || 0)),
                reloading: !!entry.reloading,
                reloadRemainingMs: Math.max(0, Math.round(Number(entry.reloadRemaining || 0) * 1000)),
                reloadedFlashRemainingMs: Math.max(0, Math.round(Number(entry.reloadedFlashRemaining || 0) * 1000))
            };
        }
        return out;
    }

    function clonePresentationState(state) {
        if (!state) return null;
        var interpModule = interpolationApi();
        if (interpModule && interpModule.cloneTransform) {
            return interpModule.cloneTransform(state);
        }
        return {
            x: Number(state.x || 0),
            footY: Number(state.footY || 0),
            z: Number(state.z || 0),
            yaw: Number(state.yaw || 0),
            pitch: Number(state.pitch || 0),
            moveSpeedNorm: Number(state.moveSpeedNorm || 0),
            sprinting: !!state.sprinting,
            fastBackpedal: !!state.fastBackpedal,
            movingForward: !!state.movingForward,
            movingBackward: !!state.movingBackward,
            movingLeft: !!state.movingLeft,
            movingRight: !!state.movingRight,
            isGrounded: state.isGrounded !== false,
            velocityY: Number(state.velocityY || 0),
            muzzleFlashUntil: Number(state.muzzleFlashUntil || 0)
        };
    }

    function appendSnapshotHistory(render, entity, snapshotMeta) {
        if (!render || !entity) return;
        var receivedAt = Math.max(0, Number(snapshotMeta && snapshotMeta.receivedAt || Date.now()));
        var serverTime = snapshotServerTimeMs(snapshotMeta);

        var sample = {
            serverTime: serverTime,
            receivedAt: receivedAt,
            x: Number(entity.x || 0),
            footY: snapshotFootY(entity),
            z: Number(entity.z || 0),
            yaw: Number(entity.yaw || 0),
            pitch: Number(entity.pitch || 0),
            alive: entity.alive !== false,
            moveSpeedNorm: Number(entity.moveSpeedNorm || 0),
            sprinting: !!entity.sprinting,
            fastBackpedal: !!entity.fastBackpedal,
            movingForward: !!entity.movingForward,
            movingBackward: !!entity.movingBackward,
            movingLeft: !!entity.movingLeft,
            movingRight: !!entity.movingRight,
            isGrounded: entity.isGrounded !== false,
            velocityY: Number(entity.velocityY || 0),
            muzzleFlashUntil: Number(entity.muzzleFlashUntil || 0)
        };
        var interpolationTuning = remoteInterpolationTuning();
        var interpModule = interpolationApi();
        var lossHistoryBonus = Math.max(0, Math.round(
            Number(Number(render.lossDelayPaddingMs || 0) > 0 ? (interpolationTuning.lossHistoryBonus || 10) : 0)
        ));
        var maxSnapshotHistory = Math.max(
            8,
            Math.round(Number(interpolationTuning.historySize || MAX_SNAPSHOT_HISTORY)) + lossHistoryBonus
        );
        var history = Array.isArray(render.snapshotHistory) ? render.snapshotHistory : [];
        var previous = history.length > 0 ? history[history.length - 1] : null;
        var dx = previous ? (Number(previous.x || 0) - sample.x) : 0;
        var dy = previous ? (Number(previous.footY || 0) - sample.footY) : 0;
        var dz = previous ? (Number(previous.z || 0) - sample.z) : 0;
        var movement = movementTuning();
        var maxMoveSpeedWuPerSec = Math.max(0, Number(movement.runSpeed || 14));
        var priorSpeedNorm = previous ? Math.max(0, Number(previous.moveSpeedNorm || 0)) : 0;
        var sampleSpeedNorm = Math.max(0, Number(sample.moveSpeedNorm || 0));
        var speedNorm = Math.max(priorSpeedNorm, sampleSpeedNorm);
        var gapDurationSec = previous
            ? Math.max(0, Number(serverTime - Number(previous.serverTime || serverTime)) / 1000)
            : 0;
        var teleportBaseThresholdWu = Math.max(
            0,
            Number(interpolationTuning.teleportBaseThresholdWu || DEFAULT_TELEPORT_RESET_DISTANCE_WU)
        );
        var teleportSpeedAllowanceScale = Math.max(
            0,
            Number(interpolationTuning.teleportSpeedAllowanceScale || 1.5)
        );
        var teleportResetDistanceWu = teleportBaseThresholdWu + (maxMoveSpeedWuPerSec * speedNorm * gapDurationSec * teleportSpeedAllowanceScale);
        var teleportResetDistanceSq = teleportResetDistanceWu * teleportResetDistanceWu;
        var teleported = !!(
            previous &&
            (
                ((dx * dx) + (dy * dy) + (dz * dz)) > teleportResetDistanceSq ||
                (!previous.alive && sample.alive)
            )
        );
        if (teleported) {
            history.length = 0;
            history.push(sample);
            render.freezePresentation = null;
            render.freezePresentationAt = 0;
            render.freezeBlendFrom = null;
            render.freezeBlendStartAt = 0;
            render.presentationRenderServerTime = NaN;
            render.presentationRenderClockAtMs = 0;
        } else if (previous && Math.abs(Number(previous.serverTime || 0) - serverTime) < 0.001) {
            history[history.length - 1] = sample;
        } else {
            history.push(sample);
            if (history.length > maxSnapshotHistory) history.shift();
        }
        if (!teleported && render.freezePresentation && previous && serverTime > Number(previous.serverTime || 0)) {
            render.freezeBlendFrom = clonePresentationState(render.freezePresentation);
            render.freezeBlendStartAt = receivedAt;
            render.freezeBlendDurationMs = Math.max(24, Number(interpolationTuning.freezeRecoveryBlendMs || 48));
            render.freezePresentation = null;
            render.freezePresentationAt = 0;
        }
        render.snapshotHistory = history;
        var measuredOffsetMs = receivedAt - serverTime;
        var offsetSnapDeltaMs = Math.max(60, Number(interpolationTuning.serverOffsetSnapDeltaMs || 150));
        if (interpModule && interpModule.smoothClockOffset) {
            render.serverTimeOffsetMs = interpModule.smoothClockOffset(
                Number(render.serverTimeOffsetMs),
                measuredOffsetMs,
                offsetSnapDeltaMs
            );
        } else {
            var offsetLerpAlpha = clamp(Number(interpolationTuning.offsetLerpAlpha || 0.08), 0.01, 1);
            if (!isFinite(Number(render.serverTimeOffsetMs))) {
                render.serverTimeOffsetMs = measuredOffsetMs;
            } else {
                render.serverTimeOffsetMs += (measuredOffsetMs - render.serverTimeOffsetMs) * offsetLerpAlpha;
            }
        }

        if (previous && serverTime > Number(previous.serverTime || 0)) {
            var rawIntervalMs = Math.max(1, serverTime - Number(previous.serverTime || 0));
            var priorIntervalMs = clamp(Number(render.snapshotIntervalMs || DEFAULT_SNAPSHOT_INTERVAL_MS), 16, 140);
            var nextIntervalMs = clamp(
                rawIntervalMs,
                Math.max(16, priorIntervalMs * 0.5),
                Math.max(16, priorIntervalMs * 3)
            );
            var priorStepMs = clamp(Number(render.lastSnapshotStepMs || priorIntervalMs), 16, 140);
            render.lastSnapshotStepMs = nextIntervalMs;
            render.snapshotIntervalMs = (priorIntervalMs * 0.7) + (nextIntervalMs * 0.3);
            var jitterSampleMs = Math.abs(nextIntervalMs - priorStepMs);
            var priorJitterMs = clamp(Number(render.snapshotJitterMs || 0), 0, 120);
            render.snapshotJitterMs = (priorJitterMs * 0.65) + (clamp(jitterSampleMs, 0, 120) * 0.35);
            var lossThresholdScale = Math.max(1.1, Number(interpolationTuning.lossBurstThresholdScale || 1.5));
            var expectedIntervalMs = Math.max(16, priorIntervalMs);
            var missedSnapshots = rawIntervalMs > (expectedIntervalMs * lossThresholdScale)
                ? Math.max(1, Math.round(rawIntervalMs / expectedIntervalMs) - 1)
                : 0;
            var priorLossPaddingMs = Math.max(0, Number(render.lossDelayPaddingMs || 0));
            if (missedSnapshots > 0) {
                render.consecutiveMissedSnapshots = Math.max(0, Number(render.consecutiveMissedSnapshots || 0)) + missedSnapshots;
            } else {
                render.consecutiveMissedSnapshots = 0;
            }
            var lossTriggerCount = Math.max(2, Math.round(Number(interpolationTuning.lossDelayPaddingTriggerCount || 2)));
            if (Number(render.consecutiveMissedSnapshots || 0) >= lossTriggerCount) {
                var paddingFloorMs = expectedIntervalMs * Math.max(0.5, Number(interpolationTuning.lossDelayPaddingIntervalScale || 1));
                var paddingCapMs = Math.max(
                    paddingFloorMs,
                    Number(interpolationTuning.lossDelayPaddingMaxMs || (expectedIntervalMs * 2))
                );
                render.lossDelayPaddingMs = Math.min(
                    paddingCapMs,
                    Math.max(priorLossPaddingMs * 0.8, paddingFloorMs)
                );
            } else {
                render.lossDelayPaddingMs = priorLossPaddingMs * 0.6;
            }
        } else if (!render.snapshotIntervalMs) {
            render.snapshotIntervalMs = DEFAULT_SNAPSHOT_INTERVAL_MS;
            render.lastSnapshotStepMs = DEFAULT_SNAPSHOT_INTERVAL_MS;
            render.snapshotJitterMs = 0;
            render.lossDelayPaddingMs = 0;
            render.consecutiveMissedSnapshots = 0;
        }

        var intervalMs = clamp(Number(render.snapshotIntervalMs || DEFAULT_SNAPSHOT_INTERVAL_MS), 16, 140);
        var jitterMs = clamp(Number(render.snapshotJitterMs || 0), 0, 120);
        var targetDelayMs = interpModule && interpModule.computeInterpolationDelay
            ? interpModule.computeInterpolationDelay(intervalMs, jitterMs, interpolationTuning)
            : defaultInterpolationDelayMs();
        var minDelayMs = Math.max(1, Number(interpolationTuning.minDelayMs || 1));
        var maxDelayMs = Math.max(minDelayMs, Number(interpolationTuning.maxDelayMs || targetDelayMs));
        var lossDelayPaddingMs = Math.max(0, Number(render.lossDelayPaddingMs || 0));
        var maxExtraDelayMs = Math.max(
            lossDelayPaddingMs,
            Number(interpolationTuning.lossDelayPaddingMaxMs || intervalMs)
        );
        targetDelayMs = clamp(targetDelayMs + lossDelayPaddingMs, minDelayMs, maxDelayMs + maxExtraDelayMs);
        var priorDelayMs = Math.max(1, Number(render.interpolationDelayMs || targetDelayMs));
        var targetWeight = targetDelayMs > priorDelayMs
            ? clamp(Number(interpolationTuning.delayIncreaseTargetWeight || 0.7), 0.05, 1)
            : clamp(Number(interpolationTuning.delayDecreaseTargetWeight || 0.2), 0.01, 1);
        render.interpolationDelayMs = (priorDelayMs * (1 - targetWeight)) + (targetDelayMs * targetWeight);
        render.maxExtrapolationMs = interpModule && interpModule.computeMaxExtrapolation
            ? interpModule.computeMaxExtrapolation(intervalMs, jitterMs, interpolationTuning)
            : Math.max(1, Number(interpolationTuning.maxExtrapolationMinMs || 1));
        render.freezeGapMs = interpModule && interpModule.computeFreezeGap
            ? interpModule.computeFreezeGap(intervalMs, jitterMs, interpolationTuning)
            : Math.max(1, Number(interpolationTuning.freezeGapMinMs || 1));
        if (!render.interpolationDelayMs) {
            render.interpolationDelayMs = Math.max(
                1,
                Number(interpolationTuning.defaultDelayMs || targetDelayMs)
            );
        }
        return teleported;
    }

    function applyImmediateRemoteTransform(render, entity, snapshotMeta) {
        if (!render || !entity || !render.group) return;
        var nextX = Number(entity.x || 0);
        var nextFootY = snapshotFootY(entity);
        var nextZ = Number(entity.z || 0);
        var nextYaw = Number(entity.yaw || 0);
        var nextPitch = Number(entity.pitch || 0);
        var rollingNow = Number(entity.rollUntil || 0) > snapshotServerTimeMs(snapshotMeta);
        if (render.actorVisual && render.actorVisual.setWorldTransform) {
            render.actorVisual.setWorldTransform({
                x: nextX,
                y: nextFootY,
                z: nextZ
            }, nextYaw, { rolling: rollingNow });
        } else {
            render.group.position.x = nextX;
            render.group.position.y = nextFootY;
            render.group.position.z = nextZ;
            render.group.rotation.y = nextYaw;
        }
        render.combatX = nextX;
        render.combatY = nextFootY + REMOTE_EYE_HEIGHT;
        render.combatZ = nextZ;
        render.combatYaw = nextYaw;
        render.combatPitch = nextPitch;
        render.lastPresentedTransform = clonePresentationState({
            x: nextX,
            footY: nextFootY,
            z: nextZ,
            yaw: nextYaw,
            pitch: nextPitch,
            moveSpeedNorm: Number(entity.moveSpeedNorm || 0),
            sprinting: !!entity.sprinting,
            fastBackpedal: !!entity.fastBackpedal,
            movingForward: !!entity.movingForward,
            movingBackward: !!entity.movingBackward,
            movingLeft: !!entity.movingLeft,
            movingRight: !!entity.movingRight,
            isGrounded: entity.isGrounded !== false,
            velocityY: Number(entity.velocityY || 0),
            muzzleFlashUntil: Number(entity.muzzleFlashUntil || 0)
        });
        if (render.actorVisual && render.actorVisual.syncHitboxes) {
            render.actorVisual.syncHitboxes({
                x: nextX,
                y: nextFootY,
                z: nextZ
            }, { rolling: rollingNow });
        } else {
            if (render.bodyHitbox && render.bodyHitbox.position && render.bodyHitbox.position.set) {
                render.bodyHitbox.position.set(nextX, nextFootY + 0.7625, nextZ);
            }
            if (render.headHitbox && render.headHitbox.position && render.headHitbox.position.set) {
                render.headHitbox.position.set(nextX, nextFootY + 2.0, nextZ);
            }
        }
    }

    function captureRenderTransformSample(render, aliveOverride, sampleMeta) {
        if (!render || !render.group) return null;
        var stamp = Math.max(0, Number(sampleMeta && sampleMeta.receivedAt || Date.now()));
        var serverTime = snapshotServerTimeMs(sampleMeta);
        var groupPosition = render.group.position || { x: 0, y: 0, z: 0 };
        var latest = render.lastPresentedTransform || null;
        return {
            serverTime: serverTime,
            receivedAt: stamp,
            x: latest ? Number(latest.x || 0) : Number(groupPosition.x || 0),
            footY: latest ? Number(latest.footY || 0) : Number(groupPosition.y || 0),
            z: latest ? Number(latest.z || 0) : Number(groupPosition.z || 0),
            yaw: latest ? Number(latest.yaw || 0) : Number(render.group.rotation && render.group.rotation.y || 0),
            pitch: latest ? Number(latest.pitch || 0) : Number(render.combatPitch || 0),
            alive: aliveOverride !== undefined ? !!aliveOverride : (render.alive !== false),
            moveSpeedNorm: latest ? Number(latest.moveSpeedNorm || 0) : Number(render.moveSpeedNorm || 0),
            sprinting: latest ? !!latest.sprinting : !!render.sprinting,
            fastBackpedal: latest ? !!latest.fastBackpedal : !!render.fastBackpedal,
            movingForward: latest ? !!latest.movingForward : !!render.movingForward,
            movingBackward: latest ? !!latest.movingBackward : !!render.movingBackward,
            movingLeft: latest ? !!latest.movingLeft : !!render.movingLeft,
            movingRight: latest ? !!latest.movingRight : !!render.movingRight,
            isGrounded: latest ? (latest.isGrounded !== false) : (render.isGrounded !== false),
            velocityY: latest ? Number(latest.velocityY || 0) : Number(render.velocityY || 0),
            muzzleFlashUntil: latest ? Number(latest.muzzleFlashUntil || 0) : Number(render.muzzleFlashUntil || 0)
        };
    }

    function setRenderAliveState(render, alive) {
        if (!render) return false;
        if (!alive) {
            var deadSample = captureRenderTransformSample(render, false, {
                receivedAt: Date.now()
            });
            if (deadSample) {
                render.snapshotHistory = [deadSample];
            }
            render.freezePresentation = null;
            render.freezePresentationAt = 0;
            render.freezeBlendFrom = null;
            render.freezeBlendStartAt = 0;
            render.presentationRenderServerTime = NaN;
            render.presentationRenderClockAtMs = 0;
            render.lossDelayPaddingMs = 0;
            render.consecutiveMissedSnapshots = 0;
        }
        render.alive = !!alive;
        if (render.group) render.group.visible = !!alive;
        if (render.actorVisual && render.actorVisual.setAlive) {
            render.actorVisual.setAlive(!!alive);
            render.actorVisual.setHitboxVisibility(hitboxVisible);
        }
        if (render.bodyHitbox) render.bodyHitbox.visible = !!alive;
        if (render.headHitbox) render.headHitbox.visible = !!alive;
        return true;
    }

    function classWallhackRadiusFor(classId) {
        var preset = sharedClassPreset(classId);
        var radius = Number(preset && preset.wallhackRadius || 0);
        return radius > 0 ? radius : 90;
    }

    function sharedClassPreset(classId) {
        var shared = sharedApi().gameplayTuning || {};
        var presets = shared.classPresets || {};
        return presets[classId] || presets.ffa || null;
    }

    function classStats(classId) {
        var preset = sharedClassPreset(classId);
        return {
            armorMax: preset && Number(preset.armorMax || 0) > 0
                ? Number(preset.armorMax)
                : Math.max(0, Number(entityConstants.DEFAULT_ARMOR_MAX || entityConstants.DEFAULT_ARMOR || 0)),
            wallhackRadius: classWallhackRadiusFor(classId)
        };
    }

    function createRemoteVisual(entity, snapshotMeta) {
        var actorFactory = actorVisualFactory();
        if (!actorFactory || !actorFactory.create) {
            throw new Error('GameNetEntities requires GameActorVisualFactory.create.');
        }
        var actorVisual = actorFactory.create({
            ownerType: 'net',
            bodyColor: 0x3772c4,
            skinColor: 0xd2a77d,
            legColor: 0x2d2d2d,
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
            }, (entity.yaw || 0), {
                rolling: Number(entity.rollUntil || 0) > snapshotServerTimeMs(snapshotMeta)
            });
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
            interpolationDelayMs: defaultInterpolationDelayMs(),
            maxExtrapolationMs: 32,
            freezeGapMs: 96,
            serverTimeOffsetMs: NaN,
            lossDelayPaddingMs: 0,
            consecutiveMissedSnapshots: 0,
            freezePresentation: null,
            freezePresentationAt: 0,
            freezeBlendFrom: null,
            freezeBlendStartAt: 0,
            freezeBlendDurationMs: 48,
            lastPresentedTransform: null,
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
            fastBackpedal: !!entity.fastBackpedal,
            movingForward: !!entity.movingForward,
            movingBackward: !!entity.movingBackward,
            movingLeft: !!entity.movingLeft,
            movingRight: !!entity.movingRight,
            isGrounded: entity.isGrounded !== false,
            velocityY: Number(entity.velocityY || 0),
            _prevIsGrounded: entity.isGrounded !== false,
            weaponId: entity.weaponId || 'rifle',
            weaponAmmo: cloneWeaponAmmoStateMap(entity.weaponAmmo),
            weaponAmmoServerTimeMs: snapshotServerTimeMs(snapshotMeta),
            _appliedWeaponId: entity.weaponId || 'rifle',
            muzzleFlashUntil: entity.muzzleFlashUntil || 0,
            rollStartedAt: Number(entity.rollStartedAt || 0),
            rollUntil: Number(entity.rollUntil || 0),
            rollInputState: entity.rollInputState && typeof entity.rollInputState === 'object'
                ? {
                    movingForward: !!entity.rollInputState.movingForward,
                    movingBackward: !!entity.rollInputState.movingBackward,
                    movingLeft: !!entity.rollInputState.movingLeft,
                    movingRight: !!entity.rollInputState.movingRight
                }
                : null,
            streamHeat: entity.streamHeat || 0,
            streamOverheatedUntil: entity.streamOverheatedUntil || 0,
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
        var teleported = appendSnapshotHistory(r, entity, snapshotMeta);
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
        r.fastBackpedal = !!entity.fastBackpedal;
        r.movingForward = !!entity.movingForward;
        r.movingBackward = !!entity.movingBackward;
        r.movingLeft = !!entity.movingLeft;
        r.movingRight = !!entity.movingRight;
        r.isGrounded = entity.isGrounded !== false;
        r.velocityY = Number(entity.velocityY || 0);
        r.weaponId = entity.weaponId || 'rifle';
        r.weaponAmmo = cloneWeaponAmmoStateMap(entity.weaponAmmo);
        r.weaponAmmoServerTimeMs = snapshotServerTimeMs(snapshotMeta);
        r.streamHeat = entity.streamHeat || 0;
        r.streamOverheatedUntil = entity.streamOverheatedUntil || 0;
        r.muzzleFlashUntil = entity.muzzleFlashUntil || 0;
        r.rollStartedAt = Number(entity.rollStartedAt || 0);
        r.rollUntil = Number(entity.rollUntil || 0);
        r.rollInputState = entity.rollInputState && typeof entity.rollInputState === 'object'
            ? {
                movingForward: !!entity.rollInputState.movingForward,
                movingBackward: !!entity.rollInputState.movingBackward,
                movingLeft: !!entity.rollInputState.movingLeft,
                movingRight: !!entity.rollInputState.movingRight
            }
            : null;

        setRenderAliveState(r, entity.alive !== false);
        if (teleported) {
            applyImmediateRemoteTransform(r, entity, snapshotMeta);
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

    GameNetEntities.setAliveState = function (id, alive) {
        var render = renderMap.get(String(id || ''));
        if (!render) return false;
        return setRenderAliveState(render, alive !== false);
    };

    GameNetEntities.configure = function (nextDeps) {
        deps = nextDeps && typeof nextDeps === 'object' ? nextDeps : {};
        entityConstants = sharedApi().entityConstants || {};
    };

    GameNetEntities.getCoreWorldPosition = function (entityId, outVec3) {
        var render = renderMap.get(entityId);
        if (!render || !render.actorVisual || !render.actorVisual.getCoreWorldPosition) return null;
        return render.actorVisual.getCoreWorldPosition(outVec3);
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
