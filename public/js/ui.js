/**
 * ui.js - HUD, damage numbers, reticles, and status text
 * Loaded as global: window.GameUI
 */
(function () {
    'use strict';

    var GameUI = {};

    var crosshairEl, shotgunReticleEl, plasmaReticleEl, hitmarkerEl, killCounterEl;
    var healthBarEl, healthTextEl, armorBarEl, damageNumbersEl, debugInfoEl;
    var weaponInfoEl, throwableInfoEl;
    var classInfoEl;
    var cooldownBarEl, cooldownStatusEl;
    var plasmaHeatBarEl, plasmaStatusEl;
    var damageVignetteEl, damageIndicatorEl;
    var damageTicks = [];
    var damageTickTimers = [];
    var damageFlashLevel = 0;

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
        hitmarkerEl = document.getElementById('hitmarker');
        killCounterEl = document.getElementById('kill-counter');
        healthBarEl = document.getElementById('health-bar');
        healthTextEl = document.getElementById('health-text');
        armorBarEl = document.getElementById('armor-bar');
        damageNumbersEl = document.getElementById('damage-numbers');
        debugInfoEl = document.getElementById('debug-info');
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
            crosshairEl.style.display = 'none';
            shotgunReticleEl.style.display = 'none';
            plasmaReticleEl.style.display = 'block';
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
            line('G Frag', state.frag) + '<br>' +
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

    GameUI.getKillCount = function () {
        return killCount;
    };

    window.GameUI = GameUI;
})();
