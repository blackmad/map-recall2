/**
 * Buurt generator round 9: per-row measurements that scale to every drawn row (docs/handoffs/buurt-generators-20261115.md).
 * Pure; no I/O. scripts/buurt-generators/measure-walls.ts and measure-roofs.ts read the panoramas and AHN4 and stage
 * `districts/measured/<district>.json`; generate.ts reads it under the row and street notes.
 *
 *   wall   the brick of a row's ground-to-eaves band, from rectified street panoramas (the retail lane's measure-pui
 *          approach and gates, retailPuiPaint.ts: OKLab, cut and foliage gates, the vehicle gate; the brick the median of
 *          the band's warm pixels, else its k-means clusters), voted across
 *          at least two captures.
 *   roof   the roof form a street sees, from the AHN4 0.5 m DSM over a pand's footprint: flat, pitched (ridge along the
 *          street) or gabled to the street, and whether the free row ends are hipped.
 */
import { clusters, labHex, oklab, type Cluster, type Lab } from '../retailPuiPaint.ts';

/** The band read for the wall: from just over the pavement to just under the eaves, the inner share of the cut. */
export const WALL_BAND = { z0: 0.4, eavesGapM: 0.3, vehicleTopM: 2.4, halfWindowM: 12, inset: 0.08, ppm: 20 } as const;
/** Gates. `valid` and `leaf` are measure-pui's (PUI_GATE); `share` is the brick cluster's least share of the band; a
 *  cluster under `glassL` is glass or shadow, one over `whiteL` with chroma under `whiteC` white frames and sills (a
 *  white or cream wall is taken only when it holds `whiteShare`); `sky` drops blue reflections. */
export const WALL_GATE = { valid: 0.85, leaf: 0.08, share: 0.2, glassL: 0.27, whiteL: 0.8, whiteC: 0.03, whiteShare: 0.4, sky: { C: 0.025, h0: 200, h1: 290 } } as const;
/** Vote: two reads from distinct captures agree when their lightness differs by at most `dL` and their colour (a, b) by
 *  at most `dAB`. Lightness is looser, as sun and shade remain after the white balance (wallBrickOf); a different brick
 *  shows in the hue and chroma. */
export const WALL_VOTE = { dL: 0.1, dAB: 0.03, minReads: 2 } as const;

/**
 * Foliage, stricter than measureFacade's isLeaf: that one counts a spring leaf's pale yellow-green (g > r - 6), which a
 * yellow or buff brick also is (Amsterdam-Zuid's yellow brick reads r 190 g 185 b 130). Only green-dominant pixels count.
 */
export function isFoliage(r: number, g: number, b: number): boolean {
  const hi = Math.max(r, g, b), lo = Math.min(r, g, b);
  return hi - lo >= 12 && hi >= 25 && g >= r + 2 && g > b + 8;
}

export type BrickVerdict = { hex: string; lab: Lab; share: number; kind: 'brick' | 'pale' };
const hue = (c: Cluster) => ((Math.atan2(c.lab[2], c.lab[1]) * 180) / Math.PI + 360) % 360;
/** The wall's brick among the band's clusters: the largest one that is not glass, white trim or sky. Null when none holds
 *  `share` of the band. */
export function brickOf(cs: Cluster[]): BrickVerdict | null {
  const G = WALL_GATE;
  const ok = cs.filter(c => c.share >= G.share && c.lab[0] >= G.glassL && !(c.C >= G.sky.C && hue(c) >= G.sky.h0 && hue(c) <= G.sky.h1));
  const wall = ok.filter(c => !(c.lab[0] >= G.whiteL && c.C <= G.whiteC)).sort((p, q) => q.share - p.share)[0];
  if (wall) return { hex: labHex(wall.lab), lab: wall.lab, share: +wall.share.toFixed(3), kind: 'brick' };
  const pale = ok.filter(c => c.share >= G.whiteShare).sort((p, q) => q.share - p.share)[0];
  return pale ? { hex: labHex(pale.lab), lab: pale.lab, share: +pale.share.toFixed(3), kind: 'pale' } : null;
}
/** Warm pixels: the brick's own hues (red-brown through buff and yellow), clear of grey glass, white trim and sky. */
export const WARM = { h0: 15, h1: 110, C: 0.015, L0: 0.25, L1: 0.88, share: 0.25 } as const;
/**
 * The band's brick from its pixels (OKLab, foliage already dropped). Brick in these photos is a low-chroma spread over a
 * wide lightness range (sun, shade, mortar), which k-means cuts into lightness slices, the largest of them arbitrary
 * (Herculesstraat 131422: the slices L 0.36-0.70 hold 0.12-0.34 each). So the brick is the median of the band's warm
 * pixels when they hold `WARM.share` of it; a band without that much warm (render, concrete) falls to the clusters.
 */
