export const PLAYER_SPAWN_SHIELD_MS = 1000;
export const RESPAWN_DELAY_MS = 2200;

const runtime = (typeof globalThis !== 'undefined') ? globalThis : {};
runtime.__MAYHEM_RUNTIME = runtime.__MAYHEM_RUNTIME || {};
runtime.__MAYHEM_RUNTIME.GameShared = runtime.__MAYHEM_RUNTIME.GameShared || {};
runtime.__MAYHEM_RUNTIME.GameShared.combatTimings = {
  PLAYER_SPAWN_SHIELD_MS,
  RESPAWN_DELAY_MS
};
runtime.__MAYHEM_RUNTIME.GameShared.getCombatTimings = function () {
  return {
    PLAYER_SPAWN_SHIELD_MS,
    RESPAWN_DELAY_MS
  };
};
