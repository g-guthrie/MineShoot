(function () {
    'use strict';

    var demonicRuntime = globalThis.__DEMONIC_RUNTIME = globalThis.__DEMONIC_RUNTIME || {};

    function panelMarkup(snapshot) {
        var actor = snapshot.actor || {};
        var hud = snapshot.hud || {};
        var presentation = snapshot.presentation || {};
        var net = snapshot.net || {};

        return '' +
            '<div class="demonic-scene-panels">' +
                '<div class="demonic-scene-panel"><span>STANCE</span><strong>' + String(actor.stance || 'IDLE').toUpperCase() + '</strong></div>' +
                '<div class="demonic-scene-panel"><span>HUD</span><strong>' + String(hud.weaponInfo || 'NO HUD') + '</strong></div>' +
                '<div class="demonic-scene-panel"><span>ABILITIES</span><strong>' + String(hud.abilityInfo || 'NO ABILITIES') + '</strong></div>' +
                '<div class="demonic-scene-panel"><span>RETICLE</span><strong>' + String(presentation.reticle && presentation.reticle.label || 'NONE').toUpperCase() + '</strong></div>' +
                '<div class="demonic-scene-panel"><span>AUTHORITY</span><strong>' + String(net.status || 'UNKNOWN').toUpperCase() + '</strong></div>' +
            '</div>';
    }

    function create(options) {
        options = options || {};
        var host = options.host || null;
        var renderContextApi = demonicRuntime.GameRenderContext || null;
        var actorPreviewApi = demonicRuntime.GameActorPreviewRuntime || null;
        var renderHost = null;
        var panelHost = null;
        var renderContext = null;
        var actorPreview = null;
        var latestPanelMarkup = '';

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

        function ensureHosts() {
            if (!host) return false;
            if (!renderHost) {
                host.innerHTML = '' +
                    '<div class="demonic-scene-shell">' +
                        '<div id="demonic-live-scene" class="demonic-live-scene"></div>' +
                        '<div id="demonic-live-scene-panels"></div>' +
                    '</div>';
                renderHost = document.getElementById('demonic-live-scene');
                panelHost = document.getElementById('demonic-live-scene-panels');
            }
            return !!renderHost;
        }

        function ensureRuntime() {
            if (!ensureHosts()) return;
            if (!renderContext && renderContextApi && renderContextApi.create) {
                renderContext = renderContextApi.create({ host: renderHost });
            }
            if (!actorPreview && actorPreviewApi && actorPreviewApi.create && renderContext) {
                actorPreview = actorPreviewApi.create({
                    scene: renderContext.scene
                });
            }
        }

        function renderPanels(snapshot) {
            if (!panelHost) return;
            var markup = panelMarkup(snapshot);
            if (markup === latestPanelMarkup) return;
            latestPanelMarkup = markup;
            panelHost.innerHTML = markup;
        }

        return {
            update: function () {
                ensureRuntime();
                var snapshot = {
                    actor: actorSnapshot(),
                    hud: hudSnapshot(),
                    presentation: presentationSnapshot(),
                    net: netSnapshot()
                };
                if (actorPreview && actorPreview.update) {
                    actorPreview.update(Object.assign({}, snapshot.actor, {
                        reticle: snapshot.presentation.reticle,
                        adsState: snapshot.presentation.adsState
                    }));
                }
                renderPanels(snapshot);
                if (renderContext && renderContext.renderer && renderContext.scene && renderContext.camera) {
                    renderContext.renderer.render(renderContext.scene, renderContext.camera);
                }
            },
            destroy: function () {
                if (actorPreview && actorPreview.destroy) actorPreview.destroy();
                actorPreview = null;
                if (renderContext && renderContext.destroy) renderContext.destroy();
                renderContext = null;
                if (host) host.innerHTML = '';
                renderHost = null;
                panelHost = null;
                latestPanelMarkup = '';
            }
        };
    }

    demonicRuntime.GameSceneRuntime = {
        create: create
    };
})();
