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
    var entityConstants = (globalThis.__MAYHEM_RUNTIME.GameShared && globalThis.__MAYHEM_RUNTIME.GameShared.entityConstants) || {};
    var REMOTE_EYE_HEIGHT = Number(entityConstants.EYE_HEIGHT || 1.6);
    var hitboxFactory = globalThis.__MAYHEM_RUNTIME.GameHitboxFactory || null;

    function classWallhackRadiusFor(classId) {
        if (globalThis.__MAYHEM_RUNTIME.GameCombatTuning && globalThis.__MAYHEM_RUNTIME.GameCombatTuning.getClassWallhackRadius) {
            return globalThis.__MAYHEM_RUNTIME.GameCombatTuning.getClassWallhackRadius(classId);
        }
        return 90;
    }

    function sharedClassPreset(classId) {
        var shared = (globalThis.__MAYHEM_RUNTIME.GameShared && globalThis.__MAYHEM_RUNTIME.GameShared.gameplayTuning) || {};
        var presets = shared.classPresets || {};
        return presets[classId] || presets.abilities || null;
    }

    function classStats(classId) {
        var preset = sharedClassPreset(classId);
        return {
            armorMax: preset && Number(preset.armorMax || 0) > 0 ? Number(preset.armorMax) : 90,
            wallhackRadius: preset && Number(preset.wallhackRadius || 0) > 0
                ? Number(preset.wallhackRadius)
                : classWallhackRadiusFor(classId)
        };
    }

    function readAbilityFx(entity) {
        return (entity && entity.abilityFx && typeof entity.abilityFx === 'object') ? entity.abilityFx : null;
    }

    function createRemoteVisual(entity) {
        var group = new THREE.Group();
        var color = entity.kind === 'bot' ? 0x8f5a2d : 0x3772c4;
        var actorFactory = globalThis.__MAYHEM_RUNTIME.GameActorVisualFactory || null;
        var actorVisual = actorFactory && actorFactory.create ? actorFactory.create({
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
        var rigApi = actorVisual ? actorVisual.rigApi : null;
        var bodyHitbox = actorVisual ? actorVisual.bodyHitbox : null;
        var headHitbox = actorVisual ? actorVisual.headHitbox : null;
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
        var abilityFx = readAbilityFx(entity);

        return {
            id: entity.id,
            kind: entity.kind,
            group: group,
            bodyHitbox: bodyHitbox,
            headHitbox: headHitbox,
            actorVisual: actorVisual,
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
            spawnShieldUntil: entity.spawnShieldUntil || 0,
            wallhackRadius: entity.wallhackRadius || classStats(entity.classId).wallhackRadius,
            moveSpeedNorm: entity.moveSpeedNorm || 0,
            sprinting: !!entity.sprinting,
            isGrounded: entity.isGrounded !== false,
            velocityY: Number(entity.velocityY || 0),
            _prevIsGrounded: entity.isGrounded !== false,
            weaponId: entity.weaponId || 'rifle',
            _appliedWeaponId: entity.weaponId || 'rifle',
            muzzleFlashUntil: entity.muzzleFlashUntil || 0,
            chokeVictimState: abilityFx ? (abilityFx.chokeVictim || null) : null,
            hookedUntil: abilityFx ? Number(abilityFx.hookedUntil || 0) : 0,
            streamHeat: entity.streamHeat || 0,
            streamOverheatedUntil: entity.streamOverheatedUntil || 0,
            hookState: abilityFx ? (abilityFx.hookVisual || null) : null,
            chokeState: abilityFx && Number(abilityFx.chokeCasterUntil || 0) > 0
                ? { endsAt: Number(abilityFx.chokeCasterUntil || 0) }
                : null,
            healState: abilityFx && Number(abilityFx.healUntil || 0) > 0
                ? { endsAt: Number(abilityFx.healUntil || 0) }
                : null
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
        if (!r || !r.group) return;
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
        r.spawnShieldUntil = entity.spawnShieldUntil || 0;
        r.wallhackRadius = entity.wallhackRadius || classStats(entity.classId).wallhackRadius;
        r.moveSpeedNorm = entity.moveSpeedNorm || 0;
        r.sprinting = !!entity.sprinting;
        r.isGrounded = entity.isGrounded !== false;
        r.velocityY = Number(entity.velocityY || 0);
        r.weaponId = entity.weaponId || 'rifle';
        r.streamHeat = entity.streamHeat || 0;
        r.streamOverheatedUntil = entity.streamOverheatedUntil || 0;
        r.muzzleFlashUntil = entity.muzzleFlashUntil || 0;
        var abilityFx = readAbilityFx(entity);
        r.chokeState = abilityFx && Number(abilityFx.chokeCasterUntil || 0) > 0
            ? { endsAt: Number(abilityFx.chokeCasterUntil || 0) }
            : null;
        r.chokeVictimState = abilityFx ? (abilityFx.chokeVictim || null) : null;
        r.hookedUntil = abilityFx ? Number(abilityFx.hookedUntil || 0) : 0;
        r.hookState = abilityFx ? (abilityFx.hookVisual || null) : null;
        r.healState = abilityFx && Number(abilityFx.healUntil || 0) > 0
            ? { endsAt: Number(abilityFx.healUntil || 0) }
            : null;
        r.abilityLoadout = entity.abilityLoadout || null;

        r.group.visible = !!entity.alive;
        if (r.bodyHitbox) r.bodyHitbox.visible = !!entity.alive;
        if (r.headHitbox) r.headHitbox.visible = !!entity.alive;
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
            if (r.actorVisual && r.actorVisual.setHitboxVisibility) r.actorVisual.setHitboxVisibility(hitboxVisible);
        });
        return hitboxVisible;
    };

    GameNetEntities.setHitboxVisibility = function (visible) {
        hitboxVisible = !!visible;
        renderMap.forEach(function (r) {
            if (!r.bodyHitbox || !r.headHitbox) return;
            r.bodyHitbox.material.opacity = hitboxVisible ? 0.3 : 0;
            r.headHitbox.material.opacity = hitboxVisible ? 0.3 : 0;
            if (r.actorVisual && r.actorVisual.setHitboxVisibility) r.actorVisual.setHitboxVisibility(hitboxVisible);
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
