import { createQuickMatchFlow } from './app/quick-match-flow.mjs';
import {
  installGlobalClientDiagnostics,
  recordClientDiagnostic
} from './runtime/diagnostics/client-diagnostics.mjs';

const playBtn = document.getElementById('play-btn');
const overlay = document.getElementById('overlay');
const runtimeIndicator = document.getElementById('runtime-indicator');

function setPlayButtonState(busy, label) {
  if (!playBtn) return;
  playBtn.disabled = !!busy;
  playBtn.classList.toggle('is-busy', !!busy);
  playBtn.textContent = label || (busy ? 'LOADING' : 'PLAY');
}

function setRuntimeIndicator(text) {
  if (!runtimeIndicator) return;
  runtimeIndicator.textContent = text || 'PROFILE :: STANDBY';
}

function requestShellPointerLock() {
  if (document.pointerLockElement) return true;
  if (!overlay || typeof overlay.requestPointerLock !== 'function') return false;
  try {
    overlay.requestPointerLock();
    return true;
  } catch (_err) {
    return false;
  }
}

async function beginQuickMatch() {
  return quickMatchFlow.beginQuickMatch();
}

const quickMatchFlow = createQuickMatchFlow({
  requestPointerLock: requestShellPointerLock,
  setPlayButtonState: setPlayButtonState,
  setRuntimeIndicator: setRuntimeIndicator,
  loadApp() {
    recordClientDiagnostic('quick_match_import_app');
    return import('./app/runtime-entry.js');
  },
  exitPointerLock() {
    if (document.exitPointerLock && document.pointerLockElement) {
      document.exitPointerLock();
    }
  },
  onError(err) {
    const message = err && err.message ? String(err.message) : 'STARTUP FAILED';
    setRuntimeIndicator(`ERROR :: ${message.toUpperCase().slice(0, 64)}`);
  }
});

function preloadRuntime() {
  import('./app/runtime-entry.js')
    .then(function (app) {
      if (app && typeof app.startQuickMatch === 'function') {
        return app;
      }
      return null;
    })
    .then(function () {
      recordClientDiagnostic('quick_match_preloaded');
    })
    .catch(function (err) {
      recordClientDiagnostic('quick_match_preload_error', {
        message: err && err.message ? String(err.message) : 'Unknown preload error'
      });
    });
}

if (playBtn) {
  playBtn.addEventListener('click', function (e) {
    e.preventDefault();
    beginQuickMatch().catch(function (err) {
      console.error(err);
    });
  });
  playBtn.addEventListener('mouseenter', preloadRuntime, { once: true });
  playBtn.addEventListener('touchstart', preloadRuntime, { once: true, passive: true });
}

installGlobalClientDiagnostics(window);
setRuntimeIndicator(null);

if ('requestIdleCallback' in window) {
  window.requestIdleCallback(preloadRuntime, { timeout: 1200 });
} else {
  window.setTimeout(preloadRuntime, 150);
}
