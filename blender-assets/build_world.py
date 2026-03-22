"""
Minecraft FPS - Blender World Builder
Rebuilds the Three.js world with higher quality geometry.
Exports each biome as a separate GLB + one combined world.glb

Run: blender --background --python build_world.py
"""

import bpy
import math
import os

OUTPUT_DIR = os.path.dirname(os.path.abspath(__file__))

# ================================================================
# SCENE CLEAR
# ================================================================
def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()
    for c in list(bpy.data.collections):
        bpy.data.collections.remove(c)
    for m in list(bpy.data.meshes):
        bpy.data.meshes.remove(m)
    for mat in list(bpy.data.materials):
        bpy.data.materials.remove(mat)

clear_scene()

# ================================================================
# COORDINATE CONVERSION
# Three.js: X right, Y up, Z toward viewer
# Blender:  X right, Z up, Y away from viewer
# pos: (tjx, tjy, tjz) -> (tjx, -tjz, tjy)
# scale: (w=X, h=Y, d=Z) -> (w=X, d=Y_bl_depth, h=Z_bl_up) -> (w, d, h)
# ================================================================

def tj(x, y, z):
    """Three.js position -> Blender position"""
    return (x, -z, y)

def tjr(rot_y):
    """Three.js Y-axis rotation -> Blender Z-axis rotation (negated)"""
    return -rot_y

# ================================================================
# MATERIAL CACHE
# ================================================================
_mats = {}

def mat(name, hex_color, roughness=0.8, metallic=0.0, alpha=1.0, emit=0.0):
    if name in _mats:
        return _mats[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nodes = m.node_tree.nodes
    links = m.node_tree.links
    nodes.clear()
    out  = nodes.new('ShaderNodeOutputMaterial')
    bsdf = nodes.new('ShaderNodeBsdfPrincipled')
    links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    r = ((hex_color >> 16) & 0xFF) / 255.0
    g = ((hex_color >> 8)  & 0xFF) / 255.0
    b = ( hex_color        & 0xFF) / 255.0
    bsdf.inputs['Base Color'].default_value = (r, g, b, 1.0)
    bsdf.inputs['Roughness'].default_value  = roughness
    bsdf.inputs['Metallic'].default_value   = metallic
    if alpha < 1.0:
        m.blend_method = 'BLEND'
        bsdf.inputs['Alpha'].default_value = alpha
    if emit > 0.0:
        bsdf.inputs['Emission Color'].default_value    = (r, g, b, 1.0)
        bsdf.inputs['Emission Strength'].default_value = emit
    _mats[name] = m
    return m

# ================================================================
# COLLECTION SYSTEM
# ================================================================
_active_col = None

def set_col(name):
    global _active_col
    if name not in bpy.data.collections:
        col = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(col)
    _active_col = bpy.data.collections[name]

def _to_col(obj):
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    if _active_col:
        _active_col.objects.link(obj)

# ================================================================
# GEOMETRY HELPERS
# ================================================================

def block(x, y, z, w, h, d, material, roty=0.0, bevel=True):
    """Box at Three.js center (x,y,z), Three.js dims (w=X, h=Y, d=Z)"""
    bpy.ops.mesh.primitive_cube_add(size=1, location=tj(x, y, z))
    obj = bpy.context.active_object
    obj.scale = (w, d, h)          # Blender X=width, Y=depth, Z=height
    if roty != 0.0:
        obj.rotation_euler[2] = tjr(roty)
    obj.data.materials.append(material)
    if bevel:
        bv = obj.modifiers.new('Bevel', 'BEVEL')
        bv.width         = min(0.04, min(w, h, d) * 0.06)
        bv.segments      = 2
        bv.limit_method  = 'ANGLE'
        bv.angle_limit   = math.radians(60)
    _to_col(obj)
    return obj

def ramp(x, y, z, w, h, d, material, roty=0.0, tiltx=0.0):
    """Ramp: box rotated around Y (direction) and tilted on X (slope)"""
    bpy.ops.mesh.primitive_cube_add(size=1, location=tj(x, y, z))
    obj = bpy.context.active_object
    obj.scale = (w, d, h)
    obj.rotation_euler = (tiltx, 0, tjr(roty))
    obj.data.materials.append(material)
    _to_col(obj)
    return obj

def cylinder(x, y, z, radius, height, material, segs=16):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=segs, radius=radius, depth=height, location=tj(x, y, z)
    )
    obj = bpy.context.active_object
    obj.data.materials.append(material)
    _to_col(obj)
    return obj

def sphere(x, y, z, radius, material):
    bpy.ops.mesh.primitive_uv_sphere_add(
        radius=radius, location=tj(x, y, z), segments=12, ring_count=8
    )
    obj = bpy.context.active_object
    obj.data.materials.append(material)
    _to_col(obj)
    return obj

def cone(x, y, z, radius, height, material, segs=8):
    bpy.ops.mesh.primitive_cone_add(
        vertices=segs, radius1=radius, radius2=0, depth=height, location=tj(x, y, z)
    )
    obj = bpy.context.active_object
    obj.data.materials.append(material)
    _to_col(obj)
    return obj

# ================================================================
# EXPORT HELPER
# ================================================================

def export_col(col_name, filename):
    bpy.ops.object.select_all(action='DESELECT')
    col = bpy.data.collections.get(col_name)
    if not col:
        print(f"[WARN] Collection not found: {col_name}")
        return
    def sel(c):
        for o in c.objects:
            o.select_set(True)
        for ch in c.children:
            sel(ch)
    sel(col)
    fp = os.path.join(OUTPUT_DIR, filename)
    bpy.ops.export_scene.gltf(
        filepath=fp,
        use_selection=True,
        export_format='GLB',
        export_yup=True,
        export_apply=True,
        export_materials='EXPORT',
    )
    print(f"  Exported: {fp}")

# ================================================================
# LIGHTING & WORLD
# ================================================================
bpy.context.scene.world.use_nodes = True
bg = bpy.context.scene.world.node_tree.nodes['Background']
bg.inputs['Color'].default_value    = (0.42, 0.61, 0.76, 1)
bg.inputs['Strength'].default_value = 0.35

bpy.ops.object.light_add(type='SUN', location=(10, -8, 20))
sun = bpy.context.active_object
sun.data.energy       = 4.5
sun.data.color        = (1.0, 0.957, 0.847)
sun.rotation_euler    = (0.65, 0, 0.75)
# Sun goes in scene root (not a biome collection)

