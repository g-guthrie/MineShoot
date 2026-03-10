# Blender Asset Pipeline

This repo already loads glTF weapon models from `public/assets/models/weapons`.

The missing piece was a repeatable Blender export path. Use the wrapper below instead of exporting by hand from the UI each time.

## Prerequisite

Blender must resolve on your shell `PATH`.

Check it with:

```sh
Blender --version
```

## Export a weapon from Blender

Export a collection named `Weapon` from a `.blend` file into the repo:

```sh
./scripts/blender-export.sh ~/Downloads/pistol.blend public/assets/models/weapons/pistol.gltf --collection Weapon
```

Export a single object instead:

```sh
./scripts/blender-export.sh ~/Downloads/rifle.blend public/assets/models/weapons/rifle.gltf --object Rifle
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
- For current weapon assets, prefer `.gltf` when you want to stay aligned with the existing loader URLs.
- When exporting `.gltf`, commit the matching `.bin` file that Blender writes next to it.
- Use `.glb` only if you also update the runtime asset URL and loader expectations accordingly.
- Re-export into the final repo path so the runtime URL stays stable.

## NPM shortcut

You can also call the wrapper through npm:

```sh
npm run blender:export -- ~/Downloads/pistol.blend public/assets/models/weapons/pistol.gltf --collection Weapon
```
