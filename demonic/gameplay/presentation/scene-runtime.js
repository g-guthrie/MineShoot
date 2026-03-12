(function () {
    'use strict';

    var demonicRuntime = globalThis.__DEMONIC_RUNTIME = globalThis.__DEMONIC_RUNTIME || {};

    function panelMarkup(snapshot) {
        var actor = snapshot.actor || {};
        var hud = snapshot.hud || {};
        var presentation = snapshot.presentation || {};
        var net = snapshot.net || {};

        var reticle = presentation.reticle || {};
        return '' +
            '<div class="demonic-scene-panels">' +
                '<div class="demonic-scene-panel"><span>STANCE</span><strong>' + String(actor.stance || 'IDLE').toUpperCase() + '</strong></div>' +
                '<div class="demonic-scene-panel"><span>HUD</span><strong>' + String(hud.weaponInfo || 'NO HUD') + '</strong></div>' +
                '<div class="demonic-scene-panel"><span>ABILITIES</span><strong>' + String(hud.abilityInfo || 'NO ABILITIES') + '</strong></div>' +
                '<div class="demonic-scene-panel"><span>RETICLE</span><strong>' + String(reticle.label || 'NONE').toUpperCase() + ' :: ' + String(reticle.type || '').toUpperCase() + ' :: ' + Number(reticle.width || 0).toFixed(0) + 'x' + Number(reticle.height || 0).toFixed(0) + '</strong></div>' +
                '<div class="demonic-scene-panel"><span>AUTHORITY</span><strong>' + String(net.status || 'UNKNOWN').toUpperCase() + '</strong></div>' +
            '</div>';
    }

    function create(options) {
        options = options || {};
        var host = options.host || null;
        var renderContextApi = demonicRuntime.GameRenderContext || null;
        var actorPreviewApi = demonicRuntime.GameActorPreviewRuntime || null;
        var worldPreviewApi = demonicRuntime.GameWorldPreviewRuntime || null;
        var hudViewApi = demonicRuntime.GameHudViewRuntime || null;
        var renderHost = null;
        var panelHost = null;
        var hudHost = null;
        var renderContext = null;
        var actorPreview = null;
        var worldPreview = null;
        var hudView = null;
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

        function playerSnapshot() {
            return options.getPlayerSnapshot ? options.getPlayerSnapshot() : {};
        }

        function cameraSnapshot() {
            return options.getCameraSnapshot ? options.getCameraSnapshot() : {};
        }

        function abilitySnapshot() {
            return options.getAbilitySnapshot ? options.getAbilitySnapshot() : {};
        }

        function ensureHosts() {
            if (!host) return false;
            if (!renderHost) {
                host.innerHTML = '' +
                    '<div class="demonic-scene-shell">' +
                        '<div id="demonic-live-scene" class="demonic-live-scene"></div>' +
                        '<div class="demonic-live-ui-stack">' +
                            '<div id="demonic-live-scene-panels"></div>' +
                            '<div id="demonic-live-hud"></div>' +
                        '</div>' +
                    '</div>';
                renderHost = document.getElementById('demonic-live-scene');
                panelHost = document.getElementById('demonic-live-scene-panels');
                hudHost = document.getElementById('demonic-live-hud');
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
            if (!worldPreview && worldPreviewApi && worldPreviewApi.create && renderContext) {
                worldPreview = worldPreviewApi.create({
                    scene: renderContext.scene
                });
            }
            if (!hudView && hudViewApi && hudViewApi.create) {
                hudView = hudViewApi.create({
                    host: hudHost,
                    getHudSnapshot: hudSnapshot,
                    getPresentationSnapshot: presentationSnapshot
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
                    net: netSnapshot(),
                    player: playerSnapshot(),
                    camera: cameraSnapshot(),
                    abilities: abilitySnapshot()
                };
                if (worldPreview && worldPreview.update) {
                    worldPreview.update(snapshot.abilities);
                }
                if (actorPreview && actorPreview.update) {
                    actorPreview.update(Object.assign({}, snapshot.actor, snapshot.player, {
                        reticle: snapshot.presentation.reticle,
                        adsState: snapshot.presentation.adsState,
                        lastShotAt: snapshot.abilities && snapshot.abilities.lastCast ? snapshot.abilities.lastCast.castAt : 0
                    }));
                }
                renderPanels(snapshot);
                if (hudView && hudView.update) hudView.update();
                if (renderContext && renderContext.renderer && renderContext.scene && renderContext.camera) {
                    if (snapshot.camera && snapshot.camera.position) {
                        renderContext.camera.position.set(
                            Number(snapshot.camera.position.x || 0),
                            Number(snapshot.camera.position.y || 0),
                            Number(snapshot.camera.position.z || 0)
                        );
                    }
                    if (snapshot.camera && snapshot.camera.target) {
                        renderContext.camera.lookAt(
                            Number(snapshot.camera.target.x || 0),
                            Number(snapshot.camera.target.y || 0),
                            Number(snapshot.camera.target.z || 0)
                        );
                    }
                    renderContext.renderer.render(renderContext.scene, renderContext.camera);
                }
            },
            destroy: function () {
                if (actorPreview && actorPreview.destroy) actorPreview.destroy();
                actorPreview = null;
                if (worldPreview && worldPreview.destroy) worldPreview.destroy();
                worldPreview = null;
                if (hudView && hudView.destroy) hudView.destroy();
                hudView = null;
                if (renderContext && renderContext.destroy) renderContext.destroy();
                renderContext = null;
                if (host) host.innerHTML = '';
                renderHost = null;
                panelHost = null;
                hudHost = null;
                latestPanelMarkup = '';
            }
        };
    }

    demonicRuntime.GameSceneRuntime = {
        create: create
    };
})();
