/**
 * weapon-swap-input.js - Interprets wheel/swipe input into one weapon toggle.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameWeaponSwapInput
 */
(function () {
    'use strict';

    var runtime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};

    var DEFAULT_CONFIG = {
        // Collapse duplicate browser events from a single mouse-wheel notch.
        discreteLockoutMs: 140,
        // End a swipe burst even if the device never emits a quiet release packet.
        gestureTimeoutMs: 420,
        // Ignore tiny jitter before treating wheel input as deliberate movement.
        noiseThresholdPx: 8,
        // Treat near-zero follow-up packets as the swipe settling back down.
        releaseEpsilonPx: 4,
        // Require this much accumulated burst movement before toggling weapons.
        triggerThresholdPx: 24,
        // Prefer a clearly dominant axis before falling back to the largest axis.
        axisDominanceRatio: 1.1
    };

    function cloneConfig(overrides) {
        var next = {};
        overrides = overrides || {};
        for (var key in DEFAULT_CONFIG) {
            if (!Object.prototype.hasOwnProperty.call(DEFAULT_CONFIG, key)) continue;
            var overrideValue = Number(overrides[key]);
            next[key] = isFinite(overrideValue) ? overrideValue : DEFAULT_CONFIG[key];
        }
        return next;
    }

    function create(opts) {
        opts = opts || {};

        var config = cloneConfig(opts.config);
        var burstState = {
            accumMagnitude: 0,
            blocked: false,
            lastEventAt: 0
        };
        var discreteState = {
            lockUntil: 0
        };
        var inputCaptureOverride = null;

        function readNow() {
            if (typeof performance !== 'undefined' && performance && typeof performance.now === 'function') {
                return Number(performance.now() || 0);
            }
            return Date.now();
        }

        function hasInputCapture() {
            if (inputCaptureOverride === true || inputCaptureOverride === false) {
                return inputCaptureOverride;
            }
            return !!(opts.hasInputCapture && opts.hasInputCapture());
        }

        function resetBurstState() {
            burstState.accumMagnitude = 0;
            burstState.blocked = false;
            burstState.lastEventAt = 0;
        }

        function resetDiscreteState() {
            discreteState.lockUntil = 0;
        }

        function resetState() {
            resetBurstState();
            resetDiscreteState();
        }

        function setInputCaptureOverride(value) {
            if (value === null || value === undefined) {
                inputCaptureOverride = null;
                return inputCaptureOverride;
            }
            inputCaptureOverride = !!value;
            return inputCaptureOverride;
        }

        function readState() {
            return {
                config: cloneConfig(config),
                burst: {
                    accumMagnitude: Number(burstState.accumMagnitude || 0),
                    blocked: !!burstState.blocked,
                    lastEventAt: Number(burstState.lastEventAt || 0)
                },
                discrete: {
                    lockUntil: Number(discreteState.lockUntil || 0)
                },
                inputCaptureOverride: inputCaptureOverride,
                inputCaptureActive: hasInputCapture()
            };
        }

        function normalizeWheelAxis(delta, deltaMode) {
            var value = Number(delta || 0);
            if (!isFinite(value)) return 0;
            if (Number(deltaMode || 0) === 1) return value * config.triggerThresholdPx;
            if (Number(deltaMode || 0) === 2) return value * Math.max(1, window.innerHeight || 0);
            return value;
        }

        function choosePrimaryDelta(dx, dy, absDx, absDy) {
            if (absDy >= (absDx * config.axisDominanceRatio)) {
                return dy;
            }
            if (absDx >= (absDy * config.axisDominanceRatio)) {
                return dx;
            }
            return absDy >= absDx ? dy : dx;
        }

        function applyToggle(mode) {
            if (typeof opts.toggleWeapon !== 'function' || typeof opts.applyWeapon !== 'function') {
                return { handled: true, toggled: false, mode: mode, reason: 'toggle_unavailable' };
            }
            var weapon = opts.toggleWeapon();
            if (!weapon) {
                return { handled: true, toggled: false, mode: mode, reason: 'toggle_unavailable' };
            }
            opts.applyWeapon(weapon);
            return {
                handled: true,
                toggled: true,
                mode: mode,
                weaponId: String(weapon.id || '')
            };
        }

        function handleWheel(event) {
            var e = event || {};
            if (!hasInputCapture()) {
                return { handled: false, toggled: false, reason: 'input_capture_required' };
            }
            if (e.preventDefault) e.preventDefault();

            var now = readNow();
            var dx = normalizeWheelAxis(e.deltaX, e.deltaMode);
            var dy = normalizeWheelAxis(e.deltaY, e.deltaMode);
            var absDx = Math.abs(dx);
            var absDy = Math.abs(dy);
            var isDiscreteWheel = Number(e.deltaMode || 0) !== 0;
            var isNoise = absDx < config.noiseThresholdPx && absDy < config.noiseThresholdPx;
            var quietRelease = absDx <= config.releaseEpsilonPx && absDy <= config.releaseEpsilonPx;
            var gestureTimedOut = burstState.lastEventAt > 0 &&
                (now - burstState.lastEventAt) > config.gestureTimeoutMs;
            var primaryDelta = choosePrimaryDelta(dx, dy, absDx, absDy);

            if (isDiscreteWheel) {
                if (isNoise) {
                    return { handled: true, toggled: false, mode: 'discrete', reason: 'noise' };
                }
                if (discreteState.lockUntil > now) {
                    return { handled: true, toggled: false, mode: 'discrete', reason: 'lockout' };
                }
                resetBurstState();
                var discreteResult = applyToggle('discrete');
                if (discreteResult.toggled) {
                    discreteState.lockUntil = now + config.discreteLockoutMs;
                }
                return discreteResult;
            }

            if (burstState.blocked) {
                if (quietRelease || gestureTimedOut) {
                    resetBurstState();
                } else {
                    burstState.lastEventAt = now;
                    return { handled: true, toggled: false, mode: 'burst', reason: 'blocked' };
                }
            }

            burstState.lastEventAt = now;
            if (quietRelease) {
                burstState.accumMagnitude = 0;
                return { handled: true, toggled: false, mode: 'burst', reason: 'quiet_release' };
            }
            if (isNoise) {
                return { handled: true, toggled: false, mode: 'burst', reason: 'noise' };
            }

            burstState.accumMagnitude += Math.abs(primaryDelta);
            if (burstState.accumMagnitude < config.triggerThresholdPx) {
                return { handled: true, toggled: false, mode: 'burst', reason: 'accumulating' };
            }

            burstState.accumMagnitude = 0;
            burstState.blocked = true;
            return applyToggle('burst');
        }

        return {
            handleWheel: handleWheel,
            resetState: resetState,
            readState: readState,
            setInputCaptureOverride: setInputCaptureOverride
        };
    }

    runtime.GameWeaponSwapInput = {
        create: create,
        DEFAULT_CONFIG: cloneConfig(DEFAULT_CONFIG)
    };
})();
