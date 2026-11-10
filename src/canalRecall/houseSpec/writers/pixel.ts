/**
 * Pixel writer (house line H5): a rectified street crop measured by `measureFacade` with the `houseLine` profile
 * (MEASURE_PROFILES.houseLine, the H2d verdict), written as a partial HouseSpec. Everything here is a measurement of the photo's pixels;
 * the Jev judge (jev.ts) is the other thing that reads the same crop.
 *
 * Fields (source `streetlevel-measured`, the ladder rung of a measured street photo):
 *   palette/brick          the wall colour, `measure.wall.hex` (the normalised wall: the dominant colour outside the openings,
 *                          wall-vs-trim and clusterWall applied). good or fallback crop.
 *   palette/wallMaterial   brick when the course lines are resolved (`material.basis === 'courses'`). A painted or rendered wall is
 *                          not told apart from here (paint and plaster look alike in pixels): left to the register and the judge.
 *   fronts/0/bays          the window-column count on a rhythmic front (punched/columns) whose column pitch is resolved
 *                          (`pitchScore >= PIXEL_BAYS.minPitchScore`) and where `columns` and `windowColumns` agree. good crops only.
 *   fronts/0/storeys       OFF (`PIXEL_WRITES_STOREYS`): ground storey + upper storeys from the measured storey pitch (`storeysFromPitch`).
 *                          On the AB07 hand pands it agreed 7/16 (0.44) where the 3DBAG count agreed 7/16 on the same pands: no gain,
 *                          and as a streetlevel-measured field it would outrank the 3dbag count and add disagreements. The function
 *                          stays (tested) for the next buurt's agreement report; flip the constant when it beats the BAG count.
 * Glazing is printed by the sheets, never written and never part of a confidence (H2d verdict).
 *
 * The crop tier (docs/house-line.md §4b) sets the confidence: a good crop (judge >= JUDGE_GOOD) may write every field, a fallback crop
 * (hard flags pass, judge below) only the colour and the storey count, at lower confidence. The tier is recorded in `ref`.
 */
import { MEASURE_PROFILES, measureFacade, type FacadeMeasurement } from '../../buildingRecipe/measureFacade.ts';
import { blurRgb, PRE_BLUR_PX, storeyLines } from '../previewVerdict.ts';
import { rgbToHsl } from '../../blockFace/wallColour.ts';
import { emptySpec, pandDigits, setSpecField, type HouseSpec } from '../spec.ts';

export type CropTier = 'good' | 'fallback';
export interface CropPixels { rgb: Uint8Array; width: number; height: number; ppm: number }
export interface PixelInput {
  pandId: string; image: CropPixels; tier: CropTier;
  /** BAG eaves (or ridge) height above ground, m; null when unknown (the whole crop height is measured then). */
  wallTopM: number | null;
  /** Receipt: the crop path (source-data:// or repo path) and the imagery date. */
  ref: string; at: string | null;
}
/** Confidence by tier and field. Values are priors set by the agreement report (scripts/house-specs/agreement.ts), not calibrated probabilities. */
export const PIXEL_CONFIDENCE = { good: { colour: 0.55, bays: 0.5, storeys: 0.5, material: 0.5 }, fallback: { colour: 0.45, storeys: 0.35 } } as const;
/** Measured over the crop minus this margin at each side (the edge cells of a rectified crop are the most smeared). */
export const SIDE_MARGIN_M = 0.1;
export const PIXEL_WRITES_STOREYS = false;
/** Bays are written only when the column pitch is resolved; on the AB07 hand pands this took columns from 11/22 to 9/11 right. */
export const PIXEL_BAYS = { minPitchScore: 0.6 } as const;
/** A wall read this light is a clipped sky or sheeting, not a front (the washed-out flag lets some through): not written. */
export const MAX_WALL_L = 0.95;

const hslL = (hex: string): number => { const n = parseInt(hex.slice(1), 16); return rgbToHsl([(n >> 16) & 255, (n >> 8) & 255, n & 255])[2]; };

export function measureCrop(c: PixelInput): { m: FacadeMeasurement; topM: number; lines: number[] } | null {
  const { width, height, ppm } = c.image, cropTop = height / ppm;
  const topM = Math.min(cropTop, c.wallTopM ?? cropTop);
  if (!(topM >= 3) || width / ppm < 2.5) return null;
  const lines = storeyLines(topM);
  const rgb = blurRgb(c.image.rgb, width, height, PRE_BLUR_PX);
  const m = measureFacade({ image: { width, height, rgb, ppm, topM: cropTop }, box: { u0: SIDE_MARGIN_M, u1: width / ppm - SIDE_MARGIN_M, v0: 0, v1: topM }, lines, openingSplit: { ...MEASURE_PROFILES.houseLine } });
  return { m, topM, lines };
}

/** The partial spec of one measured crop. Null when the crop is unusable (too few usable cells, foliage or washed-out) for every field. */
export function pixelSpec(c: PixelInput, measured = measureCrop(c)): HouseSpec | null {
  if (!measured) return null;
  const { m, topM } = measured, conf = PIXEL_CONFIDENCE[c.tier];
  if (m.usableFraction < 0.5) return null;
  const spec = emptySpec(pandDigits(c.pandId));
  const put = (path: string, value: unknown, confidence: number) => {
    setSpecField(spec, path, value);
    spec.provenance[path] = { source: 'streetlevel-measured', confidence: +confidence.toFixed(2), ref: `${c.ref}#${c.tier}`, at: c.at };
  };
  // Foliage or highlight clipping in the crop lowers every colour-derived confidence (the H4c flags keep the worst out already).
  const penalty = (m.foliageFraction > 0.15 ? 0.1 : 0) + (m.washedOutFraction > 0.25 ? 0.1 : 0);
  if (/^#[0-9a-f]{6}$/i.test(m.wall.hex) && hslL(m.wall.hex) <= MAX_WALL_L) put('palette/brick', m.wall.hex.toLowerCase(), conf.colour - penalty);
  if (c.tier === 'good' && m.material?.family === 'brick' && m.material.basis === 'courses') put('palette/wallMaterial', 'brick', PIXEL_CONFIDENCE.good.material - penalty);
  if (c.tier === 'good' && (m.frontClass === 'punched' || m.frontClass === 'columns')) {
    const cols = m.windowColumns ?? m.columns;
    if (cols !== null && Number.isInteger(cols) && cols >= 1 && cols <= 12 && m.columns === m.windowColumns && m.pitchScore >= PIXEL_BAYS.minPitchScore) put('fronts/0/bays', cols, PIXEL_CONFIDENCE.good.bays - penalty);
  }
  const storeys = PIXEL_WRITES_STOREYS ? storeysFromPitch(m, topM) : null;
  if (storeys !== null) put('fronts/0/storeys', storeys, conf.storeys - penalty);
  return Object.keys(spec.provenance).length ? spec : null;
}

/** Ground storey + upper storeys at the measured storey pitch; null when the pitch did not resolve or is implausible (2.2 to 4.2 m). */
export function storeysFromPitch(m: Pick<FacadeMeasurement, 'storeyM' | 'pitchM' | 'pitchScore'>, topM: number, groundM = 3.2): number | null {
  const pitch = m.storeyM ?? m.pitchM;
  if (pitch === null || pitch === undefined || !(m.pitchScore >= 0.15) || pitch < 2.2 || pitch > 4.2) return null;
  return 1 + Math.max(0, Math.round((topM - groundM) / pitch));
}
