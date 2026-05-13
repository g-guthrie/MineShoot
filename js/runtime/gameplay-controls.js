/**
 * gameplay-controls.js - Gameplay input bindings and transient control state.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameGameplayControls
 */
(function () {
    'use strict';

    var runtime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    var domUtils = runtime.GameDomUtils || null;
    var DESKTOP_AUTO_FIRE_STORAGE_KEY = 'mayhem.desktopAutoFireEnabled';
    var CAMERA_VIEW_STORAGE_KEY = 'mayhem.cameraViewMode';
    var FIRST_PERSON_CAMERA_OFFSET_STORAGE_KEY = 'mayhem.firstPersonCameraOriginOffset.v1';
    var CAMERA_ORIGIN_TUNE_STEP = 0.05;
    var CAMERA_ORIGIN_TUNE_FINE_STEP = 0.01;
    var CAMERA_ORIGIN_TUNE_MAX_ABS = 1.5;
    var activeGameplayControlsInstance = null;

    function readStoredFirstPersonViewPreference() {
        try {
            if (typeof window === 'undefined' || !window.localStorage) return false;
            var raw = window.localStorage.getItem(CAMERA_VIEW_STORAGE_KEY);
            return raw === 'fps';
        } catch (_err) {
            return false;
        }
    }

    function inputLabelsApi() {
        return runtime.GameInputLabels || null;
    }

    function clampCameraOffsetValue(value) {
        var n = Number(value || 0);
        if (!isFinite(n)) n = 0;
        return Math.max(-CAMERA_ORIGIN_TUNE_MAX_ABS, Math.min(CAMERA_ORIGIN_TUNE_MAX_ABS, n));
    }

    function normalizeFirstPersonCameraOffset(value) {
        var source = value && typeof value === 'object' ? value : {};
        return {
            x: clampCameraOffsetValue(source.x),
            y: clampCameraOffsetValue(source.y),
            z: clampCameraOffsetValue(source.z)
        };
    }

    function cloneFirstPersonCameraOffset(value) {
        return normalizeFirstPersonCameraOffset(value);
    }

    function readStoredFirstPersonCameraOffset() {
        try {
            if (typeof window === 'undefined' || !window.localStorage) return normalizeFirstPersonCameraOffset(null);
            var raw = window.localStorage.getItem(FIRST_PERSON_CAMERA_OFFSET_STORAGE_KEY);
            if (!raw) return normalizeFirstPersonCameraOffset(null);
            return normalizeFirstPersonCameraOffset(JSON.parse(raw));
        } catch (_err) {
            return normalizeFirstPersonCameraOffset(null);
        }
    }

    function create(opts) {
        opts = opts || {};

        var triggerHeld = false;
        var armedThrowableType = '';
        var throwableHeldType = '';
        var virtualCapture = false;
        var touchControlsRoot = null;
        var touchTopbar = null;
        var touchRotatePrompt = null;
        var touchLookSurface = null;
        var touchMoveThumb = null;
        var touchMoveKnob = null;
        var touchJumpBtn = null;
        var touchSwapBtn = null;
        var touchRollBtn = null;
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
        var DEFAULT_TOUCH_LOOK_MULTIPLIER = 1.9;
        var IPHONE_TOUCH_LOOK_MULTIPLIER = DEFAULT_TOUCH_LOOK_MULTIPLIER * 1.25;
        var TOUCH_SPRINT_ARC_FRACTION = 0.25;
        var touchJumpState = {
            pointerId: null
        };
        var touchOrientationState = 'landscape';
        var desktopAutoFireEnabled = false;
        var firstPersonViewEnabled = readStoredFirstPersonViewPreference();
        var firstPersonCameraOffset = readStoredFirstPersonCameraOffset();
        var cameraOriginTuneModeEnabled = false;
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
            if (typeof window === 'undefined') return false;
            var coarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
            var maxTouchPoints = typeof navigator !== 'undefined'
                ? Number(navigator.maxTouchPoints || 0)
                : 0;
            var touchCapable = ('ontouchstart' in window) || maxTouchPoints > 0;
            return !!(coarse && touchCapable);
        }

        function isPhoneSizedTouchDevice() {
            return !!(touchDevice() && (window.innerWidth <= 640 || window.innerHeight <= 500));
        }

        function isIphoneTouchDevice() {
            if (!touchDevice() || typeof navigator === 'undefined') return false;
            var platform = String(navigator.platform || '');
            var userAgent = String(navigator.userAgent || '');
            var maxTouchPoints = Number(navigator.maxTouchPoints || 0);
            return /iPhone/i.test(platform) ||
                /iPhone/i.test(userAgent) ||
                (/Mac/i.test(platform) && maxTouchPoints > 1);
        }

        function playerApi() {
            return runtime.GamePlayer || null;
        }

        function playerInspectModeActive() {
            var player = playerApi();
            return !!(player && player.isInspectModeActive && player.isInspectModeActive());
        }

        function sessionApi() {
            return runtime.GameSession || null;
        }

        function sharedApi() {
            return runtime.GameShared || null;
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

        function localStore() {
            try {
                return window.localStorage || null;
            } catch (_err) {
                return null;
            }
        }

        function loadDesktopAutoFirePreference() {
            var store = localStore();
            if (!store || typeof store.getItem !== 'function') return false;
            try {
                var raw = store.getItem(DESKTOP_AUTO_FIRE_STORAGE_KEY);
                if (raw == null) return false;
                return raw === '1';
            } catch (_err) {
                return false;
            }
        }

        function saveDesktopAutoFirePreference() {
            var store = localStore();
            if (!store || typeof store.setItem !== 'function') return desktopAutoFireEnabled;
            try {
                store.setItem(DESKTOP_AUTO_FIRE_STORAGE_KEY, desktopAutoFireEnabled ? '1' : '0');
            } catch (_err) {
                // no-op
            }
            return desktopAutoFireEnabled;
        }

        function isDesktopAutoFireEnabled() {
            return !touchDevice() && !!desktopAutoFireEnabled;
        }

        function setDesktopAutoFireEnabled(nextValue) {
            desktopAutoFireEnabled = !!nextValue;
            saveDesktopAutoFirePreference();
            return isDesktopAutoFireEnabled();
        }

        function toggleDesktopAutoFireEnabled() {
            return setDesktopAutoFireEnabled(!desktopAutoFireEnabled);
        }

        function saveFirstPersonViewPreference() {
            var store = localStore();
            if (!store || typeof store.setItem !== 'function') return firstPersonViewEnabled;
            try {
                store.setItem(CAMERA_VIEW_STORAGE_KEY, firstPersonViewEnabled ? 'fps' : 'over_shoulder');
            } catch (_err) {
                // no-op
            }
            return firstPersonViewEnabled;
        }

        function refreshCameraViewToggleButton() {
            var cameraViewToggleBtn = document.getElementById('camera-view-toggle-btn');
            if (!cameraViewToggleBtn) return;
            var enabled = isFirstPersonViewEnabled();
            cameraViewToggleBtn.textContent = enabled ? 'CAMERA: FPS' : 'CAMERA: OVER SHOULDER';
            cameraViewToggleBtn.setAttribute('aria-pressed', enabled ? 'true' : 'false');
        }

        function isFirstPersonViewEnabled() {
            return !!firstPersonViewEnabled;
        }

        function setFirstPersonViewEnabled(nextValue) {
            firstPersonViewEnabled = !!nextValue;
            saveFirstPersonViewPreference();
            refreshCameraViewToggleButton();
            return firstPersonViewEnabled;
        }

        function toggleFirstPersonViewEnabled() {
            return setFirstPersonViewEnabled(!firstPersonViewEnabled);
        }

        function saveFirstPersonCameraOffset() {
            var store = localStore();
            if (!store || typeof store.setItem !== 'function') return getFirstPersonCameraOffset();
            try {
                store.setItem(FIRST_PERSON_CAMERA_OFFSET_STORAGE_KEY, JSON.stringify(firstPersonCameraOffset));
            } catch (_err) {
                // no-op
            }
            return getFirstPersonCameraOffset();
        }

        function getFirstPersonCameraOffset() {
            return cloneFirstPersonCameraOffset(firstPersonCameraOffset);
        }

        function setFirstPersonCameraOffset(nextOffset) {
            firstPersonCameraOffset = normalizeFirstPersonCameraOffset(nextOffset);
            saveFirstPersonCameraOffset();
            return getFirstPersonCameraOffset();
        }

        function adjustFirstPersonCameraOffset(delta) {
            var source = delta && typeof delta === 'object' ? delta : {};
            return setFirstPersonCameraOffset({
                x: firstPersonCameraOffset.x + Number(source.x || 0),
                y: firstPersonCameraOffset.y + Number(source.y || 0),
                z: firstPersonCameraOffset.z + Number(source.z || 0)
            });
        }

        function formatCameraOffsetValue(value) {
            var n = Math.round(Number(value || 0) * 1000) / 1000;
            return (n >= 0 ? '+' : '') + n.toFixed(3);
        }

        function cameraOriginTuneMessage() {
            return 'Camera origin tuning: ' + (cameraOriginTuneModeEnabled ? 'ON' : 'OFF') + '\n' +
                'right ' + formatCameraOffsetValue(firstPersonCameraOffset.x) +
                '  up ' + formatCameraOffsetValue(firstPersonCameraOffset.y) +
                '  forward ' + formatCameraOffsetValue(firstPersonCameraOffset.z) + '\n' +
                'Arrows: forward/back/left/right. PgUp/PgDn: up/down. Home: reset.';
        }

        function setCameraOriginTuneModeEnabled(enabled) {
            cameraOriginTuneModeEnabled = !!enabled;
            if (cameraOriginTuneModeEnabled) setFirstPersonViewEnabled(true);
            setTransientDebug(cameraOriginTuneMessage(), cameraOriginTuneModeEnabled ? 5000 : 1200);
            return cameraOriginTuneModeEnabled;
        }

        function toggleCameraOriginTuneModeEnabled() {
            return setCameraOriginTuneModeEnabled(!cameraOriginTuneModeEnabled);
        }

        function handleCameraOriginTuneKey(e) {
            if (!cameraOriginTuneModeEnabled) return false;
            if (domUtils && domUtils.isEditableTarget && domUtils.isEditableTarget(e.target)) return false;
            var step = e && e.shiftKey ? CAMERA_ORIGIN_TUNE_FINE_STEP : CAMERA_ORIGIN_TUNE_STEP;
            var code = String(e && e.code || '');
            var delta = null;
            if (code === 'ArrowUp') delta = { z: step };
            else if (code === 'ArrowDown') delta = { z: -step };
            else if (code === 'ArrowLeft') delta = { x: -step };
            else if (code === 'ArrowRight') delta = { x: step };
            else if (code === 'PageUp') delta = { y: step };
            else if (code === 'PageDown') delta = { y: -step };
            else if (code === 'Home') {
                setFirstPersonCameraOffset(null);
                if (e.preventDefault) e.preventDefault();
                if (e.stopPropagation) e.stopPropagation();
                setTransientDebug(cameraOriginTuneMessage(), 5000);
                return true;
            }
            if (!delta) return false;
            adjustFirstPersonCameraOffset(delta);
            if (e.preventDefault) e.preventDefault();
            if (e.stopPropagation) e.stopPropagation();
            setTransientDebug(cameraOriginTuneMessage(), 5000);
            return true;
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

        function setTouchSprintVisual(active) {
            if (!touchMoveThumb || !touchMoveThumb.classList) return;
            touchMoveThumb.classList.toggle('sprinting', !!active);
        }

        function touchMoveRadiiPx() {
            var fallbackBase = 52;
            var ring = touchMoveThumb && touchMoveThumb.querySelector
                ? touchMoveThumb.querySelector('.touch-stick-ring')
                : null;
            if (!ring || !touchMoveKnob ||
                !touchMoveThumb ||
                typeof ring.getBoundingClientRect !== 'function' ||
                typeof touchMoveThumb.getBoundingClientRect !== 'function' ||
                typeof touchMoveKnob.getBoundingClientRect !== 'function') {
                return {
                    baseRadius: fallbackBase,
                    sprintRadius: fallbackBase + 28,
                    sprintThreshold: fallbackBase + 10
                };
            }
            var thumbRect = touchMoveThumb.getBoundingClientRect();
            var ringRect = ring.getBoundingClientRect();
            var knobRect = touchMoveKnob.getBoundingClientRect();
            var thumbSize = Math.min(Number(thumbRect.width || 0), Number(thumbRect.height || 0));
            var ringSize = Math.min(Number(ringRect.width || 0), Number(ringRect.height || 0));
            var knobSize = Math.max(Number(knobRect.width || 0), Number(knobRect.height || 0));
            var baseRadius = (ringSize - knobSize) * 0.5;
            baseRadius = baseRadius > 0 ? Math.max(24, baseRadius) : fallbackBase;
            var sprintReach = thumbSize > ringSize ? ((thumbSize - ringSize) * 0.5) : 28;
            sprintReach = Math.max(24, Math.min(96, sprintReach));
            return {
                baseRadius: baseRadius,
                sprintRadius: baseRadius + sprintReach,
                sprintThreshold: baseRadius + Math.min(18, Math.max(10, sprintReach * 0.26))
            };
        }

        function touchSprintHalfAngleRad() {
            return Math.PI * TOUCH_SPRINT_ARC_FRACTION;
        }

        function touchSprintClockwiseOffsetRad() {
            return 5 * Math.PI / 180;
        }

        function resolveTouchSprintState(rawX, rawY, sprintThreshold) {
            var x = Number(rawX || 0);
            var y = Number(rawY || 0);
            var magnitude = Math.sqrt((x * x) + (y * y));
            if (!(magnitude >= Number(sprintThreshold || 0))) return false;
            var forwardAngle = Math.atan2(x, -y);
            var centeredAngle = forwardAngle - touchSprintClockwiseOffsetRad();
            return Math.abs(centeredAngle) <= touchSprintHalfAngleRad();
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
            setTouchSprintVisual(false);
            var player = playerApi();
            if (player && player.clearMovementInputState) {
                player.clearMovementInputState();
            }
        }

        function beginMovePointer(event) {
            if (!event || touchMoveState.pointerId !== null || !touchLandscapeReady()) return;
            touchMoveState.pointerId = event.pointerId;
            if (touchMoveThumb && typeof touchMoveThumb.getBoundingClientRect === 'function') {
                var rect = touchMoveThumb.getBoundingClientRect();
                touchMoveState.centerX = rect.left + (rect.width * 0.5);
                touchMoveState.centerY = rect.top + (rect.height * 0.5);
            } else {
                touchMoveState.centerX = Number(event.clientX || 0);
                touchMoveState.centerY = Number(event.clientY || 0);
            }
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
            var moveRadii = touchMoveRadiiPx();
            var baseRadius = moveRadii.baseRadius;
            var rawX = Number(event.clientX || 0) - touchMoveState.centerX;
            var rawY = Number(event.clientY || 0) - touchMoveState.centerY;
            var dist = Math.sqrt((rawX * rawX) + (rawY * rawY));
            var sprinting = resolveTouchSprintState(rawX, rawY, moveRadii.sprintThreshold);
            var visualRadius = sprinting ? moveRadii.sprintRadius : baseRadius;
            var visualScale = dist > visualRadius ? (visualRadius / dist) : 1;
            var controlScale = dist > baseRadius ? (baseRadius / dist) : 1;
            var visualX = rawX * visualScale;
            var visualY = rawY * visualScale;
            var controlX = rawX * controlScale;
            var controlY = rawY * controlScale;
            touchMoveState.dx = controlX / baseRadius;
            touchMoveState.dy = controlY / baseRadius;
            touchMoveState.sprint = sprinting;
            setTouchMoveVisual(visualX, visualY);
            setTouchSprintVisual(touchMoveState.sprint);
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
                player.applyLookDelta(
                    deltaX,
                    deltaY,
                    isIphoneTouchDevice() ? IPHONE_TOUCH_LOOK_MULTIPLIER : DEFAULT_TOUCH_LOOK_MULTIPLIER
                );
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

        function beginJumpPointer(event) {
            if (!event || touchJumpState.pointerId !== null || !touchLandscapeReady()) return;
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
                touchJumpState.pointerId = null;
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
            return !isPhoneSizedTouchDevice() || touchLandscapeReady();
        }

        function deactivateTouchCaptureInternal() {
            virtualCapture = false;
            setTouchRootVisible(false);
            setTriggerPressed(false);
            setJumpPressed(false);
            resetTouchMovementState();
            endLookPointer({ pointerId: touchLookState.pointerId });
            touchJumpState.pointerId = null;
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
            topbar.innerHTML = '<button type="button" class="touch-btn touch-btn-menu" data-touch-action="menu">MENU</button>';
            root.appendChild(topbar);

            var rotatePrompt = document.createElement('div');
            rotatePrompt.className = 'touch-rotate-prompt';
            rotatePrompt.innerHTML =
                '<div class="touch-rotate-card">' +
                    '<div class="touch-rotate-kicker">Phone Mode</div>' +
                    '<div class="touch-rotate-title">Rotate To Landscape</div>' +
                    '<div class="touch-rotate-copy">The phone controls are built for sideways play.</div>' +
                '</div>';
            root.appendChild(rotatePrompt);

            var moveThumb = document.createElement('div');
            moveThumb.className = 'touch-stick touch-stick-left';
            moveThumb.innerHTML =
                '<div class="touch-stick-ring"><div class="touch-stick-sprint-wedge"></div><div class="touch-stick-knob"></div></div>';
            root.appendChild(moveThumb);

            var actionCluster = document.createElement('div');
            actionCluster.className = 'touch-action-cluster';
            actionCluster.innerHTML =
                '<button type="button" class="touch-btn touch-btn-jump" data-touch-action="jump">' +
                    '<span class="touch-btn-title">JUMP</span>' +
                    '<span class="touch-btn-note">hold</span>' +
                '</button>' +
                '<button type="button" class="touch-btn touch-btn-swap" data-touch-action="swap">' +
                    '<span class="touch-btn-title">SWAP</span>' +
                    '<span class="touch-btn-note">switch gun</span>' +
                '</button>' +
                '<button type="button" class="touch-btn touch-btn-roll" data-touch-action="roll">' +
                    '<span class="touch-btn-title">ROLL</span>' +
                    '<span class="touch-btn-note">quick dodge</span>' +
                '</button>';
            root.appendChild(actionCluster);
            document.body.appendChild(root);

            touchControlsRoot = root;
            touchTopbar = topbar;
            touchRotatePrompt = rotatePrompt;
            touchLookSurface = look;
            touchMoveThumb = moveThumb;
            touchMoveKnob = moveThumb.querySelector('.touch-stick-knob');
            touchJumpBtn = actionCluster.querySelector('[data-touch-action="jump"]');
            touchSwapBtn = actionCluster.querySelector('[data-touch-action="swap"]');
            touchRollBtn = actionCluster.querySelector('[data-touch-action="roll"]');

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
            listen(touchSwapBtn, 'pointerdown', function (event) {
                if (!virtualCapture || !touchLandscapeReady()) return;
                event.preventDefault();
                triggerWeaponSwap();
            });
            listen(touchRollBtn, 'pointerdown', function (event) {
                if (!virtualCapture || !touchLandscapeReady()) return;
                event.preventDefault();
                triggerRoll();
            });

            listen(topbar.querySelector('[data-touch-action="menu"]'), 'click', function (event) {
                if (!virtualCapture) return;
                event.preventDefault();
                pauseTouchGameplay();
            });

            updateTouchOrientationState();
        }

        desktopAutoFireEnabled = loadDesktopAutoFirePreference();

        var weaponSwapInput = runtime.GameWeaponSwapInput && runtime.GameWeaponSwapInput.create
            ? runtime.GameWeaponSwapInput.create({
                applyWeapon: opts.applyWeapon,
                hasInputCapture: function () {
                    return hasInputCapture() && !playerInspectModeActive();
                },
                toggleWeapon: function () {
                    return runtime.GameHitscan && runtime.GameHitscan.toggleWeapon
                        ? runtime.GameHitscan.toggleWeapon()
                        : null;
                }
            })
            : null;

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

        function triggerLocalThrowFeedback(type) {
            if (runtime.GameAudio && runtime.GameAudio.play) {
                runtime.GameAudio.play('throw', {
                    throwable: type,
                    projectileType: type
                });
            }
        }

        function tryThrow(type, throwIntentOverride) {
            if (playerInspectModeActive()) return null;
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
                triggerLocalThrowFeedback(type);
                setTransientDebug('Throw sent: ' + type, 650);
                return { ok: true, sent: true };
            }

            var outcome = throwablesApi.throw(type, camera, throwIntent);
            runtime.GameUI.updateThrowableInfo(outcome.state);
            if (outcome.ok) {
                triggerLocalThrowFeedback(type);
            }
            if (!outcome.ok && outcome.reason === 'cooldown') {
                setTransientDebug(type + ' is recharging.', 600);
            }
            return outcome;
        }

        function triggerRoll() {
            if (playerInspectModeActive()) return false;
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

        function triggerWeaponSwap() {
            if (playerInspectModeActive()) return false;
            if (!hasInputCapture()) return false;
            if (!canUseLocalAction('weapon')) return false;
            if (weaponSwapInput && weaponSwapInput.triggerToggle) {
                var swapResult = weaponSwapInput.triggerToggle();
                return !!(swapResult && swapResult.toggled);
            }
            if (!runtime.GameHitscan || !runtime.GameHitscan.toggleWeapon || !opts.applyWeapon) return false;
            var weapon = runtime.GameHitscan.toggleWeapon();
            if (!weapon) return false;
            opts.applyWeapon(weapon);
            return true;
        }

        function triggerReload() {
            if (playerInspectModeActive()) return false;
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
                if (playerInspectModeActive()) return;
                triggerHeld = true;
                if (opts.tryPlayerFire) opts.tryPlayerFire();
            });

            listen(document, 'mouseup', function (e) {
                if (e.button !== 0) return;
                triggerHeld = false;
            });

            listen(window, 'blur', function () {
                setTriggerPressed(false);
                setJumpPressed(false);
                endLookPointer({ pointerId: touchLookState.pointerId });
            });
        }

        function bindWeaponControls() {
            listen(document, 'keydown', function (e) {
                if (e.repeat) return;
                if (domUtils && domUtils.isEditableTarget && domUtils.isEditableTarget(e.target)) return;
                var idx = -1;
                if (matchesBinding('weapon_slot_1', e, 'Digit1')) {
                    idx = 0;
                } else if (matchesBinding('weapon_slot_2', e, 'Digit2')) {
                    idx = 1;
                }
                if (idx < 0) return;
                if (!hasInputCapture()) return;
                if (playerInspectModeActive()) return;
                if (!canUseLocalAction('weapon')) return;
                if (!runtime.GameHitscan || !runtime.GameHitscan.getWeaponOrder || !runtime.GameHitscan.setWeapon || !opts.applyWeapon) return;
                var weaponOrder = runtime.GameHitscan.getWeaponOrder();
                if (!Array.isArray(weaponOrder) || idx >= weaponOrder.length) return;
                var weaponId = String(weaponOrder[idx] || '');
                if (!weaponId) return;
                var currentWeapon = runtime.GameHitscan.getCurrentWeapon ? runtime.GameHitscan.getCurrentWeapon() : null;
                if (currentWeapon && String(currentWeapon.id || '') === weaponId) return;
                if (e.preventDefault) e.preventDefault();
                if (e.stopPropagation) e.stopPropagation();
                opts.applyWeapon(runtime.GameHitscan.setWeapon(weaponId));
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
            if (touchDevice()) return;
            listen(document, 'keydown', function (e) {
                if (e.repeat) return;
                if (!matchesBinding('reload', e, 'KeyR')) return;
                if (domUtils && domUtils.isEditableTarget && domUtils.isEditableTarget(e.target)) return;
                if (!hasInputCapture()) return;
                e.preventDefault();
                e.stopPropagation();
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

        function bindCameraViewToggleControl() {
            var cameraViewToggleBtn = document.getElementById('camera-view-toggle-btn');
            if (!cameraViewToggleBtn) return;

            listen(cameraViewToggleBtn, 'click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                var enabled = toggleFirstPersonViewEnabled();
                setTransientDebug(enabled ? 'Camera: FPS' : 'Camera: over shoulder', 900);
            });

            refreshCameraViewToggleButton();
        }

        function bindCameraOriginTuneControls() {
            listen(document, 'keydown', function (e) {
                if (e.repeat) return;
                if (domUtils && domUtils.isEditableTarget && domUtils.isEditableTarget(e.target)) return;
                if (matchesBinding('camera_origin_tune', e, 'F6')) {
                    if (e.preventDefault) e.preventDefault();
                    if (e.stopPropagation) e.stopPropagation();
                    toggleCameraOriginTuneModeEnabled();
                    return;
                }
                handleCameraOriginTuneKey(e);
            });
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
                if (playerInspectModeActive()) return;
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

        function clearGameplayActionStateForInspect() {
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
            touchJumpState.pointerId = null;
        }

        function bindInspectControls() {
            listen(document, 'keydown', function (e) {
                if (e.repeat) return;
                if (!matchesBinding('inspect_player', e, 'KeyV')) return;
                if (domUtils && domUtils.isEditableTarget && domUtils.isEditableTarget(e.target)) return;
                var player = playerApi();
                if (!player || !player.toggleInspectMode) return;
                if (e.preventDefault) e.preventDefault();
                if (e.stopPropagation) e.stopPropagation();
                var enabled = !!player.toggleInspectMode();
                clearGameplayActionStateForInspect();
                setTransientDebug(enabled ? 'Inspect orbit: ON' : 'Inspect orbit: OFF', 1000);
            });
        }

        function bindDebugKeys() {
            listen(document, 'keydown', function (e) {
                if (e.repeat) return;
                if (domUtils && domUtils.isEditableTarget && domUtils.isEditableTarget(e.target)) return;
                if (!matchesBinding('toggle_debug', e, 'KeyH')) return;
                var enabled = opts.toggleDebugVisuals ? !!opts.toggleDebugVisuals() : false;
                setTransientDebug(enabled ? 'Dev visuals: ON' : 'Dev visuals: OFF', 1100);
            });
        }

        function bindAutoFireToggleControl() {
            listen(document, 'keydown', function (e) {
                if (e.repeat) return;
                if (!matchesBinding('toggle_auto_fire', e, 'KeyG')) return;
                if (touchDevice()) return;
                if (domUtils && domUtils.isEditableTarget && domUtils.isEditableTarget(e.target)) return;
                e.preventDefault();
                var enabled = toggleDesktopAutoFireEnabled();
                setTransientDebug(enabled ? 'Desktop auto fire: ON' : 'Desktop auto fire: OFF', 1100);
            });
        }

        return {
            bind: function () {
                if (bound) return;
                bound = true;
                activeGameplayControlsInstance = this;
                bindDocsControls();
                bindShooting();
                bindCameraOriginTuneControls();
                bindWeaponControls();
                bindReloadControls();
                bindCameraViewToggleControl();
                bindSoundToggleControl();
                bindThrowableControls();
                bindRollControls();
                bindInspectControls();
                bindAutoFireToggleControl();
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
                touchRotatePrompt = null;
                touchLookSurface = null;
                touchMoveThumb = null;
                touchMoveKnob = null;
                touchJumpBtn = null;
                touchSwapBtn = null;
                touchRollBtn = null;
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
            isPhoneSizedTouchDevice: function () {
                return isPhoneSizedTouchDevice();
            },
            isDesktopAutoFireEnabled: function () {
                return isDesktopAutoFireEnabled();
            },
            isFirstPersonViewEnabled: function () {
                return isFirstPersonViewEnabled();
            },
            setFirstPersonViewEnabled: function (enabled) {
                return setFirstPersonViewEnabled(enabled);
            },
            toggleFirstPersonViewEnabled: function () {
                return toggleFirstPersonViewEnabled();
            },
            getFirstPersonCameraOffset: function () {
                return getFirstPersonCameraOffset();
            },
            setFirstPersonCameraOffset: function (offset) {
                return setFirstPersonCameraOffset(offset);
            },
            isCameraOriginTuneModeEnabled: function () {
                return !!cameraOriginTuneModeEnabled;
            },
            toggleCameraOriginTuneModeEnabled: function () {
                return toggleCameraOriginTuneModeEnabled();
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
                touchJumpState.pointerId = null;
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
        isPhoneSizedTouchDevice: function () {
            return !!(
                activeGameplayControlsInstance &&
                activeGameplayControlsInstance.isPhoneSizedTouchDevice &&
                activeGameplayControlsInstance.isPhoneSizedTouchDevice()
            );
        },
        isDesktopAutoFireEnabled: function () {
            if (!activeGameplayControlsInstance) {
                try {
                    var raw = window.localStorage ? window.localStorage.getItem(DESKTOP_AUTO_FIRE_STORAGE_KEY) : null;
                    return raw == null ? false : raw === '1';
                } catch (_err) {
                    return false;
                }
            }
            return !!(
                activeGameplayControlsInstance &&
                activeGameplayControlsInstance.isDesktopAutoFireEnabled &&
                    activeGameplayControlsInstance.isDesktopAutoFireEnabled()
                );
        },
        isFirstPersonViewEnabled: function () {
            if (!activeGameplayControlsInstance) return readStoredFirstPersonViewPreference();
            return !!(
                activeGameplayControlsInstance &&
                activeGameplayControlsInstance.isFirstPersonViewEnabled &&
                activeGameplayControlsInstance.isFirstPersonViewEnabled()
            );
        },
        setFirstPersonViewEnabled: function (enabled) {
            if (!activeGameplayControlsInstance || !activeGameplayControlsInstance.setFirstPersonViewEnabled) {
                try {
                    if (typeof window !== 'undefined' && window.localStorage) {
                        window.localStorage.setItem(CAMERA_VIEW_STORAGE_KEY, enabled ? 'fps' : 'over_shoulder');
                    }
                } catch (_err) {
                    // no-op
                }
                return !!enabled;
            }
            return activeGameplayControlsInstance.setFirstPersonViewEnabled(enabled);
        },
        toggleFirstPersonViewEnabled: function () {
            var controlsApi = runtime.GameGameplayControls || {};
            var enabled = controlsApi.isFirstPersonViewEnabled
                ? controlsApi.isFirstPersonViewEnabled()
                : false;
            return controlsApi.setFirstPersonViewEnabled
                ? controlsApi.setFirstPersonViewEnabled(!enabled)
                : !enabled;
        },
        getFirstPersonCameraOffset: function () {
            if (!activeGameplayControlsInstance || !activeGameplayControlsInstance.getFirstPersonCameraOffset) {
                return readStoredFirstPersonCameraOffset();
            }
            return activeGameplayControlsInstance.getFirstPersonCameraOffset();
        },
        setFirstPersonCameraOffset: function (offset) {
            if (!activeGameplayControlsInstance || !activeGameplayControlsInstance.setFirstPersonCameraOffset) {
                var normalized = normalizeFirstPersonCameraOffset(offset);
                try {
                    if (typeof window !== 'undefined' && window.localStorage) {
                        window.localStorage.setItem(FIRST_PERSON_CAMERA_OFFSET_STORAGE_KEY, JSON.stringify(normalized));
                    }
                } catch (_err) {
                    // no-op
                }
                return normalized;
            }
            return activeGameplayControlsInstance.setFirstPersonCameraOffset(offset);
        },
        isCameraOriginTuneModeEnabled: function () {
            return !!(
                activeGameplayControlsInstance &&
                activeGameplayControlsInstance.isCameraOriginTuneModeEnabled &&
                activeGameplayControlsInstance.isCameraOriginTuneModeEnabled()
            );
        },
        toggleCameraOriginTuneModeEnabled: function () {
            if (!activeGameplayControlsInstance || !activeGameplayControlsInstance.toggleCameraOriginTuneModeEnabled) {
                return false;
            }
            return activeGameplayControlsInstance.toggleCameraOriginTuneModeEnabled();
        }
    };
})();
