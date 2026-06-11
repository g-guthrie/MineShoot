# Third-Party Licenses

## Quaternius asset packs (CC0)

The following assets are by Quaternius, released under CC0 1.0 Universal
(public domain) — https://creativecommons.org/publicdomain/zero/1.0/ —
no attribution required; credit given with thanks:

- `public/assets/characters/toon-shooter/` (Character_Soldier,
  Character_Enemy, Character_Hazmat): "Toon Shooter Game Kit",
  https://quaternius.com/packs/toonshootergamekit.html
- `public/assets/weapons/animated/` (P90, Pistol, Revolver, Rifle,
  Shotgun, SniperRifle; converted FBX -> GLB, recolored by material
  name): "Animated FPS Guns" pack,
  https://quaternius.com/packs/animatedguns.html

## HYTOPIA game engine and example games

Portions of MineShoot's combat presentation behavior are adapted from the
MIT-licensed HYTOPIA game engine monorepo and its example games
(`hygrounds`, `zombies-fps`):

- Source: https://github.com/hytopiagg/hytopia-source
- License: MIT License
- Copyright © 2026 HYTOPIA, Inc

Adapted behavior includes the 35ms muzzle-flash blink, the deterministic
7-pellet shotgun spread pattern (center plus ring), the 100ms red tint
flash on damaged players, and hurt audio with per-hit pitch variation of
-200 to +600 cents. The adaptation is a rewrite against MineShoot's own
engine; no HYTOPIA art, audio, or model assets are included. (HYTOPIA's
separate `assets` and `sdk` repositories are platform-exclusive and are
not used.)

The MIT License (MIT)

Copyright © 2026 HYTOPIA, Inc

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

## HYTOPIA hygrounds example (MIT)

The game in `hytopia-game/` is adapted from the MIT-licensed "hygrounds"
example in the HYTOPIA engine monorepo
(https://github.com/hytopiagg/hytopia-source, Copyright (c) 2026
HYTOPIA, Inc), with a custom generated three-biome map. It targets the
HYTOPIA platform, where HYTOPIA's game assets are licensed for use.
