(function () {
    'use strict';

    var demonicRuntime = globalThis.__DEMONIC_RUNTIME = globalThis.__DEMONIC_RUNTIME || {};
    var mayhemRuntime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};

    function defaultRecoil() {
        return {
            z: -0.05,
            x: -0.09,
            pitch: 0.018,
            yaw: 0.009,
            roll: 0.006,
            armR: 0.22,
            armL: 0.1,
            muzzleMs: 60
        };
    }

    function presentationFor(weaponId) {
        var shared = mayhemRuntime.GameShared || {};
        return shared.getWeaponPresentation ? shared.getWeaponPresentation(weaponId) : null;
    }

    function create() {
        var state = {
            weaponId: 'machinegun',
            recoil: defaultRecoil(),
            gunKick: 0,
            armKick: 0,
            cameraPitchKick: 0,
            cameraYawKick: 0,
            cameraRollKick: 0,
            muzzleVisibleUntil: 0,
            lastTriggeredAt: 0
        };

        function nowMs() {
            return Date.now();
        }

        function setWeapon(weaponId) {
            state.weaponId = String(weaponId || state.weaponId || 'machinegun');
            var presentation = presentationFor(state.weaponId);
            state.recoil = presentation && presentation.recoil ? Object.assign({}, presentation.recoil) : defaultRecoil();
        }

        setWeapon('machinegun');

        return {
            setWeapon: setWeapon,
            update: function (dt) {
                var blend = Math.min(1, dt * 18);
                state.gunKick += (0 - state.gunKick) * blend;
                state.armKick += (0 - state.armKick) * blend;
                state.cameraPitchKick += (0 - state.cameraPitchKick) * Math.min(1, dt * 14);
                state.cameraYawKick += (0 - state.cameraYawKick) * Math.min(1, dt * 16);
                state.cameraRollKick += (0 - state.cameraRollKick) * Math.min(1, dt * 12);
            },
            triggerFire: function (scopeBlend) {
                var recoil = state.recoil || defaultRecoil();
                var scopeMultiplier = 1 - (Math.max(0, Math.min(1, Number(scopeBlend || 0))) * 0.2);
                var yawKick = (Math.random() - 0.5) * Number(recoil.yaw || 0) * scopeMultiplier;
                var rollKick = -yawKick * (Number(recoil.roll || 0) / Math.max(Number(recoil.yaw || 0), 0.0001));
                state.gunKick += Number(recoil.z || 0) * scopeMultiplier;
                state.armKick += Number(recoil.x || 0) * scopeMultiplier;
                state.cameraPitchKick += Number(recoil.pitch || 0) * scopeMultiplier;
                state.cameraYawKick += yawKick;
                state.cameraRollKick += rollKick;
                state.muzzleVisibleUntil = nowMs() + Math.max(0, Number(recoil.muzzleMs || 0));
                state.lastTriggeredAt = nowMs();
            },
            getSnapshot: function () {
                return {
                    weaponId: String(state.weaponId || ''),
                    gunKick: Number(state.gunKick || 0),
                    armKick: Number(state.armKick || 0),
                    cameraPitchKick: Number(state.cameraPitchKick || 0),
                    cameraYawKick: Number(state.cameraYawKick || 0),
                    cameraRollKick: Number(state.cameraRollKick || 0),
                    muzzleVisible: nowMs() < Number(state.muzzleVisibleUntil || 0),
                    lastTriggeredAt: Number(state.lastTriggeredAt || 0)
                };
            }
        };
    }

    demonicRuntime.GameWeaponFeedbackRuntime = {
        create: create
    };
})();
