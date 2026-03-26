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

For the current Boxman weapon mount, the working attachment is:

- bone: right lower arm (`arm_lowerR`)
- local offset: `x: -0.04`, `y: 0.65`, `z: -0.06`
- local rotation: `x: 0.08`, `y: 0.22`, `z: 0`
- the forearm mount lives on the bone, then the actual weapon model is positioned inside that mount
- the weapon model is lined up by `mount.position - handleBack`, so the back of the handle is the main hand reference, not the center of the receiver

Those values are not magical. They are just the offsets that make the gun sit in a believable place on the forearm without collapsing into the elbow area.

### Use The Current Handle-Back Reference

The current runtime should be treated as if the back of the weapon handle is the alignment target for future guns.

In plain terms:

- the forearm mount decides where the weapon lives relative to the arm
- inside that mount, the weapon's `handleBack` point is what gets lined up to the hand reference
- the receiver, barrel, stock, and other parts extend outward from that handle reference
- the muzzle anchor is driven by the weapon's `zones.muzzle` point and is also the normal local muzzle/tracer origin

That makes the mount a practical authoring guide for future weapon meshes:

- build the weapon so the back of the grip/handle is the thing you align to the hand
- build the barrel so it extends away from that handle reference toward the muzzle point
- keep the weapon parented to the same runtime forearm mount unless a later rig/socket replaces it

### What The Current Working Orientation Means

Right now the runtime applies these extra weapon-model rotations after the per-weapon stored mount rotation:

- extra `+90` degrees on `X`
- extra `0` degrees on `Y`
- extra `180` degrees on `Z`

So when authoring or debugging a weapon mesh for the current runtime:

- treat the handle-back point as the hand anchor
- treat the muzzle point as the barrel/shot origin reference
- expect the runtime to do the final `X/Z` turning needed to make the weapon sit correctly in hand
- do not assume the raw mesh forward axis in Blender is the final in-game forward axis without checking the runtime rotations above

### Practical Build Rule For Future Weapons

When building a new weapon mesh in Blender:

1. Put a clear handle-back reference at the back of the grip.
2. Put the muzzle reference at the real barrel exit point.
3. Keep the whole weapon authored around that handle-to-muzzle relationship.
4. Let the runtime forearm mount place the weapon in the hand.
5. If the weapon sits wrong in game, first check the runtime extra rotations and the `handleBack` / `muzzle` points before changing the forearm bone mount.

That should keep future weapons aligned with the current working runtime mount instead of re-discovering the same handle and muzzle alignment rules by trial and error.

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
