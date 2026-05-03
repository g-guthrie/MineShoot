/**
 * actor-visual-factory.js - Shared avatar + hitbox creation for player/enemy/remote actors.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameActorVisualFactory
 */
(function () {
    'use strict';

    var GameActorVisualFactory = {};

    function sharedApi() {
        return (globalThis.__MAYHEM_RUNTIME && globalThis.__MAYHEM_RUNTIME.GameShared) || {};
    }

    function entityPointsApi() {
        return sharedApi().entityPoints || {};
    }

    function entityConstantsApi() {
        return sharedApi().entityConstants || {};
    }

    function cloneVisualForRevealGhost(visual) {
        if (!visual || !visual.clone) return null;
        if (visual.userData && typeof visual.userData.cloneVisualForRevealGhost === 'function') {
            return visual.userData.cloneVisualForRevealGhost();
        }
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
        ghost.userData.baseColor = 0x65d8ff;
        return ghost;
    }

    function disposeMaterials(materials) {
        if (!Array.isArray(materials)) return;
        var seen = [];
        for (var i = 0; i < materials.length; i++) {
            var material = materials[i];
            if (!material || typeof material.dispose !== 'function' || seen.indexOf(material) !== -1) continue;
            seen.push(material);
            material.dispose();
        }
    }

    function disposeObjectResources(root) {
        if (!root || !root.traverse) return;
        var geometries = [];
        var materials = [];
        root.traverse(function (node) {
            if (
                node &&
                node.geometry &&
                typeof node.geometry.dispose === 'function' &&
                !(node.geometry.userData && node.geometry.userData.sharedHitboxGeometry) &&
                geometries.indexOf(node.geometry) === -1
            ) {
                geometries.push(node.geometry);
            }
            if (!node || !node.material) return;
            var nodeMaterials = Array.isArray(node.material) ? node.material : [node.material];
            for (var i = 0; i < nodeMaterials.length; i++) {
                var material = nodeMaterials[i];
                if (material && typeof material.dispose === 'function' && materials.indexOf(material) === -1) {
                    materials.push(material);
                }
            }
        });
        for (var g = 0; g < geometries.length; g++) {
            geometries[g].dispose();
        }
        disposeMaterials(materials);
    }

    function createMovementCollider(ownerType, opacity) {
        var constants = entityConstantsApi();
        var radius = Math.max(0.05, Number(constants.PLAYER_RADIUS || 0.5));
        var height = Math.max(radius, Number(constants.PLAYER_HEIGHT || 2.8));
        var geometry = new THREE.EdgesGeometry(new THREE.CylinderGeometry(radius, radius, height, 16, 1, false));
        var material = new THREE.LineBasicMaterial({
            color: 0x33ff66,
            transparent: true,
            opacity: (typeof opacity === 'number') ? opacity : 0.3,
            depthTest: false
        });
        var collider = new THREE.LineSegments(geometry, material);
        collider.renderOrder = 2;
        collider.userData = {
            type: 'movement_collider',
            ownerType: ownerType,
            radius: radius,
            height: height
        };
        return collider;
    }

    function normalizeCombatHitboxState(state) {
        var source = state && typeof state === 'object' ? state : {};
        return {
            rolling: !!source.rolling
        };
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

        var rigApi = null;
        if (
            globalThis.__MAYHEM_RUNTIME.GameBoxmanRig &&
            globalThis.__MAYHEM_RUNTIME.GameBoxmanRig.isReady &&
            globalThis.__MAYHEM_RUNTIME.GameBoxmanRig.isReady() &&
            globalThis.__MAYHEM_RUNTIME.GameBoxmanRig.create
        ) {
            rigApi = globalThis.__MAYHEM_RUNTIME.GameBoxmanRig.create({
                bodyColor: bodyColor,
                skinColor: skinColor,
                legColor: legColor,
                weaponId: weaponId,
                tintColor: (ownerType === 'player') ? 0xffffff : bodyColor
            });
        }
        if (!rigApi || !rigApi.root) {
            throw new Error('GameActorVisualFactory.create requires GameBoxmanRig.create to return a rig root.');
        }
        var visual = rigApi.root;
        var root = new THREE.Group();
        root.add(visual);
        var rig = rigApi.rig || null;
        var bodyParts = (visual.userData && Array.isArray(visual.userData.bodyParts)) ? visual.userData.bodyParts : [];
        var originalPartColors = (visual.userData && Array.isArray(visual.userData.originalPartColors)) ? visual.userData.originalPartColors : [];
        var revealState = {
            materials: [],
            baseOpacity: 0.26
        };
        var combatHitboxState = normalizeCombatHitboxState(opts.combatHitboxState);
        var alive = true;
        var hitboxesEnabled = hitboxOpacity > 0;
        var destroyed = false;

        var bodyHitbox = null;
        var headHitbox = null;
        var movementCollider = !!opts.includeCollisionDebug ? createMovementCollider(ownerType, hitboxOpacity) : null;
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
        if (revealGhost) {
            root.add(revealGhost);
        }
        if (revealGhost && revealGhost.userData) {
            revealState.materials = Array.isArray(revealGhost.userData.revealMaterials) ? revealGhost.userData.revealMaterials : [];
            revealState.baseOpacity = Number(revealGhost.userData.baseOpacity || 0.26);
        }

        function restorePartColors() {
            for (var i = 0; i < bodyParts.length; i++) {
                var part = bodyParts[i];
                if (!part || !part.material || !part.material.color) continue;
                part.material.color.setHex(typeof originalPartColors[i] === 'number' ? originalPartColors[i] : 0xffffff);
                if (part.material.emissive) part.material.emissive.setHex(0x000000);
            }
        }

        function setPartFlash(colorHex, emissiveHex) {
            for (var i = 0; i < bodyParts.length; i++) {
                var part = bodyParts[i];
                if (!part || !part.material || !part.material.color) continue;
                part.material.color.setHex(colorHex);
                if (part.material.emissive) part.material.emissive.setHex(emissiveHex);
            }
        }

        function applyHitboxState() {
            var opacity = hitboxesEnabled ? 0.3 : 0;
            if (bodyHitbox) {
                bodyHitbox.visible = alive;
                if (bodyHitbox.material) bodyHitbox.material.opacity = opacity;
            }
            if (headHitbox) {
                headHitbox.visible = alive && !combatHitboxState.rolling;
                if (headHitbox.material) headHitbox.material.opacity = opacity;
            }
            if (movementCollider) {
                movementCollider.visible = alive;
                if (movementCollider.material) movementCollider.material.opacity = opacity;
            }
        }

        function syncHitboxes(rootPosition, state) {
            var entityPoints = entityPointsApi();
            var entityConstants = entityConstantsApi();
            if (state !== undefined) {
                combatHitboxState = normalizeCombatHitboxState(state);
                applyHitboxState();
            }
            rootPosition = rootPosition || root.position;
            if (!rootPosition) return;
            if (bodyHitbox) {
                var rollBodyLinearScale = Math.max(0.01, Number(entityPoints.ROLL_BODY_HITBOX_LINEAR_SCALE || Math.cbrt(0.0853125)));
                var bodyBaseCenterY = entityPoints.entityBodyHitboxYFromFeet
                    ? entityPoints.entityBodyHitboxYFromFeet(rootPosition.y)
                    : (rootPosition.y + 0.7625);
                var bodyBaseHalfY = bodyHitbox.geometry && bodyHitbox.geometry.parameters
                    ? Number(bodyHitbox.geometry.parameters.height || 0) * 0.5
                    : Number(entityConstants.BODY_HITBOX_SIZE && entityConstants.BODY_HITBOX_SIZE.y || 0) * 0.5;
                var bodyUniformScale = combatHitboxState.rolling ? rollBodyLinearScale : 1;
                var bodyBaseMinY = bodyBaseCenterY - bodyBaseHalfY;
                bodyHitbox.scale.set(bodyUniformScale, bodyUniformScale, bodyUniformScale);
                bodyHitbox.position.set(
                    rootPosition.x,
                    bodyBaseMinY + (bodyBaseHalfY * bodyUniformScale),
                    rootPosition.z
                );
            }
            if (headHitbox) {
                headHitbox.scale.set(1, 1, 1);
                var eyeWorld = rigApi && rigApi.getEyeWorldPosition ? rigApi.getEyeWorldPosition(new THREE.Vector3()) : null;
                if (eyeWorld) {
                    var rootRef = root && root.position ? root.position : rootPosition;
                    var bodyHalfY = bodyHitbox && bodyHitbox.geometry && bodyHitbox.geometry.parameters
                        ? Number(bodyHitbox.geometry.parameters.height || 0) * Number(bodyHitbox.scale && bodyHitbox.scale.y || 1) * 0.5
                        : Number(entityConstants.BODY_HITBOX_SIZE && entityConstants.BODY_HITBOX_SIZE.y || 0) * 0.5;
                    var headHalfY = headHitbox.geometry && headHitbox.geometry.parameters
                        ? Number(headHitbox.geometry.parameters.height || 0) * Number(headHitbox.scale && headHitbox.scale.y || 1) * 0.5
                        : Number(entityConstants.HEAD_HITBOX_SIZE && entityConstants.HEAD_HITBOX_SIZE.y || 0) * 0.5;
                    var bodyTopY = Number(bodyHitbox && bodyHitbox.position ? bodyHitbox.position.y || 0 : 0) + bodyHalfY;
                    headHitbox.position.set(
                        eyeWorld.x + (Number(rootPosition.x || 0) - Number(rootRef.x || 0)),
                        bodyTopY + headHalfY,
                        eyeWorld.z + (Number(rootPosition.z || 0) - Number(rootRef.z || 0))
                    );
                } else {
                    headHitbox.position.set(rootPosition.x, entityPoints.entityHeadHitboxYFromFeet ? entityPoints.entityHeadHitboxYFromFeet(rootPosition.y) : (rootPosition.y + 2.0), rootPosition.z);
                }
            }
            if (movementCollider) {
                var baseColliderHeight = Math.max(0.05, Number(entityConstants.PLAYER_HEIGHT || movementCollider.userData.height || 2.8));
                var rollHeightScale = Math.max(0.05, Number(entityConstants.ROLL_CONTACT_CYLINDER_HEIGHT_SCALE || 0.3));
                var colliderHeight = combatHitboxState.rolling
                    ? Math.max(Number(entityConstants.PLAYER_RADIUS || movementCollider.userData.radius || 0.5), baseColliderHeight * rollHeightScale)
                    : baseColliderHeight;
                movementCollider.scale.set(1, colliderHeight / Math.max(0.0001, baseColliderHeight), 1);
                movementCollider.position.set(rootPosition.x, rootPosition.y + (colliderHeight * 0.5), rootPosition.z);
            }
        }

        function setPosition(rootPosition, state) {
            if (!rootPosition) return;
            root.position.set(
                (typeof rootPosition.x === 'number') ? rootPosition.x : root.position.x,
                (typeof rootPosition.y === 'number') ? rootPosition.y : root.position.y,
                (typeof rootPosition.z === 'number') ? rootPosition.z : root.position.z
            );
            syncHitboxes(root.position, state);
        }

        function setYaw(yaw) {
            if (typeof yaw !== 'number' || !isFinite(yaw)) return;
            root.rotation.y = yaw;
        }

        function setWorldTransform(rootPosition, yaw, state) {
            setPosition(rootPosition, state);
            setYaw(yaw);
        }

        function setCombatHitboxState(state) {
            combatHitboxState = normalizeCombatHitboxState(state);
            applyHitboxState();
            syncHitboxes(root.position);
        }

        function setHitboxVisibility(visible) {
            hitboxesEnabled = !!visible;
            applyHitboxState();
        }

        function setAlive(active) {
            alive = !!active;
            root.visible = alive;
            visual.visible = alive;
            if (!alive && revealGhost) revealGhost.visible = false;
            applyHitboxState();
        }

        function setDamageFlash(active) {
            if (active) {
                setPartFlash(0xff0000, 0x440000);
            } else {
                restorePartColors();
            }
        }

        function setSpawnShield(active) {
            visual.traverse(function (node) {
                if (!node || !node.isMesh || !node.material) return;
                var mat = node.material;
                if (mat.__spawnShieldBaseOpacity === undefined) {
                    mat.__spawnShieldBaseOpacity = (typeof mat.opacity === 'number') ? mat.opacity : 1;
                    mat.__spawnShieldBaseTransparent = !!mat.transparent;
                }
                if (active) {
                    mat.transparent = true;
                    mat.opacity = Math.min(mat.__spawnShieldBaseOpacity, 0.42);
                } else {
                    mat.opacity = mat.__spawnShieldBaseOpacity;
                    mat.transparent = mat.__spawnShieldBaseTransparent;
                }
                mat.needsUpdate = true;
            });
        }

        function setRevealGhostState(visible, opacity, colorHex) {
            if (!revealGhost) return;
            revealGhost.visible = !!visible && alive;
            if (!revealGhost.visible) return;
            var nextOpacity = (typeof opacity === 'number' && isFinite(opacity)) ? opacity : revealState.baseOpacity;
            var nextColor = (typeof colorHex === 'number' && isFinite(colorHex))
                ? colorHex
                : (revealGhost.userData ? Number(revealGhost.userData.baseColor || 0x65d8ff) : 0x65d8ff);
            for (var i = 0; i < revealState.materials.length; i++) {
                revealState.materials[i].opacity = nextOpacity;
                if (revealState.materials[i].color) revealState.materials[i].color.setHex(nextColor);
            }
        }

        function destroy() {
            if (destroyed) return;
            destroyed = true;
            if (root && root.parent) root.parent.remove(root);
            if (bodyHitbox && bodyHitbox.parent) bodyHitbox.parent.remove(bodyHitbox);
            if (headHitbox && headHitbox.parent) headHitbox.parent.remove(headHitbox);
            if (movementCollider && movementCollider.parent) movementCollider.parent.remove(movementCollider);
            if (rigApi && rigApi.dispose) rigApi.dispose();
            disposeMaterials(revealState.materials);
            disposeObjectResources(bodyHitbox);
            disposeObjectResources(headHitbox);
            disposeObjectResources(movementCollider);
        }

        function getCoreWorldPosition(outVec3) {
            return rigApi && rigApi.getCoreWorldPosition ? rigApi.getCoreWorldPosition(outVec3) : null;
        }

        function getThrowableOriginWorldPosition(outVec3) {
            return rigApi && rigApi.getThrowableOriginWorldPosition ? rigApi.getThrowableOriginWorldPosition(outVec3) : null;
        }

        function getEyeWorldPosition(outVec3) {
            return rigApi && rigApi.getEyeWorldPosition ? rigApi.getEyeWorldPosition(outVec3) : null;
        }

        function setMuzzleVisible(visible) {
            if (rigApi && rigApi.setMuzzleVisible) {
                rigApi.setMuzzleVisible(visible);
            }
        }

        function setWeapon(weaponId) {
            if (rigApi && rigApi.setWeapon) {
                rigApi.setWeapon(weaponId);
            }
        }

        function updateAnimation(dt, animState) {
            if (rigApi && rigApi.updateAnimation) {
                rigApi.updateAnimation(dt, animState);
            }
        }

        function triggerAction(action, options) {
            if (rigApi && rigApi.triggerAction) {
                return !!rigApi.triggerAction(action, options || null);
            }
            return false;
        }

        function cancelStopRecoveryForFire() {
            if (rigApi && rigApi.cancelStopRecoveryForFire) {
                return !!rigApi.cancelStopRecoveryForFire();
            }
            return false;
        }

        function getMuzzleWorldPosition(outVec3) {
            return rigApi && rigApi.getMuzzleWorldPosition ? rigApi.getMuzzleWorldPosition(outVec3) : null;
        }

        function getWeaponId() {
            return rigApi && rigApi.getWeaponId ? rigApi.getWeaponId() : weaponId;
        }

        applyHitboxState();

        return {
            root: root,
            visual: visual,
            rig: rig,
            rigApi: rigApi,
            bodyHitbox: bodyHitbox,
            headHitbox: headHitbox,
            movementCollider: movementCollider,
            revealGhost: revealGhost,
            syncHitboxes: syncHitboxes,
            setPosition: setPosition,
            setYaw: setYaw,
            setWorldTransform: setWorldTransform,
            setCombatHitboxState: setCombatHitboxState,
            setAlive: setAlive,
            setDamageFlash: setDamageFlash,
            setSpawnShield: setSpawnShield,
            setRevealGhostState: setRevealGhostState,
            setHitboxVisibility: setHitboxVisibility,
            setWeapon: setWeapon,
            updateAnimation: updateAnimation,
            setMuzzleVisible: setMuzzleVisible,
            triggerAction: triggerAction,
            cancelStopRecoveryForFire: cancelStopRecoveryForFire,
            destroy: destroy,
            getCoreWorldPosition: getCoreWorldPosition,
            getMuzzleWorldPosition: getMuzzleWorldPosition,
            getThrowableOriginWorldPosition: getThrowableOriginWorldPosition,
            getEyeWorldPosition: getEyeWorldPosition,
            getWeaponId: getWeaponId
        };
    };

    globalThis.__MAYHEM_RUNTIME.GameActorVisualFactory = GameActorVisualFactory;
})();
