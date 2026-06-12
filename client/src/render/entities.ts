/**
 * Dynamic world objects: remote players, enemies, purchase barriers, weapon
 * crates, shot tracers. Positions come interpolated from snapshot pairs.
 */
import * as THREE from 'three';
import type { Snapshot, WireEnemy, WirePlayer } from '../../../protocol/index';
import type { SimEvent } from '../../../sim/types';
import { PURCHASE_BARRIERS, WEAPON_CRATES, barrierHalfExtents } from '../../../sim/mapConfig';
import { WEAPONS, PLAYER_EYE_HEIGHT } from '../../../sim/constants';

/** Labels only readable up close, like the reference build's SceneUI viewDistance. */
const LABEL_VIEW_DISTANCE = 12;

function makeTextSprite(lines: string[], color = '#e8e0d0', throughWalls = false): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 64 + lines.length * 56;
  const ctx = canvas.getContext('2d')!;
  ctx.font = 'bold 44px Trebuchet MS, sans-serif';
  ctx.textAlign = 'center';
  ctx.lineWidth = 8;
  lines.forEach((line, i) => {
    const y = 64 + i * 56;
    ctx.strokeStyle = 'rgba(0,0,0,0.9)';
    ctx.strokeText(line, 256, y);
    ctx.fillStyle = color;
    ctx.fillText(line, 256, y);
  });
  const texture = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, depthTest: !throughWalls }),
  );
  const aspect = canvas.height / canvas.width;
  sprite.scale.set(3.4, 3.4 * aspect, 1);
  return sprite;
}

interface PlayerVisual {
  group: THREE.Group;
  body: THREE.Mesh;
  label: THREE.Sprite;
  downed: boolean;
}

interface EnemyVisual {
  mesh: THREE.Mesh;
  material: THREE.MeshLambertMaterial;
  flashUntil: number;
}

interface Tracer {
  line: THREE.Line;
  material: THREE.LineBasicMaterial;
  dieAt: number;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const tmpVec = new THREE.Vector3();

function lerpAngle(a: number, b: number, t: number): number {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export class EntityRenderer {
  private players = new Map<string, PlayerVisual>();
  private enemies = new Map<number, EnemyVisual>();
  private barrierGroups: THREE.Group[] = [];
  private barrierLabels: THREE.Sprite[] = [];
  private crateLabels: THREE.Sprite[] = [];
  private crateLabelKeys: string[] = [];
  private tracers: Tracer[] = [];

  private playerGeo = new THREE.CapsuleGeometry(0.4, 1.0, 4, 12);
  private zombieGeo = new THREE.CapsuleGeometry(0.35, 1.0, 4, 10);
  private ripperGeo = new THREE.CapsuleGeometry(0.55, 1.4, 4, 12);

  constructor(private readonly scene: THREE.Scene) {
    this.buildBarriers();
    this.buildCrates();
  }

  private buildBarriers(): void {
    for (const config of PURCHASE_BARRIERS) {
      const half = barrierHalfExtents(config);
      const group = new THREE.Group();

      const fence = new THREE.Mesh(
        new THREE.BoxGeometry(half.x * 2, 2.4, half.z * 2),
        new THREE.MeshLambertMaterial({ color: 0x7a5a30, transparent: true, opacity: 0.55 }),
      );
      fence.position.set(config.position.x, 1.2, config.position.z);
      group.add(fence);

      const label = makeTextSprite([config.name, `$${config.removalPrice} — [E] unlock`], '#ffd27d');
      label.position.set(config.position.x, 3.1, config.position.z);
      group.add(label);
      this.barrierLabels.push(label);

      this.scene.add(group);
      this.barrierGroups.push(group);
    }
  }

  private buildCrates(): void {
    for (const config of WEAPON_CRATES) {
      const crate = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 0.9, 1.2),
        new THREE.MeshLambertMaterial({ color: 0x6b4226 }),
      );
      crate.position.set(config.position.x, config.position.y - 0.5, config.position.z);
      crate.rotation.y = (config.yawDeg * Math.PI) / 180;
      this.scene.add(crate);

      const label = makeTextSprite([config.name, `$${config.price} — [E] roll`], '#9ad1ff');
      label.position.set(config.position.x, config.position.y + 1.2, config.position.z);
      this.scene.add(label);
      this.crateLabels.push(label);
      this.crateLabelKeys.push('');
    }
  }

  /** Update all visuals from an interpolated snapshot pair. */
  update(
    a: Snapshot,
    b: Snapshot,
    t: number,
    myPlayerId: string | null,
    now: number,
    cameraPos: THREE.Vector3,
  ): void {
    this.updatePlayers(a, b, t, myPlayerId);
    this.updateEnemies(a, b, t, now);
    this.updateBarriers(b);
    this.updateCrates(b, myPlayerId);
    this.updateLabelVisibility(cameraPos);
    this.updateTracers(now);
  }

  /** Price labels are readable only up close, and never through walls. */
  private updateLabelVisibility(cameraPos: THREE.Vector3): void {
    const within = (sprite: THREE.Sprite) => {
      const world = sprite.getWorldPosition(tmpVec);
      return world.distanceTo(cameraPos) <= LABEL_VIEW_DISTANCE;
    };
    for (const label of this.barrierLabels) label.visible = within(label);
    for (const label of this.crateLabels) label.visible = within(label);
  }

