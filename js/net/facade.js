/**
 * facade.js - Public GameNet surface assembly.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameNetFacade
 */
(function () {
    'use strict';

    var runtime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    var GameNetFacade = {};

    function collectMissingMethods(target, targetName, methodNames, missing) {
        if (!target || typeof target !== 'object') {
            missing.push(targetName);
            return;
        }
        for (var i = 0; i < methodNames.length; i++) {
            var methodName = methodNames[i];
            if (typeof target[methodName] !== 'function') {
                missing.push(targetName + '.' + methodName);
            }
        }
    }

    function assertCreateOpts(opts) {
        var missing = [];
        collectMissingMethods(opts.netState, 'netState', [
            'getRoomId',
            'setRoomId',
            'setWorldMeta',
            'setWorldMismatchNotified',
            'setInputSendInterval'
        ], missing);
        collectMissingMethods(opts.joinState, 'joinState', [
            'beginJoinAttempt',
            'failJoin',
            'resetJoinAttempt'
        ], missing);
        collectMissingMethods(opts.connectionTiming, 'connectionTiming', [
            'reset',
            'snapshotTimingState',
            'connectionTimingState',
            'authoritativeNowMs',
            'getEstimatedServerTime',
            'toLocalClockTime'
        ], missing);
        collectMissingMethods(opts.runtimeCore, 'runtimeCore', [
            'update'
        ], missing);
        collectMissingMethods(opts.stateView, 'stateView', [
            'getEntityStateList',
            'getAuthoritativeSelfState',
            'getSelfState',
            'getSelfReconciliationState',
            'consumeThrowAck',
            'consumeThrowReject',
            'consumeThrowableEvent',
            'consumeAbilityEvent',
            'getAuthoritativeThrowableState',
            'consumeClassCastResult',
            'consumeDamageFeedback',
            'consumeIncomingDamageFeedback',
            'getEntityMarkerWorldPos',
            'getChokeVictimStateForEntity',
            'getSelfAbilityState',
            'getMatchState',
            'getInputSyncState',
            'getPendingInputSamples',
            'getRespawnState',
            'getGameMode',
            'getPrivateRoomPhase',
            'getExpectedWorldMeta',
            'getWorldMeta',
            'getEntityName',
            'getLockTargets',
            'consumeNotice'
        ], missing);
        collectMissingMethods(opts.commandsApi, 'commandsApi', [
            'sendFire',
            'sendReload',
            'sendEquipWeapon',
            'sendWeaponLoadout',
            'sendThrow',
            'sendAbilityLoadout',
            'sendAbilityCast'
        ], missing);
        collectMissingMethods(opts.effects, 'effects', [
            'damagePointForEntityId'
        ], missing);
        if (missing.length) {
            throw new Error('GameNetFacade.create missing required dependencies: ' + missing.join(', '));
        }
    }

    GameNetFacade.create = function (opts) {
        opts = opts || {};
        assertCreateOpts(opts);

        var GameNet = {};

        GameNet.setRoomId = function (nextRoomId) {
            var nextId = opts.sanitizeRoomId ? opts.sanitizeRoomId(nextRoomId) : String(nextRoomId || '');
            if (opts.netState && opts.netState.setRoomId) {
                opts.netState.setRoomId(nextId);
                opts.netState.setWorldMeta(null);
                opts.netState.setWorldMismatchNotified(false);
                opts.netState.setInputSendInterval(opts.defaultInputSendInterval || (1 / 60));
            }
            if (opts.connectionTiming && opts.connectionTiming.reset) {
                opts.connectionTiming.reset();
            }
            return nextId;
        };

        GameNet.getRoomId = function () {
            return opts.netState && opts.netState.getRoomId ? opts.netState.getRoomId() : '';
        };

        GameNet.beginJoinAttempt = opts.joinState.beginJoinAttempt;
        GameNet.failJoin = opts.joinState.failJoin;
        GameNet.resetJoinAttempt = opts.joinState.resetJoinAttempt;

        GameNet.init = function (scene) {
            if (opts.onInit) opts.onInit(scene);
        };

        GameNet.shutdown = function () {
            if (opts.onShutdown) opts.onShutdown();
        };

        GameNet.isActive = function () {
            return !!(opts.isActive && opts.isActive());
        };

        GameNet.isConnected = function () {
            return !!(opts.isConnected && opts.isConnected());
        };

        GameNet.getHitboxArray = function () {
            return opts.entitiesApi && opts.entitiesApi.getHitboxArray ? opts.entitiesApi.getHitboxArray() : [];
        };

        GameNet.setHitboxVisibility = function (visible) {
            if (opts.entitiesApi && opts.entitiesApi.setHitboxVisibility) {
                opts.entitiesApi.setHitboxVisibility(visible);
            }
        };

        GameNet.getEntityStateList = opts.stateView.getEntityStateList;
        GameNet.getAuthoritativeSelfState = opts.stateView.getAuthoritativeSelfState;
        GameNet.getSelfState = opts.stateView.getSelfState;
        GameNet.getSelfReconciliationState = opts.stateView.getSelfReconciliationState;

        GameNet.update = opts.runtimeCore.update;

        GameNet.sendFire = opts.commandsApi.sendFire;
        GameNet.sendReload = opts.commandsApi.sendReload;
        GameNet.sendEquipWeapon = opts.commandsApi.sendEquipWeapon;
        GameNet.sendWeaponLoadout = opts.commandsApi.sendWeaponLoadout;
        GameNet.sendThrow = opts.commandsApi.sendThrow;

        GameNet.consumeThrowAck = opts.stateView.consumeThrowAck;
        GameNet.consumeThrowReject = opts.stateView.consumeThrowReject;
        GameNet.consumeThrowableEvent = opts.stateView.consumeThrowableEvent;
        GameNet.consumeAbilityEvent = opts.stateView.consumeAbilityEvent;
        GameNet.getAuthoritativeThrowableState = opts.stateView.getAuthoritativeThrowableState;

        GameNet.sendAbilityLoadout = opts.commandsApi.sendAbilityLoadout;
        GameNet.sendAbilityCast = opts.commandsApi.sendAbilityCast;

        GameNet.consumeClassCastResult = opts.stateView.consumeClassCastResult;
        GameNet.consumeDamageFeedback = opts.stateView.consumeDamageFeedback;
        GameNet.consumeIncomingDamageFeedback = opts.stateView.consumeIncomingDamageFeedback;
        GameNet.damagePointForEntityId = opts.effects.damagePointForEntityId;
        GameNet.getEntityMarkerWorldPos = opts.stateView.getEntityMarkerWorldPos;
        GameNet.getChokeVictimStateForEntity = opts.stateView.getChokeVictimStateForEntity;
        GameNet.getSelfAbilityState = opts.stateView.getSelfAbilityState;
        GameNet.getMatchState = opts.stateView.getMatchState;
        GameNet.getInputSyncState = opts.stateView.getInputSyncState;
        GameNet.getPendingInputSamples = opts.stateView.getPendingInputSamples;
        GameNet.getRespawnState = opts.stateView.getRespawnState;
        GameNet.getGameMode = opts.stateView.getGameMode;
        GameNet.getPrivateRoomPhase = opts.stateView.getPrivateRoomPhase;
        GameNet.getExpectedWorldMeta = opts.stateView.getExpectedWorldMeta;
        GameNet.getWorldMeta = opts.stateView.getWorldMeta;
        GameNet.getEntityName = opts.stateView.getEntityName;
        GameNet.getLockTargets = opts.stateView.getLockTargets;
        GameNet.consumeNotice = opts.stateView.consumeNotice;
        GameNet.getSnapshotTimingState = opts.connectionTiming.snapshotTimingState;
        GameNet.getConnectionTimingState = opts.connectionTiming.connectionTimingState;
        GameNet.getAuthoritativeNow = opts.connectionTiming.authoritativeNowMs;
        GameNet.getEstimatedServerTime = function () {
            return opts.connectionTiming.getEstimatedServerTime();
        };
        GameNet.toLocalTime = opts.connectionTiming.toLocalClockTime;

        return GameNet;
    };

    runtime.GameNetFacade = GameNetFacade;
})();
