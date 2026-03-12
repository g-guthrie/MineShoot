/**
 * feedback-sync.js - Consumes multiplayer gameplay feedback queues and syncs throwable state.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameNetFeedbackSync
 */
(function () {
    'use strict';

    function runtime() {
        return globalThis.__MAYHEM_RUNTIME || {};
    }

    function netView() {
        var RT = runtime();
        var net = RT.GameNet || null;
        return net && net.view ? net.view : net;
    }

    function handleNetworkDamageFeedback(feedback, camera) {
        if (!feedback) return;
        var RT = runtime();
        var isShotgun = feedback.weaponId === 'shotgun';
        var damageNumberSpread = isShotgun ? { spreadX: 152, spreadY: 72 } : undefined;

        if (RT.GameAudio && RT.GameAudio.play) {
            RT.GameAudio.play('bulletImpact', {
                killed: !!feedback.killed,
                hitType: feedback.hitType || 'body',
                weapon: feedback.weaponId || ''
            });
        }
        if (feedback.killed) {
            RT.GameUI.showKillMarker();
        } else {
            RT.GameUI.showHitMarker();
        }

        if (feedback.worldPos && typeof feedback.damage === 'number' && feedback.damage > 0) {
            var wp = feedback.worldPos;
            RT.GameUI.showDamageNumber(
                new THREE.Vector3(Number(wp.x || 0), Number(wp.y || 0), Number(wp.z || 0)),
                feedback.damage,
                !!feedback.killed,
                camera,
                feedback.hitType || 'body',
                damageNumberSpread
            );
        }
    }

    function handleAbilityEvent(event, selfState) {
        if (!event || event.abilityId !== 'choke') return;
        var RT = runtime();
        var viewApi = netView();
        if (!RT.GameAudio || !RT.GameAudio.play || !viewApi) return;

        var selfId = selfState && selfState.id ? String(selfState.id) : '';
        var sourceId = String(event.sourceId || '');
        var targetId = String(event.targetId || '');
        var shouldHear = sourceId && selfId && sourceId === selfId;
        if (!shouldHear && targetId && selfId && targetId === selfId) {
            shouldHear = true;
        }
        if (!shouldHear && RT.GamePlayer && RT.GamePlayer.getPosition && viewApi.damagePointForEntityId) {
            var selfPos = RT.GamePlayer.getPosition();
            var sourcePos = viewApi.damagePointForEntityId(sourceId);
            if (selfPos && sourcePos) {
                var dx = Number(selfPos.x || 0) - Number(sourcePos.x || 0);
                var dy = Number(selfPos.y || 0) - Number(sourcePos.y || 0);
                var dz = Number(selfPos.z || 0) - Number(sourcePos.z || 0);
                shouldHear = Math.sqrt((dx * dx) + (dy * dy) + (dz * dz)) <= 26;
            }
        }
        if (shouldHear) {
            RT.GameAudio.play('chokeCast');
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

        if (viewApi && viewApi.consumeClassCastResult) {
            var castResult = null;
            do {
                castResult = viewApi.consumeClassCastResult();
                if (castResult) {
                    if (castResult.t === 'class_cast_ok') {
                        setTransientDebug((castResult.kind || 'Ability') + ' cast!', 800);
                    } else if (castResult.t === 'class_cast_reject') {
                        setTransientDebug('Ability failed: ' + (castResult.reason || 'rejected'), 700);
                    }
                }
            } while (castResult);
        }

        if (viewApi && viewApi.consumeDamageFeedback) {
            var damageFeedback = null;
            do {
                damageFeedback = viewApi.consumeDamageFeedback();
                if (damageFeedback) handleNetworkDamageFeedback(damageFeedback, camera);
            } while (damageFeedback);
        }

        if (viewApi && viewApi.consumeAbilityEvent) {
            var abilityEvent = null;
            do {
                abilityEvent = viewApi.consumeAbilityEvent();
                if (abilityEvent) handleAbilityEvent(abilityEvent, selfState);
            } while (abilityEvent);
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
                    RT.GameThrowables.confirmPredictedThrow(throwAck.clientThrowId);
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
        syncGameplayFeedback: syncGameplayFeedback
    };
})();
