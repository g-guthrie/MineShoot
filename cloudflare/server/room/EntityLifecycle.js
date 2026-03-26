import { getClassPreset, getDefaultAbilityId, getDefaultWeaponLoadout } from '../../../shared/gameplay-tuning.js';
import { DEFAULT_HP_MAX } from '../../../shared/entity-constants.js';

const DEFAULT_CLASS_ID = 'abilities';
const DEFAULT_ABILITY_ID = getDefaultAbilityId();
const DEFAULT_WEAPON_LOADOUT = getDefaultWeaponLoadout();

function defaultAbilityId() {
  return DEFAULT_ABILITY_ID;
}

function cloneWeaponLoadout() {
  return DEFAULT_WEAPON_LOADOUT.slice();
}

function applyActionRuntimeDefaults(entity) {
  entity.abilityCooldownUntil = 0;
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
  entity.rollStartedAt = 0;
  entity.rollUntil = 0;
  entity.rollInputState = null;
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
    abilityId: defaultAbilityId(),
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
    lastProcessedInputSeq: 0,
    lastReceivedInputSeq: 0,
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
    stocksRemaining: 3,
    maxStocks: 5,
    bonusLivesEarned: 0,
    extraLifeProgressPct: 0,
    eliminated: false,
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
    abilityId: defaultAbilityId(),
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
    aiDirX: Math.cos(Math.random() * Math.PI * 2),
    aiDirZ: Math.sin(Math.random() * Math.PI * 2),
    aiSpeed: 2.2,
    aiTurnTimer: 1 + (Math.random() * 3)
  };

  entity.stocksRemaining = 3;
  entity.maxStocks = 5;
  entity.bonusLivesEarned = 0;
  entity.extraLifeProgressPct = 0;
  entity.eliminated = false;

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
  entity.stocksRemaining = Math.max(1, Number(entity.stocksRemaining || 3));
  entity.maxStocks = Math.max(entity.stocksRemaining, Number(entity.maxStocks || 5));
  entity.bonusLivesEarned = Math.max(0, Number(entity.bonusLivesEarned || 0));
  entity.extraLifeProgressPct = Math.max(0, Math.min(100, Number(entity.extraLifeProgressPct || 0)));
  entity.eliminated = false;
  entity.streamHeat = 0;
  entity.streamOverheatedUntil = 0;
  entity.lastShotAt = {};
  entity.lastShotTokenByWeapon = {};
  entity.muzzleFlashUntil = 0;
  entity.throwables = typeof options.createThrowableRuntime === 'function'
    ? options.createThrowableRuntime()
    : {};
  entity.lastThrowAt = 0;
  entity.poseHistory = [];

  if (typeof options.createWeaponAmmoRuntime === 'function') {
    entity.weaponAmmo = options.createWeaponAmmoRuntime(entity.weaponLoadout || cloneWeaponLoadout());
  }
  if (Array.isArray(entity.weaponLoadout) && entity.weaponLoadout.length) {
    entity.weaponId = String(entity.weaponLoadout[0] || entity.weaponId || '');
  }

  if (typeof options.createMovementInputState === 'function') {
    entity.inputState = options.createMovementInputState();
  }
  entity.inputQueue = [];
  entity.lastProcessedInputSeq = Math.max(0, Number(entity.lastProcessedInputSeq || entity.seq || 0));
  entity.lastReceivedInputSeq = entity.lastProcessedInputSeq;
  entity.pendingInputSeq = entity.lastProcessedInputSeq;
  entity.seq = entity.lastProcessedInputSeq;

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
