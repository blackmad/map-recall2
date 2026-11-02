import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {upwardRoofPlane} from './house-geometry';
import {edgeNormal, roofTiers, type RoofPlane} from '../../src/canalRecall/landmarks/roofTiers';
import {at, bagFrame as kitBagFrame, frameFor, inside, onBagEdge as kitOnBagEdge, ZoneMesh, type C, type Cut, type Frame, type P, type Pad, type Zone} from './zone-wall-kit';
import plan from './politie-lijnbaansgracht-footprints.json';

/**
 * Politiebureau Lijnbaansgracht, Lijnbaansgracht 219 (BAG pand 0363100012169471, bouwjaar 1977; designed by the Dienst der
 * Publieke Werken, architect Anna Clasina van Hattem, opened December 1977 - nl.wikipedia "Lijnbaansgracht 219").
 *
 * What the city panoramas show (Gemeente Amsterdam, CC BY 4.0; scripts/landmarks/politie-lijnbaansgracht-brief.md,
 * staging/landmarks/politie-lijnbaansgracht/sources.md):
 *  - a 45.5 m canal front of dark brown brick with square-ish dark-framed windows (mullion + transom, pale shutter-box
 *    strip over each head) on a 2.41 m pitch: five rows on the tall north-west block (19.85 m), four rows plus a top
 *    storey set back behind a 15.7 m parapet on the south-east part, a recessed notch above a 12.2 m terrace between them;
 *  - on the north-west block a first-storey band projecting over the quay, white bands top and bottom, six larger windows;
 *    a thin white canopy at the corner entrance;
 *  - three wide dark vehicle openings with white lintels in the south-east ground storey, a white canopy band and a pale
 *    panelled shaft rising above the parapet near the south-east end;
 *  The back walls are hidden behind neighbouring houses on every panorama; they repeat the front's brick and window grid.
 * The Harry Karssen plastiek once on the front was removed around 2017 (nl.wikipedia) and is not drawn.
 *
 * Massing: 3DBAG LoD2.2 roof planes (CC BY 4.0) snapped to levels and stacked as nested tiers (roofTiers). Frame: x east,
 * z south, y up from the 3DBAG ground (0.5 m NAP), origin = vertex average of the BAG outline (the catalogue anchor).
 * Heights on the front from the rectified w01-232 crop at 43 px/m, ground fixed by the 12.2 m terrace and 15.7 m parapet.
 */
const RING = plan.nativeRing as P[];
const LEVELS = [12.2, 15.7, 19.85, 21.0, 21.5];
const E_W01 = 1, E_W02 = 0, E_SE_PARTY = 2, E_W06 = 4;

const bagFrame = (i: number) => kitBagFrame(RING, i);
const onBagEdge = (a: P, c: P) => kitOnBagEdge(RING, a, c);
let m: ZoneMesh;
let b: BuildingTools;

/* ------------------------------------------------------------------ measured front (w01-232) */
/** Window rows [sill, head] on the front, bottom to top: the ground row is short and high (souterrain cells below). */
const ROWS: [number, number][] = [[1.98, 3.6], [5.0, 7.33], [8.37, 10.7], [11.86, 14.19], [15.47, 17.8]];
const PITCH = 2.41, COL0 = 3.98, WIN_W = 1.7;
const col = (k: number) => COL0 + PITCH * k;
const LEFT = [0, 1, 2, 3, 4, 5].map(col);                     // north-west block
const RIGHT = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map(col);  // south-east part, the last one half behind the shaft
const END_WINDOW: [number, number] = [44.05, 45.35];
const BAY: [number, number] = [2.3, 18.1], BAY_Y: [number, number] = [5.0, 7.79], BAY_OUT = 0.6, BAND = 0.23;
const BAY_COLS = [0, 1, 2, 3, 4, 5].map(k => 3.9 + 2.51 * k), BAY_WIN = 1.75;
const GARAGES: [number, number][] = [[27.2, 31.4], [32.1, 36.2], [36.9, 41.0]];
const GARAGE_HEAD = 3.6;
const SHAFT: [number, number] = [40.2, 43.5], SHAFT_Y: [number, number] = [4.9, 17.5];
const SE_CANOPY: [number, number] = [38.5, 45.5];
const DOOR: [number, number] = [0.7, 2.0];
/** The notch between the parts (t 17.6-21.7, w01-232 crop): a white terrace edge at 11.6-12.2 m, one window in the recessed wall. */
const NOTCH: [number, number] = [17.6, 21.7];
// photo: 1.5 m wide at t 18.35-19.9; the 3DBAG notch back wall parallel to the front is only t 19.0-20.2, so it is narrowed to fit
const NOTCH_WINDOW: [number, number] = [19.6, 0.95], NOTCH_WINDOW_Y: [number, number] = [13.6, 15.6];

