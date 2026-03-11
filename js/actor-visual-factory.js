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
        ghost.userData.baseColor = 0x65d8ff;
        return ghost;
    }

    function createChokeFx() {
        var group = new THREE.Group();
        var glowMat = new THREE.MeshBasicMaterial({
            color: 0xff6a7a,
            transparent: true,
            opacity: 0,
            depthWrite: false
        });
        var ringMat = new THREE.MeshBasicMaterial({
            color: 0xff8a96,
            transparent: true,
            opacity: 0,
            wireframe: true,
            depthWrite: false
        });

        var chestGlow = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 10), glowMat.clone());
        chestGlow.position.set(0, 1.1, 0);
        chestGlow.scale.set(1.0, 1.35, 0.9);
        group.add(chestGlow);

        var throatGlow = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), glowMat.clone());
        throatGlow.position.set(0, 1.5, 0.02);
        throatGlow.scale.set(0.9, 1.25, 0.9);
        group.add(throatGlow);

        var ringUpper = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.018, 5, 20), ringMat.clone());
        ringUpper.position.set(0, 1.48, 0.01);
        ringUpper.rotation.x = Math.PI * 0.5;
        group.add(ringUpper);

        var ringChest = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.015, 5, 22), ringMat.clone());
        ringChest.position.set(0, 1.08, 0);
        ringChest.rotation.x = Math.PI * 0.5;
        group.add(ringChest);

        var wisps = [];
        for (var i = 0; i < 3; i++) {
            var wisp = new THREE.Mesh(
                new THREE.SphereGeometry(0.045 + (i * 0.01), 6, 6),
                glowMat.clone()
            );
            group.add(wisp);
            wisps.push(wisp);
        }

        group.visible = false;
        group.userData.parts = {
            chestGlow: chestGlow,
            throatGlow: throatGlow,
            ringUpper: ringUpper,
            ringChest: ringChest,
            wisps: wisps
        };
        return group;
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
        var chokeFx = createChokeFx();
        root.add(chokeFx);
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

        function setChokeFxState(active, startedAt) {
            if (!chokeFx || !chokeFx.userData || !chokeFx.userData.parts) return;
            var parts = chokeFx.userData.parts;
            chokeFx.visible = !!active && alive;
            if (!chokeFx.visible) return;

            var stamp = Date.now();
            var phase = startedAt ? ((stamp - startedAt) * 0.014) : (stamp * 0.014);
            var pulse = 0.62 + (Math.sin(phase * 1.7) * 0.18);
            var ringPulse = 0.84 + (Math.sin(phase * 1.3) * 0.12);

            parts.chestGlow.material.opacity = 0.14 + (pulse * 0.12);
            parts.throatGlow.material.opacity = 0.18 + (pulse * 0.16);
            parts.chestGlow.scale.set(1.0 + (pulse * 0.08), 1.3 + (pulse * 0.12), 0.9 + (pulse * 0.08));
            parts.throatGlow.scale.set(0.88 + (pulse * 0.06), 1.2 + (pulse * 0.12), 0.88 + (pulse * 0.06));

            parts.ringUpper.material.opacity = 0.3 + (pulse * 0.18);
            parts.ringChest.material.opacity = 0.16 + (pulse * 0.12);
            parts.ringUpper.scale.set(ringPulse, ringPulse, 1);
            parts.ringChest.scale.set(0.92 + (pulse * 0.1), 0.92 + (pulse * 0.1), 1);
            parts.ringUpper.rotation.z = Math.sin(phase * 0.8) * 0.24;
            parts.ringChest.rotation.z = Math.cos(phase * 0.7) * 0.18;

            for (var i = 0; i < parts.wisps.length; i++) {
                var wisp = parts.wisps[i];
                var wispPhase = phase + (i * 2.1);
                var radius = 0.16 + (i * 0.04);
                wisp.position.set(
                    Math.cos(wispPhase) * radius,
                    1.18 + (i * 0.14) + Math.sin(wispPhase * 1.6) * 0.05,
                    Math.sin(wispPhase) * radius * 0.6
                );
                wisp.material.opacity = 0.12 + (0.08 * (1 + Math.sin(wispPhase * 2.0)));
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
            setChokeFxState(!!(animState && animState.choked), Number(animState && animState.startedAt || 0));
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
            chokeFx: chokeFx,
            syncHitboxes: syncHitboxes,
            setPosition: setPosition,
            setYaw: setYaw,
            setWorldTransform: setWorldTransform,
            setAlive: setAlive,
            setHealFlash: setHealFlash,
            setDamageFlash: setDamageFlash,
            setSpawnShield: setSpawnShield,
            setRevealGhostState: setRevealGhostState,
            setChokeFxState: setChokeFxState,
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
