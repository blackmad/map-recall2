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
export const BRIGHT = { minL: 85, maxC: 10, share: 0.2, warmL: [45, 65], warmMaxA: 12 } as const;
/** A cluster this chromatic (in the thumbnail's frame) with a warm hue is brick, not glass or shade. */
export const WARM_CHROMA = 3.5;
/** Accept a measurement only with this share for its cluster, this many kept pixels and at most this leaf share. */
export const ACCEPT = { share: 0.15, pixels: 1500, leaf: 0.35 } as const;

export type WallPatch = { shaded: boolean; kind: 'paint' | 'brick' | 'unsure'; clusters: Array<[number, number, number, number]>; hex: string; painted: boolean; share: number; kept: number; leafShare: number; L: number; a: number; b: number; accepted: boolean };

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
  // Round 4: sunlit white render broken up by glazing (Nieuwe Kerkstraat 105-111: white 22 %, a sun-warmed L* 52 warm
  // cluster 22 %) reads as paint when a bright low-chroma cluster holds BRIGHT.share and the warm pick is mid-lightness.
  // Dark red brick (L* < BRIGHT.warmL[0]) with white frames and light buff brick (L* >= BRIGHT.warmL[1]) keep their brick,
  // and so does sunlit red brick (a* >= BRIGHT.warmMaxA: Sarphatistraat 62, a* 18 under white frames and sky; the
  // sun-warmed render and curtains at Nieuwe Kerkstraat measure a* 7).
  const bright = order.find(k => centres[k][0] >= BRIGHT.minL && chroma(k) < BRIGHT.maxC && shareOf(k) >= BRIGHT.share);
  const sunlitRender = paint === undefined && warm !== undefined && bright !== undefined && centres[warm][0] >= BRIGHT.warmL[0] && centres[warm][0] < BRIGHT.warmL[1] && centres[warm][1] < BRIGHT.warmMaxA;
  const pick = paint ?? (sunlitRender ? bright : undefined) ?? warm ?? order[0];
  const members = keep.filter((_, i) => assign[i] === pick);
  const r = median(members.map(m => m.rgb[0])), g = median(members.map(m => m.rgb[1])), b = median(members.map(m => m.rgb[2]));
  const [L, A, B] = rgbToLab([r, g, b]);
  const share = members.length / keep.length;
  const painted = pick === paint || (sunlitRender && pick === bright);
  const kind = painted ? 'paint' : warm !== undefined ? 'brick' : 'unsure';
  const clusters = order.map(k => [Math.round(centres[k][0]), Math.round(centres[k][1]), Math.round(centres[k][2]), +shareOf(k).toFixed(2)] as [number, number, number, number]);
  // Round 5: brick measured in shade at low chroma cannot tell buff from red (Mauritskade 17, tan-brown in shade: raw
  // L* 35, C* 6, hue 43, the signature of shaded red brick too); it is not accepted, and measure-walls.ts looks for a
  // sunlit capture of the same front instead.
  const shaded = kind === 'brick' && isShadedRaw([L, A, B]);
  return { shaded, kind, clusters, hex: `#${hex2(r)}${hex2(g)}${hex2(b)}`, painted, share: +share.toFixed(3), kept: keep.length, leafShare: +leafShare.toFixed(3), L: Math.round(L), a: Math.round(A), b: Math.round(B),
    accepted: kind !== 'unsure' && !shaded && share >= ACCEPT.share && keep.length >= ACCEPT.pixels && leafShare <= ACCEPT.leaf };
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
/**
 * Buff, yellow and grey-buff brick in the thumbnail's frame (round 3): light and yellow (L* >= minL, hue >= minHue), or
 * clearly yellow at a mid lightness (hue >= yellowHue, L* >= yellowMinL), with some chroma, hue at most maxHue. The #118
 * brick branch caps L* at 60, rotates hue -18 deg and clamps it to 32-56 deg: built for 19th-century red brick, it drew
 * Spitsbergenstraat 2-36's yellow brick (raw #e9ccad) a pink tan #ac8976 and Funenpark 440-463's grey-buff (raw #6f685d)
 * a warm brown #826250, the round-2 blind's only kit regression. These keep their own lightness (to maxL), hue (clamped
 * to the buff band) and chroma (in minC-maxC). Only the postwar path calls this; applyExposure and the buurt profiles
 * are untouched.
 * Round 5: buff is a low-to-mid chroma brick (the read buff fronts measure raw C* 20-26); strongly chromatic light brick
 * (raw C* >= maxRawC: red brick in full sun measures L* 83, C* 33-36) stays on the red-brick path.
 */
