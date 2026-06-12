import {
  Audio,
  Entity,
  EntityEvent,
  PathfindingEntityController,
} from 'highchair';

import type { EventPayloads, ModelEntityOptions, QuaternionLike, Vector3Like, World } from 'highchair';

import GamePlayerEntity from './GamePlayerEntity';

const RETARGET_ACCUMULATOR_THRESHOLD_MS = 5000;
const PATHFIND_ACCUMULATOR_THRESHOLD_MS = 3000;
const CONTACT_DAMAGE_INTERVAL_MS = 1000;
const KILL_REWARD_MULTIPLIER = 0.5;

export interface EnemyEntityOptions extends ModelEntityOptions {
  damage: number;
  damageAudioUri?: string;
  health: number;
  idleAudioUri?: string;
  idleAudioReferenceDistance?: number;
  idleAudioVolume?: number;
  jumpHeight?: number
  preferJumping?: boolean;
  reward: number;
  speed: number;
}

export default class EnemyEntity extends Entity {
  public damage: number;
  public health: number;
  public jumpHeight: number;
  public maxHealth: number;
  public preferJumping: boolean;
  public reward: number;
  public speed: number;

  private _damageAudio: Audio | undefined;
  private _idleAudio: Audio | undefined;
  private _isPathfinding = false;
  // Jittered so enemies spawned in the same burst don't all run A* on the same tick.
  private _pathfindAccumulatorMs = Math.random() * PATHFIND_ACCUMULATOR_THRESHOLD_MS;
  private _retargetAccumulatorMs = 0;
  private _targetEntity: Entity | undefined;
  private _contactDamageAccumulatorMs = 0;
  private _contactingPlayers: Set<GamePlayerEntity> = new Set();

  public constructor(options: EnemyEntityOptions) {
    super({ ...options, tag: 'enemy' });
    this.damage = options.damage;
    this.health = options.health;
    this.jumpHeight = options.jumpHeight ?? 1;
    this.maxHealth = options.health;
    this.preferJumping = options.preferJumping ?? false;
    this.reward = options.reward;
    this.speed = options.speed;

    if (options.damageAudioUri) {
      this._damageAudio = new Audio({
        attachedToEntity: this,
        uri: options.damageAudioUri,
        volume: 1,
        loop: false,
      });
    }

    if (options.idleAudioUri) {
      this._idleAudio = new Audio({
        attachedToEntity: this,
        uri: options.idleAudioUri,
        volume: options.idleAudioVolume ?? 0.5,
        loop: true,
        referenceDistance: options.idleAudioReferenceDistance ?? 1, // low reference distance so its only heard when the enemy is very near
      });
    }

    this.on(EntityEvent.ENTITY_COLLISION, this._onEntityCollision);
    this.on(EntityEvent.TICK, this._onTick);

    this.setCcdEnabled(true);
  }

  public override spawn(world: World, position: Vector3Like, rotation?: QuaternionLike) {
    super.spawn(world, position, rotation);

    if (this._idleAudio) {
      this._idleAudio.play(world, true);
    }
  }

  public takeDamage(damage: number, fromPlayer?: GamePlayerEntity) {
    if (!this.world) {
      return;
    }

    const effectiveDamage = Math.min(damage, Math.max(this.health, 0));
    this.health -= damage;

    if (this._damageAudio) {
      this._damageAudio.play(this.world, true);
    }

    // Reward damage dealt as a % of max health, plus a kill bonus,
    // so total payout per enemy tracks its configured reward.
    if (fromPlayer) {
      let reward = (effectiveDamage / this.maxHealth) * this.reward;
      if (this.health <= 0) {
        reward += this.reward * KILL_REWARD_MULTIPLIER;
      }
      fromPlayer.addMoney(reward);
    }

    if (this.health <= 0 && this.isSpawned) {
      this.despawn();
    } else {
      // Apply red tint for 75ms to indicate damage
      this.setTintColor({ r: 255, g: 0, b: 0 });
      // Reset tint after 75ms, make sure to check if the entity is still
      // spawned to prevent setting tint on a despawned entity
      setTimeout(() => this.isSpawned ? this.setTintColor({ r: 255, g: 255, b: 255 }) : undefined, 75);
    }
  }

