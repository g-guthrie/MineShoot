const GAME_MODE_DEFS = {
  ffa: {
    id: 'ffa',
    label: 'Free For All',
    menuButtonLabel: 'Free For All',
    primaryButtonLabel: 'Play Free For All',
    shortLabel: 'Free For All',
    showInMainMenu: true,
    supportsPrivateRoom: true,
    primaryQuickPlay: true,
    sortOrder: 10
  },
  tdm: {
    id: 'tdm',
    label: 'Team Death Match',
    menuButtonLabel: 'Team Death Match',
    primaryButtonLabel: 'Play Team Death Match',
    shortLabel: 'Team Death Match',
    showInMainMenu: true,
    supportsPrivateRoom: true,
    primaryQuickPlay: false,
    sortOrder: 20
  }
};

function cloneMode(mode) {
  const source = mode || {};
  return {
    id: String(source.id || ''),
    label: String(source.label || ''),
    menuButtonLabel: String(source.menuButtonLabel || source.label || ''),
    primaryButtonLabel: String(source.primaryButtonLabel || source.menuButtonLabel || source.label || ''),
    shortLabel: String(source.shortLabel || source.id || ''),
    showInMainMenu: !!source.showInMainMenu,
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

export function getDefaultGameMode() {
  const primary = allModes().find((mode) => mode.primaryQuickPlay);
  return primary ? primary.id : 'ffa';
}

export function normalizeGameMode(modeId) {
  const normalized = String(modeId || '').trim().toLowerCase();
  const source = GAME_MODE_DEFS[normalized];
  if (source && (source.showInMainMenu || source.supportsPrivateRoom)) {
    return source.id;
  }
  return getDefaultGameMode();
}

export function getGameModeLabel(modeId, fallback = '') {
  const normalized = normalizeGameMode(modeId);
  const mode = GAME_MODE_DEFS[normalized];
  if (mode && mode.label) return String(mode.label);
  return String(fallback || '');
}

const runtime = (globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {});
runtime.GameShared = runtime.GameShared || {};
runtime.GameShared.getGameModeCatalog = getGameModeCatalog;
runtime.GameShared.getGameMode = getGameMode;
runtime.GameShared.getQuickPlayGameModes = getQuickPlayGameModes;
runtime.GameShared.getDefaultGameMode = getDefaultGameMode;
runtime.GameShared.normalizeGameMode = normalizeGameMode;
runtime.GameShared.getGameModeLabel = getGameModeLabel;
