export function buildDemonicMenuModel(options = {}) {
  const runtimeProfile = options.runtimeProfile || null;
  const shared = options.shared || {};
  const modeRegistry = options.modeRegistry || null;
  const displaySettings = options.displaySettings || null;
  const workstreams = Array.isArray(options.workstreams) ? options.workstreams : [];

  const runtimeModes = modeRegistry && typeof modeRegistry.getRuntimeModes === 'function'
    ? modeRegistry.getRuntimeModes(runtimeProfile)
    : [];
  const gameModes = typeof shared.getQuickPlayGameModes === 'function'
    ? shared.getQuickPlayGameModes()
    : [];
  const sandboxModes = typeof shared.getSandboxGameModes === 'function'
    ? shared.getSandboxGameModes()
    : [];

  const preferredRuntimeModeId = typeof shared.getPreferredDemonicRuntimeModeId === 'function'
    ? shared.getPreferredDemonicRuntimeModeId()
    : '';
  const defaultRuntimeModeId = runtimeModes.some((mode) => mode.id === preferredRuntimeModeId)
    ? preferredRuntimeModeId
    : (runtimeModes[0] ? runtimeModes[0].id : '');
  const defaultGameModeId = typeof shared.getDefaultGameMode === 'function'
    ? shared.getDefaultGameMode()
    : (gameModes[0] ? gameModes[0].id : 'ffa');

  const selectedRuntimeModeId = String(options.selectedRuntimeModeId || defaultRuntimeModeId || '');
  const selectedGameModeId = String(options.selectedGameModeId || defaultGameModeId || 'ffa');

  const selectedRuntimeMode = runtimeModes.find((mode) => mode.id === selectedRuntimeModeId) || runtimeModes[0] || null;
  const selectedGameMode = gameModes.find((mode) => mode.id === selectedGameModeId) || gameModes[0] || null;
  const supportsSandbox = sandboxModes.some((mode) => mode.id === selectedGameModeId);
  const fpsOptions = displaySettings && typeof displaySettings.getFpsOptions === 'function'
    ? displaySettings.getFpsOptions()
    : [60];
  const selectedFps = displaySettings && typeof displaySettings.getTargetFps === 'function'
    ? displaySettings.getTargetFps()
    : 60;

  return {
    runtimeModes,
    gameModes,
    sandboxModes,
    workstreams,
    selectedRuntimeModeId,
    selectedGameModeId,
    selectedRuntimeMode,
    selectedGameMode,
    supportsSandbox,
    fpsOptions,
    selectedFps,
    launchSummary: {
      runtimeLabel: selectedRuntimeMode ? selectedRuntimeMode.label : 'No runtime mode',
      gameLabel: selectedGameMode ? selectedGameMode.label : 'No game mode',
      authorityLabel: selectedRuntimeMode ? selectedRuntimeMode.authorityMode : 'unknown',
      backendLabel: selectedRuntimeMode ? selectedRuntimeMode.backendLabel : 'unknown',
      note: selectedRuntimeMode && selectedRuntimeMode.authoritativeTesting
        ? 'Preferred Demonic parity lane: authoritative Cloudflare-backed testing to avoid sandbox drift.'
        : 'Fallback path only. Use Cloudflare-backed modes for parity validation and signoff.'
    }
  };
}