/**
 * White balance and exposure from the band's own white trim. The three panorama cameras disagree: the 2025 recordings
 * read the white frames at L 0.70 with a cyan cast (a -0.021, b -0.020) and their brick grey (#584f47), the 2024 spheres
 * bright (white L 0.99), the 2021-22 TMX cameras between; but the brick's lightness over its white trim's is steady
 * (Herculesstraat 131422: 0.61, 0.62, 0.64, 0.66 across four captures of three cameras). The white is the band's
 * brightest `q` share; it counts only when it is near neutral and not warm over `warmC` (cream trim passes, a buff
 * wall's own sunlit face is warmer and must not be neutralised). With a white, the pixels lose its cast and the brick is drawn at its lightness over the
 * white times `targetL` (a white frame as the renderer draws it, retailPuiPaint's pale paint); without one the read
 * stays raw and says so.
 */
export const WHITE_REF = { q: 0.97, minL: 0.6, maxC: 0.04, warm: [15, 110], warmC: 0.025, targetL: 0.92, maxL: 0.85 } as const;
export type WhiteRef = { L: number; a: number; b: number } | null;
export function whiteRefOf(px: Lab[]): WhiteRef {
  if (px.length < 50) return null;
  const Ls = px.map(p => p[0]).sort((x, y) => x - y), cut = Ls[Math.floor(Ls.length * WHITE_REF.q)];
  const top = px.filter(p => p[0] >= cut), med = (k: 0 | 1 | 2) => { const v = top.map(p => p[k]).sort((x, y) => x - y); return v[v.length >> 1]; };
  const L = med(0), a = med(1), b = med(2), C = Math.hypot(a, b), h = ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
  if (L < WHITE_REF.minL || C > WHITE_REF.maxC || (C > WHITE_REF.warmC && h >= WHITE_REF.warm[0] && h <= WHITE_REF.warm[1])) return null;
  return { L, a, b };
}
/**
 * Round 11 hue guard (lane R's finding: 69 Rivierenbuurt and 21 Apollo/Stadion rows drawn under 36 deg, pink-mauve,
 * where the raw reads are browner; Rubensstraat lost its blind A/B on it). Removing a cyan camera cast adds red, and on
 * a dim band the trim's cast can be larger than the brick's own chroma. So the balance may move a read's hue at most
 * `maxRedShift` toward red: with a raw read of real chroma (`rawMinC`) the hue is held at raw - maxRedShift; a grey raw
 * read has no hue to keep, and a read pushed over maxRedShift is only kept out of the pink-mauve band (under `floorH`
 * or over `mauveH`), at floorH. Chroma and lightness stay the balanced ones.
 */
