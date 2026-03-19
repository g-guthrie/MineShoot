import React from 'react';
import { Crosshair, Bomb, Sword, Zap, Wind, Flame, Sparkles, Target, Eye, Heart, Anchor, Grip, Rows3, Asterisk } from 'lucide-react';
import { useGameLoadout } from '@/integration/loadout';

type ThrowableCategory = 'grenade' | 'blade';

interface LoadoutItem {
  id: string;
  name: string;
  icon: React.ReactNode;
}

const WEAPONS: LoadoutItem[] = [
  { id: 'machinegun', name: 'MACHINE GUN', icon: <Rows3 className="w-4 h-4" /> },
  { id: 'shotgun', name: 'SHOTGUN', icon: <Grip className="w-4 h-4" /> },
  { id: 'rifle', name: 'RIFLE', icon: <Crosshair className="w-4 h-4" /> },
  { id: 'pistol', name: 'PISTOL', icon: <Asterisk className="w-4 h-4" /> },
  { id: 'sniper', name: 'SNIPER', icon: <Target className="w-4 h-4" /> },
];

const THROWABLE_CATEGORIES: { id: ThrowableCategory; label: string }[] = [
  { id: 'grenade', label: 'GRENADES' },
  { id: 'blade', label: 'BLADES & OBJECTS' },
];

const THROWABLES: Record<ThrowableCategory, LoadoutItem[]> = {
  grenade: [
    { id: 'frag', name: 'FRAG', icon: <Bomb className="w-4 h-4" /> },
    { id: 'plasma', name: 'PLASMA', icon: <Sparkles className="w-4 h-4" /> },
    { id: 'molotov', name: 'MOLOTOV', icon: <Flame className="w-4 h-4" /> },
  ],
  blade: [
    { id: 'knife', name: 'KNIFE', icon: <Sword className="w-4 h-4" /> },
  ],
};

const ABILITIES: LoadoutItem[] = [
  { id: 'choke', name: 'VADER CHOKE', icon: <Wind className="w-4 h-4" /> },
  { id: 'hook', name: 'CHAIN HOOK', icon: <Anchor className="w-4 h-4" /> },
  { id: 'heal', name: 'HEAL', icon: <Heart className="w-4 h-4" /> },
  { id: 'missile', name: 'MISSILE', icon: <Zap className="w-4 h-4" /> },
  { id: 'deadeye', name: 'DEADEYE', icon: <Eye className="w-4 h-4" /> },
];

