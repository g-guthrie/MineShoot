import { createMatchClientStack } from './match-client-stack.mjs';
import { createMatchRuntimeCoordinator } from '../coordinator/match-runtime-coordinator.mjs';
import { createPlayerRuntime } from '../player/runtime.mjs';
import { GamePlayerCombat } from '../../player-combat.js';
import { GameUI } from '../../ui.js';
import { GameAudio } from '../../audio.js';
import { GameNet } from '../../network.js';
import { GameHitscan } from '../../hitscan.js';
import { GamePlayer } from '../../player.js';
import { GameWorld } from '../../world.js';

export function createDefaultGameClientStack(options = {}) {
  const playerRuntime = createPlayerRuntime({
    playerApi: GamePlayer
  });

  const coordinator = createMatchRuntimeCoordinator({
    worldApi: GameWorld,
    playerRuntime,
    netApi: GameNet,
    hitscanApi: GameHitscan,
    combatApi: GamePlayerCombat,
    uiApi: GameUI,
    audioApi: GameAudio,
    document: options.document,
    THREE: options.THREE
  });

  return createMatchClientStack({
    netApi: GameNet,
    coordinator,
    performanceApi: options.performanceApi,
    setTimeoutFn: options.setTimeoutFn
  });
}
