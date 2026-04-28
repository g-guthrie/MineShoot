(function () {
    'use strict';

    var runtime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    var DEFAULT_COLOR_METAL = 0x2a2a2a;
    var DEFAULT_COLOR_DARK = 0x171717;
    var DEFAULT_COLOR_WOOD = 0x7a512d;
    var DEFAULT_HANDLE_BACK = [0, -0.12, 0.12];
    var DEFAULT_MUZZLE = [0, 0.02, -0.84];
    var DEFAULT_RELOAD_ZONE = [0, 0.04, -0.12];
    var DEFAULT_SUPPORT_ZONE = [0, -0.03, -0.18];
    var VALID_HOLD_CLASSES = {
        oneHandCompact: true,
        oneHandLarge: true,
        twoHandPrecision: true
    };
    var VALID_STOCK_CLASSES = {
        none: true,
        short: true,
        precision: true
    };

    function cloneVec3(list, fallback) {
        var source = Array.isArray(list) ? list : fallback;
        return [
            Number(source && source[0] || 0),
            Number(source && source[1] || 0),
            Number(source && source[2] || 0)
        ];
    }

    function clonePart(part, fallbackColor) {
        if (!part) return null;
        return {
            position: cloneVec3(part.position || part.p, [0, 0, 0]),
            size: cloneVec3(part.size || part.s, [1, 1, 1]),
            color: (typeof part.color === 'number' ? part.color : (typeof part.c === 'number' ? part.c : fallbackColor)),
            visible: part.visible !== false
        };
    }

    function cloneAimProfile(aim, fallbackShoulder, fallbackWrist) {
        var profile = aim || {};
        return {
            shoulderFactor: Number(profile.shoulderFactor != null ? profile.shoulderFactor : fallbackShoulder),
            wristFactor: Number(profile.wristFactor != null ? profile.wristFactor : fallbackWrist)
        };
    }

    function cloneAsset(asset) {
        if (!asset) return null;
        return {
            type: String(asset.type || ''),
            url: String(asset.url || ''),
            textureUrl: String(asset.textureUrl || ''),
            scale: Number(asset.scale != null ? asset.scale : 1),
            rotationDeg: cloneVec3(asset.rotationDeg || asset.rotation || [0, 0, 0], [0, 0, 0]),
            sourceMuzzle: cloneVec3(asset.sourceMuzzle, [0, 0, 0])
        };
    }

    function cloneQuat(list, fallback) {
        var source = Array.isArray(list) ? list : fallback;
        return [
            Number(source && source[0] || 0),
            Number(source && source[1] || 0),
            Number(source && source[2] || 0),
            Number(source && source[3] != null ? source[3] : 1)
        ];
    }

    function cloneToonAttachment(attachment) {
        if (!attachment) return null;
        return {
            sourceUrl: String(attachment.sourceUrl || ''),
            parentNode: String(attachment.parentNode || ''),
            weaponNode: String(attachment.weaponNode || ''),
            translation: cloneVec3(attachment.translation, [0, 0, 0]),
            rotation: cloneQuat(attachment.rotation, [0, 0, 0, 1]),
            scale: cloneVec3(attachment.scale, [1, 1, 1]),
            useMountOffset: attachment.useMountOffset === true
        };
    }

    function ensurePlatform(definition) {
        var raw = definition || {};
        var holdClass = String(raw.holdClass || 'oneHandLarge');
        var stockClass = String(raw.stockClass || 'short');
        if (!VALID_HOLD_CLASSES[holdClass]) {
            throw new Error('Unknown weapon holdClass: ' + holdClass);
        }
        if (!VALID_STOCK_CLASSES[stockClass]) {
            throw new Error('Unknown weapon stockClass: ' + stockClass);
        }
        if (holdClass !== 'twoHandPrecision' && stockClass === 'precision') {
            throw new Error('Only twoHandPrecision weapons may use stockClass "precision".');
        }

        var mount = raw.mount || {};
        var zones = raw.zones || {};
        var parts = raw.parts || {};

        var platform = {
            classId: 'gun',
            holdClass: holdClass,
            stockClass: stockClass,
            mount: {
                contact: 'handleBack',
                position: cloneVec3(mount.position, [0, 0, 0]),
                rotationDeg: cloneVec3(mount.rotationDeg || mount.rotation || [0, 0, 0], [0, 0, 0]),
                aim: cloneAimProfile(mount.aim, 0.7, 0.3)
            },
            zones: {
                handleBack: cloneVec3(zones.handleBack, DEFAULT_HANDLE_BACK),
                muzzle: cloneVec3(zones.muzzle, DEFAULT_MUZZLE),
                reloadZone: cloneVec3(zones.reloadZone, DEFAULT_RELOAD_ZONE),
                supportZone: cloneVec3(zones.supportZone, DEFAULT_SUPPORT_ZONE),
                rearExtent: Math.max(0, Number(zones.rearExtent != null ? zones.rearExtent : 0.2))
            },
            parts: {
                receiver: clonePart(parts.receiver, DEFAULT_COLOR_METAL),
                grip: clonePart(parts.grip, DEFAULT_COLOR_WOOD),
                barrel: clonePart(parts.barrel, DEFAULT_COLOR_DARK),
                stock: clonePart(parts.stock, DEFAULT_COLOR_WOOD),
                opticRail: clonePart(parts.opticRail, DEFAULT_COLOR_DARK),
                optic: clonePart(parts.optic, 0x686868),
                muzzleDevice: clonePart(parts.muzzleDevice, DEFAULT_COLOR_DARK),
                underbarrel: clonePart(parts.underbarrel, DEFAULT_COLOR_WOOD),
                feed: clonePart(parts.feed, DEFAULT_COLOR_METAL),
                accentA: clonePart(parts.accentA, DEFAULT_COLOR_METAL),
                accentB: clonePart(parts.accentB, DEFAULT_COLOR_METAL)
            },
            asset: cloneAsset(raw.asset),
            toonAttachment: cloneToonAttachment(raw.toonAttachment)
        };

        if (!platform.parts.receiver || !platform.parts.grip || !platform.parts.barrel) {
            throw new Error('Weapon platform definitions require receiver, grip, and barrel parts.');
        }
        return platform;
    }

    function partToLegacy(part) {
        if (!part) return null;
        return {
            p: cloneVec3(part.position, [0, 0, 0]),
            s: cloneVec3(part.size, [1, 1, 1]),
            c: (typeof part.color === 'number') ? part.color : DEFAULT_COLOR_METAL
        };
    }

    function toLegacyVisual(platform) {
        var optic = platform.parts.optic;
        var underbarrel = platform.parts.underbarrel;
        return {
            classId: platform.classId,
            mount: {
                position: cloneVec3(platform.mount.position, [0, 0, 0]),
                rotation: platform.mount.rotationDeg.map(function (deg) {
                    return Number(deg || 0) * (Math.PI / 180);
                })
            },
            parts: {
                body: partToLegacy(platform.parts.receiver),
                barrel: partToLegacy(platform.parts.barrel),
                stock: partToLegacy(platform.parts.stock),
                grip: partToLegacy(platform.parts.grip),
                scope: !!optic,
                pump: !!underbarrel,
                coil: false
            },
            anchors: {
                handle: cloneVec3(platform.zones.handleBack, DEFAULT_HANDLE_BACK),
                barrelTip: cloneVec3(platform.zones.muzzle, DEFAULT_MUZZLE),
                support: cloneVec3(platform.zones.supportZone, DEFAULT_SUPPORT_ZONE)
            },
            effects: {
                muzzleFlash: {
                    position: cloneVec3(platform.zones.muzzle, DEFAULT_MUZZLE)
                }
            }
        };
    }

    var weaponPlatformEntries = {
        rifle: ensurePlatform({
            holdClass: 'oneHandLarge',
            stockClass: 'short',
            asset: {
                type: 'gltf',
                url: '/assets/weapons/toon-shooter/scout-rifle.gltf',
                textureUrl: '',
                scale: 0.72,
                rotationDeg: [0, -90, 0],
                sourceMuzzle: [-1.2651, 0.2121, 0.0009]
            },
            toonAttachment: {
                sourceUrl: '/assets/characters/toon-shooter/Character_Enemy.gltf',
                parentNode: 'Index1.R',
                weaponNode: 'Sniper_2',
                translation: [-0.033812522888183594, 0.1839268719164987, -0.030244827270507812],
                rotation: [0.3192978501319885, -0.544323742389679, -0.650169312953949, 0.4231317639350891],
                scale: [0.9165812134742737, 0.9165812134742737, 0.916581392288208]
            },
            mount: {
                position: [0.0, 0.02, 0.08],
                rotationDeg: [2, 2, -1],
                aim: { shoulderFactor: 0.7, wristFactor: 0.3 }
            },
            zones: {
                handleBack: [0, -0.1, 0.08],
                muzzle: [0, 0.02, -0.56],
                reloadZone: [0, 0.04, -0.08],
                supportZone: [-0.05, -0.03, -0.34],
                rearExtent: 0.22
            },
            parts: {
                receiver: { position: [0, 0.0, -0.06], size: [0.2352, 0.1, 0.55], color: 0x333333 },
                grip: { position: [0, -0.1, 0.02], size: [0.1344, 0.14, 0.08], color: 0x7a512d },
                barrel: { position: [0, 0.02, -0.36], size: [0.1456, 0.08, 0.26], color: 0x222222 },
                stock: { position: [0, -0.04, 0.14], size: [0.2128, 0.11, 0.16], color: 0x7a512d }
            }
        }),
        pistol: ensurePlatform({
            holdClass: 'oneHandCompact',
            stockClass: 'none',
            asset: {
                type: 'gltf',
                url: '/assets/weapons/toon-shooter/revolver.gltf',
                textureUrl: '',
                scale: 0.62,
                rotationDeg: [0, -90, 0],
                sourceMuzzle: [-0.8349, 0.2487, 0.0028]
            },
            toonAttachment: {
                sourceUrl: '/assets/characters/toon-shooter/Character_Enemy.gltf',
                parentNode: 'Index1.R',
                weaponNode: 'Revolver',
                translation: [-0.03695803880691528, 0.1359110986201425, -0.04479995369911194],
                rotation: [0.06790197640657425, 0.09356407076120377, 0.46245670318603516, 0.8790727853775024],
                scale: [0.10991809517145157, 0.10991813242435455, 0.11939284205436707],
                useMountOffset: true
            },
            mount: {
                position: [0.0, 0.055, 0.08],
                rotationDeg: [10, 5, 0],
                aim: { shoulderFactor: 0.68, wristFactor: 0.32 }
            },
            zones: {
                handleBack: [0, -0.135, 0.02],
                muzzle: [0, 0.005, -0.44],
                reloadZone: [0, 0.02, -0.06],
                supportZone: [-0.02, -0.055, -0.1],
                rearExtent: 0.08
            },
            parts: {
                receiver: { position: [0, -0.02, -0.06], size: [0.1848, 0.085, 0.385], color: 0x3a3a3a },
                grip: { position: [0, -0.14, -0.01], size: [0.12096, 0.154, 0.1], color: 0x6f4d32 },
                barrel: { position: [0, 0.0, -0.24], size: [0.1008, 0.0544, 0.169], color: 0x2c2c2c },
                stock: { position: [0, -0.05, 0.09], size: [0.1134, 0.0935, 0.1152], color: 0x6f4d32 }
            }
        }),
        machinegun: ensurePlatform({
            holdClass: 'oneHandLarge',
            stockClass: 'short',
            asset: {
                type: 'gltf',
                url: '/assets/weapons/toon-shooter/ak.gltf',
                textureUrl: '',
                scale: 0.9,
                rotationDeg: [0, -90, 0],
                sourceMuzzle: [-1.0274, 0.2455, -0.0023]
            },
            toonAttachment: {
                sourceUrl: '/assets/characters/toon-shooter/Character_Enemy.gltf',
                parentNode: 'Index1.R',
                weaponNode: 'AK',
                translation: [0.01034402847290039, 0.1514850997775793, -0.05410188436508179],
                rotation: [0.07112707942724228, 0.07164616882801056, 0.5258878469467163, 0.844541072845459],
                scale: [0.4179118871688843, 0.41791191697120667, 0.41791197657585144]
            },
            mount: {
                position: [0.0, 0.02, 0.08],
                rotationDeg: [0, 0, 0],
                aim: { shoulderFactor: 0.69, wristFactor: 0.31 }
            },
            zones: {
                handleBack: [0, -0.08, 0.1],
                muzzle: [0, 0.02, -0.9],
                reloadZone: [0, 0.04, -0.12],
                supportZone: [-0.08, -0.03, -0.32],
                rearExtent: 0.22
            },
            parts: {
                receiver: { position: [0, 0.0, -0.08], size: [0.336, 0.105, 0.726], color: 0x2b2b2b },
                grip: { position: [0, -0.11, 0.01], size: [0.14, 0.1512, 0.08], color: 0x565656 },
                barrel: { position: [0, 0.03, -0.52], size: [0.1708, 0.08, 0.4212], color: 0x191919 },
                stock: { position: [0, -0.03, 0.19], size: [0.2576, 0.1155, 0.1888], color: 0x565656 }
            }
        }),
        shotgun: ensurePlatform({
            holdClass: 'oneHandLarge',
            stockClass: 'short',
            asset: {
                type: 'gltf',
                url: '/assets/weapons/toon-shooter/shotgun.gltf',
                textureUrl: '',
                scale: 0.72,
                rotationDeg: [0, -90, 0],
                sourceMuzzle: [-1.2499, 0.0489, 0]
            },
            toonAttachment: {
                sourceUrl: '/assets/characters/toon-shooter/Character_Enemy.gltf',
                parentNode: 'Index1.R',
                weaponNode: 'Shotgun',
                translation: [-0.03956228494644165, 0.197227946421351, -0.07035112380981445],
                rotation: [0.4583534896373749, -0.47960832715034485, -0.5488527417182922, 0.5085752010345459],
                scale: [1, 1, 1],
                useMountOffset: true
            },
            mount: {
                position: [0.0, 0.02, 0.08],
                rotationDeg: [0, 0, 0],
                aim: { shoulderFactor: 0.7, wristFactor: 0.3 }
            },
            zones: {
                handleBack: [0, -0.1, 0.08],
                muzzle: [0, 0.02, -0.86],
                reloadZone: [0, 0.04, -0.1],
                supportZone: [-0.05, -0.03, -0.44],
                rearExtent: 0.24
            },
            parts: {
                receiver: { position: [0, 0.0, -0.1], size: [0.3304, 0.106, 0.649], color: 0x6b4220 },
                grip: { position: [0, -0.1, 0.02], size: [0.1428, 0.1484, 0.0816], color: 0x8a5a2d },
                barrel: { position: [0, 0.02, -0.47], size: [0.2632, 0.0896, 0.403], color: 0x222222 },
                stock: { position: [0, -0.03, 0.21], size: [0.2548, 0.1144, 0.1856], color: 0x8a5a2d },
                underbarrel: { position: [0, -0.03, -0.33], size: [0.2408, 0.08, 0.12], color: 0x8a5a2d }
            }
        }),
        sniper: ensurePlatform({
            holdClass: 'twoHandPrecision',
            stockClass: 'precision',
            asset: {
                type: 'gltf',
                url: '/assets/weapons/toon-shooter/sniper.gltf',
                textureUrl: '',
                scale: 0.82,
                rotationDeg: [0, -90, 0],
                sourceMuzzle: [-1.588, 0.2293, -0.0214]
            },
            toonAttachment: {
                sourceUrl: '/assets/characters/toon-shooter/Character_Enemy.gltf',
                parentNode: 'Index1.R',
                weaponNode: 'Sniper',
                translation: [0.005934536457061768, 0.16237883915587858, -0.05194741487503052],
                rotation: [0.032933976501226425, 0.036410339176654816, 0.5895998477935791, 0.8062020540237427],
                scale: [0.21388870477676392, 0.21388870477676392, 0.21388870477676392]
            },
            mount: {
                position: [0.0, 0.02, 0.04],
                rotationDeg: [0, 0, 0],
                aim: { shoulderFactor: 0.72, wristFactor: 0.28 }
            },
            zones: {
                handleBack: [0, -0.11, 0.11],
                muzzle: [0, 0.02, -1.34],
                reloadZone: [0, 0.04, -0.16],
                supportZone: [-0.055, -0.055, -0.42],
                rearExtent: 0.34
            },
            parts: {
                receiver: { position: [0, -0.01, -0.16], size: [0.2996, 0.09, 1.045], color: 0x2f3f2f },
                grip: { position: [0, -0.11, 0.01], size: [0.14, 0.14, 0.08], color: 0x5d3c1f },
                barrel: { position: [0, 0.02, -0.7], size: [0.112, 0.064, 0.767], color: 0x1c1c1c },
                stock: { position: [0, -0.02, 0.22], size: [0.2352, 0.11, 0.2048], color: 0x5d3c1f },
                optic: { position: [0, 0.09, -0.21], size: [0.1568, 0.08, 0.23], color: 0x666666 }
            }
        })
    };

    runtime.GameWeaponVisuals = {
        get: function (weaponId) {
            var resolvedId = Object.prototype.hasOwnProperty.call(weaponPlatformEntries, weaponId) ? weaponId : 'rifle';
            var platform = weaponPlatformEntries[resolvedId];
            return {
                weaponId: resolvedId,
                platform: platform,
                visual: toLegacyVisual(platform)
            };
        }
    };
})();