# ================================================================
# GROUND BASE
# ================================================================
set_col("Ground")
# Abyss floor
block(16, -0.8, 16, 34, 1.2, 34, mat('abyss', 0x111120, roughness=0.9), bevel=False)
# Per-biome ground pads (3x3 grid, each ~10.67 wide)
GROUND_DATA = [
    # (cx, cz, color, name)
    (5.3,  5.3,  0xd0e8f4, 'gnd_arctic'),
    (16.0, 5.3,  0x484848, 'gnd_urban'),
    (26.7, 5.3,  0xc8a45a, 'gnd_desert'),
    (5.3,  16.0, 0x6b5a3e, 'gnd_quarry'),
    (16.0, 16.0, 0x3d5c28, 'gnd_jungle'),
    (26.7, 16.0, 0x5c5c4a, 'gnd_nuclear'),
    (5.3,  26.7, 0x8c8070, 'gnd_wallst'),
    (16.0, 26.7, 0xe8e0d0, 'gnd_citadel'),
    (26.7, 26.7, 0x3a3a2e, 'gnd_radar'),
]
for gx, gz, gc, gn in GROUND_DATA:
    block(gx, 0.15, gz, 10.65, 0.3, 10.65, mat(gn, gc, roughness=0.95), bevel=False)

# ================================================================
# ARCTIC (NW quadrant: x 0-10.67, z 0-10.67)
# ================================================================
set_col("Arctic")
m_snow    = mat('snow',    0xf0f5f8, roughness=0.35)
m_ice     = mat('ice',     0xb8d4e8, roughness=0.15, metallic=0.1, alpha=0.85)
m_frost   = mat('frost',   0xcce4f0, roughness=0.25)
m_rock_a  = mat('rock_a',  0x6a7a8a, roughness=0.92)
m_crev    = mat('crev',    0x2a3848, roughness=0.9)

# Tiered mountain (center of arctic quad)
tiers = [
    (5.3, 1.0,  5.3,  9.4, 2.0, 9.4,  m_rock_a),
    (5.3, 3.0,  5.3,  8.0, 2.0, 8.0,  m_snow),
    (5.3, 5.0,  5.3,  6.6, 2.2, 6.6,  m_snow),
    (5.3, 7.2,  5.3,  5.2, 2.2, 5.2,  m_frost),
    (5.3, 9.4,  5.3,  3.8, 2.2, 3.8,  m_frost),
    (5.3, 11.6, 5.3,  2.4, 2.2, 2.4,  m_ice),
    (5.3, 13.5, 5.3,  1.2, 1.5, 1.2,  m_ice),   # Summit
]
for t in tiers:
    block(*t)

# Summit ice spike
cone(5.3, 14.5, 5.3, 0.5, 1.8, m_ice, segs=6)

# Route shelves for navigation
shelves = [
    (2.8, 1.5,  4.5,  5.0, 0.4, 3.0, m_snow),
    (3.2, 3.5,  5.2,  4.0, 0.4, 2.6, m_frost),
    (4.4, 6.0,  4.2,  3.4, 0.4, 2.4, m_frost),
    (5.3, 8.5,  2.6,  3.0, 0.4, 2.0, m_ice),
    (5.3, 11.0, 1.8,  2.4, 0.4, 1.6, m_ice),
]
for s in shelves:
    block(*s)

# Icicle spires around the perimeter
icicle_packs = [
    (1.2, 0.6,  1.5), (2.2, 0.6, 1.2), (0.6, 0.6, 2.8),
    (9.5, 0.6,  1.5), (10.0,0.6, 2.2), (8.8, 0.6, 0.8),
    (1.2, 0.6,  9.5), (2.0, 0.6,10.0), (0.6, 0.6, 8.8),
    (9.5, 0.6,  9.5), (10.0,0.6, 8.8), (8.8, 0.6,10.0),
    (5.3, 0.6,  0.6), (5.9, 0.6, 1.2), (4.7, 0.6, 1.0),
    (0.6, 0.6,  5.3), (1.2, 0.6, 5.9), (1.0, 0.6, 4.7),
]
for ix, iy, iz in icicle_packs:
    h1 = 0.9 + (ix * 0.17) % 0.6
    block(ix, iy + h1/2,      iz, 0.35, h1,   0.35, m_ice)
    block(ix, iy + h1 + 0.4,  iz, 0.2,  0.7,  0.2,  m_ice)
    cone( ix, iy + h1 + 0.85, iz, 0.12, 0.6,  m_ice, segs=5)

# Ice arch bridge
block(4.8, 2.0, 8.5, 0.55, 4.0, 0.55, m_ice)
block(7.5, 2.0, 8.5, 0.55, 4.0, 0.55, m_ice)
block(6.2, 4.2, 8.5, 2.9,  0.5, 0.55, m_ice)
# Arch keystones
block(5.4, 3.8, 8.5, 0.5, 0.5, 0.5, m_frost)
block(7.0, 3.8, 8.5, 0.5, 0.5, 0.5, m_frost)

# Glacier patches
for gpx, gpz in [(2.0, 7.5), (7.5, 3.0), (8.5, 7.5), (3.0, 2.5)]:
    block(gpx, 0.35, gpz, 2.5, 0.2, 2.0, m_ice)

# Crevasse cracks
for cpx, cpz in [(3.5, 6.5), (7.0, 5.0), (6.5, 8.5)]:
    block(cpx, 0.1, cpz, 3.5, 0.08, 0.25, m_crev, roty=0.3, bevel=False)

# ================================================================
# URBAN / SKATEPARK (N-center: x 10.67-21.33, z 0-10.67)
# ================================================================
set_col("Urban")
m_conc   = mat('conc',   0x9e9e9e, roughness=0.85)
m_conc_m = mat('conc_m', 0x7a7a7a, roughness=0.88)
m_conc_d = mat('conc_d', 0x585858, roughness=0.92)
m_asph   = mat('asph',   0x353535, roughness=0.96)
m_rail   = mat('rail',   0x8890a0, roughness=0.35, metallic=0.85)
m_pnt_r  = mat('pnt_r',  0xcc3333, roughness=0.55)
m_pnt_b  = mat('pnt_b',  0x2255cc, roughness=0.55)
m_pnt_y  = mat('pnt_y',  0xddaa11, roughness=0.55)
m_wood_u = mat('wood_u', 0x8b6914, roughness=0.85)
m_lamp   = mat('lamp',   0xffffaa, roughness=0.3, emit=4.0)

# Bowl base
block(16.0, -0.8, 5.3, 13.0, 1.6, 10.8, m_conc_d, bevel=False)
block(16.0,  0.1, 5.3, 13.0, 0.2, 10.8, m_conc,   bevel=False)
# Bowl walls
block(10.2, 0.8, 5.3, 0.4, 1.6, 10.8, m_conc_m)
block(21.8, 0.8, 5.3, 0.4, 1.6, 10.8, m_conc_m)
block(16.0, 0.8, 0.3, 13.0, 1.6, 0.4, m_conc_m)

# Quarter pipe (curved progression)
qp_segs = [
    (16.0, 0.32, 1.8,  12.0, 0.64, 0.8, m_conc, 0, -0.08),
    (16.0, 0.72, 2.35, 12.0, 0.64, 0.8, m_conc, 0, -0.15),
    (16.0, 1.22, 2.95, 12.0, 0.64, 0.8, m_conc, 0, -0.22),
    (16.0, 1.80, 3.65, 12.0, 0.64, 0.8, m_conc, 0, -0.28),
    (16.0, 2.17, 4.35, 12.0, 0.50, 0.8, m_conc, 0, -0.30),
]
for r in qp_segs:
    ramp(*r)

