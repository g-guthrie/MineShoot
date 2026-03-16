/**
 * input-bindings-ui.js - Menu legend and keyboard rebind modal.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameInputBindingsUi
 */
(function () {
    'use strict';

    var runtime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};

    function createSummaryRows(bindingsApi) {
        return [
            { label: [bindingsApi.getDisplayLabel('move_forward'), bindingsApi.getDisplayLabel('move_left'), bindingsApi.getDisplayLabel('move_backward'), bindingsApi.getDisplayLabel('move_right')].join(' / '), title: 'Move' },
            { label: 'MOUSE', title: 'Look' },
            { label: bindingsApi.getDisplayLabel('sprint'), title: 'Sprint' },
            { label: 'RMB / ' + bindingsApi.getDisplayLabel('ads_key'), title: 'ADS' },
            { label: bindingsApi.getDisplayLabel('jump'), title: 'Jump' },
            { label: 'LMB', title: 'Fire' },
            { label: bindingsApi.getDisplayLabel('reload'), title: 'Reload' },
            { label: bindingsApi.getDisplayLabel('weapon_slot_1') + ' / ' + bindingsApi.getDisplayLabel('weapon_slot_2'), title: 'Weapon Slots' },
            { label: 'WHEEL', title: 'Toggle Weapon' },
            { label: bindingsApi.getDisplayLabel('throwable'), title: 'Throwable' },
            { label: bindingsApi.getDisplayLabel('ability_1') + ' / ' + bindingsApi.getDisplayLabel('ability_2'), title: 'Abilities' },
            { label: bindingsApi.getDisplayLabel('toggle_debug'), title: 'Debug Visuals' },
            { label: bindingsApi.getDisplayLabel('open_manual'), title: 'Field Manual' },
            { label: 'ESC', title: 'Release / Close' }
        ];
    }

    function create() {
        var inited = false;
        var unsubscribe = null;
        var captureActionId = '';
        var controlsMenuEl = null;
        var controlsToggleEl = null;
        var summaryGridEl = null;
        var editBtnEl = null;
        var overlayEl = null;
        var closeBtnEl = null;
        var resetBtnEl = null;
        var statusEl = null;
        var fixedGridEl = null;
        var groupsWrapEl = null;
        var captureInputEl = null;

        function bindingsApi() {
            return runtime.GameInputBindings || null;
        }

        function modalManager() {
            return runtime.GameModalManager || null;
        }

        function setStatus(text, isErr) {
            if (!statusEl) return;
            statusEl.textContent = text || '';
            statusEl.style.color = isErr ? '#ffb0b0' : '#baf8c8';
        }

        function currentLabel(actionId) {
            var api = bindingsApi();
            return api && api.getDisplayLabel ? api.getDisplayLabel(actionId) : '--';
        }

        function stopCapture() {
            captureActionId = '';
            if (captureInputEl && captureInputEl.blur) captureInputEl.blur();
        }

        function renderLegend() {
            if (!summaryGridEl) return;
            var api = bindingsApi();
            if (!api || !api.getDisplayLabel) {
                summaryGridEl.innerHTML = '';
                return;
            }
            var rows = createSummaryRows(api);
            summaryGridEl.innerHTML = '';
            for (var i = 0; i < rows.length; i++) {
                var row = document.createElement('span');
                row.textContent = rows[i].label + ' ' + rows[i].title;
                summaryGridEl.appendChild(row);
            }
        }

        function renderFixedControls() {
            if (!fixedGridEl) return;
            var api = bindingsApi();
            var rows = api && api.getFixedControls ? api.getFixedControls() : [];
            fixedGridEl.innerHTML = '';
            for (var i = 0; i < rows.length; i++) {
                var card = document.createElement('div');
                card.className = 'controls-fixed-card';
                var label = document.createElement('span');
                label.className = 'controls-fixed-label';
                label.textContent = rows[i].label;
                var title = document.createElement('span');
                title.className = 'controls-fixed-title';
                title.textContent = rows[i].title;
                var note = document.createElement('span');
                note.className = 'controls-fixed-note';
                note.textContent = rows[i].note;
                card.appendChild(label);
                card.appendChild(title);
                card.appendChild(note);
                fixedGridEl.appendChild(card);
            }
        }

        function groupedActionDefs() {
            var api = bindingsApi();
            var defs = api && api.getActionDefs ? api.getActionDefs() : [];
            var groups = {};
            var ordered = [];
            for (var i = 0; i < defs.length; i++) {
                var groupId = String(defs[i].group || 'Other');
                if (!groups[groupId]) {
                    groups[groupId] = [];
                    ordered.push(groupId);
                }
                groups[groupId].push(defs[i]);
            }
            return ordered.map(function (groupId) {
                return {
                    id: groupId,
                    items: groups[groupId]
                };
            });
        }

        function renderModal() {
            if (!groupsWrapEl) return;
            groupsWrapEl.innerHTML = '';
            var groups = groupedActionDefs();
            for (var i = 0; i < groups.length; i++) {
                var group = groups[i];
                var section = document.createElement('section');
                section.className = 'controls-bind-group';

                var heading = document.createElement('h3');
                heading.textContent = group.id;
                section.appendChild(heading);

                for (var n = 0; n < group.items.length; n++) {
                    var action = group.items[n];
                    var row = document.createElement('div');
                    row.className = 'controls-bind-row';

                    var copy = document.createElement('div');
                    copy.className = 'controls-bind-copy';

                    var title = document.createElement('span');
                    title.className = 'controls-bind-title';
                    title.textContent = action.title;

                    var note = document.createElement('span');
                    note.className = 'controls-bind-note';
                    note.textContent = action.note;

                    copy.appendChild(title);
                    copy.appendChild(note);

                    var button = document.createElement('button');
                    button.type = 'button';
                    button.className = 'controls-bind-btn';
                    if (captureActionId === action.id) {
                        button.classList.add('capturing');
                        button.textContent = 'PRESS KEY';
                    } else {
                        button.textContent = currentLabel(action.id);
                    }
                    button.dataset.actionId = action.id;
                    button.dataset.actionTitle = action.title;
                    button.addEventListener('click', function () {
                        captureActionId = String(this.dataset.actionId || '');
                        setStatus('Press a new key for ' + String(this.dataset.actionTitle || 'this action') + '.', false);
                        renderModal();
                        if (captureInputEl && captureInputEl.focus) captureInputEl.focus();
                    });

                    row.appendChild(copy);
                    row.appendChild(button);
                    section.appendChild(row);
                }

                groupsWrapEl.appendChild(section);
            }
        }

        function syncAll() {
            renderLegend();
            renderFixedControls();
            renderModal();
        }

        function closeControlsDropdown() {
            if (controlsMenuEl) controlsMenuEl.hidden = true;
            if (controlsToggleEl) controlsToggleEl.setAttribute('aria-expanded', 'false');
        }

        function openModal(triggerEl) {
            closeControlsDropdown();
            setStatus('Choose an action, then press a new key. Mouse, wheel, and Escape stay fixed.', false);
            stopCapture();
            syncAll();
            var manager = modalManager();
            if (manager && manager.open) {
                manager.open('controls', triggerEl || editBtnEl || document.activeElement || null);
                return;
            }
            if (overlayEl) {
                overlayEl.hidden = false;
                overlayEl.setAttribute('aria-hidden', 'false');
            }
        }

        function closeModal() {
            stopCapture();
            var manager = modalManager();
            if (manager && manager.close) {
                manager.close('controls');
                return;
            }
            if (overlayEl) {
                overlayEl.hidden = true;
                overlayEl.setAttribute('aria-hidden', 'true');
            }
        }

        function bindCapture() {
            if (!captureInputEl || captureInputEl.__captureBound) return;
            captureInputEl.__captureBound = true;
            captureInputEl.addEventListener('keydown', function (event) {
                if (!captureActionId) return;
                var api = bindingsApi();
                if (!api || !api.assign || !api.tokenFromEvent) return;
                event.preventDefault();
                event.stopPropagation();

                var token = api.tokenFromEvent(event);
                if (token === 'Escape') {
                    setStatus('Binding change canceled.', false);
                    stopCapture();
                    renderModal();
                    return;
                }

                var outcome = api.assign(captureActionId, token);
                if (!outcome || outcome.ok === false) {
                    setStatus('That key is reserved. Pick another keyboard key.', true);
                    return;
                }

                var boundLabel = currentLabel(captureActionId);
                if (outcome.changed === false) {
                    setStatus('Binding already set to ' + boundLabel + '.', false);
                } else if (outcome.swappedActionId) {
                    setStatus('Swapped to ' + boundLabel + ' and preserved the previous action on ' + api.getDisplayLabel(outcome.swappedActionId) + '.', false);
                } else {
                    setStatus('Bound to ' + boundLabel + '.', false);
                }
                stopCapture();
                syncAll();
            });
        }

        function bind() {
            if (controlsToggleEl && !controlsToggleEl.__controlsModalBound && !editBtnEl) {
                controlsToggleEl.__controlsModalBound = true;
                controlsToggleEl.addEventListener('click', function (event) {
                    event.preventDefault();
                    event.stopPropagation();
                    openModal(this);
                });
            }
            if (editBtnEl && !editBtnEl.__bound) {
                editBtnEl.__bound = true;
                editBtnEl.addEventListener('click', function (event) {
                    event.preventDefault();
                    event.stopPropagation();
                    openModal(this);
                });
            }
            if (closeBtnEl && !closeBtnEl.__bound) {
                closeBtnEl.__bound = true;
                closeBtnEl.addEventListener('click', function (event) {
                    event.preventDefault();
                    event.stopPropagation();
                    closeModal();
                });
            }
            if (resetBtnEl && !resetBtnEl.__bound) {
                resetBtnEl.__bound = true;
                resetBtnEl.addEventListener('click', function (event) {
                    event.preventDefault();
                    event.stopPropagation();
                    var api = bindingsApi();
                    if (!api || !api.resetAll) return;
                    api.resetAll();
                    setStatus('Defaults restored.', false);
                    stopCapture();
                    syncAll();
                });
            }
            bindCapture();
        }

        return {
            init: function () {
                if (inited) {
                    syncAll();
                    return;
                }
                controlsMenuEl = document.getElementById('controls-menu');
                controlsToggleEl = document.getElementById('controls-toggle');
                summaryGridEl = document.getElementById('controls-menu-grid');
                editBtnEl = document.getElementById('edit-controls-btn');
                overlayEl = document.getElementById('controls-overlay');
                closeBtnEl = document.getElementById('controls-close-btn');
                resetBtnEl = document.getElementById('controls-reset-btn');
                statusEl = document.getElementById('controls-rebind-status');
                fixedGridEl = document.getElementById('controls-fixed-grid');
                groupsWrapEl = document.getElementById('controls-bindings-groups');
                captureInputEl = document.getElementById('controls-capture-input');

                if (!summaryGridEl && !overlayEl) return;
                inited = true;

                var manager = modalManager();
                if (manager && overlayEl) {
                    var utilityToggleBtn = document.getElementById('utility-toggle-btn');
                    manager.register('controls', {
                        element: overlayEl,
                        initialFocus: closeBtnEl || overlayEl,
                        restoreFocus: utilityToggleBtn || editBtnEl || controlsToggleEl || null,
                        onClose: function () {
                            stopCapture();
                            renderModal();
                        }
                    });
                }

                bind();
                syncAll();
                if (bindingsApi() && bindingsApi().subscribe) {
                    unsubscribe = bindingsApi().subscribe(syncAll);
                }
            },
            open: openModal,
            close: closeModal,
            destroy: function () {
                if (unsubscribe) unsubscribe();
                unsubscribe = null;
            }
        };
    }

    runtime.GameInputBindingsUi = create();
})();
