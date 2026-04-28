# Wall Street Biome Planning Packet

Use with [`world-planning-workflow.md`](/Users/gguthrie/Desktop/code%20bs/minecraft-fps/docs/world-planning-workflow.md) and [`world-planning-template.md`](/Users/gguthrie/Desktop/code%20bs/minecraft-fps/docs/world-planning-template.md).

## 1. Identity

- Biome name: Wall Street
- Grid cell: `r2c1`
- Theme / fantasy: cold toon-finance Wall Street, with a hostile corporate district built against the south wall
- Perimeter wall being hidden: south wall
- Hero landmark: CEO tower rising out of a NYSE-style exchange frontage
- Secondary structures: west annex, east brokerage block, south shoulder offices, archways, alley cover, ticker boards, vault doors
- One-sentence pitch: A giant stock-exchange facade and impossible CEO tower turn the south-center slot into a cold satirical Wall Street canyon that hides the south perimeter wall without the old Toontown color language.

### Exact Edge Math

- Current cell bounds: `x:[56,110] z:[110,164]`
- Current cell centerline: `x:83 z:137`
- South perimeter wall strip from [`buildBiomePerimeter(...)`](/Users/gguthrie/Desktop/code%20bs/minecraft-fps/shared/world-layout.js) sits just beyond the cell at roughly `z:164.6`
- CEO tower target height is capped at roughly `y:70`

## 2. Intent Sheet

### Fantasy Goal

Wall Street should feel like a cartoon financial district where capitalism became architecture, but the cartoon read comes from shape instead of candy color: oversized stairs, tall cold-white columns, a triangular pediment, impossible tower height, dark green glass, charcoal asphalt, and side buildings pressing inward around the player.

### Gameplay Goal

The biome should play as a frontal siege with flank alleys. Players can push the center stair axis into the exchange portico, or wrap through left and right alley corridors to attack the forecourt from side angles.

### Skyline Goal

From the center of the map, the player should read three layers in order:

1. giant exchange facade
2. broad lobby / podium
3. absurd CEO tower with crown

### Must-Haves

- NYSE-style frontage with columns, giant stair, and pediment/slanted roof
- tall CEO tower that is mostly skyline, not playable space
- two flank buildings creating alley pressure
- cold asphalt/concrete/green-glass palette with brass only as trim

### Must-Not-Haves

- a flat office slab replacing the exchange facade
- fully playable tower shaft or roof stack
- messy collision clutter in alleys or at stair edges
- warm tan plaza, pastel signs, bus stops, planters, or decorative prop spam from the old Toontown version

### Playable vs Non-Playable

Playable:

- center stair and terrace
- exchange portico threshold
- west and east alleys
- one low roof or balcony on each side block

Skyline-only / non-playable:

- upper tower shaft
- crown / spire
- top pediment roof
- deep rear mass near the south perimeter

## 3. Top-Down Gameplay Blueprint

### Legend

```text
M = main push / stair route
L = west flank route
R = east flank route
C = cover cluster
F = exchange frontage
P = podium / lobby mass
T = CEO tower shaft
W = west finance block
E = east finance block
X = blocked or skyline-only mass
. = open space
```

### ASCII Blueprint

```text
North
      west                                              east
        0  1  2  3  4  5  6  7  8  9 10 11 12 13
  0 | .  .  .  .  .  .  .  .  .  .  .  .  .  .
  1 | .  .  .  .  .  .  .  .  .  .  .  .  .  .
  2 | .  .  .  .  .  .  C  C  .  .  .  .  .  .
  3 | .  .  W  W  W  L  C  C  R  E  E  E  .  .
  4 | .  .  W  W  W  L  .  .  R  E  E  E  .  .
  5 | .  .  W  W  W  L  M  M  R  E  E  E  .  .
  6 | .  .  W  W  W  L  M  M  R  E  E  E  .  .
  7 | .  .  W  W  W  L  M  M  R  E  E  E  .  .
  8 | .  .  W  W  L  M  M  M  M  R  E  E  .  .
  9 | .  .  .  L  L  F  F  F  F  R  R  .  .  .
 10 | .  .  .  L  P  P  T  T  P  P  R  .  .  .
 11 | .  .  .  .  P  P  T  T  P  P  .  .  .  .
 12 | .  .  .  .  X  X  T  T  X  X  .  .  .  .
 13 | .  .  .  .  X  X  T  T  X  X  .  .  .  .
South
```

### Route Notes

- Main route: rows `5-10`, cols `5-8`; broad stair push into the exchange portico
- Secondary route: rows `3-10`, cols `3-5`; west alley wrap toward the forecourt
- Flank route: rows `3-10`, cols `8-10`; east alley wrap with slightly cleaner sightlines
- Risky route: direct open approach through rows `2-5`, cols `6-7`; fastest line but most exposed

### Cover Notes

- Keep the center approach open until the stairs; cover belongs on the side lanes and stair lips
- Alley cover should alternate hard corner and pocket cover instead of forming a continuous maze
- Stair cover should be built into landings and side lips, not freestanding clutter

### Traversal Notes

- The main stair should offer 2-3 landings with clean transitions and no snaggy trim collision
- Each side block gets one reachable low balcony or roof edge, but not a dominant sniper roof
- The portico threshold can support short elevation play, but the player should not climb through the facade onto the roofline

## 4. Elevation / Silhouette Plan

### Main Elevation

