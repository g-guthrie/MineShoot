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
