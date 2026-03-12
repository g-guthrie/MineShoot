(function () {
    'use strict';

    var demonicRuntime = globalThis.__DEMONIC_RUNTIME = globalThis.__DEMONIC_RUNTIME || {};

    function reticleMarkup(reticle, movementInfo) {
        var state = reticle || { type: 'crosshair', width: 18, height: 18, label: 'STANDARD' };
        var width = Math.max(0, Number(state.width || 0));
        var height = Math.max(0, Number(state.height || 0));
        return '' +
            '<div class="demonic-hud-reticle ' + String(state.type || 'crosshair') + '"' +
                ' style="width:' + width + 'px;height:' + height + 'px">' +
                '<span>' + String(state.label || '').toUpperCase() + '</span>' +
            '</div>' +
            '<div class="demonic-hud-move-state">' + String(movementInfo || '').toUpperCase() + '</div>';
    }

    function cooldownMarkup(hud) {
        var status = String(hud.cooldownStatus || 'READY').toUpperCase();
        var ms = Math.max(0, Number(hud.cooldownMs || 0));
        return '' +
            '<div class="demonic-hud-card cooldown">' +
                '<span>COOLDOWN</span>' +
                '<strong>' + status + ' :: ' + ms.toFixed(0) + 'ms</strong>' +
            '</div>';
    }

    function vitalsMarkup(hud) {
        var vitals = hud && hud.vitals ? hud.vitals : {};
        var hp = Math.max(0, Number(vitals.hp || 0));
        var hpMax = Math.max(1, Number(vitals.hpMax || 1));
        var armor = Math.max(0, Number(vitals.armor || 0));
        var armorMax = Math.max(1, Number(vitals.armorMax || 1));
        var status = vitals.alive === false
            ? 'DOWN'
            : (vitals.respawnActive ? 'RESPAWN ' + Math.ceil(Math.max(0, Number(vitals.respawnRemainingMs || 0)) / 1000) : 'STABLE');
        return '' +
            '<div class="demonic-hud-card">' +
                '<span>VITALS</span>' +
                '<strong>HP ' + hp.toFixed(0) + '/' + hpMax.toFixed(0) + ' :: ARM ' + armor.toFixed(0) + '/' + armorMax.toFixed(0) + '</strong>' +
                '<em>' + status + '</em>' +
            '</div>';
    }

    function radarMarkup(awareness) {
        var state = awareness || {};
        var segments = Array.isArray(state.segments) ? state.segments : [];
        var bars = [];
        for (var i = 0; i < segments.length; i++) {
            var intensity = Math.max(0, Math.min(1, Number(segments[i] || 0)));
            bars.push('<div class="demonic-radar-segment" style="opacity:' + (0.16 + intensity * 0.84).toFixed(3) + ';height:' + Math.round(12 + intensity * 32) + 'px"></div>');
        }
        var core = Math.max(0, Math.min(1, Number(state.coreIntensity || 0)));
        return '' +
            '<div class="demonic-hud-radar">' +
                '<div class="demonic-hud-radar-grid">' + bars.join('') + '</div>' +
                '<div class="demonic-hud-radar-core" style="opacity:' + (0.15 + core * 0.7).toFixed(3) + '"></div>' +
            '</div>';
    }

    function damageMarkup(damage) {
        var state = damage || {};
        var sectors = Array.isArray(state.sectors) ? state.sectors : [];
        var flash = Math.max(0, Math.min(1, Number(state.flashLevel || 0)));
        var items = [];
        for (var i = 0; i < sectors.length; i++) {
            var opacity = Math.max(0, Math.min(1, Number(sectors[i] || 0)));
            items.push('<div class="demonic-damage-sector" style="opacity:' + (opacity * 0.84).toFixed(3) + '"></div>');
        }
        return '' +
            '<div class="demonic-damage-shell">' +
                '<div class="demonic-damage-vignette" style="opacity:' + (flash * 0.62).toFixed(3) + '"></div>' +
                '<div class="demonic-damage-grid">' + items.join('') + '</div>' +
            '</div>';
    }

    function create(options) {
        options = options || {};
        var host = options.host || null;
        var latestMarkup = '';

        function hudSnapshot() {
            return options.getHudSnapshot ? options.getHudSnapshot() : {};
        }

        function presentationSnapshot() {
            return options.getPresentationSnapshot ? options.getPresentationSnapshot() : {};
        }

        function awarenessSnapshot() {
            var hud = hudSnapshot();
            return hud && hud.awareness ? hud.awareness : null;
        }

        function damageSnapshot() {
            var hud = hudSnapshot();
            return hud && hud.damage ? hud.damage : null;
        }

        function render() {
            if (!host) return;
            var hud = hudSnapshot();
            var presentation = presentationSnapshot();
            var awareness = awarenessSnapshot();
            var damage = damageSnapshot();
            var markup = '' +
                '<div class="demonic-hud-shell">' +
                    '<div class="demonic-hud-top">' +
                        vitalsMarkup(hud) +
                        '<div class="demonic-hud-card"><span>WEAPON</span><strong>' + String(hud.weaponInfo || '') + '</strong></div>' +
                        '<div class="demonic-hud-card"><span>ABILITIES</span><strong>' + String(hud.abilityInfo || '') + '</strong></div>' +
                        cooldownMarkup(hud) +
                    '</div>' +
                    '<div class="demonic-hud-center">' +
                        reticleMarkup(presentation.reticle, hud.movementInfo) +
                        radarMarkup(awareness) +
                        damageMarkup(damage) +
                    '</div>' +
                '</div>';
            if (markup === latestMarkup) return;
            latestMarkup = markup;
            host.innerHTML = markup;
        }

        return {
            update: render,
            destroy: function () {
                if (host) host.innerHTML = '';
                latestMarkup = '';
            }
        };
    }

    demonicRuntime.GameHudViewRuntime = {
        create: create
    };
})();
