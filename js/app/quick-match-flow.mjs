import { recordClientDiagnostic } from '../runtime/diagnostics/client-diagnostics.mjs';

export function createQuickMatchFlow(options = {}) {
  const requestPointerLock = typeof options.requestPointerLock === 'function' ? options.requestPointerLock : function noop() { return false; };
  const setPlayButtonState = typeof options.setPlayButtonState === 'function' ? options.setPlayButtonState : function noop() {};
  const setRuntimeIndicator = typeof options.setRuntimeIndicator === 'function' ? options.setRuntimeIndicator : function noop() {};
  const loadApp = typeof options.loadApp === 'function' ? options.loadApp : function noopLoad() { return Promise.resolve(null); };
  const exitPointerLock = typeof options.exitPointerLock === 'function' ? options.exitPointerLock : function noop() {};

  let launchPromise = null;

  return {
    beginQuickMatch() {
      if (launchPromise) return launchPromise;

      requestPointerLock();
      setPlayButtonState(true, 'LOADING');
      setRuntimeIndicator('PROFILE :: LOADING');
      recordClientDiagnostic('quick_match_begin');

      launchPromise = Promise.resolve()
        .then(function loadRuntimeModule() {
          return loadApp();
        })
        .then(function startLoadedApp(app) {
          if (!app || typeof app.startQuickMatch !== 'function') {
            throw new Error('Game runtime entry is unavailable.');
          }
          recordClientDiagnostic('quick_match_runtime_loaded');
          return app.startQuickMatch();
        })
        .catch(function handleError(err) {
          setPlayButtonState(false, 'PLAY');
          setRuntimeIndicator('PROFILE :: STANDBY');
          exitPointerLock();
          recordClientDiagnostic('quick_match_error', {
            message: err && err.message ? String(err.message) : 'Unknown quick match error'
          });
          throw err;
        })
        .finally(function clearLaunchPromise() {
          launchPromise = null;
        });

      return launchPromise;
    }
  };
}
