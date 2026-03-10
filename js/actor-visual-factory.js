/**
 * actor-visual-factory.js - Shared avatar + hitbox creation for player/enemy/remote actors.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameActorVisualFactory
 */
(function () {
    'use strict';

    var GameActorVisualFactory = {};
    var entityPoints = (globalThis.__MAYHEM_RUNTIME.GameShared && globalThis.__MAYHEM_RUNTIME.GameShared.entityPoints) || {};

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

        var rigApi = null;
        if (globalThis.__MAYHEM_RUNTIME.GameAvatarRig && globalThis.__MAYHEM_RUNTIME.GameAvatarRig.create) {
            rigApi = globalThis.__MAYHEM_RUNTIME.GameAvatarRig.create({
                bodyColor: bodyColor,
                skinColor: skinColor,
                legColor: legColor,
                weaponId: weaponId
            });
        }
        if (!rigApi || !rigApi.root) {
            throw new Error('GameActorVisualFactory.create requires GameAvatarRig.create to return a rig root.');
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
        var alive = true;
        var hitboxesEnabled = hitboxOpacity > 0;

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
                headHitbox.visible = alive;
                if (headHitbox.material) headHitbox.material.opacity = opacity;
            }
        }

        function syncHitboxes(rootPosition) {
            rootPosition = rootPosition || root.position;
            if (!rootPosition) return;
            if (bodyHitbox) bodyHitbox.position.set(rootPosition.x, entityPoints.entityBodyHitboxYFromFeet ? entityPoints.entityBodyHitboxYFromFeet(rootPosition.y) : (rootPosition.y + 0.7625), rootPosition.z);
            if (headHitbox) headHitbox.position.set(rootPosition.x, entityPoints.entityHeadHitboxYFromFeet ? entityPoints.entityHeadHitboxYFromFeet(rootPosition.y) : (rootPosition.y + 2.0), rootPosition.z);
        }

        function setPosition(rootPosition) {
            if (!rootPosition) return;
            root.position.set(
                (typeof rootPosition.x === 'number') ? rootPosition.x : root.position.x,
                (typeof rootPosition.y === 'number') ? rootPosition.y : root.position.y,
                (typeof rootPosition.z === 'number') ? rootPosition.z : root.position.z
            );
            syncHitboxes(root.position);
        }

        function setYaw(yaw) {
            if (typeof yaw !== 'number' || !isFinite(yaw)) return;
            root.rotation.y = yaw;
        }

        function setWorldTransform(rootPosition, yaw) {
            setPosition(rootPosition);
            setYaw(yaw);
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

        function setHealFlash(active) {
            if (active) {
                setPartFlash(0x6dff9a, 0x163d18);
            } else {
                restorePartColors();
            }
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

        function setRevealGhostState(visible, opacity) {
            if (!revealGhost) return;
            revealGhost.visible = !!visible && alive;
            if (!revealGhost.visible) return;
            var nextOpacity = (typeof opacity === 'number' && isFinite(opacity)) ? opacity : revealState.baseOpacity;
            for (var i = 0; i < revealState.materials.length; i++) {
                revealState.materials[i].opacity = nextOpacity;
            }
        }

        function destroy() {
            if (root && root.parent) root.parent.remove(root);
            if (bodyHitbox && bodyHitbox.parent) bodyHitbox.parent.remove(bodyHitbox);
            if (headHitbox && headHitbox.parent) headHitbox.parent.remove(headHitbox);
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
            revealGhost: revealGhost,
            syncHitboxes: syncHitboxes,
            setPosition: setPosition,
            setYaw: setYaw,
            setWorldTransform: setWorldTransform,
            setAlive: setAlive,
            setHealFlash: setHealFlash,
            setDamageFlash: setDamageFlash,
            setSpawnShield: setSpawnShield,
            setRevealGhostState: setRevealGhostState,
            setHitboxVisibility: setHitboxVisibility,
            setWeapon: setWeapon,
            updateAnimation: updateAnimation,
            setMuzzleVisible: setMuzzleVisible,
            triggerAction: triggerAction,
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
