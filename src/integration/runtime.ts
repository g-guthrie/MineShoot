export type RuntimeRecord = Record<string, any>;

function runtime(): RuntimeRecord {
  return ((globalThis as any).__MAYHEM_RUNTIME = (globalThis as any).__MAYHEM_RUNTIME || {});
}

export function getRuntime() {
  return runtime();
}

export function getAuthApi() {
  return runtime().GameNetAuth || null;
}

export function getLobbyApi() {
  return runtime().GameLobbyApi || null;
}

export function getLobbySessionFactory() {
  return runtime().GameLobbySession || null;
}

export function getRuntimeSession() {
  return runtime().GameSession || null;
}

export function getGameMain() {
  return runtime().GameMain || null;
}

export function currentActivityState(): string {
  const session = getRuntimeSession();
  if (session && typeof session.getActivityState === 'function') {
    return String(session.getActivityState() || 'menu');
  }
  const main = getGameMain();
  if (main && typeof main.getActivityState === 'function') {
    return String(main.getActivityState() || 'menu');
  }
  return 'menu';
}

export function roomCodeFromRoomId(roomId: string): string {
  const modeUi = runtime().GameRuntimeModeUi || null;
  if (modeUi && typeof modeUi.roomCodeFromRoomId === 'function') {
    return String(modeUi.roomCodeFromRoomId(roomId) || roomId || '').toUpperCase();
  }
  return String(roomId || '').toUpperCase();
}

export async function ensureMenuIdentity() {
  const authApi = getAuthApi();
  authApi?.enablePublicMode?.();
  await authApi?.ensureArenaIdentity?.();
  await authApi?.ensureMenuSession?.().catch(() => null);
}

export async function launchGameMode(modeId: string, options: Record<string, any> = {}) {
  const main = getGameMain();
  if (main && typeof main.launchModeById === 'function') {
    return main.launchModeById(modeId, options);
  }
  const loader = runtime().GameRuntimeLoader || null;
  if (!loader || typeof loader.loadGameplayRuntime !== 'function') {
    return { ok: false, error: 'Gameplay runtime loader unavailable.' };
  }
  const loadedMain = await loader.loadGameplayRuntime();
  if (!loadedMain || typeof loadedMain.launchModeById !== 'function') {
    return { ok: false, error: 'Gameplay launcher unavailable.' };
  }
  return loadedMain.launchModeById(modeId, options);
}

export async function launchAssignedMatch(state: any) {
  if (!state || !state.self) return null;
  if (state.self.publicMatch && state.self.publicMatch.roomId) {
    return launchGameMode('cloud_multiplayer', {
      roomId: state.self.publicMatch.roomId,
      gameMode: state.self.publicMatch.gameMode || 'ffa',
    });
  }
  if (state.self.privateRoom && state.self.privateRoom.roomId) {
    return launchGameMode('single_cloudflare', {
      roomId: state.self.privateRoom.roomId,
      gameMode: state.self.privateRoom.roomMode || 'ffa',
    });
  }
  return null;
}

export function openDocs(triggerEl?: HTMLElement | null) {
  const loader = runtime().GameRuntimeLoader || null;
  if (!loader || typeof loader.toggleDocs !== 'function') {
    return Promise.resolve(null);
  }
  return loader.toggleDocs(triggerEl || null);
}

export function normalizeGameMode(modeId: string) {
  const shared = runtime().GameShared || null;
  if (shared && typeof shared.normalizeGameMode === 'function') {
    return String(shared.normalizeGameMode(modeId) || 'ffa');
  }
  const next = String(modeId || '').trim().toLowerCase();
  if (next === 'tdm' || next === 'lms' || next === 'practice' || next === 'ffa') return next;
  return 'ffa';
}
