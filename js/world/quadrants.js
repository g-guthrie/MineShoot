import { buildArcticQuadrant } from './quadrant-arctic.js';
import { buildBasinQuadrant } from './quadrant-basin.js';
import { buildCitadelQuadrant } from './quadrant-citadel.js';
import { buildDesertQuadrant } from './quadrant-desert.js';
import { buildJungleQuadrant } from './quadrant-jungle.js';
import { buildNuclearQuadrant } from './quadrant-nuclear.js';
import { buildQuarryQuadrant } from './quadrant-quarry.js';
import { buildRadarQuadrant } from './quadrant-radar.js';
import { buildUrbanQuadrant } from './quadrant-urban.js';

export const GameWorldQuadrants = {
  arctic: buildArcticQuadrant,
  basin: buildBasinQuadrant,
  citadel: buildCitadelQuadrant,
  desert: buildDesertQuadrant,
  jungle: buildJungleQuadrant,
  nuclear: buildNuclearQuadrant,
  quarry: buildQuarryQuadrant,
  radar: buildRadarQuadrant,
  urban: buildUrbanQuadrant
};
