import {
  CylinderGeometry,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  Quaternion,
  Scene,
  Vector3,
} from 'three';

export type TracerSpawn = {
  /** World-space muzzle position [x, y, z]. */
  o: [number, number, number];
  /** World-space impact / max-range end point [x, y, z]. */
  e: [number, number, number];
  /** Travel speed in world units per second (default 280). */
  speed?: number;
  /** Visible segment length in world units (default 2.1). */
  seg?: number;
  /** Lifetime in seconds (default 0.11). */
  life?: number;
};

type Tracer = {
  origin: Vector3;
  dir: Vector3;
  head: Vector3;
  tail: Vector3;
  speed: number;
  segmentLength: number;
  traveled: number;
  maxDistance: number;
  life: number;
  framesAlive: number;
};

const MAX_TRACERS = 96;

/**
 * Bullet tracers, ported from the original MineShoot
 * hitscan-tracer-runtime.js: a pooled InstancedMesh of thin cylinders that
 * fly from the muzzle to the impact point at the gun's tracer speed, fading
 * out after a short life. The server broadcasts one spawn per ray (pellets
 * included) over the UI data channel; the game UI forwards them here via
 * globalThis.__tracers.
 */
export default class TracerManager {
  private _pool: Tracer[] = [];
  private _cursor = 0;
  private _mesh: InstancedMesh;
  private _zeroMatrix = new Matrix4().makeScale(0, 0, 0);
  private _tmpMatrix = new Matrix4();
  private _tmpQuat = new Quaternion();
  private _tmpScale = new Vector3();
  private _tmpMid = new Vector3();
  private _up = new Vector3(0, 1, 0);

  public constructor(scene: Scene) {
    const geo = new CylinderGeometry(0.03, 0.03, 1, 8);
    const mat = new MeshBasicMaterial({
      color: 0xfff2c9,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      depthTest: true,
    });
    this._mesh = new InstancedMesh(geo, mat, MAX_TRACERS);
    this._mesh.frustumCulled = false;
    this._mesh.renderOrder = 40;
    for (let i = 0; i < MAX_TRACERS; i++) {
      this._mesh.setMatrixAt(i, this._zeroMatrix);
      this._pool.push({
        origin: new Vector3(),
        dir: new Vector3(),
        head: new Vector3(),
        tail: new Vector3(),
        speed: 0,
        segmentLength: 0,
        traveled: 0,
        maxDistance: 0,
        life: 0,
        framesAlive: 0,
      });
    }
    this._mesh.instanceMatrix.needsUpdate = true;
    scene.add(this._mesh);
  }

  public spawn(data: TracerSpawn): void {
    if (!data?.o || !data?.e) return;
    this._cursor = (this._cursor + 1) % MAX_TRACERS;
    const t = this._pool[this._cursor];

    t.origin.set(data.o[0], data.o[1], data.o[2]);
    t.dir.set(data.e[0], data.e[1], data.e[2]).sub(t.origin);
    const len = t.dir.length();
    if (len <= 0.001) return;
    t.dir.divideScalar(len);
    t.head.copy(t.origin);
    t.tail.copy(t.origin);
    t.traveled = 0;
    t.maxDistance = len;
    t.segmentLength = Math.max(0.05, Number(data.seg ?? 2.1));
    t.speed = Math.max(1, Number(data.speed ?? 280));
    t.framesAlive = 0;
    t.life = Math.max(0.01, Number(data.life ?? 0.11));
  }

  public update(dt: number): void {
    if (!dt) return;
    const simDt = Math.min(dt, 1 / 15);
    let dirty = false;
    for (let i = 0; i < this._pool.length; i++) {
      const t = this._pool[i];
      if (t.life <= 0) continue;
      t.life -= simDt;
      t.framesAlive += 1;

      t.traveled = Math.min(t.maxDistance, t.traveled + t.speed * simDt);
      t.head.copy(t.origin).addScaledVector(t.dir, t.traveled);
      t.tail.copy(t.origin).addScaledVector(t.dir, Math.max(0, t.traveled - t.segmentLength));

      const done = t.life <= 0 || (t.traveled >= t.maxDistance && t.framesAlive > 1);
      if (done) {
        t.life = 0;
        this._mesh.setMatrixAt(i, this._zeroMatrix);
        dirty = true;
        continue;
      }

      this._tmpMid.copy(t.tail).add(t.head).multiplyScalar(0.5);
      this._tmpQuat.setFromUnitVectors(this._up, t.dir);
      this._tmpScale.set(1, Math.max(0.05, t.head.distanceTo(t.tail) * 0.82), 1);
      this._tmpMatrix.compose(this._tmpMid, this._tmpQuat, this._tmpScale);
      this._mesh.setMatrixAt(i, this._tmpMatrix);
      dirty = true;
    }
    if (dirty) this._mesh.instanceMatrix.needsUpdate = true;
  }
}
