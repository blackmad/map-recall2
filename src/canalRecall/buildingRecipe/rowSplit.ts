/**
 * Row split for the large kit (intent `walls[].houses`): a BAG pand that is really a row of separate houses (own widths,
 * eaves, storeys, crowns and wall colours) on one 3DBAG wall panel. Pure helpers shared by the fit (fitLarge.ts), the
 * compile (largeCompile.ts) and the measurement writeback (measure.ts):
 *
 * - `houseCuts`: the panel cut at the houses' cumulative shares;
 * - `spanEaves` / `spanTop`: a house's eaves and wall top read off the 3DBAG wall over its own span (the large tier's
 *   85 % rule, `panelEaves`, restricted to the span);
 * - `rowCoherence`: an unmeasured lone eaves more than 0.8 m off the row line, between neighbours on it, takes the line;
 * - `rowSegments`: the measured joints of a front: piecewise-constant wall colour along the crop (dynamic programming
 *   over 1 m strips), merged where neighbours are within dE76 12;
 * - `roofSteps`: joints from the 3DBAG roof heights just behind the front (steps of 1.5 m or more);
 * - `proposeHouses`: a `houses` list only on clear evidence (two or more joints: dE76 >= 20, or a colour change on a
 *   roof step; every house at least 3 m wide).
 */
import {insidePanel, type Panel} from '../blockBuilding/panels.ts';
import type {LargeHouseIntent} from './intent.ts';
import {roofHeightAt} from './facts.ts';

type Rgb = [number, number, number];
const r3 = (v: number) => Math.round(v * 1000) / 1000;
const median = (v: number[]) => { if (!v.length) return 0; const s = [...v].sort((a, b) => a - b); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };

/** Cut positions (u, panel metres) between the houses, from their shares (normalised) over [uMin, uMax]. */
export function houseCuts(uMin: number, uMax: number, shares: number[]): number[] {
  const total = shares.reduce((a, b) => a + b, 0), W = uMax - uMin, out: number[] = [];
  let acc = 0;
  for (let k = 0; k + 1 < shares.length; k++) { acc += shares[k]; out.push(r3(uMin + W * acc / total)); }
  return out;
}

/**
 * The line most of a span stands on: the modal 0.3 m bin of the heights (ties to the lower bin), the bin's median; null
 * when that bin holds under 30 % of the values (no line: a zigzag of gables or a stepped top).
 */
export function modalLine(values: number[]): number | null {
  if (!values.length) return null;
  const bins = new Map<number, number[]>();
  for (const v of values) { const b = Math.floor(v / 0.3); bins.set(b, [...(bins.get(b) ?? []), v]); }
  // a bin and its upper neighbour count together (a line at a bin edge)
  let best: number[] = [];
  for (const b of [...bins.keys()].sort((x, y) => x - y)) { const vs = [...bins.get(b)!, ...(bins.get(b + 1) ?? [])]; if (vs.length > best.length) best = vs; }
  return best.length >= values.length * 0.3 ? r3(median(best)) : null;
}

/**
 * A house's eaves on the 3DBAG wall over [u0, u1]: the line most of its 0.25 m columns top out on (`modalLine`: a flat
 * cornice front whose LoD2.2 wall has a notch or a raised corner keeps its line), else the highest height at which the
 * wall still spans 85 % of the span (the large tier's `panelEaves` rule: a gable wall's eaves, not its apex).
 */
export function spanEaves(p: Panel, u0: number, u1: number): number {
  const cols: number[] = [];
  for (let u = u0 + 0.125; u < u1; u += 0.25) cols.push(spanTop(p, u - 0.1, u + 0.1));
  const line = modalLine(cols);
  if (line !== null) return line;
  const W = u1 - u0, top = spanTop(p, u0, u1);
  for (let v = top - 0.05; v > p.vMin + 0.5; v -= 0.1) {
    let hit = 0;
    for (let k = 0; k < 20; k++) if (insidePanel(p, [u0 + W * (k + 0.5) / 20, v])) hit++;
    if (hit >= 17) return r3(Math.min(top, v + 0.05));
  }
  return r3(top);
}

/** Highest wall point over [u0, u1] (0.25 m columns). */
export function spanTop(p: Panel, u0: number, u1: number): number {
  let top = p.vMin;
  for (let u = u0 + 0.125; u < u1; u += 0.25) for (let v = p.vMax; v > top; v -= 0.05) if (insidePanel(p, [u, v])) { top = v; break; }
  return r3(top);
}

