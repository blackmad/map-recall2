import * as T from 'three';
import polygonClipping, {type MultiPolygon, type Polygon} from 'polygon-clipping';
import type {BuildingTools} from './cultural-builders';
import {put, ringFrame, setSink, slab, type Frame} from './nearbar-kit';
import {convexCorners, exposedRuns, inRing, type Piece, type Pt, type Run} from '../../src/canalRecall/landmarks/terraceBands';
import {prism, runFrame} from './plan-prism';
import source from './vijzelbank-footprints.json';

/**
 * Vijzelbank / Prins en Keizer, Vijzelstraat 66-80 (BAG pand 0363100012165685, one pand; former ABN head office by M.F. Duintjer
 * with J. Trapman, built 1969-1973, renovated 2013-2014; municipal monument 200979). Native east/south metres from the BAG vertex
 * average (scripts/landmarks/vijzelstraat-prepare.ts), y up from the 3DBAG ground (0.92 m NAP).
 *
 * Massing: one prism per 3DBAG LoD2.2 roof piece (CC BY 4.0), its top snapped to the floor band that is its roof edge on the
 * photos, so the terraces step down to both canals as the monument register describes. Read on the rectified 2025 panorama of the
 * Vijzelstraat front (recording_2025-06-16_06-42-40_01588, 20 px/m, CC BY 4.0) and Commons "Vijzelstraat 66-80.jpg" (Ceescamel,
 * 2019, CC BY-SA 4.0):
 *  - ground storey: a colonnade of white square piers on the bay axes in front of dark shopfronts set ~3 m back, under a dark
 *    fascia 4.45-5.6 m;
 *  - above it dark projecting floor-edge bands, 0.55 m deep, centred every 3.38 m (8.93 ... 29.21 m), white fins between them on
 *    the bay axes and at every corner, recessed glazing with pale blinds; 30 bays on the 141 m front (13 at 4.71 m south of the
 *    passage, two of 5.1 m over it, 15 of 4.64 m north of it);
 *  - the Kerkstraat building passage (OSM w34955694) through the ground storey, under a double-height void at the front up to the
 *    third band, with a glazed walkway in it;
 *  - the two highest tiers (to 26.1 and 29.5 m) under roof plates that overhang the bands; steel fire-escape platforms and ladders on the
 *    front; thin black railings on every terrace.
 */
type Src = {surfaces: {type: string; rings: number[][][]}[]; facadeRing: number[][]; neighbours: {id: string; height: number; ring: Pt[]}[]};
const src = source as unknown as Src;

const FASCIA = {y0: 4.45, y1: 5.6};
/** Floor-band centres above the fascia, measured on the rectified front (3.38 m storeys). */
const LEVELS = [8.93, 12.31, 15.69, 19.07, 22.45, 25.83, 29.21];
const BAND_H = 0.55, BAND_OUT = 0.65, FIN_W = 0.4, FIN_OUT = 0.5, LIP = 0.1, PANE_OUT = 0.15;
/** Front bay axes (fins and colonnade piers), metres from the south (viewer-left) end of the Vijzelstraat front. */
/** Depth of the gallery behind the BAG line (pier faces) to the shopfronts. */
const GALLERY = 2.6;
const PASSAGE = {t0: 61.2, t1: 71.4, depth: 31, voidDepth: 6.5, voidTop: 12.31 - BAND_H / 2};
const FRONT = ringFrame(src.facadeRing, 4);
const AXES = [
  ...[...Array(13)].map((_, k) => k * PASSAGE.t0 / 13),
  PASSAGE.t0, (PASSAGE.t0 + PASSAGE.t1) / 2,
  ...[...Array(16)].map((_, k) => PASSAGE.t1 + k * (FRONT.len - PASSAGE.t1) / 15),
];

