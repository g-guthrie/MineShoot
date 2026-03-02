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
    var plasmaBeamLine = null;

    var DEFAULT_ENEMY_COUNT = 5;
    var DEFAULT_ARMOR_REGEN_DELAY = 6.0;
    var ARMOR_REGEN_PER_SEC = 12;

    var currentAimTargetId = '';
    var multiplayerMode = false;
    var forceGuestNetMode = false;
    var startupDebugNotice = '';
    var lastPlasmaActive = false;

    function applyBrandingOverrides() {
        document.title = 'Mayhem';
        var overlayTitle = document.querySelector('#overlay h1');
        if (overlayTitle) overlayTitle.textContent = 'MAYHEM';
        var docsTitle = document.getElementById('docs-title');
        if (docsTitle && /minecraft fps/i.test(docsTitle.textContent || '')) {
            docsTitle.textContent = String(docsTitle.textContent).replace(/minecraft fps/ig, 'MAYHEM');
        }
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

    function hasInputCapture() {
        return !!document.pointerLockElement || !!window.__gameNoLockInput;
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

    function setBeamLinePoints(line, start, end) {
        if (!line || !line.geometry || !line.geometry.attributes || !line.geometry.attributes.position) return;
        var arr = line.geometry.attributes.position.array;
        arr[0] = start.x; arr[1] = start.y; arr[2] = start.z;
        arr[3] = end.x; arr[4] = end.y; arr[5] = end.z;
        line.geometry.attributes.position.needsUpdate = true;
        line.geometry.computeBoundingSphere();
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
        if (multiplayerMode && window.GameNet && window.GameNet.sendEquipWeapon) {
            window.GameNet.sendEquipWeapon(weapon.id);
        }
        if (window.GameDocs && window.GameDocs.refresh) {
            window.GameDocs.refresh();
        }
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
        if (window.GameDocs && window.GameDocs.refresh) {
            window.GameDocs.refresh();
        }

        return selected;
    }

    function queueClassChange(classId) {
        var queued = window.GameClasses.queueClass(classId);
        if (!queued) return;

        if (multiplayerMode && window.GameNet && window.GameNet.queueClassChange) {
            window.GameNet.queueClassChange(classId);
        }

        window.GameUI.updateClassInfo(window.GameClasses.getHudState());
        if (window.GameDocs && window.GameDocs.refresh) {
            window.GameDocs.refresh();
        }
        setTransientDebug('Queued class: ' + queued.name + ' (applies on death)', 1300);
    }

    function handleEnemyHit(hitPoint, damage, hitType, result) {
        if (!result) return;
        if (window.GameAudio && window.GameAudio.play) {
            window.GameAudio.play('enemyHit', { killed: !!result.killed });
        }
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
            if (window.GameAudio && window.GameAudio.play) {
                window.GameAudio.play('playerHit');
            }
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
            if (window.GameAudio && window.GameAudio.play) {
                var w = window.GameHitscan.getCurrentWeapon();
                window.GameAudio.play('fire', { weapon: w && w.id ? w.id : 'rifle' });
            }
        }
    }

    function setupPointerLock() {
        overlay = document.getElementById('overlay');
        var playBtn = document.getElementById('play-btn');
        var lastStartRequest = 0;
        window.__gameNoLockInput = false;

        function enterFallbackStart(debugText) {
            window.__gameNoLockInput = true;
            if (overlay) overlay.style.display = 'none';
            isPlaying = true;
            if (debugText) {
                setTransientDebug(debugText, 2200);
            }
        }

        function requestPlayStart(e) {
            var now = performance.now();
            if (now - lastStartRequest < 140) return;
            lastStartRequest = now;
            if (e) {
                if (typeof e.button === 'number' && e.button !== 0) return;
                e.preventDefault();
                e.stopPropagation();
            }
            if (window.GameAudio && window.GameAudio.unlock) {
                window.GameAudio.unlock();
            }
            if (window.GameDocs && window.GameDocs.isOpen && window.GameDocs.isOpen()) {
                window.GameDocs.close();
            }

            // Enter gameplay immediately; pointer lock is best-effort.
            enterFallbackStart();

            var target = renderer && renderer.domElement;
            if (!target) {
                return;
            }
            var requestLock = target.requestPointerLock || target.webkitRequestPointerLock || target.mozRequestPointerLock;
            if (typeof requestLock !== 'function') {
                setTransientDebug('Pointer lock API unavailable. Using fallback input mode.', 2200);
                return;
            }
            try {
                var maybePromise = requestLock.call(target);
                if (maybePromise && typeof maybePromise.then === 'function' && typeof maybePromise.catch === 'function') {
                    maybePromise.catch(function () {
                        if (!document.pointerLockElement) {
                            setTransientDebug('Pointer lock denied. Using fallback input mode.', 2200);
                        }
                    });
                }
            } catch (err) {
                setTransientDebug('Pointer lock failed. Using fallback input mode.', 2200);
            }
        }

        if (playBtn) {
            playBtn.addEventListener('click', requestPlayStart);
            playBtn.addEventListener('pointerup', requestPlayStart);
            playBtn.addEventListener('mousedown', requestPlayStart);
            playBtn.addEventListener('touchend', requestPlayStart, { passive: false });
        }

        document.addEventListener('pointerlockchange', function () {
            if (document.pointerLockElement === renderer.domElement) {
                window.__gameNoLockInput = false;
                if (window.GameDocs && window.GameDocs.close) {
                    window.GameDocs.close();
                }
                overlay.style.display = 'none';
                isPlaying = true;
            } else {
                if (!window.__gameNoLockInput) {
                    overlay.style.display = 'flex';
                    isPlaying = false;
                }
            }
        });

        document.addEventListener('pointerlockerror', function () {
            if (!document.pointerLockElement) {
                enterFallbackStart('Pointer lock error. Using fallback input mode.');
            }
        });

        document.addEventListener('keydown', function (e) {
            if (e.code === 'Escape' && window.__gameNoLockInput) {
                window.__gameNoLockInput = false;
                if (overlay) overlay.style.display = 'flex';
                isPlaying = false;
            }
        });
    }

    function setupDocsControls() {
        document.addEventListener('keydown', function (e) {
            if (e.code === 'KeyI') {
                if (window.GameDocs && window.GameDocs.toggle) {
                    e.preventDefault();
                    window.GameDocs.toggle();
                }
                return;
            }

            if (e.code === 'Escape' && window.GameDocs && window.GameDocs.isOpen && window.GameDocs.isOpen()) {
                window.GameDocs.close();
            }
        });
    }

    function setupShooting() {
        document.addEventListener('mousedown', function (e) {
            if (e.button !== 0) return;
            if (!hasInputCapture()) return;
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
        document.addEventListener('keydown', function (e) {
            if (e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'Digit3' || e.code === 'Digit4' || e.code === 'Digit5') {
                var weaponOrder = window.GameHitscan.getWeaponOrder();
                var idx = parseInt(e.code.replace('Digit', ''), 10) - 1;
                if (idx >= 0 && idx < weaponOrder.length) {
                    applyWeapon(window.GameHitscan.setWeapon(weaponOrder[idx]));
                }
                return;
            }

            if (e.code === 'KeyT') {
                var loadoutOrder = window.GameHitscan.getWeaponOrder();
                if (loadoutOrder.length > 5) {
                    applyWeapon(window.GameHitscan.setWeapon(loadoutOrder[5]));
                }
            }
        });

        document.addEventListener('wheel', function (e) {
            if (!hasInputCapture()) return;
            e.preventDefault();
            applyWeapon(window.GameHitscan.cycleWeapon(e.deltaY > 0 ? 1 : -1));
        }, { passive: false });
    }

    function setupLoadoutControls() {
        var slotsWrap = document.getElementById('loadout-slots');
        var applyBtn = document.getElementById('loadout-apply');
        var plasmaToggleBtn = document.getElementById('loadout-plasma-toggle');
        if (!slotsWrap || !applyBtn || !plasmaToggleBtn) return;

        function getCatalogMap() {
            var catalog = window.GameHitscan.getWeaponCatalog ? window.GameHitscan.getWeaponCatalog() : [];
            var map = {};
            for (var i = 0; i < catalog.length; i++) {
                map[catalog[i].id] = catalog[i];
            }
            return map;
        }

        var catalogMap = getCatalogMap();
        var includePlasma = true;
        var currentLoadout = (window.GamePlayer.getLoadout && window.GamePlayer.getLoadout().slots) || window.GameHitscan.getWeaponOrder();
        if (currentLoadout.indexOf('plasma') === -1) includePlasma = false;

        function getWeaponOptions() {
            var all = window.GameHitscan.getAllWeaponIds ? window.GameHitscan.getAllWeaponIds() : window.GameHitscan.getWeaponOrder();
            var out = [];
            for (var i = 0; i < all.length; i++) {
                var id = all[i];
                if (!includePlasma && id === 'plasma') continue;
                out.push(id);
            }
            return out;
        }

        function normalizeLoadout(list) {
            var seen = {};
            var out = [];
            for (var i = 0; i < list.length; i++) {
                var id = String(list[i] || '');
                if (!id || seen[id]) continue;
                if (!includePlasma && id === 'plasma') continue;
                if (!catalogMap[id]) continue;
                seen[id] = true;
                out.push(id);
            }
            if (out.length === 0) out.push('rifle');
            return out;
        }

        function renderSlots() {
            currentLoadout = normalizeLoadout(currentLoadout);
            plasmaToggleBtn.textContent = includePlasma ? 'PLASMA: ENABLED' : 'PLASMA: DISABLED';

            slotsWrap.innerHTML = '';
            var options = getWeaponOptions();
            var slotCount = Math.min(6, Math.max(3, currentLoadout.length));

            for (var i = 0; i < slotCount; i++) {
                var row = document.createElement('div');
                row.className = 'loadout-slot-row';

                var label = document.createElement('label');
                label.textContent = 'Slot ' + (i + 1);
                row.appendChild(label);

                var select = document.createElement('select');
                select.dataset.slotIndex = String(i);

                for (var j = 0; j < options.length; j++) {
                    var id = options[j];
                    var option = document.createElement('option');
                    option.value = id;
                    option.textContent = catalogMap[id] ? catalogMap[id].name : id;
                    select.appendChild(option);
                }

                select.value = currentLoadout[i] || options[0];
                row.appendChild(select);
                slotsWrap.appendChild(row);
            }
        }

        plasmaToggleBtn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            includePlasma = !includePlasma;
            currentLoadout = normalizeLoadout(currentLoadout);
            renderSlots();
        });

        applyBtn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();

            var selects = slotsWrap.querySelectorAll('select');
            var next = [];
            for (var i = 0; i < selects.length; i++) {
                next.push(selects[i].value);
            }
            next = normalizeLoadout(next);
            currentLoadout = next.slice();

            var applied = window.GamePlayer.setLoadout({ slots: next });
            var finalSlots = (applied && applied.slots) ? applied.slots.slice() : next.slice();
            finalSlots = normalizeLoadout(finalSlots);

            window.GameHitscan.setWeaponOrder(finalSlots);

            var currentWeapon = window.GameHitscan.getCurrentWeapon();
            if (finalSlots.indexOf(currentWeapon.id) === -1) {
                currentWeapon = window.GameHitscan.setWeapon(finalSlots[0]);
            }
            applyWeapon(currentWeapon);
            renderSlots();
            setTransientDebug('Loadout applied: ' + finalSlots.join(', '), 1300);
        });

        renderSlots();
    }

    function tryThrow(type) {
        if (!hasInputCapture()) return;

        if (multiplayerMode && window.GameNet && window.GameNet.sendThrow) {
            window.GameNet.sendThrow(type);
            setTransientDebug('Throw sent: ' + type, 650);
            return;
        }

        var outcome = window.GameThrowables.throw(type, camera);
        window.GameUI.updateThrowableInfo(outcome.state);
        if (outcome.ok && window.GameAudio && window.GameAudio.play) {
            window.GameAudio.play('throw');
        }
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

            if (!hasInputCapture()) return;

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
            if (e.code === 'KeyH') {
                applyDebugVisuals(!wallhackRingVisible);
                setTransientDebug(wallhackRingVisible ? 'Dev visuals: ON' : 'Dev visuals: OFF', 1100);
                return;
            }
        });
    }

    function initGame() {
        applyBrandingOverrides();
        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        document.body.appendChild(renderer.domElement);

        scene = new THREE.Scene();
        clock = new THREE.Clock();

        window.GameWorld.create(scene);
        window.GameUI.init();
        if (window.GameDocs && window.GameDocs.init) {
            window.GameDocs.init();
        }
        window.GameOverhead.init();

        var plasmaBeamGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(),
            new THREE.Vector3()
        ]);
        var plasmaBeamMaterial = new THREE.LineBasicMaterial({
            color: 0x66ddff,
            transparent: true,
            opacity: 0.9,
            depthTest: false
        });
        plasmaBeamLine = new THREE.Line(plasmaBeamGeometry, plasmaBeamMaterial);
        plasmaBeamLine.visible = false;
        plasmaBeamLine.renderOrder = 24;
        scene.add(plasmaBeamLine);

        if (startupDebugNotice) {
            setTransientDebug(startupDebugNotice, 1800);
            startupDebugNotice = '';
        }

        camera = window.GamePlayer.init(scene);

        multiplayerMode = forceGuestNetMode || !!(window.GameNet && window.GameNet.getCurrentUser && window.GameNet.getCurrentUser());

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
        setupLoadoutControls();
        setupDocsControls();
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
        if (currentWeapon && (currentWeapon.id === 'shotgun' || currentWeapon.id === 'plasma')) {
            syncReticleWithWeapon(currentWeapon);
        }

        if (triggerHeld && hasInputCapture() && currentWeapon && currentWeapon.automatic && currentWeapon.id !== 'plasma') {
            tryPlayerFire();
        }

        var plasmaState = window.GameHitscan.updatePlasmaBeam(dt, camera, {
            triggerHeld: triggerHeld && hasInputCapture(),
            onLocalTick: function (target, damage) {
                if (multiplayerMode) return;
                if (!target || target.ownerType !== 'enemy' || !target.hitbox) return;
                if (!window.GameEnemy || !window.GameEnemy.damage) return;
                var result = window.GameEnemy.damage(target.hitbox, damage);
                if (!result) return;
                var hitPoint = target.worldPos ? target.worldPos.clone() : target.hitbox.position.clone();
                handleEnemyHit(hitPoint, damage, 'body', result);
            },
            onNetTick: function (targetId) {
                if (!multiplayerMode || !window.GameNet || !window.GameNet.sendPlasmaTick) return;
                if (typeof targetId !== 'string' || targetId.indexOf('net:') !== 0) return;
                window.GameNet.sendPlasmaTick(targetId.slice(4));
            }
        });
        if (window.GameHitscan.updateTracers) {
            window.GameHitscan.updateTracers(dt);
        }
        if (plasmaState.active && !lastPlasmaActive && window.GameAudio && window.GameAudio.play) {
            window.GameAudio.play('plasma');
        }
        lastPlasmaActive = !!plasmaState.active;
        window.GameUI.updatePlasmaState(plasmaState);
        if (plasmaBeamLine) {
            if (plasmaState && plasmaState.active) {
                setBeamLinePoints(plasmaBeamLine, plasmaState.beamStart, plasmaState.beamEnd);
                plasmaBeamLine.visible = true;
                plasmaBeamLine.material.opacity = plasmaState.overheated ? 0.2 : 0.9;
            } else {
                plasmaBeamLine.visible = false;
            }
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
        if (window.GameUI.updateSeekerDebugInfo) {
            var showSeekerDebug = !!wallhackRingVisible && currentWeapon && currentWeapon.id === 'seekergun';
            var seekerTelemetry = null;
            var seekerTuning = null;
            if (showSeekerDebug && window.GameHitscan.getSeekergunDebugInfo) {
                seekerTelemetry = window.GameHitscan.getSeekergunDebugInfo(camera);
            }
            if (showSeekerDebug && window.GameThrowables && window.GameThrowables.getSeekerShotTuning) {
                seekerTuning = window.GameThrowables.getSeekerShotTuning();
            }
            window.GameUI.updateSeekerDebugInfo(showSeekerDebug, seekerTelemetry, seekerTuning, {
                fov: camera && camera.fov ? camera.fov : 60,
                aspect: camera && camera.aspect ? camera.aspect : (window.innerWidth / Math.max(1, window.innerHeight))
            });
        }

        renderer.render(scene, camera);
    }

    function isLocalDevMode() {
        var host = (window.location.hostname || '').toLowerCase();
        if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '::1') return true;
        try {
            var params = new URLSearchParams(window.location.search || '');
            if (params.get('local') === '1' || params.get('offline') === '1') return true;
            if (params.get('net') === '1') return false;
        } catch (err) {
            // URL parsing failed; continue with protocol fallback.
        }
        return window.location.protocol === 'file:';
    }

    function wantsGuestNetMode() {
        try {
            var params = new URLSearchParams(window.location.search || '');
            return params.get('net') === '1';
        } catch (err) {
            return false;
        }
    }

    function boot() {
        forceGuestNetMode = wantsGuestNetMode();
        function safeInit() {
            try {
                initGame();
            } catch (err) {
                var msg = (err && err.message) ? err.message : String(err || 'Unknown startup error');
                var overlayEl = document.getElementById('overlay');
                if (overlayEl) overlayEl.style.display = 'flex';
                var dbg = document.getElementById('debug-info');
                if (dbg) dbg.textContent = 'Startup error: ' + msg;
                console.error('Startup error:', err);
            }
        }

        if (forceGuestNetMode && window.GameNet && window.GameNet.enableGuestMode) {
            window.GameNet.enableGuestMode();
            startupDebugNotice = 'Guest net mode: auth disabled, auto-joining shared room.';
            safeInit();
            return;
        }

        if (!isLocalDevMode() && window.GameNet && window.GameNet.requireAuth) {
            window.GameNet.requireAuth(function () {
                safeInit();
            });
            return;
        }
        startupDebugNotice = 'Local dev mode: backend auth/multiplayer disabled.';
        safeInit();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
