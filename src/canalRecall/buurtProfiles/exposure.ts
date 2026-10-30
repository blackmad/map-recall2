/**
 * Photo exposure for the buurt profiles on ONE shared reference (GitHub #118).
 *
 * The first profiles (#102) moved each photo source (panorama walls, panorama thumbnails, block-face types) so that
 * its own city-wide brick median landed on the city palette. A source whose samples come mostly from a few dark
 * buurten (the block faces: De Pijp, Oud-West) then had exactly those buurten lifted to the city level, and the user
 * asked the opposite (2026-10-29: "if it's darker let it be darker").
 *
 * Here every source is first brought into the frame of a reference source (the panorama thumbnails: 20 fronts per
 * buurt across the whole inner city, so their median is not one district's) by the offset measured on pands that
 * both sources cover. Only then does one city-wide transform, the same for every buurt and every source, move the
 * reference frame to the city palette (lightness lift, chroma ratio, hue rotation). A buurt therefore keeps its
 * measured difference from the city, whichever source measured it. Only physically impossible brick is clamped
 * (glare above L* 72, deep shadow below L* 14, greyer than C* 12, louder than the brick family's bound).
 */

export type Lab = number[];
export type ExposureSample = { pand: string; source: string; lab?: Lab; painted?: boolean };
/** A source's offset into the reference frame: L* added, chroma multiplied, hue rotated (degrees). */
export type SourceShift = { dL: number; chroma: number; dh: number; n: number; pairs: number; via: 'reference' | 'overlap' | 'median' | 'none' };
export type CityTransform = { lift: number; chroma: number; dh: number };
export type ExposureModel = { reference: string; referenceMedian: { L: number; C: number; h: number }; target: { L: number; C: number; h: number }; city: CityTransform; sources: Record<string, SourceShift> };

/** Fewer shared pands than this and a source falls back to median-to-median against the reference. */
export const MIN_PAIRS = 8;

export const median = (v: number[]): number => { const s = [...v].sort((a, b) => a - b); return s.length ? s[s.length >> 1] : NaN; };
export const hueOf = (l: Lab): number => (Math.atan2(l[2], l[1]) * 180 / Math.PI + 360) % 360;
export const chromaOf = (l: Lab): number => Math.hypot(l[1], l[2]);
/** Signed angular difference a - b in (-180, 180]. */
export const hueDiff = (a: number, b: number): number => ((a - b + 540) % 360) - 180;
/** Circular median: the sample hue minimising the summed angular distance (over the first 400, as #102 fitted it). */
export const hueMedian = (hs: number[]): number => {
  const xs = hs.slice(0, 400);
  return xs.length ? xs.reduce((best, h) => { const d = xs.reduce((s, x) => s + Math.abs(hueDiff(x, h)), 0); return d < best.d ? { h, d } : best; }, { h: xs[0], d: Infinity }).h : 0;
};
const bricksOf = (samples: ExposureSample[], source: string) => samples.filter(s => s.source === source && s.lab && !s.painted);

/**
 * Fit the exposure model. `target` is the city palette's brick (L, C, h); `chromaShare` scales its chroma (the
 * photos' brick is never as loud as the palette's orange). The reference defaults to the source with most bricks.
 */
export function fitExposure(samples: ExposureSample[], target: { L: number; C: number; h: number }, opts: { reference?: string; chromaShare?: number; liftShare?: number } = {}): ExposureModel {
  const sources = [...new Set(samples.map(s => s.source))];
  const reference = opts.reference ?? sources.sort((a, b) => bricksOf(samples, b).length - bricksOf(samples, a).length)[0];
  const refBricks = bricksOf(samples, reference);
  const refByPand = new Map<string, Lab>(); for (const s of refBricks) if (!refByPand.has(s.pand)) refByPand.set(s.pand, s.lab!);
  const referenceMedian = { L: median(refBricks.map(l => l.lab![0])), C: median(refBricks.map(l => chromaOf(l.lab!))), h: hueMedian(refBricks.map(l => hueOf(l.lab!))) };
  const out: Record<string, SourceShift> = {};
  for (const src of sources) {
    const bricks = bricksOf(samples, src);
    if (src === reference) { out[src] = { dL: 0, chroma: 1, dh: 0, n: bricks.length, pairs: bricks.length, via: 'reference' }; continue; }
    const pairs = bricks.filter(s => refByPand.has(s.pand)).map(s => [refByPand.get(s.pand)!, s.lab!] as const);
    if (pairs.length >= MIN_PAIRS) {
      const coloured = pairs.filter(([r, l]) => chromaOf(r) >= 3 && chromaOf(l) >= 3);
      out[src] = {
        dL: median(pairs.map(([r, l]) => r[0] - l[0])),
        chroma: coloured.length >= MIN_PAIRS ? median(coloured.map(([r, l]) => chromaOf(r) / chromaOf(l))) : referenceMedian.C / median(bricks.map(l => chromaOf(l.lab!))),
        dh: coloured.length >= MIN_PAIRS ? median(coloured.map(([r, l]) => hueDiff(hueOf(r), hueOf(l)))) : 0,
        n: bricks.length, pairs: pairs.length, via: 'overlap',
      };
    } else if (bricks.length >= 10) {
      // No shared pands: median to median against the reference (the old behaviour, but onto the reference frame).
      out[src] = { dL: referenceMedian.L - median(bricks.map(l => l.lab![0])), chroma: referenceMedian.C / median(bricks.map(l => chromaOf(l.lab!))), dh: hueDiff(referenceMedian.h, hueMedian(bricks.map(l => hueOf(l.lab!)))), n: bricks.length, pairs: pairs.length, via: 'median' };
    } else out[src] = { dL: 0, chroma: 1, dh: 0, n: bricks.length, pairs: pairs.length, via: 'none' };
  }
  const city: CityTransform = { lift: (opts.liftShare ?? 1) * (target.L - referenceMedian.L), chroma: (opts.chromaShare ?? 1) * target.C / referenceMedian.C, dh: hueDiff(target.h, referenceMedian.h) };
  return { reference, referenceMedian, target, city, sources: out };
}

/** Brick hues stay red to brown (Lab hue 32-56; #102 sheets: 24 drew salmon-pink, 66 ochre); a near-grey wall's hue is noise and takes the city's. */
export const brickHue = (h: number): number => { const x = ((h % 360) + 360) % 360; return x > 200 ? 32 : Math.max(32, Math.min(56, x)); };

/** One measured colour -> city frame. Painted walls keep half their measured tint (white balance casts) and take the lightness only. */
export function applyExposure(model: ExposureModel, source: string, lab: Lab, painted = false): Lab {
  const s = model.sources[source] ?? { dL: 0, chroma: 1, dh: 0, via: 'none' as const };
  const [L, a, b] = lab;
  const L2 = Math.max(14, Math.min(92, L + s.dL + model.city.lift));
  if (painted) return [L2, a * 0.5, b * 0.5];
  if (s.via === 'none') return [L2, a, b];
  // Bare brick is never lighter than L* 72 (sun glare or a pale stone band) nor greyer than C* 12 (a shaded wall's
  // lost colour; its hue still says red or brown), and stays inside cropWallColour's brick family (C* <= 0.9 L* + 8).
  const Lb = Math.min(72, L2);
  const C = Math.max(12, Math.min(34, 0.9 * Lb + 8, chromaOf(lab) * s.chroma * model.city.chroma));
  const h = brickHue(chromaOf(lab) < 4 ? model.target.h : hueOf(lab) + s.dh + model.city.dh) * Math.PI / 180;
  return [Lb, C * Math.cos(h), C * Math.sin(h)];
}
