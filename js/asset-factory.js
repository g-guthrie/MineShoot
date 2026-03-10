/**
 * asset-factory.js - Procedural asset builders for the HYTOPIA example list, adapted to Mayhem.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameAssetFactory
 */
(function () {
    'use strict';

    var runtime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    var shared = runtime.GameShared || {};
    var assetRecipes = shared.assetRecipes || {};
    var recipeDefinitions = assetRecipes.definitions || {};
    var materialLibrary = runtime.GameMaterialLibrary || null;

    function getLambert(opts) {
        if (materialLibrary && materialLibrary.getLambert) return materialLibrary.getLambert(opts);
        return new THREE.MeshLambertMaterial(opts);
    }

    function getBasic(opts) {
        if (materialLibrary && materialLibrary.getBasic) return materialLibrary.getBasic(opts);
        return new THREE.MeshBasicMaterial(opts);
    }

    function finalize(root, categoryId, assetId) {
        if (!root) return null;
        root.userData = root.userData || {};
        root.userData.assetCategory = categoryId;
        root.userData.assetId = assetId;
        if (root.traverse) {
            root.traverse(function (node) {
                if (!node || !node.isMesh) return;
                node.castShadow = true;
                node.receiveShadow = true;
            });
        }
        return root;
    }

    function add(group, mesh, x, y, z) {
        mesh.position.set(Number(x || 0), Number(y || 0), Number(z || 0));
        group.add(mesh);
        return mesh;
    }

    function box(w, h, d, mat) {
        return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    }

    function sphere(r, mat, widthSegments, heightSegments) {
        return new THREE.Mesh(new THREE.SphereGeometry(r, widthSegments || 10, heightSegments || 8), mat);
    }

    function cylinder(rTop, rBottom, h, mat, radialSegments) {
        return new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, radialSegments || 10), mat);
    }

    function cone(r, h, mat, radialSegments) {
        return new THREE.Mesh(new THREE.ConeGeometry(r, h, radialSegments || 8), mat);
    }

    function crossedPlanes(width, height, matA, matB) {
        var group = new THREE.Group();
        var planeA = new THREE.Mesh(new THREE.PlaneGeometry(width, height), matA);
        var planeB = new THREE.Mesh(new THREE.PlaneGeometry(width, height), matB || matA);
        planeA.rotation.y = 0;
        planeB.rotation.y = Math.PI * 0.5;
        group.add(planeA);
        group.add(planeB);
        return group;
    }

    function transparentBasic(color, opacity) {
        return new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: opacity,
            side: THREE.DoubleSide,
            depthWrite: false
        });
    }

    function createZombie() {
        var group = new THREE.Group();
        var shirt = getLambert({ color: 0x4f6175 });
        var shirtDark = getLambert({ color: 0x364653 });
        var pants = getLambert({ color: 0x6d4f3a });
        var boot = getLambert({ color: 0x3c332e });
        var skin = getLambert({ color: 0x7ea372 });
        var skinDark = getLambert({ color: 0x6a8f60 });

        add(group, box(0.62, 0.18, 0.24, skinDark), 0, 1.78, 0.02);
        add(group, box(0.78, 0.96, 0.46, shirt), 0, 1.18, 0.02);
        add(group, box(0.68, 0.22, 0.48, shirtDark), 0, 0.78, 0.02);

        add(group, box(0.52, 0.56, 0.52, skin), 0, 1.88, 0);
        add(group, box(0.5, 0.12, 0.1, skinDark), 0, 1.94, -0.22);
        add(group, box(0.08, 0.08, 0.04, getBasic({ color: 0x121212 })), -0.12, 1.98, -0.27);
        add(group, box(0.08, 0.08, 0.04, getBasic({ color: 0x121212 })), 0.12, 1.98, -0.27);

        add(group, box(0.2, 0.82, 0.2, skin), -0.5, 1.16, 0.04);
        add(group, box(0.14, 0.32, 0.16, skinDark), -0.5, 0.64, 0.05);
        add(group, box(0.2, 0.82, 0.2, skin), 0.5, 1.16, 0.04);
        add(group, box(0.14, 0.32, 0.16, skinDark), 0.5, 0.64, 0.05);

        add(group, box(0.24, 0.92, 0.24, pants), -0.17, 0.48, 0.01);
        add(group, box(0.24, 0.92, 0.24, pants), 0.17, 0.48, 0.01);
        add(group, box(0.26, 0.16, 0.3, boot), -0.17, 0.04, 0.05);
        add(group, box(0.26, 0.16, 0.3, boot), 0.17, 0.04, 0.05);
        return finalize(group, 'entity', 'zombie');
    }

    function createPig() {
        var group = new THREE.Group();
        var skin = getLambert({ color: 0xf0a7b7 });
        var skinDark = getLambert({ color: 0xd98ea0 });
        var snout = getLambert({ color: 0xd68195 });
        var eye = getBasic({ color: 0x1d1116 });

        add(group, box(1.44, 0.72, 0.76, skin), 0, 0.78, 0.05);
        add(group, box(1.36, 0.58, 0.64, skinDark), 0, 0.86, 0.05);
        add(group, box(0.64, 0.52, 0.5, skin), 0, 1.16, 0.14);

        add(group, box(0.1, 0.14, 0.14, snout), 0, 1.06, -0.22);
        add(group, box(0.52, 0.42, 0.42, skin), 0, 0.88, -0.44);
        add(group, box(0.24, 0.16, 0.12, snout), 0, 0.84, -0.67);
        add(group, box(0.04, 0.06, 0.02, eye), -0.12, 0.96, -0.66);
        add(group, box(0.04, 0.06, 0.02, eye), 0.12, 0.96, -0.66);
        add(group, box(0.1, 0.12, 0.04, skin), -0.23, 1.12, -0.62);
        add(group, box(0.1, 0.12, 0.04, skin), 0.23, 1.12, -0.62);
        group.children[group.children.length - 2].rotation.z = -0.18;
        group.children[group.children.length - 1].rotation.z = 0.18;

        add(group, box(0.18, 0.62, 0.18, skin), -0.46, 0.18, 0.44);
        add(group, box(0.18, 0.62, 0.18, skin), 0.46, 0.18, 0.44);
        add(group, box(0.18, 0.62, 0.18, skin), -0.46, 0.18, -0.28);
        add(group, box(0.18, 0.62, 0.18, skin), 0.46, 0.18, -0.28);
        add(group, box(0.08, 0.08, 0.16, skinDark), 0, 0.8, 0.62);
        return finalize(group, 'entity', 'pig');
    }

    function createChest() {
        var group = new THREE.Group();
        var wood = getLambert({ color: 0x7d5734 });
        var woodDark = getLambert({ color: 0x5b3d23 });
        var metal = getLambert({ color: 0xc7ae6a });
        add(group, box(1.0, 0.46, 0.72, wood), 0, 0.24, 0);
        add(group, box(0.88, 0.42, 0.58, woodDark), 0, 0.28, 0);
        add(group, box(1.0, 0.08, 0.08, woodDark), 0, 0.42, 0.32);
        add(group, box(1.0, 0.08, 0.08, woodDark), 0, 0.42, -0.32);
        add(group, box(0.08, 0.42, 0.72, woodDark), 0.46, 0.26, 0);
        add(group, box(0.08, 0.42, 0.72, woodDark), -0.46, 0.26, 0);

        add(group, box(1.0, 0.26, 0.72, wood), 0, 0.62, 0);
        add(group, box(0.9, 0.18, 0.58, woodDark), 0, 0.64, -0.02);
        add(group, box(0.18, 0.24, 0.06, metal), 0, 0.44, 0.39);
        add(group, box(0.08, 0.08, 0.08, metal), -0.38, 0.46, 0.37);
        add(group, box(0.08, 0.08, 0.08, metal), 0.38, 0.46, 0.37);
        return finalize(group, 'entity', 'chest');
    }

    function createDoor() {
        var group = new THREE.Group();
        var wood = getLambert({ color: 0x8d6035 });
        var woodDark = getLambert({ color: 0x684623 });
        var metal = getLambert({ color: 0xbec4cd });
        add(group, box(0.18, 2.0, 1.0, wood), 0, 1.0, 0);
        add(group, box(0.04, 1.86, 0.9, woodDark), 0.08, 1.0, 0);
        add(group, box(0.04, 1.86, 0.9, woodDark), -0.08, 1.0, 0);
        add(group, box(0.04, 0.86, 0.8, woodDark), 0, 1.36, 0);
        add(group, box(0.04, 0.66, 0.8, woodDark), 0, 0.56, 0);
        add(group, box(0.03, 0.16, 0.16, metal), 0.12, 1.64, -0.34);
        add(group, box(0.03, 0.16, 0.16, metal), 0.12, 0.36, -0.34);
        add(group, box(0.06, 0.06, 0.06, metal), -0.12, 1.0, 0.24);
        return finalize(group, 'entity', 'door');
    }

    function createBoosterPad() {
        var group = new THREE.Group();
        var base = getLambert({ color: 0x2e3238 });
        var accent = getBasic({ color: 0x4fd9ff });
        add(group, box(1.2, 0.16, 1.2, base), 0, 0.08, 0);
        add(group, box(0.7, 0.02, 0.18, accent), 0, 0.18, -0.22);
        add(group, box(0.7, 0.02, 0.18, accent), 0, 0.18, 0);
        add(group, box(0.7, 0.02, 0.18, accent), 0, 0.18, 0.22);
        return finalize(group, 'entity', 'boosterPad');
    }

    function createPortal() {
        var group = new THREE.Group();
        var frame = getLambert({ color: 0x2f3239 });
        var rune = getLambert({ color: 0x4f5673, emissive: 0x191d2c });
        var glowA = transparentBasic(0x6d6bff, 0.46);
        var glowB = transparentBasic(0x9c6aff, 0.28);

        add(group, box(0.42, 4.7, 0.34, frame), -1.56, 2.7, 0);
        add(group, box(0.42, 4.7, 0.34, frame), 1.56, 2.7, 0);
        add(group, box(2.9, 0.48, 0.34, frame), 0, 5.24, 0);
        add(group, box(0.72, 0.72, 0.4, rune), -1.56, 0.36, 0);
        add(group, box(0.72, 0.72, 0.4, rune), 1.56, 0.36, 0);
        add(group, box(0.34, 1.22, 0.34, rune), -0.98, 5.8, 0);
        add(group, box(0.34, 1.22, 0.34, rune), 0.98, 5.8, 0);
        add(group, box(0.34, 1.22, 0.34, rune), -1.28, 5.54, 0);
        add(group, box(0.34, 1.22, 0.34, rune), 1.28, 5.54, 0);

        var innerA = new THREE.Mesh(new THREE.PlaneGeometry(2.84, 3.58), glowA);
        innerA.position.set(0, 2.78, -0.03);
        group.add(innerA);
        var innerB = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 2.86), glowB);
        innerB.position.set(0, 2.82, -0.06);
        group.add(innerB);
        return finalize(group, 'entity', 'portal');
    }

    function createMuzzleFlash(options) {
        options = options || {};
        var color = (typeof options.color === 'number') ? options.color : 0xffd27a;
        var opacity = (typeof options.opacity === 'number') ? options.opacity : 0.82;
        var group = new THREE.Group();
        var mat = transparentBasic(color, opacity);
        var planeA = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.34), mat);
        planeA.rotation.z = Math.PI * 0.5;
        group.add(planeA);
        var planeB = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.22), mat);
        planeB.position.x = 0.28;
        group.add(planeB);
        var planeC = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.22), mat);
        planeC.position.x = 0.28;
        planeC.rotation.x = Math.PI * 0.5;
        group.add(planeC);
        return finalize(group, 'misc', 'muzzleFlash');
    }

    function createFootstepMarks() {
        var group = new THREE.Group();
        var mat = transparentBasic(0x3b2f24, 0.42);
        var left = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.34), mat);
        var right = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.34), mat);
        left.rotation.x = -Math.PI * 0.5;
        right.rotation.x = -Math.PI * 0.5;
        left.position.set(-0.11, 0.001, 0);
        right.position.set(0.11, 0.001, 0.06);
        group.add(left);
        group.add(right);
        return finalize(group, 'misc', 'footstepMarks');
    }

    function createBulletHole() {
        var group = new THREE.Group();
        var mat = transparentBasic(0x151515, 0.7);
        var ring = new THREE.Mesh(new THREE.RingGeometry(0.03, 0.08, 10), mat);
        var core = new THREE.Mesh(new THREE.CircleGeometry(0.026, 10), mat);
        group.add(ring);
        core.position.z = 0.0005;
        group.add(core);
        return finalize(group, 'misc', 'bulletHole');
    }

    function createSword() {
        var group = new THREE.Group();
        var blade = getLambert({ color: 0xb9c0c7 });
        var hilt = getLambert({ color: 0x6d4a2b });
        var guard = getLambert({ color: 0x9aa3ac });
        add(group, box(0.08, 0.16, 0.08, hilt), 0.01, 0.08, 0.02);
        add(group, box(0.04, 0.72, 0.04, blade), 0, 0.58, 0);
        add(group, box(0.06, 0.22, 0.06, blade), 0.01, 0.32, 0.02);
        add(group, box(0.24, 0.04, 0.08, guard), -0.33, 0.28, -0.07);
        return finalize(group, 'item', 'sword');
    }

    function createAxe() {
        var group = new THREE.Group();
        var wood = getLambert({ color: 0x8c6338 });
        var head = getLambert({ color: 0xa4abb3 });
        add(group, box(0.06, 0.72, 0.06, wood), -0.03, 0.0, -0.03);
        add(group, box(0.08, 0.18, 0.08, wood), -0.03, 0.34, -0.03);
        add(group, box(0.22, 0.26, 0.08, head), -0.03, 0.31, -0.03);
        add(group, box(0.16, 0.18, 0.08, head), -0.03, 0.31, -0.03);
        return finalize(group, 'item', 'axe');
    }

    function createPickaxe() {
        var group = new THREE.Group();
        var wood = getLambert({ color: 0x8a6238 });
        var head = getLambert({ color: 0xa4abb3 });
        add(group, box(0.06, 0.72, 0.06, wood), -0.03, 0.0, -0.03);
        add(group, box(0.08, 0.18, 0.08, wood), -0.03, 0.34, -0.03);
        var tineA = box(0.18, 0.08, 0.08, head);
        tineA.position.set(-0.13, 0.4, 0);
        tineA.rotation.z = 0.13;
        group.add(tineA);
        var tineB = box(0.18, 0.08, 0.08, head);
        tineB.position.set(0.1, 0.4, 0);
        tineB.rotation.z = -0.13;
        group.add(tineB);
        var tineC = box(0.18, 0.08, 0.08, head);
        tineC.position.set(-0.13, 0.4, 0);
        tineC.rotation.set(0.01, -0.09, 0.13);
        group.add(tineC);
        var tineD = box(0.18, 0.08, 0.08, head);
        tineD.position.set(0.1, 0.4, 0);
        tineD.rotation.z = -0.13;
        group.add(tineD);
        return finalize(group, 'item', 'pickaxe');
    }

    function createShield() {
        var group = new THREE.Group();
        var face = getLambert({ color: 0x5d6e88 });
        var trim = getLambert({ color: 0xb8c1cb });
        add(group, box(0.18, 0.18, 0.12, trim), 0.01, 0.08, 0.02);
        add(group, box(0.14, 0.44, 0.08, face), 0.0, 0.34, 0.0);
        add(group, box(0.22, 0.18, 0.08, face), 0.0, 0.58, 0.0);
        add(group, box(0.12, 0.12, 0.08, trim), 0.01, 0.66, 0.02);
        return finalize(group, 'item', 'shield');
    }

    function createFishingRod() {
        var group = new THREE.Group();
        var wood = getLambert({ color: 0x7c5a36 });
        var wrap = getLambert({ color: 0xc65b4d });
        var hookMat = getLambert({ color: 0xa8b4c4 });
        var lineMat = getBasic({ color: 0xdfe8ef, transparent: true, opacity: 0.85 });

        add(group, box(0.06, 0.06, 1.18, wood), 0, 0.08, 0.04);
        var tip = box(0.04, 0.04, 0.92, wood);
        tip.position.set(0, 0.5, -0.44);
        tip.rotation.x = -0.78;
        group.add(tip);
        add(group, box(0.1, 0.12, 0.22, wrap), 0, -0.22, 0.28);

        var line = new THREE.Mesh(
            new THREE.CylinderGeometry(0.008, 0.008, 1.18, 5),
            lineMat
        );
        line.rotation.z = -0.55;
        line.position.set(0.64, 0.4, -0.58);
        group.add(line);
        var hook = box(0.04, 0.16, 0.04, hookMat);
        hook.position.set(0.64, -0.18, -1.1);
        hook.rotation.z = 0.28;
        group.add(hook);
        return finalize(group, 'item', 'fishingRod');
    }

    function createPotion() {
        var group = new THREE.Group();
        var glass = getLambert({ color: 0x84b4ff, transparent: true, opacity: 0.74 });
        var cork = getLambert({ color: 0xc7a473 });
        add(group, box(0.22, 0.26, 0.22, glass), -0.03, 0.17, 0.03);
        add(group, box(0.08, 0.14, 0.08, glass), 0, 0.44, 0);
        add(group, box(0.12, 0.08, 0.12, cork), 0, 0.62, 0);
        add(group, box(0.14, 0.38, 0.14, transparentBasic(0x3e88ff, 0.68)), 0, 0.14, 0);
        return finalize(group, 'item', 'potion');
    }

    function createBlock(id) {
        var palettes = {
            dirt: { side: 0x6f4c2f, specks: [0x56371f, 0x845b38] },
            wood: { side: 0x8f6237, specks: [0x6f4727, 0xb17c47] },
            sand: { side: 0xebd5a2, specks: [0xf0d9a5, 0xe4cf9f, 0xf4e0aa] },
            grass: { side: 0x81672e, top: 0x86b22c, bottom: 0x6e4f33, specks: [0x6baa31, 0xa9cb32, 0x7aa529] },
            stone: { side: 0x818181, specks: [0x898989, 0x777777, 0x949494] },
            iron: { side: 0x7f7f7f, accent: 0x994732, accent2: 0xbc7a52, specks: [0x898989, 0x777777] },
            gold: { side: 0x7f7f7f, accent: 0xde9b00, accent2: 0xffd503, specks: [0x898989, 0x777777] }
        };
        var palette = palettes[id] || palettes.stone;
        var group = new THREE.Group();
        add(group, box(1, 1, 1, getLambert({ color: palette.side })), 0, 0.5, 0);
        if (palette.top != null) add(group, box(0.98, 0.08, 0.98, getLambert({ color: palette.top })), 0, 0.96, 0);
        if (palette.bottom != null) add(group, box(0.98, 0.08, 0.98, getLambert({ color: palette.bottom })), 0, 0.04, 0);
        if (palette.specks && palette.specks.length) {
            for (var i = 0; i < palette.specks.length; i++) {
                add(
                    group,
                    box(0.12, 0.12, 0.03, getLambert({ color: palette.specks[i] })),
                    -0.28 + (i * 0.24),
                    0.32 + ((i % 2) * 0.26),
                    0.49
                );
            }
        }
        if (palette.accent != null) {
            add(group, box(0.34, 0.34, 0.08, getLambert({ color: palette.accent })), 0.2, 0.62, 0.46);
            add(group, box(0.2, 0.2, 0.08, getLambert({ color: palette.accent })), -0.26, 0.28, 0.46);
            if (palette.accent2 != null) {
                add(group, box(0.12, 0.12, 0.08, getLambert({ color: palette.accent2 })), 0.06, 0.78, 0.46);
                add(group, box(0.12, 0.12, 0.08, getLambert({ color: palette.accent2 })), -0.12, 0.16, 0.46);
            }
        }
        return finalize(group, 'block', id);
    }

    function createSmoke(options) {
        options = options || {};
        var group = new THREE.Group();
        var color = (typeof options.color === 'number') ? options.color : 0x8e9298;
        var mat = transparentBasic(color, 0.32);
        add(group, sphere(0.14, mat), -0.02, 0.18, -0.04);
        add(group, sphere(0.18, mat), 0.08, 0.28, 0.02);
        add(group, sphere(0.12, mat), -0.08, 0.3, 0.06);
        return finalize(group, 'particle', 'smoke');
    }

    function createDust(options) {
        options = options || {};
        var group = new THREE.Group();
        var color = (typeof options.color === 'number') ? options.color : 0xc9ab7a;
        var mat = transparentBasic(color, 0.28);
        add(group, sphere(0.07, mat), -0.1, 0.05, 0.0);
        add(group, sphere(0.09, mat), 0.02, 0.03, -0.05);
        add(group, sphere(0.06, mat), 0.14, 0.08, 0.04);
        return finalize(group, 'particle', 'dust');
    }

    function createSparks(options) {
        options = options || {};
        var group = new THREE.Group();
        var color = (typeof options.color === 'number') ? options.color : 0xffc35f;
        var mat = transparentBasic(color, 0.9);
        var angles = [0, 0.42, -0.42, 0.86, -0.86];
        for (var i = 0; i < angles.length; i++) {
            var spark = box(0.02, 0.02, 0.24, mat);
            spark.rotation.y = angles[i];
            spark.rotation.x = (i % 2 === 0) ? 0.18 : -0.14;
            spark.position.x = 0.06 + (i * 0.02);
            group.add(spark);
        }
        return finalize(group, 'particle', 'sparks');
    }

    function createFire(options) {
        options = options || {};
        var group = new THREE.Group();
        var outer = transparentBasic((typeof options.color === 'number') ? options.color : 0xff8c2b, 0.76);
        var inner = transparentBasic(0xffd870, 0.82);
        var core = box(0.18, 0.48, 0.12, outer);
        core.position.set(-0.09, 0.3, -0.28);
        core.rotation.z = -Math.PI * 0.25;
        group.add(core);
        var core2 = box(0.18, 0.48, 0.12, outer);
        core2.position.set(-0.09, 0.3, -0.28);
        core2.rotation.z = Math.PI * 0.25;
        group.add(core2);
        add(group, box(0.18, 0.36, 0.18, inner), 0.05, 0.18, 0.25);
        var emberA = box(0.12, 0.26, 0.08, outer);
        emberA.position.set(0.08, 0.18, -0.28);
        emberA.rotation.set(-0.31, 0.88, -0.41);
        group.add(emberA);
        var emberB = box(0.12, 0.22, 0.08, outer);
        emberB.position.set(-0.18, 0.22, 0.15);
        emberB.rotation.set(0.21, 0.72, 0.52);
        group.add(emberB);
        return finalize(group, 'particle', 'fire');
    }

    function createArrow() {
        var group = new THREE.Group();
        var shaft = getLambert({ color: 0x87603a });
        var tipMat = getLambert({ color: 0xced4dd });
        var fletch = transparentBasic(0xe5efff, 0.9);
        add(group, box(0.06, 0.06, 1.06, shaft), -0.03, 0.03, 0);
        var tip = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.18, 4), tipMat);
        tip.rotation.x = Math.PI * 0.5;
        tip.rotation.z = Math.PI * 0.25;
        tip.position.set(-0.03, 0.03, -0.54);
        group.add(tip);
        var vaneA = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.16), fletch);
        vaneA.position.set(-0.03, 0.03, 0.5);
        group.add(vaneA);
        var vaneB = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.16), fletch);
        vaneB.position.set(-0.03, 0.03, 0.5);
        vaneB.rotation.z = Math.PI * 0.5;
        group.add(vaneB);
        return finalize(group, 'projectile', 'arrow');
    }

    function createLaser() {
        var group = new THREE.Group();
        add(group, box(0.08, 0.08, 1.25, getBasic({ color: 0x67f0ff, transparent: true, opacity: 0.96 })), 0, 0, -1.06);
        return finalize(group, 'projectile', 'laser');
    }

    function createFireball() {
        var group = new THREE.Group();
        var coreMat = getBasic({ color: 0xff7a20, transparent: true, opacity: 0.94 });
        var glowMat = transparentBasic(0xffbf58, 0.28);
        add(group, box(0.34, 0.34, 0.34, coreMat), 0.03, 0.03, 0);
        add(group, box(0.22, 0.52, 0.22, coreMat), 0.19, 0.09, 0);
        add(group, box(0.22, 0.22, 0.52, coreMat), 0.19, 0.09, 0);
        add(group, box(0.22, 0.22, 0.52, coreMat), 0.19, 0.09, 0);
        group.children[group.children.length - 1].rotation.x = Math.PI * 0.5;
        var flameA = crossedPlanes(0.62, 0.62, glowMat);
        flameA.position.set(0.19, -0.08, -0.24);
        group.add(flameA);
        var flameB = crossedPlanes(0.48, 0.86, glowMat);
        flameB.position.set(0.19, -0.08, -0.56);
        group.add(flameB);
        return finalize(group, 'projectile', 'fireball');
    }

    function createBullet() {
        var group = new THREE.Group();
        add(group, box(0.1, 0.1, 3.5, getLambert({ color: 0x9da3ac })), 0, 0, -1.75);
        return finalize(group, 'projectile', 'bullet');
    }

    function createFlyingRock() {
        var group = new THREE.Group();
        var rockA = getLambert({ color: 0x8f7d66 });
        var rockB = getLambert({ color: 0xa39178 });
        add(group, box(0.34, 0.26, 0.22, rockA), -0.06, 0.0, -0.06);
        add(group, box(0.18, 0.16, 0.14, rockB), 0.02, 0.02, 0.08);
        return finalize(group, 'projectile', 'flyingRock');
    }

    function createRocks() {
        var group = new THREE.Group();
        var rockA = getLambert({ color: 0x8d7d66 });
        var rockB = getLambert({ color: 0xa08e74 });
        add(group, box(0.38, 0.26, 0.34, rockA), -0.06, 0.0, -0.19);
        add(group, box(0.26, 0.18, 0.24, rockB), 0.06, 0.0, 0);
        return finalize(group, 'environment', 'rocks');
    }

    function createGrasses() {
        var group = new THREE.Group();
        var mat = transparentBasic(0x79b34d, 0.88);
        var bladeA = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 1.0), mat);
        bladeA.position.y = 0.5;
        bladeA.quaternion.set(0.2705980500730985, 0.6532814824381882, -0.6532814824381883, 0.27059805007309856);
        group.add(bladeA);
        var bladeB = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 1.0), mat);
        bladeB.position.y = 0.5;
        bladeB.quaternion.set(0.6532814824381882, 0.27059805007309845, -0.2705980500730985, 0.6532814824381883);
        group.add(bladeB);
        return finalize(group, 'environment', 'grasses');
    }

    function createFlowers() {
        var group = new THREE.Group();
        var stem = getLambert({ color: 0x4b8b47 });
        var petalA = getLambert({ color: 0xf7d35f });
        var petalB = getLambert({ color: 0xe56ca2 });
        var centers = [
            [-0.18, 0.22, -0.31],
            [0.18, 0.19, -0.25],
            [-0.34, 0.26, 0.02],
            [-0.25, 0.44, 0.31],
            [0.06, 0.0, 0.19],
            [0.22, 0.19, 0.34],
            [0.0, 0.21, 0.0]
        ];
        for (var i = 0; i < centers.length; i++) {
            add(group, box(0.03, 0.34, 0.03, stem), centers[i][0], 0.16, centers[i][2]);
            add(group, sphere(0.05, (i % 2 === 0) ? petalA : petalB), centers[i][0], 0.38 + centers[i][1], centers[i][2]);
        }
        return finalize(group, 'environment', 'flowers');
    }

    function createSwarmOfBugs() {
        var group = new THREE.Group();
        var mat = getBasic({ color: 0x222222, transparent: true, opacity: 0.8 });
        var bugPositions = [
            [-0.18, 0.22, 0.04],
            [0.12, 0.3, -0.08],
            [0.22, 0.18, 0.1],
            [-0.04, 0.34, 0.16],
            [0.03, 0.16, -0.14]
        ];
        for (var i = 0; i < bugPositions.length; i++) {
            add(group, sphere(0.03, mat, 6, 5), bugPositions[i][0], bugPositions[i][1], bugPositions[i][2]);
        }
        return finalize(group, 'environment', 'swarmOfBugs');
    }

    function createRubble() {
        var group = new THREE.Group();
        add(group, box(0.28, 0.14, 0.24, getLambert({ color: 0x7a746c })), -0.16, 0.07, 0.02);
        add(group, box(0.18, 0.1, 0.16, getLambert({ color: 0x908980 })), 0.08, 0.05, -0.08);
        add(group, box(0.12, 0.08, 0.18, getLambert({ color: 0x5f5a53 })), 0.22, 0.04, 0.12);
        return finalize(group, 'environment', 'rubble');
    }

    function createFence() {
        var group = new THREE.Group();
        var wood = getLambert({ color: 0x7e5833 });
        add(group, box(0.12, 1.08, 0.12, wood), 0.32, 0.54, -0.06);
        add(group, box(0.84, 0.12, 0.12, wood), 0.06, 0.72, -0.06);
        add(group, box(0.84, 0.12, 0.12, wood), 0.06, 0.38, -0.06);
        return finalize(group, 'structure', 'fence');
    }

    function createLightPole() {
        var group = new THREE.Group();
        var pole = getLambert({ color: 0x4b5058 });
        var housing = getLambert({ color: 0x2c2f35 });
        add(group, box(0.14, 3.1, 0.14, pole), 0, 1.55, 0);
        add(group, box(0.14, 0.14, 1.18, pole), 0, 3.04, -0.52);
        add(group, box(0.42, 0.9, 0.28, housing), 0, 2.82, -1.04);
        add(group, sphere(0.08, getBasic({ color: 0xff4f4f, transparent: true, opacity: 0.86 })), 0, 3.14, -1.2);
        add(group, sphere(0.08, getBasic({ color: 0xe3c94d, transparent: true, opacity: 0.8 })), 0, 2.84, -1.2);
        add(group, sphere(0.08, getBasic({ color: 0x5ee36d, transparent: true, opacity: 0.82 })), 0, 2.54, -1.2);
        return finalize(group, 'structure', 'lightPole');
    }

    function createSign() {
        var group = new THREE.Group();
        var wood = getLambert({ color: 0x8a6137 });
        var face = getLambert({ color: 0xc49f68 });
        add(group, box(0.1, 1.28, 0.1, wood), -0.04, 0.64, -0.04);
        add(group, box(0.78, 0.36, 0.08, face), -0.04, 1.04, -0.17);
        add(group, box(0.66, 0.04, 0.01, getBasic({ color: 0x5b4021 })), -0.04, 1.04, -0.12);
        return finalize(group, 'structure', 'sign');
    }

    function createUiIcon(options) {
        if (typeof document === 'undefined') return null;
        options = options || {};
        var ns = 'http://www.w3.org/2000/svg';
        var svg = document.createElementNS(ns, 'svg');
        svg.setAttribute('viewBox', '0 0 32 32');
        svg.setAttribute('width', String(options.size || 64));
        svg.setAttribute('height', String(options.size || 64));
        svg.style.imageRendering = 'pixelated';

        function rect(x, y, w, h, fill) {
            var node = document.createElementNS(ns, 'rect');
            node.setAttribute('x', String(x));
            node.setAttribute('y', String(y));
            node.setAttribute('width', String(w));
            node.setAttribute('height', String(h));
            node.setAttribute('fill', fill);
            svg.appendChild(node);
        }

        rect(0, 0, 32, 32, '#101318');
        rect(2, 2, 28, 28, '#1d232c');
        rect(5, 6, 10, 2, '#9e9e9e');
        rect(13, 4, 2, 8, '#bcbcbc');
        rect(16, 6, 10, 2, '#6abe30');
        rect(22, 5, 2, 4, '#6abe30');
        rect(6, 17, 4, 8, '#83cde4');
        rect(12, 16, 3, 10, '#49b0c5');
        rect(19, 15, 8, 3, '#ac3232');
        rect(22, 18, 3, 6, '#8f563b');
        svg.dataset.assetCategory = 'ui';
        svg.dataset.assetId = 'icon';
        return svg;
    }

    function createUiImage(options) {
        if (typeof document === 'undefined') return null;
        options = options || {};
        var canvas = document.createElement('canvas');
        canvas.width = Number(options.width || 320);
        canvas.height = Number(options.height || 180);
        var ctx = canvas.getContext('2d');
        if (!ctx) return canvas;
        var grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        grad.addColorStop(0, '#11161d');
        grad.addColorStop(1, '#263241');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#1a2028';
        ctx.fillRect(16, 16, canvas.width - 32, canvas.height - 32);
        ctx.strokeStyle = '#49b0c5';
        ctx.lineWidth = 4;
        ctx.strokeRect(16, 16, canvas.width - 32, canvas.height - 32);
        ctx.fillStyle = '#9e9e9e';
        ctx.fillRect(44, 48, 64, 12);
        ctx.fillRect(96, 36, 12, 48);
        ctx.fillStyle = '#6abe30';
        ctx.fillRect(170, 44, 72, 12);
        ctx.fillRect(220, 32, 12, 48);
        ctx.fillStyle = '#49b0c5';
        ctx.fillRect(56, 102, 26, 40);
        ctx.fillRect(92, 94, 18, 50);
        ctx.fillStyle = '#83cde4';
        ctx.fillRect(50, 96, 14, 44);
        ctx.fillStyle = '#ac3232';
        ctx.fillRect(184, 96, 50, 18);
        ctx.fillStyle = '#8f563b';
        ctx.fillRect(202, 116, 20, 26);
        canvas.dataset.assetCategory = 'ui';
        canvas.dataset.assetId = 'image';
        return canvas;
    }

    function createUiBackground(options) {
        if (typeof document === 'undefined') return null;
        options = options || {};
        var el = document.createElement('div');
        el.style.width = options.width || '320px';
        el.style.height = options.height || '180px';
        el.style.background = 'linear-gradient(135deg, #0f141a 0%, #243142 55%, #11161d 100%)';
        el.style.border = '1px solid rgba(73,176,197,0.55)';
        el.style.boxShadow = 'inset 0 0 0 1px rgba(172,50,50,0.18)';
        el.style.position = 'relative';
        var badge = document.createElement('div');
        badge.style.position = 'absolute';
        badge.style.inset = '20px auto auto 20px';
        badge.style.width = '88px';
        badge.style.height = '88px';
        badge.style.background = 'radial-gradient(circle at 35% 35%, #83cde4 0%, #49b0c5 40%, #1d232c 72%)';
        badge.style.border = '4px solid #9e9e9e';
        badge.style.transform = 'rotate(-8deg)';
        el.appendChild(badge);
        var stripe = document.createElement('div');
        stripe.style.position = 'absolute';
        stripe.style.right = '18px';
        stripe.style.bottom = '18px';
        stripe.style.width = '110px';
        stripe.style.height = '18px';
        stripe.style.background = '#ac3232';
        stripe.style.boxShadow = '0 -24px 0 #6abe30, 0 -48px 0 #9e9e9e';
        el.appendChild(stripe);
        el.dataset.assetCategory = 'ui';
        el.dataset.assetId = 'background';
        return el;
    }

    function createUiFont(options) {
        if (typeof document === 'undefined') return null;
        options = options || {};
        var el = document.createElement('span');
        el.textContent = String(options.text || 'MAYHEM FONT SAMPLE');
        el.style.fontFamily = "'Orbitron', 'Courier New', monospace";
        el.style.fontSize = options.fontSize || '20px';
        el.style.letterSpacing = '0.16em';
        el.style.color = '#f6f7fb';
        el.dataset.assetCategory = 'ui';
        el.dataset.assetId = 'font';
        return el;
    }

    var builders = {
        entity: {
            zombie: createZombie,
            pig: createPig,
            chest: createChest,
            door: createDoor,
            boosterPad: createBoosterPad,
            portal: createPortal
        },
        misc: {
            muzzleFlash: createMuzzleFlash,
            footstepMarks: createFootstepMarks,
            bulletHole: createBulletHole
        },
        item: {
            sword: createSword,
            axe: createAxe,
            pickaxe: createPickaxe,
            shield: createShield,
            fishingRod: createFishingRod,
            potion: createPotion
        },
        block: {
            dirt: function () { return createBlock('dirt'); },
            wood: function () { return createBlock('wood'); },
            sand: function () { return createBlock('sand'); },
            grass: function () { return createBlock('grass'); },
            stone: function () { return createBlock('stone'); },
            iron: function () { return createBlock('iron'); },
            gold: function () { return createBlock('gold'); }
        },
        particle: {
            smoke: createSmoke,
            dust: createDust,
            sparks: createSparks,
            fire: createFire
        },
        projectile: {
            arrow: createArrow,
            laser: createLaser,
            fireball: createFireball,
            bullet: createBullet,
            flyingRock: createFlyingRock
        },
        environment: {
            rocks: createRocks,
            grasses: createGrasses,
            flowers: createFlowers,
            swarmOfBugs: createSwarmOfBugs,
            rubble: createRubble
        },
        structure: {
            fence: createFence,
            lightPole: createLightPole,
            sign: createSign
        },
        ui: {
            icon: createUiIcon,
            image: createUiImage,
            background: createUiBackground,
            font: createUiFont
        }
    };

    function create(categoryId, assetId, options) {
        var category = builders[String(categoryId || '')] || null;
        if (!category) return null;
        var builder = category[String(assetId || '')] || null;
        return (typeof builder === 'function') ? builder(options || {}) : null;
    }

    runtime.GameAssetFactory = {
        create: create,
        createEntityAsset: function (assetId, options) { return create('entity', assetId, options); },
        createMiscAsset: function (assetId, options) { return create('misc', assetId, options); },
        createItemAsset: function (assetId, options) { return create('item', assetId, options); },
        createBlockAsset: function (assetId, options) { return create('block', assetId, options); },
        createParticleAsset: function (assetId, options) { return create('particle', assetId, options); },
        createProjectileAsset: function (assetId, options) { return create('projectile', assetId, options); },
        createEnvironmentAsset: function (assetId, options) { return create('environment', assetId, options); },
        createStructureAsset: function (assetId, options) { return create('structure', assetId, options); },
        createUiAsset: function (assetId, options) { return create('ui', assetId, options); },
        getRecipe: function (categoryId, assetId) {
            if (assetRecipes.get) return assetRecipes.get(categoryId, assetId);
            var defs = recipeDefinitions[String(categoryId || '')] || {};
            return defs[String(assetId || '')] || null;
        },
        list: function (categoryId) {
            if (assetRecipes.list) return assetRecipes.list(categoryId);
            var defs = recipeDefinitions[String(categoryId || '')] || {};
            return Object.values(defs);
        }
    };
})();
