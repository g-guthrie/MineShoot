export function buildDemonicMenuModel(options = {}) {
  const runtimeProfile = options.runtimeProfile || null;
  const shared = options.shared || {};
  const modeRegistry = options.modeRegistry || null;
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

  const defaultRuntimeModeId = runtimeModes.some((mode) => mode.id === 'single_full_sandbox')
    ? 'single_full_sandbox'
    : (runtimeModes[0] ? runtimeModes[0].id : '');
  const defaultGameModeId = typeof shared.getDefaultGameMode === 'function'
    ? shared.getDefaultGameMode()
    : (gameModes[0] ? gameModes[0].id : 'ffa');

  const selectedRuntimeModeId = String(options.selectedRuntimeModeId || defaultRuntimeModeId || '');
  const selectedGameModeId = String(options.selectedGameModeId || defaultGameModeId || 'ffa');

  const selectedRuntimeMode = runtimeModes.find((mode) => mode.id === selectedRuntimeModeId) || runtimeModes[0] || null;
  const selectedGameMode = gameModes.find((mode) => mode.id === selectedGameModeId) || gameModes[0] || null;
  const supportsSandbox = sandboxModes.some((mode) => mode.id === selectedGameModeId);

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
    launchSummary: {
      runtimeLabel: selectedRuntimeMode ? selectedRuntimeMode.label : 'No runtime mode',
      gameLabel: selectedGameMode ? selectedGameMode.label : 'No game mode',
      authorityLabel: selectedRuntimeMode ? selectedRuntimeMode.authorityMode : 'unknown',
      backendLabel: selectedRuntimeMode ? selectedRuntimeMode.backendLabel : 'unknown',
      note: selectedRuntimeMode && selectedRuntimeMode.id === 'single_full_sandbox'
        ? 'Best path for early Demonic parity work: local, fast, and isolated.'
        : 'This launch surface is scaffolded now; Demonic gameplay runtime wiring comes next.'
    }
  };
}
