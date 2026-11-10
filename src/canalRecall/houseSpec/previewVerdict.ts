/**
 * The house preview's likeness verdict (house line H2, docs/house-line.md §2): two facade measurements
 * (buildingRecipe/measureFacade.ts) on the same box and storey lines, one of the preview render and one of the photo
 * (or of another render), judged with likeness.ts's tolerances: wall lightness ΔL <= 0.12 and hue <= 12° (hue only when
 * both are saturated), mean glazing within 0.15, window columns within 20 %, the same window shape class.
 * likeness.ts compareLikeness needs a per-triangle MaterialSoup, which the generic streamed path does not have, so
 * this compares the two pixel measurements instead (no mask shift search, no IoU, no row-opening sequences).
 */
import { LIKENESS, likenessVerdict, type Verdict } from '../buildingRecipe/likeness.ts';
import { rgbToHsl } from '../blockFace/wallColour.ts';
import type { FacadeMeasurement } from '../buildingRecipe/measureFacade.ts';

/** Mean glazing tolerance of the preview gate (likeness.ts storeyGlazing: the brief's ±0.15). */
export const PREVIEW_GLAZING = LIKENESS.storeyGlazing;

export type PreviewVerdict = {
  verdict: Verdict; reasons: string[]; warns: string[];
  wall: { a: string; b: string; dL: number; dHue: number | null; pass: boolean };
  glazing: { a: number; b: number; diff: number; pass: boolean };
  columns: { a: number | null; b: number | null; pass: boolean | null };
  window: { a: string | null; b: string | null; pass: boolean | null };
  classes: { a: string; b: string };
};

/**
 * `a`: the render; `b`: the reference. A photo reference abstains when it is unusable (foliage, washed out, too few
 * usable cells); a render reference (`reference: 'render'`, e.g. the render.ts frame) never does: its light walls
 * read as "washed out" and it has no foliage to hide behind.
 */
export function previewVerdict(a: FacadeMeasurement, b: FacadeMeasurement, reference: 'photo' | 'render' = 'photo'): PreviewVerdict {
  const abstain: string[] = [];
  if (reference === 'photo' && b.usableFraction < LIKENESS.minUsable) abstain.push(`reference usable cells ${(b.usableFraction * 100).toFixed(0)} % < ${LIKENESS.minUsable * 100} %`);
  if (reference === 'photo' && b.foliageFraction > LIKENESS.maxFoliage) abstain.push(`reference foliage ${(b.foliageFraction * 100).toFixed(0)} % > ${LIKENESS.maxFoliage * 100} %`);
  if (reference === 'photo' && b.washedOutFraction > LIKENESS.maxWashedOut) abstain.push(`reference washed out ${(b.washedOutFraction * 100).toFixed(0)} % > ${LIKENESS.maxWashedOut * 100} %`);
  const ha = rgbToHsl(a.wall.normalised), hb = rgbToHsl(b.wall.normalised);
  const dL = ha[2] - hb[2];
  let dHue: number | null = null;
  if (Math.min(ha[1], hb[1]) > LIKENESS.satForHue) { dHue = ha[0] - hb[0]; if (dHue > 180) dHue -= 360; if (dHue < -180) dHue += 360; }
  const wallPass = Math.abs(dL) <= LIKENESS.dL && (dHue === null || Math.abs(dHue) <= LIKENESS.hueDeg);
  const gDiff = a.glazing - b.glazing, glazingPass = Math.abs(gDiff) <= PREVIEW_GLAZING;
  const ca = a.windowColumns ?? a.columns, cb = b.windowColumns ?? b.columns;
  const rhythmic = b.frontClass !== 'curtain' && b.frontClass !== 'blank';
  const colPass = !rhythmic || cb === null ? null : ca !== null && Math.abs(ca - cb) <= LIKENESS.columns * cb;
  const shapePass = !rhythmic || !b.window ? null : !!a.window && a.window.shape === b.window.shape;
  const fails: string[] = [], warns: string[] = [];
  if (!wallPass) fails.push(Math.abs(dL) > LIKENESS.dL ? `wall dL ${dL > 0 ? '+' : ''}${dL.toFixed(2)}` : `wall hue ${dHue!.toFixed(0)} deg`);
  if (!glazingPass) fails.push(`glazing ${a.glazing.toFixed(2)} vs ${b.glazing.toFixed(2)}`);
  if (shapePass === false) fails.push(`window shape ${a.window?.shape ?? 'none'} vs ${b.window!.shape}`);
  if (colPass === false) warns.push(`columns ${ca ?? 'none'} vs ${cb}`);
  const verdict = likenessVerdict({ abstain, fails, warns, iou: null });
  return {
    verdict, reasons: abstain.length ? abstain : fails, warns,
    wall: { a: a.wall.hex, b: b.wall.hex, dL: +dL.toFixed(3), dHue: dHue === null ? null : +dHue.toFixed(1), pass: wallPass },
    glazing: { a: a.glazing, b: b.glazing, diff: +gDiff.toFixed(3), pass: glazingPass },
    columns: { a: ca, b: cb, pass: colPass },
    window: { a: a.window?.shape ?? null, b: b.window?.shape ?? null, pass: shapePass },
    classes: { a: a.frontClass, b: b.frontClass },
  };
}

/** Storey lines for a front `topM` high with a `groundM` ground storey: [0, ground, ...equal upper storeys near `storeyM`, top]. */
export function storeyLines(topM: number, groundM = 3.2, storeyM = 3.0): number[] {
  const ground = Math.min(groundM, topM);
  const upper = Math.max(0, topM - ground), n = Math.max(1, Math.round(upper / storeyM));
  const lines = [0, +ground.toFixed(3)];
  if (upper > 0.5) for (let k = 1; k <= n; k++) lines.push(+(ground + upper * k / n).toFixed(3));
  return lines;
}
