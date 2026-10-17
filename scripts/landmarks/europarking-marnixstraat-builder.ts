/**
 * Europarking, the Marnixstraat car park (Marnixstraat 248-250, BAG 0363100012185422, 1972) with the Waterkant bar in
 * its undercroft on the Singelgracht. What makes it recognisable, from the open references in
 * scripts/landmarks/europarking-marnixstraat-inventory.json:
 *
 *  - two round helical ramp drums standing in the Singelgracht corner, side by side like a figure of eight, read as
 *    seven thick white bands with rounded noses (the lowest one deepest, curving under to the soffit) alternating
 *    with six deep dark open slots, a thin blue rail on each band; dark round pillars under a 4.6 m undercroft;
 *  - the 71 x 38.6 m deck block behind them: the same seven-band rhythm with flat white parapet panels and grey glazed
 *    ribbons with mullions, on pale round pillars;
 *  - under the drums, the Waterkant: a teal pavilion with green WATERKANT letters over a black-and-white zigzag
 *    frieze and a striped awning, blue tents and picnic tables along the canal.
 *
 * Measured: plan from the BAG footprints (europarking-prepare.ts; drums r 9.32 m round 3.85 m open cores, centres
 * 18.2 m apart, so the two drums meet at their radical line); band levels from the rectified panorama crops
 * (w04-337 at 44.7 px/m: pitch 2.60 m, white panels 1.28 m, ribbons 1.32 m, lowest band 1.75 m over a 4.65 m
 * undercroft; top of parapet = 3DBAG roof max 22.0 m) and, for the drums, the 2021 canal panoramas and Commons photos
 * (white:slot about 3:2 at the same slot centres; top rim at 3DBAG's 21.8 m).
 *
 * Frame: x east, z south, y up (3DBAG ground 0.50 m NAP), origin = the catalogue's surveyed anchor.
 */
import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {raisedLettering} from './ornament-kit';
import {circleRing, openDeckStack, type DeckBand, type DeckRole, type DeckStackGeometry, type PlanPoint} from '../../src/canalRecall/landmarks/openDeckStack';
import plan from './europarking-marnixstraat-footprints.json';

type Col = Parameters<BuildingTools['add']>[1];
type V = [number, number];

/** Block (and connector) bands: measured on w04-337 / w01-67, bottom to top. */
export const BLOCK_BANDS: DeckBand[] = [[4.65, 6.40], [7.72, 9.00], [10.32, 11.60], [12.92, 14.20], [15.52, 16.80], [18.12, 19.40], [20.72, 22.0]].map(([bottom, top]) => ({bottom, top}));
/** Drum bands: slots 1.05 m centred on the block's slots, the rim to 21.8 m, the lowest band 4.6 m up. */
const SLOT_CENTRES = BLOCK_BANDS.slice(0, -1).map((b, i) => (b.top + BLOCK_BANDS[i + 1].bottom) / 2);
export const DRUM_BANDS: DeckBand[] = [4.6, ...SLOT_CENTRES.map(c => c + 0.525)].map((bottom, i) => ({bottom, top: i < SLOT_CENTRES.length ? SLOT_CENTRES[i] - 0.525 : 21.8}));

const DRUM_R = 9.32, CORE_R = 3.85, DRUM_SEG = 56;

