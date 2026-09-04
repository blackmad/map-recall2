/**
 * What a canal house is shaped like — measured, not assumed.
 *
 * Every constant here comes from evidence recorded beside it, because the whole
 * risk of a grammar is that it stops being a way of reading and becomes a
 * source of facts. These numbers may narrow a search, reject an implausible
 * reading, or rank two candidate readings of the same image. They may never
 * supply a value for a building nobody looked at.
 *
 * The evidence is deliberately independent of this project's own detector.
 * Storey geometry comes from 3DBAG's storey counts divided by AHN eaves
 * heights — two measurements neither of which has anything to do with the
 * opening detector these numbers are used to constrain.
 */

/**
 * Storey height across the pilot boundary.
 *
 * n = 2,390 buildings with both a 3DBAG storey count and an AHN eaves height:
 *
 *   p05 2.40 m · p25 2.76 m · p50 3.01 m · p75 3.26 m · p95 3.71 m
 *
 * Tighter than the 2.4–4.2 m the ladder originally searched, and centred a good
 * deal higher than the 2.4 m end it kept drifting to.
 */
export const STOREY_HEIGHT_M = { min: 2.3, p25: 2.76, median: 3.01, p75: 3.26, max: 3.9 } as const;

/**
 * Eaves height by storey count, from the same 2,390 buildings.
 *
 * Used to sanity-check a ladder against the building it is on: a five-rung
 * ladder on a 9 m façade is wrong however well its rungs correlate.
 */
export const EAVES_BY_STOREYS_M: Record<number, { p25: number; p50: number; p75: number }> = {
  3: { p25: 8.5, p50: 9.5, p75: 10.7 },
  4: { p25: 11.1, p50: 12.1, p75: 13.0 },
  5: { p25: 13.7, p50: 14.9, p75: 16.1 },
};

/**
 * Storeys diminish upward.
 *
 * Documented rather than measured here: floor heights fall toward the top, and
 * upper storeys were glazed less because daylight was taken high against the
 * ceiling. Used only to break a tie between two ladders that fit equally well.
 * — Vereniging Vrienden van de Amsterdamse Binnenstad, "Vensters, ramen en roeden".
 */
export const STOREYS_DIMINISH_UPWARD = true;

/**
 * The Amsterdam foot, and why plot widths are NOT snapped to it.
 *
 * Plots on the 17th-century canal ring were set out in Amsterdam feet of
 * 28.13 cm, at 18, 20, 22, 24 or 26 feet — so 5.06, 5.63, 6.19, 6.75, 7.31 m.
 * The pilot's median plot width is 5.66 m, which is 20 feet almost exactly, and
 * it is tempting to quantise every measured width onto that module.
 *
 * Tested, and the module is not there. Over 1,343 pre-1800 plots the mean
 * distance from a whole foot is 0.2524, against 0.2524 for a randomised
 * control — 0.25 being what no structure at all looks like. The 20-foot peak is
 * the mode of the distribution, not evidence of quantisation.
 *
 * The historic module was real; it is simply not recoverable from these
 * measurements, because a BAG footprint is a modern survey of a building that
 * has been rebuilt, merged, split and settled for four centuries, and the
 * "width" here is the short side of its minimum-area rectangle rather than a
 * plot boundary. Kept as a constant for provenance, and deliberately unused.
 */
export const AMSTERDAM_FOOT_M = 0.2813;
export const HISTORIC_PLOT_FEET = [18, 20, 22, 24, 26] as const;

/**
 * Window geometry.
 *
 * Ranges rather than a prior: a *kruiskozijn* on a 17th-century front and a
 * 19th-century *schuifraam* are very different objects, and a shopfront opening
 * on the ground floor is different again. Wide enough to admit all three,
 * narrow enough to reject a shadow, a doorway reflection or a tree trunk.
 */
export const WINDOW_M = {
  minWidth: 0.55, maxWidth: 2.4,
  minHeight: 0.8, maxHeight: 3.0,
  /** Height over width. Dutch sashes are upright; nothing here is a letterbox. */
  minAspect: 0.75, maxAspect: 3.4,
} as const;

/** Openings as a share of façade area. Below this the reading found almost nothing; above it, it is reading a glazed shopfront or a tree. */
export const OPENING_AREA_SHARE = { min: 0.04, max: 0.34 } as const;

