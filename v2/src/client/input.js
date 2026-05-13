import { makeEquipMessage, makeFireMessage, makeInputMessage } from '../shared/protocol.js';

export class InputController {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.yaw = 0;
    this.pitch = -0.18;
    this.seq = 1;
    this.mouseDown = false;
    this.fireQueued = false;
    this.shotSeq = 1;
    this.weaponId = 'rifle';
    this.pointerLocked = false;
    this.bind();
  }

  bind() {
    window.addEventListener('keydown', (event) => {
      this.keys.add(event.code);
      if (event.code === 'Digit1') this.weaponId = 'rifle';
      if (event.code === 'Digit2') this.weaponId = 'pistol';
      if (event.code === 'Digit3') this.weaponId = 'shotgun';
    });
    window.addEventListener('keyup', (event) => {
      this.keys.delete(event.code);
    });
    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === this.canvas;
    });
    window.addEventListener('mousemove', (event) => {
      if (!this.pointerLocked) return;
      this.yaw -= event.movementX * 0.0021;
      this.pitch -= event.movementY * 0.0018;
      this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch));
    });
    window.addEventListener('mousedown', (event) => {
      if (event.button !== 0) return;
      if (!this.pointerLocked) {
        this.requestPointerLock();
        return;
      }
      this.mouseDown = true;
      this.fireQueued = true;
    });
    window.addEventListener('mouseup', (event) => {
      if (event.button === 0) this.mouseDown = false;
    });
  }

  requestPointerLock() {
    if (!this.canvas || typeof this.canvas.requestPointerLock !== 'function') return;
    try {
      const result = this.canvas.requestPointerLock();
      if (result && typeof result.catch === 'function') result.catch(() => {});
    } catch (_err) {
      // Unsupported contexts can still run the local V2 session without mouse capture.
    }
  }

  snapshot() {
    return {
      seq: this.seq++,
      forward: this.keys.has('KeyW'),
      backward: this.keys.has('KeyS'),
      left: this.keys.has('KeyA'),
      right: this.keys.has('KeyD'),
      jump: this.keys.has('Space'),
      sprint: this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'),
      yaw: this.yaw,
      pitch: this.pitch
    };
  }

  drainMessages() {
    const input = this.snapshot();
    const out = [makeInputMessage(input), makeEquipMessage(this.weaponId)];
    if (this.fireQueued || this.mouseDown) {
      this.fireQueued = false;
      out.push(makeFireMessage(this.weaponId, this.shotSeq++, this.yaw, this.pitch));
    }
    return { input, messages: out };
  }
}
