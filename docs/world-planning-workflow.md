# World Planning Workflow

## Purpose

This workflow defines how to plan new biome overhauls and perimeter-wall masking landmarks without jumping straight into final assets or giant one-shot geometry.

The goal is to make every biome readable in three ways:

1. fantasy
2. gameplay
3. implementation

If a concept is only strong in one or two of those areas, it is not ready to build.

## Core Rule

Do not go straight from idea to final art.

Use this sequence:

1. Intent sheet
2. Gameplay blueprint
3. Elevation / silhouette sketch
4. Proxy build specification
5. Asset breakdown
6. Proxy implementation
7. Playtest
8. Art replacement

## Deliverables

Each biome should get one planning packet based on the template in [`docs/world-planning-template.md`](/Users/gguthrie/Desktop/code%20bs/minecraft-fps/docs/world-planning-template.md).

That packet should answer:

- What is the biome fantasy?
- Which perimeter wall is being hidden?
- What is the hero landmark?
- What is playable?
- What is skyline only?
- How do players move through it?
- What is needed for proxy geometry?
- What assets are eventually required?

## Step 1: Intent Sheet

This is the concept lock.

Define:

- biome name
- fantasy pitch
- wall-masking goal
- hero landmark
- secondary structures
- main player fantasy
- no-go areas

Questions to answer:

- Why does this biome exist visually?
- Why is it different from every other biome?
- What should players remember about it after one match?
- Which parts are real gameplay and which parts are just silhouette?

Output:

- short written concept
- gameplay promise
- skyline promise

## Step 2: Gameplay Blueprint

This is the top-down gameplay pass.

Use ASCII for:

- primary routes
- secondary routes
- choke points
- cover clusters
- stairs / ramps
- alleys / shelf routes
- dead zones
- spawn-sensitive areas
- hero mass footprints

Questions to answer:

- Where do players push?
- Where do they flank?
- Where does long sightline pressure happen?
- Where do we intentionally slow movement?
- Are there any useless spaces?

Output:

- top-down ASCII blueprint
- route notes
- cover notes
- traversal notes

## Step 3: Elevation / Silhouette Sketch

This is the height pass.

Use side-view ASCII or a structured height diagram for:

- major facade height
- podium height
- tower height
- playable shelf heights
- roofline shape
- skyline-only mass

Questions to answer:

- What reads from the center of the map?
- What looks tall versus what is actually reachable?
- Is the visual composition clear from the main approach?
- Does the perimeter wall stay hidden from normal camera angles?

Output:

- one or more elevation diagrams
- height bands
- reachability notes

## Step 4: Proxy Build Specification

This is the implementation bridge.

Translate the concept into blockout-friendly instructions:

- biome-local anchors `u,v`
- world-facing edge
- footprint dimensions
- height ranges
- collision type
- traversal type
- exclusions
- cover density
- decorative density

Questions to answer:

- What gets built as simple solids?
- What is decorative-only?
- What gets excluded from spawn logic?
- What must remain modular for iteration?

Output:

- proxy geometry spec
- blockout builder list
- gameplay constraints

## Step 5: Asset Breakdown

This happens only after the proxy spec is stable.

Split assets into:

- hero assets
- modular architecture
- alley kit / route kit
- trim and detail kit
- signage kit
- skyline-only pieces
- collision shells

Questions to answer:

- Which pieces deserve bespoke modeling?
- Which pieces should be modular?
- Which pieces are visual-only?
- Which pieces need separate collision?

Output:

- asset inventory
- replacement priority
- reuse opportunities

## Step 6: Proxy Implementation

Build the biome in the current world builder code first.

Rules:

- silhouette first
- collision second
- materials third
- small decor last

Implementation target files will usually be the quadrant builders under [`js/world/`](/Users/gguthrie/Desktop/code%20bs/minecraft-fps/js/world).

## Step 7: Playtest Review

Before final art, test:

- wall visibility
- dominant perches
- trapped spaces
- blind corners
- route balance
- readability from center map
- readability from inside the biome
- collision snags
- climb exploits

If major gameplay changes appear here, go back to the packet and update the blueprint and elevation before touching final assets.

## Step 8: Art Replacement

Only after the proxy holds up in play:

- replace visible masses with authored assets
- keep collision simple
- keep anchor positions stable
- avoid changing the route graph unless necessary

## Review Gates

A biome should not move to the next stage until the current one is locked.

### Gate A: Intent Lock

Must be true:

- fantasy is clear in one sentence
- hero landmark is named
- wall-masking target is named
- playable versus skyline-only areas are clearly separated

### Gate B: Blueprint Lock

Must be true:

- all major routes are visible in ASCII
- choke points are intentional
- cover clusters are placed intentionally
- there is no obvious dead unusable quadrant

### Gate C: Elevation Lock

Must be true:

- all major heights are defined
- main approach composition reads clearly
- tallest form and playable forms are not confused
- hidden perimeter wall remains occluded in normal play

### Gate D: Proxy Spec Lock

Must be true:

- builder pieces are named
- dimensions are good enough for blockout
- collision rules are clear
- spawn exclusion needs are listed

### Gate E: Proxy Acceptance

Must be true:

- movement works
- combat reads
- wall is hidden
- no major exploit perches exist

## Recommended Biome Order

Use this order for the current perimeter redesign:

1. Desert
2. Wall Street
3. Any remaining perimeter biome that still exposes the hard wall

Reason:

- Desert is the simpler test case for natural wall masking.
- Wall Street is the more complex test case because it mixes facade composition, alleys, stairs, and extreme skyline scale.

## Practical Rule Of Thumb

If a concept cannot be explained in:

- one paragraph of fantasy
- one ASCII top-down map
- one ASCII elevation

then it is still too loose to build.
