/**
 * input-labels.js - Shared display-label helper over input bindings.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameInputLabels
 */
(function () {
    'use strict';

    var runtime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    if (runtime.GameInputLabels && runtime.GameInputLabels.getBindingLabel) return;

    function getBindingLabel(actionId, fallbackLabel) {
        var bindingsApi = runtime.GameInputBindings || null;
        if (bindingsApi && bindingsApi.getDisplayLabel) {
            var label = bindingsApi.getDisplayLabel(actionId);
            if (label && label !== '--') return label;
        }
        return String(fallbackLabel || '--');
    }

    runtime.GameInputLabels = {
        getBindingLabel: getBindingLabel
    };
})();
