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
    return import('./app/index.js');
  },
  exitPointerLock() {
    if (document.exitPointerLock && document.pointerLockElement) {
      document.exitPointerLock();
    }
  }
});

if (playBtn) {
  playBtn.addEventListener('click', function (e) {
    e.preventDefault();
    beginQuickMatch().catch(function (err) {
      console.error(err);
    });
  });
}

installGlobalClientDiagnostics(window);
setRuntimeIndicator(null);
