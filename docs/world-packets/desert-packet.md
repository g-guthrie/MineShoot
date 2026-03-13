# Desert Biome Planning Packet

Use with [`world-planning-workflow.md`](/Users/gguthrie/Desktop/code%20bs/minecraft-fps/docs/world-planning-workflow.md) and [`world-planning-template.md`](/Users/gguthrie/Desktop/code%20bs/minecraft-fps/docs/world-planning-template.md).

## 1. Identity

- Biome name: Desert Escarpment
- Grid cell: `r0c2`
- Current biome id: `desert`
- Theme / fantasy: a giant eroded mesa corner that hides the north and east walls behind natural mass
- Perimeter wall being hidden: north and east walls
- Hero landmark: mega mesa crown in the northeast corner
- Secondary structures: east shelf band, north crumble band, rubble aprons, platform pockets, ruin accent
- One-sentence pitch: A massive corner mesa and broken cliff bands turn the desert into an eroded natural fortress that masks both perimeter walls without making the whole cliff fully playable.

## 2. Intent Sheet

### Fantasy Goal

The desert should feel like a collapsed canyon edge, with a towering mesa crown in the corner and long broken cliff fragments running down the east and north edges. It should read as old geology, not a constructed wall.

### Gameplay Goal

The biome should offer controlled shelf climbing and side-lane cover while leaving the southwestern half open enough for readable fights. Players should feel invited to push onto mid-height shelves, but denied from fully owning the summit.

### Skyline Goal

From the map center, the player should read:

1. the corner mesa crown
2. a descending east cliff band
3. a lower, more broken north crumble band

### Must-Haves

- giant corner mesa at waterfall-class scale
- east shelf route with limited playable landings
- lower, more broken north wall fragment

### Must-Not-Haves

- a flat straight cliff acting like a man-made wall
- a fully accessible summit that dominates adjacent biomes
- too many tiny props competing with the hero mass

### Playable vs Non-Playable

Playable:

- lower rubble apron
- selected shelf pockets
- east-side climb route
- one broken notch in the north wall

Skyline-only / non-playable:

- highest mesa crown
- rear cliff caps nearest the hidden walls
- most of the top ridge silhouette

## 3. Top-Down Gameplay Blueprint

### Legend

```text
M = mesa crown / major mass
E = east shelf route
N = north crumble band
P = playable shelf pocket
R = rubble apron / low cover
I = thin variable-height gap filler
A = west interior arch
O = south interior outcrop
X = blocked or skyline-only mass
. = open sand
```

### ASCII Blueprint

```text
North
      west                                              east
        0  1  2  3  4  5  6  7  8  9 10 11 12 13
  0 | .  .  N  N  N  N  I  N  M  M  M  I  M  X
  1 | .  .  .  N  I  N  N  .  M  M  I  M  X  X
  2 | .  .  .  .  .  .  .  P  I  M  M  X  I  E
  3 | .  .  .  .  .  .  .  P  P  M  I  X  E  E
  4 | .  .  A  .  .  .  .  .  P  .  .  I  E  E
  5 | .  .  A  .  .  .  .  .  .  .  .  E  E  E
  6 | .  .  A  .  .  .  r  .  .  P  .  E  E  E
  7 | .  .  .  .  .  .  .  .  .  .  .  .  .  .
  8 | .  .  .  .  .  .  .  .  .  .  .  .  O  .
  9 | .  .  .  .  .  .  .  .  .  .  .  O  O  .
 10 | .  .  F  .  .  .  .  .  .  D  O  O  O  .
 11 | .  .  .  .  .  .  .  .  .  .  .  .  .  .
 12 | .  .  t  .  .  .  D  .  .  .  .  C  .  .
 13 | .  .  .  .  .  .  .  .  .  .  .  .  .  .
South
```

### Route Notes

- Main route: rows `4-6`, cols `11-13`; east-side shelf climb toward the mid pockets
- Secondary route: rows `8-10`, cols `10-13`; south outcrop cover route along the interior edge
- Flank route: rows `4-6`, cols `2-3`; west-side arch cover route
- Risky route: direct open sand push through the center-left interior; fast, readable, lightly protected

### Cover Notes

- Thin vertical fillers should break mesa gaps without reading as uniform slop
- Shelf pockets should have built-in cover lips rather than random prop clutter
- The west arch and south outcrop should be the two biggest interior-edge reads outside the mesa system

### Traversal Notes

- The east shelf route should be the clearest climb path in the biome
- North wall access should be partial and broken, not a clean ascent line
- Players who reach a mid shelf should always have at least two escape choices back down or across

### Point Construction

- Mesa crown cluster:
  - main base flush to north/east wall
  - north spine offset west from corner
  - east spire flush to east wall
  - saddle bridging the major peaks
  - broken needle near the north edge
