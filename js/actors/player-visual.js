/**
 * player-visual.js - Shared visual glue for GamePlayer presentation.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GamePlayerVisual
 */
(function () {
    'use strict';

    var runtime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    var GamePlayerVisual = {};
    var avatarTransformScratch = { x: 0, y: 0, z: 0 };

    function asNumber(value, fallback) {
        var out = Number(value);
        return isFinite(out) ? out : Number(fallback || 0);
    }

    function ensureState(state) {
        return state && typeof state === 'object' ? state : {};
    }

    function resolveActorVisual(state) {
        state = ensureState(state);
        return state.actorVisual || null;
    }

    function resolveAvatarRigApi(state) {
        state = ensureState(state);
        return state.avatarRigApi || null;
    }

    function resolveWeaponId(state, weaponId) {
        state = ensureState(state);
        if (typeof weaponId === 'string' && weaponId) return weaponId;
        if (typeof state.currentWeaponId === 'string' && state.currentWeaponId) return state.currentWeaponId;
        if (typeof state.weaponId === 'string' && state.weaponId) return state.weaponId;
        return 'rifle';
    }

    function resolveFeetY(state) {
        state = ensureState(state);
        if (typeof state.feetY === 'number' && isFinite(state.feetY)) {
            return Number(state.feetY);
        }
        return asNumber(state.posY, 0) - asNumber(state.eyeHeight, 0);
    }

    function writeWeaponId(state, weaponId) {
        state = ensureState(state);
        var nextWeaponId = resolveWeaponId(state, weaponId);
        state.currentWeaponId = nextWeaponId;
        state.weaponId = nextWeaponId;
        return nextWeaponId;
    }

    function setWeaponPose(state, weaponId) {
        state = ensureState(state);
        var nextWeaponId = writeWeaponId(state, weaponId);
        var actorVisual = resolveActorVisual(state);
        if (actorVisual && actorVisual.setWeapon) {
            actorVisual.setWeapon(nextWeaponId);
            return true;
        }
        var avatarRigApi = resolveAvatarRigApi(state);
        if (avatarRigApi && avatarRigApi.setWeapon) {
            avatarRigApi.setWeapon(nextWeaponId);
            return true;
        }
        return false;
    }

    function syncAvatarVisibility(state) {
        state = ensureState(state);
        if (!state.avatarGroup) return false;

        var scopeBlend = asNumber(state.scopeBlend, 0);
        var avatarVisible = !!state.avatarAliveVisible && (!state.sniperMode || scopeBlend < 0.55);
        state.avatarGroup.visible = avatarVisible;

        if (!avatarVisible) return false;

        var avatarRigApi = resolveAvatarRigApi(state);
        if (!avatarRigApi || !avatarRigApi.rig) return true;

        var rig = avatarRigApi.rig;
        if (rig.headMesh) rig.headMesh.visible = true;
        if (rig.bodyMesh) rig.bodyMesh.visible = true;
        if (rig.legLMesh) rig.legLMesh.visible = true;
        if (rig.legRMesh) rig.legRMesh.visible = true;
        if (rig.armLMesh) rig.armLMesh.visible = true;
        if (rig.armRMesh) rig.armRMesh.visible = true;
        return true;
    }

    function syncHitboxPositions(state) {
        state = ensureState(state);
        var actorVisual = resolveActorVisual(state);
        if (!actorVisual || !actorVisual.syncHitboxes) return false;

        avatarTransformScratch.x = asNumber(state.playerX, state.avatarTransformScratch && state.avatarTransformScratch.x);
        avatarTransformScratch.y = resolveFeetY(state);
        avatarTransformScratch.z = asNumber(state.playerZ, state.avatarTransformScratch && state.avatarTransformScratch.z);
        actorVisual.syncHitboxes(avatarTransformScratch, {
            rolling: !!(state.rolling || (state.isRolling && state.isRolling()))
        });
        return true;
    }

    function applyAvatarPose(state) {
        state = ensureState(state);
        var actorVisual = resolveActorVisual(state);
        var avatarGroup = state.avatarGroup || (actorVisual && (actorVisual.root || actorVisual.visual)) || null;
        var feetY = asNumber(
            state.feetY,
            asNumber(state.posY, 0) - asNumber(state.eyeHeight, 0)
        );
        var rolling = !!(state.rolling || (state.isRolling && state.isRolling()));

        if (actorVisual && actorVisual.setWorldTransform) {
            avatarTransformScratch.x = asNumber(state.playerX, 0);
            avatarTransformScratch.y = feetY;
            avatarTransformScratch.z = asNumber(state.playerZ, 0);
            actorVisual.setWorldTransform(avatarTransformScratch, asNumber(state.yaw, 0), { rolling: rolling });
            return true;
        }

        if (!avatarGroup) return false;

        if (avatarGroup.position && avatarGroup.position.set) {
            avatarGroup.position.set(
                asNumber(state.playerX, 0),
                feetY,
                asNumber(state.playerZ, 0)
            );
        } else {
            avatarGroup.position = {
                x: asNumber(state.playerX, 0),
                y: feetY,
                z: asNumber(state.playerZ, 0)
            };
        }

        if (avatarGroup.rotation) {
            avatarGroup.rotation.y = asNumber(state.yaw, 0);
        }

        syncHitboxPositions(state);
        return true;
    }

    function setAliveVisual(state, active) {
        state = ensureState(state);
        state.avatarAliveVisible = !!active;

        var actorVisual = resolveActorVisual(state);
        if (actorVisual && actorVisual.setAlive) {
            actorVisual.setAlive(!!active);
            if (actorVisual.setHitboxVisibility) {
                actorVisual.setHitboxVisibility(!!state.hitboxVisible);
            }
        }

        syncAvatarVisibility(state);
        return !!active;
    }

    function setHitboxVisibility(state, visible) {
        state = ensureState(state);
        state.hitboxVisible = !!visible;

        var actorVisual = resolveActorVisual(state);
        if (actorVisual && actorVisual.setHitboxVisibility) {
            actorVisual.setHitboxVisibility(!!visible);
            return !!visible;
        }

        return !!visible;
    }

    function setSpawnShieldVisual(state, active) {
        state = ensureState(state);
        state.spawnShieldVisible = !!active;

        var actorVisual = resolveActorVisual(state);
        if (actorVisual && actorVisual.setSpawnShield) {
            actorVisual.setSpawnShield(!!active);
            return !!active;
        }

        return !!active;
    }

    function forwardFireAction(state, action, options) {
        state = ensureState(state);

        var actionName = 'fire';
        var actionOptions = options || null;
        if (typeof action === 'string' && action) {
            actionName = action;
        } else if (action && typeof action === 'object' && actionOptions == null) {
            actionOptions = action;
        }

        if (state.forwardFireAction === false || state.enableFireActionForwarding === false) {
            return false;
        }

        var actorVisual = resolveActorVisual(state);
        if (actorVisual && actorVisual.triggerAction) {
            return actorVisual.triggerAction(actionName, actionOptions) !== false;
        }

        var avatarRigApi = resolveAvatarRigApi(state);
        if (avatarRigApi && avatarRigApi.triggerAction) {
            return avatarRigApi.triggerAction(actionName, actionOptions) !== false;
        }

        return false;
    }

    function create(state) {
        var boundState = ensureState(state);
        return {
            setWeaponPose: function (weaponId) { return setWeaponPose(boundState, weaponId); },
            applyWeaponPose: function (weaponId) { return setWeaponPose(boundState, weaponId); },
            syncAvatarVisibility: function () { return syncAvatarVisibility(boundState); },
            applyAvatarPose: function () { return applyAvatarPose(boundState); },
            updateAvatarPose: function () { return applyAvatarPose(boundState); },
            syncHitboxPositions: function () { return syncHitboxPositions(boundState); },
            setAliveVisual: function (active) { return setAliveVisual(boundState, active); },
            setHitboxVisibility: function (visible) { return setHitboxVisibility(boundState, visible); },
            setSpawnShieldVisual: function (active) { return setSpawnShieldVisual(boundState, active); },
            forwardFireAction: function (action, options) { return forwardFireAction(boundState, action, options); }
        };
    }

    GamePlayerVisual.create = create;
    GamePlayerVisual.setWeaponPose = setWeaponPose;
    GamePlayerVisual.applyWeaponPose = setWeaponPose;
    GamePlayerVisual.syncAvatarVisibility = syncAvatarVisibility;
    GamePlayerVisual.applyAvatarPose = applyAvatarPose;
    GamePlayerVisual.updateAvatarPose = applyAvatarPose;
    GamePlayerVisual.syncHitboxPositions = syncHitboxPositions;
    GamePlayerVisual.setAliveVisual = setAliveVisual;
    GamePlayerVisual.setHitboxVisibility = setHitboxVisibility;
    GamePlayerVisual.setSpawnShieldVisual = setSpawnShieldVisual;
    GamePlayerVisual.forwardFireAction = forwardFireAction;
    GamePlayerVisual.triggerFireAction = forwardFireAction;

    runtime.GamePlayerVisual = GamePlayerVisual;
})();
