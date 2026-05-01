"""
PvP - current nuclear biome Blender rebuild

This script mirrors the current gameplay nuclear quadrant in
`js/world/quadrant-nuclear-simpsons.js` closely enough to use as a rebuild base
in Blender.

Run:
  blender --python blender-assets/build_nuclear_current.py

Optional:
  EXPORT_GLB=1 blender --background --python blender-assets/build_nuclear_current.py
"""

import bpy
import math
import os


OUTPUT_DIR = os.path.dirname(os.path.abspath(__file__))
EXPORT_GLB = os.environ.get("EXPORT_GLB", "").strip().lower() in {"1", "true", "yes"}

# Nuclear biome cell taken from the current world layout:
# center ~= (26.7, 16.0), size ~= 10.65
RAW_BOUNDS = {
    "minX": 21.375,
    "maxX": 32.025,
    "minZ": 10.675,
    "maxZ": 21.325,
}

REACTOR_HEIGHT_SCALE = 1.25


def clear_scene():
    active_obj = bpy.context.active_object
    if active_obj is not None and active_obj.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")

    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for col in list(bpy.data.collections):
        bpy.data.collections.remove(col)
    for mesh in list(bpy.data.meshes):
        bpy.data.meshes.remove(mesh)
    for mat in list(bpy.data.materials):
        bpy.data.materials.remove(mat)


def tj(x, y, z):
    """Three.js position -> Blender position."""
    return (x, -z, y)


def tjr(rot_y):
    """Three.js Y rotation -> Blender Z rotation."""
    return -rot_y


_materials = {}
_active_collection = None


def mat(name, hex_color, roughness=0.8, metallic=0.0, alpha=1.0, emission_strength=0.0):
    if name in _materials:
        return _materials[name]

    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nodes = m.node_tree.nodes
    links = m.node_tree.links
    nodes.clear()

    out = nodes.new("ShaderNodeOutputMaterial")
    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])

    r = ((hex_color >> 16) & 0xFF) / 255.0
    g = ((hex_color >> 8) & 0xFF) / 255.0
    b = (hex_color & 0xFF) / 255.0

    bsdf.inputs["Base Color"].default_value = (r, g, b, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic

    if alpha < 1.0:
        m.blend_method = "BLEND"
        bsdf.inputs["Alpha"].default_value = alpha

    if emission_strength > 0.0:
        bsdf.inputs["Emission Color"].default_value = (r, g, b, 1.0)
        bsdf.inputs["Emission Strength"].default_value = emission_strength

    _materials[name] = m
    return m


def set_collection(name):
    global _active_collection
    collection = bpy.data.collections.get(name)
    if collection is None:
        collection = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(collection)
    _active_collection = collection


def _move_to_active_collection(obj):
    for col in list(obj.users_collection):
        col.objects.unlink(obj)
    if _active_collection is not None:
        _active_collection.objects.link(obj)


def _bevel_object(obj, width_scale=0.06, max_width=0.04):
    dims = obj.scale
    bevel = obj.modifiers.new("Bevel", "BEVEL")
    bevel.width = min(max_width, min(dims[0], dims[1], dims[2]) * width_scale)
    bevel.segments = 2
    bevel.limit_method = "ANGLE"
    bevel.angle_limit = math.radians(60)


def block(name, x, y, z, w, h, d, material, rot_y=0.0, bevel=True):
    bpy.ops.mesh.primitive_cube_add(size=1, location=tj(x, y, z))
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (w, d, h)
    if rot_y:
        obj.rotation_euler[2] = tjr(rot_y)
    obj.data.materials.append(material)
    if bevel:
        _bevel_object(obj)
    _move_to_active_collection(obj)
    return obj


def ramp(name, x, y, z, w, h, d, material, rot_y=0.0, tilt_x=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=tj(x, y, z))
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (w, d, h)
    obj.rotation_euler = (tilt_x, 0.0, tjr(rot_y))
    obj.data.materials.append(material)
    _move_to_active_collection(obj)
    return obj


def cylinder(name, x, y, z, radius, height, material, vertices=24, rot_y=0.0, bevel=True):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=height, location=tj(x, y, z))
    obj = bpy.context.active_object
    obj.name = name
    if rot_y:
        obj.rotation_euler[2] = tjr(rot_y)
    obj.data.materials.append(material)
    if bevel:
        _bevel_object(obj, width_scale=0.025, max_width=0.03)
    _move_to_active_collection(obj)
    return obj