const win = (c: number, w: number, [y0, y1]: [number, number], reveal: C = 'frame'): Cut => ({t0: c - w / 2, t1: c + w / 2, y0, y1, depth: 0.15, back: 'glass', reveal});

function frontZone(): Zone {
  const cuts: Cut[] = [];
  ROWS.forEach((r, i) => {
    for (const c of LEFT) if (i !== 1) cuts.push(win(c, WIN_W, r));          // the bay carries row 1 on the north-west block
    if (i === 4) return;                                                      // the south-east top storey is set back
    for (const c of RIGHT) {
      if (i === 0 && c > GARAGES[0][0] - 1) continue;
      if (i === 3 && c < NOTCH[1]) continue;                                  // the notch: the front stops at the 12.2 m terrace
      cuts.push(i === 1 && c - WIN_W / 2 < BAY[1] ? {...win(c, WIN_W, r), t0: BAY[1] + 0.1} : win(c, WIN_W, r));
    }
    if (i > 0) cuts.push({...win(0, 0, r), t0: END_WINDOW[0], t1: END_WINDOW[1]});
  });
  // the set-back top storey (south-east) and the notch walls carry the same columns
  for (const c of RIGHT) cuts.push({...win(c, WIN_W, ROWS[4]), y0: 16.0, y1: 18.3});
  cuts.push(win(NOTCH_WINDOW[0], NOTCH_WINDOW[1], NOTCH_WINDOW_Y));          // lands only on the recessed notch wall
  for (const [t0, t1] of GARAGES) cuts.push({t0, t1, y0: 0.1, y1: GARAGE_HEAD, depth: 0.4, back: 'dark'});
  cuts.push({t0: DOOR[0], t1: DOOR[1], y0: 0.1, y1: 2.7, depth: 0.3, back: 'dark'});
  return {t0: -0.2, t1: 46, y0: 0, y1: 30, face: 'brick', cuts};
}
/** Mullion, transom and the pale shutter-box strip of one front window. */
function windowTrim(f: Frame, c: number, w: number, y0: number, y1: number) {
  m.bar(f, c - 0.035, c + 0.035, y0, y1, -0.08, 'frame', -0.15);
  m.bar(f, c - w / 2, c + w / 2, y1 - 0.62, y1 - 0.56, -0.08, 'frame', -0.15);
  m.bar(f, c - w / 2 - 0.05, c + w / 2 + 0.05, y1, y1 + 0.13, 0.1, 'green');
}

/* ------------------------------------------------------------------ back walls (inferred) */
/**
 * The back walls stand behind the houses of the neighbouring streets: the brief panoramas for w03-w06 show those houses
 * (red brick, cream windows, header lozenges), not this building. Drawn in the front's brick with its window grid.
 */
const backCols = (len: number) => { const n = Math.max(1, Math.floor((len - 0.4) / PITCH)), p = len / n; return [...Array(n)].map((_, k) => p * (k + 0.5)); };
function backZone(len: number): Zone {
  const cuts: Cut[] = [];
  if (len >= 2.2) for (const c of backCols(len)) for (const r of ROWS) cuts.push(win(c, WIN_W, r));
  return {t0: -0.2, t1: len + 0.2, y0: 0, y1: 30, face: 'brick', cuts};
}

