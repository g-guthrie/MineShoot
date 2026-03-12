import { GameCombatTuning } from '../combat-tuning.js';
import { GameActorVisualFactory } from '../actor-visual-factory.js';

const THREE = globalThis.THREE;

/**
 * remote-entities.js - Remote player/bot visual & hitbox management
 */

export const GameNetEntities = {};

let sceneRef = null;
let renderMap = new Map();
let hitboxArray = [];
let hitboxVisible = true;
const REMOTE_EYE_HEIGHT = 1.6;

function classWallhackRadiusFor(classId) {
  if (GameCombatTuning && GameCombatTuning.getClassWallhackRadius) {
    return GameCombatTuning.getClassWallhackRadius(classId);
  }
  return 90;
}

function classStats(classId) {
  const defs = {
    ffa: { armorMax: 90, wallhackRadius: classWallhackRadiusFor('ffa') }
  };
  return defs[classId] || defs.ffa;
}

function createRemoteVisual(entity) {
  const group = new THREE.Group();
  const color = entity.kind === 'bot' ? 0x8f5a2d : 0x3772c4;
  const actorFactory = GameActorVisualFactory || null;
  const actorVisual = actorFactory && actorFactory.create ? actorFactory.create({
    kind: entity.kind === 'bot' ? 'bot' : 'remote',
    ownerType: 'net',
    bodyColor: color,
    skinColor: 0xd2a77d,
    legColor: entity.kind === 'bot' ? 0x4a3420 : 0x2d2d2d,
    weaponId: entity.weaponId || 'rifle',
    targetId: 'net:' + entity.id,
    netEntityId: entity.id,
    hitboxOpacity: hitboxVisible ? 0.3 : 0
  }) : null;
  const rigApi = actorVisual ? actorVisual.rigApi : null;
  const bodyHitbox = actorVisual ? actorVisual.bodyHitbox : null;
  const headHitbox = actorVisual ? actorVisual.headHitbox : null;
  if (bodyHitbox && bodyHitbox.userData) bodyHitbox.userData.netEntityId = entity.id;
  if (headHitbox && headHitbox.userData) headHitbox.userData.netEntityId = entity.id;
  if (actorVisual && actorVisual.visual) {
    group.add(actorVisual.visual);
  }
  if (bodyHitbox) sceneRef.add(bodyHitbox);
  if (headHitbox) sceneRef.add(headHitbox);

  group.position.set(
    entity.x,
    ((typeof entity.y === 'number' ? entity.y : REMOTE_EYE_HEIGHT) - REMOTE_EYE_HEIGHT),
    entity.z
  );
  group.rotation.y = (entity.yaw || 0);

  sceneRef.add(group);
  hitboxArray.push(bodyHitbox);
  hitboxArray.push(headHitbox);

  return {
    id: entity.id,
    kind: entity.kind,
    group,
    bodyHitbox,
    headHitbox,
    actorVisual,
    rigApi,
    targetX: entity.x,
    targetY: entity.y || 1.6,
    targetFootY: ((typeof entity.y === 'number' ? entity.y : REMOTE_EYE_HEIGHT) - REMOTE_EYE_HEIGHT),
    targetZ: entity.z,
    targetYaw: (entity.yaw || 0),
    targetPitch: entity.pitch || 0,
    hp: entity.hp,
    hpMax: entity.hpMax,
    armor: entity.armor,
    armorMax: entity.armorMax,
    classId: entity.classId,
    username: entity.username,
    alive: entity.alive,
    spawnShieldUntil: entity.spawnShieldUntil || 0,
    wallhackRadius: entity.wallhackRadius || classStats(entity.classId).wallhackRadius,
    moveSpeedNorm: entity.moveSpeedNorm || 0,
    sprinting: !!entity.sprinting,
    weaponId: entity.weaponId || 'rifle',
    muzzleFlashUntil: entity.muzzleFlashUntil || 0,
    streamHeat: entity.streamHeat || 0,
    streamOverheatedUntil: entity.streamOverheatedUntil || 0
  };
}

GameNetEntities.init = function init(scene) {
  sceneRef = scene;
};

