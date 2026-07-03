import { Audio, CollisionGroup, Entity, Quaternion, Vector3Like, QuaternionLike, RigidBodyType, EntityEvent, Vector3, Collider } from 'highchair';
import GunEntity from '../GunEntity';
import type { GunEntityOptions } from '../GunEntity';
import GamePlayerEntity from '../GamePlayerEntity';

const ROCKET_DESTRUCTION_RADIUS = 3;   // blast sphere, world units (old missile: 2)
const ROCKET_SPEED = 34;               // world units/sec (old missile tuning)
const ROCKET_LIFETIME_MS = 3000;       // despawn if nothing is hit

const DEFAULT_ROCKET_LAUNCHER_OPTIONS: GunEntityOptions = {
  ammo: 1,
  damage: 70,
  fireRate: 0.8,
  heldHand: 'right',
  iconImageUri: 'icons/rocket-launcher.png',
  idleAnimation: 'idle_gun_right',
  mlAnimation: 'shoot_gun_right',
  name: 'Rocket Launcher',
  maxAmmo: 1,
  totalAmmo: 5,
  modelUri: 'models/items/rocket-launcher.glb',
  modelScale: 1.3,
  range: 8,
  reloadAudioUri: 'audio/sfx/rocket-launcher-reload.mp3',
  reloadTimeMs: 2500,
  shootAudioUri: 'audio/sfx/rocket-launcher-shoot.mp3',
};

export default class RocketLauncherEntity extends GunEntity {
  public constructor(options: Partial<GunEntityOptions> = {}) {
    super({ ...DEFAULT_ROCKET_LAUNCHER_OPTIONS, ...options });
  }


  public override isHitscan(): boolean {
    return false; // projectile: the client never predicts rocket hits
  }

  public override getMuzzleFlashPositionRotation(): { position: Vector3Like, rotation: QuaternionLike } {
    return {
      position: { x: 0.03, y: 0.6, z: -1.5 },
      rotation: Quaternion.fromEuler(0, 90, 0),
    };
  }

  public override equip(): void {
    super.equip();

    this.setPosition({ x: 0, y: 0.3, z: 0.4 });
  }

