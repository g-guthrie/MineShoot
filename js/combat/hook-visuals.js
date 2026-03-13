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
        remoteHookVisuals.set(entityId, existing);
        return existing;
    }

    function playerCoreWorldPosition() {
        if (runtime.GamePlayer && runtime.GamePlayer.getCoreWorldPosition) {
            return runtime.GamePlayer.getCoreWorldPosition();
        }
        return null;
    }

    function playerHookOriginWorldPosition() {
        if (runtime.GamePlayer && runtime.GamePlayer.getThrowableOriginWorldPosition) {
            return runtime.GamePlayer.getThrowableOriginWorldPosition();
        }
        return playerCoreWorldPosition();
    }

    function localEnemyCoreByTargetId(targetId) {
        if (!targetId || !runtime.GameEnemy || !runtime.GameEnemy.getLockTargets) return null;
        var targets = runtime.GameEnemy.getLockTargets() || [];
        for (var i = 0; i < targets.length; i++) {
            var target = targets[i];
            if (target && String(target.targetId || '') === String(targetId) && target.worldPos) return target.worldPos;
        }
        return null;
    }

    function netEntityHookAttachById(targetId) {
        if (!targetId) return null;
        if (runtime.GameNetEntities && runtime.GameNetEntities.getCoreWorldPosition) {
            var core = runtime.GameNetEntities.getCoreWorldPosition(targetId, new THREE.Vector3());
            if (core) return core;
        }
        if (runtime.GameNet && runtime.GameNet.getEntityMarkerWorldPos) {
            return runtime.GameNet.getEntityMarkerWorldPos(targetId);
        }
        return null;
    }

    function hookVisualEndWorldPosition(state, resolveTargetPosition) {
        var abilityFxView = runtime.GameAbilityFx || null;
        var resolved = abilityFxView && abilityFxView.resolveHookVisualEnd
            ? abilityFxView.resolveHookVisualEnd(state, resolveTargetPosition)
            : null;
        if (!resolved) return null;
        return new THREE.Vector3(Number(resolved.x || 0), Number(resolved.y || 0), Number(resolved.z || 0));
    }

    function renderSelf(multiplayerMode) {
        var selfState = null;
        if (multiplayerMode && runtime.GameNet && runtime.GameNet.getSelfAbilityState) {
            var netAbility = runtime.GameNet.getSelfAbilityState();
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

        var selfStart = playerHookOriginWorldPosition();
        var selfEnd = hookVisualEndWorldPosition(
            selfState,
            multiplayerMode ? netEntityHookAttachById : localEnemyCoreByTargetId
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
                    ? runtime.GameNetEntities.getHookOriginWorldPosition(entityId, new THREE.Vector3())
                    : new THREE.Vector3(render.group.position.x, render.group.position.y + 1.0, render.group.position.z);
                var end = hookVisualEndWorldPosition(hookState, netEntityHookAttachById);
                var visual = ensureRemoteHookVisual(entityId);
                setHookVisual(visual, start, end);
                activeRemote[entityId] = true;
            });
        }
        remoteHookVisuals.forEach(function (visual, entityId) {
            if (!activeRemote[entityId]) hideHookVisual(visual);
        });
    }

    GameHookVisuals.init = function (scene) {
        sceneRef = scene || null;
    };

    GameHookVisuals.render = function (multiplayerMode) {
        if (!sceneRef) return;
        renderSelf(!!multiplayerMode);
        if (!!multiplayerMode) {
            renderRemote();
            return;
        }
        remoteHookVisuals.forEach(function (visual) {
            hideHookVisual(visual);
        });
    };

    runtime.GameHookVisuals = GameHookVisuals;
})();