const LoadoutBand: React.FC = () => {
  const loadout = useGameLoadout();

  const getWeaponName = (id: string) => WEAPONS.find((weapon) => weapon.id === id)?.name ?? id;
  const getAbilityName = (id: string) => ABILITIES.find((ability) => ability.id === id)?.name ?? id;

  return (
    <footer id="menu-loadout-band" className="border-t border-border/30">
      <div className="px-4 sm:px-6 py-3">
        <div className="flex items-center justify-between mb-2">
          {loadout.collapsed ? (
            <div id="loadout-collapsed-row" className="flex gap-3">
              <button id="weapon-slot-summary" className="pill-btn !py-1.5 text-[10px]" onClick={() => loadout.setCollapsed(false)}>
                <Crosshair className="w-3 h-3" /> {getWeaponName(loadout.weaponSlots[0])} / {getWeaponName(loadout.weaponSlots[1])}
              </button>
              <button id="throwable-slot-summary" className="pill-btn !py-1.5 text-[10px]" onClick={() => loadout.setCollapsed(false)}>
                <Bomb className="w-3 h-3" /> {loadout.selectedThrowableId.toUpperCase()}
              </button>
              <button id="ability-slot-summary" className="pill-btn !py-1.5 text-[10px]" onClick={() => loadout.setCollapsed(false)}>
                <Zap className="w-3 h-3" /> {getAbilityName(loadout.abilitySlots[0])} / {getAbilityName(loadout.abilitySlots[1])}
              </button>
            </div>
          ) : (
            <div />
          )}
          <button
            id="loadout-collapse-btn"
            className="pill-btn !py-1.5 !px-3 text-[10px] ml-auto"
            onClick={() => loadout.setCollapsed(!loadout.collapsed)}
          >
            {loadout.collapsed ? '▲ EXPAND LOADOUT' : '▼ COLLAPSE LOADOUT'}
          </button>
        </div>

        {!loadout.collapsed && (
          <div id="loadout-expanded-shell">
            <div id="loadout-row" className="loadout-grid grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div id="weapon-slot-panel" className="glass-card p-3 flex flex-col gap-3">
                <span className="section-label flex items-center gap-1.5">
                  <Crosshair className="w-3 h-3 text-primary" /> ARSENAL
                </span>
                <div className="slot-row flex gap-2">
                  <button
                    id="weapon-slot-primary"
                    className={`slot-btn flex-1 ${loadout.activeWeaponSlot === 0 ? 'active' : ''}`}
                    onClick={() => loadout.setActiveWeaponSlot(0)}
                  >
                    SLOT 1
                  </button>
                  <button
                    id="weapon-slot-secondary"
                    className={`slot-btn flex-1 ${loadout.activeWeaponSlot === 1 ? 'active' : ''}`}
                    onClick={() => loadout.setActiveWeaponSlot(1)}
                  >
                    SLOT 2
                  </button>
                </div>
                <div id="weapon-choice-grid" className="item-selection-grid grid grid-cols-3 gap-1.5 overflow-y-auto max-h-[200px]">
                  {WEAPONS.map((weapon) => (
                    <button
                      key={weapon.id}
                      className={`weapon-choice-btn item-grid-btn ${loadout.weaponSlots[loadout.activeWeaponSlot] === weapon.id ? 'selected' : ''}`}
                      data-weapon-id={weapon.id}
                      onClick={() => loadout.setWeapon(weapon.id)}
                    >
                      {weapon.icon}
                      <span className="text-[10px] font-bold font-orbitron">{weapon.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div id="throwable-slot-panel" className="glass-card p-3 flex flex-col gap-3">
                <span className="section-label flex items-center gap-1.5">
                  <Bomb className="w-3 h-3 text-primary" /> TACTICAL
                </span>
                <div id="throwable-category-tabs" className="slot-row flex gap-2">
                  {THROWABLE_CATEGORIES.map((category) => (
                    <button
                      key={category.id}
                      className={`slot-btn flex-1 ${loadout.throwableCategory === category.id ? 'active' : ''}`}
                      data-cat-id={category.id}
                      onClick={() => loadout.setThrowableCategory(category.id)}
                    >
                      {category.label}
                    </button>
                  ))}
                </div>
                <div id="throwable-choice-grid" className="item-selection-grid grid grid-cols-3 gap-1.5 overflow-y-auto max-h-[200px]">
                  {THROWABLES[loadout.throwableCategory].map((throwable) => (
                    <button
                      key={throwable.id}
                      className={`throwable-choice-btn item-grid-btn ${loadout.selectedThrowableId === throwable.id ? 'selected' : ''}`}
                      data-throwable-id={throwable.id}
                      data-category-id={loadout.throwableCategory}
                      onClick={() => loadout.setThrowable(throwable.id)}
                    >
                      {throwable.icon}
                      <span className="text-[10px] font-bold font-orbitron">{throwable.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div id="ability-slot-panel" className="glass-card p-3 flex flex-col gap-3">
                <span className="section-label flex items-center gap-1.5">
                  <Zap className="w-3 h-3 text-primary" /> ABILITIES
                </span>
                <div className="slot-row flex gap-2">
                  <button
                    id="ability-slot-primary"
                    className={`slot-btn flex-1 ${loadout.activeAbilitySlot === 0 ? 'active' : ''}`}
                    onClick={() => loadout.setActiveAbilitySlot(0)}
                  >
                    ABILITY 1
                  </button>
                  <button
                    id="ability-slot-secondary"
                    className={`slot-btn flex-1 ${loadout.activeAbilitySlot === 1 ? 'active' : ''}`}
                    onClick={() => loadout.setActiveAbilitySlot(1)}
                  >
                    ABILITY 2
                  </button>
                </div>
                <div id="ability-choice-grid" className="item-selection-grid grid grid-cols-3 gap-1.5 overflow-y-auto max-h-[200px]">
                  {ABILITIES.map((ability) => (
                    <button
                      key={ability.id}
                      className={`ability-choice-btn item-grid-btn ${loadout.abilitySlots[loadout.activeAbilitySlot] === ability.id ? 'selected' : ''}`}
                      data-ability-id={ability.id}
                      onClick={() => loadout.setAbility(ability.id)}
                    >
                      {ability.icon}
                      <span className="text-[10px] font-bold font-orbitron">{ability.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </footer>
  );
};

export default LoadoutBand;
