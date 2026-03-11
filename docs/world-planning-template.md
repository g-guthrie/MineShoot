# Biome Planning Packet Template

Use this template with the workflow in [`docs/world-planning-workflow.md`](/Users/gguthrie/Desktop/code%20bs/minecraft-fps/docs/world-planning-workflow.md).

Fill out one packet per biome or major biome overhaul.

---

## 1. Identity

- Biome name:
- Grid cell:
- Current biome id:
- Theme / fantasy:
- Perimeter wall being hidden:
- Hero landmark:
- Secondary structures:
- One-sentence pitch:

## 2. Intent Sheet

### Fantasy Goal

Describe what the biome should feel like.

### Gameplay Goal

Describe the primary combat and movement promise.

### Skyline Goal

Describe what should read from distance.

### Must-Haves

- 
- 
- 

### Must-Not-Haves

- 
- 
- 

### Playable vs Non-Playable

Playable:

- 
- 

Skyline-only / non-playable:

- 
- 

## 3. Top-Down Gameplay Blueprint

### Legend

```text
R = main route
F = flank route
C = cover cluster
H = hero mass
S = stairs / ramp
A = alley / shelf route
X = non-playable or blocked mass
. = open space
```

### ASCII Blueprint

```text
North
      west                                              east
        0  1  2  3  4  5  6  7  8  9 10 11 12 13
  0 | .  .  .  .  .  .  .  .  .  .  .  .  .  .
  1 | .  .  .  .  .  .  .  .  .  .  .  .  .  .
  2 | .  .  .  .  .  .  .  .  .  .  .  .  .  .
  3 | .  .  .  .  .  .  .  .  .  .  .  .  .  .
  4 | .  .  .  .  .  .  .  .  .  .  .  .  .  .
  5 | .  .  .  .  .  .  .  .  .  .  .  .  .  .
  6 | .  .  .  .  .  .  .  .  .  .  .  .  .  .
  7 | .  .  .  .  .  .  .  .  .  .  .  .  .  .
  8 | .  .  .  .  .  .  .  .  .  .  .  .  .  .
  9 | .  .  .  .  .  .  .  .  .  .  .  .  .  .
 10 | .  .  .  .  .  .  .  .  .  .  .  .  .  .
 11 | .  .  .  .  .  .  .  .  .  .  .  .  .  .
 12 | .  .  .  .  .  .  .  .  .  .  .  .  .  .
 13 | .  .  .  .  .  .  .  .  .  .  .  .  .  .
South
```

### Route Notes

- Main route:
- Secondary route:
- Flank route:
- Risky route:

### Cover Notes

- 
- 
- 

### Traversal Notes

- 
- 
- 

## 4. Elevation / Silhouette Plan

### Main Elevation

```text
                 skyline-only
                     /\
                    /  \
        playable   /    \     skyline-only
         _________/      \_________
        /                            \
_______/______________________________\_______
        approach / stairs / terrace
```

### Height Bands

- Ground / apron:
- Lower playable tier:
- Mid playable tier:
- Upper playable tier:
- Skyline-only tier:
- Maximum height:

### Silhouette Rules

- 
- 
- 

### Reachability Rules

- 
- 
- 

## 5. Proxy Build Specification

### Anchors

- Primary anchor:
- Secondary anchor:
- Facing edge:

### Major Pieces

#### Piece A

- Name:
- Type:
- Local anchor `u,v`:
- Footprint:
- Height:
- Collision:
- Traversal:
- Notes:

#### Piece B

- Name:
- Type:
- Local anchor `u,v`:
- Footprint:
- Height:
- Collision:
- Traversal:
- Notes:

#### Piece C

- Name:
- Type:
- Local anchor `u,v`:
- Footprint:
- Height:
- Collision:
- Traversal:
- Notes:

### Spawn / Exclusion Notes

- 
- 
- 

### Builder Breakdown

- `build...`
- `build...`
- `build...`

## 6. Asset Breakdown

### Hero Assets

- 
- 

### Modular Architecture

- 
- 

### Route / Alley / Shelf Kit

- 
- 

### Decor / Signage / Trim

- 
- 

### Collision-Only Pieces

- 
- 

## 7. Review Checklist

- [ ] Fantasy is clear in one sentence.
- [ ] Wall-masking target is explicit.
- [ ] Hero landmark is explicit.
- [ ] Top-down routes are readable.
- [ ] Height composition is defined.
- [ ] Playable vs skyline-only areas are separated.
- [ ] Proxy pieces are named.
- [ ] Spawn exclusions are noted.
- [ ] Asset needs are separated from proxy needs.

## 8. Decision Log

- Decision:
  Reason:
- Decision:
  Reason:
- Decision:
  Reason:
