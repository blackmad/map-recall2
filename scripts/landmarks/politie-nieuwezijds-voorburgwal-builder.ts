import * as T from 'three';
import polygonClipping from 'polygon-clipping';
import type {BuildingTools} from './cultural-builders';
import {upwardRoofPlane} from './house-geometry';
import {raisedLettering} from './ornament-kit';
import {holedWall, type HoledOpening, type WallQuad} from '../../src/canalRecall/landmarks/holedWall';
import {edgeNormal, roofTiers, type PlanPoint, type RoofPlane} from '../../src/canalRecall/landmarks/roofTiers';
import plan from './politie-nieuwezijds-voorburgwal-footprints.json';

/**
 * Politiebureau Nieuwezijds Voorburgwal, Nieuwezijds Voorburgwal 35 / Nieuwezijds Kolk 18 (BAG pand 0363100012171032,
 * BAG bouwjaar 1996, celfunctie + kantoorfunctie; the police moved here from NZ Voorburgwal 104-108 in 2015-2016).
 * The architect is not confirmed by any source used (no monument record, no Wikipedia article of its own).
 *
 * What the city panoramas show (Gemeente Amsterdam, CC BY 4.0; scripts/landmarks/politie-nieuwezijds-voorburgwal-brief.md,
 * staging/landmarks/politie-nieuwezijds-voorburgwal/sources.md), along the Nieuwezijds Voorburgwal front from the north:
 *  - a grey-taupe brick block (19.3 m) cut by nine full-height slit windows with white frames, the transoms of
 *    neighbouring slits staggered by half a storey, over a granite plinth and a recessed dark garage door;
 *  - a glass box (7.3-22.4 m) of teal spandrel bands with a light glass ribbon and white-framed top-hung windows per
 *    storey and grey fins; it also shows above the brick block, set back behind its parapet; under it two brick storeys
 *    of narrow windows and a glazed bay, and the glazed station front;
 *  - a pale concrete pier with a pointed (triangular) plan, carrying the blue police lozenge;
 *  - at the Nieuwezijds Kolk corner a pointed glass prow of blue-grey bands between two such piers, cantilevered over the
 *    recessed glass entrance, with POLITIE in police blue and the gold flame emblem on both faces;
 *  - north on the side street a white-framed glass curtain wall over a pale band and roller shutters; roof railings,
 *    a flagpole and a roof plant room (3DBAG).
 *
 * Massing: 3DBAG LoD2.2 roof planes (CC BY 4.0) snapped to measured levels and stacked as nested tiers (roofTiers); the
 * brick block is authored on its own and cut from the tiers. Frame: x east, z south, y up from the 3DBAG ground
 * (1.0 m NAP), origin = vertex average of the BAG outline (the catalogue anchor).
 */
type C = Parameters<BuildingTools['add']>[1];
type P = PlanPoint;
let b: BuildingTools;

const RING = plan.nativeRing as P[];
const LEVELS = [4.7, 9.6, 11.8, 15.2, 18.9, 22.4, 25.0];
const TOP = 22.4, RIB_TOP = 19.3, RIB_END = 10.5, RIB_DEPTH = 1.0;
const CANOPY = 3.4, BOX_BASE = 7.3, STOREY = 3.5;

