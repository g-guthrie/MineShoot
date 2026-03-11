(function () {
    'use strict';

    var demonicRuntime = globalThis.__DEMONIC_RUNTIME = globalThis.__DEMONIC_RUNTIME || {};

    function create() {
        var state = {
            moveForward: false,
            moveBackward: false,
            moveLeft: false,
            moveRight: false,
            sprint: false,
            ads: false,
            jumpQueued: false,
            triggerHeld: false
        };
        var lookDelta = {
            x: 0,
            y: 0
        };

        function setFlag(key, value) {
            if (!Object.prototype.hasOwnProperty.call(state, key)) return;
            state[key] = !!value;
        }

        return {
            setState: function (patch) {
                var next = patch || {};
                for (var key in next) {
                    if (!Object.prototype.hasOwnProperty.call(next, key)) continue;
                    setFlag(key, next[key]);
                }
            },
            addLookDelta: function (dx, dy) {
                lookDelta.x += Number(dx || 0);
                lookDelta.y += Number(dy || 0);
            },
            consumeLookDelta: function () {
                var out = {
                    x: Number(lookDelta.x || 0),
                    y: Number(lookDelta.y || 0)
                };
                lookDelta.x = 0;
                lookDelta.y = 0;
                return out;
            },
            getSnapshot: function () {
                return {
                    moveForward: !!state.moveForward,
                    moveBackward: !!state.moveBackward,
                    moveLeft: !!state.moveLeft,
                    moveRight: !!state.moveRight,
                    sprint: !!state.sprint,
                    ads: !!state.ads,
                    jumpQueued: !!state.jumpQueued,
                    triggerHeld: !!state.triggerHeld,
                    lookDeltaX: Number(lookDelta.x || 0),
                    lookDeltaY: Number(lookDelta.y || 0)
                };
            }
        };
    }

    demonicRuntime.GameInputRuntime = {
        create: create
    };
})();
