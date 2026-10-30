/**
 * Thumbnail evidence gate for the per-pand modern walls (#120, after #117 shipped `modern-pand-walls.json` empty).
 *
 * scripts/buurt-profiles/sample-panos.ts --modern renders a 320 px panorama thumbnail at the front's middle, pitched to
 * the upper storeys, and measures the centre 192 px box. Close and steep views look up under balconies and galleries:
 * Haarlemmer Houttuinen pand 0363100012185423 (8.6 m, pitch 39) read balcony shadow as a dark grey wall (78,83,83), which
 * the sampler called render and derive.ts drew as dark brick. The gate measures, per sample:
 *
 *   distM, pitch   from the sample (the pitch from the thumbnail URL);
 *   shadow         share of the measured (non-sky, non-leaf, not burnt) centre-box pixels that are dark and colourless
 *                  (CIE L* < SHADOW_L, C* < SHADOW_C): soffits, recesses and deep shade, not wall;
 *   agree          the sampler's masonry family (cropWallColour.masonryFamily of the wall) against derive's material
 *                  (paint when `thumbPainted`): render <-> paint and brick/buff <-> brick agree; a null family agrees
 *                  with either.
 *
 * Every threshold is chosen from the measured spread of the 3,334 modern samples (scripts/buurt-profiles/thumb-gate.ts
 * prints it) and documented at its constant.
 */
import { lch, masonryFamily, type MasonryFamily } from '../facade/cropWallColour.ts';
import { pixelKind } from '../look/brickTone.ts';

export const THUMB_EVIDENCE = {
  /** Dark and colourless: under this L* and C* a thumbnail pixel is shade, not a wall colour (the colourless dark walls
   * that disagree read L* 31 C* 3 median; coherent brick reads L* 40 C* 12). */
  shadowL: 30,
  shadowC: 8,
  /** Pitch and distance (2026-10-30 spread over 3,334 samples): the measured brick L* median stays at 30.6-34.3 across
   * pitch bins 5-46 deg and 29.1-34.8 across distance bins 4-26 m, and the family/material disagreement at 51-62 % in
   * every bin, so neither predicts a bad read on its own. The limits are the sampler's own bounds (pitch clamped to 45,
   * 4-25 m in front of the edge, so up to 28 m away with the 0.5 lateral allowance); a sample outside them comes from another sampler and is not trusted. */
  maxPitchDeg: 45,
  minDistM: 4,
  maxDistM: 28,
  /** Shadow: the 1,401 samples whose family and material agree read 0.053 median, 0.241 p90, 0.317 p95; the 1,933 that
   * disagree read 0.304 median. The brick L* median falls from 44.6 (shadow < 0.05) to 20.8 (> 0.6). The limit is the
   * agreeing samples' p90, rounded: a wall darker in shade than 9 in 10 coherent reads is not measured. */
  maxShadow: 0.25,
} as const;

/** derive.ts's material call for a thumbnail wall (`photoPainted`, plus the modern pass's light fronts). */
export function thumbPainted(wall: readonly number[], modern: boolean): boolean {
  const c = lch(wall);
  return (c.L >= 62 && c.C < 14) || (c.L >= 40 && c.h > 100 && c.h < 250 && c.C < 12) || (modern && c.L >= 66);
}

/** The thumbnail view from a sample URL (`...&fov=36&heading=214&pitch=39`). */
export function thumbView(url: string): { fov: number; heading: number; pitch: number } | null {
  const q = (k: string) => { const m = url.match(new RegExp(`[?&]${k}=(-?[\\d.]+)`)); return m ? Number(m[1]) : NaN; };
  const v = { fov: q('fov'), heading: q('heading'), pitch: q('pitch') };
  return Number.isFinite(v.pitch) ? v : null;
}

/** Shadow share of the measured pixels of a crop (interleaved, `channels` per pixel). */
export function shadowShare(data: ArrayLike<number>, channels: number): { shadow: number; measured: number } {
  let measured = 0, dark = 0;
  for (let i = 0; i + 2 < data.length; i += channels) {
    const r = data[i], g = data[i + 1], b = data[i + 2], k = pixelKind(r, g, b);
    if (k === 'sky' || k === 'burnt' || k === 'leaf') continue;
    measured++;
    const c = lch([r, g, b]);
    if (c.L < THUMB_EVIDENCE.shadowL && c.C < THUMB_EVIDENCE.shadowC) dark++;
  }
  return { shadow: measured ? +(dark / measured).toFixed(3) : 1, measured };
}

/** Does the sampler's family agree with derive's material? */
export function materialAgrees(family: MasonryFamily | null | undefined, painted: boolean): boolean {
  if (!family) return true;
  return family === 'render' ? painted : !painted;
}

export interface ThumbEvidence { distM: number; pitch: number; shadow: number; agree: boolean }
export interface ThumbVerdict { pass: boolean; reasons: string[] }

export function thumbVerdict(e: ThumbEvidence): ThumbVerdict {
  const t = THUMB_EVIDENCE, reasons: string[] = [];
  if (e.pitch > t.maxPitchDeg) reasons.push(`pitch ${e.pitch} deg > ${t.maxPitchDeg}`);
  if (e.distM < t.minDistM || e.distM > t.maxDistM) reasons.push(`${e.distM} m from the front outside ${t.minDistM}-${t.maxDistM} m`);
  if (e.shadow > t.maxShadow) reasons.push(`shadow ${Math.round(e.shadow * 100)} % > ${Math.round(t.maxShadow * 100)} %`);
  if (!e.agree) reasons.push('sampler family and derive material disagree');
  return { pass: !reasons.length, reasons };
}

export { masonryFamily };