/* ------------------------------------------------------------------ helpers */
/** Drop openings that would keep less than 60 % of their height (or width) inside the run, so a tier edge never leaves a sliver. */
function fit(z: Zone, ta: number, tb: number, ya: number, yb: number): Zone {
  return {...z, cuts: z.cuts.filter(c => {
    const h = Math.min(c.y1, yb) - Math.max(c.y0, ya), w = Math.min(c.t1, tb) - Math.max(c.t0, ta);
    return h <= 0 || w <= 0 || (h >= 0.6 * (c.y1 - c.y0) && w >= 0.6 * (c.t1 - c.t0));
  })};
}
/** Drop ring vertices between collinear edges, so a window never straddles two runs of one straight wall. */
function mergeCollinear(r: P[]): P[] {
  let out = r.slice();
  for (let changed = true; changed && out.length > 3;) {
    changed = false;
    for (let i = 0; i < out.length; i++) {
      const a = out[(i + out.length - 1) % out.length], p = out[i], c = out[(i + 1) % out.length];
      const u: P = [p[0] - a[0], p[1] - a[1]], v: P = [c[0] - p[0], c[1] - p[1]], lu = Math.hypot(...u), lv = Math.hypot(...v);
      if (lu < 1e-6 || lv < 1e-6 || (Math.abs(u[0] * v[1] - u[1] * v[0]) / (lu * lv) < 0.004 && u[0] * v[0] + u[1] * v[1] > 0)) { out.splice(i, 1); changed = true; break; }
    }
  }
  return out;
}
const parallelFrame = (f: Frame, o: number): Frame => ({...f, o: at(f, 0, o)});
const local = (f: Frame, p: P) => [(p[0] - f.o[0]) * f.t[0] + (p[1] - f.o[1]) * f.t[1], (p[0] - f.o[0]) * f.n[0] + (p[1] - f.o[1]) * f.n[1]];

