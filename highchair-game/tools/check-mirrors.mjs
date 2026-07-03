#!/usr/bin/env node
/**
 * Mirror-drift checker. Several values are deliberately mirrored across the
 * server / client / game-UI boundary (they can't share imports), which is
 * the bug class behind "hitmarkers on corpses" and friends: a mirror that
 * silently drifts from its source. This script fails loudly instead.
 *
 * Checked mirrors:
 *  - PLAYER_HITBOX fractions: gameConfig.ts (source of truth)
 *      -> highchair-client/src/core/DebugRenderer.ts (H-mode boxes)
 *      -> assets/ui/index.html (client hit prediction)
 *  - Player height: DebugRenderer PLAYER_HEIGHT vs UI PREDICT_PLAYER_HEIGHT
 *
 * Run via `npm run typecheck` (chained) or standalone:
 *   node tools/check-mirrors.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = rel => fs.readFileSync(path.join(here, '..', rel), 'utf8');

const failures = [];

function extract(source, pattern, label) {
  const m = source.match(pattern);
  if (!m) {
    failures.push(`could not find ${label} — did a rename break the checker?`);
    return undefined;
  }
  return Number(m[1]);
}

const gameConfig = read('gameConfig.ts');
const debugRenderer = read('../highchair-client/src/core/DebugRenderer.ts');
const ui = read('assets/ui/index.html');

const truth = {
  bodyHalf: extract(gameConfig, /bodyHalfWidthFrac:\s*([\d.]+)/, 'gameConfig bodyHalfWidthFrac'),
  bodyTop: extract(gameConfig, /bodyTopFrac:\s*([\d.]+)/, 'gameConfig bodyTopFrac'),
  headHalf: extract(gameConfig, /headHalfWidthFrac:\s*([\d.]+)/, 'gameConfig headHalfWidthFrac'),
  headTop: extract(gameConfig, /headTopFrac:\s*([\d.]+)/, 'gameConfig headTopFrac'),
};

const debugMirror = {
  bodyHalf: extract(debugRenderer, /HITBOX_BODY_HALF_WIDTH_FRAC = ([\d.]+)/, 'DebugRenderer body half'),
  bodyTop: extract(debugRenderer, /HITBOX_BODY_TOP_FRAC = ([\d.]+)/, 'DebugRenderer body top'),
  headHalf: extract(debugRenderer, /HITBOX_HEAD_HALF_WIDTH_FRAC = ([\d.]+)/, 'DebugRenderer head half'),
  headTop: extract(debugRenderer, /HITBOX_HEAD_TOP_FRAC = ([\d.]+)/, 'DebugRenderer head top'),
  height: extract(debugRenderer, /PLAYER_HEIGHT = ([\d.]+)/, 'DebugRenderer PLAYER_HEIGHT'),
};

const uiMirror = {
  bodyHalf: extract(ui, /PREDICT_BODY_HALF_FRAC = ([\d.]+)/, 'UI predict body half'),
  bodyTop: extract(ui, /PREDICT_BODY_TOP_FRAC = ([\d.]+)/, 'UI predict body top'),
  headHalf: extract(ui, /PREDICT_HEAD_HALF_FRAC = ([\d.]+)/, 'UI predict head half'),
  headTop: extract(ui, /PREDICT_HEAD_TOP_FRAC = ([\d.]+)/, 'UI predict head top'),
  height: extract(ui, /PREDICT_PLAYER_HEIGHT = ([\d.]+)/, 'UI PREDICT_PLAYER_HEIGHT'),
};

for (const key of ['bodyHalf', 'bodyTop', 'headHalf', 'headTop']) {
  if (truth[key] !== debugMirror[key]) {
    failures.push(`PLAYER_HITBOX.${key}: gameConfig=${truth[key]} but DebugRenderer=${debugMirror[key]}`);
  }
  if (truth[key] !== uiMirror[key]) {
    failures.push(`PLAYER_HITBOX.${key}: gameConfig=${truth[key]} but UI prediction=${uiMirror[key]}`);
  }
}
if (debugMirror.height !== uiMirror.height) {
  failures.push(`player height: DebugRenderer=${debugMirror.height} but UI prediction=${uiMirror.height}`);
}

if (failures.length) {
  console.error('MIRROR DRIFT DETECTED:');
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}
console.log('mirrors in sync: hitbox fractions x2 sites, player height x2 sites');