  public override shootRaycast(origin: Vector3Like, direction: Vector3Like, length: number) {
    // Projectile instead of a raycast: the missile flies until it touches
    // the world mesh, a placed block, or a player, then explodes.
    if (!this.parent?.world) {
      return;
    }

    const shooter = this.parent as GamePlayerEntity;
    let exploded = false;

    const rocketMissileEntity = new Entity({
      modelUri: 'models/items/rocket-missile.glb',
      modelScale: 0.75,
      rigidBodyOptions: {
        type: RigidBodyType.KINEMATIC_VELOCITY,
        colliders: [
          {
            ...Collider.optionsFromModelUri('models/items/rocket-missile.glb', 0.75),
            collisionGroups: {
              belongsTo: [ CollisionGroup.ENTITY ],
              // The world mesh is an ENTITY/ENVIRONMENT_ENTITY; there are no
              // voxel blocks except player-built ones.
              collidesWith: [ CollisionGroup.BLOCK, CollisionGroup.ENTITY, CollisionGroup.ENVIRONMENT_ENTITY, CollisionGroup.PLAYER ],
            }
          },
        ],
        linearVelocity: {
          x: direction.x * ROCKET_SPEED,
          y: direction.y * ROCKET_SPEED,
          z: direction.z * ROCKET_SPEED,
        },
      }
    });

    // Despawn if it never hits anything.
    setTimeout(() => {
      if (rocketMissileEntity.isSpawned) {
        rocketMissileEntity.despawn();
      }
    }, ROCKET_LIFETIME_MS);

    const explode = (contactPoint: Vector3Like) => {
      if (exploded || !this.parent?.world || !rocketMissileEntity.isSpawned) return;
      exploded = true;

      const { world } = this.parent;

      // Damage nearby players (shooter included: rocket-jumping stays legal).
      world.entityManager.getAllPlayerEntities().forEach(playerEntity => {
        const distance = Vector3.fromVector3Like(playerEntity.position)
          .distance(Vector3.fromVector3Like(contactPoint));
        if (distance <= ROCKET_DESTRUCTION_RADIUS) {
          (playerEntity as GamePlayerEntity).takeDamage(this.damage, direction, shooter);
        }
      });

      // Crater any player-built blocks in the blast sphere.
      const contactCoordinate = {
        x: Math.floor(contactPoint.x),
        y: Math.floor(contactPoint.y),
        z: Math.floor(contactPoint.z),
      };
      for (let dx = -ROCKET_DESTRUCTION_RADIUS; dx <= ROCKET_DESTRUCTION_RADIUS; dx++) {
        for (let dy = -ROCKET_DESTRUCTION_RADIUS; dy <= ROCKET_DESTRUCTION_RADIUS; dy++) {
          for (let dz = -ROCKET_DESTRUCTION_RADIUS; dz <= ROCKET_DESTRUCTION_RADIUS; dz++) {
            if (Math.hypot(dx, dy, dz) > ROCKET_DESTRUCTION_RADIUS) continue;
            world.chunkLattice.setBlock({
              x: contactCoordinate.x + dx,
              y: contactCoordinate.y + dy,
              z: contactCoordinate.z + dz,
            }, 0);
          }
        }
      }

      // Explosion visual: expands facing back along the flight path.
      const explosionEntity = new Entity({
        modelUri: 'models/environment/explosion.glb',
        modelScale: 0.2,
        rigidBodyOptions: { type: RigidBodyType.KINEMATIC_POSITION },
      });
      const explosionDirectionQuat = Quaternion.fromEuler(
        Math.atan2(-direction.y, Math.hypot(direction.x, direction.z)) * 180 / Math.PI + 90,
        Math.atan2(direction.x, direction.z) * 180 / Math.PI + 180,
        0
      );
      explosionEntity.spawn(world, contactPoint, explosionDirectionQuat);
      explosionEntity.setCollisionGroupsForSolidColliders({ belongsTo: [], collidesWith: [] });
      const explosionEffectInterval = setInterval(() => {
        if (explosionEntity.opacity <= 0 || !explosionEntity.isSpawned) {
          if (explosionEntity.isSpawned) explosionEntity.despawn();
          clearInterval(explosionEffectInterval);
          return;
        }
        explosionEntity.setOpacity(explosionEntity.opacity - 0.1);
      }, 100);

      (new Audio({
        uri: 'audio/sfx/rocket-launcher-explosion.mp3',
        referenceDistance: 15,
        cutoffDistance: 100,
        volume: 0.4,
      })).play(world);

      rocketMissileEntity.despawn();
    };

    const contactPointFor = (colliderHandleA: number, colliderHandleB: number): Vector3Like | undefined => {
      const manifold = this.parent?.world?.simulation.getContactManifolds(colliderHandleA, colliderHandleB)[0];
      return manifold?.contactPoints[0] ?? undefined;
    };

    rocketMissileEntity.on(EntityEvent.BLOCK_COLLISION, ({ blockType, colliderHandleA, colliderHandleB }) => {
      if (blockType.isLiquid) return;
      const contact = contactPointFor(colliderHandleA, colliderHandleB);
      if (contact) explode(contact);
    });

    // The missile spawns inside the shooter's capsule and passes their own
    // held gun + muzzle flash on the way out; never explode on any of them.
    const isShooterGear = (entity: Entity | undefined): boolean => {
      for (let current = entity; current; current = current.parent) {
        if (current === shooter) return true;
      }
      return false;
    };

    rocketMissileEntity.on(EntityEvent.ENTITY_COLLISION, ({ otherEntity, colliderHandleA, colliderHandleB }) => {
      if (isShooterGear(otherEntity) || otherEntity === rocketMissileEntity) return;
      const contact = contactPointFor(colliderHandleA, colliderHandleB) ?? rocketMissileEntity.position;
      explode(contact);
    });

    // Face the missile along its flight path.
    const directionQuat = Quaternion.fromEuler(
      Math.atan2(-direction.y, Math.hypot(direction.x, direction.z)) * 180 / Math.PI,
      Math.atan2(direction.x, direction.z) * 180 / Math.PI,
      0
    );
    rocketMissileEntity.spawn(this.parent.world, origin, directionQuat);
  }
}