def frustum(name, x, y, z, radius_bottom, radius_top, height, material, vertices=28, bevel=False):
    bpy.ops.mesh.primitive_cone_add(
        vertices=vertices,
        radius1=radius_bottom,
        radius2=radius_top,
        depth=height,
        location=tj(x, y, z),
    )
    obj = bpy.context.active_object
    obj.name = name
    obj.data.materials.append(material)
    if bevel:
        _bevel_object(obj, width_scale=0.02, max_width=0.02)
    _move_to_active_collection(obj)
    return obj


def torus(name, x, y, z, major_radius, minor_radius, material, major_segments=40, minor_segments=12):
    bpy.ops.mesh.primitive_torus_add(
        location=tj(x, y, z),
        major_radius=major_radius,
        minor_radius=minor_radius,
        major_segments=major_segments,
        minor_segments=minor_segments,
    )
    obj = bpy.context.active_object
    obj.name = name
    obj.rotation_euler[0] = math.radians(90.0)
    obj.data.materials.append(material)
    _move_to_active_collection(obj)
    return obj


def point_in_bounds(bounds, x_frac, z_frac):
    return {
        "x": bounds["minX"] + ((bounds["maxX"] - bounds["minX"]) * x_frac),
        "z": bounds["minZ"] + ((bounds["maxZ"] - bounds["minZ"]) * z_frac),
    }


def build_materials():
    return {
        "towerWhite": mat("nuc_tower_white", 0xF6F7F3, roughness=0.55),
        "towerShade": mat("nuc_tower_shade", 0xE0E3E0, roughness=0.62),
        "towerCap": mat("nuc_tower_cap", 0xEAEDE8, roughness=0.5),
        "towerBand": mat("nuc_tower_band", 0xC9CFCA, roughness=0.58),
        "buildingDark": mat("nuc_building_dark", 0x6F767B, roughness=0.88),
        "buildingMid": mat("nuc_building_mid", 0x858C91, roughness=0.82),
        "buildingLight": mat("nuc_building_light", 0x9CA3A8, roughness=0.75),
        "trim": mat("nuc_trim", 0xB1B8BC, roughness=0.58),
        "duct": mat("nuc_duct", 0x8F979C, roughness=0.55, metallic=0.16),
        "ductDark": mat("nuc_duct_dark", 0x747C81, roughness=0.68, metallic=0.12),
        "grate": mat("nuc_grate", 0x677076, roughness=0.72, metallic=0.2),
        "accentDark": mat("nuc_accent_dark", 0x4E565B, roughness=0.8, metallic=0.08),
        "steam": mat("nuc_steam", 0xF8FAF6, roughness=0.4, alpha=0.12),
        "glow": mat("nuc_glow", 0x79FF77, roughness=0.22, alpha=0.9, emission_strength=2.4),
        "ground": mat("nuc_ground", 0x5C5C4A, roughness=0.95),
    }


def add_glow_strip_segment(name, x, y, z, w, h, d, glow_mat):
    return block(name, x, y, z, max(0.14, w), max(0.18, h), max(0.14, d), glow_mat, bevel=False)