/* ------------------------------------------------------------------ build */
export function buildPolitieLijnbaansgracht(_w: number, _d: number, tools: BuildingTools) {
  b = tools;
  m = new ZoneMesh(tools);
  const {f: F1} = bagFrame(E_W01);
  const FRONT = frontZone();
  const frontRuns: {lo: number; hi: number; top: number}[] = [];
  const backFacing = (n: P) => n[0] * F1.n[0] + n[1] * F1.n[1] < -0.5;

  // 3DBAG shows a 0.6 m V-dent in the front at the joint between the parts (t 17.6-18.9); the photo shows flush brick there
  // and the tall block ending at 17.6 m, so the dent's apex moves onto the front line at 17.6 m
  // and the notch's south-east corner on the front at 21.7 m (3DBAG 20.8 m; the photo's notch spans the 20.8 m window column)
  const flushDent = (p: P): P => {
    const [t, o] = local(F1, p);
    if (t > 17 && t < 19.5 && o < -0.05 && o > -0.8) return at(F1, NOTCH[0], 0);
    if (t > 20.5 && t < 21.1 && Math.abs(o) < 0.25) return at(F1, NOTCH[1], 0);
    return p;
  };
  const planes: RoofPlane[] = plan.roofs.map(r => ({ring: r.rings[0].map(p => flushDent([p[0], p[2]] as P)), height: r.rings[0].reduce((s, p) => s + p[1], 0) / r.rings[0].length}));
  const tiers = roofTiers(planes, {levels: LEVELS, minAreaM2: 2, simplifyM: 0.12});
  const inPlan = (k: number, p: P) => k >= 0 && k < tiers.length && tiers[k].plan.some(([outer, ...holes]) => inside(p, outer) && !holes.some(h => inside(p, h)));

  tiers.forEach((tier, k) => {
    for (const poly of tier.plan) for (const raw of poly) {
      const ring = mergeCollinear(raw);
      for (let i = 0; i < ring.length; i++) {
      const a = ring[i], c = ring[(i + 1) % ring.length], n = edgeNormal(a, c), L = Math.hypot(c[0] - a[0], c[1] - a[1]);
      if (L < 0.05) continue;
      const y0 = tier.bottom;
      if (y0 >= tier.top - 0.02) continue;
      const mid: P = [(a[0] + c[0]) / 2 + n[0] * 0.3, (a[1] + c[1]) / 2 + n[1] * 0.3];
      const inward: P = [(a[0] + c[0]) / 2 - n[0] * 0.3, (a[1] + c[1]) / 2 - n[1] * 0.3];
      const pad: Pad = {b: y0 > 0.01 && inPlan(k - 1, mid) ? 0.15 : 0, t: inPlan(k + 1, inward) ? 0 : 0.15, ends: 0.08};
      const plant = tier.top > 20.5;
      const raw = onBagEdge(a, c);
      // 3DBAG corners sit up to 0.3 m off the BAG corners (tiny chamfer edges): runs on a BAG edge reach its corners
      const hit = raw && {...raw, ta: raw.ta < 0.4 ? 0 : raw.ta, tb: raw.tb > bagFrame(raw.i).len - 0.4 ? bagFrame(raw.i).len : raw.tb};
      const parallel = n[0] * F1.n[0] + n[1] * F1.n[1] > 0.98;
      if (plant) {
        const {f, len} = frameFor(a, c, n);
        m.emitZone(f, {t0: -0.2, t1: len + 0.2, y0: 0, y1: 30, face: 'brick', cuts: []}, 0, len, y0, tier.top, pad);
      } else if (parallel && Math.abs(local(F1, a)[1]) < 0.25 && Math.abs(local(F1, c)[1]) < 0.25) {
        // on the BAG front line: collected and emitted below as full-height strips (no seam at the tier levels)
        const ta = local(F1, a)[0], tb = local(F1, c)[0], L1 = bagFrame(E_W01).len;
        const lo = Math.min(ta, tb), hi = Math.max(ta, tb);
        frontRuns.push({lo: lo < 0.4 ? 0 : lo, hi: hi > L1 - 0.4 ? L1 : hi, top: tier.top});
      } else if (parallel) {
        // the canal front and every wall parallel to it (set-back storey, notch) share the front's t frame and columns
        // own frame (3DBAG walls are a few tenths of a degree off the BAG line), columns placed in the front's t
        const {f, len} = frameFor(a, c, n), off = local(F1, f.o)[0];
        const z = fit(FRONT, off, off + len, y0 + pad.b, tier.top - pad.t);
        m.emitZone(f, {...z, t0: z.t0 - off, t1: z.t1 - off, cuts: z.cuts.map(q => ({...q, t0: q.t0 - off, t1: q.t1 - off}))}, 0, len, y0, tier.top, pad);
      } else if (hit && hit.i === E_W02) {
        const {f, len} = bagFrame(E_W02);
        const cuts = ROWS.flatMap(r => [1.7, 3.9, 6.1].map(cc => win(cc, 1.6, r)));
        m.emitZone(f, fit({t0: -0.2, t1: len + 0.2, y0: 0, y1: 30, face: 'brick', cuts}, hit.ta, hit.tb, y0, tier.top), hit.ta, hit.tb, y0, tier.top, pad);
      } else if (hit && hit.i === E_SE_PARTY) {
        const {f, len} = bagFrame(E_SE_PARTY);
        m.emitZone(f, {t0: -0.2, t1: len + 0.2, y0: 0, y1: 30, face: 'brick', cuts: []}, hit.ta, hit.tb, y0, tier.top, pad);
      } else if (backFacing(n) || (hit && hit.i === E_W06)) {
        const {f, len} = hit ? bagFrame(hit.i) : frameFor(a, c, n);
        const [ta, tb] = hit ? [hit.ta, hit.tb] : [0, len];
        const z = fit(backZone(len), ta, tb, y0 + pad.b, tier.top - pad.t);
        m.emitZone(f, z, ta, tb, y0, tier.top, pad);
      } else {
        // short side returns (notch cheeks, steps): plain brick of the face they belong to
        const {f, len} = frameFor(a, c, n);
        m.emitZone(f, {t0: -0.2, t1: len + 0.2, y0: 0, y1: 30, face: 'brick', cuts: []}, 0, len, y0, tier.top, pad);
      }
      m.flush();
      }
    }
    for (const poly of tier.roof) {
      const [outer, ...holes] = poly, s = new T.Shape(outer.map(([x, z]) => new T.Vector2(x, z)));
      for (const h of holes) s.holes.push(new T.Path(h.map(([x, z]) => new T.Vector2(x, z))));
      b.add(upwardRoofPlane(s, tier.top), 'slate');
    }
  });

  // ---- the canal front as vertical strips, each from the pavement to the highest tier standing on the BAG line there
  {
    const cutsAt = [...new Set(frontRuns.flatMap(r => [r.lo, r.hi]).map(v => +v.toFixed(3)))].sort((p, q) => p - q);
    const strips: {lo: number; hi: number; top: number}[] = [];
    for (let i = 0; i + 1 < cutsAt.length; i++) {
      const lo = cutsAt[i], hi = cutsAt[i + 1], mid = (lo + hi) / 2;
      const top = Math.max(0, ...frontRuns.filter(r => r.lo <= mid && r.hi >= mid).map(r => r.top));
      if (top <= 0 || hi - lo < 0.01) continue;
      const last = strips[strips.length - 1];
      if (last && Math.abs(last.top - top) < 1e-3 && Math.abs(last.hi - lo) < 1e-3) last.hi = hi; else strips.push({lo, hi, top});
    }
    const {f: FB} = bagFrame(E_W01);
    for (const st of strips) m.emitZone(FB, fit(FRONT, st.lo, st.hi, 0, st.top - 0.15), st.lo, st.hi, 0, st.top, {b: 0, t: 0.15, ends: 0});
    m.flush();
  }

  // ---- front window trim on every front-parallel window that was cut (main wall rows; the set-back storey)
  {
    const {len: L1} = bagFrame(E_W01);
    const rowsAt = (c: number) => ROWS.map((r, i) => ({r, i})).filter(({i}) => {
      const left = c < BAY[1];
      if (left) return i !== 1;
      if (i === 0) return c < GARAGES[0][0] - 1;
      if (i === 3) return c > NOTCH[1];
      return i < 4;
    });
    for (const c of [...LEFT, ...RIGHT]) for (const {r} of rowsAt(c)) {
      if (c + WIN_W / 2 > SHAFT[0] && r[0] > SHAFT_Y[0] - 0.5) continue;      // behind the shaft
      if (r[0] === ROWS[1][0] && c - WIN_W / 2 < BAY[1]) { const t0 = BAY[1] + 0.1, t1 = c + WIN_W / 2; m.bar(F1, t0 - 0.05, t1 + 0.05, r[1], r[1] + 0.13, 0.1, 'green'); continue; }
      windowTrim(F1, c, WIN_W, r[0], r[1]);
    }
    m.flush();
    // white lintels over the vehicle openings, the corner door frame
    for (const [t0, t1] of GARAGES) m.bar(F1, t0 - 0.1, t1 + 0.1, GARAGE_HEAD, GARAGE_HEAD + 0.12, 0.1, 'white');
    void L1;
  }

  // ---- the first-storey band (bay) on the north-west block
  {
    const [t0, t1] = BAY, [y0, y1] = BAY_Y, f = parallelFrame(F1, BAY_OUT);
    const cuts = BAY_COLS.map(c => ({...win(c, BAY_WIN, [y0 + BAND + 0.12, y1 - BAND - 0.12])}));
    m.emitZone(f, {t0, t1, y0: y0 + BAND, y1: y1 - BAND, face: 'brick', cuts}, t0, t1, y0 + BAND, y1 - BAND, {b: 0, t: 0, ends: 0.1});
    m.flush();
    m.bar(F1, t0, t1, y0, y0 + BAND, BAY_OUT + 0.1, 'white');
    m.bar(F1, t0, t1, y1 - BAND, y1, BAY_OUT + 0.1, 'white');
    // side returns of the band storey
    m.quad(F1, {pts: [[t0, y0 + BAND, 0], [t0, y0 + BAND, BAY_OUT], [t0, y1 - BAND, BAY_OUT], [t0, y1 - BAND, 0]], normal: [-1, 0, 0]}, 'brick');
    m.quad(F1, {pts: [[t1, y0 + BAND, 0], [t1, y1 - BAND, 0], [t1, y1 - BAND, BAY_OUT], [t1, y0 + BAND, BAY_OUT]], normal: [1, 0, 0]}, 'brick');
    m.flush();
    for (const c of BAY_COLS) {
      const fb = parallelFrame(F1, BAY_OUT);
      m.bar(fb, c - 0.035, c + 0.035, y0 + BAND + 0.12, y1 - BAND - 0.12, -0.08, 'frame', -0.15);
    }
    // corner canopy over the entrance and the NW end's white bands (the band storey's return, simplified)
    m.bar(F1, 0.3, BAY[0], 6.95, 7.2, 0.75, 'white');
    const {f: F2, len: L2} = bagFrame(E_W02);
    m.bar(F2, 0, L2, y0, y0 + BAND, 0.1, 'white');
    m.bar(F2, 0, L2, y1 - BAND, y1, 0.1, 'white');
    m.flush();
  }

  // ---- the notch's white terrace edge (11.6-12.2 m across the notch)
  m.bar(F1, NOTCH[0], NOTCH[1], 11.6, 12.25, 0.1, 'white');
  m.flush();

  // ---- the south-east canopy band and the pale panelled shaft
  {
    const [s0, s1] = SHAFT;
    m.bar(F1, SE_CANOPY[0], SE_CANOPY[1] - 0.05, SHAFT_Y[0] - 0.7, SHAFT_Y[0], 1.0, 'white');
    m.bar(F1, s0, s1, SHAFT_Y[0], SHAFT_Y[1], 0.45, 'stone');
    for (const t of [s0 + 0.8, (s0 + s1) / 2, s1 - 0.8]) m.bar(F1, t - 0.03, t + 0.03, SHAFT_Y[0] + 0.2, SHAFT_Y[1] - 0.2, 0.56, 'frame', 0.45);
    m.flush();
  }
}