export interface PlausibilityInput {
  wallWidthM: number;
  eavesHeightM: number | null;
  /** Storey count from an independent source, when there is one. */
  declaredStoreys: number | null;
  storeyBands: number;
  storeyIntervalsM: number[];
  bays: number;
  openings: Array<{ xM: number; yM: number; widthM: number; heightM: number }>;
}

export interface Plausibility {
  /** 0…1. Not a confidence — a filter on whether this reading is a façade at all. */
  score: number;
  /** Every rule that failed, in words, so a rejection can be argued with. */
  failures: string[];
}

/**
 * Is this reading a façade, or is it a photograph of a tree?
 *
 * The reference sheet made the need obvious: at obliquity under 12° and
 * standoff under 40 m — filters that sound strict — several sampled façades
 * turned out to be trees, scaffolding, a lamp post, or a wildly mis-scaled
 * close-up. Those readings pass every geometric test on the *camera* and none
 * on the *building*, so the building is what has to be tested.
 *
 * This does not correct a reading. It says whether to keep it.
 */
export function plausibility(input: PlausibilityInput): Plausibility {
  const failures: string[] = [];
  const { wallWidthM, eavesHeightM, declaredStoreys, storeyBands, storeyIntervalsM, bays, openings } = input;

  if (openings.length === 0) failures.push('no openings found');

  // Storey count against the building's own height.
  if (eavesHeightM && storeyBands > 0) {
    const implied = eavesHeightM / storeyBands;
    if (implied < STOREY_HEIGHT_M.min) failures.push(`${storeyBands} bands over ${eavesHeightM.toFixed(1)} m implies ${implied.toFixed(2)} m storeys, below ${STOREY_HEIGHT_M.min} m`);
    if (implied > STOREY_HEIGHT_M.max) failures.push(`${storeyBands} bands over ${eavesHeightM.toFixed(1)} m implies ${implied.toFixed(2)} m storeys, above ${STOREY_HEIGHT_M.max} m`);
  }
  // And against an independent count, where one exists. A disagreement of more
  // than one is a signal, not an error — a souterrain or a bel-étage produces
  // exactly that — but more than two means the ladder is on something else.
  if (declaredStoreys && storeyBands && Math.abs(declaredStoreys - storeyBands) > 2) {
    failures.push(`${storeyBands} bands against an independent ${declaredStoreys} storeys`);
  }

  for (const interval of storeyIntervalsM) {
    if (interval < STOREY_HEIGHT_M.min || interval > STOREY_HEIGHT_M.max) {
      failures.push(`a ${interval.toFixed(2)} m floor-to-floor interval is outside ${STOREY_HEIGHT_M.min}–${STOREY_HEIGHT_M.max} m`);
      break;
    }
  }

  // Bays against frontage. A 5 m front has one or two; six means the columns
  // are window *panes*, or a tree's branches.
  const maxBays = Math.max(2, Math.round(wallWidthM / 1.6));
  if (bays > maxBays) failures.push(`${bays} bays across ${wallWidthM.toFixed(1)} m of frontage, more than ${maxBays}`);

  // Opening area as a share of the wall.
  if (eavesHeightM && eavesHeightM > 0) {
    const share = openings.reduce((sum, o) => sum + o.widthM * o.heightM, 0) / (wallWidthM * eavesHeightM);
    if (share > OPENING_AREA_SHARE.max) failures.push(`openings cover ${(share * 100).toFixed(0)}% of the wall, above ${OPENING_AREA_SHARE.max * 100}%`);
    if (openings.length && share < OPENING_AREA_SHARE.min) failures.push(`openings cover only ${(share * 100).toFixed(1)}% of the wall`);
  }

  // Individual openings that are not window-shaped.
  const odd = openings.filter(o => {
    const aspect = o.heightM / o.widthM;
    return o.widthM < WINDOW_M.minWidth || o.widthM > WINDOW_M.maxWidth
      || o.heightM < WINDOW_M.minHeight || o.heightM > WINDOW_M.maxHeight
      || aspect < WINDOW_M.minAspect || aspect > WINDOW_M.maxAspect;
  }).length;
  if (openings.length && odd / openings.length > 0.4) failures.push(`${odd} of ${openings.length} openings are not window-shaped`);

  // A reading with no failures scores 1; each failure costs a fifth.
  return { score: Math.max(0, 1 - failures.length * 0.2), failures };
}

/** Readings at or above this are kept; below it they are recorded as rejected. */
export const PLAUSIBLE_ENOUGH = 0.6;
