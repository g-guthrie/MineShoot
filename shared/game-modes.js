const GAME_MODE_DEFS = {
  ffa: {
    id: 'ffa',
    label: 'Free For All',
    menuButtonLabel: 'FREE FOR ALL',
    primaryButtonLabel: 'QUICK MATCH (FFA)',
    sandboxButtonLabel: 'SANDBOX FFA',
    shortLabel: 'FFA',
    showInMainMenu: true,
    supportsSandbox: true,
    supportsPrivateRoom: true,
    primaryQuickPlay: true,
    sortOrder: 10
  },
  tdm: {
    id: 'tdm',
    label: 'Team Deathmatch',
    menuButtonLabel: 'TEAM DEATHMATCH',
    primaryButtonLabel: 'QUICK MATCH (TDM)',
    sandboxButtonLabel: 'SANDBOX TDM',
    shortLabel: 'TDM',
    showInMainMenu: true,
    supportsSandbox: true,
    supportsPrivateRoom: true,
    primaryQuickPlay: false,
    sortOrder: 20
  },
  lms: {
    id: 'lms',
    label: 'Last Man Standing',
    menuButtonLabel: 'LAST MAN STANDING',
    primaryButtonLabel: 'QUICK MATCH (LMS)',
    sandboxButtonLabel: 'SANDBOX LMS',
    shortLabel: 'LMS',
    showInMainMenu: true,
    supportsSandbox: true,
    supportsPrivateRoom: true,
    primaryQuickPlay: false,
    sortOrder: 30
  }
};

function cloneMode(mode) {
  const source = mode || {};
  return {
    id: String(source.id || ''),
    label: String(source.label || ''),
    menuButtonLabel: String(source.menuButtonLabel || source.label || ''),
    primaryButtonLabel: String(source.primaryButtonLabel || source.menuButtonLabel || source.label || ''),
    sandboxButtonLabel: String(source.sandboxButtonLabel || source.menuButtonLabel || source.label || ''),
    shortLabel: String(source.shortLabel || source.id || ''),
    showInMainMenu: !!source.showInMainMenu,
    supportsSandbox: !!source.supportsSandbox,
    supportsPrivateRoom: !!source.supportsPrivateRoom,
    primaryQuickPlay: !!source.primaryQuickPlay,
    sortOrder: Number.isFinite(Number(source.sortOrder)) ? Number(source.sortOrder) : 999
  };
}

function allModes() {
  return Object.keys(GAME_MODE_DEFS)
    .map((modeId) => cloneMode(GAME_MODE_DEFS[modeId]))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function getGameModeCatalog() {
  return allModes();
}

export function getGameMode(modeId) {
  const normalized = String(modeId || '').trim().toLowerCase();
  return cloneMode(GAME_MODE_DEFS[normalized] || GAME_MODE_DEFS.ffa);
}

export function getQuickPlayGameModes() {
  return allModes().filter((mode) => mode.showInMainMenu);
}

export function getSandboxGameModes() {
  return allModes().filter((mode) => mode.supportsSandbox);
}

export function getDefaultGameMode() {
  const primary = allModes().find((mode) => mode.primaryQuickPlay);
  return primary ? primary.id : 'ffa';
}

export function getDefaultSandboxGameMode() {
  const sandboxModes = getSandboxGameModes();
  return sandboxModes.length ? sandboxModes[0].id : getDefaultGameMode();
}

export function normalizeGameMode(modeId, options = {}) {
  const allowSandboxOnly = !!options.allowSandboxOnly;
  const normalized = String(modeId || '').trim().toLowerCase();
  const source = GAME_MODE_DEFS[normalized];
  if (source && (allowSandboxOnly || source.showInMainMenu || source.supportsSandbox || source.supportsPrivateRoom)) {
    return source.id;
  }
  return allowSandboxOnly ? getDefaultSandboxGameMode() : getDefaultGameMode();
}

const runtime = (globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {});
runtime.GameShared = runtime.GameShared || {};
runtime.GameShared.getGameModeCatalog = getGameModeCatalog;
runtime.GameShared.getGameMode = getGameMode;
runtime.GameShared.getQuickPlayGameModes = getQuickPlayGameModes;
runtime.GameShared.getSandboxGameModes = getSandboxGameModes;
runtime.GameShared.getDefaultGameMode = getDefaultGameMode;
runtime.GameShared.getDefaultSandboxGameMode = getDefaultSandboxGameMode;
runtime.GameShared.normalizeGameMode = normalizeGameMode;
