/**
 * ui.js - HUD, damage numbers, reticles, and status text
 * Loaded as global: window.GameUI
 */
(function () {
    'use strict';

    var GameUI = {};

    var crosshairEl, shotgunReticleEl, plasmaReticleEl, chokeReticleEl, deadeyeReticlesEl, hitmarkerEl, killCounterEl;
    var healthBarEl, healthTextEl, armorBarEl, damageNumbersEl, debugInfoEl, seekerDebugInfoEl;
    var seekerConeMarkersEl, seekerConeMarkerEls;
    var combatRadarEl, combatRadarSlicesEl, combatRadarCoreEl, combatBeaconsEl;
    var combatBeaconEls = [];
    var weaponInfoEl, throwableInfoEl;
    var classInfoEl;
    var cooldownBarEl, cooldownStatusEl;
    var plasmaHeatBarEl, plasmaStatusEl;
    var damageVignetteEl, damageIndicatorEl;
    var damageTicks = [];
    var damageTickTimers = [];
    var damageFlashLevel = 0;
    var deadeyeReticlePool = [];
    var deadeyeProjectVec = new THREE.Vector3();

    var killCount = 0;
    var hitmarkerTimer = null;

    function formatCooldown(seconds) {
        if (seconds <= 0) return '';
        if (seconds >= 10) return Math.ceil(seconds) + 's';
        return seconds.toFixed(1) + 's';
    }

    function wrapAngleRad(rad) {
        while (rad > Math.PI) rad -= Math.PI * 2;
        while (rad < -Math.PI) rad += Math.PI * 2;
        return rad;
    }

    GameUI.init = function () {
        crosshairEl = document.getElementById('crosshair');
        shotgunReticleEl = document.getElementById('shotgun-reticle');
        plasmaReticleEl = document.getElementById('plasma-reticle');
        chokeReticleEl = document.getElementById('choke-reticle');
        deadeyeReticlesEl = document.getElementById('deadeye-reticles');
        hitmarkerEl = document.getElementById('hitmarker');
        killCounterEl = document.getElementById('kill-counter');
        healthBarEl = document.getElementById('health-bar');
        healthTextEl = document.getElementById('health-text');
        armorBarEl = document.getElementById('armor-bar');
        damageNumbersEl = document.getElementById('damage-numbers');
        debugInfoEl = document.getElementById('debug-info');
        seekerDebugInfoEl = document.getElementById('seeker-debug-info');
        seekerConeMarkersEl = document.getElementById('seeker-cone-markers');
        seekerConeMarkerEls = seekerConeMarkersEl ? seekerConeMarkersEl.querySelectorAll('.seeker-cone-marker') : [];
        combatRadarEl = document.getElementById('combat-radar');
        combatRadarSlicesEl = document.getElementById('combat-radar-slices');
        combatRadarCoreEl = document.getElementById('combat-radar-core');
        combatBeaconsEl = document.getElementById('combat-beacons');
        combatBeaconEls = [];
        weaponInfoEl = document.getElementById('weapon-info');
        throwableInfoEl = document.getElementById('throwable-info');
        classInfoEl = document.getElementById('class-info');
        cooldownBarEl = document.getElementById('cooldown-bar');
        cooldownStatusEl = document.getElementById('cooldown-status');
        plasmaHeatBarEl = document.getElementById('plasma-heat-bar');
        plasmaStatusEl = document.getElementById('plasma-status');
        damageVignetteEl = document.getElementById('damage-vignette');
        damageIndicatorEl = document.getElementById('damage-indicator');

        killCount = 0;
        GameUI.updateKillCounter();

        damageTicks = [];
        damageTickTimers = [];
        damageFlashLevel = 0;

        if (damageIndicatorEl) {
            damageIndicatorEl.innerHTML = '';
            for (var i = 0; i < 12; i++) {
                var tick = document.createElement('div');
                tick.className = 'damage-sector';

                var halfStep = Math.PI / 12;
                var centerAngle = (-Math.PI / 2) + (i * (Math.PI / 6));
                var a0 = centerAngle - halfStep;
                var a1 = centerAngle + halfStep;
                var r = 140;
                var x0 = 50 + Math.cos(a0) * r;
                var y0 = 50 + Math.sin(a0) * r;
                var x1 = 50 + Math.cos(a1) * r;
                var y1 = 50 + Math.sin(a1) * r;
                tick.style.clipPath =
                    'polygon(50% 50%, ' +
                    x0.toFixed(2) + '% ' + y0.toFixed(2) + '%, ' +
                    x1.toFixed(2) + '% ' + y1.toFixed(2) + '%)';

                damageIndicatorEl.appendChild(tick);
                damageTicks.push(tick);
                damageTickTimers.push(0);
            }
        }

        if (combatBeaconsEl) {
            for (var b = 0; b < 3; b++) {
                var beacon = document.createElement('div');
                beacon.className = 'combat-beacon-dot';
                combatBeaconsEl.appendChild(beacon);
                combatBeaconEls.push(beacon);
            }
        }

        deadeyeReticlePool = [];
    };

    GameUI.showHitMarker = function () {
        hitmarkerEl.style.transition = 'none';
        hitmarkerEl.style.opacity = '1';
        if (hitmarkerTimer) clearTimeout(hitmarkerTimer);
        hitmarkerTimer = setTimeout(function () {
            hitmarkerEl.style.transition = 'opacity 0.2s ease-out';
            hitmarkerEl.style.opacity = '0';
            hitmarkerTimer = null;
        }, 200);
    };

    GameUI.showKillMarker = function () {
        hitmarkerEl.style.transition = 'none';
        hitmarkerEl.style.opacity = '1';
        hitmarkerEl.style.color = '#ff4444';
        hitmarkerEl.style.fontSize = '36px';
        if (hitmarkerTimer) clearTimeout(hitmarkerTimer);
        hitmarkerTimer = setTimeout(function () {
            hitmarkerEl.style.transition = 'opacity 0.25s ease-out';
            hitmarkerEl.style.opacity = '0';
            hitmarkerEl.style.color = '#ff0000';
            hitmarkerEl.style.fontSize = '28px';
            hitmarkerTimer = null;
        }, 300);
    };

    GameUI.addKill = function () {
        killCount++;
        GameUI.updateKillCounter();
    };

    GameUI.updateKillCounter = function () {
        killCounterEl.textContent = 'Kills: ' + killCount;
    };

    GameUI.updateHealth = function (hp, maxHp) {
        var pct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
        healthBarEl.style.width = pct + '%';
        healthTextEl.textContent = 'HP: ' + Math.ceil(hp);

        if (pct > 60) {
            healthBarEl.style.background = '#4CAF50';
        } else if (pct > 30) {
            healthBarEl.style.background = '#FFC107';
        } else {
            healthBarEl.style.background = '#F44336';
        }
    };

    GameUI.updateArmor = function (armor, armorMax) {
        if (!armorBarEl) return;
        armorMax = Math.max(1, armorMax || 1);
        var pct = Math.max(0, Math.min(100, (armor / armorMax) * 100));
        armorBarEl.style.width = pct + '%';
    };

    GameUI.showDamageNumber = function (worldPoint, damage, isKill, camera, hitType) {
        var projected = worldPoint.clone().project(camera);
        var x = (projected.x * 0.5 + 0.5) * window.innerWidth;
        var y = (-projected.y * 0.5 + 0.5) * window.innerHeight;
        if (projected.z > 1) return;

        var className = 'damage-number';
        if (isKill) className += ' kill';
        if (hitType === 'head') className += ' headshot';

        var el = document.createElement('div');
        el.className = className;
        el.textContent = isKill ? ('-' + damage + ' KILL!') : ('-' + damage);
        el.style.left = x + 'px';
        el.style.top = y + 'px';
        el.style.marginLeft = ((Math.random() - 0.5) * 40) + 'px';

        damageNumbersEl.appendChild(el);
        setTimeout(function () {
            if (el.parentNode) el.parentNode.removeChild(el);
        }, 1000);
    };

    GameUI.setDebugInfo = function (text) {
        if (!debugInfoEl) return;
        debugInfoEl.textContent = text || '';
    };

    GameUI.updateSeekerDebugInfo = function (visible, telemetry, tuning, viewInfo) {
        if (!seekerDebugInfoEl) return;
        if (!visible || !telemetry) {
            seekerDebugInfoEl.style.display = 'none';
            seekerDebugInfoEl.textContent = '';
            if (seekerConeMarkersEl) seekerConeMarkersEl.style.display = 'none';
            return;
        }
        var hasLock = telemetry.hasLock ? 'YES' : 'NO';
        var lockStrength = telemetry.hasLock && telemetry.lockNorm >= 0
            ? Math.max(0, 1 - telemetry.lockNorm).toFixed(2)
            : '0.00';
        var nearestNorm = telemetry.nearestNorm >= 0 ? telemetry.nearestNorm.toFixed(2) : '--';
        var lines = [
            'SEEKER DEBUG',
            'LOCK: ' + hasLock + '  TARGET: ' + (telemetry.lockTargetId || 'none'),
            'LOCK_STRENGTH: ' + lockStrength + '  NEAREST_NORM: ' + nearestNorm,
            'BOX_PX: ' + Math.round(telemetry.reticleSizePx) + '  CANDIDATES: ' + telemetry.candidateCount,
            'RANGE: ' + telemetry.maxRange.toFixed(1)
        ];
        if (tuning) {
            lines.push(
                'HOMING_LERP: ' + Number(tuning.homingLerp || 0).toFixed(2) +
                '  HOMING_BOOST: ' + Number(tuning.homingBoost || 0).toFixed(2)
            );
            lines.push(
                'PROJ_SPEED: ' + Number(tuning.speed || 0).toFixed(1) +
                '  FUSE: ' + Number(tuning.fuse || 0).toFixed(2)
            );
            lines.push('LOCK_HALF_ANGLE: ' + Number(tuning.lockHalfAngleDeg || 0).toFixed(1) + ' deg');
        }
        seekerDebugInfoEl.textContent = lines.join('\n');
        seekerDebugInfoEl.style.display = 'block';

        if (!seekerConeMarkersEl || !seekerConeMarkerEls || seekerConeMarkerEls.length < 4) return;
        if (!tuning || !viewInfo || !viewInfo.fov || !viewInfo.aspect || !tuning.lockHalfAngleDeg) {
            seekerConeMarkersEl.style.display = 'none';
            return;
        }
        var halfAngleRad = Number(tuning.lockHalfAngleDeg) * Math.PI / 180;
        var vFovRad = Number(viewInfo.fov) * Math.PI / 180;
        var aspect = Math.max(0.0001, Number(viewInfo.aspect));
        var tanHalf = Math.tan(halfAngleRad);
        var tanV = Math.tan(vFovRad * 0.5);
        if (!isFinite(tanHalf) || !isFinite(tanV) || tanV <= 0.000001) {
            seekerConeMarkersEl.style.display = 'none';
            return;
        }
        var xNdc = tanHalf / (tanV * aspect);
        var yNdc = tanHalf / tanV;
        var dx = Math.min(window.innerWidth * 0.45, Math.max(6, xNdc * window.innerWidth * 0.5));
        var dy = Math.min(window.innerHeight * 0.45, Math.max(6, yNdc * window.innerHeight * 0.5));
        var cx = window.innerWidth * 0.5;
        var cy = window.innerHeight * 0.5;

        seekerConeMarkerEls[0].style.left = Math.round(cx + dx) + 'px'; // right
        seekerConeMarkerEls[0].style.top = Math.round(cy) + 'px';
        seekerConeMarkerEls[1].style.left = Math.round(cx - dx) + 'px'; // left
        seekerConeMarkerEls[1].style.top = Math.round(cy) + 'px';
        seekerConeMarkerEls[2].style.left = Math.round(cx) + 'px'; // top
        seekerConeMarkerEls[2].style.top = Math.round(cy - dy) + 'px';
        seekerConeMarkerEls[3].style.left = Math.round(cx) + 'px'; // bottom
        seekerConeMarkerEls[3].style.top = Math.round(cy + dy) + 'px';
        seekerConeMarkersEl.style.display = 'block';
    };

    GameUI.updateCombatRadar = function (state) {
        if (!combatRadarEl || !combatRadarSlicesEl || !combatRadarCoreEl) return;
        if (!state || !state.segments || !state.segments.length) {
            combatRadarEl.style.display = 'none';
            return;
        }
        combatRadarEl.style.display = 'block';
        var segs = state.segments;
        var count = Math.max(1, segs.length);
        var step = 360 / count;
        var parts = [];
        for (var i = 0; i < count; i++) {
            var intensity = Math.max(0, Math.min(1, Number(segs[i] || 0)));
            var alpha = (0.04 + intensity * 0.78).toFixed(3);
            var start = (i * step - step * 0.5);
            var end = start + step;
            parts.push('rgba(86, 193, 255, ' + alpha + ') ' + start.toFixed(2) + 'deg ' + end.toFixed(2) + 'deg');
        }
        combatRadarSlicesEl.style.background = 'conic-gradient(' + parts.join(', ') + ')';

        var core = Math.max(0, Math.min(1, Number(state.coreIntensity || 0)));
        var coreAlpha = (core * 0.82).toFixed(3);
        combatRadarCoreEl.style.background = 'rgba(255, 96, 96, ' + coreAlpha + ')';
        combatRadarCoreEl.style.boxShadow = '0 0 ' + (4 + core * 10).toFixed(1) + 'px rgba(255, 90, 90, ' + (core * 0.7).toFixed(3) + ')';
    };

    GameUI.updateCombatBeacons = function (beacons) {
        if (!combatRadarEl || !combatBeaconEls || combatBeaconEls.length === 0) return;
        var rect = combatRadarEl.getBoundingClientRect();
        var cx = rect.left + rect.width * 0.5;
        var cy = rect.top + rect.height * 0.5;
        var radius = Math.max(40, rect.width * 0.78);
        for (var i = 0; i < combatBeaconEls.length; i++) {
            var el = combatBeaconEls[i];
            var b = (beacons && i < beacons.length) ? beacons[i] : null;
            if (!b || typeof b.angleRad !== 'number') {
                el.style.display = 'none';
                continue;
            }
            var intensity = Math.max(0.25, Math.min(1, Number(b.intensity || 0.5)));
            var x = cx + Math.sin(b.angleRad) * radius;
            var y = cy - Math.cos(b.angleRad) * radius;
            el.style.left = Math.round(x) + 'px';
            el.style.top = Math.round(y) + 'px';
            el.style.opacity = intensity.toFixed(3);
            el.style.display = 'block';
        }
    };

    GameUI.updateCooldown = function (ready, pct) {
        if (!cooldownBarEl || !cooldownStatusEl) return;
        cooldownBarEl.style.width = (pct * 100) + '%';
        if (ready) {
            cooldownBarEl.style.background = '#4CAF50';
            cooldownStatusEl.textContent = 'READY';
            cooldownStatusEl.style.color = '#4CAF50';
        } else {
            cooldownBarEl.style.background = '#FFC107';
            cooldownStatusEl.textContent = 'COOLDOWN';
            cooldownStatusEl.style.color = '#FFC107';
        }
    };

    GameUI.updateWeaponInfo = function (weapon) {
        if (!weaponInfoEl || !weapon) return;
        var mode = weapon.automatic ? 'AUTO' : 'SEMI';
        if (weapon.pellets && weapon.pellets > 1) {
            mode = weapon.pellets + ' PELLETS';
        }
        weaponInfoEl.textContent = weapon.name + ' | ' + mode + ' | ' +
            weapon.bodyDamage + '/' + weapon.headDamage + ' DMG';
    };

    GameUI.updateClassInfo = function (state) {
        if (!classInfoEl || !state) return;

        if (typeof state === 'string') {
            classInfoEl.textContent = state;
            return;
        }

        function fmtCd(seconds) {
            if (!seconds || seconds <= 0) return 'READY';
            if (seconds >= 10) return Math.ceil(seconds) + 's';
            return seconds.toFixed(1) + 's';
        }

        var extra = state.extra ? (' | ' + state.extra) : '';
        if (state.queuedClassName) {
            extra += ' | QUEUE: ' + state.queuedClassName;
        }
        classInfoEl.textContent =
            state.name + ' | E ' + (state.abilityName || 'Ability') + ': ' + fmtCd(state.abilityCooldown) +
            ' | R ' + (state.ultimateName || 'Ultimate') + ': ' + fmtCd(state.ultimateCooldown) + extra;
    };

    GameUI.updateReticle = function (weapon, spec) {
        if (!crosshairEl || !shotgunReticleEl || !plasmaReticleEl || !weapon) return;

        if (weapon.id !== 'shotgun' && weapon.id !== 'plasma') {
            crosshairEl.style.display = 'block';
            shotgunReticleEl.style.display = 'none';
            plasmaReticleEl.style.display = 'none';
            return;
        }

        if (weapon.id === 'plasma') {
            crosshairEl.style.display = 'block';
            shotgunReticleEl.style.display = 'none';
            plasmaReticleEl.style.display = 'none';
            var pSize = (spec && spec.size) ? spec.size : 220;
            plasmaReticleEl.style.width = pSize + 'px';
            plasmaReticleEl.style.height = pSize + 'px';
            return;
        }

        crosshairEl.style.display = 'none';
        shotgunReticleEl.style.display = 'block';
        plasmaReticleEl.style.display = 'none';

        var size = (spec && spec.size) ? spec.size : 300;
        var points = (spec && spec.points) ? spec.points : [];
        shotgunReticleEl.style.width = size + 'px';
        shotgunReticleEl.style.height = size + 'px';

        var dots = shotgunReticleEl.querySelectorAll('.pellet-dot');
        var needed = points.length;

        while (dots.length < needed) {
            var dot = document.createElement('div');
            dot.className = 'pellet-dot';
            shotgunReticleEl.appendChild(dot);
            dots = shotgunReticleEl.querySelectorAll('.pellet-dot');
        }
        while (dots.length > needed) {
            shotgunReticleEl.removeChild(dots[dots.length - 1]);
            dots = shotgunReticleEl.querySelectorAll('.pellet-dot');
        }

        for (var i = 0; i < needed; i++) {
            var x = Math.round((size * 0.5) + (points[i][0] * size * 0.5));
            var y = Math.round((size * 0.5) + (points[i][1] * size * 0.5));
            dots[i].style.left = x + 'px';
            dots[i].style.top = y + 'px';
        }
    };

    GameUI.updateThrowableInfo = function (state) {
        if (!throwableInfoEl || !state) return;

        function line(prefix, entry) {
            if (!entry) return prefix + ': --';
            var cd = entry.charges > 0 ? '' : (' (' + formatCooldown(entry.cooldownRemaining) + ')');
            return prefix + ': ' + entry.charges + cd;
        }

        throwableInfoEl.innerHTML =
            line('G Frag (arm/throw)', state.frag) + '<br>' +
            line('V Seeker', state.seeker) + '<br>' +
            line('B Molotov', state.molotov) + '<br>' +
            line('Q Knife', state.knife);
    };

    GameUI.updatePlasmaState = function (state) {
        if (!plasmaHeatBarEl || !plasmaStatusEl) return;
        if (!state) {
            plasmaHeatBarEl.style.width = '0%';
            plasmaStatusEl.textContent = 'PLASMA READY';
            plasmaStatusEl.style.color = '#7edbff';
            if (plasmaReticleEl) plasmaReticleEl.style.borderColor = 'rgba(102, 221, 255, 0.9)';
            return;
        }

        var heat = Math.max(0, Math.min(1, state.heat || 0));
        plasmaHeatBarEl.style.width = Math.round(heat * 100) + '%';

        if (state.overheated) {
            plasmaStatusEl.textContent = 'PLASMA OVERHEATED';
            plasmaStatusEl.style.color = '#ff8a7a';
            if (plasmaReticleEl) plasmaReticleEl.style.borderColor = 'rgba(255, 122, 102, 0.92)';
            return;
        }

        if (state.active && state.targetId) {
            plasmaStatusEl.textContent = 'LOCK: ' + state.targetId;
            plasmaStatusEl.style.color = '#8ef5b2';
            if (plasmaReticleEl) plasmaReticleEl.style.borderColor = 'rgba(120, 255, 170, 0.95)';
            return;
        }

        plasmaStatusEl.textContent = heat > 0.02 ? 'PLASMA COOLING' : 'PLASMA READY';
        plasmaStatusEl.style.color = '#7edbff';
        if (plasmaReticleEl) plasmaReticleEl.style.borderColor = 'rgba(102, 221, 255, 0.9)';
    };

    GameUI.showDirectionalDamage = function (sourcePos, playerPos, playerYaw, damage) {
        if (!sourcePos || !playerPos || typeof playerYaw !== 'number') return;
        if (!damageTicks || damageTicks.length !== 12) return;

        var toX = sourcePos.x - playerPos.x;
        var toZ = sourcePos.z - playerPos.z;
        var len = Math.sqrt(toX * toX + toZ * toZ);
        if (len <= 0.001) return;

        toX /= len;
        toZ /= len;

        var forwardX = -Math.sin(playerYaw);
        var forwardZ = -Math.cos(playerYaw);
        var rightX = Math.cos(playerYaw);
        var rightZ = -Math.sin(playerYaw);

        var frontDot = toX * forwardX + toZ * forwardZ;
        var rightDot = toX * rightX + toZ * rightZ;
        var angle = wrapAngleRad(Math.atan2(rightDot, frontDot));

        var sector = Math.round(angle / (Math.PI / 6));
        sector = ((sector % 12) + 12) % 12;

        var duration = 1.0 + Math.min(0.5, damage / 120);
        damageTickTimers[sector] = Math.max(damageTickTimers[sector], duration);

        // Bleed to adjacent slices for smoother clock-like impact.
        var next = (sector + 1) % 12;
        var prev = (sector + 11) % 12;
        damageTickTimers[next] = Math.max(damageTickTimers[next], duration * 0.45);
        damageTickTimers[prev] = Math.max(damageTickTimers[prev], duration * 0.45);

        damageFlashLevel = Math.max(
            damageFlashLevel,
            0.18 + Math.min(0.32, damage / 180)
        );
    };

    GameUI.updateDamageEffects = function (dt) {
        if (!damageTicks || damageTicks.length === 0) return;

        for (var i = 0; i < damageTickTimers.length; i++) {
            if (damageTickTimers[i] > 0) {
                damageTickTimers[i] -= dt;
                if (damageTickTimers[i] < 0) damageTickTimers[i] = 0;
            }

            var t = Math.min(1, damageTickTimers[i]);
            var opacity = t * 0.62;
            damageTicks[i].style.opacity = opacity.toFixed(3);
        }

        if (damageFlashLevel > 0) {
            damageFlashLevel -= dt * 1.4;
            if (damageFlashLevel < 0) damageFlashLevel = 0;
        }

        if (damageVignetteEl) {
            damageVignetteEl.style.opacity = (damageFlashLevel * 0.45).toFixed(3);
        }
    };

    GameUI.updateChokeReticle = function (visible, sizePx) {
        if (!chokeReticleEl) return;
        if (!visible) {
            chokeReticleEl.style.display = 'none';
            return;
        }
        var size = sizePx || 190;
        chokeReticleEl.style.width = size + 'px';
        chokeReticleEl.style.height = size + 'px';
        chokeReticleEl.style.display = 'block';
    };

    function ensureDeadeyeReticles(count) {
        if (!deadeyeReticlesEl) return;
        while (deadeyeReticlePool.length < count) {
            var node = document.createElement('div');
            node.className = 'deadeye-target-reticle';
            var core = document.createElement('div');
            core.className = 'deadeye-target-core';
            node.appendChild(core);
            deadeyeReticlesEl.appendChild(node);
            deadeyeReticlePool.push(node);
        }
    }

    function hideDeadeyeReticles() {
        if (!deadeyeReticlesEl) return;
        deadeyeReticlesEl.style.display = 'none';
        for (var i = 0; i < deadeyeReticlePool.length; i++) {
            deadeyeReticlePool[i].style.display = 'none';
        }
    }

    GameUI.updateDeadeyeReticle = function (camera, deadeyeState) {
        if (!deadeyeReticlesEl) return;
        if (!deadeyeState || !Array.isArray(deadeyeState.targets) || deadeyeState.targets.length === 0) {
            hideDeadeyeReticles();
            return;
        }

        ensureDeadeyeReticles(deadeyeState.targets.length);
        deadeyeReticlesEl.style.display = 'block';

        for (var i = 0; i < deadeyeReticlePool.length; i++) {
            deadeyeReticlePool[i].style.display = 'none';
        }

        for (var t = 0; t < deadeyeState.targets.length; t++) {
            var target = deadeyeState.targets[t];
            var el = deadeyeReticlePool[t];
            if (!target || !el) continue;

            var screenX = window.innerWidth * 0.5;
            var screenY = window.innerHeight * 0.5;
            if (!target.screenCenter) {
                if (!camera || !target.worldPos) continue;
                deadeyeProjectVec.set(target.worldPos.x, target.worldPos.y, target.worldPos.z).project(camera);
                if (deadeyeProjectVec.z < -1 || deadeyeProjectVec.z > 1) continue;
                screenX = (deadeyeProjectVec.x * 0.5 + 0.5) * window.innerWidth;
                screenY = (-deadeyeProjectVec.y * 0.5 + 0.5) * window.innerHeight;
            }

            var progress = Math.max(0, Math.min(1, target.progress || 0));
            var size = target.locked ? 22 : Math.round(220 - (progress * 160));
            if (size < 22) size = 22;
            if (size > 220) size = 220;

            el.style.left = screenX.toFixed(1) + 'px';
            el.style.top = screenY.toFixed(1) + 'px';
            el.style.width = size + 'px';
            el.style.height = size + 'px';
            el.style.display = 'block';
            if (target.locked) el.classList.add('locked');
            else el.classList.remove('locked');
        }
    };

    GameUI.getKillCount = function () {
        return killCount;
    };

    window.GameUI = GameUI;
})();