export const HUE_GUARD = { maxRedShift: 12, rawMinC: 0.012, floorH: 36, mauveH: 300 } as const;
const hueOfLab = (l: Lab) => ((Math.atan2(l[2], l[1]) * 180) / Math.PI + 360) % 360;
export function hueGuard(bal: Lab, raw: Lab): { lab: Lab; guard: 'raw' | 'floor' | null } {
  const hb = hueOfLab(bal), hr = hueOfLab(raw), C = Math.hypot(bal[1], bal[2]);
  const red = ((hr - hb + 540) % 360) - 180; // > 0: the balanced read is redder than the raw one
  const at = (h: number): Lab => [bal[0], C * Math.cos((h * Math.PI) / 180), C * Math.sin((h * Math.PI) / 180)];
  if (Math.hypot(raw[1], raw[2]) >= HUE_GUARD.rawMinC) return red > HUE_GUARD.maxRedShift ? { lab: at((hr - HUE_GUARD.maxRedShift + 360) % 360), guard: 'raw' } : { lab: bal, guard: null };
  // A grey raw read's hue (and so the direction of the move) means nothing: only a large move into pink-mauve is held.
  if (Math.abs(red) > HUE_GUARD.maxRedShift && (hb < HUE_GUARD.floorH || hb > HUE_GUARD.mauveH)) return { lab: at(HUE_GUARD.floorH), guard: 'floor' };
  return { lab: bal, guard: null };
}
/** The band's brick, balanced on its white trim when it has one (`balanced` true), else raw; hue-guarded (HUE_GUARD). */
export function wallBrickOf(px: Lab[]): (BrickVerdict & { balanced: boolean; raw: string; hueGuard?: 'raw' | 'floor' }) | null {
  const w = whiteRefOf(px);
  const v = brickOfPixels(w ? px.map(([L, a, b]) => [L, a - w.a, b - w.b] as Lab) : px);
  if (!v) return null;
  const rawLab: Lab = w ? [v.lab[0], v.lab[1] + w.a, v.lab[2] + w.b] : v.lab, raw = labHex(rawLab);
  if (!w) return { ...v, balanced: false, raw };
  const g = hueGuard([Math.min(WHITE_REF.maxL, (v.lab[0] / w.L) * WHITE_REF.targetL), v.lab[1], v.lab[2]], rawLab);
  return { ...v, lab: g.lab, hex: labHex(g.lab), balanced: true, raw, ...(g.guard ? { hueGuard: g.guard } : {}) };
}
export function brickOfPixels(px: Lab[]): BrickVerdict | null {
  const warm = px.filter(([L, a, b]) => { const C = Math.hypot(a, b), h = ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360; return C >= WARM.C && h >= WARM.h0 && h <= WARM.h1 && L >= WARM.L0 && L <= WARM.L1; });
  if (px.length && warm.length / px.length >= WARM.share) {
    const med = (k: 0 | 1 | 2) => { const v = warm.map(p => p[k]).sort((x, y) => x - y); return v[v.length >> 1]; };
    const lab: Lab = [med(0), med(1), med(2)];
    return { hex: labHex(lab), lab, share: +(warm.length / px.length).toFixed(3), kind: 'brick' };
  }
  return brickOf(clusters(px, 5));
}
export const labOf = (r: number, g: number, b: number): Lab => oklab(r, g, b);

export type WallRead = { pano: string; date: string; verdict: (BrickVerdict & { balanced?: boolean; raw?: string }) | null; why?: string };
export type WallVote = { hex: string; n: number; of: number; dates: number; balanced: boolean; reads: { pano: string; date: string; hex: string; raw?: string }[] } | { skip: string };
const agrees = (p: Lab, q: Lab) => Math.abs(p[0] - q[0]) <= WALL_VOTE.dL && Math.hypot(p[1] - q[1], p[2] - q[2]) <= WALL_VOTE.dAB;
/**
 * The row's brick from its reads: the largest group of reads from distinct panoramas that agree (WALL_VOTE) with one
 * another (each read's neighbourhood, the earliest read winning ties), at least `minReads` strong; drawn at the group's
 * median L, a, b. A lone read, or reads that all disagree, give no brick: the district pool stands.
 */
export function voteWall(reads: readonly WallRead[]): WallVote {
  const any = reads.filter((r): r is WallRead & { verdict: NonNullable<WallRead['verdict']> } => !!r.verdict);
  // Balanced reads (wallBrickOf) are on one scale and raw ones are not: when two or more balanced reads exist, only they vote.
  const bal = any.filter(r => r.verdict.balanced), clear = bal.length >= WALL_VOTE.minReads ? bal : any;
  if (clear.length < WALL_VOTE.minReads) return { skip: `${clear.length} clear read${clear.length === 1 ? '' : 's'} of ${reads.length}` };
  let best: typeof clear = [];
  for (const r of clear) {
    const near = clear.filter(q => agrees(q.verdict.lab, r.verdict.lab));
    if (near.length > best.length) best = near;
  }
  if (best.length < WALL_VOTE.minReads) return { skip: `the ${clear.length} clear reads disagree (${clear.map(r => r.verdict.hex).join(', ')})` };
  const med = (k: 0 | 1 | 2) => { const v = best.map(r => r.verdict.lab[k]).sort((a, b) => a - b); return v.length % 2 ? v[v.length >> 1] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2; };
  return { hex: labHex([med(0), med(1), med(2)]), n: best.length, of: reads.length, dates: new Set(best.map(r => r.date)).size, balanced: best.every(r => !!r.verdict.balanced), reads: best.map(r => ({ pano: r.pano, date: r.date, hex: r.verdict.hex, ...(r.verdict.raw ? { raw: r.verdict.raw } : {}) })) };
}

