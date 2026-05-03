/**
 * runtime-match-actions.js - Gameplay runtime action owner.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameRuntimeMatchActions
 */
(function () {
    'use strict';

    var runtime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    var GameRuntimeMatchActions = {};

    GameRuntimeMatchActions.create = function (opts) {
        opts = opts || {};

        var SPRINT_FIRE_RAISE_DELAY_MIN_MS = 90;
        var SPRINT_FIRE_RAISE_DELAY_MAX_MS = 145;
        var STOP_RECOVERY_FIRE_DELAY_MIN_MS = 70;
        var STOP_RECOVERY_FIRE_DELAY_MAX_MS = 120;
        var debugVisualsOn = false;
        var netShotCounter = 0;
        var firePoseRetryTimer = 0;
        var worldCollisionDebugRoot = null;

        function gameUiApi() {
            return opts.getGameUiApi ? opts.getGameUiApi() : null;
        }

        function gamePlayerApi() {
            return opts.getGamePlayerApi ? opts.getGamePlayerApi() : null;
        }

        function gameEnemyApi() {
            return opts.getGameEnemyApi ? opts.getGameEnemyApi() : null;
        }

        function gameHitscanApi() {
            return opts.getGameHitscanApi ? opts.getGameHitscanApi() : null;
        }

        function gameAudioApi() {
            return opts.getGameAudioApi ? opts.getGameAudioApi() : null;
        }

        function gameDocsApi() {
            return opts.getGameDocsApi ? opts.getGameDocsApi() : null;
        }

        function gameThrowablesApi() {
            return opts.getGameThrowablesApi ? opts.getGameThrowablesApi() : null;
        }

        function gameOverheadApi() {
            return opts.getGameOverheadApi ? opts.getGameOverheadApi() : null;
        }

        function gameNetApi() {
            return opts.getGameNetApi ? opts.getGameNetApi() : null;
        }

        function gameNetFeedbackSyncApi() {
            return opts.getGameNetFeedbackSyncApi ? opts.getGameNetFeedbackSyncApi() : null;
        }

        function currentMatchViewApi() {
            return opts.getCurrentMatchViewApi ? opts.getCurrentMatchViewApi() : null;
        }

        function currentSelfCombatApi() {
            return opts.getCurrentSelfCombatApi ? opts.getCurrentSelfCombatApi() : null;
        }

        function scheduleFirePoseRetry(delayMs, retryOptions) {
            if (firePoseRetryTimer) return true;
            if (typeof setTimeout !== 'function') return false;
            firePoseRetryTimer = setTimeout(function () {
                firePoseRetryTimer = 0;
                tryPlayerFire(retryOptions || null);
            }, Math.max(1, Number(delayMs || 0)));
            return true;
        }

        function currentMatchCommandApi() {
            return opts.getCurrentMatchCommandApi ? opts.getCurrentMatchCommandApi() : null;
        }

        function currentMatchRemoteEntitiesApi() {
            return opts.getCurrentMatchRemoteEntitiesApi ? opts.getCurrentMatchRemoteEntitiesApi() : null;
        }

        function loadoutStateApi() {
            return opts.getLoadoutStateApi ? opts.getLoadoutStateApi() : null;
        }

        function loadoutRuntimeApi() {
            return opts.getLoadoutRuntimeApi ? opts.getLoadoutRuntimeApi() : null;
        }

        function camera() {
            return opts.getCamera ? opts.getCamera() : null;
        }

        function scene() {
            return opts.getScene ? opts.getScene() : null;
        }

        function multiplayerMode() {
            return !!(opts.isMultiplayerMode && opts.isMultiplayerMode());
        }

        function hasInputCapture() {
            return !!(opts.hasInputCapture && opts.hasInputCapture());
        }

        function setTransientDebug(text, ms) {
            if (opts.setTransientDebug) opts.setTransientDebug(text, ms);
        }

        function notifyDebugVisualChange() {
            if (opts.onDebugVisualsChanged) opts.onDebugVisualsChanged(debugVisualsOn);
        }

        function clearWorldCollisionDebug() {
            if (worldCollisionDebugRoot && worldCollisionDebugRoot.parent) {
                worldCollisionDebugRoot.parent.remove(worldCollisionDebugRoot);
            }
            worldCollisionDebugRoot = null;
        }

        function ensureWorldCollisionDebug() {
            if (worldCollisionDebugRoot) return worldCollisionDebugRoot;
            var runtimeWorld = runtime.GameWorld || null;
            var sceneRef = scene();
            var THREE = globalThis.THREE;
            if (!runtimeWorld || !runtimeWorld.getCollidables || !sceneRef || !THREE) return null;

            var collidables = runtimeWorld.getCollidables() || [];
            var root = new THREE.Group();
            root.name = 'world-collision-debug';

            var lineMaterial = new THREE.LineBasicMaterial({
                color: 0x57e3ff,
                transparent: true,
                opacity: 0.38,
                depthWrite: false
            });

            for (var i = 0; i < collidables.length; i++) {
                var mesh = collidables[i];
                if (!mesh || !mesh.userData || !mesh.userData.collisionBox) continue;
                var box = mesh.userData.collisionBox;
                var size = new THREE.Vector3();
                var center = new THREE.Vector3();
                box.getSize(size);
                box.getCenter(center);
                if (!(size.x > 0 && size.y > 0 && size.z > 0)) continue;

                var helper = new THREE.LineSegments(
                    new THREE.EdgesGeometry(new THREE.BoxGeometry(size.x, size.y, size.z)),
                    lineMaterial
                );
                helper.position.copy(center);
                helper.renderOrder = 998;
                helper.frustumCulled = false;
                root.add(helper);
            }

            sceneRef.add(root);
            worldCollisionDebugRoot = root;
            return root;
        }

        function setWorldCollisionDebugVisibility(visible) {
            if (!visible) {
                clearWorldCollisionDebug();
                return;
            }
            var root = ensureWorldCollisionDebug();
            if (root) root.visible = true;
        }

        function isLocalActionLocked() {
            var playerApi = gamePlayerApi();
            return !!(playerApi && playerApi.isActionLocked && playerApi.isActionLocked());
        }

        function canUseLocalAction(actionType) {
            var player = gamePlayerApi();
            if (!player) return !isLocalActionLocked();
            if (actionType === 'weapon' && player.canUseWeapon) return !!player.canUseWeapon();
            if (actionType === 'throwable' && player.canUseThrowable) return !!player.canUseThrowable();
            return !isLocalActionLocked();
        }

        function applyDebugVisuals(visible) {
            debugVisualsOn = !!visible;
            notifyDebugVisualChange();

            var uiApi = gameUiApi();
            if (uiApi && uiApi.setDebugVisuals) {
                uiApi.setDebugVisuals(!!visible);
            }

            var enemyApi = gameEnemyApi();
            if (enemyApi) {
                if (enemyApi.setHitboxVisibility) {
                    enemyApi.setHitboxVisibility(!!visible);
                } else if (enemyApi.isHitboxVisible && enemyApi.toggleHitboxVisibility) {
                    if (enemyApi.isHitboxVisible() !== !!visible) {
                        enemyApi.toggleHitboxVisibility();
                    }
                }
            }

            var remoteApi = currentMatchRemoteEntitiesApi();
            if (remoteApi && remoteApi.setHitboxVisibility) {
                remoteApi.setHitboxVisibility(!!visible);
            }

            var playerApi = gamePlayerApi();
            if (playerApi && playerApi.setHitboxVisibility) {
                playerApi.setHitboxVisibility(!!visible);
            }

            setWorldCollisionDebugVisibility(!!visible);

            var throwablesApi = gameThrowablesApi();
            if (throwablesApi && throwablesApi.setDebugMode) {
                throwablesApi.setDebugMode(!!visible);
            }
        }

        function toggleDebugVisuals() {
            applyDebugVisuals(!debugVisualsOn);
            return debugVisualsOn;
        }

        function syncReticleWithWeapon(weapon) {
            if (!weapon) return;
            var playerApi = gamePlayerApi();
            var uiApi = gameUiApi();
            var hitscanApi = gameHitscanApi();
            var adsState = null;
            if (playerApi && playerApi.getAdsState) {
                adsState = playerApi.getAdsState();
            }
            if (!uiApi || !hitscanApi || !uiApi.updateReticle || !hitscanApi.getReticleSpec) return;
            uiApi.updateReticle(
                weapon,
                hitscanApi.getReticleSpec(weapon.id),
                adsState
            );
        }

        function applyWeapon(weapon) {
            if (!weapon) return;
            var uiApi = gameUiApi();
            var playerApi = gamePlayerApi();
            var docsApi = gameDocsApi();
            if (uiApi && uiApi.updateWeaponInfo) {
                uiApi.updateWeaponInfo(weapon);
            }
            if (playerApi && playerApi.setWeaponModel) {
                playerApi.setWeaponModel(weapon.id);
            }
            syncReticleWithWeapon(weapon);
            var netCommands = currentMatchCommandApi();
            if (multiplayerMode() && netCommands && netCommands.sendEquipWeapon) {
                netCommands.sendEquipWeapon(weapon.id);
            }
            if (docsApi && docsApi.refresh) {
                docsApi.refresh();
            }
            setTransientDebug('Weapon: ' + weapon.name, 950);
        }

        function syncCommittedLoadoutToRuntime() {
            var loadoutRuntime = loadoutRuntimeApi();
            if (loadoutRuntime && loadoutRuntime.applyCommittedLoadout) {
                var committed = loadoutRuntime.applyCommittedLoadout(multiplayerMode());
                return committed && Array.isArray(committed.weaponSlots)
                    ? committed.weaponSlots.slice(0, 2)
                    : [];
            }
            return [];
        }

        function validateLoadoutSelections() {
            var loadoutState = loadoutStateApi();
            return loadoutState && loadoutState.validateSelections
                ? loadoutState.validateSelections()
                : { ok: false, message: 'Loadout state unavailable.' };
        }

        function handleEnemyHit(hitPoint, damage, hitType, result, targetId) {
            if (!result) return;
            var overhead = gameOverheadApi();
            var hitscanApi = gameHitscanApi();
            var audioApi = gameAudioApi();
            var uiApi = gameUiApi();
            var currentCamera = camera();
            var resolvedTargetId = String(targetId || '');
            if (!resolvedTargetId && result.enemy && Number.isFinite(Number(result.enemy.index))) {
                resolvedTargetId = 'enemy:' + String(result.enemy.index);
            }
            if (resolvedTargetId && overhead && overhead.revealTarget) {
                overhead.revealTarget(resolvedTargetId, 1500);
            }
            var currentWeapon = hitscanApi && hitscanApi.getCurrentWeapon
                ? hitscanApi.getCurrentWeapon()
                : null;
            var isShotgun = !!(currentWeapon && currentWeapon.id === 'shotgun');
            var damageNumberSpread = isShotgun ? { spreadX: 152, spreadY: 72 } : undefined;
            if (audioApi && audioApi.play) {
                audioApi.play('bulletImpact', {
                    killed: !!result.killed,
                    hitType: hitType,
                    weapon: currentWeapon && currentWeapon.id ? currentWeapon.id : ''
                });
            }
            if (!uiApi) return;
            if (result.killed) {
                if (uiApi.showKillMarker) uiApi.showKillMarker();
                if (uiApi.showDamageNumber) uiApi.showDamageNumber(hitPoint, damage, true, currentCamera, hitType, damageNumberSpread);
            } else {
                if (uiApi.showHitMarker) uiApi.showHitMarker();
                if (uiApi.showDamageNumber) uiApi.showDamageNumber(hitPoint, damage, false, currentCamera, hitType, damageNumberSpread);
            }
        }

        function tryPlayerFire(options) {
            options = options || {};
            if (!canUseLocalAction('weapon')) return;
            var player = gamePlayerApi();
            if (player && player.isRolling && player.isRolling()) return;
            var netView = currentMatchViewApi();
            var netCommands = currentMatchCommandApi();
            var selfCombat = currentSelfCombatApi();
            var hitscanApi = gameHitscanApi();
            var netApi = gameNetApi();
            var feedbackApi = gameNetFeedbackSyncApi();
            var enemyApi = gameEnemyApi();
            var audioApi = gameAudioApi();
            var currentCamera = camera();
            var currentWeapon = hitscanApi && hitscanApi.getCurrentWeapon ? hitscanApi.getCurrentWeapon() : null;
            var fireSprintCancelMs = Math.max(
                220,
                Math.min(420, Number(currentWeapon && currentWeapon.cooldownMs || 0) * 0.85 || 320)
            );
            if (multiplayerMode()) {
                if (selfCombat && selfCombat.canUseGameplayActions && !selfCombat.canUseGameplayActions()) return;
                if (!selfCombat && netView) {
                    var selfState = netView.getAuthoritativeSelfState ? netView.getAuthoritativeSelfState() : null;
                    var respawnState = netView.getRespawnState ? netView.getRespawnState() : null;
                    if ((selfState && selfState.alive === false) || (respawnState && respawnState.active)) return;
                }
            }
            var sprintRequested = !!(player && player.getNetworkInputState && player.getNetworkInputState().sprint);
            var sprintKeyHeld = !!(player && player.isSprintKeyHeld && player.isSprintKeyHeld());
            var sprinting = !!(player && player.isSprinting && player.isSprinting());
            var sprintPoseActive = !!(sprintRequested || sprinting);
            if ((sprintRequested || sprintKeyHeld || sprinting) &&
                (!player || !(
                    (player.cancelSprintTemporarily && player.cancelSprintTemporarily(fireSprintCancelMs)) ||
                    (player.cancelSprintUntilRelease && player.cancelSprintUntilRelease())
                ))) {
                return;
            }
            if (sprintPoseActive && !options.fromSprintRaiseDelay) {
                var raiseDelayMs = Math.max(
                    SPRINT_FIRE_RAISE_DELAY_MIN_MS,
                    Math.min(SPRINT_FIRE_RAISE_DELAY_MAX_MS, fireSprintCancelMs * 0.42)
                );
                if (scheduleFirePoseRetry(raiseDelayMs, { fromSprintRaiseDelay: true })) return;
            }
            if (player && player.prepareWeaponFire && !options.fromStopRecoveryDelay) {
                var canceledStopRecovery = !!player.prepareWeaponFire();
                if (canceledStopRecovery) {
                    var stopRecoveryDelayMs = Math.max(
                        STOP_RECOVERY_FIRE_DELAY_MIN_MS,
                        Math.min(STOP_RECOVERY_FIRE_DELAY_MAX_MS, fireSprintCancelMs * 0.28)
                    );
                    if (scheduleFirePoseRetry(stopRecoveryDelayMs, { fromStopRecoveryDelay: true })) return;
                }
            }
            netShotCounter = (netShotCounter + 1) % 1000000;
            var shotToken = 's' + Date.now().toString(36) + '-' + netShotCounter.toString(36);
            if (!hitscanApi || !hitscanApi.fire) return;
            var shotSample = hitscanApi.captureShotSample
                ? hitscanApi.captureShotSample(currentCamera, shotToken)
                : null;
            var fired = hitscanApi.fire(
                currentCamera,
                function (hitboxMesh, hitPoint, distance, hitType, damage, weapon, pelletIndex) {
                    if (multiplayerMode() && hitboxMesh && hitboxMesh.userData && hitboxMesh.userData.ownerType === 'net') {
                        var canPredictNetworkHit = !!(netApi && netApi.isConnected && netApi.isConnected());
                        var shouldPredictNetHit = canPredictNetworkHit && (!hitscanApi.shouldPredictNetHit ||
                            hitscanApi.shouldPredictNetHit(currentCamera, hitboxMesh, shotToken, pelletIndex, shotSample));
                        if (shouldPredictNetHit && feedbackApi && feedbackApi.emitPredictedLocalDamageFeedback) {
                            feedbackApi.emitPredictedLocalDamageFeedback({
                                weaponId: weapon && weapon.id ? weapon.id : '',
                                hitType: hitType,
                                shotToken: shotToken,
                                pelletIndex: pelletIndex,
                                damage: damage,
                                worldPos: hitPoint,
                                camera: currentCamera,
                                killed: false
                            });
                        }
                        return;
                    }

                    if (!enemyApi || !enemyApi.damage) return;
                    var result = enemyApi.damage(hitboxMesh, damage);
                    var localTargetId = hitboxMesh && hitboxMesh.userData
                        ? String(hitboxMesh.userData.targetId || '')
                        : '';
                    handleEnemyHit(hitPoint, damage, hitType, result, localTargetId);
                },
                function () {},
                shotToken,
                shotSample
            );

            if (fired) {
                var activeWeapon = hitscanApi.getCurrentWeapon ? hitscanApi.getCurrentWeapon() : null;
                if (
                    multiplayerMode() &&
                    activeWeapon &&
                    netCommands &&
                    netCommands.sendFire
                ) {
                    netCommands.sendFire(activeWeapon.id, shotToken, shotSample);
                }

                if (player && player.triggerAction) {
                    player.triggerAction('fire');
                }
                if (audioApi && audioApi.play) {
                    var w = hitscanApi.getCurrentWeapon ? hitscanApi.getCurrentWeapon() : null;
                    if (document.hasFocus()) {
                        audioApi.play('fire', { weapon: w && w.id ? w.id : 'rifle' });
                    }
                }
            }
        }

        return {
            isDebugVisualsOn: function () { return !!debugVisualsOn; },
            canUseLocalAction: canUseLocalAction,
            applyDebugVisuals: applyDebugVisuals,
            toggleDebugVisuals: toggleDebugVisuals,
            clearWorldCollisionDebug: clearWorldCollisionDebug,
            syncReticleWithWeapon: syncReticleWithWeapon,
            applyWeapon: applyWeapon,
            syncCommittedLoadoutToRuntime: syncCommittedLoadoutToRuntime,
            validateLoadoutSelections: validateLoadoutSelections,
            handleEnemyHit: handleEnemyHit,
            tryPlayerFire: tryPlayerFire
        };
    };

    runtime.GameRuntimeMatchActions = GameRuntimeMatchActions;
})();