  private updatePlayers(a: Snapshot, b: Snapshot, t: number, myPlayerId: string | null): void {
    const prev = new Map(a.players.map(p => [p.id, p]));
    const seen = new Set<string>();

    for (const player of b.players) {
      if (player.id === myPlayerId || player.spectator) continue;
      seen.add(player.id);

      let visual = this.players.get(player.id);
      if (!visual) {
        const body = new THREE.Mesh(
          this.playerGeo,
          new THREE.MeshLambertMaterial({ color: 0x4a6fa5 }),
        );
        const label = makeTextSprite([player.name], '#e8e0d0', true); // names show through walls
        const group = new THREE.Group();
        group.add(body);
        label.position.y = 1.6;
        group.add(label);
        this.scene.add(group);
        visual = { group, body, label, downed: false };
        this.players.set(player.id, visual);
      }

      const from = prev.get(player.id) ?? player;
      visual.group.position.set(
        lerp(from.x, player.x, t),
        lerp(from.y, player.y, t),
        lerp(from.z, player.z, t),
      );
      visual.body.rotation.y = lerpAngle(from.yaw, player.yaw, t);

      if (player.downed !== visual.downed) {
        visual.downed = player.downed;
        visual.body.rotation.x = player.downed ? Math.PI / 2 : 0;
        (visual.body.material as THREE.MeshLambertMaterial).color.set(
          player.downed ? 0x666666 : 0x4a6fa5,
        );
      }
      // Capsule origin is its center; feet sit at group position.
      visual.body.position.y = player.downed ? 0.45 : 0.9;
    }

    for (const [id, visual] of this.players) {
      if (!seen.has(id)) {
        this.scene.remove(visual.group);
        this.players.delete(id);
      }
    }
  }

  private updateEnemies(a: Snapshot, b: Snapshot, t: number, now: number): void {
    const prev = new Map(a.enemies.map(e => [e.id, e]));
    const seen = new Set<number>();

    for (const enemy of b.enemies) {
      seen.add(enemy.id);
      let visual = this.enemies.get(enemy.id);
      if (!visual) {
        const material = new THREE.MeshLambertMaterial({
          color: enemy.kind === 'ripper' ? 0x8a1d1d : 0x4d7a3a,
        });
        const mesh = new THREE.Mesh(
          enemy.kind === 'ripper' ? this.ripperGeo : this.zombieGeo,
          material,
        );
        this.scene.add(mesh);
        visual = { mesh, material, flashUntil: 0 };
        this.enemies.set(enemy.id, visual);
      }

      const from = prev.get(enemy.id) ?? enemy;
      const centerY = enemy.kind === 'ripper' ? 1.2 : 0.85;
      visual.mesh.position.set(
        lerp(from.x, enemy.x, t),
        lerp(from.y, enemy.y, t) + centerY,
        lerp(from.z, enemy.z, t),
      );
      visual.mesh.rotation.y = lerpAngle(from.yaw, enemy.yaw, t);

      visual.material.emissive.setHex(now < visual.flashUntil ? 0x991111 : 0x000000);
    }

    for (const [id, visual] of this.enemies) {
      if (!seen.has(id)) {
        this.scene.remove(visual.mesh);
        this.enemies.delete(id);
      }
    }
  }

  private updateBarriers(snapshot: Snapshot): void {
    snapshot.barriers.forEach((alive, i) => {
      const group = this.barrierGroups[i];
      if (group) group.visible = alive;
    });
  }

  private updateCrates(snapshot: Snapshot, myPlayerId: string | null): void {
    snapshot.crates.forEach((crate, i) => {
      const label = this.crateLabels[i];
      const config = WEAPON_CRATES[i];
      if (!label || !config) return;

      const key = crate.rolledWeaponId ? `${crate.rolledWeaponId}:${crate.rolledForPlayerId}` : '';
      if (key === this.crateLabelKeys[i]) return;
      this.crateLabelKeys[i] = key;

      const old = label.material.map;
      let next: THREE.Sprite;
      if (crate.rolledWeaponId) {
        const weapon = WEAPONS[crate.rolledWeaponId];
        next =
          crate.rolledForPlayerId === myPlayerId
            ? makeTextSprite([weapon.name, '[E] claim your weapon!'], '#7dff8a')
            : makeTextSprite([weapon.name, 'reserved by another player'], '#ff9d9d');
      } else {
        next = makeTextSprite([config.name, `$${config.price} — [E] roll`], '#9ad1ff');
      }
      label.material.map = next.material.map;
      label.scale.copy(next.scale);
      label.material.needsUpdate = true;
      old?.dispose();
    });
  }

  /** Spawn a tracer line for a shot event. */
  addShotTracer(event: Extract<SimEvent, { type: 'shot' }>, shooter: WirePlayer | undefined, now: number): void {
    if (!shooter) return;
    const origin = new THREE.Vector3(shooter.x, shooter.y + PLAYER_EYE_HEIGHT - 0.15, shooter.z);

    for (const hit of event.hits) {
      const geometry = new THREE.BufferGeometry().setFromPoints([
        origin,
        new THREE.Vector3(hit.x, hit.y, hit.z),
      ]);
      const material = new THREE.LineBasicMaterial({
        color: 0xffe9a0,
        transparent: true,
        opacity: 0.85,
      });
      const line = new THREE.Line(geometry, material);
      this.scene.add(line);
      this.tracers.push({ line, material, dieAt: now + 80 });
    }
  }

  /** Red damage blink on an enemy. */
  flashEnemy(enemyId: number, now: number): void {
    const visual = this.enemies.get(enemyId);
    if (visual) visual.flashUntil = now + 90;
  }

  private updateTracers(now: number): void {
    this.tracers = this.tracers.filter(tracer => {
      if (now >= tracer.dieAt) {
        this.scene.remove(tracer.line);
        tracer.line.geometry.dispose();
        tracer.material.dispose();
        return false;
      }
      tracer.material.opacity = (0.85 * (tracer.dieAt - now)) / 80;
      return true;
    });
  }
}