// ---- roof form from the AHN DSM ---------------------------------------------------------------------------------
/** A DSM cell in the row's frame: `t` metres along the front line, `n` metres back from it, `h` over the ground. */
export type RoofCell = { t: number; n: number; h: number };
/**
 * Thresholds. The depth profile is the median height of 1 m depth bins over the row's middle (`endM` off each end); its
 * front slope is the rise from the front bin to the highest bin within `frontM` of the front. A profile rising at least
 * `pitchedM` there is pitched (the street sees tiles); a profile whose bins all lie within `flatM`, or none of whose bins
 * stands `flatM` over the front one, is flat. Gabled to
 * the street: the depth profile is flat but the along-street profile (1 m bins over the front `frontM`) swings at least
 * `pitchedM`. A free row end is hipped when the ridge-depth height in its last `endM` falls at least `hipM` under the
 * middle's.
 */
export const ROOF_FORM = { endM: 4, frontM: 6, pitchedM: 1.0, flatM: 0.8, hipM: 1.0, minCells: 60, chimneyQ: 0.97, yardM: 2.5, seenSlope: 1.3, steepSlope: 1.0 } as const;
/**
 * `hidden-pitch`: a roof that rises behind the front but too gently to be seen over the eaves from the street. Apollo's
 * noted streets (round 9, AHN4): the tiles the photos show (Herculesstraat, Sportstraat, Michelangelostraat) rise
 * 1.3-4.5 m in the first 2 m behind the front, a mansard face; the roofs the photos do not show over a broad eaves slab
 * (Minervalaan, Quinten Massijsstraat 110788) rise 0.7-0.8 m per metre. A rise under `seenSlope` m per metre over the
 * first 2 m is hidden, and the street sees a flat top.
 */
export type RoofForm = { form: 'flat' | 'pitched' | 'hidden-pitch' | 'gable-street' | 'unclear'; frontRiseM: number;
  /** Round 10 (pitched only): the rise of the roof's steep face, from the front up the depth bins while each climbs at
   *  least `steepSlope` m per metre; a mansard's face stops at its break, a full hipped roof runs to its ridge. */
  steepRiseM?: number; ridgeM: number; eavesM: number; hipped: { start: boolean; end: boolean }; cells: number; why: string };
const medianOf = (v: number[]) => { if (!v.length) return NaN; const s = [...v].sort((a, b) => a - b); return s.length % 2 ? s[s.length >> 1] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };
function profile(cells: RoofCell[], key: 't' | 'n', lo: number, hi: number): Map<number, number> {
  const bins = new Map<number, number[]>();
  for (const c of cells) { const v = c[key]; if (v < lo || v > hi) continue; const b = Math.floor(v); let l = bins.get(b); if (!l) bins.set(b, l = []); l.push(c.h); }
  return new Map([...bins].filter(([, l]) => l.length >= 3).map(([b, l]) => [b, medianOf(l)]));
}
/** The roof form of a series from its DSM cells; `lenM` the series' length on the front line, `free` which ends stand free
 *  (no neighbour row against them). */