def build_cooling_tower(east_face_x, cz, tower_id, mats):
    base_width = 16.6
    cx = east_face_x - (base_width * 0.5)
    radius_profile = [
        (0.0, 8.30),
        (4.0, 7.95),
        (7.6, 7.40),
        (11.0, 6.85),
        (14.2, 6.30),
        (17.2, 5.85),
        (20.1, 5.45),
        (22.9, 5.20),
        (25.7, 5.40),
        (28.6, 5.80),
        (31.6, 6.35),
        (35.0, 7.05),
        (38.8, 7.60),
        (42.6, 7.85),
    ]
    peak_height = radius_profile[-1][0]

    for idx in range(len(radius_profile) - 1):
        y0, r0 = radius_profile[idx]
        y1, r1 = radius_profile[idx + 1]
        seg_h = y1 - y0
        frustum(
            f"{tower_id}_tower_shell_{idx:02d}",
            cx,
            y0 + (seg_h * 0.5),
            cz,
            r0,
            r1,
            seg_h,
            mats["towerWhite"] if idx % 2 == 0 else mats["towerShade"],
            bevel=False,
        )
        if idx not in {0, len(radius_profile) - 2}:
            torus(
                f"{tower_id}_tower_band_{idx:02d}",
                cx,
                y0 + seg_h,
                cz,
                ((r0 + r1) * 0.5),
                0.13,
                mats["towerBand"],
            )

    cylinder(f"{tower_id}_tower_ring", cx, 0.52, cz, 8.95, 1.04, mats["towerShade"], bevel=False)
    cylinder(f"{tower_id}_tower_lip", cx, peak_height + 0.18, cz, 7.25, 0.36, mats["towerCap"], bevel=False)
    cylinder(f"{tower_id}_tower_throat", cx, peak_height - 1.2, cz, 5.65, 2.5, mats["towerCap"], bevel=False)

    for rib_idx in range(8):
        angle = (math.pi * 2.0 * rib_idx) / 8.0
        rib_x = cx + math.cos(angle) * 7.85
        rib_z = cz + math.sin(angle) * 7.85
        block(
            f"{tower_id}_tower_rib_{rib_idx:02d}",
            rib_x,
            21.0,
            rib_z,
            0.18,
            16.8,
            0.34,
            mats["towerBand"],
            rot_y=angle,
            bevel=False,
        )

    steam_cols = 10
    steam_rows = 16
    steam_col_spacing = 1.12
    steam_row_spacing = 0.82
    steam_start_x = cx - (((steam_cols - 1) * steam_col_spacing) * 0.5)
    for col in range(steam_cols):
        for row in range(steam_rows):
            block(
                f"{tower_id}_steam_{col:02d}_{row:02d}",
                steam_start_x + (col * steam_col_spacing),
                peak_height + 1.3 + (row * steam_row_spacing),
                cz - 2.35 + ((col % 3) * 0.52),
                1.78,
                1.02,
                1.78,
                mats["steam"],
                bevel=False,
            )

    return {
        "centerX": cx,
        "centerZ": cz,
        "width": base_width,
        "peakHeight": peak_height,
    }


def build_reactor_building(spec, mats):
    center_x = spec["x"]
    center_z = spec["z"]
    width = spec["w"]
    depth = spec["d"]
    height = spec["h"]
    reactor_id = spec["id"]

    block(f"{reactor_id}_base", center_x, 0.18, center_z, width + 0.8, 0.36, depth + 1.0, mats["buildingMid"])
    block(f"{reactor_id}_body", center_x, height * 0.5, center_z, width, height, depth, mats["buildingDark"])
    block(
        f"{reactor_id}_upper",
        center_x + 0.2,
        height - 0.95,
        center_z - 0.18,
        width * 0.68,
        0.9,
        depth * 0.74,
        mats["buildingMid"],
    )
    block(
        f"{reactor_id}_roof_band",
        center_x,
        height + 0.14,
        center_z,
        width * 0.72,
        0.14,
        depth * 0.76,
        mats["trim"],
        bevel=False,
    )

    roof_pad_y = height + 0.38
    block(f"{reactor_id}_roof_pad", center_x, roof_pad_y, center_z, width * 0.52, 0.24, depth * 0.44, mats["buildingLight"])
    for vent_idx, vent_z in enumerate((-depth * 0.16, 0.0, depth * 0.16)):
        block(
            f"{reactor_id}_roof_vent_{vent_idx}",
            center_x + (width * 0.12),
            roof_pad_y + 0.72,
            center_z + vent_z,
            width * 0.1,
            0.9,
            depth * 0.1,
            mats["accentDark"],
        )
        block(
            f"{reactor_id}_roof_vent_cap_{vent_idx}",
            center_x + (width * 0.12),
            roof_pad_y + 1.2,
            center_z + vent_z,
            width * 0.16,
            0.12,
            depth * 0.14,
            mats["trim"],
            bevel=False,
        )

    west_catwalk_x = center_x - (width * 0.5) - 0.7
    block(
        f"{reactor_id}_west_catwalk",
        west_catwalk_x,
        height * 0.5,
        center_z,
        0.9,
        0.16,
        depth * 0.68,
        mats["grate"],
        bevel=False,
    )
    for rail_side, rail_offset in [("outer", -0.34), ("inner", 0.34)]:
        block(
            f"{reactor_id}_west_catwalk_{rail_side}_rail",
            west_catwalk_x + rail_offset,
            (height * 0.5) + 0.36,
            center_z,
            0.08,
            0.46,
            depth * 0.68,
            mats["ductDark"],
            bevel=False,
        )
    for post_idx, frac in enumerate((0.14, 0.32, 0.5, 0.68, 0.86)):
        post_z = (center_z - (depth * 0.34)) + (depth * 0.68 * frac)
        for side_mult in (-0.34, 0.34):
            block(
                f"{reactor_id}_west_catwalk_post_{post_idx}_{'a' if side_mult < 0 else 'b'}",
                west_catwalk_x + side_mult,
                (height * 0.5) + 0.12,
                post_z,
                0.06,
                0.7,
                0.06,
                mats["ductDark"],
                bevel=False,
            )

    for stack_idx, x_offset in enumerate((-width * 0.2, width * 0.2)):
        cylinder(
            f"{reactor_id}_roof_stack_{stack_idx}",
            center_x + x_offset,
            height + 1.25,
            center_z - (depth * 0.18),
            0.36,
            2.0,
            mats["duct"],
            vertices=18,
            bevel=False,
        )

    return {
        "id": reactor_id,
        "centerX": center_x,
        "centerZ": center_z,
        "width": width,
        "depth": depth,
        "height": height,
        "westFaceX": center_x - (width * 0.5),
        "eastFaceX": center_x + (width * 0.5),
        "northZ": center_z - (depth * 0.5),
        "southZ": center_z + (depth * 0.5),
        "roofY": height,
    }


