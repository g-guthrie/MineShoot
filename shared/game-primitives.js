(function (global) {
    'use strict';

    if (global.__GAME_PRIMITIVES__) return;

    function deepFreeze(value) {
        if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
        Object.freeze(value);
        var keys = Object.keys(value);
        for (var i = 0; i < keys.length; i++) {
            deepFreeze(value[keys[i]]);
        }
        return value;
    }

    var primitives = {
        coords: {
            feet_origin: true,
            eye_offset_y: 1.6,
            body_hitbox_offset_y: 1.0,
            head_hitbox_offset_y: 2.475,
            overhead_bar_offset_y: 2.9,
            core_anchor_offset_y: 1.0,
            muzzle_fallback_offset_y: 1.45
        },
        entity: {
            capsule_height: 1.7,
            capsule_radius: 0.58,
            collision_step_size: 0.6,
            spawn_padding_default: 8
        },
        rig: {
            body: { size: [0.8, 1.0, 0.5], offset: [0, 1.0, 0] },
            head: { size: [0.55, 0.55, 0.55], offset: [0, 1.8, 0] },
            arm: {
                size: [0.22, 0.85, 0.22],
                shoulder_left_offset: [-0.43, 1.37, 0],
                shoulder_right_offset: [0.43, 1.37, 0],
                mesh_offset: [0, -0.42, 0]
            },
            leg: {
                size: [0.28, 0.9, 0.28],
                hip_left_offset: [-0.18, 0.6, 0],
                hip_right_offset: [0.18, 0.6, 0],
                mesh_offset: [0, -0.45, 0]
            },
            anchors: {
                core: [0, 1.0, 0],
                overhead: [0, 2.9, 0]
            },
            weapon_profiles: {
                rifle: {
                    twoHanded: true,
                    gunPos: [0.12, 1.0, 0.28],
                    gunRot: [0, 0, 0],
                    muzzlePos: [0, 0.02, -0.56]
                },
                pistol: {
                    twoHanded: false,
                    gunPos: [0.32, 1.02, 0.24],
                    gunRot: [0.12, 0.05, 0],
                    muzzlePos: [0, 0.0, -0.33]
                },
                machinegun: {
                    twoHanded: true,
                    gunPos: [0.14, 1.0, 0.28],
                    gunRot: [0, 0, 0],
                    muzzlePos: [0, 0.03, -0.7]
                },
                shotgun: {
                    twoHanded: true,
                    gunPos: [0.12, 1.0, 0.3],
                    gunRot: [0, 0, 0],
                    muzzlePos: [0, 0.02, -0.71]
                },
                sniper: {
                    twoHanded: true,
                    gunPos: [0.12, 1.0, 0.32],
                    gunRot: [0, 0, 0],
                    muzzlePos: [0, 0.02, -1.03]
                },
                plasma: {
                    twoHanded: true,
                    gunPos: [0.14, 1.02, 0.3],
                    gunRot: [0.02, 0.02, 0],
                    muzzlePos: [0, 0.04, -0.78]
                }
            }
        },
        hitboxes: {
            body: {
                size: [2.7, 2.0, 2.7],
                center_offset: [0, 1.0, 0]
            },
            head: {
                size: [1.55, 0.95, 1.55],
                center_offset: [0, 2.475, 0]
            }
        },
        combat: {
            max_hp: 500,
            armor_regen_delay_sec: 6,
            armor_regen_per_sec: 12,
            class_order: ['ninja', 'jedi', 'magician', 'sharpshooter', 'brawler'],
            class_presets: {
                ninja: { armorMax: 80, wallhackRadius: 90 },
                jedi: { armorMax: 130, wallhackRadius: 85 },
                magician: { armorMax: 100, wallhackRadius: 100 },
                sharpshooter: { armorMax: 90, wallhackRadius: 115 },
                brawler: { armorMax: 150, wallhackRadius: 75 }
            },
            weapon_order: ['rifle', 'pistol', 'machinegun', 'shotgun', 'sniper', 'plasma'],
            weapon_stats: {
                rifle: { cooldown_ms: 190, body_damage: 36, head_damage: 68, max_range: 120 },
                pistol: { cooldown_ms: 280, body_damage: 30, head_damage: 56, max_range: 92 },
                machinegun: { cooldown_ms: 80, body_damage: 16, head_damage: 30, max_range: 88 },
                shotgun: { cooldown_ms: 820, body_damage: 14, head_damage: 22, max_range: 42, pellets: 12 },
                sniper: { cooldown_ms: 1250, body_damage: 120, head_damage: 220, max_range: 190 },
                plasma: { cooldown_ms: 100, body_damage: 15, head_damage: 15, max_range: 24 }
            },
            plasma: {
                max_sustain_ms: 2500,
                overheat_ms: 1600,
                beam_hold_ms: 180,
                tick_hz: 10
            }
        },
        world: {
            base_world_size: 50,
            area_scale: 5,
            margin: 2,
            seed_default: 'mineshoot-v1',
            chunk_size: 16,
            interest_radius_chunks: 2,
            core_cover_layout: [
                [25, 1.5, 25, 4, 3, 1],
                [25, 1.5, 27, 1, 3, 3],
                [25, 1.5, 23, 1, 3, 3],
                [10, 1, 10, 3, 2, 3],
                [10, 3, 10, 1, 2, 1],
                [40, 1, 10, 3, 2, 3],
                [40, 3, 10, 1, 2, 1],
                [10, 1, 40, 3, 2, 3],
                [10, 3, 40, 1, 2, 1],
                [40, 1, 40, 3, 2, 3],
                [40, 3, 40, 1, 2, 1],
                [20, 1, 15, 6, 2, 1],
                [30, 1, 35, 6, 2, 1],
                [15, 1, 30, 1, 2, 6],
                [35, 1, 20, 1, 2, 6],
                [8, 0.5, 25, 1, 1, 1],
                [42, 0.5, 25, 1, 1, 1],
                [25, 0.5, 8, 1, 1, 1],
                [25, 0.5, 42, 1, 1, 1],
                [18, 1, 22, 2, 2, 2],
                [32, 1, 28, 2, 2, 2],
                [22, 1, 38, 2, 2, 2],
                [28, 1, 12, 2, 2, 2]
            ]
        }
    };

    primitives.world.world_size = Math.round(
        primitives.world.base_world_size * Math.sqrt(primitives.world.area_scale)
    );
    primitives.world.min = primitives.world.margin;
    primitives.world.max = primitives.world.world_size - primitives.world.margin;
    primitives.world.center = primitives.world.world_size * 0.5;

    primitives.world.scale_axis = function (value) {
        return (value / primitives.world.base_world_size) * primitives.world.world_size;
    };

    primitives.world.scale_span = function (value) {
        return Math.max(1, (value / primitives.world.base_world_size) * primitives.world.world_size);
    };

    global.__GAME_PRIMITIVES__ = deepFreeze(primitives);
})(typeof globalThis !== 'undefined' ? globalThis : this);
