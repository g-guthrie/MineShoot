# Feature Spec: Minecraft-Style FPS Hitscan Game

## Overview

Build a browser-based first-person shooter with Minecraft-style voxel graphics. The game features hitscan shooting mechanics where raycast bullets hit instantly (no projectile travel time). Characters have hitboxes that are **2x the visual size** of the character model, making them easier to hit.

## Core Requirements

### 1. Rendering & World
- 3D voxel/blocky Minecraft aesthetic using Three.js
- Simple flat terrain (grass-textured ground plane, ~50x50 blocks)
- Skybox or solid sky-blue background
- A few scattered block structures (walls, pillars) for cover
- First-person camera with mouselook (pointer lock)

### 2. Player
- WASD movement + Space to jump
- Mouselook for aiming (pointer lock API)
- Crosshair overlay in center of screen
- Blocky Minecraft-style arms/weapon visible in first person (simple box geometry)
- Health bar UI (100 HP)

### 3. Enemy Characters
- 3-5 blocky humanoid enemies (Minecraft Steve-style: box head, box body, box limbs)
- Each enemy is approximately 1 unit wide x 2 units tall x 1 unit deep (visual model)
- **Hitbox is 2x the visual size**: 2 units wide x 4 units tall x 2 units deep
- Enemies wander randomly, pausing occasionally
- Enemies have health (50 HP), show damage flash (red tint) when hit
- Enemies despawn/ragdoll when health reaches 0

### 4. Hitscan Shooting
- Left click to shoot
- Instant raycast from camera center (hitscan — no bullet travel)
- Ray checks against enemy HITBOXES (the 2x oversized invisible box), NOT the visual mesh
- Visual feedback: muzzle flash, hit marker on crosshair, damage number popup
- Fire rate: ~3 shots per second (cooldown 333ms)
- Damage: 25 per hit (2 shots to kill an enemy)

### 5. Hitbox System (KEY FEATURE)
- Each enemy has TWO collision volumes:
  - **Visual mesh**: The rendered character model (normal size)
  - **Hitbox**: An invisible Box3/BoxHelper that is exactly 2x the dimensions of the visual mesh, centered on the character
- The hitbox should be toggleable (press H to show/hide wireframe hitboxes for debugging)
- Raycasts for shooting ONLY check the hitbox, not the visual mesh

### 6. UI / HUD
- Crosshair (simple + shape, centered)
- Health bar (bottom left)
- Ammo/shot indicator (bottom right)  
- Kill counter (top right)
- Hit marker animation (brief X flash on crosshair when hitting enemy)
- Damage numbers floating up from hit enemies

### 7. Game Loop
- Enemies respawn after 5 seconds at random positions
- No win/lose condition — infinite practice arena
- Simple score counter for kills

## Tech Stack
- **HTML5 + CSS** for the page and HUD overlay
- **Three.js** (via CDN) for 3D rendering
- **Vanilla JavaScript** — no build tools, no npm, just .html + .js files
- Must work by opening index.html in a browser (no server required)

## File Structure
```
index.html          — Entry point, loads scripts, contains HUD HTML/CSS
js/
  main.js           — Game init, render loop, pointer lock
  player.js         — Player movement, camera, shooting
  enemy.js          — Enemy class (model + hitbox + AI)
  world.js          — Terrain and structures
  hitscan.js        — Raycasting and hit detection against hitboxes
  ui.js             — HUD updates, damage numbers, hit markers
```

## Acceptance Criteria
- [ ] Game loads in browser by opening index.html
- [ ] WASD + mouselook movement works
- [ ] Left click fires hitscan ray
- [ ] Enemies have visible blocky Minecraft-style models
- [ ] Hitboxes are 2x the visual size (verifiable by pressing H)
- [ ] Hits register on the oversized hitbox, not the visual mesh
- [ ] Damage numbers appear on hit
- [ ] Enemies die after 2 hits (50 HP, 25 damage per shot)
- [ ] Enemies respawn after death
- [ ] Kill counter increments
- [ ] No console errors