# Stairs (4 steps + handrail)
for i in range(4):
    block(21.0, 0.19 + i*0.38, 7.2 + i*0.6, 3.2, 0.38, 0.6, m_conc)
block(22.5, 1.1, 8.8, 0.05, 2.2, 3.8, m_rail)  # Handrail

# Flat ledges
block(12.5, 0.6, 8.5,  4.0, 0.4, 1.2, m_conc_m)
block(12.5, 0.6, 9.8,  4.0, 0.4, 0.3, m_rail)   # Edge rail

# Kicker
ramp(19.2, 0.3, 9.0, 3.2, 0.6, 1.6, m_conc, 0, -0.18)

# Manual pad
block(14.8, 0.45, 7.2, 4.0, 0.6, 2.0, m_conc_m)
block(14.8, 0.76, 7.2, 4.0, 0.1, 0.1, m_rail)   # Grind edge

# Billboard
block(16.0, 2.5, 1.0, 0.3, 5.0, 0.3, m_conc_d)
block(19.5, 2.5, 1.0, 0.3, 5.0, 0.3, m_conc_d)
block(17.75, 4.5, 1.0, 3.8, 0.3, 0.3, m_rail)
block(17.75, 3.1, 0.92, 3.6, 1.7, 0.12, m_pnt_b)   # Billboard face
block(17.75, 3.1, 0.92, 2.0, 0.4, 0.11, m_pnt_y)   # Stripe

# Shelter
block(12.5, 1.85, 2.5, 4.5, 0.2, 3.5, m_conc_d)
for px, pz in [(10.5, 2.0), (14.5, 2.0), (10.5, 4.5), (14.5, 4.5)]:
    block(px, 0.9, pz, 0.2, 1.8, 0.2, m_conc_d)

# Overpass fragment
block(20.5, 1.5, 5.3, 3.2, 0.4, 4.0, m_conc_d)
ramp(18.9, 0.75, 5.3, 1.8, 1.5, 4.0, m_conc_m, 0, -0.22)

# Street lamps (5)
lamp_pos = [(11.5, 5.3), (13.5, 8.8), (17.0, 9.8), (20.2, 8.8), (21.5, 3.5)]
for lx, lz in lamp_pos:
    block(lx, 2.6, lz, 0.15, 5.2, 0.15, m_conc_d)
    block(lx + 0.4, 5.1, lz, 0.8, 0.1, 0.1, m_rail)
    block(lx + 0.8, 5.0, lz, 0.28, 0.22, 0.28, m_lamp)

# Paint markings
block(16.0, 0.31, 5.8, 8.0, 0.02, 0.12, m_pnt_r, bevel=False)
block(16.0, 0.31, 7.5, 8.0, 0.02, 0.12, m_pnt_b, bevel=False)
block(16.0, 0.31, 9.2, 6.0, 0.02, 0.12, m_pnt_y, bevel=False)

# Graffiti wall
block(10.3, 0.9, 7.5, 0.12, 1.8, 4.0, m_conc_m)
block(10.3, 0.9, 7.5, 0.10, 0.9, 1.8, m_pnt_r, bevel=False)
block(10.3, 0.9, 9.0, 0.10, 0.7, 1.2, m_pnt_b, bevel=False)

# ================================================================
# DESERT (NE: x 21.33-32, z 0-10.67)
# ================================================================
set_col("Desert")
m_mesa   = mat('mesa',   0xc8703a, roughness=0.9)
m_sand   = mat('sand',   0xd4945a, roughness=0.85)
m_rock_d = mat('rock_d', 0x7a5a3a, roughness=0.95)
m_dune   = mat('dune',   0xe0c070, roughness=0.7)
m_cact   = mat('cact',   0x3d7a28, roughness=0.85)
m_cact_l = mat('cact_l', 0x5a9a38, roughness=0.8)
m_bone   = mat('bone',   0xe8e0c8, roughness=0.65)
m_tweed  = mat('tweed',  0xb8946a, roughness=0.8, alpha=0.75)
m_fossi  = mat('fossi',  0xd8c8a8, roughness=0.7)

# Corner mesa crown (NE corner)
block(28.0, 3.6,  5.3, 8.8, 7.2, 9.8, m_mesa)
block(28.0, 7.7,  5.3, 7.2, 1.5, 8.0, m_sand)
block(28.0, 8.7,  5.3, 6.0, 0.9, 7.0, m_sand)
block(28.0, 9.2,  5.3, 4.8, 0.6, 5.5, m_mesa)  # Cap
# Mesa spines
block(25.3, 2.0, 5.3, 1.6, 4.0, 5.0, m_rock_d)
block(30.8, 1.5, 4.0, 1.2, 3.0, 4.0, m_rock_d)

# East shelf band (4 tall formations)
east_segs = [
    (31.6, 5.5,  2.5, 1.0, 11.0, 3.5, m_mesa),
    (31.6, 7.0,  6.2, 1.0, 14.0, 3.0, m_mesa),
    (31.6, 6.0,  9.8, 1.0, 12.0, 3.5, m_sand),
    (31.6, 4.5, 13.0, 1.0,  9.0, 3.0, m_sand),
]
for es in east_segs:
    block(*es)

# North crumble band
crumble = [
    (22.0, 1.5, 0.5, 2.5, 3.0, 1.0, m_rock_d),
    (24.8, 2.0, 0.5, 2.0, 4.0, 1.0, m_mesa),
    (27.2, 1.2, 0.5, 2.8, 2.4, 1.0, m_rock_d),
    (29.8, 1.8, 0.5, 2.0, 3.6, 1.0, m_mesa),
    (31.6, 1.0, 0.5, 1.0, 2.0, 1.0, m_sand),
]
for cr in crumble:
    block(*cr)

# Grand arch (hero feature)
block(24.5, 4.5, 5.5, 0.9, 9.0, 0.9, m_sand)
block(28.5, 4.5, 5.5, 0.9, 9.0, 0.9, m_sand)
block(26.5, 9.1, 5.5, 4.4, 1.0, 0.9, m_mesa)   # Arch span
block(25.2, 8.3, 5.5, 0.9, 0.9, 0.9, m_mesa)   # Left haunch
block(27.8, 8.3, 5.5, 0.9, 0.9, 0.9, m_mesa)   # Right haunch

# Small arch
block(22.5, 2.0, 9.5, 0.6, 4.0, 0.6, m_sand)
block(24.5, 2.0, 9.5, 0.6, 4.0, 0.6, m_sand)
block(23.5, 4.2, 9.5, 2.5, 0.6, 0.6, m_mesa)

# Sand dunes
block(22.5, 0.3, 6.0, 4.0, 0.6, 3.0, m_dune)
block(23.5, 0.5, 7.6, 2.5, 0.4, 2.0, m_dune)
block(29.5, 0.4, 8.5, 3.5, 0.5, 2.5, m_dune)

