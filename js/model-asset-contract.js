/**
 * model-asset-contract.js - Runtime asset contract for original modeled actors and weapons.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameModelAssetContract
 */
(function () {
    'use strict';

    var runtime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    var GameModelAssetContract = {};

    var THIRD_PERSON_NODE_NAMES = [
        'root',
        'third-person',
        'upper',
        'lower',
        'torso',
        'torso-geo',
        'torso-anchor',
        'mount-anchor',
        'back-anchor',
        'neck',
        'head',
        'head-geo',
        'head-anchor',
        'eyes-anchor',
        'arms',
        'arm-left',
        'arm-left-geo',
        'hand-left',
        'hand-left-anchor',
        'arm-right',
        'arm-right-geo',
        'hand-right',
        'hand-right-anchor',
        'weapon-mount-anchor',
        'leg-left',
        'leg-left-geo',
        'leg-right',
        'leg-right-geo',
        'camera-anchor'
    ];

    var THIRD_PERSON_ANIMATION_NAMES = [
        'idle-upper', 'idle-lower', 'walk-upper', 'walk-lower', 'run-upper', 'run-lower',
        'sneak-upper', 'sneak-lower', 'sneak-idle-upper', 'sneak-idle-lower', 'climbing',
        'crawling', 'sleep', 'simple-interact', 'jump-pre', 'jump-loop', 'jump-post-light',
        'jump-post-heavy', 'carry-upper', 'idle-mounted-upper', 'idle-mounted-lower',
        'idle-gun-left', 'idle-gun-right', 'idle-gun-both', 'shoot-gun-left', 'shoot-gun-right',
        'shoot-gun-both', 'walk-strafe-left-upper', 'walk-strafe-left-lower',
        'walk-strafe-right-upper', 'walk-strafe-right-lower', 'run-strafe-left-upper',
        'run-strafe-left-lower', 'run-strafe-right-upper', 'run-strafe-right-lower',
        'walk-backwards-upper', 'walk-backwards-lower', 'run-backwards-upper',
        'run-backwards-lower', 'swim-forward', 'swim-idle', 'swim-backwards',
        'sword-attack-upper', 'sword-attack-tornado', 'dodge-roll', 'damage-hit-upper',
        'consume-upper', 'foraging-transition', 'foraging-loop', 'combat-idle',
        'sword-attack-1', 'sword-attack-2', 'sword-attack-3', 'sword-attack-4', 'sword-attack-5',
        'shield-block (WIP)', 'emote-griddy', 'emote-annoyed', 'emote-ratdance',
        'sneak2-walk', 'sneak2-idle', 'run-slide', 'axe-chop-loop', 'death-kneel',
        'death-front', 'death-back', 'bow-draw', 'bow-draw-loop', 'bow-draw-shoot',
        'mining-loop', 'crouch-walk', 'crouch-idle', 'sit', 'sit-chair'
    ];

    var WEAPON_ANCHOR_NAMES = [
        'grip-anchor',
        'support-anchor',
        'muzzle-anchor',
        'casing-anchor',
        'sight-anchor'
    ];

    var DEFAULT_MODEL_REGISTRY = {
        playerThirdPerson: {
            id: 'player-third-person',
            modelPath: '/assets/models/players/player-third-person.glb',
            manifestPath: '/assets/models/manifests/player-third-person.contract.json',
            requiredNodes: THIRD_PERSON_NODE_NAMES.slice(),
            requiredAnimations: THIRD_PERSON_ANIMATION_NAMES.slice()
        },
        weapons: {
            pistol: {
                id: 'weapon-pistol',
                modelPath: '/assets/models/weapons/pistol.glb',
                manifestPath: '/assets/models/manifests/weapon-pistol.contract.json',
                requiredNodes: WEAPON_ANCHOR_NAMES.slice()
            },
            rifle: {
                id: 'weapon-rifle',
                modelPath: '/assets/models/weapons/rifle.glb',
                manifestPath: '/assets/models/manifests/weapon-rifle.contract.json',
                requiredNodes: WEAPON_ANCHOR_NAMES.slice()
            },
            machinegun: {
                id: 'weapon-machinegun',
                modelPath: '/assets/models/weapons/machinegun.glb',
                manifestPath: '/assets/models/manifests/weapon-machinegun.contract.json',
                requiredNodes: WEAPON_ANCHOR_NAMES.slice()
            }
        }
    };

    function cloneArray(list) {
        return Array.isArray(list) ? list.slice() : [];
    }

    function cloneRegistry() {
        return JSON.parse(JSON.stringify(DEFAULT_MODEL_REGISTRY));
    }

    function normalizeStringList(list) {
        if (!Array.isArray(list)) return [];
        return list.map(function (value) { return String(value || ''); }).filter(Boolean);
    }

    function diffRequired(required, actual) {
        var actualSet = new Set(normalizeStringList(actual));
        return normalizeStringList(required).filter(function (name) { return !actualSet.has(name); });
    }

    function validateEntry(entry, actualNodes, actualAnimations) {
        entry = entry || {};
        var missingNodes = diffRequired(entry.requiredNodes || [], actualNodes || []);
        var missingAnimations = diffRequired(entry.requiredAnimations || [], actualAnimations || []);
        return {
            ok: missingNodes.length === 0 && missingAnimations.length === 0,
            missingNodes: missingNodes,
            missingAnimations: missingAnimations
        };
    }

    GameModelAssetContract.getThirdPersonNodeNames = function () {
        return cloneArray(THIRD_PERSON_NODE_NAMES);
    };

    GameModelAssetContract.getThirdPersonAnimationNames = function () {
        return cloneArray(THIRD_PERSON_ANIMATION_NAMES);
    };

    GameModelAssetContract.getWeaponAnchorNames = function () {
        return cloneArray(WEAPON_ANCHOR_NAMES);
    };

    GameModelAssetContract.getRegistry = function () {
        return cloneRegistry();
    };

    GameModelAssetContract.validatePlayerThirdPerson = function (actualNodes, actualAnimations) {
        return validateEntry(DEFAULT_MODEL_REGISTRY.playerThirdPerson, actualNodes, actualAnimations);
    };

    GameModelAssetContract.validateWeapon = function (weaponId, actualNodes) {
        var entry = DEFAULT_MODEL_REGISTRY.weapons[String(weaponId || '')] || null;
        if (!entry) {
            return {
                ok: false,
                missingNodes: [],
                missingAnimations: [],
                error: 'Unknown weapon contract: ' + String(weaponId || '')
            };
        }
        return validateEntry(entry, actualNodes, []);
    };

    runtime.GameModelAssetContract = GameModelAssetContract;
})();
