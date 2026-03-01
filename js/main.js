/**
 * main.js - Game orchestration for single-player and Cloudflare multiplayer modes
 */
(function () {
    'use strict';

    var renderer, scene, clock, camera;
    var overlay;

    var isPlaying = false;
    var triggerHeld = false;

    var playerHP = 500;
    var playerMaxHP = 500;
    var playerArmor = 90;
    var playerArmorMax = 90;
    var armorRegenDelay = 0;

    var respawnInvulnTimer = 0;
    var debugTimer = null;

    var wallhackRing = null;
    var wallhackRingRadius = 0;
    var wallhackRingVisible = true;

    var DEFAULT_ENEMY_COUNT = 5;
    var DEFAULT_ARMOR_REGEN_DELAY = 6.0;
    var ARMOR_REGEN_PER_SEC = 12;

    var currentAimTargetId = '';
    var multiplayerMode = false;

    function cameraModeLabel(mode) {
        return mode === 'third' ? 'CAM: THIRD' : 'CAM: FIRST';
    }

    function setTransientDebug(text, ms) {
        window.GameUI.setDebugInfo(text || '');
        if (debugTimer) clearTimeout(debugTimer);
        if (!text) {
            debugTimer = null;
            return;
        }
        debugTimer = setTimeout(function () {
            window.GameUI.setDebugInfo('');
            debugTimer = null;
        }, ms || 1000);
    }

    function getCurrentWallhackRadius() {
        if (multiplayerMode && window.GameNet && window.GameNet.getSelfState) {
            var selfState = window.GameNet.getSelfState();
            if (selfState && typeof selfState.wallhackRadius === 'number') {
                return selfState.wallhackRadius;
            }
        }

        if (window.GameClasses && window.GameClasses.getWallhackRadius) {
            return window.GameClasses.getWallhackRadius();
        }

        if (window.GameEnemy && window.GameEnemy.getWallhackRadius) {
            return window.GameEnemy.getWallhackRadius();
        }

        return 90;
    }

    function rebuildWallhackRing(radius) {
        if (!scene) return;

        if (wallhackRing && wallhackRing.parent) {
            wallhackRing.parent.remove(wallhackRing);
        }

        wallhackRingRadius = radius;
        var points = [];
        var segments = 96;

        for (var i = 0; i < segments; i++) {
            var a = (i / segments) * Math.PI * 2;
            points.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
        }

        var geo = new THREE.BufferGeometry().setFromPoints(points);
        var mat = new THREE.LineBasicMaterial({
            color: 0x65d8ff,
            transparent: true,
            opacity: 0.7,
            depthTest: false
        });

        wallhackRing = new THREE.LineLoop(geo, mat);
        wallhackRing.renderOrder = 30;
        wallhackRing.visible = wallhackRingVisible;
        scene.add(wallhackRing);
    }

    function syncWallhackRingRadius() {
        var radius = getCurrentWallhackRadius();
        if (!wallhackRing || Math.abs(radius - wallhackRingRadius) > 0.01) {
            rebuildWallhackRing(radius);
        }
    }

    function applyDebugVisuals(visible) {
        wallhackRingVisible = !!visible;
        if (wallhackRing) wallhackRing.visible = wallhackRingVisible;

        if (window.GameEnemy) {
            if (window.GameEnemy.setHitboxVisibility) {
                window.GameEnemy.setHitboxVisibility(!!visible);
            } else if (window.GameEnemy.isHitboxVisible && window.GameEnemy.toggleHitboxVisibility) {
                if (window.GameEnemy.isHitboxVisible() !== !!visible) {
                    window.GameEnemy.toggleHitboxVisibility();
                }
            }
        }

        if (window.GameNet && window.GameNet.setHitboxVisibility) {
            window.GameNet.setHitboxVisibility(!!visible);
        }
    }

    function syncReticleWithWeapon(weapon) {
        if (!weapon) return;
        window.GameUI.updateReticle(weapon, window.GameHitscan.getReticleSpec(weapon.id));
    }

    function applyArmorProfile(armorMax) {
        armorMax = Math.max(1, armorMax || 100);
        playerArmorMax = armorMax;
        if (playerArmor > playerArmorMax) playerArmor = playerArmorMax;
        if (playerArmor < 0) playerArmor = 0;
        window.GameUI.updateArmor(playerArmor, playerArmorMax);
    }

    function applyWeapon(weapon) {
        if (!weapon) return;
        window.GameUI.updateWeaponInfo(weapon);
        window.GamePlayer.setWeaponModel(weapon.id);
        syncReticleWithWeapon(weapon);
        setTransientDebug('Weapon: ' + weapon.name, 950);
    }

    function applyClassImmediate(classId) {
        if (!window.GameClasses) return null;
        var selected = window.GameClasses.setClass(classId);
        if (!selected) return null;

        if (selected.loadoutWeapon) {
            applyWeapon(window.GameHitscan.setWeapon(selected.loadoutWeapon));
        }

        applyArmorProfile(selected.armorMax || playerArmorMax);
        window.GameUI.updateClassInfo(window.GameClasses.getHudState());
        syncWallhackRingRadius();

        return selected;
    }

    function queueClassChange(classId) {
        var queued = window.GameClasses.queueClass(classId);
        if (!queued) return;

        if (multiplayerMode && window.GameNet && window.GameNet.queueClassChange) {
            window.GameNet.queueClassChange(classId);
        }

        window.GameUI.updateClassInfo(window.GameClasses.getHudState());
        setTransientDebug('Queued class: ' + queued.name + ' (applies on death)', 1300);
    }

    function setupPerspectiveControls() {
        var btn = document.getElementById('camera-toggle');

        function syncButton() {
            if (!btn) return;
            btn.textContent = cameraModeLabel(window.GamePlayer.getPerspective());
        }

        function togglePerspective() {
            var mode = window.GamePlayer.togglePerspective();
            syncButton();
            syncReticleWithWeapon(window.GameHitscan.getCurrentWeapon());
            setTransientDebug(mode === 'third' ? 'Third-person camera' : 'First-person camera', 800);
        }

        if (btn) {
            btn.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                togglePerspective();
            });
        }

        document.addEventListener('keydown', function (e) {
            if (e.code === 'KeyC') togglePerspective();
        });

        syncButton();
    }

    function handleEnemyHit(hitPoint, damage, hitType, result) {
        if (!result) return;

        if (result.killed) {
            window.GameUI.showKillMarker();
            window.GameUI.addKill();
            window.GameUI.showDamageNumber(hitPoint, damage, true, camera, hitType);
        } else {
            window.GameUI.showHitMarker();
            window.GameUI.showDamageNumber(hitPoint, damage, false, camera, hitType);
        }
    }

    function consumePlayerDamage(rawDamage, hitType, attackerEnemy) {
        if (respawnInvulnTimer > 0 || !isPlaying) return;

        var damage = Math.max(1, Math.round(rawDamage));
        if (window.GameClasses && window.GameClasses.modifyIncomingDamage) {
            damage = window.GameClasses.modifyIncomingDamage(damage, hitType);
        }

        armorRegenDelay = DEFAULT_ARMOR_REGEN_DELAY;

        if (playerArmor > 0) {
            var absorbed = Math.min(playerArmor, damage);
            playerArmor -= absorbed;
            damage -= absorbed;
        }

        if (damage > 0) {
            playerHP -= damage;
        }

        if (attackerEnemy && attackerEnemy.group && attackerEnemy.group.position) {
            var playerPos = window.GamePlayer.getPosition();
            var rot = window.GamePlayer.getRotation();
            window.GameUI.showDirectionalDamage(
                attackerEnemy.group.position,
                playerPos,
                rot && typeof rot.yaw === 'number' ? rot.yaw : 0,
                rawDamage
            );
        }

        if (playerHP <= 0) {
            respawnPlayer();
            return;
        }

        window.GameUI.updateHealth(playerHP, playerMaxHP);
        window.GameUI.updateArmor(playerArmor, playerArmorMax);
    }

    function respawnPlayer() {
        if (!multiplayerMode) {
            var applied = window.GameClasses.applyQueuedClass();
            if (applied) {
                if (applied.loadoutWeapon) {
                    applyWeapon(window.GameHitscan.setWeapon(applied.loadoutWeapon));
                }
                applyArmorProfile(applied.armorMax || playerArmorMax);
            }
        }

        playerHP = playerMaxHP;
        if (!multiplayerMode) {
            playerArmor = playerArmorMax;
        }
        armorRegenDelay = 0;

        window.GameUI.updateHealth(playerHP, playerMaxHP);
        window.GameUI.updateArmor(playerArmor, playerArmorMax);

        if (!multiplayerMode) {
            window.GamePlayer.respawnRandom();
            respawnInvulnTimer = 1.0;
        }

        window.GameUI.updateDamageEffects(5);
        window.GameUI.updateClassInfo(window.GameClasses.getHudState());
        syncWallhackRingRadius();
    }

    function tryPlayerFire() {
        var fired = window.GameHitscan.fire(
            camera,
            function (hitboxMesh, hitPoint, distance, hitType, damage, weapon) {
                if (window.GameClasses && window.GameClasses.modifyOutgoingDamage) {
                    damage = window.GameClasses.modifyOutgoingDamage(damage, hitType, weapon ? weapon.id : '');
                }

                if (multiplayerMode && hitboxMesh && hitboxMesh.userData && hitboxMesh.userData.ownerType === 'net') {
                    if (window.GameNet && window.GameNet.sendFire) {
                        window.GameNet.sendFire(hitboxMesh, weapon ? weapon.id : 'rifle', hitType);
                        window.GameUI.showHitMarker();
                    }
                    return;
                }

                if (!window.GameEnemy || !window.GameEnemy.damage) return;
                var result = window.GameEnemy.damage(hitboxMesh, damage);
                handleEnemyHit(hitPoint, damage, hitType, result);
            },
            function () {}
        );

        if (fired) {
            window.GamePlayer.fireAnimation();
        }
    }

    function setupPointerLock() {
        overlay = document.getElementById('overlay');

        overlay.addEventListener('click', function () {
            renderer.domElement.requestPointerLock();
        });

        renderer.domElement.addEventListener('click', function () {
            if (!document.pointerLockElement) {
                renderer.domElement.requestPointerLock();
            }
        });

        document.addEventListener('pointerlockchange', function () {
            if (document.pointerLockElement === renderer.domElement) {
                overlay.style.display = 'none';
                isPlaying = true;
            } else {
                overlay.style.display = 'flex';
                isPlaying = false;
            }
        });
    }

    function setupShooting() {
        document.addEventListener('mousedown', function (e) {
            if (e.button !== 0) return;
            if (!document.pointerLockElement) return;
            triggerHeld = true;
            tryPlayerFire();
        });

        document.addEventListener('mouseup', function (e) {
            if (e.button !== 0) return;
            triggerHeld = false;
        });

        window.addEventListener('blur', function () {
            triggerHeld = false;
        });
    }

    function setupWeaponControls() {
        var weaponOrder = window.GameHitscan.getWeaponOrder();

        document.addEventListener('keydown', function (e) {
            if (e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'Digit3' || e.code === 'Digit4' || e.code === 'Digit5') {
                var idx = parseInt(e.code.replace('Digit', ''), 10) - 1;
                if (idx >= 0 && idx < weaponOrder.length) {
                    applyWeapon(window.GameHitscan.setWeapon(weaponOrder[idx]));
                }
            }
        });

        document.addEventListener('wheel', function (e) {
            if (!document.pointerLockElement) return;
            e.preventDefault();
            applyWeapon(window.GameHitscan.cycleWeapon(e.deltaY > 0 ? 1 : -1));
        }, { passive: false });
    }

    function tryThrow(type) {
        if (!document.pointerLockElement) return;

        if (multiplayerMode && window.GameNet && window.GameNet.sendThrow) {
            window.GameNet.sendThrow(type);
            setTransientDebug('Throw sent: ' + type, 650);
            return;
        }

        var outcome = window.GameThrowables.throw(type, camera);
        window.GameUI.updateThrowableInfo(outcome.state);
        if (!outcome.ok && outcome.reason === 'cooldown') {
            setTransientDebug(type + ' is recharging.', 600);
        }
    }

    function setupThrowableControls() {
        document.addEventListener('keydown', function (e) {
            switch (e.code) {
                case 'KeyG': tryThrow('frag'); break;
                case 'KeyV': tryThrow('seeker'); break;
                case 'KeyB': tryThrow('molotov'); break;
                case 'KeyQ': tryThrow('knife'); break;
            }
        });
    }

    function setupClassControls() {
        var classOrder = window.GameClasses.getOrder();
        var keyToClass = {
            Digit6: classOrder[0],
            Digit7: classOrder[1],
            Digit8: classOrder[2],
            Digit9: classOrder[3],
            Digit0: classOrder[4]
        };

        function triggerClassAbility(slot) {
            if (multiplayerMode) {
                setTransientDebug('Abilities are local-only right now in net mode.', 900);
                return;
            }

            if (!document.pointerLockElement) return;

            var playerPos = window.GamePlayer.getPosition();
            var rot = window.GamePlayer.getRotation();
            var outcome = window.GameClasses.triggerAbility(
                slot,
                camera,
                playerPos,
                rot,
                function (hitData) {
                    if (!hitData || !hitData.result) return;
                    handleEnemyHit(hitData.hitPoint, hitData.damage, hitData.hitType, hitData.result);
                },
                setTransientDebug
            );
            window.GameUI.updateClassInfo(window.GameClasses.getHudState());
            if (outcome && !outcome.ok && outcome.message) {
                setTransientDebug(outcome.message, 700);
            }
        }

        document.addEventListener('keydown', function (e) {
            if (keyToClass[e.code]) {
                queueClassChange(keyToClass[e.code]);
                return;
            }
            if (e.code === 'KeyE') {
                triggerClassAbility(1);
                return;
            }
            if (e.code === 'KeyR') {
                triggerClassAbility(2);
            }
        });
    }

    function setupDebugKeys() {
        document.addEventListener('keydown', function (e) {
            if (e.code !== 'KeyH') return;
            applyDebugVisuals(!wallhackRingVisible);
            setTransientDebug(wallhackRingVisible ? 'Dev visuals: ON' : 'Dev visuals: OFF', 1100);
        });
    }

    function initGame() {
        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        document.body.appendChild(renderer.domElement);

        scene = new THREE.Scene();
        clock = new THREE.Clock();

        window.GameWorld.create(scene);
        window.GameUI.init();
        window.GameOverhead.init();

        camera = window.GamePlayer.init(scene);

        multiplayerMode = !!(window.GameNet && window.GameNet.getCurrentUser && window.GameNet.getCurrentUser());

        if (multiplayerMode) {
            window.GameNet.init(scene);
        } else {
            var enemyCount = window.GameWorld.getRecommendedEnemyCount ? window.GameWorld.getRecommendedEnemyCount() : DEFAULT_ENEMY_COUNT;
            window.GameEnemy.init(scene, enemyCount);
            window.GameThrowables.init(scene);
            window.GameUI.updateThrowableInfo(window.GameThrowables.getState());
        }

        window.GameClasses.init(scene);

        var initialClass = window.GameClasses.getCurrentClass();
        if (multiplayerMode && window.GameNet && window.GameNet.getCurrentUser) {
            var netUser = window.GameNet.getCurrentUser();
            if (netUser && netUser.classId) {
                initialClass = { id: netUser.classId };
            }
        }
        applyClassImmediate(initialClass.id);

        playerHP = playerMaxHP;
        playerArmor = window.GameClasses.getArmorMax ? window.GameClasses.getArmorMax() : 90;
        applyArmorProfile(playerArmor);
        window.GameUI.updateHealth(playerHP, playerMaxHP);
        window.GameUI.updateClassInfo(window.GameClasses.getHudState());

        rebuildWallhackRing(getCurrentWallhackRadius());
        applyDebugVisuals(true);

        applyWeapon(window.GameHitscan.getCurrentWeapon());

        setupPointerLock();
        setupShooting();
        setupWeaponControls();
        setupThrowableControls();
        setupClassControls();
        setupPerspectiveControls();
        setupDebugKeys();

        window.addEventListener('resize', function () {
            renderer.setSize(window.innerWidth, window.innerHeight);
        });

        animate();
    }

    function animate() {
        requestAnimationFrame(animate);

        var dt = clock.getDelta();
        if (dt > 0.1) dt = 0.1;

        window.GamePlayer.update(dt);

        var currentWeapon = window.GameHitscan.getCurrentWeapon();
        if (currentWeapon && currentWeapon.id === 'shotgun') {
            syncReticleWithWeapon(currentWeapon);
        }

        if (triggerHeld && document.pointerLockElement && currentWeapon && currentWeapon.automatic) {
            tryPlayerFire();
        }

        if (respawnInvulnTimer > 0) {
            respawnInvulnTimer -= dt;
            if (respawnInvulnTimer < 0) respawnInvulnTimer = 0;
        }

        if (!multiplayerMode) {
            if (armorRegenDelay > 0) {
                armorRegenDelay -= dt;
                if (armorRegenDelay < 0) armorRegenDelay = 0;
            } else if (playerArmor < playerArmorMax) {
                playerArmor += ARMOR_REGEN_PER_SEC * dt;
                if (playerArmor > playerArmorMax) playerArmor = playerArmorMax;
            }
        }

        var playerPos = window.GamePlayer.getPosition();
        if (wallhackRing) {
            wallhackRing.position.set(playerPos.x, 0.06, playerPos.z);
        }

        if (multiplayerMode) {
            window.GameNet.update(dt, playerPos, window.GamePlayer.getRotation());
            var selfState = window.GameNet.getSelfState();
            if (selfState) {
                var currentClass = window.GameClasses.getCurrentClass();
                if (selfState.classId && (!currentClass || currentClass.id !== selfState.classId)) {
                    applyClassImmediate(selfState.classId);
                }
                if (selfState.queuedClassId) {
                    window.GameClasses.queueClass(selfState.queuedClassId);
                } else if (window.GameClasses.clearQueuedClass) {
                    window.GameClasses.clearQueuedClass();
                }

                playerHP = selfState.hp;
                playerMaxHP = selfState.hpMax;
                playerArmor = selfState.armor;
                playerArmorMax = selfState.armorMax;
                window.GameUI.updateHealth(playerHP, playerMaxHP);
                window.GameUI.updateArmor(playerArmor, playerArmorMax);
                syncWallhackRingRadius();
            }

            var notice = window.GameNet.consumeNotice();
            if (notice) setTransientDebug(notice, 900);
        } else {
            window.GameClasses.update(
                dt,
                camera,
                playerPos,
                window.GamePlayer.getRotation(),
                function (hitData) {
                    if (!hitData || !hitData.result) return;
                    handleEnemyHit(hitData.hitPoint, hitData.damage, hitData.hitType, hitData.result);
                },
                setTransientDebug
            );

            window.GameEnemy.update(dt, playerPos, camera, function (damage, hitType, attackerEnemy) {
                consumePlayerDamage(damage, hitType, attackerEnemy);
            });

            window.GameThrowables.update(dt, function (hitData) {
                if (!hitData || !hitData.result) return;
                handleEnemyHit(hitData.hitPoint, hitData.damage, hitData.hitType, hitData.result);
            });

            window.GameUI.updateThrowableInfo(window.GameThrowables.getState());
            window.GameUI.updateHealth(playerHP, playerMaxHP);
            window.GameUI.updateArmor(playerArmor, playerArmorMax);
        }

        currentAimTargetId = '';
        var centerTarget = window.GameHitscan.peekCenterTarget(camera, 220);
        if (centerTarget && centerTarget.targetId) {
            currentAimTargetId = centerTarget.targetId;
        }

        window.GameOverhead.update(camera, playerPos, currentAimTargetId);

        var cdRemaining = window.GameHitscan.cooldownRemaining();
        var cdTotal = window.GameHitscan.getCooldown();
        var cdReady = cdRemaining <= 0;
        var cdPct = cdReady ? 1 : (1 - cdRemaining / cdTotal);

        window.GameUI.updateCooldown(cdReady, cdPct);
        window.GameUI.updateDamageEffects(dt);
        window.GameUI.updateClassInfo(window.GameClasses.getHudState());

        renderer.render(scene, camera);
    }

    function boot() {
        if (window.GameNet && window.GameNet.requireAuth) {
            window.GameNet.requireAuth(function () {
                initGame();
            });
            return;
        }
        initGame();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