# Cacti (8)
cactus_pos = [
    (21.5, 0.3, 3.0), (23.0, 0.3, 4.5), (25.5, 0.3, 8.5),
    (22.0, 0.3, 9.5), (29.0, 0.3, 10.5),(31.0, 0.3, 7.5),
    (26.5, 0.3, 11.5),(30.0, 0.3, 3.5),
]
for ci, (cx, cy, cz) in enumerate(cactus_pos):
    h = 1.5 + (ci % 3) * 0.4
    block(cx, cy + h/2,         cz,       0.32, h,   0.32, m_cact)
    block(cx - 0.45, cy + h*0.6 + 0.25, cz, 0.75, 0.28, 0.28, m_cact_l)
    block(cx + 0.45, cy + h*0.7 + 0.25, cz, 0.75, 0.28, 0.28, m_cact_l)
    block(cx - 0.45, cy + h*0.6 + 0.62, cz, 0.28, 0.5, 0.28, m_cact_l)
    block(cx + 0.45, cy + h*0.7 + 0.62, cz, 0.28, 0.5, 0.28, m_cact_l)
    cone(cx, cy + h + 0.35, cz, 0.22, 0.6, m_cact_l, segs=5)

# Fossil ribs
block(23.5, 0.2, 7.0, 2.4, 0.12, 0.35, m_bone, roty=0.3)
block(24.5, 0.2, 7.5, 1.8, 0.12, 0.32, m_bone, roty=-0.2)
block(25.2, 0.2, 6.8, 2.0, 0.12, 0.3,  m_fossi, roty=0.5)

# Rubble clusters
for rx, rz in [(22.8, 5.5), (27.0, 7.5), (30.5, 5.0)]:
    block(rx,     0.2, rz,     1.2, 0.4, 0.9, m_rock_d)
    block(rx+0.7, 0.3, rz+0.5, 0.7, 0.6, 0.7, m_mesa)

# Tumbleweeds
sphere(27.5, 0.5, 7.0, 0.42, m_tweed)
sphere(21.8, 0.5, 11.0, 0.38, m_tweed)

# ================================================================
# JUNGLE (Center: x 10.67-21.33, z 10.67-21.33)
# ================================================================
set_col("Jungle")
m_tr_a = mat('tr_a', 0x5c3d20, roughness=0.9)
m_tr_b = mat('tr_b', 0x4a3015, roughness=0.95)
m_lv_l = mat('lv_l', 0x5a8a28, roughness=0.8)
m_lv_m = mat('lv_m', 0x3d6a1a, roughness=0.82)
m_lv_d = mat('lv_d', 0x2c4e10, roughness=0.85)
m_vine = mat('vine',  0x567a30, roughness=0.88)
m_st_j = mat('st_j',  0x606060, roughness=0.9)
m_moss = mat('moss',  0x4e7040, roughness=0.9)
m_wtr  = mat('wtr',   0x2a6a9a, roughness=0.15, metallic=0.1, alpha=0.7)
m_fern = mat('fern',  0x5a8a2a, roughness=0.85)
m_mush = mat('mush',  0xcc4422, roughness=0.8)
m_log  = mat('log',   0x6b4010, roughness=0.92)

def jungle_tree(cx, cz, h, tw, ml, md, ms=None):
    """Generic jungle tree"""
    ms = ms or m_tr_a
    block(cx, h/2,       cz, tw,     h,   tw,     ms)
    block(cx, h+0.6,     cz, tw*4.5, 1.2, tw*4.5, ml)
    block(cx, h+1.5,     cz, tw*3.5, 1.0, tw*3.5, md)
    block(cx, h+2.2,     cz, tw*2.0, 0.8, tw*2.0, ml)
    # Vines
    for vx, vz in [(cx-tw*1.8, cz), (cx+tw*1.8, cz), (cx, cz-tw*1.8), (cx, cz+tw*1.8)]:
        block(vx, h*0.45, vz, 0.12, h*0.7, 0.12, m_vine)
    # Roots
    for rx, rz in [(cx-tw*0.6, cz), (cx+tw*0.6, cz)]:
        ramp(rx, 0.3, cz, 0.28, 0.8, tw*0.8, m_tr_b, 0, -0.3)

def giant_tree(cx, cz):
    h = 8.0
    block(cx, h/2,  cz, 1.3, h, 1.3, m_tr_b)
    block(cx-1.2, h*0.68, cz, 2.2, 0.4, 0.4, m_tr_b)
    block(cx+1.4, h*0.80, cz, 2.2, 0.4, 0.4, m_tr_b)
    block(cx, h*0.88, cz+1.2, 0.4, 0.4, 2.2, m_tr_b)
    block(cx, h+0.7, cz, 6.0, 1.5, 6.0, m_lv_d)
    block(cx, h+2.0, cz, 4.5, 1.2, 4.5, m_lv_m)
    block(cx, h+3.1, cz, 2.5, 1.0, 2.5, m_lv_l)
    for vx, vz in [
        (cx-2.6, cz-1.0), (cx+2.6, cz+1.0),
        (cx-1.0, cz+2.6), (cx+1.0, cz-2.6),
        (cx-2.0, cz+2.0), (cx+2.0, cz-2.0),
    ]:
        block(vx, h*0.5, vz, 0.14, h*0.8, 0.14, m_vine)
    # Buttress roots
    for rx, rz in [(cx-0.8, cz), (cx+0.8, cz), (cx, cz-0.8), (cx, cz+0.8)]:
        ramp(rx, 0.5, rz, 0.32, 1.0, 0.55, m_tr_b, 0, -0.35)

# Trees
jungle_tree(13.5, 13.5, 4.0, 0.6,  m_lv_m, m_lv_d)
jungle_tree(18.5, 12.5, 3.5, 0.5,  m_lv_l, m_lv_m, m_tr_b)
jungle_tree(12.0, 17.5, 4.5, 0.7,  m_lv_d, m_lv_m)
jungle_tree(20.5, 15.5, 3.0, 0.48, m_lv_m, m_lv_l, m_tr_b)
jungle_tree(14.5, 20.0, 3.8, 0.6,  m_lv_l, m_lv_d)
jungle_tree(19.5, 19.5, 4.2, 0.65, m_lv_d, m_lv_m, m_tr_b)
jungle_tree(11.5, 12.8, 2.5, 0.35, m_lv_l, m_lv_m)  # Sapling
jungle_tree(20.2, 21.0, 2.4, 0.3,  m_lv_m, m_lv_l, m_tr_b)  # Sapling
giant_tree(16.0, 16.0)

