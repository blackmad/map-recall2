/**
 * The wall colour of a front from its photographed pixels, brick-only (round 2 of lane postwar-housing-kit-20261120).
 *
 * The T0 per-pand modern walls (buurtProfiles/modern-pand-walls.json, scripts/buurt-profiles/sample-panos.ts) took one
 * brick-tone mode over a 320 px centre box: on the read fronts it averaged windows, frames and loggia shadow into the
 * wall (Bloemgracht 210-286: grey "paint" on red brick; Wibautstraat 31-55: #372622 on red-brown). Here the caller passes
 * only the pixels inside the wall's projected outline over its upper storeys (scripts/postwar-kit/measure-walls.ts), and:
 *   1. drops leaves, sky-blue glass reflections, burnt highlights and anything darker than L* 22 (glass, loggias, shadow);
 *   2. splits the rest into WALL_CLUSTERS by k-means in CIELAB, seeded on lightness quantiles (deterministic);
 *   3. takes a light low-chroma cluster holding PAINT_SHARE (render, paint), else the most chromatic warm cluster holding
 *      WARM_YIELD (brick: glass, frames and shade are neutral), else the largest, marked 'unsure' and never accepted
 *      (grey brick, cladding and render in shade all land there; the kit leaves today's draw for them);
 *   4. reports the cluster's median colour, its share of the kept pixels and whether it reads as paint.
 * Panorama thumbnails are low in chroma (overcast, haze: a red brick front measures a* 3-7), so the cluster choice works in
 * the photo's frame and calibrateThumb() then puts the colour in the frame today's measured walls use (derive.ts #118).
 */
import { labToRgb, rgbToLab } from '../look/brickTone.js';
import { applyExposure, type ExposureModel } from '../buurtProfiles/exposure.js';

export const MIN_L = 22;
export const WALL_CLUSTERS = 5;
export const WARM_YIELD = 0.15;
export const PAINT_SHARE = 0.35;
/** A cluster this chromatic (in the thumbnail's frame) with a warm hue is brick, not glass or shade. */
export const WARM_CHROMA = 3.5;
/** Accept a measurement only with this share for its cluster, this many kept pixels and at most this leaf share. */
export const ACCEPT = { share: 0.15, pixels: 1500, leaf: 0.35 } as const;

export type WallPatch = { kind: 'paint' | 'brick' | 'unsure'; clusters: Array<[number, number, number, number]>; hex: string; painted: boolean; share: number; kept: number; leafShare: number; L: number; a: number; b: number; accepted: boolean };

const hex2 = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
const median = (v: number[]) => { const s = [...v].sort((p, q) => p - q); return s[Math.floor(s.length / 2)] ?? 0; };