export const BUFF = { minL: 65, minHue: 65, yellowHue: 80, yellowMinL: 40, maxHue: 110, minRawC: 3, maxRawC: 30, maxL: 78, minC: 8, maxC: 30, hue: [65, 90] } as const;
const lchOf = (lab: readonly number[]) => [lab[0], Math.hypot(lab[1], lab[2]), (Math.atan2(lab[2], lab[1]) * 180 / Math.PI + 360) % 360];
export function isBuffRaw(lab: readonly number[]): boolean {
  const [L, C, h] = lchOf(lab);
  return C >= BUFF.minRawC && C < BUFF.maxRawC && h <= BUFF.maxHue && ((L >= BUFF.minL && h >= BUFF.minHue) || (L >= BUFF.yellowMinL && h >= BUFF.yellowHue));
}
export function calibrateThumb(hex: string, painted: boolean, paintCast: readonly [number, number] = [0, 0]): string {
  const [L, a, b] = rgbToLab([1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)));
  if (!painted && isBuffRaw([L, a, b])) {
    const [, C, h] = lchOf([L, a, b]);
    const L2 = Math.min(BUFF.maxL, L), C2 = Math.max(BUFF.minC, Math.min(BUFF.maxC, C)), h2 = Math.max(BUFF.hue[0], Math.min(BUFF.hue[1], h)) * Math.PI / 180;
    return `#${labToRgb([L2, C2 * Math.cos(h2), C2 * Math.sin(h2)]).map(hex2).join('')}`;
  }
  const lab = painted ? applyExposure(THUMB_EXPOSURE, 'thumb', [L, a - paintCast[0], b - paintCast[1]], true)
    : ((l: number[]) => [l[0], l[1] * MODERN_BRICK_CHROMA, l[2] * MODERN_BRICK_CHROMA])(applyExposure(THUMB_EXPOSURE, 'thumb', [L, a, b]));
  return `#${labToRgb(lab).map(hex2).join('')}`;
}

/** Round 5: brick in shade at low chroma (raw C* < maxC, L* < maxL in the thumbnail's frame) is not a usable measurement. */
export const SHADED = { maxC: 8, maxL: 40 } as const;
export function isShadedRaw(lab: readonly number[]): boolean {
  return lab[0] < SHADED.maxL && Math.hypot(lab[1], lab[2]) < SHADED.maxC;
}
/** Round 5: a capture usable to rescue a shaded front: its brick measures at raw L* >= SUNLIT_MIN_L (and is not shaded). */
export const SUNLIT_MIN_L = 40;
export function isSunlitRaw(lab: readonly number[]): boolean {
  return lab[0] >= SUNLIT_MIN_L && !isShadedRaw(lab);
}

/**
 * Round 2 of the kit (lane postwar-kit-r2-20261121, item 1): one capture cannot call grey-brown against red, nor grey
 * brick at all. A low-chroma warm reading (raw C* < AMBIGUOUS.maxC) is a cast as often as a colour (Mariadistelkade 3-27:
 * grey-brown drawn red-brown; Lutmastraat 2-8: light buff drawn red-brown), and the #118 brick calibration triples its
 * chroma. So:
 *   - an ambiguous warm front is accepted only when every other usable capture of it (fetch-alternates.ts, other days)
 *     also reads warm brick; its colour is then the median of the captures' raw colours. A capture that reads grey or
 *     paint makes it unsure. With no other usable capture it stays only when its raw hue is clearly red (< AMBIGUOUS.hue).
 *   - an 'unsure' front is grey brick when two or more captures from different days each find a dominant low-chroma
 *     mid-light cluster (GREY) at lightnesses within GREY.agreeL: a shaded render or a one-off cast does not repeat.
 *     Its colour keeps its own lightness and low chroma (calibrateGrey), not the brick path's tripled chroma.
 */
