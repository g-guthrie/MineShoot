/**
 * dom-utils.js - Shared DOM helper utilities.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameDomUtils
 */
(function () {
    'use strict';

    var runtime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    if (runtime.GameDomUtils && runtime.GameDomUtils.isEditableTarget) return;

    function isEditableTarget(target) {
        var node = target || null;
        var tagName = node && node.tagName ? String(node.tagName).toUpperCase() : '';
        if (node && node.isContentEditable) return true;
        return tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT';
    }

    runtime.GameDomUtils = {
        isEditableTarget: isEditableTarget
    };
})();