export interface RowClamp { house: number; fromM: number; toM: number }
/**
 * Row coherence (memory "row coherence", block-face rowCoherence.ts for the large kit): the row line is the median eaves;
 * a house whose eaves stand more than `thresholdM` off it, while its neighbours (one at a row end) stand within half that of
 * it, is a lone outlier (LoD2.2 read a rear roof or a dormer as its eaves) and takes the line, unless `keep[k]` (a
 * hand storey count or `ownEaves`: the photo skyline confirms it).
 */
export function rowCoherence(eaves: number[], keep: boolean[], thresholdM = 0.8): {eaves: number[]; clamps: RowClamp[]} {
  if (eaves.length < 3) return {eaves: [...eaves], clamps: []};
  const line = median(eaves), out = [...eaves], clamps: RowClamp[] = [];
  const onLine = (k: number) => k < 0 || k >= eaves.length || Math.abs(eaves[k] - line) <= thresholdM / 2;
  eaves.forEach((e, k) => {
    if (keep[k] || Math.abs(e - line) <= thresholdM || !onLine(k - 1) || !onLine(k + 1)) return;
    out[k] = r3(line); clamps.push({house: k, fromM: e, toM: r3(line)});
  });
  return {eaves: out, clamps};
}

const dE = (a: Rgb, b: Rgb) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
/** Joint: a cut between strips `at` (fraction of the strip run) with the colours on both sides. */
export interface RowSegment { from: number; to: number; lab: Rgb }
/**
 * Piecewise-constant segmentation of the wall colour along a front: `labs[i]` is the Lab median of strip i (null when the
 * strip has too few wall cells; it joins whichever side it falls in). Least squares with a penalty per segment (dynamic
 * programming, segments at least `minStrips` long), then neighbours closer than `mergeDE` are merged. Returns the
 * segments as fractions of the strip run. One segment = no joint.
 */
export function rowSegments(labs: (Rgb | null)[], opts: {minStrips?: number; penalty?: number; mergeDE?: number} = {}): RowSegment[] {
  const n = labs.length, minS = opts.minStrips ?? 3, pen = opts.penalty ?? 300, mergeDE = opts.mergeDE ?? 12;
  const ok = labs.map(l => l !== null);
  if (ok.filter(Boolean).length < minS * 2) return n && ok.some(Boolean) ? [{from: 0, to: 1, lab: medLab(labs.filter((l): l is Rgb => l !== null))}] : [];
  // cost(i, j): SSE of strips i..j-1 round their median
  const cost = (i: number, j: number) => { const ls = labs.slice(i, j).filter((l): l is Rgb => l !== null); if (!ls.length) return 0; const m = medLab(ls); return ls.reduce((a, l) => a + dE(l, m) ** 2, 0); };
  const best = new Array(n + 1).fill(Infinity), from = new Array(n + 1).fill(-1);
  best[0] = 0;
  for (let j = minS; j <= n; j++) for (let i = 0; i <= j - minS; i++) {
    if (best[i] === Infinity || (i > 0 && i < minS)) continue;
    const c = best[i] + cost(i, j) + pen;
    if (c < best[j]) { best[j] = c; from[j] = i; }
  }
  let cuts: number[] = [];
  for (let j = n; j > 0 && from[j] >= 0; j = from[j]) cuts.unshift(from[j]);
  if (!cuts.length || cuts[0] !== 0) cuts = [0];
  const bounds = [...cuts, n];
  let segs = bounds.slice(0, -1).map((a, k) => ({a, b: bounds[k + 1]}));
  // merge neighbours whose colours are within mergeDE (the same material read twice)
  const labOf = (s: {a: number; b: number}) => medLab(labs.slice(s.a, s.b).filter((l): l is Rgb => l !== null));
  for (let merged = true; merged && segs.length > 1;) {
    merged = false;
    let bestK = -1, bestD = mergeDE;
    for (let k = 0; k + 1 < segs.length; k++) { const d = dE(labOf(segs[k]), labOf(segs[k + 1])); if (d < bestD) { bestD = d; bestK = k; } }
    if (bestK >= 0) { segs.splice(bestK, 2, {a: segs[bestK].a, b: segs[bestK + 1].b}); merged = true; }
  }
  return segs.map(s => ({from: r3(s.a / n), to: r3(s.b / n), lab: labOf(s).map(v => +v.toFixed(1)) as Rgb}));
}
function medLab(ls: Rgb[]): Rgb { return [0, 1, 2].map(c => median(ls.map(l => l[c]))) as Rgb; }

