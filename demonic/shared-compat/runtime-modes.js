const FALLBACK_MODES = [
  {
    id: 'cloud_multiplayer',
    label: 'Public Lobby',
    backendKind: 'cloudflare-prod',
    authorityMode: 'networked',
    backendLabel: 'CLOUDFLARE PROD',
    roomStrategy: 'global'
  },
  {
    id: 'single_cloudflare',
    label: 'Solo Cloudflare (Bots)',
    backendKind: 'cloudflare-prod',
    authorityMode: 'networked',
    backendLabel: 'CLOUDFLARE PROD',
    roomStrategy: 'private'
  },
  {
    id: 'single_dev_server',
    label: 'Local Dev Room (Bots)',
    backendKind: 'local-worker',
    authorityMode: 'networked',
    backendLabel: 'LOCAL WORKER',
    roomStrategy: 'fixed'
  },
  {
    id: 'single_full_sandbox',
    label: 'Offline Sandbox',
    backendKind: 'sandbox',
    authorityMode: 'offline',
    backendLabel: 'OFFLINE SANDBOX',
    roomStrategy: 'none'
  }
];

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
    : FALLBACK_MODES;

  return (Array.isArray(modes) ? modes : FALLBACK_MODES)
    .map(normalizeMode)
    .filter((mode) => mode.id);
}