def build_broad_stair(building, bridge_y, mats):
    step_count = 8
    rise = bridge_y / step_count
    tread_depth = 1.8
    tread_width = 1.2
    tread_thick = 0.12

    stair_x = building["westFaceX"] - (tread_depth * 0.5)
    start_z = building["southZ"] - 0.5

    for idx in range(step_count):
        tread_y = (idx + 1) * rise
        step_z = start_z - (idx * tread_width)
        block(
            f"{building['id']}_stair_step_{idx:02d}",
            stair_x,
            tread_y,
            step_z,
            tread_depth,
            tread_thick,
            tread_width,
            mats["buildingLight"] if idx == step_count - 1 else mats["buildingMid"],
        )

    top_step_z = start_z - ((step_count - 1) * tread_width)
    total_run = (step_count - 1) * tread_width
    stringer_len = math.sqrt((total_run * total_run) + (bridge_y * bridge_y))
    stringer_angle = math.atan2(bridge_y, total_run)
    mid_z = (start_z + top_step_z) * 0.5
    mid_y = bridge_y * 0.5
    stringer_thick = 0.14
    stringer_height = 0.28
    side_offset = (tread_depth * 0.5) - (stringer_thick * 0.5)

    for side, label in [(-1, "left"), (1, "right")]:
        ramp(
            f"{building['id']}_stair_stringer_{label}",
            stair_x + (side * side_offset),
            mid_y,
            mid_z,
            stringer_thick,
            stringer_height,
            stringer_len,
            mats["ductDark"],
            tilt_x=stringer_angle,
        )

    rail_y = bridge_y * 0.58
    rail_len = (step_count - 1) * tread_width + 0.45
    for side, label in [(-1, "left"), (1, "right")]:
        ramp(
            f"{building['id']}_stair_handrail_{label}",
            stair_x + (side * 0.72),
            rail_y,
            (start_z + top_step_z) * 0.5,
            0.06,
            0.06,
            rail_len,
            mats["ductDark"],
            tilt_x=stringer_angle,
        )

    block(
        f"{building['id']}_stair_landing",
        stair_x,
        bridge_y,
        top_step_z,
        tread_depth + 0.3,
        tread_thick,
        tread_width + 0.3,
        mats["trim"],
    )

    for side, x_offset in [("left", -0.74), ("right", 0.74)]:
        block(
            f"{building['id']}_landing_post_{side}",
            stair_x + x_offset,
            bridge_y + 0.38,
            top_step_z,
            0.06,
            0.72,
            0.06,
            mats["ductDark"],
            bevel=False,
        )


