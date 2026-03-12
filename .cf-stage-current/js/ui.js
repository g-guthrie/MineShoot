/**
 * ui.js - HUD, damage numbers, reticles, and status text
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameUI
 */
(function () {
    'use strict';

    var GameUI = {};

    var crosshairEl, bloomReticleEl, shotgunReticleEl, sniperScopeEl, hitmarkerEl, killCounterEl;
    var healthBarEl, healthTextEl, armorBarEl, damageNumbersEl, debugInfoEl;
    var seekerReticleEl, seekerReticleLabelEl;
    var combatRadarEl, combatRadarSlicesEl, combatRadarCoreEl, combatBeaconsEl;
    var combatBeaconEls = [];
    var weaponInfoEl, throwableInfoEl;
    var cooldownBarEl, cooldownStatusEl;
    var damageVignetteEl, damageIndicatorEl;
    var damageTicks = [];
    var damageTickTimers = [];
    var damageFlashLevel = 0;
    var debugVisualsOn = false;
    var bloomReticle = null;

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
        bloomReticleEl = document.getElementById('bloom-reticle');
        bloomReticle = (globalThis.__MAYHEM_RUNTIME.GameBloomReticle && globalThis.__MAYHEM_RUNTIME.GameBloomReticle.create)
            ? globalThis.__MAYHEM_RUNTIME.GameBloomReticle.create(bloomReticleEl)
            : null;
        shotgunReticleEl = document.getElementById('shotgun-reticle');
        sniperScopeEl = document.getElementById('sniper-scope');
        hitmarkerEl = document.getElementById('hitmarker');
        killCounterEl = document.getElementById('kill-counter');
        healthBarEl = document.getElementById('health-bar');
        healthTextEl = document.getElementById('health-text');
        armorBarEl = document.getElementById('armor-bar');
        damageNumbersEl = document.getElementById('damage-numbers');
        debugInfoEl = document.getElementById('debug-info');
        seekerReticleEl = document.getElementById('seeker-reticle');
        seekerReticleLabelEl = document.getElementById('seeker-reticle-label');
        combatRadarEl = document.getElementById('combat-radar');
        combatRadarSlicesEl = document.getElementById('combat-radar-slices');
        combatRadarCoreEl = document.getElementById('combat-radar-core');
        combatBeaconsEl = document.getElementById('combat-beacons');
        combatBeaconEls = [];
        weaponInfoEl = document.getElementById('weapon-info');
        throwableInfoEl = document.getElementById('throwable-info');
        cooldownBarEl = document.getElementById('cooldown-bar');
        cooldownStatusEl = document.getElementById('cooldown-status');
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
            for (var b = 0; b < 1; b++) {
                var beacon = document.createElement('div');
                beacon.className = 'combat-beacon-dot';
                combatBeaconsEl.appendChild(beacon);
                combatBeaconEls.push(beacon);
            }
        }
    };

    GameUI.showHitMarker = function () {
        if (!hitmarkerEl) return;
        hitmarkerEl.style.transition = 'none';
        hitmarkerEl.style.opacity = '1';
        hitmarkerEl.style.color = '#ffffff';
        hitmarkerEl.style.fontSize = '28px';
        if (hitmarkerTimer) clearTimeout(hitmarkerTimer);
        hitmarkerTimer = setTimeout(function () {
            hitmarkerEl.style.transition = 'opacity 0.18s ease-out';
            hitmarkerEl.style.opacity = '0';
            hitmarkerEl.style.color = '#ff0000';
            hitmarkerEl.style.fontSize = '28px';
            hitmarkerTimer = null;
        }, 90);
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

    GameUI.updateMatchStatus = function (matchState, selfState) {
        if (!killCounterEl) return;
        if (!matchState || !matchState.started) {
            GameUI.updateKillCounter();
            return;
        }

        var ownKills = Math.max(0, Number(selfState && selfState.kills || 0));
        if (String(matchState.gameMode || '') === 'tdm') {
            var teamId = String(selfState && selfState.teamId || '');
            var teamProgress = Number(matchState.teamProgress && matchState.teamProgress[teamId] || 0);
            var enemyTeamId = teamId === 'alpha' ? 'bravo' : 'alpha';
            var enemyProgress = Number(matchState.teamProgress && matchState.teamProgress[enemyTeamId] || 0);
            killCounterEl.textContent = 'Kills: ' + ownKills + ' | Team: ' + teamProgress.toFixed(1) + ' / ' + enemyProgress.toFixed(1);
            return;
        }
        killCounterEl.textContent = 'Kills: ' + ownKills + ' | Lead: ' + Number(matchState.leaderProgress || 0).toFixed(0) + ' / ' + Number(matchState.targetProgress || 0).toFixed(0);
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

    GameUI.showDamageNumber = function (worldPoint, damage, isKill, camera, hitType, options) {
        options = options || {};
        var projected = worldPoint.clone().project(camera);
        var x = (projected.x * 0.5 + 0.5) * window.innerWidth;
        var y = (-projected.y * 0.5 + 0.5) * window.innerHeight;
        if (projected.z > 1) return;
        damage = Math.max(0, Math.round(Number(damage) || 0));

        var className = 'damage-number';
        if (isKill) className += ' kill';
        if (hitType === 'head') className += ' headshot';

        var el = document.createElement('div');
        el.className = className;
        el.textContent = isKill ? ('-' + damage + ' KILL!') : ('-' + damage);
        el.style.left = x + 'px';
        el.style.top = y + 'px';
        el.style.marginLeft = ((Math.random() - 0.5) * (Number(options.spreadX) || 40)) + 'px';
        el.style.marginTop = ((Math.random() - 0.5) * (Number(options.spreadY) || 0)) + 'px';

        damageNumbersEl.appendChild(el);
        setTimeout(function () {
            if (el.parentNode) el.parentNode.removeChild(el);
        }, 1000);
    };

    GameUI.setDebugInfo = function (text) {
        if (!debugInfoEl) return;
        debugInfoEl.textContent = text || '';
    };

    GameUI.setDebugVisuals = function (enabled) {
        debugVisualsOn = !!enabled;
        if (!shotgunReticleEl) return;
        var dots = shotgunReticleEl.querySelectorAll('.pellet-dot');
        for (var i = 0; i < dots.length; i++) {
            dots[i].style.display = debugVisualsOn ? 'block' : 'none';
        }
        if (bloomReticle && bloomReticle.setDebugEnabled) {
            bloomReticle.setDebugEnabled(debugVisualsOn);
        } else if (bloomReticleEl && !debugVisualsOn) {
            bloomReticleEl.style.display = 'none';
        }
    };

    GameUI.updateSeekerReticle = function (visible, hasTarget, halfAngleDeg, viewInfo) {
        if (!seekerReticleEl) return;
        if (!visible) {
            seekerReticleEl.style.display = 'none';
            return;
        }

        var size = 80;
        if (halfAngleDeg && viewInfo && viewInfo.fov && viewInfo.aspect) {
            var halfAngleRad = halfAngleDeg * Math.PI / 180;
            var vFovRad = viewInfo.fov * Math.PI / 180;
            var tanHalf = Math.tan(halfAngleRad);
            var tanV = Math.tan(vFovRad * 0.5);
            if (isFinite(tanHalf) && isFinite(tanV) && tanV > 0.000001) {
                var aspect = Math.max(0.0001, viewInfo.aspect);
                var xNdc = tanHalf / (tanV * aspect);
                var yNdc = tanHalf / tanV;
                var dx = Math.max(30, Math.min(window.innerWidth * 0.35, xNdc * window.innerWidth * 0.5));
                var dy = Math.max(30, Math.min(window.innerHeight * 0.35, yNdc * window.innerHeight * 0.5));
                size = Math.round(Math.min(dx, dy) * 2);
            }
        }
        size = Math.max(50, Math.min(400, size));

        seekerReticleEl.style.display = 'block';
        seekerReticleEl.style.width = size + 'px';
        seekerReticleEl.style.height = size + 'px';
        seekerReticleEl.style.left = Math.round(window.innerWidth * 0.5) + 'px';
        seekerReticleEl.style.top = Math.round(window.innerHeight * 0.5) + 'px';

        if (hasTarget) {
            seekerReticleEl.classList.add('has-lock');
            if (seekerReticleLabelEl) seekerReticleLabelEl.style.display = 'block';
        } else {
            seekerReticleEl.classList.remove('has-lock');
            if (seekerReticleLabelEl) seekerReticleLabelEl.style.display = 'none';
        }
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
        if (weapon.singleHitFromPellets) {
            mode = 'SEMI';
        } else if (weapon.pellets && weapon.pellets > 1) {
            mode = weapon.pellets + ' PELLETS';
        }
        weaponInfoEl.textContent = weapon.name + ' | ' + mode + ' | ' +
            weapon.bodyDamage + '/' + weapon.headDamage + ' DMG';
    };

    GameUI.updateReticle = function (weapon, spec) {
        if (!crosshairEl || !bloomReticleEl || !shotgunReticleEl || !weapon) return;

        if (!(spec && spec.type === 'circle')) {
            crosshairEl.style.display = 'block';
            shotgunReticleEl.style.display = 'none';
            if (bloomReticle && bloomReticle.updateForWeapon) {
                bloomReticle.updateForWeapon(weapon, {
                    adsActive: !!(spec && spec.adsActive),
                    scoped: false
                });
            } else {
                bloomReticleEl.style.display = 'none';
            }
            return;
        }

        crosshairEl.style.display = 'none';
        if (bloomReticle && bloomReticle.hide) bloomReticle.hide();
        else bloomReticleEl.style.display = 'none';
        shotgunReticleEl.style.display = 'block';

        var size = (spec && spec.size) ? spec.size : 300;
        shotgunReticleEl.style.width = size + 'px';
        shotgunReticleEl.style.height = size + 'px';
    };

    GameUI.setHitscanTargetState = function (active) {
        if (crosshairEl) crosshairEl.classList.toggle('reticle-target-in-range', !!active);
    };

    GameUI.setShotgunTargetState = function (active) {
        if (shotgunReticleEl) shotgunReticleEl.classList.toggle('reticle-target-in-range', !!active);
    };

    GameUI.updateThrowableInfo = function (state) {
        if (!throwableInfoEl || !state) return;

        var GT = globalThis.__MAYHEM_RUNTIME.GameThrowables;
        var selectedId = (GT && GT.getSelectedThrowable) ? GT.getSelectedThrowable() : 'frag';
        var entry = state[selectedId];
        if (!entry) {
            throwableInfoEl.textContent = 'Q --';
            return;
        }
        var cd = entry.charges > 0 ? '' : (' (' + formatCooldown(entry.cooldownRemaining) + ')');
        throwableInfoEl.textContent = 'Q ' + entry.label + ': ' + entry.charges + cd;
    };

    GameUI.updateSniperScope = function (state) {
        if (!sniperScopeEl || !crosshairEl || !bloomReticleEl || !shotgunReticleEl) return;
        var isSniper = !!(state && state.sniper);
        var blend = Math.max(0, Math.min(1, Number(state && state.blend) || 0));
        var active = isSniper && blend > 0.02;

        sniperScopeEl.style.display = active ? 'block' : 'none';
        sniperScopeEl.style.opacity = active ? blend.toFixed(3) : '0';

        if (active) {
            crosshairEl.style.display = 'none';
            if (bloomReticle && bloomReticle.hide) bloomReticle.hide();
            else bloomReticleEl.style.display = 'none';
            shotgunReticleEl.style.display = 'none';
            return;
        }

        if (isSniper) {
            crosshairEl.style.display = 'block';
        }
    };

    GameUI.updatePlasmaState = function (_state) {};

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

        var duration = 1.15 + Math.min(0.65, damage / 90);
        damageTickTimers[sector] = Math.max(damageTickTimers[sector], duration);

        // Bleed to adjacent slices for smoother clock-like impact.
        var next = (sector + 1) % 12;
        var prev = (sector + 11) % 12;
        damageTickTimers[next] = Math.max(damageTickTimers[next], duration * 0.62);
        damageTickTimers[prev] = Math.max(damageTickTimers[prev], duration * 0.62);

        damageFlashLevel = Math.max(
            damageFlashLevel,
            0.28 + Math.min(0.42, damage / 120)
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
            var opacity = t * 0.84;
            damageTicks[i].style.opacity = opacity.toFixed(3);
        }

        if (damageFlashLevel > 0) {
            damageFlashLevel -= dt * 1.05;
            if (damageFlashLevel < 0) damageFlashLevel = 0;
        }

        if (damageVignetteEl) {
            damageVignetteEl.style.opacity = (damageFlashLevel * 0.62).toFixed(3);
        }
    };

    GameUI.getKillCount = function () {
        return killCount;
    };

    globalThis.__MAYHEM_RUNTIME.GameUI = GameUI;
})();
