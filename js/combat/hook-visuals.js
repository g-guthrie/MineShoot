/**
 * hook-visuals.js - Runtime hook chain visuals for local and networked gameplay.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameHookVisuals
 */
(function () {
    'use strict';

    var runtime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    var GameHookVisuals = {};

    var sceneRef = null;
    var selfHookVisual = null;
    var remoteHookVisuals = new Map();
    var hookTmpPos = new THREE.Vector3();
    var hookTmpDir = new THREE.Vector3();
    var hookTmpLook = new THREE.Vector3();
    var hookSelfStart = new THREE.Vector3();
    var hookSelfEnd = new THREE.Vector3();
    var hookRemoteStart = new THREE.Vector3();
    var hookRemoteEnd = new THREE.Vector3();
    var hookTargetScratch = new THREE.Vector3();

    function netView() {
        var net = runtime.GameNet || null;
        return net && net.view ? net.view : net;
    }

    function createChainSegment(index) {
        var seg = new THREE.Mesh(
            new THREE.BoxGeometry(0.075, 0.075, 1),
            new THREE.MeshLambertMaterial({ color: index % 2 === 0 ? 0xc9d1d9 : 0x909aa6 })
        );
        seg.renderOrder = 55;
        seg.visible = false;
        seg.scale.z = 0.3;
        return seg;
    }

    function createHookHead() {
        var head = new THREE.Group();
        var bodyMat = new THREE.MeshLambertMaterial({ color: 0x6e7884 });
        var tipMat = new THREE.MeshLambertMaterial({ color: 0xe8b96f });
        var prongMat = new THREE.MeshLambertMaterial({ color: 0xaeb7c0 });

        var shaft = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, 0.48), bodyMat);
        head.add(shaft);

        var collar = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.08), bodyMat);
        collar.position.z = -0.18;
        head.add(collar);

        var tip = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.2, 5), tipMat);
        tip.rotation.x = Math.PI * 0.5;
        tip.position.z = 0.34;
        head.add(tip);

        for (var i = 0; i < 2; i++) {
            var prong = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.24), prongMat);
            prong.position.set(i === 0 ? -0.1 : 0.1, 0, 0.16);
            prong.rotation.y = i === 0 ? -0.78 : 0.78;
            head.add(prong);
        }

        head.renderOrder = 56;
        head.visible = false;
        return head;
    }

    function createHookVisual() {
        if (!sceneRef) return null;
        var chainSegments = [];
        for (var i = 0; i < 12; i++) {
            var seg = createChainSegment(i);
            sceneRef.add(seg);
            chainSegments.push(seg);
        }
        var head = createHookHead();
        sceneRef.add(head);
        return {
            chainSegments: chainSegments,
            head: head,
            currentStart: new THREE.Vector3(),
            currentEnd: new THREE.Vector3(),
            seeded: false
        };
    }

    function hideHookVisual(visual) {
        if (!visual) return;
        if (visual.chainSegments) {
            for (var i = 0; i < visual.chainSegments.length; i++) {
                visual.chainSegments[i].visible = false;
            }
        }
        if (visual.head) visual.head.visible = false;
        visual.seeded = false;
    }

    function disposeRenderable(node, disposedGeometries, disposedMaterials) {
        if (!node) return;
        if (node.parent) node.parent.remove(node);
        if (node.traverse) {
            node.traverse(function (child) {
                if (child && child.geometry && disposedGeometries.indexOf(child.geometry) === -1) {
                    disposedGeometries.push(child.geometry);
                    child.geometry.dispose();
                }
                var materials = child && child.material
                    ? (Array.isArray(child.material) ? child.material : [child.material])
                    : [];
                for (var i = 0; i < materials.length; i++) {
                    var material = materials[i];
                    if (material && disposedMaterials.indexOf(material) === -1) {
                        disposedMaterials.push(material);
                        material.dispose();
                    }
                }
            });
            return;
        }
        if (node.geometry && disposedGeometries.indexOf(node.geometry) === -1) {
            disposedGeometries.push(node.geometry);
            node.geometry.dispose();
        }
        var mats = node.material ? (Array.isArray(node.material) ? node.material : [node.material]) : [];
        for (var mi = 0; mi < mats.length; mi++) {
            if (mats[mi] && disposedMaterials.indexOf(mats[mi]) === -1) {
                disposedMaterials.push(mats[mi]);
                mats[mi].dispose();
            }
        }
    }

    function disposeHookVisual(visual) {
        if (!visual) return;
        var disposedGeometries = [];
        var disposedMaterials = [];
        if (visual.chainSegments) {
            for (var i = 0; i < visual.chainSegments.length; i++) {
                disposeRenderable(visual.chainSegments[i], disposedGeometries, disposedMaterials);
            }
        }
        disposeRenderable(visual.head, disposedGeometries, disposedMaterials);
    }

    function clearAllVisuals() {
        disposeHookVisual(selfHookVisual);
        selfHookVisual = null;
        remoteHookVisuals.forEach(function (visual) {
            disposeHookVisual(visual);
        });
        remoteHookVisuals.clear();
    }

    function setHookVisual(visual, start, end) {
        if (!visual || !start || !end) {
            hideHookVisual(visual);
            return;
        }

        visual.currentStart.copy(start);
        visual.currentEnd.copy(end);
        visual.seeded = true;

        hookTmpDir.copy(visual.currentEnd).sub(visual.currentStart);
        var len = hookTmpDir.length();
        if (len <= 0.00001) {
            hideHookVisual(visual);
            return;
        }
        hookTmpDir.normalize();

        var segmentCount = visual.chainSegments ? visual.chainSegments.length : 0;
        var segmentSpacing = len / Math.max(1, segmentCount);
        var segmentLength = Math.max(0.18, segmentSpacing * 0.82);
        for (var i = 0; i < segmentCount; i++) {
            var seg = visual.chainSegments[i];
            var t = (i + 0.5) / segmentCount;
            hookTmpPos.copy(visual.currentStart).lerp(visual.currentEnd, t);
            seg.position.copy(hookTmpPos);
            seg.lookAt(hookTmpLook.copy(hookTmpPos).add(hookTmpDir));
            seg.scale.z = segmentLength;
            seg.scale.x = 1 + ((i % 2 === 0) ? 0.04 : -0.04);
            seg.scale.y = 1 + ((i % 2 === 0) ? -0.04 : 0.04);
            seg.visible = true;
        }

        visual.head.visible = true;
        visual.head.position.copy(visual.currentEnd);
        visual.head.lookAt(hookTmpLook.copy(visual.currentEnd).add(hookTmpDir));
    }

    function ensureSelfHookVisual() {
        if (selfHookVisual) return selfHookVisual;
        selfHookVisual = createHookVisual();
        return selfHookVisual;
    }

    function ensureRemoteHookVisual(entityId) {
        var existing = remoteHookVisuals.get(entityId);
        if (existing) return existing;
        existing = createHookVisual();
        if (existing) remoteHookVisuals.set(entityId, existing);
        return existing;
    }

    function destroyRemoteHookVisual(entityId) {
        var existing = remoteHookVisuals.get(entityId);
        if (!existing) return;
        disposeHookVisual(existing);
        remoteHookVisuals.delete(entityId);
    }

    function playerCoreWorldPosition(out) {
        if (runtime.GamePlayer && runtime.GamePlayer.getCoreWorldPosition) {
            var core = runtime.GamePlayer.getCoreWorldPosition(out);
            if (core) return out.copy(core);
        }
        return null;
    }

    function playerHookOriginWorldPosition(out) {
        if (runtime.GamePlayer && runtime.GamePlayer.getThrowableOriginWorldPosition) {
            var origin = runtime.GamePlayer.getThrowableOriginWorldPosition(out);
            if (origin) return out.copy(origin);
        }
        return playerCoreWorldPosition(out);
    }

    function localEnemyCoreByTargetId(targetId, out) {
        if (!targetId || !runtime.GameEnemy || !runtime.GameEnemy.getLockTargets) return null;
        var targets = runtime.GameEnemy.getLockTargets() || [];
        for (var i = 0; i < targets.length; i++) {
            var target = targets[i];
            if (target && String(target.targetId || '') === String(targetId) && target.worldPos) {
                return out.copy(target.worldPos);
            }
        }
        return null;
    }

    function netEntityHookAttachById(targetId, out) {
        if (!targetId) return null;
        if (runtime.GameNetEntities && runtime.GameNetEntities.getCoreWorldPosition) {
            var core = runtime.GameNetEntities.getCoreWorldPosition(targetId, out);
            if (core) return out.copy(core);
        }
        var netApi = netView();
        if (netApi && netApi.getEntityMarkerWorldPos) {
            var marker = netApi.getEntityMarkerWorldPos(targetId);
            if (marker) return out.copy(marker);
        }
        return null;
    }

    function hookVisualEndWorldPosition(state, resolveTargetPosition, out) {
        var abilityFxView = runtime.GameAbilityFx || null;
        var resolved = abilityFxView && abilityFxView.resolveHookVisualEnd
            ? abilityFxView.resolveHookVisualEnd(state, function (targetId) {
                return resolveTargetPosition(targetId, hookTargetScratch);
            }, out)
            : null;
        if (!resolved) return null;
        if (resolved === out) return out;
        return out.set(Number(resolved.x || 0), Number(resolved.y || 0), Number(resolved.z || 0));
    }

    function renderSelf(multiplayerMode) {
        var selfState = null;
        var netApi = netView();
        if (multiplayerMode && netApi && netApi.getSelfAbilityState) {
            var netAbility = netApi.getSelfAbilityState();
            selfState = netAbility ? netAbility.hookState : null;
        } else if (runtime.GameAbilities && runtime.GameAbilities.getHookState) {
            selfState = runtime.GameAbilities.getHookState();
        }

        var selfVisual = ensureSelfHookVisual();
        if (!selfVisual) return;
        if (!selfState) {
            hideHookVisual(selfVisual);
            return;
        }

        var selfStart = playerHookOriginWorldPosition(hookSelfStart);
        var selfEnd = hookVisualEndWorldPosition(
            selfState,
            multiplayerMode ? netEntityHookAttachById : localEnemyCoreByTargetId,
            hookSelfEnd
        );
        setHookVisual(selfVisual, selfStart, selfEnd);
    }

    function renderRemote() {
        var activeRemote = {};
        if (runtime.GameNetEntities && runtime.GameNetEntities.getRenderMap) {
            var renderMap = runtime.GameNetEntities.getRenderMap();
            renderMap.forEach(function (render, entityId) {
                var hookState = render && render.hookState ? render.hookState : null;
                if (!hookState) return;
                var start = runtime.GameNetEntities.getHookOriginWorldPosition
                    ? runtime.GameNetEntities.getHookOriginWorldPosition(entityId, hookRemoteStart)
                    : hookRemoteStart.set(
                        Number(render.group && render.group.position && render.group.position.x || 0),
                        Number(render.group && render.group.position && render.group.position.y || 0) + 1.0,
                        Number(render.group && render.group.position && render.group.position.z || 0)
                    );
                var end = hookVisualEndWorldPosition(hookState, netEntityHookAttachById, hookRemoteEnd);
                var visual = ensureRemoteHookVisual(entityId);
                if (!visual) return;
                setHookVisual(visual, start, end);
                activeRemote[entityId] = true;
            });
        }
        remoteHookVisuals.forEach(function (_visual, entityId) {
            if (!activeRemote[entityId]) destroyRemoteHookVisual(entityId);
        });
    }

    GameHookVisuals.init = function (scene) {
        clearAllVisuals();
        sceneRef = scene || null;
    };

    GameHookVisuals.render = function (multiplayerMode) {
        if (!sceneRef) return;
        renderSelf(!!multiplayerMode);
        if (!!multiplayerMode) {
            renderRemote();
            return;
        }
        remoteHookVisuals.forEach(function (_visual, entityId) {
            destroyRemoteHookVisual(entityId);
        });
    };

    runtime.GameHookVisuals = GameHookVisuals;
})();
