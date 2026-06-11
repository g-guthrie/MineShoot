/**
 * main.js - Entry point. Game modules read THREE from globalThis, so it
 * is installed before any of them are evaluated.
 */
import * as THREE from 'three';

globalThis.THREE = THREE;

await import('./game.js');
