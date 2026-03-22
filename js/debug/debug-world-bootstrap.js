/**
 * debug-world-bootstrap.js
 * Two-phase bootstrap: set THREE global before IIFE modules load.
 */
import * as THREE from 'three';

globalThis.THREE = THREE;
globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};

await import('./debug-world-main.js');
