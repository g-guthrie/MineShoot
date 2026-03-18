# World Edge Redesign Plan

## Intent

Hide the current low perimeter wall behind biome-authored hero forms so each edge reads as part of the world itself rather than a hard arena cutoff.

The correct implementation path is not "LLM writes one giant final mesh in world coordinates." That is brittle and hard to iterate. The right path is:

1. Lock the concept and gameplay intent in cell-local coordinates.
2. Build a proxy/blockout pass in the current authored world code.
3. Validate sightlines, collision, spawn safety, and readability.
4. Replace stable proxy pieces with authored Blender assets or modular GLTF kits.

## Existing World Constraints

The repo uses a fixed 3x3 biome grid from [`shared/world-layout.js`](/Users/gguthrie/Desktop/code%20bs/minecraft-fps/shared/world-layout.js).

World grid:

```text
North

  [ Arctic ] [ Radar   ] [ Desert ]
  [ Jungle ] [ Citadel ] [ Nuclear]
  [ Quarry ] [ Wall St ] [ Urban  ]

South
```

Relevant biome bounds now use the full cell footprint from `quadrantBounds(...)`:

- Desert: `x:[110,164] z:[2,56]`
- Wall Street: `x:[56,110] z:[110,164]`
- Hidden perimeter walls sit just outside the playable span:
  - north wall near `z:2`
  - south wall near `z:164`
  - east wall near `x:164`

Implication:

- Desert is a corner biome and can use both its north and east borders as a giant L-shaped masking landmark.
- The `wall-street` cell is the south-edge finance biome: one massive south-facing hero facade with secondary buildings stepping inward.

## High-Level Strategy

Every perimeter biome should own a "foreground wall mask" layer with three jobs:

1. Occlude the ugly hard wall from normal player camera angles.
2. Feel biome-native and support traversal where useful.
3. Preserve readable combat lanes by keeping the deepest mass near the perimeter and tapering inward.

Design rule:

- Keep the hero mass within the outer 20-35% of the biome footprint.
- Let only selected lower shelves, stairs, balconies, and side entries be playable.
- Avoid fully playable rooflines on the tallest perimeter pieces unless the entire biome is built around that vertical combat promise.

## Recommended Production Workflow

### Phase A: Design Packet

For each biome landmark, define:

- normalized anchor: biome-local `u,v`
- world-facing edge: `north`, `south`, `east`, `west`
- footprint: width/depth in world units
- top height in world units
- collision profile: solid / partial / decorative
- traversal surfaces
- sightline blockers
- replacement plan: proxy-only or future Blender asset

### Phase B: Blockout in Code

Use the existing imperative world builder pattern in [`js/world/quadrant-desert.js`](/Users/gguthrie/Desktop/code%20bs/minecraft-fps/js/world/quadrant-desert.js) and [`js/world/quadrant-wall-street.js`](/Users/gguthrie/Desktop/code%20bs/minecraft-fps/js/world/quadrant-wall-street.js).

Blockout pass goals:

- silhouette first
- collision second
- material differentiation third
- decorative clutter last

Blockout pieces should be broken into reusable sub-builders instead of one monolith:

- `buildPerimeterMesaWall(...)`
- `buildDesertRubbleApron(...)`
- `buildToonTowerPodium(...)`
- `buildToonStreetFacade(...)`
- `buildFinanceAlley(...)`

### Phase C: Gameplay Validation

Check:

- spawn exclusions
- choke width
- climb exploits
- sniper dominance from perimeter ledges
- whether the hidden hard wall is still visible from jump peaks

### Phase D: Art Replacement

Once the proxy shape is proven:

- keep collision on simple invisible block volumes
- replace visible sections with authored GLTF chunks
- preserve the same anchors and approximate footprints

That separation avoids collision regressions when visual assets change.

## Landmark Scale Calibration

Current reference landmarks:

- Jungle waterfall lip is roughly `25.9` world units tall in [`js/world/quadrant-jungle.js`](/Users/gguthrie/Desktop/code%20bs/minecraft-fps/js/world/quadrant-jungle.js).
- Citadel apex is roughly `15.7` world units tall in [`js/world/quadrant-citadel.js`](/Users/gguthrie/Desktop/code%20bs/minecraft-fps/js/world/quadrant-citadel.js).

Recommended new targets:

- Desert mega-mesa peak: `24-30` units tall
- Desert perimeter cliff band: `16-24` units tall
- Wall Street exchange podium/lobby roof: `18-24` units tall
- Wall Street CEO tower total height: `65-78` units tall

That keeps the desert wall in the same hero class as the waterfall, while the Wall Street tower becomes the unmatched skyline piece the user described.

## Desert Concept: Mega Mesa Corner Wall

### Design Goal

Turn the desert corner into an L-shaped natural fortress:

