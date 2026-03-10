import argparse
import os
import sys

import bpy


FORMAT_MAP = {
    "binary": "GLB",
    "separate": "GLTF_SEPARATE",
}

MATERIAL_MAP = {
    "export": "EXPORT",
    "placeholder": "PLACEHOLDER",
    "viewport": "VIEWPORT",
    "none": "NONE",
}


def parse_args(argv):
    parser = argparse.ArgumentParser(
        description="Export a Blender scene/object/collection to glTF for this repo."
    )
    parser.add_argument("--output", required=True, help="Destination .gltf or .glb path.")
    parser.add_argument("--object", dest="object_name", help="Object name to export.")
    parser.add_argument("--collection", help="Collection name to export.")
    parser.add_argument(
        "--format",
        choices=["auto"] + sorted(FORMAT_MAP),
        default="auto",
        help="glTF packaging mode. Default derives from the output extension.",
    )
    parser.add_argument(
        "--materials",
        choices=sorted(MATERIAL_MAP),
        default="export",
        help="Material export mode.",
    )
    parser.add_argument(
        "--animations",
        action="store_true",
        help="Include animations. Off by default for static weapon props.",
    )
    parser.add_argument(
        "--apply-modifiers",
        action="store_true",
        help="Apply export-time modifiers.",
    )
    return parser.parse_args(argv)


def recursive_collection_objects(collection):
    for obj in collection.objects:
        yield obj
    for child in collection.children:
        yield from recursive_collection_objects(child)


def clear_selection():
    for obj in bpy.data.objects:
        obj.select_set(False)


def select_export_scope(args):
    clear_selection()

    selected = []
    if args.object_name:
        obj = bpy.data.objects.get(args.object_name)
        if obj is None:
            raise SystemExit(f"Object not found: {args.object_name}")
        obj.select_set(True)
        selected.append(obj)
    elif args.collection:
        collection = bpy.data.collections.get(args.collection)
        if collection is None:
            raise SystemExit(f"Collection not found: {args.collection}")
        seen = set()
        for obj in recursive_collection_objects(collection):
            if obj is None or obj.name in seen:
                continue
            obj.select_set(True)
            selected.append(obj)
            seen.add(obj.name)

    if selected:
        bpy.context.view_layer.objects.active = selected[0]
    return bool(selected), selected


def main():
    argv = sys.argv
    passthrough = argv[argv.index("--") + 1 :] if "--" in argv else []
    args = parse_args(passthrough)

    output_path = os.path.abspath(args.output)
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    export_format = args.format
    if export_format == "auto":
        export_format = "binary" if output_path.lower().endswith(".glb") else "separate"

    use_selection, selected = select_export_scope(args)

    bpy.ops.export_scene.gltf(
        filepath=output_path,
        check_existing=False,
        export_format=FORMAT_MAP[export_format],
        use_selection=use_selection,
        export_animations=args.animations,
        export_texcoords=True,
        export_normals=True,
        export_tangents=False,
        export_materials=MATERIAL_MAP[args.materials],
        export_image_format="AUTO",
        export_draco_mesh_compression_enable=False,
        export_yup=True,
        export_apply=args.apply_modifiers,
    )

    scope = "scene"
    if args.object_name:
        scope = f"object:{args.object_name}"
    elif args.collection:
        scope = f"collection:{args.collection}"

    print(
        "Exported",
        scope,
        "to",
        output_path,
        f"(format={export_format}, selected={len(selected) if use_selection else 'all'})",
    )


if __name__ == "__main__":
    main()
