# Audio Sources

Runtime weapon and movement samples in `public/assets/audio` come from two local source sets.

Current weapon fire samples are restored from the prior CC0 OpenGameArt set:

- `22 Pistol.wav` -> `weapons/pistol.mp3`
- `22 Magnum.wav` -> `weapons/sniper.mp3`
- `Black Powder.wav` -> `weapons/shotgun.mp3`
- `Unkown.wav` -> `weapons/rifle.mp3`

The current footstep sample is a local extract from:

- `/Users/gguthrie/Downloads/KickAssDuke_1_2/KADuke_Data.zip`

Mapped source files:

- `sounds/step_concrete.wav` -> `movement/footstep-concrete.ogg`

Current jump and movement-wind samples are CC0 OpenGameArt downloads:

- `air_move.wav` by Almitory -> `movement/jump.ogg`
- `wind woosh loop.ogg` by SketchMan3 -> `movement/wind-woosh-loop.ogg`

Processing applied locally with `ffmpeg`:

- Trimmed weapon fire samples to browser-game one-shots.
- Trimmed the jump whoosh to a 0.46s takeoff cue, removed the quiet lead-in so the peak lands near 90ms, filtered rumble/ultrahighs, and faded the tail.
- Re-encoded the wind whoosh loop to a smaller browser-playable OGG.
- Converted copied source files to browser-playable MP3 or OGG files.
- Added short fade-outs to avoid abrupt clip ends.
