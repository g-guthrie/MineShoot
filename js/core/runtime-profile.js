import { protocol as sharedProtocol } from '../../shared/protocol.js';

const PROD_WORKER_ORIGIN = 'https://mayhem.gguthrie-minecraft-fps.workers.dev';
const LOCAL_WORKER_ORIGIN = 'http://127.0.0.1:8787';
const DEFAULT_MODE_ID = 'cloud_multiplayer';
const PUBLIC_FFA_MODE = {
  id: DEFAULT_MODE_ID,
  label: 'Public FFA',
  menuTitle: 'QUICK MATCH (FFA)',
  menuDesc: 'Authoritative public free-for-all.',
  backendKind: 'cloudflare-prod',
  backendLabel: 'CLOUDFLARE PROD',
  authorityMode: 'networked',
  authMode: 'guest',
  roomStrategy: 'matchmaking',
  roomPrefix: '',
  roomId: 'global',
  gameMode: 'ffa',
  visible: 'always'
};

function cloneMode(mode) {
  if (!mode) return null;
  return {
    id: mode.id,
    label: mode.label,
    menuTitle: mode.menuTitle,
    menuDesc: mode.menuDesc,
    backendKind: mode.backendKind,
    backendLabel: mode.backendLabel,
    authorityMode: mode.authorityMode,
    authMode: mode.authMode,
    roomStrategy: mode.roomStrategy,
    roomPrefix: mode.roomPrefix,
    apiOrigin: mode.apiOrigin || '',
    backendOrigin: mode.backendOrigin || '',
    roomId: mode.roomId || 'global',
    gameMode: mode.gameMode || 'ffa',
    visible: mode.visible
  };
}

function isAbsoluteUrl(raw) {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(String(raw || ''));
}

function isLocalHost(hostname) {
  const host = String(hostname || '').toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '::1';
}

function backendOriginFor(kind) {
  if (kind === 'cloudflare-prod') return PROD_WORKER_ORIGIN;
  if (kind === 'local-worker') return LOCAL_WORKER_ORIGIN;
  return '';
}

function absolutize(path, base) {
  if (!path) return '';
  if (isAbsoluteUrl(path)) return String(path);
  return new URL(String(path), String(base)).toString();
}

export function createRuntimeProfile(options = {}) {
  const location = options.location || window.location;
  const protocol = options.protocol || sharedProtocol || null;
  let selectedModeId = '';

  function isLocalEnvironment() {
    if (location.protocol === 'file:') return true;
    if (isLocalHost(location.hostname)) return true;
    return false;
  }

  function isHttpEnvironment() {
    return location.protocol === 'http:' || location.protocol === 'https:';
  }

  function apiOriginFor(mode) {
    if (!mode || !mode.backendKind) return '';
    if (mode.backendKind === 'cloudflare-prod' && isHttpEnvironment() && !isLocalEnvironment()) {
      return String(location.origin || '');
    }
    return backendOriginFor(mode.backendKind);
  }

  function resolveMode(modeId) {
    if (modeId && modeId !== DEFAULT_MODE_ID) return null;
    return cloneMode({
      id: PUBLIC_FFA_MODE.id,
      label: PUBLIC_FFA_MODE.label,
      menuTitle: PUBLIC_FFA_MODE.menuTitle,
      menuDesc: PUBLIC_FFA_MODE.menuDesc,
      backendKind: PUBLIC_FFA_MODE.backendKind,
      backendLabel: PUBLIC_FFA_MODE.backendLabel,
      authorityMode: PUBLIC_FFA_MODE.authorityMode,
      authMode: PUBLIC_FFA_MODE.authMode,
      roomStrategy: PUBLIC_FFA_MODE.roomStrategy,
      roomPrefix: PUBLIC_FFA_MODE.roomPrefix,
      apiOrigin: apiOriginFor(PUBLIC_FFA_MODE),
      backendOrigin: backendOriginFor(PUBLIC_FFA_MODE.backendKind),
      roomId: protocol && protocol.defaults ? protocol.defaults.roomId || PUBLIC_FFA_MODE.roomId : PUBLIC_FFA_MODE.roomId,
      gameMode: PUBLIC_FFA_MODE.gameMode,
      visible: true
    });
  }

  function selectedOrDefaultMode() {
    const resolved = selectedModeId ? resolveMode(selectedModeId) : null;
    if (resolved) return resolved;
    return resolveMode(DEFAULT_MODE_ID);
  }

  return {
    isLocalEnvironment,
    requestedRoomId() {
      return '';
    },
    getRequestedModeId() {
      return '';
    },
    getAvailableModes() {
      return [resolveMode(DEFAULT_MODE_ID)].filter(Boolean);
    },
    getMode(modeId) {
      return resolveMode(modeId);
    },
    selectMode(modeId) {
      const resolved = resolveMode(modeId);
      if (!resolved) return null;
      selectedModeId = resolved.id;
      return cloneMode(resolved);
    },
    clearSelectedMode() {
      selectedModeId = '';
    },
    getSelectedMode() {
      return selectedModeId ? resolveMode(selectedModeId) : null;
    },
    resolveApiUrl(path) {
      if (!path) return '';
      if (isAbsoluteUrl(path)) return String(path);

      const mode = selectedOrDefaultMode();
      const base = (mode && mode.apiOrigin)
        ? mode.apiOrigin
        : (isHttpEnvironment() ? String(location.origin || '') : LOCAL_WORKER_ORIGIN);
      return absolutize(path, base);
    },
    resolveWsUrl(path) {
      if (!path) return '';
      if (/^wss?:\/\//i.test(String(path))) return String(path);

      const mode = selectedOrDefaultMode();
      const base = (mode && mode.backendOrigin)
        ? mode.backendOrigin
        : (isHttpEnvironment() ? String(location.origin || '') : LOCAL_WORKER_ORIGIN);
      const wsBase = String(base).replace(/^http:/i, 'ws:').replace(/^https:/i, 'wss:');
      return absolutize(path, wsBase);
    }
  };
}

const defaultBrowserLocation = (typeof window !== 'undefined' && window.location)
  ? window.location
  : {
      protocol: 'http:',
      hostname: '127.0.0.1',
      origin: LOCAL_WORKER_ORIGIN
    };

export const gameRuntimeProfile = createRuntimeProfile({
  protocol: sharedProtocol,
  location: defaultBrowserLocation
});
