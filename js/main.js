import { createDefaultGameClientStack } from './runtime/client/client-stack-bootstrap.mjs';
import { createRenderContext, installResizeHandler } from './core/bootstrap.js';
import { requestFrame } from './core/loop.js';
import { gameRuntimeProfile } from './core/runtime-profile.js';
import { GameUI } from './ui.js';
import { GameAudio } from './audio.js';
import { protocol as sharedProtocol } from '../shared/protocol.js';

const THREE = globalThis.THREE;

/**
 * main.js - Multiplayer-only rifle-match orchestration
 */
var renderer = null;
var scene = null;
var clock = null;
var camera = null;
var overlay = null;
var isPlaying = false;
var runtimeInitialized = false;
var triggerHeld = false;
var debugTimer = null;
var debugVisualsOn = false;
var activeRuntimeMode = null;
var startupDebugNotice = '';
var lastHandledMatchEndAt = 0;
var launchInFlight = false;
var pointerLockHooksInstalled = false;
var shootingHooksInstalled = false;
var debugHooksInstalled = false;
var resizeHooksInstalled = false;
var clientStack = null;
var started = false;
var bootstrapped = false;
var animationStarted = false;

function ensureClientStack() {
        if (clientStack) return clientStack;
        clientStack = createDefaultGameClientStack({
            document: document,
            THREE: THREE,
            performanceApi: performance,
            setTimeoutFn: setTimeout
        });
        return clientStack;
    }

    function applyBrandingOverrides() {
        document.title = 'Mayhem';
        var overlayTitle = document.querySelector('#overlay h1');
        if (overlayTitle) overlayTitle.textContent = 'MAYHEM';
    }

    function canResumeGameplay() {
        if (!runtimeInitialized) return false;
        return ensureClientStack().canResumeGameplay();
    }

    function playButtonEl() {
        return document.getElementById('play-btn');
    }

    function showOverlay() {
        if (overlay) overlay.style.display = 'flex';
    }

    function hideOverlay() {
        if (overlay) overlay.style.display = 'none';
    }

    function setPlayButtonBusy(busy, label) {
        var btn = playButtonEl();
        if (!btn) return;
        btn.disabled = !!busy;
        btn.classList.toggle('is-busy', !!busy);
        btn.textContent = label || (busy ? 'CONNECTING' : 'PLAY');
    }

    function winnerLabel(matchState, selfState) {
        if (!matchState) return '';
        var winnerId = String(matchState.winnerId || '');
        if (!winnerId) return 'PLAYER';
        if (selfState && winnerId === String(selfState.id || '')) return 'YOU';
        var winnerName = ensureClientStack().getEntityName(winnerId);
        if (winnerName) return String(winnerName).toUpperCase();
        return 'PLAYER';
    }

    function syncOverlayState() {
        if (hasInputCapture()) {
            hideOverlay();
            isPlaying = true;
            return;
        }
        if (!runtimeInitialized) {
            showOverlay();
            return;
        }
        showOverlay();
        isPlaying = false;
    }

    function setTransientDebug(text, ms) {
        if (!GameUI || !GameUI.setDebugInfo) return;
        GameUI.setDebugInfo(text || '');
        if (debugTimer) clearTimeout(debugTimer);
        if (!text) {
            debugTimer = null;
            return;
        }
        debugTimer = setTimeout(function () {
            GameUI.setDebugInfo('');
            debugTimer = null;
        }, ms || 1000);
    }

    function hasInputCapture() {
        return !!document.pointerLockElement;
    }

    function applyDebugVisuals(visible) {
        debugVisualsOn = !!visible;
        ensureClientStack().setDebugVisuals(debugVisualsOn);
    }

    function ensureRenderContext() {
        if (renderer && scene && clock) {
            return {
                renderer: renderer,
                scene: scene,
                clock: clock
            };
        }

        var renderCtx = createRenderContext();
        renderer = renderCtx.renderer;
        scene = renderCtx.scene;
        clock = renderCtx.clock;

        if (!resizeHooksInstalled) {
            installResizeHandler(renderer);
            resizeHooksInstalled = true;
        }

        return renderCtx;
    }

    function requestControlMode() {
        if (hasInputCapture()) return true;
        if (runtimeInitialized && !canResumeGameplay()) return false;
        if (GameAudio && GameAudio.unlock) GameAudio.unlock();
        var target = (renderer && renderer.domElement) ? renderer.domElement : (overlay || document.getElementById('overlay') || document.body);
        if (target.requestPointerLock) {
            target.requestPointerLock();
            return true;
        }
        return false;
    }

    function syncRiflePresentation() {
        return ensureClientStack().syncWeaponPresentation();
    }

    function tryPlayerFire() {
        return ensureClientStack().requestFire({
            isPlaying: isPlaying,
            hasInputCapture: hasInputCapture()
        });
    }

    function setupPointerLock() {
        overlay = document.getElementById('overlay');
        if (pointerLockHooksInstalled) return;
        pointerLockHooksInstalled = true;

        document.addEventListener('pointerlockchange', function () {
            syncOverlayState();
        });
    }

    function setupShooting() {
        if (shootingHooksInstalled) return;
        shootingHooksInstalled = true;
        document.addEventListener('mousedown', function (e) {
            if (e.button !== 0) return;
            if (!hasInputCapture()) return;
            triggerHeld = true;
            tryPlayerFire();
        });

        document.addEventListener('mouseup', function (e) {
            if (e.button === 0) triggerHeld = false;
        });

        window.addEventListener('blur', function () {
            triggerHeld = false;
        });
    }

    function setupDebugKeys() {
        if (debugHooksInstalled) return;
        debugHooksInstalled = true;
        document.addEventListener('keydown', function (e) {
            if (e.code === 'KeyH') {
                debugVisualsOn = !debugVisualsOn;
                applyDebugVisuals(debugVisualsOn);
                setTransientDebug(debugVisualsOn ? 'Dev visuals: ON' : 'Dev visuals: OFF', 1000);
            }
        });
    }

    function initGame() {
        applyBrandingOverrides();
        ensureRenderContext();
        ensureClientStack().startSession({
            scene: scene,
            isPlaying: function () { return isPlaying; },
            metaTimeoutMs: 1400
        }).then(function (result) {
            camera = result && result.camera ? result.camera : camera;
            syncRiflePresentation();
            applyDebugVisuals(false);

            runtimeInitialized = true;
            launchInFlight = false;
            setPlayButtonBusy(false);
            setupPointerLock();
            setupShooting();
            setupDebugKeys();
            syncOverlayState();

            if (result && result.startupNotice) {
                startupDebugNotice = startupDebugNotice
                    ? (startupDebugNotice + ' ' + result.startupNotice)
                    : result.startupNotice;
            }
            if (startupDebugNotice) {
                setTransientDebug(startupDebugNotice, 1800);
                startupDebugNotice = '';
            }

            if (hasInputCapture()) {
                hideOverlay();
                isPlaying = true;
            }

            if (!animationStarted) {
                animationStarted = true;
                animate();
            }
        }).catch(function (err) {
            launchInFlight = false;
            setPlayButtonBusy(false);
            showOverlay();
            setTransientDebug((err && err.message) ? err.message : 'Runtime startup failed.', 1800);
        });
    }

    function animate() {
        requestFrame(animate);

        var dt = clock.getDelta();
        if (dt > 0.1) dt = 0.1;

        var frameState = ensureClientStack().updateFrame(dt);
        camera = frameState && frameState.camera ? frameState.camera : camera;
        var currentWeapon = frameState ? frameState.currentWeapon : null;
        var displaySelfState = frameState ? frameState.displaySelfState : null;
        var matchState = frameState ? frameState.matchState : null;

        if (triggerHeld && hasInputCapture() && currentWeapon && currentWeapon.automatic) {
            tryPlayerFire();
        }

        if (matchState && matchState.ended && Number(matchState.endedAt || 0) > 0) {
            if (lastHandledMatchEndAt !== Number(matchState.endedAt || 0)) {
                lastHandledMatchEndAt = Number(matchState.endedAt || 0);
                if (document.pointerLockElement && document.exitPointerLock) {
                    document.exitPointerLock();
                }
                setTransientDebug(winnerLabel(matchState, displaySelfState) + ' won the round.', 1800);
            }
        } else {
            lastHandledMatchEndAt = 0;
        }

        var notice = ensureClientStack().consumeNotice();
        if (notice) setTransientDebug(notice, 900);

        renderer.render(scene, camera);
    }

    function runtimeProfile() {
        return gameRuntimeProfile;
    }

    function resolveApiUrl(apiPath) {
        var runtime = runtimeProfile();
        if (runtime && runtime.resolveApiUrl) return runtime.resolveApiUrl(apiPath);
        return apiPath;
    }

    function matchmakingPath() {
        return sharedProtocol && sharedProtocol.matchmakingPath ? sharedProtocol.matchmakingPath : '/api/matchmaking';
    }

    function setRuntimeIndicator(text) {
        var el = document.getElementById('runtime-indicator');
        if (!el) return;
        el.textContent = text || 'PROFILE :: STANDBY';
    }

    function startAllocatedRoom(payload) {
        var runtime = runtimeProfile();
        if (!payload || !payload.roomId || started) return;
        started = true;
        activeRuntimeMode = runtime && runtime.selectMode ? runtime.selectMode('cloud_multiplayer') : null;
        if (!activeRuntimeMode) {
            launchInFlight = false;
            setPlayButtonBusy(false);
            setTransientDebug('Runtime mode unavailable.', 1800);
            return;
        }
        activeRuntimeMode.roomId = String(payload.roomId);
        startupDebugNotice = 'Joined FFA room ' + String(payload.roomId).toUpperCase() + '.';
        setRuntimeIndicator('PROFILE :: PUBLIC FFA');
        ensureClientStack().setRoomId(payload.roomId);
        initGame();
    }

    function requestMatchmaking() {
        launchInFlight = true;
        setPlayButtonBusy(true, 'CONNECTING');
        fetch(resolveApiUrl(matchmakingPath()), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ action: 'quick' })
        })
            .then(function (response) {
                return response.json().catch(function () { return null; }).then(function (body) {
                    return { ok: response.ok, body: body };
                });
            })
            .then(function (result) {
                if (!result.ok || !result.body || !result.body.ok) {
                    throw new Error((result.body && result.body.error) || 'Room request failed.');
                }
                startAllocatedRoom(result.body);
            })
            .catch(function (err) {
                launchInFlight = false;
                setPlayButtonBusy(false);
                if (document.exitPointerLock && document.pointerLockElement) {
                    document.exitPointerLock();
                }
                showOverlay();
                setTransientDebug((err && err.message) ? err.message : 'Room request failed.', 1800);
            });
    }

    function boot() {
        if (bootstrapped) return;
        bootstrapped = true;
        applyBrandingOverrides();
        overlay = document.getElementById('overlay');
    }

export function startQuickMatch() {
    boot();
    if (launchInFlight) return false;
    if (runtimeInitialized && canResumeGameplay()) {
        requestControlMode();
        return true;
    }
    ensureRenderContext();
    requestControlMode();
    requestMatchmaking();
    return true;
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
} else {
    boot();
}
