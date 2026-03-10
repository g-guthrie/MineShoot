/**
 * actor-visual-factory.js - Shared avatar + hitbox creation for player/enemy/remote actors.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameActorVisualFactory
 */
(function () {
    'use strict';

    var GameActorVisualFactory = {};
    var entityPoints = (globalThis.__MAYHEM_RUNTIME.GameShared && globalThis.__MAYHEM_RUNTIME.GameShared.entityPoints) || {};
    var entityConstants = (globalThis.__MAYHEM_RUNTIME.GameShared && globalThis.__MAYHEM_RUNTIME.GameShared.entityConstants) || {};

    function readVec3(value, fallback) {
        return {
            x: (value && typeof value.x === 'number') ? value.x : fallback.x,
            y: (value && typeof value.y === 'number') ? value.y : fallback.y,
            z: (value && typeof value.z === 'number') ? value.z : fallback.z
        };
    }

    function createFallbackVisual(bodyColor, skinColor, legColor) {
        var group = new THREE.Group();
        var bodyMat = new THREE.MeshLambertMaterial({ color: bodyColor });
        var limbMat = new THREE.MeshLambertMaterial({ color: legColor });
        var skinMat = new THREE.MeshLambertMaterial({ color: skinColor });
        var torsoSize = readVec3(entityConstants.AVATAR_TORSO_SIZE, { x: 0.8, y: 1.0, z: 0.5 });
        var torsoCenter = readVec3(entityConstants.AVATAR_TORSO_CENTER_OFFSET, { x: 0, y: 1.3, z: 0 });
        var headSize = readVec3(entityConstants.AVATAR_HEAD_SIZE, { x: 0.55, y: 0.55, z: 0.55 });
        var headCenter = readVec3(entityConstants.AVATAR_HEAD_CENTER_OFFSET, { x: 0, y: 2.1, z: 0 });
        var armSize = readVec3(entityConstants.AVATAR_ARM_SIZE, { x: 0.22, y: 0.85, z: 0.22 });
        var armLeftCenter = readVec3(entityConstants.AVATAR_ARM_LEFT_CENTER_OFFSET, { x: -0.52, y: 1.25, z: 0 });
        var armRightCenter = readVec3(entityConstants.AVATAR_ARM_RIGHT_CENTER_OFFSET, { x: 0.52, y: 1.25, z: 0 });
        var legSize = readVec3(entityConstants.AVATAR_LEG_SIZE, { x: 0.28, y: 0.9, z: 0.28 });
        var legLeftCenter = readVec3(entityConstants.AVATAR_LEG_LEFT_CENTER_OFFSET, { x: -0.18, y: 0.45, z: 0 });
        var legRightCenter = readVec3(entityConstants.AVATAR_LEG_RIGHT_CENTER_OFFSET, { x: 0.18, y: 0.45, z: 0 });

        var body = new THREE.Mesh(new THREE.BoxGeometry(torsoSize.x, torsoSize.y, torsoSize.z), bodyMat);
        body.position.set(torsoCenter.x, torsoCenter.y, torsoCenter.z);
        group.add(body);

        var head = new THREE.Mesh(new THREE.BoxGeometry(headSize.x, headSize.y, headSize.z), skinMat);
        head.position.set(headCenter.x, headCenter.y, headCenter.z);
        group.add(head);

        var armL = new THREE.Mesh(new THREE.BoxGeometry(armSize.x, armSize.y, armSize.z), skinMat);
        armL.position.set(armLeftCenter.x, armLeftCenter.y, armLeftCenter.z);
        group.add(armL);

        var armR = new THREE.Mesh(new THREE.BoxGeometry(armSize.x, armSize.y, armSize.z), skinMat);
        armR.position.set(armRightCenter.x, armRightCenter.y, armRightCenter.z);
        group.add(armR);

        var legL = new THREE.Mesh(new THREE.BoxGeometry(legSize.x, legSize.y, legSize.z), limbMat);
        legL.position.set(legLeftCenter.x, legLeftCenter.y, legLeftCenter.z);
        group.add(legL);

        var legR = new THREE.Mesh(new THREE.BoxGeometry(legSize.x, legSize.y, legSize.z), limbMat);
        legR.position.set(legRightCenter.x, legRightCenter.y, legRightCenter.z);
        group.add(legR);

        return group;
    }

    function cloneVisualForRevealGhost(visual) {
        if (!visual || !visual.clone) return null;
        var originalUserData = visual.userData;
        visual.userData = {};
        try {
            return visual.clone(true);
        } finally {
            visual.userData = originalUserData;
        }
    }

    function createRevealGhost(visual) {
        var ghost = cloneVisualForRevealGhost(visual);
        if (!ghost) return null;
        var mats = [];

        ghost.traverse(function (node) {
            if (!node.isMesh) return;
            var mat = new THREE.MeshBasicMaterial({
                color: 0x65d8ff,
                transparent: true,
                opacity: 0.26,
                depthTest: false,
                depthWrite: false
            });
            node.material = mat;
            node.renderOrder = 90;
            mats.push(mat);
        });

        ghost.visible = false;
        ghost.scale.set(1.05, 1.05, 1.05);
        ghost.userData.revealMaterials = mats;
        ghost.userData.baseOpacity = 0.26;
        return ghost;
    }

    GameActorVisualFactory.create = function (opts) {
        opts = opts || {};
        var ownerType = String(opts.ownerType || 'net');
        var targetId = String(opts.targetId || '');
        var netEntityId = String(opts.netEntityId || '');
        var bodyColor = (typeof opts.bodyColor === 'number') ? opts.bodyColor : 0x4a7fc1;
        var skinColor = (typeof opts.skinColor === 'number') ? opts.skinColor : 0xd2a77d;
        var legColor = (typeof opts.legColor === 'number') ? opts.legColor : 0x2f2f2f;
        var weaponId = String(opts.weaponId || 'rifle');
        var hitboxOpacity = (typeof opts.hitboxOpacity === 'number') ? opts.hitboxOpacity : 0;
        var includeRevealGhost = !!opts.includeRevealGhost;

        var visual = null;
        var rigApi = null;
        if (globalThis.__MAYHEM_RUNTIME.GameAvatarRig && globalThis.__MAYHEM_RUNTIME.GameAvatarRig.create) {
            rigApi = globalThis.__MAYHEM_RUNTIME.GameAvatarRig.create(String(opts.kind || ownerType), {
                bodyColor: bodyColor,
                skinColor: skinColor,
                legColor: legColor,
                weaponId: weaponId
            });
            visual = rigApi && rigApi.root ? rigApi.root : null;
        }
        if (!visual) {
            visual = createFallbackVisual(bodyColor, skinColor, legColor);
        }

        var bodyHitbox = null;
        var headHitbox = null;
        var hitboxFactory = globalThis.__MAYHEM_RUNTIME.GameHitboxFactory || null;
        if (hitboxFactory && hitboxFactory.createCombatHitbox) {
            bodyHitbox = hitboxFactory.createCombatHitbox('body', ownerType, {
                opacity: hitboxOpacity,
                targetId: targetId,
                netEntityId: netEntityId
            });
            headHitbox = hitboxFactory.createCombatHitbox('head', ownerType, {
                opacity: hitboxOpacity,
                targetId: targetId,
                netEntityId: netEntityId
            });
        }

        var revealGhost = includeRevealGhost ? createRevealGhost(visual) : null;

        function syncHitboxes(rootPosition) {
            if (!rootPosition) return;
            if (bodyHitbox) bodyHitbox.position.set(rootPosition.x, entityPoints.entityBodyHitboxYFromFeet ? entityPoints.entityBodyHitboxYFromFeet(rootPosition.y) : (rootPosition.y + 0.7625), rootPosition.z);
            if (headHitbox) headHitbox.position.set(rootPosition.x, entityPoints.entityHeadHitboxYFromFeet ? entityPoints.entityHeadHitboxYFromFeet(rootPosition.y) : (rootPosition.y + 2.0), rootPosition.z);
        }

        function setHitboxVisibility(visible) {
            var opacity = visible ? 0.3 : 0;
            if (bodyHitbox) {
                bodyHitbox.visible = true;
                if (bodyHitbox.material) bodyHitbox.material.opacity = opacity;
            }
            if (headHitbox) {
                headHitbox.visible = true;
                if (headHitbox.material) headHitbox.material.opacity = opacity;
            }
        }

        return {
            visual: visual,
            rigApi: rigApi,
            bodyHitbox: bodyHitbox,
            headHitbox: headHitbox,
            revealGhost: revealGhost,
            syncHitboxes: syncHitboxes,
            setHitboxVisibility: setHitboxVisibility
        };
    };

    globalThis.__MAYHEM_RUNTIME.GameActorVisualFactory = GameActorVisualFactory;
})();