def build_inter_building_duct(north_building, south_building, bridge_y, mats):
    duct_width = 1.4
    duct_thickness = 0.24
    rail_width = 0.08
    rail_height = 0.5
    wall_penetration = 0.5
    support_width = 0.24

    overlap_min_x = max(north_building["westFaceX"], south_building["westFaceX"])
    overlap_max_x = min(north_building["eastFaceX"], south_building["eastFaceX"])
    duct_x = (overlap_min_x + overlap_max_x) * 0.5

    north_z = north_building["southZ"] - wall_penetration
    south_z = south_building["northZ"] + wall_penetration
    total_length = south_z - north_z
    duct_mid_z = (north_z + south_z) * 0.5

    block("inter_building_duct_body", duct_x, bridge_y, duct_mid_z, duct_width, duct_thickness, total_length, mats["duct"])
    block("inter_building_duct_undertray", duct_x, bridge_y - 0.24, duct_mid_z, duct_width * 0.82, 0.12, total_length, mats["accentDark"], bevel=False)

    rail_offset = (duct_width * 0.5) - (rail_width * 0.5)
    rail_y = bridge_y + (duct_thickness * 0.5) + (rail_height * 0.5)
    for side, label in [(-1, "left"), (1, "right")]:
        block(
            f"inter_building_duct_{label}_rail",
            duct_x + (side * rail_offset),
            rail_y,
            duct_mid_z,
            rail_width,
            rail_height,
            total_length,
            mats["ductDark"],
            bevel=False,
        )

    for rung_idx, frac in enumerate((0.16, 0.32, 0.48, 0.64, 0.8)):
        rung_z = north_z + (total_length * frac)
        block(
            f"inter_building_duct_grate_{rung_idx}",
            duct_x,
            bridge_y + 0.03,
            rung_z,
            duct_width * 0.72,
            0.03,
            0.06,
            mats["grate"],
            bevel=False,
        )

    gap_north_z = north_building["southZ"]
    gap_south_z = south_building["northZ"]
    gap_length = gap_south_z - gap_north_z
    pillar_top_y = bridge_y - (duct_thickness * 0.5)
    for idx, t in enumerate((0.3, 0.7)):
        block(
            f"inter_building_duct_support_{idx}",
            duct_x,
            pillar_top_y * 0.5,
            gap_north_z + (gap_length * t),
            support_width,
            pillar_top_y,
            support_width,
            mats["ductDark"],
            bevel=False,
        )

    block(
        "inter_building_south_landing",
        duct_x,
        bridge_y,
        south_building["northZ"] + 0.4,
        duct_width + 0.4,
        duct_thickness,
        0.8,
        mats["trim"],
    )


def build_glow_strip(building, mats):
    glow_height = 0.96
    glow_depth = 0.18
    strip_y = (building["height"] - 0.75) - (building["height"] * 0.05)
    stand_off = 0.01
    south_face_z = building["southZ"] - (glow_depth * 0.5) + stand_off
    west_x = building["westFaceX"] + (glow_depth * 0.5) - stand_off
    east_x = building["eastFaceX"] - (glow_depth * 0.5) + stand_off
    main_span = max(2.0, building["width"] - glow_depth)
    wrap_span = max(2.4, min(3.1, building["depth"] * 0.12))
    wrap_z = building["southZ"] - (wrap_span * 0.5) + stand_off

    add_glow_strip_segment("south_glow_main", building["centerX"], strip_y, south_face_z, main_span, glow_height, glow_depth, mats["glow"])
    add_glow_strip_segment("south_glow_west", west_x, strip_y, wrap_z, glow_depth, glow_height, wrap_span, mats["glow"])
    add_glow_strip_segment("south_glow_east", east_x, strip_y, wrap_z, glow_depth, glow_height, wrap_span, mats["glow"])
    block("south_glow_backing", building["centerX"], strip_y, building["southZ"] + 0.08, main_span * 0.92, glow_height + 0.08, 0.08, mats["accentDark"], bevel=False)


def build_pipe_run(south_building, mats):
    pipe_y = south_building["height"] * 0.56
    pipe_start_x = south_building["westFaceX"] - 0.9
    pipe_end_x = RAW_BOUNDS["maxX"] - 4.0
    main_length = pipe_end_x - pipe_start_x
    pipe_z = south_building["centerZ"] + (south_building["depth"] * 0.22)

    for idx, y_offset in enumerate((-0.42, 0.0, 0.42)):
        cylinder(
            f"south_pipe_run_{idx}",
            pipe_start_x + (main_length * 0.5),
            pipe_y + y_offset,
            pipe_z,
            0.18,
            main_length,
            mats["duct"],
            vertices=16,
            rot_y=math.pi * 0.5,
            bevel=False,
        )
    for support_idx, frac in enumerate((0.08, 0.28, 0.48, 0.68, 0.88)):
        support_x = pipe_start_x + (main_length * frac)
        block(
            f"south_pipe_support_{support_idx}",
            support_x,
            (pipe_y * 0.5) - 0.05,
            pipe_z,
            0.18,
            pipe_y - 0.3,
            0.42,
            mats["ductDark"],
            bevel=False,
        )