- highest mass in the northeast corner
- mesa shelf riding down the east border
- crumbling canyon wall tapering along the north border
- rubble fans and playable shelf fragments extending inward

This should feel like a collapsed desert escarpment, not a neat fortress wall.

### Gameplay Goal

- hard-occlude the north and east perimeter walls
- give players a few mid-height shelf positions
- deny full top access to the highest mesa crown
- keep the southwestern half of the biome readable for movement and fights

### Desert Placement Plan

- Primary hero mass anchors to biome-local `u:0.83-0.98`, `v:0.06-0.34`
- East wall shelf band runs from `v:0.12` to `v:0.78`
- North crumble band runs from `u:0.22` to `u:0.78`
- Playable toe shelves should live mostly around `u:0.58-0.82`, `v:0.28-0.62`

### Desert Structure Stack

1. Corner mesa crown
   - tallest piece
   - broad top silhouette
   - unplayable summit
2. East shelf run
   - stepped cliffs and ledges
   - 1-2 playable shelf landings
3. North crumble wall
   - broken, lower, more fragmented
   - reads as erosion, not symmetry
4. Rubble apron
   - low cover and slope breakup
5. Existing small props
   - cacti, bones, minor arches, bushes
   - rebalanced so they support the new cliff language instead of competing with it

### Desert Asset Specifications

#### D1. Corner Mesa Crown

- Type: hero mass, likely proxy first then Blender replacement
- Footprint: `16-20w x 14-18d`
- Height: `26-30`
- Position: northeast corner, offset inward enough to sit in front of the hard wall
- Shape: 3-4 major stacked terraces, slightly leaning inward toward biome center
- Top: broad cap with broken rear silhouette against sky
- Access: no direct route to summit
- Traversal: one partial shelf at roughly `y:8-10`, another at `y:13-15`
- Collision: simple stepped solid blocks, not exact visual collision

#### D2. East Shelf Band

- Type: secondary structural wall
- Footprint: long strip broken into 3 chunks
- Height: `12-22`
- Position: east edge from northeast corner downward
- Shape: alternating buttresses and recessed cuts
- Access: lower shelves only
- Traversal: two reachable landings connected by ramps/jumps
- Combat role: side lane cover and anti-wall occlusion

#### D3. North Crumble Band

- Type: secondary wall fragment
- Height: `10-18`
- Position: north edge, starting left of the corner mass
- Shape: more ruined and slanted than the east shelf band
- Traversal: one broken arch pass-through or notch
- Combat role: stops players from seeing the top wall on approach from center/northwest angles

#### D4. Rubble Aprons

- Type: gameplay cover set
- Height: `0.5-5`
- Placement: toe of east and north wall pieces
- Shape: fans, split boulders, collapsed shelf chunks
- Traversal: safe stepping stones; no snaggy micro-collision

#### D5. Desert Platform Pockets

- Type: intentional playable spots
- Count: `3-5`
- Size: `2.5-5.5` units wide
- Heights:
  - low pockets at `y:3-5`
  - mid pockets at `y:7-10`
  - optional high pocket at `y:12-14`
- Rule: every pocket needs at least two readable approach/escape paths

## Wall Street Concept: Toontown Finance District

### Design Goal

Replace the old flood-control concept with a giant toon-finance district:

- absurd CEO tower on the south wall
- giant formal lobby and stairs facing inward
- flanking finance buildings creating canyon alleys
- Wall Street cues pushed through Toontown exaggeration

Reference blend:

- Toontown cog/boss satire
- white-column financial facades
- deep canyon-like alleys
- impossibly tall central spire

### Gameplay Goal

- hide the south perimeter wall completely
- create one dominant centerline approach to the tower stairs
- provide flank alleys west and east
- keep lower floors and stairs playable
- keep upper tower shaft mostly non-playable

### Wall Street Placement Plan

- CEO tower sits centered on the south edge, biome-local `u:0.50`, `v:0.86-0.98`
- Grand stairs project north to about biome-local `v:0.62`
- West finance block occupies `u:0.16-0.34`, `v:0.52-0.84`
- East finance block occupies `u:0.66-0.84`, `v:0.50-0.82`
- Alley slots run north-south between the side buildings and the center stair axis

### Wall Street Structure Stack

1. NYSE-style exchange frontage
   - huge front read
   - white columns, giant stairs, pediment/slanted roof, over-scaled doors
2. CEO lobby and podium mass
   - set directly behind or fused into the exchange frontage
   - broad enough to hide the south wall by itself
3. Impossible tower shaft
   - very thin relative to podium
   - rises far past every other biome silhouette
4. Spire and cog crown
   - skyline read from across map
5. Side buildings
   - 2-4 shorter buildings
   - slightly crooked, stylized, dense
6. Alley layer
   - narrow canyons, signage, service doors, vault vents, lamp posts