export function roofFormOf(raw: readonly RoofCell[], lenM: number, free: { start: boolean; end: boolean } = { start: true, end: true }): RoofForm {
  const F = ROOF_FORM, none = { start: false, end: false };
  const hs = raw.filter(c => Number.isFinite(c.h)).map(c => c.h).sort((a, b) => a - b);
  if (hs.length < F.minCells) return { form: 'unclear', frontRiseM: 0, ridgeM: 0, eavesM: 0, hipped: none, cells: hs.length, why: `${hs.length} DSM cells` };
  const cap = hs[Math.floor(hs.length * F.chimneyQ)];
  const cells = raw.filter(c => Number.isFinite(c.h) && c.h <= cap && c.h >= F.yardM);
  const mid = profile(lenM > 2 * F.endM + 2 ? cells.filter(c => c.t >= F.endM && c.t <= lenM - F.endM) : cells, 'n', 0, 99);
  const depth = [...mid].sort((a, b) => a[0] - b[0]);
  if (depth.length < 3) return { form: 'unclear', frontRiseM: 0, ridgeM: 0, eavesM: 0, hipped: none, cells: cells.length, why: `${depth.length} depth bins` };
  const front = depth[0][1], within = depth.filter(([b]) => b < depth[0][0] + F.frontM), top = Math.max(...within.map(([, h]) => h));
  const ridgeBin = within.find(([, h]) => h === top)![0];
  const all = depth.map(([, h]) => h), spread = Math.max(...all) - Math.min(...all), rise = top - front;
  const r2 = (v: number) => +v.toFixed(2);
  if (rise >= F.pitchedM) {
    // Hips: the ridge-depth band (±1 m of the ridge bin) along the street; a free end whose last endM sits hipM under the middle.
    const band = cells.filter(c => Math.abs(c.n - (ridgeBin + 0.5)) <= 1.5);
    const midH = medianOf(band.filter(c => c.t >= F.endM && c.t <= lenM - F.endM).map(c => c.h));
    const endH = (a: number, b: number) => medianOf(band.filter(c => c.t >= a && c.t <= b).map(c => c.h));
    const hipped = { start: free.start && midH - endH(0, F.endM / 2) >= F.hipM, end: free.end && midH - endH(lenM - F.endM / 2, lenM) >= F.hipM };
    const near = depth.filter(([b]) => b > depth[0][0] && b <= depth[0][0] + 2), slope = near.length ? Math.max(...near.map(([b, h]) => (h - front) / (b - depth[0][0]))) : 0;
    if (slope < F.seenSlope) return { form: 'hidden-pitch', frontRiseM: r2(rise), ridgeM: r2(top), eavesM: r2(front), hipped, cells: cells.length, why: `rises ${r2(rise)} m within ${F.frontM} m but only ${r2(slope)} m per metre at the front: hidden over the eaves` };
    let steep = front, prev = depth[0];
    for (const bin of depth.slice(1)) { if (bin[0] > depth[0][0] + F.frontM || (bin[1] - prev[1]) / (bin[0] - prev[0]) < F.steepSlope) break; steep = bin[1]; prev = bin; }
    return { form: 'pitched', frontRiseM: r2(rise), steepRiseM: r2(Math.max(0, steep - front)), ridgeM: r2(top), eavesM: r2(front), hipped, cells: cells.length, why: `depth profile rises ${r2(rise)} m within ${F.frontM} m of the front, ${r2(slope)} m per metre at the front` };
  }
  if (spread <= F.flatM) {
    const along = [...profile(cells.filter(c => c.n < F.frontM), 't', 0, lenM).values()];
    const swing = along.length >= 4 ? Math.max(...along) - Math.min(...along) : 0;
    // A row of street gables swings regularly along the street; one step (a taller member) is not a gable rhythm.
    let turns = 0; for (let i = 2; i < along.length; i++) if ((along[i] - along[i - 1]) * (along[i - 1] - along[i - 2]) < 0 && Math.abs(along[i - 1] - along[i - 2]) > 0.3) turns++;
    if (swing >= F.pitchedM && turns >= 2) return { form: 'gable-street', frontRiseM: r2(swing), ridgeM: r2(Math.max(...along)), eavesM: r2(Math.min(...along)), hipped: none, cells: cells.length, why: `flat in depth, ${r2(swing)} m swing and ${turns} turns along the street` };
    return { form: 'flat', frontRiseM: r2(rise), ridgeM: r2(Math.max(...all)), eavesM: r2(front), hipped: none, cells: cells.length, why: `depth profile within ${r2(spread)} m` };
  }
  // Highest at the front: whatever lies behind (a roof falling to the back, a lower rear wing) is under the street's sight
  // line, so the street sees a flat top at the front edge.
  if (Math.max(...all) - front <= F.flatM) return { form: 'flat', frontRiseM: r2(rise), ridgeM: r2(Math.max(...all)), eavesM: r2(front), hipped: none, cells: cells.length, why: `highest at the front, ${r2(front - Math.min(...all))} m lower behind` };
  return { form: 'unclear', frontRiseM: r2(rise), ridgeM: r2(Math.max(...all)), eavesM: r2(front), hipped: none, cells: cells.length, why: `front rise ${r2(rise)} m under ${F.pitchedM} m but depth spread ${r2(spread)} m (a back pitch or a stepped block)` };
}

