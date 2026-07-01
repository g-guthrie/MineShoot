import { Quaternion } from 'highchair';
import arenaMeta from './assets/maps/boxman-arena.meta.json' with { type: 'json' };

export const BEDROCK_BLOCK_ID = 2;

export const BLOCK_ID_BREAK_DAMAGE: Record<string | number, number> = {
  1: 50, // bricks
  4: 50, // cobblestone
  6: 70, // diamond block
  7: 70, // diamond ore
  8: 10, // dirt
  14: 10, // glass
  15: 70, // gold ore
  16: 10, // grass
  17: 10, // gravel
  19: 100, // infected shadowrock core
  20: 100, // infected shadowrock
  24: 50, // mossy cobblestone
  27: 10, // oak leaves
  30: 10, // sand
  36: 100, // stone bricks
  37: 40, // stone (also build block)
  // biome-arena additions
  9: 100, // dragon block
  10: 70, // dragons-stone
  11: 70, // emerald block
  18: 20, // ice
  23: 30, // log
  25: 10, // nuit leaves
  28: 30, // oak planks
  29: 10, // sand light
  31: 40, // sandstone light
  32: 40, // sandstone
  33: 15, // shadow pebble
  34: 70, // shadowrock
  38: 100, // swirl rune
  44: 10, 45: 10, 46: 10, 47: 10, // snow variants
  48: 30, // ice block
  49: 70, 50: 70, // shale cliffs
  51: 50, // shale rock
  52: 15, 53: 15, // lava dirt
  54: 30, // lava rocky
  56: 50, 57: 50, 58: 40, // jungle blocks
  59: 10, 60: 10, 61: 10, // jungle dirt
  62: 50, 63: 50, // dark cobblestone
  64: 30, 65: 30, 66: 30, // dark oak / slats
  67: 10, // cracked sand
  68: 10, // glass window
  default: 30, // default for all other blocks
}

export const BLOCK_ID_MATERIALS: Record<string | number, number> = {
  1: 4, // bricks
  2: 0, // bedrock
  6: 10, // diamond block
  7: 10, // diamond ore,
  8: 0, // dirt
  14: 0, // glass
  15: 8, // gold ore,
  16: 0, // grass
  19: 8, // infected shadowrock core
  20: 8, // infected shadowrock
  22: 0, // lava
  23: 2, // log
  28: 2, // oak planks
  36: 5, // stone bricks
  42: 0, // water flow
  43: 0, // water still
  // biome-arena additions
  9: 10, // dragon block
  11: 10, // emerald block
  18: 1, // ice
  25: 0, // nuit leaves
  27: 0, // oak leaves
  31: 3, 32: 3, // sandstone
  33: 1, // shadow pebble
  34: 5, // shadowrock
  38: 8, // swirl rune
  44: 0, 45: 0, 46: 0, 47: 0, // snow
  48: 2, // ice block
  49: 5, 50: 5, 51: 4, // shale
  52: 0, 53: 0, 54: 2, // lava ground
  56: 4, 57: 4, 58: 3, // jungle blocks
  59: 0, 60: 0, 61: 0, // jungle dirt
  64: 2, 65: 2, 66: 2, // dark oak / slats
  67: 0, // cracked sand
  68: 0, // glass window
  default: 1, // default for all other blocks
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

// Spawn points are generated alongside the map (tools/build-map.mjs) so they
// always sit on real walkable floor.
export const SPAWN_POINTS = arenaMeta.spawnPoints;