# Shrine (center of jungle)
scx, scz = 16.0, 16.0
block(scx, 0.5,  scz, 9.0, 1.0, 7.0, m_st_j)
block(scx-3.6, 2.5, scz-2.8, 0.9, 4.0, 0.9, m_st_j)
block(scx+3.6, 2.5, scz-2.8, 0.9, 4.0, 0.9, m_st_j)
block(scx-3.6, 2.5, scz+2.8, 0.9, 4.0, 0.9, m_moss)
block(scx+3.6, 2.5, scz+2.8, 0.9, 4.0, 0.9, m_moss)
block(scx-3.6, 1.5, scz, 0.65, 2.0, 2.8, m_st_j)
block(scx+3.6, 1.5, scz, 0.65, 2.0, 2.8, m_st_j)
block(scx, 1.5, scz, 1.5, 2.2, 1.5, m_moss)
block(scx, 2.9, scz, 1.0, 0.7, 1.0, m_st_j)
# Shrine roof (lintel)
block(scx, 4.8, scz-2.8, 9.0, 0.4, 0.9, m_st_j)
# Vines on shrine
for svx, svz in [(scx-3.6, scz-2.0), (scx+3.6, scz-2.0), (scx-3.6, scz+2.0)]:
    block(svx, 2.5, svz, 0.1, 4.0, 0.1, m_vine)

# Waterfall (west border)
for row in range(9):
    for col_i in range(6):
        block(10.7 + row*0.74, 0.5 + col_i*0.88, 14.2, 0.70, 0.82, 0.08, m_wtr, bevel=False)
# Waterfall pool
block(14.4, 0.1, 14.2, 6.5, 0.2, 2.5, m_wtr, bevel=False)

# Ferns, mushrooms, logs
for fx, fz in [(12.5, 14.5), (15.0, 13.0), (18.5, 17.0), (13.5, 19.0), (20.0, 18.5), (11.8, 18.0)]:
    block(fx, 0.35, fz, 0.9, 0.25, 1.5, m_fern)
block(14.2, 0.38, 16.5, 0.32, 0.55, 0.32, m_mush)
block(14.2, 0.7,  16.5, 0.8, 0.18, 0.8,  m_mush)  # Cap
block(17.5, 0.38, 20.0, 0.28, 0.45, 0.28, m_mush)
block(17.5, 0.66, 20.0, 0.7, 0.15, 0.7,  m_mush)  # Cap
# Logs
block(12.8, 0.3, 15.5, 2.5, 0.45, 0.45, m_log, roty=0.4)
block(19.0, 0.3, 17.8, 2.0, 0.38, 0.38, m_log, roty=-0.3)
# Stones
for sx, sz in [(13.0, 18.5), (17.8, 14.0), (20.5, 19.5)]:
    block(sx, 0.2, sz, 0.7, 0.45, 0.6, m_st_j)

# ================================================================
# NUCLEAR (E: x 21.33-32, z 10.67-21.33)
# ================================================================
set_col("Nuclear")
m_twr   = mat('twr',   0xdde8e0, roughness=0.55)
m_twr_s = mat('twr_s', 0xb8c8c0, roughness=0.65)
m_bld   = mat('bld',   0x585858, roughness=0.85)
m_bld_l = mat('bld_l', 0x787878, roughness=0.8)
m_duct  = mat('duct',  0x4a5050, roughness=0.65, metallic=0.35)
m_nglow = mat('nglow', 0x44ff66, roughness=0.2, emit=3.0, alpha=0.88)
m_stm   = mat('stm',   0xffffff, roughness=0.5, alpha=0.14)
m_warn  = mat('warn',  0xffcc00, roughness=0.5)

def cooling_tower(tcx, tcz):
    for i in range(13):
        f   = i / 12.0
        w   = 16.6 - (16.6 - 10.4) * f
        my  = 0.3 + i + 0.5
        m   = m_twr if i % 2 == 0 else m_twr_s
        block(tcx, my, tcz, w, 1.0, w, m)
    block(tcx, 13.8, tcz, 11.2, 0.6, 11.2, m_twr)   # Cap
    block(tcx, -0.1, tcz, 18.2, 0.6, 18.2, m_twr_s) # Ring base
    # Warning stripe
    block(tcx, 6.5, tcz, 13.5, 0.4, 13.5, m_warn, bevel=False)

cooling_tower(23.5, 13.5)
cooling_tower(29.5, 13.5)

# North reactor building
block(25.5, 3.875, 17.5, 11.8, 7.75, 17.6, m_bld)
block(25.5, 7.95,  17.5, 12.5,  0.4, 18.2, m_bld_l)
block(25.5,  0.3,  17.5, 12.5,  0.6, 18.5, m_duct)

# South reactor building
block(25.5, 6.48,  27.2, 15.4, 12.96, 22.9, m_bld)
block(25.5, 13.05, 27.2, 16.0,   0.5, 23.5, m_bld_l)
block(25.5,  0.3,  27.2, 16.0,   0.6, 23.5, m_duct)

# Fire escape (north building west face)
for step in range(8):
    block(19.2, 0.4 + step*0.9, 15.0 + step*0.2, 1.8, 0.12, 0.8, m_duct)
block(19.6, 3.6, 15.5, 0.1, 7.5, 0.25, m_duct)
block(18.8, 3.6, 15.5, 0.1, 7.5, 0.25, m_duct)

# Inter-building bridge duct
block(25.5, 8.5, 22.2, 1.4, 0.8, 4.0, m_duct)
block(25.5, 8.9, 22.2, 2.0, 0.15, 4.0, m_duct)  # Rail top

# Glow windows
block(25.5, 5.0, 16.3, 14.5, 1.2, 0.15, m_nglow, bevel=False)
block(25.5, 8.0, 16.3, 14.5, 1.2, 0.15, m_nglow, bevel=False)
block(25.5, 10.5, 16.3, 12.0, 1.0, 0.15, m_nglow, bevel=False)

# Decorative static steam clouds above towers
for tcx in [23.5, 29.5]:
    for si in range(5):
        ox = -1.5 + si * 0.8
        block(tcx + ox, 15.0 + si*0.6, 13.5, 0.8, 0.5, 0.8, m_stm, bevel=False)
        block(tcx + ox + 0.4, 15.5 + si*0.6, 13.5, 0.6, 0.4, 0.6, m_stm, bevel=False)

# Hazard markers on ground
for hx, hz in [(22.5, 11.5), (28.5, 11.5), (22.5, 20.5), (28.5, 20.5)]:
    block(hx, 0.35, hz, 1.5, 0.1, 1.5, m_warn, bevel=False)

# ================================================================
# CITADEL (S-center: x 10.67-21.33, z 21.33-32)
# ================================================================
set_col("Citadel")
m_ivory  = mat('ivory',  0xf5f0e8, roughness=0.35)
m_marble = mat('marble', 0xe8e2d8, roughness=0.28)
m_citsh  = mat('citsh',  0xcec8bc, roughness=0.45)
m_trim_c = mat('trim_c', 0xc8b888, roughness=0.38)
m_flm_o  = mat('flm_o',  0xff6600, roughness=0.2, emit=4.0, alpha=0.8)
m_flm_m  = mat('flm_m',  0xff9900, roughness=0.2, emit=5.5, alpha=0.75)
m_flm_c  = mat('flm_c',  0xffee00, roughness=0.2, emit=7.0, alpha=0.72)
m_stm_c  = mat('stm_c',  0xffffff, roughness=0.5, alpha=0.1)