// ---- which part of the row a camera sees -------------------------------------------------------------------------
type Pt = { x: number; y: number };
/** Gates on the view ray to each metre of the front (round 10). A pale rendered block beside the camera, or a stretch
 *  seen edge-on (a smear), must not be read as the row's brick. A column counts only when the ray from the camera to it
 *  crosses no other building's footprint and meets the front within `maxObliquityDeg` of square on. (Lekstraat 147614's
 *  grey read, which first looked like this, was the bent row's chord: `localFront`.) */
export const VIEW_GATE = { maxObliquityDeg: 55, stepM: 0.5, endInsetM: 0.3 } as const;
const cross = (o: Pt, a: Pt, b: Pt) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
function segmentsCross(p: Pt, q: Pt, a: Pt, b: Pt): boolean {
  const d1 = cross(a, b, p), d2 = cross(a, b, q), d3 = cross(p, q, a), d4 = cross(p, q, b);
  return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
}
/** Visibility of the front a→b from `cam`, sampled every `stepM` metres along it: true where the camera sees the wall.
 *  `occluders` are the rings (RD metres) of every building but the row's own members. */
export function visibleAlong(cam: Pt, a: Pt, b: Pt, occluders: readonly (readonly Pt[])[]): boolean[] {
  const len = Math.hypot(b.x - a.x, b.y - a.y), ux = (b.x - a.x) / len, uy = (b.y - a.y) / len;
  const out: boolean[] = [];
  for (let t = 0; t <= len + 1e-9; t += VIEW_GATE.stepM) {
    const p = { x: a.x + ux * t, y: a.y + uy * t };
    const vx = cam.x - p.x, vy = cam.y - p.y, d = Math.hypot(vx, vy);
    const standoff = Math.abs(vx * uy - vy * ux); // distance off the line (either side)
    if (d < 1e-6 || (Math.acos(Math.min(1, standoff / d)) * 180) / Math.PI > VIEW_GATE.maxObliquityDeg) { out.push(false); continue; }
    // Stop the ray just short of the wall so a neighbour sharing the wall line does not count.
    const k = (d - VIEW_GATE.endInsetM) / d, q = { x: p.x + vx * (1 - k), y: p.y + vy * (1 - k) };
    let blocked = false;
    for (const ring of occluders) {
      for (let i = 0; i + 1 < ring.length && !blocked; i++) blocked = segmentsCross(cam, q, ring[i], ring[i + 1]);
      if (blocked) break;
    }
    out.push(!blocked);
  }
  return out;
}

// ---- the stretch of a bent row a camera reads ----------------------------------------------------------------------
/** A row's front is its members' front lines in row order, and long rows bend: Lekstraat 147614 runs 236 m, and the
 *  chord from its first to its last member passes 29 m off the facade at the 2025 camera, so the read window held a
 *  tree and a block across the square, not the row (round 10). A read rectifies onto the straight run of members
 *  nearest the camera instead: from the member closest to it, grown one neighbour at a time (the nearer one first)
 *  while each turns less than `maxTurnDeg` from it and the run stays within `spanM`. */
export const LOCAL_FRONT = { spanM: 30, maxTurnDeg: 12 } as const;
export type FrontSeg = readonly [Pt, Pt];
export function localFront(segs: readonly FrontSeg[], cam: Pt): { a: Pt; b: Pt; lo: number; hi: number; offM: number } | null {
  if (!segs.length) return null;
  const distTo = ([p, q]: FrontSeg) => {
    const dx = q.x - p.x, dy = q.y - p.y, l2 = dx * dx + dy * dy || 1e-9, t = Math.max(0, Math.min(1, ((cam.x - p.x) * dx + (cam.y - p.y) * dy) / l2));
    return Math.hypot(cam.x - p.x - t * dx, cam.y - p.y - t * dy);
  };
  const dir = ([p, q]: FrontSeg) => Math.atan2(q.y - p.y, q.x - p.x);
  let k = 0;
  segs.forEach((s, i) => { if (distTo(s) < distTo(segs[k])) k = i; });
  const turnOk = (i: number) => { let d = Math.abs(dir(segs[i]) - dir(segs[k])) % (2 * Math.PI); if (d > Math.PI) d = 2 * Math.PI - d; return (d * 180) / Math.PI < LOCAL_FRONT.maxTurnDeg; };
  const span = (lo: number, hi: number) => Math.hypot(segs[hi][1].x - segs[lo][0].x, segs[hi][1].y - segs[lo][0].y);
  let lo = k, hi = k;
  for (;;) {
    const opts = [lo - 1, hi + 1].filter(i => i >= 0 && i < segs.length && turnOk(i) && span(Math.min(lo, i), Math.max(hi, i)) <= LOCAL_FRONT.spanM);
    if (!opts.length) break;
    const i = opts.sort((x, y) => distTo(segs[x]) - distTo(segs[y]))[0];
    if (i < lo) lo = i; else hi = i;
  }
  const a = segs[lo][0], b = segs[hi][1], len = Math.hypot(b.x - a.x, b.y - a.y) || 1e-9;
  // The camera's offset off the run, positive on the side of the row's normal (uy, -ux), as measure-walls takes it.
  const offM = ((cam.x - a.x) * (b.y - a.y) - (cam.y - a.y) * (b.x - a.x)) / len;
  return { a, b, lo, hi, offM };
}

