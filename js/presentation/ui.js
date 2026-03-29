/**
 * ui.js - HUD, damage numbers, reticles, and status text
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameUI
 */
(function () {
    'use strict';

    var runtime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    var inputLabels = runtime.GameInputLabels || null;
    var GameUI = {};

    var crosshairEl, pistolReticleEl, spreadReticleEl, shotgunReticleEl, plasmaReticleEl, sniperScopeEl, hitmarkerEl, killCounterEl;
    var plasmaReticleRings = [];
    var healthBarEl, healthTextEl, armorBarEl, damageNumbersEl, debugInfoEl, idleWarningEl;
    var trackingReticleEl, trackingReticleLabelEl;
    var combatRadarEl, combatRadarSlicesEl, combatRadarCoreEl, combatBeaconsEl;
    var combatBeaconEls = [];
    var weaponInfoEl, throwableInfoEl;
    var cooldownBarEl, cooldownStatusEl;
    var extraLifeBarContainer, extraLifeValue, extraLifeFill;
    var sprintSpeedLinesEl;
    var sprintSpeedLineEls = [];
    var damageVignetteEl, damageIndicatorEl;
    var damageTicks = [];
    var damageTickTimers = [];
    var damageFlashLevel = 0;
    var debugVisualsOn = false;
    var spreadReticle = null;
    var killCount = 0;

    var hitmarkerTimer = null;
    var HITMARKER_HOLD_MS = 45;
    var HITMARKER_FADE_SEC = 0.09;
    var lastThrowableInfoState = null;
    var inputBindingsUnsubscribe = null;

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

    function ensurePlasmaReticleRings() {
        if (!plasmaReticleEl) return;
        while (plasmaReticleRings.length < 1) {
            var ring = document.createElement('div');
            ring.className = 'plasma-reticle-ring';
            plasmaReticleEl.appendChild(ring);
            plasmaReticleRings.push(ring);
        }
    }

    function appendWeaponInfoLine(text, className) {
        if (!weaponInfoEl) return;
        var line = document.createElement('div');
        line.className = className;
        line.textContent = String(text || '');
        weaponInfoEl.appendChild(line);
    }

    GameUI.init = function () {
        if (inputBindingsUnsubscribe) {
            inputBindingsUnsubscribe();
            inputBindingsUnsubscribe = null;
        }
        crosshairEl = document.getElementById('crosshair');
        pistolReticleEl = document.getElementById('pistol-reticle');
        spreadReticleEl = document.getElementById('spread-reticle');
        spreadReticle = (globalThis.__MAYHEM_RUNTIME.GameSpreadReticle && globalThis.__MAYHEM_RUNTIME.GameSpreadReticle.create)
            ? globalThis.__MAYHEM_RUNTIME.GameSpreadReticle.create(spreadReticleEl)
            : null;
        shotgunReticleEl = document.getElementById('shotgun-reticle');
        plasmaReticleEl = document.getElementById('plasma-reticle');
        plasmaReticleRings = [];
        ensurePlasmaReticleRings();
        sniperScopeEl = document.getElementById('sniper-scope');
        hitmarkerEl = document.getElementById('hitmarker');
        killCounterEl = document.getElementById('kill-counter');
        healthBarEl = document.getElementById('health-bar');
        healthTextEl = document.getElementById('health-text');
        armorBarEl = document.getElementById('armor-bar');
        damageNumbersEl = document.getElementById('damage-numbers');
        debugInfoEl = document.getElementById('debug-info');
        idleWarningEl = document.getElementById('idle-warning');
        trackingReticleEl = document.getElementById('tracking-reticle');
        trackingReticleLabelEl = document.getElementById('tracking-reticle-label');
        combatRadarEl = document.getElementById('combat-radar');
        combatRadarSlicesEl = document.getElementById('combat-radar-slices');
        combatRadarCoreEl = document.getElementById('combat-radar-core');
        combatBeaconsEl = document.getElementById('combat-beacons');
        combatBeaconEls = [];
        weaponInfoEl = document.getElementById('weapon-info');
        throwableInfoEl = document.getElementById('throwable-info');
        cooldownBarEl = document.getElementById('cooldown-bar');
        cooldownStatusEl = document.getElementById('cooldown-status');
        extraLifeBarContainer = document.getElementById('extra-life-bar-container');
        extraLifeValue = document.getElementById('extra-life-value');
        extraLifeFill = document.getElementById('extra-life-fill');
        sprintSpeedLinesEl = document.getElementById('sprint-speed-lines');
        damageVignetteEl = document.getElementById('damage-vignette');
        damageIndicatorEl = document.getElementById('damage-indicator');

        GameUI.updateMatchStatus(null, null);
        GameUI.updateExtraLifeProgress(0);

        damageTicks = [];
        damageTickTimers = [];
        damageFlashLevel = 0;
        GameUI.setIdleWarning('');
        if (runtime.GameInputBindings && runtime.GameInputBindings.subscribe) {
            inputBindingsUnsubscribe = runtime.GameInputBindings.subscribe(function () {
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

    GameUI.resetGameplayHud = function () {
        if (hitmarkerTimer) {
            clearTimeout(hitmarkerTimer);
            hitmarkerTimer = null;
        }
        killCount = 0;
        lastThrowableInfoState = null;
        damageFlashLevel = 0;
        debugVisualsOn = false;

        hidePrimaryReticles();
        updateSniperScope(false, 0);
        setReticleSetTargetClass('crosshair', false);
        if (plasmaReticleEl) plasmaReticleEl.style.display = 'none';
        if (trackingReticleEl) trackingReticleEl.style.display = 'none';
        if (trackingReticleLabelEl) trackingReticleLabelEl.style.display = 'none';
        if (combatRadarEl) combatRadarEl.style.display = 'none';
        if (combatRadarSlicesEl) combatRadarSlicesEl.style.background = '';
        if (combatRadarCoreEl) {
            combatRadarCoreEl.style.background = '';
            combatRadarCoreEl.style.boxShadow = '';
        }
        for (var i = 0; i < combatBeaconEls.length; i++) {
            if (combatBeaconEls[i]) combatBeaconEls[i].style.display = 'none';
        }
        if (weaponInfoEl) clearChildren(weaponInfoEl);
        if (throwableInfoEl) throwableInfoEl.textContent = '';
        if (cooldownBarEl) {
            cooldownBarEl.style.width = '0%';
            cooldownBarEl.style.background = '';
        }
        if (cooldownStatusEl) {
            cooldownStatusEl.textContent = '';
            cooldownStatusEl.style.color = '';
        }
        if (sprintSpeedLinesEl) {
            sprintSpeedLinesEl.style.display = 'none';
            sprintSpeedLinesEl.style.opacity = '0';
        }
        if (hitmarkerEl) {
            hitmarkerEl.style.transition = 'none';
            hitmarkerEl.style.opacity = '0';
            hitmarkerEl.style.color = '#ff0000';
            hitmarkerEl.style.fontSize = '28px';
        }
        if (killCounterEl) killCounterEl.textContent = '';
        if (damageNumbersEl) clearChildren(damageNumbersEl);
        if (debugInfoEl) debugInfoEl.textContent = '';
        GameUI.setIdleWarning('');
        if (healthBarEl) {
            healthBarEl.style.width = '100%';
            healthBarEl.style.background = '#4CAF50';
        }
        if (healthTextEl) healthTextEl.textContent = 'HP: 0';
        if (armorBarEl) armorBarEl.style.width = '0%';
        if (damageVignetteEl) damageVignetteEl.style.opacity = '0';
        if (damageIndicatorEl) {
            for (var tickIndex = 0; tickIndex < damageTickTimers.length; tickIndex++) {
                damageTickTimers[tickIndex] = 0;
            }
        }
        GameUI.updateDamageEffects(0);
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
        if (!matchState && !selfState) {
            killCounterEl.textContent = '';
            return;
        }
        var stockMode = !!(matchState && matchState.stockMode) || Number(selfState && selfState.maxStocks || 0) > 0;
        if (stockMode) {
            var lives = Math.max(0, Number(selfState && selfState.stocksRemaining || 0));
            var maxLives = Math.max(lives, Number(selfState && selfState.maxStocks || 0));
            var aliveCount = Math.max(0, Number(matchState && matchState.aliveCount || 0));
            killCounterEl.innerHTML =
                '<div class="match-pill-row">' +
                    '<div class="match-pill"><span class="match-pill-label">LIVES</span><span class="match-pill-value">' + lives + '</span></div>' +
                    '<div class="match-pill"><span class="match-pill-label">ALIVE</span><span class="match-pill-value">' + aliveCount + '</span></div>' +
                '</div>';
            GameUI.updateExtraLifeProgress(selfState && selfState.extraLifeProgressPct || 0);
            return;
        }
        var matchRules = sharedMatchRules();
        if (matchRules && matchRules.formatMatchHudCounter) {
            GameUI.updateExtraLifeProgress(0);
            killCounterEl.textContent = matchRules.formatMatchHudCounter(matchState, selfState);
            return;
        }
        killCounterEl.textContent = 'Kills: ' + killCount;
        GameUI.updateExtraLifeProgress(0);
    };

    GameUI.updateExtraLifeProgress = function (pct) {
        if (!extraLifeBarContainer) return;
        var p = Math.max(0, Math.min(100, Number(pct) || 0));
        extraLifeBarContainer.style.display = p > 0 ? 'flex' : 'none';
        if (extraLifeValue) extraLifeValue.textContent = Math.round(p) + '%';
        if (extraLifeFill) extraLifeFill.style.width = p.toFixed(1) + '%';
    };

    GameUI.updateHealth = function (hp, maxHp) {
        var pct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
        healthBarEl.style.width = pct + '%';
        healthTextEl.textContent = 'HP ' + Math.ceil(hp);

        if (pct > 60) {
            healthBarEl.style.background = '#3CB8FF';
        } else if (pct > 30) {
            healthBarEl.style.background = '#FFCC00';
        } else {
            healthBarEl.style.background = '#FF3B3B';
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
        if (status === 'overheated') {
            cooldownBarEl.style.background = '#FF5A3D';
            cooldownStatusEl.textContent = 'OVERHEAT';
            cooldownStatusEl.style.color = '#FF5A3D';
        } else
        if (status === 'reloading') {
            if (phase === 'present' || phase === 'raise') {
                cooldownBarEl.style.background = '#FF9B00';
                cooldownStatusEl.textContent = 'RELOAD :: PRESENT';
                cooldownStatusEl.style.color = '#FF9B00';
            } else if (phase === 'recover' || phase === 'settle') {
                cooldownBarEl.style.background = '#FFCC00';
                cooldownStatusEl.textContent = 'RELOAD :: RECOVER';
                cooldownStatusEl.style.color = '#FFCC00';
            } else {
                cooldownBarEl.style.background = '#FF3B3B';
                cooldownStatusEl.textContent = 'RELOAD :: ACTION';
                cooldownStatusEl.style.color = '#FF3B3B';
            }
        } else if (status === 'reloaded') {
            cooldownBarEl.style.background = '#3CB8FF';
            cooldownStatusEl.textContent = 'RELOAD COMPLETE';
            cooldownStatusEl.style.color = '#3CB8FF';
        } else if (status === 'cooldown') {
            cooldownBarEl.style.background = '#FFCC00';
            cooldownStatusEl.textContent = 'COOLDOWN';
            cooldownStatusEl.style.color = '#FFCC00';
        } else {
            cooldownBarEl.style.background = '#3CB8FF';
            cooldownStatusEl.textContent = 'READY';
            cooldownStatusEl.style.color = '#3CB8FF';
        }
    };

    GameUI.updateWeaponInfo = function (weapon) {
        if (!weaponInfoEl || !weapon) return;
        var mode = weapon.automatic ? 'AUTO' : 'SEMI';
        if (weapon.pellets && weapon.pellets > 1) {
            mode = weapon.pellets + ' PELLETS';
        }
        var ammoText = '';
        if (weapon.magazineSize && weapon.magazineSize > 0) {
            ammoText = Math.max(0, Number(weapon.ammoInMag || 0)) + '/' + Math.max(1, Number(weapon.magazineSize || 1));
        }
        clearChildren(weaponInfoEl);
        appendWeaponInfoLine(weapon.name, 'weapon-line weapon-line-name');
        appendWeaponInfoLine(ammoText || mode, 'weapon-line weapon-line-ammo');
        appendWeaponInfoLine(weapon.bodyDamage + '/' + weapon.headDamage + ' DMG', 'weapon-line weapon-line-meta');
    };

    function setElementDisplay(el, visible) {
        if (!el) return;
        el.style.display = visible ? 'block' : 'none';
    }

    function reticleTargetSets() {
        return {
            crosshair: [crosshairEl],
            circle: [shotgunReticleEl]
        };
    }

    function setReticleSetTargetClass(group, active) {
        var sets = reticleTargetSets();
        var activeGroup = sets[group] ? group : 'crosshair';
        for (var setId in sets) {
            if (!Object.prototype.hasOwnProperty.call(sets, setId)) continue;
            var elements = sets[setId];
            var enabled = setId === activeGroup && !!active;
            for (var i = 0; i < elements.length; i++) {
                if (elements[i]) elements[i].classList.toggle('reticle-target-in-range', enabled);
            }
        }
    }

    function updateSniperScope(scoped, blend) {
        if (!sniperScopeEl) return;
        sniperScopeEl.style.display = scoped ? 'block' : 'none';
        sniperScopeEl.style.opacity = scoped ? blend.toFixed(3) : '0';
    }

    function hideSpreadReticle() {
        if (spreadReticle && spreadReticle.hide) spreadReticle.hide();
        else setElementDisplay(spreadReticleEl, false);
    }

    function hidePrimaryReticles() {
        setElementDisplay(crosshairEl, false);
        setElementDisplay(pistolReticleEl, false);
        setElementDisplay(shotgunReticleEl, false);
        hideSpreadReticle();
    }

    function updateCrosshairReticle(weapon, adsState, scoped, hitscan) {
        setElementDisplay(crosshairEl, true);
        setElementDisplay(shotgunReticleEl, false);
        setElementDisplay(pistolReticleEl, false);
        if (spreadReticle && spreadReticle.updateForWeapon) {
            spreadReticle.updateForWeapon(weapon, {
                adsActive: !!(adsState && adsState.active),
                scoped: scoped
            });
            return;
        }
        setElementDisplay(spreadReticleEl, false);
    }

    function updateCircleReticle(spec) {
        setElementDisplay(crosshairEl, false);
        setElementDisplay(pistolReticleEl, false);
        hideSpreadReticle();
        setElementDisplay(shotgunReticleEl, true);

        var size = (spec && spec.size) ? spec.size : 300;
        shotgunReticleEl.style.width = size + 'px';
        shotgunReticleEl.style.height = size + 'px';
    }

    function normalizedReticleSpec(spec) {
        if (spec && typeof spec === 'object') return spec;
        return {
            type: 'crosshair',
            targetGroup: 'crosshair',
            targetSource: 'center'
        };
    }

    GameUI.updateReticle = function (weapon, spec, adsState) {
        if (!crosshairEl || !spreadReticleEl || !shotgunReticleEl || !weapon) return;

        spec = normalizedReticleSpec(spec);
        var isSniper = !!(adsState && adsState.sniper);
        var blend = Math.max(0, Math.min(1, Number(adsState && adsState.blend) || 0));
        var scoped = isSniper && blend > 0.02;
        var hitscan = globalThis.__MAYHEM_RUNTIME.GameHitscan || null;

        updateSniperScope(scoped, blend);

        if (scoped) {
            hidePrimaryReticles();
            return;
        }

        if (spec.type !== 'circle') {
            updateCrosshairReticle(weapon, adsState, scoped, hitscan);
            return;
        }

        updateCircleReticle(spec);
    };

    GameUI.setReticleTargetState = function (group, active) {
        setReticleSetTargetClass(group, active);
    };

    GameUI.updateThrowableInfo = function (state) {
        if (!throwableInfoEl || !state) return;
        lastThrowableInfoState = state;

        var GT = globalThis.__MAYHEM_RUNTIME.GameThrowables;
        var shared = (globalThis.__MAYHEM_RUNTIME || {}).GameShared || {};
        var selectedId = (GT && GT.getSelectedThrowable)
            ? GT.getSelectedThrowable()
            : (shared.getDefaultThrowableId ? shared.getDefaultThrowableId() : '');
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
        applyOverlayTone(plasmaReticleEl, state.tone || 'throwable', { useBackground: false });
        plasmaReticleEl.style.display = 'block';
        ensurePlasmaReticleRings();
        var sizes = Array.isArray(state.ringDiametersPx) ? state.ringDiametersPx : [];
        for (var i = 0; i < plasmaReticleRings.length; i++) {
            var ringEl = plasmaReticleRings[i];
            if (!ringEl) continue;
            var size = Math.max(16, Math.round(Number(sizes[i] || 0)));
            ringEl.style.width = size + 'px';
            ringEl.style.height = size + 'px';
            ringEl.style.display = size > 0 ? 'block' : 'none';
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

    GameUI.getKillCount = function () {
        return killCount;
    };

    globalThis.__MAYHEM_RUNTIME.GameUI = GameUI;
})();