const at = (f: Frame, t: number, o: number): Pt => [f.origin[0] + f.tangent[0] * t + f.n[0] * o, f.origin[1] + f.tangent[1] * t + f.n[1] * o];
/** Plan quad on the front frame: t0..t1 along the front, o0..o1 out of it. */
const frontQuad = (t0: number, t1: number, o0: number, o1: number): Polygon => [[at(FRONT.f, t0, o0), at(FRONT.f, t1, o0), at(FRONT.f, t1, o1), at(FRONT.f, t0, o1), at(FRONT.f, t0, o0)]];
const open = (r: Pt[]) => (r.length > 1 && r[0][0] === r.at(-1)![0] && r[0][1] === r.at(-1)![1] ? r.slice(0, -1) : r);
const closed = (r: Pt[]): Pt[] => [...r, r[0]];
const area = (r: Pt[]) => Math.abs(r.reduce((a, p, i) => { const q = r[(i + 1) % r.length]; return a + p[0] * q[1] - q[0] * p[1]; }, 0) / 2);

/**
 * The photos show every terrace step of the front ending on a fin, with whole bays; the 3DBAG roof outlines put the steps up to
 * half a bay off. A step line is the set of roof-piece vertices at one position t along the front; when any of them lies within
 * 12 m of the front line, the whole line (every vertex within 0.3 m of that t, however deep) moves along the front to the
 * nearest bay axis (at most 2.4 m), so steps land on axes and their side walls stay square. The outer ring's ends are axes
 * already, so the outline stays put.
 */
const frontT = (p: Pt) => (p[0] - FRONT.f.origin[0]) * FRONT.f.tangent[0] + (p[1] - FRONT.f.origin[1]) * FRONT.f.tangent[1];
const frontO = (p: Pt) => (p[0] - FRONT.f.origin[0]) * FRONT.f.n[0] + (p[1] - FRONT.f.origin[1]) * FRONT.f.n[1];
const STEP_TS = src.surfaces.filter(s => s.type === 'RoofSurface').flatMap(s => s.rings[0].map(q => [q[0], q[2]] as Pt)).filter(p => frontO(p) >= -12).map(frontT);
function snapAxis(p: Pt): Pt {
  const t = frontT(p);
  if (!STEP_TS.some(s => Math.abs(s - t) < 0.3)) return p;
  const ax = AXES.reduce((best, a) => (Math.abs(a - t) < Math.abs(best - t) ? a : best), AXES[0]);
  return Math.abs(ax - t) > 2.4 ? p : [p[0] + FRONT.f.tangent[0] * (ax - t), p[1] + FRONT.f.tangent[1] * (ax - t)];
}
/** Does a plan ring reach within 3 m of the Vijzelstraat front (the blocks whose roof plates the photos show overhanging)? */
const onFront = (r: Pt[]) => r.some(p => (p[0] - FRONT.f.origin[0]) * FRONT.f.n[0] + (p[1] - FRONT.f.origin[1]) * FRONT.f.n[1] > -3);
/** Roof edge height of a 3DBAG roof piece: the top of the band at or below it (its railing and coping are not wall). */
function snapTop(t: number): number {
  if (t > 31.5) return t; // roof plant
  const lv = [...LEVELS].reverse().find(l => l <= t - 0.1);
  return lv === undefined ? FASCIA.y1 : lv + BAND_H / 2;
}

/** Front-frame t of a run's ends, or null when the run does not face the Vijzelstraat (set-back storeys keep the bay axes). */
function frontSpan(r: Run): [number, number] | null {
  const f = FRONT.f;
  if (r.n[0] * f.n[0] + r.n[1] * f.n[1] < 0.99) return null;
  const T0 = (p: Pt) => (p[0] - f.origin[0]) * f.tangent[0] + (p[1] - f.origin[1]) * f.tangent[1];
  return [T0(r.a), T0(r.b)];
}