/* ------------------------------------------------------------------ frames and mesh */
type Frame = {o: P; t: P; n: P};
const ringArea = (r: P[]) => r.reduce((a, p, i) => { const q = r[(i + 1) % r.length]; return a + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;
/** Frame of a wall whose outward normal is n: t runs viewer-left to viewer-right seen from outside, (t, y, o) right-handed. */
function frameFor(a: P, c: P, n: P): {f: Frame; len: number} {
  const t: P = [n[1], -n[0]], len = Math.hypot(c[0] - a[0], c[1] - a[1]);
  const fwd = (c[0] - a[0]) * t[0] + (c[1] - a[1]) * t[1] > 0;
  return {f: {o: fwd ? a : c, t, n}, len};
}
function ringOut(ring: P[], i: number): P {
  const a = ring[i], c = ring[(i + 1) % ring.length], L = Math.hypot(c[0] - a[0], c[1] - a[1]), s = ringArea(ring) > 0 ? 1 : -1;
  return [s * (c[1] - a[1]) / L, -s * (c[0] - a[0]) / L];
}
const bagFrame = (i: number) => frameFor(RING[i], RING[(i + 1) % RING.length], ringOut(RING, i));
const at = (f: Frame, t: number, o = 0): P => [f.o[0] + f.t[0] * t + f.n[0] * o, f.o[1] + f.t[1] * t + f.n[1] * o];
const shift = (f: Frame, t: number): Frame => ({...f, o: at(f, t)});
const yaw = (n: P) => Math.atan2(n[0], n[1]);

class Mesh {
  private tris = new Map<C, number[]>();
  private push(c: C, ...v: number[]) { let a = this.tris.get(c); if (!a) this.tris.set(c, a = []); a.push(...v); }
  quad(f: Frame, q: WallQuad, c: C) {
    const w = q.pts.map(([t, y, o]) => { const p = at(f, t, o); return [p[0], y, p[1]]; });
    this.push(c, ...w[0], ...w[1], ...w[2], ...w[0], ...w[2], ...w[3]);
  }
  rect(f: Frame, t0: number, t1: number, y0: number, y1: number, o: number, c: C) {
    this.quad(f, {pts: [[t0, y0, o], [t1, y0, o], [t1, y1, o], [t0, y1, o]], normal: [0, 0, 1]}, c);
  }
  /** Proud bar: front face plus the four sides, back at o = 0. */
  bar(f: Frame, t0: number, t1: number, y0: number, y1: number, d: number, c: C, back = 0) {
    this.rect(f, t0, t1, y0, y1, d, c);
    this.quad(f, {pts: [[t0, y1, back], [t0, y1, d], [t1, y1, d], [t1, y1, back]], normal: [0, 1, 0]}, c);
    this.quad(f, {pts: [[t0, y0, back], [t1, y0, back], [t1, y0, d], [t0, y0, d]], normal: [0, -1, 0]}, c);
    this.quad(f, {pts: [[t0, y0, back], [t0, y0, d], [t0, y1, d], [t0, y1, back]], normal: [-1, 0, 0]}, c);
    this.quad(f, {pts: [[t1, y0, back], [t1, y1, back], [t1, y1, d], [t1, y0, d]], normal: [1, 0, 0]}, c);
  }
  /** Horizontal polygon at height y facing up or down. */
  flat(ring: P[], y: number, c: C, up: boolean) {
    const g = new T.ShapeGeometry(new T.Shape(ring.map(p => new T.Vector2(p[0], p[1]))));
    const pos = g.getAttribute('position'), idx = g.index!;
    for (let i = 0; i < idx.count; i += 3) {
      const ids = [idx.getX(i), idx.getX(i + 1), idx.getX(i + 2)];
      const v = ids.map(k => [pos.getX(k), y, pos.getY(k)]);
      const nY = (v[1][2] - v[0][2]) * (v[2][0] - v[0][0]) - (v[1][0] - v[0][0]) * (v[2][2] - v[0][2]);
      if ((nY > 0) === up) this.push(c, ...v[0], ...v[1], ...v[2]); else this.push(c, ...v[0], ...v[2], ...v[1]);
    }
  }
  flush() {
    for (const [c, pos] of this.tris) {
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
      g.computeVertexNormals();
      b.add(g, c);
    }
    this.tris.clear();
  }
}
let m: Mesh;

/* ------------------------------------------------------------------ facade zones */
type Cut = HoledOpening & {back: C; reveal?: C};
/** A rectangle of one wall in its own t (viewer-left origin), with its face material and the openings cut through it. */
type Zone = {t0: number; t1: number; y0: number; y1: number; face: C; cuts: Cut[]};
/** Holed wall for the part of zone z inside t in [ra, rb], y in [ya, yb] (t in the zone's frame f). */
/**
 * `pad`: keep openings this far inside a run edge that has no wall beyond it in the same plane (a roof below or above, the
 * run's ends at a corner), so every pane has wall round it (the opening-outside audit judges a pane against its wall's
 * silhouette; a ribbon cut flush to a roof line reads as glass standing past the wall).
 */
type Pad = {b: number; t: number; ends: number};
function emitZone(f: Frame, z: Zone, ra: number, rb: number, ya: number, yb: number, pad: Pad = {b: 0, t: 0, ends: 0}) {
  const t0 = Math.max(z.t0, ra), t1 = Math.min(z.t1, rb), y0 = Math.max(z.y0, ya), y1 = Math.min(z.y1, yb);
  if (t1 - t0 < 0.02 || y1 - y0 < 0.02) return;
  const lo = y0 <= ya + 1e-3 ? y0 + pad.b : y0, hi = y1 >= yb - 1e-3 ? y1 - pad.t : y1;
  const L = t1 - t0, left = t0 <= ra + 1e-3 ? pad.ends : 0, right = t1 >= rb - 1e-3 ? pad.ends : 0;
  const g = shift(f, t0), cuts = z.cuts.map(c => ({...c, t0: Math.max(c.t0 - t0, Math.min(left, c.t1 - t0 - 0.05)), t1: Math.min(c.t1 - t0, Math.max(L - right, c.t0 - t0 + 0.05)), y0: Math.max(c.y0, Math.min(lo, c.y1 - 0.05)), y1: Math.min(c.y1, Math.max(hi, c.y0 + 0.05))}))
    .filter(c => c.t1 > 1e-3 && c.t0 < L - 1e-3 && c.y1 > y0 + 1e-3 && c.y0 < y1 - 1e-3 && c.t1 - c.t0 > 0.04 && c.y1 - c.y0 > 0.04);
  const hw = holedWall(t1 - t0, y0, y1, cuts);
  for (const q of hw.face) m.quad(g, q, z.face);
  hw.reveals.forEach((qs, k) => qs.forEach(q => m.quad(g, q, cuts[k].reveal ?? z.face)));
  hw.backs.forEach((q, k) => m.quad(g, q, cuts[k].back));
}

/** Storey bands of the glass box and prow: storey bases from 7.3 m on a 3.5 m pitch (w01-315.alt, w03-316). */
const storeyBases = (y0: number, y1: number) => { const out: number[] = []; for (let s = BOX_BASE; s < y1; s += STOREY) if (s + STOREY > y0) out.push(s); return out; };
/** Light glass ribbon per storey (s+2.6..s+3.4), across t0..t1; the prow adds a second ribbon (s+0.55..s+1.2). */
function ribbons(t0: number, t1: number, y0: number, y1: number, prow: boolean): Cut[] {
  const cuts: Cut[] = [];
  for (const s of storeyBases(y0, y1)) {
    const bands: [number, number][] = [[s + 2.6, s + 3.4]];
    if (prow) bands.unshift([s + 0.55, s + 1.2]);
    for (const [a, c] of bands) if (c > y0 && a < y1) cuts.push({t0, t1, y0: Math.max(a, y0), y1: Math.min(c, y1), depth: 0.06, back: 'glass'});
  }
  return cuts;
}
/** White-framed top-hung windows in the dark band (s+1.45..s+1.95) at the given bay centres. */
function bandWindows(centres: number[], w: number, y0: number, y1: number): Cut[] {
  const cuts: Cut[] = [];
  for (const s of storeyBases(y0, y1)) for (const c of centres) if (s + 1.95 < y1 && s + 1.45 > y0) cuts.push({t0: c - w / 2, t1: c + w / 2, y0: s + 1.45, y1: s + 1.95, depth: 0.08, back: 'glass', reveal: 'white'});
  return cuts;
}
/** White frames round the bandWindows openings: four bars 6 cm proud of the face. */
function frameWindows(f: Frame, centres: number[], w: number) {
  for (const s of storeyBases(BOX_BASE, TOP)) for (const c of centres) {
    if (s + 1.95 >= TOP) continue;
    const a = c - w / 2, z = c + w / 2, y0 = s + 1.45, y1 = s + 1.95, k = 0.06;
    m.bar(f, a - k, z + k, y1, y1 + k, 0.09, 'white'); m.bar(f, a - k, z + k, y0 - k, y0, 0.09, 'white');
    m.bar(f, a - k, a, y0, y1, 0.09, 'white'); m.bar(f, z, z + k, y0, y1, 0.09, 'white');
  }
}
/** The banded glass skin for any wall run not authored by hand (roof steps, side faces, the south lower parts). */
function bandedZones(len: number, y0: number, y1: number, ground = true): Zone[] {
  const z: Zone[] = [];
  if (ground && y0 < CANOPY) z.push({t0: 0, t1: len, y0: 0, y1: CANOPY, face: 'bronze', cuts: len > 1.2 ? [{t0: 0.3, t1: len - 0.3, y0: 0.12, y1: 3.1, depth: 0.2, back: 'glass'}] : []});
  if (y1 > CANOPY && y0 < BOX_BASE) z.push({t0: 0, t1: len, y0: CANOPY, y1: BOX_BASE, face: 'bronze', cuts: [{t0: 0, t1: len, y0: 4.3, y1: 7.0, depth: 0.06, back: 'glass'}]});
  if (y1 > BOX_BASE) z.push({t0: 0, t1: len, y0: BOX_BASE, y1: 30, face: 'bronze', cuts: ribbons(0, len, BOX_BASE, 30, false)});
  return z;
}

/* ------------------------------------------------------------------ the designed fronts (BAG ring edges) */
const E_W01 = 19, E_W03 = 22, E_TIP = 23, E_W04 = 24, E_W02 = 0, E_W05 = 15, E_W07 = 8;
const PIER_EDGES = [20, 21, 25, 26];
const CORNER_EDGES = [11, 12, 13, 14, 16, 17, 18];
/** Slit columns of the brick block (w01-315.alt, 2022, at 50 px/m): ten on a 1.016 m pitch from 0.8 m, the last on the fold. */
const SLITS = [...Array(10)].map((_, k) => 0.8 + 1.016 * k);
const SLIT_W = 0.36;
/** Slit bottoms: down to the plinth left of the garage, to the garage head over it, over the lower window row at the right. */
const slitBottom = (t: number) => t < 5.1 ? 1.75 : t < 7.5 ? 3.25 : 4.95;
const GARAGE: [number, number] = [5.1, 9.1];
const LOWER_ROW = [7.9, 8.9, 9.9, 11.0, 12.0, 13.0, 14.0, 15.1, 16.1, 17.2];
const UPPER_ROW = [10.9, 11.8, 12.7, 13.6];
const BAY: [number, number] = [14.35, 16.55];
const BOX: [number, number] = [RIB_END, 17.7];
const BOX_WINDOWS = [11.5, 13.4, 16.6];
const BOX_FINS = [12.5, 15.6];
const SHOP_MULLIONS = [10.95, 12.8, 14.6, 16.4];

const prowWindowCentres = (t0: number, t1: number) => t1 - t0 > 4 ? [t0 + (t1 - t0) * 0.3, t0 + (t1 - t0) * 0.7] : [];
function designs(): Map<number, Zone[]> {
  const d = new Map<number, Zone[]>();
  const len = (i: number) => bagFrame(i).len;
  // w01: (the brick block t 0..10.1 is authored separately) lower brick storeys, glass box, pier band
  {
    const lower: Cut[] = [{t0: BOX[0], t1: BOX[1] - 0.15, y0: 0.12, y1: 2.95, depth: 0.3, back: 'glass', reveal: 'stone'}];
    for (const t of LOWER_ROW) if (t > BOX[0]) lower.push({t0: t - 0.22, t1: t + 0.22, y0: 3.2, y1: 4.7, depth: 0.18, back: 'glass', reveal: 'white'});
    for (const t of UPPER_ROW) lower.push({t0: t - 0.2, t1: t + 0.2, y0: 4.9, y1: 7.0, depth: 0.18, back: 'glass', reveal: 'white'});
    lower.push({t0: BAY[0], t1: BAY[1], y0: 4.9, y1: 7.0, depth: 0.12, back: 'glass', reveal: 'stone'});
    d.set(E_W01, [
      {t0: BOX[0], t1: BOX[1], y0: 0, y1: BOX_BASE, face: 'greyBrick', cuts: lower},
      {t0: BOX[0], t1: BOX[1], y0: BOX_BASE, y1: TOP, face: 'bronze', cuts: [...ribbons(BOX[0], BOX[1], BOX_BASE, TOP, false), ...bandWindows(BOX_WINDOWS, 1.45, BOX_BASE, TOP)]},
      {t0: BOX[1], t1: len(E_W01) + 0.1, y0: 0, y1: TOP, face: 'concrete', cuts: []},
    ]);
  }
  // the prow: w03 (pier 0..1.9), the tip, w04 (pier from 7.3); open below the canopy (the lobby is authored)
  const prowZone = (t0: number, t1: number, wa = t0, wb = t1): Zone => ({t0, t1, y0: CANOPY, y1: TOP, face: 'copper', cuts: [
    {t0, t1, y0: 4.3, y1: 7.0, depth: 0.06, back: 'glass'}, ...ribbons(t0, t1, BOX_BASE, TOP, true),
    ...bandWindows(prowWindowCentres(wa, wb), 1.4, BOX_BASE, TOP)]});
  d.set(E_W03, [{t0: -0.1, t1: 1.9, y0: 0, y1: TOP, face: 'concrete', cuts: []}, prowZone(1.9, len(E_W03) + 0.1, 1.9, len(E_W03))]);
  d.set(E_TIP, [prowZone(-0.1, len(E_TIP) + 0.1, 0, len(E_TIP))]);
  d.set(E_W04, [prowZone(-0.1, 7.3, 0, 7.3), {t0: 7.3, t1: len(E_W04) + 0.1, y0: 0, y1: TOP, face: 'concrete', cuts: []}]);
  for (const i of PIER_EDGES) d.set(i, [{t0: -0.1, t1: len(i) + 0.1, y0: 0, y1: TOP + 1, face: 'concrete', cuts: []}]);
  for (const i of CORNER_EDGES) d.set(i, [{t0: -0.1, t1: len(i) + 0.1, y0: 0, y1: TOP + 1, face: 'concrete', cuts: []}]);
  // w02 (south, behind the birches): grey-framed gridded glass over a glazed ground storey
  {
    const L = len(E_W02), cuts: Cut[] = [], cols = Math.round((L - 0.4) / 1.2), p = (L - 0.4) / cols;
    for (let s = CANOPY; s < TOP - 0.5; s += STOREY) for (let k = 0; k < cols; k++) cuts.push({t0: 0.2 + k * p + 0.06, t1: 0.2 + (k + 1) * p - 0.06, y0: s + 0.5, y1: Math.min(s + STOREY - 0.08, TOP - 0.4), depth: 0.08, back: 'glass'});
    d.set(E_W02, [
      {t0: -0.1, t1: L + 0.1, y0: 0, y1: CANOPY, face: 'frame', cuts: [{t0: 0.3, t1: L - 0.3, y0: 0.1, y1: 3.1, depth: 0.2, back: 'glass'}]},
      {t0: -0.1, t1: L + 0.1, y0: CANOPY, y1: TOP + 1, face: 'frame', cuts},
    ]);
  }
  // w05 (north, side street): roller shutters, pale band, white-framed curtain wall of nine columns, four storeys
  {
    const L = len(E_W05), cuts: Cut[] = [], cols = 9, p = (L - 0.16) / cols;
    const storeys: [number, number][] = [[4.8, 8.3], [8.3, 11.8], [11.8, 15.3], [15.3, 18.95]];
    for (const [s0, s1] of storeys) {
      const mid = s0 + (s1 - s0 - 0.42) / 2;
      cuts.push({t0: 0.08, t1: L - 0.08, y0: s1 - 0.42, y1: s1 - 0.06, depth: 0.05, back: 'bronze'});   // dark spandrel row
      for (let k = 0; k < cols; k++) for (const [a, c] of [[s0 + 0.05, mid - 0.03], [mid + 0.03, s1 - 0.48]]) cuts.push({t0: 0.08 + k * p + 0.04, t1: 0.08 + (k + 1) * p - 0.04, y0: a, y1: c, depth: 0.07, back: 'glass'});
    }
    d.set(E_W05, [
      {t0: -0.1, t1: L + 0.1, y0: 0, y1: 3.2, face: 'concrete', cuts: [{t0: 0.25, t1: L - 0.25, y0: 0.1, y1: 3.1, depth: 0.15, back: 'dark'}]},
      {t0: -0.1, t1: L + 0.1, y0: 3.2, y1: 4.8, face: 'concrete', cuts: []},
      {t0: -0.1, t1: L + 0.1, y0: 4.8, y1: 19.0, face: 'white', cuts},
    ]);
  }
  // w07 (the end of the Sint Jacobsstraat): light grey roller shutters (2025 pano) under a pale band
  {
    const L = len(E_W07);
    d.set(E_W07, [
      {t0: -0.1, t1: L + 0.1, y0: 0, y1: 3.2, face: 'concrete', cuts: [{t0: 0.2, t1: L - 0.2, y0: 0.1, y1: 3.1, depth: 0.15, back: 'frame'}]},
      {t0: -0.1, t1: L + 0.1, y0: 3.2, y1: 4.7, face: 'concrete', cuts: []},
      ...bandedZones(L + 0.1, 4.7, 30, false).map(z => ({...z, t0: -0.1, y0: Math.max(z.y0, 4.7)})),
    ]);
  }
  return d;
}

/** The BAG ring edge a plan segment lies on (within 0.25 m), with the segment's t range on that edge. */
function onBagEdge(a: P, c: P): {i: number; ta: number; tb: number} | null {
  for (let i = 0; i < RING.length; i++) {
    const {f, len} = bagFrame(i);
    const loc = (p: P) => [(p[0] - f.o[0]) * f.t[0] + (p[1] - f.o[1]) * f.t[1], (p[0] - f.o[0]) * f.n[0] + (p[1] - f.o[1]) * f.n[1]];
    const [ta, oa] = loc(a), [tb, ob] = loc(c);
    if (Math.abs(oa) < 0.25 && Math.abs(ob) < 0.25 && Math.min(ta, tb) > -0.3 && Math.max(ta, tb) < len + 0.3 && Math.abs(tb - ta) > 0.01) return {i, ta: Math.min(ta, tb), tb: Math.max(ta, tb)};
  }
  return null;
}
const inside = (p: P, r: P[]) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) if ((r[i][1] > p[1]) !== (r[j][1] > p[1]) && p[0] < (r[j][0] - r[i][0]) * (p[1] - r[i][1]) / (r[j][1] - r[i][1]) + r[i][0]) c = !c; return c; };

