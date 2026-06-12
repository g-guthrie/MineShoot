/**
 * Dynamic world objects rendered from snapshots: remote players, enemies,
 * purchase barriers, weapon crates, shot tracers. Uses the reference
 * build's GLTF models with their embedded animation clips; clip choice is
 * derived from snapshot state (speed, downed, weapon).
 */
import * as THREE from 'three';
import type { Snapshot, WirePlayer } from '../../../protocol/index';
import type { SimEvent } from '../../../sim/types';
import { PURCHASE_BARRIERS, WEAPON_CRATES } from '../../../sim/mapConfig';
import { WEAPONS, PLAYER_EYE_HEIGHT } from '../../../sim/constants';
import type { WeaponId } from '../../../sim/constants';
import { AnimSlot, ModelLibrary, WEAPON_MODEL_SCALE } from './models';
import type { ModelInstance } from './models';

/** Labels only readable up close, like the reference build's SceneUI viewDistance. */
const LABEL_VIEW_DISTANCE = 12;

/** Reference modelScale values. */
const SOLDIER_SCALE = 0.5;
const ZOMBIE_SCALE = 0.55;
const RIPPER_SCALE = 0.5;

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

/** Upper-body pose per weapon (reference GunEntity idle/shoot animations). */
function gunPose(weapon: WeaponId): { idle: string; shoot: string } {
  const oneHanded = weapon === 'pistol' || weapon === 'auto-pistol';
  return oneHanded
    ? { idle: 'idle_gun_right', shoot: 'shoot_gun_right' }
    : { idle: 'idle_gun_both', shoot: 'shoot_gun_both' };
}

interface PlayerVisual {
  group: THREE.Group;
  model: ModelInstance;
  lower: AnimSlot;
  upper: AnimSlot;
  label: THREE.Sprite;
  handAnchor: THREE.Object3D | null;
  weaponId: WeaponId | null;
  weaponMesh: THREE.Object3D | null;
}

interface EnemyVisual {
  kind: 'zombie' | 'ripper';
  model: ModelInstance;
  anim: AnimSlot;
  flashUntil: number;
  tintables: THREE.MeshStandardMaterial[];
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

/** Collect materials for damage tinting (clone so instances tint independently). */
function collectTintables(root: THREE.Object3D): THREE.MeshStandardMaterial[] {
  const result: THREE.MeshStandardMaterial[] = [];
  root.traverse(obj => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh && mesh.material instanceof THREE.MeshStandardMaterial) {
      mesh.material = mesh.material.clone();
      result.push(mesh.material as THREE.MeshStandardMaterial);
    }
  });
  return result;
}

export class EntityRenderer {
  private players = new Map<string, PlayerVisual>();
  private enemies = new Map<number, EnemyVisual>();
  private barrierGroups: THREE.Group[] = [];
  private barrierLabels: THREE.Sprite[] = [];
  private crateLabels: THREE.Sprite[] = [];
  private crateLabelKeys: string[] = [];
  private tracers: Tracer[] = [];

  constructor(
    private readonly scene: THREE.Scene,
    private readonly models: ModelLibrary,
  ) {
    this.buildBarriers();
    this.buildCrates();
  }

  private buildBarriers(): void {
    for (const config of PURCHASE_BARRIERS) {
      const group = new THREE.Group();
      const floorY = config.position.y - 0.5; // barrier centers sit 0.5 above the floor

      // One fence segment per block of width, matching the reference's
      // child-entity row.
      const count = Math.max(1, Math.round(config.width));
      const offset = (count - 1) / 2;
      for (let i = 0; i < count; i++) {
        const fence = this.models.instance('fence', 1).root;
        const along = i - offset;
        fence.position.x = config.position.x + (config.axis === 'x' ? along : 0);
        fence.position.z = config.position.z + (config.axis === 'z' ? along : 0);
        fence.position.y += floorY;
        if (config.axis === 'z') fence.rotation.y = Math.PI / 2;
        group.add(fence);
      }

      const label = makeTextSprite([config.name, `$${config.removalPrice} — [E] unlock`], '#ffd27d');
      label.position.set(config.position.x, floorY + 2.6, config.position.z);
      group.add(label);
      this.barrierLabels.push(label);

      this.scene.add(group);
      this.barrierGroups.push(group);
    }
  }