// ---- the erker's finish: white timber or the row's brick (round 10) -------------------------------------------------
/** A pixel is white trim when it is near neutral and at least `relL` of the band's white reference (or `absL` with
 *  none: the 2025 recordings read white frames at L 0.70). An erker reads white when, over its face from the first
 *  floor to under the line, `share` of its seen pixels are white and that is `overWall` above the row's wall beside it
 *  (a brick erker's white frames and sills come to 0.15-0.30, as does the wall's own windows' white). The judges named
 *  white wrap-around and angled oriels drawn in brick on Hunzestraat 120343, Kuinderstraat 067158 and Stadionkade
 *  063989 (round 9 held-out). */
export const ERKER_WHITE = { relL: 0.8, absL: 0.72, maxC: 0.035, share: 0.4, overWall: 0.15, minPx: 400, minReads: 2, rowMajority: 0.6 } as const;
export function whiteShareOf(px: readonly Lab[], ref: WhiteRef): number {
  if (!px.length) return 0;
  const minL = ref ? ref.L * ERKER_WHITE.relL : ERKER_WHITE.absL, a0 = ref?.a ?? 0, b0 = ref?.b ?? 0;
  let n = 0;
  for (const [L, a, b] of px) if (L >= minL && Math.hypot(a - a0, b - b0) <= ERKER_WHITE.maxC) n++;
  return n / px.length;
}
export type ErkerRead = { share: number; wall: number; brick?: number; wallBrick?: number };
/** The share of warm (brick) pixels, after the white reference's cast. */
export function brickShareOf(px: readonly Lab[], ref: WhiteRef): number {
  if (!px.length) return 0;
  const a0 = ref?.a ?? 0, b0 = ref?.b ?? 0;
  let n = 0;
  for (const [L, a, b] of px) { const A = a - a0, B = b - b0, C = Math.hypot(A, B), h = ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360; if (C >= WARM.C && h >= WARM.h0 && h <= WARM.h1 && L >= WARM.L0 && L <= WARM.L1) n++; }
  return n / px.length;
}
/** One erker's finish from its reads (distinct panoramas): white when `minReads` agree it is white, brick when as many
 *  agree it is not; split or thin reads leave it unread (null). */
export function erkerFinishOf(reads: readonly ErkerRead[]): 'white' | 'brick' | null {
  const white = reads.filter(r => r.share >= ERKER_WHITE.share && r.share - r.wall >= ERKER_WHITE.overWall).length;
  const brick = reads.length - white;
  if (white >= ERKER_WHITE.minReads && white > brick) return 'white';
  if (brick >= ERKER_WHITE.minReads && brick > white) return 'brick';
  return null;
}
/** The row's erkers: each read erker keeps its own finish; an unread one takes the row's when `rowMajority` of the
 *  read ones agree (the series value), else stays unread. */
export function rowErkerFinish(finishes: readonly ('white' | 'brick' | null)[]): ('white' | 'brick' | null)[] {
  const read = finishes.filter((f): f is 'white' | 'brick' => !!f), w = read.filter(f => f === 'white').length;
  const row = read.length ? (w / read.length >= ERKER_WHITE.rowMajority ? 'white' : (read.length - w) / read.length >= ERKER_WHITE.rowMajority ? 'brick' : null) : null;
  return finishes.map(f => f ?? row);
}