  private _onEntityCollision = (payload: EventPayloads[EntityEvent.ENTITY_COLLISION]) => {
    const { otherEntity, started } = payload;

    if (!(otherEntity instanceof GamePlayerEntity)) {
      return;
    }

    if (started) {
      this._contactingPlayers.add(otherEntity);
      otherEntity.takeDamage(this.damage);
      this._contactDamageAccumulatorMs = 0;
    } else {
      this._contactingPlayers.delete(otherEntity);
    }
  }

  /*
   * Pathfinding is handled on an accumulator basis to prevent excessive pathfinding
   * or movement calculations. It defers to dumb movements 
   */
  private _onTick = (payload: EventPayloads[EntityEvent.TICK]) => {
    const { tickDeltaMs } = payload;

    if (!this.isSpawned) {
      return;
    }

    this._pathfindAccumulatorMs += tickDeltaMs;
    this._retargetAccumulatorMs += tickDeltaMs;

    // Sustained-contact damage: re-damage players still touching this enemy
    // on an interval, instead of only on the collision-start edge.
    if (this._contactingPlayers.size) {
      this._contactDamageAccumulatorMs += tickDeltaMs;
      if (this._contactDamageAccumulatorMs >= CONTACT_DAMAGE_INTERVAL_MS) {
        this._contactDamageAccumulatorMs = 0;
        this._contactingPlayers.forEach(player => {
          if (player.isSpawned) {
            player.takeDamage(this.damage);
          } else {
            this._contactingPlayers.delete(player);
          }
        });
      }
    }

    // Acquire a target to hunt; downed players are untargetable, so retarget
    // immediately when the current target goes down.
    const targetDowned = this._targetEntity instanceof GamePlayerEntity && this._targetEntity.downed;
    if (!this._targetEntity || !this._targetEntity.isSpawned || targetDowned || this._retargetAccumulatorMs > RETARGET_ACCUMULATOR_THRESHOLD_MS) {
      this._targetEntity = this._getNearestTarget();
      this._retargetAccumulatorMs = 0;
    }

    // No target, do nothing
    if (!this._targetEntity) {
      return;
    }

    const targetDistanceSquared = this._getTargetDistanceSquared(this._targetEntity);
    const pathfindingController = this.controller as PathfindingEntityController;

    if (targetDistanceSquared < 8 * 8 || (!this._isPathfinding && this._pathfindAccumulatorMs < PATHFIND_ACCUMULATOR_THRESHOLD_MS)) {
      pathfindingController.move(this._targetEntity.position, this.speed);
      pathfindingController.face(this._targetEntity.position, this.speed * 2);
    } else if (this._pathfindAccumulatorMs > PATHFIND_ACCUMULATOR_THRESHOLD_MS) {
      this._isPathfinding = pathfindingController.pathfind(this._targetEntity.position, this.speed, {
        maxFall: this.jumpHeight,
        maxJump: this.jumpHeight,
        maxOpenSetIterations: 200,
        verticalPenalty: this.preferJumping ? -1 : 1,
        pathfindAbortCallback: () => this._isPathfinding = false,
        pathfindCompleteCallback: () => this._isPathfinding = false,
        waypointMoveSkippedCallback: () => this._isPathfinding = false,
      });

      this._pathfindAccumulatorMs = 0;
    }
  }

  private _getNearestTarget(): Entity | undefined {
    if (!this.world) {
      return undefined;
    }

    let nearestTarget: Entity | undefined;
    let nearestDistance = Infinity;

    const targetableEntities = this.world.entityManager.getAllPlayerEntities();

    targetableEntities.forEach(target => {
      if (target instanceof GamePlayerEntity && target.downed) { // skip downed players
        return;
      }
      
      const distanceSquared = this._getTargetDistanceSquared(target);
      if (distanceSquared < nearestDistance) {
        nearestTarget = target;
        nearestDistance = distanceSquared;
      }
    });

    return nearestTarget;
  }

  private _getTargetDistanceSquared(target: Entity) {
    const dx = target.position.x - this.position.x;
    const dy = target.position.y - this.position.y;
    const dz = target.position.z - this.position.z;

    return dx * dx + dy * dy + dz * dz;
  }
}