  private buildCrates(): void {
    for (const config of WEAPON_CRATES) {
      const floorY = config.position.y - 0.5; // crate centers sit 0.5 above the floor
      const crate = this.models.instance('weaponbox', 0.5).root;
      crate.position.set(config.position.x, crate.position.y + floorY, config.position.z);
      crate.rotation.y = (config.yawDeg * Math.PI) / 180;
      this.scene.add(crate);

      const label = makeTextSprite([config.name, `$${config.price} — [E] roll`], '#9ad1ff');
      label.position.set(config.position.x, floorY + 2.2, config.position.z);
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
    dt: number,
  ): void {
    const snapDtMs = Math.max(1, b.timeMs - a.timeMs);
    this.updatePlayers(a, b, t, myPlayerId, dt);
    this.updateEnemies(a, b, t, now, dt, snapDtMs);
    this.updateBarriers(b);
    this.updateCrates(b, myPlayerId);
    this.updateLabelVisibility(cameraPos);
    this.updateTracers(now);
  }

  private updatePlayers(
    a: Snapshot,
    b: Snapshot,
    t: number,
    myPlayerId: string | null,
    dt: number,
  ): void {
    const prev = new Map(a.players.map(p => [p.id, p]));
    const seen = new Set<string>();

    for (const player of b.players) {
      if (player.id === myPlayerId || player.spectator) continue;
      seen.add(player.id);

      let visual = this.players.get(player.id);
      if (!visual) {
        const model = this.models.instance('soldier', SOLDIER_SCALE);
        const group = new THREE.Group();
        group.add(model.root);

        const label = makeTextSprite([player.name], '#e8e0d0', true); // names show through walls
        label.position.y = 2.0;
        group.add(label);

        const handAnchor =
          model.root.getObjectByName('hand_right_anchor') ??
          model.root.getObjectByName('hand_right') ??
          null;

        this.scene.add(group);
        visual = {
          group,
          model,
          lower: new AnimSlot(model.mixer!, model.clips),
          upper: new AnimSlot(model.mixer!, model.clips),
          label,
          handAnchor,
          weaponId: null,
          weaponMesh: null,
        };
        this.players.set(player.id, visual);
      }

      const from = prev.get(player.id) ?? player;
      visual.group.position.set(
        lerp(from.x, player.x, t),
        lerp(from.y, player.y, t),
        lerp(from.z, player.z, t),
      );
      visual.group.rotation.y = lerpAngle(from.yaw, player.yaw, t);

      // Animation choice mirrors the reference controller settings.
      const speed = Math.hypot(player.vx, player.vz);
      if (player.downed) {
        visual.lower.play(speed > 0.2 ? 'crawling' : 'sleep');
        visual.upper.play(speed > 0.2 ? 'crawling' : 'sleep');
      } else {
        visual.lower.play(speed > 5.5 ? 'run_lower' : speed > 0.3 ? 'walk_lower' : 'idle_lower');
        visual.upper.play(gunPose(player.weapon).idle);
      }

      this.syncHeldWeapon(visual, player.downed ? null : player.weapon);
      visual.model.mixer?.update(dt);
    }

    for (const [id, visual] of this.players) {
      if (!seen.has(id)) {
        this.scene.remove(visual.group);
        this.players.delete(id);
      }
    }
  }

  /** Attach/swap the gun model in the soldier's hand. */
  private syncHeldWeapon(visual: PlayerVisual, weapon: WeaponId | null): void {
    if (visual.weaponId === weapon || !visual.handAnchor) return;
    if (visual.weaponMesh) {
      visual.weaponMesh.removeFromParent();
      visual.weaponMesh = null;
    }
    visual.weaponId = weapon;
    if (weapon) {
      const gun = this.models.instance(weapon, WEAPON_MODEL_SCALE[weapon], false).root;
      // Reference: gun spawns at {0,0,-0.2} rotated Euler(-90,0,0) in the hand.
      gun.position.set(0, 0, -0.2);
      gun.rotation.set(-Math.PI / 2, 0, 0);
      visual.handAnchor.add(gun);
      visual.weaponMesh = gun;
    }
  }

  /** Play the shoot pose on a remote player when their shot event arrives. */
  playerShot(playerId: string, weapon: WeaponId): void {
    const visual = this.players.get(playerId);
    if (visual) visual.upper.oneShot(gunPose(weapon).shoot);
  }

  private updateEnemies(
    a: Snapshot,
    b: Snapshot,
    t: number,
    now: number,
    dt: number,
    snapDtMs: number,
  ): void {
    const prev = new Map(a.enemies.map(e => [e.id, e]));
    const seen = new Set<number>();

    for (const enemy of b.enemies) {
      seen.add(enemy.id);
      let visual = this.enemies.get(enemy.id);
      if (!visual) {
        const model =
          enemy.kind === 'ripper'
            ? this.models.instance('ripper', RIPPER_SCALE)
            : this.models.instance('zombie', ZOMBIE_SCALE);
        this.scene.add(model.root);
        visual = {
          kind: enemy.kind,
          model,
          anim: new AnimSlot(model.mixer!, model.clips),
          flashUntil: 0,
          tintables: collectTintables(model.root),
        };
        this.enemies.set(enemy.id, visual);
      }

      const from = prev.get(enemy.id) ?? enemy;
      const groundOffset = visual.model.root.userData.groundOffset ?? visual.model.root.position.y;
      visual.model.root.userData.groundOffset = groundOffset;
      visual.model.root.position.set(
        lerp(from.x, enemy.x, t),
        lerp(from.y, enemy.y, t) + groundOffset,
        lerp(from.z, enemy.z, t),
      );
      visual.model.root.rotation.y = lerpAngle(from.yaw, enemy.yaw, t);

      // Clip thresholds from the reference enemy constructors.
      const speed = (Math.hypot(enemy.x - from.x, enemy.z - from.z) / snapDtMs) * 1000;
      if (visual.kind === 'ripper') {
        visual.anim.play(
          speed > 6
            ? 'animation.ripper_zombie.sprint'
            : speed > 0.3
              ? 'animation.ripper_zombie.walk'
              : 'animation.ripper_zombie.idle',
        );
      } else {
        visual.anim.play(speed > 5 ? 'run' : speed > 3 ? 'walk' : 'crawling');
      }

      const flashing = now < visual.flashUntil;
      for (const material of visual.tintables) {
        material.emissive.setHex(flashing ? 0x991111 : 0x000000);
      }
      visual.model.mixer?.update(dt);
    }

    for (const [id, visual] of this.enemies) {
      if (!seen.has(id)) {
        this.scene.remove(visual.model.root);
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

  /** Price labels are readable only up close, and never through walls. */
  private updateLabelVisibility(cameraPos: THREE.Vector3): void {
    const within = (sprite: THREE.Sprite) => {
      const world = sprite.getWorldPosition(tmpVec);
      return world.distanceTo(cameraPos) <= LABEL_VIEW_DISTANCE;
    };
    for (const label of this.barrierLabels) label.visible = within(label);
    for (const label of this.crateLabels) label.visible = within(label);
  }

  /** Spawn a tracer line for a shot event. */
  addShotTracer(
    event: Extract<SimEvent, { type: 'shot' }>,
    shooter: WirePlayer | undefined,
    now: number,
  ): void {
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
