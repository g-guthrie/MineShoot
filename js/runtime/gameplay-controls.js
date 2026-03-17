/**
 * gameplay-controls.js - Gameplay input bindings and transient control state.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameGameplayControls
 */
(function () {
    'use strict';

    var runtime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    var activeTestHandle = null;

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
        var listenerRemovers = [];

        function matchesBinding(actionId, event, fallbackCodes) {
            var bindingsApi = runtime.GameInputBindings || null;
            if (bindingsApi && bindingsApi.matches) {
                return bindingsApi.matches(actionId, event);
            }
            var code = String(event && event.code || '');
            var fallbacks = Array.isArray(fallbackCodes) ? fallbackCodes : [fallbackCodes];
            for (var i = 0; i < fallbacks.length; i++) {
                if (String(fallbacks[i] || '') === code) return true;
            }
            return false;
        }

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

        function listen(target, type, handler, options) {
            if (!target || typeof target.addEventListener !== 'function') return;
            target.addEventListener(type, handler, options);
            listenerRemovers.push(function () {
                if (typeof target.removeEventListener !== 'function') return;
                target.removeEventListener(type, handler, options);
            });
        }

        var weaponSwapInput = runtime.GameWeaponSwapInput && runtime.GameWeaponSwapInput.create
            ? runtime.GameWeaponSwapInput.create({
                applyWeapon: opts.applyWeapon,
                hasInputCapture: hasInputCapture,
                toggleWeapon: function () {
                    return runtime.GameHitscan && runtime.GameHitscan.toggleWeapon
                        ? runtime.GameHitscan.toggleWeapon()
                        : null;
                }
            })
            : null;

        activeTestHandle = weaponSwapInput ? {
            setInputCaptureOverride: function (value) {
                return weaponSwapInput.setInputCaptureOverride
                    ? weaponSwapInput.setInputCaptureOverride(value)
                    : null;
            },
            resetState: function () {
                if (weaponSwapInput.resetState) weaponSwapInput.resetState();
            },
            readState: function () {
                return weaponSwapInput.readState ? weaponSwapInput.readState() : null;
            }
        } : null;

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
                        opts.handleEnemyHit(hitData.hitPoint, hitData.damage, hitData.hitType, hitData.result, hitData.targetId || '');
                    }
                },
                setTransientDebug
            );
            runtime.GameUI.updateAbilityInfo(runtime.GameAbilities.getHudState());
            if (outcome && !outcome.ok && outcome.message) {
                setTransientDebug(outcome.message, 700);
            }
        }

        function triggerReload() {
            if (!hasInputCapture()) return false;
            if (!canUseLocalAction('weapon')) return false;
            var hitscanApi = runtime.GameHitscan;
            if (!hitscanApi || !hitscanApi.reloadCurrentWeapon) return false;
            var currentWeapon = hitscanApi.getCurrentWeapon ? hitscanApi.getCurrentWeapon() : null;
            var weaponId = currentWeapon && currentWeapon.id ? String(currentWeapon.id || '') : '';
            var commandsApi = netCommands();
            if (!weaponId) return false;
            if (currentWeapon) {
                var reloadMs = Number(currentWeapon.reloadMs);
                var magazineSize = Number(currentWeapon.magazineSize);
                var ammoInMag = Number(currentWeapon.ammoInMag);
                if (currentWeapon.reloading) return false;
                if (isFinite(reloadMs) && reloadMs <= 0) return false;
                if (isFinite(magazineSize) && magazineSize <= 0) return false;
                if (isFinite(magazineSize) && magazineSize > 0 && isFinite(ammoInMag) && ammoInMag >= magazineSize) {
                    return false;
                }
            }
            if (multiplayerMode()) {
                if (!commandsApi || !commandsApi.sendReload) {
                    setTransientDebug('Reload unavailable.', 700);
                    return false;
                }
                if (!commandsApi.sendReload(weaponId)) {
                    setTransientDebug('Reload send failed.', 700);
                    return false;
                }
            }
            return !!hitscanApi.reloadCurrentWeapon();
        }

        function bindDocsControls() {
            listen(document, 'keydown', function (e) {
                if (editableTarget(e.target)) return;
                if (matchesBinding('open_manual', e, 'KeyI')) {
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
            listen(document, 'mousedown', function (e) {
                if (e.button !== 0) return;
                if (!hasInputCapture()) return;
                triggerHeld = true;
                if (opts.tryPlayerFire) opts.tryPlayerFire();
            });

            listen(document, 'mouseup', function (e) {
                if (e.button !== 0) return;
                triggerHeld = false;
            });

            listen(window, 'blur', function () {
                triggerHeld = false;
            });
        }

        function bindWeaponControls() {
            listen(document, 'keydown', function (e) {
                var idx = -1;
                if (matchesBinding('weapon_slot_1', e, 'Digit1')) {
                    idx = 0;
                } else if (matchesBinding('weapon_slot_2', e, 'Digit2')) {
                    idx = 1;
                }
                if (idx >= 0) {
                    var weaponOrder = runtime.GameHitscan.getWeaponOrder();
                    if (idx < weaponOrder.length && opts.applyWeapon) {
                        opts.applyWeapon(runtime.GameHitscan.setWeapon(weaponOrder[idx]));
                    }
                }
            });

            listen(document, 'wheel', function (e) {
                if (!weaponSwapInput || !weaponSwapInput.handleWheel) return;
                weaponSwapInput.handleWheel(e);
            }, { passive: false });

            listen(window, 'blur', function () {
                if (weaponSwapInput && weaponSwapInput.resetState) {
                    weaponSwapInput.resetState();
                }
            });
        }

        function bindReloadControls() {
            listen(document, 'keydown', function (e) {
                if (e.repeat) return;
                if (!matchesBinding('reload', e, 'KeyR')) return;
                if (!hasInputCapture()) return;
                e.preventDefault();
                triggerReload();
            });
        }

        function bindSoundToggleControl() {
            var soundToggleBtn = document.getElementById('sound-toggle-btn');
            if (!soundToggleBtn || !runtime.GameAudio) return;
            if (!runtime.GameAudio.setMuted || !runtime.GameAudio.isMuted) return;

            function refreshLabel() {
                soundToggleBtn.textContent = runtime.GameAudio.isMuted() ? 'SOUND: OFF' : 'SOUND: ON';
            }

            listen(soundToggleBtn, 'click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                var muted = runtime.GameAudio.setMuted(!runtime.GameAudio.isMuted());
                refreshLabel();
                setTransientDebug(muted ? 'Sound muted' : 'Sound unmuted', 900);
            });

            refreshLabel();
        }

        function bindThrowableControls() {
            listen(document, 'keydown', function (e) {
                if (e.repeat) return;
                if (!matchesBinding('throwable', e, 'KeyQ')) return;
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

            listen(document, 'keyup', function (e) {
                if (!matchesBinding('throwable', e, 'KeyQ')) return;
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
            listen(document, 'keydown', function (e) {
                if (e.repeat) return;
                if (matchesBinding('ability_1', e, 'KeyE')) {
                    triggerAbility(1);
                } else if (matchesBinding('ability_2', e, 'KeyF')) {
                    triggerAbility(2);
                }
            });
        }

        function bindDebugKeys() {
            listen(document, 'keydown', function (e) {
                if (!matchesBinding('toggle_debug', e, 'KeyH')) return;
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
                bindReloadControls();
                bindSoundToggleControl();
                bindThrowableControls();
                bindAbilityControls();
                bindDebugKeys();
            },
            unbind: function () {
                if (!bound) return;
                bound = false;
                while (listenerRemovers.length) {
                    var remove = listenerRemovers.pop();
                    if (typeof remove === 'function') remove();
                }
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
                if (weaponSwapInput && weaponSwapInput.resetState) {
                    weaponSwapInput.resetState();
                }
                if (armedThrowableType || throwableHeldType) {
                    clearArmedThrowablePreview();
                }
            }
        };
    }

    runtime.GameGameplayControls = {
        create: create,
        _test: {
            getActiveHandle: function () {
                return activeTestHandle;
            }
        }
    };
})();
