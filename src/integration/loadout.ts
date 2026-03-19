import { useEffect, useSyncExternalStore } from 'react';

type LoadoutState = {
  weaponSlots: [string, string];
  activeWeaponSlot: 0 | 1;
  throwableCategory: 'grenade' | 'blade';
  selectedThrowableId: string;
  abilitySlots: [string, string];
  activeAbilitySlot: 0 | 1;
  collapsed: boolean;
};

type Listener = () => void;

const STORAGE_KEY = 'mayhem.portal.loadout.v1';
const listeners = new Set<Listener>();

const defaultState: LoadoutState = {
  weaponSlots: ['machinegun', 'shotgun'],
  activeWeaponSlot: 0,
  throwableCategory: 'grenade',
  selectedThrowableId: 'frag',
  abilitySlots: ['choke', 'missile'],
  activeAbilitySlot: 0,
  collapsed: false,
};

let state: LoadoutState = loadState();

function runtime(): Record<string, any> {
  return ((globalThis as any).__MAYHEM_RUNTIME = (globalThis as any).__MAYHEM_RUNTIME || {});
}

function loadState(): LoadoutState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaultState };
    const parsed = JSON.parse(raw);
    return {
      weaponSlots: [String(parsed?.weaponSlots?.[0] || defaultState.weaponSlots[0]), String(parsed?.weaponSlots?.[1] || defaultState.weaponSlots[1])],
      activeWeaponSlot: parsed?.activeWeaponSlot === 1 ? 1 : 0,
      throwableCategory: parsed?.throwableCategory === 'blade' ? 'blade' : 'grenade',
      selectedThrowableId: String(parsed?.selectedThrowableId || defaultState.selectedThrowableId),
      abilitySlots: [String(parsed?.abilitySlots?.[0] || defaultState.abilitySlots[0]), String(parsed?.abilitySlots?.[1] || defaultState.abilitySlots[1])],
      activeAbilitySlot: parsed?.activeAbilitySlot === 1 ? 1 : 0,
      collapsed: !!parsed?.collapsed,
    };
  } catch {
    return { ...defaultState };
  }
}

function saveState() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // no-op
  }
}

function emit() {
  saveState();
  installGameMenuLoadout();
  listeners.forEach((listener) => listener());
}

function patch(next: Partial<LoadoutState>) {
  state = { ...state, ...next };
  emit();
}

function pairReplace(pair: [string, string], activeIndex: 0 | 1, nextId: string): [string, string] {
  const next: [string, string] = [pair[0], pair[1]];
  const other = activeIndex === 0 ? 1 : 0;
  if (next[other] === nextId) next[other] = next[activeIndex];
  next[activeIndex] = nextId;
  return next;
}

function applyToRuntime(multiplayerMode = false) {
  const rt = runtime();
  const weaponSlots = state.weaponSlots.filter(Boolean);
  if (rt.GameHitscan?.setWeaponOrder && weaponSlots.length) {
    rt.GameHitscan.setWeaponOrder(weaponSlots);
  }
  if (rt.GamePlayer?.setLoadout && weaponSlots.length) {
    rt.GamePlayer.setLoadout({ slots: weaponSlots });
  }
  const netCommands = rt.GameNet?.commands || rt.GameNet || null;
  if (multiplayerMode && netCommands?.sendWeaponLoadout) {
    netCommands.sendWeaponLoadout(state.weaponSlots[0] || '', state.weaponSlots[1] || '');
  }
  if (rt.GameThrowables?.setSelectedThrowable && state.selectedThrowableId) {
    rt.GameThrowables.setSelectedThrowable(state.selectedThrowableId);
  }
  if (rt.GameAbilities?.setLoadoutSlot) {
    rt.GameAbilities.setLoadoutSlot(1, state.abilitySlots[0] || '');
    rt.GameAbilities.setLoadoutSlot(2, state.abilitySlots[1] || '');
    if (rt.GameUI?.updateAbilityInfo && rt.GameAbilities?.getHudState) {
      rt.GameUI.updateAbilityInfo(rt.GameAbilities.getHudState());
    }
  }
  if (multiplayerMode && netCommands?.sendAbilityLoadout) {
    netCommands.sendAbilityLoadout(state.abilitySlots[0] || '', state.abilitySlots[1] || '');
  }
}

function validateSelections() {
  const missing: string[] = [];
  if (!state.weaponSlots[0]) missing.push('weapon slot 1');
  if (!state.weaponSlots[1]) missing.push('weapon slot 2');
  if (!state.abilitySlots[0]) missing.push('ability 1');
  if (!state.abilitySlots[1]) missing.push('ability 2');
  if (!state.selectedThrowableId) missing.push('throwable');
  if (!missing.length) return { ok: true, message: '' };
  return { ok: false, message: 'Missing ' + missing.join(', ') + '.' };
}

function installGameMenuLoadout() {
  const rt = runtime();
  rt.GameMenuLoadout = {
    init() {
      installGameMenuLoadout();
    },
    syncToRuntime(multiplayerMode = false) {
      applyToRuntime(!!multiplayerMode);
    },
    getWeaponSlots() {
      return state.weaponSlots.slice();
    },
    getAbilityLoadout() {
      return { slot1: state.abilitySlots[0], slot2: state.abilitySlots[1] };
    },
    getSelectedThrowable() {
      return state.selectedThrowableId;
    },
    validateSelections,
    getRuntimeSnapshot() {
      return {
        weaponSlots: state.weaponSlots.slice(),
        abilityLoadout: { slot1: state.abilitySlots[0], slot2: state.abilitySlots[1] },
        selectedThrowableId: state.selectedThrowableId,
      };
    },
    subscribe(listener: Listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

installGameMenuLoadout();

export function useGameLoadout() {
  const snapshot = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
    () => state,
  );

  useEffect(() => {
    installGameMenuLoadout();
  }, []);

  return {
    ...snapshot,
    setCollapsed(next: boolean) {
      patch({ collapsed: !!next });
    },
    setActiveWeaponSlot(slot: 0 | 1) {
      patch({ activeWeaponSlot: slot });
    },
    setWeapon(id: string) {
      patch({ weaponSlots: pairReplace(state.weaponSlots, state.activeWeaponSlot, String(id || '')) });
    },
    setThrowableCategory(category: 'grenade' | 'blade') {
      patch({ throwableCategory: category === 'blade' ? 'blade' : 'grenade' });
    },
    setThrowable(id: string) {
      patch({ selectedThrowableId: String(id || '') });
    },
    setActiveAbilitySlot(slot: 0 | 1) {
      patch({ activeAbilitySlot: slot });
    },
    setAbility(id: string) {
      patch({ abilitySlots: pairReplace(state.abilitySlots, state.activeAbilitySlot, String(id || '')) });
    },
  };
}