ccx, ccz = 16.0, 26.7

# Concentric base rings (mountain base)
for i, w in enumerate([40, 36, 32, 28, 24, 20, 18]):
    yh = 0.5
    block(ccx, yh*i - 0.2, ccz, w, yh, w, m_citsh, bevel=False)

# Marble court
block(ccx, 1.8, ccz, 18.0, 0.3, 16.0, m_marble)
block(ccx, 2.0, ccz, 15.0, 0.12, 12.0, m_ivory)

# Grand approaches (4 sides)
for (dx, dz) in [(0, -1), (0, 1), (-1, 0), (1, 0)]:
    for step in range(6):
        sw = 16.2 - step * 1.1
        sy = 2.0 + step * 0.55
        sxp = ccx + dx * (9.2 + step * 1.35)
        szp = ccz + dz * (9.2 + step * 1.35)
        if dx == 0:
            block(sxp, sy/2, szp, sw, sy, 0.3, m_marble)
        else:
            block(sxp, sy/2, szp, 0.3, sy, sw, m_marble)

# Mountain body bands
for yh, mw, mm in [(4, 16, m_citsh), (7, 13, m_marble), (10, 10, m_ivory)]:
    block(ccx, yh/2, ccz, mw*2, yh, mw*2, mm, bevel=False)

# Pavilion wings (4 corners of mountain top)
for px, pz in [(ccx-8, ccz-8), (ccx+8, ccz-8), (ccx-8, ccz+8), (ccx+8, ccz+8)]:
    block(px, 6.5, pz, 5.5, 3.0, 5.5, m_marble)
    block(px, 8.5, pz, 4.0, 2.0, 4.0, m_ivory)

# Sanctum wings
block(ccx - 6.0, 11.2, ccz, 5.8, 4.4, 12.4, m_ivory)
block(ccx + 6.0, 11.2, ccz, 5.8, 4.4, 12.4, m_ivory)
block(ccx, 14.0, ccz, 3.0, 0.8, 13.0, m_marble)  # Lintel

# Central sanctum stack
block(ccx, 15.8, ccz, 10.2, 5.2, 10.2, m_marble)
block(ccx, 20.0, ccz,  8.5, 2.5,  8.5, m_ivory)
block(ccx, 22.0, ccz,  6.5, 1.8,  6.5, m_marble)
block(ccx, 23.5, ccz,  5.0, 1.5,  5.0, m_ivory)

# Sanctum columns (8)
for px, pz in [
    (ccx-4.5, ccz-4.5), (ccx+4.5, ccz-4.5),
    (ccx-4.5, ccz+4.5), (ccx+4.5, ccz+4.5),
    (ccx-4.5, ccz),     (ccx+4.5, ccz),
    (ccx, ccz-4.5),     (ccx, ccz+4.5),
]:
    block(px, 15.0, pz, 0.75, 9.5, 0.75, m_trim_c)

# Summit flame torch (3 layers)
block(ccx, 25.5, ccz, 6.8, 2.2, 6.8, m_flm_o)
block(ccx, 26.6, ccz, 4.8, 1.8, 4.8, m_flm_m)
block(ccx, 27.4, ccz, 2.8, 1.4, 2.8, m_flm_c)

# Steam around torch
for si in range(5):
    angle = si * math.pi * 2 / 5
    sx = ccx + math.cos(angle) * 2.5
    sz = ccz + math.sin(angle) * 2.5
    block(sx, 26.0 + si*0.4, sz, 0.6, 0.5, 0.6, m_stm_c, bevel=False)

# Decorative urns at sanctum base
for ux, uz in [(ccx-5.5, ccz-5.5), (ccx+5.5, ccz-5.5), (ccx-5.5, ccz+5.5), (ccx+5.5, ccz+5.5)]:
    cylinder(ux, 14.5, uz, 0.4, 1.2, m_marble, segs=12)
    cylinder(ux, 15.3, uz, 0.55, 0.25, m_trim_c, segs=12)

# ================================================================
# QUARRY (W: x 0-10.67, z 21.33-32)
# ================================================================
set_col("Quarry")
m_qr  = mat('qr',  0x6a5a4a, roughness=0.95)
m_qd  = mat('qd',  0x4a3a2a, roughness=0.96)
m_qdu = mat('qdu', 0x9a8870, roughness=0.9)
m_qst = mat('qst', 0x6a7070, roughness=0.38, metallic=0.75)
m_qor = mat('qor', 0xd4ac3a, roughness=0.55, metallic=0.35)

qcx, qcz = 5.3, 26.7

# Terraced pit
block(qcx, -0.5, qcz,  9.0, 1.0,  9.0, m_qd,  bevel=False)
block(qcx, -0.1, qcz, 10.5, 0.4, 10.5, m_qr,  bevel=False)
block(qcx,  0.3, qcz, 12.0, 0.4, 12.0, m_qdu, bevel=False)
block(qcx,  0.7, qcz, 13.5, 0.4, 13.5, m_qr,  bevel=False)

# Access ramps
ramp(qcx+3.5, 0.1, qcz-5.8, 3.5, 0.8, 2.5, m_qr,  0,               -0.18)
ramp(qcx-4.5, 0.1, qcz+2.0, 2.5, 0.8, 3.0, m_qr,  math.pi/2,       -0.18)
ramp(qcx+1.0, 0.1, qcz+5.5, 3.0, 0.8, 2.0, m_qdu, math.pi,         -0.18)

# Crane (northeast of pit)
crx, crz = qcx+4.8, qcz-4.2
block(crx-0.5, 4.1, crz, 0.8, 8.2, 0.8, m_qst)
block(crx+0.5, 3.7, crz, 0.8, 7.4, 0.8, m_qst)
block(crx+3.6,  8.0, crz, 8.4, 0.5, 0.4, m_qst)   # Boom
block(crx+8.0,  6.5, crz, 0.1, 3.0, 0.1, m_qst)   # Cable
block(crx+8.0,  5.0, crz, 0.85, 0.7, 0.65, m_qor) # Ore bucket
# Crane diagonal brace
ramp(crx-0.2, 2.0, crz, 0.25, 4.5, 0.25, m_qst, 0, -0.4)

# Catwalk
block(qcx+2.0, 2.5, qcz, 10.8, 0.22, 2.0, m_qst)
block(qcx-3.2, 1.3, qcz, 0.3, 2.6, 0.3, m_qst)
block(qcx+7.2, 1.3, qcz, 0.3, 2.6, 0.3, m_qst)
ramp(qcx-4.2, 1.3, qcz, 2.2, 2.6, 1.8, m_qr, 0, -0.28)
# Catwalk railing
block(qcx+2.0, 3.55, qcz-1.0, 10.8, 0.12, 0.08, m_qst, bevel=False)
block(qcx+2.0, 3.55, qcz+1.0, 10.8, 0.12, 0.08, m_qst, bevel=False)

