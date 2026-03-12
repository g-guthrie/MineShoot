/**
 * gameplay-controls.js - Gameplay input bindings and transient control state.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameGameplayControls
 */
(function () {
    'use strict';

    var runtime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};

    function editableTarget(target) {
        var node = target || null;
        var tagName = node && node.tagName ? String(node.tagName).toUpperCase() : '';
        if (node && node.isContentEditable) return true;
        return tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT';
    }

    function create(opts) {
        opts = opts || {};

        var triggerHeld = false;
        var armedThrowableType = '';
        var throwableHeldType = '';
        var bound = false;

        function getCamera() {
            return opts.getCamera ? opts.getCamera() : null;
        }

        function multiplayerMode() {
            return !!(opts.getMultiplayerMode && opts.getMultiplayerMode());
        }

        function netCommands() {
            var net = runtime.GameNet || null;
            return net && net.commands ? net.commands : net;
        }

        function hasInputCapture() {
            return !!(opts.hasInputCapture && opts.hasInputCapture());
        }

        function canUseLocalAction(actionType) {
            return !!(opts.canUseLocalAction && opts.canUseLocalAction(actionType));
        }

        function setTransientDebug(text, ms) {
            if (opts.setTransientDebug) opts.setTransientDebug(text, ms);
        }

        function clearTrackingReticle() {
            if (runtime.GameUI && runtime.GameUI.updateTrackingReticle) {
                runtime.GameUI.updateTrackingReticle(false, false);
            }
        }

        function clearArmedThrowablePreview() {
            armedThrowableType = '';
            throwableHeldType = '';
            var throwablesApi = runtime.GameThrowables;
            if (throwablesApi && throwablesApi.clearTrajectoryPreview) {
                throwablesApi.clearTrajectoryPreview();
            }
            clearTrackingReticle();
        }

        function updateArmedThrowablePreview() {
            var throwablesApi = runtime.GameThrowables;
            if (!armedThrowableType) {
                if (throwablesApi && throwablesApi.clearTrajectoryPreview) {
                    throwablesApi.clearTrajectoryPreview();
                }
                clearTrackingReticle();
                return;
            }
            if (!hasInputCapture()) {
                clearArmedThrowablePreview();
                return;
            }
            if (!throwablesApi) return;

            var camera = getCamera();
            var previewType = throwablesApi.getPreviewType ? throwablesApi.getPreviewType(armedThrowableType) : 'none';
            if (previewType === 'trajectory' && throwablesApi.updateTrajectoryPreview) {
                throwablesApi.updateTrajectoryPreview(armedThrowableType, camera);
                return;
            }
            if (previewType !== 'cone') return;

            var hasTarget = false;
            if (throwablesApi.checkPlasmaLockInCone) {
                hasTarget = throwablesApi.checkPlasmaLockInCone(camera);
            }
            if (runtime.GameUI && runtime.GameUI.updateTrackingReticle) {
                var def = throwablesApi.getThrowableDef ? throwablesApi.getThrowableDef(armedThrowableType) : null;
                var halfAngleDeg = (def && def.acquireHalfAngleDeg) ? def.acquireHalfAngleDeg : 35;
                runtime.GameUI.updateTrackingReticle(true, hasTarget, halfAngleDeg, {
                    fov: camera && camera.fov ? camera.fov : 60,
                    aspect: camera && camera.aspect ? camera.aspect : (window.innerWidth / Math.max(1, window.innerHeight))
                });
            }
        }

        function triggerLocalThrowFeedback() {
            if (runtime.GamePlayer && runtime.GamePlayer.triggerAction) {
                runtime.GamePlayer.triggerAction('throw');
            }
            if (runtime.GameAudio && runtime.GameAudio.play) {
                runtime.GameAudio.play('throw');
            }
        }

        function tryThrow(type, throwIntentOverride) {
            if (!canUseLocalAction('throwable')) return null;
            if (!hasInputCapture()) return null;

            var camera = getCamera();
            var throwablesApi = runtime.GameThrowables;
            var throwIntent = throwIntentOverride || (throwablesApi && throwablesApi.buildThrowIntent
                ? throwablesApi.buildThrowIntent(camera)
                : null);

            var commandsApi = netCommands();
            if (multiplayerMode() && commandsApi && commandsApi.sendThrow) {
                var clientThrowId = throwablesApi && throwablesApi.buildClientThrowId
                    ? throwablesApi.buildClientThrowId()
                    : ('cthrow-' + Date.now().toString(36));
                if (throwablesApi && throwablesApi.throwPredicted) {
                    throwablesApi.throwPredicted(type, camera, clientThrowId, throwIntent);
                }
                commandsApi.sendThrow(type, clientThrowId, throwIntent);
                triggerLocalThrowFeedback();
                setTransientDebug('Throw sent: ' + type, 650);
                return { ok: true, sent: true };
            }

            var outcome = throwablesApi.throw(type, camera, throwIntent);
            runtime.GameUI.updateThrowableInfo(outcome.state);
            if (outcome.ok) {
                triggerLocalThrowFeedback();
            }
            if (!outcome.ok && outcome.reason === 'cooldown') {
                setTransientDebug(type + ' is recharging.', 600);
            }
            return outcome;
        }

        function triggerAbility(slotIndex) {
            if (!hasInputCapture()) return;
            if (!canUseLocalAction('ability')) return;

            var camera = getCamera();
            var commandsApi = netCommands();
            if (multiplayerMode() && commandsApi && commandsApi.sendAbilityCast) {
                var preparedCast = runtime.GameAbilities.prepareNetCast
                    ? runtime.GameAbilities.prepareNetCast(slotIndex, camera)
                    : { ok: true, slot: Number(slotIndex) === 2 ? 2 : 1, castData: null, commit: null };
                if (!preparedCast || preparedCast.ok === false) {
                    if (preparedCast && preparedCast.message) {
                        setTransientDebug(preparedCast.message, 700);
                    }
                    return;
                }
                commandsApi.sendAbilityCast(preparedCast.slot, preparedCast.castData);
                if (preparedCast.commit) {
                    preparedCast.commit();
                }
                return;
            }

            var playerPos = runtime.GamePlayer.getPosition();
            var rot = runtime.GamePlayer.getRotation();
            var outcome = runtime.GameAbilities.triggerAbility(
                slotIndex,
                camera,
                playerPos,
                rot,
                function (hitData) {
                    if (!hitData || !hitData.result) return;
                    if (opts.handleEnemyHit) {
                        opts.handleEnemyHit(hitData.hitPoint, hitData.damage, hitData.hitType, hitData.result);
                    }
                },
                setTransientDebug
            );
            runtime.GameUI.updateAbilityInfo(runtime.GameAbilities.getHudState());
            if (outcome && !outcome.ok && outcome.message) {
                setTransientDebug(outcome.message, 700);
            }
        }

        function bindDocsControls() {
            document.addEventListener('keydown', function (e) {
                if (editableTarget(e.target)) return;
                if (e.code === 'KeyI') {
                    e.preventDefault();
                    if (runtime.GameRuntimeLoader && runtime.GameRuntimeLoader.toggleDocs) {
                        runtime.GameRuntimeLoader.toggleDocs();
                    } else if (runtime.GameDocs && runtime.GameDocs.toggle) {
                        runtime.GameDocs.toggle();
                    }
                    return;
                }

                if (e.code === 'Escape' && runtime.GameDocs && runtime.GameDocs.isOpen && runtime.GameDocs.isOpen()) {
                    runtime.GameDocs.close();
                }
            });
        }

        function bindShooting() {
            document.addEventListener('mousedown', function (e) {
                if (e.button !== 0) return;
                if (!hasInputCapture()) return;
                triggerHeld = true;
                if (opts.tryPlayerFire) opts.tryPlayerFire();
            });

            document.addEventListener('mouseup', function (e) {
                if (e.button !== 0) return;
                triggerHeld = false;
            });

            window.addEventListener('blur', function () {
                triggerHeld = false;
            });
        }

        function bindWeaponControls() {
            document.addEventListener('keydown', function (e) {
                if (e.code === 'Digit1' || e.code === 'Digit2') {
                    var weaponOrder = runtime.GameHitscan.getWeaponOrder();
                    var idx = parseInt(e.code.replace('Digit', ''), 10) - 1;
                    if (idx >= 0 && idx < weaponOrder.length && opts.applyWeapon) {
                        opts.applyWeapon(runtime.GameHitscan.setWeapon(weaponOrder[idx]));
                    }
                    return;
                }
            });

            var wheelCooldownUntil = 0;
            var wheelScrollAccum = 0;
            var wheelGestureLatched = false;
            var wheelLatchedDirection = 0;
            var WHEEL_SCROLL_THRESHOLD = 3;
            var WHEEL_COOLDOWN_MS = 500;
            var WHEEL_RELEASE_EPSILON = 1.1;

            document.addEventListener('wheel', function (e) {
                if (!hasInputCapture()) return;
                e.preventDefault();
                var now = performance.now();
                var primaryDelta = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
                var direction = primaryDelta === 0 ? 0 : (primaryDelta > 0 ? 1 : -1);
                var dominantMagnitude = Math.max(Math.abs(e.deltaX), Math.abs(e.deltaY));

                if (dominantMagnitude <= WHEEL_RELEASE_EPSILON) {
                    wheelGestureLatched = false;
                    wheelLatchedDirection = 0;
                    wheelScrollAccum = 0;
                }
                if (wheelGestureLatched && direction !== 0 && direction === wheelLatchedDirection) {
                    wheelScrollAccum = 0;
                    return;
                }
                if (now < wheelCooldownUntil) return;
                if (direction !== 0 && wheelLatchedDirection !== 0 && direction !== wheelLatchedDirection) {
                    wheelScrollAccum = 0;
                    wheelGestureLatched = false;
                    wheelLatchedDirection = 0;
                }

                wheelScrollAccum += dominantMagnitude;
                if (wheelScrollAccum < WHEEL_SCROLL_THRESHOLD) return;

                wheelScrollAccum = 0;
                wheelCooldownUntil = now + WHEEL_COOLDOWN_MS;
                wheelGestureLatched = true;
                wheelLatchedDirection = direction;
                if (opts.applyWeapon) opts.applyWeapon(runtime.GameHitscan.cycleWeapon(1));
            }, { passive: false });
        }

        function bindSoundToggleControl() {
            var soundToggleBtn = document.getElementById('sound-toggle-btn');
            if (!soundToggleBtn || !runtime.GameAudio) return;
            if (!runtime.GameAudio.setMuted || !runtime.GameAudio.isMuted) return;

            function refreshLabel() {
                soundToggleBtn.textContent = runtime.GameAudio.isMuted() ? 'SOUND: OFF' : 'SOUND: ON';
            }

            soundToggleBtn.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                var muted = runtime.GameAudio.setMuted(!runtime.GameAudio.isMuted());
                refreshLabel();
                setTransientDebug(muted ? 'Sound muted' : 'Sound unmuted', 900);
            });

            refreshLabel();
        }

        function bindThrowableControls() {
            document.addEventListener('keydown', function (e) {
                if (e.repeat) return;
                if (e.code !== 'KeyQ') return;
                if (!hasInputCapture()) return;
                if (!canUseLocalAction('throwable')) return;

                var throwablesApi = runtime.GameThrowables;
                if (!throwablesApi || !throwablesApi.getSelectedThrowable) return;

                var selectedType = throwablesApi.getSelectedThrowable();
                if (!selectedType) return;

                var previewType = throwablesApi.getPreviewType ? throwablesApi.getPreviewType(selectedType) : 'none';
                if (previewType === 'none') {
                    tryThrow(selectedType);
                    return;
                }

                armedThrowableType = selectedType;
                throwableHeldType = selectedType;
            });

            document.addEventListener('keyup', function (e) {
                if (e.code !== 'KeyQ') return;
                if (!throwableHeldType) return;
                if (!canUseLocalAction('throwable')) {
                    clearArmedThrowablePreview();
                    return;
                }

                var camera = getCamera();
                var type = throwableHeldType;
                var intent = runtime.GameThrowables && runtime.GameThrowables.buildThrowIntent
                    ? runtime.GameThrowables.buildThrowIntent(camera)
                    : null;
                tryThrow(type, intent);
                clearArmedThrowablePreview();
            });
        }

        function bindAbilityControls() {
            document.addEventListener('keydown', function (e) {
                if (e.repeat) return;
                if (e.code === 'KeyR') {
                    triggerAbility(1);
                } else if (e.code === 'KeyF') {
                    triggerAbility(2);
                }
            });
        }

        function bindDebugKeys() {
            document.addEventListener('keydown', function (e) {
                if (e.code !== 'KeyH') return;
                var enabled = opts.toggleDebugVisuals ? !!opts.toggleDebugVisuals() : false;
                setTransientDebug(enabled ? 'Dev visuals: ON' : 'Dev visuals: OFF', 1100);
            });
        }

        return {
            bind: function () {
                if (bound) return;
                bound = true;
                bindDocsControls();
                bindShooting();
                bindWeaponControls();
                bindSoundToggleControl();
                bindThrowableControls();
                bindAbilityControls();
                bindDebugKeys();
            },
            clearArmedThrowablePreview: clearArmedThrowablePreview,
            updateArmedThrowablePreview: updateArmedThrowablePreview,
            hasArmedThrowablePreview: function () {
                return !!armedThrowableType;
            },
            isTriggerHeld: function () {
                return !!triggerHeld;
            },
            releaseTransientInput: function () {
                triggerHeld = false;
                if (armedThrowableType || throwableHeldType) {
                    clearArmedThrowablePreview();
                }
            }
        };
    }

    runtime.GameGameplayControls = {
        create: create
    };
})();
