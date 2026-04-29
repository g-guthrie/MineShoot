# Audio Sources

Runtime weapon and movement samples in `public/assets/audio` come from two local source sets.

Current weapon fire samples are restored from the prior CC0 OpenGameArt set:

- `22 Pistol.wav` -> `weapons/pistol.mp3`
- `22 Magnum.wav` -> `weapons/sniper.mp3`
- `Black Powder.wav` -> `weapons/shotgun.mp3`
- `Unkown.wav` -> `weapons/rifle.mp3`

The current footstep and jump samples are local extracts from:

- `/Users/gguthrie/Downloads/KickAssDuke_1_2/KADuke_Data.zip`

Mapped source files:

- `sounds/step_concrete.wav` -> `movement/footstep-concrete.ogg`
- `sounds/vs_jump1.ogg` -> `movement/jump.ogg`

Processing applied locally with `ffmpeg`:

- Trimmed weapon fire samples to browser-game one-shots.
- Converted copied WAV files to browser-playable MP3 or OGG files.
- Added short fade-outs to avoid abrupt clip ends.