# Drill assembly
drx, drz = qcx-3.5, qcz-3.5
block(drx, 0.4, drz, 1.8, 0.8, 1.8, m_qr)
block(drx, 2.5, drz, 0.8, 4.0, 0.8, m_qst)
block(drx, 4.7, drz, 2.7, 0.28, 2.7, m_qst, roty=0.5)
block(drx, 5.1, drz, 0.3, 0.9, 0.3, m_qst)  # Drill bit
cone(drx, 5.6, drz, 0.18, 0.5, m_qst, segs=5)

# Ridge formations
block(qcx-5.8, 1.5, qcz+1.0, 1.0, 3.0, 6.0, m_qr)
block(qcx+6.0, 1.2, qcz-1.0, 1.0, 2.5, 4.5, m_qd)

# Ore veins
for ox, oz in [(qcx-2.0, qcz+2.0), (qcx+1.5, qcz-1.0), (qcx+3.0, qcz+3.5)]:
    block(ox, 0.2, oz, 0.8, 0.35, 0.8, m_qor)

# ================================================================
# RADAR (SE: x 21.33-32, z 21.33-32)
# ================================================================
set_col("Radar")
m_rb  = mat('rb',  0x2a2e28, roughness=0.9)
m_rp  = mat('rp',  0x5a6a5a, roughness=0.55, metallic=0.25)
m_rs  = mat('rs',  0x3a4440, roughness=0.55, metallic=0.45)
m_ra  = mat('ra',  0x8ab050, roughness=0.48)
m_rg  = mat('rg',  0x44ff22, roughness=0.2, emit=4.0)
m_rl  = mat('rl',  0xaaddff, roughness=0.2, emit=2.5)

rdx, rdz = 26.7, 26.7

# Base ring
block(rdx, -0.1, rdz, 12.8, 0.55, 12.8, m_rb, bevel=False)
# Central mast
block(rdx, 3.5, rdz, 1.0, 7.0, 1.0, m_rs)
block(rdx, 7.1, rdz, 4.8, 0.16, 0.16, m_rp)   # Crosshair H
block(rdx, 7.1, rdz, 0.16, 0.16, 4.8, m_rp)   # Crosshair V
cylinder(rdx, 7.0, rdz, 2.8, 0.12, m_rp, segs=24)  # Ring
block(rdx, 7.55, rdz, 0.38, 0.65, 0.38, m_rg)  # Beacon
# Mast guy wires (4)
for wx, wz in [(rdx-2.5, rdz), (rdx+2.5, rdz), (rdx, rdz-2.5), (rdx, rdz+2.5)]:
    ramp(wx/2 + rdx/2, 3.5, wz/2 + rdz/2, 0.06, 7.0, 0.06, m_rs, 0, math.atan2(3.5, 2.5))

# Dish 1
d1x = rdx - 3.5
block(d1x, 1.5, rdz+2.0, 0.5, 3.0, 0.5, m_rs)
block(d1x, 3.2, rdz+2.0, 2.5, 0.14, 2.5, m_rp)
cylinder(d1x, 3.05, rdz+2.0, 0.8, 0.08, m_rb, segs=16)  # Dish ring
block(d1x, 3.0, rdz+2.0, 0.28, 0.28, 0.28, m_rg)

# Dish 2
d2x = rdx + 3.2
block(d2x, 1.5, rdz-2.5, 0.5, 2.8, 0.5, m_rs)
block(d2x, 3.0, rdz-2.5, 2.2, 0.14, 2.2, m_rp)
block(d2x, 2.9, rdz-2.5, 0.28, 0.28, 0.28, m_rg)

# Bunker A
block(rdx-4.0, 1.6, rdz-4.5, 8.4, 3.2, 5.6, m_rb)
block(rdx-4.0, 3.3, rdz-4.5, 8.8, 0.2, 6.0, m_rp)
ramp(rdx-4.0+5.0, 0.8, rdz-4.5, 2.2, 1.6, 3.2, m_rb, 0, -0.2)
# Bunker A antenna
block(rdx-6.5, 4.5, rdz-4.5, 0.1, 2.0, 0.1, m_rs)
block(rdx-6.5, 5.55, rdz-4.5, 0.6, 0.12, 0.12, m_rs)

# Bunker B
block(rdx+3.5, 1.3, rdz+3.5, 6.6, 2.6, 4.8, m_rb)
block(rdx+3.5, 2.7, rdz+3.5, 7.0, 0.2, 5.2, m_rp)
ramp(rdx+3.5-4.0, 0.65, rdz+3.5, 1.8, 1.3, 2.6, m_rb, 0, -0.2)

# Perimeter walls
block(rdx-5.3, 1.5, rdz,     0.3, 3.0, 10.6, m_rb)
block(rdx+5.3, 1.5, rdz,     0.3, 3.0, 10.6, m_rb)
block(rdx,     1.5, rdz-5.3, 10.6, 3.0, 0.3, m_rb)
# Wall accent stripes
block(rdx-5.2, 1.8, rdz, 0.08, 1.0, 10.6, m_ra, bevel=False)
block(rdx+5.2, 1.8, rdz, 0.08, 1.0, 10.6, m_ra, bevel=False)

# Sensor array (ground-level boxes)
for si in range(4):
    block(rdx - 4.5 + si*1.5, 0.55, rdz+4.0, 0.8, 0.5, 0.8, m_rp)
    block(rdx - 4.5 + si*1.5, 0.82, rdz+4.0, 0.55, 0.12, 0.55, m_ra, bevel=False)

# ================================================================
# WALL STREET (SW: x 0-10.67, z 21.33-32)
# ================================================================
set_col("WallStreet")
m_sl  = mat('sl',  0xeae0d0, roughness=0.45)
m_sm  = mat('sm',  0xc8c0b0, roughness=0.52)
m_sd  = mat('sd',  0xa09888, roughness=0.58)
m_tws = mat('tws', 0xd8d0c0, roughness=0.42)
m_brnz= mat('brnz',0xb88848, roughness=0.38, metallic=0.55)
m_gwn = mat('gwn', 0x6090c0, roughness=0.08, metallic=0.5, alpha=0.38)
m_gwc = mat('gwc', 0x80b0e0, roughness=0.05, metallic=0.6, alpha=0.28)
m_snr = mat('snr', 0xcc2222, roughness=0.45, emit=0.6)
m_snb = mat('snb', 0x2244cc, roughness=0.45, emit=0.6)
m_hedg= mat('hedg',0x3a6020, roughness=0.9)
m_pvt = mat('pvt', 0x8a8078, roughness=0.82)
m_wsg = mat('wsg', 0xffeebb, roughness=0.25, emit=2.5)
m_crb = mat('crb', 0x6a6058, roughness=0.88)

wcx, wcz = 5.3, 26.7

# Pavement base
block(wcx, 0.12, wcz, 10.5, 0.22, 10.5, m_pvt, bevel=False)
block(wcx, 0.24, wcz,  7.5, 0.06,  7.5, m_sl,  bevel=False)
# Center lane
block(wcx, 0.26, wcz,  7.5, 0.04,  0.18, m_crb, bevel=False)