GameNetEntities.ensureRemote = function ensureRemote(entity) {
  if (!renderMap.has(entity.id)) {
    renderMap.set(entity.id, createRemoteVisual(entity));
  }
  return renderMap.get(entity.id);
};

GameNetEntities.removeRemoteVisual = function removeRemoteVisual(id) {
  const render = renderMap.get(id);
  if (!render) return;

  if (render.group && render.group.parent) render.group.parent.remove(render.group);
  if (render.bodyHitbox && render.bodyHitbox.parent) render.bodyHitbox.parent.remove(render.bodyHitbox);
  if (render.headHitbox && render.headHitbox.parent) render.headHitbox.parent.remove(render.headHitbox);

  const next = [];
  for (let i = 0; i < hitboxArray.length; i++) {
    const hitbox = hitboxArray[i];
    if (hitbox !== render.bodyHitbox && hitbox !== render.headHitbox) next.push(hitbox);
  }
  hitboxArray = next;

  renderMap.delete(id);
};

GameNetEntities.updateFromSnapshot = function updateFromSnapshot(entity) {
  if (!sceneRef) return;
  const render = GameNetEntities.ensureRemote(entity);
  render.targetX = entity.x;
  render.targetY = entity.y || 1.6;
  render.targetFootY = ((typeof entity.y === 'number' ? entity.y : REMOTE_EYE_HEIGHT) - REMOTE_EYE_HEIGHT);
  render.targetZ = entity.z;
  render.targetYaw = (entity.yaw || 0);
  render.targetPitch = entity.pitch || 0;
  render.hp = entity.hp;
  render.hpMax = entity.hpMax;
  render.armor = entity.armor;
  render.armorMax = entity.armorMax;
  render.classId = entity.classId;
  render.username = entity.username;
  render.alive = entity.alive;
  render.spawnShieldUntil = entity.spawnShieldUntil || 0;
  render.wallhackRadius = entity.wallhackRadius || classStats(entity.classId).wallhackRadius;
  render.moveSpeedNorm = entity.moveSpeedNorm || 0;
  render.sprinting = !!entity.sprinting;
  render.weaponId = entity.weaponId || 'rifle';
  render.streamHeat = entity.streamHeat || 0;
  render.streamOverheatedUntil = entity.streamOverheatedUntil || 0;
  render.muzzleFlashUntil = entity.muzzleFlashUntil || 0;

  render.group.visible = !!entity.alive;
  render.bodyHitbox.visible = !!entity.alive;
  render.headHitbox.visible = !!entity.alive;
};

GameNetEntities.getHitboxArray = function getHitboxArray() {
  return hitboxArray;
};

GameNetEntities.toggleHitboxVisibility = function toggleHitboxVisibility() {
  hitboxVisible = !hitboxVisible;
  renderMap.forEach(function eachRender(render) {
    if (!render.bodyHitbox || !render.headHitbox) return;
    render.bodyHitbox.material.opacity = hitboxVisible ? 0.3 : 0;
    render.headHitbox.material.opacity = hitboxVisible ? 0.3 : 0;
    if (render.actorVisual && render.actorVisual.setHitboxVisibility) render.actorVisual.setHitboxVisibility(hitboxVisible);
  });
  return hitboxVisible;
};

GameNetEntities.setHitboxVisibility = function setHitboxVisibility(visible) {
  hitboxVisible = !!visible;
  renderMap.forEach(function eachRender(render) {
    if (!render.bodyHitbox || !render.headHitbox) return;
    render.bodyHitbox.material.opacity = hitboxVisible ? 0.3 : 0;
    render.headHitbox.material.opacity = hitboxVisible ? 0.3 : 0;
    if (render.actorVisual && render.actorVisual.setHitboxVisibility) render.actorVisual.setHitboxVisibility(hitboxVisible);
  });
};

GameNetEntities.getRenderMap = function getRenderMap() {
  return renderMap;
};

GameNetEntities.classStats = classStats;

GameNetEntities.cleanup = function cleanup() {
  const ids = [];
  renderMap.forEach(function eachRender(_value, id) { ids.push(id); });
  for (let i = 0; i < ids.length; i++) {
    GameNetEntities.removeRemoteVisual(ids[i]);
  }
  renderMap.clear();
  hitboxArray = [];
};
