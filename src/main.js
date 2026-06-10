/**
 * main.js - Entry point. The world/rig modules expect THREE and the
 * __MAYHEM_RUNTIME registry as globals, so install those before any of
 * them are evaluated, then boot the game.
 */
import * as THREE from 'three';

globalThis.THREE = THREE;
globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};

await import('./game.js');
