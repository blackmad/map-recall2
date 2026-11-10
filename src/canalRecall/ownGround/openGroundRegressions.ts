// Named open-ground regressions (lane open-ground-look 2026-11-10): the user's feedback spots where open ground drew
// as the paving-grey land, and a Centrum plein that must stay paving. groundSurface.test.ts reads the published
// open-ground-v1 cells at these probes; scripts/own-ground/open-ground-ortho-sheet.ts and the ride frames use the spots.

import type { OpenGroundCover } from './groundSurface.js';

export interface OpenGroundProbe {
  /** What the orthophoto shows there (PDOK luchtfoto 2025, checked by eye on the lane's sheet). */
  what: string;
  /** WGS84. */
  lng: number; lat: number;
  /** The cover open-ground-v1 must draw there; null: nothing (paving, a path, a road stays as it is). */
  expect: OpenGroundCover | null;
}

export interface OpenGroundSpot {
  name: string;
  /** Feedback id, when the spot came from the user. */
  feedback?: string;
  lng: number; lat: number;
  /** The own-ground cell (elevation-v1 key) of the spot. */
  cell: string;
  /** Where the ride frame stands the rider, and the way it looks (degrees from north), tests/e2e/open-ground-frames.spec.ts. */
  frame: { lng: number; lat: number; bearing: number };
  probes: readonly OpenGroundProbe[];
}

export const OPEN_GROUND_SPOTS: readonly OpenGroundSpot[] = [
  { name: 'heathrowstraat', feedback: '637f346b', lng: 4.83250, lat: 52.38597, cell: '-5_1', frame: { lng: 4.83250, lat: 52.38597, bearing: 20 }, probes: [
    { what: 'the lawn strip north of the footpath, along the school building (BGT groenvoorziening)', lng: 4.832497, lat: 52.386148, expect: 'meadow' },
    { what: 'the paved forecourt the rider stood at (BGT erf, paved on the photo)', lng: 4.832497, lat: 52.385922, expect: null },
  ] },
  { name: 'barajasweg', feedback: '4f47f105', lng: 4.83346, lat: 52.38745, cell: '-5_1', frame: { lng: 4.83346, lat: 52.38745, bearing: 200 }, probes: [
    { what: 'the lawn east of the office courtyard (BGT groenvoorziening)', lng: 4.833748, lat: 52.387451, expect: 'meadow' },
    { what: 'the paved office courtyard (BGT erf, paved on the photo)', lng: 4.833159, lat: 52.387451, expect: null },
  ] },
  { name: 'moermanskkade', feedback: '020e2132', lng: 4.8721, lat: 52.3976, cell: '-2_3', frame: { lng: 4.87170, lat: 52.39712, bearing: 15 }, probes: [
    { what: 'the empty lot: BGT zand, rough meadow and reeds on the 2025 photo and panorama (the CIR aerial: 44 % vegetated)', lng: 4.8721, lat: 52.3976, expect: 'meadow' },
  ] },
  { name: 'sloterdijkerweg', feedback: '28ae61fb', lng: 4.84600, lat: 52.38744, cell: '-4_1', frame: { lng: 4.84600, lat: 52.38744, bearing: 300 }, probes: [
    { what: 'the woodland west of the road, by the rail yard (BGT groenvoorziening under trees)', lng: 4.845117, lat: 52.387440, expect: 'meadow' },
  ] },
  // check:bridge-gaps nauernaseweg-way-deck (integrator 2026-11-10): the level-0 BGT grass under the raised (h 1) road
  // polygons of the way deck's approach drew over the carriageway (+63 m² off the road). Raised roads-v1 surfaces are cut out.
  { name: 'nauernaseweg', lng: 4.75045, lat: 52.43245, cell: '-11_6', frame: { lng: 4.75045, lat: 52.43245, bearing: 60 }, probes: [
    { what: 'the carriageway of the way-deck approach, west end (BGT grass at level 0 under the h 1 road)', lng: 4.750259, lat: 52.432385, expect: null },
    { what: 'the carriageway of the way-deck approach, east of the deck', lng: 4.750643, lat: 52.432510, expect: null },
  ] },
  { name: 'nieuwmarkt', lng: 4.90040, lat: 52.37270, cell: '0_0', frame: { lng: 4.90040, lat: 52.37195, bearing: 0 }, probes: [
    { what: 'the paved square south of the Waag: a plein stays paving', lng: 4.90040, lat: 52.37225, expect: null },
  ] },
];
