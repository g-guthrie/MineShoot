/**
 * hitbox-factory.js - Shared hitbox creation for enemies and remote entities.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameHitboxFactory
 */
(function () {
    'use strict';

    var ec = (globalThis.__MAYHEM_RUNTIME.GameShared && globalThis.__MAYHEM_RUNTIME.GameShared.entityConstants) || {};
    // Fallbacks mirror shared/entity-constants.js HEAD_HITBOX_SIZE and
    // BODY_HITBOX_SIZE; keep them in sync or fallback hitboxes will not match
    // the server's hit volumes.
    var HEAD = ec.HEAD_HITBOX_SIZE || { x: 1.092, y: 0.77, z: 1.092 };
    var BODY = ec.BODY_HITBOX_SIZE || { x: 2.485, y: 1.98, z: 1.74 };

    var HEAD_COLOR_ENEMY = 0xff4444;
    var HEAD_COLOR_NET = 0xff6666;
    var BODY_COLOR_ENEMY = 0x00aaff;
    var BODY_COLOR_NET = 0x22bbff;
    var HEAD_GEOMETRY = new THREE.BoxGeometry(HEAD.x, HEAD.y, HEAD.z);
    var BODY_GEOMETRY = new THREE.BoxGeometry(BODY.x, BODY.y, BODY.z);

    HEAD_GEOMETRY.userData = HEAD_GEOMETRY.userData || {};
    HEAD_GEOMETRY.userData.sharedHitboxGeometry = true;
    BODY_GEOMETRY.userData = BODY_GEOMETRY.userData || {};
    BODY_GEOMETRY.userData.sharedHitboxGeometry = true;

    function createCombatHitbox(type, ownerType, opts) {
        opts = opts || {};
        var isHead = (type === 'head');
        var geo = isHead ? HEAD_GEOMETRY : BODY_GEOMETRY;

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

    globalThis.__MAYHEM_RUNTIME.GameHitboxFactory = { createCombatHitbox: createCombatHitbox };
})();