let b: BuildingTools;
const geom = (pos: number[]) => { const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); return g; };
function emit(g: DeckStackGeometry, colours: Partial<Record<DeckRole, Col>>) {
  for (const [role, c] of Object.entries(colours) as [DeckRole, Col][]) if (g[role].length) b.add(geom(g[role]), c);
}
/** Outward normal of ring edge i (ring of any winding). */
function outward(ring: V[], i: number): V {
  let a = 0; for (let k = 0; k < ring.length; k++) { const p = ring[k], q = ring[(k + 1) % ring.length]; a += p[0] * q[1] - q[0] * p[1]; }
  const p = ring[i], q = ring[(i + 1) % ring.length], dx = q[0] - p[0], dz = q[1] - p[1], l = Math.hypot(dx, dz), s = a > 0 ? 1 : -1;
  return [s * dz / l, -s * dx / l];
}
const yaw = (n: V) => Math.atan2(n[0], n[1]);
/** Compass bearing -> unit vector in the x-east, z-south frame. */
const dir = (bearing: number): V => [Math.sin(bearing * Math.PI / 180), -Math.cos(bearing * Math.PI / 180)];
function prism(ring: V[], y0: number, y1: number, c: Col) {
  const shape = new T.Shape(ring.map(p => new T.Vector2(p[0], -p[1])));
  const g = new T.ExtrudeGeometry(shape, {depth: y1 - y0, bevelEnabled: false}).rotateX(-Math.PI / 2).translate(0, y0, 0);
  b.add(g.toNonIndexed(), c);
}
const cyl = (x: number, z: number, r: number, y0: number, y1: number, c: Col, seg = 12) => b.add(new T.CylinderGeometry(r, r, y1 - y0, seg, 1, true), c, x, (y0 + y1) / 2, z);
const dedupe = (ring: number[][]) => ring.filter((p, i) => Math.hypot(p[0] - ring[(i + 1) % ring.length][0], p[1] - ring[(i + 1) % ring.length][1]) > 0.08) as V[];

