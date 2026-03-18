import './quadrant-arctic.js';
import './quadrant-wall-street.js';
import './quadrant-citadel.js';
import './quadrant-desert.js';
import './quadrant-jungle.js';
import './quadrant-nuclear.js';
import './quadrant-quarry.js';
import './quadrant-radar.js';
import './quadrant-urban.js';

const quadrants = (globalThis.__MAYHEM_RUNTIME && globalThis.__MAYHEM_RUNTIME.WorldQuadrants) || {};

export const GameWorldQuadrants = {
  arctic: quadrants.arctic,
  citadel: quadrants.citadel,
  desert: quadrants.desert,
  jungle: quadrants.jungle,
  nuclear: quadrants.nuclear,
  quarry: quadrants.quarry,
  radar: quadrants.radar,
  'wall-street': quadrants['wall-street'],
  urban: quadrants.urban
};
