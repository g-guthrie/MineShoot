/**
 * Pointer-lock mouse look + WASD. Continuous state is read every send;
 * edge-triggered actions (reload/interact) accumulate between sends.
 */
const MOUSE_SENSITIVITY = 0.0023;
const MAX_PITCH = 1.55;

export class InputState {
  yaw = 0;
  pitch = 0;

  private keys = new Set<string>();
  private mouseDown = false;
  private reloadPressed = false;
  private interactPressed = false;

  constructor(private readonly canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', e => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (e.code === 'KeyR') this.reloadPressed = true;
      if (e.code === 'KeyE') this.interactPressed = true;
    });
    window.addEventListener('keyup', e => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    canvas.addEventListener('mousedown', e => {
      if (document.pointerLockElement !== canvas) {
        canvas.requestPointerLock();
        return;
      }
      if (e.button === 0) this.mouseDown = true;
    });
    window.addEventListener('mouseup', e => {
      if (e.button === 0) this.mouseDown = false;
    });

    window.addEventListener('mousemove', e => {
      if (document.pointerLockElement !== canvas) return;
      this.yaw -= e.movementX * MOUSE_SENSITIVITY;
      this.pitch -= e.movementY * MOUSE_SENSITIVITY;
      this.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, this.pitch));
    });
  }

  get pointerLocked(): boolean {
    return document.pointerLockElement === this.canvas;
  }

  /** Continuous state only — safe to read every frame (no edge consumption). */
  continuous() {
    let moveX = 0;
    let moveZ = 0;
    if (this.keys.has('KeyW')) moveZ += 1;
    if (this.keys.has('KeyS')) moveZ -= 1;
    if (this.keys.has('KeyD')) moveX += 1;
    if (this.keys.has('KeyA')) moveX -= 1;

    return {
      moveX,
      moveZ,
      yaw: this.yaw,
      pitch: this.pitch,
      jump: this.keys.has('Space'),
      sprint: this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'),
      fire: this.mouseDown && this.pointerLocked,
    };
  }

  /** Continuous + accumulated edge state; edges reset on read. */
  sample() {
    const reload = this.reloadPressed;
    const interact = this.interactPressed;
    this.reloadPressed = false;
    this.interactPressed = false;
    return { ...this.continuous(), reload, interact };
  }
}
