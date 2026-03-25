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
- local offset: `x: -0.04`, `y: 0.65`, `z: -0.06`
- local rotation: `x: 0.08`, `y: 0.22`, `z: 0`
- cube size: `0.28 x 0.28 x 0.5`

Those values are not special beyond this asset. They are just the offsets that made the cube visibly sit farther down the forearm instead of disappearing into the elbow area.

### Use The Current Cube As The Handle Reference

The current placeholder cube should be treated as the reference handle orientation for future guns.

In plain terms:

- the current cube position is where the grip/handle should live relative to the forearm mount
- the current cube rotation is the orientation a held weapon should generally inherit
- if you built the cube outward along its local `+Y` axis, that would be the barrel direction

That makes the mount a practical authoring guide for future weapon meshes:

- build the weapon handle around the current cube
- build the barrel forward along the cube's local `+Y`
- keep the weapon parented to the same runtime forearm mount unless a later rig/socket replaces it

### What The Current Local Axes Mean

For this mount:

- `+Y` is the gun-forward / barrel direction
- `-Z` lifts the weapon up out of the hand
- `+Z` pushes the handle deeper down into the hand
- `+X` moves the weapon inward toward the body
- `-X` moves the weapon outward toward the silhouette

This is based on the current mount and the observed test adjustments:

- flipping `X` negative moved the weapon farther outward, away from the body
- changing `Z` moved the weapon up/down relative to how the hand grips it
- the local yaw rotation corrected the natural inward arm twist so the weapon sits more like a real held gun

### Practical Build Rule For Future Weapons

When building a new weapon mesh in Blender:

1. Treat the current cube as the grip block.
2. Put the handle where the cube is.
3. Extend the barrel along local `+Y`.
4. If the weapon sits too far into the body, move it toward `-X`.
5. If the handle floats too high or too low in the hand, adjust `Z`.

That should keep future weapon handles aligned with the current working runtime mount instead of re-discovering the same orientation by trial and error.

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