/** Joints (fractions of the run) where the roof height behind the front steps by `stepM` or more between samples. */
export function roofSteps(heights: (number | null)[], stepM = 1.5): number[] {
  const out: number[] = [], n = heights.length;
  for (let i = 1; i < n; i++) { const a = heights[i - 1], b = heights[i]; if (a !== null && b !== null && Math.abs(a - b) >= stepM) out.push(r3(i / n)); }
  return out;
}

export interface HouseEvidence {
  /** the main panel's width (m) */
  widthM: number;
  /** colour segments along the panel (fractions of the panel width from uMin, `rowSegments` mapped onto the panel) */
  colour: {from: number; to: number; hex: string}[];
  /** roof-height joints along the panel (fractions, `roofSteps`) */
  roof: number[];
  /** the group's bay pitch (m) */
  pitchM: number;
  /** usable share of the crop (colour evidence counts only from 0.6) */
  usable: number;
}
/** Colour joints count alone from this dE76; weaker ones (from `rowSegments`' merge floor, 12) only with a roof step within 1 m. */
export const ROW_JOINT_DE = 20;
/**
 * A `houses` list from the evidence, or null. A joint is a colour change of dE76 >= 20 (from a usable crop), or a weaker
 * colour change confirmed by a roof step within 1 m (>= 1.5 m, `roofSteps`); a roof step alone is not one. Proposed only on
 * clear evidence: at least two joints (three houses), every house at least 3 m wide. Each house takes the colour of the
 * segment covering most of it (from a usable crop) and its bays from the pitch.
 */
export function proposeHouses(e: HouseEvidence): {houses: LargeHouseIntent[]; joints: {at: number; by: string}[]} | null {
  const joints: {at: number; by: string}[] = [], near = (a: number, b: number) => Math.abs(a - b) * e.widthM < 1;
  const colourOk = e.usable >= 0.6;
  if (colourOk) e.colour.slice(1).forEach((s, k) => {
    const d = dE(hexLab(e.colour[k].hex), hexLab(s.hex)), roofed = e.roof.some(r => near(r, s.from));
    if (d >= ROW_JOINT_DE || roofed) joints.push({at: s.from, by: roofed ? `colour dE ${d.toFixed(0)} + roof step` : `colour dE ${d.toFixed(0)}`});
  });
  // a roof step alone is not a joint: LoD2.2 steps at dormers, lift housings and mansard tops inside one front
  joints.sort((a, b) => a.at - b.at);
  if (joints.length < 2) return null;
  const bounds = [0, ...joints.map(j => j.at), 1];
  if (bounds.some((b, k) => k > 0 && (b - bounds[k - 1]) * e.widthM < 3)) return null;
  const houses = bounds.slice(0, -1).map((a, k): LargeHouseIntent => {
    const b = bounds[k + 1], over = (s: {from: number; to: number}) => Math.max(0, Math.min(b, s.to) - Math.max(a, s.from));
    const seg = colourOk ? [...e.colour].sort((x, y) => over(y) - over(x))[0] : undefined;
    return {w: r3(b - a), bays: Math.max(1, Math.round((b - a) * e.widthM / Math.max(0.8, e.pitchM))), ...(seg ? {brick: seg.hex} : {})};
  });
  return {houses, joints};
}

/** Roof heights (m over the ground) 0.3 m behind the panel, every 0.5 m along it (null where no roof): `roofSteps`' input. */
export function roofProfile(roofsRD: Parameters<typeof roofHeightAt>[0], groundNAP: number, anchorRD: [number, number], p: Pick<Panel, 'o' | 'r' | 'n' | 'uMin' | 'uMax'>): (number | null)[] {
  const out: (number | null)[] = [], [ax, ay] = anchorRD;
  for (let u = p.uMin + 0.25; u < p.uMax; u += 0.5) {
    const x = p.o[0] + p.r[0] * u - p.n[0] * 0.3, z = p.o[2] + p.r[2] * u - p.n[2] * 0.3;
    out.push(roofHeightAt(roofsRD, [ax + x, ay - z], groundNAP));
  }
  return out;
}

const lin = (c: number) => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
/** #rrggbb -> CIE Lab (D65), as measureFacade's rgbToLab. */
export function hexLab(hex: string): Rgb {
  const [R, G, B] = [1, 3, 5].map(i => lin(parseInt(hex.slice(i, i + 2), 16)));
  const x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047, y = R * 0.2126 + G * 0.7152 + B * 0.0722, z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}
