/**
 * ui.js - HUD, damage numbers, reticles, and status text
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameUI
 */
(function () {
    'use strict';

    var runtime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    var inputLabels = runtime.GameInputLabels || null;
    var GameUI = {};

    var crosshairEl, pistolReticleEl, spreadReticleEl, shotgunReticleEl, plasmaReticleEl, plasmaCurveLeftEl, plasmaCurveRightEl, sniperScopeEl, chokeReticleEl, hookReticleEl, deadeyeDebugRectEl, deadeyeReticlesEl, hitmarkerEl, killCounterEl;
    var healthBarEl, healthTextEl, armorBarEl, damageNumbersEl, debugInfoEl, idleWarningEl, abilityDebugPanelEl;
    var trackingReticleEl, trackingReticleLabelEl;
    var combatRadarEl, combatRadarSlicesEl, combatRadarCoreEl, combatBeaconsEl;
    var combatBeaconEls = [];
    var weaponInfoEl, throwableInfoEl;
    var abilityInfoEl;
    var cooldownBarEl, cooldownStatusEl;
    var sprintSpeedLinesEl;
    var sprintSpeedLineEls = [];
    var damageVignetteEl, damageIndicatorEl;
    var damageTicks = [];
    var damageTickTimers = [];
    var damageFlashLevel = 0;
    var deadeyeReticlePool = [];
    var deadeyeProjectVec = new THREE.Vector3();
    var debugVisualsOn = false;
    var spreadReticle = null;
    var killCount = 0;

    var hitmarkerTimer = null;
    var HITMARKER_HOLD_MS = 45;
    var HITMARKER_FADE_SEC = 0.09;
    var lastAbilityInfoState = null;
    var lastThrowableInfoState = null;

    function sharedMatchRules() {
        return runtime &&
            runtime.GameShared &&
            runtime.GameShared.matchRules
            ? runtime.GameShared.matchRules
            : null;
    }

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

    function debugToneSpec(tone) {
        var id = String(tone || '');
        if (id === 'ability1') {
            return {
                border: 'rgba(126, 215, 255, 0.85)',
                glow: 'rgba(100, 180, 255, 0.35)',
                fill: 'rgba(100, 180, 255, 0.08)',
                text: '#b9ddff',
                surface: 'rgba(4, 12, 18, 0.9)'
            };
        }
        if (id === 'ability2') {
            return {
                border: 'rgba(118, 230, 142, 0.88)',
                glow: 'rgba(94, 212, 118, 0.34)',
                fill: 'rgba(82, 188, 104, 0.08)',
                text: '#c6ffd3',
                surface: 'rgba(4, 16, 8, 0.9)'
            };
        }
        if (id === 'throwable') {
            return {
                border: 'rgba(255, 166, 94, 0.9)',
                glow: 'rgba(255, 130, 72, 0.34)',
                fill: 'rgba(255, 140, 70, 0.08)',
                text: '#ffd2ad',
                surface: 'rgba(22, 10, 4, 0.9)'
            };
        }
        return {
            border: 'rgba(244, 246, 248, 0.82)',
            glow: 'rgba(255, 255, 255, 0.22)',
            fill: 'rgba(255, 255, 255, 0.06)',
            text: '#f2f5f7',
            surface: 'rgba(10, 12, 14, 0.9)'
        };
    }

    function applyOverlayTone(el, tone, options) {
        if (!el) return;
        var spec = debugToneSpec(tone);
        options = options || {};
        el.style.borderColor = spec.border;
        el.style.boxShadow = '0 0 14px ' + spec.glow + ', inset 0 0 8px ' + spec.fill;
        if (options.useBackground) {
            el.style.background = spec.fill;
        }
    }

    function ensurePlasmaReticleDecorations() {
        if (!plasmaReticleEl || plasmaReticleEl.__decorated) return;
        var left = document.createElement('div');
        left.className = 'plasma-reticle-curve left';
        plasmaReticleEl.appendChild(left);
        var right = document.createElement('div');
        right.className = 'plasma-reticle-curve right';
        plasmaReticleEl.appendChild(right);
        plasmaReticleEl.__curveLeft = left;
        plasmaReticleEl.__curveRight = right;
        plasmaReticleEl.__decorated = true;
    }

    function clearChildren(el) {
        if (!el) return;
        if (typeof el.replaceChildren === 'function') {
            el.replaceChildren();
            return;
        }
        if (Array.isArray(el.children)) {
            el.children.length = 0;
        }
        el.textContent = '';
        el.innerHTML = '';
    }

    function appendWeaponInfoLine(text, className) {
        if (!weaponInfoEl) return;
        var line = document.createElement('div');
        line.className = className;
        line.textContent = String(text || '');
        weaponInfoEl.appendChild(line);
    }

    GameUI.init = function () {
        crosshairEl = document.getElementById('crosshair');
        pistolReticleEl = document.getElementById('pistol-reticle');
        spreadReticleEl = document.getElementById('spread-reticle');
        spreadReticle = (globalThis.__MAYHEM_RUNTIME.GameSpreadReticle && globalThis.__MAYHEM_RUNTIME.GameSpreadReticle.create)
            ? globalThis.__MAYHEM_RUNTIME.GameSpreadReticle.create(spreadReticleEl)
            : null;
        shotgunReticleEl = document.getElementById('shotgun-reticle');
        plasmaReticleEl = document.getElementById('plasma-reticle');
        ensurePlasmaReticleDecorations();
        plasmaCurveLeftEl = plasmaReticleEl ? plasmaReticleEl.__curveLeft || null : null;
        plasmaCurveRightEl = plasmaReticleEl ? plasmaReticleEl.__curveRight || null : null;
        sniperScopeEl = document.getElementById('sniper-scope');
        chokeReticleEl = document.getElementById('choke-reticle');
        hookReticleEl = document.getElementById('hook-reticle');
        deadeyeDebugRectEl = document.getElementById('deadeye-debug-rect');
        deadeyeReticlesEl = document.getElementById('deadeye-reticles');
        hitmarkerEl = document.getElementById('hitmarker');
        killCounterEl = document.getElementById('kill-counter');
        healthBarEl = document.getElementById('health-bar');
        healthTextEl = document.getElementById('health-text');
        armorBarEl = document.getElementById('armor-bar');
        damageNumbersEl = document.getElementById('damage-numbers');
        debugInfoEl = document.getElementById('debug-info');
        idleWarningEl = document.getElementById('idle-warning');
        abilityDebugPanelEl = document.getElementById('ability-debug-panel');
        trackingReticleEl = document.getElementById('tracking-reticle');
        trackingReticleLabelEl = document.getElementById('tracking-reticle-label');
        combatRadarEl = document.getElementById('combat-radar');
        combatRadarSlicesEl = document.getElementById('combat-radar-slices');
        combatRadarCoreEl = document.getElementById('combat-radar-core');
        combatBeaconsEl = document.getElementById('combat-beacons');
        combatBeaconEls = [];
        weaponInfoEl = document.getElementById('weapon-info');
        throwableInfoEl = document.getElementById('throwable-info');
        abilityInfoEl = document.getElementById('ability-info');
        cooldownBarEl = document.getElementById('cooldown-bar');
        cooldownStatusEl = document.getElementById('cooldown-status');
        sprintSpeedLinesEl = document.getElementById('sprint-speed-lines');
        damageVignetteEl = document.getElementById('damage-vignette');
        damageIndicatorEl = document.getElementById('damage-indicator');

        GameUI.updateMatchStatus(null, null);

        damageTicks = [];
        damageTickTimers = [];
        damageFlashLevel = 0;
        GameUI.setIdleWarning('');
        if (runtime.GameInputBindings && runtime.GameInputBindings.subscribe) {
            runtime.GameInputBindings.subscribe(function () {
                if (lastAbilityInfoState) GameUI.updateAbilityInfo(lastAbilityInfoState);
                if (lastThrowableInfoState) GameUI.updateThrowableInfo(lastThrowableInfoState);
            });
        }

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
            for (var b = 0; b < 4; b++) {
                var beacon = document.createElement('div');
                beacon.className = 'combat-beacon-dot';
                combatBeaconsEl.appendChild(beacon);
                combatBeaconEls.push(beacon);
            }
        }

        deadeyeReticlePool = [];
        sprintSpeedLineEls = [];
        if (sprintSpeedLinesEl) {
            sprintSpeedLinesEl.innerHTML = '';
            var speedLineSpecs = [
                { side: 'left', top: '14%', delay: '0.00s', duration: '0.78s' },
                { side: 'left', top: '30%', delay: '0.18s', duration: '0.88s' },
                { side: 'left', top: '68%', delay: '0.11s', duration: '0.82s' },
                { side: 'left', top: '84%', delay: '0.27s', duration: '0.92s' },
                { side: 'right', top: '18%', delay: '0.09s', duration: '0.86s' },
                { side: 'right', top: '38%', delay: '0.23s', duration: '0.8s' },
                { side: 'right', top: '62%', delay: '0.05s', duration: '0.9s' },
                { side: 'right', top: '82%', delay: '0.31s', duration: '0.84s' }
            ];
            for (var s = 0; s < speedLineSpecs.length; s++) {
                var spec = speedLineSpecs[s];
                var line = document.createElement('div');
                line.className = 'sprint-speed-line ' + spec.side;
                line.style.top = spec.top;
                line.style.animationDelay = spec.delay;
                line.style.animationDuration = spec.duration;
                sprintSpeedLinesEl.appendChild(line);
                sprintSpeedLineEls.push(line);
            }
        }
    };

    GameUI.showHitMarker = function () {
        hitmarkerEl.style.transition = 'none';
        hitmarkerEl.style.opacity = '1';
        hitmarkerEl.style.color = '#ffffff';
        hitmarkerEl.style.fontSize = '28px';
        if (hitmarkerTimer) clearTimeout(hitmarkerTimer);
        hitmarkerTimer = setTimeout(function () {
            hitmarkerEl.style.transition = 'opacity ' + HITMARKER_FADE_SEC + 's ease-out';
            hitmarkerEl.style.opacity = '0';
            hitmarkerEl.style.color = '#ff0000';
            hitmarkerEl.style.fontSize = '28px';
            hitmarkerTimer = null;
        }, HITMARKER_HOLD_MS);
    };

    GameUI.showPredictedHitMarker = function () {
        hitmarkerEl.style.transition = 'none';
        hitmarkerEl.style.opacity = '1';
        hitmarkerEl.style.color = '#dfe9ff';
        hitmarkerEl.style.fontSize = '28px';
        if (hitmarkerTimer) clearTimeout(hitmarkerTimer);
        hitmarkerTimer = setTimeout(function () {
            hitmarkerEl.style.transition = 'opacity ' + HITMARKER_FADE_SEC + 's ease-out';
            hitmarkerEl.style.opacity = '0';
            hitmarkerEl.style.color = '#ff0000';
            hitmarkerEl.style.fontSize = '28px';
            hitmarkerTimer = null;
        }, HITMARKER_HOLD_MS);
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

    GameUI.updateMatchStatus = function (matchState, selfState) {
        killCount = Math.max(0, Number(selfState && selfState.kills || 0));
        if (!killCounterEl) return;
        var matchRules = sharedMatchRules();
        if (matchRules && matchRules.formatMatchHudCounter) {
            killCounterEl.textContent = matchRules.formatMatchHudCounter(matchState, selfState);
            return;
        }
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

    GameUI.showDamageNumber = function (worldPoint, damage, isKill, camera, hitType, options) {
        options = options || {};
        if (!damageNumbersEl || !worldPoint || !camera || !worldPoint.clone || !camera.isCamera) return;
        var projected = worldPoint.clone().project(camera);
        if (!isFinite(projected.x) || !isFinite(projected.y) || !isFinite(projected.z)) return;
        if (projected.z < -1 || projected.z > 1) return;
        var x = (projected.x * 0.5 + 0.5) * window.innerWidth;
        var y = (-projected.y * 0.5 + 0.5) * window.innerHeight;
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

    GameUI.setIdleWarning = function (text) {
        if (!idleWarningEl) return;
        var nextText = String(text || '').trim();
        idleWarningEl.textContent = nextText;
        idleWarningEl.hidden = !nextText;
    };

    GameUI.setDebugVisuals = function (enabled) {
        debugVisualsOn = !!enabled;
        if (!shotgunReticleEl) return;
        if (spreadReticle && spreadReticle.setDebugEnabled) {
            spreadReticle.setDebugEnabled(debugVisualsOn);
        } else if (spreadReticleEl && !debugVisualsOn) {
            spreadReticleEl.style.display = 'none';
        }
        if (!debugVisualsOn) {
            if (plasmaReticleEl) plasmaReticleEl.style.display = 'none';
            if (chokeReticleEl) chokeReticleEl.style.display = 'none';
            if (hookReticleEl) hookReticleEl.style.display = 'none';
            if (deadeyeDebugRectEl) deadeyeDebugRectEl.style.display = 'none';
            if (abilityDebugPanelEl) {
                abilityDebugPanelEl.style.display = 'none';
                abilityDebugPanelEl.textContent = '';
            }
        }
    };

    GameUI.updateTrackingReticle = function (visible, hasTarget, halfAngleDeg, viewInfo) {
        if (!trackingReticleEl) return;
        if (!visible) {
            trackingReticleEl.style.display = 'none';
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

        trackingReticleEl.style.display = 'block';
        trackingReticleEl.style.width = size + 'px';
        trackingReticleEl.style.height = size + 'px';
        trackingReticleEl.style.left = Math.round(window.innerWidth * 0.5) + 'px';
        trackingReticleEl.style.top = Math.round(window.innerHeight * 0.5) + 'px';

        if (hasTarget) {
            trackingReticleEl.classList.add('has-lock');
            if (trackingReticleLabelEl) trackingReticleLabelEl.style.display = 'block';
        } else {
            trackingReticleEl.classList.remove('has-lock');
            if (trackingReticleLabelEl) trackingReticleLabelEl.style.display = 'none';
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
            var alpha = (intensity > 0 ? (0.14 + intensity * 0.64) : 0.04).toFixed(3);
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

    GameUI.updateCooldown = function (state) {
        if (!cooldownBarEl || !cooldownStatusEl) return;
        var status = String(state && state.status || 'ready');
        var pct = Math.max(0, Math.min(1, Number(state && state.pct != null ? state.pct : 1)));
        var phase = String(state && state.phase || 'ready');
        cooldownBarEl.style.width = (pct * 100) + '%';
        if (status === 'reloading') {
            if (phase === 'raise') {
                cooldownBarEl.style.background = '#ff8b3d';
                cooldownStatusEl.textContent = 'RELOAD :: RAISE';
                cooldownStatusEl.style.color = '#ff8b3d';
            } else if (phase === 'settle') {
                cooldownBarEl.style.background = '#ffc04d';
                cooldownStatusEl.textContent = 'RELOAD :: SETTLE';
                cooldownStatusEl.style.color = '#ffc04d';
            } else {
                cooldownBarEl.style.background = '#ff5c5c';
                cooldownStatusEl.textContent = 'RELOAD :: MANIPULATE';
                cooldownStatusEl.style.color = '#ff5c5c';
            }
        } else if (status === 'reloaded') {
            cooldownBarEl.style.background = '#4CAF50';
            cooldownStatusEl.textContent = 'RELOAD COMPLETE';
            cooldownStatusEl.style.color = '#4CAF50';
        } else if (status === 'cooldown') {
            cooldownBarEl.style.background = '#FFC107';
            cooldownStatusEl.textContent = 'COOLDOWN';
            cooldownStatusEl.style.color = '#FFC107';
        } else {
            cooldownBarEl.style.background = '#4CAF50';
            cooldownStatusEl.textContent = 'READY';
            cooldownStatusEl.style.color = '#4CAF50';
        }
    };

    GameUI.updateWeaponInfo = function (weapon) {
        if (!weaponInfoEl || !weapon) return;
        var mode = weapon.automatic ? 'AUTO' : 'SEMI';
        if (weapon.pellets && weapon.pellets > 1) {
            mode = weapon.pellets + ' PELLETS';
        }
        var ammoText = 'NO AMMO';
        if (weapon.magazineSize && weapon.magazineSize > 0) {
            ammoText = Math.max(0, Number(weapon.ammoInMag || 0)) + '/' + Math.max(1, Number(weapon.magazineSize || 1));
        }
        clearChildren(weaponInfoEl);
        appendWeaponInfoLine(weapon.name, 'weapon-line weapon-line-name');
        appendWeaponInfoLine(ammoText, 'weapon-line weapon-line-ammo');
        appendWeaponInfoLine(mode + ' | ' + weapon.bodyDamage + '/' + weapon.headDamage + ' DMG', 'weapon-line weapon-line-meta');
    };

    GameUI.updateAbilityInfo = function (state) {
        if (!abilityInfoEl || !state) return;
        lastAbilityInfoState = state;

        if (typeof state === 'string') {
            abilityInfoEl.textContent = state;
            return;
        }

        function fmtCd(seconds) {
            if (!seconds || seconds <= 0) return 'READY';
            if (seconds >= 10) return Math.ceil(seconds) + 's';
            return seconds.toFixed(1) + 's';
        }

        var ability = inputLabels.getBindingLabel('ability_1', 'E') + ' ' + (state.abilityName || 'Ability') + ': ' + fmtCd(state.cooldown);
        var extra = state.extra ? (' | ' + state.extra) : '';
        abilityInfoEl.textContent = ability + extra;
    };

    GameUI.updateReticle = function (weapon, spec, adsState) {
        if (!crosshairEl || !spreadReticleEl || !shotgunReticleEl || !weapon) return;

        var isSniper = !!(adsState && adsState.sniper);
        var blend = Math.max(0, Math.min(1, Number(adsState && adsState.blend) || 0));
        var scoped = isSniper && blend > 0.02;
        var hitscan = globalThis.__MAYHEM_RUNTIME.GameHitscan || null;

        if (sniperScopeEl) {
            sniperScopeEl.style.display = scoped ? 'block' : 'none';
            sniperScopeEl.style.opacity = scoped ? blend.toFixed(3) : '0';
        }

        if (scoped) {
            crosshairEl.style.display = 'none';
            if (pistolReticleEl) pistolReticleEl.style.display = 'none';
            if (spreadReticle && spreadReticle.hide) spreadReticle.hide();
            else spreadReticleEl.style.display = 'none';
            shotgunReticleEl.style.display = 'none';
            return;
        }

        if (!(spec && spec.type === 'circle')) {
            crosshairEl.style.display = 'block';
            shotgunReticleEl.style.display = 'none';
            if (pistolReticleEl) {
                var spreadMetrics = weapon.id === 'pistol' && hitscan && hitscan.getSpreadMetrics
                    ? hitscan.getSpreadMetrics(weapon.id)
                    : null;
                var pistolDiameterX = Math.max(0, Number(spreadMetrics && spreadMetrics.radiusXpx || spreadMetrics && spreadMetrics.radiusPx || 0) * 2);
                var pistolDiameterY = Math.max(0, Number(spreadMetrics && spreadMetrics.radiusYpx || spreadMetrics && spreadMetrics.radiusPx || 0) * 2);
                if (weapon.id === 'pistol' && pistolDiameterX > 2 && pistolDiameterY > 2) {
                    pistolReticleEl.style.display = 'block';
                    pistolReticleEl.style.width = Math.round(pistolDiameterX) + 'px';
                    pistolReticleEl.style.height = Math.round(pistolDiameterY) + 'px';
                } else {
                    pistolReticleEl.style.display = 'none';
                }
            }
            if (spreadReticle && spreadReticle.updateForWeapon) {
                spreadReticle.updateForWeapon(weapon, {
                    adsActive: !!(adsState && adsState.active),
                    scoped: scoped
                });
            } else {
                spreadReticleEl.style.display = 'none';
            }
            return;
        }

        crosshairEl.style.display = 'none';
        if (pistolReticleEl) pistolReticleEl.style.display = 'none';
        if (spreadReticle && spreadReticle.hide) spreadReticle.hide();
        else spreadReticleEl.style.display = 'none';
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
        lastThrowableInfoState = state;

        var GT = globalThis.__MAYHEM_RUNTIME.GameThrowables;
        var selectedId = (GT && GT.getSelectedThrowable) ? GT.getSelectedThrowable() : 'frag';
        var entry = state[selectedId];
        if (!entry) {
            throwableInfoEl.textContent = inputLabels.getBindingLabel('throwable', 'Q') + ' --';
            return;
        }
        var cd = entry.charges > 0 ? '' : (' (' + formatCooldown(entry.cooldownRemaining) + ')');
        throwableInfoEl.textContent = inputLabels.getBindingLabel('throwable', 'Q') + ' ' + entry.label + ': ' + entry.charges + cd;
    };

    GameUI.updatePlasmaState = function (state) {
        if (!plasmaReticleEl) return;
        if (!state || !state.visible) {
            plasmaReticleEl.style.display = 'none';
            return;
        }
        var size = Math.max(24, Math.round(Number(state.diameterPx || 120)));
        var curveStrength = Math.max(0, Math.min(1, Number(state.curveStrength || 0)));
        var curveWidth = Math.max(30, Math.round(size * (0.42 + (curveStrength * 0.34))));
        var curveHeight = Math.max(18, Math.round(size * (0.18 + (curveStrength * 0.3))));
        applyOverlayTone(plasmaReticleEl, state.tone || 'throwable', { useBackground: false });
        plasmaReticleEl.style.width = size + 'px';
        plasmaReticleEl.style.height = size + 'px';
        plasmaReticleEl.style.display = 'block';
        if (plasmaCurveLeftEl) {
            plasmaCurveLeftEl.style.width = curveWidth + 'px';
            plasmaCurveLeftEl.style.height = curveHeight + 'px';
        }
        if (plasmaCurveRightEl) {
            plasmaCurveRightEl.style.width = curveWidth + 'px';
            plasmaCurveRightEl.style.height = curveHeight + 'px';
        }
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

    GameUI.updateSprintEffects = function (state) {
        if (!sprintSpeedLinesEl) return;
        state = state || {};
        var intensity = Math.max(0, Math.min(1, Number(state.intensity || 0)));
        var blocked = !!state.adsActive || !!state.scopeActive || !!state.sniper || !!state.hidden;
        if (intensity <= 0.03 || blocked) {
            sprintSpeedLinesEl.style.display = 'none';
            sprintSpeedLinesEl.style.opacity = '0';
            return;
        }

        sprintSpeedLinesEl.style.display = 'block';
        sprintSpeedLinesEl.style.opacity = (0.16 + (intensity * 0.52)).toFixed(3);
        for (var i = 0; i < sprintSpeedLineEls.length; i++) {
            var line = sprintSpeedLineEls[i];
            var weight = 0.55 + (((i % 4) / 4) * 0.45);
            line.style.opacity = (0.12 + (intensity * weight * 0.78)).toFixed(3);
            line.style.width = Math.round(140 + (intensity * (110 + ((i % 3) * 24)))) + 'px';
        }
    };

    GameUI.updateChokeReticle = function (visible, widthPx, heightPx) {
        if (!chokeReticleEl) return;
        if (!visible) {
            chokeReticleEl.style.display = 'none';
            return;
        }
        chokeReticleEl.style.width = Math.round(widthPx || 60) + 'px';
        chokeReticleEl.style.height = Math.round(heightPx || 180) + 'px';
        applyOverlayTone(chokeReticleEl, arguments[3], { useBackground: false });
        chokeReticleEl.style.display = 'block';
    };

    GameUI.updateHookReticle = function (visible, diameterPx) {
        if (!hookReticleEl) return;
        if (!visible) {
            hookReticleEl.style.display = 'none';
            return;
        }
        var size = diameterPx || 104;
        hookReticleEl.style.width = size + 'px';
        hookReticleEl.style.height = size + 'px';
        applyOverlayTone(hookReticleEl, arguments[2], { useBackground: false });
        hookReticleEl.style.display = 'block';
    };

    GameUI.updateDeadeyeDebugRect = function (visible, widthPx, heightPx) {
        if (!deadeyeDebugRectEl) return;
        if (!visible) {
            deadeyeDebugRectEl.style.display = 'none';
            return;
        }
        deadeyeDebugRectEl.style.width = Math.round(widthPx || 220) + 'px';
        deadeyeDebugRectEl.style.height = Math.round(heightPx || 160) + 'px';
        applyOverlayTone(deadeyeDebugRectEl, arguments[3], { useBackground: true });
        deadeyeDebugRectEl.style.display = 'block';
    };

    GameUI.updateAbilityDebugPanel = function (visible, payload) {
        if (!abilityDebugPanelEl) return;
        if (!visible || !payload || (Array.isArray(payload) && payload.length === 0)) {
            abilityDebugPanelEl.style.display = 'none';
            abilityDebugPanelEl.textContent = '';
            abilityDebugPanelEl.innerHTML = '';
            return;
        }
        if (typeof payload === 'string') {
            abilityDebugPanelEl.textContent = payload;
            abilityDebugPanelEl.style.display = 'block';
            return;
        }
        if (abilityDebugPanelEl.replaceChildren) {
            abilityDebugPanelEl.replaceChildren();
        } else {
            abilityDebugPanelEl.innerHTML = '';
            if (Array.isArray(abilityDebugPanelEl.children)) abilityDebugPanelEl.children.length = 0;
        }
        for (var i = 0; i < payload.length; i++) {
            var section = payload[i];
            if (!section) continue;
            var tone = debugToneSpec(section.tone);
            var node = document.createElement('div');
            node.className = 'ability-debug-section tone-' + String(section.tone || 'weapon');
            node.style.borderColor = tone.border;
            node.style.background = tone.surface;
            node.style.color = tone.text;

            var title = document.createElement('div');
            title.className = 'ability-debug-title';
            title.textContent = String(section.title || '');
            node.appendChild(title);

            if (section.body) {
                var body = document.createElement('div');
                body.className = 'ability-debug-body';
                body.textContent = String(section.body || '');
                node.appendChild(body);
            }
            abilityDebugPanelEl.appendChild(node);
        }
        abilityDebugPanelEl.style.display = 'block';
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

    globalThis.__MAYHEM_RUNTIME.GameUI = GameUI;
})();
