/**
 * input.js - Pointer lock, mouse look, and key state for the local player.
 */
export function createInput({ canvas }) {
  const movement = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    jump: false,
    sprint: false,
    adsActive: false
  };

  let locked = false;
  let fireHeld = false;
  let lookHandler = null;
  let fireDownHandler = null;
  let fireUpHandler = null;
  let placeHandler = null;
  let weaponHandler = null;
  let reloadHandler = null;
  let scoreboardHandler = null;
  let adsHandler = null;

  const KEY_MAP = {
    KeyW: 'forward',
    KeyS: 'backward',
    KeyA: 'left',
    KeyD: 'right',
    Space: 'jump',
    ShiftLeft: 'sprint',
    ShiftRight: 'sprint'
  };

  document.addEventListener('keydown', (event) => {
    const move = KEY_MAP[event.code];
    if (move) {
      movement[move] = true;
      if (event.code === 'Space') event.preventDefault();
      return;
    }
    if (event.code === 'Tab') {
      event.preventDefault();
      if (scoreboardHandler) scoreboardHandler(true);
      return;
    }
    if (event.code === 'KeyR' && reloadHandler) {
      reloadHandler();
      return;
    }
    if (event.code === 'KeyQ' && placeHandler && locked) {
      placeHandler();
      return;
    }
    if (event.code.startsWith('Digit') && weaponHandler) {
      const slot = Number(event.code.slice(5)) - 1;
      if (slot >= 0 && slot <= 3) weaponHandler(slot);
    }
  });

  document.addEventListener('keyup', (event) => {
    const move = KEY_MAP[event.code];
    if (move) {
      movement[move] = false;
      return;
    }
    if (event.code === 'Tab' && scoreboardHandler) {
      event.preventDefault();
      scoreboardHandler(false);
    }
  });

  window.addEventListener('blur', () => {
    for (const key of Object.keys(movement)) movement[key] = false;
    fireHeld = false;
  });

  document.addEventListener('pointerlockchange', () => {
    locked = document.pointerLockElement === canvas;
    if (!locked) {
      fireHeld = false;
      movement.adsActive = false;
      if (fireUpHandler) fireUpHandler();
      if (adsHandler) adsHandler(false);
    }
  });

  document.addEventListener('mousemove', (event) => {
    if (!locked || !lookHandler) return;
    lookHandler(event.movementX || 0, event.movementY || 0);
  });

  canvas.addEventListener('mousedown', (event) => {
    if (!locked) {
      canvas.requestPointerLock();
      return;
    }
    if (event.button === 0) {
      fireHeld = true;
      if (fireDownHandler) fireDownHandler();
    } else if (event.button === 2) {
      movement.adsActive = true;
      if (adsHandler) adsHandler(true);
    }
  });

  document.addEventListener('mouseup', (event) => {
    if (event.button === 0) {
      fireHeld = false;
      if (fireUpHandler) fireUpHandler();
    } else if (event.button === 2) {
      movement.adsActive = false;
      if (adsHandler) adsHandler(false);
    }
  });

  document.addEventListener('contextmenu', (event) => event.preventDefault());

  document.addEventListener('wheel', (event) => {
    if (!locked || !weaponHandler) return;
    weaponHandler(event.deltaY > 0 ? 'next' : 'prev');
  }, { passive: true });

  return {
    movementState: () => movement,
    isLocked: () => locked,
    isFireHeld: () => fireHeld,
    requestPointerLock: () => {
      try { canvas.requestPointerLock(); } catch (err) { /* needs user gesture */ }
    },
    releasePointerLock: () => {
      if (document.pointerLockElement) document.exitPointerLock();
    },
    onLook: (fn) => { lookHandler = fn; },
    onFireDown: (fn) => { fireDownHandler = fn; },
    onFireUp: (fn) => { fireUpHandler = fn; },
    onPlaceBlock: (fn) => { placeHandler = fn; },
    onWeaponSelect: (fn) => { weaponHandler = fn; },
    onReload: (fn) => { reloadHandler = fn; },
    onScoreboard: (fn) => { scoreboardHandler = fn; },
    onAds: (fn) => { adsHandler = fn; }
  };
}