def add_perimeter_deck(south_building, mats):
    deck_y = 2.35
    deck_x = south_building["centerX"] - (south_building["width"] * 0.18)
    deck_z = south_building["southZ"] + 0.9
    deck_width = south_building["width"] * 0.74
    block("south_perimeter_deck", deck_x, deck_y, deck_z, deck_width, 0.18, 1.3, mats["grate"], bevel=False)
    for rail_side, offset in [("front", 0.58), ("rear", -0.58)]:
        block(
            f"south_perimeter_deck_rail_{rail_side}",
            deck_x,
            deck_y + 0.42,
            deck_z + offset,
            deck_width,
            0.08,
            0.08,
            mats["ductDark"],
            bevel=False,
        )
    for post_idx, frac in enumerate((0.06, 0.22, 0.38, 0.54, 0.70, 0.86)):
        post_x = (deck_x - (deck_width * 0.5)) + (deck_width * frac)
        for z_offset in (-0.58, 0.58):
            block(
                f"south_perimeter_deck_post_{post_idx}_{'a' if z_offset < 0 else 'b'}",
                post_x,
                deck_y + 0.18,
                deck_z + z_offset,
                0.06,
                0.52,
                0.06,
                mats["ductDark"],
                bevel=False,
            )


def build_ground(bounds, mats):
    center_x = (bounds["minX"] + bounds["maxX"]) * 0.5
    center_z = (bounds["minZ"] + bounds["maxZ"]) * 0.5
    width = bounds["maxX"] - bounds["minX"]
    depth = bounds["maxZ"] - bounds["minZ"]
    block("nuclear_ground_pad", center_x, 0.15, center_z, width, 0.3, depth, mats["ground"], bevel=False)


def build_nuclear_quadrant():
    clear_scene()
    set_collection("Nuclear_Current")
    mats = build_materials()

    build_ground(RAW_BOUNDS, mats)

    north_tower_z = RAW_BOUNDS["minZ"] + 14.0
    south_tower_z = RAW_BOUNDS["maxZ"] - 14.0
    build_cooling_tower(RAW_BOUNDS["maxX"], north_tower_z, "north", mats)
    build_cooling_tower(RAW_BOUNDS["maxX"], south_tower_z, "south", mats)

    north_anchor = point_in_bounds(RAW_BOUNDS, 0.46, 0.29)
    south_anchor = point_in_bounds(RAW_BOUNDS, 0.50, 0.74)

    north_building = build_reactor_building({
        "id": "north",
        "x": north_anchor["x"],
        "z": north_anchor["z"],
        "w": 11.8,
        "d": 17.6,
        "h": 6.2 * REACTOR_HEIGHT_SCALE,
    }, mats)

    south_building = build_reactor_building({
        "id": "south",
        "x": south_anchor["x"],
        "z": south_anchor["z"],
        "w": 15.4,
        "d": 22.9,
        "h": 8.3 * REACTOR_HEIGHT_SCALE,
    }, mats)

    bridge_y = north_building["roofY"]
    build_broad_stair(north_building, bridge_y, mats)
    build_inter_building_duct(north_building, south_building, bridge_y, mats)
    build_glow_strip(south_building, mats)
    build_pipe_run(south_building, mats)
    add_perimeter_deck(south_building, mats)

    block(
        "north_floor_band",
        RAW_BOUNDS["minX"] + 16.0,
        0.16,
        RAW_BOUNDS["minZ"] + 3.5,
        20.0,
        0.32,
        1.0,
        mats["trim"],
    )

    bpy.context.scene.world.use_nodes = True
    bg = bpy.context.scene.world.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (0.42, 0.61, 0.76, 1.0)
    bg.inputs["Strength"].default_value = 0.35

    bpy.ops.object.light_add(type="SUN", location=(30, -18, 40))
    sun = bpy.context.active_object
    sun.data.energy = 4.5
    sun.data.color = (1.0, 0.957, 0.847)
    sun.rotation_euler = (0.65, 0.0, 0.75)

    if EXPORT_GLB:
        bpy.ops.object.select_all(action="DESELECT")
        collection = bpy.data.collections.get("Nuclear_Current")
        if collection is not None:
            for obj in collection.objects:
                obj.select_set(True)
            out_path = os.path.join(OUTPUT_DIR, "nuclear_current.glb")
            bpy.ops.export_scene.gltf(
                filepath=out_path,
                use_selection=True,
                export_format="GLB",
                export_yup=True,
                export_apply=True,
                export_materials="EXPORT",
            )
            print(f"Exported {out_path}")


if __name__ == "__main__":
    build_nuclear_quadrant()