```text
                         crown / emblem
                            /\
                           /  \
                          / TT \
                         / TTTT \
                        / TTTTTT \
                 ______/__________\______
                |         P P        |
                |    P    P P    P   |
         _______|____________________|_______
        /   F     F     F     F     F      /|
       /__________________________________/ |
      /_M___M___M___M___M___M___M___M____/  |
         main stair / terrace / portico
```

### Height Bands

- Ground / apron: `y 0-1`
- Lower playable tier: `y 1-7`
- Mid playable tier: `y 8-16`
- Upper playable tier: `y 17-20` only on selected side-block balcony edges or podium lip if proven safe
- Skyline-only tier: `y 21-52`
- Maximum height: `y 52`

### Silhouette Rules

- The exchange facade must be wider than the tower shaft so the tower feels planted, not flimsy
- The pediment must read as a strong triangular cap from the center-map approach
- The tower should taper or step back as it rises so the skyline stays legible

### Reachability Rules

- Players can reach the stair, terrace, portico threshold, and selected side-building upper edges
- Players should not reach the upper tower shaft, crown, or rear south-edge roof mass
- Any optional podium roof access must still keep the tower shaft itself non-climbable

## 5. Proxy Build Specification

### Anchors

- Primary anchor: exchange center `u:0.50 v:0.84`, exact world `x:83 z:155.36`
- Secondary anchor: west block center `u:0.21 v:0.66`, exact world `x:67.34 z:145.64`
- Facing edge: south

### Major Pieces

#### Piece A

- Name: Exchange Frontage
- Type: hero facade / wall mask
- Local anchor `u,v`: `0.50, 0.88`
- Footprint: `24w x 10d`
- Height: `18-22`
- Collision: broad solid stair, terrace, facade base; roofline mostly non-colliding or blocked
- Traversal: center stair and terrace playable
- Notes: columns and pediment are visual identity; the facade must hide the south wall even from slight jump angles

#### Piece B

- Name: CEO Podium + Tower Core
- Type: hero structural stack
- Local anchor `u,v`: `0.50, 0.94`
- Footprint: podium `20w x 12d`, tower `8w x 8d`
- Height: podium `18-24`, tower `65-78`
- Collision: simple podium shell; tower shaft minimal collision
- Traversal: podium lip optional; tower shaft non-playable
- Notes: tower reads as skyline payoff behind the exchange, not a front-loaded box

#### Piece C

- Name: West Annex
- Type: flank building
- Local anchor `u,v`: `0.24, 0.66`
- Footprint: `10w x 14d`
- Height: `16-22`
- Collision: simple building shell with one balcony lip
- Traversal: west alley entry and one reachable upper edge
- Notes: slightly bulkier than east block; can carry a vault intake or satirical banker signage

#### Piece D

- Name: East Brokerage Block
- Type: flank building
- Local anchor `u,v`: `0.76, 0.64`
- Footprint: `10w x 14d`
- Height: `14-18`
- Collision: simple shell with one reachable side stair or balcony
- Traversal: east alley route and one upper pocket
- Notes: cleaner facade language, optional ticker board, should visually echo the exchange frontage

#### Piece E

- Name: Plaza Cover + Alley Kit
- Type: route kit
- Local anchor `u,v`: distributed
- Footprint: cover nodes `1-4w`, alley width `4-6`
- Height: `1-4`
- Collision: simple solid cover chunks
- Traversal: keeps both flank alleys legible and fair
- Notes: no dense prop spam; every cover cluster must support a route decision

### Spawn / Exclusion Notes

- Add a large exclusion around the exchange stairs and podium core so players do not spawn into the main spectacle space
- Add smaller exclusions for side-block interiors if proxy shells become thick enough to trap spawn checks
- Keep the northern third of the biome comparatively open for spawn-safe circulation and sightline reset

### Builder Breakdown

- `buildWallStreetExchangeFrontage(...)`
- `buildWallStreetPodiumAndTower(...)`
- `buildWallStreetSideBlock(...)`
- `buildWallStreetAlleyKit(...)`
- `buildWallStreetPlazaCover(...)`

## 6. Asset Breakdown

### Hero Assets

- NYSE-style exchange facade
- CEO tower crown / emblem / spire

### Modular Architecture

- column module
- pediment edge / roofline module
- podium wall / window band module
- side-building facade modules

### Route / Alley / Shelf Kit

- stair landings
- alley corner pieces
- balcony lips
- terrace edge cover

### Decor / Signage / Trim

- ticker boards
- brass corporate medallions
- vault wheel details
- clocks, signs, trim bands, lamp posts

### Collision-Only Pieces

- simplified podium shell
- blocked roof wedges behind facade
- invisible anti-climb caps on tower setbacks

## 7. Review Checklist

- [x] Fantasy is clear in one sentence.
- [x] Wall-masking target is explicit.
- [x] Hero landmark is explicit.
- [x] Top-down routes are readable.
- [x] Height composition is defined.
- [x] Playable vs skyline-only areas are separated.
- [x] Proxy pieces are named.
- [x] Spawn exclusions are noted.
- [x] Asset needs are separated from proxy needs.

## 8. Decision Log

- Decision: Put the exchange facade in front of the podium instead of exposing the podium directly.
  Reason: The facade is the biome identity and the best wall-masking front mass.
- Decision: Keep the CEO tower mostly non-playable.
  Reason: The tower should be skyline payoff, not an all-dominating vertical combat exploit.
- Decision: Give each side block one limited upper playable edge.
  Reason: The biome needs vertical variation, but not enough to overpower the central push.
