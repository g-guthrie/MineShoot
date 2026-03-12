(function () {
    'use strict';

    var demonicRuntime = globalThis.__DEMONIC_RUNTIME = globalThis.__DEMONIC_RUNTIME || {};

    function weaponPalette(weaponId) {
        switch (String(weaponId || '')) {
            case 'shotgun':
                return { body: 0x7a4b27, barrel: 0x222222, grip: 0x94623a };
            case 'sniper':
                return { body: 0x314131, barrel: 0x1c1c1c, grip: 0x5d3c1f };
            case 'pistol':
                return { body: 0x444444, barrel: 0x2b2b2b, grip: 0x6f4d32 };
            case 'machinegun':
                return { body: 0x333333, barrel: 0x161616, grip: 0x5b5b5b };
            default:
                return { body: 0x3a3a3a, barrel: 0x222222, grip: 0x7a512d };
        }
    }

    function createBox(w, h, d, color) {
        return new THREE.Mesh(
            new THREE.BoxGeometry(w, h, d),
            new THREE.MeshLambertMaterial({ color: color })
        );
    }

    function create(options) {
        options = options || {};
        var scene = options.scene || null;
        if (!scene) throw new Error('Demonic actor preview requires a THREE scene.');

        var root = new THREE.Group();
        var floor = new THREE.Mesh(
            new THREE.CircleGeometry(3.2, 32),
            new THREE.MeshBasicMaterial({ color: 0x1b1321, transparent: true, opacity: 0.9 })
        );
        floor.rotation.x = -Math.PI * 0.5;
        floor.position.y = 0;
        root.add(floor);

        var actor = new THREE.Group();
        actor.position.y = 0.3;
        root.add(actor);

        var torso = createBox(0.8, 1.0, 0.5, 0x4a7fc1);
        torso.position.set(0, 1.3, 0);
        actor.add(torso);

        var head = createBox(0.55, 0.55, 0.55, 0xd2a77d);
        head.position.set(0, 2.1, 0);
        actor.add(head);

        var armL = createBox(0.22, 0.85, 0.22, 0xd2a77d);
        var armR = createBox(0.22, 0.85, 0.22, 0xd2a77d);
        armL.position.set(-0.52, 1.25, 0);
        armR.position.set(0.52, 1.25, 0);
        actor.add(armL);
        actor.add(armR);

        var legL = createBox(0.28, 0.9, 0.28, 0x2f2f2f);
        var legR = createBox(0.28, 0.9, 0.28, 0x2f2f2f);
        legL.position.set(-0.18, 0.45, 0);
        legR.position.set(0.18, 0.45, 0);
        actor.add(legL);
        actor.add(legR);

        var gun = new THREE.Group();
        var gunBody = createBox(0.16, 0.12, 0.72, 0x3a3a3a);
        var gunBarrel = createBox(0.08, 0.08, 0.46, 0x1f1f1f);
        var gunGrip = createBox(0.1, 0.16, 0.1, 0x7a512d);
        gunBody.position.set(0, 0.01, -0.08);
        gunBarrel.position.set(0, 0.02, -0.54);
        gunGrip.position.set(0, -0.12, 0.06);
        gun.add(gunBody);
        gun.add(gunBarrel);
        gun.add(gunGrip);
        actor.add(gun);

        scene.add(root);

        return {
            update: function (snapshot) {
                var state = snapshot || {};
                var pose = String(state.stance || 'idle');
                var bob = Number(state.bobPhase || 0);
                var sway = Math.sin(bob) * 0.28;
                var gunPalette = weaponPalette(state.weaponId);

                actor.rotation.y += (0.24 - actor.rotation.y) * 0.08;
                gunBody.material.color.setHex(gunPalette.body);
                gunBarrel.material.color.setHex(gunPalette.barrel);
                gunGrip.material.color.setHex(gunPalette.grip);

                legL.rotation.x = 0;
                legR.rotation.x = 0;
                armL.rotation.x = 0;
                armR.rotation.x = 0;
                armL.rotation.z = 0;
                armR.rotation.z = 0;
                gun.rotation.set(-1.12, 0, 0);
                gun.position.set(0.34, 1.16, -0.18);

                if (pose === 'move') {
                    legL.rotation.x = sway;
                    legR.rotation.x = -sway;
                    armL.rotation.x = -sway * 0.5;
                    armR.rotation.x = sway * 0.3;
                } else if (pose === 'sprint') {
                    legL.rotation.x = sway * 1.2;
                    legR.rotation.x = -sway * 1.2;
                    armL.rotation.x = -0.45;
                    armR.rotation.x = 0.65;
                    armR.rotation.z = -0.18;
                    gun.rotation.set(-0.72, -0.08, -0.16);
                    gun.position.set(0.38, 1.08, -0.02);
                } else if (pose === 'ads' || pose === 'scope_ads') {
                    armL.rotation.x = -0.42;
                    armR.rotation.x = 0.94;
                    armR.rotation.z = -0.08;
                    gun.position.set(0.2, 1.28, -0.36);
                    gun.rotation.set(-1.28, 0.02, 0);
                } else if (pose === 'jump') {
                    armL.rotation.x = 0.22;
                    armR.rotation.x = 0.56;
                    armL.rotation.z = -0.24;
                    legL.rotation.x = -0.18;
                    legR.rotation.x = -0.18;
                    actor.position.y = 0.36;
                } else {
                    actor.position.y = 0.3;
                    armR.rotation.x = 0.72;
                    gun.position.set(0.28, 1.18, -0.2);
                }

                if (pose !== 'jump') actor.position.y = 0.3;
            },
            destroy: function () {
                if (root.parent) root.parent.remove(root);
            }
        };
    }

    demonicRuntime.GameActorPreviewRuntime = {
        create: create
    };
})();
