let runtimeLoadPromise = null;

async function loadGameRuntime() {
  if (!runtimeLoadPromise) {
    runtimeLoadPromise = import('./runtime-entry.js');
  }
  return runtimeLoadPromise;
}

export async function startQuickMatch() {
  const runtimeModule = await loadGameRuntime();
  if (!runtimeModule || typeof runtimeModule.startQuickMatch !== 'function') {
    throw new Error('Game launcher failed to initialize.');
  }
  return runtimeModule.startQuickMatch();
}
