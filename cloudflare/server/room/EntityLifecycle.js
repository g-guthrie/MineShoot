import { getClassPreset, getDefaultAbilityLoadout, getDefaultWeaponLoadout } from '../../../shared/gameplay-tuning.js';
import { DEFAULT_HP_MAX } from '../../../shared/entity-constants.js';

const DEFAULT_CLASS_ID = 'abilities';
const DEFAULT_ABILITY_LOADOUT = getDefaultAbilityLoadout();
const DEFAULT_WEAPON_LOADOUT = getDefaultWeaponLoadout();

function cloneAbilityLoadout() {
  return {
    slot1: DEFAULT_ABILITY_LOADOUT.slot1,
    slot2: DEFAULT_ABILITY_LOADOUT.slot2
  };
}

function cloneWeaponLoadout() {
  return DEFAULT_WEAPON_LOADOUT.slice();
}

function applyActionRuntimeDefaults(entity) {
  entity.slot1CooldownUntil = 0;
  entity.slot2CooldownUntil = 0;
  entity.abilityCooldownUntil = 0;
  entity.ultimateCooldownUntil = 0;
  entity.weaponLockUntil = 0;
  entity.throwableLockUntil = 0;
  entity.abilityLockUntil = 0;
  entity.stunUntil = 0;
  entity.slowUntil = 0;
  entity.slowMultiplier = 1;
  entity.burnUntil = 0;
  entity.burnTickAt = 0;
  entity.burnSourceId = '';
  entity.deadeye = null;
  entity.chokeState = null;
  entity.chokeVictimState = null;
  entity.justBeenHookedState = null;
  entity.hookState = null;
  entity.hookPullState = null;
  entity.healState = null;
  return entity;
}

export function createPlayerEntity(options = {}) {
  const id = String(options.id || '');
  const username = String(options.username || id || 'player');
  const classId = DEFAULT_CLASS_ID;
  const preset = getClassPreset(classId);
  const weaponLoadout = cloneWeaponLoadout();

  const entity = {
    id,
    actorId: String(options.actorId || id || ''),
    actorName: String(options.actorName || username || id || 'player'),
    kind: 'player',
    username,
    classId,
    fixtureType: String(options.fixtureType || ''),
    abilityLoadout: cloneAbilityLoadout(),
    weaponLoadout,
    x: 0,
    y: Number(options.eyeHeight || 0),
    z: 0,
    yaw: Number(options.yaw || 0),
    pitch: Number(options.pitch || 0),
    hp: DEFAULT_HP_MAX,
    hpMax: DEFAULT_HP_MAX,
    armor: preset.armorMax,
    armorMax: preset.armorMax,
    wallhackRadius: preset.wallhackRadius,
    alive: true,
    respawnAt: 0,
    plannedSpawnPoint: null,
    spawnShieldUntil: 0,
    lastDamageAt: 0,
    seq: 0,
    pendingInputSeq: 0,
    inputMode: 'intent',
    inputState: typeof options.createMovementInputState === 'function'
      ? options.createMovementInputState()
      : null,
    inputQueue: [],
    lastShotAt: {},
    lastShotTokenByWeapon: {},
    weaponId: weaponLoadout[0],
    weaponAmmo: typeof options.createWeaponAmmoRuntime === 'function'
      ? options.createWeaponAmmoRuntime(weaponLoadout)
      : null,
    moveSpeedNorm: 0,
    sprinting: false,
    velocityY: 0,
    isGrounded: true,
    jumpHoldTimer: 0,
    jumpHeldLast: false,
    streamHeat: 0,
    streamOverheatedUntil: 0,
    muzzleFlashUntil: 0,
    throwables: typeof options.createThrowableRuntime === 'function'
      ? options.createThrowableRuntime()
      : {},
    lastThrowAt: 0,
    poseHistory: [],
    kills: 0,
    deaths: 0,
    progressScore: 0,
    lmsLives: 0,
    lmsCharge: 0,
    lmsBankState: null,
    outOfRound: false,
    teamId: '',
    disconnectedAt: 0
  };

  applyActionRuntimeDefaults(entity);
  return entity;
}

