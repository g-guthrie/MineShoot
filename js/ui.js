/**
 * ui.js - Crosshair, health bar, kill counter, hit markers, damage numbers
 * Loaded as global: window.GameUI
 */
(function () {
    'use strict';

    var GameUI = {};

    // DOM references (cached on init)
    var crosshairEl, hitmarkerEl, killCounterEl;
    var healthBarEl, healthTextEl, damageNumbersEl, debugInfoEl;
    var cooldownBarEl, cooldownStatusEl;

    var killCount = 0;
    var hitmarkerTimer = null;

    /**
     * Initialize UI - cache DOM elements
     */
    GameUI.init = function () {
        crosshairEl = document.getElementById('crosshair');
        hitmarkerEl = document.getElementById('hitmarker');
        killCounterEl = document.getElementById('kill-counter');
        healthBarEl = document.getElementById('health-bar');
        healthTextEl = document.getElementById('health-text');
        damageNumbersEl = document.getElementById('damage-numbers');
        debugInfoEl = document.getElementById('debug-info');
        cooldownBarEl = document.getElementById('cooldown-bar');
        cooldownStatusEl = document.getElementById('cooldown-status');
        killCount = 0;
        GameUI.updateKillCounter();
    };

    /**
     * Show hit marker briefly
     */
    GameUI.showHitMarker = function () {
        hitmarkerEl.style.transition = 'none'; // instant show
        hitmarkerEl.style.opacity = '1';
        if (hitmarkerTimer) clearTimeout(hitmarkerTimer);
        hitmarkerTimer = setTimeout(function () {
            hitmarkerEl.style.transition = 'opacity 0.2s ease-out'; // fade out
            hitmarkerEl.style.opacity = '0';
            hitmarkerTimer = null;
        }, 200);
    };

    /**
     * Show hit marker with kill style
     */
    GameUI.showKillMarker = function () {
        hitmarkerEl.style.transition = 'none'; // instant show
        hitmarkerEl.style.opacity = '1';
        hitmarkerEl.style.color = '#ff4444';
        hitmarkerEl.style.fontSize = '36px';
        if (hitmarkerTimer) clearTimeout(hitmarkerTimer);
        hitmarkerTimer = setTimeout(function () {
            hitmarkerEl.style.transition = 'opacity 0.25s ease-out'; // fade out
            hitmarkerEl.style.opacity = '0';
            hitmarkerEl.style.color = '#ff0000';
            hitmarkerEl.style.fontSize = '28px';
            hitmarkerTimer = null;
        }, 300);
    };

    /**
     * Increment and update kill counter
     */
    GameUI.addKill = function () {
        killCount++;
        GameUI.updateKillCounter();
    };

    GameUI.updateKillCounter = function () {
        killCounterEl.textContent = 'Kills: ' + killCount;
    };

    /**
     * Update health bar display
     * @param {number} hp - current HP
     * @param {number} maxHp - max HP
     */
    GameUI.updateHealth = function (hp, maxHp) {
        var pct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
        healthBarEl.style.width = pct + '%';
        healthTextEl.textContent = 'HP: ' + Math.ceil(hp);

        // Color based on health
        if (pct > 60) {
            healthBarEl.style.background = '#4CAF50';
        } else if (pct > 30) {
            healthBarEl.style.background = '#FFC107';
        } else {
            healthBarEl.style.background = '#F44336';
        }
    };

    /**
     * Show floating damage number at a 3D world point
     * @param {THREE.Vector3} worldPoint - hit point in world space
     * @param {number} damage - damage number to show
     * @param {boolean} isKill - was this a kill shot?
     * @param {THREE.Camera} camera - the game camera
     */
    GameUI.showDamageNumber = function (worldPoint, damage, isKill, camera) {
        // Project world point to screen coordinates
        var projected = worldPoint.clone().project(camera);

        // Convert from NDC (-1 to 1) to screen pixels
        var x = (projected.x * 0.5 + 0.5) * window.innerWidth;
        var y = (-projected.y * 0.5 + 0.5) * window.innerHeight;

        // Don't show if behind camera
        if (projected.z > 1) return;

        // Create damage number element
        var el = document.createElement('div');
        el.className = 'damage-number' + (isKill ? ' kill' : '');
        el.textContent = isKill ? '-' + damage + ' KILL!' : '-' + damage;
        el.style.left = x + 'px';
        el.style.top = y + 'px';

        // Add slight random offset for variety
        var offsetX = (Math.random() - 0.5) * 40;
        el.style.marginLeft = offsetX + 'px';

        damageNumbersEl.appendChild(el);

        // Remove after animation completes (1s) to prevent memory leaks
        setTimeout(function () {
            if (el.parentNode) {
                el.parentNode.removeChild(el);
            }
        }, 1000);
    };

    /**
     * Update debug info text
     * @param {string} text
     */
    GameUI.setDebugInfo = function (text) {
        debugInfoEl.textContent = text;
    };

    /**
     * Update cooldown indicator
     * @param {boolean} ready - whether weapon is ready to fire
     * @param {number} pct - cooldown progress 0..1 (1 = ready)
     */
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

    /**
     * Get current kill count
     */
    GameUI.getKillCount = function () {
        return killCount;
    };

    window.GameUI = GameUI;
})();
