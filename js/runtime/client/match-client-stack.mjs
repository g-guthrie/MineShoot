export function createMatchClientStack(options = {}) {
  const netApi = options.netApi;
  const coordinator = options.coordinator;
  const performanceApi = options.performanceApi;
  const setTimeoutFn = options.setTimeoutFn;

  if (!netApi || typeof netApi.init !== 'function') {
    throw new Error('Match client stack requires a net API.');
  }
  if (!coordinator || typeof coordinator.bootstrap !== 'function') {
    throw new Error('Match client stack requires a match coordinator.');
  }
  if (!performanceApi || typeof performanceApi.now !== 'function') {
    throw new Error('Match client stack requires a performance API.');
  }
  if (typeof setTimeoutFn !== 'function') {
    throw new Error('Match client stack requires a timeout function.');
  }

  let started = false;
  let lastFrameState = null;

  function waitForWorldMeta(timeoutMs) {
    const startedAt = performanceApi.now();
    const maxWaitMs = Math.max(1, Number(timeoutMs || 1400));

    return new Promise((resolve) => {
      function poll() {
        const receivedMeta = netApi.getWorldMeta ? netApi.getWorldMeta() : null;
        if (receivedMeta && receivedMeta.worldSeed) {
          resolve({
            worldMeta: receivedMeta,
            startupNotice: ''
          });
          return;
        }

        if ((performanceApi.now() - startedAt) >= maxWaitMs) {
          const fallbackMeta = netApi.getExpectedWorldMeta ? netApi.getExpectedWorldMeta() : null;
          resolve({
            worldMeta: fallbackMeta,
            startupNotice: fallbackMeta && fallbackMeta.worldSeed
              ? 'World metadata timeout; using expected room profile.'
              : ''
          });
          return;
        }

        setTimeoutFn(poll, 40);
      }

      poll();
    });
  }

  return {
    setRoomId(roomId) {
      if (netApi.setRoomId) {
        return netApi.setRoomId(roomId);
      }
      return String(roomId || '');
    },
    getRoomId() {
      return netApi.getRoomId ? netApi.getRoomId() : '';
    },
    getEntityName(entityId) {
      return netApi.getEntityName ? netApi.getEntityName(entityId) : '';
    },
    canResumeGameplay() {
      const matchState = netApi.getMatchState ? netApi.getMatchState() : null;
      return !(matchState && matchState.ended);
    },
    startSession(options = {}) {
      const scene = options.scene;
      const isPlaying = typeof options.isPlaying === 'function' ? options.isPlaying : function noop() { return false; };
      const timeoutMs = Number(options.metaTimeoutMs || 1400);

      netApi.init(scene);
      return waitForWorldMeta(timeoutMs).then((metaResult) => {
        const camera = coordinator.bootstrap({
          scene,
          worldMeta: metaResult.worldMeta,
          isPlaying
        });
        started = true;
        return {
          camera,
          worldMeta: metaResult.worldMeta,
          startupNotice: metaResult.startupNotice || ''
        };
      });
    },
    updateFrame(dt) {
      if (!started) return null;
      lastFrameState = coordinator.updateFrame(dt);
      return lastFrameState;
    },
    requestFire(state = {}) {
      return coordinator.fire({
        isPlaying: !!state.isPlaying,
        hasInputCapture: !!state.hasInputCapture
      });
    },
    setDebugVisuals(visible) {
      return coordinator.setDebugVisuals(visible);
    },
    syncWeaponPresentation() {
      return coordinator.syncWeaponPresentation();
    },
    consumeNotice() {
      return netApi.consumeNotice ? netApi.consumeNotice() : '';
    },
    getLastFrameState() {
      return lastFrameState;
    },
    shutdown() {
      started = false;
      lastFrameState = null;
      if (netApi.shutdown) netApi.shutdown();
    }
  };
}
