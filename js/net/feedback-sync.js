/**
 * feedback-sync.js - Consumes multiplayer gameplay feedback queues and syncs throwable state.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameNetFeedbackSync
 */
(function () {
    'use strict';

    var predictedHitFeedback = [];
    var confirmedShotFeedback = [];
    var PREDICTED_HIT_MAX = 128;
    var CONFIRMED_SHOT_MAX = 64;
    var feedbackSelfPos = {
        x: 0,
        y: 0,
        z: 0,
        set: function (x, y, z) {
            this.x = x;
            this.y = y;
            this.z = z;
            return this;
        }
    };

    function runtime() {
        return globalThis.__MAYHEM_RUNTIME || {};
    }

    function netView() {
        var net = runtime().GameNet || null;
        return net && net.view ? net.view : null;
    }

    function netEffects() {
        var net = runtime().GameNet || null;
        return net && net.effects ? net.effects : null;
    }

    function netRemoteEntities() {
        var net = runtime().GameNet || null;
        return net && net.remoteEntities ? net.remoteEntities : null;
    }

    function sharedApi() {
        return runtime().GameShared || {};
    }

    function worldTracerFx() {
        return runtime().GameWorldTracerFx || null;
    }

    function feedbackTuning() {
        var shared = sharedApi();
        var network = shared.getNetworkTuning ? shared.getNetworkTuning() : null;
        var feedback = network && network.feedback ? network.feedback : {};
        return {
            predictedHitTtlMs: Math.max(1, Number(feedback.predictedHitTtlMs || 900)),
            confirmedShotTtlMs: Math.max(
                Math.max(1, Number(feedback.predictedHitTtlMs || 900)),
                Number(feedback.confirmedShotTtlMs || (Math.max(1, Number(feedback.predictedHitTtlMs || 900)) * 2.25))
            )
        };
    }

    function normalizePelletIndex(value) {
        var parsed = Number(value);
        if (!isFinite(parsed)) return null;
        return Math.max(0, Math.floor(parsed));
    }

    function predictionKey(feedback) {
        var shotToken = String(feedback && feedback.shotToken || '');
        if (!shotToken) return '';
        var pelletIndex = normalizePelletIndex(feedback && feedback.pelletIndex);
        return shotToken + '|' + (pelletIndex == null ? 'single' : String(pelletIndex));
    }

    function prunePredictedHitFeedback(now) {
        var stamp = Math.max(0, Number(now || Date.now()));
        var next = [];
        for (var i = 0; i < predictedHitFeedback.length; i++) {
            var entry = predictedHitFeedback[i];
            if (!entry) continue;
            var ageMs = stamp - Number(entry.at || 0);
            if (ageMs < 0 || ageMs > feedbackTuning().predictedHitTtlMs) continue;
            next.push(entry);
        }
        predictedHitFeedback = next;
    }

    function pruneConfirmedShotFeedback(now) {
        var stamp = Math.max(0, Number(now || Date.now()));
        var next = [];
        for (var i = 0; i < confirmedShotFeedback.length; i++) {
            var entry = confirmedShotFeedback[i];
            if (!entry) continue;
            var ageMs = stamp - Number(entry.at || 0);
            if (ageMs < 0 || ageMs > feedbackTuning().confirmedShotTtlMs) continue;
            next.push(entry);
        }
        confirmedShotFeedback = next;
    }

    function consumePredictedHitFeedback(feedback) {
        if (!feedback) return null;
        var stamp = Date.now();
        prunePredictedHitFeedback(stamp);
        pruneConfirmedShotFeedback(stamp);
        var key = predictionKey(feedback);
        var feedbackShotToken = String(feedback.shotToken || '');
        var feedbackWeaponId = String(feedback.weaponId || '');
        if (key) {
            for (var i = predictedHitFeedback.length - 1; i >= 0; i--) {
                var entry = predictedHitFeedback[i];
                if (!entry) continue;
                if (predictionKey(entry) === key) {
                    predictedHitFeedback.splice(i, 1);
                    return entry;
                }
            }
        }
        if (feedbackShotToken) return null;
        for (var r = predictedHitFeedback.length - 1; r >= 0; r--) {
            var fallbackEntry = predictedHitFeedback[r];
            if (!fallbackEntry) continue;
            if (String(fallbackEntry.weaponId || '') !== feedbackWeaponId) continue;
            if (normalizePelletIndex(fallbackEntry.pelletIndex) !== normalizePelletIndex(feedback.pelletIndex)) continue;
            predictedHitFeedback.splice(r, 1);
            return fallbackEntry;
        }
        return null;
    }

    function clearPredictedHitFeedbackByShotToken(shotToken) {
        var token = String(shotToken || '');
        if (!token) return;
        var next = [];
        for (var i = 0; i < predictedHitFeedback.length; i++) {
            var entry = predictedHitFeedback[i];
            if (!entry) continue;
            if (String(entry.shotToken || '') === token) continue;
            next.push(entry);
        }
        predictedHitFeedback = next;
    }

    function registerPredictedLocalHit(feedback) {
        var stamp = Date.now();
        prunePredictedHitFeedback(stamp);
        pruneConfirmedShotFeedback(stamp);
        var key = predictionKey(feedback);
        var shotToken = String(feedback && feedback.shotToken || '');
        for (var i = predictedHitFeedback.length - 1; i >= 0; i--) {
            var entry = predictedHitFeedback[i];
            if (!entry) continue;
            if (key && predictionKey(entry) === key) {
                entry.weaponId = String(feedback && feedback.weaponId || '');
                entry.pelletIndex = normalizePelletIndex(feedback && feedback.pelletIndex);
                entry.at = stamp;
                return;
            }
        }
        predictedHitFeedback.push({
            weaponId: String(feedback && feedback.weaponId || ''),
            shotToken: shotToken,
            pelletIndex: normalizePelletIndex(feedback && feedback.pelletIndex),
            at: stamp
        });
        while (predictedHitFeedback.length > PREDICTED_HIT_MAX) {
            predictedHitFeedback.shift();
        }
    }

    function markConfirmedShotToken(shotToken) {
        var token = String(shotToken || '');
        if (!token) return true;
        var stamp = Date.now();
        pruneConfirmedShotFeedback(stamp);
        for (var i = 0; i < confirmedShotFeedback.length; i++) {
            var entry = confirmedShotFeedback[i];
            if (!entry) continue;
            if (String(entry.shotToken || '') === token) {
                entry.at = stamp;
                return false;
            }
        }
        confirmedShotFeedback.push({
            shotToken: token,
            at: stamp
        });
        while (confirmedShotFeedback.length > CONFIRMED_SHOT_MAX) {
            confirmedShotFeedback.shift();
        }
        return true;
    }

    function damageNumberSpread(feedback) {
        return feedback && feedback.weaponId === 'shotgun'
            ? { spreadX: 152, spreadY: 72 }
            : undefined;
    }

    function tracerWeaponConfig(weaponId) {
        var shared = sharedApi();
        var presentation = shared && shared.getWeaponPresentation
            ? shared.getWeaponPresentation(String(weaponId || ''))
            : null;
        var tracer = presentation && presentation.tracer ? presentation.tracer : {};
        return {
            tracerLife: Number(tracer.life || 0),
            tracerSpeed: Number(tracer.speed || 0),
            tracerSegmentLength: Number(tracer.segmentLength || 0)
        };
    }

    function resolveShotEffectOrigin(sourceId, fallbackOrigin) {
        var remoteEntitiesApi = netRemoteEntities();
        var renderMap = remoteEntitiesApi && remoteEntitiesApi.getRenderMap ? remoteEntitiesApi.getRenderMap() : null;
        var render = renderMap && renderMap.get ? renderMap.get(String(sourceId || '')) : null;
        if (render && render.actorVisual && render.actorVisual.getMuzzleWorldPosition && typeof THREE !== 'undefined' && THREE && THREE.Vector3) {
            var muzzleWorld = render.actorVisual.getMuzzleWorldPosition(new THREE.Vector3());
            if (muzzleWorld && typeof muzzleWorld.x === 'number') return muzzleWorld;
        }
        if (!fallbackOrigin || typeof THREE === 'undefined' || !THREE || !THREE.Vector3) return null;
        return new THREE.Vector3(
            Number(fallbackOrigin.x || 0),
            Number(fallbackOrigin.y || 0),
            Number(fallbackOrigin.z || 0)
        );
    }

    function handleShotEffect(event, camera, selfState) {
        if (!event || !camera) return;
        var tracerFx = worldTracerFx();
        if (!tracerFx || !tracerFx.spawnTracer) return;
        var selfId = String(selfState && selfState.id || '');
        var sourceId = String(event.sourceId || '');
        if (sourceId && selfId && sourceId === selfId) return;
        var traces = Array.isArray(event.traces) ? event.traces : [];
        if (!traces.length) return;
        var origin = resolveShotEffectOrigin(sourceId, event.origin);
        if (!origin) return;
        var weapon = tracerWeaponConfig(event.weaponId || '');
        for (var i = 0; i < traces.length; i++) {
            var trace = traces[i];
            if (!trace) continue;
            tracerFx.spawnTracer(
                camera,
                weapon,
                new THREE.Vector3(
                    Number(trace.x || 0),
                    Number(trace.y || 0),
                    Number(trace.z || 0)
                ),
                origin
            );
        }
    }

    function showDamageNumber(feedback, camera) {
        var RT = runtime();
        if (!RT.GameUI || !RT.GameUI.showDamageNumber) return false;
        if (!feedback || !feedback.worldPos || typeof feedback.damage !== 'number' || !(feedback.damage > 0) || !camera) return false;
        var wp = feedback.worldPos;
        RT.GameUI.showDamageNumber(
            new THREE.Vector3(Number(wp.x || 0), Number(wp.y || 0), Number(wp.z || 0)),
            feedback.damage,
            !!feedback.killed,
            camera,
            feedback.hitType || 'body',
            damageNumberSpread(feedback)
        );
        return true;
    }

    function emitPredictedLocalDamageFeedback(feedback) {
        var RT = runtime();
        var payload = feedback || {};
        showDamageNumber(payload, payload.camera || null);
        var canPlayAudio = !!(RT.GameAudio && RT.GameAudio.play);
        var hasFocus = true;
        if (typeof document !== 'undefined' && document && typeof document.hasFocus === 'function') {
            hasFocus = !!document.hasFocus();
        }
        if (canPlayAudio && hasFocus) {
            RT.GameAudio.play('bulletImpact', {
                killed: false,
                hitType: payload.hitType || 'body',
                weapon: payload.weaponId || ''
            });
        }
        registerPredictedLocalHit(payload);
    }

    function handleNetworkDamageFeedback(feedback, camera) {
        if (!feedback) return;
        var RT = runtime();
        if (feedback.targetId && RT.GameOverhead && RT.GameOverhead.revealTarget) {
            RT.GameOverhead.revealTarget(String(feedback.targetId || ''), 1500);
        }
        var matchedPrediction = consumePredictedHitFeedback(feedback);
        var suppressLocalAudio = !!matchedPrediction;
        var suppressDamageNumber = !!matchedPrediction;
        var shouldShowAuthoritativeConfirm = !feedback.killed && markConfirmedShotToken(feedback.shotToken || '');

        if (!suppressLocalAudio && RT.GameAudio && RT.GameAudio.play) {
            RT.GameAudio.play('bulletImpact', {
                killed: !!feedback.killed,
                hitType: feedback.hitType || 'body',
                weapon: feedback.weaponId || ''
            });
        }
        if (feedback.killed) {
            if (RT.GameUI && RT.GameUI.showKillMarker) RT.GameUI.showKillMarker();
        } else if (shouldShowAuthoritativeConfirm) {
            if (RT.GameUI && RT.GameUI.showHitMarker) RT.GameUI.showHitMarker();
        }

        if (!suppressDamageNumber) showDamageNumber(feedback, camera);
        if (feedback.killed) {
            clearPredictedHitFeedbackByShotToken(feedback.shotToken || '');
        }
    }

    function syncGameplayFeedback(options) {
        var opts = options || {};
        var RT = runtime();
        var viewApi = netView();
        var selfState = opts.selfState || null;
        var camera = opts.camera || null;
        var dt = Number(opts.dt || 0);
        var setTransientDebug = typeof opts.setTransientDebug === 'function' ? opts.setTransientDebug : function () {};

        if (viewApi && viewApi.consumeDamageFeedback) {
            var damageFeedback = null;
            do {
                damageFeedback = viewApi.consumeDamageFeedback();
                if (damageFeedback) handleNetworkDamageFeedback(damageFeedback, camera);
            } while (damageFeedback);
        }

        if (viewApi && viewApi.consumeShotEffect) {
            var shotEffect = null;
            do {
                shotEffect = viewApi.consumeShotEffect();
                if (shotEffect) handleShotEffect(shotEffect, camera, selfState);
            } while (shotEffect);
        }

        if (viewApi && viewApi.consumeIncomingDamageFeedback && RT.GamePlayerCombat && RT.GamePlayerCombat.showIncomingFeedback) {
            var incomingDamageFeedback = null;
            do {
                incomingDamageFeedback = viewApi.consumeIncomingDamageFeedback();
                if (incomingDamageFeedback) {
                    RT.GamePlayerCombat.showIncomingFeedback(
                        incomingDamageFeedback.sourcePos,
                        incomingDamageFeedback.damage,
                        incomingDamageFeedback.hitType
                    );
                }
            } while (incomingDamageFeedback);
        }

        if (viewApi && viewApi.consumeThrowAck && RT.GameThrowables && RT.GameThrowables.confirmPredictedThrow) {
            var throwAck = null;
            do {
                throwAck = viewApi.consumeThrowAck();
                if (throwAck && throwAck.clientThrowId) {
                    RT.GameThrowables.confirmPredictedThrow(throwAck.clientThrowId, throwAck);
                }
            } while (throwAck);
        }

        if (viewApi && viewApi.consumeThrowReject && RT.GameThrowables && RT.GameThrowables.rejectPredictedThrow) {
            var throwReject = null;
            do {
                throwReject = viewApi.consumeThrowReject();
                if (throwReject && throwReject.clientThrowId) {
                    RT.GameThrowables.rejectPredictedThrow(throwReject.clientThrowId);
                }
            } while (throwReject);
        }

        if (viewApi && viewApi.getAuthoritativeThrowableState && RT.GameThrowables && RT.GameThrowables.syncAuthoritativeState) {
            RT.GameThrowables.syncAuthoritativeState(
                viewApi.getAuthoritativeThrowableState(),
                selfState ? selfState.id : ''
            );
        }

        if (viewApi && viewApi.consumeThrowableEvent && RT.GameThrowables && RT.GameThrowables.applyNetworkEvent) {
            var throwEvent = null;
            do {
                throwEvent = viewApi.consumeThrowableEvent();
                if (throwEvent) RT.GameThrowables.applyNetworkEvent(throwEvent);
            } while (throwEvent);
        }

        if (RT.GameThrowables && RT.GameThrowables.update) {
            RT.GameThrowables.update(dt, function () {});
        }
    }

    runtime().GameNetFeedbackSync = {
        syncGameplayFeedback: syncGameplayFeedback,
        notifyPredictedLocalHit: registerPredictedLocalHit,
        emitPredictedLocalDamageFeedback: emitPredictedLocalDamageFeedback,
        emitPredictedLocalHitFeedback: emitPredictedLocalDamageFeedback
    };
})();
