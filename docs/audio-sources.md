# Audio Sources

Runtime weapon and movement samples in `public/assets/audio` come from two local source sets.

The current auto rifle, hand cannon, sniper, footstep, and jump samples are local extracts from:

- `/Users/gguthrie/Downloads/KickAssDuke_1_2/KADuke_Data.zip`

Mapped source files:

- `sounds/deagle_fire.ogg` -> `weapons/hand-cannon.ogg`
- `sounds/HMG_fire.ogg` -> `weapons/auto-rifle.ogg`
- `sounds/sniper_fire.wav` -> `weapons/sniper-fire.ogg`
- `sounds/step_concrete.wav` -> `movement/footstep-concrete.ogg`
- `sounds/vs_jump1.ogg` -> `movement/jump.ogg`

The current scout rifle and shotgun samples were restored from the prior CC0 OpenGameArt set:

- `Unkown.wav` -> `weapons/rifle.mp3`
- `Black Powder.wav` -> `weapons/shotgun.mp3`

Processing applied locally with `ffmpeg`:

- Trimmed weapon fire samples to browser-game one-shots.
- Converted copied WAV files to browser-playable MP3 or OGG files.
- Added short fade-outs to avoid abrupt clip ends.
