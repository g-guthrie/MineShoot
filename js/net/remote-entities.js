/**
 * remote-entities.js - Remote player/bot visual & hitbox management
 * Extracted from network.js. Loaded as: globalThis.__MAYHEM_RUNTIME.GameNetEntities
 */
(function () {
    'use strict';

    var GameNetEntities = {};

    var sceneRef = null;
    var renderMap = new Map();
    var hitboxArray = [];
    var hitboxVisible = true;
    var REMOTE_EYE_HEIGHT = 1.6;
    var hitboxFactory = globalThis.__MAYHEM_RUNTIME.GameHitboxFactory || null;

    function classWallhackRadiusFor(classId) {
        if (globalThis.__MAYHEM_RUNTIME.GameCombatTuning && globalThis.__MAYHEM_RUNTIME.GameCombatTuning.getClassWallhackRadius) {
            return globalThis.__MAYHEM_RUNTIME.GameCombatTuning.getClassWallhackRadius(classId);
        }
        return 90;
    }

    function classStats(classId) {
        var defs = {
            abilities: { armorMax: 90, wallhackRadius: classWallhackRadiusFor('abilities') }
        };
        return defs[classId] || defs.abilities;
    }

    function createRemoteVisual(entity) {
        var group = new THREE.Group();
        var color = entity.kind === 'bot' ? 0x8f5a2d : 0x3772c4;
        var rigApi = null;
        if (globalThis.__MAYHEM_RUNTIME.GameAvatarRig && globalThis.__MAYHEM_RUNTIME.GameAvatarRig.create) {
            rigApi = globalThis.__MAYHEM_RUNTIME.GameAvatarRig.create(entity.kind === 'bot' ? 'bot' : 'remote', {
                bodyColor: color,
                skinColor: 0xd2a77d,
                legColor: entity.kind === 'bot' ? 0x4a3420 : 0x2d2d2d,
                weaponId: entity.weaponId || 'rifle'
            });
            group.add(rigApi.root);
        } else {
            var bodyMat = new THREE.MeshLambertMaterial({ color: color });
            var limbMat = new THREE.MeshLambertMaterial({ color: entity.kind === 'bot' ? 0x4a3420 : 0x2d2d2d });
            var skinMat = new THREE.MeshLambertMaterial({ color: 0xd2a77d });

            var body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.0, 0.5), bodyMat);
            body.position.y = 1.0;
            group.add(body);

            var head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.55), skinMat);
            head.position.y = 1.8;
            group.add(head);

            var armL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.85, 0.22), skinMat);
            armL.position.set(-0.45, 1.0, 0);
            group.add(armL);

            var armR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.85, 0.22), skinMat);
            armR.position.set(0.45, 1.0, 0);
            group.add(armR);

            var legL = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.9, 0.28), limbMat);
            legL.position.set(-0.18, 0.45, 0);
            group.add(legL);

            var legR = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.9, 0.28), limbMat);
            legR.position.set(0.18, 0.45, 0);
            group.add(legR);
        }

        var hitboxOpts = { netEntityId: entity.id, targetId: 'net:' + entity.id, opacity: hitboxVisible ? 0.3 : 0 };
        var bodyHitbox, headHitbox;
        if (hitboxFactory && hitboxFactory.createCombatHitbox) {
            bodyHitbox = hitboxFactory.createCombatHitbox('body', 'net', hitboxOpts);
            headHitbox = hitboxFactory.createCombatHitbox('head', 'net', hitboxOpts);
        } else {
            var ec = (globalThis.__MAYHEM_RUNTIME.GameShared && globalThis.__MAYHEM_RUNTIME.GameShared.entityConstants) || {};
            var HEAD = ec.HEAD_HITBOX_SIZE || { x: 1.375, y: 0.844, z: 1.375 };
            bodyHitbox = new THREE.Mesh(
                new THREE.BoxGeometry(2.7, 1.525, 2.7),
                new THREE.MeshBasicMaterial({ transparent: true, opacity: hitboxVisible ? 0.3 : 0, wireframe: true, color: 0x22bbff, depthTest: true })
            );
            bodyHitbox.userData = { type: 'body', ownerType: 'net', netEntityId: entity.id, targetId: 'net:' + entity.id };
            headHitbox = new THREE.Mesh(
                new THREE.BoxGeometry(HEAD.x, HEAD.y, HEAD.z),
                new THREE.MeshBasicMaterial({ transparent: true, opacity: hitboxVisible ? 0.3 : 0, wireframe: true, color: 0xff6666, depthTest: false })
            );
            headHitbox.userData = { type: 'head', ownerType: 'net', netEntityId: entity.id, targetId: 'net:' + entity.id };
        }
        sceneRef.add(bodyHitbox);
        sceneRef.add(headHitbox);

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
            group: group,
            bodyHitbox: bodyHitbox,
            headHitbox: headHitbox,
            rigApi: rigApi,
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
            wallhackRadius: entity.wallhackRadius || classStats(entity.classId).wallhackRadius,
            moveSpeedNorm: entity.moveSpeedNorm || 0,
            sprinting: !!entity.sprinting,
            weaponId: entity.weaponId || 'rifle',
            muzzleFlashUntil: entity.muzzleFlashUntil || 0,
            streamHeat: entity.streamHeat || 0,
            streamOverheatedUntil: entity.streamOverheatedUntil || 0
        };
    }

    GameNetEntities.init = function (scene) {
        sceneRef = scene;
        hitboxFactory = globalThis.__MAYHEM_RUNTIME.GameHitboxFactory || null;
    };

    GameNetEntities.ensureRemote = function (entity) {
        if (!renderMap.has(entity.id)) {
            renderMap.set(entity.id, createRemoteVisual(entity));
        }
        return renderMap.get(entity.id);
    };

    GameNetEntities.removeRemoteVisual = function (id) {
        var r = renderMap.get(id);
        if (!r) return;

        if (r.group && r.group.parent) r.group.parent.remove(r.group);
        if (r.bodyHitbox && r.bodyHitbox.parent) r.bodyHitbox.parent.remove(r.bodyHitbox);
        if (r.headHitbox && r.headHitbox.parent) r.headHitbox.parent.remove(r.headHitbox);

        var next = [];
        for (var i = 0; i < hitboxArray.length; i++) {
            var hb = hitboxArray[i];
            if (hb !== r.bodyHitbox && hb !== r.headHitbox) next.push(hb);
        }
        hitboxArray = next;

        renderMap.delete(id);
    };

    GameNetEntities.updateFromSnapshot = function (entity) {
        if (!sceneRef) return;
        var r = GameNetEntities.ensureRemote(entity);
        r.targetX = entity.x;
        r.targetY = entity.y || 1.6;
        r.targetFootY = ((typeof entity.y === 'number' ? entity.y : REMOTE_EYE_HEIGHT) - REMOTE_EYE_HEIGHT);
        r.targetZ = entity.z;
        r.targetYaw = (entity.yaw || 0);
        r.targetPitch = entity.pitch || 0;
        r.hp = entity.hp;
        r.hpMax = entity.hpMax;
        r.armor = entity.armor;
        r.armorMax = entity.armorMax;
        r.classId = entity.classId;
        r.username = entity.username;
        r.alive = entity.alive;
        r.wallhackRadius = entity.wallhackRadius || classStats(entity.classId).wallhackRadius;
        r.moveSpeedNorm = entity.moveSpeedNorm || 0;
        r.sprinting = !!entity.sprinting;
        r.weaponId = entity.weaponId || 'rifle';
        r.streamHeat = entity.streamHeat || 0;
        r.streamOverheatedUntil = entity.streamOverheatedUntil || 0;
        r.muzzleFlashUntil = entity.muzzleFlashUntil || 0;
        r.chokeState = entity.chokeState || null;
        r.abilityLoadout = entity.abilityLoadout || null;

        r.group.visible = !!entity.alive;
        r.bodyHitbox.visible = !!entity.alive;
        r.headHitbox.visible = !!entity.alive;
    };

    GameNetEntities.getHitboxArray = function () {
        return hitboxArray;
    };

    GameNetEntities.toggleHitboxVisibility = function () {
        hitboxVisible = !hitboxVisible;
        renderMap.forEach(function (r) {
            if (!r.bodyHitbox || !r.headHitbox) return;
            r.bodyHitbox.material.opacity = hitboxVisible ? 0.3 : 0;
            r.headHitbox.material.opacity = hitboxVisible ? 0.3 : 0;
        });
        return hitboxVisible;
    };

    GameNetEntities.setHitboxVisibility = function (visible) {
        hitboxVisible = !!visible;
        renderMap.forEach(function (r) {
            if (!r.bodyHitbox || !r.headHitbox) return;
            r.bodyHitbox.material.opacity = hitboxVisible ? 0.3 : 0;
            r.headHitbox.material.opacity = hitboxVisible ? 0.3 : 0;
        });
    };

    GameNetEntities.getRenderMap = function () {
        return renderMap;
    };

    GameNetEntities.classStats = classStats;

    GameNetEntities.cleanup = function () {
        var ids = [];
        renderMap.forEach(function (_v, id) { ids.push(id); });
        for (var i = 0; i < ids.length; i++) {
            GameNetEntities.removeRemoteVisual(ids[i]);
        }
        renderMap.clear();
        hitboxArray = [];
    };

    globalThis.__MAYHEM_RUNTIME.GameNetEntities = GameNetEntities;
})();
