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

    function matchesBinding(actionId, event, fallbackCodes) {
        var bindingsApi = runtime.GameInputBindings || null;
        if (bindingsApi && bindingsApi.matchesWithFallback) {
            return bindingsApi.matchesWithFallback(actionId, event, fallbackCodes);
        }
        if (bindingsApi && bindingsApi.matches) {
            return bindingsApi.matches(actionId, event);
        }
        var code = String(event && event.code || '');
        var fallbacks = Array.isArray(fallbackCodes) ? fallbackCodes : [fallbackCodes];
        for (var i = 0; i < fallbacks.length; i++) {
            if (String(fallbacks[i] || '') === code) return true;
        }
        return false;
    }

    runtime.GameInputLabels = {
        getBindingLabel: getBindingLabel,
        matchesBinding: matchesBinding
    };
})();
