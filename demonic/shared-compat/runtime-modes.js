function fallbackModes() {
  const shared = globalThis.__MAYHEM_RUNTIME && globalThis.__MAYHEM_RUNTIME.GameShared
    ? globalThis.__MAYHEM_RUNTIME.GameShared
    : {};
  return typeof shared.getRuntimeModeCatalog === 'function'
    ? shared.getRuntimeModeCatalog()
    : [];
}

function normalizeMode(mode) {
  const source = mode || {};
  return {
    id: String(source.id || ''),
    label: String(source.label || ''),
    backendKind: String(source.backendKind || ''),
    authorityMode: String(source.authorityMode || ''),
    backendLabel: String(source.backendLabel || ''),
    roomStrategy: String(source.roomStrategy || ''),
    supportsSandbox: String(source.id || '') === 'single_full_sandbox',
    supportsDemonic: true
  };
}

export function getDemonicRuntimeModes(runtimeProfile) {
  const api = runtimeProfile || null;
  const modes = api && typeof api.getAvailableModes === 'function'
    ? api.getAvailableModes()
    : fallbackModes();

  return (Array.isArray(modes) ? modes : fallbackModes())
    .map(normalizeMode)
    .filter((mode) => mode.id);
}
