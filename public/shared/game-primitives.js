! function(global) {
    "use strict";
    if (!global.__GAME_PRIMITIVES__) {
        var primitives = {
            coords: {
                feet_origin: !0,
                eye_offset_y: 1.6,
                body_hitbox_offset_y: 1,
                head_hitbox_offset_y: 2.475,
                overhead_bar_offset_y: 2.9,
                core_anchor_offset_y: 1,
                muzzle_fallback_offset_y: 1.45
            },
            entity: {
                capsule_height: 1.7,
                capsule_radius: .58,
                collision_step_size: .6,
                spawn_padding_default: 8
            },
            rig: {
                body: {
                    size: [.8, 1, .5],
                    offset: [0, 1, 0]
                },
                head: {
                    size: [.55, .55, .55],
                    offset: [0, 1.8, 0]
                },
                arm: {
                    size: [.22, .85, .22],
                    shoulder_left_offset: [-.43, 1.37, 0],
                    shoulder_right_offset: [.43, 1.37, 0],
                    mesh_offset: [0, -.42, 0]
                },
                leg: {
                    size: [.28, .9, .28],
                    hip_left_offset: [-.18, .6, 0],
                    hip_right_offset: [.18, .6, 0],
                    mesh_offset: [0, -.45, 0]
                },
                anchors: {
                    core: [0, 1, 0],
                    overhead: [0, 2.9, 0]
                },
                animation: {
                    walk_freq: 8.2,
                    run_freq: 11,
                    sprint_freq: 14,
                    strafe_freq: 10,
                    gait_speed_scale_base: 0.32,
                    gait_speed_scale_range: 1,
                    leg_amp_idle: 0.08,
                    leg_amp_scale: 0.38,
                    leg_amp_sprint_boost: 0.14,
                    leg_amp_airborne: 0.04,
                    leg_amp_max: 0.66
                },
                weapon_profiles: {
                    rifle: {
                        twoHanded: !0,
                        gunPos: [.12, 1, .28],
                        gunRot: [0, 0, 0],
                        primaryGripPos: [.08, -.1, .02],
                        supportGripPos: [-.16, -.03, -.2],
                        body: {
                            p: [0, 0, -.06],
                            s: [1, 1, 1],
                            c: 3355443
                        },
                        barrel: {
                            p: [0, .02, -.36],
                            s: [1, 1, 1],
                            c: 2236962
                        },
                        stock: {
                            p: [0, -.04, .14],
                            s: [1, 1, 1],
                            c: 8016173
                        },
                        grip: {
                            p: [0, -.1, .02],
                            s: [1, 1, 1],
                            c: 8016173
                        },
                        scope: !1,
                        pump: !1,
                        coil: !1,
                        muzzlePos: [0, .02, -.56]
                    },
                    pistol: {
                        twoHanded: !1,
                        gunPos: [.32, 1.02, .24],
                        gunRot: [.12, .05, 0],
                        primaryGripPos: [.07, -.12, -.01],
                        supportGripPos: [-.08, -.04, -.06],
                        body: {
                            p: [0, -.02, -.06],
                            s: [.75, .85, .7],
                            c: 3815994
                        },
                        barrel: {
                            p: [0, 0, -.24],
                            s: [.68, .68, .65],
                            c: 2894892
                        },
                        stock: {
                            p: [0, -.05, .09],
                            s: [.52, .85, .72],
                            c: 7294258
                        },
                        grip: {
                            p: [0, -.14, -.01],
                            s: [.9, 1.1, 1.25],
                            c: 7294258
                        },
                        scope: !1,
                        pump: !1,
                        coil: !1,
                        muzzlePos: [0, 0, -.33]
                    },
                    machinegun: {
                        twoHanded: !0,
                        gunPos: [.14, 1, .28],
                        gunRot: [0, 0, 0],
                        primaryGripPos: [.09, -.1, .02],
                        supportGripPos: [-.18, -.03, -.24],
                        body: {
                            p: [0, 0, -.09],
                            s: [1.16, 1, 1.14],
                            c: 2829099
                        },
                        barrel: {
                            p: [0, .03, -.45],
                            s: [1.1, 1, 1.3],
                            c: 1644825
                        },
                        stock: {
                            p: [0, -.03, .16],
                            s: [1.1, 1, 1],
                            c: 5987163
                        },
                        grip: {
                            p: [0, -.11, .01],
                            s: [1, 1, 1],
                            c: 5987163
                        },
                        scope: !1,
                        pump: !1,
                        coil: !0,
                        muzzlePos: [0, .03, -.7]
                    },
                    shotgun: {
                        twoHanded: !0,
                        gunPos: [.12, 1, .3],
                        gunRot: [0, 0, 0],
                        primaryGripPos: [.09, -.1, .03],
                        supportGripPos: [-.22, -.03, -.33],
                        body: {
                            p: [0, 0, -.1],
                            s: [1.18, 1.02, 1.1],
                            c: 7029280
                        },
                        barrel: {
                            p: [0, .02, -.43],
                            s: [1.7, 1.12, 1.35],
                            c: 2236962
                        },
                        stock: {
                            p: [0, -.03, .17],
                            s: [1.12, 1.02, 1.02],
                            c: 9067053
                        },
                        grip: {
                            p: [0, -.1, .02],
                            s: [1, 1, 1],
                            c: 9067053
                        },
                        scope: !1,
                        pump: !0,
                        coil: !1,
                        muzzlePos: [0, .02, -.71]
                    },
                    sniper: {
                        twoHanded: !0,
                        gunPos: [.12, 1, .32],
                        gunRot: [0, 0, 0],
                        primaryGripPos: [.09, -.11, .02],
                        supportGripPos: [-.2, -.03, -.37],
                        body: {
                            p: [0, -.01, -.14],
                            s: [1.22, .9, 1.58],
                            c: 3096367
                        },
                        barrel: {
                            p: [0, .02, -.56],
                            s: [.82, .82, 2.15],
                            c: 1842204
                        },
                        stock: {
                            p: [0, -.02, .17],
                            s: [1.1, 1, 1.15],
                            c: 6110239
                        },
                        grip: {
                            p: [0, -.11, .01],
                            s: [1, 1, 1],
                            c: 6110239
                        },
                        scope: !0,
                        pump: !1,
                        coil: !1,
                        muzzlePos: [0, .02, -1.03]
                    },
                    plasma: {
                        twoHanded: !0,
                        gunPos: [.14, 1.02, .3],
                        gunRot: [.02, .02, 0],
                        primaryGripPos: [.1, -.1, .02],
                        supportGripPos: [-.18, -.03, -.26],
                        body: {
                            p: [0, 0, -.09],
                            s: [1.18, 1.08, 1.25],
                            c: 1920855
                        },
                        barrel: {
                            p: [0, .03, -.5],
                            s: [.92, .92, 1.3],
                            c: 4970227
                        },
                        stock: {
                            p: [0, -.03, .16],
                            s: [1.08, 1, 1],
                            c: 3231581
                        },
                        grip: {
                            p: [0, -.11, .01],
                            s: [1, 1, 1],
                            c: 3231581
                        },
                        scope: !0,
                        pump: !1,
                        coil: !0,
                        muzzlePos: [0, .04, -.78]
                    }
                }
            },
            hitboxes: {
                body: {
                    size: [2.7, 2, 2.7],
                    center_offset: [0, 1, 0]
                },
                head: {
                    size: [1.55, .95, 1.55],
                    center_offset: [0, 2.475, 0]
                }
            },
            combat: {
                max_hp: 500,
                armor_regen_delay_sec: 6,
                armor_regen_per_sec: 12,
                class_order: ["ninja", "jedi", "magician", "sharpshooter", "brawler"],
                class_presets: {
                    ninja: {
                        armorMax: 80,
                        wallhackRadius: 90
                    },
                    jedi: {
                        armorMax: 130,
                        wallhackRadius: 85
                    },
                    magician: {
                        armorMax: 100,
                        wallhackRadius: 100
                    },
                    sharpshooter: {
                        armorMax: 90,
                        wallhackRadius: 115
                    },
                    brawler: {
                        armorMax: 150,
                        wallhackRadius: 75
                    }
                },
                lock_profiles: {
                    beam_default: {
                        overlap_threshold: 0,
                        sticky: !0,
                        require_los: !0,
                        require_range: !0
                    },
                    plasma: {
                        overlap_threshold: 0,
                        sticky: !0,
                        require_los: !0,
                        require_range: !0
                    }
                },
                weapon_order: ["rifle", "pistol", "machinegun", "shotgun", "sniper", "plasma"],
                weapon_stats: {
                    rifle: {
                        cooldown_ms: 190,
                        body_damage: 36,
                        head_damage: 68,
                        max_range: 120
                    },
                    pistol: {
                        cooldown_ms: 280,
                        body_damage: 30,
                        head_damage: 56,
                        max_range: 92
                    },
                    machinegun: {
                        cooldown_ms: 80,
                        body_damage: 16,
                        head_damage: 30,
                        max_range: 88
                    },
                    shotgun: {
                        cooldown_ms: 820,
                        body_damage: 14,
                        head_damage: 22,
                        max_range: 42,
                        pellets: 12
                    },
                    sniper: {
                        cooldown_ms: 1250,
                        body_damage: 120,
                        head_damage: 220,
                        max_range: 190
                    },
                    plasma: {
                        cooldown_ms: 100,
                        body_damage: 15,
                        head_damage: 15,
                        max_range: 24
                    }
                },
                continuous_weapons: {
                    plasma: {
                        profile: "plasma",
                        effect: "plasma_tick",
                        reticle_kind: "plasma"
                    }
                },
                plasma: {
                    max_sustain_ms: 2500,
                    overheat_ms: 1600,
                    beam_hold_ms: 180,
                    tick_hz: 10
                }
            },
            network: {
                tick_rate_hz: 30,
                interpolation_delay_ms: 80,
                extrapolation_cap_ms: 100,
                stale_hold_ms: 300
            },
            camera: {
                third_person: {
                    distance: 4.4,
                    height: .7,
                    shoulder_offset: 1.35,
                    smooth: 12,
                    default_shoulder: "right"
                }
            },
            world: {
                base_world_size: 50,
                area_scale: 5,
                margin: 2,
                seed_default: "mineshoot-v1",
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
                    [8, .5, 25, 1, 1, 1],
                    [42, .5, 25, 1, 1, 1],
                    [25, .5, 8, 1, 1, 1],
                    [25, .5, 42, 1, 1, 1],
                    [18, 1, 22, 2, 2, 2],
                    [32, 1, 28, 2, 2, 2],
                    [22, 1, 38, 2, 2, 2],
                    [28, 1, 12, 2, 2, 2]
                ]
            }
        };
        primitives.world.world_size = Math.round(primitives.world.base_world_size * Math.sqrt(primitives.world.area_scale)), primitives.world.min = primitives.world.margin, primitives.world.max = primitives.world.world_size - primitives.world.margin, primitives.world.center = .5 * primitives.world.world_size, primitives.world.scale_axis = function(value) {
            return value / primitives.world.base_world_size * primitives.world.world_size
        }, primitives.world.scale_span = function(value) {
            return Math.max(1, value / primitives.world.base_world_size * primitives.world.world_size)
        }, global.__GAME_PRIMITIVES__ = function deepFreeze(value) {
            if (!value || "object" != typeof value || Object.isFrozen(value)) return value;
            Object.freeze(value);
            for (var keys = Object.keys(value), i = 0; i < keys.length; i++) deepFreeze(value[keys[i]]);
            return value
        }(primitives)
    }
}("undefined" != typeof globalThis ? globalThis : this);
