(function () {
    'use strict';

    var demonicRuntime = globalThis.__DEMONIC_RUNTIME = globalThis.__DEMONIC_RUNTIME || {};

    function create(options) {
        options = options || {};
        var input = options.input || null;
        var onFire = typeof options.onFire === 'function' ? options.onFire : function () {};
        var onEquipWeapon = typeof options.onEquipWeapon === 'function' ? options.onEquipWeapon : function () {};
        var bound = false;
        var bindings = [];
        var documentRef = document;
        var windowRef = window;

        function listen(target, type, handler, config) {
            if (!target || !target.addEventListener) return;
            target.addEventListener(type, handler, config || false);
            bindings.push({ target: target, type: type, handler: handler, config: config || false });
        }

        function setInputState(patch) {
            if (input && input.setState) input.setState(patch);
        }

        return {
            bind: function () {
                if (bound) return;
                bound = true;

                listen(documentRef, 'keydown', function (e) {
                    switch (e.code) {
                        case 'KeyW': setInputState({ moveForward: true }); break;
                        case 'KeyA': setInputState({ moveLeft: true }); break;
                        case 'KeyS': setInputState({ moveBackward: true }); break;
                        case 'KeyD': setInputState({ moveRight: true }); break;
                        case 'KeyE': setInputState({ sprint: true }); break;
                        case 'ShiftLeft':
                        case 'ShiftRight':
                            if (!e.repeat) setInputState({ ads: !(input && input.getSnapshot ? input.getSnapshot().ads : false) });
                            break;
                        case 'Space':
                            setInputState({ jumpQueued: true });
                            if (e.preventDefault) e.preventDefault();
                            break;
                        case 'Digit1':
                            onEquipWeapon(0);
                            break;
                        case 'Digit2':
                            onEquipWeapon(1);
                            break;
                    }
                });

                listen(documentRef, 'keyup', function (e) {
                    switch (e.code) {
                        case 'KeyW': setInputState({ moveForward: false }); break;
                        case 'KeyA': setInputState({ moveLeft: false }); break;
                        case 'KeyS': setInputState({ moveBackward: false }); break;
                        case 'KeyD': setInputState({ moveRight: false }); break;
                        case 'KeyE': setInputState({ sprint: false }); break;
                        case 'Space': setInputState({ jumpQueued: false }); break;
                    }
                });

                listen(documentRef, 'mousemove', function (e) {
                    if (!input || !input.addLookDelta) return;
                    input.addLookDelta(e.movementX || 0, e.movementY || 0);
                });

                listen(documentRef, 'mousedown', function (e) {
                    if (e.button === 0) {
                        setInputState({ triggerHeld: true });
                        onFire();
                    }
                    if (e.button === 2) {
                        if (e.preventDefault) e.preventDefault();
                        setInputState({ ads: !(input && input.getSnapshot ? input.getSnapshot().ads : false) });
                    }
                });

                listen(documentRef, 'mouseup', function (e) {
                    if (e.button === 0) {
                        setInputState({ triggerHeld: false });
                    }
                });

                listen(documentRef, 'contextmenu', function (e) {
                    if (e.preventDefault) e.preventDefault();
                });

                listen(windowRef, 'blur', function () {
                    setInputState({
                        moveForward: false,
                        moveBackward: false,
                        moveLeft: false,
                        moveRight: false,
                        sprint: false,
                        jumpQueued: false,
                        triggerHeld: false
                    });
                });
            },
            unbind: function () {
                for (var i = 0; i < bindings.length; i++) {
                    var entry = bindings[i];
                    if (entry.target && entry.target.removeEventListener) {
                        entry.target.removeEventListener(entry.type, entry.handler, entry.config);
                    }
                }
                bindings = [];
                bound = false;
            }
        };
    }

    demonicRuntime.GameInputBindings = {
        create: create
    };
})();
