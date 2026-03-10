# Audio Sources

Weapon fire samples in [`public/assets/audio/weapons`](/Users/gguthrie/Desktop/code%20bs/minecraft-fps/public/assets/audio/weapons) are derived from OpenGameArt assets marked `CC0 1.0`, which allows redistribution and modification without attribution.

Source page:
- [Gunshots by kevinkace](https://opengameart.org/content/gunshots)

Original download URLs used:
- `22 Pistol.wav` -> `pistol.mp3`
- `22 Magnum.wav` -> `sniper.mp3`
- `Black Powder.wav` -> `shotgun.mp3`
- `Unkown.wav` -> `rifle.mp3`

Processing applied locally with `ffmpeg`:
- Trimmed each recording to a single-shot segment.
- Converted stereo `wav` files to mono `mp3` files at `44.1 kHz`.
- Added a short fade-out to avoid abrupt clip ends.
