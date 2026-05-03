# River Arches Biome Planning Packet

- Biome id: `river-arches`
- Runtime slot: south-center cell, `r2c1`
- Theme: natural river gorge with limestone arches, meadow banks, reeds, stepping stones, and a south cliff waterfall.
- Replaces: the retired black/lime Wall Street / toon-finance biome.

## Intent

River Arches should sit between the existing natural-color biomes without reading as city, finance, or Toontown. Its palette is blue water, warm sand, pale limestone, meadow green, moss, and small wildflower accents.

## Play Shape

- Central river forms a readable lane through the cell.
- Three stone arches create protrusions and over-water sightline breaks.
- Side cliff shelves make left and right alley lanes without sealing the biome.
- Low river rocks, stepping stones, reeds, and fallen logs provide cover at human scale.
- The south cliff and waterfall mask the perimeter wall as authored terrain.

## Current Runtime Contract

- `shared/world-layout.js` maps `r2c1` to `river-arches`.
- `js/world/quadrant-river-arches.js` owns the visible blockout and spawn exclusions.
- `tests/world/world-layout.test.js` verifies the builder stays inside bounds and contains water, arches, trees, and no finance leftovers.
