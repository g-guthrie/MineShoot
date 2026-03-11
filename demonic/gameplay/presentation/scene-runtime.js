(function () {
    'use strict';

    var demonicRuntime = globalThis.__DEMONIC_RUNTIME = globalThis.__DEMONIC_RUNTIME || {};

    function stageMarkup(snapshot) {
        var actor = snapshot.actor || {};
        var hud = snapshot.hud || {};
        var presentation = snapshot.presentation || {};
        var net = snapshot.net || {};

        return '' +
            '<div class="demonic-scene-shell">' +
                '<div class="demonic-scene-stage">' +
                    '<pre class="demonic-scene-ascii">        .-.\n       (o o)      POSE :: ' + String(actor.stance || 'idle').toUpperCase() + '\n       | O \\\\     WEAPON :: ' + String(actor.weaponId || '').toUpperCase() + '\n       |    \\\\    MODE :: ' + String(net.authorityMode || '').toUpperCase() + '\n       |__.-\'     RETICLE :: ' + String(presentation.reticle && presentation.reticle.type || '').toUpperCase() + '\n      /| |\\\\\n     /_| |_\\\\</pre>' +
                '</div>' +
                '<div class="demonic-scene-panels">' +
                    '<div class="demonic-scene-panel"><span>HUD</span><strong>' + String(hud.weaponInfo || 'NO HUD') + '</strong></div>' +
                    '<div class="demonic-scene-panel"><span>ABILITIES</span><strong>' + String(hud.abilityInfo || 'NO ABILITIES') + '</strong></div>' +
                    '<div class="demonic-scene-panel"><span>COOLDOWN</span><strong>' + String(hud.cooldownStatus || 'READY') + ' :: ' + Number(hud.cooldownMs || 0).toFixed(0) + 'ms</strong></div>' +
                    '<div class="demonic-scene-panel"><span>AUTHORITY</span><strong>' + String(net.status || 'UNKNOWN').toUpperCase() + '</strong></div>' +
                '</div>' +
            '</div>';
    }

    function create(options) {
        options = options || {};
        var host = options.host || null;
        var latestMarkup = '';

        function actorSnapshot() {
            return options.getActorSnapshot ? options.getActorSnapshot() : {};
        }

        function hudSnapshot() {
            return options.getHudSnapshot ? options.getHudSnapshot() : {};
        }

        function presentationSnapshot() {
            return options.getPresentationSnapshot ? options.getPresentationSnapshot() : {};
        }

        function netSnapshot() {
            return options.getNetSnapshot ? options.getNetSnapshot() : {};
        }

        function render(snapshot) {
            if (!host) return;
            var markup = stageMarkup(snapshot);
            if (markup === latestMarkup) return;
            latestMarkup = markup;
            host.innerHTML = markup;
        }

        return {
            update: function () {
                render({
                    actor: actorSnapshot(),
                    hud: hudSnapshot(),
                    presentation: presentationSnapshot(),
                    net: netSnapshot()
                });
            },
            destroy: function () {
                if (host) host.innerHTML = '';
                latestMarkup = '';
            }
        };
    }

    demonicRuntime.GameSceneRuntime = {
        create: create
    };
})();
