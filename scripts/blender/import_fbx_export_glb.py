import argparse
import os
import sys

import bpy


def parse_args(argv):
    parser = argparse.ArgumentParser(description="Batch-convert FBX meshes to GLB files.")
    parser.add_argument(
        "--asset",
        action="append",
        nargs=2,
        metavar=("INPUT", "OUTPUT"),
        required=True,
        help="Input FBX path and output GLB path.",
    )
    return parser.parse_args(argv)


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()


def export_asset(input_path, output_path):
    clear_scene()
    bpy.ops.import_scene.fbx(filepath=os.path.abspath(input_path))
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=os.path.abspath(output_path),
        check_existing=False,
        export_format="GLB",
        export_animations=False,
        export_texcoords=True,
        export_normals=True,
        export_tangents=False,
        export_materials="NONE",
        export_yup=True,
        export_apply=False,
        export_draco_mesh_compression_enable=False,
    )
    print(f"Exported {input_path} -> {output_path}")


def main():
    passthrough = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    args = parse_args(passthrough)
    for input_path, output_path in args.asset:
        export_asset(input_path, output_path)


if __name__ == "__main__":
    main()
