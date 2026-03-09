/**
 * actor-visual-factory.js - Shared avatar + hitbox creation for player/enemy/remote actors.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameActorVisualFactory
 */
(function () {
    'use strict';

    var GameActorVisualFactory = {};
    var entityPoints = (globalThis.__MAYHEM_RUNTIME.GameShared && globalThis.__MAYHEM_RUNTIME.GameShared.entityPoints) || {};

    function createFallbackVisual(bodyColor, skinColor, legColor) {
        var group = new THREE.Group();
        var bodyMat = new THREE.MeshLambertMaterial({ color: bodyColor });
        var limbMat = new THREE.MeshLambertMaterial({ color: legColor });
        var skinMat = new THREE.MeshLambertMaterial({ color: skinColor });

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

        return group;
    }

    function createRevealGhost(visual) {
        var ghost = visual.clone(true);
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
            if (bodyHitbox) bodyHitbox.position.set(rootPosition.x, entityPoints.entityBodyHitboxY ? entityPoints.entityBodyHitboxY(rootPosition.y) : (rootPosition.y + 0.7625), rootPosition.z);
            if (headHitbox) headHitbox.position.set(rootPosition.x, entityPoints.entityHeadHitboxY ? entityPoints.entityHeadHitboxY(rootPosition.y) : (rootPosition.y + 2.0), rootPosition.z);
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
