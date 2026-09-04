/**
 * Declared survey areas.
 *
 * Adding a Dutch city to façade reconnaissance is an entry in this file. The
 * national registers in `sources/netherlands.ts` already cover it, so nothing
 * else has to change — which is the whole point of moving the sources behind
 * interfaces.
 *
 * Offsets on a corridor area are measured against real cross-sections, never
 * picked. A Grachtengordel canal is ~25 m of water plus ~12–15 m of quay each
 * side, so the far-bank front wall sits ~27 m from the centreline and 45 m
 * lands 18 m into a plot 30–55 m deep.
 */
import type { SurveyArea } from './surveyArea.ts';

export const AMSTERDAM_GRACHTENGORDEL_WEST: SurveyArea = {
  areaId: 'amsterdam-grachtengordel-west',
  cityId: 'amsterdam',
  name: 'De Negen Straatjes / Grachtengordel-West',
  description:
    'The façade-twin pilot. Brouwersgracht in the north, Leidsegracht in the south, Singel in the east, '
    + 'Prinsengracht plus the first Jordaan row in the west, with both banks of every boundary canal in scope. '
    + 'Singel never reaches Leidsegracht — it ends at Koningsplein — so Herengracht carries the south-east corner.',
  localOrigin: { x: 120_700, y: 487_500 },
  localOriginNote: 'Westermarkt, 44 m from the Westerkerk tower. Fixed once and never changed.',
  shape: {
    kind: 'corridor',
    featureSelector: { waterway: 'canal' },
    featureBbox: [52.358, 4.870, 52.388, 4.907],
    edges: [
      {
        feature: 'Brouwersgracht', from: 'Prinsengracht', to: 'Singel', outwardOffsetM: 42,
        rationale: 'North edge. Narrower than the main grachten, so 42 m reaches the north-bank warehouses without touching Haarlemmerstraat.',
      },
      {
        feature: 'Singel', from: 'Brouwersgracht', to: null, outwardOffsetM: 45,
        rationale: 'East edge, from Brouwersgracht to the canal’s own south end at Koningsplein. Both banks are in scope.',
      },
      {
        feature: 'Herengracht', from: 'Singel-south-end', to: 'Leidsegracht', outwardOffsetM: 45,
        rationale: 'South-east closure. Singel stops at Koningsplein while Leidsegracht starts at Herengracht, so Herengracht carries the corner.',
      },
      {
        feature: 'Leidsegracht', from: 'Herengracht', to: 'Prinsengracht', outwardOffsetM: 45,
        rationale: 'South edge. The Gouden Bocht continues south-east of here and is the stretch sector, not the core.',
      },
      {
        feature: 'Prinsengracht', from: 'Leidsegracht', to: 'Brouwersgracht', outwardOffsetM: 95,
        rationale: 'West edge, widened for the first Jordaan row behind the west bank: ~27 m to the front wall, a 50–60 m block, then into the next row. Set from measured perpendiculars — Bloemstraat 12 is 54 m out and in, Bloemgracht 60 is 109 m out and not.',
      },
    ],
  },
};

/**
 * Utrecht's medieval core, as a second Dutch fabric.
 *
 * Not a copy of Amsterdam's grammar and not meant to be: Utrecht's Oudegracht
 * is a working wharf canal a full storey below street level, with *werfkelders*
 * opening onto the water and houses whose ground floor is therefore two ground
 * floors. It is here to prove the pipeline is not Amsterdam-shaped, and because
 * this repository already ships a Utrecht extract.
 *
 * Declared as a polygon rather than a corridor because the binnenstad's edge is
 * the singel moat, which is one continuous feature rather than a ring of named
 * legs — a case the corridor shape cannot express and should not be bent into.
 */
export const UTRECHT_BINNENSTAD_NORTH: SurveyArea = {
  areaId: 'utrecht-binnenstad-north',
  cityId: 'utrecht',
  name: 'Utrecht binnenstad — Oudegracht north',
  description:
    'The Oudegracht between Viebrug and the Domtoren, with Nieuwegracht and the Domplein. '
    + 'A wharf-canal fabric: werfkelders at water level under a raised street, which the Amsterdam grammar has no vocabulary for.',
  localOrigin: { x: 136_500, y: 456_000 },
  localOriginNote: 'Domplein, beside the Domtoren.',
  shape: {
    kind: 'polygon',
    ringLngLat: [
      [5.11550, 52.09600], [5.12480, 52.09600], [5.12660, 52.09180],
      [5.12300, 52.08830], [5.11700, 52.08880], [5.11400, 52.09220],
    ],
  },
};

export const SURVEY_AREAS: readonly SurveyArea[] = [
  AMSTERDAM_GRACHTENGORDEL_WEST,
  UTRECHT_BINNENSTAD_NORTH,
];

export const findArea = (areaId: string): SurveyArea => {
  const area = SURVEY_AREAS.find(candidate => candidate.areaId === areaId);
  if (!area) throw new Error(`unknown survey area '${areaId}'. Known: ${SURVEY_AREAS.map(a => a.areaId).join(', ')}`);
  return area;
};
