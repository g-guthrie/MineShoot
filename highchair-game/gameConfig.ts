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