- Gap filler set:
  - 7 thin vertical seam fillers
  - variable heights from roughly `y 5-14`
  - mixed sandstone caps on selected fillers only
- Interior cover set:
  - west interior arch near `u:0.12 v:0.52`
  - south interior rock outcrop near `u:0.56 v:0.88`
- Ground clutter policy:
  - keep fossil ribs
  - remove broken fence
  - reduce bushes, rocks, dunes, tumbleweeds
  - favor fewer larger reads over many tiny props

## 4. Elevation / Silhouette Plan

### Main Elevation

```text
                           skyline-only crown
                          __________________
                         /   M M M M M M   /|
                ________/__________________/ |
               /    mid shelf / pocket    /  |
      ________/___________________________/   |
     /       broken cliff / buttress      /   |
____/____________________________________/____|
    rubble apron / open sand / low cover
```

### Height Bands

- Ground / apron: `y 0-2`
- Lower playable tier: `y 3-6`
- Mid playable tier: `y 7-12`
- Upper playable tier: `y 13-18` only in isolated shelf pockets
- Skyline-only tier: `y 19-30`
- Maximum height: `y 30`

### Silhouette Rules

- The corner crown must be the tallest point by a clear margin
- The east edge should read as a descending shelf band, not a second equal crown
- The north edge should read as more broken and lower than the east edge

### Reachability Rules

- Mid shelves are reachable through the east-side route and select rubble approaches
- The summit cap and rear crown silhouette remain non-playable
- No route should let players sit on the highest corner edge overlooking multiple biomes

## 5. Proxy Build Specification

### Anchors

- Primary anchor: mesa crown `u:0.90 v:0.18`, approx world `x:153.8 z:15.6`
- Secondary anchor: east shelf center `u:0.92 v:0.52`, approx world `x:154.6 z:29.8`
- Facing edge: north + east

### Major Pieces

#### Piece A

- Name: Corner Mesa Crown
- Type: hero mass / wall mask
- Local anchor `u,v`: `0.90, 0.18`
- Footprint: `18w x 16d`
- Height: `26-30`
- Collision: stepped solid mass with simplified shelf planes
- Traversal: no direct summit access; only partial upper shelf access
- Notes: this is the wall-hiding anchor and should occlude both hidden edges by itself

#### Piece B

- Name: East Shelf Band
- Type: climb route + structural wall
- Local anchor `u,v`: `0.92, 0.52`
- Footprint: `8w x 26d` split into chunks
- Height: `12-22`
- Collision: solid shelves and ramps with simple side faces
- Traversal: primary climb route with 2-3 controlled landings
- Notes: should be more traversable than the north band

#### Piece C

- Name: North Crumble Band
- Type: secondary wall fragment
- Local anchor `u,v`: `0.52, 0.16`
- Footprint: `20w x 8d`
- Height: `10-18`
- Collision: broken solid masses with one intentional notch
- Traversal: mostly visual, with one partial crossing point
- Notes: must feel slanted, fractured, and lower than the east band

#### Piece D

- Name: Rubble Apron + Platform Pockets
- Type: route kit
- Local anchor `u,v`: distributed
- Footprint: distributed nodes `2-6w`
- Height: `0.5-12`
- Collision: chunky low solids and a few flat pockets
- Traversal: supports toe movement, cover, and shelf transitions
- Notes: keep count restrained so the hero masses remain readable

### Spawn / Exclusion Notes

- Add a large exclusion around the corner crown so players never spawn inside the giant mass
- Add a stretched exclusion along the east shelf band if the climb route creates deep collision pockets
- Keep the southwest open field comparatively clear for spawn-safe circulation and combat reset

### Builder Breakdown

- `buildDesertCornerMesaCrown(...)`
- `buildDesertEastShelfBand(...)`
- `buildDesertNorthCrumbleBand(...)`
- `buildDesertRubbleApron(...)`
- `buildDesertPlatformPockets(...)`

## 6. Asset Breakdown

### Hero Assets

- corner mesa crown
- upper cliff cap silhouettes

### Modular Architecture

- cliff face segments
- shelf lip segments
- broken canyon wall chunks

### Route / Alley / Shelf Kit

- ramped shelf links
- climbable ledge chunks
- cover boulders / rubble piles

### Decor / Signage / Trim

- ruined arch accent
- cacti clusters
- bone / fossil accents
- sparse fence remains

### Collision-Only Pieces

- anti-climb summit caps
- simplified rear cliff blockers
- invisible shelf guards where silhouette geometry would otherwise be too climbable

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

- Decision: Make the east shelf band the primary climb route.
  Reason: It supports controlled vertical play without giving away the summit.
- Decision: Keep the north crumble band lower and more broken than the east band.
  Reason: The corner crown needs to remain the dominant silhouette.
- Decision: Preserve a cleaner open southwest area.
  Reason: The desert needs contrast between open combat space and sheltering cliff mass.