export function createBotEntity(index, options = {}) {
  const botIndex = Math.max(0, Number(index || 0));
  const classId = DEFAULT_CLASS_ID;
  const preset = getClassPreset(classId);
  const weaponLoadout = cloneWeaponLoadout();

  const entity = {
    id: `bot-${botIndex + 1}`,
    kind: 'bot',
    username: `BOT_${botIndex + 1}`,
    classId,
    abilityLoadout: cloneAbilityLoadout(),
    weaponLoadout,
    x: 10 + (Math.random() * 90),
    y: Number(options.eyeHeight || 0),
    z: 10 + (Math.random() * 90),
    yaw: Math.random() * Math.PI * 2,
    pitch: 0,
    hp: DEFAULT_HP_MAX,
    hpMax: DEFAULT_HP_MAX,
    armor: preset.armorMax,
    armorMax: preset.armorMax,
    wallhackRadius: preset.wallhackRadius,
    alive: true,
    respawnAt: 0,
    lastDamageAt: 0,
    weaponId: weaponLoadout[0],
    lastShotAt: {},
    lastShotTokenByWeapon: {},
    moveSpeedNorm: 0,
    sprinting: false,
    streamHeat: 0,
    streamOverheatedUntil: 0,
    muzzleFlashUntil: 0,
    throwables: typeof options.createThrowableRuntime === 'function'
      ? options.createThrowableRuntime()
      : {},
    lastThrowAt: 0,
    poseHistory: [],
    lmsLives: 0,
    lmsCharge: 0,
    lmsBankState: null,
    outOfRound: false,
    aiDirX: Math.cos(Math.random() * Math.PI * 2),
    aiDirZ: Math.sin(Math.random() * Math.PI * 2),
    aiSpeed: 2.2,
    aiTurnTimer: 1 + (Math.random() * 3)
  };

  applyActionRuntimeDefaults(entity);
  return entity;
}

export function resetEntityForRespawn(entity, options = {}) {
  if (!entity) return entity;

  entity.hp = entity.hpMax;
  entity.armor = entity.armorMax;
  entity.alive = true;
  entity.respawnAt = 0;
  entity.lastDamageAt = 0;
  entity.streamHeat = 0;
  entity.streamOverheatedUntil = 0;
  entity.lastShotAt = {};
  entity.lastShotTokenByWeapon = {};
  entity.muzzleFlashUntil = 0;
  entity.lmsBankState = null;
  entity.throwables = typeof options.createThrowableRuntime === 'function'
    ? options.createThrowableRuntime()
    : {};
  entity.lastThrowAt = 0;
  entity.poseHistory = [];
  entity.outOfRound = false;

  if (typeof options.createWeaponAmmoRuntime === 'function') {
    entity.weaponAmmo = options.createWeaponAmmoRuntime(entity.weaponLoadout || cloneWeaponLoadout());
  }

  if (typeof options.createMovementInputState === 'function') {
    entity.inputState = options.createMovementInputState();
  }

  entity.velocityY = 0;
  entity.isGrounded = true;
  entity.jumpHoldTimer = 0;
  entity.jumpHeldLast = false;

  applyActionRuntimeDefaults(entity);

  if (options.zeroAim) {
    entity.moveSpeedNorm = 0;
    entity.sprinting = false;
    entity.yaw = 0;
    entity.pitch = 0;
  }

  return entity;
}

export function resetEntityForLmsRound(entity, options = {}) {
  if (!entity) return entity;

  resetEntityForRespawn(entity, options);
  entity.teamId = '';
  entity.progressScore = Math.max(0, Number(options.startingLives || 0));
  entity.lmsLives = Math.max(0, Number(options.startingLives || 0));
  entity.lmsCharge = 0;
  entity.lmsBankState = null;
  entity.outOfRound = false;
  return entity;
}