export function buildVijzelbank(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  // ---- plan: ground storey ring minus the colonnade strip and the Kerkstraat passage ----
  const ring: Polygon = [closed(src.facadeRing.map(p => [p[0], p[1]] as Pt))];
  const colonnade = frontQuad(-10, FRONT.len + 10, -GALLERY, 10);
  const passage = frontQuad(PASSAGE.t0, PASSAGE.t1, -PASSAGE.depth, 10);
  const voidQ = frontQuad(PASSAGE.t0, PASSAGE.t1, -PASSAGE.voidDepth, 10);
  const ground = polygonClipping.difference(ring, colonnade, passage);

  // ---- pieces: every 3DBAG roof piece over 2 m2, top snapped to its roof-edge band; the void lifts the pieces over it ----
  const pieces: (Piece & {wall: string; canopy: boolean})[] = [];
  for (const s of src.surfaces) {
    if (s.type !== 'RoofSurface') continue;
    const r = open(s.rings[0].map(p => snapAxis([p[0], p[2]])));
    if (r.length < 3 || area(r) < 2) continue;
    const raw = s.rings[0].reduce((a, p) => a + p[1], 0) / s.rings[0].length;
    const top = snapTop(raw), plant = raw > 31.5, low = top <= FASCIA.y1;
    const poly: Polygon = [closed(r), ...s.rings.slice(1).map(h => closed(open(h.map(p => snapAxis([p[0], p[2]])))))];
    const parts: [MultiPolygon, number][] = [[polygonClipping.difference(poly, voidQ), FASCIA.y0], [polygonClipping.intersection(poly, voidQ), PASSAGE.voidTop]];
    for (const [mp, base] of parts) for (const pg of mp) {
      if (area(pg[0]) < 0.5 || top <= base + 0.1) continue;
      pieces.push({ring: open(pg[0] as Pt[]), holes: pg.slice(1).map(h => open(h as Pt[])), base, top, wall: plant ? 'concrete' : low ? 'bronze' : 'stone', canopy: !plant && top > 26 && onFront(pg[0] as Pt[])});
    }
  }
  // 3DBAG roof pieces can overlap in plan (a sloped piece under a flat one): the higher piece keeps the ground
  pieces.sort((a, c) => c.top - a.top || a.base - c.base);
  const taken: Polygon[] = [];
  const solid: typeof pieces = [];
  for (const p of pieces) {
    const poly: Polygon = [closed(p.ring), ...(p.holes ?? []).map(closed)];
    const rest = taken.length ? polygonClipping.difference(poly, ...taken) : [poly];
    taken.push(poly);
    for (const pg of rest) if (area(pg[0] as Pt[]) >= 0.5) solid.push({...p, ring: open(pg[0] as Pt[]), holes: pg.slice(1).map(h => open(h as Pt[]))});
  }
  pieces.length = 0; pieces.push(...solid);
  const groundPieces: Piece[] = ground.map(pg => ({ring: open(pg[0] as Pt[]), holes: pg.slice(1).map(h => open(h as Pt[])), base: 0, top: FASCIA.y0}));
  for (const pg of ground) prism(b, pg as Pt[][], 0, FASCIA.y0, 'stone', null, null);
  for (const p of pieces) prism(b, [p.ring, ...(p.holes ?? [])], p.base, p.top, p.wall, 'slate', 'concrete');
  b.mark?.('shell');

  const blocked = (x: number, z: number, y: number) => src.neighbours.some(n => n.height > y && inRing(n.ring, x, z));
  setSink(0);

  // ---- floor-edge bands (the fascia is the first) with corner blocks; the top tier's roof plate overhangs ----
  // every band stands LIP above its storey line, so the top band of a terrace clears that terrace's roof plane
  const bandAt = (y: number, h: number, colour: string, outFor: (r: Run) => number, lip = LIP) => {
    const runs = exposedRuns(pieces, y, {blocked});
    for (const r of runs) {
      const {f, len} = runFrame(r), out = outFor(r);
      slab(b, f, len / 2, y - h / 2, len, h + lip, out, colour);
    }
    for (const c of convexCorners(runs)) {
      const out = BAND_OUT;
      const f: Frame = {origin: [c.p[0] + c.n1[0] * out / 2 + c.n2[0] * out / 2, c.p[1] + c.n1[1] * out / 2 + c.n2[1] * out / 2], tangent: [-c.n1[1], c.n1[0]], n: c.n1};
      put(b, f, new T.BoxGeometry(out, h + lip, out).translate(0, lip / 2, 0), 0, y, 0, colour);
    }
    return runs;
  };
  bandAt((FASCIA.y0 + FASCIA.y1) / 2 + 0.001, FASCIA.y1 - FASCIA.y0, 'bronze', () => BAND_OUT, LIP);
  const topRuns: Run[] = [];
  for (const y of LEVELS) {
    const runs = bandAt(y, BAND_H, 'bronze', r => (pieces[r.piece].canopy && Math.abs(pieces[r.piece].top - (y + BAND_H / 2)) < 0.01 ? 1.6 : BAND_OUT));
    topRuns.push(...runs.filter(r => Math.abs(pieces[r.piece].top - (y + BAND_H / 2)) < 0.01 && !pieces[r.piece].canopy));
  }

  // ---- white fins between the bands: on the front's bay axes, elsewhere on ~4.7 m axes, always at both ends of a run ----
  const storeys: [number, number][] = [[FASCIA.y1, LEVELS[0] - BAND_H / 2], ...LEVELS.slice(0, -1).map((l, i) => [l + BAND_H / 2, LEVELS[i + 1] - BAND_H / 2] as [number, number])];
  for (const [y0, y1] of storeys) {
    const runs = exposedRuns(pieces, (y0 + y1) / 2, {blocked});
    // a run that carries straight on into another piece's run is one facade: no fin at the seam, the glazing runs through
    const goesOn = (r: Run, p: Pt) => runs.some(q => q !== r && q.n[0] * r.n[0] + q.n[1] * r.n[1] > 0.9998 && [q.a, q.b].some(e => Math.hypot(e[0] - p[0], e[1] - p[1]) < 0.08));
    for (const r of runs) {
      const {f, len} = runFrame(r);
      const contA = goesOn(r, r.a), contB = goesOn(r, r.b);
      if (len < 1.2 && !(contA || contB)) continue;
      const span = frontSpan(r);
      let ts: number[];
      if (span) {
        const [a, c] = span, lo = Math.min(a, c), hi = Math.max(a, c);
        // an axis on a seam between two runs belongs to the run it starts (front-frame order), so it is drawn once
        ts = AXES.filter(t => t > lo - 0.05 && t < hi - 0.05).map(t => Math.abs(t - a));
      } else {
        const n = Math.max(1, Math.round(len / 4.7));
        ts = [...Array(n + 1)].map((_, k) => k * len / n).filter(t => t > 0.05 && t < len - 0.05);
      }
      const fins = [...new Set(ts.map(t => Math.min(len - FIN_W / 2, Math.max(FIN_W / 2, t))).map(t => Math.round(t * 1000) / 1000))].sort((a, c) => a - c);
      // end fins where a run stops at a corner or a terrace edge rather than on an axis
      const endFins = new Set<number>();
      if (!contA && !(fins[0] <= FIN_W)) { fins.unshift(FIN_W / 2); endFins.add(FIN_W / 2); }
      if (!contB && !(fins.at(-1)! >= len - FIN_W)) { fins.push(len - FIN_W / 2); endFins.add(len - FIN_W / 2); }
      for (const t of fins) slab(b, f, t, y0 + LIP, FIN_W, y1 - y0 - LIP, FIN_OUT, 'concrete');
      // recessed glazing (pale blinds) filling each bay between the fins (or up to a seam), 15 cm proud of the wall
      const stops = [contA ? -FIN_W / 2 - 0.03 : null, ...fins, contB ? len + FIN_W / 2 + 0.03 : null].filter((v): v is number => v !== null);
      for (let k = 0; k + 1 < stops.length; k++) {
        const a = stops[k] + FIN_W / 2 + 0.03, c = stops[k + 1] - FIN_W / 2 - 0.03;
        // no pane narrower than 0.8 m (the bays are 4.6-5.1 m; a narrower gap is a seam or a survey sliver). On the front a part-bay between an axis and a 3DBAG terrace edge stays solid: the photo shows the terraces ending
        // on a fin with whole bays, so a sliver of glass there would be an artefact of the survey outline
        const whole = !span || c - a > 1.2 || !(endFins.has(stops[k]) || endFins.has(stops[k + 1]));
        if (c - a > 0.8 && whole && (len >= 2.5 || contA || contB)) slab(b, f, (a + c) / 2, y0 + LIP + 0.05, c - a, y1 - y0 - LIP - 0.1, PANE_OUT, 'glass');
      }
    }
  }
  // ground storey: dark shopfront glass per bay on every exposed ground wall (the gallery back, the passage sides, the canal ends)
  for (const r of exposedRuns(groundPieces, 2, {blocked})) {
    const {f, len} = runFrame(r);
    const n = Math.max(1, Math.round(len / 4.7));
    for (let k = 0; k < n; k++) {
      const a = k * len / n + (k === 0 ? 0.4 : 0.15), c = (k + 1) * len / n - (k === n - 1 ? 0.4 : 0.15);
      if (c - a > 0.5) slab(b, f, (a + c) / 2, 0.25, c - a, 3.85, PANE_OUT, 'dark');
    }
  }

  // ---- colonnade piers on the front axes (none inside the passage), 0.9 m square, faces on the BAG line ----
  setSink(0);
  for (const t of AXES) {
    if (t > PASSAGE.t0 + 0.1 && t < PASSAGE.t1 - 0.1) continue;
    slab(b, FRONT.f, Math.min(FRONT.len - 0.45, Math.max(0.45, t)), 0, 0.9, FASCIA.y0, 0.9, 'concrete', -0.9);
  }
  // the colonnade's return piers on the two canal ends of the strip are the corner piers above (t = 0 and t = len)

  // ---- the glazed walkway across the void, 3 m in, at the first floor ----
  {
    const f = FRONT.f, w = PASSAGE.t1 - PASSAGE.t0 - 0.2, c = (PASSAGE.t0 + PASSAGE.t1) / 2;
    slab(b, f, c, FASCIA.y1 + LIP - 0.35, w, 0.35, 1.6, 'bronze', -4.6);
    slab(b, f, c, FASCIA.y1 + LIP + 1.0, w, 0.06, 0.06, 'bronze', -3.1);
    for (let k = 0; k <= 8; k++) slab(b, f, c - w / 2 + 0.05 + k * (w - 0.1) / 8, FASCIA.y1 + LIP, 0.05, 1.0, 0.05, 'bronze', -3.1);
  }

  // ---- fire escapes on the front: a steel platform at each listed storey and a ladder up to the next ----
  setSink(0.06, true);
  const ESCAPES: [number, number[]][] = [[17.0, [0]], [51.6, [0, 1, 2, 3, 4, 5]], [72.4, [0, 1]], [99.3, [0]]];
  for (const [t, ks] of ESCAPES) for (const k of ks) {
    const y = (k === 0 ? FASCIA.y1 : LEVELS[k - 1] + BAND_H / 2) + LIP;
    slab(b, FRONT.f, t, y, 1.8, 0.12, 0.8, 'bronze', BAND_OUT - 0.1);
    slab(b, FRONT.f, t, y + 0.12, 1.8, 1.0, 0.05, 'bronze', BAND_OUT + 0.65);
    for (const s of [-1, 1]) slab(b, FRONT.f, t + s * 0.22, y + 0.12, 0.05, 3.0, 0.05, 'bronze', BAND_OUT + 0.55);
  }

  // ---- terrace railings: posts every 2.4 m and a top rail, 0.3 m behind each terrace's edge band ----
  setSink(0);
  for (const r of topRuns) {
    const {f, len} = runFrame(r), y = pieces[r.piece].top;
    if (len < 1.5) continue;
    slab(b, f, len / 2, y + 1.0, len - 0.2, 0.06, 0.06, 'bronze', -0.36);
    const n = Math.max(1, Math.round(len / 2.4));
    for (let k = 0; k <= n; k++) slab(b, f, 0.1 + k * (len - 0.2) / n, y, 0.05, 1.0, 0.05, 'bronze', -0.35);
  }
  setSink(0);
}
