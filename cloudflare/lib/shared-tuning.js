import { gameplayTuning } from '../../shared/gameplay-tuning.js';

function deepClone(data) {
  return JSON.parse(JSON.stringify(data));
}

export function getSharedTuningWu() {
  const shared = gameplayTuning;
  if (!shared || typeof shared !== 'object') {
    throw new Error('GameShared.gameplayTuning is missing.');
  }

  if (!shared.classPresets || !shared.weaponStats) {
    throw new Error('GameShared.gameplayTuning is missing required sections.');
  }

  return deepClone(shared);
}
