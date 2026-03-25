# Blender Asset Pipeline

This repo uses the Blender export wrapper for authored environment and prop assets.

The missing piece was a repeatable Blender export path. Use the wrapper below instead of exporting by hand from the UI each time.

## Prerequisite

Blender must resolve on your shell `PATH`.

Check it with:

```sh
Blender --version
```

## Export an asset from Blender

Export a collection named `Props` from a `.blend` file into the repo:

```sh
./scripts/blender-export.sh ~/Downloads/arena-props.blend public/assets/models/props/arena-props.gltf --collection Props
```

Export a single object instead:

```sh
./scripts/blender-export.sh scene.blend public/assets/models/props/door.gltf --object Door
```

By default the wrapper derives the export format from the output extension:

- `.gltf` exports as `GLTF_SEPARATE`
- `.glb` exports as `GLB`

Blender `5.0.1` on this machine does not expose embedded `.gltf` export. If you export `.gltf`, commit the generated `.bin` sidecar too.

## Optional flags

Include animations:

```sh
./scripts/blender-export.sh scene.blend public/assets/models/props/door.gltf --object Door --animations
```

Export `.glb` instead:

```sh
./scripts/blender-export.sh scene.blend public/assets/models/props/crate.glb --object Crate --format binary
```

Apply modifiers at export time:

```sh
./scripts/blender-export.sh scene.blend public/assets/models/props/crate.gltf --object Crate --apply-modifiers
```

## Recommended repo conventions

- Keep gameplay-facing models under `public/assets/models/...`.
- Prefer one top-level collection per exportable asset.
- When exporting `.gltf`, commit the matching `.bin` file that Blender writes next to it.
- Use `.glb` only if the runtime path consuming the asset already expects it.
- Re-export into the final repo path so the runtime URL stays stable.

## NPM shortcut

You can also call the wrapper through npm:

```sh
npm run blender:export -- scene.blend public/assets/models/props/door.gltf --object Door
```

## Character Bone Attachments That Actually Work

If you need to attach a runtime object like a placeholder gun cube to a character limb, the important rule is:

- attach to the live exported bone on the live `SkinnedMesh.skeleton.bones` instance
- do not attach to the model root, armature wrapper, or a name-matched helper node unless you have confirmed it is the real animated bone

Why this matters:

- root attachment follows world movement only
- live bone attachment follows idle sway, limb motion, and animation clips

### What failed in this project

The runtime was trying to attach to Blender-style dotted names like `arm_lower.R`, but the exported Boxman skeleton in `public/assets/models/boxman.glb` actually uses names like `arm_lowerR`.

That caused an easy-to-miss failure mode:

- the lookup missed the live exported bone
- the code fell back to a higher wrapper/root transform
- the cube moved through the world but did not inherit idle arm sway

### What works now

In [js/actors/boxman-rig.js](/Users/gguthrie/Desktop/code%20bs/minecraft-fps/js/actors/boxman-rig.js), the runtime now:

1. finds the live `SkinnedMesh`
2. resolves bones from `skinnedMesh.skeleton.bones` first
3. supports exported-name aliases like `arm_lowerR` and `arm_lower.R`
4. parents the attachment object to the resolved live bone

For the current placeholder weapon cube, the working mount is:

- bone: right lower arm (`arm_lowerR`)
- local offset: `x: 0.08`, `y: 0.65`, `z: -0.16`
- cube size: `0.28 x 0.28 x 0.5`

Those values are not special beyond this asset. They are just the offsets that made the cube visibly sit farther down the forearm instead of disappearing into the elbow area.

### How to verify an attachment is correct

Use this checklist:

- the object follows idle sway at rest
- the object follows arm swing during clips
- the object is parented under a real exported `Bone`
- the bone was resolved from the live cloned skeleton, not the preload template or a wrapper group

If the object follows gross movement through the world but not idle sway, it is almost certainly attached at the wrong hierarchy level.

### Before adding a new socket bone

Do not add new hand or weapon socket bones until you have already proven that an attachment can ride an existing live exported bone through idle sway.

If the current attachment path is wrong, a new bone will fail the same way.

Once live-bone attachment is confirmed, then adding a dedicated `hand.R` or `weapon_socket.R` bone becomes worthwhile for cleaner weapon articulation.
