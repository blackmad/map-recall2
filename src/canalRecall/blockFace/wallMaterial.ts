/**
 * Wall material read off a strip span (block-face libs round 2, #113, 2026-11-09). The type match scored `stucco` as a
 * weighted criterion only, so a front the strip reads as grey render or black paint still placed a brick type whose
 * tint fit then drew it brick-red or green (Jordaan Bloemgrachtbuurt review, Oct 29). `stripWallMaterial` classifies the
 * span from stripPalette's own readings; `match.materialVeto` on a type turns a mismatch into a veto. Absent = no change.
 */
import {rgbToHsl, type Rgb} from './wallColour.ts';

export type WallMaterial = 'brick' | 'render' | 'black-paint';

export const WALL_MATERIAL = {
  /**
   * Black (or very dark neutral) paint: the trim-normalised wall (StripEvidence.wall, exposure independent) under this HSL
   * lightness and saturation. Calibrated on every auto-placed pand of 4,578 in the faces (2026-11-09): at 0.12 / 0.12 ten
   * pands read, all held already; at 0.15 / 0.10 one placed Helmersbuurt pand (161340) reads, at 0.2 / 0.2 twenty-one
   * placed brick pands do. Dark brick is not told from black paint by tone alone, hence the tight limits.
   */
  blackLight: 0.12,
  blackSat: 0.12,
} as const;

/** The material the span's wall reads as, or null when the span has no wall reading. */
export function stripWallMaterial(p: {stucco: boolean; wall: string | null}): {material: WallMaterial; why: string} | null {
  if (p.stucco) return {material: 'render', why: 'painted/render wall (accent share over the stucco threshold)'};
  if (!p.wall || !/^#[0-9a-f]{6}$/i.test(p.wall)) return null;
  const hsl = rgbToHsl([1, 3, 5].map(i => parseInt(p.wall!.slice(i, i + 2), 16)) as Rgb);
  if (hsl[2] < WALL_MATERIAL.blackLight && hsl[1] < WALL_MATERIAL.blackSat) return {material: 'black-paint', why: `near-black neutral wall ${p.wall}`};
  return {material: 'brick', why: 'brick wall'};
}

/** Vetoes of a type for a wall material: render needs `stucco: true` types, black paint needs `blackPaint: true`. */
export function materialVetoes(rule: {stucco?: boolean; blackPaint?: boolean; materialVeto?: true}, read: ReturnType<typeof stripWallMaterial>): string[] {
  if (!rule.materialVeto || !read) return [];
  if (read.material === 'render' && rule.stucco !== true) return [`strip reads ${read.why}, a brick type`];
  if (read.material === 'black-paint' && !rule.blackPaint) return [`strip reads ${read.why}, not a painted type`];
  return [];
}
