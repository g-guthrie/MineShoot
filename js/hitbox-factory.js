import { HEAD_HITBOX_SIZE, BODY_HITBOX_SIZE } from '../shared/entity-constants.js';

/**
 * hitbox-factory.js - Shared hitbox creation for enemies and remote entities.
 */

var HEAD = HEAD_HITBOX_SIZE || { x: 1.375, y: 0.844, z: 1.375 };
var BODY = BODY_HITBOX_SIZE || { x: 2.7, y: 1.525, z: 2.7 };

var HEAD_COLOR_ENEMY = 0xff4444;
var HEAD_COLOR_NET = 0xff6666;
var BODY_COLOR_ENEMY = 0x00aaff;
var BODY_COLOR_NET = 0x22bbff;

export function createCombatHitbox(type, ownerType, opts) {
  opts = opts || {};
  var isHead = (type === 'head');
  var geo = isHead
    ? new THREE.BoxGeometry(HEAD.x, HEAD.y, HEAD.z)
    : new THREE.BoxGeometry(BODY.x, BODY.y, BODY.z);

  var isEnemy = (ownerType === 'enemy');
  var color = isHead
    ? (isEnemy ? HEAD_COLOR_ENEMY : HEAD_COLOR_NET)
    : (isEnemy ? BODY_COLOR_ENEMY : BODY_COLOR_NET);

  var mat = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: (typeof opts.opacity === 'number') ? opts.opacity : 0.3,
    wireframe: true,
    color: color,
    depthTest: isHead ? false : true
  });

  var mesh = new THREE.Mesh(geo, mat);
  mesh.visible = true;
  mesh.renderOrder = isHead ? 1 : 0;

  mesh.userData = {
    type: type,
    ownerType: ownerType
  };
  if (opts.entityIndex !== undefined) mesh.userData.enemyIndex = opts.entityIndex;
  if (opts.entityRef !== undefined) mesh.userData.enemyRef = opts.entityRef;
  if (opts.netEntityId !== undefined) mesh.userData.netEntityId = opts.netEntityId;
  if (opts.targetId !== undefined) mesh.userData.targetId = opts.targetId;

  return mesh;
}
