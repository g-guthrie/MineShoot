/**
 * network-config.js - Shared config and tuning helpers for GameNet runtime modules.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameNetConfig
 */
(function () {
    'use strict';

    function runtimeRoot() {
        return globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    }

    function sharedApi() {
        return runtimeRoot().GameShared || {};
    }

    function protocolConfig() {
        return sharedApi().protocol || {};
    }

    function entityApi() {
        return runtimeRoot().GameNetEntities || null;
    }

    function sanitizeRoomId(roomName) {
        var protocol = protocolConfig();
        if (typeof protocol.sanitizeRoomId === 'function') {
            return String(protocol.sanitizeRoomId(roomName) || 'global');
        }
        var normalized = String(roomName || '')
            .toLowerCase()
            .replace(/[^a-z0-9_-]+/g, '');
        return normalized || 'global';
    }

    function cloneWorldFlags(flags) {
        var protocol = protocolConfig();
        if (typeof protocol.cloneWorldFlags === 'function') {
            return protocol.cloneWorldFlags(flags);
        }
        var source = (flags && typeof flags === 'object') ? flags : {};
        return Object.assign({}, source);
    }

    function gameplayNetworkTuning() {
        var shared = sharedApi();
        return shared.getNetworkTuning ? (shared.getNetworkTuning() || {}) : {};
    }

    function gameplayNetworkFlags() {
        return gameplayNetworkTuning().flags || {};
    }

    function gameplayNetworkPingTuning() {
        return gameplayNetworkTuning().ping || {};
    }

    function gameplayNetworkSelfReconciliationTuning() {
        return gameplayNetworkTuning().selfReconciliation || {};
    }

    function gameplayNetworkRemoteInterpolationTuning() {
        return gameplayNetworkTuning().remoteInterpolation || {};
    }

    function gameplayNetworkCombatPriorityTuning() {
        return gameplayNetworkTuning().combatPriority || {};
    }

    function gameplayNetworkFeedbackTuning() {
        return gameplayNetworkTuning().feedback || {};
    }

    function networkFlagEnabled(flagName, defaultEnabled) {
        if (!flagName) return defaultEnabled !== false;
        var flags = gameplayNetworkFlags();
        if (!Object.prototype.hasOwnProperty.call(flags, flagName)) {
            return defaultEnabled !== false;
        }
        return flags[flagName] !== false;
    }

    function replayFirstSelfCorrectionEnabled() {
        return networkFlagEnabled('replayFirstSelfCorrection', true);
    }

    function remoteReceiveJitterBufferEnabled() {
        return networkFlagEnabled('remoteReceiveJitterBuffer', true);
    }

    function snapshotDeltaCompressionEnabled() {
        return networkFlagEnabled('snapshotDeltaCompression', true);
    }

    function adaptiveSelfReconciliationEnabled() {
        return networkFlagEnabled('adaptiveSelfReconciliation', true);
    }

    function adaptiveSnapshotCadenceEnabled() {
        return networkFlagEnabled('adaptiveSnapshotCadence', true);
    }

    function combatBurstSnapshotsEnabled() {
        return networkFlagEnabled('combatBurstSnapshots', true);
    }

    function shotTokenDamageAggregationEnabled() {
        return networkFlagEnabled('shotTokenDamageAggregation', true);
    }

    function pingCadenceMs() {
        var raw = Number(gameplayNetworkPingTuning().cadenceMs || 500);
        if (!isFinite(raw) || raw <= 0) return 500;
        return Math.max(100, raw);
    }

    function fallbackClassPreset(classId) {
        var shared = sharedApi();
        var gameplayTuning = shared.gameplayTuning || {};
        var classPresets = gameplayTuning.classPresets || {};
        return classPresets[classId] || classPresets.ffa || null;
    }

    function classStats(classId) {
        var entities = entityApi();
        if (entities && typeof entities.classStats === 'function') {
            return entities.classStats(classId);
        }
        var preset = fallbackClassPreset(classId);
        var constants = sharedApi().entityConstants || {};
        return {
            armorMax: preset && Number(preset.armorMax || 0) > 0
                ? Number(preset.armorMax)
                : Math.max(0, Number(constants.DEFAULT_ARMOR_MAX || constants.DEFAULT_ARMOR || 0)),
            wallhackRadius: preset && Number(preset.wallhackRadius || 0) > 0
                ? Number(preset.wallhackRadius)
                : 90
        };
    }

    function buildExpectedWorldMeta(roomName, fallbackRoomId) {
        var protocol = protocolConfig();
        var resolvedRoomId = sanitizeRoomId(roomName || fallbackRoomId || 'global');
        if (typeof protocol.buildExpectedWorldMeta === 'function') {
            return protocol.buildExpectedWorldMeta(resolvedRoomId, protocol.world);
        }
        var world = protocol.world || {};
        return {
            roomId: resolvedRoomId,
            worldSeed: world.defaultWorldSeedPrefix
                ? String(world.defaultWorldSeedPrefix) + resolvedRoomId
                : ('room-env-static-' + resolvedRoomId),
            worldProfileVersion: Math.max(0, Number(world.worldProfileVersion || 0)),
            worldFlags: cloneWorldFlags(world.worldFlags)
        };
    }

    function activeWorldMeta() {
        var worldApi = runtimeRoot().GameWorld || null;
        return worldApi && typeof worldApi.getWorldMeta === 'function'
            ? (worldApi.getWorldMeta() || null)
            : null;
    }

    var api = {
        runtimeRoot: runtimeRoot,
        sharedApi: sharedApi,
        protocolConfig: protocolConfig,
        entityApi: entityApi,
        sanitizeRoomId: sanitizeRoomId,
        cloneWorldFlags: cloneWorldFlags,
        buildExpectedWorldMeta: buildExpectedWorldMeta,
        activeWorldMeta: activeWorldMeta,
        classStats: classStats,
        gameplayNetworkTuning: gameplayNetworkTuning,
        gameplayNetworkFlags: gameplayNetworkFlags,
        gameplayNetworkPingTuning: gameplayNetworkPingTuning,
        gameplayNetworkSelfReconciliationTuning: gameplayNetworkSelfReconciliationTuning,
        gameplayNetworkRemoteInterpolationTuning: gameplayNetworkRemoteInterpolationTuning,
        gameplayNetworkCombatPriorityTuning: gameplayNetworkCombatPriorityTuning,
        gameplayNetworkFeedbackTuning: gameplayNetworkFeedbackTuning,
        networkFlagEnabled: networkFlagEnabled,
        replayFirstSelfCorrectionEnabled: replayFirstSelfCorrectionEnabled,
        remoteReceiveJitterBufferEnabled: remoteReceiveJitterBufferEnabled,
        snapshotDeltaCompressionEnabled: snapshotDeltaCompressionEnabled,
        adaptiveSelfReconciliationEnabled: adaptiveSelfReconciliationEnabled,
        adaptiveSnapshotCadenceEnabled: adaptiveSnapshotCadenceEnabled,
        combatBurstSnapshotsEnabled: combatBurstSnapshotsEnabled,
        shotTokenDamageAggregationEnabled: shotTokenDamageAggregationEnabled,
        pingCadenceMs: pingCadenceMs
    };

    runtimeRoot().GameNetConfig = api;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
}());