# Curbing
for cx_off in [-5.0, 5.0]:
    block(wcx+cx_off, 0.28, wcz, 0.25, 0.35, 10.5, m_crb)
for cz_off in [-5.0, 5.0]:
    block(wcx, 0.28, wcz+cz_off, 10.5, 0.35, 0.25, m_crb)

# Grand stair (north approach)
for i in range(5):
    sw = 16.4 - i * 0.95
    block(wcx, 0.3 + i*0.44, wcz - 6.5 - i*0.72, sw, 0.44, 1.2, m_sm)
# Red stripe on top step
block(wcx, 0.32 + 4*0.44, wcz - 6.5 - 4*0.72, 12.0, 0.06, 1.22, m_snr, bevel=False)

# Stock Exchange (hero building)
block(wcx, 5.6,  wcz, 8.2, 11.2, 6.5, m_sl)
block(wcx, 11.4, wcz, 8.8,  0.4, 7.2, m_sd)    # Roofline
block(wcx, 12.2, wcz, 6.8,  1.6, 5.5, m_sm)    # Upper tier
block(wcx, 13.8, wcz, 5.2,  1.6, 4.2, m_sl)
block(wcx, 15.3, wcz, 3.8,  1.4, 3.0, m_sm)
block(wcx, 16.5, wcz, 2.8,  1.2, 2.5, m_sl)    # Top tier

# Facade columns (6)
for fcx in [wcx-3.5, wcx-2.1, wcx-0.7, wcx+0.7, wcx+2.1, wcx+3.5]:
    block(fcx, 5.6, wcz-3.4, 0.38, 11.2, 0.38, m_sd)

# Windows
block(wcx-2.2, 5.2, wcz-3.4, 1.8, 2.6, 0.14, m_gwn)
block(wcx+2.2, 5.2, wcz-3.4, 1.8, 2.6, 0.14, m_gwn)
block(wcx-2.2, 9.0, wcz-3.4, 1.8, 2.2, 0.14, m_gwc)
block(wcx+2.2, 9.0, wcz-3.4, 1.8, 2.2, 0.14, m_gwc)

# Glow strips on facade
block(wcx, 3.2, wcz-3.42, 7.2, 0.28, 0.1, m_wsg, bevel=False)
block(wcx, 7.5, wcz-3.42, 7.2, 0.28, 0.1, m_wsg, bevel=False)
block(wcx, 11.0,wcz-3.42, 6.0, 0.22, 0.1, m_wsg, bevel=False)

# Clock medallion
cylinder(wcx, 17.5, wcz-3.42, 1.1, 0.14, m_brnz, segs=32)
block(wcx, 17.5, wcz-3.42-0.08, 0.07, 1.8, 0.07, m_sd)   # Hands

# Signs
block(wcx, 13.5, wcz-3.0, 4.8, 0.9, 0.1, m_snr, bevel=False)
block(wcx, 14.6, wcz-3.0, 3.8, 0.7, 0.1, m_snb, bevel=False)

# Tower Stack (tallest structure, offset east)
twx = wcx + 4.0
tower_tiers = [
    (twx, 6.0,  wcz, 12.6, 12.0, 12.6, m_tws),
    (twx, 18.5, wcz, 11.0, 13.0, 11.0, m_tws),
    (twx, 31.5, wcz,  9.5, 16.0,  9.5, m_sl),
    (twx, 41.5, wcz,  8.5,  9.0,  8.5, m_sm),
    (twx, 48.5, wcz,  8.2,  5.0,  8.2, m_tws),
]
ty_acc = 0
for ti, (tx, ty, tz, tw, th, td, tm) in enumerate(tower_tiers):
    block(tx, ty, tz, tw, th, td, tm)
    # Window strips per tier
    for wi in range(int(th / 3.5)):
        block(tx, ty - th/2 + 1.0 + wi*3.2, tz - tw/2,
              tw - 0.4, 1.0, 0.1, m_gwn, bevel=False)
    ty_acc = ty + th/2

# Spire
block(twx, ty_acc + 3.0,  wcz, 1.5, 6.0, 1.5, m_sd)
block(twx, ty_acc + 7.0,  wcz, 0.65, 3.5, 0.65, m_brnz)
block(twx, ty_acc + 8.8,  wcz, 0.32, 0.9, 0.32, m_wsg)  # Beacon

# Side finance buildings
block(wcx-4.2, 7.5, wcz,  3.8, 15.0, 6.2, m_sm)
block(wcx-4.2, 8.8, wcz-3.4, 3.8, 17.5, 0.25, m_sl)

# Street lamps (2)
for slx in [wcx-5.0, wcx+5.0]:
    block(slx, 2.7, wcz-4.2, 0.15, 5.4, 0.15, m_sd)
    block(slx, 5.4, wcz-4.2, 0.1, 0.1, 1.1, m_brnz)
    block(slx, 5.3, wcz-3.7, 0.3, 0.3, 0.3, m_wsg)

# Planter hedges (6)
for hx, hz in [
    (wcx-4.2, wcz-6.8), (wcx,     wcz-6.8), (wcx+4.2, wcz-6.8),
    (wcx-4.2, wcz+6.8), (wcx,     wcz+6.8), (wcx+4.2, wcz+6.8),
]:
    block(hx, 0.45, hz, 1.4, 0.9, 1.4, m_sd)
    block(hx, 0.95, hz, 1.5, 0.65, 1.5, m_hedg)

# Bus stops (2 glass shelters)
for bsx in [wcx-5.5, wcx+5.5]:
    block(bsx, 1.6,  wcz,     5.4, 3.2, 3.2, m_gwc)
    block(bsx, 3.35, wcz,     5.8, 0.14, 3.6, m_sd)
    block(bsx-2.0, 0.5, wcz-1.0, 3.0, 0.38, 0.6, m_sm)  # Bench

# ================================================================
# EXPORT ALL BIOMES
# ================================================================
biomes_export = [
    ("Ground",      "ground.glb"),
    ("Arctic",      "arctic.glb"),
    ("Urban",       "urban.glb"),
    ("Desert",      "desert.glb"),
    ("Jungle",      "jungle.glb"),
    ("Nuclear",     "nuclear.glb"),
    ("Citadel",     "citadel.glb"),
    ("Quarry",      "quarry.glb"),
    ("Radar",       "radar.glb"),
    ("WallStreet",  "wall_street.glb"),
]

print("\n=== Exporting biome GLBs ===")
for col_name, fname in biomes_export:
    export_col(col_name, fname)

# Combined full world export
print("\n=== Exporting world_full.glb ===")
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(
    filepath=os.path.join(OUTPUT_DIR, "world_full.glb"),
    use_selection=True,
    export_format='GLB',
    export_yup=True,
    export_apply=True,
    export_materials='EXPORT',
)

print("\n=== Done! All assets exported to:", OUTPUT_DIR, "===")
