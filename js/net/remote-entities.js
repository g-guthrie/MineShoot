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

    function createRemoteVisual(entity) {
        var color = entity.kind === 'bot' ? 0x8f5a2d : 0x3772c4;
        var actorFactory = globalThis.__MAYHEM_RUNTIME.GameActorVisualFactory || null;
        if (!actorFactory || !actorFactory.create) {
            throw new Error('GameNetEntities requires GameActorVisualFactory.create.');
        }
        var actorVisual = actorFactory.create({
            ownerType: 'net',
            bodyColor: color,
            skinColor: 0xd2a77d,
            legColor: entity.kind === 'bot' ? 0x4a3420 : 0x2d2d2d,
            weaponId: entity.weaponId || 'rifle',
            targetId: 'net:' + entity.id,
            netEntityId: entity.id,
            hitboxOpacity: hitboxVisible ? 0.3 : 0
        });
        var group = actorVisual.root || actorVisual.visual;
        var rigApi = actorVisual.rigApi;
        var bodyHitbox = actorVisual.bodyHitbox;
        var headHitbox = actorVisual.headHitbox;
        if (bodyHitbox && bodyHitbox.userData) bodyHitbox.userData.netEntityId = entity.id;
        if (headHitbox && headHitbox.userData) headHitbox.userData.netEntityId = entity.id;
        if (bodyHitbox) sceneRef.add(bodyHitbox);
        if (headHitbox) sceneRef.add(headHitbox);
        if (actorVisual.setWorldTransform) {
            actorVisual.setWorldTransform({
                x: entity.x,
                y: ((typeof entity.y === 'number' ? entity.y : REMOTE_EYE_HEIGHT) - REMOTE_EYE_HEIGHT),
                z: entity.z
            }, (entity.yaw || 0));
        } else {
            group.position.set(
                entity.x,
                ((typeof entity.y === 'number' ? entity.y : REMOTE_EYE_HEIGHT) - REMOTE_EYE_HEIGHT),
                entity.z
            );
            group.rotation.y = (entity.yaw || 0);
        }

        sceneRef.add(group);
        if (bodyHitbox) hitboxArray.push(bodyHitbox);
        if (headHitbox) hitboxArray.push(headHitbox);
        var abilityFxView = globalThis.__MAYHEM_RUNTIME.GameAbilityFx;
        var snapshotAbilityState = abilityFxView && abilityFxView.buildSnapshotAbilityState
            ? abilityFxView.buildSnapshotAbilityState(entity)
            : {
                chokeVictimState: null,
                hookedUntil: 0,
                hookState: null,
                chokeState: null,
                healState: null
            };

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
            chokeVictimState: snapshotAbilityState.chokeVictimState,
            hookedUntil: snapshotAbilityState.hookedUntil,
            streamHeat: entity.streamHeat || 0,
            streamOverheatedUntil: entity.streamOverheatedUntil || 0,
            hookState: snapshotAbilityState.hookState,
            chokeState: snapshotAbilityState.chokeState,
            healState: snapshotAbilityState.healState
        };
    }

    GameNetEntities.init = function (scene) {
        sceneRef = scene;
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

        if (r.actorVisual && r.actorVisual.destroy) {
            r.actorVisual.destroy();
        } else if (r.group && r.group.parent) {
            r.group.parent.remove(r.group);
        }

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
        var abilityFxView = globalThis.__MAYHEM_RUNTIME.GameAbilityFx;
        var snapshotAbilityState = abilityFxView && abilityFxView.buildSnapshotAbilityState
            ? abilityFxView.buildSnapshotAbilityState(entity)
            : {
                chokeVictimState: null,
                hookedUntil: 0,
                hookState: null,
                chokeState: null,
                healState: null
            };
        r.chokeState = snapshotAbilityState.chokeState;
        r.chokeVictimState = snapshotAbilityState.chokeVictimState;
        r.hookedUntil = snapshotAbilityState.hookedUntil;
        r.hookState = snapshotAbilityState.hookState;
        r.healState = snapshotAbilityState.healState;
        r.abilityLoadout = entity.abilityLoadout || null;

        r.group.visible = !!entity.alive;
        if (r.actorVisual && r.actorVisual.setAlive) {
            r.actorVisual.setAlive(entity.alive);
            r.actorVisual.setHitboxVisibility(hitboxVisible);
        }
    };

    GameNetEntities.getHitboxArray = function () {
        return hitboxArray;
    };

    GameNetEntities.toggleHitboxVisibility = function () {
        hitboxVisible = !hitboxVisible;
        renderMap.forEach(function (r) {
            if (r.actorVisual && r.actorVisual.setHitboxVisibility) r.actorVisual.setHitboxVisibility(hitboxVisible);
        });
        return hitboxVisible;
    };

    GameNetEntities.setHitboxVisibility = function (visible) {
        hitboxVisible = !!visible;
        renderMap.forEach(function (r) {
            if (r.actorVisual && r.actorVisual.setHitboxVisibility) r.actorVisual.setHitboxVisibility(hitboxVisible);
        });
    };

    GameNetEntities.getRenderMap = function () {
        return renderMap;
    };

    GameNetEntities.getCoreWorldPosition = function (entityId, outVec3) {
        var render = renderMap.get(entityId);
        if (!render || !render.actorVisual || !render.actorVisual.getCoreWorldPosition) return null;
        return render.actorVisual.getCoreWorldPosition(outVec3);
    };

    GameNetEntities.getHookOriginWorldPosition = function (entityId, outVec3) {
        var render = renderMap.get(entityId);
        if (!render || !render.actorVisual) return null;
        if (render.actorVisual.getThrowableOriginWorldPosition) {
            var throwableOrigin = render.actorVisual.getThrowableOriginWorldPosition(outVec3);
            if (throwableOrigin) return throwableOrigin;
        }
        if (render.actorVisual.getCoreWorldPosition) {
            return render.actorVisual.getCoreWorldPosition(outVec3);
        }
        return null;
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
