// Lane G1 of the Ground v2 plan (issue #376): the targeted ground fixes, one URL flag each.
//
// Every fix is a GroundStore option of the same name, default on (the store reads `!== false`), and byte-identical
// where its defect is absent. The page reads `?<name>=0` (or `window.__canalRecallGroundFixes = { <name>: false }`)
// and hands the set to the worker in its init message, so the page's planning store and the worker's building store
// agree. The A/B per fix is `npm run ground:audit -- --spots --opts '{"<name>":false}'` against the default
// (docs/reports/ground-g1-20261112.md).

/** The fixes, in the lane's order (the brief's A to F). */
export const GROUND_FIXES = [
  /** A: open ground cut free of the roads-v1 ground polygons offline (open-ground-v2, scripts/own-ground/clip-open-ground.ts). */
  'openGroundClip',
  /** B: the roads-v1 drape's min-area gate scales with the triangle's own extent, so long strips on coarse relief split. */
  'roadStrips',
  /** C: portal sanity (tunnels.ts PORTAL_SANITY). */
  'portalSanity',
  /** D: the float bound in drapeBisect (parks.ts), matching its sag test. */
  'floatBound',
  /** E: caps under decks (deckCaps.ts): the relief under a dry deck flattened to its ends' street level. */
  'deckCaps',
  /** F: underpass roads (BGT h < 0 kept under a tunnel cut). */
  'underpassRoads',
  /** Lane fb-bridges 2026-11-13: deck bodies and tops stop where the survey's deck polygons end over open water (bridgeGaps.ts surveyDeckCaps). */
  'surveyCaps',
  /** Lane fb-bridges 2026-11-13: no railing beside a surveyed surface over mapped water, the Muntplein (groundCell plein). */
  'pleinRails',
  /** Lane fb-bridges 2026-11-13: a way deck over an end hole runs on to the top of the bank's climb (wayDecks.ts HOLE_CLIMB_GRADE), the Lelylaan. */
  'holeClimb',
  /** Lane F1b 2026-11-14: a median gap inside a deck's half-width does not end the survey edge walk (bridgeGaps.ts surveyDeckEdges `median`), Ringweg-Noord. */
  'medianEdges',
  /** Lane F1b 2026-11-14: survey caps smoothed along the deck, no railing step at a pier bay or a short capped run (bridgeGaps.ts surveyDeckCaps `smooth`). */
  'capSmooth',
  /** Lane F1b 2026-11-14: streets under a way deck's hole ranges drape on the relief, not the deck's lift (surface.ts streetHeight), the Lelylaan cycle path. */
  'holeStreets',
  /** Lane f1b-jagged 2026-11-14: holeStreets leaves the deck's own road alone where the survey draws it at ground level over the hole (bridgeGaps.ts holeCarry), Ringweg-Noord. */
  'holeCarried',
  /** Lane quay-corner 2026-11-14: a shore segment crossing a bridge opening is cut at its edges, only the part inside dropped (water.ts splitAtRings), the Bilderdijkgracht at De Clercqstraat. */
  'openingShores',
  /** Lane crossing-grade 2026-11-14 (user: "these roads should probably figure out 'I don't dip down'"): way decks that dip run on to the top of each bank's climb away from the water, so a crossing holds the grade between the bank tops (wayDecks.ts BANK_CLIMB_MAX_M), bundles too, the embankment's side falling to the relief (surface.ts BANK_SIDE_GRADE); deck-level road polygons take the nearest deck's level (roadSurfaces.ts deckLevelHeight). The Lelylaan slip 7382983. */
  'bankClimb',
  /** Lane dips-deck-ends 2026-11-14: a way deck whose relief sags under the line between the way's own end nodes runs on to them as hole ranges, and a flat register footprint over such a sag takes a lifting deck (wayDecks.ts WAY_END_DIP_M). Haarlemmer Houttuinen 7376117 under BRU0095, the Amsterdamse Baan links. */
  'wayEnds',
  /** Lane fb-bridges-20261119: the survey's deck polygons seed wetGround's narrow-polygon rounds (wetGround.ts WetGroundInput.decks): the Torensluis water slit (c16d3403), the Doelensluis notch (4c1344ce). */
  'wetNearDecks',
  /** Lane fb-bridges-20261119: ground polygons split across a measured deck's lateral blend (roadSurfaces.ts DeckSideFine): De Clercqstraat's deck joints (3b8ca68b). */
  'deckSideFine',
  /** Lane fb-bridges-20261119: tram rails centred in their carriageway within RAIL_CENTRE_TOL_M (railCentre.ts): Vijzelstraat (62d5a35f). */
  'railCentre',
  /** Lane fb-bridges-20261119: a covered deck's top drawn in the survey's material at its edges (groundCell coveredTopLayer): the Oost-Indische Huisbrug (935a6807). */
  'coveredTopTone',
  /** Lane fb-ground2-20261120: the land's water cut lifted inside wet-ground rings (wetGroundEdges.ts liftLandInRings): the Doelensluis water hole (4c1344ce). */
  'wetHoles',
  /** Lane fb-ground2-20261120: quay faces along wet-ground ring edges over open water, the OSM shore under a ring buried (wetGroundEdges.ts wetGroundShores): the Doelensluis terrace face (4c1344ce). */
  'wetFaces',
  /** Lane fb-ground2-20261120: survey deck edges that narrow abruptly taper at DECK_EDGE_TAPER (bridgeGaps.ts taperDeckEdges): De Clercqstraat's ledge across the road (3b8ca68b). */
  'edgeTaper',
] as const;
export type GroundFix = (typeof GROUND_FIXES)[number];
export type GroundFixFlags = Partial<Record<GroundFix, boolean>>;

/** The fixes switched off by the page (`?name=0|false|off`, or the window override): only the off ones are listed. */
export function groundFixFlags(search = (globalThis as { location?: { search?: string } }).location?.search ?? ''): GroundFixFlags {
  const g = globalThis as { __canalRecallGroundFixes?: GroundFixFlags };
  const out: GroundFixFlags = {};
  for (const f of GROUND_FIXES) {
    const forced = g.__canalRecallGroundFixes?.[f];
    if (typeof forced === 'boolean') { if (!forced) out[f] = false; continue; }
    if (new RegExp(`[?&]${f}=(0|false|off)\\b`).test(search)) out[f] = false;
  }
  return out;
}

/** The store options for a flag set (only the off fixes: the store's defaults are on). */
export function groundFixOptions(flags: GroundFixFlags | undefined): GroundFixFlags {
  const out: GroundFixFlags = {};
  for (const f of GROUND_FIXES) if (flags?.[f] === false) out[f] = false;
  return out;
}
