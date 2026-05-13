import { GameSession } from './session.js';

const canvas = document.getElementById('game-canvas');
const startBtn = document.getElementById('start-btn');
const session = new GameSession(canvas);

startBtn.addEventListener('click', () => {
  session.input.requestPointerLock();
  session.start();
});

window.__PVP_V2_SESSION__ = session;
