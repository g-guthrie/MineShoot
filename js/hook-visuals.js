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
    var hookTmpStart = new THREE.Vector3();
    var hookTmpA = new THREE.Vector3();
    var hookTmpB = new THREE.Vector3();

    function createHookVisual() {
        if (!sceneRef) return null;

        var chainSegments = [];
        for (var i = 0; i < 9; i++) {
            var seg = new THREE.Mesh(
                new THREE.BoxGeometry(0.08, 0.08, 0.56),
                new THREE.MeshLambertMaterial({ color: 0xb7bcc4 })
            );
            seg.renderOrder = 55;
            seg.visible = false;
            sceneRef.add(seg);
            chainSegments.push(seg);
        }

        var head = new THREE.Mesh(
            new THREE.BoxGeometry(0.4, 0.28, 0.62),
            new THREE.MeshLambertMaterial({ color: 0x8a8f96 })
        );
        head.renderOrder = 56;
        head.visible = false;
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
        if (!visual.seeded) {
            visual.currentStart.copy(start);
            visual.currentEnd.copy(end);
            visual.seeded = true;
        } else {
            visual.currentStart.lerp(start, 0.38);
            visual.currentEnd.lerp(end, 0.32);
        }

        hookTmpA.copy(visual.currentEnd).sub(visual.currentStart);
        var len = hookTmpA.length();
        if (len <= 0.00001) {
            hideHookVisual(visual);
            return;
        }
        hookTmpA.normalize();

        var segmentCount = visual.chainSegments ? visual.chainSegments.length : 0;
        for (var i = 0; i < segmentCount; i++) {
            var seg = visual.chainSegments[i];
            var t = (i + 0.5) / segmentCount;
            hookTmpStart.copy(visual.currentStart).lerp(visual.currentEnd, t);
            seg.position.copy(hookTmpStart);
            seg.lookAt(hookTmpB.copy(hookTmpStart).add(hookTmpA));
            seg.visible = true;
        }

        visual.head.visible = true;
        visual.head.position.copy(visual.currentEnd);
        visual.head.lookAt(hookTmpB.copy(visual.currentEnd).add(hookTmpA));
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
            if (target && target.targetId === targetId && target.worldPos) return target.worldPos;
        }
        return null;
    }

    function netEntityCoreById(targetId) {
        if (!targetId || !runtime.GameNet || !runtime.GameNet.getEntityMarkerWorldPos) return null;
        return runtime.GameNet.getEntityMarkerWorldPos(targetId);
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
            multiplayerMode ? netEntityCoreById : localEnemyCoreByTargetId
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
                var end = hookVisualEndWorldPosition(hookState, netEntityCoreById);
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