export const AMBIGUOUS = { maxC: 12, hue: 60 } as const;
export const GREY = { maxC: 6, minL: 30, maxL: 75, share: 0.35, agreeL: 10, outC: 4 } as const;
export type CaptureClass = 'warm' | 'paint' | 'grey' | 'other';
type Usable = Pick<WallPatch, 'kind' | 'shaded' | 'clusters' | 'kept' | 'leafShare' | 'L' | 'a' | 'b'>;
export const usableCapture = (m: Usable | null | undefined): m is Usable => !!m && m.kept >= ACCEPT.pixels && m.leafShare <= ACCEPT.leaf;
export function captureClass(m: Usable): CaptureClass {
  if (m.kind === 'paint') return 'paint';
  if (m.kind === 'brick' && !m.shaded) return 'warm';
  const [L, a, b, share] = m.clusters[0] ?? [0, 0, 0, 0];
  if (Math.hypot(a, b) < GREY.maxC && L >= GREY.minL && L <= GREY.maxL && share >= GREY.share) return 'grey';
  return 'other';
}
export const isAmbiguousWarm = (m: Usable) => m.kind === 'brick' && !m.shaded && Math.hypot(m.a, m.b) < AMBIGUOUS.maxC;
const hueOf = (a: number, b: number) => (Math.atan2(b, a) * 180 / Math.PI + 360) % 360;
const med = (v: number[]) => { const s = [...v].sort((p, q) => p - q), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
export type Consensus = { verdict: 'warm' | 'grey' | 'unsure'; lab?: [number, number, number]; captures: number; classes: CaptureClass[] };
/** The call over a front's captures (primary first, then other days), for an ambiguous warm or an unsure primary. */
export function consensusOf(primary: Usable, alternates: ReadonlyArray<Usable | null>): Consensus {
  const all = [primary, ...alternates].filter(usableCapture);
  const classes = all.map(captureClass);
  const medLab = (ms: Usable[]): [number, number, number] => [med(ms.map(m => m.L)), med(ms.map(m => m.a)), med(ms.map(m => m.b))];
  if (captureClass(primary) === 'warm') {
    if (all.length < 2) return hueOf(primary.a, primary.b) < AMBIGUOUS.hue ? { verdict: 'warm', lab: [primary.L, primary.a, primary.b], captures: 1, classes } : { verdict: 'unsure', captures: 1, classes };
    if (classes.some(c => c === 'grey' || c === 'paint')) return { verdict: 'unsure', captures: all.length, classes };
    const warm = all.filter((_, i) => classes[i] === 'warm');
    if (warm.length < 2) return { verdict: 'unsure', captures: all.length, classes };
    return { verdict: 'warm', lab: medLab(warm), captures: all.length, classes };
  }
  const grey = all.filter((_, i) => classes[i] === 'grey');
  if (grey.length >= 2 && grey.length * 2 > all.length) {
    const Ls = grey.map(m => m.clusters[0][0]);
    if (Math.max(...Ls) - Math.min(...Ls) <= GREY.agreeL) {
      const c = grey.map(m => m.clusters[0]);
      return { verdict: 'grey', lab: [med(c.map(x => x[0])), med(c.map(x => x[1])), med(c.map(x => x[2]))], captures: all.length, classes };
    }
  }
  return { verdict: 'unsure', captures: all.length, classes };
}
/** Grey brick in today's frame: its own lightness (lifted like the brick path, L +0), chroma held at GREY.outC or less. */
export function calibrateGrey(lab: readonly [number, number, number]): string {
  const [L, a, b] = lab, C = Math.hypot(a, b), k = C > GREY.outC ? GREY.outC / C : 1;
  return `#${labToRgb([L, a * k, b * k]).map(hex2).join('')}`;
}
