import { Quaternion } from 'highchair';
import arenaMeta from './assets/maps/boxman-arena.meta.json' with { type: 'json' };

// The world is a collider mesh with an empty chunk lattice; the only
// voxel blocks that can exist are ones players build (BUILD_BLOCK_ID).
export const BLOCK_ID_BREAK_DAMAGE: Record<string | number, number> = {
  37: 40, // stone (build block)
  default: 30,
};

export const BLOCK_ID_MATERIALS: Record<string | number, number> = {
  37: 5, // stone (build block)
  default: 0,
};

export const BUILD_BLOCK_ID = 37; // stone

export const GAME_DURATION_MS = 8 * 60 * 1000; // 8 minutes

export const ITEM_DESPAWN_TIME_MS = 25 * 1000; // 25 seconds

export const MINIMUM_PLAYERS_TO_START = 2;

export const RANK_ASSIST_EXP = 20;
export const RANK_SAVE_INTERVAL_EXP = 500; // Every increment of this, save the persisted data.
export const RANK_KILL_EXP = 100;
export const RANK_WIN_EXP = 1000;
export const RANKS = [
  {
    name: 'Unranked',
    totalExp: 0,
    iconUri: 'icons/ranks/unranked.png',
    unlocks: [],
  },
  {
    name: 'Bronze I',
    totalExp: 500,
    iconUri: 'icons/ranks/bronze-1.png',
    unlocks: [
      'Visible Rank & Medal - Your rank and medal will be visible to all players in game above your head.',
      'Bronze I Rank',
    ]
  },
  {
    name: 'Bronze II',
    totalExp: 1000,
    iconUri: 'icons/ranks/bronze-2.png',
    unlocks: [
      'Bronze II Rank',
    ]
  },
  {
    name: 'Bronze III',
    totalExp: 1500,
    iconUri: 'icons/ranks/bronze-3.png',
    unlocks: [
      'Bronze III Rank',
    ]
  },
  {
    name: 'Bronze IV',
    totalExp: 2500,
    iconUri: 'icons/ranks/bronze-4.png',
    unlocks: [
      'Bronze IV Rank',
    ]
  },
  {
    name: 'Bronze V',
    totalExp: 4000,
    iconUri: 'icons/ranks/bronze-5.png',
    unlocks: [
      'Bronze V Rank',
    ]
  },
  {
    name: 'Silver I',
    totalExp: 6000,
    iconUri: 'icons/ranks/silver-1.png',
    unlocks: [
      'Competitive Matches - Your performance in any match that includes other Silver rank or higher players will affect your competitive ranking based on your relative finishing position.',
      'Silver I Rank',
    ]
  },
  {
    name: 'Silver II',
    totalExp: 9000,
    iconUri: 'icons/ranks/silver-2.png',
    unlocks: [
      'Silver II Rank',
    ]
  },
  {
    name: 'Silver III',
    totalExp: 13000,
    iconUri: 'icons/ranks/silver-3.png',
    unlocks: [
      'Silver III Rank',
    ]
  },
  {
    name: 'Silver IV',
    totalExp: 18000,
    iconUri: 'icons/ranks/silver-4.png',
    unlocks: [
      'Silver IV Rank',
    ]
  },
  {
    name: 'Silver V',
    totalExp: 24000,
    iconUri: 'icons/ranks/silver-5.png',
    unlocks: [
      'Silver V Rank',
    ]
  },
  {
    name: 'Gold I',
    totalExp: 32000,
    iconUri: 'icons/ranks/gold-1.png',
    unlocks: [
      'Gold Flex - All weapons will be tinted gold when you hold them.',
      'Gold I Rank',
    ]
  },
  {
    name: 'Gold II',
    totalExp: 42000,
    iconUri: 'icons/ranks/gold-2.png',
    unlocks: [
      'Gold II Rank',
    ]
  },
  {
    name: 'Gold III',
    totalExp: 54000,
    iconUri: 'icons/ranks/gold-3.png',
    unlocks: [
      'Gold III Rank',
    ]
  },
  {
    name: 'Gold IV',
    totalExp: 68000,
    iconUri: 'icons/ranks/gold-4.png',
    unlocks: [
      'Gold IV Rank',
    ]
  },
  {
    name: 'Gold V',
    totalExp: 85000,
    iconUri: 'icons/ranks/gold-5.png',
    unlocks: [
      'Gold V Rank',
    ]
  },
  {
    name: 'Platinum I',
    totalExp: 105000,
    iconUri: 'icons/ranks/platinum-1.png',
    unlocks: [
      'Celestial Hammer - Your pickaxe is replaced with a magnificent celestial hammer.',
      'Platinum I Rank',
    ]
  },
  {
    name: 'Platinum II',
    totalExp: 130000,
    iconUri: 'icons/ranks/platinum-2.png',
    unlocks: [
      'Platinum II Rank',
    ]
  },
  {
    name: 'Platinum III',
    totalExp: 160000,
    iconUri: 'icons/ranks/platinum-3.png',
    unlocks: [
      'Platinum III Rank',
    ]
  },
  {
    name: 'Platinum IV',
    totalExp: 195000,
    iconUri: 'icons/ranks/platinum-4.png',
    unlocks: [
      'Platinum IV Rank',
    ]
  },
  {
    name: 'Platinum V',
    totalExp: 235000,
    iconUri: 'icons/ranks/platinum-5.png',
    unlocks: [
      'Platinum V Rank',
    ]
  },
  {
    name: 'Diamond I',
    totalExp: 280000,
    iconUri: 'icons/ranks/diamond-1.png',
    unlocks: [
      'Opulent Wings - Your character will be adorned with visual wings.',
      'Diamond I Rank',
    ]
  },
  {
    name: 'Diamond II',
    totalExp: 330000,
    iconUri: 'icons/ranks/diamond-2.png',
    unlocks: [
      'Diamond II Rank',
    ]
  },
  {
    name: 'Diamond III',
    totalExp: 385000,
    iconUri: 'icons/ranks/diamond-3.png',
    unlocks: [
      'Diamond III Rank',
    ]
  },
  {
    name: 'Diamond IV',
    totalExp: 445000,
    iconUri: 'icons/ranks/diamond-4.png',
    unlocks: [
      'Diamond IV Rank',
    ]
  },
  {
    name: 'Diamond V',
    totalExp: 510000,
    iconUri: 'icons/ranks/diamond-5.png',
    unlocks: [
      'Diamond V Rank',
    ]
  },
  {
    name: 'Elite I',
    totalExp: 580000,
    iconUri: 'icons/ranks/elite-1.png',
    unlocks: [
      'Elite Outfit - Your character will be adorned with a special elite outfit.',
      'Elite I Rank',
    ]
  },
  {
    name: 'Elite II',
    totalExp: 655000,
    iconUri: 'icons/ranks/elite-2.png',
    unlocks: [
      'Elite II Rank',
    ]
  },
  {
    name: 'Elite III',
    totalExp: 735000,
    iconUri: 'icons/ranks/elite-3.png',
    unlocks: [
      'Elite III Rank',
    ]
  },
  {
    name: 'Elite IV',
    totalExp: 820000,
    iconUri: 'icons/ranks/elite-4.png',
    unlocks: [
      'Elite IV Rank',
    ]
  },
  {
    name: 'Elite V',
    totalExp: 910000,
    iconUri: 'icons/ranks/elite-5.png',
    unlocks: [
      'Highest Honor - Your character will receive something extremely special. You will need to reach this rank to find out what it is!',
      'Elite V Rank',
    ]
  },
]

// Spawn heights are the world collider floor surfaces
// (tools/export-boxman-glb.mjs). Entity positions are the CAPSULE CENTER,
// not the feet, so every spawn adds this standing clearance on top.
// Measured: a player capsule (modelScale 0.75) rests with its center
// 1.135 above the floor.
export const PLAYER_STAND_HEIGHT = 1.2;

export const SPAWN_POINTS = arenaMeta.spawnPoints.map(point => ({
  ...point,
  y: point.y + PLAYER_STAND_HEIGHT,
}));
