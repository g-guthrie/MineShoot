/**
 * Every weapon a player can put in their loadout. Players carry the pickaxe
 * plus up to LOADOUT_SLOTS guns chosen from this catalog (set via the
 * in-game loadout menu); there are no weapon pickups on the map.
 */
export interface GunCatalogEntry {
  id: string;
  label: string;
  icon: string;
}

export const GUN_CATALOG: readonly GunCatalogEntry[] = [
  { id: 'pistol', label: 'Pistol', icon: 'icons/pistol.png' },
  { id: 'revolver', label: 'Revolver', icon: 'icons/revolver.png' },
  { id: 'submachine-gun', label: 'SMG', icon: 'icons/submachine-gun.png' },
  { id: 'shotgun', label: 'Shotgun', icon: 'icons/shotgun.png' },
  { id: 'auto-shotgun', label: 'Auto Shotgun', icon: 'icons/auto-shotgun.png' },
  { id: 'ak47', label: 'AK-47', icon: 'icons/ak-47.png' },
  { id: 'light-machine-gun', label: 'LMG', icon: 'icons/light-machine-gun.png' },
  { id: 'scout-rifle', label: 'Scout Rifle', icon: 'icons/scout-rifle.png' },
  { id: 'sniper', label: 'Sniper', icon: 'icons/sniper.png' },
  { id: 'rocket-launcher', label: 'Rocket Launcher', icon: 'icons/rocket-launcher.png' },
  { id: 'mining-drill', label: 'Mining Drill', icon: 'icons/mining-drill.png' },
];

export const LOADOUT_SLOTS = 2;

export const DEFAULT_LOADOUT: readonly string[] = [
  'ak47',
  'shotgun',
];

export function isCatalogGun(id: unknown): id is string {
  return typeof id === 'string' && GUN_CATALOG.some(gun => gun.id === id);
}
