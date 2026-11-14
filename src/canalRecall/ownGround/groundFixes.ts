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
] as const;
/**
 * Trials: fixes measured but not yet shipped, default off; `?<name>=1|true|on` (or the window override set true) turns one
 * on, through the same plumbing to the worker.
 */
export const GROUND_TRIALS = [
  /** Lane f1b-jagged 2026-11-14: way decks run on to the top of each bank's climb away from the water, so a crossing holds the grade between the bank tops (wayDecks.ts BANK_CLIMB_MAX_M), the Lelylaan slip. Off: the extended deck opens a hole in the carriageway beside the slip (frames in _pruned-sheets/f1b-jagged). */
  'bankClimb',
] as const;
export type GroundFix = (typeof GROUND_FIXES)[number] | (typeof GROUND_TRIALS)[number];
export type GroundFixFlags = Partial<Record<GroundFix, boolean>>;

/** The fixes switched off by the page (`?name=0|false|off`, or the window override) and the trials switched on (`?name=1`). */
export function groundFixFlags(search = (globalThis as { location?: { search?: string } }).location?.search ?? ''): GroundFixFlags {
  const g = globalThis as { __canalRecallGroundFixes?: GroundFixFlags };
  const out: GroundFixFlags = {};
  for (const f of GROUND_FIXES) {
    const forced = g.__canalRecallGroundFixes?.[f];
    if (typeof forced === 'boolean') { if (!forced) out[f] = false; continue; }
    if (new RegExp(`[?&]${f}=(0|false|off)\\b`).test(search)) out[f] = false;
  }
  for (const f of GROUND_TRIALS) {
    const forced = g.__canalRecallGroundFixes?.[f];
    if (forced === true || (forced === undefined && new RegExp(`[?&]${f}=(1|true|on)\\b`).test(search))) out[f] = true;
  }
  return out;
}

/** The store options for a flag set (the off fixes, the store's defaults being on, and the trials turned on). */
export function groundFixOptions(flags: GroundFixFlags | undefined): GroundFixFlags {
  const out: GroundFixFlags = {};
  for (const f of GROUND_FIXES) if (flags?.[f] === false) out[f] = false;
  for (const f of GROUND_TRIALS) if (flags?.[f] === true) out[f] = true;
  return out;
}