export function buildEuroparkingMarnixstraat(_w: number, _d: number, tools: BuildingTools) {
  b = tools;
  const [A, B] = plan.drums.map(d => d.core.centre as V);           // A north, B south
  const ab = Math.hypot(B[0] - A[0], B[1] - A[1]), u: V = [(B[0] - A[0]) / ab, (B[1] - A[1]) / ab];
  const M: V = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];

  // ---- the two ramp drums, each clipped at the radical line so they meet without overlapping faces
  for (const [c, side] of [[A, 1], [B, -1]] as [V, number][]) {
    const g = openDeckStack({
      ring: circleRing(c, DRUM_R, DRUM_SEG), holes: [circleRing(c, CORE_R, 24)], bands: DRUM_BANDS,
      slotDepth: 2.2, nose: 0.4, noseSegments: 3, underside: 1.0, undersideSegments: 3, parapet: 0.45, deckY: 20.7,
      rail: [0.06, 0.1, 0.12], clip: [{point: M, normal: [u[0] * side, u[1] * side]}],
    });
    emit(g, {parapet: 'white', slot: 'dark', slotCeiling: 'dark', slotFloor: 'concrete', parapetInner: 'concrete', deck: 'slate', soffit: 'concrete', well: 'dark', rail: 'blue'});
    // The core well's floor at the undercroft ceiling (the well is open above, closed below).
    const disc = new T.CircleGeometry(CORE_R, 24).rotateX(-Math.PI / 2).toNonIndexed();
    b.add(disc, 'dark', c[0], DRUM_BANDS[0].bottom, c[1]);
    // Dark round pillars under the drum.
    for (let k = 0; k < 8; k++) { const a = (k + 0.5) * Math.PI / 4; cyl(c[0] + 6.0 * Math.cos(a), c[1] + 6.0 * Math.sin(a), 0.36, 0, DRUM_BANDS[0].bottom, 'dark'); }
  }

  // ---- the deck block
  const [S, E, N, W] = plan.block.corners as V[];
  const block = openDeckStack({ring: [S, E, N, W], bands: BLOCK_BANDS, slotDepth: 0.45, parapet: 0.25, deckY: 20.9});
  emit(block, {parapet: 'stone', slot: 'glass', slotCeiling: 'dark', slotFloor: 'stone', parapetInner: 'stone', deck: 'slate', soffit: 'concrete'});
  // Ribbon mullions every ~1.9 m (w03-157, w04-337): front and cheeks only (they run floor to ceiling and pierce the glass).
  {
    const pos: number[] = [];
    const quad = (a: number[], c: number[], d: number[], e: number[]) => pos.push(...a, ...c, ...d, ...a, ...d, ...e);
    [[S, E], [E, N], [N, W], [W, S]].forEach(([p, q], edge) => {
      const len = Math.hypot(q[0] - p[0], q[1] - p[1]), t: V = [(q[0] - p[0]) / len, (q[1] - p[1]) / len], n = outward([S, E, N, W], edge);
      const count = Math.round(len / 1.9);
      for (let k = 1; k < count; k++) {
        const s = k * len / count, P = (dt: number, o: number, y: number) => [p[0] + t[0] * (s + dt) + n[0] * o, y, p[1] + t[1] * (s + dt) + n[1] * o];
        for (let i = 0; i + 1 < BLOCK_BANDS.length; i++) {
          const y0 = BLOCK_BANDS[i].top, y1 = BLOCK_BANDS[i + 1].bottom, w = 0.04, f = -0.37, r = -0.47;
          quad(P(-w, f, y0), P(w, f, y0), P(w, f, y1), P(-w, f, y1));       // front, facing out
          quad(P(w, r, y0), P(w, r, y1), P(w, f, y1), P(w, f, y0));         // cheeks
          quad(P(-w, f, y0), P(-w, f, y1), P(-w, r, y1), P(-w, r, y0));
        }
      }
    });
    b.add(geom(pos), 'frame');
  }
  // Pale round pillars on a grid 3 m in from the faces.
  /** Point at fractions (a along the canal face W -> S, c across S -> E). */
  const along = (a: number, c: number): V => [W[0] + (S[0] - W[0]) * a + (E[0] - S[0]) * c, W[1] + (S[1] - W[1]) * a + (E[1] - S[1]) * c];
  const lenWS = Math.hypot(S[0] - W[0], S[1] - W[1]), lenSE = Math.hypot(E[0] - S[0], E[1] - S[1]);
  for (let i = 0; i < 10; i++) for (let j = 0; j < 4; j++) {
    const p = along((3 + i * (lenWS - 6) / 9) / lenWS, (3 + j * (lenSE - 6) / 3) / lenSE);
    cyl(p[0], p[1], 0.5, 0, BLOCK_BANDS[0].bottom, 'concrete');
  }
  // Q-Park EUROPARKING lettering on the Marnixstraat face's lowest band (w01-67, 48-56 m from the east corner).
  {
    const n = outward([S, E, N, W], 1), len = Math.hypot(N[0] - E[0], N[1] - E[1]), s = 52 / len;
    const L = raisedLettering({text: 'Q-PARK EUROPARKING', heightM: 0.55, maxWidthM: 8.5, depthM: 0.04});
    b.add(L.geometry, 'frame', E[0] + (N[0] - E[0]) * s, (BLOCK_BANDS[0].bottom + BLOCK_BANDS[0].top) / 2, E[1] + (N[1] - E[1]) * s, yaw(n));
  }

  // ---- the connector between the drums and the block's canal face (BAG fillets); its drum and block sides are buried
  {
    const ring = plan.pands.carPark.ring as V[];
    const near = (p: V, c: V) => Math.abs(Math.hypot(p[0] - c[0], p[1] - c[1]) - DRUM_R) < 0.12;
    // Fillet B: from the last vertex on drum B before the canal face; fillet A: from the canal face to drum A.
    const iS = ring.findIndex(p => Math.hypot(p[0] - S[0], p[1] - S[1]) < 0.05), iW = ring.findIndex(p => Math.hypot(p[0] - W[0], p[1] - W[1]) < 0.05);
    let k = iS - 1; while (!near(ring[k - 1], B)) k--;
    const filletB = ring.slice(k - 1, iS);
    let m = iW + 1; while (!near(ring[m], A)) m++;
    const filletA = ring.slice(iW + 1, m + 1);
    const ang = (c: V, p: V) => Math.atan2(p[1] - c[1], p[0] - c[0]);
    const wrap = (d: number) => { while (d > Math.PI) d -= 2 * Math.PI; while (d <= -Math.PI) d += 2 * Math.PI; return d; };
    const onCircle = (c: V, a: number): V => [c[0] + DRUM_R * Math.cos(a), c[1] + DRUM_R * Math.sin(a)];
    /** Points strictly between `from` and `to` on the drum circle about c, the short way round. */
    const arc = (c: V, from: V, to: V, step = 8): V[] => {
      const a0 = ang(c, from), d = wrap(ang(c, to) - a0), nSeg = Math.max(2, Math.ceil(Math.abs(d) * 180 / Math.PI / step)), pts: V[] = [];
      for (let k2 = 1; k2 < nSeg; k2++) pts.push(onCircle(c, a0 + d * k2 / nSeg));
      return pts;
    };
    // The V where the drums pinch on the block side is cut 2.5 m short (the drum parapets close it above).
    const h = Math.sqrt(DRUM_R ** 2 - (ab / 2) ** 2), perp: V = [-u[1], u[0]];
    const sideSign = ((S[0] - M[0]) * perp[0] + (S[1] - M[1]) * perp[1]) > 0 ? 1 : -1;
    const pinch: V = [M[0] + perp[0] * h * sideSign, M[1] + perp[1] * h * sideSign];
    const cut = 2.5 / DRUM_R;
    const pB = onCircle(B, ang(B, pinch) + Math.sign(wrap(ang(B, filletB[0]) - ang(B, pinch))) * cut);
    const pA = onCircle(A, ang(A, pinch) + Math.sign(wrap(ang(A, filletA.at(-1)!) - ang(A, pinch))) * cut);
    const poly: V[] = [pB, ...arc(B, pB, filletB[0]), ...filletB, ...filletA, ...arc(A, filletA.at(-1)!, pA), pA];
    const exposed = poly.map((p, i) => filletB.includes(p) && filletB.includes(poly[(i + 1) % poly.length]) || filletA.includes(p) && filletA.includes(poly[(i + 1) % poly.length]));
    const g = openDeckStack({ring: poly, bands: BLOCK_BANDS, slotDepth: 0.45, parapet: 0.25, deckY: 20.9, exposed, slabs: true, clampMiters: true});
    emit(g, {parapet: 'stone', slot: 'glass', slotCeiling: 'dark', slotFloor: 'concrete', parapetInner: 'stone', deck: 'slate', soffit: 'concrete'});
  }

  // ---- the Waterkant (BAG 0363100012243632, 2016) under the drum pinch, and the small undercroft pands
  const wk = dedupe(plan.pands.waterkant.ring);
  prism(wk, 0, 2.85, 'pink');
  // The bar front: the pavilion edge facing the canal (about bearing 247).
  let fi = 0, best = -1;
  for (let i = 0; i < wk.length; i++) { const n = outward(wk, i), d = dir(247), len = Math.hypot(wk[(i + 1) % wk.length][0] - wk[i][0], wk[(i + 1) % wk.length][1] - wk[i][1]); const score = (n[0] * d[0] + n[1] * d[1]) * len; if (score > best) { best = score; fi = i; } }
  {
    const p = wk[fi], q = wk[(fi + 1) % wk.length], n = outward(wk, fi), len = Math.hypot(q[0] - p[0], q[1] - p[1]), t: V = [(q[0] - p[0]) / len, (q[1] - p[1]) / len];
    const at = (s: number, out: number): V => [p[0] + t[0] * s + n[0] * out, p[1] + t[1] * s + n[1] * out];
    const mid = at(len / 2, 0), a = yaw(n), W0 = len - 0.6;
    // Glazed bar front with a dark frame.
    const gf = at(len / 2, 0.04); b.box(gf[0], 0.15, gf[1], W0, 2.1, 0.1, 'glass', a);
    for (let s = 0.3; s <= len - 0.3 + 1e-6; s += (len - 0.6) / 5) { const f = at(s, 0.1); b.box(f[0], 0.15, f[1], 0.1, 2.1, 0.08, 'frame', a); }
    // Striped awning (red and blue, Commons 2015 photo) sloping out over the front.
    const stripes = 14, sw = W0 / stripes;
    for (let k = 0; k < stripes; k++) {
      const s = 0.3 + sw * (k + 0.5), g = new T.BoxGeometry(sw, 0.05, 1.7).rotateX(0.28).translate(0, 0, 0.85);
      const o = at(s, 0); b.add(g, k % 2 ? 'blue' : 'red', o[0], 2.3, o[1], a);
    }
    // Zigzag frieze: a white strip with dark chevrons over the awning.
    const fz = at(len / 2, 0.02); b.box(fz[0], 2.3, fz[1], W0, 0.55, 0.06, 'white', a);
    const teeth = 12, tw = W0 / teeth;
    for (let k = 0; k < teeth; k++) {
      const sh = new T.Shape([new T.Vector2(-tw / 2, 0.5), new T.Vector2(tw / 2, 0.5), new T.Vector2(0, 0.07)]);
      const g = new T.ExtrudeGeometry(sh, {depth: 0.12, bevelEnabled: false});
      const o = at(0.3 + tw * (k + 0.5), 0.03); b.add(g.toNonIndexed(), 'dark', o[0], 2.3, o[1], a);
    }
    // Teal sign board on the roof edge, green WATERKANT letters on it.
    b.box(mid[0], 2.85, mid[1], W0, 1.2, 0.12, 'pink', a);
    const L = raisedLettering({text: 'WATERKANT', heightM: 0.95, maxWidthM: W0 - 0.4, depthM: 0.05});
    const lp = at(len / 2, 0.06); b.add(L.geometry, 'green', lp[0], 3.45, lp[1], a);
  }
  prism(dedupe(plan.pands.store.ring), 0, 2.6, 'copper');
  prism(dedupe(plan.pands.container.ring), 0, 3.0, 'copper');
  prism(dedupe(plan.pands.kiosk.ring), 0, 3.0, 'concrete');

  // ---- terrace: blue tents and picnic tables on the canal side under the drums
  /** Picnic table, long axis along local x of yaw `a`: red top, two benches, two end frames. */
  const table = (p: V, a: number) => {
    const X: V = [Math.cos(a), -Math.sin(a)], Z: V = [Math.sin(a), Math.cos(a)];
    b.box(p[0], 0.7, p[1], 1.8, 0.06, 0.75, 'red', a);
    for (const s of [-1, 1]) {
      b.box(p[0] + Z[0] * 0.62 * s, 0.42, p[1] + Z[1] * 0.62 * s, 1.8, 0.05, 0.28, 'bronze', a);
      b.box(p[0] + X[0] * 0.75 * s, 0, p[1] + X[1] * 0.75 * s, 0.08, 0.7, 1.52, 'bronze', a);
    }
  };
  for (const [c, bearings] of [[A, [215, 240, 290, 315]], [B, [200, 225, 275, 300]]] as [V, number[]][]) for (const br of bearings) {
    const d = dir(br), p: V = [c[0] + d[0] * 7.7, c[1] + d[1] * 7.7];
    table(p, yaw(d));
  }
  for (const [c, br] of [[A, 265], [B, 250]] as [V, number][]) {
    const d = dir(br), p: V = [c[0] + d[0] * 7.6, c[1] + d[1] * 7.6];
    b.box(p[0], 0, p[1], 0.08, 2.2, 0.08, 'frame');
    b.hip(p[0], 2.2, p[1], 3.0, 3.0, 1.3, 'blue');
  }
}
