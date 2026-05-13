/**
 * feedback-sync.js - Consumes multiplayer gameplay feedback queues and syncs throwable state.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameNetFeedbackSync
 */
(function () {
    'use strict';

    var predictedHitFeedback = [];
    var confirmedShotFeedback = [];
    var remoteShotAudioLastAtBySource = {};
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

    function worldVector3(value) {
        if (!value || typeof THREE === 'undefined' || !THREE || !THREE.Vector3) return null;
        var x = Number(value.x);
        var y = Number(value.y);
        var z = Number(value.z);
        if (!isFinite(x) || !isFinite(y) || !isFinite(z)) return null;
        return new THREE.Vector3(x, y, z);
    }

    function feedbackTuning() {
        var shared = sharedApi();
        var network = shared.getNetworkTuning ? shared.getNetworkTuning() : null;
        var feedback = network && network.feedback ? network.feedback : {};
        var confirmedShotWindowMs = Math.max(1, Number(feedback.confirmedShotWindowMs || 5000));
        var confirmedShotStaleWindowMs = Math.max(
            confirmedShotWindowMs,
            Number(feedback.confirmedShotStaleWindowMs || Math.max(30000, confirmedShotWindowMs))
        );
        return {
            predictedHitTtlMs: Math.max(1, Number(feedback.predictedHitTtlMs || 900)),
            confirmedShotWindowMs: confirmedShotWindowMs,
            confirmedShotStaleWindowMs: confirmedShotStaleWindowMs
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
            var ageMs = stamp - Number(entry.firstAt || entry.at || 0);
            if (ageMs < 0 || ageMs > feedbackTuning().confirmedShotStaleWindowMs) continue;
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
        if (!token) return { allow: true, stale: false };
        var stamp = Date.now();
        pruneConfirmedShotFeedback(stamp);
        for (var i = 0; i < confirmedShotFeedback.length; i++) {
            var entry = confirmedShotFeedback[i];
            if (!entry) continue;
            if (String(entry.shotToken || '') === token) {
                entry.at = stamp;
                if ((stamp - Number(entry.firstAt || entry.at || stamp)) > feedbackTuning().confirmedShotWindowMs) {
                    return { allow: false, stale: true };
                }
                return { allow: false, stale: false };
            }
        }
        confirmedShotFeedback.push({
            shotToken: token,
            firstAt: stamp,
            at: stamp
        });
        while (confirmedShotFeedback.length > CONFIRMED_SHOT_MAX) {
            confirmedShotFeedback.shift();
        }
        return { allow: true, stale: false };
    }

    function warnProtocolFault(label, payload) {
        if (globalThis.console && typeof globalThis.console.warn === 'function') {
            globalThis.console.warn(label, payload);
        }
    }

    function handleShotReject(rejection) {
        if (!rejection) return;
        clearPredictedHitFeedbackByShotToken(rejection.shotToken || '');
        warnProtocolFault('[GameNetFeedbackSync] authoritative shot rejected', {
            shotToken: String(rejection.shotToken || ''),
            weaponId: String(rejection.weaponId || ''),
            reason: String(rejection.reason || 'rejected'),
            serverTime: Math.max(0, Number(rejection.serverTime || 0))
        });
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

    function remoteRenderForSource(sourceId) {
        var remoteEntitiesApi = netRemoteEntities();
        var renderMap = remoteEntitiesApi && remoteEntitiesApi.getRenderMap ? remoteEntitiesApi.getRenderMap() : null;
        return renderMap && renderMap.get ? renderMap.get(String(sourceId || '')) : null;
    }

    function shotPresentationConfig(weaponId) {
        var shared = sharedApi();
        var presentation = shared && shared.getWeaponPresentation
            ? shared.getWeaponPresentation(String(weaponId || ''))
            : null;
        var recoil = presentation && presentation.recoil ? presentation.recoil : {};
        var network = shared && shared.getNetworkTuning ? shared.getNetworkTuning() : null;
        var remoteInterpolation = network && network.remoteInterpolation ? network.remoteInterpolation : {};
        var durationMs = Math.max(
            16,
            Number(recoil.muzzleMs || 0),
            Number(remoteInterpolation.muzzleFlashPresentationMs || 70)
        );
        return {
            durationMs: durationMs,
            durationSec: durationMs / 1000
        };
    }

    function triggerShotEffectPresentation(sourceId, event) {
        var render = remoteRenderForSource(sourceId);
        if (!render) return false;
        var token = String(event && event.shotToken || '');
        if (token && render._lastShotEffectPresentationToken === token) return false;
        var config = shotPresentationConfig(event && event.weaponId || '');
        var visibleUntil = Date.now() + config.durationMs;
        render._localMuzzleFlashUntilMs = Math.max(
            Number(render._localMuzzleFlashUntilMs || 0),
            visibleUntil
        );
        render._shotEffectPresentationUntilMs = Math.max(
            Number(render._shotEffectPresentationUntilMs || 0),
            visibleUntil
        );
        var visualApi = render.actorVisual || render.rigApi || null;
        if (event && event.weaponId) {
            render.weaponId = String(event.weaponId || render.weaponId || 'rifle');
            if (render.actorVisual && render.actorVisual.setWeapon) {
                render.actorVisual.setWeapon(render.weaponId);
            } else if (render.rigApi && render.rigApi.setWeapon) {
                render.rigApi.setWeapon(render.weaponId);
            }
        }
        if (visualApi && visualApi.setMuzzleVisible) {
            visualApi.setMuzzleVisible(true);
            render._muzzleVisible = true;
        }
        if (visualApi && visualApi.triggerAction) {
            visualApi.triggerAction('fire', {
                duration: config.durationSec,
                strength: 1,
                shotToken: token
            });
            if (token) render._lastShotEffectPresentationToken = token;
            return true;
        }
        return false;
    }

    function resolveShotEffectOrigin(sourceId, fallbackOrigin) {
        var authoritativeOrigin = worldVector3(fallbackOrigin);
        if (authoritativeOrigin) return authoritativeOrigin;
        var render = remoteRenderForSource(sourceId);
        if (render && render.actorVisual && render.actorVisual.getMuzzleWorldPosition && typeof THREE !== 'undefined' && THREE && THREE.Vector3) {
            var muzzleWorld = render.actorVisual.getMuzzleWorldPosition(new THREE.Vector3());
            var fallbackMuzzle = worldVector3(muzzleWorld);
            if (fallbackMuzzle) return fallbackMuzzle;
        }
        return null;
    }

    function playRemoteShotAudio(event, origin, camera) {
        var RT = runtime();
        if (!RT.GameAudio || !RT.GameAudio.play || !origin || !camera || !camera.position) return;
        if (typeof document !== 'undefined' && document && typeof document.hasFocus === 'function' && !document.hasFocus()) return;
        var sourceId = String(event && event.sourceId || '');
        var weaponId = String(event && event.weaponId || 'rifle') || 'rifle';
        var now = Date.now();
        var minInterval = weaponId === 'machinegun' ? 42 : (weaponId === 'shotgun' || weaponId === 'sniper' ? 95 : 58);
        var key = sourceId + ':' + weaponId;
        if (remoteShotAudioLastAtBySource[key] && (now - remoteShotAudioLastAtBySource[key]) < minInterval) return;
        remoteShotAudioLastAtBySource[key] = now;
        RT.GameAudio.play('fire', {
            weapon: weaponId,
            sourcePosition: { x: origin.x, y: origin.y, z: origin.z },
            listenerPosition: {
                x: camera.position.x,
                y: camera.position.y,
                z: camera.position.z
            },
            nearDistance: 5.5,
            referenceDistance: 10.5,
            distanceRolloff: 1.8,
            maxDistance: 105
        });
    }

    function handleShotEffect(event, camera, selfState) {
        if (!event || !camera) return;
        var sourceId = String(event.sourceId || '');
        var selfId = String(selfState && selfState.id || '');
        if (sourceId && selfId && sourceId === selfId) return;
        var traces = Array.isArray(event.traces) ? event.traces : [];
        if (!traces.length) return;
        triggerShotEffectPresentation(sourceId, event);
        var tracerFx = worldTracerFx();
        if (!tracerFx || !tracerFx.spawnTracer) return;
        var origin = resolveShotEffectOrigin(sourceId, event.origin);
        if (!origin) return;
        playRemoteShotAudio(event, origin, camera);
        var weapon = tracerWeaponConfig(event.weaponId || '');
        for (var i = 0; i < traces.length; i++) {
            var trace = traces[i];
            if (!trace) continue;
            var end = worldVector3(trace);
            if (!end) continue;
            tracerFx.spawnTracer(
                camera,
                weapon,
                end,
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
        var confirmationState = markConfirmedShotToken(feedback.shotToken || '');
        if (confirmationState.stale) {
            warnProtocolFault('[GameNetFeedbackSync] stale confirmed-shot token dropped', {
                shotToken: String(feedback.shotToken || ''),
                weaponId: String(feedback.weaponId || '')
            });
            return;
        }
        var suppressLocalAudio = !!matchedPrediction || !confirmationState.allow;
        var suppressDamageNumber = !!matchedPrediction || !confirmationState.allow;
        var shouldShowAuthoritativeConfirm = !feedback.killed && confirmationState.allow;

        if (!suppressLocalAudio && RT.GameAudio && RT.GameAudio.play) {
            RT.GameAudio.play('bulletImpact', {
                killed: !!feedback.killed,
                hitType: feedback.hitType || 'body',
                weapon: feedback.weaponId || ''
            });
        }
        if (feedback.killed && confirmationState.allow) {
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

        if (viewApi && viewApi.consumeShotReject) {
            var shotReject = null;
            do {
                shotReject = viewApi.consumeShotReject();
                if (shotReject) handleShotReject(shotReject);
            } while (shotReject);
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
