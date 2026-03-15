const RUNTIME_MODE_DEFS = {
  cloud_multiplayer: {
    id: 'cloud_multiplayer',
    label: 'Public Lobby',
    menuTitle: 'PUBLIC LOBBY',
    menuDesc: 'Shared Cloudflare lobby for public preview play.',
    backendKind: 'cloudflare-prod',
    backendLabel: 'CLOUDFLARE PROD',
    authorityMode: 'networked',
    authMode: 'public',
    roomStrategy: 'global',
    roomPrefix: '',
    fixedRoomId: '',
    visible: 'always',
    authoritativeTesting: true
  },
  single_cloudflare: {
    id: 'single_cloudflare',
    label: 'Solo Cloudflare (Bots)',
    menuTitle: 'SOLO CLOUDFLARE (BOTS)',
    menuDesc: 'Private Cloudflare test room with bots enabled.',
    backendKind: 'cloudflare-prod',
    backendLabel: 'CLOUDFLARE PROD',
    authorityMode: 'networked',
    authMode: 'public',
    roomStrategy: 'private',
    roomPrefix: 'cf-solo',
    fixedRoomId: '',
    visible: 'always',
    authoritativeTesting: true
  },
  single_dev_server: {
    id: 'single_dev_server',
    label: 'Local Dev Room (Bots)',
    menuTitle: 'LOCAL DEV ROOM (BOTS)',
    menuDesc: 'Shared local Wrangler room with bots enabled.',
    backendKind: 'local-worker',
    backendLabel: 'LOCAL WORKER',
    authorityMode: 'networked',
    authMode: 'public',
    roomStrategy: 'fixed',
    roomPrefix: '',
    fixedRoomId: 'local-shared',
    visible: 'local-only',
    authoritativeTesting: false
  },
  single_full_sandbox: {
    id: 'single_full_sandbox',
    label: 'Offline Sandbox',
    menuTitle: 'OFFLINE SANDBOX',
    menuDesc: 'Offline sandbox with local simulated bots.',
    backendKind: 'sandbox',
    backendLabel: 'OFFLINE SANDBOX',
    authorityMode: 'offline',
    authMode: 'none',
    roomStrategy: 'none',
    roomPrefix: '',
    fixedRoomId: '',
    visible: 'always',
    authoritativeTesting: false
  }
};

function cloneRuntimeMode(mode) {
  const source = mode || {};
  return {
    id: String(source.id || ''),
    label: String(source.label || ''),
    menuTitle: String(source.menuTitle || ''),
    menuDesc: String(source.menuDesc || ''),
    backendKind: String(source.backendKind || ''),
    backendLabel: String(source.backendLabel || ''),
    authorityMode: String(source.authorityMode || ''),
    authMode: String(source.authMode || ''),
    roomStrategy: String(source.roomStrategy || ''),
    roomPrefix: String(source.roomPrefix || ''),
    fixedRoomId: String(source.fixedRoomId || ''),
    visible: String(source.visible || 'always'),
    authoritativeTesting: !!source.authoritativeTesting
  };
}

function allRuntimeModes() {
  return Object.keys(RUNTIME_MODE_DEFS).map((modeId) => cloneRuntimeMode(RUNTIME_MODE_DEFS[modeId]));
}

export function getRuntimeModeCatalog() {
  return allRuntimeModes();
}

export function getRuntimeMode(modeId) {
  const normalized = String(modeId || '').trim().toLowerCase();
  return cloneRuntimeMode(RUNTIME_MODE_DEFS[normalized] || null);
}

export function getDefaultRuntimeModeId() {
  return 'cloud_multiplayer';
}

export function normalizeRuntimeModeId(modeId) {
  const normalized = String(modeId || '').trim().toLowerCase();
  return RUNTIME_MODE_DEFS[normalized] ? normalized : getDefaultRuntimeModeId();
}

const runtime = (globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {});
runtime.GameShared = runtime.GameShared || {};
runtime.GameShared.getRuntimeModeCatalog = getRuntimeModeCatalog;
runtime.GameShared.getRuntimeMode = getRuntimeMode;
runtime.GameShared.getDefaultRuntimeModeId = getDefaultRuntimeModeId;
runtime.GameShared.normalizeRuntimeModeId = normalizeRuntimeModeId;