/** `rgb`: interleaved r, g, b (no alpha) of the wall's pixels. */
export function measureWallPatch(rgb: ArrayLike<number>): WallPatch | null {
  const keep: Array<{ rgb: [number, number, number]; lab: [number, number, number] }> = [];
  let leaf = 0, total = 0;
  for (let i = 0; i + 2 < rgb.length; i += 3) {
    const r = rgb[i], g = rgb[i + 1], b = rgb[i + 2]; total++;
    if (g > r + 3 && g > b + 3) { leaf++; continue; }
    if (b > r + 20 || (r >= 250 && g >= 250 && b >= 250)) continue;
    const lab = rgbToLab([r, g, b]) as [number, number, number];
    if (lab[0] < MIN_L) continue;
    keep.push({ rgb: [r, g, b], lab });
  }
  const leafShare = total ? leaf / total : 1;
  if (keep.length < 50) return null;
  // k-means in Lab, centres seeded on lightness quantiles.
  const byL = [...keep].sort((p, q) => p.lab[0] - q.lab[0]);
  let centres = Array.from({ length: WALL_CLUSTERS }, (_, k) => [...byL[Math.floor((k + 0.5) / WALL_CLUSTERS * byL.length)].lab]);
  const assign = new Int32Array(keep.length);
  for (let it = 0; it < 12; it++) {
    for (let i = 0; i < keep.length; i++) {
      const [L, A, B] = keep[i].lab; let best = 0, bd = Infinity;
      for (let k = 0; k < centres.length; k++) { const c = centres[k], d = (L - c[0]) ** 2 + (A - c[1]) ** 2 + (B - c[2]) ** 2; if (d < bd) { bd = d; best = k; } }
      assign[i] = best;
    }
    const sum = centres.map(() => [0, 0, 0, 0]);
    for (let i = 0; i < keep.length; i++) { const s = sum[assign[i]]; s[0] += keep[i].lab[0]; s[1] += keep[i].lab[1]; s[2] += keep[i].lab[2]; s[3]++; }
    centres = centres.map((c, k) => sum[k][3] ? [sum[k][0] / sum[k][3], sum[k][1] / sum[k][3], sum[k][2] / sum[k][3]] : c);
  }
  const sizes = centres.map((_, k) => { let n = 0; for (let i = 0; i < keep.length; i++) if (assign[i] === k) n++; return n; });
  const order = centres.map((_, k) => k).sort((p, q) => sizes[q] - sizes[p]);
  const chroma = (k: number) => Math.hypot(centres[k][1], centres[k][2]);
  const shareOf = (k: number) => sizes[k] / keep.length;
  // Paint: a light, low-chroma cluster holding PAINT_SHARE. Else brick: the most chromatic warm cluster with WARM_YIELD.
  // Else (grey brick, cladding): the largest.
  const paint = order.find(k => centres[k][0] >= 72 && chroma(k) < 14 && shareOf(k) >= PAINT_SHARE);
  const warm = order.filter(k => centres[k][1] >= 1.5 && centres[k][2] >= 2 && chroma(k) >= WARM_CHROMA && shareOf(k) >= WARM_YIELD).sort((p, q) => chroma(q) - chroma(p))[0];
  const pick = paint ?? warm ?? order[0];
  const members = keep.filter((_, i) => assign[i] === pick);
  const r = median(members.map(m => m.rgb[0])), g = median(members.map(m => m.rgb[1])), b = median(members.map(m => m.rgb[2]));
  const [L, A, B] = rgbToLab([r, g, b]);
  const share = members.length / keep.length;
  const painted = pick === paint;
  const kind = paint !== undefined ? 'paint' : warm !== undefined ? 'brick' : 'unsure';
  const clusters = order.map(k => [Math.round(centres[k][0]), Math.round(centres[k][1]), Math.round(centres[k][2]), +shareOf(k).toFixed(2)] as [number, number, number, number]);
  return { kind, clusters, hex: `#${hex2(r)}${hex2(g)}${hex2(b)}`, painted, share: +share.toFixed(3), kept: keep.length, leafShare: +leafShare.toFixed(3), L: Math.round(L), a: Math.round(A), b: Math.round(B),
    accepted: kind !== 'unsure' && share >= ACCEPT.share && keep.length >= ACCEPT.pixels && leafShare <= ACCEPT.leaf };
}

/**
 * The buurt profiles' calibration of a panorama-thumbnail colour (scripts/buurt-profiles/derive.ts, #118, run 2026-11-09:
 * thumb is the reference source; city transform L +0, C x5.56, h -18; the modern pass's brick takes MODERN_BRICK_CHROMA of
 * that; paint loses the source's paint cast and half its tint), so a corrected wall sits in the frame of the walls it replaces.
 */
export const THUMB_EXPOSURE: ExposureModel = {
  reference: 'thumb', referenceMedian: { L: 35, C: 5, h: 60 }, target: { L: 43.2, C: 36.9 * 0.75, h: 42 },
  city: { lift: 0, chroma: 5.56, dh: -18 }, sources: { thumb: { dL: 0, chroma: 1, dh: 0, n: 2697, pairs: 2697, via: 'reference' } },
};
export const MODERN_BRICK_CHROMA = 0.55;
export function calibrateThumb(hex: string, painted: boolean, paintCast: readonly [number, number] = [0, 0]): string {
  const [L, a, b] = rgbToLab([1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)));
  const lab = painted ? applyExposure(THUMB_EXPOSURE, 'thumb', [L, a - paintCast[0], b - paintCast[1]], true)
    : ((l: number[]) => [l[0], l[1] * MODERN_BRICK_CHROMA, l[2] * MODERN_BRICK_CHROMA])(applyExposure(THUMB_EXPOSURE, 'thumb', [L, a, b]));
  return `#${labToRgb(lab).map(hex2).join('')}`;
}