/* ------------------------------------------------------------------ build */
export function buildPolitieNieuwezijdsVoorburgwal(_w: number, _d: number, tools: BuildingTools) {
  b = tools;
  m = new Mesh();
  const D = designs();
  const {f: F1} = bagFrame(E_W01);

  // ---- the brick block: footprint inside the strip t 0..10.1, 1 m deep behind the w01 line
  const strip: P[] = [at(F1, 0, 2), at(F1, RIB_END, 2), at(F1, RIB_END, -RIB_DEPTH), at(F1, 0, -RIB_DEPTH)];
  const close = (r: P[]) => [...r, r[0]];
  const ribPoly = (polygonClipping.intersection([close(RING)], [close(strip)])[0][0] as P[]).slice(0, -1);

  // ---- tiers from the 3DBAG roof planes, with the brick block cut out
  const planes: RoofPlane[] = plan.roofs.map(r => ({ring: r.rings[0].map(p => [p[0], p[2]] as P), height: r.rings[0].reduce((s, p) => s + p[1], 0) / r.rings[0].length}));
  const tiers = roofTiers(planes, {levels: LEVELS, minAreaM2: 2, simplifyM: 0.12, cuts: [[strip]]});

  const inPlan = (k: number, p: P) => k >= 0 && k < tiers.length && tiers[k].plan.some(([outer, ...holes]) => inside(p, outer) && !holes.some(h => inside(p, h)));
  tiers.forEach((tier, k) => {
    for (const poly of tier.plan) for (const ring of poly) for (let i = 0; i < ring.length; i++) {
      const a = ring[i], c = ring[(i + 1) % ring.length], n = edgeNormal(a, c), L = Math.hypot(c[0] - a[0], c[1] - a[1]);
      if (L < 0.05) continue;
      const mid: P = [(a[0] + c[0]) / 2 + n[0] * 0.3, (a[1] + c[1]) / 2 + n[1] * 0.3];
      let y0 = tier.bottom;
      if (inside(mid, ribPoly)) y0 = Math.max(y0, RIB_TOP);   // buried in the brick block below its parapet
      if (y0 >= tier.top - 0.02) continue;
      const inward: P = [(a[0] + c[0]) / 2 - n[0] * 0.3, (a[1] + c[1]) / 2 - n[1] * 0.3];
      const pad: Pad = {b: y0 > 0.01 && inPlan(k - 1, mid) ? 0.15 : 0, t: inPlan(k + 1, inward) ? 0 : 0.15, ends: 0.08};
      const hit = onBagEdge(a, c), zones = hit && D.get(hit.i);
      if (hit && zones) { const {f} = bagFrame(hit.i); for (const z of zones) emitZone(f, z, hit.ta, hit.tb, y0, tier.top, pad); }
      else {
        const {f, len} = frameFor(a, c, n);
        const party = n[0] > 0.7 && mid[0] > 6;                // east party walls against the Sint Jacobsstraat row
        const plant = tier.top > 24;
        const zs: Zone[] = party || plant ? [{t0: 0, t1: len, y0: 0, y1: 30, face: plant ? 'stone' : 'greyBrick', cuts: []}] : bandedZones(len, y0, tier.top);
        for (const z of zs) emitZone(f, z, 0, len, y0, tier.top, pad);
      }
      m.flush();
    }
    for (const poly of tier.roof) {
      const [outer, ...holes] = poly, s = new T.Shape(outer.map(([x, z]) => new T.Vector2(x, z)));
      for (const h of holes) s.holes.push(new T.Path(h.map(([x, z]) => new T.Vector2(x, z))));
      b.add(upwardRoofPlane(s, tier.top), 'slate');
    }
  });

  // ---- the brick block: front with the slits, plinth and garage; side, parapet back, top
  {
    const front: Cut[] = [];
    SLITS.forEach((t, k) => {
      const y0 = slitBottom(t);
      front.push({t0: t - SLIT_W / 2, t1: t + SLIT_W / 2, y0, y1: 19.0, depth: 0.25, back: 'glass', reveal: 'white'});
      if (t > 7.5) front.push({t0: t - 0.22, t1: t + 0.22, y0: 3.2, y1: 4.7, depth: 0.18, back: 'glass', reveal: 'white'});
      void k;
    });
    front.push({t0: GARAGE[0], t1: GARAGE[1], y0: 0.1, y1: 3.0, depth: 0.55, back: 'dark', reveal: 'greyBrick'});
    front.push({t0: GARAGE[1] + 0.2, t1: RIB_END, y0: 0.12, y1: 2.95, depth: 0.3, back: 'glass', reveal: 'stone'});
    const plinthCuts = front.filter(c => c.y0 < 0.45);
    emitZone(F1, {t0: 0, t1: RIB_END, y0: 0, y1: 0.45, face: 'stone', cuts: plinthCuts}, 0, RIB_END, 0, 0.45);
    emitZone(F1, {t0: 0, t1: RIB_END, y0: 0.45, y1: RIB_TOP, face: 'greyBrick', cuts: front}, 0, RIB_END, 0.45, RIB_TOP);
    m.flush();
    // side faces at the north corner (ring edges inside the strip, off the w01 line), the parapet back, the top
    for (let i = 0; i < ribPoly.length; i++) {
      const a = ribPoly[i], c = ribPoly[(i + 1) % ribPoly.length], n = ringOut(ribPoly, i), L = Math.hypot(c[0] - a[0], c[1] - a[1]);
      if (L < 0.05) continue;
      const mid: P = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2];
      const o = (mid[0] - F1.o[0]) * F1.n[0] + (mid[1] - F1.o[1]) * F1.n[1], t = (mid[0] - F1.o[0]) * F1.t[0] + (mid[1] - F1.o[1]) * F1.t[1];
      if (Math.abs(o) < 0.05) continue;                               // the front, done above
      if (Math.abs(t - RIB_END) < 0.05) continue;                     // against the glass box
      const {f} = frameFor(a, c, n);
      if (Math.abs(o + RIB_DEPTH) < 0.05) { m.rect(f, 0, L, 18.85, RIB_TOP, 0, 'greyBrick'); continue; }   // parapet back over the 18.9 roof
      if (Math.abs(t) < 0.05) continue;                               // the cut start on the tier side
      m.rect(f, 0, L, 0, RIB_TOP, 0, 'greyBrick');
    }
    m.flat(ribPoly, RIB_TOP, 'stone', true);
    m.flush();
    // transoms in the slits: whole storeys on even columns, a small vent box on odd ones (staggered half a storey)
    SLITS.forEach((t, k) => {
      const ys = k % 2 === 0 ? [7.3, 10.9, 14.4, 18.0] : [5.3, 5.6, 8.8, 9.1, 12.4, 12.7, 16.0, 16.3];
      const bottom = slitBottom(t);
      for (const y of ys) if (y > bottom + 0.2) m.rect(F1, t - SLIT_W / 2, t + SLIT_W / 2, y - 0.03, y + 0.03, -0.12, 'white');
    });
    // garage doors: two leaves; mullions of the glazed front
    m.rect(F1, (GARAGE[0] + GARAGE[1]) / 2 - 0.03, (GARAGE[0] + GARAGE[1]) / 2 + 0.03, 0.1, 2.95, -0.45, 'frame');
    for (const t of SHOP_MULLIONS) m.rect(F1, t - 0.04, t + 0.04, 0.12, 2.95, -0.2, 'frame');
    // opaque light fascia panels over the station glazing (2022 pano: a frosted band above a transom at 2.45 m)
    m.rect(F1, GARAGE[1] + 0.2, BOX[1] - 0.15, 2.45, 2.95, -0.12, 'concrete');
    m.rect(F1, GARAGE[1] + 0.2, BOX[1] - 0.15, 2.4, 2.45, -0.2, 'frame');
    m.flush();
  }

  // ---- w01 glass box trim: fins, white window frames, soffit band; the lower bay window grid
  {
    for (const t of BOX_FINS) m.bar(F1, t - 0.07, t + 0.07, BOX_BASE, TOP - 0.1, 0.28, 'stone');
    m.bar(F1, BOX[0], BOX[1], BOX_BASE - 0.12, BOX_BASE + 0.08, 0.12, 'stone');
    frameWindows(F1, BOX_WINDOWS, 1.45);
    for (const t of [15.1, 15.8]) m.rect(F1, t - 0.04, t + 0.04, 4.9, 7.0, -0.04, 'frame');
    m.rect(F1, BAY[0], BAY[1], 5.95, 6.02, -0.04, 'frame');
    m.flush();
  }

  // ---- the prow: horizontal frames, POLITIE and the emblem on both faces, the lobby under the canopy
  const prowFaces: {i: number; t0: number; t1: number; text: [number, number]}[] = [
    {i: E_W03, t0: 1.9, t1: bagFrame(E_W03).len, text: [4.6, 9.1]},
    {i: E_TIP, t0: 0, t1: bagFrame(E_TIP).len, text: [0, 0]},
    {i: E_W04, t0: 0, t1: 7.3, text: [1.8, 6.3]},
  ];
  for (const pf of prowFaces) {
    const {f} = bagFrame(pf.i);
    for (const s of storeyBases(CANOPY, TOP)) for (const y of [s, s + 0.55, s + 1.2, s + 2.6]) if (y > CANOPY + 0.3 && y < TOP - 0.1) m.bar(f, pf.t0, pf.t1, y - 0.03, y + 0.03, 0.07, 'frame');
    m.bar(f, pf.t0, pf.t1, CANOPY - 0.25, CANOPY + 0.1, 0.1, 'concrete');
    frameWindows(f, prowWindowCentres(pf.t0, pf.t1), 1.4);
  }
  m.flush();
  for (const pf of prowFaces) {
    if (pf.text[1] <= pf.text[0]) continue;
    const {f} = bagFrame(pf.i), [ta, tb] = pf.text, yc = 5.5, h = 0.6;
    const pw = 0.55, ew = 1.0, gap = 0.12;
    const P1 = raisedLettering({text: 'P', heightM: h, maxWidthM: pw, depthM: 0.05});
    const L1 = raisedLettering({text: 'LITIE', heightM: h, maxWidthM: tb - ta - pw - ew - 2 * gap, depthM: 0.05});
    const tp = ta + P1.widthM / 2, te = ta + P1.widthM + gap + ew / 2, tl = ta + P1.widthM + 2 * gap + ew + L1.widthM / 2;
    for (const [g, t] of [[P1.geometry, tp], [L1.geometry, tl]] as [T.BufferGeometry, number][]) { const p = at(f, t, 0.02); b.add(g, 'blue', p[0], yc, p[1], yaw(f.n)); }
    // the emblem: a gold lozenge with the white flame, over the O
    const loz = new T.Shape([new T.Vector2(0, -0.62), new T.Vector2(ew / 2, 0), new T.Vector2(0, 0.62), new T.Vector2(-ew / 2, 0)]);
    const flame = new T.Shape(); flame.moveTo(0, 0.42); flame.quadraticCurveTo(0.24, 0.05, 0.1, -0.36); flame.lineTo(-0.1, -0.36); flame.quadraticCurveTo(-0.24, 0.05, 0, 0.42);
    const pe = at(f, te, 0.02);
    b.add(new T.ExtrudeGeometry(loz, {depth: 0.06, bevelEnabled: false}).translate(0, 0, -0.01), 'gold', pe[0], yc + 0.1, pe[1], yaw(f.n));
    b.add(new T.ExtrudeGeometry(flame, {depth: 0.04, bevelEnabled: false, curveSegments: 4}).translate(0, 0, 0.04), 'white', pe[0], yc + 0.1, pe[1], yaw(f.n));
  }
  // lobby: glass walls 2.2 m behind the prow faces between the two piers, soffit, tip column
  {
    const IN = 2.2;
    const f3 = bagFrame(E_W03).f, f4 = bagFrame(E_W04).f, fT = bagFrame(E_TIP).f;
    const line = (f: Frame): [P, P] => [at(f, 0, -IN), at(f, 1, -IN)];
    const meet = ([p, q]: [P, P], [r, s]: [P, P]): P => {
      const d1: P = [q[0] - p[0], q[1] - p[1]], d2: P = [s[0] - r[0], s[1] - r[1]], den = d1[0] * d2[1] - d1[1] * d2[0];
      const u = ((r[0] - p[0]) * d2[1] - (r[1] - p[1]) * d2[0]) / den;
      return [p[0] + d1[0] * u, p[1] + d1[1] * u];
    };
    const A0 = at(f3, 1.9, 0), A1 = at(f3, 1.9, -IN), B1 = meet(line(f3), line(fT)), B2 = meet(line(fT), line(f4)), C1 = at(f4, 7.3, -IN), C0 = at(f4, 7.3, 0);
    const lobby: P[] = [A1, B1, B2, C1], normals: P[] = [f3.n, fT.n, f4.n];
    for (let i = 0; i + 1 < lobby.length; i++) {
      const p = lobby[i], q = lobby[i + 1], L = Math.hypot(q[0] - p[0], q[1] - p[1]);
      const {f} = frameFor(p, q, normals[i]);
      emitZone(f, {t0: 0, t1: L, y0: 0, y1: CANOPY, face: 'frame', cuts: [{t0: 0.08, t1: L - 0.08, y0: 0.05, y1: CANOPY - 0.3, depth: 0.06, back: 'glass'}]}, 0, L, 0, CANOPY);
      m.flush();
      for (let t = 1.2; t < L - 0.3; t += 1.2) m.bar(f, t - 0.04, t + 0.04, 0.05, CANOPY - 0.3, 0.05, 'frame', -0.06);
    }
    // the pier returns down to the pavement at both ends of the lobby, facing the open space under the prow
    m.rect(frameFor(A0, A1, f3.t).f, 0, IN, 0, CANOPY, 0, 'concrete');
    m.rect(frameFor(C1, C0, [-f4.t[0], -f4.t[1]]).f, 0, IN, 0, CANOPY, 0, 'concrete');
    // soffit between the prow line and the lobby
    const soffit: P[] = [A0, at(f3, bagFrame(E_W03).len, 0), at(fT, bagFrame(E_TIP).len, 0), C0, ...[...lobby].reverse()];
    m.flat(soffit, CANOPY, 'concrete', false);
    m.flush();
    const tip = at(fT, bagFrame(E_TIP).len / 2, -0.9);
    b.add(new T.CylinderGeometry(0.22, 0.22, CANOPY, 12, 1, true), 'stone', tip[0], CANOPY / 2, tip[1]);
  }

  // ---- the police lozenge on the NZV pier, the flagpole, the north roof railing
  {
    const p = at(F1, 17.8, 0.02), loz = new T.Shape([new T.Vector2(0, -0.5), new T.Vector2(0.42, 0), new T.Vector2(0, 0.5), new T.Vector2(-0.42, 0)]);
    b.add(new T.ExtrudeGeometry(loz, {depth: 0.08, bevelEnabled: false}).translate(0, 0, -0.01), 'blue', p[0], 6.7, p[1], yaw(F1.n));
    const fp = at(F1, 8.8, -2.5);
    b.add(new T.CylinderGeometry(0.06, 0.08, 6.0, 8, 1, true), 'stone', fp[0], TOP + 3.0, fp[1]);
    const fl = at(F1, 8.8 + 0.85, -2.5);
    b.add(new T.BoxGeometry(1.6, 1.0, 0.04), 'blue', fl[0], TOP + 5.3, fl[1], Math.atan2(-F1.t[1], F1.t[0]));
    const {f: F5, len: L5} = bagFrame(E_W05), rail: P[] = [];
    for (let k = 0; k <= Math.round(L5 / 1.75); k++) rail.push(at(F5, 0.15 + (L5 - 0.3) * k / Math.round(L5 / 1.75), -0.2));
    for (const q of rail) b.add(new T.BoxGeometry(0.05, 1.0, 0.05), 'stone', q[0], 19.0 + 0.5, q[1]);
    const r0 = at(F5, L5 / 2, -0.2);
    b.add(new T.BoxGeometry(L5 - 0.3, 0.06, 0.06), 'stone', r0[0], 20.0, r0[1], Math.atan2(-F5.t[1], F5.t[0]));
  }
}