### Wall Street Asset Specifications

#### W1. NYSE-Style Exchange Frontage

- Type: hero facade / wall mask
- Footprint: `20-28w x 8-12d`
- Height: `16-22`
- Position: centered on south wall
- Front read: giant staircase, tall white columns, oversized doorway, triangular pediment, slanted roofline
- Shape notes:
  - broad stair rising to a columned portico
  - pediment should read clearly from the biome center
  - roof should feel like a toon-exaggerated stock exchange front, not a flat office slab
- Playability:
  - stair landings playable
  - front terrace playable
  - top pediment roof should usually be non-playable
- Collision: broad simple planes for stairs, terrace, and facade base

#### W2. CEO Podium / Lobby Block

- Type: hero structural mass behind frontage
- Footprint: `18-24w x 10-14d`
- Height: `18-24`
- Position: centered on south wall, fused into the exchange frontage
- Front read: deep lobby recess, giant doors, tall window bands, big forecourt threshold
- Playability:
  - stair landings playable
  - front terrace playable
  - roof edge optional only if combat feels fair
- Collision: broad simple planes for terrace and podium

#### W3. CEO Tower Shaft

- Type: skyline hero
- Footprint: `6-10w x 6-10d` above podium
- Height: `65-78`
- Shape: slightly tapered or stacked setbacks so it stays readable
- Visual rhythm: windows, cog motifs, decorative bands every `8-12` units
- Playability: mostly decorative and non-reachable
- Critical rule: do not make the shaft collision overly detailed

#### W4. Spire / Crown

- Type: skyline topper
- Height contribution: `8-14`
- Shape options:
  - toothed cog halo around the upper shaft
  - bent gold spire
  - satirical banker emblem
- Role: silhouette identity, not gameplay

#### W5. Grand Stair Set

- Type: main approach gameplay piece
- Width: `12-18`
- Depth projection: `6-10`
- Height gain: `4-7`
- Landing count: `2-3`
- Combat role: frontal risk/reward path with clear cover edges
- Design note: the stair set should terminate into the exchange portico, not directly into the tower shaft

#### W6. West Finance Block

- Type: flank building
- Footprint: `8-12w x 10-16d`
- Height: `14-22`
- Style: chunky Wall Street annex with toon distortion
- Features: cornice, service alley, maybe a vault intake or ticker sign
- Playability: first roof or balcony may be reachable; top roof should be limited

#### W7. East Finance Block

- Type: flank building
- Footprint: `8-12w x 10-16d`
- Height: `12-18`
- Style: brokerage / annex building that visually reinforces the exchange frontage
- Features: tall windows, sign plinth, side stairs, alley choke, optional mini pediment or ticker board
- Playability: similar to west block

#### W8. Alley Kit

- Type: reusable secondary set
- Pieces:
  - side stairs
  - archways
  - service doors
  - AC / vent / pipe blocks
  - signs and marquee brackets
  - planter / bollard cover
- Width target: `3.5-6`
- Rule: each alley needs a clean combat line and one pocket cover node

#### W9. Toon-Finance Detail Kit

- Type: purely decorative overlays
- Pieces:
  - giant cog medallions
  - fake ticker bands
  - comically large vault wheel
  - gold trim bands
  - exaggerated clocks
  - satirical banker insignia
- Collision: none unless large enough to matter

## Visual Language Rules

### Desert

- large simple reads first
- warm mesa orange and sandstone tan
- dark rock only for fracture lines and contrast
- avoid over-detailing the skyline edge

### Wall Street / Toontown Finance

- exaggerated proportions
- exchange facade first, then podium, then thin absurd tower
- financial architecture cues must read instantly from medium distance
- NYSE-style columns and pediment must be readable from the main approach
- stylization should come from shape and proportion first, not texture noise

## Gameplay Guardrails

Apply these before any final art pass:

- no single perch should dominate the biome center and adjacent seam simultaneously
- if a platform is reachable, there must be a non-degenerate way back down
- hero structures should stay out of spawn-safe lanes
- decorative collision should never create ankle-high snag fields

## Build Sequence Recommendation

1. Desert proxy wall first
2. Wall Street proxy conversion second
3. Re-run ASCII map generation only after implementation
4. Playtest sightlines and hidden-wall coverage
5. Replace the proven proxies with authored asset kits

Reason:

- Desert is simpler and teaches the perimeter-wall masking pattern.
- Wall Street is the higher-risk biome because of the extreme tower scale and alley complexity.

## What To Build Later

When you want to move from plan to implementation, the next practical deliverable should be:

1. a proxy geometry pass in the existing quadrant builders
2. updated spawn exclusions
3. a quick camera sweep verifying the perimeter wall is never visible in normal traversal

Only after that should we invest in final mesh authoring.
