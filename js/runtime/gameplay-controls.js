/**
 * gameplay-controls.js - Gameplay input bindings and transient control state.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameGameplayControls
 */
(function () {
    'use strict';

    var runtime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    var domUtils = runtime.GameDomUtils || null;
    var activeTestHandle = null;
    var activeGameplayControlsInstance = null;

    function inputLabelsApi() {
        return runtime.GameInputLabels || null;
    }

    function create(opts) {
        opts = opts || {};

        var triggerHeld = false;
        var armedThrowableType = '';
        var throwableHeldType = '';
        var virtualCapture = false;
        var touchControlsRoot = null;
        var touchTopbar = null;
        var touchHintEl = null;
        var touchRotatePrompt = null;
        var touchLookSurface = null;
        var touchMoveThumb = null;
        var touchMoveKnob = null;
        var touchFireBtn = null;
        var touchJumpBtn = null;
        var touchMoveState = {
            pointerId: null,
            centerX: 0,
            centerY: 0,
            dx: 0,
            dy: 0,
            sprint: false,
            jump: false
        };
        var touchLookState = {
            pointerId: null,
            lastX: 0,
            lastY: 0
        };
        var touchFireState = {
            pointerId: null,
            startX: 0,
            startY: 0,
            gestureTriggered: false,
            armed: false,
            pressTimer: 0
        };
        var touchJumpState = {
            pointerId: null,
            lastTapAt: 0
        };
        var touchOrientationState = 'landscape';
        var bound = false;
        var listenerRemovers = [];

        function matchesBinding(actionId, event, fallbackCodes) {
            var labelsApi = inputLabelsApi();
            return !!(labelsApi && labelsApi.matchesBinding && labelsApi.matchesBinding(actionId, event, fallbackCodes));
        }

        function getCamera() {
            return opts.getCamera ? opts.getCamera() : null;
        }

        function multiplayerMode() {
            return !!(opts.getMultiplayerMode && opts.getMultiplayerMode());
        }

        function netCommands() {
            var net = runtime.GameNet || null;
            return net && net.commands ? net.commands : null;
        }

        function hasInputCapture() {
            return (!!virtualCapture && touchLandscapeReady()) || !!(opts.hasInputCapture && opts.hasInputCapture());
        }

        function touchDevice() {
            return !!(
                typeof window !== 'undefined' &&
                (
                    ('ontouchstart' in window) ||
                    Number(navigator && navigator.maxTouchPoints || 0) > 0 ||
                    (window.matchMedia && window.matchMedia('(pointer: coarse)').matches)
                )
            );
        }

        function playerApi() {
            return runtime.GamePlayer || null;
        }

        function sessionApi() {
            return runtime.GameSession || null;
        }

        function docsLoaderApi() {
            return runtime.GameRuntimeLoader || null;
        }

        function docsApi() {
            if (opts.getDocsApi) {
                var providedApi = opts.getDocsApi();
                if (providedApi) return providedApi;
            }
            var loader = docsLoaderApi();
            if (loader && loader.getLoadedDocsRuntime) {
                return loader.getLoadedDocsRuntime() || null;
            }
            return null;
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

        function touchLandscapeReady() {
            return touchOrientationState !== 'portrait';
        }

        function setTouchRootVisible(visible) {
            if (!touchControlsRoot) return;
            touchControlsRoot.hidden = !visible;
            touchControlsRoot.setAttribute('aria-hidden', visible ? 'false' : 'true');
            touchControlsRoot.setAttribute('data-active', visible ? 'true' : 'false');
        }

        function setTouchMoveVisual(dx, dy) {
            if (!touchMoveKnob) return;
            touchMoveKnob.style.transform = 'translate(' + dx.toFixed(1) + 'px, ' + dy.toFixed(1) + 'px)';
        }

        function selectedThrowableLabel() {
            var throwablesApi = runtime.GameThrowables;
            if (!throwablesApi || !throwablesApi.getSelectedThrowable) return 'throwable';
            var selectedId = String(throwablesApi.getSelectedThrowable() || '');
            if (!selectedId) return 'throwable';
            var def = throwablesApi.getThrowableDef ? throwablesApi.getThrowableDef(selectedId) : null;
            return String((def && def.label) || selectedId || 'throwable').toUpperCase();
        }

        function refreshTouchGestureHint() {
            if (!touchHintEl) return;
            touchHintEl.textContent =
                'FIRE swipe up throws ' + selectedThrowableLabel() +
                '. Swipe down reloads. Swipe sideways swaps. Double-tap JUMP rolls.';
        }

        function syncTouchMovementState() {
            var player = playerApi();
            if (!player || !player.setMovementInputState) return;
            var deadzone = 0.16;
            var x = Number(touchMoveState.dx || 0);
            var y = Number(touchMoveState.dy || 0);
            player.setMovementInputState({
                forward: touchLandscapeReady() && y < -deadzone,
                backward: touchLandscapeReady() && y > deadzone,
                left: touchLandscapeReady() && x < -deadzone,
                right: touchLandscapeReady() && x > deadzone,
                jump: touchLandscapeReady() && !!touchMoveState.jump,
                sprint: touchLandscapeReady() && !!touchMoveState.sprint
            });
        }

        function resetTouchMovementState() {
            touchMoveState.pointerId = null;
            touchMoveState.centerX = 0;
            touchMoveState.centerY = 0;
            touchMoveState.dx = 0;
            touchMoveState.dy = 0;
            touchMoveState.sprint = false;
            touchMoveState.jump = false;
            setTouchMoveVisual(0, 0);
            var player = playerApi();
            if (player && player.clearMovementInputState) {
                player.clearMovementInputState();
            }
        }

        function beginMovePointer(event) {
            if (!event || touchMoveState.pointerId !== null || !touchLandscapeReady()) return;
            touchMoveState.pointerId = event.pointerId;
            touchMoveState.centerX = Number(event.clientX || 0);
            touchMoveState.centerY = Number(event.clientY || 0);
            if (touchMoveThumb && touchMoveThumb.setPointerCapture) {
                try {
                    touchMoveThumb.setPointerCapture(event.pointerId);
                } catch (_err) {
                    // no-op
                }
            }
        }

        function updateMovePointer(event) {
            if (!event || touchMoveState.pointerId !== event.pointerId || !touchLandscapeReady()) return;
            var radius = 46;
            var rawX = Number(event.clientX || 0) - touchMoveState.centerX;
            var rawY = Number(event.clientY || 0) - touchMoveState.centerY;
            var dist = Math.sqrt((rawX * rawX) + (rawY * rawY));
            var scale = dist > radius ? (radius / dist) : 1;
            var clampedX = rawX * scale;
            var clampedY = rawY * scale;
            touchMoveState.dx = clampedX / radius;
            touchMoveState.dy = clampedY / radius;
            touchMoveState.sprint = dist > (radius * 0.82);
            setTouchMoveVisual(clampedX, clampedY);
            syncTouchMovementState();
        }

        function endMovePointer(event) {
            if (!event || touchMoveState.pointerId !== event.pointerId) return;
            resetTouchMovementState();
        }

        function beginLookPointer(event) {
            if (!event || touchLookState.pointerId !== null || !touchLandscapeReady()) return;
            if (touchMoveState.pointerId === event.pointerId) return;
            touchLookState.pointerId = event.pointerId;
            touchLookState.lastX = Number(event.clientX || 0);
            touchLookState.lastY = Number(event.clientY || 0);
            if (touchLookSurface && touchLookSurface.setPointerCapture) {
                try {
                    touchLookSurface.setPointerCapture(event.pointerId);
                } catch (_err) {
                    // no-op
                }
            }
        }

        function updateLookPointer(event) {
            if (!event || touchLookState.pointerId !== event.pointerId || !touchLandscapeReady()) return;
            var nextX = Number(event.clientX || 0);
            var nextY = Number(event.clientY || 0);
            var deltaX = nextX - touchLookState.lastX;
            var deltaY = nextY - touchLookState.lastY;
            touchLookState.lastX = nextX;
            touchLookState.lastY = nextY;
            var player = playerApi();
            if (player && player.applyLookDelta) {
                player.applyLookDelta(deltaX, deltaY, 1.35);
            }
        }

        function endLookPointer(event) {
            if (!event || touchLookState.pointerId !== event.pointerId) return;
            touchLookState.pointerId = null;
            touchLookState.lastX = 0;
            touchLookState.lastY = 0;
        }

        function setJumpPressed(pressed) {
            touchMoveState.jump = !!pressed && touchLandscapeReady();
            syncTouchMovementState();
        }

        function setTriggerPressed(pressed) {
            triggerHeld = !!pressed && touchLandscapeReady();
            if (triggerHeld && opts.tryPlayerFire) {
                opts.tryPlayerFire();
            }
        }

        function clearTouchFirePressTimer() {
            if (!touchFireState.pressTimer || typeof clearTimeout !== 'function') return;
            clearTimeout(touchFireState.pressTimer);
            touchFireState.pressTimer = 0;
        }

        function resetTouchFireState() {
            clearTouchFirePressTimer();
            touchFireState.pointerId = null;
            touchFireState.startX = 0;
            touchFireState.startY = 0;
            touchFireState.gestureTriggered = false;
            touchFireState.armed = false;
            if (touchFireBtn) touchFireBtn.removeAttribute('data-gesture');
        }

        function performWeaponSwap() {
            if (!runtime.GameHitscan || !runtime.GameHitscan.toggleWeapon || !opts.applyWeapon) return false;
            var weapon = runtime.GameHitscan.toggleWeapon();
            if (!weapon) return false;
            opts.applyWeapon(weapon);
            refreshTouchGestureHint();
            return true;
        }

        function trySelectedThrowable() {
            var throwablesApi = runtime.GameThrowables;
            if (!throwablesApi || !throwablesApi.getSelectedThrowable) return null;
            var type = String(throwablesApi.getSelectedThrowable() || '');
            if (!type) return null;
            var camera = getCamera();
            var intent = throwablesApi.buildThrowIntent
                ? throwablesApi.buildThrowIntent(camera)
                : null;
            return tryThrow(type, intent);
        }

        function resolveFireGesture(event) {
            var dx = Number(event.clientX || 0) - touchFireState.startX;
            var dy = Number(event.clientY || 0) - touchFireState.startY;
            var absX = Math.abs(dx);
            var absY = Math.abs(dy);
            if (Math.max(absX, absY) < 34) return '';
            if (absY > absX * 1.18) {
                return dy < 0 ? 'throw' : 'reload';
            }
            if (absX > absY * 1.18) {
                return 'swap';
            }
            return '';
        }

        function triggerFireGesture(gesture) {
            if (!gesture) return false;
            clearTouchFirePressTimer();
            if (touchFireState.armed) {
                setTriggerPressed(false);
            }
            touchFireState.gestureTriggered = true;
            if (touchFireBtn) touchFireBtn.setAttribute('data-gesture', gesture);
            if (gesture === 'throw') {
                trySelectedThrowable();
                return true;
            }
            if (gesture === 'reload') {
                triggerReload();
                return true;
            }
            if (gesture === 'swap') {
                performWeaponSwap();
                return true;
            }
            return false;
        }

        function beginFirePointer(event) {
            if (!event || touchFireState.pointerId !== null || !touchLandscapeReady()) return;
            touchFireState.pointerId = event.pointerId;
            touchFireState.startX = Number(event.clientX || 0);
            touchFireState.startY = Number(event.clientY || 0);
            touchFireState.gestureTriggered = false;
            touchFireState.armed = false;
            if (touchFireBtn && touchFireBtn.setPointerCapture) {
                try {
                    touchFireBtn.setPointerCapture(event.pointerId);
                } catch (_err) {
                    // no-op
                }
            }
            clearTouchFirePressTimer();
            if (typeof setTimeout === 'function') {
                touchFireState.pressTimer = setTimeout(function () {
                    touchFireState.pressTimer = 0;
                    if (touchFireState.pointerId !== event.pointerId || touchFireState.gestureTriggered) return;
                    touchFireState.armed = true;
                    setTriggerPressed(true);
                }, 48);
            }
        }

        function updateFirePointer(event) {
            if (!event || touchFireState.pointerId !== event.pointerId || !touchLandscapeReady()) return;
            if (touchFireState.gestureTriggered) return;
            var gesture = resolveFireGesture(event);
            if (gesture) {
                triggerFireGesture(gesture);
            }
        }

        function endFirePointer(event) {
            if (!event || touchFireState.pointerId !== event.pointerId) return;
            if (touchFireState.pressTimer) {
                clearTouchFirePressTimer();
                if (!touchFireState.gestureTriggered && opts.tryPlayerFire && touchLandscapeReady()) {
                    opts.tryPlayerFire();
                }
            } else if (touchFireState.armed) {
                setTriggerPressed(false);
            }
            resetTouchFireState();
        }

        function cancelFirePointer(event) {
            if (!event || touchFireState.pointerId !== event.pointerId) return;
            if (touchFireState.armed) {
                setTriggerPressed(false);
            }
            resetTouchFireState();
        }

        function beginJumpPointer(event) {
            if (!event || touchJumpState.pointerId !== null || !touchLandscapeReady()) return;
            var stamp = Date.now();
            var doubleTap = (stamp - Number(touchJumpState.lastTapAt || 0)) < 260;
            touchJumpState.lastTapAt = stamp;
            if (doubleTap) {
                triggerRoll();
                setJumpPressed(false);
                return;
            }
            touchJumpState.pointerId = event.pointerId;
            if (touchJumpBtn && touchJumpBtn.setPointerCapture) {
                try {
                    touchJumpBtn.setPointerCapture(event.pointerId);
                } catch (_err) {
                    // no-op
                }
            }
            setJumpPressed(true);
        }

        function endJumpPointer(event) {
            if (!event || touchJumpState.pointerId !== event.pointerId) return;
            touchJumpState.pointerId = null;
            setJumpPressed(false);
        }

        function lockLandscapeOrientation() {
            var orientationApi = window.screen && window.screen.orientation;
            if (!orientationApi || typeof orientationApi.lock !== 'function') return;
            try {
                var maybePromise = orientationApi.lock('landscape');
                if (maybePromise && typeof maybePromise.catch === 'function') {
                    maybePromise.catch(function () {});
                }
            } catch (_err) {
                // no-op
            }
        }

        function unlockLandscapeOrientation() {
            var orientationApi = window.screen && window.screen.orientation;
            if (!orientationApi || typeof orientationApi.unlock !== 'function') return;
            try {
                orientationApi.unlock();
            } catch (_err) {
                // no-op
            }
        }

        function updateTouchOrientationState() {
            var next = window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';
            touchOrientationState = next;
            if (touchControlsRoot) {
                touchControlsRoot.setAttribute('data-orientation', next);
            }
            if (next === 'portrait') {
                setTriggerPressed(false);
                setJumpPressed(false);
                resetTouchMovementState();
                endLookPointer({ pointerId: touchLookState.pointerId });
                resetTouchFireState();
                touchJumpState.pointerId = null;
                touchJumpState.lastTapAt = 0;
            }
            return next;
        }

        function activateTouchCaptureInternal() {
            if (!touchDevice()) return false;
            buildTouchControls();
            lockLandscapeOrientation();
            virtualCapture = true;
            setTouchRootVisible(true);
            updateTouchOrientationState();
            refreshTouchGestureHint();
            return true;
        }

        function deactivateTouchCaptureInternal() {
            virtualCapture = false;
            setTouchRootVisible(false);
            setTriggerPressed(false);
            setJumpPressed(false);
            resetTouchMovementState();
            endLookPointer({ pointerId: touchLookState.pointerId });
            resetTouchFireState();
            touchJumpState.pointerId = null;
            touchJumpState.lastTapAt = 0;
            unlockLandscapeOrientation();
            return true;
        }

        function pauseTouchGameplay() {
            if (!virtualCapture) return false;
            deactivateTouchCaptureInternal();
            var session = sessionApi();
            if (session && session.showGameplayPrompt) {
                session.showGameplayPrompt();
                return true;
            }
            return false;
        }

        function buildTouchControls() {
            if (touchControlsRoot || !touchDevice() || typeof document === 'undefined') return;
            var root = document.createElement('div');
            root.id = 'touch-controls';
            root.hidden = true;
            root.setAttribute('aria-hidden', 'true');
            root.setAttribute('data-orientation', 'landscape');
            root.setAttribute('data-active', 'false');

            var look = document.createElement('div');
            look.className = 'touch-look-surface';
            root.appendChild(look);

            var topbar = document.createElement('div');
            topbar.className = 'touch-topbar';
            topbar.innerHTML =
                '<div class="touch-gesture-hint" aria-live="polite"></div>' +
                '<button type="button" class="touch-btn touch-btn-menu" data-touch-action="menu">MENU</button>';
            root.appendChild(topbar);

            var rotatePrompt = document.createElement('div');
            rotatePrompt.className = 'touch-rotate-prompt';
            rotatePrompt.innerHTML =
                '<div class="touch-rotate-card">' +
                    '<div class="touch-rotate-title">Rotate To Landscape</div>' +
                    '<div class="touch-rotate-copy">The phone controls are built for sideways play.</div>' +
                '</div>';
            root.appendChild(rotatePrompt);

            var moveThumb = document.createElement('div');
            moveThumb.className = 'touch-stick touch-stick-left';
            moveThumb.innerHTML = '<div class="touch-stick-ring"><div class="touch-stick-knob"></div></div><div class="touch-stick-label">MOVE</div>';
            root.appendChild(moveThumb);

            var actionCluster = document.createElement('div');
            actionCluster.className = 'touch-action-cluster';
            actionCluster.innerHTML =
                '<button type="button" class="touch-btn touch-btn-jump" data-touch-action="jump">' +
                    '<span class="touch-btn-title">JUMP</span>' +
                    '<span class="touch-btn-note">double tap to roll</span>' +
                '</button>' +
                '<button type="button" class="touch-btn touch-btn-fire" data-touch-action="fire">' +
                    '<span class="touch-btn-title">FIRE</span>' +
                    '<span class="touch-btn-note">swipe for throw, reload, or swap</span>' +
                '</button>';
            root.appendChild(actionCluster);
            document.body.appendChild(root);

            touchControlsRoot = root;
            touchTopbar = topbar;
            touchHintEl = topbar.querySelector('.touch-gesture-hint');
            touchRotatePrompt = rotatePrompt;
            touchLookSurface = look;
            touchMoveThumb = moveThumb;
            touchMoveKnob = moveThumb.querySelector('.touch-stick-knob');
            touchJumpBtn = actionCluster.querySelector('[data-touch-action="jump"]');
            touchFireBtn = actionCluster.querySelector('[data-touch-action="fire"]');

            listen(window, 'resize', updateTouchOrientationState);
            listen(window, 'orientationchange', updateTouchOrientationState);
            if (window.screen && window.screen.orientation && typeof window.screen.orientation.addEventListener === 'function') {
                listen(window.screen.orientation, 'change', updateTouchOrientationState);
            }

            listen(moveThumb, 'pointerdown', function (event) {
                if (!virtualCapture || !touchLandscapeReady()) return;
                event.preventDefault();
                beginMovePointer(event);
                updateMovePointer(event);
            });
            listen(moveThumb, 'pointermove', function (event) {
                if (!virtualCapture || !touchLandscapeReady()) return;
                event.preventDefault();
                updateMovePointer(event);
            });
            listen(moveThumb, 'pointerup', function (event) {
                event.preventDefault();
                endMovePointer(event);
            });
            listen(moveThumb, 'pointercancel', function (event) {
                endMovePointer(event);
            });

            listen(look, 'pointerdown', function (event) {
                if (!virtualCapture || !touchLandscapeReady()) return;
                event.preventDefault();
                beginLookPointer(event);
            });
            listen(look, 'pointermove', function (event) {
                if (!virtualCapture || !touchLandscapeReady()) return;
                if (touchLookState.pointerId === null) return;
                event.preventDefault();
                updateLookPointer(event);
            });
            listen(look, 'pointerup', function (event) {
                endLookPointer(event);
            });
            listen(look, 'pointercancel', function (event) {
                endLookPointer(event);
            });

            listen(touchFireBtn, 'pointerdown', function (event) {
                if (!virtualCapture || !touchLandscapeReady()) return;
                event.preventDefault();
                beginFirePointer(event);
            });
            listen(touchFireBtn, 'pointermove', function (event) {
                if (!virtualCapture || !touchLandscapeReady()) return;
                event.preventDefault();
                updateFirePointer(event);
            });
            listen(touchFireBtn, 'pointerup', function (event) {
                event.preventDefault();
                endFirePointer(event);
            });
            listen(touchFireBtn, 'pointercancel', function (event) {
                cancelFirePointer(event);
            });

            listen(touchJumpBtn, 'pointerdown', function (event) {
                if (!virtualCapture || !touchLandscapeReady()) return;
                event.preventDefault();
                beginJumpPointer(event);
            });
            listen(touchJumpBtn, 'pointerup', function (event) {
                event.preventDefault();
                endJumpPointer(event);
            });
            listen(touchJumpBtn, 'pointercancel', function (event) {
                endJumpPointer(event);
            });

            listen(topbar.querySelector('[data-touch-action="menu"]'), 'click', function (event) {
                if (!virtualCapture) return;
                event.preventDefault();
                pauseTouchGameplay();
            });

            refreshTouchGestureHint();
            updateTouchOrientationState();
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
            refreshTouchGestureHint();
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

            var throwablesApi = runtime.GameThrowables;
            if (!throwableHasCharges(throwablesApi, type)) {
                setTransientDebug(type + ' is recharging.', 600);
                return { ok: false, reason: 'cooldown' };
            }

            var camera = getCamera();
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

        function triggerRoll() {
            if (!hasInputCapture()) return false;
            var playerApi = runtime.GamePlayer || null;
            if (!playerApi || !playerApi.tryRoll) return false;
            var rollOptions = playerApi.peekRollActionOptions ? playerApi.peekRollActionOptions() : null;
            var triggered = !!playerApi.tryRoll();
            if (!triggered) return false;
            if (multiplayerMode()) {
                var commandsApi = netCommands();
                if (commandsApi && commandsApi.sendRoll && rollOptions) {
                    commandsApi.sendRoll(rollOptions);
                }
            }
            return true;
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
                if (domUtils && domUtils.isEditableTarget && domUtils.isEditableTarget(e.target)) return;

                var loadedDocsApi = docsApi();
                if (e.code === 'Escape' && loadedDocsApi && loadedDocsApi.isOpen && loadedDocsApi.isOpen()) {
                    e.preventDefault();
                    e.stopPropagation();
                    loadedDocsApi.close();
                    return;
                }

                // Docs toggle via keybind is handled by menu-shell.js global listener;
                // skip here to avoid double-toggle.
            });
        }

        function bindShooting() {
            if (touchDevice()) buildTouchControls();
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
                setTriggerPressed(false);
                resetTouchFireState();
                setJumpPressed(false);
                endLookPointer({ pointerId: touchLookState.pointerId });
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

        function throwableHasCharges(throwablesApi, type) {
            if (!throwablesApi || !throwablesApi.getState) return false;
            var state = throwablesApi.getState();
            var entry = state && state[type];
            return !!(entry && entry.charges > 0);
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

                // Don't arm preview or throw if no charges available
                if (!throwableHasCharges(throwablesApi, selectedType)) {
                    setTransientDebug(selectedType + ' is recharging.', 600);
                    return;
                }

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

        function bindRollControls() {
            listen(document, 'keydown', function (e) {
                if (e.repeat) return;
                if (!matchesBinding('roll', e, 'KeyE')) return;
                if (!hasInputCapture()) return;
                e.preventDefault();
                triggerRoll();
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
                activeGameplayControlsInstance = this;
                bindDocsControls();
                bindShooting();
                bindWeaponControls();
                bindReloadControls();
                bindSoundToggleControl();
                bindThrowableControls();
                bindRollControls();
                bindDebugKeys();
            },
            unbind: function () {
                if (!bound) return;
                bound = false;
                while (listenerRemovers.length) {
                    var remove = listenerRemovers.pop();
                    if (typeof remove === 'function') remove();
                }
                if (activeGameplayControlsInstance === this) {
                    activeGameplayControlsInstance = null;
                }
                if (touchControlsRoot && touchControlsRoot.parentNode) {
                    touchControlsRoot.parentNode.removeChild(touchControlsRoot);
                }
                touchControlsRoot = null;
                touchTopbar = null;
                touchHintEl = null;
                touchRotatePrompt = null;
                touchLookSurface = null;
                touchMoveThumb = null;
                touchMoveKnob = null;
                touchFireBtn = null;
                touchJumpBtn = null;
                deactivateTouchCaptureInternal();
                touchLookState.pointerId = null;
            },
            clearArmedThrowablePreview: clearArmedThrowablePreview,
            updateArmedThrowablePreview: updateArmedThrowablePreview,
            hasArmedThrowablePreview: function () {
                return !!armedThrowableType;
            },
            isTriggerHeld: function () {
                return !!triggerHeld;
            },
            isTouchMode: function () {
                return touchDevice();
            },
            hasVirtualCapture: function () {
                return !!virtualCapture && touchLandscapeReady();
            },
            activateTouchCapture: function () {
                return activateTouchCaptureInternal();
            },
            deactivateTouchCapture: function () {
                return deactivateTouchCaptureInternal();
            },
            releaseTransientInput: function () {
                setTriggerPressed(false);
                if (weaponSwapInput && weaponSwapInput.resetState) {
                    weaponSwapInput.resetState();
                }
                if (armedThrowableType || throwableHeldType) {
                    clearArmedThrowablePreview();
                }
                setJumpPressed(false);
                resetTouchMovementState();
                endLookPointer({ pointerId: touchLookState.pointerId });
                resetTouchFireState();
            }
        };
    }

    runtime.GameGameplayControls = {
        create: create,
        hasVirtualCapture: function () {
            return !!(
                activeGameplayControlsInstance &&
                activeGameplayControlsInstance.hasVirtualCapture &&
                activeGameplayControlsInstance.hasVirtualCapture()
            );
        },
        isTouchMode: function () {
            return !!(
                activeGameplayControlsInstance &&
                activeGameplayControlsInstance.isTouchMode &&
                activeGameplayControlsInstance.isTouchMode()
            );
        },
        _test: {
            getActiveHandle: function () {
                return activeTestHandle;
            }
        }
    };
})();
